import { existsSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path, { join } from "node:path";

/**
 * Task 3: Plugin Loader
 * Loads all plugins from the plugins/ directory.
 */
export async function loadPlugins(root) {
  const pluginDir = join(root, "plugins");

  if (!existsSync(pluginDir)) return [];

  const plugins = [];
  const folders = readdirSync(pluginDir);

  for (const folder of folders) {
    const pluginPath = join(pluginDir, folder, "plugin.js");

    if (existsSync(pluginPath)) {
      try {
        // Convert path to file:// URL for ESM dynamic import
        const fileUrl = pathToFileURL(pluginPath).href;
        const mod = await import(fileUrl);
        plugins.push(mod.default || mod);
      } catch (err) {
        console.error(`[PLUGINS] Failed to load plugin from ${folder}:`, err.message);
      }
    }
  }

  return plugins;
}

/**
 * Task 4: Command Registry
 * Combines all plugin commands into a single registry.
 */
export function buildCommandRegistry(plugins) {
  const registry = {};

  for (const plugin of plugins) {
    if (plugin.commands) {
      for (const cmd in plugin.commands) {
        registry[cmd] = {
          fn: plugin.commands[cmd],
          pluginName: plugin.name || "unknown",
          description: plugin.description || ""
        };
      }
    }
  }

  return registry;
}
