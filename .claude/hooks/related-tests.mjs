// PostToolUse hook: run the sibling Vitest file when a logic module is edited.
//
// The architecture extracts pure logic into modules with a co-located
// `<name>.test.ts` (e.g. transferLogic.ts + transferLogic.test.ts). Editing
// either the module or its test runs just that test file — fast, targeted.
//
// Exit 0 = no sibling test / tests passed. Exit 2 = feed failures back to Claude.
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

// Can't run tests before `npm install`. Skip silently.
if (!existsSync('node_modules/vitest')) process.exit(0);

// Pick the test file to run: the edited file if it IS a test, else its sibling.
let testFile;
if (/\.test\.ts$/.test(file)) {
  testFile = file;
} else {
  const candidate = file.replace(/\.(ts|tsx)$/, '.test.ts');
  if (existsSync(candidate)) testFile = candidate;
}
if (!testFile) process.exit(0);

try {
  execSync(`npx --no-install vitest run "${testFile}"`, { stdio: 'pipe', encoding: 'utf8' });
} catch (e) {
  const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim();
  console.error(`Related tests failed (${testFile}):\n${out}`);
  process.exit(2);
}
process.exit(0);
