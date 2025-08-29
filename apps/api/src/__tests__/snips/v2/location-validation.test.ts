import { describe, it, expect } from "@jest/globals";
import { scrapeOptions } from "../../../controllers/v2/types";

describe("Location validation", () => {
  describe("Valid country codes", () => {
    it("should accept valid ISO 3166-1 alpha-2 country codes", () => {
      const validCodes = ["US", "DE", "JP", "CA", "GB", "FR"];
      
      for (const code of validCodes) {
        const result = scrapeOptions.safeParse({
          location: { country: code }
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.location?.country).toBe(code.toUpperCase());
        }
      }
    });

    it("should accept valid ISO 3166-2 subdivision codes", () => {
      const validCodes = ["US-CA", "DE-BY", "CA-ON", "GB-ENG", "FR-75", "AU-NSW"];
      
      for (const code of validCodes) {
        const result = scrapeOptions.safeParse({
          location: { country: code }
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.location?.country).toBe(code.toUpperCase());
        }
      }
    });

    it("should accept special case US-generic", () => {
      const result = scrapeOptions.safeParse({
        location: { country: "US-generic" }
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.location?.country).toBe("US-GENERIC");
      }
    });

    it("should handle case insensitive input", () => {
      const testCases = [
        { input: "us", expected: "US" },
        { input: "us-ca", expected: "US-CA" },
        { input: "De-By", expected: "DE-BY" },
        { input: "CA-on", expected: "CA-ON" }
      ];
      
      for (const { input, expected } of testCases) {
        const result = scrapeOptions.safeParse({
          location: { country: input }
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.location?.country).toBe(expected);
        }
      }
    });

    it("should default to US-generic when country is undefined", () => {
      const result = scrapeOptions.safeParse({
        location: {}
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.location?.country).toBe("US-generic");
      }
    });
  });

  describe("Invalid country codes", () => {
    it("should reject invalid country codes", () => {
      const invalidCodes = [
        "USA", // 3 letters
        "X", // 1 letter
        "123", // numbers only
        "US-CALIFORNIA", // subdivision too long (more than 3 chars)
        "US-", // missing subdivision
        "-CA", // missing country
        "US--CA", // double hyphen
        "US CA", // space instead of hyphen
        "US_CA", // underscore instead of hyphen
      ];
      
      for (const code of invalidCodes) {
        const result = scrapeOptions.safeParse({
          location: { country: code }
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain("Invalid country code");
        }
      }
    });

    it("should provide helpful error message", () => {
      const result = scrapeOptions.safeParse({
        location: { country: "INVALID" }
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Invalid country code. Please use a valid ISO 3166-1 alpha-2 country code or ISO 3166-2 subdivision code (e.g., 'US', 'US-CA', 'DE-BY')."
        );
      }
    });
  });

  describe("Edge cases", () => {
    it("should handle empty string", () => {
      const result = scrapeOptions.safeParse({
        location: { country: "" }
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.location?.country).toBe("US-generic");
      }
    });

    it("should handle null value", () => {
      const result = scrapeOptions.safeParse({
        location: { country: null }
      });
      expect(result.success).toBe(false);
    });

    it("should work with other location properties", () => {
      const result = scrapeOptions.safeParse({
        location: { 
          country: "US-CA",
          languages: ["en", "es"]
        }
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.location?.country).toBe("US-CA");
        expect(result.data.location?.languages).toEqual(["en", "es"]);
      }
    });
  });
});
