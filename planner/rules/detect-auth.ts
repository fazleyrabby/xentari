import { Step, PRIORITY_MAP } from "../types.ts";

export function detectAuth(analysis: string): Step[] {
  const lines = analysis.toLowerCase().split("\n");
  const hasAuth = lines.some(line => line.includes("auth") || line.includes("login"));

  if (!hasAuth) {
    return [
      {
        id: "auth-1",
        type: "route",
        description: "Add basic authentication routes",
        file: "routes/auth.js",
        priority: PRIORITY_MAP.route,
        dependsOn: [],
        meta: { capability: "", layer: "" }
      },
      {
        id: "auth-2",
        type: "controller",
        description: "Implement login and registration logic",
        file: "controllers/AuthController.js",
        priority: PRIORITY_MAP.controller,
        dependsOn: [],
        meta: { capability: "", layer: "" }
      }
    ];
  }

  return [];
}
