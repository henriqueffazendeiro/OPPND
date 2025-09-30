const DEFAULT_SETTINGS = {
  apiBaseUrl: 'https://api.oppnd.local',
  userHash: '',
  autoPixel: true
};

let settings = { ...DEFAULT_SETTINGS };
let messages = {};
let draftMap = {};
let decorateTimeout = null;
let syncIntervalId = null;

const storageKeys = {
  settings: 'oppndSettings',
  messages: 'oppndMessages',
  draftMap: 'oppndDraftMap'
};

init();

async function init() {
  const stored = await chrome.storage.local.get([storageKeys.settings, storageKeys.messages, storageKeys.draftMap]);
  settings = { ...DEFAULT_SETTINGS, ...(stored[storageKeys.settings] || {}) };
  messages = stored[storageKeys.messages] || {};
  draftMap = stored[storageKeys.draftMap] || {};

  chrome.runtime.sendMessage({ type: 'oppnd:init' });

  observeDom();
  startSyncLoop();
  scheduleDecorate();
}

function startSyncLoop() {
  if (syncIntervalId) return;
  const SYNC_INTERVAL_MS = 15000;
  const fireSync = () => {
    chrome.runtime.sendMessage({ type: 'oppnd:sync-request' }, () => {
      // Ignore runtime errors when tab is closing
      void chrome.runtime.lastError;
    });
  };
  fireSync();
  syncIntervalId = setInterval(fireSync, SYNC_INTERVAL_MS);
}

function observeDom() {
  const observer = new MutationObserver(mutations => {
    let shouldDecorate = false;
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (isComposeRoot(node)) {
          prepareCompose(node);
        } else {
          const dialogs = node.querySelectorAll('div[role="dialog"]');
          dialogs.forEach(dialog => {
            if (isComposeRoot(dialog)) {
              prepareCompose(dialog);
            }
          });
        }
        if (nodeMatchesGmailRow(node)) {
          shouldDecorate = true;
        }
      });
      if (mutation.type === 'attributes' && nodeMatchesGmailRow(mutation.target)) {
        shouldDecorate = true;
      }
    }
    if (shouldDecorate) {
      scheduleDecorate();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}

function isComposeRoot(element) {
  if (!(element instanceof Element)) return false;
  if (element.getAttribute('role') !== 'dialog') return false;
  return Boolean(findComposeBody(element));
}

function prepareCompose(dialog) {
  if (dialog.dataset.oppndPrepared) return;
  dialog.dataset.oppndPrepared = 'true';

  const draftId = dialog.dataset.oppndDraftId || crypto.randomUUID();
  dialog.dataset.oppndDraftId = draftId;

  let messageId = draftMap[draftId];
  if (!messageId) {
    messageId = `${crypto.randomUUID()}-${Date.now()}`;
    draftMap[draftId] = messageId;
    chrome.storage.local.set({ [storageKeys.draftMap]: draftMap });
  }

  const sendButton = querySendButton(dialog);
  if (sendButton) {
    sendButton.addEventListener('click', () => handleSend(dialog, draftId, messageId), { capture: true });
  }
}

function querySendButton(dialog) {
  const selectors = [
    'div[role="button"][data-tooltip*="Send"]',
    'div[role="button"][data-tooltip*="Enviar"]',
    'div[role="button"][aria-label*="Send"]',
    'div[role="button"][aria-label*="Enviar"]',
    'button[data-tooltip*="Send"]',
    'button[data-tooltip*="Enviar"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="Enviar"]'
  ];
  for (const selector of selectors) {
    const el = dialog.querySelector(selector);
    if (el) return el;
  }
  return null;
}

