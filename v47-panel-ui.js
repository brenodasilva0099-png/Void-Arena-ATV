// Void Arena v4.7: painéis funcionando mesmo dentro do iframe do Discord.
export function setupPanels({ loadProfile, renderParticipants, getSDK }) {
  const ids = ['participantsPanel', 'profilePanel', 'settingsPanel'];
  const panels = ids.map((id) => document.getElementById(id));
  if (panels.some((panel) => !panel)) {
    console.error('[Void Arena] Painéis ausentes:', ids);
    return;
  }
  const shade = document.createElement('div');
  shade.id = 'vaPanelShade';
  shade.setAttribute('aria-hidden', 'true');
  document.body.appendChild(shade);
  for (const panel of panels) {
    document.body.appendChild(panel);
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-hidden', 'true');
    panel.tabIndex = -1;
  }
  let lastFocus = null;
  function close() {
    const wasOpen = panels.some((p) => p.classList.contains('open'));
    for (const panel of panels) {
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
    }
    shade.classList.remove('open');
    if (wasOpen && lastFocus?.isConnected) lastFocus.focus();
    lastFocus = null;
  }
  function show(id) {
    const panel = document.getElementById(id);
    if (!panel) return;
    if (panel.classList.contains('open')) { close(); return; }
    if (!panels.some((p) => p.classList.contains('open'))) lastFocus = document.activeElement;
    for (const item of panels) {
      const active = item === panel;
      item.classList.toggle('open', active);
      item.setAttribute('aria-hidden', active ? 'false' : 'true');
    }
    shade.classList.add('open');
    panel.focus({ preventScroll: true });
    if (id === 'profilePanel') loadProfile().catch((error) => console.warn('Perfil:', error));
    if (id === 'participantsPanel') {
      const list = document.getElementById('participantsList');
      if (list && !list.querySelector('.participant-row')) {
        list.innerHTML = '<div class="participant-empty">Consultando participantes...</div>';
      }
      const sdk = getSDK();
      if (sdk?.commands?.getInstanceConnectedParticipants) {
        Promise.resolve(sdk.commands.getInstanceConnectedParticipants())
          .then((data) => renderParticipants(data?.participants || []))
          .catch((error) => {
            console.warn('Participantes:', error);
            if (list && !list.querySelector('.participant-row')) list.innerHTML = '<div class="participant-empty">Lista indisponível neste contexto do Discord.</div>';
          });
      } else if (list && !list.querySelector('.participant-row')) {
        list.innerHTML = '<div class="participant-empty">Abra a Activity em uma chamada para ver os participantes.</div>';
      }
    }
  }
  const buttons = { participantsButton: 'participantsPanel', profileButton: 'profilePanel', settingsButton: 'settingsPanel' };
  const closeButtons = new Set(['closeParticipantsButton', 'closeProfileButton', 'closeSettingsButton']);
  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('button');
    if (!button) return;
    if (buttons[button.id]) {
      event.preventDefault();
      event.stopImmediatePropagation();
      show(buttons[button.id]);
    } else if (closeButtons.has(button.id)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }
  }, true);
  shade.addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panels.some((p) => p.classList.contains('open'))) {
      event.preventDefault();
      close();
    }
  });
  for (const [buttonId, panelId] of Object.entries(buttons)) {
    const button = document.getElementById(buttonId);
    button?.setAttribute('aria-controls', panelId);
    button?.setAttribute('aria-haspopup', 'dialog');
  }
}
