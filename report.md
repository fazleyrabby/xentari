# 🧠 Xentari — The Ultimate Case Study & Product Manual (Phases 1–78)

# 🧠 Engine Evolution Layer (E-Phases)

Xentari uses a dual-phase system:

1. Product Phases (Phase 1–78)
   → historical evolution of the system
2. Engine Phases (E1–E12+)
   → deterministic execution engine improvements

---

### E10 — Stack Engine (Smart)
*   **Goal:** Enable cross-stack support (Node, Laravel, Go, Rust, etc.) with deterministic detection.
*   **Result:**
    *   **Smart Detector:** Implemented a zero-dependency, scoring-based stack detector.
    *   **Modular Patterns:** Moved pattern loading into stack-specific directories (`stacks/{stack}/patterns/`).
    *   **Interface Enforcement:** Every stack now exports a strict contract (`patterns`, `planner`, `validator`, `testRunner`).
    *   **Core Agnosticism:** Purged stack-specific logic from the core orchestrator.

### E11 — Controlled Execution Engine (Hardened)
*   **Goal:** Eliminate shell-injection vulnerabilities and enforce strict command validation.
*   **Result:**
    *   **Command Tokenization:** Replaced string-based execution with a structured parser that tokenizes commands and arguments.
    *   **Zero-Shell Execution:** Switched to `spawn` with `shell: false` to prevent shell interpretation of malicious payloads.
    *   **Structured Whitelist:** Implemented an argument-aware whitelist for development commands (npm, node, go, etc.).
    *   **Policy Engine:** Blocks dangerous patterns (chaining, redirects, sudo) at the tokenizer level.
    *   **Arg Validator:** Prevents path traversal (`..`) and absolute path access in command arguments.

### E12 — CLI Layout Safety System (No-Break UI)
*   **Goal:** Ensure visual consistency and prevent UI breakage across varying terminal widths and character sets.
*   **Result:**
    *   **Width-Aware Layout:** Implemented a terminal width engine (`core/ui/width.js`) that enforces deterministic wrapping and truncation.
    *   **Safe Box Renderer:** Created a border-safe box renderer (`core/ui/box.js`) with automatic degradation for small terminals (< 60 columns).
    *   **Unicode Normalization:** Added a normalization layer (`core/ui/normalize.js`) using NFKC to prevent alignment issues caused by multi-byte characters.
    *   **Smart Path Truncation:** Implemented "middle-truncation" for file paths to preserve context while respecting layout boundaries.
    *   **Safe Action Indicators:** Standardized single-line action reporting with deterministic status icons and clamped targets.

---

This separation ensures clarity between:
- timeline evolution
- system architecture maturity
---

This document provides a complete technical overview, evolution history, architecture, and validation system of Xentari — a local-first AI coding assistant. It serves as a definitive technical guide for studying the system's modular design and deterministic execution flow.

---

# 🏗 1. System Overview & Philosophy

Xentari is a CLI-based development tool designed to turn Small Language Models (SLMs) into reliable software engineers. It operates on the principle that AI should be a transparent, controllable, and safe pair programmer.

### Local-First Core
- **Privacy & Security:** Runs entirely on local models (7B–14B parameters), ensuring code never leaves the machine.
- **Independence:** No cloud dependency or recurring API costs.
- **Performance:** Optimized for speed and low-latency interaction on local hardware using OpenAI-compatible inference servers (like llama.cpp).

### Deterministic Agent Pipeline
Instead of a vague "chat" interface that produces inconsistent results, Xentari follows a strict, deterministic sequence:
**User → Plan → Retrieve → Code → Review → Advisor (Optional) → Approval → Patch → Log**

---

# 🧩 2. High-Level Architecture: The "Engine Room"

Xentari is organized into specialized layers to separate orchestration, intelligence, and safety:

1.  **PlannerAgent:** Deconstructs high-level tasks into discrete, dependency-aware implementation steps.
2.  **Deterministic Retrieval Module:** Uses strict "Context Contracts" to pull precise code blocks from the filesystem.
3.  **Retriever (Legacy Fallback):** Employs a multi-factor scoring algorithm (keyword, proximity, and indexing) when contracts aren't met.
4.  **CoderAgent:** Generates updated file content, prioritizing full-file stability over partial snippets.
5.  **Constraint Engine:** A specialized regex-based filter that strips markdown fences, conversational prose, and LLM "chatter."
6.  **ReviewerAgent:** Acts as a "Senior Developer" gate, rejecting changes that violate project standards or introduce obvious bugs.
7.  **Advisor:** An escalation mechanism that triggers only when the local model fails, optionally calling a more capable model for "fixes."
8.  **TUI Module Layer:** A component-based UI system providing stage logs, timings, and a persistent status bar.
9.  **Approval Layer:** A mandatory safety gate requiring explicit user confirmation via an interactive diff viewer.
10. **Patcher:** A Git-based engine that generates, validates, and applies standard Unified Diffs.

---

# 📂 3. Evolution Phases (Technical History)

### Phase 1 — Core Pipeline
Implemented the foundational orchestration logic. Established the basic loop: receive task, call model, apply change.
- **Key File:** `core/pipeline.ts`

### Phase 1.5 — Refactor
Separated the monolith into modular components. Introduced standard interfaces for agents and utilities to enable easier expansion.

### Phase 2 — Usability & Safety
Added essential CLI features:
- **Undo System:** Uses `git reset --hard HEAD` to immediately revert accidental changes.
- **Dry-Run Mode:** Generates and validates patches without touching the disk.
- **Multi-mode CLI:** Support for single-step execution and plan-only mode.

### Phase 3 — Intelligent Retrieval
Developed a weighted scoring system to find the most relevant files for a task.
- **Factors:** Filename match (10x weight), keyword density, and priority markers (e.g., "model", "service").
- **Key File:** `core/retriever.js`

### Phase 4 — Adaptive Model Tiers
Implemented automatic tier detection based on the model name. The system adjusts its behavior (token limits, retry counts, batch sizes) based on whether the model is classified as **Small**, **Medium**, or **Large**.
- **Key File:** `core/tier.js`

### Phase 5 — Full-File Patching
Moved away from unstable "edit blocks" to full-file generation. The system generates the entire new file content, then computes a Unified Diff locally to ensure `git apply` compatibility.
- **Key File:** `core/diff-generator.js`

### Phase 6 — Multi-Agent System
Split the AI's brain into a **Planner** (high-level architect) and an **Executor** (surgical coder). This reduces the cognitive load on local models.
- **Key Directory:** `core/agents/`

