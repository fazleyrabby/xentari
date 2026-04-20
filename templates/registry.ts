export interface TemplateContext {
  name: string;
}

export type TemplateFunction = (ctx: TemplateContext) => string;

export const TEMPLATE_REGISTRY: Record<string, TemplateFunction> = {
  "controller.basic": (ctx) => {
    return `export class ${ctx.name}Controller {
  index(req, res) {
    res.json({ message: "Welcome to ${ctx.name}Controller" });
  }
}
`;
  },
  "route.basic": (ctx) => {
    return `import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ status: "${ctx.name} online" });
});

export default router;
`;
  },
  "model.basic": (ctx) => {
    return `export class ${ctx.name} {
  constructor(data) {
    this.id = data.id;
    this.createdAt = new Date("2026-04-19T00:00:00Z");
  }
}
`;
  },
  "structure.basic": (ctx) => {
    return `// Module: ${ctx.name}
// Created: 2026-04-19
`;
  },
  "general.basic": (ctx) => {
    return `// Artifact: ${ctx.name}
`;
  }
};
