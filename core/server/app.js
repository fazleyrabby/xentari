import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { route } from "../router/index.js";
import { getState } from "../ui/state.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post("/run", async (req, res) => {
  try {
    const { prompt } = req.body;

    const result = await route(prompt, {
      auto: true,
      source: "web"
    });

    res.json(result);

  } catch (err) {
    res.json({ error: err.message });
  }
});

app.get("/state", (req, res) => {
  res.json(getState());
});

export default app;
