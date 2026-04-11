/**
 * Stats plugin for displaying execution metrics.
 */
export default {
  name: "stats",
  description: "Display execution metrics",

  commands: {
    stats: async ({ context }) => {
      if (!context.metrics) {
        console.log("No metrics available for this session.");
        return;
      }
      
      console.log("\nSession Metrics:");
      console.log(JSON.stringify(context.metrics, null, 2));
    }
  }
};
