/**
 * F1 Live Monitor Pro - Background Service Worker
 * Gestiona la sincronización de datos con OpenF1 API, caché y notificaciones.
 */

// --- CONFIGURACIÓN Y CONSTANTES ---
const API_BASE = 'https://api.openf1.org/v1';
const CACHE_TIMES = {
    SESSIONS: 30, // minutos
    DRIVERS: 1440 // 24 horas (una vez por sesión)
};
const DEFAULT_SETTINGS = {
    refreshInterval: 2,
    driverCount: 3,
    enableNotifications: true
};

const log = (msg) => console.log(`[F1-BG] ${msg}`);
const delay = (ms) => new Promise(res => setTimeout(res, ms));

// --- AYUDANTES DE NOTIFICACIÓN Y API ---

/**
 * Muestra una notificación de escritorio si el usuario lo permite para ese tipo específico.
 * @param {string} type - Tipo de notificación (clave en storage)
 */
async function notify(title, message, type) {
    const settings = await chrome.storage.local.get({
        notifySessionStart: true,
        notifyLeaderChange: true,
        notifyTrackStatus: true,
        notifyRaceControl: false
    });
    
    // Si el tipo específico está desactivado, no mostrar
    if (type && !settings[type]) return;

    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: `🏎️ ${title}`,
        message: message,
        priority: 2
    });
}

/**
 * Fetch seguro con manejo de errores y rate limits (429).
 */
async function safeGetJson(url) {
    try {
        const response = await fetch(url);
        // Manejo específico del 429 (Rate Limit) para detener cascada de errores
        if (response.status === 429) {
            log(`⚠️ LIMIT (429) en API: ${url}.`);
            return null;
        }
        // Manejo de recursos no encontrados (404) para sesiones vacías o borradas
        if (response.status === 404) {
            // Log discreto para 404 ya que es común en sesiones antiguas
            log(`ℹ️ [404] Dato no disponible para esta sesión.`);
            return [];
        }
        if (response.status === 204) return [];
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const text = await response.text();
        return text ? JSON.parse(text) : [];
    } catch (e) {
        log(`Error en fetch (${url}): ${e.message}`);
        return [];
    }
}

// --- GESTIÓN DE CACHÉ ---

async function getCachedData(key, maxAgeMins = 0) {
    const data = await chrome.storage.local.get(key);
    if (!data[key]) return null;
    if (maxAgeMins > 0) {
        const age = (Date.now() - data[key].timestamp) / 60000;
        if (age > maxAgeMins) return null;
    }
    return data[key].content;
}

async function saveToCache(key, content) {
    await chrome.storage.local.set({ [key]: { content, timestamp: Date.now() } });
}

// --- LÓGICA PRINCIPAL DE SINCRONIZACIÓN ---

/**
 * Punto de entrada para la sincronización periódica.
 */
async function syncF1Data() {
    try {
        const now = new Date();
        const year = now.getFullYear();

        // 1. Obtener sesiones (con caché)
        let allSessions = await getCachedData('f1_sessions_cache', CACHE_TIMES.SESSIONS);
        if (!allSessions) {
            const raw = await safeGetJson(`${API_BASE}/sessions?year=${year}`);
            if (raw === null) return;
            allSessions = Array.isArray(raw) ? raw : (raw ? [raw] : []);
            if (allSessions.length > 0) await saveToCache('f1_sessions_cache', allSessions);
        }

        if (!allSessions || allSessions.length === 0) return;

        // 2. Identificar sesión activa o última relevante
        const active = allSessions.find(s => new Date(s.date_start) <= now && new Date(s.date_end) >= now);
        const next = allSessions.filter(s => new Date(s.date_start) > now).sort((a,b) => new Date(a.date_start) - new Date(b.date_start))[0];

        let target = null;
        let isLive = false;

        if (active) {
            target = active;
            isLive = true;
        } else {
            const past = allSessions.filter(s => s.session_type === 'Race' && new Date(s.date_end) < now).sort((a,b) => new Date(b.date_end) - new Date(a.date_end))[0];
            if (past) target = past;
        }

        if (!target) return;

        // Notificación de inicio de sesión
        const { lastSessionKey } = await chrome.storage.local.get('lastSessionKey');
        if (isLive && lastSessionKey !== target.session_key) {
            notify(chrome.i18n.getMessage("sessionLive"), `${chrome.i18n.getMessage("sessionStarted")} ${target.session_name || target.location}`, "notifySessionStart");
            await chrome.storage.local.set({ lastSessionKey: target.session_key });
        }

        // 3. Actualizar Podio y Estado de Pista (Secuencial para evitar 429)
        const trackSuccess = await updateTrackStatus(target.session_key);
        if (trackSuccess === null) return; // Abortar resto de sync si hay 429
        
        await delay(500);
        await updatePodium(target.session_key, target.session_name || target.location, isLive, next);

    } catch (e) {
        log(`Fallo crítico en syncF1Data: ${e.message}`);
    }
}

