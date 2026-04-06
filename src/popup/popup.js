/**
 * Formulane - Popup Engine
 * Sincroniza el almacenamiento local con la interfaz HUD.
 */

const elements = {
    title: document.getElementById('title'),
    podium: document.getElementById('podium'), // El contenedor .container
    modeLabel: document.querySelector('.status-indicator'),
    trackBanner: document.getElementById('track-banner'),
    trackLabel: document.getElementById('track-label'),
    trackMsg: document.getElementById('track-msg'),
    raceName: document.getElementById('race-name'),
    timer: document.getElementById('timer'),
    settingsBtn: document.getElementById('settings-btn')
};

/**
 * Renderiza la interfaz basándose en el CSS de alto impacto.
 */
function render() {
    chrome.storage.local.get(['podium', 'title', 'nextRace', 'mode', 'trackStatus'], (data) => {
        
        // 1. Manejo del Estado LIVE / OFFLINE
        const isLive = data.mode === 'LIVE';
        if (isLive) {
            document.body.classList.add('live');
            if (elements.modeLabel) elements.modeLabel.innerText = "LIVE";
        } else {
            document.body.classList.remove('live');
            if (elements.modeLabel) elements.modeLabel.innerText = "OFFLINE";
        }

        // 2. Título de la Sesión
        if (elements.title) {
            elements.title.innerText = data.title || "FORMULANE HUD";
        }

        // 3. Banner de Incidentes (SC, VSC, Banderas)
        const ts = data.trackStatus;
        if (ts && ts.mode !== 'CLEAR' && elements.trackBanner) {
            elements.trackBanner.style.display = 'flex';
            elements.trackBanner.style.borderLeft = `4px solid ${ts.color}`;
            if (elements.trackLabel) elements.trackLabel.innerText = ts.label;
            if (elements.trackMsg) elements.trackMsg.innerText = ts.message;
            
            if (ts.mode.includes('ENDING')) elements.trackBanner.classList.add('pulse-bg');
            else elements.trackBanner.classList.remove('pulse-bg');
        } else if (elements.trackBanner) {
            elements.trackBanner.style.display = 'none';
        }

        // 4. Renderizado del Podio (Tarjetas Aero HUD)
        if (!data.podium || data.podium.length === 0) {
            elements.podium.innerHTML = `
                <div style="text-align:center; padding:40px; opacity:0.3; font-family: 'Orbitron'; font-size:10px; letter-spacing:1px;">
                    SYNCING TELEMETRY...
                </div>`;
            // Forzar al background a trabajar si no hay datos
            chrome.runtime.sendMessage({ type: 'FORCE_SYNC' });
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

        // 5. Próxima Carrera y Timer
        if (data.nextRace && elements.raceName) {
            elements.raceName.innerText = data.nextRace.name.toUpperCase();
            startTimer(data.nextRace.time);
        }
    });
}

/**
 * Lógica del Temporizador
 */
let timerInterval;
function startTimer(target) {
    if (timerInterval) clearInterval(timerInterval);
    const tick = () => {
        const diff = target - Date.now();
        if (diff <= 0) {
            if (elements.timer) elements.timer.innerText = "TRACK ACTION LIVE";
            return;
        }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        if (elements.timer) {
            elements.timer.innerText = `${d}D ${String(h).padStart(2,'0')}H ${String(m).padStart(2,'0')}M ${String(s).padStart(2,'0')}S`;
        }
    };
    tick();
    timerInterval = setInterval(tick, 1000);
}

// Listeners
chrome.storage.onChanged.addListener(render);

document.addEventListener('DOMContentLoaded', () => {
    render();
    elements.settingsBtn?.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
});