async function handleSend(dialog, draftId, messageId) {
  const subjectInput = dialog.querySelector('input[name="subjectbox"]');
  const subject = subjectInput ? subjectInput.value.trim() : '';
  const bodyContainer = findComposeBody(dialog);

  if (!settings.userHash) {
    console.warn('[Oppnd] Missing user hash; skipping pixel injection');
  }

  if (settings.autoPixel && settings.userHash && bodyContainer) {
    injectPixel(bodyContainer, messageId);
  }

  const nowIso = new Date().toISOString();
  const messageRecord = {
    messageId,
    userHash: settings.userHash,
    subjectSnippet: subject,
    threadHint: null,
    states: {
      sentAt: nowIso,
      deliveredAt: messages[messageId]?.states?.deliveredAt || null,
      readAt: messages[messageId]?.states?.readAt || null
    }
  };

  messages[messageId] = messageRecord;
  await chrome.storage.local.set({ [storageKeys.messages]: messages });
  chrome.runtime.sendMessage({ type: 'oppnd:update-message', payload: messageRecord });
  scheduleDecorate();

  notifyBackendSent(messageRecord).catch(err => {
    console.error('[Oppnd] Failed to notify backend of sent message', err);
  });
}

function findComposeBody(root) {
  if (!(root instanceof Element)) return null;
  const explicit = root.querySelector('div[aria-label="Message Body"]');
  if (explicit) return explicit;
  const candidates = root.querySelectorAll('div[role="textbox"][contenteditable="true"]');
  for (const el of candidates) {
    if (el.getAttribute('aria-label')) {
      return el;
    }
  }
  return candidates[0] || null;
}

function injectPixel(bodyContainer, messageId) {
  if (bodyContainer.querySelector(`img[data-oppnd-mid="${messageId}"]`)) {
    return;
  }
  const img = document.createElement('img');
  const pixelUrl = buildPixelUrl(messageId);
  img.src = pixelUrl;
  img.width = 1;
  img.height = 1;
  img.alt = '';
  img.style.display = 'none';
  img.setAttribute('data-oppnd-mid', messageId);
  bodyContainer.appendChild(img);
}

function buildPixelUrl(messageId) {
  const base = settings.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl;
  const url = new URL('/t/pixel', base);
  url.searchParams.set('mid', messageId);
  if (settings.userHash) {
    url.searchParams.set('u', settings.userHash);
  }
  return url.toString();
}

function notifyBackendSent(messageRecord) {
  if (!settings.apiBaseUrl || !settings.userHash) {
    return Promise.reject(new Error('Missing Oppnd settings'));
  }
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'oppnd:sent-event',
      payload: messageRecord
    }, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response && response.ok) {
        resolve(response);
      } else {
        reject(new Error(response?.error || 'Unknown Oppnd error'));
      }
    });
  });
}

function scheduleDecorate() {
  if (decorateTimeout) {
    clearTimeout(decorateTimeout);
  }
  decorateTimeout = setTimeout(() => {
    decorateThreadRows();
    decorateThreadSubject();
  }, 250);
}

function nodeMatchesGmailRow(node) {
  return node instanceof Element && node.matches && node.matches('tr.zA, tr.x7, div.if, h2.hP, h1.hP');
}

function decorateThreadRows() {
  const rows = document.querySelectorAll('tr.zA');
  const messageList = Object.values(messages);
  rows.forEach(row => {
    const message = findMessageForRow(row, messageList);
    if (!message) return;
    row.dataset.oppndMessageId = message.messageId;
    const threadId = row.getAttribute('data-legacy-thread-id');
    if (threadId && !message.threadHint) {
      message.threadHint = threadId;
      chrome.storage.local.set({ [storageKeys.messages]: messages });
      chrome.runtime.sendMessage({ type: 'oppnd:update-message', payload: message });
    }
    applyTicksToRow(row, message);
  });
}

function decorateThreadSubject() {
  const subjectEl = document.querySelector('h2.hP, h1.hP');
  if (!subjectEl) return;
  const container = subjectEl.parentElement;
  if (!container) return;
  let badge = container.querySelector('.oppnd-ticks');
  const message = findMessageForThreadView();
  if (!message) {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = createTickElement();
    container.appendChild(badge);
  }
  updateTickElement(badge, message);
}

