import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function replaceRequired(text, find, replacement, label) {
  if (!text.includes(find)) throw new Error('[v4.6] Âncora não encontrada: ' + label);
  return text.replace(find, replacement);
}
function edit(file, transform) {
  if (!existsSync(file)) throw new Error('[v4.6] Arquivo ausente: ' + file);
  const before = readFileSync(file, 'utf8');
  const after = transform(before);
  if (before === after) throw new Error('[v4.6] Nenhuma alteração: ' + file);
  writeFileSync(file, after);
}

export function applyV46Patch(target) {
  const root = process.cwd();
  const uiCss = readFileSync(path.join(root, 'v46-ui.css'), 'utf8');
  const pkgPath = path.join(target, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.version = '4.6.0';
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  edit(path.join(target, 'index.html'), (before) => {
    let html = before;
    html = replaceRequired(html, 'content="#0a0d14"', 'content="#080914"', 'tema Activity');
    html = replaceRequired(html, '<title>Void Arena — Transmissão</title>', '<title>Void Arena Live — Assistir</title>', 'título Activity');
    html = replaceRequired(html, '<small>Transmissão</small>', '<small>TRANSMISSÃO AO VIVO</small>', 'identidade Activity');
    html = replaceRequired(html, '<section id="stage" class="stage">', '<section id="stage" class="stage">\n        <div class="va-stage-brand" aria-hidden="true">VOID ARENA / LIVE</div>', 'palco Activity');
    html = replaceRequired(html, '<div class="empty-logo"><span>◫</span></div>',
      '<div class="empty-logo"><span>VA</span></div>\n          <span class="va-eyebrow">BEM-VINDO AO VOID ARENA LIVE</span>', 'visual da tela inicial');
    html = replaceRequired(html, '<h1>Nenhuma transmissão ativa</h1>', '<h1>Pronto para entrar ao vivo?</h1>', 'headline Activity');
    html = replaceRequired(html,
      'Abra sua tela em poucos cliques. Quem entrar nesta mesma Activity se conecta automaticamente.',
      'Compartilhe seus melhores momentos com quem está na chamada. Escolha sua tela e comece em segundos.', 'texto inicial');
    html = replaceRequired(html, '<button id="emptyStartButton" class="empty-cta">Iniciar transmissão</button>',
      '<button id="emptyStartButton" class="empty-cta">✦ Começar transmissão</button>\n          <span class="va-empty-footer">Qualidade adaptativa · Múltiplas transmissões · Sem instalações no PC</span>', 'iniciar Activity');
    html = replaceRequired(html, '<button id="fullscreenButton" class="secondary compact">⛶ Tela cheia</button>',
      '<button id="fullscreenButton" class="secondary compact" title="Expandir player">⛶ Tela cheia</button>', 'player fullscreen');
    return html;
  });

  edit(path.join(target, 'broadcast.html'), (before) => {
    let html = before;
    html = replaceRequired(html, 'content="#0a0d14"', 'content="#080914"', 'tema estúdio');
    html = replaceRequired(html, '<title>Void Arena — Transmissão</title>', '<title>Void Arena Studio — Transmitir</title>', 'título estúdio');
    html = replaceRequired(html, '<small>Painel de transmissão</small>', '<small>ESTÚDIO DE TRANSMISSÃO</small>', 'identidade estúdio');
    html = replaceRequired(html, '<div class="capture-layout">',
      '<div class="capture-subheader"><strong>● &nbsp; SEU ESTÚDIO AO VIVO</strong><small>Configure a captura e compartilhe sua tela com a sala</small></div>\n        <div class="capture-layout">', 'subheader estúdio');
    html = replaceRequired(html, '<section class="capture-main">',
      '<section class="capture-main">\n            <div class="capture-placeholder" aria-hidden="true"><div class="capture-orbit"><span>VA</span></div><p>Seu vídeo aparecerá aqui</p><small>Escolha uma janela ou tela para abrir a prévia.</small></div>', 'placeholder captura');
    html = replaceRequired(html, '<div class="capture-intro">',
      '<div class="capture-intro"><div class="capture-kicker">INICIAR NOVA TRANSMISSÃO</div>', 'hero captura');
    html = replaceRequired(html, '<button id="stopButton" class="danger primary-large hidden" disabled>Encerrar transmissão</button>',
      '<button id="stopButton" class="danger primary-large hidden" disabled>Encerrar transmissão</button>\n            <div class="capture-flow" aria-label="Etapas da transmissão"><div><b>01 / CONFIGURAR</b><span>Selecione qualidade, FPS e áudio.</span></div><div><b>02 / COMPARTILHAR</b><span>Escolha a janela ou tela.</span></div><div><b>03 / AO VIVO</b><span>Volte ao Discord para acompanhar.</span></div></div>', 'etapas estúdio');
    return html;
  });

  edit(path.join(target, 'src', 'style.css'), (css) => css + '\n\n' + uiCss + '\n');
  edit(path.join(target, 'server.mjs'), (server) => {
    server = replaceRequired(server, "version: '4.5.0'", "version: '4.6.0'", 'versão health');
    if (server.includes('Void Arena Live v4.5.0:')) {
      server = server.replace('Void Arena Live v4.5.0:', 'Void Arena Live v4.6.0:');
    }
    return server;
  });
}
