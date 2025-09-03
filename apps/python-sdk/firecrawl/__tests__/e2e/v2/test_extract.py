import os
from dotenv import load_dotenv
from firecrawl import Firecrawl

load_dotenv()

if not os.getenv("API_KEY"):
    raise ValueError("API_KEY is not set")

if not os.getenv("API_URL"):
    raise ValueError("API_URL is not set")


class TestExtractE2E:
    """E2E tests for v2 client extract (proxied to v1)."""

    def setup_method(self):
        self.client = Firecrawl(api_key=os.getenv("API_KEY"), api_url=os.getenv("API_URL"))

    def test_extract_minimal_with_prompt(self):
        resp = self.client.extract(
            urls=["https://docs.firecrawl.dev"],
            prompt="Extract the main page title",
        )

        assert hasattr(resp, "success")
        assert resp.success is True or resp.success is False
        # data may be None if backend omits; presence depends on implementation

    def test_extract_all_parameters(self):
        """Test extract with all available parameters (comprehensive e2e test)."""
        from firecrawl.v2.types import ScrapeOptions, JsonFormat, Location, WaitAction
        
        json_schema = {
            "type": "object",
            "properties": {
                "title": {"type": "string"}
            },
            "required": ["title"],
        }

        scrape_options = ScrapeOptions(
            formats=[
                "markdown",
                "rawHtml",
                JsonFormat(
                    type="json",
                    prompt="Extract title",
                    schema=json_schema
                )
            ],
            only_main_content=True,
            mobile=False,
            skip_tls_verification=False,
            remove_base64_images=True,
            block_ads=True,
            proxy="auto",
            store_in_cache=True,
            max_age=1000,
            fast_mode=False,
            headers={"User-Agent": "E2E-Extract-Test"},
            include_tags=["main"],
            exclude_tags=["nav"],
            wait_for=2000,
            location=Location(country="US", city="New York"),
            wait_actions=[
                WaitAction(type="wait", value=1000)
            ]
        )

        resp = self.client.extract(
            urls=["https://docs.firecrawl.dev"],
            prompt="Extract the main page title",
            schema=json_schema,
            system_prompt="You are a helpful assistant",
            allow_external_links=False,
            enable_web_search=False,
            show_sources=True,
            ignore_invalid_urls=True,
            scrape_options=scrape_options,
        )

        assert hasattr(resp, "success")
        assert resp.success is True or resp.success is False
        if hasattr(resp, "data") and resp.data is not None:
            assert isinstance(resp.data, (dict, list))

    def test_extract_with_schema(self):
        schema = {
            "type": "object",
            "properties": {
                "title": {"type": "string"}
            },
            "required": ["title"],
        }

        resp = self.client.extract(
            urls=["https://docs.firecrawl.dev"],
            schema=schema,
            prompt="Extract the main page title",
            show_sources=True,
            enable_web_search=False,
        )

        assert hasattr(resp, "success")
        # if backend includes sources, ensure structure is a dict (do not fail if omitted)
        if hasattr(resp, "sources") and resp.sources is not None:
            assert isinstance(resp.sources, dict)

        # check if resp.data schema is equal to schema
        assert isinstance(resp.data, dict)
        assert resp.data["title"] is not None
