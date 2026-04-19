import { strictModeGuard } from "../../core/runtime/strictGuard.ts";

export function test(assert) {
  const context = [
    { path: "src/Services/AuthService.php", content: "class AuthService { public function login() {} }" }
  ];

  // Test 1: Allowed claim
  const res1 = strictModeGuard("AuthService handles login functionality", context);
  assert(res1.valid, "Verified identifiers should be allowed");

  // Test 2: Speculative block
  const res2 = strictModeGuard("This project likely uses MVC pattern", context);
  assert(!res2.valid, "Speculative words like 'likely' must be blocked");
  assert(res2.violations.some(v => v.includes("likely")), "Violation must mention the speculative word");

  // Test 3: Unknown entity block
  const res3 = strictModeGuard("PaymentGateway processes transactions", context);
  assert(!res3.valid, "Identifiers not in context should be blocked");
  assert(res3.violations.some(v => v.includes("PaymentGateway")), "Violation must mention unknown entity");

  // Test 4: Sanitization
  const res4 = strictModeGuard(
    "AuthService is here\nPaymentGateway is missing",
    context
  );
  assert(res4.sanitized === "AuthService is here", "Sanitizer should remove only unverified lines");
}
