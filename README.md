# 🧠 Xentari — Local AI Coding Assistant

Xentari is a high-performance, local-first CLI tool designed to automate complex coding tasks using a "Plan-Retrieve-Code-Review" architecture. It prioritizes system integrity and provides a seamless developer experience by leveraging local LLMs (via llama.cpp or compatible servers) and a hybrid advisor escalation system.

---

## 🚀 Key Features

- **Multi-Phase Pipeline:** Autonomous task planning, context-aware file retrieval, patch generation, and automated review.
- **Dynamic Context Engine:** Automatically detects the project stack (Backend, Frontend, etc.) from user intent and loads task-specific rules and context files.
- **Project Intelligence:** Lightweight indexing system that builds a semantic map of the codebase for faster, more accurate file targeting.
- **Advisor Escalation:** Hybrid intelligence layer that escalates complex or failing tasks to a stronger model (e.g., Claude) for resolution.
- **Smart Context:** Weighted composite scoring for file retrieval (filename, content, priority, and history).
- **Execution Memory:** Intelligence store that tracks successful patterns and frequently modified files to improve subsequent turns.
- **Safe Patching:** Git-integrated patch application with structural validation, dry-run support, and one-command undo.
- **Tiered Optimization:** Adaptive behavior based on local model capacity (Small, Medium, Large tiers).

---

## 🛠 Architecture

Xentari operates as an orchestrator across several specialized modules:

1. **Planner:** Decomposes user intent into actionable, file-targeted steps.
2. **Retriever:** Identifies relevant files using weighted scoring, stack detection, and semantic indexing.
3. **Coder:** Generates unified diff patches with structured retry logic.
4. **Reviewer:** Validates patches for logic, style, and potential breaking changes.
5. **Advisor:** Intervenes when the local model fails to generate a valid or approved patch.
6. **Patcher:** Applies changes safely via `git apply` with built-in validation.

---

## 📦 Installation & Usage

### Prerequisites
- Node.js (v18+)
- A running LLM server (e.g., `llama.cpp` with an OpenAI-compatible API)
- `git` repository

### Setup
1. Clone the repository.
2. Run `npm install`.
3. Configure your LLM endpoint in `config/config.json`.
4. Link the binary: `npm link`.

### Basic Commands
- `xen "task description"` — Run full pipeline.
- `xen "task" --dry` — Generate patch and review without applying.
- `xen "task" --auto` — Enable autonomous retry and advisor mode.
- `xen index` — Build/refresh project intelligence index.
- `xen context` — Show dynamic context being sent to LLM.
- `xen undo` — Revert the last applied patch.

---

## 🏗 Development Status (Phase 9 Complete)

The project has successfully reached Phase 9, introducing **Project Intelligence**.
- [x] Core Implementation (P1-P1.5)
- [x] Usability & Mode Upgrades (P2)
- [x] Intelligence & Context Engine (P3)
- [x] Advisor Escalation (P7)
- [x] Dynamic Context & Multi-Stack (P8)
- [x] Project Intelligence & Semantic Layer (P9)

---

## 📄 License
MIT
