# 🧠 Xentari — The Ultimate Case Study & Product Manual (Phases 1–79)

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

### MULTI-STEP VALIDATION TESTS
*   **Goal:** Validate Xentari’s multi-step execution, failure intelligence, retry system, and TUI consistency in an isolated, high-stress environment.
*   **Result:**
    *   **Successful Multi-Step Execution:** Verified through `test-01-basic-success` and `test-09-sequential`, confirming that Xentari correctly orchestrates sequential tasks without state corruption.
    *   **Failure Intelligence Accuracy:** `test-02-retry-code` and `test-04-mixed` successfully demonstrated failure classification as CODE, triggering correct retry behaviors.
    *   **Retry Boundary Enforcement:** `test-06-multi-retry` confirmed that the system respects retry limits and successfully recovers on subsequent attempts when recoverable.
    *   **Non-Retryable Halt:** `test-03-non-retry` and `test-05-security` verified that ENVIRONMENT and Security failures correctly halt execution without infinite retry loops.
    *   **Plan Integrity Gate:** `test-07-plan-validation` confirmed that the execution loop rejects malformed or incomplete plans before attempting execution.
    *   **TUI Stability & History Management:** `test-08-ui` successfully validated the action history capping (limit of 20), ensuring no UI overflow or layout breakage during long-running tasks.

### E15 — TRUST BUILDING + CHAOS TESTING
*   **Goal:** Strengthen system reliability, predictability, and debuggability through deterministic validation and stress-testing.
*   **Result:**
    *   **Determinism Validation:** Implemented `tests/determinism.test.js` to ensure identical plans yield identical results across multiple execution cycles.
    *   **Chaos Testing Suite:** Created `tests/chaos.test.js` to verify the system's resilience against malformed inputs, unicode bypasses, and shell injection attempts.
    *   **Execution Snapshot System:** Developed `core/execution/snapshot.js` to persist a full audit trail of steps, results, and contexts in `.xentari/snapshots.log`.
    *   **Debug Trace Layer:** Implemented `core/execution/trace.js`, a high-frequency in-memory circular buffer (cap: 50) for real-time observability.
    *   **UI Observability Hook:** Integrated the trace buffer into the TUI state machine, enabling future real-time debugging views within the CLI.
    *   **Normalization Resilience:** Confirmed that the `safeExec` engine correctly normalizes and handles varied whitespace and unicode characters while rejecting dangerous control characters.

### OBSERVABILITY UI — TIMELINE + DEBUG PANEL
*   **Goal:** Visualize the internal execution trace and provide enhanced debugging tools within the TUI.
*   **Result:**
    *   **Execution Timeline System:** Implemented a new panel to visualize the high-frequency trace buffer, showing real-time state transitions (STEP, FAIL, RETRY, OK).
    *   **Scrollable UI Regions:** Added vertical scrolling support (`j`/`k`) for both Action History and Timeline panels to handle long-running sessions without overflow.
    *   **Multi-View Panel Switching:** Integrated keyboard shortcuts (`1`, `2`, `3`) to instantly switch between Actions, Timeline, and Debug views.
    *   **Integrated Debug Panel:** Created a dedicated system status view showing the last execution step, failure types, precise timestamps, and snapshot counts.
    *   **Reactive UI state:** Extended the state machine to handle view-specific offsets and timeline data, ensuring perfect synchronization between background execution and user display.

### BATTLE TESTING — EXTERNAL HARNESS
*   **Goal:** Validate Xentari as a black-box system using an external, non-intrusive test suite.
*   **Result:**
    *   **External Test Location:** Implemented at `/Users/rabbi/Desktop/xentari-tests/` to ensure zero pollution of the core codebase.
    *   **Black-Box Validation:** Verified the CLI through `runner.js` using `child_process.execSync`, testing the system exactly as an end-user would.
    *   **Attack Resilience:** Successfully blocked 5/5 execution attacks, including shell-injection attempts and unicode-based ampersand bypasses.
    *   **Path Traversal Prevention:** Confirmed that filesystem attacks (e.g., accessing `/etc/passwd` or `../secret.js`) are correctly detected and blocked by the argument validator.
    *   **Deterministic Stability:** Verified that identical task inputs yield consistent execution statuses across multiple runs.
    *   **Regression Fixes:** Identified and resolved two critical `SyntaxError` bugs in the `coder.js` and `agents/index.js` modules discovered during external execution.

