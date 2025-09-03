import type { Document } from "../types";

/**
 * Normalize a raw Document from the API by converting list metadata values to strings.
 * Preserves certain fields that should remain as lists.
 */
export function normalizeDocumentInput(doc: Record<string, any>): Document {
  const normalized = { ...doc };

  const preserveListFields: string[] = [
    "ogLocaleAlternate", // equivalent to og_locale_alternate in Python SDK
  ];

  if (normalized.metadata && typeof normalized.metadata === "object") {
    const metadata = { ...normalized.metadata };
    
    for (const [field, value] of Object.entries(metadata)) {
      if (Array.isArray(value) && !preserveListFields.includes(field)) {
        try {
          metadata[field] = value.map(String).join(", ");
        } catch (error) {
        }
      }
    }
    
    normalized.metadata = metadata;
  }

  return normalized as Document;
}
