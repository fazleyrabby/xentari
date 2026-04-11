/**
 * Core plugin for essential TUI commands.
 */
export default {
  name: "core",
  description: "Essential TUI commands",

  commands: {
    clear: async () => {
      console.clear();
    },
    help: async ({ context }) => {
      console.log("\nAvailable Commands:");
      const registry = context.registry;
      for (const [name, cmd] of Object.entries(registry)) {
        console.log(`  /${name.padEnd(10)} - ${cmd.description || `Command from ${cmd.pluginName}`}`);
      }
    }
  }
};
