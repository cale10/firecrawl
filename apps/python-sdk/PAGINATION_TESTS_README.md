# Firecrawl v2 Pagination Tests

This directory contains comprehensive unit tests for the Firecrawl v2 pagination functionality.

## Overview

The pagination tests cover:

- ✅ **PaginationConfig Model** - Testing the configuration object
- ✅ **Crawl Pagination** - Testing crawl job pagination (sync & async)
- ✅ **Batch Scrape Pagination** - Testing batch scrape pagination (sync & async)
- ✅ **Edge Cases** - Testing error conditions and edge cases
- ✅ **Limits** - Testing max_pages, max_results, and max_wait_time limits

## Test Files

- `test_pagination.py` - Main test suite
- `run_pagination_tests.py` - Test runner script
- `example_pagination.py` - Usage examples

## Running Tests

### Prerequisites

```bash
pip install pytest
```

### Run All Tests

```bash
# Using the test runner
python run_pagination_tests.py

# Or directly with pytest
pytest test_pagination.py -v
```

### Run Specific Test Classes

```bash
# Test PaginationConfig only
pytest test_pagination.py::TestPaginationConfig -v

# Test crawl pagination only
pytest test_pagination.py::TestCrawlPagination -v

# Test batch scrape pagination only
pytest test_pagination.py::TestBatchScrapePagination -v

# Test async pagination only
pytest test_pagination.py::TestAsyncPagination -v

# Test edge cases only
pytest test_pagination.py::TestPaginationEdgeCases -v
```

### Run Specific Tests

```bash
# Test default values
pytest test_pagination.py::TestPaginationConfig::test_default_values -v

# Test auto_paginate=False
pytest test_pagination.py::TestCrawlPagination::test_get_crawl_status_no_pagination -v

# Test max_pages limit
pytest test_pagination.py::TestCrawlPagination::test_get_crawl_status_max_pages_limit -v
```

## Test Coverage

### PaginationConfig Tests
- ✅ Default values (auto_paginate=True, others None)
- ✅ Custom values (all fields set)

### Crawl Pagination Tests
- ✅ `auto_paginate=False` - Returns next URL, doesn't fetch additional pages
- ✅ `auto_paginate=True` - Fetches all pages, returns None for next
- ✅ `max_pages` limit - Stops after specified number of pages
- ✅ `max_results` limit - Stops after specified number of results
- ✅ `max_wait_time` limit - Stops after specified time
- ✅ Error handling - Continues with partial results on API errors

### Batch Scrape Pagination Tests
- ✅ `auto_paginate=False` - Returns next URL, doesn't fetch additional pages
- ✅ `auto_paginate=True` - Fetches all pages, returns None for next
- ✅ Combined limits - Tests max_pages and max_results together

### Async Pagination Tests
- ✅ Async crawl pagination
- ✅ Async batch scrape pagination
- ✅ Async pagination limits

### Edge Cases
- ✅ Empty data responses
- ✅ Mixed string/dict data (strings should be skipped)
- ✅ Failed API responses
- ✅ Unsuccessful subsequent pages

## Test Structure

Each test class follows this pattern:

```python
class TestCrawlPagination:
    def setup_method(self):
        """Set up test fixtures."""
        self.mock_client = Mock()
        self.job_id = "test-crawl-123"
        self.sample_doc = {...}
    
    def test_specific_functionality(self):
        """Test description."""
        # Arrange - Set up mocks and test data
        # Act - Call the function under test
        # Assert - Verify the results
```

## Mocking Strategy

Tests use `unittest.mock.Mock` to simulate:

- **HTTP Client** - Mock responses for API calls
- **API Responses** - Mock JSON responses with pagination data
- **Time** - Mock time.time() for timeout testing
- **Async Client** - Mock async HTTP client for async tests

## Example Test Output

```
🧪 Running Firecrawl v2 Pagination Tests
==================================================
test_pagination.py::TestPaginationConfig::test_default_values PASSED
test_pagination.py::TestPaginationConfig::test_custom_values PASSED
test_pagination.py::TestCrawlPagination::test_get_crawl_status_no_pagination PASSED
test_pagination.py::TestCrawlPagination::test_get_crawl_status_with_pagination PASSED
...

✅ All pagination tests passed!
```

## Adding New Tests

To add new tests:

1. **Add to existing test class** if testing similar functionality
2. **Create new test class** if testing new functionality
3. **Follow naming convention**: `test_<functionality>_<scenario>`
4. **Use descriptive docstrings** explaining what the test verifies
5. **Mock external dependencies** to ensure tests are isolated
6. **Test both success and failure cases**

## Troubleshooting

### Import Errors
Make sure you're running tests from the correct directory:
```bash
cd apps/python-sdk
python run_pagination_tests.py
```

### Missing Dependencies
Install required packages:
```bash
pip install pytest firecrawl
```

### Test Failures
Check that:
- Mock responses match expected API format
- Test data is properly structured
- Assertions match expected behavior
- Time mocking is correct for timeout tests
