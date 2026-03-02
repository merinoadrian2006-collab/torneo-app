const BASE_URL = '';
const params = new URLSearchParams(window.location.search);
const torneoId = params.get('id');
const isPublic = params.get('public') === '1';

// ── DOM refs ───────────────────────────────────────────
const titulo           = document.getElementById('torneoTitulo');
const statEquipos      = document.getElementById('statEquipos');
const statPartidos     = document.getElementById('statPartidos');
const statGoles        = document.getElementById('statGoles');
const statEquiposLabel = document.getElementById('statEquiposLabel');
const statGolesLabel   = document.getElementById('statGolesLabel');
const sportBadge       = document.getElementById('sportBadge');
const equiposList      = document.getElementById('equiposList');
const tablaClasif      = document.getElementById('tablaClasificacion');
const estadisticasEl   = document.getElementById('estadisticasSection');
const partidosEl       = document.getElementById('partidosSection');
const playoffEl        = document.getElementById('playoffSection');
const activityEl       = document.getElementById('activitySection');
const btnEquipo        = document.getElementById('btnEquipo');
const btnPartido       = document.getElementById('btnPartido');
const shareBar         = document.getElementById('shareBar');
const editControls     = document.getElementById('editControls');
const editControls2    = document.getElementById('editControls2');

let torneoData = null;
let chartBars  = null;
let chartPie   = null;

// ── Sport definitions ──────────────────────────────────
const SPORTS = {
    futbol:      { emoji: '⚽', name: 'Fútbol',      scoreLabel: 'Goles',   teamLabel: 'Equipos',   teamSingle: 'Equipo',   drawAllowed: true,  placeholder: 'Nombre del equipo...',    localLabel: 'Local',     visitLabel: 'Visitante', tableLabel: 'Clasificación', scoreColLabel: 'GF', scoreConcedLabel: 'GC', finLabel: 'FIN'  },
    futbol_sala: { emoji: '🏟️', name: 'Fútbol Sala', scoreLabel: 'Goles',   teamLabel: 'Equipos',   teamSingle: 'Equipo',   drawAllowed: true,  placeholder: 'Nombre del equipo...',    localLabel: 'Local',     visitLabel: 'Visitante', tableLabel: 'Clasificación', scoreColLabel: 'GF', scoreConcedLabel: 'GC', finLabel: 'FIN'  },
    baloncesto:  { emoji: '🏀', name: 'Baloncesto',  scoreLabel: 'Puntos',  teamLabel: 'Equipos',   teamSingle: 'Equipo',   drawAllowed: false, placeholder: 'Nombre del equipo...',    localLabel: 'Local',     visitLabel: 'Visitante', tableLabel: 'Clasificación', scoreColLabel: 'PF', scoreConcedLabel: 'PC', finLabel: 'FIN'  },
    tenis:       { emoji: '🎾', name: 'Tenis',       scoreLabel: 'Sets',    teamLabel: 'Jugadores', teamSingle: 'Jugador',  drawAllowed: false, placeholder: 'Nombre del jugador...',   localLabel: 'Jugador 1', visitLabel: 'Jugador 2', tableLabel: 'Ranking',        scoreColLabel: 'SF', scoreConcedLabel: 'SC', finLabel: 'SETS' },
    frontenis:   { emoji: '🎱', name: 'Frontenis',   scoreLabel: 'Sets',    teamLabel: 'Jugadores', teamSingle: 'Jugador',  drawAllowed: false, placeholder: 'Nombre del jugador...',   localLabel: 'Jugador 1', visitLabel: 'Jugador 2', tableLabel: 'Ranking',        scoreColLabel: 'SF', scoreConcedLabel: 'SC', finLabel: 'SETS' },
    voleibol:    { emoji: '🏐', name: 'Voleibol',    scoreLabel: 'Sets',    teamLabel: 'Equipos',   teamSingle: 'Equipo',   drawAllowed: false, placeholder: 'Nombre del equipo...',    localLabel: 'Local',     visitLabel: 'Visitante', tableLabel: 'Clasificación', scoreColLabel: 'SF', scoreConcedLabel: 'SC', finLabel: 'SETS' },
    padel:       { emoji: '🏓', name: 'Pádel',       scoreLabel: 'Sets',    teamLabel: 'Parejas',   teamSingle: 'Pareja',   drawAllowed: false, placeholder: 'Nombre de la pareja...', localLabel: 'Pareja 1',  visitLabel: 'Pareja 2',  tableLabel: 'Ranking',        scoreColLabel: 'SF', scoreConcedLabel: 'SC', finLabel: 'SETS' },
    rugby:       { emoji: '🏉', name: 'Rugby',       scoreLabel: 'Puntos',  teamLabel: 'Equipos',   teamSingle: 'Equipo',   drawAllowed: true,  placeholder: 'Nombre del equipo...',    localLabel: 'Local',     visitLabel: 'Visitante', tableLabel: 'Clasificación', scoreColLabel: 'PF', scoreConcedLabel: 'PC', finLabel: 'FIN'  },
};

