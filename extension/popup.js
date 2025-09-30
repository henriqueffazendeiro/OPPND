const listEl = document.getElementById('messages');
const emptyEl = document.getElementById('emptyState');
const refreshBtn = document.getElementById('refresh');

loadMessages();

refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'A sincronizar…';
  try {
    await chrome.runtime.sendMessage({ type: 'oppnd:sync-request' });
  } catch (err) {
    console.error('[Oppnd] Sync request failed', err);
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Sincronizar com backend';
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.oppndMessages) {
    loadMessages();
  }
});

async function loadMessages() {
  const stored = await chrome.storage.local.get(['oppndMessages']);
  const messages = Object.values(stored.oppndMessages || {});
  messages.sort((a, b) => getLastTimestamp(b) - getLastTimestamp(a));
  const latest = messages.slice(0, 10);
  render(latest);
}

function render(items) {
  listEl.innerHTML = '';
  if (!items.length) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;
  for (const item of items) {
    const li = document.createElement('li');
    const subject = document.createElement('div');
    subject.className = 'subject';
    subject.textContent = item.subjectSnippet || '(Sem assunto)';

    const meta = document.createElement('div');
    meta.className = 'meta';
    const state = deriveState(item.states || {});
    const timestamp = getLastTimestamp(item);
    meta.textContent = `${stateLabel(state)} • ${timestamp ? new Date(timestamp).toLocaleString() : '—'}`;

    li.appendChild(subject);
    li.appendChild(meta);
    listEl.appendChild(li);
  }
}

function deriveState(states) {
  if (states.readAt) return 'read';
  if (states.deliveredAt) return 'delivered';
  if (states.sentAt) return 'sent';
  return 'none';
}

function stateLabel(state) {
  switch (state) {
    case 'read':
      return 'Lido';
    case 'delivered':
      return 'Entregue';
    case 'sent':
      return 'Enviado';
    default:
      return 'Sem estado';
  }
}

function getLastTimestamp(item) {
  const states = item.states || {};
  return Date.parse(states.readAt || states.deliveredAt || states.sentAt || 0);
}
