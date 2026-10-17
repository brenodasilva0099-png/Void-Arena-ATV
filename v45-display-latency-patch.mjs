import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function patchText(file, mutate) {
  if (!existsSync(file)) throw new Error(`Arquivo não encontrado para patch v4.5: ${file}`);
  const before = readFileSync(file, 'utf8');
  const after = mutate(before);
  if (after === before) throw new Error(`Patch v4.5 não alterou ${file}`);
  writeFileSync(file, after);
}

function mustReplace(source, search, replacement, label) {
  const next = source.replace(search, replacement);
  if (next === source) throw new Error(`Patch v4.5 não encontrou: ${label}`);
  return next;
}

export function applyV45Patch(target) {
  const packageFile = path.join(target, 'package.json');
  const pkg = JSON.parse(readFileSync(packageFile, 'utf8'));
  pkg.version = '4.5.0';
  writeFileSync(packageFile, `${JSON.stringify(pkg, null, 2)}\n`);

  patchText(path.join(target, 'src', 'style.css'), (css) => `${css}\n\n/* v4.5 fullscreen / player sizing */\n#remoteCanvas {\n  display: block;\n  width: 100%;\n  height: 100%;\n  max-width: none !important;\n  max-height: none !important;\n  object-fit: contain;\n}\n\n/* O elemento que recebe requestFullscreen precisa realmente ocupar o viewport. */\n:fullscreen {\n  width: 100vw !important;\n  height: 100vh !important;\n  max-width: none !important;\n  max-height: none !important;\n  margin: 0 !important;\n  padding: 0 !important;\n  background: #000 !important;\n  overflow: hidden !important;\n}\n\n:fullscreen #remoteCanvas,\n#remoteCanvas:fullscreen {\n  width: 100% !important;\n  height: 100% !important;\n  max-width: none !important;\n  max-height: none !important;\n  object-fit: contain !important;\n}\n\n/* Remove limites antigos de largura/altura do palco durante tela cheia. */\n:fullscreen .stage,\n:fullscreen .stream-stage,\n:fullscreen .video-stage,\n:fullscreen .viewer-stage,\n:fullscreen .player-stage,\n:fullscreen .screen-stage {\n  width: 100% !important;\n  height: 100% !important;\n  max-width: none !important;\n  max-height: none !important;\n  min-width: 0 !important;\n  min-height: 0 !important;\n}\n`);

  patchText(path.join(target, 'src', 'broadcaster.js'), (input) => {
    let source = input;

    source = mustReplace(
      source,
      'const MEDIA_SOFT_BUFFER = 4 * 1024 * 1024;\nconst MEDIA_HARD_BUFFER = 12 * 1024 * 1024;',
      'const MEDIA_SOFT_BUFFER = 512 * 1024;\nconst MEDIA_HARD_BUFFER = 1536 * 1024;',
      'limites da fila de mídia'
    );

    source = mustReplace(
      source,
      /function viewerRequestedCeiling\(\) \{[\s\S]*?\n\}/,
      `function viewerRequestedCeiling() {\n  // Há um único encoder por transmissão. Uma preferência baixa de um espectador\n  // não deve derrubar a qualidade para todos. Quando houver várias preferências\n  // explícitas, usamos a maior delas; espectadores que pedirem menos continuam\n  // recebendo o mesmo fluxo e o canvas faz o redimensionamento local.\n  let requested = '';\n  for (const viewer of knownViewers.values()) {\n    const pref = viewer.preference;\n    if (!pref || pref === 'auto' || !QUALITY_ORDER.includes(pref)) continue;\n    if (!requested || QUALITY_ORDER.indexOf(pref) > QUALITY_ORDER.indexOf(requested)) requested = pref;\n  }\n  return requested || '1440';\n}`,
      'viewerRequestedCeiling'
    );

    source = mustReplace(
      source,
      /function effectiveMasterQuality\(\) \{[\s\S]*?\n\}/,
      `function effectiveMasterQuality() {\n  const viewerTarget = viewerRequestedCeiling();\n\n  // Qualidade fixa do transmissor é a fonte de verdade. Ainda respeitamos uma\n  // preferência explícita menor do conjunto de espectadores, mas nunca deixamos\n  // um único espectador em 480p reduzir todos os demais quando outro pediu mais.\n  if (qualitySelect.value !== 'auto') return qualityMin(qualitySelect.value, viewerTarget);\n\n  const networkCeiling = qualityMin(hardwareCeiling(), autoNetworkQuality);\n\n  // Em Auto, uma preferência explícita (ex.: 720p) é honrada enquanto a fila\n  // estiver saudável. Só o congestionamento real pode forçar resolução menor.\n  if (viewerTarget !== '1440' && (socket?.bufferedAmount || 0) < MEDIA_SOFT_BUFFER) {\n    return qualityMin(hardwareCeiling(), viewerTarget);\n  }\n  return networkCeiling;\n}`,
      'effectiveMasterQuality'
    );

    source = mustReplace(
      source,
      "if ((stats.fps && Number(stats.fps) < targetFps * 0.6) || Number(stats.rttMs || 0) > 450) {",
      "const expectedFps = Math.max(15, Math.min(targetFps, currentEncodedFps || targetFps));\n    if ((stats.fps && Number(stats.fps) < expectedFps * 0.45) || Number(stats.rttMs || 0) > 650) {",
      'detecção de espectador lento'
    );

    source = mustReplace(
      source,
      'const keyFrame = forceKeyFrame || frameNo % Math.max(30, actualFps * 2) === 0;',
      'const keyFrame = forceKeyFrame || frameNo % Math.max(15, actualFps) === 0;',
      'intervalo de keyframe'
    );

    return source;
  });

  patchText(path.join(target, 'src', 'activity.js'), (input) => {
    let source = input;

    source = mustReplace(
      source,
      "const rtt = lastPongRtt ? ` • ${lastPongRtt} ms` : '';\n  connectionState.textContent = streamActive ? `Relay${currentVideoHeight ? ` • ${currentVideoHeight}p` : ''} • ${fps || '—'} FPS • ${mbps.toFixed(1)} Mb/s${rtt}` : '—';",
      "const rtt = lastPongRtt ? ` • servidor ${lastPongRtt} ms` : '';\n  connectionState.textContent = streamActive ? `Relay${currentVideoHeight ? ` • ${currentVideoHeight}p real` : ''} • ${fps || '—'} FPS • ${mbps.toFixed(1)} Mb/s${rtt}` : '—';",
      'texto de estatísticas do viewer'
    );

    source = mustReplace(
      source,
      'if (audioNextTime > now + 0.22) audioNextTime = now + 0.04;\n            if (audioNextTime < now + 0.03) audioNextTime = now + 0.03;',
      'if (audioNextTime > now + 0.12) audioNextTime = now + 0.025;\n            if (audioNextTime < now + 0.02) audioNextTime = now + 0.02;',
      'buffer de áudio'
    );

    // Marca o documento durante fullscreen para garantir que regras de layout\n    // sejam reaplicadas também nos clientes Discord que recalculam o iframe.
    if (!source.includes("document.addEventListener('fullscreenchange', syncVoidArenaFullscreen);")) {
      source += `\n\nfunction syncVoidArenaFullscreen() {\n  document.documentElement.classList.toggle('va-fullscreen', Boolean(document.fullscreenElement));\n}\ndocument.addEventListener('fullscreenchange', syncVoidArenaFullscreen);\nsyncVoidArenaFullscreen();\n`;
    }

    return source;
  });

  patchText(path.join(target, 'server.mjs'), (input) => {
    let source = input;
    source = source.replaceAll('viewer.bufferedAmount > 8 * 1024 * 1024', 'viewer.bufferedAmount > 2 * 1024 * 1024');
    source = source.replace("version: '4.4.0'", "version: '4.5.0'");
    source = source.replace('Void Arena Live v4.4.0:', 'Void Arena Live v4.5.0:');
    return source;
  });
}
