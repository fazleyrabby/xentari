import { scoreFile } from "../../core/context/buildContext.ts";

export function test(assert) {
  const input = "cart service logic";
  
  const file1 = { path: "src/services/CartService.php", content: "function checkout() {}" };
  const file2 = { path: "vendor/lib/utils.php", content: "some random code" };
  const file3 = { path: "src/controllers/CartController.php", content: "class CartController {}" };

  const res1 = scoreFile(file1, input);
  const res2 = scoreFile(file2, input);
  const res3 = scoreFile(file3, input);

  assert(res1.score > res2.score, "CartService must score higher than vendor utils");
  assert(res3.score > res2.score, "CartController must score higher than vendor utils");
  
  // Verify steps are included
  assert(res1.steps.length > 0, "Scoring steps must be returned for visualization");
  assert(res1.steps.some(s => s.label === "Term matches"), "Term matching must be recorded in steps");
}