function findMessageForThreadView() {
  const threadIdContainer = document.querySelector('div[role="main"] div[aria-label="Conversation"]');
  let threadId = null;
  if (threadIdContainer) {
    threadId = threadIdContainer.getAttribute('data-legacy-thread-id');
  }
  if (threadId) {
    return Object.values(messages).find(msg => msg.threadHint === threadId) || null;
  }
  const subjectEl = document.querySelector('h2.hP, h1.hP');
  const subject = subjectEl ? subjectEl.textContent.trim() : '';
  if (!subject) return null;
  return findMessageBySubject(subject);
}

function findMessageForRow(row, messageList) {
  const threadId = row.getAttribute('data-legacy-thread-id');
  if (threadId) {
    const byThread = messageList.find(msg => msg.threadHint === threadId);
    if (byThread) return byThread;
  }
  const subjectEl = row.querySelector('span.bog');
  const subject = subjectEl ? subjectEl.textContent.trim() : '';
  if (!subject) return null;
  return findMessageBySubject(subject);
}

function findMessageBySubject(subject) {
  const cleanedSubject = subject.toLowerCase();
  const messageList = Object.values(messages);
  let candidate = messageList.find(msg => (msg.subjectSnippet || '').toLowerCase() === cleanedSubject);
  if (candidate) return candidate;
  candidate = messageList.find(msg => cleanedSubject.includes((msg.subjectSnippet || '').toLowerCase()));
  return candidate || null;
}

function applyTicksToRow(row, message) {
  let badge = row.querySelector('.oppnd-ticks');
  if (!badge) {
    const subjectCell = row.querySelector('.y6');
    if (!subjectCell) return;
    badge = createTickElement();
    subjectCell.appendChild(badge);
  }
  updateTickElement(badge, message);
}

function createTickElement() {
  const span = document.createElement('span');
  span.className = 'oppnd-ticks';
  span.style.display = 'inline-flex';
  span.style.alignItems = 'center';
  span.style.marginLeft = '4px';
  span.style.gap = '2px';
  return span;
}

function updateTickElement(element, message) {
  const state = deriveState(message.states || {});
  element.innerHTML = tickSvgForState(state);
  const lastAt = message.states?.readAt || message.states?.deliveredAt || message.states?.sentAt;
  element.title = lastAt ? `Oppnd: ${stateLabel(state)} • ${new Date(lastAt).toLocaleString()}` : `Oppnd: ${stateLabel(state)}`;
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

function tickSvgForState(state) {
  switch (state) {
    case 'read':
      return doubleTick('#1a73e8');
    case 'delivered':
      return doubleTick('#9aa0a6');
    case 'sent':
      return singleTick('#5f6368');
    default:
      return singleTick('#dadce0');
  }
}

function singleTick(color) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="10" viewBox="0 0 16 10">
      <path d="M2 5.5 L5.5 9 L14 1" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
}

function doubleTick(color) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="10" viewBox="0 0 18 10">
      <path d="M1.5 5.5 L4.8 9 L10.5 2.5" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M6.5 5.5 L9.8 9 L15.5 2.5" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
}

chrome.runtime.onMessage.addListener(message => {
  if (!message || !message.type) return;
  if (message.type === 'oppnd:event' && message.payload) {
    mergeMessageUpdate(message.payload);
  } else if (message.type === 'oppnd:sync-complete') {
    chrome.storage.local.get([storageKeys.messages]).then(result => {
      messages = result[storageKeys.messages] || {};
      scheduleDecorate();
    });
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes[storageKeys.messages]) {
    messages = changes[storageKeys.messages].newValue || {};
    scheduleDecorate();
  }
  if (changes[storageKeys.settings]) {
    settings = { ...DEFAULT_SETTINGS, ...(changes[storageKeys.settings].newValue || {}) };
  }
});

function mergeMessageUpdate(update) {
  const existing = messages[update.messageId] || { messageId: update.messageId, states: {} };
  messages[update.messageId] = {
    ...existing,
    ...update,
    states: {
      ...existing.states,
      ...(update.states || {})
    }
  };
  chrome.storage.local.set({ [storageKeys.messages]: messages });
  scheduleDecorate();
}
