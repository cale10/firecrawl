export enum WebhookEventType {
  CRAWL_STARTED = "crawl.started",
  CRAWL_PAGE = "crawl.page",
  CRAWL_COMPLETED = "crawl.completed",
  CRAWL_FAILED = "crawl.failed",
  BATCH_SCRAPE_STARTED = "batch_scrape.started",
  BATCH_SCRAPE_PAGE = "batch_scrape.page",
  BATCH_SCRAPE_COMPLETED = "batch_scrape.completed",
  EXTRACT_STARTED = "extract.started",
  EXTRACT_COMPLETED = "extract.completed",
  EXTRACT_FAILED = "extract.failed",
}

export interface WebhookConfig {
  url: string;
  headers: Record<string, string>;
  metadata: Record<string, string>;
  events: string[];
}

export interface WebhookContext {
  teamId: string;
  crawlId: string;
  scrapeId?: string;
  v1: boolean;
  webhook?: WebhookConfig;
  awaitWebhook?: boolean;
}

export interface WebhookLogData {
  success: boolean;
  error?: string;
  teamId: string;
  crawlId: string;
  scrapeId?: string;
  url: string;
  statusCode?: number;
  event: WebhookEventType;
}

interface BaseWebhookPayload {
  success: boolean;
  type: WebhookEventType;
  metadata?: Record<string, string>;
  jobId: string;
  id?: string; // TODO: remove at some point (v1 feature)
}

// generic types
export interface WebhookDocument {
  content: string;
  markdown?: string;
  metadata: Record<string, any>;
}

export interface WebhookDocumentLink {
  content: WebhookDocument;
  source: string;
}

// crawl
export interface CrawlStartedWebhookPayload extends BaseWebhookPayload {
  type: WebhookEventType.CRAWL_STARTED;
  data: [];
}

export interface CrawlPageWebhookPayload extends BaseWebhookPayload {
  type: WebhookEventType.CRAWL_PAGE;
  data: WebhookDocument[];
  error?: string;
}

export interface CrawlCompletedWebhookPayload extends BaseWebhookPayload {
  type: WebhookEventType.CRAWL_COMPLETED;
  data: WebhookDocumentLink[];
}

export interface CrawlCompletedV1WebhookPayload extends BaseWebhookPayload {
  type: WebhookEventType.CRAWL_COMPLETED;
  data: WebhookDocument[];
}

export interface CrawlFailedWebhookPayload extends BaseWebhookPayload {
  type: WebhookEventType.CRAWL_FAILED;
  data: [];
  error: string;
}

// batch
export interface BatchScrapeStartedWebhookPayload extends BaseWebhookPayload {
  type: WebhookEventType.BATCH_SCRAPE_STARTED;
  data: [];
}

export interface BatchScrapePageWebhookPayload extends BaseWebhookPayload {
  type: WebhookEventType.BATCH_SCRAPE_PAGE;
  data: WebhookDocument[];
  error?: string;
}

export interface BatchScrapeCompletedWebhookPayload extends BaseWebhookPayload {
  type: WebhookEventType.BATCH_SCRAPE_COMPLETED;
  data: WebhookDocumentLink[];
}

export interface BatchScrapeCompletedV1WebhookPayload
  extends BaseWebhookPayload {
  type: WebhookEventType.BATCH_SCRAPE_COMPLETED;
  data: WebhookDocument[];
}

// extract
export interface ExtractStartedWebhookPayload extends BaseWebhookPayload {
  type: WebhookEventType.EXTRACT_STARTED;
  data: [];
}

export interface ExtractCompletedWebhookPayload extends BaseWebhookPayload {
  type: WebhookEventType.EXTRACT_COMPLETED;
  data: any;
}

export interface ExtractFailedWebhookPayload extends BaseWebhookPayload {
  type: WebhookEventType.EXTRACT_FAILED;
  data: [];
  error: string;
}

export type WebhookPayload =
  | CrawlStartedWebhookPayload
  | CrawlPageWebhookPayload
  | CrawlCompletedWebhookPayload
  | CrawlCompletedV1WebhookPayload
  | CrawlFailedWebhookPayload
  | BatchScrapeStartedWebhookPayload
  | BatchScrapePageWebhookPayload
  | BatchScrapeCompletedWebhookPayload
  | BatchScrapeCompletedV1WebhookPayload
  | ExtractStartedWebhookPayload
  | ExtractCompletedWebhookPayload
  | ExtractFailedWebhookPayload;
