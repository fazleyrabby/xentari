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

### 🔹 Interactive TUI

* Persistent CLI session
* Streaming execution output
* Command palette and shortcuts

### 🔹 Context Engine

* Multi-stack awareness (backend/frontend detection)
* Tiered context system (global, stack, rules)

### 🔹 Smart Retrieval + Chunking

* Selects only relevant parts of files
* Simulates long-context reasoning for smaller models

### 🔹 Constraint Engine

* Removes markdown and conversational noise
* Enforces structured outputs and size limits

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

Xentari is a functional MVP and actively used in real development workflows.

* ✅ Stable execution pipeline
* ✅ Local LLM integration
* ✅ Safe patch system with rollback
* ✅ Multi-step execution with retry control

Actively improving through real-world testing and iteration.

---

## 🗺 Roadmap

* Improved retrieval precision
* Enhanced multi-file reasoning
* Better UX (diff navigation, command palette)
* Stability improvements from real-world usage

---

## ⚠️ Limitations

* Depends on local model quality
* Complex refactors may require stronger models
* Indexing is heuristic-based (not embedding-based yet)

---

## 📜 License

MIT

---
