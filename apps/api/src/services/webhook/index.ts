import { getWebhookConfig } from "./config";
import { deliverWebhook } from "./delivery";
import {
  WebhookConfig,
  WebhookContext,
  WebhookEventType,
  WebhookPayload,
} from "./types";

export {
  getWebhookInsertQueueLength,
  processWebhookInsertJobs,
} from "./delivery";
export { getWebhookConfig } from "./config";
export * from "./types";

export function shouldSendEvent(
  webhook: WebhookConfig | null,
  event: WebhookEventType,
) {
  if (!webhook) return false;
  try {
    // events schema contains ["completed","failed","page","started"]
    const subType = event.split(".")[1] as any;
    return Array.isArray(webhook.events)
      ? (webhook.events as any[]).includes(subType)
      : true;
  } catch {
    return true;
  }
}

export interface WebhookSenderOptions {
  awaitWebhook?: boolean;
}

export interface WebhookSender {
  webhookUrl: WebhookConfig;
  hmacSecret?: string;
  context: WebhookContext;
  send: (
    payload: WebhookPayload,
    opts?: WebhookSenderOptions & { scrapeId?: string },
  ) => Promise<void>;
}

export async function createWebhookSender(
  context: WebhookContext,
): Promise<WebhookSender | null> {
  const { webhookUrl, hmacSecret } = await getWebhookConfig(
    context.teamId,
    context.crawlId,
    context.webhook as any,
  );

  if (!webhookUrl) return null;

  return {
    webhookUrl,
    hmacSecret,
    context,
    send: async (payload, opts) => {
      if (!shouldSendEvent(webhookUrl, payload.type)) return;

      if (context.v1) {
        payload.id = payload.jobId;
        // @ts-ignore temporary until v1 is deprecated
        delete payload.jobId;
      }

      const result = deliverWebhook({
        webhookUrl,
        hmacSecret,
        payload,
        context: { ...context, scrapeId: opts?.scrapeId },
      });

      if (opts?.awaitWebhook || context.awaitWebhook) {
        await result;
      } else {
        result.catch(() => {});
      }
    },
  };
}
