// PostToolUse hook: type-check the project after edits to .ts/.tsx files.
//
// The production build (`tsc -b` with noUnusedLocals/noUnusedParameters) fails
// on unused imports/vars and other type errors. This surfaces them immediately
// after an edit instead of at build/CI time.
//
// Exit 0 = silent pass. Exit 2 = feed the tsc output back to Claude to fix.
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}

const file = input?.tool_input?.file_path ?? '';
if (!/\.(ts|tsx)$/.test(file)) process.exit(0);

// Can't (and shouldn't) type-check before `npm install`. Skip silently.
if (!existsSync('node_modules/typescript')) process.exit(0);

try {
  // --no-install: never let npx fetch a stray "tsc" package from the network.
  execSync('npx --no-install tsc --noEmit', { stdio: 'pipe', encoding: 'utf8' });
} catch (e) {
  const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim();
  console.error(`TypeScript check failed:\n${out}`);
  process.exit(2);
}
process.exit(0);
