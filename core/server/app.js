import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { executionLoop } from "../execution/engine.js";
import { getState } from "../ui/state.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post("/run", async (req, res) => {
  try {
    const { prompt, auto = true } = req.body;
    
    const plan = {
      steps: [
        { command: prompt, reason: "Web UI Request", stack: "node" }
      ]
    };

    const result = await executionLoop(plan, { auto, source: "web" });
    res.json({ success: true, result });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.get("/state", (req, res) => {
  res.json(getState());
});

export default app;
