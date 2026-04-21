export interface TemplateContext {
  name: string;
  projectType: "node" | "laravel";
}

export type TemplateFunction = (ctx: TemplateContext) => string;

export const TEMPLATE_REGISTRY: Record<string, TemplateFunction> = {
  "controller.basic": (ctx) => {
    if (ctx.projectType === "laravel") {
      return `<?php

namespace App\\Http\\Controllers;

use Illuminate\\Http\\Request;

class ${ctx.name}Controller extends Controller
{
    public function index(Request $request)
    {
        return response()->json(['message' => 'Welcome to ${ctx.name}Controller']);
    }
}
`;
    }
    return `export class ${ctx.name}Controller {
  index(req, res) {
    res.json({ message: "Welcome to ${ctx.name}Controller" });
  }
}
`;
  },
  "route.basic": (ctx) => {
    if (ctx.projectType === "laravel") {
      return `<?php

use Illuminate\\Support\\Facades\\Route;

Route::get('/', function () {
    return response()->json(['status' => '${ctx.name} online']);
});
`;
    }
    return `import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ status: "${ctx.name} online" });
});

export default router;
`;
  },
  "model.basic": (ctx) => {
    if (ctx.projectType === "laravel") {
      return `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;

class ${ctx.name} extends Model
{
    protected $guarded = [];
}
`;
    }
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
