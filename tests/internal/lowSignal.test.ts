import { extractQueryTerms } from "../../core/context/noiseFilter.ts";

export function test(assert) {
  // Test 1: Empty or short query
  const terms1 = extractQueryTerms("hi");
  assert(terms1.length === 0, "'hi' should result in zero meaningful terms");

  // Test 2: Meaningful query
  const terms2 = extractQueryTerms("analyze cart logic");
  assert(terms2.includes("analyze"), "Should extract 'analyze'");
  assert(terms2.includes("cart"), "Should extract 'cart'");
  assert(terms2.includes("logic"), "Should extract 'logic'");

  // Test 3: Common stops ignored
  const terms3 = extractQueryTerms("this code from here");
  assert(terms3.length === 0, "Stop words should be ignored");
}
