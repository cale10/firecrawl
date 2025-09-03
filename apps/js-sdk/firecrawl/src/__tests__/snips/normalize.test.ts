import { normalizeDocumentInput } from "../../v2/utils/normalize";

describe("normalizeDocumentInput", () => {
  it("should convert list metadata to comma-separated strings", () => {
    const input = {
      markdown: "# Test",
      metadata: {
        keywords: ["test", "example", "metadata"],
        title: "Test Title",
        description: "Test description"
      }
    };

    const result = normalizeDocumentInput(input);
    
    expect(result.metadata?.keywords).toBe("test, example, metadata");
    expect(result.metadata?.title).toBe("Test Title");
    expect(result.metadata?.description).toBe("Test description");
  });

  it("should preserve ogLocaleAlternate as a list", () => {
    const input = {
      markdown: "# Test",
      metadata: {
        ogLocaleAlternate: ["en_US", "en_GB", "fr_FR"],
        keywords: ["test", "example"]
      }
    };

    const result = normalizeDocumentInput(input);
    
    expect(result.metadata?.ogLocaleAlternate).toEqual(["en_US", "en_GB", "fr_FR"]);
    expect(result.metadata?.keywords).toBe("test, example");
  });

  it("should handle documents without metadata", () => {
    const input = {
      markdown: "# Test",
      html: "<h1>Test</h1>"
    };

    const result = normalizeDocumentInput(input);
    
    expect(result.markdown).toBe("# Test");
    expect(result.html).toBe("<h1>Test</h1>");
  });

  it("should handle empty or null metadata gracefully", () => {
    const input1 = { markdown: "# Test", metadata: null };
    const input2 = { markdown: "# Test", metadata: {} };

    expect(() => normalizeDocumentInput(input1)).not.toThrow();
    expect(() => normalizeDocumentInput(input2)).not.toThrow();
  });

  it("should handle non-string values in lists", () => {
    const input = {
      markdown: "# Test",
      metadata: {
        mixedList: [1, true, "string", null, undefined],
        stringList: ["a", "b", "c"]
      }
    };

    const result = normalizeDocumentInput(input);
    
    expect(result.metadata?.mixedList).toBe("1, true, string, null, undefined");
    expect(result.metadata?.stringList).toBe("a, b, c");
  });

  it("should handle join failures gracefully", () => {
    const input = {
      markdown: "# Test",
      metadata: {
        problematicList: [{ toString: () => { throw new Error("Cannot convert"); } }]
      }
    };

    const result = normalizeDocumentInput(input);
    
    expect(Array.isArray(result.metadata?.problematicList)).toBe(true);
  });
});
