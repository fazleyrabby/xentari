import express from "express";

const router = express.Router();

router.get("/models", async (req, res) => {
  res.json({
    models: [
      { id: "qwen2.5-coder-7b-instruct-q4_k_m.gguf" }
    ]
  });
});

export default router;
