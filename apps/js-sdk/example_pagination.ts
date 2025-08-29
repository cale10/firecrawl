import { config } from "dotenv";
import { Firecrawl } from "./firecrawl/src/index";

config();

async function main() {
  const apiKey = process.env.FIRECRAWL_API_KEY || "fc-YOUR_API_KEY";
  const client = new Firecrawl({ apiKey });

  // --- Crawl examples ---
  
  // Method 1: Simple crawl - automatically waits for completion and returns all results
  // Use this when you want all the data and don't need to control pagination
  const crawlAll = await client.crawl("https://docs.firecrawl.dev", { limit: 5 });
  console.log("crawl auto (default):", crawlAll.status, "docs:", crawlAll.data.length, "next:", crawlAll.next);

  // Method 2: Manual crawl with pagination control
  // Use this when you need to control how many pages to fetch or want to process results incrementally
  const crawlStart = await client.startCrawl("https://docs.firecrawl.dev", { limit: 5 });
  const crawlJobId = crawlStart.id;

  // Get just the first page of results (useful for large crawls where you want to process incrementally)
  const crawlSingle = await client.getCrawlStatus(crawlJobId, { autoPaginate: false });
  console.log("crawl single page:", crawlSingle.status, "docs:", crawlSingle.data.length, "next:", crawlSingle.next);

  // Get multiple pages with custom limits (useful for controlling memory usage or processing time)
  const crawlLimited = await client.getCrawlStatus(crawlJobId, {
    autoPaginate: true,
    maxPages: 2,        // Only fetch 2 pages maximum
    maxResults: 50,     // Only fetch 50 results maximum
    maxWaitTime: 15,    // Wait maximum 15 seconds for completion
  });
  console.log("crawl limited:", crawlLimited.status, "docs:", crawlLimited.data.length, "next:", crawlLimited.next);

  // --- Batch scrape examples ---
  
  // Method 1: Simple batch scrape - automatically waits for completion and returns all results
  // Use this when you want all the data from multiple URLs and don't need to control pagination
  const batchAll = await client.batchScrape([
    "https://docs.firecrawl.dev",
    "https://firecrawl.dev",
  ], { options: { formats: ["markdown"] } });
  console.log("batch auto (default):", batchAll.status, "docs:", batchAll.data.length, "next:", batchAll.next);

  // Method 2: Manual batch scrape with pagination control
  // Use this when you need to control how many pages to fetch or want to process results incrementally
  const batchStart = await client.startBatchScrape([
    "https://docs.firecrawl.dev",
    "https://firecrawl.dev",
  ], { options: { formats: ["markdown"] } });
  const batchJobId = batchStart.id;

  // Get just the first page of results
  const batchSingle = await client.getBatchScrapeStatus(batchJobId, { autoPaginate: false });
  console.log("batch single page:", batchSingle.status, "docs:", batchSingle.data.length, "next:", batchSingle.next);

  // Get multiple pages with custom limits
  const batchLimited = await client.getBatchScrapeStatus(batchJobId, {
    autoPaginate: true,
    maxPages: 2,        // Only fetch 2 pages maximum
    maxResults: 100,    // Only fetch 100 results maximum
    maxWaitTime: 20,    // Wait maximum 20 seconds for completion
  });
  console.log("batch limited:", batchLimited.status, "docs:", batchLimited.data.length, "next:", batchLimited.next);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