### WEB UI PHASE 1 — HEADLESS INTERFACE
*   **Goal:** Provide a web-based interface for Xentari without modifying core execution logic.
*   **Result:**
    *   **HTTP API Layer:** Implemented an Express server (`core/server/app.js`) with a `/run` endpoint to trigger system tasks and a `/state` endpoint for on-demand state retrieval.
    *   **WebSocket Streaming:** Created a WebSocket server (`core/server/ws.js`) that broadcasts real-time state updates (5fps) to all connected web clients.
    *   **React Frontend:** Scaffolded a Vite-powered React application (`web/`) that visualizes internal state, execution traces, and provides a remote command input.
    *   **State-Driven Visualization:** The Web UI consumes the same reactive state machine (`core/ui/state.js`) used by the TUI, ensuring visual parity across interfaces.
    *   **System Decoupling:** Maintained strict separation between the core engine and the interface layer, enabling dual-mode operation (CLI and Web) simultaneously.

### WEB UI — STRUCTURED IDE LAYOUT
*   **Goal:** Upgrade Xentari Web UI into a structured IDE-like interface with continuous automation support.
*   **Result:**
    *   **AUTO mode fix:** Updated backend `/run` endpoint to pass `{ auto: true }` directly, preventing blockages by CLI permission prompts.
    *   **3-panel system:** Restructured the frontend into dedicated left (Agent), center (Output), and right (Context) panels.
    *   **Agent panel:** Visualizes real-time execution actions and raw thinking trace data.
    *   **Context panel:** Continuously displays system stack, phase, and mode attributes.
    *   **Trace UI:** Styled specific trace markers (`OK`, `FAIL`, `STEP`, `RETRY`) with Neo-Brutalist, high-contrast monospace fonts.

### CHAT + EXECUTION ROUTER
*   **Goal:** Add conversational capability WITHOUT breaking deterministic execution.
*   **Result:**
    *   **Input Classifier:** Implemented heuristic intent engine to dynamically switch between standard conversation (CHAT) and deterministic action generation (EXEC).
    *   **Routing System:** Extracted request validation into `core/router/index.js` to create an API decoupling layer.
    *   **Chat handler:** Initialized `core/router/chat.js` for standalone conversational responses.
    *   **UI Integration:** Repurposed the standard Agent execution panel to render sequential user-agent messages while persisting auto-execution integrity.

### CONTEXT-AWARE CHAT SYSTEM
*   **Goal:** Upgrade the chat system to be aware of project files, execution history, current stack, and active context.
*   **Result:**
    *   **Context Engine:** Implemented `core/context/contextEngine.js` for project scanning (depth-limited) and state retrieval.
    *   **Project Scanning:** Added logic to walk the project directory and capture file structure (read-only).
    *   **Trace Awareness:** Integrated recent execution trace (last 5 steps) and actions into the chat context.
    *   **Smart Chat Responses:** Enhanced `handleChat` to provide keyword-triggered insights about files, system status, and recent activity using the project context.
    *   **UI Hinting:** Added a visual "Context-aware mode active" indicator to the web interface.

### MODEL METRICS OBSERVABILITY
*   **Goal:** Implement provider-agnostic model performance metrics to track token usage, speed (TPS), and latency.
*   **Result:**
    *   **Normalization Layer:** Created `core/llm/metrics.js` to standardize raw response metadata from diverse providers (llama.cpp, OpenAI, vLLM).
    *   **Safe Capture:** Integrated fallback-safe metrics extraction within the core `chat` logic in `core/llm.js`.
    *   **State Integration:** Synchronized normalized metrics with the system state machine (`core/ui/state.js`).
    *   **Unified UI Display:**
        *   **Web UI:** Integrated real-time metrics (Tokens, TPS, Latency, Provider) into the Context Panel.
        *   **TUI:** Standardized the execution footer to display performance stats with a graceful "N/A" fallback.
    *   **Provider Agnosticism:** Verified support for multi-platform usage data without disrupting the deterministic execution flow.

