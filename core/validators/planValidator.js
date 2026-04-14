export function validatePlan(plan) {
  if (!plan || !Array.isArray(plan.steps)) {
    throw new Error("Invalid plan: steps missing");
  }

  for (const step of plan.steps) {
    if (!step.type) {
      throw new Error(`Invalid plan step ${step.id}: missing type`);
    }

    if (!step.target) {
      throw new Error(`Invalid plan step ${step.id}: missing target`);
    }
  }

  return true;
}