/**
 * Actualiza el estado de la pista (SC, VSC, Banderas)
 */
async function updateTrackStatus(sessionKey) {
    try {
        // Peticiones secuenciales con delay para burst control
        const statusRaw = await safeGetJson(`${API_BASE}/track_status?session_key=${sessionKey}`);
        if (statusRaw === null) return null; // Señal de 429
        
        await delay(500);
        const raceControlRaw = await safeGetJson(`${API_BASE}/race_control?session_key=${sessionKey}`);
        if (raceControlRaw === null) return null; // Señal de 429
        
        const lastStatus = statusRaw?.[statusRaw.length - 1];
        const lastRC = raceControlRaw?.[raceControlRaw.length - 1];
        if (!lastStatus) return;

        let state = { label: chrome.i18n.getMessage("clear"), color: "#4ade80", message: chrome.i18n.getMessage("trackClear"), mode: "CLEAR" };
        const code = parseInt(lastStatus.status);

        const statusMap = {
            2: { label: chrome.i18n.getMessage("yellowFlag"), color: "#ffd700", message: chrome.i18n.getMessage("yellowFlag"), mode: "YELLOW" },
            4: { label: chrome.i18n.getMessage("safetyCar"), color: "#ff8000", message: chrome.i18n.getMessage("scMessage"), mode: "SC" },
            5: { label: chrome.i18n.getMessage("redFlag"), color: "#ff1801", message: chrome.i18n.getMessage("sessionSuspended"), mode: "RED" },
            6: { label: chrome.i18n.getMessage("vsc"), color: "#ffd700", message: chrome.i18n.getMessage("vscMessage"), mode: "VSC" },
            7: { label: chrome.i18n.getMessage("vscEnding"), color: "#ffd700", message: chrome.i18n.getMessage("prepareRestart"), mode: "VSC_ENDING" }
        };

        const oldTrackStatus = (await chrome.storage.local.get('trackStatus')).trackStatus;

        if (statusMap[code]) {
            state = statusMap[code];
            // Notificar incidentes de pista (SC, VSC, RED)
            if (oldTrackStatus?.mode !== state.mode && [4, 5, 6].includes(code)) {
                notify(chrome.i18n.getMessage("incidentOnTrack"), state.message, "notifyTrackStatus");
            }
        }

        // Procesar mensajes especiales de Race Control
        if (lastRC) {
            const msg = lastRC.message.toUpperCase();
            const { lastRCId } = await chrome.storage.local.get('lastRCId');
            
            if (lastRC.date !== lastRCId) {
                const alerts = ["DRS ENABLED", "INVESTIGATION", "PENALTY", "PIT LANE OPEN"];
                if (alerts.some(a => msg.includes(a))) {
                    notify(chrome.i18n.getMessage("raceControlAlerts"), lastRC.message, "notifyRaceControl");
                }
                await chrome.storage.local.set({ lastRCId: lastRC.date });
            }

            if (msg.includes("SC ENDING") || msg.includes("SAFETY CAR IN THIS LAP")) {
                state = { label: chrome.i18n.getMessage("scEnding"), color: "#ff8000", message: chrome.i18n.getMessage("scEndingMessage"), mode: "SC_ENDING" };
            } else if (state.mode === "YELLOW" && lastRC.sector) {
                state.message = `${chrome.i18n.getMessage("dangerSector")} ${lastRC.sector}`;
            }
        }

        await chrome.storage.local.set({ trackStatus: { ...state, lastUpdate: Date.now() } });
    } catch (e) { log(`Error en trackStatus: ${e.message}`); }
}

/**
 * Actualiza las posiciones de los pilotos
 */
