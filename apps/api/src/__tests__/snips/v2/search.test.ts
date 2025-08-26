import { search, idmux, Identity } from "./lib";

let identity: Identity;

beforeAll(async () => {
  identity = await idmux({
    name: "search",
    concurrency: 100,
    credits: 1000000,
  });
}, 10000);

describe("Search tests", () => {
  it.concurrent("works", async () => {
    const res = await search({
      query: "firecrawl"
    }, identity);
    expect(res.web).toBeDefined();
    expect(res.web?.length).toBeGreaterThan(0);
  }, 60000);

  it.concurrent("works with scrape", async () => {
    const res = await search({
      query: "coconut",
      limit: 5,
      scrapeOptions: {
        formats: ["markdown"],
      },
      timeout: 120000,
    }, identity);

    for (const doc of res.web ?? []) {
      expect(doc.markdown).toBeDefined();
    }
  }, 125000);

  it.concurrent("works with PDF maxPages in scrapeOptions", async () => {
    const res = await search({
      query: "filetype:pdf test",
      limit: 1,
      scrapeOptions: {
        formats: ["markdown"],
        parsers: [{ type: "pdf", maxPages: 1 }],
      },
      timeout: 120000,
    }, identity);

    expect(res.web).toBeDefined();
    if (res.web && res.web.length > 0) {
      const pdfResult = res.web.find(doc => doc.metadata?.numPages !== undefined);
      if (pdfResult) {
        expect(pdfResult.metadata?.numPages).toBe(1);
        expect(pdfResult.markdown).toBeDefined();
      }
    }
  }, 125000);
});