### WEB UI — UX POLISH
*   **Goal:** Refine the UI/UX to a professional, IDE-level coding experience while maintaining Neo-Brutalist aesthetics.
*   **Result:**
    *   **Auto-Scroll:** Implemented `useRef` based automatic scrolling to keep latest chat messages in view.
    *   **Message Redesign:** Introduced high-contrast bubble styling for User (Blue) and Xentari (Green) messages with clear role markers.
    *   **Sticky Input:** Relocated the command input to a fixed footer within the Agent panel for better accessibility.
    *   **Layout Refinement:** Optimized panel widths (1/4, 2/4, 1/4) and added structured headers to all columns.
    *   **Status Indicators:** Replaced plain status text with explicit, colored status boxes (RUNNING, SUCCESS, FAILED) in the center output panel.
    *   **Empty State:** Added a helpful starter prompt for empty message threads.

### WORKSPACE + MODEL CONFIG SYSTEM
*   **Goal:** Implement a dynamic workspace and model configuration system for multi-project and multi-provider support.
*   **Result:**
    *   **Global Runtime Context:** Created `core/runtime/context.js` to manage session-specific project paths, models, and API endpoints.
    *   **Dynamic Context Engine:** Decoupled `core/context/contextEngine.js` from `process.cwd()`, enabling real-time switching of project scanning targets.
    *   **API Configuration Layer:** Added `/config` server endpoints to allow external clients (Web UI) to dynamically update the system's operating environment.
    *   **Integrated Settings UI:**
        - **Workspace Selector:** Added a project path input to explicitly define the target workspace.
        - **Model Configurator:** Integrated model name and API URL inputs for on-the-fly LLM provider switching.
        - **Persistence:** Implemented bi-directional config syncing between the UI and backend runtime.
    *   **Enhanced Status Header:** Updated the application header to display the currently active workspace path.

### HYBRID CHAT SYSTEM (SYSTEM + MODEL)
*   **Goal:** Establish a tiered routing system for system queries, model-powered conversation, and deterministic execution.
*   **Result:**
    *   **Tiered Classification:** Upgraded `core/router/classifier.js` to distinguish between direct system triggers, execution requests, and natural language chat.
    *   **System Handler:** Introduced `core/router/system.js` for fast, zero-LLM responses to status, file, and trace queries.
    *   **Hybrid Chat Handler:** Updated `core/router/chat.js` to leverage the runtime LLM config for general conversation, automatically injecting project context into the prompt.
    *   **Provider Compatibility:** Ensured chat compatibility with diverse response formats (Ollama vs. OpenAI).
    *   **UI Clarity:** Updated role labels to clearly distinguish between user messages and AI-generated responses.

### MODEL CONFIG VALIDATION + ALERT SYSTEM
*   **Goal:** Enhance safety and UX by validating LLM runtime configurations and providing guided error recovery.
*   **Result:**
    *   **Strict Runtime Validation:** Implemented multi-state validation in `core/router/chat.js` to detect missing API endpoints, missing models, or full config absence.
    *   **Actionable Error Messaging:** Replaced silent failures and generic "500" errors with detailed, human-readable terminal/chat responses that provide examples (e.g., Ollama/LM Studio URLs).
    *   **UI Alert Banner:** Integrated a high-visibility yellow warning banner in the Web UI that activates automatically when the model configuration is invalid.
    *   **Guided UX Recovery:** 
        - Added a "Configure" CTA in the application header that anchors the user directly to the settings bar.
        - Implemented real-time status indicators in the Context Panel ("Model not ready") to prevent unintentional chat usage.
    *   **Fail-Safe Routing:** Ensured that missing model configurations do not crash the server or block non-LLM system queries.

