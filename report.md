# Xentari — In-Depth Architecture & Implementation Guide

This document serves as a comprehensive technical study guide for the Xentari project. It details the evolution of the system from a basic pipeline to a sophisticated, multi-agent, parallel-executing AI coding assistant.

---

## 🏗 High-Level Architecture

Xentari follows a **Modular Agent Orchestration** pattern. Instead of a single monolithic prompt, it decomposes tasks into specialized stages, each handled by a focused logic module or LLM agent.

### The Pipeline Flow:
1.  **Planner:** Breaks down a high-level task into atomic, file-targeted steps.
2.  **Retriever:** Identifies the most relevant files using weighted scoring and RAG.
3.  **Coder:** Generates the *full updated content* for the target files.
4.  **Constraint Engine:** Cleans the output (removes markdown, filler, etc.).
5.  **Reviewer:** Performs a logic and syntax check on the proposed changes.
6.  **Advisor (Escalation):** A stronger model intervenes if the local model fails.
7.  **Patcher:** Generates a unified diff and applies it safely via Git.

---

## 📂 Phase-by-Phase Technical Deep Dive

### Phase 1 — Core Implementation: The Birth of the Pipeline
**Goal:** Establish the fundamental "Plan-Retrieve-Code-Review-Apply" loop.

*   **Planner:** Takes user input and returns a JSON list of steps.
    *   *Logic:* Uses a system prompt to force the LLM to think in steps.
*   **Retriever (v1):** Basic keyword matching against filenames using `glob`.
*   **Coder:** Generates a raw patch.
*   **Reviewer:** A simple LLM pass asking "Is this patch correct? Respond OK or Issue:".
*   **Patcher:** Writes the diff to a temporary file and executes `git apply`.

### Phase 1.5 — Production Refactor: Stability & Observability
**Goal:** Transition from a prototype script to a maintainable software project.

*   **Config Singleton (`core/config.js`):** Implemented lazy-loading of `config.json` to prevent repeated disk I/O.
*   **Logger Layer (`core/logger.js`):** Added colored ANSI console output and structured JSON logging to `logs/xen.log`.
*   **Context Singleton (`core/context.js`):** Centralized the loading of project-wide rules.

### Phase 2 — Usability & Daily Driver: Safe Interaction
**Goal:** Make the tool safe for real-world codebases.

*   **CLI Modes:** Added `--dry` (validate only), `--plan` (show steps only), and `--auto` (autonomous retry).
*   **Interactive Confirmation (`core/prompt.js`):** Uses `node:readline` to ask the user before applying any change.
*   **Undo Support:** Implemented `xen undo`, which performs a `git reset --hard HEAD` to instantly revert failures.

### Phase 3 — Intelligence & Context Upgrade: Smart Retrieval
**Goal:** Solve the "irrelevant context" problem.

*   **Advanced Scoring:** The retriever now uses a weighted formula:
    *   `score = (filename * 2) + (content * 1) + (priority * 1.5) + (memory * 1)`
*   **Context Chaining:** Steps now "remember" what happened in previous steps. If Step 1 modified `user.js`, Step 2 will prioritize `user.js` in its context.
*   **Summarizer (`core/summarizer.js`):** Uses the LLM to generate a 1-sentence summary of every patch for the logs.

### Phase 4 — Adaptive Model Intelligence: Tiered Optimization
**Goal:** Enable Xentari to run on anything from a 3B "Small" model to a 70B "Large" model.

*   **Tier Detection (`core/tier.js`):** Automatically classifies the model based on its name (e.g., `qwen-7b` = SMALL).
*   **Tier Profiles:** Each tier has different limits:
    *   *Small:* Fewer files, shorter context, fewer steps.
    *   *Large:* High token limits, multi-file edits, complex planning.

### Phase 5 — File-Based Patching: Reliability Over Format
**Goal:** Fix the common "invalid diff format" error produced by small models.

*   **The Switch:** Instead of asking the LLM to write a complex `diff --git` format, the LLM now outputs the **FULL UPDATED FILE**.
*   **Local Diffing (`core/diff-generator.js`):** Xentari calculates the diff locally using the `diff` library. This ensures 100% valid unified diffs every time.

### Phase 6 — Multi-Agent Execution: The Agent Layer
**Goal:** Decouple the pipeline from the CLI entry point.

*   **ExecutorAgent:** A high-level controller that manages the loop, handles errors, and coordinates between the Planner and Coder.
*   **Atomic Steps:** Encourages the model to make one change at a time, increasing success rates on local hardware.

### Phase 7 — Advisor System: Hybrid Intelligence
**Goal:** Use expensive models only when necessary.

*   **Escalation Logic:** If the local model fails 2 consecutive times (syntax error or reviewer rejection), Xentari automatically calls the **Advisor** (a stronger remote model like Claude/GPT-4).
*   **Cost Efficiency:** Minimizes API costs by solving 80% of tasks locally.

### Phase 8 — Context Engine: Dynamic Stack Awareness
**Goal:** Don't drown the LLM in irrelevant data.

*   **Stack Detection:** Analyzes the task keywords.
    *   "add button" → Loads `context/frontend.md`
    *   "database query" → Loads `context/backend.md`
*   **Tiered Context:** Combines Global + Stack + Task-specific rules into a single concise prompt.

### Phase 9 — Project Intelligence: Semantic Layer
**Goal:** Speed up file targeting.

