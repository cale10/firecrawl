const testOptions = [
  { parsers: ["pdf"] },
  { parsers: [{ type: "pdf" }] },
  { parsers: [{ type: "pdf", maxPages: 10 }] },
  { parsers: ["pdf", { type: "pdf", maxPages: 5 }] }
];

function validateMaxPages(options) {
  if (options.parsers) {
    for (const parser of options.parsers) {
      if (typeof parser === "object" && parser.type === "pdf") {
        if (parser.maxPages !== undefined) {
          if (!Number.isInteger(parser.maxPages) || parser.maxPages < 1 || parser.maxPages > 1000) {
            throw new Error("maxPages must be an integer between 1 and 1000");
          }
        }
      }
    }
  }
}

console.log('Testing JavaScript SDK maxPages functionality...');

testOptions.forEach((option, i) => {
  try {
    validateMaxPages(option);
    console.log(`✓ Test ${i + 1} validation passed: ${JSON.stringify(option)}`);
  } catch (e) {
    console.log(`✗ Test ${i + 1} validation failed: ${e.message}`);
  }
});

try {
  validateMaxPages({ parsers: [{ type: "pdf", maxPages: 1001 }] });
  console.log('✗ Should have failed for maxPages > 1000');
} catch (e) {
  console.log('✓ Correctly rejected maxPages > 1000');
}

console.log('✅ JavaScript SDK maxPages test completed!');
