# 🧠 Xentari

Local-first AI coding assistant with a structured agent pipeline.  
Designed to work with small local models (llama.cpp, Qwen, Gemma) while maintaining reliability and low token usage.

---

## Overview

Xentari is a CLI-based developer tool that executes coding tasks through a deterministic pipeline:

**Plan → Retrieve → Code → Review → Patch**

Instead of relying on large context windows or cloud APIs, it focuses on:

- **Minimal and relevant context**: Smart retrieval and chunking.
- **Safe patch generation**: Git-integrated validation and apply.
- **Predictable execution**: Multi-agent pipeline with deterministic stages.
- **Local model compatibility**: Optimized for 7B–14B models.

---

## Features

- **Agent Pipeline**
  - Planner, Retriever, Coder, Reviewer, Patcher
  - Step-based execution with dependency mapping and validation.

- **Local-first LLM Support**
  - Works with OpenAI-compatible local servers (llama.cpp, etc.).
  - No dependency on external APIs.

- **Interactive TUI**
  - Persistent session with a conversational shell.
  - Live execution output with LLM streaming support.
  - Built-in slash-commands and debugging tools.

- **Context Engine**
  - Multi-stack awareness (Backend/Frontend detection).
  - Tier-aware context building (Global, Stack, Rules).

- **Smart Chunking**
  - Handles large files by selecting only the most relevant sections.
  - Simulates long-context reasoning for smaller models.

- **Constraint Engine**
  - Removes markdown fences and conversational filler.
  - Enforces strict structured responses and size guards.

- **Project Indexing (RAG-lite)**
  - Lightweight file summaries and export mapping.
  - Improves retrieval accuracy through semantic token overlap.

- **Live Metrics**
  - Real-time tracking of tokens (input/output), execution time, and retry counts.
  - TUI status bar for immediate performance feedback.

- **Safe Patch System**
  - Automated unified diff generation from full-file output.
  - `git apply` validation with dry-run support.
  - One-command `undo` functionality.

- **Parallel Execution**
  - Concurrent processing of independent task steps to reduce latency.
  - Integrated file locking system to prevent race conditions.

---

## Architecture

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

## Requirements

- Node.js 18+
- Git repository
- Local LLM server (OpenAI-compatible endpoint, default port 8081)

---

## Installation

```bash
git clone <repo-url>
cd xentari
npm install
npm link
```

### Configuration
Edit `config/config.json` to match your local setup:
```json
{
  "baseURL": "http://localhost:8081/v1",
  "model": "qwen"
}
```

---

## Usage

### Interactive Mode
Launch the persistent TUI shell:
```bash
xen
```

### Run a Task
Execute a task directly from the CLI:
```bash
xen "add a login endpoint to the auth service"
```

### Common Flags
- `xen "task" --dry` — Generate and validate patch, but do not apply.
- `xen "task" --auto` — Enable autonomous retry loop with reviewer feedback.
- `xen "task" --step` — Execute a single step directly (skips planning).
- `xen "task" --plan` — Generate and show the execution plan only.

### Commands
- `xen index` — Build or refresh the project semantic index.
- `xen context` — Inspect the dynamic context being sent to the LLM.
- `xen debug "task"` — Show retrieval scores, token estimates, and performance metrics.
- `xen undo` — Revert the last applied patch (via git reset).

---

## Design Goals

- **Performance**: Work reliably with small local models (7B–14B).
- **Efficiency**: Minimize token usage through smart retrieval and chunking.
- **Reliability**: Avoid full-project context injection to reduce hallucinations.
- **Observability**: Keep execution deterministic and fully debuggable.

---

## Current Status

Core system is functional:
- ✅ Agent pipeline (Plan-Retrieve-Code-Review-Patch)
- ✅ TUI interface with streaming and metrics
- ✅ Dynamic context engine & multi-stack support
- ✅ Smart chunking for large files
- ✅ Constraint engine and output guardrails
- ✅ Multi-agent parallel execution
- ✅ Lightweight project indexing

---

## Limitations

- **Model Quality**: Performance is heavily dependent on the local model's ability to follow instructions.
- **Reasoning**: Extremely complex refactors may still require stronger models (use Advisor escalation).
- **Indexing**: Project indexing is currently heuristic-based (token overlap) rather than using vector embeddings.

---

## License
MIT
