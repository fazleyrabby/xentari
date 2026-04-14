import express from "express";
import { workspaceManager } from "../../workspace/workspaceManager.js";
import { listFiles, readFile, writeFile } from "../../filesystem/fileManager.js";

const router = express.Router();

function getProjectRoot(projectId) {
  if (!projectId) throw new Error("Project ID is required");
  const project = workspaceManager.getProjectById(projectId);
  if (!project) throw new Error("Project not found");
  return project.path;
}

router.get("/files", (req, res) => {
  try {
    const root = getProjectRoot(req.query.projectId);
    res.json({ files: listFiles(root) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/file", (req, res) => {
  try {
    const root = getProjectRoot(req.query.projectId);
    const data = readFile(root, req.query.path);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/file/save", (req, res) => {
  try {
    const { projectId, path: relativePath, content } = req.body;
    const root = getProjectRoot(projectId);
    writeFile(root, relativePath, content);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
