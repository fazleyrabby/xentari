import * as esbuild from 'esbuild';

async function build() {
  await esbuild.build({
    entryPoints: ['cli/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: 'dist/cli.js',
    format: 'esm',
    banner: {
      js: '#!/usr/bin/env node',
    },
    external: ['node:util', 'node:child_process', 'node:fs', 'node:path'],
  });
  console.log('Build complete: dist/cli.js');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
