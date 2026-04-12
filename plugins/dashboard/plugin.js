/**
 * Dashboard plugin for Xentari.
 */
import { renderDashboard } from "../../core/dashboard.js";
import { loadSummary } from "../../core/analytics.js";

export default {
  name: "dashboard",
  description: "Display performance metrics dashboard",

  commands: {
    dashboard: async ({ context }) => {
      const summary = loadSummary();
      renderDashboard(context.metrics, summary);
    }
  }
};
