import express from "express";
import { providerRuntime } from "../../../runtime/providerRuntime.js";
import { modelRegistry } from "../../modelRegistry.js";

const router = express.Router();

router.get("/models", async (req, res) => {
  try {
    // Optional: Refresh if requested or stale
    if (req.query.refresh === "true" || !modelRegistry.lastUpdated) {
      await providerRuntime.refresh();
    }

    res.json({
      providers: modelRegistry.getActiveProviders(),
      models: modelRegistry.getAll()
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch models", details: e.message });
  }
});

export default router;
