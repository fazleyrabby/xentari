# 🧠 Xentari

**Deterministic, local-first AI coding — without chat.**

> Build, analyze, and modify code using a structured execution pipeline — optimized for small local models.

---

## ⚡ Example

```bash
xen "add validation and logging to todo route"
```

```diff
--- routes/todo.js ---
+ if (!title) return error
+ console.log("request received")
```

Apply changes? (y/n)

---

## 🚀 Why Xentari

Most AI tools are:

* ❌ Chat-based
* ❌ Cloud-dependent
* ❌ Token-heavy
* ❌ Unpredictable

Xentari is:

* ✅ **Deterministic pipeline (not chat)**
* ✅ **Local-first (llama.cpp, Qwen, etc.)**
* ✅ **Minimal context (fast + efficient)**
* ✅ **Safe changes (diff + approval)**

> Xentari doesn’t guess — it executes.

---

## ⚙️ How It Works

```text
User → Plan → Context → Generate → Validate → Diff → Apply
```

* System controls execution
* Model is used only when needed

---

## 🧪 Usage

```bash
xen "add login endpoint to auth service"
```

```bash
xen explain app.js:42
xen find "cart logic"
xen analyze "project structure"
```

---

## 🔒 Safety First

* Diff-based changes (no blind writes)
* Explicit approval before applying
* Git validation (`git apply --dry-run`)
* Rollback support (`xen undo`)

---

## 🆚 Compared to AI Coding Tools

|             | Chat Tools | Xentari       |
| ----------- | ---------- | ------------- |
| Execution   | Chat       | Pipeline      |
| Context     | Large      | Minimal       |
| Model       | Cloud      | Local-first   |
| Output      | Direct     | Reviewed diff |
| Determinism | Low        | High          |

---

## ⚙️ Install

```bash
git clone <repo-url>
cd xentari
npm install
npm link
```

---

## 🎯 Design

* Built for **small local models (7B)**
* Optimized for **speed + reliability**
* Fully **deterministic + inspectable**

---

## ⚠️ Status

Active development — stable core, evolving UX.

---

## 📜 License

MIT
