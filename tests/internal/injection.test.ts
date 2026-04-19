import { detectFileReference } from "../../web/src/utils/detectFileReference.js";

export function test(assert) {
  // Test 1: Simple file reference
  const res1 = detectFileReference("Check src/app.js for logic");
  assert(res1?.path === "src/app.js", "Should detect simple file path");
  assert(res1?.line === null, "Line should be null if not provided");

  // Test 2: File with line number
  const res2 = detectFileReference("Error in controllers/UserController.php:45");
  assert(res2?.path === "controllers/UserController.php", "Should detect path with colon");
  assert(res2?.line === 45, "Should detect line number after colon");

  // Test 3: No extension (should not match)
  const res3 = detectFileReference("Look in the README file");
  assert(res3 === null, "Should not match files without supported extensions");

  // Test 4: Multiple extensions
  const res4 = detectFileReference("Update layouts/Base.astro:10");
  assert(res4?.path === "layouts/Base.astro", "Should support .astro files");
  assert(res4?.line === 10, "Should detect line in .astro file");
}
