import { logger as _logger } from "../../lib/logger";
import { supabase_rr_service } from "../supabase";
import { webhookSchema } from "./schema";
import { WebhookConfig } from "./types";
import { z } from "zod";

export interface WebhookConfigResult {
  webhookUrl: WebhookConfig | null;
  hmacSecret: string | undefined;
}

export async function getWebhookConfig(
  teamId: string,
  crawlId: string,
  webhook?: z.infer<typeof webhookSchema>,
): Promise<WebhookConfigResult> {
  const logger = _logger.child({
    module: "webhook-config",
    method: "getWebhookConfig",
    teamId,
    crawlId,
  });

  // Handle self-hosted webhook URL
  const selfHostedUrl = process.env.SELF_HOSTED_WEBHOOK_URL?.replace(
    "{{JOB_ID}}",
    crawlId,
  );

  const useDbAuthentication = process.env.USE_DB_AUTHENTICATION === "true";

  let webhookUrl: WebhookConfig | null =
    webhook ??
    (selfHostedUrl ? webhookSchema.parse({ url: selfHostedUrl }) : null);

  // Only fetch the webhook URL from the database if the self-hosted webhook URL and webhook are not set
  // and the USE_DB_AUTHENTICATION environment variable is set to true
  if (!webhookUrl && useDbAuthentication) {
    try {
      const { data: webhooksData, error } = await supabase_rr_service
        .from("webhooks")
        .select("url")
        .eq("team_id", teamId)
        .limit(1);

      if (error) {
        logger.error("Error fetching webhook URL for team", { error });
        return { webhookUrl: null, hmacSecret: undefined };
      }

      if (!webhooksData || webhooksData.length === 0) {
        return { webhookUrl: null, hmacSecret: undefined };
      }

      webhookUrl = webhooksData[0].url;
    } catch (error) {
      logger.error("Error fetching webhook config", { error });
      return { webhookUrl: null, hmacSecret: undefined };
    }
  }

  let hmacSecret: string | undefined =
    process.env.SELF_HOSTED_WEBHOOK_HMAC_SECRET;

  if (useDbAuthentication) {
    try {
      const { data: teamData, error: teamError } = await supabase_rr_service
        .from("teams")
        .select("hmac_secret")
        .eq("id", teamId)
        .limit(1)
        .single();

      if (teamError) {
        logger.error("Error fetching team HMAC secret", { error: teamError });
      } else if (teamData?.hmac_secret) {
        hmacSecret = teamData.hmac_secret;
      }
    } catch (error) {
      logger.error("Error fetching HMAC secret", { error });
    }
  }

  return { webhookUrl, hmacSecret };
}
