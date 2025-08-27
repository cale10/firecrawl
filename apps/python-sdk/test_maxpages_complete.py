#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'firecrawl'))

try:
    from v2.types import ScrapeOptions, PDFParser
    from v2.utils.validation import prepare_scrape_options
    
    print("Testing Python SDK maxPages functionality...")
    
    test_cases = [
        ("String format", ScrapeOptions(parsers=["pdf"])),
        ("Object format", ScrapeOptions(parsers=[PDFParser()])),
        ("Object with maxPages", ScrapeOptions(parsers=[PDFParser(max_pages=10)])),
        ("Mixed formats", ScrapeOptions(parsers=["pdf", PDFParser(max_pages=5)])),
        ("Dict format", ScrapeOptions(parsers=[{"type": "pdf", "max_pages": 15}]))
    ]
    
    for name, option in test_cases:
        try:
            validated = option.model_validate(option.model_dump())
            prepared = prepare_scrape_options(validated)
            print(f"✓ {name} - Validation and preprocessing passed")
            if prepared and "parsers" in prepared:
                print(f"  Prepared parsers: {prepared['parsers']}")
        except Exception as e:
            print(f"✗ {name} - Failed: {e}")
    
    try:
        invalid_option = ScrapeOptions(parsers=[PDFParser(max_pages=1001)])
        print("✗ Should have failed for maxPages > 1000")
    except Exception as e:
        print("✓ Correctly rejected maxPages > 1000")
    
    print("✅ Python SDK maxPages test completed!")
    
except Exception as e:
    print(f"✗ Test failed: {e}")
    import traceback
    traceback.print_exc()