### SESSION + SEARCH SYSTEM
*   **Goal:** Provide lightweight, filesystem-based chat persistence and instant search capabilities.
*   **Result:**
    *   **Filesystem Session Store:** Created `core/session/store.js` using the workspace `.xentari/sessions/` directory for zero-database persistence.
    *   **Session State Management:** Integrated session lifecycle (list, load, save) into the Web UI via new `/session` server endpoints.
    *   **Auto-Persistence:** Configured the Web UI to automatically sync chat history to the workspace after every message.
    *   **Instant Message Search:** Implemented a real-time client-side search filter enabled by `core/session/search.js`.
    *   **Session Switching:** Added a dynamic session selector to the settings bar, allowing users to pivot between different conversation contexts and create new threads on the fly.

### CONFIG + PROVIDER DETECTION
*   **Goal:** Implement a deterministic system for persisting user configurations and auto-detecting local LLM providers (Ollama, LM Studio).
*   **Result:**
    *   **Config Management:** Developed `config/configManager.js` to handle `.xentari/config.json` with safe defaults and persistence logic.
    *   **Modular Provider System:** 
        - Created `BaseProvider` interface and specific implementations for `OllamaProvider` and `LMStudioProvider`.
        - Detection is strictly HTTP-based (GET `/api/tags` and GET `/v1/models`) to avoid shell execution.
    *   **Centralized Discovery:**
        - **ProviderRegistry:** Manages parallel provider detection and model aggregation with fail-safe error handling.
        - **ModelRegistry:** Maintains a normalized, in-memory state of discovered models and active providers.
    *   **Discovery Runtime:** Implemented `runtime/providerRuntime.js` to coordinate the full discovery lifecycle and sync data into the global registry.
    *   **Discovery API:** Exposed a new `/api/models` endpoint for consistent external access.
    - **Intelligent UI Integration:** 
        - Integrated a `datalist` into the Web UI's model input for real-time model suggestions from discovered providers.
        - Added a manual discovery refresh button (↻) to the settings bar.
*   **Known Limitations:** Detection is currently limited to localhost; remote providers must still be configured manually in `config.json`.

### WORKSPACE + SESSION PROJECT SYSTEM
*   **Goal:** Replace manual path entry with a persistent project management system linked to chat sessions.
*   **Result:**
    *   **Global Project Storage:** Implemented `.xentari/projects.json` to store user-approved project paths and metadata.
    *   **Workspace Manager:** Created `core/workspace/workspaceManager.js` to handle global project CRUD operations and path validation.
    *   **Enhanced Session Linking:**
        - Upgraded `SessionManager` to link sessions to specific global projects via `activeProjectId`.
        - Selecting a project in the UI automatically updates the runtime context and switches the agent's target directory.
    *   **Interactive Workspace UI:**
        - **Folder Picker:** Integrated a standard browser folder picker (with absolute path fallback) in the left panel.
        - **Project List:** Added a dedicated Workspace panel for managing all saved projects.
    *   **Unified API Endpoints:** Added `/api/projects` (GET, POST, DELETE) for global project management.
    *   **CLI Integration:** Added `xen workspace` commands (`add`, `list`, `use`) for full terminal-based workspace management.
    *   **Persistence:** Sessions now remember their linked project across restarts, ensuring a seamless development flow.

### FILE SYSTEM LAYER (PRE-MONACO FOUNDATION)
*   **Goal:** Establish a secure, project-scoped filesystem module for listing, reading, and writing files.
*   **Result:**
    *   **Secure Path Resolution:** Implemented `resolveSafePath` in `core/filesystem/fileManager.js` to strictly enforce project boundaries and prevent directory traversal (STRICT startsWith check + realpath validation).
    *   **Deterministic Listing:** Developed a recursive `listFiles` utility that automatically ignores noisy directories (`node_modules`, `.git`, `.xentari`).
    *   **Resource Guards:** Added file size limits (1MB) and UTF-8 encoding requirements to ensure system stability during file reads.
    *   **Unified File API:** Created `/api/files` and `/api/file` endpoints in `core/server/routes/files.js` to expose the filesystem to the Web UI.
    *   **Workspace Integration:** Linked file operations directly to the `workspaceManager`, ensuring that all file actions are verified against user-approved project roots.
    *   **Security Model:** Implemented a backend-controlled access model where the client only provides relative paths, which are then validated against the server-side project registry.

