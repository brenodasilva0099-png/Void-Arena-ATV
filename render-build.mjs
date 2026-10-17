import { rmSync, mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { applyV44Patch } from './v44-multistream-patch.mjs';
import { applyV45Patch } from './v45-display-latency-patch.mjs';
import { applyV46Patch } from './v46-studio-ui-patch.mjs';

const cwd = process.cwd();
const target = path.join(cwd, '.activity-live');
const repoArchive = path.join(cwd, 'activity-src.tar.gz');
const tempArchive = path.join('/tmp', 'void-arena-activity-src.tar.gz');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function tarIsValid(file) {
  const result = spawnSync('tar', ['-tzf', file], { stdio: 'ignore' });
  return !result.error && result.status === 0;
}

function readBase64Archive() {
  const parts = readdirSync(cwd)
    .filter((name) => /^activity-src\.b64\.part\d+$/.test(name))
    .sort();
  if (!parts.length) return null;
  const base64 = parts.map((name) => readFileSync(path.join(cwd, name), 'utf8').trim()).join('');
  return Buffer.from(base64, 'base64');
}

function patchText(file, mutate) {
  if (!existsSync(file)) return;
  const before = readFileSync(file, 'utf8');
  const after = mutate(before);
  if (after !== before) writeFileSync(file, after);
}

function applyV43RecoveryPatch() {
  const packageFile = path.join(target, 'package.json');
  if (existsSync(packageFile)) {
    const pkg = JSON.parse(readFileSync(packageFile, 'utf8'));
    pkg.version = '4.3.1';
    writeFileSync(packageFile, `${JSON.stringify(pkg, null, 2)}\n`);
  }

  patchText(path.join(target, 'src', 'activity.js'), (source) => {
    source = source.replace(
      "if (!origin || origin.includes('discordsays.com')) origin = 'http://127.0.0.1:3420';",
      "if (!origin || origin.includes('discordsays.com')) origin = 'https://void-arena-atv.onrender.com';"
    );

    if (!source.includes("const participantsButton = $('participantsButton');")) {
      source = source.replace(
        "const participantCount = $('participantCount');",
        "const participantCount = $('participantCount');\nconst participantsButton = $('participantsButton');\nconst participantsPanel = $('participantsPanel');\nconst closeParticipantsButton = $('closeParticipantsButton');\nconst participantsList = $('participantsList');\nconst participantsSubtitle = $('participantsSubtitle');"
      );
    }

    if (!source.includes('function renderParticipants(participants = [])')) {
      const marker = `function setStatus(text, kind = '') {\n  statusEl.textContent = text;\n  statusEl.dataset.kind = kind;\n}\n`;
      const helper = `${marker}\nfunction participantAvatarUrl(user) {\n  const direct = user?.avatar_url || user?.avatarUrl;\n  if (direct) return direct;\n  const id = user?.id;\n  const hash = user?.avatar;\n  if (id && hash) return \`https://cdn.discordapp.com/avatars/\${id}/\${hash}.png?size=96\`;\n  return '';\n}\n\nfunction renderParticipants(participants = []) {\n  const list = Array.isArray(participants) ? participants : [];\n  const visibleCount = Math.max(1, list.length);\n  participantCount.textContent = String(visibleCount);\n  if (participantsSubtitle) participantsSubtitle.textContent = \`\${visibleCount} participante\${visibleCount === 1 ? '' : 's'}\`;\n  if (!participantsList) return;\n  participantsList.innerHTML = '';\n\n  if (!list.length) {\n    const empty = document.createElement('div');\n    empty.className = 'participant-empty';\n    empty.textContent = 'Aguardando participantes…';\n    participantsList.appendChild(empty);\n    return;\n  }\n\n  for (const participant of list) {\n    const user = participant?.user || participant || {};\n    const name = participant?.nickname || user.global_name || user.globalName || user.display_name || user.username || 'Participante';\n    const row = document.createElement('div');\n    row.className = 'participant-row';\n\n    const avatarUrl = participantAvatarUrl(user);\n    if (avatarUrl) {\n      const img = document.createElement('img');\n      img.className = 'participant-avatar';\n      img.src = avatarUrl;\n      img.alt = '';\n      row.appendChild(img);\n    } else {\n      const fallback = document.createElement('span');\n      fallback.className = 'participant-avatar participant-avatar-fallback';\n      fallback.textContent = String(name).trim().slice(0, 1).toUpperCase() || '?';\n      row.appendChild(fallback);\n    }\n\n    const text = document.createElement('div');\n    text.className = 'participant-text';\n    const strong = document.createElement('strong');\n    strong.textContent = name;\n    const small = document.createElement('small');\n    small.textContent = user.username && user.username !== name ? \`@\${user.username}\` : 'Na Activity';\n    text.append(strong, small);\n    row.appendChild(text);\n    participantsList.appendChild(row);\n  }\n}\n\nparticipantsButton?.addEventListener('click', () => participantsPanel?.classList.add('open'));\ncloseParticipantsButton?.addEventListener('click', () => participantsPanel?.classList.remove('open'));\n`;
      source = source.replace(marker, helper);
    }

    source = source.replace(
      "const updateParticipants = (participants = []) => { participantCount.textContent = String(participants.length || 1); };",
      "const updateParticipants = (participants = []) => { renderParticipants(participants); };"
    );

    return source;
  });

  patchText(path.join(target, 'index.html'), (html) => {
    if (!html.includes('id="participantsButton"')) {
      html = html.replace(
        '<button id="profileButton" class="icon-button" title="Meu perfil">Perfil</button>',
        '<button id="participantsButton" class="icon-button" title="Participantes">Pessoas</button>\n          <button id="profileButton" class="icon-button" title="Meu perfil">Perfil</button>'
      );
    }

    if (!html.includes('id="participantsPanel"')) {
      const panel = `      <aside id="participantsPanel" class="side-panel participants-panel">\n        <div class="panel-header"><div><strong>Na Activity</strong><small id="participantsSubtitle">1 participante</small></div><button id="closeParticipantsButton" class="icon-button">✕</button></div>\n        <div id="participantsList" class="participants-list"><div class="participant-empty">Carregando participantes…</div></div>\n      </aside>\n\n`;
      html = html.replace('      <aside id="profilePanel" class="side-panel profile-panel">', `${panel}      <aside id="profilePanel" class="side-panel profile-panel">`);
    }
    return html;
  });

  patchText(path.join(target, 'src', 'style.css'), (css) => {
    if (css.includes('.participants-list')) return css;
    return `${css}\n\n/* v4.3 participants */\n.participants-panel { z-index: 12; }\n.participants-list { display: flex; flex-direction: column; gap: 8px; padding: 12px; }\n.participant-row { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 8px 10px; border: 1px solid #253147; border-radius: 12px; background: rgba(20,29,43,.82); }\n.participant-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex: 0 0 36px; background: #1a2434; }\n.participant-avatar-fallback { display: grid; place-items: center; color: #dbe7f8; font-weight: 700; }\n.participant-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }\n.participant-text strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.participant-text small, .participant-empty { color: #8e9aaf; font-size: 12px; }\n@media (max-width: 720px) {\n  #participantsButton { padding-inline: 8px; }\n  .participants-panel { width: min(88vw, 360px); }\n}\n`;
  });

  patchText(path.join(target, 'server.mjs'), (source) => source
    .replace("version: '4.2.2'", "version: '4.3.1'")
    .replace('Void Arena Live v4.2.2:', 'Void Arena Live v4.3.1:'));
}

let archiveBuffer = null;
let recoveredFromBase64 = false;

if (existsSync(repoArchive)) {
  const repoBuffer = readFileSync(repoArchive);
  if (repoBuffer?.length) {
    writeFileSync(tempArchive, repoBuffer);
    if (tarIsValid(tempArchive)) archiveBuffer = repoBuffer;
    else console.warn(`activity-src.tar.gz inválido (${repoBuffer.length} bytes); usando partes Base64 íntegras.`);
  }
}

if (!archiveBuffer) {
  archiveBuffer = readBase64Archive();
  recoveredFromBase64 = true;
}

if (!archiveBuffer?.length) {
  console.error('Fonte da Activity não encontrada ou vazia.');
  process.exit(1);
}

writeFileSync(tempArchive, archiveBuffer);
if (!tarIsValid(tempArchive)) {
  console.error(`Arquivo reconstruído da Activity também está inválido (${archiveBuffer.length} bytes).`);
  process.exit(2);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
run('tar', ['-xzf', tempArchive, '-C', target]);

if (recoveredFromBase64) applyV43RecoveryPatch();
applyV44Patch(target);
applyV45Patch(target);
applyV46Patch(target);

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
console.log(`Void Arena Activity compilada para o Render (${archiveBuffer.length} bytes de fonte, v4.6 aplicada).`);
