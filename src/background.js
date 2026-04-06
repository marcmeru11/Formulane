/**
 * Formulane - Elite Background Service Worker
 * Optimized for Instant Load & Race Conditions
 */

const API_BASE = 'https://api.openf1.org/v1';
const SYNC_ALARM = 'f1SyncAlarm';
const DEFAULT_SETTINGS = {
    refreshInterval: 10,
    driverCount: 3
};

const log = (msg) => console.log(`[F1-BG] ${new Date().toLocaleTimeString()} - ${msg}`);
const delay = (ms) => new Promise(res => setTimeout(res, ms));

/**
 * Fetch Wrapper con manejo de errores
 */
async function safeGetJson(url) {
    try {
        const response = await fetch(url);
        if (response.status === 429) return null;
        if (response.status === 404 || response.status === 204) return [];
        const data = await response.json();
        return Array.isArray(data) ? data : (data ? [data] : []);
    } catch (e) {
        log(`Error: ${e.message}`);
        return [];
    }
}

/**
 * Lógica de Sincronización Principal
 */
async function syncF1Data() {
    log("Iniciando sincronización de datos...");
    try {
        const now = new Date();
        const year = now.getFullYear();

        // 1. Obtener Sesiones
        let allSessions = await safeGetJson(`${API_BASE}/sessions?year=${year}`);
        if (!allSessions || allSessions.length === 0) {
            allSessions = await safeGetJson(`${API_BASE}/sessions?year=${year - 1}`);
        }

        if (!allSessions || allSessions.length === 0) return;

        // 2. Determinar Target (Live o Última Carrera)
        const active = allSessions.find(s => 
            new Date(s.date_start) <= now && new Date(s.date_end) >= now
        );
        
        const next = allSessions
            .filter(s => new Date(s.date_start) > now)
            .sort((a, b) => new Date(a.date_start) - new Date(b.date_start))[0];

        let target = active || allSessions
            .filter(s => s.session_type === 'Race' && new Date(s.date_end) < now)
            .sort((a, b) => new Date(b.date_end) - new Date(a.date_end))[0];

        if (!target) return;

        // 3. Obtener Telemetría (Posiciones y Pilotos)
        const isLive = !!active;
        const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
        
        const posRaw = await safeGetJson(`${API_BASE}/position?session_key=${target.session_key}`);
        await delay(500);
        const drvRaw = await safeGetJson(`${API_BASE}/drivers?session_key=${target.session_key}`);

        let podium = [];

        if (posRaw?.length > 0 && drvRaw?.length > 0) {
            const driversMap = {};
            drvRaw.forEach(d => {
                driversMap[d.driver_number] = {
                    name: (d.last_name || d.broadcast_name || "Unknown").toUpperCase(),
                    team: (d.team_name || "F1 TEAM").toUpperCase(),
                    color: d.team_colour ? `#${d.team_colour}` : "#e10600"
                };
            });

            const latestPos = {};
            posRaw.forEach(p => { if (p.driver_number) latestPos[p.driver_number] = p.position; });

            podium = Object.entries(latestPos)
                .sort((a, b) => a[1] - b[1])
                .slice(0, settings.driverCount)
                .map(([num, pos]) => {
                    const info = driversMap[num] || { name: `DRV ${num}`, team: "F1 TEAM", color: "#e10600" };
                    return {
                        pos, name: info.name, team: info.team, color: info.color,
                        val: isLive ? "LIVE" : "FINAL"
                    };
                });
        }

        // 4. Guardar Todo
        await chrome.storage.local.set({ 
            podium, 
            nextRace: next ? { name: `${next.location} - ${next.session_name}`, time: new Date(next.date_start).getTime() } : null,
            title: isLive ? `LIVE: ${target.location}` : `RESULTADO: ${target.location}`,
            mode: isLive ? 'LIVE' : 'OFFLINE'
        });

        log("Datos actualizados correctamente.");
    } catch (e) {
        log(`Fallo en sync: ${e.message}`);
    }
}

/**
 * Configuración de Alarmas
 */
async function setupAlarm() {
    const data = await chrome.storage.local.get({ refreshInterval: DEFAULT_SETTINGS.refreshInterval });
    const interval = Math.max(1, parseInt(data.refreshInterval));
    
    await chrome.alarms.clear(SYNC_ALARM);
    chrome.alarms.create(SYNC_ALARM, { periodInMinutes: interval });
    log(`Alarma configurada cada ${interval} minutos.`);
}

// --- LISTENERS CRÍTICOS ---

// 1. INSTALACIÓN: Ejecuta al momento y luego crea la alarma
chrome.runtime.onInstalled.addListener(() => {
    log("Extensión instalada/actualizada.");
    syncF1Data(); // Ejecución instantánea
    setupAlarm(); // Programación futura
});

// 2. ALARMA: Ejecución periódica
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SYNC_ALARM) syncF1Data();
});

// 3. MENSAJES: Desde Popup o Settings
chrome.runtime.onMessage.addListener((request) => {
    if (request.type === 'SETTINGS_UPDATED') {
        log("Ajustes cambiados. Reconfigurando...");
        setupAlarm();
        syncF1Data();
    }
    if (request.type === 'FORCE_SYNC') {
        log("Sincronización forzada desde el Popup.");
        syncF1Data();
    }
});

// Inicialización de seguridad (por si el Service Worker se despierta solo)
setupAlarm();