### WEB FOLDER SELECTOR (SAFE MODE)
*   **Goal:** Implement a browser-compatible folder selection UX that avoids file uploads and helps users input valid local paths.
*   **Rationale:** Standard browser security prevents direct access to absolute paths during folder picking. Uploading entire project folders is inefficient and insecure.
*   **Result:**
    *   **Folder Name Extraction:** Implemented a dual-strategy for directory discovery:
        - **Primary:** Utilized the modern **File System Access API** (`window.showDirectoryPicker()`) to provide a professional "View Files" permission flow instead of a scary "Upload" warning.
        - **Fallback:** Retained the `webkitdirectory` input for legacy browser support, extracting root folder names while strictly ignoring file contents.
    *   **Path Helper Strategy:** Implemented OS-aware path guessing (Mac, Windows, Linux) to pre-fill an absolute path input, guiding the user towards the correct local directory.
    *   **Hybrid Confirmation UX:** Added a dedicated "RE-GISTER" panel in the Workspace view where users can review and edit the guessed path before it is saved.
    - **Safe Transmission:** Switched to a pure JSON-based API (`POST /api/projects/add`) that only sends the directory string, completely eliminating `FormData` and multipart uploads.
    *   **Strict Backend Validation:** Ensured the backend resolves and validates the path (existence + directory check) before updating `projects.json`.

### STABLE CONFIGURATION SYSTEM (DEEP MERGE)
*   **Goal:** Harden the configuration layer to be safe, non-breaking, and deterministic across CLI and Web.
*   **Result:**
    *   **Deep Merge Logic:** Implemented a recursive `deepMerge` utility to correctly handle nested configuration blocks (like `providers` or `retrieverWeights`), preventing partial data loss during overrides.
    *   **Safe Global Storage:** Standardized global configuration storage to the user's home directory (`~/.xentari/config.json`), ensuring settings persist across different Xentari versions.
    *   **Crash-Proof Project Resolution:** Updated `getLocalConfigPath` to fail gracefully (returning `null`) when no active project directory is present in the runtime context.
    *   **Lossless Saving:** Upgraded `saveConfig` to perform a disk-read-and-merge cycle. This ensures that saving a subset of settings (e.g., just updating a model name) does not inadvertently wipe out unrelated configuration keys.
    *   **Safe Defaults:** Updated `DEFAULT_CONFIG` with sane, disabled-by-default states for local providers like `llama` to prevent silent connection errors.
*   **Validation:** Verified that the system correctly merges tiered configurations (Default → Global → Local) without data corruption.

### HYBRID MODEL REGISTRY (DETECTION + OVERRIDES)
*   **Goal:** Combine real-time provider detection with persistent configuration overrides for a deterministic, customized model menu.
*   **Result:**
    *   **Model ID Normalization:** Implemented a unified ID schema (`provider:modelId`) across all providers (Ollama, LM Studio, Llama-server), enabling reliably merging and identification.
    *   **Merged Model Logic:** Created `core/models/modelMerger.js` to intelligently combine runtime-detected models with optional overrides from `config.json`.
    *   **Config Overrides:** Enabled custom labels, context windows, and capability tagging (e.g., "coding", "vision") via the `models` block in configuration.
    *   **Standardized Defaults:** Integrated `defaultModel` selection at the registry level, automatically marking preferred models as `selected` in the UI if they are physically detected.
    *   **Runtime Source of Truth:** Maintained a strict "Detection First" architecture where config-only models are ignored if the provider isn't actually accessible at runtime.
    *   **Enhanced API Response:** Upgraded `GET /api/models` to return rich metadata including `overridden` and `selected` flags, providing a foundation for advanced model switching in the Web UI.