async function updatePodium(sessionKey, title, isLive, next) {
    try {
        const driversKey = `f1_drivers_${sessionKey}`;
        
        // Peticiones secuenciales (burst control)
        const posRaw = await safeGetJson(`${API_BASE}/position?session_key=${sessionKey}`);
        if (posRaw === null) return null; // Señal de 429
        
        let drvRaw = await getCachedData(driversKey);
        const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
        
        await delay(500);

        // Si no hay pilotos en caché o es un array vacío, descargarlos
        if (!drvRaw || (Array.isArray(drvRaw) && drvRaw.length === 0)) {
            log(`Sincronizando información de pilotos para sesión ${sessionKey}...`);
            drvRaw = await safeGetJson(`${API_BASE}/drivers?session_key=${sessionKey}`);
            if (drvRaw && drvRaw.length > 0) {
                await saveToCache(driversKey, drvRaw);
                log(`Sincronizados ${drvRaw.length} pilotos.`);
            }
        }

        if (!posRaw?.length || !drvRaw?.length) {
            if (posRaw === null) return; // Rate limit protection
            // Si no hay datos nuevos, no borramos el podio existente
            const { podium: current } = await chrome.storage.local.get('podium');
            if (current?.length > 0) return;
        }

        const driversMap = {};
        if (Array.isArray(drvRaw)) {
            drvRaw.forEach(d => {
                const num = String(d.driver_number);
                // Intentar obtener el mejor nombre posible
                const name = (d.last_name || d.broadcast_name || d.full_name || "???").toUpperCase();
                driversMap[num] = {
                    name: name,
                    team: (d.team_name || "F1 TEAM").toUpperCase(),
                    color: `#${d.team_colour || 'ffffff'}`
                };
            });
        }

        // Obtener última posición conocida de cada piloto
        const latestHead = {};
        if (Array.isArray(posRaw)) {
            posRaw.forEach(p => { 
                if (p.driver_number) latestHead[p.driver_number] = p.position; 
            });
        }

        const podium = Object.entries(latestHead)
            .sort((a,b) => a[1] - b[1])
            .slice(0, settings.driverCount || 3)
            .map(([num, pos]) => {
                const info = driversMap[num] || { name: `${chrome.i18n.getMessage("driverPlaceholder")} ${num}`, team: "F1 TEAM" };
                const colors = { 1: "#ffd700", 2: "#94a3b8", 3: "#92400e" };
                return {
                    pos,
                    name: info.name,
                    team: info.team,
                    color: colors[pos] || "#e10600",
                    val: isLive ? chrome.i18n.getMessage("live") : chrome.i18n.getMessage("final")
                };
            });

        // Notificar cambio de líder
        if (isLive && podium.length > 0) {
            const { lastLeader } = await chrome.storage.local.get('lastLeader');
            if (lastLeader && lastLeader !== podium[0].name) {
                notify(chrome.i18n.getMessage("leaderChanged"), `¡${podium[0].name} ${chrome.i18n.getMessage("newP1")}`, "notifyLeaderChange");
            }
            await chrome.storage.local.set({ lastLeader: podium[0].name });
        }

        const nextRace = next ? { name: `${next.location} - ${next.session_name}`, time: new Date(next.date_start).getTime() } : null;

        await chrome.storage.local.set({ 
            podium, 
            title: isLive ? `${chrome.i18n.getMessage("liveTitle")} ${title}` : `${chrome.i18n.getMessage("resultTitle")} ${title}`,
            mode: isLive ? 'LIVE' : 'OFFLINE',
            nextRace 
        });

    } catch (e) { log(`Error en updatePodium: ${e.message}`); }
}

// --- GESTIÓN DE ALARMAS Y EVENTOS ---

async function setupAlarm() {
    const { refreshInterval } = await chrome.storage.local.get({ refreshInterval: DEFAULT_SETTINGS.refreshInterval });
    await chrome.alarms.clear("f1Sync");
    chrome.alarms.create("f1Sync", { periodInMinutes: refreshInterval });
}

chrome.runtime.onInstalled.addListener(() => { syncF1Data(); setupAlarm(); });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === "f1Sync") syncF1Data(); });
chrome.runtime.onMessage.addListener((m) => {
    if (['UPDATE_ALARM', 'SETTINGS_UPDATED'].includes(m.type)) {
        setupAlarm();
        syncF1Data();
    }
});

// Inicialización
syncF1Data();
setupAlarm();