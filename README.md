# 🧠 Xentari

**Xentari is a deterministic, local-first AI development system that executes coding tasks through structured pipelines instead of chat.**

---

## 🚀 Overview

Xentari is a CLI-based developer tool designed to work with small local models (7B–14B) while maintaining reliability, safety, and low token usage.

Instead of relying on large context windows or cloud APIs, it focuses on:

* **Minimal and relevant context** through smart retrieval
* **Deterministic execution pipeline** instead of chat-based randomness
* **Safe, inspectable changes** via diff + approval
* **Local-first operation** with no external dependency

---

## Why Xentari?

Most AI coding tools rely on:

* large context windows
* cloud-based models
* probabilistic outputs

Xentari takes a different approach:

* **Deterministic execution pipeline**
* **Minimal context (no brute-force token usage)**
* **Local-first (works with small models)**
* **Safe, controlled code modification**

> Instead of making models bigger, Xentari makes execution smarter.

---

## ⚙️ How It Works

```text
User → Plan → Retrieve → Code → Review → Diff → Approve → Apply
```

---

## 🧭 Project Behavior

Xentari runs directly in your current working directory.

```bash
cd your-project
xen
```

* Automatically detects project structure
* Builds a local index (`.xentari/`)
* Applies changes only within the current project

Each project is fully isolated and maintains its own state.

---

## 📁 Project Isolation

Xentari stores all internal data inside:

```
.xentari/
```

This ensures:

* no pollution of your codebase
* easy cleanup
* full separation between projects

---

## 🧠 Key Features

### 🔹 Agent Pipeline

* Planner, Retriever, Coder, Reviewer, Patcher
* Step-based execution with dependency mapping and validation

### 🔹 Local-first LLM Support

* Works with OpenAI-compatible local servers (llama.cpp, Qwen, Gemma)
* No dependency on external APIs

### 🔹 Dual Interface System

* **Interactive TUI:** Persistent CLI session with split-panel layout (lazygit-style) and real-time streaming.
* **Web UI (Beta):** Professional IDE-like interface with:
    * **File Explorer:** VS Code-like tree view with lazy loading.
    * **Inline Actions:** Select code in preview to "Explain" or "Refactor" instantly.
    * **Diff Viewer:** Side-by-side comparison of AI suggestions with "Apply" support.

### 🔹 Self-Healing Execution (E12)

* **Failure Classification:** Automatically categorizes errors (CODE, ENVIRONMENT, PERMISSION).
* **Intelligent Retries:** Automatically attempts to fix recoverable errors (e.g., syntax/validation) with a 2-retry boundary.

### 🔹 Advanced Observability (E15)

* **Execution Snapshots:** Full audit trail of steps, results, and contexts persisted to `.xentari/snapshots.log`.
* **Debug Trace Layer:** High-frequency circular buffer capturing every internal state transition for real-time debugging.
* **Timeline Visualization:** Visual execution trace available in both TUI and Web UI.

### 🔹 Project Indexing (RAG-lite)

* Lightweight file summaries and structure mapping
* Heuristic-based retrieval (token overlap + structure)

### 🔹 Dependency & Architecture Awareness

* File dependency mapping (imports / requires)
* Reverse dependencies (impact detection)
* Module grouping and flow detection (route → controller → service → model)

### 🔹 Live Metrics

* Token usage (input/output)
* Execution time
* Retry count
* Status bar in TUI

### 🔹 Safe Patch System

* Side-by-side diff viewer
* Git-based validation (`git apply --dry-run`)
* Explicit user approval before applying changes
* Rollback support (`xen undo`)

### 🔹 Optimized Step Execution

* Controlled multi-step execution
* Retry minimization and failure classification
* Context reuse across steps

---

## 🧪 Example

```bash
xen "add validation and logging to todo route"
```

### Execution Flow

```text
[PLAN]
1. analyze todo module
2. locate route
3. add validation
4. add logging

[CODE]
→ modifying route file

[DIFF]
--- routes/todo.js ---
+ if (!title) return error
+ console.log("request received")

Apply changes? (y/n)
```

---

## 🛡 Safety Model

Xentari is designed to be safe by default:

* **Diff-based changes** (no blind writes)
* **User approval required before apply**
* **Git-based validation (`git apply --dry-run`)**
* **Rollback support (`xen undo`)**
* **Project isolation (`.xentari/` only, no repo pollution)**

---

## 🆚 How Xentari is Different

| Feature          | Typical Tools      | Xentari           |
| ---------------- | ------------------ | ----------------- |
| Execution Model  | Chat-based         | Pipeline-based    |
| Context Usage    | Large prompts      | Minimal retrieval |
| Model Dependency | Cloud (GPT/Claude) | Local-first       |
| Output           | Direct code        | Reviewed + diff   |
| Determinism      | Low                | High              |

---

## 🏗 Architecture

```text
User Input
    ↓
 Planner (Decomposition & Dependency Mapping)
    ↓
 Retriever (Stack-Aware Scoring & Smart Chunking)
    ↓
 Coder (Content Generation & Constraint Enforcement)
    ↓
 Reviewer (Strict Validation & Logic Check)
    ↓
 Patcher (Diff Generation & Git Application)
```

---

## 📦 Requirements

* Node.js 18+
* Git repository
* Local LLM server (OpenAI-compatible endpoint)

---

## ⚙️ Installation

```bash
git clone <repo-url>
cd xentari
npm install
npm link
```

---

## ⚙️ Configuration

Edit:

```json
config/config.json
```

```json
{
  "baseURL": "http://localhost:8081/v1",
  "model": "qwen"
}
```

---

## 🚀 Usage

### Interactive Mode

```bash
xen
```

---

### Run a Task

```bash
xen "add login endpoint to auth service"
```

---

### Common Flags

* `--dry` → validate patch without applying
* `--auto` → enable retry loop
* `--step` → execute single step
* `--plan` → show execution plan only

---

### Commands

* `xen index` → build project index
* `xen context` → inspect context
* `xen debug "task"` → show metrics + retrieval
* `xen undo` → rollback last patch

---

## 🎯 Design Goals

* **Performance** → works with small local models
* **Efficiency** → minimal token usage
* **Reliability** → avoids full-context hallucination
* **Observability** → deterministic and debuggable

---

## 📊 Current Status

Xentari is a **production-ready deterministic engine** actively used for local-first software engineering.

* ✅ **E14 Stable:** Persistent TUI with split-panel navigation.
* ✅ **Self-Correction:** High success rate in multi-step recovery (E12).
* ✅ **Full Audit:** Execution snapshots and high-frequency tracing (E15).
* ✅ **Web-Ready:** Headless WebSocket API and React frontend.

---

## 🗺 Roadmap

* **Full TypeScript Migration:** Transitioning remaining core JS to strict TS.
* **Advanced Contract Expansion:** Domain-specific contracts for React and Python stacks.
* **Cross-Workspace Dashboard:** Multi-project state monitoring in the Web UI.
* **Embedding-based Indexing:** Augmenting heuristic RAG with local vector storage.

---

## ⚠️ Limitations

* Depends on local model quality
* Complex refactors may require stronger models
* Indexing is heuristic-based (not embedding-based yet)

---

## 📜 License

MIT

---