### PROVIDER ENDPOINT NORMALIZATION
*   **Goal:** Simplify user configuration by automatically cleaning base URLs and ensuring compatibility with `llama-server`.
*   **Result:**
    *   **Normalization Utility:** Created `core/providers/normalizeBaseUrl.js` which intelligently strips redundant endpoints (like `/chat/completions`) and enforces the `/v1` suffix for OpenAI-compatible providers.
    *   **Universal Base URLs:** Updated all providers to utilize normalized base paths, allowing users to input simplified URLs (e.g., `http://localhost:8081`) while the system handles the API routing.
    *   **OpenAI Detection Upgrade:** switched detection for LM Studio and Llama-server to utilize the standard `GET /models` endpoint, improving reliability and out-of-the-box support for `llama.cpp`.
    - **Self-Correcting Chat Logic:** Enhanced the chat router to normalize the `apiUrl` at runtime before appending `/chat/completions`, preventing common "404 Not Found" errors caused by misconfigured paths.
    *   **Actionable Error Guidance:** Improved configuration error messages to provide specific examples and troubleshooting steps (e.g., "Ensure server is running") instead of generic failure notices.
*   **Validation:** Verified that `llama-server` (without explicit `--api` flags) is correctly detected and usable via the normalized `v1` endpoint.

### MODEL PERFORMANCE METRICS (REAL-TIME SIDEBAR)
*   **Goal:** Provide visibility into model efficiency, speed, and usage directly within the Web UI sidebar.
*   **Result:**
    *   **Unified Metrics Extraction:** Updated the chat pipeline to selectively extract `usage` (total tokens) and `timings` (latency, TPS) from OpenAI-compatible API responses.
    *   **Llama.cpp Timing Integration:** specifically mapped `predicted_ms` and `predicted_per_second` from `llama-server` responses to the system's global state.
    *   **Automated State Updates:** Integrated `setMetrics()` into the `handleChat` router, ensuring that the UI sidebar is instantly updated with fresh performance data after every model reply.
    *   **Fallback Latency Tracking:** Implemented a backend timer fallback to track request duration even if the provider does not supply explicit timing metadata.
    *   **Live Metrics UI:** Bound the "Latency", "Speed", and "Usage" fields in the Web UI to the live metrics stream, providing immediate feedback on model performance.

### DETERMINISTIC AGENT IDENTITY (SYSTEM PROMPT)
*   **Goal:** Transform the model from a generic AI assistant into a specialized, task-oriented coding agent.
*   **Result:**
    *   **Strict Identity Enforcement:** Implemented a new, comprehensive system prompt that defines Xentari's role as a deterministic agent that prioritizes technical action over conversation.
    *   **Action-First Rules:** established strict operational rules: no pleasantries, no generic project-gathering questions, and a focus on provided context.
    *   **Situational Context Injection:** Dynamically injects real-time project state (file structure, active phase, stack) into the system prompt for every request.
    *   **Capability Awareness:** Informed the model of its internal capabilities (reading/writing files, debugging) to encourage more targeted and useful responses.
*   **Validation:** Verified that "hi" and other generic prompts now receive a professional, concise, and task-focused reply instead of a multi-bullet generic assistant response.

### Phase 79 — Legacy Cleanup & Architectural Hardening
*   **Infrastructure Cleanup:** Removed 10+ legacy fallback files (including `retriever.js`, `sessionManager.js`, and `context.js`) to eliminate technical debt and architectural redundancy.
*   **Modernized Session Store:** Transitioned to project-aware session and history management in `core/session/store.ts`, supporting persistent per-project conversational state.
*   **Deterministic Context:** Replaced legacy RAG-based context engine with a faster, code-aware `buildContext` utility using `glob` for shallow but highly relevant context discovery.
*   **Decoupled Runtime:** Established a lean `runAgent.ts` pipeline independent of complex multi-step executor dependencies, ensuring high-speed chat interactions and zero side-effects.
*   **Advanced Core Tests:** Implemented a new verification suite (`tests/core_suite_advanced.js`) ensuring system stability across CLI and API layers post-refactoring.

