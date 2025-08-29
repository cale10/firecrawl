import { config } from "dotenv";
import { Firecrawl } from "./firecrawl/src/index";

config();

async function main() {
  const apiKey = process.env.FIRECRAWL_API_KEY || "fc-YOUR_API_KEY";
  const client = new Firecrawl({ apiKey });

  // --- Crawl examples ---
  const crawlStart = await client.startCrawl("https://docs.firecrawl.dev", { limit: 5 });
  const crawlJobId = crawlStart.id;

  // Default: auto-paginate = true (fetches all pages, next will be null)
  const crawlAll = await client.getCrawlStatus(crawlJobId);
  console.log("crawl auto (default):", crawlAll.status, "docs:", crawlAll.data.length, "next:", crawlAll.next);

  // Disable auto-pagination: returns a single page and a `next` URL if more data is available
  const crawlSingle = await client.getCrawlStatus(crawlJobId, { autoPaginate: false });
  console.log("crawl single page:", crawlSingle.status, "docs:", crawlSingle.data.length, "next:", crawlSingle.next);

  // Auto-paginate with limits
  const crawlLimited = await client.getCrawlStatus(crawlJobId, {
    autoPaginate: true,
    maxPages: 2,
    maxResults: 50,
    maxWaitTime: 15, // seconds
  });
  console.log("crawl limited:", crawlLimited.status, "docs:", crawlLimited.data.length, "next:", crawlLimited.next);

  // --- Batch scrape examples ---
  const batchStart = await client.startBatchScrape([
    "https://docs.firecrawl.dev",
    "https://firecrawl.dev",
  ], { options: { formats: ["markdown"] } });
  const batchJobId = batchStart.id;

  // Default: auto-paginate = true
  const batchAll = await client.getBatchScrapeStatus(batchJobId);
  console.log("batch auto (default):", batchAll.status, "docs:", batchAll.data.length, "next:", batchAll.next);

  // Disable auto-pagination
  const batchSingle = await client.getBatchScrapeStatus(batchJobId, { autoPaginate: false });
  console.log("batch single page:", batchSingle.status, "docs:", batchSingle.data.length, "next:", batchSingle.next);

  // Auto-paginate with limits
  const batchLimited = await client.getBatchScrapeStatus(batchJobId, {
    autoPaginate: true,
    maxPages: 2,
    maxResults: 100,
    maxWaitTime: 20, // seconds
  });
  console.log("batch limited:", batchLimited.status, "docs:", batchLimited.data.length, "next:", batchLimited.next);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


