const DEFAULT_SETTINGS = {
  apiBaseUrl: 'https://api.oppnd.local',
  userHash: '',
  autoPixel: true
};

let abortController = null;
let retryDelay = 1000;
const MAX_RETRY_DELAY = 60000;

async function getSettings() {
  const stored = await chrome.storage.local.get(['oppndSettings']);
  return { ...DEFAULT_SETTINGS, ...(stored.oppndSettings || {}) };
}

async function setSettings(settings) {
  await chrome.storage.local.set({ oppndSettings: settings });
}

async function ensureInitialized() {
  const settings = await getSettings();
  if (settings.userHash) {
    connectSSE(settings);
  }
}

function cleanupSSE() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

async function connectSSE(settings) {
  cleanupSSE();
  if (!settings.apiBaseUrl || !settings.userHash) {
    return;
  }

  const endpoint = new URL('/sse', settings.apiBaseUrl);
  endpoint.searchParams.set('u', settings.userHash);

  abortController = new AbortController();
  retryDelay = 1000;

  const attemptConnection = async () => {
    try {
      await streamSSE(endpoint.toString(), settings);
      retryDelay = 1000;
    } catch (err) {
      console.warn('[Oppnd] SSE failed', err);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
      if (abortController) {
        attemptConnection();
      }
    }
  };

  attemptConnection();
}

async function streamSSE(url, settings) {
  const response = await fetch(url, {
    method: 'GET',
    signal: abortController.signal,
    headers: {
      Accept: 'text/event-stream'
    },
    cache: 'no-cache'
  });

  if (!response.ok || !response.body) {
    throw new Error(`SSE connection failed with status ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop();
    for (const rawEvent of events) {
      const parsed = parseSseEvent(rawEvent);
      if (parsed && parsed.data) {
        handleIncomingEvent(parsed.data, settings);
      }
    }
  }
}

function parseSseEvent(chunk) {
  const lines = chunk.split('\n');
  const event = {};
  for (const line of lines) {
    if (!line || line.startsWith(':')) continue;
    const [rawField, ...rest] = line.split(':');
    const field = rawField.trim();
    const value = rest.join(':').trimStart();
    if (field === 'event') {
      event.type = value;
    } else if (field === 'data') {
      event.data = value;
    } else if (field === 'id') {
      event.id = value;
    }
  }
  return event;
}

async function handleIncomingEvent(rawData, settings) {
  try {
    const payload = JSON.parse(rawData);
    if (!payload || !payload.messageId) return;
    await upsertMessageState(payload.messageId, payload);
    await broadcastToTabs({ type: 'oppnd:event', payload });
  } catch (err) {
    console.error('[Oppnd] Failed to process SSE event', err);
  }
}

async function upsertMessageState(messageId, update) {
  const { oppndMessages = {} } = await chrome.storage.local.get(['oppndMessages']);
  const current = oppndMessages[messageId] || { messageId, states: {} };
  oppndMessages[messageId] = {
    ...current,
    ...update,
    states: {
      ...current.states,
      ...(update.states || {})
    }
  };
  await chrome.storage.local.set({ oppndMessages });
}

async function broadcastToTabs(message) {
  const tabs = await chrome.tabs.query({ url: 'https://mail.google.com/*' });
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, message);
    } catch (error) {
      // Ignore tabs that cannot receive messages
    }
  }
}

async function syncFromBackend() {
  const settings = await getSettings();
  if (!settings.apiBaseUrl || !settings.userHash) return { ok: false };
  try {
    const endpoint = new URL('/events/history', settings.apiBaseUrl);
    endpoint.searchParams.set('u', settings.userHash);
    const res = await fetch(endpoint.toString(), {
      headers: {
        Accept: 'application/json'
      }
    });
    if (!res.ok) throw new Error(`Sync failed with status ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data.messages)) {
      const byId = {};
      for (const msg of data.messages) {
        if (msg.messageId) {
          byId[msg.messageId] = msg;
        }
      }
      await chrome.storage.local.set({ oppndMessages: byId });
      await broadcastToTabs({ type: 'oppnd:sync-complete', payload: { messageCount: data.messages.length } });
      return { ok: true };
    }
    return { ok: false };
  } catch (err) {
    console.error('[Oppnd] syncFromBackend failed', err);
    return { ok: false, error: String(err) };
  }
}

async function notifySentEvent(payload) {
  if (!payload || !payload.messageId) {
    return { ok: false, error: 'Invalid payload' };
  }
  const settings = await getSettings();
  if (!settings.apiBaseUrl || !settings.userHash) {
    return { ok: false, error: 'Missing settings' };
  }
  try {
    const endpoint = new URL('/events/sent', settings.apiBaseUrl);
    const res = await fetch(endpoint.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messageId: payload.messageId,
        userHash: settings.userHash,
        subjectSnippet: payload.subjectSnippet || '',
        threadHint: payload.threadHint || null
      })
    });
    if (!res.ok) {
      throw new Error(`Sent event failed with status ${res.status}`);
    }
    const data = await res.json();
    await upsertMessageState(payload.messageId, data);
    await broadcastToTabs({ type: 'oppnd:event', payload: data });
    return { ok: true };
  } catch (err) {
    console.error('[Oppnd] notifySentEvent failed', err);
    return { ok: false, error: String(err) };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureInitialized();
});

if (chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    ensureInitialized();
  });
}

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes.oppndSettings) {
    const newSettings = { ...DEFAULT_SETTINGS, ...(changes.oppndSettings.newValue || {}) };
    if (!newSettings.userHash) {
      cleanupSSE();
      return;
    }
    connectSSE(newSettings);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;
  switch (message.type) {
    case 'oppnd:init':
      ensureInitialized();
      break;
    case 'oppnd:sync-request':
      syncFromBackend().then(sendResponse);
      return true;
    case 'oppnd:update-message':
      if (message.payload && message.payload.messageId) {
        upsertMessageState(message.payload.messageId, message.payload);
      }
      break;
    case 'oppnd:sent-event':
      notifySentEvent(message.payload).then(sendResponse);
      return true;
    default:
      break;
  }
});

chrome.runtime.onSuspend.addListener(() => {
  cleanupSSE();
});


console.log('[Oppnd] background script reloaded', typeof notifySentEvent);

globalThis.notifySentEvent = notifySentEvent;

