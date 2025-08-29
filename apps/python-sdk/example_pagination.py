"""
Example demonstrating pagination functionality in Firecrawl v2 SDK.

This example shows how to use the new pagination features for both crawl and batch scrape operations.
"""

from firecrawl import FirecrawlApp
from firecrawl.v2.types import PaginationConfig

# Initialize the client
client = FirecrawlApp(api_key="your-api-key")

# Example 1: Auto-pagination (default behavior)
print("=== Example 1: Auto-pagination (default) ===")
crawl_job = client.crawl("https://example.com", limit=100)
status = client.get_crawl_status(crawl_job.id)
print(f"Total documents fetched: {len(status.data)}")
print(f"Next URL: {status.next}")  # Should be None since auto-pagination is enabled

# Example 2: Manual pagination - get only first page
print("\n=== Example 2: Manual pagination ===")
crawl_job = client.crawl("https://example.com", limit=100)
pagination_config = PaginationConfig(auto_paginate=False)
status = client.get_crawl_status(crawl_job.id, pagination_config=pagination_config)
print(f"Documents from first page: {len(status.data)}")
print(f"Next URL: {status.next}")  # Will show the next page URL

# Example 3: Limited pagination - fetch only 3 pages
print("\n=== Example 3: Limited pagination ===")
pagination_config = PaginationConfig(max_pages=3)
status = client.get_crawl_status(crawl_job.id, pagination_config=pagination_config)
print(f"Documents from first 3 pages: {len(status.data)}")

# Example 4: Result-limited pagination - stop after 50 results
print("\n=== Example 4: Result-limited pagination ===")
pagination_config = PaginationConfig(max_results=50)
status = client.get_crawl_status(crawl_job.id, pagination_config=pagination_config)
print(f"Documents (max 50): {len(status.data)}")

# Example 5: Time-limited pagination - stop after 30 seconds
print("\n=== Example 5: Time-limited pagination ===")
pagination_config = PaginationConfig(max_wait_time=30)
status = client.get_crawl_status(crawl_job.id, pagination_config=pagination_config)
print(f"Documents fetched within 30 seconds: {len(status.data)}")

# Example 6: Combined pagination limits
print("\n=== Example 6: Combined limits ===")
pagination_config = PaginationConfig(
    max_pages=5,
    max_results=100,
    max_wait_time=60
)
status = client.get_crawl_status(crawl_job.id, pagination_config=pagination_config)
print(f"Documents with combined limits: {len(status.data)}")

# Example 7: Batch scrape with pagination
print("\n=== Example 7: Batch scrape pagination ===")
urls = ["https://example1.com", "https://example2.com", "https://example3.com"]
batch_job = client.batch_scrape_urls(urls)
status = client.get_batch_scrape_status(batch_job.id)
print(f"Batch scrape documents: {len(status.data)}")

# Example 8: Async usage
print("\n=== Example 8: Async pagination ===")
import asyncio
from firecrawl import AsyncFirecrawlApp

async def async_example():
    async_client = AsyncFirecrawlApp(api_key="your-api-key")
    
    # Start a crawl
    crawl_job = await async_client.async_crawl_url("https://example.com", limit=50)
    
    # Get status with pagination
    pagination_config = PaginationConfig(max_pages=2)
    status = await async_client.get_crawl_status(
        crawl_job.id, 
        pagination_config=pagination_config
    )
    print(f"Async crawl documents: {len(status.data)}")

# Run async example
# asyncio.run(async_example())
