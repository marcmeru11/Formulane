/**
 * F1 Live Monitor Pro - Popup Script
 * Gestiona la visualización del podio, estado de pista y cuenta atrás.
 */

// Caché de elementos del DOM para rendimiento
const elements = {
    title: document.getElementById('title'),
    podium: document.getElementById('podium'),
    modeLabel: document.getElementById('mode-label'),
    trackBanner: document.getElementById('track-banner'),
    trackLabel: document.getElementById('track-label')?.querySelector('span'),
    trackMsg: document.getElementById('track-msg'),
    raceName: document.getElementById('race-name'),
    timer: document.getElementById('timer'),
    settingsBtn: document.getElementById('settings-btn')
};

/**
 * Renderiza la interfaz principal basándose en el estado almacenado.
 */
function render() {
    chrome.storage.local.get(['podium', 'title', 'nextRace', 'mode', 'trackStatus'], (data) => {
        if (elements.title) elements.title.innerText = data.title || chrome.i18n.getMessage("noData");
        
        // 1. Estado de Sesión (LIVE / OFFLINE)
        if (data.mode === 'LIVE') {
            document.body.classList.add('live');
            if (elements.modeLabel) elements.modeLabel.innerText = chrome.i18n.getMessage("live");
        } else {
            document.body.classList.remove('live');
            if (elements.modeLabel) elements.modeLabel.innerText = chrome.i18n.getMessage("offline");
        }

        // 2. Banner de incidentes en pista (SC, VSC, Banderas)
        const ts = data.trackStatus;
        if (ts && ts.mode !== 'CLEAR') {
            elements.trackBanner.style.display = 'flex';
            elements.trackBanner.style.backgroundColor = ts.color;
            if (elements.trackLabel) elements.trackLabel.innerText = ts.label;
            if (elements.trackMsg) elements.trackMsg.innerText = ts.message;

            // Animación para estados de aviso inminente (ENDING)
            if (ts.mode?.includes('ENDING')) {
                elements.trackBanner.classList.add('pulse-bg');
            } else {
                elements.trackBanner.classList.remove('pulse-bg');
            }
        } else if (elements.trackBanner) {
            elements.trackBanner.style.display = 'none';
        }

        // 3. Lista de Pilotos (Podio)
        if (!data.podium?.length) {
            elements.podium.innerHTML = `
                <div style="text-align:center; padding:20px; opacity:0.5; font-size:12px;">
                    ${chrome.i18n.getMessage("waitingData")}
                </div>`;
        } else {
            elements.podium.innerHTML = data.podium.map((d, index) => `
                <div class="driver-card" style="--team-color: ${d.color}; --team-glow: ${d.color}33; --delay: ${index * 0.1}s">
                    <div class="pos-badge">${d.pos}</div>
                    <div class="driver-info">
                        <div class="name">${d.name}</div>
                        <div class="team">${d.team}</div>
                    </div>
                    <div class="data-value">${d.val}</div>
                </div>
            `).join('');
        }

        // 4. Próximo evento
        if (data.nextRace && elements.raceName) {
            elements.raceName.innerText = data.nextRace.name;
            startTimer(data.nextRace.time);
        }
    });
}

/**
 * Gestiona el temporizador de cuenta atrás para la próxima sesión.
 */
let timerInterval;
function startTimer(target) {
    if (timerInterval) clearInterval(timerInterval);
    
    const tick = () => {
        const diff = target - Date.now();
        if (diff <= 0) { 
            if (elements.timer) elements.timer.innerText = chrome.i18n.getMessage("onTrack"); 
            return; 
        }
        
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        
        if (elements.timer) {
            const dStr = chrome.i18n.getMessage("dayAbbr");
            const hStr = chrome.i18n.getMessage("hourAbbr");
            const mStr = chrome.i18n.getMessage("minAbbr");
            const sStr = chrome.i18n.getMessage("secAbbr");
            elements.timer.innerText = `${d}${dStr} ${String(h).padStart(2,'0')}${hStr} ${String(m).padStart(2,'0')}${mStr} ${String(s).padStart(2,'0')}${sStr}`;
        }
    };
    
    tick();
    timerInterval = setInterval(tick, 1000);
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

// Suscripción a cambios y carga inicial
chrome.storage.onChanged.addListener(render);
document.addEventListener('DOMContentLoaded', () => {
    localizeHtml();
    render();
    
    // Botón de configuración
    elements.settingsBtn?.addEventListener('click', () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('src/options/options.html'));
        }
    });
});