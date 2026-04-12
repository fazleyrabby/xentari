#!/usr/bin/env node

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

// resolve current file
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// resolve project root
const rootDir = path.resolve(__dirname, '..')

// entry TypeScript file
const entry = path.join(rootDir, 'bin/xen.ts')

// force local tsx (no global resolution issues)
const tsxPath = path.join(rootDir, 'node_modules/tsx/dist/cli.mjs')

// spawn process
const child = spawn(
  process.execPath,
  [tsxPath, entry, ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    cwd: process.cwd(),
  }
)

child.on('exit', (code) => process.exit(code))