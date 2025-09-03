import undici from "undici";
import { createHmac } from "crypto";
import { logger as _logger } from "../../lib/logger";
import {
  getSecureDispatcher,
  isIPPrivate,
} from "../../scraper/scrapeURL/engines/utils/safeFetch";
import {
  WebhookConfig,
  WebhookContext,
  WebhookLogData,
  WebhookPayload,
} from "./types";
import { redisEvictConnection } from "../redis";
import { supabase_service } from "../supabase";

const WEBHOOK_INSERT_QUEUE_KEY = "webhook-insert-queue";
const WEBHOOK_INSERT_BATCH_SIZE = 1000;

export interface WebhookDeliveryOptions {
  webhookUrl: WebhookConfig;
  hmacSecret?: string;
  payload: WebhookPayload;
  context: WebhookContext;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

function generateHmacSignature(payload: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  return hmac.digest("hex");
}

async function addWebhookInsertJob(data: any) {
  await redisEvictConnection.rpush(
    WEBHOOK_INSERT_QUEUE_KEY,
    JSON.stringify(data),
  );
}

export async function getWebhookInsertQueueLength(): Promise<number> {
  return (await redisEvictConnection.llen(WEBHOOK_INSERT_QUEUE_KEY)) ?? 0;
}

async function getWebhookInsertJobs(): Promise<any[]> {
  const jobs =
    (await redisEvictConnection.lpop(
      WEBHOOK_INSERT_QUEUE_KEY,
      WEBHOOK_INSERT_BATCH_SIZE,
    )) ?? [];
  return jobs.map(x => JSON.parse(x));
}

export async function processWebhookInsertJobs() {
  const jobs = await getWebhookInsertJobs();
  if (jobs.length === 0) {
    return;
  }
  const logger = _logger.child({
    module: "webhook-delivery",
    method: "processWebhookInsertJobs",
  });
  logger.info(`Webhook inserter found jobs to insert`, {
    jobCount: jobs.length,
  });
  try {
    const { error } = await supabase_service.from("webhook_logs").insert(jobs);
    if (error) {
      throw error;
    }
    logger.info(`Webhook inserter inserted jobs`, { jobCount: jobs.length });
  } catch (error) {
    logger.error(`Webhook inserter failed to insert jobs`, {
      error,
      jobCount: jobs.length,
    });
  }
}

async function logWebhook(data: WebhookLogData) {
  try {
    await addWebhookInsertJob({
      success: data.success,
      error: data.error ?? null,
      team_id: data.teamId,
      crawl_id: data.crawlId,
      scrape_id: data.scrapeId ?? null,
      url: data.url,
      status_code: data.statusCode ?? null,
      event: data.event,
    });
  } catch (error) {
    _logger.error("Error logging webhook", {
      error,
      crawlId: data.crawlId,
      scrapeId: data.scrapeId,
      teamId: data.teamId,
      team_id: data.teamId,
      module: "webhook-delivery",
      method: "logWebhook",
    });
  }
}

export async function deliverWebhook(
  options: WebhookDeliveryOptions,
): Promise<WebhookDeliveryResult> {
  const { webhookUrl, hmacSecret, payload, context } = options;

  const logger = _logger.child({
    module: "webhook-delivery",
    method: "deliverWebhook",
    teamId: context.teamId,
    crawlId: context.crawlId,
    scrapeId: context.scrapeId,
    webhookUrl: webhookUrl.url,
  });

  // check if the webhook URL is a private IP address (early exit, we also later check in the dispatcher)
  try {
    const webhookHost = new URL(webhookUrl.url).hostname;
    if (isIPPrivate(webhookHost)) {
      logger.warn("Aborting webhook call to private IP address", {
        url: webhookUrl.url,
      });
      return { success: false, error: "Private IP address not allowed" };
    }
  } catch (error) {
    logger.error("Invalid webhook URL", { error, url: webhookUrl.url });
    return { success: false, error: "Invalid webhook URL" };
  }

  const payloadString = JSON.stringify(payload);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...webhookUrl.headers,
  };

  if (hmacSecret) {
    const signature = generateHmacSignature(payloadString, hmacSecret);
    headers["X-Firecrawl-Signature"] = `sha256=${signature}`;
  }

  const timeout = context.v1 ? 10000 : 30000; // 10s for v1, 30s for v2

  try {
    logger.debug("Sending webhook request", {
      url: webhookUrl.url,
      headers: Object.keys(headers),
      payloadSize: payloadString.length,
      timeout,
    });

    const res = await undici.fetch(webhookUrl.url, {
      method: "POST",
      headers,
      body: payloadString,
      dispatcher: getSecureDispatcher(),
      signal: AbortSignal.timeout(timeout),
    });

    const success = res.ok;
    const statusCode = res.status;

    await logWebhook({
      success,
      teamId: context.teamId,
      crawlId: context.crawlId,
      scrapeId: context.scrapeId,
      url: webhookUrl.url,
      event: payload.type,
      statusCode,
    });

    if (!success) {
      logger.warn("Webhook request failed", {
        statusCode,
        statusText: res.statusText,
      });
      return {
        success: false,
        statusCode,
        error: `HTTP ${statusCode}: ${res.statusText}`,
      };
    }

    logger.info("Webhook delivered successfully", { statusCode });
    return { success: true, statusCode };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown error";

    const statusCode =
      typeof (error as any)?.status === "number"
        ? (error as any).status
        : undefined;

    logger.error("Webhook delivery failed", {
      error: errorMessage,
      statusCode,
    });

    await logWebhook({
      success: false,
      teamId: context.teamId,
      crawlId: context.crawlId,
      scrapeId: context.scrapeId,
      url: webhookUrl.url,
      event: payload.type,
      error: errorMessage,
      statusCode,
    });

    return {
      success: false,
      statusCode,
      error: errorMessage,
    };
  }
}
