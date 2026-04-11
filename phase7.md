# 🧠 Phase 7 — Advisor System (Hybrid Intelligence Layer)

You are a senior Node.js engineer working on an AI CLI tool.

Your task is to implement a **minimal advisor fallback system** that escalates failed local model attempts to a stronger model (e.g., Claude).

⚠️ STRICT RULES:
- DO NOT refactor existing architecture
- DO NOT modify planner/retriever core logic
- DO NOT add new agent types beyond advisor
- ONLY add fallback logic
- Keep implementation simple and deterministic

---

# 🎯 GOAL

Enable this behavior:

local model → fails → retry → fails → advisor → success

---

# 🧩 ARCHITECTURE UPDATE

Current:
Planner → Executor → Reviewer → Patcher

New:
Planner → Executor → Reviewer
        ↓ (on failure)
      Advisor
        ↓
      Reviewer → Patcher

---

# 🔧 TASK 1 — Create Advisor Module

## File: core/advisor.js

~~~js
import { callLLM } from "./llm.js";

export async function advisorFix({ task, patch, feedback }) {
  const prompt = `
You are a senior engineer fixing a broken patch.

Task:
${task}

Current patch:
${patch || "No patch generated"}

Reviewer feedback:
${feedback || "No feedback available"}

Fix the patch.

STRICT RULES:
- Return ONLY a valid unified diff
- NO explanations
- NO markdown
- Must include "diff --git" and "@@" headers
`;

  const res = await callLLM({
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 1000
  });

  return res;
}
~~~

---

# 🔧 TASK 2 — Add Advisor Trigger State

## File: core/agents/executor.agent.js (or pipeline)

~~~js
let reviewFailures = 0;
let invalidPatchFailures = 0;
let advisorUsed = false;
~~~

---

# 🔧 TASK 3 — Track Failures

~~~js
invalidPatchFailures++;
~~~

~~~js
reviewFailures++;
~~~

---

# 🔧 TASK 4 — Escalation Condition

~~~js
const shouldEscalate =
  reviewFailures >= 2 ||
  invalidPatchFailures >= 2 ||
  !patch;
~~~

---

# 🔧 TASK 5 — Call Advisor

~~~js
import { advisorFix } from "../advisor.js";
~~~

~~~js
if (shouldEscalate && !advisorUsed) {
  log.warn("[ADVISOR] Escalating to stronger model...");

  const fixedPatch = await advisorFix({
    task,
    patch,
    feedback: reviewResult
  });

  patch = fixedPatch;
  advisorUsed = true;
}
~~~

---

# 🔧 TASK 6 — Re-validate Advisor Output

~~~js
const valid = validatePatch(patch);

if (!valid.valid) {
  log.error("[ADVISOR] Invalid patch returned");
  return;
}

const review = await reviewPatch(patch);

if (!isApproved(review)) {
  log.error("[ADVISOR] Patch still not approved");
  return;
}
~~~

---

# 🔧 TASK 7 — Logging

~~~js
log.section("ADVISOR");
log.info("Advisor intervention triggered");
~~~

~~~json
{
  "advisor_used": true
}
~~~

---

# 🔧 TASK 8 — Safety Guard

~~~js
if (advisorUsed) return;
~~~

---

# ✅ EXPECTED RESULT

- Local model handles simple tasks
- Retries handle moderate failures
- Advisor resolves complex failures
- System no longer gets stuck
- Token usage reduced vs full cloud usage

---

# 🚫 DO NOT

- Add multiple advisors
- Add routing logic
- Add async multi-agent loops
- Replace local model logic
- Modify retriever/planner

---

# 🧠 SUCCESS CRITERIA

- Local success → no advisor triggered
- 1 failure → retry works
- 2 failures → advisor triggered
- Advisor output passes validation + review
- Logs clearly show advisor usage

---

Implement exactly as specified.