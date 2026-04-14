import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getRuntime } from "../runtime/context.js";

function getProjectsPath() {
  const { projectDir } = getRuntime(); // Fallback to current if needed
  // Global projects are stored in the user home or root of the tool?
  // The user said .xentari/projects.json
  // I'll put it in the tool's base directory or user's home .xentari
  // Given the instruction ".xentari/projects.json", I'll use the root of the current project context for now
  // but usually global projects should be in a global location.
  // However, I will follow the explicit ".xentari/projects.json" instruction.
  return path.join(process.cwd(), ".xentari", "projects.json");
}

export class WorkspaceManager {
  constructor() {
    this.ensureConfigExists();
  }

  ensureConfigExists() {
    const p = getProjectsPath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify({ projects: [] }, null, 2));
  }

  getProjects() {
    const data = fs.readFileSync(getProjectsPath(), "utf-8");
    return JSON.parse(data).projects;
  }

  saveProjects(projects) {
    fs.writeFileSync(getProjectsPath(), JSON.stringify({ projects }, null, 2));
  }

  addProject(dirPath) {
    const projects = this.getProjects();
    const absolutePath = path.resolve(dirPath);

    if (!fs.existsSync(absolutePath) || !fs.lstatSync(absolutePath).isDirectory()) {
      throw new Error("Invalid project path: Must be an existing directory");
    }

    if (projects.find(p => p.path === absolutePath)) {
      return projects.find(p => p.path === absolutePath);
    }

    const newProject = {
      id: crypto.randomUUID(),
      name: path.basename(absolutePath),
      path: absolutePath,
      addedAt: Date.now()
    };

    projects.push(newProject);
    this.saveProjects(projects);
    return newProject;
  }

  removeProject(id) {
    const projects = this.getProjects();
    const filtered = projects.filter(p => p.id !== id);
    this.saveProjects(filtered);
    return filtered;
  }

  getProjectById(id) {
    return this.getProjects().find(p => p.id === id);
  }
}

export const workspaceManager = new WorkspaceManager();