### Phase 80: True Streaming & Rich Typography (IDE Evolution)
**Status**: Decoupled & Hardened

#### 🎯 Objective
Transition the Web UI from a chat client to a real-time development environment.

#### 🛠 Changes
- **Core Streaming**: Implemented true token-by-token streaming via SSE.
  - `core/providers/index.ts`: Added `streamChat` generator.
  - `core/runtime/runAgent.ts`: Added `onChunk` callback support.
  - `core/server/app.js`: Refactored `/run/stream` to pipe chunks live.
- **Rich Rendering**: Integrated `react-markdown` and `Prism` syntax highlighting.
  - `web/src/App.jsx`: Now renders code blocks, lists, and bold text beautifully.
- **Config Hardening**: Standardized all configuration keys to `baseUrl` (lowercase).
  - Repaired `.xentari/config.json` to resolve connectivity hangs.
- **UI State Safety**: Fixed nested access for `state.header` (Stack, Phase, Mode indicators).

#### 🧪 Verification
- Verified real-time streaming with `llama-server` on port 8081.
- Confirmed Markdown rendering of code blocks in chat bubbles.
- Validated E13 determinism for `runAgent` discovery.

### Phase 80.5: E13.5 SSE True Streaming Protocol
**Status**: Completed & Verified

#### 🎯 Objective
Migrate the mock streaming implementation to a fully progressive, true real-time SSE stream structure across backend and frontend, resolving UI blocking states.

#### 🛠 Changes
- **Backend Infrastructure (`core/server/app.js`)**:
  - Implemented standard `GET /chat/stream` SSE endpoint adhering to explicit `Content-Type: text/event-stream` headers formatting.
  - Implemented typed JSON stream chunks: `{"type": "status"|"chunk"|"done"}`.
- **Frontend Streaming Loop (`web/src/App.jsx`)**:
  - Deprecated blocking `fetch()`/`getReader()` implementations in favor of the native `EventSource` API.
  - Applied React UI state pattern changes: `bufferRef` accumulation is now independent of render-blocking update loops to improve UX responsiveness.
- **Micro-Status Reporting (`core/runtime/runAgent.ts`)**:
  - Injected an `onStatus` tracking closure directly into the core agent pipeline.
  - Automatically transitions system through contextual phases: *scanning project* -> *analyzing context* -> *generating response*, before handing progressive chunking to UI.

#### 🧪 Verification
- Verified buffer streaming logic doesn't drop strings or lag on large API outputs.
- Closed memory leaks matching proper graceful exit strategy via `eventSource.close()`.

### Phase 81: UI Context Awareness (Context Panel)
**Status**: Completed & Verified

#### 🎯 Objective
Expose the backend context awareness in the UI so users can verify exactly which files the AI used for grounding its response.

#### 🛠 Changes
- **Backend Context Emission (`core/runtime/runAgent.ts` & `core/server/app.js`)**:
  - Registered an `onContext` callback within the `runAgent` lifecycle that surfaces `.files` out of the buildContext module.
  - Plumbed `onContext` into the SSE stream handler (`/chat/stream`) to emit a typed JSON package (`type: "context"`).
- **Frontend Context Catching (`web/src/App.jsx`)**:
  - Implemented SSE context parsing (`data.type === "context"`) to update localized `contextFiles` state independently of token rendering.
- **Dedicated UI Component (`web/src/components/ContextPanel.jsx`)**:
  - Created a scrollable layout displaying file paths and relevancy heuristical scores.
  - Mounted the panel seamlessly into the three-column layout (between the Chat and Stats columns) without breaking the existing flow.

#### 🧪 Verification
- Evaluated deterministic discovery runs (e.g., "where is runAgent defined?").
- Confirmed that the event emits cleanly *before* chunk generation starts, exhibiting zero token-delay or stream friction.

---

## UI Improvements