*   **Indexer (`core/indexer.js`):** Scans the project once to build a lightweight `index.json` containing file summaries and function exports.
*   **Heuristic Mapping:** The retriever uses this index to find files even if the filename doesn't match the keyword (e.g., finding the "Auth Service" inside `security.js`).

### Phase 10 — Interactive TUI System: A Real Assistant
**Goal:** Provide a seamless, persistent developer experience.

*   **Persistent Shell:** Run `xen` to enter an interactive loop. No need to restart the tool for every task.
*   **Streaming:** LLM output is rendered token-by-token in the terminal, giving instant feedback.
*   **Slash Commands:** Added commands like `/clear`, `/undo`, and `/context`.

### Phase 11 — Multi-Agent Parallel Execution: High Throughput
**Goal:** Reduce the time taken for multi-step tasks.

*   **Dependency Detection:** The Planner now assigns `dependsOn: [id]` to steps.
*   **Batch Scheduling (`core/scheduler.js`):** Groups independent steps into batches.
*   **File Locking (`core/locks.js`):** Prevents two agents from editing the same file at the same time.
*   **Concurrency:** Executes independent steps simultaneously using `Promise.all`.

### Phase 12 — TUI Status Bar & Metrics: Observability
**Goal:** Know exactly what's happening under the hood.

*   **Metrics Engine (`core/metrics.js`):** Tracks input/output tokens, execution time, and retry counts.
*   **Status Bar:** Displays a live dashboard at the bottom of the TUI:
    `MODEL: qwen (SMALL) | TOKENS: 1.2k | TIME: 4.5s | FILES: 3 | CHUNKS: 2 | RETRIES: 1`

### Phase 13 — Constraint Engine & Guardrails: Reliable Output
**Goal:** Deterministic cleaning of LLM noise.

*   **Constraints (`core/constraints.js`):** A set of rules applied post-generation:
    *   `no_markdown`: Strips ``` fences.
    *   `no_explanations`: Removes "Sure, here is your code..." prose.
    *   `trim`: Removes trailing whitespace and junk.
*   **Validation:** Rejects output if it still contains conversational filler or is empty.

### Phase 14 — Smart Chunking: Long Context Simulation
**Goal:** Handle 5000+ line files with a 2048 token model.

*   **Chunker (`core/chunker.js`):** Splits large files into 800-character segments.
*   **Relevance Scoring:** Selects only the chunks that contain keywords related to the task.
*   **Continuity Hints:** Instructs the LLM: "You are seeing a PARTIAL file. Only modify the visible parts."
*   **Multi-Pass Analysis:** For very large files, the model performs an "Analysis Pass" first to locate the logic before editing.

### Phase 15 — Lightweight Local RAG: The Knowledge Store
**Goal:** True "Long-Term Memory" without a Vector DB.

*   **Knowledge Store (`logs/knowledge.json`):** Stores structured metadata (exports, keywords, summaries) for every file.
*   **RAG Retriever (`core/rag.js`):** Performs a semantic-lite lookup before the file retriever runs.
*   **Boosting:** Files found in the knowledge store receive a **+10 score boost**, ensuring they are selected for the context window.

### Phase 16 — Plugin System: Extensibility
**Goal:** Make Xentari a platform, not just a tool.

*   **ESM Plugin Loader (`core/plugins.js`):** Uses dynamic `import()` to load third-party logic from the `plugins/` directory.
*   **Command Registry:** Plugins can register new slash-commands (e.g., `/stats`).
*   **Context Passing:** Plugins receive the current `state`, `metrics`, and `projectDir`, allowing them to interact with the active session.

---

## 🧠 Core Logic Flows to Remember

### 1. The Retrieval Strategy
Xentari doesn't just "find files". It filters through three layers:
1.  **RAG Lookup:** Checks `knowledge.json` for semantic hits.
2.  **File Metadata:** Checks filenames, extensions, and directory priority.
3.  **Content Analysis:** Chunks top candidates and scores segments for relevance.

### 2. The Patching Safety Loop
To prevent project corruption:
1.  **Generate Content:** Get updated file text.
2.  **Validate Output:** Ensure no markdown or prose leaked in.
3.  **Local Diff:** Generate unified diff.
4.  **Structural Validation:** Ensure `diff --git` and `@@` headers are correct.
5.  **Review Pass:** Ask the LLM to find logic errors in the diff.
6.  **Git Check:** Run `git apply --check` to ensure the patch is compatible with the current HEAD.

### 3. The Constraint Logic
Local models are "chatty". The Constraint Engine uses deterministic string manipulation (regex and line filters) to strip away conversational noise, transforming a "chat response" into "pure source code" before it ever hits the disk.

---

## 🛠 Troubleshooting Guide for Developers

*   **"Missing diff --git header":** Usually means the `diff-generator` failed to find changes or the LLM output was empty.
*   **"Patch too large":** Check the `TIER_PROFILES` in `core/tier.js`. Large files often trigger this if they aren't chunked properly.
*   **"SyntaxError: Unexpected token":** Check for leaked `...` or `// rest of code` placeholders in the LLM response. The Constraint Engine handles many, but not all.
*   **"ECONNREFUSED":** The llama.cpp server isn't running on the port specified in `config/config.json`.

---

## 📈 Future Design Directions (Phase 17+)
*   **Vector Embeddings:** Transition from keyword RAG to true semantic RAG using local embedding models.
*   **LSP Integration:** Use Language Server Protocol to provide real-time syntax and type checking for the Reviewer.
*   **Web Dashboard:** A local web-based UI for visualizing the agent graph and file changes.
