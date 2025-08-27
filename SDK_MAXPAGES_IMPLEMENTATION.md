# SDK maxPages Implementation Summary

## Changes Made

### JavaScript SDK (apps/js-sdk)

1. **Type Definitions** (`src/v2/types.ts`)
   - Updated `parsers` field from `string[]` to `Array<string | { type: "pdf"; maxPages?: number }>`
   - Maintains backward compatibility with string array format

2. **Validation** (`src/v2/utils/validation.ts`)
   - Added maxPages validation in `ensureValidScrapeOptions`
   - Validates range: 1-1000 pages
   - Validates integer type

### Python SDK (apps/python-sdk)

1. **Type Definitions** (`firecrawl/v2/types.py`)
   - Added `PDFParser` class with `max_pages` field (1-1000 range)
   - Updated `ScrapeOptions.parsers` to support Union type
   - Added field validator for parsers array

2. **Client Methods** (`firecrawl/v2/client.py`)
   - Updated all method signatures to support new parser types
   - Added PDFParser import

3. **Preprocessing** (`firecrawl/v2/utils/validation.py`)
   - Added parsers handling in `prepare_scrape_options`
   - Converts snake_case (`max_pages`) to camelCase (`maxPages`)
   - Handles PDFParser objects and dict formats

## Usage Examples

### JavaScript SDK
```javascript
// String format (backward compatibility)
{ parsers: ["pdf"] }

// Object format without maxPages
{ parsers: [{ type: "pdf" }] }

// Object format with maxPages
{ parsers: [{ type: "pdf", maxPages: 10 }] }

// Mixed formats
{ parsers: ["pdf", { type: "pdf", maxPages: 5 }] }
```

### Python SDK
```python
from firecrawl.v2.types import ScrapeOptions, PDFParser

# String format (backward compatibility)
ScrapeOptions(parsers=["pdf"])

# Object format without maxPages
ScrapeOptions(parsers=[PDFParser()])

# Object format with maxPages
ScrapeOptions(parsers=[PDFParser(max_pages=10)])

# Mixed formats
ScrapeOptions(parsers=["pdf", PDFParser(max_pages=5)])

# Dict format (auto-converted)
ScrapeOptions(parsers=[{"type": "pdf", "max_pages": 15}])
```

## Validation Rules

- `maxPages` must be an integer between 1 and 1000
- Both string and object formats are supported
- Mixed arrays are allowed
- Backward compatibility maintained with existing `["pdf"]` format

## API Compatibility

Both SDKs now properly format requests for the v2 API:
- String format: `["pdf"]` → unchanged
- Object format: `[{"type": "pdf", "maxPages": 10}]` → sent as-is to API
- Python SDK converts `max_pages` to `maxPages` for API compatibility
