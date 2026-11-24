import { execFileSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--prefix', 'app', 'run', 'build'], { cwd: root, stdio: 'inherit' });
const output = new URL('../dist/', import.meta.url);
rmSync(output, { recursive: true, force: true });
cpSync(new URL('../app/dist/', import.meta.url), output, { recursive: true });
console.log('INFO STATIC_BUILD_READY');
