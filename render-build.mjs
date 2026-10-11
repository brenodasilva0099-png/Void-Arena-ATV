import { rmSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const target = `${cwd}/.activity-live`;
const archive = `${cwd}/activity-src.tar.gz`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(archive)) {
  console.error('activity-src.tar.gz não encontrado.');
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
run('tar', ['-xzf', archive, '-C', target]);

const env = {
  ...process.env,
  VITE_DISCORD_CLIENT_ID: process.env.VITE_DISCORD_CLIENT_ID || '1513157422057918625',
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || '1513157422057918625',
};

run('npm', ['install', '--no-audit', '--no-fund'], { cwd: target, env });
run('npm', ['run', 'build'], { cwd: target, env });
console.log('Void Arena Activity compilada para o Render.');
