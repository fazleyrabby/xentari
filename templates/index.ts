import { TEMPLATE_REGISTRY, TemplateContext } from "./registry.ts";

export function extractNameFromPath(filePath: string): string {
  const parts = filePath.split("/");
  const fileName = parts[parts.length - 1];
  const name = fileName.split(".")[0];
  
  // Capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function buildContext(patch: any): TemplateContext {
  return {
    name: extractNameFromPath(patch.target)
  };
}

export function renderTemplate(patch: any): string {
  const ctx = buildContext(patch);
  const renderer = TEMPLATE_REGISTRY[patch.template] || TEMPLATE_REGISTRY["general.basic"];
  return renderer(ctx);
}

export function processPatches(patches: any[]): any {
  return {
    files: patches.map(patch => ({
      path: patch.target,
      content: renderTemplate(patch)
    }))
  };
}
