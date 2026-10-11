import { rmSync, mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const cwd = process.cwd();
const target = path.join(cwd, '.activity-live');
const archive = path.join('/tmp', 'void-arena-activity-src.tar.gz');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const parts = readdirSync(cwd)
  .filter((name) => /^activity-src\.b64\.part\d+$/.test(name))
  .sort();

if (!parts.length) {
  console.error('Partes da fonte da Activity não encontradas.');
  process.exit(1);
}

const base64 = parts.map((name) => readFileSync(path.join(cwd, name), 'utf8').trim()).join('');
const archiveBuffer = Buffer.from(base64, 'base64');
if (archiveBuffer.length < 20_000) {
  console.error(`Arquivo reconstruído parece incompleto (${archiveBuffer.length} bytes).`);
  process.exit(1);
}
writeFileSync(archive, archiveBuffer);

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
run('tar', ['-xzf', archive, '-C', target]);

const env = {
  ...process.env,
  VITE_DISCORD_CLIENT_ID: process.env.VITE_DISCORD_CLIENT_ID || '1513157422057918625',
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || '1513157422057918625',
};

if (!existsSync(path.join(target, 'package.json'))) {
  console.error('package.json da Activity não apareceu após extrair a fonte.');
  process.exit(1);
}

run('npm', ['install', '--no-audit', '--no-fund'], { cwd: target, env });
run('npm', ['run', 'build'], { cwd: target, env });
console.log(`Void Arena Activity compilada para o Render (${archiveBuffer.length} bytes de fonte).`);
