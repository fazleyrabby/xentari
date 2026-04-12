# 🧠 Xentari — The Ultimate Case Study & Product Manual (Phases 1–21)

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




*   **Context Panel Simulation:** Added a dedicated visual block to show current project root, stack, and framework.
*   **Session Branding:** Standardized CLI headers and cleaner execution logs for better readability.

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

### 🧠 Agent Layer (`core/agents/`)
*   **`executor.agent.js`**: The orchestrator. Manages the lifecycle of a task, including sandboxing, planning, and executing individual steps.
*   **`planner.agent.js`**: The architect. Analyzes high-level tasks and produces a structured JSON plan with dependencies.
*   **`coder.agent.js`**: The developer. Takes context and instructions to generate final file content.
*   **`reviewer.agent.js`**: The senior dev. Reviews generated patches for correctness and stylistic adherence.

### 🔍 Context & Retrieval (`core/retrieval/`, `core/`)
*   **`retrieval/`**: Modern deterministic extraction logic using strict contracts to pull precise function/class blocks.
*   **`context-engine.js`**: Builds dynamic LLM prompts by combining global rules, stack-specific context, and relevant project knowledge.
*   **`indexer.js`**: Scans the project to create a searchable index (`knowledge.json`) for semantic matching.
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

---

# 🏁 8. Summary: Why Xentari Wins
Xentari succeeds because it prioritizes **Transparency and Control**. By combining deterministic logic with a high-signal interface and a manual approval gate, it transforms AI from a "black box" into a reliable, local-first pair programmer.
