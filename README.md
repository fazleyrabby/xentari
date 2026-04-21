# Xentari

**Xentari is a deterministic, local-first AI development system that executes coding tasks through structured pipelines instead of chat.**

## Installation

```bash
# Clone the repository
git clone https://github.com/fazleyrabby/xentari.git
cd xentari

# Install dependencies and link the CLI
npm install
npm run build
npm link
```

## Core Workflow

Xentari uses a deterministic pipeline to ensure that the same task and codebase always result in the same changes.

### 1. Start the API Server
The CLI communicates with a local API server for heavy lifting.
```bash
npm start
```

### 2. Run CI (Drift Detection)
Verify if the current codebase matches the expected deterministic state.
```bash
xen ci .
```

### 3. Preview Changes (Dry Run)
By default, the `apply` command runs in dry-run mode and shows a git-style diff.
```bash
xen apply .
```

### 4. Apply Changes
Actually write the generated files to the filesystem.
```bash
xen apply . --write
```

### 5. Apply and Commit
Apply changes and automatically create a deterministic Git commit.
```bash
xen apply . --write --commit
```

## CLI Commands

- `xen analyze <path>`: Analyze the project structure.
- `xen plan <path>`: Generate a development plan.
- `xen ci <path>`: Check for codebase drift (CI mode).
- `xen apply <path>`: Preview or apply changes (defaults to dry-run).
- `xen patch`: (Internal) Generate patch specs from a plan.
- `xen render`: (Internal) Render file content from patches.

## Safety Features

- **Dry-Run by Default**: No files are ever written unless `--write` is specified.
- **Path Safety**: The engine prevents writing files outside of the target project directory.
- **Deterministic Commits**: Commits use a fixed message format and only stage files created by Xentari.
- **CI Mode**: Integrated exit codes (0 for clean, 1 for drift, 2 for error) for use in GitHub Actions.

## License

ISC
