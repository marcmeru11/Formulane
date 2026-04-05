// Elementos del DOM - Identificadores sincronizados con options.html
const elements = {
  refreshInterval: document.getElementById('refreshInterval'),
  driverCount: document.getElementById('driverCount'),
  notifySessionStart: document.getElementById('notifySessionStart'),
  notifyLeaderChange: document.getElementById('notifyLeaderChange'),
  notifyTrackStatus: document.getElementById('notifyTrackStatus'),
  notifyRaceControl: document.getElementById('notifyRaceControl'),
  saveBtn: document.getElementById('save'),
  status: document.getElementById('status')
};

/**
 * Carga los ajustes guardados desde chrome.storage.local
 */
function loadOptions() {
  chrome.storage.local.get({
    refreshInterval: 2,
    driverCount: 3,
    notifySessionStart: true,
    notifyLeaderChange: true,
    notifyTrackStatus: true,
    notifyRaceControl: false
  }, (items) => {
    if (elements.refreshInterval) elements.refreshInterval.value = items.refreshInterval;
    if (elements.driverCount) elements.driverCount.value = items.driverCount;
    if (elements.notifySessionStart) elements.notifySessionStart.checked = items.notifySessionStart;
    if (elements.notifyLeaderChange) elements.notifyLeaderChange.checked = items.notifyLeaderChange;
    if (elements.notifyTrackStatus) elements.notifyTrackStatus.checked = items.notifyTrackStatus;
    if (elements.notifyRaceControl) elements.notifyRaceControl.checked = items.notifyRaceControl;
  });
}

/**
 * Guarda los ajustes y notifica al script de fondo
 */
function saveOptions() {
  const refreshInterval = parseInt(elements.refreshInterval?.value || 2, 10);
  const driverCount = parseInt(elements.driverCount?.value || 3, 10);
  
  const settings = { 
    refreshInterval, 
    driverCount,
    notifySessionStart: elements.notifySessionStart?.checked ?? true,
    notifyLeaderChange: elements.notifyLeaderChange?.checked ?? true,
    notifyTrackStatus: elements.notifyTrackStatus?.checked ?? true,
    notifyRaceControl: elements.notifyRaceControl?.checked ?? false
  };

  // Validación robusta
  if (isNaN(refreshInterval) || refreshInterval < 1) {
    showStatus(chrome.i18n.getMessage("errorInvalidInterval"), 'error');
    return;
  }

  chrome.storage.local.set(settings, () => {
    // Notificar al background para sincronización inmediata
    chrome.runtime.sendMessage({ 
      type: 'SETTINGS_UPDATED', 
      interval: refreshInterval 
    });
    
    showStatus(chrome.i18n.getMessage("settingsSaved"));
  });
}

/**
 * Muestra un mensaje de estado temporal en la UI
 */
function showStatus(text, type = 'success') {
  if (!elements.status) return;

  elements.status.textContent = text;
  elements.status.style.color = type === 'error' ? '#ff3c33' : '#4ade80';
  elements.status.className = 'status-show';
  
  setTimeout(() => {
    elements.status.className = '';
  }, 2500);
}

/**
 * Traduce los elementos del DOM que tienen el atributo data-i18n.
 */
function localizeHtml() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(key);
    if (message) el.innerText = message;
  });
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  localizeHtml();
  loadOptions();
});
if (elements.saveBtn) {
  elements.saveBtn.addEventListener('click', saveOptions);
}
