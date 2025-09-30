const storageKey = 'oppndSettings';
const defaults = {
  apiBaseUrl: 'https://api.oppnd.local',
  userHash: '',
  autoPixel: true
};

const apiInput = document.getElementById('apiBaseUrl');
const autoPixelInput = document.getElementById('autoPixel');
const userHashInput = document.getElementById('userHash');
const regenButton = document.getElementById('regen');
const statusEl = document.getElementById('status');

let settings = { ...defaults };

init();

async function init() {
  const stored = await chrome.storage.local.get([storageKey]);
  settings = { ...defaults, ...(stored[storageKey] || {}) };
  apiInput.value = settings.apiBaseUrl || '';
  autoPixelInput.checked = settings.autoPixel !== false;
  userHashInput.value = settings.userHash || '';
}

apiInput.addEventListener('change', async () => {
  settings.apiBaseUrl = apiInput.value.trim() || defaults.apiBaseUrl;
  await persist('URL da API guardada.');
});

autoPixelInput.addEventListener('change', async () => {
  settings.autoPixel = autoPixelInput.checked;
  await persist('Preferência atualizada.');
});

regenButton.addEventListener('click', async () => {
  settings.userHash = await generateHash();
  userHashInput.value = settings.userHash;
  await persist('Nova chave gerada.');
  chrome.runtime.sendMessage({ type: 'oppnd:init' });
});

async function persist(message) {
  await chrome.storage.local.set({ [storageKey]: settings });
  showStatus(message);
}

function showStatus(text) {
  statusEl.textContent = text;
  if (!text) return;
  setTimeout(() => {
    statusEl.textContent = '';
  }, 2500);
}

async function generateHash() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}
