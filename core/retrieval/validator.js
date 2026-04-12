export function validateContext(context, contract) {
  const missing = [];

  for (const field of contract.required) {
    if (!context[field]) missing.push(field);
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
