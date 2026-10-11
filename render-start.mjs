import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const target = path.resolve('.activity-live');
const entry = path.join(target, 'server.mjs');
if (!existsSync(entry)) {
  console.error('Build da Activity ausente. Rode npm run build primeiro.');
  process.exit(1);
}

const child = spawn(process.execPath, ['server.mjs'], {
  cwd: target,
  stdio: 'inherit',
  env: {
    ...process.env,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || process.env.VITE_DISCORD_CLIENT_ID || '1513157422057918625',
    VITE_DISCORD_CLIENT_ID: process.env.VITE_DISCORD_CLIENT_ID || '1513157422057918625',
  },
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