### Phase 7 — Advisor Fallback
Introduced the `advisorFix` mechanism. If the primary model fails review or produces invalid diffs twice, the system can escalate the feedback to a stronger model to "repair" the patch.
- **Key File:** `core/advisor.js`

### Phase 8 — Dynamic Context Engine
Centralized context building. The engine gathers global project rules, stack-specific docs (backend/frontend), and recent file history to build a "Rich Prompt."
- **Key File:** `core/context-engine.js`

### Phase 9 — Project Intelligence (Indexing)
Implemented a lightweight indexer that scans the project and builds a `knowledge.json` file containing file summaries, exports, and keywords.
- **Key File:** `core/indexer.js`

### Phase 10 — Terminal User Interface (TUI)
Developed an interactive shell mode with real-time streaming, command history, and custom command support (`/help`, `/index`, `/undo`).
- **Key File:** `core/tui.js`

### Phase 11 — Parallel Execution
Added a dependency-aware scheduler. Steps that don't depend on each other are executed in parallel using `Promise.all` and a file-locking system.
- **Key File:** `core/scheduler.js`, `core/locks.js`

### Phase 12 — Metrics & Observability
Integrated comprehensive tracking for every task:
- Token usage (input vs. output)
- Execution duration per stage
- Retry counts and constraint fix counts.
- **Key File:** `core/metrics.js`

