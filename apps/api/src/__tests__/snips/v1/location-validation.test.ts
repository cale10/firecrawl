import { describe, it, expect } from "@jest/globals";
import { scrapeOptions } from "../../../controllers/v1/types";

describe("V1 Location validation", () => {
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
  });

  describe("Deprecated geolocation field", () => {
    it("should accept valid codes in deprecated geolocation field", () => {
      const validCodes = ["US", "US-CA", "DE-BY"];
      
      for (const code of validCodes) {
        const result = scrapeOptions.safeParse({
          geolocation: { country: code }
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.geolocation?.country).toBe(code.toUpperCase());
        }
      }
    });

    it("should reject invalid codes in deprecated geolocation field", () => {
      const result = scrapeOptions.safeParse({
        geolocation: { country: "INVALID" }
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Invalid country code");
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
  });
});