function getSport() {
    if (!torneoData || !torneoData.sport) return SPORTS['futbol'];
    return SPORTS[torneoData.sport] || SPORTS['futbol'];
}

// ── Auth / API helper ──────────────────────────────────
const token = localStorage.getItem('torneoapp_token');

async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token && !isPublic) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    if (res.status === 401 && !isPublic) {
        alert('Sesión expirada. Vuelve a iniciar sesión.');
        localStorage.removeItem('torneoapp_token');
        localStorage.removeItem('torneoapp_session');
        window.location.href = '/';
        return null;
    }
    return res;
}

// ── Utilities ──────────────────────────────────────────
function escapeHtml(str) {
    return String(str || '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'")
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Strip validator.escape artifacts from server (show clean names in UI)
function displayName(str) {
    return String(str || '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
}

function animateCount(el, target, duration = 700) {
    if (!el) return;
    const startTime = performance.now();
    function update(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - progress, 3)));
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

function getInitials(name) {
    return displayName(name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getAvatarColor(name) {
    const colors = ['#e8ff00','#ff6b35','#a78bfa','#34d399','#60a5fa','#f472b6','#fbbf24','#f87171'];
    let hash = 0;
    const s = String(name || '');
    for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

// ── LOAD TORNEO ────────────────────────────────────────
async function cargarTorneo() {
    try {
        const url = isPublic
            ? `/api/public/${torneoId}`
            : `/api/torneos/${torneoId}`;
        const res = await api(url);
        if (!res) return;
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            titulo.textContent = err.message || 'Torneo no encontrado';
            console.error('Error cargando torneo:', res.status, err);
            return;
        }
        torneoData = await res.json();

        const sport = getSport(); // NOW torneoData.sport is set correctly

        // Banner
        titulo.textContent = displayName(torneoData.name);
        document.title = `${displayName(torneoData.name)} — TorneoApp`;

        if (sportBadge) {
            sportBadge.textContent = `${sport.emoji} ${sport.name}`;
            sportBadge.style.display = 'inline-flex';
        }

        // Stat labels
        if (statEquiposLabel) statEquiposLabel.textContent = sport.teamLabel;
        if (statGolesLabel)   statGolesLabel.textContent   = sport.scoreLabel;

        const totalScore = torneoData.matches.reduce((s, m) => s + (m.scoreA || 0) + (m.scoreB || 0), 0);
        animateCount(statEquipos, torneoData.teams.length);
        animateCount(statPartidos, torneoData.matches.length);
        animateCount(statGoles, totalScore);

        // Section labels
        const secLabel = document.getElementById('sectionEquiposLabel');
        if (secLabel) secLabel.textContent = sport.teamLabel;

        const equipoNameInput = document.getElementById('equipoName');
        if (equipoNameInput) equipoNameInput.placeholder = sport.placeholder;

        const labelLocal = document.getElementById('labelLocal');
        const labelVisit = document.getElementById('labelVisitante');
        if (labelLocal) labelLocal.textContent = sport.localLabel;
        if (labelVisit) labelVisit.textContent  = sport.visitLabel;

        const vsLabel = document.getElementById('vsScoreLabel');
        if (vsLabel) vsLabel.textContent = sport.scoreLabel.slice(0,1) + '-' + sport.scoreLabel.slice(0,1);

        if (isPublic) {
            if (editControls)  editControls.style.display  = 'none';
            if (editControls2) editControls2.style.display = 'none';
            if (shareBar)      shareBar.style.display      = 'none';
        } else {
            mostrarShareBar();
        }

        mostrarEquipos();
        if (!isPublic) actualizarSelects();
        mostrarTabla();
        mostrarEstadisticas();
        mostrarPlayoff();
        mostrarPartidos();
        mostrarActividad();

    } catch (e) {
        console.error(e);
        titulo.textContent = 'Error cargando el torneo';
    }
}

// ── SHARE BAR ──────────────────────────────────────────
function mostrarShareBar() {
    if (!shareBar) return;
    const url = `${window.location.origin}/torneo.html?id=${torneoId}&public=1`;
    const isOn = torneoData.publicShare;
    shareBar.innerHTML = `
        <div class="share-bar-inner">
            <div class="share-info">
                <span class="share-label">🔗 Enlace público</span>
                <span class="share-status ${isOn ? 'active' : ''}">${isOn ? '🟢 Activo' : '⚫ Desactivado'}</span>
            </div>
            <div class="share-actions">
                ${isOn ? `<input class="share-url" value="${url}" readonly id="shareUrlInput">
                <button class="btn-share-copy" id="btnCopy">📋 Copiar</button>` : ''}
                <button class="btn-share-toggle ${isOn ? 'active' : ''}" id="btnToggleShare">
                    ${isOn ? '🔒 Desactivar' : '🌐 Activar enlace'}
                </button>
            </div>
        </div>`;
    document.getElementById('btnToggleShare')?.addEventListener('click', toggleShare);
    document.getElementById('btnCopy')?.addEventListener('click', copiarEnlace);
}

async function toggleShare() {
    const res = await api(`/api/torneos/${torneoId}/share`, { method: 'PUT' });
    if (!res) return;
    const data = await res.json();
    torneoData.publicShare = data.publicShare;
    mostrarShareBar();
}

function copiarEnlace() {
    const input = document.getElementById('shareUrlInput');
    if (!input) return;
    navigator.clipboard.writeText(input.value).then(() => {
        const btn = document.getElementById('btnCopy');
        if (!btn) return;
        const orig = btn.textContent;
        btn.textContent = '✓ Copiado';
        btn.style.background = '#00ff88';
        btn.style.color = '#0a0a0f';
        setTimeout(() => { btn.textContent = orig; btn.style.background = ''; btn.style.color = ''; }, 1500);
    });
}

// ── EQUIPOS ────────────────────────────────────────────
function mostrarEquipos() {
    const sport = getSport();
    if (!equiposList) return;
    if (!torneoData.teams.length) {
        equiposList.innerHTML = `<div class="empty-state" style="padding:24px"><p>No hay ${sport.teamLabel.toLowerCase()} aún. ¡Añade el primero!</p></div>`;
        return;
    }
    equiposList.innerHTML = `<div class="equipos-grid">${torneoData.teams.map(t => {
        const color = getAvatarColor(t.name);
        const pj = t.wins + t.draws + t.losses;
        const nombre = displayName(t.name);
        return `
        <div class="equipo-card">
            <div class="equipo-avatar" style="background:${color}22;border-color:${color}44;color:${color}">${getInitials(t.name)}</div>
            <div class="equipo-card-info">
                <span class="equipo-card-name">${nombre}</span>
                <span class="equipo-card-stats">${pj} PJ · ${t.points} pts</span>
            </div>
            ${!isPublic ? `<button class="btn-danger" onclick="eliminarEquipo('${t._id}')">✕</button>` : ''}
        </div>`;
    }).join('')}</div>`;
}

async function eliminarEquipo(id) {
    const sport = getSport();
    if (!confirm(`¿Eliminar este ${sport.teamSingle.toLowerCase()}?`)) return;
    const res = await api(`/api/torneos/${torneoId}/equipos/${id}`, { method: 'DELETE' });
    if (res && res.ok) cargarTorneo();
}

if (btnEquipo) btnEquipo.addEventListener('click', async () => {
    const nameInput = document.getElementById('equipoName');
    const name = nameInput.value.trim();
    if (!name) return;
    if (!navigator.onLine) return alert('Sin conexión');
    btnEquipo.disabled = true;
    const res = await api(`/api/torneos/${torneoId}/equipos`, {
        method: 'PUT',
        body: JSON.stringify({ name })
    });
    btnEquipo.disabled = false;
    if (!res) return;
    if (!res.ok) { const d = await res.json(); return alert(d.message || 'Error'); }
    nameInput.value = '';
    btnEquipo.textContent = '✓';
    btnEquipo.style.background = '#00ff88';
    setTimeout(() => { btnEquipo.textContent = '+ Añadir'; btnEquipo.style.background = ''; }, 700);
    cargarTorneo();
});

if (document.getElementById('equipoName')) {
    document.getElementById('equipoName').addEventListener('keydown', e => { if (e.key === 'Enter') btnEquipo?.click(); });
}

function actualizarSelects() {
    const selA = document.getElementById('teamA');
    const selB = document.getElementById('teamB');
    if (!selA || !selB) return;
    const opts = torneoData.teams.map(t => `<option value="${escapeHtml(t.name)}">${displayName(t.name)}</option>`).join('');
    selA.innerHTML = opts;
    selB.innerHTML = opts;
    if (torneoData.teams.length > 1) selB.selectedIndex = 1;
}

if (btnPartido) btnPartido.addEventListener('click', async () => {
    const sport = getSport();
    const teamA = document.getElementById('teamA')?.value;
    const teamB = document.getElementById('teamB')?.value;
    const scoreA = parseInt(document.getElementById('scoreA')?.value) || 0;
    const scoreB = parseInt(document.getElementById('scoreB')?.value) || 0;
    if (!teamA || !teamB || teamA === teamB) return alert('Selecciona dos participantes distintos');
    if (!sport.drawAllowed && scoreA === scoreB) return alert(`En ${sport.name} no puede haber empate`);
    if (!navigator.onLine) return alert('Sin conexión');
    btnPartido.disabled = true;
    const res = await api(`/api/torneos/${torneoId}/partidos`, {
        method: 'PUT',
        body: JSON.stringify({ teamA, teamB, scoreA, scoreB })
    });
    btnPartido.disabled = false;
    if (!res) return;
    if (!res.ok) { const d = await res.json(); return alert(d.message || 'Error'); }
    document.getElementById('scoreA').value = 0;
    document.getElementById('scoreB').value = 0;
    btnPartido.textContent = '✓ Guardado';
    btnPartido.style.background = '#00ff88';
    btnPartido.classList.add('flash');
    setTimeout(() => {
        btnPartido.style.background = '';
        btnPartido.classList.remove('flash');
        btnPartido.textContent = 'Guardar Resultado';
    }, 800);
    cargarTorneo();
});

// ── TABLA ──────────────────────────────────────────────
function mostrarTabla() {
    if (!tablaClasif) return;
    const sport = getSport();
    if (!torneoData.teams.length) { tablaClasif.innerHTML = ''; return; }

    const sorted = [...torneoData.teams].sort((a, b) =>
        b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)
    );

    const drawColHead = sport.drawAllowed ? '<th title="Empates">E</th>' : '';
    const drawCellFn  = t => sport.drawAllowed ? `<td>${t.draws}</td>` : '';

    tablaClasif.innerHTML = `
        <div class="section-header" style="margin-top:48px"><h2>${sport.tableLabel}</h2></div>
        <div class="tabla-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th style="text-align:left">${sport.teamSingle}</th>
                        <th title="Partidos Jugados">PJ</th>
                        <th title="Ganados">G</th>
                        ${drawColHead}
                        <th title="Perdidos">P</th>
                        <th title="${sport.scoreLabel} a favor">${sport.scoreColLabel}</th>
                        <th title="${sport.scoreLabel} en contra">${sport.scoreConcedLabel}</th>
                        <th title="Puntos">Pts</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map((t, i) => {
                        const pj = t.wins + t.draws + t.losses;
                        const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
                        const color = getAvatarColor(t.name);
                        return `<tr>
                            <td><span class="rank-num ${rankClass}">${i + 1}</span></td>
                            <td style="text-align:left">
                                <span class="table-avatar" style="background:${color}22;border-color:${color}44;color:${color}">${getInitials(t.name)}</span>
                                ${displayName(t.name)}
                            </td>
                            <td>${pj}</td>
                            <td>${t.wins}</td>
                            ${drawCellFn(t)}
                            <td>${t.losses}</td>
                            <td>${t.goalsFor}</td>
                            <td>${t.goalsAgainst}</td>
                            <td class="pts-cell">${t.points}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>`;
}

// ── ESTADÍSTICAS ───────────────────────────────────────
function mostrarEstadisticas() {
    if (!estadisticasEl) return;
    const sport = getSport();
    if (!torneoData.teams.length) { estadisticasEl.innerHTML = ''; return; }

    const sorted = [...torneoData.teams].sort((a, b) => b.goalsFor - a.goalsFor).slice(0, 6);

    estadisticasEl.innerHTML = `
        <div class="section-header" style="margin-top:48px"><h2>Estadísticas</h2></div>
        <div class="stats-grid">
            <div class="chart-card chart-card--bars">
                <div class="chart-title">${sport.scoreLabel} por ${sport.teamSingle}</div>
                <canvas id="chartBars" height="200"></canvas>
            </div>
            <div class="stats-right-col">
                <div class="chart-card chart-card--half">
                    <div class="chart-title">Distribución</div>
                    <div class="pie-wrap"><canvas id="chartPie"></canvas></div>
                </div>
                <div class="chart-card chart-card--half">
                    <div class="chart-title">Últimos 5 resultados</div>
                    <div class="racha-list">
                        ${sorted.map(t => {
                            const history = torneoData.matches
                                .filter(m => m.round === 'league' && (m.teamA === t.name || m.teamB === t.name))
                                .slice(-5).map(m => {
                                    const isA = m.teamA === t.name;
                                    const s = isA ? m.scoreA : m.scoreB;
                                    const o = isA ? m.scoreB : m.scoreA;
                                    if (s > o) return '<span class="racha-w">G</span>';
                                    if (s < o) return '<span class="racha-l">P</span>';
                                    return '<span class="racha-d">E</span>';
                                }).join('');
                            return `<div class="racha-item">
                                <span class="racha-nombre">${displayName(t.name)}</span>
                                <div class="racha-iconos">${history || '<span style="color:var(--text-muted);font-size:12px">—</span>'}</div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>
        </div>`;

    if (chartBars) { chartBars.destroy(); chartBars = null; }
    if (chartPie)  { chartPie.destroy();  chartPie  = null; }

    const barsCtx = document.getElementById('chartBars').getContext('2d');
    const barGradient = barsCtx.createLinearGradient(0, 0, 0, 200);
    barGradient.addColorStop(0, 'rgba(232,255,0,0.9)');
    barGradient.addColorStop(1, 'rgba(232,255,0,0.2)');

    chartBars = new Chart(barsCtx, {
        type: 'bar',
        data: {
            labels: sorted.map(t => displayName(t.name)),
            datasets: [{
                label: sport.scoreLabel,
                data: sorted.map(t => t.goalsFor),
                backgroundColor: barGradient,
                borderColor: 'rgba(232,255,0,0.9)',
                borderWidth: 1, borderRadius: 7,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true, animation: { duration: 900, easing: 'easeOutQuart' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(10,10,15,0.95)',
                    borderColor: 'rgba(232,255,0,0.3)',
                    borderWidth: 1,
                    titleColor: '#e8ff00',
                    bodyColor: '#888899',
                    padding: 10,
                    cornerRadius: 8
                }
            },
            scales: {
                x: {
                    ticks: { color: '#666680', font: { family: 'Barlow', size: 11 } },
                    grid: { display: false },
                    border: { color: 'rgba(255,255,255,0.05)' }
                },
                y: {
                    ticks: { color: '#666680', font: { family: 'Barlow', size: 11 } },
                    grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                    border: { display: false },
                    beginAtZero: true
                }
            }
        }
    });

    const totalV = torneoData.teams.reduce((s, t) => s + t.wins,  0);
    const totalE = torneoData.teams.reduce((s, t) => s + t.draws, 0);
    const totalD = torneoData.teams.reduce((s, t) => s + t.losses, 0);
    const pieLabels = sport.drawAllowed ? ['Victorias', 'Empates', 'Derrotas'] : ['Victorias', 'Derrotas'];
    const pieData   = sport.drawAllowed ? [totalV, totalE, totalD]             : [totalV, totalD];
    const pieColors = sport.drawAllowed
        ? ['rgba(232,255,0,0.88)', 'rgba(136,153,255,0.75)', 'rgba(255,68,68,0.75)']
        : ['rgba(232,255,0,0.88)', 'rgba(255,68,68,0.75)'];
    const pieBorders = sport.drawAllowed
        ? ['rgba(232,255,0,0.5)', 'rgba(136,153,255,0.5)', 'rgba(255,68,68,0.5)']
        : ['rgba(232,255,0,0.5)', 'rgba(255,68,68,0.5)'];

    chartPie = new Chart(document.getElementById('chartPie').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: pieLabels,
            datasets: [{
                data: pieData,
                backgroundColor: pieColors,
                borderColor: pieBorders,
                borderWidth: 2,
                hoverOffset: 10,
                hoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            animation: { duration: 900, easing: 'easeOutQuart' },
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#888899',
                        font: { family: 'Barlow', size: 11 },
                        padding: 12,
                        usePointStyle: true,
                        pointStyleWidth: 8
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10,10,15,0.95)',
                    borderColor: 'rgba(232,255,0,0.3)',
                    borderWidth: 1,
                    titleColor: '#e8ff00',
                    bodyColor: '#888899',
                    padding: 10,
                    cornerRadius: 8
                }
            }
        }
    });
}

// ── PLAYOFF ────────────────────────────────────────────
function mostrarPlayoff() {
    if (!playoffEl) return;
    const hasTeams  = torneoData.teams.length >= 2;
    const hasPlayoff = torneoData.playoff && torneoData.playoff.length > 0;
    if (!hasTeams) { playoffEl.innerHTML = ''; return; }

    const roundLabels = { QF1:'C. de final 1', QF2:'C. de final 2', QF3:'C. de final 3', QF4:'C. de final 4', SF1:'Semifinal 1', SF2:'Semifinal 2', F:'Final' };

    if (!hasPlayoff) {
        playoffEl.innerHTML = `
            <div class="section-header" style="margin-top:48px"><h2>Playoff</h2></div>
            <div class="playoff-empty">
                <p>Genera el cuadro de eliminatorias basado en la clasificación actual.</p>
                ${!isPublic ? `<button class="btn-primary" onclick="generarPlayoff()">⚡ Generar Playoff</button>` : ''}
            </div>`;
        return;
    }

    const matchHTML = m => {
        const winA = m.played && m.scoreA > m.scoreB;
        const winB = m.played && m.scoreB > m.scoreA;
        const colorA = getAvatarColor(m.teamA);
        const colorB = getAvatarColor(m.teamB);
        const isPending = !m.teamA || !m.teamB;
        return `
        <div class="playoff-match ${m.played ? 'played' : ''} ${isPending ? 'pending' : ''}">
            <div class="playoff-round-label">${roundLabels[m.round] || m.round}</div>
            <div class="playoff-team ${winA ? 'winner' : ''}">
                ${m.teamA ? `<span class="mini-avatar" style="background:${colorA}22;border-color:${colorA}44;color:${colorA}">${getInitials(m.teamA)}</span>` : '<span class="mini-avatar-empty"></span>'}
                <span class="playoff-team-name">${m.teamA ? displayName(m.teamA) : '— Por definir —'}</span>
                ${m.played ? `<span class="playoff-score ${winA ? 'score-win' : ''}">${m.scoreA}</span>` : ''}
            </div>
            <div class="playoff-team ${winB ? 'winner' : ''}">
                ${m.teamB ? `<span class="mini-avatar" style="background:${colorB}22;border-color:${colorB}44;color:${colorB}">${getInitials(m.teamB)}</span>` : '<span class="mini-avatar-empty"></span>'}
                <span class="playoff-team-name">${m.teamB ? displayName(m.teamB) : '— Por definir —'}</span>
                ${m.played ? `<span class="playoff-score ${winB ? 'score-win' : ''}">${m.scoreB}</span>` : ''}
            </div>
            ${!isPublic && !m.played && m.teamA && m.teamB ? `
            <div class="playoff-input-row">
                <input type="number" id="pA_${m.round}" min="0" value="0" class="score-input playoff-score-input">
                <span class="vs-sep">—</span>
                <input type="number" id="pB_${m.round}" min="0" value="0" class="score-input playoff-score-input">
                <button class="btn-primary btn-sm" onclick="guardarPlayoff('${m.round}')">Guardar</button>
            </div>` : ''}
            ${m.round === 'F' && m.played ? `<div class="campeon-banner">🏆 ${displayName(m.scoreA > m.scoreB ? m.teamA : m.teamB)}</div>` : ''}
        </div>`;
    };

    const qfs   = torneoData.playoff.filter(m => m.round.startsWith('QF'));
    const sfs   = torneoData.playoff.filter(m => m.round.startsWith('SF'));
    const final = torneoData.playoff.find(m => m.round === 'F');

    let bracketHTML = '<div class="playoff-bracket">';
    if (qfs.length)  bracketHTML += `<div class="playoff-col"><div class="playoff-col-title">Cuartos</div>${qfs.map(matchHTML).join('')}</div>`;
    if (sfs.length)  bracketHTML += `<div class="playoff-col"><div class="playoff-col-title">Semifinales</div>${sfs.map(matchHTML).join('')}</div>`;
    if (final)       bracketHTML += `<div class="playoff-col"><div class="playoff-col-title">Final</div>${matchHTML(final)}</div>`;
    bracketHTML += '</div>';

    playoffEl.innerHTML = `
        <div class="section-header" style="margin-top:48px"><h2>Playoff</h2></div>
        ${bracketHTML}
        ${!isPublic ? `<div style="margin-top:16px;text-align:center"><button class="btn-danger" onclick="resetPlayoff()">Reiniciar playoff</button></div>` : ''}`;
}

async function generarPlayoff() {
    const res = await api(`/api/torneos/${torneoId}/playoff/generar`, { method: 'POST' });
    if (res && res.ok) cargarTorneo();
}

async function guardarPlayoff(round) {
    const scoreA = parseInt(document.getElementById(`pA_${round}`)?.value) || 0;
    const scoreB = parseInt(document.getElementById(`pB_${round}`)?.value) || 0;
    if (scoreA === scoreB) return alert('No puede haber empate en playoff');
    const res = await api(`/api/torneos/${torneoId}/playoff/${round}`, {
        method: 'PUT',
        body: JSON.stringify({ scoreA, scoreB })
    });
    if (res && res.ok) cargarTorneo();
}

async function resetPlayoff() {
    if (!confirm('¿Reiniciar el playoff? Se perderán todos los resultados.')) return;
    const res = await api(`/api/torneos/${torneoId}/playoff`, { method: 'DELETE' });
    if (res && res.ok) cargarTorneo();
}

// ── PARTIDOS ───────────────────────────────────────────
function mostrarPartidos() {
    if (!partidosEl) return;
    const sport = getSport();
    if (!torneoData.matches.length) { partidosEl.innerHTML = ''; return; }

    const items = [...torneoData.matches].reverse().map(m => {
        const winA   = m.scoreA > m.scoreB;
        const winB   = m.scoreB > m.scoreA;
        const colorA = getAvatarColor(m.teamA);
        const colorB = getAvatarColor(m.teamB);
        return `
        <div class="marcador-card">
            <div class="marcador-team ${winA ? 'winner' : ''}">
                <div class="marcador-avatar" style="background:${colorA}22;border-color:${colorA}55;color:${colorA}">${getInitials(m.teamA)}</div>
                <span class="marcador-name">${displayName(m.teamA)}</span>
            </div>
            <div class="marcador-score-block">
                <div class="marcador-score">
                    <span class="${winA ? 'score-win' : ''}">${m.scoreA}</span>
                    <span class="score-sep">:</span>
                    <span class="${winB ? 'score-win' : ''}">${m.scoreB}</span>
                </div>
                <div class="marcador-label">${sport.finLabel}</div>
            </div>
            <div class="marcador-team right ${winB ? 'winner' : ''}">
                <div class="marcador-avatar" style="background:${colorB}22;border-color:${colorB}55;color:${colorB}">${getInitials(m.teamB)}</div>
                <span class="marcador-name">${displayName(m.teamB)}</span>
            </div>
            ${!isPublic ? `<button class="btn-danger marcador-del" onclick="eliminarPartido('${m._id}')">✕</button>` : ''}
        </div>`;
    }).join('');

    partidosEl.innerHTML = `
        <div class="section-header" style="margin-top:48px"><h2>Partidos</h2></div>
        <div class="marcadores-list">${items}</div>`;
}

async function eliminarPartido(id) {
    if (!confirm('¿Eliminar este partido?')) return;
    const res = await api(`/api/torneos/${torneoId}/partidos/${id}`, { method: 'DELETE' });
    if (res && res.ok) cargarTorneo();
}

// ── ACTIVIDAD ──────────────────────────────────────────
function mostrarActividad() {
    if (!activityEl) return;
    if (!torneoData.activity || !torneoData.activity.length) { activityEl.innerHTML = ''; return; }
    const items = torneoData.activity.slice(0, 12).map(a => {
        const d = new Date(a.date);
        const hora = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
        const dia  = d.toLocaleDateString('es', { day: '2-digit', month: 'short' });
        const canUndo = !isPublic && a.undoRef && (a.undoRef.type === 'match' || a.undoRef.type === 'team');
        return `<div class="activity-item" id="act-${a._id}">
            <div class="activity-left">
                <span class="activity-dot ${a.undoRef ? 'dot-undoable' : ''}"></span>
                <span class="activity-text">${escapeHtml(a.text)}</span>
            </div>
            <div class="activity-right">
                <span class="activity-time">${dia} ${hora}</span>
                ${canUndo ? `<button class="btn-undo" onclick="deshacerActividad('${a._id}')">↩ Deshacer</button>` : ''}
            </div>
        </div>`;
    }).join('');
    activityEl.innerHTML = `
        <div class="section-header" style="margin-top:48px"><h2>Actividad Reciente</h2></div>
        <div class="activity-list">${items}</div>`;
}

async function deshacerActividad(activityId) {
    const el = document.getElementById(`act-${activityId}`);
    if (el) { el.style.opacity = '0.4'; el.style.pointerEvents = 'none'; }
    try {
        const res = await api(`/api/torneos/${torneoId}/activity/${activityId}`, { method: 'DELETE' });
        if (!res) return;
        const data = await res.json();
        if (data.undone) {
            // Show a toast
            mostrarToast('↩ Acción deshecha correctamente');
        }
        cargarTorneo();
    } catch {
        if (el) { el.style.opacity = ''; el.style.pointerEvents = ''; }
        alert('Error al deshacer');
    }
}

function mostrarToast(msg, tipo = 'success') {
    let toast = document.getElementById('appToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'appToast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = `app-toast ${tipo}`;
    toast.style.display = 'block';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.style.display = 'none'; }, 2800);
}

// ── INIT ───────────────────────────────────────────────
if (!torneoId) {
    window.location.href = '/';
} else if (isPublic) {
    cargarTorneo();
} else if (!token) {
    window.location.href = '/';
} else {
    cargarTorneo();
}
