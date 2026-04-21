import { TEMPLATE_REGISTRY, TemplateContext } from "./registry.ts";

export function normalizeName(base: string): string {
  // Canonical normalization: Remove existing suffixes, remove non-alphanumeric, capitalize first letter
  const clean = base
    .replace(/Controller$/i, '')
    .replace(/Model$/i, '')
    .replace(/[^a-zA-Z0-9]/g, '');
    
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function extractNameFromPath(filePath: string, template: string): string {
  const parts = filePath.split("/");
  const fileName = parts[parts.length - 1];
  const base = fileName.split(".")[0];
  const normalized = normalizeName(base);

  return normalized;
}

export function buildContext(patch: any): TemplateContext {
  // Prefer explicit subject for the template name
  const rawName = patch.subject && patch.subject !== "base" && patch.subject !== "index" 
    ? patch.subject 
    : extractNameFromPath(patch.target, patch.template);
    
  const name = normalizeName(rawName);

  return {
    name,
    projectType: patch.projectType || "node"
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