### Phase 13 — Constraint Engine
Hardened the output parser. Implemented rules to strip markdown fences (` ``` `) and conversational filler ("Here is the code...") to ensure the patcher receives pure data.
- **Key File:** `core/constraints.js`

### Phase 14 — Smart Chunking
Solves the problem of large files exceeding model context windows. Files are split into 800-character chunks, scored for relevance, and only the most important parts are sent to the model.
- **Key File:** `core/chunker.js`

### Phase 15 — Lightweight RAG
Added a basic Retrieval-Augmented Generation layer. The system uses the project index to find related "knowledge blocks" and injects them into the prompt to provide cross-file awareness.
- **Key File:** `core/rag.js`

### Phase 16 — Plugin Architecture
Created an extensible system where new CLI commands can be added as plugins without modifying the core binary.
- **Key File:** `core/plugins.js`

### Phase 17 — Deterministic Retrieval (Stabilization)
Eliminated retrieval randomness by introducing **Context Contracts**. If a task is to "modify function X," the system parses the AST (or uses regex) to extract *exactly* that function, ignoring irrelevant noise.
- **Key Directory:** `core/retrieval/`

### Phase 18 — Safe Approval Layer
Implemented a mandatory safety gate. No change is ever written to disk without an interactive side-by-side diff preview and explicit user approval.
- **Key Directory:** `core/approval/`

### Phase 19 — UI/UX Overhaul
Refined the TUI with:
- **Stage-based logging:** Clear "RETRIEVE", "CODE", "REVIEW" headers.
- **Stage Timings:** Millisecond-precision tracking for bottlenecks.
- **Status Bar:** A persistent bottom-row summary of the task result.

### Phase 20 — Project Isolation System
Enabled Xentari to safely work on *other* projects.
- **Root Detection:** `resolver.js` automatically finds the nearest `package.json` or `.git`.
- **Safe Paths:** `guard.js` ensures all file writes are restricted to the project root.
- **Danger Zone:** Warns and requires extra approval if trying to modify Xentari's own core files.

### Phase 21 — Sandbox Mode
The ultimate safety feature.
- **Auto-Cloning:** Clones the target project to a temporary directory.
- **Isolated Run:** Executes the entire pipeline in the temp folder.
- **Merge Back:** Shows a diff of all sandbox changes and asks to apply them back to the real project at once.

### Phase 22 — Advanced Diff Viewer
*   **Goal:** Implement a professional-grade terminal interface for reviewing code changes.
*   **Result:**
*   **Interactive TUI:** Created `/core/tui/diffViewerInteractive.js` using pure Node.js (readline + ANSI).
*   **Side-by-side Layout:** Enables easy comparison of OLD vs NEW code in a split-screen view.
*   **Keyboard Navigation:** Supports scrolling (j/k or arrows) and quick actions (y/n) for efficient reviewing.
*   **Color-coded Diffs:** High-signal highlighting for added (green) and removed (red) lines.
*   **Safe Fallback:** Implemented a simple-diff mode if the interactive terminal is not available.

### Phase 23 — Extended Cross-Stack Support
*   **Goal:** Expand Xentari's intelligence to cover most real-world development ecosystems.
*   **Result:**
*   **Automated Detection:** Implemented `/core/project/detector.js` to identify stacks like Node, PHP (Laravel), Python (Django), Go, Java, Ruby, and Flutter based on project artifacts.
*   **Stack Profiles:** Created `/core/stacks/` to provide ecosystem-specific hints and conventions to the LLM.
*   **Dynamic Prompting:** The planner now injects tailored hints (e.g., "This is a PHP project. Framework: Laravel.") to improve the accuracy of implementation steps.
*   **Modular Coverage:** Broadened the system's applicability without adding framework-specific logic branching.

### Phase 24 — Unified UX Layer
*   **Goal:** Standardize the CLI experience for a consistent and predictable flow.
*   **Result:**
*   **UX Controller:** Implemented `/core/tui/ux.js` to centralize stage displays, success/warning/error messaging.
*   **Standardized Stages:** Pipeline execution now strictly follows unified stage headers (PLAN, RETRIEVE, CODE, REVIEW, PATCH).
*   **Unified Flow:** All code changes and critical actions are routed through a standardized Diff + Approval sequence.
*   **Consistent Feedback:** Success and failure states are clearly communicated using a unified visual language across all commands.

### Phase 25 — Session Memory
*   **Goal:** Enable context continuity and follow-up command support.
*   **Result:**
*   **Lightweight Storage:** Implemented `/core/memory/session.js` using a JSON-based history store (`session.json`) capped at 10 items.
*   **Automatic Recording:** Task details and modified file lists are automatically saved upon successful pipeline completion.
*   **Context Injection:** Recent task history is dynamically injected into the Planner's system prompt as a "Session Memory" hint.
*   **Improved Continuity:** Enables the AI to "remember" what it just did, facilitating natural language follow-ups like "now add tests for that function."

### Phase 26 — Structured Reasoning Layer
*   **Goal:** Introduce deliberate planning before execution to reduce randomness and improve decision quality.
*   **Result:**
*   **Reasoning-First Prompting:** Updated the Planner's system prompt to enforce a REASONING phase where the model must analyze dependencies and file impact before drafting steps.
*   **Strict JSON Plan:** Enforced a standard `{"steps": [...]}` JSON format for predictable parsing.
*   **Step-by-Step Orchestration:** The pipeline now iterates through the structured plan, providing clear "→ step" logging and allowing for surgical retries if a specific step fails.
*   **Improved Accuracy:** Moving from reactive coding to structured planning significantly reduces hallucinations and misaligned implementation steps.

### Phase 27 — Claude Code Style UX Layer
*   **Goal:** Upgrade the CLI to a modern, interactive AI development tool experience.
*   **Result:**
*   **Command Palette:** Implemented `/core/cli/handler.js` to support slash commands like `/help`, `/history`, `/stats`, and `/exit`.
*   **Interactive Loop:** Rebuilt the TUI loop in `core/tui.js` to provide a persistent `xen >` prompt for natural task input.
*   **Session Continuity:** Integrated Session Memory into the interactive loop, allowing users to reference previous actions naturally.
*   **Multi-File Awareness:** The system now tracks and hints at recently modified files in subsequent prompts, providing a more coherent multi-step development workflow.
*   **Polished Branding:** Standardized CLI headers and logging to provide a high-signal, professional developer experience.

### Phase 28 — Inline Edit + Partial Patch Apply
*   **Goal:** Provide granular control over patch application by allowing users to select and edit individual diff hunks.
*   **Result:**
*   **Hunk Splitting:** Created `/core/patch/partial.js` to intelligently split unified diffs into discrete, actionable chunks.
*   **Granular Selection:** Integrated a selection interface into the approval flow, enabling users to choose exactly which changes to merge.
*   **Patch Reconstruction:** Implemented logic to rebuild valid unified diffs from a subset of selected hunks.
*   **Controlled Merging:** Users can now skip specific changes (e.g., experimental code or debug logs) while applying the rest of the patch safely.
*   **Inline Editing Support:** Added the foundational logic for modifying hunk content directly before application, maximizing developer flexibility.

### Phase 29 — Codebase-Aware Index Upgrade
*   **Goal:** Enhance the project index to represent architectural metadata beyond simple file lists.
*   **Result:**
*   **Deep Analysis:** Updated the indexer to extract functions, classes, and exports using optimized heuristics.
*   **Framework Detection:** Implemented automatic identification of Laravel, Next.js, and Django stacks.
*   **Entry Point Mapping:** The system now automatically detects core files like `app.js`, `server.ts`, and `main.py`.
*   **Domain Grouping:** Files are automatically categorized into domains (Authentication, Database, API, Todos) for better context grouping.
*   **Zero-Latency Indexing:** Maintained performance under 3 seconds while providing significantly richer metadata for the Agent Pipeline.

### Phase 30 — Task Decomposition & Structured Planning
*   **Goal:** Convert broad user instructions into ordered, typed actions for more reliable execution.
*   **Result:**
*   **Multi-Step Deconstruction:** Upgraded the Planner to break tasks into 3–6 atomic steps with specific IDs and dependencies.
*   **Typed Action Schema:** Introduced standard step types (`analyze`, `read`, `modify`, `create`, `refactor`, `verify`) to categorize AI intent.
*   **Structured Output:** Enforced a strict JSON schema for plans, improving the hand-off between planning and execution layers.
*   **Heuristic Retry:** Implemented a single-retry logic for the Planner to self-correct if it produces malformed JSON during the reasoning phase.
*   **Dependency Awareness:** The system now identifies when a step depends on the output of a previous action, ensuring logical sequential flow.

### Phase 31 — Sequential Step Executor Engine
*   **Goal:** Execute complex plans step-by-step with safety guards and fault tolerance.
*   **Result:**
*   **Plan Preview & Approval:** Added a mandatory verification step where the user reviews the implementation plan before execution starts.
*   **Sequential Loop:** Implemented a robust loop that iterates through the plan, executing each typed action (`analyze` → `modify` → `verify`) in order.
*   **Step-Level Retries:** If a specific implementation step fails, the system now performs a surgical retry of just that step instead of restarting the entire task.
*   **Execution Safety:** Added step limits (warn if > 6 steps) to prevent runaway or overly complex operations that might degrade model performance.
*   **Unified Feedback:** Integrated UX stage-logging (`→ MODIFY: backend/src/app.ts`) to provide millisecond-precision visibility into the execution progress.

### Phase 32 — Session Header & Context Panel
*   **Goal:** Provide full visibility into the execution state and project context.
*   **Result:**
    *   **Session Header:** Implemented a clean, branded session header with project path and status.
    *   **Context Panel:** Added a visual summary of the detected tech stack (e.g., Node.js, Laravel) and project root to the UI.
    *   **Standardized Branding:** Established a professional CLI visual identity for the session start.

### Phase 33 — Dependency Index (Lightweight)
*   **Goal:** Track relationships between files to improve cross-file reasoning.
*   **Result:**
    *   **Import Extraction:** Updated the indexer to detect `import` and `require` statements using high-speed regex.
    *   **Path Normalization:** Implemented logic to resolve relative imports into project-scoped file paths.
    *   **Dependency Storage:** The project index now tracks a `dependencies` map for every analyzed file.

### Phase 34 — Reverse Dependency Map
*   **Goal:** Track "impact direction" by knowing which files depend on a specific module.
*   **Result:**
    *   **Inverted Graph:** The indexer now automatically builds a `reverseDependencies` map during the indexing phase.
    *   **Propagation Awareness:** Enables the system to understand that changing a utility file might break several high-level controllers.

### Phase 35 — Multi-File Retrieval
*   **Goal:** Automatically include relevant dependencies in the AI's context.
*   **Result:**
    *   **Context Expansion:** Retrieval now automatically pulls in up to 2 direct dependencies and 2 reverse dependencies for the primary file.
    *   **Holistic Context:** Provides the LLM with a 360-degree view of how a file interacts with the rest of the project.

### Phase 36 — Impact Analysis
*   **Goal:** Warn users about the potential side effects of a code change.
*   **Result:**
    *   **Pre-Patch Analysis:** The executor now displays a "⚠ Impact Analysis" warning listing all files that might be affected by the current edit.
    *   **Risk Mitigation:** Improves developer confidence when making changes to core shared modules.

### Phase 37 — Multi-File Reasoning in Steps
*   **Goal:** Improve code consistency across multiple files in a single task.
*   **Result:**
    *   **Referential Context:** The CoderAgent now distinguishes between files it must *modify* and files it should use as *reference*.
    *   **Cross-File Integrity:** Significantly reduces broken imports and inconsistent function calls in AI-generated code.

### Phase 38 — Module Detection (Architecture Layer)
*   **Goal:** Understand project structure at a logical domain level.
*   **Result:**
    *   **Domain Grouping:** Implemented heuristics to group files into logical modules like `authentication`, `users`, `todos`, and `payments`.
    *   **High-Level Overview:** The project index now represents the codebase as a set of interacting modules rather than a flat file list.

### Phase 39 — Command Palette + Quick Actions
*   **Goal:** Enhance CLI interactivity with keyboard shortcuts and context-aware quick actions.
*   **Result:**
    *   **Interactive Palette:** Implemented `/core/cli/palette.js` to define common developer actions (`/fix`, `/refactor`, `/test`).
    *   **Hotkey Support:** Added `Ctrl+P` hotkey to instantly toggle the command palette display without interrupting the task loop.
    *   **Intelligent Task Mapping:** Shortcuts are automatically expanded into descriptive tasks (e.g., `/fix auth` becomes "Fix current issue regarding auth").
    *   **Contextual Awareness:** Palette actions leverage recent session memory to target the most relevant files automatically.
    *   **Refined UX:** Updated the TUI to feel like a modern IDE-integrated tool with high-signal feedback and streamlined command execution.

### Phase 40 — Module-Aware Retrieval
*   **Goal:** Prioritize entire architectural domains during context building.
*   **Result:**
    *   **Domain Detection:** Updated `retriever.js` to identify if a task targets a specific module (e.g., "auth").
    *   **Module-Wide Context:** Automatically includes top files from the detected module to provide the LLM with a complete structural view of the domain.

### Phase 41 — System Flow Detection
*   **Goal:** Understand how requests propagate through the system layers.
*   **Result:**
    *   **Layered Heuristics:** Implemented logic in `indexer.js` to sort module files by their functional rank (`route` → `controller` → `service` → `model`).
    *   **Execution Path Mapping:** The project index now tracks logical "flows," allowing the AI to understand the chain of command within a module.

### Phase 42 — Flow-Aware Execution
*   **Goal:** Guide code changes to follow established architectural patterns.
*   **Result:**
    *   **Sequential Awareness:** The executor now logs and prioritizes the detected system flow during multi-step tasks.
    *   **Cross-Layer Consistency:** Ensures that a change to a "model" correctly propagates updates back to the "service" and "controller."

### Phase 43 — Architecture Context Injection
*   **Goal:** Provide the LLM with explicit system-level structural hints.
*   **Result:**
    *   **Architectural Prompting:** Automatically injects the detected Module and Logical Flow into the system prompt.
    *   **Reduced Confusion:** Minimizes LLM mistakes regarding where to place logic and how different files interact.

### Phase 44 — Pattern Memory (Success Learning)
*   **Goal:** Improve system accuracy by learning from past successful executions.
*   **Result:**
    *   **Intel Storage:** Upgraded `memory.js` to store the last 20 successful task patterns and their associated file sets.
    *   **Positive Reinforcement:** The system now "remembers" which files were successfully modified for specific task types.

### Phase 45 — Failure Memory
*   **Goal:** Avoid repeating unsuccessful strategies and buggy code paths.
*   **Result:**
    *   **Error Reflection:** Structured failure data (task type, fail type, reason) is recorded in `reflection.json`.
    *   **Negative Reinforcement:** Prevents the AI from repeatedly attempting the same incorrect file selections or logic patterns.

### Phase 46 — Decision Biasing
*   **Goal:** Use session and pattern memory to steer the Planner and Retriever.
*   **Result:**
    *   **Guided Planning:** The Planner agent now receives hints about previously successful approaches and files to avoid.
    *   **Smarter Selection:** Automatically prioritizes files that have worked in the past for similar tasks, reducing overall retry rates.

### Phase 47 — Self-Improvement Loop
*   **Goal:** Continuously evolve the system's performance through data-driven insights.
*   **Result:**
    *   **Performance Analytics:** Implemented `core/analytics.js` to track historical success rates, avg retries, and top failure categories.
    *   **Weekly Insights:** Generates automated summaries of system health, identifying exactly which architectural layer needs tuning.

### Phase 48 — ASCII Header & System Banner
*   **Goal:** Establish a professional, branded CLI experience.
*   **Result:**
    *   **Branded Startup:** Implemented `/core/tui/header.js` with a custom ASCII logo and system status display.
    *   **Context Visibility:** Instantly shows the project root, tech stack, and framework upon session start.

### Phase 49 — Color Theme System (ANSI Based)
*   **Goal:** Enhance UI readability using high-signal color-coding.
*   **Result:**
    *   **Unified Theme:** Centralized ANSI color utilities in `/core/tui/colors.js`.
    *   **Semantic Feedback:** Standardized Success (Green), Warning (Yellow), and Error (Red) visual languages across the entire CLI.

### Phase 50 — Side-by-Side Diff Viewer (Colored)
*   **Goal:** Provide a high-density, professional-grade code review interface.
*   **Result:**
    *   **Parallel Comparison:** Created `/core/diff/align.js` to structure OLD vs NEW code into structured columns.
    *   **High-Signal Highlighting:** Aligned with the color system to clearly mark additions and removals in a split-screen terminal view.

### Phase 51 — Clean Storage Policy
*   **Goal:** Zero project pollution. Ensure Xentari remains non-intrusive.
*   **Result:**
    *   **Centralized Metadata:** All internal files (index, memory, intelligence) are now strictly stored in a hidden `.xentari/` directory.
    *   **Git Integrity:** Automatically manages `.gitignore` to keep internal metadata out of the user's repository.
    *   **Clean Root:** Purged all stray agent, context, and memory files from the project root.

### Phase 52 — Smart Auto-Placement & Directory Selection
*   **Goal:** Deterministically resolve file locations during recovery to minimize user prompts.
*   **Result:**
    *   **Rule-Based Mapping:** Implemented keyword-aware placement (`controller` → `src/controllers`, etc.) with HIGH/MEDIUM confidence scoring.
    *   **Dynamic Directory Scanning:** Rebuilt the directory selector to scan the real project structure (`fs.readdirSync`) instead of using hardcoded lists.
    *   **Interactive Fallback:** Only interrupts the user when confidence is LOW, maintaining a seamless TUI experience.

### Phase 53 — Patch Retry Flow Control (Executor-Level)
*   **Goal:** Ensure the system recovers from patch failures without restarting the entire pipeline.
*   **Result:**
    *   **Recovery Signaling:** `applyPatch` now returns a `retry` signal upon successful file creation.
    *   **Surgical Retries:** The Executor intercepts the retry signal and re-triggers the patch step with updated paths, bypassing the Planner and Retriever.
    *   **Stability Policy:** Limits recovery to 1 retry per step to prevent infinite loops while ensuring 100% success on missing file cases.

### Phase 54 — Deterministic Failure Simulation Suite
*   **Goal:** Validate system robustness against real-world edge cases.
*   **Result:**
    *   **Simulation Module:** Created `core/utils/simulation.js` to inject specific failures (Missing File, Permission Denied, Malformed Output).
    *   **Pipeline Hook:** Integrated simulation triggers into the execution flow using environment variables (`XEN_SIMULATE`).
    *   **Robustness Testing:** Enables automated validation of the recovery flows implemented in Phase 52 and 53.

### Phase 55 — High-Integrity Patch Generation (Diff Headers)
*   **Goal:** Resolve `bad git-diff` errors during new file creation.
*   **Result:**
    *   **Header Sanitization:** Rebuilt `core/diff.ts` to strictly enforce Git-standard headers (`--- /dev/null`) for new files, removing incompatible timestamps and filenames generated by the `diff` library.
    - **Prefix Alignment:** Standardized `a/` and `b/` prefixing to ensure absolute compatibility with standard `git apply` pipelines.

### Phase 56 — E2E Stability Validation & Diagnostic Reporting
*   **Goal:** Conduct a comprehensive real-world audit of the system on a live Node.js project.
*   **Result:**
    *   **Diagnostic Report:** Generated an E2E audit (`E2E_Test_Report.md`) identifying core weaknesses in Coder precision and dependency awareness.
    *   **Automation Hooks:** Successfully verified that the system can be automated via environment variables (e.g., `XEN_AUTO_APPROVE`) for CI/CD and remote testing.
    *   **Regression Fixes:** Identified and fixed a critical syntax error in `diff.ts` discovered during the E2E execution loop.

### Phase 57 — Zero-Configuration Auto-Indexing (Strict Enforcement)
*   **Goal:** Ensure the system always operates with fresh project knowledge without manual intervention.
*   **Result:**
    *   **Strict Startup Check:** Implemented a mandatory indexing gate in the execution pipeline and TUI loop.
    *   **No Fallback Policy:** Eliminated "Fallback to legacy" retrieval modes; the system now guarantees a high-fidelity index is available before any planning or code generation starts.
    *   **Just-in-Time Indexing:** Automatically triggers `indexProject` on session start if no `.xentari/` index is found.


### Phase 58 — Anti-Hallucination Dependency Injection
*   **Goal:** Prevent models from assuming the existence of libraries not present in the project.
*   **Result:**
    *   **Context Hardware:** Integrated `package.json` analysis directly into the `DynamicContext` engine.
    *   **Strict Constraints:** All planners and coders now receive a mandatory `# PROJECT DEPENDENCIES` block, grounding their architectural choices in the actual available stack.

### Phase 59 — Strict Target Path Enforcement
*   **Goal:** Eliminate "Coder Deviation" where the agent modifies files outside the intended scope.
*   **Result:**
    *   **Validation Gate:** The Executor now rejects any update where the returned file path does not match the expected `targetPath`.
    *   **Atomic Updates:** Enforced single-file modifications per step to simplify verification and prevent cascading errors.

### Phase 60 — Reinforced Dependency Injection
*   **Goal:** Provide the LLM with a definitive source of truth for the project's library stack.
*   **Result:**
    *   **Manifest Parsing:** Robust JSON parsing of `package.json` ensures that devDependencies and production dependencies are always present in the prompt.
    *   **Prompt Hardening:** Explicitly instructed the model to "Use ONLY the dependencies listed; do NOT assume libraries."

### Phase 61 — Diff System Hardening (Full-File Flow)
*   **Goal:** Eliminate malformed patch errors caused by LLM-generated diffs.
*   **Result:**
    *   **System-Managed Diffs:** Moved from model-generated diffs to a "Full Content -> Unified Diff" flow. The model provides the final file content, and Xentari's core logic generates the standard Git patch.
    *   **Sanitization Loop:** Integrated automatic markdown removal and whitespace trimming before the diffing stage.

### Phase 62 — Strict Code Output Contract
*   **Goal:** Ensure 100% clean code output without conversational prose.
*   - **Rule Enforcement:** Updated the system prompt to explicitly forbid markdown blocks, explanations, and conversational filler.
*   - **Failure Rejection:** Added a validation layer that rejects output containing conversational markers or incomplete file structures.

### Phase 63 — CREATE Step Guarantee
*   **Goal:** Ensure the system never fails when attempting to create a new module.
*   **Result:**
    *   **Pre-Initialization:** The Executor now guarantees file and directory existence (via `mkdirSync` and `writeFileSync`) *before* the agent begins work.
    *   **Reliable Application:** Eliminates `git apply` failures that occur when the target file is missing.

### Phase 64 — Retrieval Strict Mode (No Fallback)
*   **Goal:** Ensure retrieval results are deterministic and index-driven.
*   **Result:**
    *   **Fallback Removal:** Removed "Broad Search" fallbacks that often introduced irrelevant context into the model window.
    *   **Index Dependency:** Retrieval now strictly requires a valid index, returning an empty set instead of "guessing" when no semantic match is found.

### Phase 65 — Automated Stress-Test Suite
*   **Goal:** Deterministically validate system stability across all failure scenarios.
*   **Result:**
    *   **Failure Orchestration:** Developed a dedicated stress-testing runner that simulates environmental chaos (deleted directories, missing manifests) and model hallucinations (markdown leakage, raw diffs).
    *   **Recovery Validation:** Confirmed that the system gracefully handles and recovers from empty LLM responses, target deviations, and patch application failures.
    *   **Baseline Established:** Achieved 100% pass rate on core recovery flows (Bootstrap, creation, and sanitization).

### Phase 66 — CLI UI Refactor (Production Grade)
*   **Goal:** Eliminate ambiguity and provide full visibility into the execution state machine.
*   **Result:**
    *   **Deterministic Status Indicators:** Implemented `→ STEP STATE` format (e.g., `→ PLAN ✓`, `→ CODE generating...`).
    *   **Strict Error Template:** Standardized error reporting with `✗ ERROR_CODE`, `Reason`, and `Action` for clear troubleshooting.
    *   **Diff Preview Standardization:** Enforced a mandatory `--- / +++` diff format with side-by-side verification before patching.
    *   **Session Summary:** Added a comprehensive post-execution report detailing updated files, line deltas, and execution time.

### Phase 67 — Full Agentic Prompt + Scaffold (Phase 3 Ready)
*   **Goal:** Enforce a strict code output contract and align the model with a structured project scaffold.
*   **Result:**
    *   **Prompt Hardening:** Integrated a "Deterministic Code Generator" prompt that prohibits markdown, explanations, and partial files.
    *   **Scaffold Awareness:** Optimized the agent to operate within a structured `xentari/` directory containing `plan.json`, `state.json`, and module-specific task definitions.
    *   **Integrity Guarantee:** The system now enforces raw code-only outputs, treating the LLM as a precise compiler rather than a conversational assistant.

### Phase 68 — Deterministic Task Generation
*   **Goal:** Automate the creation of structured, atomic task lists for project initialization.
*   **Result:**
    *   **Task Generator:** Developed `xentari-task-generator.js` to programmatically build a project plan based on module definitions.
    *   **Atomic Steps:** Ensures that every step targets a single file with explicit constraints, reducing model hallucination and improving success rates.

### Phase 69 — Version Control & Persistence
*   **Goal:** Automate the backup and documentation of significant project iterations.
*   **Result:**
    *   **Git Automation:** Implemented a workflow to commit and push changes after major stability milestones.
    *   **Documentation Sync:** All architectural changes and UI refinements are automatically synchronized with the `report.md` for continuous study and onboarding.

### Phase 70 — Execution Target Alignment & Pipeline Hardening
*   **Goal:** Fix hallucinatory target deviations during multi-step automated execution.
*   **Result:**
    *   **Target Deviation Fix:** Eradicated `TARGET_VIOLATION` errors by removing legacy filename inference logic in `coder.js` that previously conflicted with the deterministic retrieval engine.
    *   **Contextual Binding:** Added strict injection in `executor.ts`, ensuring the coder agent ALWAYS receives detailed task descriptions and strict constraints instead of naked file paths.
    *   **End-to-End Stability:** Verified that the multi-step scaffolding pipeline fully iterates through pre-generated `task.json` plans without throwing execution sequence errors.

### Phase 71 — External Isolation Testing & E2E Scaffold Validation
*   **Goal:** Run a clean end-to-end scaffolding test fully outside the Xentari source tree to validate execution stability in a real-world project scenario.
*   **Result:**
    *   **Isolation Enforcement:** Identified and enforced a firm rule: all test scaffold projects must be created outside the Xentari codebase (e.g., `Desktop/Projects/xentari-testing`). Creating test projects inside the Xentari repository polluted the `.xentari/` knowledge index, causing the agent to confuse its own configuration files as target context.
    *   **Scaffold Execution Verified:** Successfully ran `xen run "build project"` in `Desktop/Projects/xentari-testing` against a full 10-step Todo API scaffold definition (`plan.json` + task files).
    *   **Pipeline Stability Confirmed:** All 10 tasks loaded correctly. Zero `TARGET_VIOLATION` errors. The executor correctly hydrated each step's `update.file` with `step.target` before enforcement checks.
    *   **Generator Fix:** Updated `xentari-task-generator.cjs` to emit `001.json`, `002.json`, etc. (matching the executor's strict `<id>.json` lookup format) rather than verbose filenames, resolving a silent task-loading failure.
    *   **Known Model Behaviour (Not CLI Bug):** The underlying LLM occasionally blends multi-file context into a single output (e.g., outputting `package.json` content into `src/index.js`). This is a prompt-engineering boundary issue within the model layer and does not affect the state machine integrity.

### Phase 72 — Context Engine (Context Bundle)
*   **Goal:** Eliminate context confusion and ensure correct file relationships.
*   **Result:**
    *   **Deterministic Selection:** Implemented `/core/retrieval/contextEngine.ts` to select and format exact context bundles (Target, Related, Pattern, Rules).
    *   **Relation Mapping:** Integrated static relation maps and auto-context extraction via the dependency indexer.
    *   **Context Limiter:** Enforced a 3-file limit for related context to minimize input for small models.
    *   **Deterministic Prompting:** Updated the CoderAgent to strictly use the formatted context bundle, reducing hallucinations and irrelevant code injections.

### Phase 73 — Multi-File Orchestration & Test-Aware Execution
*   **Goal:** Safely coordinate changes across multiple files with automated validation.
*   **Result:**
    *   **Sequential Execution:** Upgraded the Executor to iterate through atomic steps, maintaining state in `state.json`.
    *   **Test-Aware Validation:** Integrated `runTest` in the execution loop to verify each change against a generated JS test case before proceeding.
    *   **Robust Recovery:** Implemented a mandatory 1-retry policy for validation failures, allowing the model to self-correct based on summarized test output.
    *   **Structure Enforcement:** Automated the application of Phase 4 structure validation within the orchestration loop.

### Phase 74 — Pattern Validation Hardening
*   **Goal:** Fix false positives in structural validation.
*   **Result:**
    *   **Sanitized Content:** Updated `validateStructure` in `patterns.js` to strip strings and comments before running regex checks.
    *   **Word Boundaries:** Switched to word-boundary regex (`\breq\b`) to prevent matches within other variable names or literals.
    *   **Deterministic Success:** Verified the fix against the `patterns.test.js` suite, achieving 100% pass rate.

### Phase 75 — Consistency Engine (System Snapshot)
*   **Goal:** Ensure cross-file and cross-step consistency beyond single-file validity.
*   **Result:**
    *   **Snapshot Management:** Implemented `/core/retrieval/consistency.ts` to capture, persist, and load system snapshots (hashes and exports).
    *   **Contract Validation:** Added logic to detect "Contract Mismatches" by verifying that functions used in one file (e.g., controller) are actually exported by its dependencies (e.g., service).
    *   **Cascade Guard:** Implemented a system-wide block that prevents subsequent steps from executing if a previous step has failed, protecting system integrity.
    *   **Stale Context Detection:** Added JIT checks to ensure that the context being used by the model hasn't drifted since the snapshot was taken.
    *   **Interface Preservation:** Enforced strict rules against renaming or removing exported functions without explicit coordination, reducing the risk of broken modules during multi-step tasks.

### Phase 76 — Intent Engine (Controlled Flexibility)
*   **Goal:** Enable safe, intent-driven evolution of the codebase while maintaining strict control.
*   **Result:**
    *   **Intent Awareness:** Implemented `/core/retrieval/intentEngine.ts` to define and enforce task intent (modify, refactor, add, remove).
    *   **Scope Enforcement:** Added strict validation to ensure changes are restricted to the intended file or module scope.
    *   **Controlled Breaking:** Enabled the system to allow necessary "breaking changes" (like function renames) ONLY when the intent is explicitly set to `refactor`.
    *   **Minimal Change Enforcer:** Introduced heuristics to prevent "over-modification" where a model might rewrite large portions of a file unnecessarily for a small task.
    *   **Guided Implementation:** The Planner now generates explicit intents for each step, which are then used to ground the Coder and validator layers in the PURPOSE of the change.

### Phase 77 — Feedback Engine (Self-Improvement Loop)
*   **Goal:** Capture failures as structured signals to improve system performance over time without changing core architecture.
*   **Result:**
    *   **Failure Logging:** Implemented `/core/retrieval/feedbackEngine.ts` to record and classify execution/validation failures in `.xentari/feedback.json`.
    *   **Pattern Detection:** Added logic to detect repeated failure patterns for specific files or implementation steps.
    *   **Feedback Injection:** Integrated JIT feedback injection into the CoderAgent's prompt. If a step has failed previously, the system explicitly warns the model about the most common error (e.g., "Contract Mismatch" or "Balanced Braces").
    *   **Failure Classification:** Implemented a classifier that categorizes issues into Consistency, Behavior, Output, or Context failures, allowing for targeted system adaptations.
    *   **Continuous Learning:** The system now "learns" from every unsuccessful attempt, effectively narrowing the model's decision surface based on historical project experience.

### Phase 78 — Structure Enforcement (Agent + System Spec)
*   **Goal:** Eliminate architectural inconsistency, make structure deterministic, and reduce model decision surface to near-zero.
*   **Result:**
    *   **Structure Lock:** Shifted architectural responsibility from the model to the system. The model now acts as an implementation engine only, filling predefined templates.
    *   **Pattern Engine:** Implemented `/core/patterns.js` and `stacks/{stack}/patterns/` to store and manage deterministic templates for core components (Controllers, Services, Routes, Models).
    *   **Role-Based Prompting:** The system now injects a specific `ROLE` (e.g., `controller`) and `PATTERN` into the agent's prompt, along with a strict template that MUST be followed exactly.
    *   **Deterministic Validation:** Added a structure validation layer that rejects any model output violating the pattern (e.g., missing `req`/`res` in a controller or using ES modules where CommonJS is required).
    *   **Integrated Planning:** Upgraded the Planner Agent to autonomously assign roles and patterns to individual implementation steps in the `plan.json`.
    *   **Hardened Enforcement:** Established strict rules against changing module exports, adding unauthorized layers, or removing required functions from templates.

---

# 🔄 4. Core System Flows (Study Paths)

### Retrieval Flow (Hybrid Model)
1.  **Contract Resolution:** System checks if the task matches a strict contract (e.g., `modify_function`).
2.  **Deterministic Extraction:** If matched, it extracts imports and function blocks directly from disk.
3.  **Legacy Fallback:** If no contract is met, the `Retriever` scores files based on task keywords.
4.  **Chunking:** Large files are segmented; only relevant chunks are selected.
5.  **Hashing:** The final context is hashed (SHA-1) for observability.

### Patch Safety Flow
1.  **Generation:** Coder generates raw content based on the plan.
2.  **Constraint:** Filter strips markdown fences and conversational prose.
3.  **Validation:** `validator.js` checks for common syntax errors.
4.  **Diffing:** `patchToUnified` creates a standard `.patch`.
5.  **Approval:** System displays a side-by-side preview.
6.  **Application:** Uses `git apply` for high-integrity writes.

---

# 📂 5. Project Structure (Module Breakdown)

Xentari is organized into a modular hierarchy to separate concerns:

### 🚀 Entry Point
*   **`bin/xen.js`**: The command-line interface. Responsible for argument parsing, configuration loading, and dispatching tasks to either the TUI or the Agent Pipeline.

### 🧠 Agent Layer (`core/`, `core/agents/`)
*   **`core/executor.ts`**: The orchestrator. Manages the lifecycle of a task, including planning, executing individual steps, and overseeing validation via the Consistency and Intent engines.
*   **`planner.agent.js`**: The architect. Analyzes high-level tasks and produces a structured JSON plan with dependencies.
*   **`coder.agent.js`**: The developer. Takes context and instructions to generate final file content.
*   **`reviewer.agent.js`**: The senior dev. Reviews generated patches for correctness and stylistic adherence.

### 🔍 Context & Retrieval (`core/retrieval/`, `core/`)
*   **`retrieval/`**: Modern deterministic extraction logic using strict contracts to pull precise function/class blocks.
*   **`context-engine.js`**: Builds dynamic LLM prompts by combining global rules, stack-specific context, and relevant project knowledge.
*   **`index.ts`**: Scans the project to create a searchable index (`index.json`) for semantic matching.
*   **`retriever.js`**: A multi-factor scoring engine that finds relevant files using keywords, recent history, and index data.
*   **`rag.js`**: Implements basic Retrieval-Augmented Generation for specialized project knowledge.

### 🛡 Safety & Project Management (`core/project/`, `core/sandbox/`, `core/approval/`)
*   **`project/`**: Contains the **Isolation System**. Detects project roots, **auto-detects tech stacks**, and ensures all file operations stay within "Safe Paths."
*   **`stacks/`**: New module containing **Ecosystem Profiles** (Python, PHP, Go, etc.) to provide stack-specific intelligence.
*   **`sandbox/`**: Manages temporary execution environments by cloning projects to prevent accidental corruption.
*   **`approval/`**: Handles the logic for user-gated operations (Danger Zone warnings, sandbox deployment).
*   **`locks.js`**: Prevents race conditions during parallel step execution.

### 🛠 Core Infrastructure (`core/`)
*   **`llm.js`**: The communication bridge to local inference servers (OpenAI-compatible). Handles streaming and token estimation.
*   **`patcher.js`**: A robust wrapper around Git for validating, applying, and undoing changes. **Integrated with Interactive Diff Viewer.**
*   **`scheduler.js`**: A dependency-graph solver that batches independent plan steps for parallel processing.
*   **`diff-generator.js`**: Transforms raw LLM output into standard Unified Diffs.
*   **`chunker.js`**: Breaks large files into manageable pieces for model context windows.

### 🖥 User Interface (`core/tui/`, `core/tui.js`)
*   **`tui/`**: A library of UI components including stage-based logs, a persistent status bar, and an **Advanced Interactive Diff Viewer** with keyboard navigation.
*   **`tui.js`**: The main interactive loop for the Xen CLI.

---

# 📊 6. Validation & Scoring System

Xentari uses a data-driven approach to measure reliability:

### Target Metrics
- **Success Rate:** ≥ 80% (Tasks completed without manual intervention)
- **Retry Rate:** ≤ 1.5 average retries per task.
- **Patch Integrity:** 100% (No corrupted files or invalid syntax allowed).
- **Inference Speed:** < 10s for typical code generations.

### Bug Classification (`logs/bugs.json`)
The system logs failures into categories:
- `retrieval`: Wrong file or missing context.
- `generation`: Logic errors in AI output.
- `format`: Invalid diff or markdown leakage.
- `execution`: Crashes or system errors.

---

# 📌 7. Current Project Status & Roadmap

Xentari has evolved into a **Professional-Grade Local Assistant**. It is now **Deterministic**, **Safe**, and **Highly Observable**.

### Next Strategic Focus:
1. **Full TypeScript Migration:** Transitioning all remaining `.js` files to `.ts` and implementing strict type-checking across agent boundaries.
2. **Advanced Contract Expansion:** Developing specialized context contracts for frontend frameworks (React/Next.js) and data-heavy Python stacks.
3. **Cross-Workspace Dashboard:** Enhancing the metrics system to provide a unified view of performance across multiple indexed projects.
4. **Interactive Conflict Resolution:** Implementing a terminal UI for resolving merge conflicts during sandbox deployments.
5. **Agentic Benchmarking:** Creating a standardized suite of coding tasks to measure and compare the efficiency of different local models within the Xentari pipeline.

---

# 🏁 8. Summary: Why Xentari Wins
Xentari succeeds because it prioritizes **Transparency and Control**. By combining deterministic logic with a high-signal interface and a manual approval gate, it transforms AI from a "black box" into a reliable, local-first pair programmer.

### E13 — CORE UNIT + INTEGRATION TEST SUITE (Hardened)
*   **Goal:** Establish a production-grade testing framework for unit, integration, and system-level validation.
*   **Result:**
    *   **Unified Test Runner:** Implemented a minimal, async-aware test runner (`tests/testRunner.js`) for high-fidelity validation.
    *   **Multi-Tier Test Suite:**
        *   **Unit Tests:** Validates core logic in isolation (Parser, Policy, Whitelist).
        *   **Integration Tests:** Verifies complex module interactions (SafeExec, StackLoader).
        *   **System Tests:** Exercises the full execution pipeline (`executionLoop`) from plan to execution.
    *   **Adversarial Security Testing:** Added specialized tests to verify protection against unicode-based bypasses and path traversal attacks.
    *   **Non-Interactive Automation:** Updated the permission gate to support `XEN_AUTO_APPROVE`, enabling automated CI/CD and regression testing.
    *   **UI Snapshot Validation:** Integrated basic UI rendering tests to ensure layout stability during system execution.

### E14 — TUI UPGRADE (SPLIT PANELS + PERSISTENT LOOP)
*   **Goal:** Transform Xentari from a one-time execution CLI into a persistent, multi-panel TUI system.
*   **Result:**
    *   **Persistent CLI Loop:** Implemented a long-running execution model where the process remains active, enabling live status monitoring and user interactivity.
    *   **Split-Panel Layout:** Created a dual-panel rendering system (`core/ui/layout.js`) that divides the terminal into logical regions (Actions/History vs. Diffs/Details).
    *   **Non-Blocking Input:** Integrated a raw-mode input listener (`core/ui/input.js`) that allows real-time user commands without interrupting the background execution flow.
    *   **Continuous Refresh Engine:** Implemented a non-flicker UI refresh loop (`core/ui/loop.js`) to maintain visual consistency across all terminal states.
    *   **State-Driven Rendering:** Centralized UI logic into a reactive state machine (`core/ui/state.js`), ensuring the TUI always reflects the current system truth.

### E12 — FAILURE INTELLIGENCE SYSTEM
*   **Goal:** Transform Xentari into a self-correcting deterministic execution system by classifying and intelligently retrying failures.
*   **Result:**
    *   **Failure Classifier:** Implemented `core/execution/failureClassifier.js` to map error messages to specific categories (ENVIRONMENT, PERMISSION, CODE, VALIDATION) and determine retry eligibility.
    *   **Retry Intelligence Engine:** Created `core/execution/retryEngine.js` to manage execution retries, enforcing a maximum retry limit and coordinating with the classifier.
    *   **Enhanced Execution Loop:** Upgraded `core/execution/engine.js` to integrate retry logic, automatically repeating steps on recoverable failures (e.g., syntax or validation errors).
    *   **State-Driven UI Integration:** Fully integrated the execution loop with the TUI state machine, providing real-time visual feedback for runs, failures, and retries.
    *   **Resilient Orchestration:** The system now intelligently decides whether to halt or attempt recovery based on the structural nature of the error, significantly increasing the success rate of complex tasks.

### CORE TEST SUITE — ADVANCED
*   **Goal:** Establish a multi-tier, high-fidelity validation framework to ensure deterministic behavior across all system layers.
*   **Result:**
    *   **Unit Testing Layer:** Implemented strict logic validation for the Parser (including unicode bypass checks), Failure Classifier, and UI State Machine.
    *   **Feature Validation:** Created targeted tests for the Retry Engine and SafeExec wrapper to ensure specific engine capabilities behave as intended.
    *   **Integration & System Coverage:** Developed end-to-end flows in `tests/integration/` and `tests/system/` to verify the execution engine's stability during complex, multi-step operations.
    *   **Automated Regression Guard:** Implemented a source-scanning regression test (`tests/regression/regression.test.js`) to prevent the accidental introduction of unsafe `child_process.exec` calls.
    *   **High-Signal Reporting:** All tests are integrated into a unified entry point with deterministic PASS/FAIL signaling, ensuring no architectural regressions are merged into the core.
