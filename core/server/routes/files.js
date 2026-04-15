import express from "express";
import { workspaceManager } from "../../workspace/workspaceManager.js";
import { listDirectory, readFile, writeFile } from "../../filesystem/fileManager.js";
import { diffFiles } from "../../diff.ts";

const router = express.Router();

function getProjectRoot(projectId) {
  if (!projectId) throw new Error("Project ID is required");
  const project = workspaceManager.getProjectById(projectId);
  if (!project) throw new Error("Project not found");
  
  return project.path;
}

router.get("/files", (req, res) => {
  try {
    const { projectId, path: relativePath } = req.query;
    const root = getProjectRoot(projectId);
    res.json(listDirectory(root, relativePath || ""));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/file", (req, res) => {
  try {
    const { projectId, path: relativePath } = req.query;
    const root = getProjectRoot(projectId);
    const data = readFile(root, relativePath);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/diff", (req, res) => {
  try {
    const { projectId, path: relativePath, newContent } = req.body;
    const root = getProjectRoot(projectId);
    const oldData = readFile(root, relativePath);
    const diff = diffFiles(oldData.content || "", newContent || "");
    res.json(diff);
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
