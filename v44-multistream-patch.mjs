import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function patchText(file, mutate) {
  if (!existsSync(file)) throw new Error(`Arquivo não encontrado para patch: ${file}`);
  const before = readFileSync(file, 'utf8');
  const after = mutate(before);
  if (after === before) throw new Error(`Patch v4.4 não alterou ${file}`);
  writeFileSync(file, after);
}

function mustReplace(source, search, replacement, label) {
  const next = source.replace(search, replacement);
  if (next === source) throw new Error(`Patch v4.4 não encontrou: ${label}`);
  return next;
}

export function applyV44Patch(target) {
  const packageFile = path.join(target, 'package.json');
  const pkg = JSON.parse(readFileSync(packageFile, 'utf8'));
  pkg.version = '4.4.0';
  writeFileSync(packageFile, `${JSON.stringify(pkg, null, 2)}\n`);

  patchText(path.join(target, 'src', 'activity.js'), (input) => {
    let source = input;

    source = mustReplace(
      source,
      "const participantsSubtitle = $('participantsSubtitle');",
      "const participantsSubtitle = $('participantsSubtitle');\nconst streamSelect = $('streamSelect');",
      'streamSelect const'
    );

    source = mustReplace(
      source,
      "const mobileDevice = isMobileDevice();",
      "const mobileDevice = isMobileDevice();\n\nfunction multiSocketUrl() {\n  const url = new URL(socketUrl());\n  url.pathname = url.pathname.replace(/\\/ws$/, '/ws-multi');\n  return url.toString();\n}",
      'multiSocketUrl activity'
    );

    source = mustReplace(
      source,
      /function updateTransmitButton\(\) \{[\s\S]*?\n\}/,
      `function updateTransmitButton() {\n  if (!activityReady) {\n    transmitButton.disabled = true;\n    return;\n  }\n  transmitButton.disabled = false;\n  transmitButton.textContent = streamActive ? 'Transmitir outra tela' : 'Transmitir minha tela';\n  transmitButton.dataset.state = streamActive ? 'live' : 'idle';\n}`,
      'updateTransmitButton'
    );

    source = mustReplace(
      source,
      'function clearCanvas() {',
      `function updateStreamList(streams = [], selectedStreamId = '') {\n  if (!streamSelect) return;\n  const list = Array.isArray(streams) ? streams : [];\n  const wanted = selectedStreamId || streamSelect.value;\n  streamSelect.innerHTML = '';\n  if (!list.length) {\n    const option = document.createElement('option');\n    option.value = '';\n    option.textContent = 'Nenhuma transmissão';\n    streamSelect.appendChild(option);\n    streamSelect.disabled = true;\n    return;\n  }\n  for (let i = 0; i < list.length; i++) {\n    const item = list[i] || {};\n    const option = document.createElement('option');\n    option.value = item.id || '';\n    const name = item.broadcaster?.name || ('Transmissão ' + (i + 1));\n    option.textContent = name + (item.active ? ' • AO VIVO' : ' • preparando');\n    streamSelect.appendChild(option);\n  }\n  streamSelect.disabled = list.length < 2;\n  if (wanted && list.some((item) => item?.id === wanted)) streamSelect.value = wanted;\n}\n\nstreamSelect?.addEventListener('change', () => {\n  const streamId = streamSelect.value;\n  if (!streamId) return;\n  closeMediaDecoders();\n  setLive(false);\n  setStatus('Trocando de transmissão…');\n  send({ type: 'select-stream', streamId });\n});\n\nfunction clearCanvas() {`,
      'stream selector helpers'
    );

    source = mustReplace(
      source,
      "socket = new WebSocket(socketUrl());",
      "socket = new WebSocket(multiSocketUrl());",
      'viewer multi websocket'
    );

    source = mustReplace(
      source,
      "    } else if (msg.type === 'stream-state') {\n      viewerCount.textContent = String(msg.viewers ?? 0);",
      "    } else if (msg.type === 'stream-state') {\n      updateStreamList(msg.streams || [], msg.selectedStreamId || msg.streamId || '');\n      viewerCount.textContent = String(msg.viewers ?? 0);",
      'stream-state selector update'
    );

    source = mustReplace(
      source,
      `  if (streamActive) {\n    setStatus(canControl ? 'Sua transmissão já está ao vivo.' : 'Já existe uma transmissão ativa nesta Activity.', 'ok');\n    return;\n  }\n`,
      '',
      'launch single-stream guard'
    );

    return source;
  });

  patchText(path.join(target, 'src', 'broadcaster.js'), (input) => {
    let source = input;
    source = mustReplace(
      source,
      "const mobileDevice = isMobileDevice();",
      "const mobileDevice = isMobileDevice();\n\nfunction multiSocketUrl() {\n  const url = new URL(socketUrl());\n  url.pathname = url.pathname.replace(/\\/ws$/, '/ws-multi');\n  return url.toString();\n}",
      'multiSocketUrl broadcaster'
    );
    source = mustReplace(
      source,
      "socket = new WebSocket(socketUrl());",
      "socket = new WebSocket(multiSocketUrl());",
      'broadcaster multi websocket'
    );
    return source;
  });

  patchText(path.join(target, 'index.html'), (input) => {
    let html = input;
    html = mustReplace(
      html,
      '<div id="controlsBody" class="controls-body">',
      '<div id="controlsBody" class="controls-body">\n            <label>Assistir\n              <select id="streamSelect"><option value="">Nenhuma transmissão</option></select>\n            </label>',
      'stream selector html'
    );
    return html;
  });

  patchText(path.join(target, 'src', 'style.css'), (css) => `${css}\n\n/* v4.4 multi-stream */\n#streamSelect { min-width: 160px; max-width: 240px; }\n@media (max-width: 720px) { #streamSelect { min-width: 120px; max-width: 42vw; } }\n`);

  patchText(path.join(target, 'server.mjs'), (input) => {
    let source = input;

    source = mustReplace(
      source,
      "const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 * 1024, perMessageDeflate: false });\nserver.on('upgrade', (req, socket, head) => {\n  const url = new URL(req.url, 'http://localhost');\n  if (url.pathname !== '/ws' && url.pathname !== '/.proxy/ws') return socket.destroy();\n  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));\n});",
      "const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 * 1024, perMessageDeflate: false });\nconst wssMulti = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 * 1024, perMessageDeflate: false });\nserver.on('upgrade', (req, socket, head) => {\n  const url = new URL(req.url, 'http://localhost');\n  if (url.pathname === '/ws' || url.pathname === '/.proxy/ws') {\n    return wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));\n  }\n  if (url.pathname === '/ws-multi' || url.pathname === '/.proxy/ws-multi') {\n    return wssMulti.handleUpgrade(req, socket, head, (ws) => wssMulti.emit('connection', ws));\n  }\n  socket.destroy();\n});",
      'websocket upgrade multi route'
    );

    const multiServer = `\n\n// v4.4: várias transmissões simultâneas na mesma Activity.\nconst multiRooms = new Map();\n\nfunction getMultiRoom(id) {\n  if (!multiRooms.has(id)) multiRooms.set(id, { viewers: new Map(), broadcasters: new Map() });\n  return multiRooms.get(id);\n}\n\nfunction multiStreamInfo(streamId, record, index = 0) {\n  return {\n    id: streamId,\n    active: Boolean(record?.startedAt && record?.ws?.readyState === WebSocket.OPEN),\n    startedAt: record?.startedAt || null,\n    broadcaster: record?.user ? {\n      id: record.user.id,\n      name: record.user.globalName || record.user.username || ('Transmissão ' + (index + 1)),\n      avatarUrl: avatarUrl(record.user, 96),\n    } : { id: '', name: 'Transmissão ' + (index + 1), avatarUrl: '' },\n  };\n}\n\nfunction multiSelected(room, viewer) {\n  let streamId = safeText(viewer?.meta?.selectedStreamId, 64);\n  let record = streamId ? room.broadcasters.get(streamId) : null;\n  if (!record) {\n    const entries = [...room.broadcasters.entries()];\n    const fallback = entries.find(([, item]) => item.startedAt && item.ws?.readyState === WebSocket.OPEN) || entries[0] || null;\n    if (fallback) {\n      streamId = fallback[0];\n      record = fallback[1];\n      if (viewer?.meta) viewer.meta.selectedStreamId = streamId;\n    } else {\n      streamId = '';\n      record = null;\n      if (viewer?.meta) viewer.meta.selectedStreamId = '';\n    }\n  }\n  return { streamId, record };\n}\n\nfunction multiViewerCount(room, streamId) {\n  let count = 0;\n  for (const viewer of room.viewers.values()) if (viewer.meta?.selectedStreamId === streamId) count++;\n  return count;\n}\n\nfunction currentMultiState(room, viewer = null) {\n  const { streamId, record } = multiSelected(room, viewer);\n  const sameUser = Boolean(viewer?.meta?.user?.id && record?.user?.id === viewer.meta.user.id);\n  const sameControlKey = Boolean(viewer?.meta?.controlKey && record?.controlKey && viewer.meta.controlKey === record.controlKey);\n  const streams = [...room.broadcasters.entries()].map(([id, item], index) => multiStreamInfo(id, item, index));\n  return {\n    type: 'stream-state',\n    active: Boolean(record?.startedAt && record?.ws?.readyState === WebSocket.OPEN),\n    viewers: streamId ? multiViewerCount(room, streamId) : 0,\n    startedAt: record?.startedAt || null,\n    broadcaster: record?.user ? {\n      id: record.user.id,\n      name: record.user.globalName || record.user.username,\n      avatarUrl: avatarUrl(record.user, 96),\n    } : null,\n    masterConfig: record?.masterConfig || { quality: 'auto', fps: 30, audioEnabled: true },\n    canControl: sameUser || sameControlKey,\n    streamId,\n    selectedStreamId: streamId,\n    streams,\n  };\n}\n\nfunction multiSendSelectedConfig(room, viewer) {\n  const { record } = multiSelected(room, viewer);\n  if (!record) return;\n  if (record.videoConfig) safeSend(viewer, { type: 'video-config', config: record.videoConfig });\n  if (record.audioConfig) safeSend(viewer, { type: 'audio-config', config: record.audioConfig });\n}\n\nfunction multiForwardToSelectedBroadcaster(room, viewer, payload) {\n  const { record } = multiSelected(room, viewer);\n  safeSend(record?.ws, payload);\n}\n\nfunction multiBroadcastState(room) {\n  for (const viewer of room.viewers.values()) safeSend(viewer, currentMultiState(room, viewer));\n  for (const [streamId, record] of room.broadcasters) {\n    safeSend(record.ws, { type: 'viewer-count', viewers: multiViewerCount(room, streamId) });\n  }\n}\n\nasync function multiStopStream(roomId, streamId, reason = 'stopped') {\n  const room = multiRooms.get(roomId);\n  const record = room?.broadcasters.get(streamId);\n  if (!room || !record || !record.startedAt) return;\n  const durationSeconds = Math.max(0, (Date.now() - record.startedAt) / 1000);\n  const summary = await awardStreamXp(record.user, durationSeconds);\n  try {\n    const noteRoom = {\n      broadcasterUser: record.user,\n      guildId: record.guildId,\n      voiceChannelId: record.voiceChannelId,\n      voiceChannelName: record.voiceChannelName,\n      notifyMessageId: record.notifyMessageId || null,\n      notifyInviteCode: record.notifyInviteCode || null,\n    };\n    await sendDiscordNotification(noteRoom, 'end', { durationSeconds, ...(summary || {}) });\n    record.notifyMessageId = noteRoom.notifyMessageId || null;\n  } catch (error) {\n    console.warn('Notificação multi-stream:', error);\n  }\n  record.startedAt = null;\n  record.videoConfig = null;\n  record.audioConfig = null;\n  for (const viewer of room.viewers.values()) {\n    if (viewer.meta?.selectedStreamId === streamId) {\n      viewer.meta.selectedStreamId = '';\n      safeSend(viewer, { type: 'stream-stopped', streamId, reason, summary });\n    }\n  }\n  safeSend(record.ws, { type: 'stream-ended-summary', summary, durationSeconds });\n  multiBroadcastState(room);\n}\n\nwssMulti.on('connection', (ws) => {\n  ws.meta = { role: null, room: null, id: randomToken(8), user: null, sessionToken: null, controlKey: '', selectedStreamId: '', streamId: '' };\n\n  ws.on('message', async (raw, isBinary) => {\n    if (isBinary) {\n      const room = ws.meta.room ? multiRooms.get(ws.meta.room) : null;\n      const record = room?.broadcasters.get(ws.meta.streamId);\n      if (!room || ws.meta.role !== 'broadcaster' || !record || record.ws !== ws || !record.startedAt) return;\n      for (const viewer of room.viewers.values()) {\n        if (viewer.meta?.selectedStreamId !== ws.meta.streamId) continue;\n        if (viewer.readyState !== WebSocket.OPEN || viewer.bufferedAmount > 8 * 1024 * 1024) continue;\n        try { viewer.send(raw, { binary: true }); } catch {}\n      }\n      return;\n    }\n\n    let msg;\n    try { msg = JSON.parse(raw.toString()); } catch { return safeSend(ws, { type: 'error', message: 'Mensagem inválida.' }); }\n\n    if (msg.type === 'join-viewer') {\n      const roomId = normalizeRoom(msg.room);\n      if (!roomId) return safeSend(ws, { type: 'error', message: 'Instância inválida.' });\n      const sessionToken = safeText(msg.session_token, 256);\n      const session = activitySessions.get(sessionToken);\n      ws.meta.controlKey = safeText(msg.control_key, 128);\n      ws.meta.preference = ['auto', '480', '720', '1080', '1440'].includes(String(msg.preference)) ? String(msg.preference) : 'auto';\n      if (session && session.expiresAt > Date.now() && session.room === roomId) {\n        ws.meta.user = session.user;\n        ws.meta.sessionToken = sessionToken;\n      }\n      const room = getMultiRoom(roomId);\n      ws.meta.role = 'viewer';\n      ws.meta.room = roomId;\n      room.viewers.set(ws.meta.id, ws);\n      safeSend(ws, { type: 'viewer-registered', viewerId: ws.meta.id, transport: 'webcodecs-relay-multi' });\n      const state = currentMultiState(room, ws);\n      safeSend(ws, state);\n      multiSendSelectedConfig(room, ws);\n      const selected = multiSelected(room, ws);\n      if (selected.record?.ws?.readyState === WebSocket.OPEN) {\n        safeSend(selected.record.ws, { type: 'viewer-joined', viewerId: ws.meta.id, preference: ws.meta.preference || 'auto' });\n        if (selected.record.startedAt) safeSend(selected.record.ws, { type: 'need-keyframe', viewerId: ws.meta.id });\n      }\n      multiBroadcastState(room);\n      return;\n    }\n\n    if (msg.type === 'register-broadcaster') {\n      const roomId = normalizeRoom(msg.room);\n      if (!roomId) return safeSend(ws, { type: 'error', message: 'Instância inválida.' });\n      const ticketText = safeText(msg.ticket, 256);\n      const controlKey = safeText(msg.control_key, 128);\n      const ticketData = broadcastTickets.get(ticketText);\n      let user = null;\n      let sessionToken = null;\n      let guildId = null;\n      let channelId = null;\n      let channelName = '';\n      if (ticketData && ticketData.expiresAt > Date.now() && ticketData.room === roomId) {\n        user = ticketData.user;\n        sessionToken = ticketData.sessionToken;\n        guildId = ticketData.guildId;\n        channelId = ticketData.channelId;\n        channelName = ticketData.channelName;\n        broadcastTickets.delete(ticketText);\n      } else if (!ALLOW_LOCAL_BROADCAST) {\n        return safeSend(ws, { type: 'error', message: 'Ticket de transmissão inválido ou expirado.' });\n      }\n      const room = getMultiRoom(roomId);\n      const streamId = randomToken(6);\n      const record = {\n        ws, user, sessionToken, guildId, voiceChannelId: channelId,\n        voiceChannelName: channelName || await resolveChannelName(channelId),\n        controlKey, startedAt: null, videoConfig: null, audioConfig: null,\n        masterConfig: { quality: 'auto', fps: 30, audioEnabled: true },\n        notifyMessageId: null, notifyInviteCode: null,\n      };\n      room.broadcasters.set(streamId, record);\n      ws.meta = { ...ws.meta, role: 'broadcaster', room: roomId, user, sessionToken, controlKey, streamId };\n\n      for (const viewer of room.viewers.values()) {\n        const sameUser = Boolean(viewer.meta?.user?.id && user?.id && viewer.meta.user.id === user.id);\n        const sameControlKey = Boolean(viewer.meta?.controlKey && controlKey && viewer.meta.controlKey === controlKey);\n        if (sameUser || sameControlKey || !viewer.meta.selectedStreamId) viewer.meta.selectedStreamId = streamId;\n      }\n\n      safeSend(ws, { type: 'broadcaster-registered', streamId, transport: 'webcodecs-relay-multi', viewers: multiViewerCount(room, streamId), masterConfig: record.masterConfig });\n      for (const viewer of room.viewers.values()) {\n        if (viewer.meta.selectedStreamId === streamId) safeSend(ws, { type: 'viewer-joined', viewerId: viewer.meta.id, preference: viewer.meta.preference || 'auto' });\n      }\n      multiBroadcastState(room);\n      return;\n    }\n\n    const room = ws.meta.room ? multiRooms.get(ws.meta.room) : null;\n    if (!room) return;\n\n    if (msg.type === 'select-stream' && ws.meta.role === 'viewer') {\n      const streamId = safeText(msg.streamId, 64);\n      if (!room.broadcasters.has(streamId)) return safeSend(ws, { type: 'error', message: 'Essa transmissão não está mais disponível.' });\n      const oldStreamId = ws.meta.selectedStreamId;\n      if (oldStreamId && oldStreamId !== streamId) {\n        safeSend(room.broadcasters.get(oldStreamId)?.ws, { type: 'viewer-left', viewerId: ws.meta.id });\n      }\n      ws.meta.selectedStreamId = streamId;\n      safeSend(ws, currentMultiState(room, ws));\n      multiSendSelectedConfig(room, ws);\n      const record = room.broadcasters.get(streamId);\n      safeSend(record?.ws, { type: 'viewer-joined', viewerId: ws.meta.id, preference: ws.meta.preference || 'auto' });\n      if (record?.startedAt) safeSend(record.ws, { type: 'need-keyframe', viewerId: ws.meta.id });\n      multiBroadcastState(room);\n      return;\n    }\n\n    if (msg.type === 'video-config' && ws.meta.role === 'broadcaster') {\n      const record = room.broadcasters.get(ws.meta.streamId);\n      if (!record) return;\n      record.videoConfig = msg.config || null;\n      for (const viewer of room.viewers.values()) if (viewer.meta.selectedStreamId === ws.meta.streamId) safeSend(viewer, { type: 'video-config', config: record.videoConfig });\n      return;\n    }\n\n    if (msg.type === 'audio-config' && ws.meta.role === 'broadcaster') {\n      const record = room.broadcasters.get(ws.meta.streamId);\n      if (!record) return;\n      record.audioConfig = msg.config || null;\n      for (const viewer of room.viewers.values()) if (viewer.meta.selectedStreamId === ws.meta.streamId) safeSend(viewer, { type: 'audio-config', config: record.audioConfig });\n      return;\n    }\n\n    if (msg.type === 'need-keyframe' && ws.meta.role === 'viewer') {\n      return multiForwardToSelectedBroadcaster(room, ws, { type: 'need-keyframe', viewerId: ws.meta.id });\n    }\n    if (msg.type === 'ping' && ws.meta.role === 'viewer') {\n      safeSend(ws, { type: 'pong', at: Number(msg.at || Date.now()) });\n      return;\n    }\n    if (msg.type === 'quality-preference' && ws.meta.role === 'viewer') {\n      const preference = ['auto', '480', '720', '1080', '1440'].includes(String(msg.preference)) ? String(msg.preference) : 'auto';\n      ws.meta.preference = preference;\n      return multiForwardToSelectedBroadcaster(room, ws, { type: 'quality-preference', viewerId: ws.meta.id, preference });\n    }\n    if (msg.type === 'viewer-stats' && ws.meta.role === 'viewer') {\n      return multiForwardToSelectedBroadcaster(room, ws, { type: 'viewer-stats', viewerId: ws.meta.id, stats: msg.stats || {} });\n    }\n    if (msg.type === 'master-config' && ws.meta.role === 'broadcaster') {\n      const record = room.broadcasters.get(ws.meta.streamId);\n      if (!record) return;\n      record.masterConfig = {\n        quality: ['auto', '480', '720', '1080', '1440'].includes(String(msg.config?.quality)) ? String(msg.config.quality) : 'auto',\n        fps: Number(msg.config?.fps) === 60 ? 60 : 30,\n        audioEnabled: msg.config?.audioEnabled !== false,\n      };\n      for (const viewer of room.viewers.values()) {\n        if (viewer.meta.selectedStreamId !== ws.meta.streamId) continue;\n        const sameUser = Boolean(viewer.meta?.user?.id && record.user?.id === viewer.meta.user.id);\n        const sameControlKey = Boolean(viewer.meta?.controlKey && record.controlKey && viewer.meta.controlKey === record.controlKey);\n        safeSend(viewer, { type: 'master-config', config: record.masterConfig, canControl: sameUser || sameControlKey });\n      }\n      return;\n    }\n    if (msg.type === 'owner-config-command' && ws.meta.role === 'viewer') {\n      const selected = multiSelected(room, ws);\n      const sameUser = Boolean(ws.meta.user?.id && selected.record?.user?.id === ws.meta.user.id);\n      const sameControlKey = Boolean(ws.meta.controlKey && selected.record?.controlKey && ws.meta.controlKey === selected.record.controlKey);\n      if (!sameUser && !sameControlKey) return;\n      safeSend(selected.record?.ws, { type: 'owner-config-command', config: msg.config || {} });\n      return;\n    }\n    if (msg.type === 'stream-started' && ws.meta.role === 'broadcaster') {\n      const record = room.broadcasters.get(ws.meta.streamId);\n      if (!record) return;\n      if (!record.startedAt) {\n        record.startedAt = Date.now();\n        try {\n          if (record.voiceChannelId) record.notifyInviteCode = await createActivityInvite(record.voiceChannelId);\n          const noteRoom = {\n            broadcasterUser: record.user, guildId: record.guildId, voiceChannelId: record.voiceChannelId,\n            voiceChannelName: record.voiceChannelName, notifyMessageId: record.notifyMessageId, notifyInviteCode: record.notifyInviteCode,\n          };\n          await sendDiscordNotification(noteRoom, 'start');\n          record.notifyMessageId = noteRoom.notifyMessageId || null;\n        } catch (error) { console.warn('Notificação multi-stream:', error); }\n      }\n      safeSend(ws, { type: 'stream-start-confirmed', streamId: ws.meta.streamId, startedAt: record.startedAt });\n      safeSend(ws, { type: 'need-keyframe' });\n      multiBroadcastState(room);\n      return;\n    }\n    if (msg.type === 'stream-stopped' && ws.meta.role === 'broadcaster') {\n      await multiStopStream(ws.meta.room, ws.meta.streamId, 'stopped');\n      return;\n    }\n  });\n\n  ws.on('close', async () => {\n    const roomId = ws.meta.room;\n    if (!roomId) return;\n    const room = multiRooms.get(roomId);\n    if (!room) return;\n    if (ws.meta.role === 'viewer') {\n      room.viewers.delete(ws.meta.id);\n      safeSend(room.broadcasters.get(ws.meta.selectedStreamId)?.ws, { type: 'viewer-left', viewerId: ws.meta.id });\n      multiBroadcastState(room);\n    } else if (ws.meta.role === 'broadcaster') {\n      const streamId = ws.meta.streamId;\n      const record = room.broadcasters.get(streamId);\n      if (record?.startedAt) await multiStopStream(roomId, streamId, 'broadcaster-disconnected');\n      room.broadcasters.delete(streamId);\n      for (const viewer of room.viewers.values()) if (viewer.meta.selectedStreamId === streamId) viewer.meta.selectedStreamId = '';\n      multiBroadcastState(room);\n    }\n    if (room.viewers.size === 0 && room.broadcasters.size === 0) multiRooms.delete(roomId);\n  });\n});\n`;

    source = mustReplace(source, '\nserver.listen(PORT, \'0.0.0.0\', () => {', multiServer + "\nserver.listen(PORT, '0.0.0.0', () => {", 'insert multi websocket server');
    source = source.replace("version: '4.3.1'", "version: '4.4.0'").replace('Void Arena Live v4.3.1:', 'Void Arena Live v4.4.0:');
    return source;
  });
}
