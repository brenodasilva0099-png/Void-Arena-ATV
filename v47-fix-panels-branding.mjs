import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

function edit(file, fn) {
  if (!existsSync(file)) throw new Error('[v4.7] Arquivo ausente: ' + file);
  const before = readFileSync(file, 'utf8');
  const after = fn(before);
  if (before === after) throw new Error('[v4.7] Arquivo sem alterações: ' + file);
  writeFileSync(file, after);
}

export function applyV47Patch(root) {
  const cwd = process.cwd();
  for (const file of ['v47-panel-ui.js', 'v47-panel-ui.css', 'v47-void-arena-mark.svg']) {
    if (!existsSync(path.join(cwd, file))) throw new Error('[v4.7] Arquivo de recursos ausente: ' + file);
  }
  copyFileSync(path.join(cwd, 'v47-panel-ui.js'), path.join(root, 'src', 'panel-ui.js'));
  mkdirSync(path.join(root, 'public'), { recursive: true });
  copyFileSync(path.join(cwd, 'v47-void-arena-mark.svg'), path.join(root, 'public', 'void-arena-mark.svg'));
  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.version = '4.7.0';
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  edit(path.join(root, 'src', 'activity.js'), (js) => {
    if (!js.includes("import './style.css';") || !js.includes('function renderParticipants(participants = [])') || !js.includes('initDiscord();')) {
      throw new Error('[v4.7] Entrada de Activity ou Pessoas mudou');
    }
    return js.replace("import './style.css';", "import './style.css';\nimport { setupPanels } from './panel-ui.js';")
      .replace('initDiscord();', 'initDiscord();\nsetupPanels({ loadProfile, renderParticipants, getSDK: () => sdk });');
  });

  edit(path.join(root, 'src', 'style.css'), (css) => css + '\n' + readFileSync(path.join(cwd, 'v47-panel-ui.css'), 'utf8'));
  // Se o Discord retornar um ícone antigo ou inválido, mantém o emblema local.
  edit(path.join(root, 'src', 'transport.js'), (js) => {
    const needle = '          img.src = branding.iconUrl;';
    if (!js.includes(needle)) throw new Error('[v4.7] image loader não encontrado');
    return js.replace(needle,
      "          img.onerror = () => { img.onerror = null; img.src = '/void-arena-mark.svg'; };\n          img.src = branding.iconUrl;");
  });

  edit(path.join(root, 'index.html'), (html) => {
    if (!html.includes('id="participantsPanel"') || !html.includes('id="profilePanel"')) {
      throw new Error('[v4.7] Painéis ausentes do HTML');
    }
    return html.replace('<div class="empty-logo"><span>VA</span></div>', '<div class="empty-logo"><img src="/void-arena-mark.svg" alt="Void Arena" /></div>')
      .replace('class="participant-empty">Carregando participantes…', 'class="participant-empty">Aguardando participantes…')
      .replace('<meta name="theme-color" content="#080914" />',
        '<meta name="theme-color" content="#080914" />\n    <link rel="icon" href="/void-arena-mark.svg" type="image/svg+xml" />');
  });

  edit(path.join(root, 'broadcast.html'), (html) => html
    .replace('<div class="capture-orbit"><span>VA</span></div>', '<div class="capture-orbit"><img src="/void-arena-mark.svg" alt="Void Arena" /></div>')
    .replace('<meta name="theme-color" content="#080914" />',
      '<meta name="theme-color" content="#080914" />\n    <link rel="icon" href="/void-arena-mark.svg" type="image/svg+xml" />'));

  edit(path.join(root, 'server.mjs'), (server) => {
    if (!server.includes("version: '4.6.0'") || !server.includes('  brandingCache = result;')) {
      throw new Error('[v4.7] Backend diferente do esperado');
    }
    // Usa app icon quando o bot ou variável permitem, ou símbolo local caso contrário.
    server = server.replaceAll("BRAND_ICON_URL || ''", "BRAND_ICON_URL || '/void-arena-mark.svg'");
    const beforeCache = [
      '  if (!BOT_TOKEN && !BRAND_ICON_URL) {',
      '    try {',
      "      const response = await discordFetch('/applications/' + CLIENT_ID + '/rpc', { signal: AbortSignal.timeout(1800) });",
      '      if (response.ok) {',
      '        const meta = await response.json();',
      "        if (meta && meta.icon && meta.id) result.iconUrl = 'https://cdn.discordapp.com/app-icons/' + meta.id + '/' + meta.icon + '.webp?size=256';",
      '      }',
      '    } catch {}',
      '  }',
      '  brandingCache = result;'
    ].join('\n');
    server = server.replace('  brandingCache = result;', beforeCache);
    return server.replace("version: '4.6.0'", "version: '4.7.0'")
      .replace('Void Arena Live v4.6.0:', 'Void Arena Live v4.7.0:');
  });
}