### Markdown Rendering
- Integrated `react-markdown` + `remark-gfm` for full GFM support (tables, strikethrough, task lists).
- Fenced code blocks rendered via `react-syntax-highlighter` (oneDark theme) with per-language syntax highlighting.
- Inline code styled with distinct background for readability.
- Streaming-safe: renderer updates progressively as chunks arrive with no flicker or reset.

### Context Panel
- `ContextPanel.jsx` displays files used in AI reasoning per response.
- Shows file path + relevancy score per entry.
- Toggled via `CTX` button in header — non-blocking, independent of chat flow.
- Wired to SSE `context` event emitted before chunk generation begins.

---

## Performance

### Context Caching (E14.1)
- Added `core/context/contextCache.ts` — in-memory Map with 5-minute TTL.
- Cache key = MD5(`input::MD5(projectDir)`).
- `buildContext` (filesystem scan) is skipped entirely on cache hit.
- Repeated identical queries resolve instantly without redundant I/O.

---

## Observability Timeline

### Execution Trace (`Timeline.jsx`)
- New component renders a horizontal step-by-step trace above the chat messages.
- Populated live from SSE `status` events (`scanning project → analyzing context → generating response`).
- Active (last) step highlighted with emerald glow dot + brighter text.
- Completed steps shown muted with `→` separators.
- Resets to empty on every new query.
- Hidden when no steps exist (zero layout impact on idle state).

---

## File Preview Drawer

### On-Demand File Preview (`FileDrawer.jsx`)
- Clicking any file in the Context Panel opens a right-side drawer (500px, full height, `z-40`).
- File content fetched on-demand via `GET /file?path=...` — nothing pre-loaded.
- Backend endpoint added to `core/server/app.js`:
  - Resolves path relative to active `projectDir` from config.
  - Path traversal guard: rejects any path escaping `projectDir` via `path.resolve` comparison.
  - Truncates content to 2000 chars to keep response light.
  - Returns `{ path, content, matchLine }` — `matchLine` is the first line index matching the filename keyword.
- Drawer renders code as a line-numbered table (`<table>`), not a flat `<pre>`.
- Highlighted line: `bg-yellow-500/10` row + `text-yellow-200` text.
- Auto-scrolls to highlighted line via `useEffect` + `scrollIntoView({ behavior: "smooth", block: "center" })`.
- Shows "Loading..." placeholder while fetch is in-flight.
- Close button resets `selectedFile` to null, unmounts drawer.

---

## Project Intelligence — Generic Signal Scoring (E14.2)

### Problem
Original project analysis was weak — system prompt injection was a single line (`Project: laravel (mvc).`) giving the LLM no behavioral guidance, and file selection used hardcoded `priorityTerms` unrelated to the user's query.

### Changes

#### `core/context/buildContext.ts` — `scoreFile()` exported
Generic, framework-agnostic file scoring function. Takes `{ path, content }`, `input` string, and optional `project`:
- **Keyword relevance**: each input word matched against path (+3) and content (+1).
- **Shallow path boost**: files ≤2 path segments get +2 (entry-point files).
- **Entry-point signals**: `index`, `main`, `app`, `server` → +3.
- **Config/routing signals**: `config`, `routes`, `package`, `composer` → +3.
- **Noise penalty**: `node_modules`, `dist`, `build`, `public` → −3.
- **Project-type boost** (light): if `project.type` includes `"backend"`, `routes` and `config` paths get +2 each.
- No framework names hardcoded anywhere.

#### `core/runtime/runAgent.ts` — re-ranking + strong system prompt
After `detectProject` resolves, `context.snippets` are re-scored with `scoreFile(file, input, project)`, sorted descending, and sliced to top 8 before being sent to the model.

System prompt replaced with structured guidance:
- Identifies project type generically (`framework + type` label).
- Explicit instruction to focus on core architecture over build tooling.
- Anti-hallucination rule: "If not in context, say not found in context."
- Sends `structure` (file list) + `rankedSnippets` (top 8 scored files) separately — cleaner than dumping the full context JSON.

