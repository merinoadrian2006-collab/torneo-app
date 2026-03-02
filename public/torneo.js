const BASE_URL = '';
const params = new URLSearchParams(window.location.search);
const torneoId = params.get('id');
const isPublic = params.get('public') === '1';

// ── DOM refs ───────────────────────────────────────────
const titulo       = document.getElementById('torneoTitulo');
const leaderCard   = document.getElementById('leaderCard');
const equiposList  = document.getElementById('equiposList');
const tablaClasif  = document.getElementById('tablaClasificacion');
const estadisticasEl = document.getElementById('estadisticasSection');
const partidosEl   = document.getElementById('partidosSection');
const playoffEl    = document.getElementById('playoffSection');
const btnEquipo    = document.getElementById('btnEquipo');
const btnPartido   = document.getElementById('btnPartido');
const shareBar     = document.getElementById('shareBar');
const editControls  = document.getElementById('editControls');
const editControls2 = document.getElementById('editControls2');

let torneoData = null;
let chartBars  = null;
let chartPie   = null;

// ── Config ─────────────────────────────────────────────
const CONFIG = {
    scoreLabel:      'Puntos',
    teamLabel:       'Participantes',
    teamSingle:      'Participante',
    drawAllowed:     true,
    placeholder:     'Nombre del participante...',
    localLabel:      'Local',
    visitLabel:      'Visitante',
    tableLabel:      'Clasificación',
    scoreColLabel:   'PF',
    scoreConcedLabel:'PC',
    finLabel:        'FIN',
};

// ── Auth ───────────────────────────────────────────────
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
        .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'")
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function displayName(str) {
    return String(str || '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'");
}
function animateCount(el, target, duration = 700) {
    if (!el) return;
    const startTime = performance.now();
    function update(now) {
        const p = Math.min((now - startTime) / duration, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(update);
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

// ── Event delegation — replaces ALL inline onclick ─────
// Every button uses data-action="xxx" + data-id / data-round
// One listener on the whole page handles everything.
document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;
    const id     = btn.dataset.id;
    const round  = btn.dataset.round;

    if (action === 'eliminarEquipo') {
        if (!confirm(`¿Eliminar este ${CONFIG.teamSingle.toLowerCase()}?`)) return;
        btn.disabled = true;
        const res = await api(`/api/torneos/${torneoId}/equipos/${id}`, { method: 'DELETE' });
        if (res && res.ok) cargarTorneo(); else btn.disabled = false;
    }
    if (action === 'eliminarPartido') {
        if (!confirm('¿Eliminar este partido?')) return;
        btn.disabled = true;
        const res = await api(`/api/torneos/${torneoId}/partidos/${id}`, { method: 'DELETE' });
        if (res && res.ok) cargarTorneo(); else btn.disabled = false;
    }
    if (action === 'generarPlayoff') {
        btn.disabled = true; btn.textContent = '⏳ Generando...';
        const res = await api(`/api/torneos/${torneoId}/playoff/generar`, { method: 'POST' });
        if (res && res.ok) cargarTorneo();
        else { btn.disabled = false; btn.textContent = '⚡ Generar Playoff'; }
    }
    if (action === 'resetPlayoff') {
        if (!confirm('¿Reiniciar el playoff? Se perderán todos los resultados.')) return;
        btn.disabled = true;
        const res = await api(`/api/torneos/${torneoId}/playoff`, { method: 'DELETE' });
        if (res && res.ok) cargarTorneo(); else btn.disabled = false;
    }
    if (action === 'guardarPlayoff') {
        const scoreA = parseInt(document.getElementById(`pA_${round}`)?.value) || 0;
        const scoreB = parseInt(document.getElementById(`pB_${round}`)?.value) || 0;
        if (scoreA === scoreB) return alert('No puede haber empate en playoff');
        btn.disabled = true; btn.textContent = '⏳';
        const res = await api(`/api/torneos/${torneoId}/playoff/${round}`, {
            method: 'PUT', body: JSON.stringify({ scoreA, scoreB })
        });
        if (res && res.ok) cargarTorneo();
        else { btn.disabled = false; btn.textContent = 'Guardar'; }
    }
});

// ── LEADER CARD ────────────────────────────────────────
function mostrarLeader() {
    if (!leaderCard) return;
    if (!torneoData.teams.length) { leaderCard.innerHTML = ''; leaderCard.style.display = 'none'; return; }
    const sorted = [...torneoData.teams].sort((a, b) =>
        b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)
    );
    const leader = sorted[0];
    const color  = getAvatarColor(leader.name);
    const pj     = leader.wins + leader.draws + leader.losses;
    const finalMatch = torneoData.playoff?.find(m => m.round === 'F' && m.played);
    const champion   = finalMatch ? (finalMatch.scoreA > finalMatch.scoreB ? finalMatch.teamA : finalMatch.teamB) : null;

    if (champion) {
        const cc = getAvatarColor(champion);
        leaderCard.innerHTML = `
            <div class="leader-card champion-card">
                <div class="leader-crown">🏆</div>
                <div class="leader-avatar" style="background:${cc}22;border-color:${cc};color:${cc}">${getInitials(champion)}</div>
                <div class="leader-info">
                    <span class="leader-label">🥇 Campeón del torneo</span>
                    <span class="leader-name">${displayName(champion)}</span>
                </div>
            </div>`;
    } else if (pj > 0) {
        leaderCard.innerHTML = `
            <div class="leader-card">
                <div class="leader-crown">👑</div>
                <div class="leader-avatar" style="background:${color}22;border-color:${color};color:${color}">${getInitials(leader.name)}</div>
                <div class="leader-info">
                    <span class="leader-label">🔝 Líder actual</span>
                    <span class="leader-name">${displayName(leader.name)}</span>
                </div>
                <div class="leader-stats">
                    <div class="leader-stat"><span class="leader-stat-num">${leader.points}</span><span class="leader-stat-lbl">pts</span></div>
                    <div class="leader-stat"><span class="leader-stat-num">${leader.wins}</span><span class="leader-stat-lbl">vict</span></div>
                    <div class="leader-stat"><span class="leader-stat-num">${pj}</span><span class="leader-stat-lbl">PJ</span></div>
                </div>
            </div>`;
    } else {
        leaderCard.innerHTML = ''; leaderCard.style.display = 'none'; return;
    }
    leaderCard.style.display = 'block';
}

// ── LOAD TORNEO ────────────────────────────────────────
async function cargarTorneo() {
    try {
        const url = isPublic ? `/api/public/${torneoId}` : `/api/torneos/${torneoId}`;
        const res = await api(url);
        if (!res) return;
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            if (titulo) titulo.textContent = err.message || 'Torneo no encontrado';
            return;
        }
        torneoData = await res.json();

        if (titulo) titulo.textContent = displayName(torneoData.name);
        document.title = `${displayName(torneoData.name)} — TorneoApp`;

        const secLabel = document.getElementById('sectionEquiposLabel');
        if (secLabel) secLabel.textContent = CONFIG.teamLabel;
        const equipoNameInput = document.getElementById('equipoName');
        if (equipoNameInput) equipoNameInput.placeholder = CONFIG.placeholder;
        const labelLocal = document.getElementById('labelLocal');
        const labelVisit = document.getElementById('labelVisitante');
        if (labelLocal) labelLocal.textContent = CONFIG.localLabel;
        if (labelVisit) labelVisit.textContent  = CONFIG.visitLabel;

        const statEquipos  = document.getElementById('statEquipos');
        const statPartidos = document.getElementById('statPartidos');
        const statGoles    = document.getElementById('statGoles');
        const totalScore   = torneoData.matches.reduce((s, m) => s + (m.scoreA||0) + (m.scoreB||0), 0);
        animateCount(statEquipos,  torneoData.teams.length);
        animateCount(statPartidos, torneoData.matches.length);
        animateCount(statGoles,    totalScore);

        if (isPublic) {
            if (editControls)  editControls.style.display  = 'none';
            if (editControls2) editControls2.style.display = 'none';
            if (shareBar)      shareBar.style.display      = 'none';
        } else {
            mostrarShareBar();
        }

        mostrarLeader();
        mostrarEquipos();
        if (!isPublic) actualizarSelects();
        mostrarTabla();
        mostrarEstadisticas();
        mostrarPlayoff();
        mostrarPartidos();

    } catch (e) {
        console.error(e);
        if (titulo) titulo.textContent = 'Error cargando el torneo';
    }
}

// ── SHARE BAR ──────────────────────────────────────────
function mostrarShareBar() {
    if (!shareBar) return;
    const url = `${window.location.origin}/torneo.html?id=${torneoId}&public=1`;
    const isActive = torneoData.publicShare;
    shareBar.innerHTML = `
        <div class="share-bar-inner">
            <div class="share-info">
                <div class="share-label-group">
                    <span class="share-icon">🔗</span>
                    <span class="share-label">Enlace público</span>
                </div>
                <span class="share-status ${isActive ? 'active' : ''}">${isActive ? '🟢 Activo' : '⚫ Desactivado'}</span>
            </div>
            <div class="share-actions">
                <div class="share-url-wrap ${!isActive ? 'share-disabled' : ''}">
                    <input class="share-url" value="${escapeHtml(url)}" readonly id="shareUrlInput" ${!isActive ? 'disabled' : ''}>
                    <button class="btn-share-copy" id="btnCopy" ${!isActive ? 'disabled' : ''}>📋 Copiar</button>
                </div>
                <button class="btn-share-toggle ${isActive ? 'active' : ''}" id="btnToggleShare">
                    ${isActive ? '🔓 Desactivar' : '🌐 Activar acceso público'}
                </button>
            </div>
        </div>`;

    document.getElementById('btnCopy')?.addEventListener('click', () => {
        const input = document.getElementById('shareUrlInput');
        if (!input || !isActive) return;
        navigator.clipboard.writeText(input.value).then(() => {
            const btn = document.getElementById('btnCopy');
            if (!btn) return;
            btn.textContent = '✓ Copiado';
            btn.classList.add('copied');
            setTimeout(() => { btn.textContent = '📋 Copiar'; btn.classList.remove('copied'); }, 2000);
        }).catch(() => { input.select(); document.execCommand('copy'); });
    });

    document.getElementById('btnToggleShare')?.addEventListener('click', async () => {
        const btn = document.getElementById('btnToggleShare');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ ...'; }
        try {
            const res = await api(`/api/torneos/${torneoId}/share`, { method: 'PUT' });
            if (!res) return;
            if (!res.ok) { const err = await res.json().catch(()=>({})); alert(err.message || 'Error'); return; }
            const data = await res.json();
            torneoData.publicShare = data.publicShare;
            mostrarShareBar();
        } catch { alert('Error de conexión'); }
        finally { if (btn) btn.disabled = false; }
    });
}

// ── EQUIPOS ────────────────────────────────────────────
function mostrarEquipos() {
    if (!equiposList) return;
    if (!torneoData.teams.length) {
        equiposList.innerHTML = `<div class="empty-state" style="padding:24px"><span class="empty-icon">👥</span><p>No hay ${CONFIG.teamLabel.toLowerCase()} aún. ¡Añade el primero!</p></div>`;
        return;
    }
    const sortedTeams = [...torneoData.teams].sort((a,b) =>
        b.points - a.points || (b.goalsFor-b.goalsAgainst) - (a.goalsFor-a.goalsAgainst)
    );
    equiposList.innerHTML = `<div class="equipos-grid">${sortedTeams.map((t, i) => {
        const color  = getAvatarColor(t.name);
        const pj     = t.wins + t.draws + t.losses;
        const nombre = displayName(t.name);
        const medal  = ['🥇','🥈','🥉'][i] || '';
        return `
        <div class="equipo-card" style="animation-delay:${i*0.04}s">
            <div class="equipo-avatar" style="background:${color}22;border-color:${color}44;color:${color}">${getInitials(t.name)}</div>
            <div class="equipo-card-info">
                <span class="equipo-card-name">${medal} ${nombre}</span>
                <span class="equipo-card-stats">${pj} PJ · ${t.points} pts · ${t.wins}V ${t.draws}E ${t.losses}D</span>
            </div>
            ${!isPublic ? `<button class="btn-danger" data-action="eliminarEquipo" data-id="${t._id}" title="Eliminar">✕</button>` : ''}
        </div>`;
    }).join('')}</div>`;
}

if (btnEquipo) btnEquipo.addEventListener('click', async () => {
    const nameInput = document.getElementById('equipoName');
    const name = nameInput?.value.trim();
    if (!name) return;
    if (!navigator.onLine) return alert('Sin conexión');
    btnEquipo.disabled = true;
    const res = await api(`/api/torneos/${torneoId}/equipos`, { method: 'PUT', body: JSON.stringify({ name }) });
    btnEquipo.disabled = false;
    if (!res) return;
    if (!res.ok) { const d = await res.json(); return alert(d.message || 'Error'); }
    if (nameInput) nameInput.value = '';
    btnEquipo.textContent = '✓';
    btnEquipo.style.background = '#00ff88';
    setTimeout(() => { btnEquipo.textContent = '+ Añadir'; btnEquipo.style.background = ''; }, 700);
    cargarTorneo();
});

document.getElementById('equipoName')?.addEventListener('keydown', e => { if (e.key === 'Enter') btnEquipo?.click(); });

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
    const teamA  = document.getElementById('teamA')?.value;
    const teamB  = document.getElementById('teamB')?.value;
    const scoreA = parseInt(document.getElementById('scoreA')?.value) || 0;
    const scoreB = parseInt(document.getElementById('scoreB')?.value) || 0;
    if (!teamA || !teamB || teamA === teamB) return alert('Selecciona dos participantes distintos');
    if (!navigator.onLine) return alert('Sin conexión');
    btnPartido.disabled = true;
    const res = await api(`/api/torneos/${torneoId}/partidos`, {
        method: 'PUT', body: JSON.stringify({ teamA, teamB, scoreA, scoreB })
    });
    btnPartido.disabled = false;
    if (!res) return;
    if (!res.ok) { const d = await res.json(); return alert(d.message || 'Error'); }
    const sA = document.getElementById('scoreA'); if (sA) sA.value = 0;
    const sB = document.getElementById('scoreB'); if (sB) sB.value = 0;
    btnPartido.textContent = '✓ Guardado';
    btnPartido.style.background = '#00ff88';
    btnPartido.classList.add('flash');
    setTimeout(() => { btnPartido.style.background = ''; btnPartido.classList.remove('flash'); btnPartido.textContent = 'Guardar Resultado'; }, 800);
    cargarTorneo();
});

// ── TABLA ──────────────────────────────────────────────
function mostrarTabla() {
    if (!tablaClasif) return;
    if (!torneoData.teams.length) { tablaClasif.innerHTML = ''; return; }

    const sorted = [...torneoData.teams].sort((a, b) =>
        b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)
    );
    const rankEmoji = i => ['🥇','🥈','🥉'][i] || (i+1);

    tablaClasif.innerHTML = `
        <div class="section-header" style="margin-top:48px"><h2>${CONFIG.tableLabel}</h2></div>
        <div class="tabla-wrapper">
            <table>
                <thead>
                    <tr>
                        <th class="col-rank">#</th>
                        <th class="col-name" style="text-align:left">${CONFIG.teamSingle}</th>
                        <th class="col-num" title="Partidos Jugados">PJ</th>
                        <th class="col-num" title="Ganados">G</th>
                        <th class="col-num" title="Empates">E</th>
                        <th class="col-num" title="Perdidos">P</th>
                        <th class="col-num col-hide-xs" title="${CONFIG.scoreLabel} a favor">${CONFIG.scoreColLabel}</th>
                        <th class="col-num col-hide-xs" title="${CONFIG.scoreLabel} en contra">${CONFIG.scoreConcedLabel}</th>
                        <th class="col-num col-pts" title="Puntos">Pts</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map((t, i) => {
                        const pj = t.wins + t.draws + t.losses;
                        const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
                        const color = getAvatarColor(t.name);
                        return `<tr>
                            <td class="col-rank"><span class="rank-num ${rankClass}">${rankEmoji(i)}</span></td>
                            <td class="col-name" style="text-align:left">
                                <span class="table-avatar" style="background:${color}22;border-color:${color}44;color:${color}">${getInitials(t.name)}</span>
                                <span class="team-name-cell">${displayName(t.name)}</span>
                            </td>
                            <td class="col-num">${pj}</td>
                            <td class="col-num">${t.wins}</td>
                            <td class="col-num">${t.draws}</td>
                            <td class="col-num">${t.losses}</td>
                            <td class="col-num col-hide-xs">${t.goalsFor}</td>
                            <td class="col-num col-hide-xs">${t.goalsAgainst}</td>
                            <td class="col-num col-pts pts-cell">${t.points}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>`;
}

// ── ESTADÍSTICAS ───────────────────────────────────────
function mostrarEstadisticas() {
    if (!estadisticasEl) return;
    if (!torneoData.teams.length) { estadisticasEl.innerHTML = ''; return; }

    const sorted = [...torneoData.teams].sort((a,b) => b.goalsFor - a.goalsFor).slice(0,6);
    const totalV = torneoData.teams.reduce((s,t) => s+t.wins,  0);
    const totalE = torneoData.teams.reduce((s,t) => s+t.draws, 0);
    const totalD = torneoData.teams.reduce((s,t) => s+t.losses,0);

    const rachaHTML = sorted.map(t => {
        const history = torneoData.matches
            .filter(m => m.round==='league' && (m.teamA===t.name||m.teamB===t.name))
            .slice(-5).map(m => {
                const isA = m.teamA===t.name;
                const s = isA?m.scoreA:m.scoreB, o = isA?m.scoreB:m.scoreA;
                if (s>o) return '<span class="racha-w">G</span>';
                if (s<o) return '<span class="racha-l">P</span>';
                return '<span class="racha-d">E</span>';
            }).join('');
        return `<div class="racha-item">
            <span class="racha-nombre">${displayName(t.name)}</span>
            <div class="racha-iconos">${history||'<span style="color:var(--text-muted);font-size:12px">—</span>'}</div>
        </div>`;
    }).join('');

    estadisticasEl.innerHTML = `
        <div class="section-header" style="margin-top:48px"><h2>📊 Estadísticas</h2></div>
        <div class="stats-grid">
            <div class="chart-card chart-card--tall">
                <div class="chart-title">⚡ ${CONFIG.scoreLabel} por ${CONFIG.teamSingle}</div>
                <canvas id="chartBars" height="200"></canvas>
            </div>
            <div class="chart-card stats-right-col">
                <div class="chart-card--half">
                    <div class="chart-title">🎯 Distribución</div>
                    <div class="pie-wrap"><canvas id="chartPie"></canvas></div>
                </div>
                <div class="chart-card--half" style="border-top:1px solid var(--border);padding-top:16px;margin-top:0">
                    <div class="chart-title">📈 Últimos resultados</div>
                    <div class="racha-list">${rachaHTML}</div>
                </div>
            </div>
        </div>`;

    if (chartBars) { chartBars.destroy(); chartBars = null; }
    if (chartPie)  { chartPie.destroy();  chartPie  = null; }

    const palette = [
        {bg:'rgba(232,255,0,0.75)',  border:'#e8ff00'},
        {bg:'rgba(0,212,255,0.75)', border:'#00d4ff'},
        {bg:'rgba(180,80,255,0.75)',border:'#b450ff'},
        {bg:'rgba(255,80,140,0.75)',border:'#ff508c'},
        {bg:'rgba(0,255,160,0.75)', border:'#00ffa0'},
        {bg:'rgba(255,160,0,0.75)', border:'#ffa000'},
    ];

    chartBars = new Chart(document.getElementById('chartBars').getContext('2d'), {
        type:'bar',
        data:{ labels:sorted.map(t=>displayName(t.name)), datasets:[{ label:CONFIG.scoreLabel,
            data:sorted.map(t=>t.goalsFor),
            backgroundColor:sorted.map((_,i)=>palette[i%palette.length].bg),
            borderColor:sorted.map((_,i)=>palette[i%palette.length].border),
            borderWidth:1, borderRadius:7, borderSkipped:false }] },
        options:{ responsive:true, animation:{duration:900,easing:'easeOutQuart'},
            plugins:{ legend:{display:false}, tooltip:{backgroundColor:'#18181f',borderColor:'rgba(255,255,255,0.1)',borderWidth:1,titleColor:'#e8ff00',bodyColor:'#f0f0f0',padding:10} },
            scales:{ x:{ticks:{color:'#888899',font:{family:'Barlow',size:11}},grid:{color:'rgba(255,255,255,0.04)'}},
                     y:{ticks:{color:'#888899',font:{family:'Barlow',size:11}},grid:{color:'rgba(255,255,255,0.04)'},beginAtZero:true} } }
    });

    chartPie = new Chart(document.getElementById('chartPie').getContext('2d'), {
        type:'doughnut',
        data:{ labels:['Victorias','Empates','Derrotas'], datasets:[{ data:[totalV,totalE,totalD],
            backgroundColor:['#e8ff00','#00d4ff','#ff3366'], borderColor:'#111118', borderWidth:3, hoverOffset:6,
            hoverBorderColor:['#b8cc00','#009ab8','#cc0044'] }] },
        options:{ responsive:true, animation:{duration:900,easing:'easeOutQuart'}, cutout:'68%',
            plugins:{ legend:{position:'bottom',labels:{color:'#888899',font:{family:'Barlow',size:11},padding:12,boxWidth:10,boxHeight:10,usePointStyle:true,pointStyle:'circle'}},
                tooltip:{backgroundColor:'#18181f',borderColor:'rgba(255,255,255,0.1)',borderWidth:1,titleColor:'#e8ff00',bodyColor:'#f0f0f0',padding:10} } }
    });
}

// ── PLAYOFF ────────────────────────────────────────────
function mostrarPlayoff() {
    if (!playoffEl) return;
    if (torneoData.teams.length < 2) { playoffEl.innerHTML = ''; return; }

    const roundLabels = { QF1:'⚔️ C.Final 1', QF2:'⚔️ C.Final 2', QF3:'⚔️ C.Final 3', QF4:'⚔️ C.Final 4', SF1:'🔥 Semifinal 1', SF2:'🔥 Semifinal 2', F:'🏆 Final' };

    if (!torneoData.playoff?.length) {
        playoffEl.innerHTML = `
            <div class="section-header" style="margin-top:48px"><h2>🏆 Playoff</h2></div>
            <div class="playoff-empty">
                <div class="playoff-empty-icon">🎯</div>
                <p>Genera el cuadro de eliminatorias basado en la clasificación actual.</p>
                ${!isPublic ? `<button class="btn-primary" data-action="generarPlayoff">⚡ Generar Playoff</button>` : ''}
            </div>`;
        return;
    }

    const matchHTML = m => {
        const winA = m.played && m.scoreA > m.scoreB;
        const winB = m.played && m.scoreB > m.scoreA;
        const cA = getAvatarColor(m.teamA), cB = getAvatarColor(m.teamB);
        return `
        <div class="playoff-match ${m.played?'played':''} ${(!m.teamA||!m.teamB)?'pending':''}">
            <div class="playoff-round-label">${roundLabels[m.round]||m.round}</div>
            <div class="playoff-team ${winA?'winner':''}">
                ${m.teamA?`<span class="mini-avatar" style="background:${cA}22;border-color:${cA}44;color:${cA}">${getInitials(m.teamA)}</span>`:'<span class="mini-avatar-empty"></span>'}
                <span class="playoff-team-name">${m.teamA?displayName(m.teamA):'— Por definir —'}</span>
                ${m.played?`<span class="playoff-score ${winA?'score-win':''}">${m.scoreA}</span>`:''}
                ${winA?'<span class="winner-badge">✓</span>':''}
            </div>
            <div class="playoff-team ${winB?'winner':''}">
                ${m.teamB?`<span class="mini-avatar" style="background:${cB}22;border-color:${cB}44;color:${cB}">${getInitials(m.teamB)}</span>`:'<span class="mini-avatar-empty"></span>'}
                <span class="playoff-team-name">${m.teamB?displayName(m.teamB):'— Por definir —'}</span>
                ${m.played?`<span class="playoff-score ${winB?'score-win':''}">${m.scoreB}</span>`:''}
                ${winB?'<span class="winner-badge">✓</span>':''}
            </div>
            ${!isPublic&&!m.played&&m.teamA&&m.teamB?`
            <div class="playoff-input-row">
                <input type="number" id="pA_${m.round}" min="0" value="0" class="score-input playoff-score-input">
                <span class="vs-sep">—</span>
                <input type="number" id="pB_${m.round}" min="0" value="0" class="score-input playoff-score-input">
                <button class="btn-primary btn-sm" data-action="guardarPlayoff" data-round="${m.round}">Guardar</button>
            </div>`:''}
            ${m.round==='F'&&m.played?`<div class="campeon-banner">🏆 ${displayName(m.scoreA>m.scoreB?m.teamA:m.teamB)}</div>`:''}
        </div>`;
    };

    const qfs   = torneoData.playoff.filter(m=>m.round.startsWith('QF'));
    const sfs   = torneoData.playoff.filter(m=>m.round.startsWith('SF'));
    const final = torneoData.playoff.find(m=>m.round==='F');

    let html = '<div class="playoff-bracket">';
    if (qfs.length) html += `<div class="playoff-col"><div class="playoff-col-title">⚔️ Cuartos</div>${qfs.map(matchHTML).join('')}</div>`;
    if (sfs.length) html += `<div class="playoff-col"><div class="playoff-col-title">🔥 Semis</div>${sfs.map(matchHTML).join('')}</div>`;
    if (final)      html += `<div class="playoff-col"><div class="playoff-col-title">🏆 Final</div>${matchHTML(final)}</div>`;
    html += '</div>';

    playoffEl.innerHTML = `
        <div class="section-header" style="margin-top:48px"><h2>🏆 Playoff</h2></div>
        ${html}
        ${!isPublic?`<div style="margin-top:16px;text-align:center"><button class="btn-danger" data-action="resetPlayoff">🔄 Reiniciar playoff</button></div>`:''}`;

    mostrarLeader();
}

// ── PARTIDOS ───────────────────────────────────────────
function mostrarPartidos() {
    if (!partidosEl) return;
    if (!torneoData.matches.length) { partidosEl.innerHTML = ''; return; }

    const items = [...torneoData.matches].reverse().map((m, i) => {
        const winA = m.scoreA > m.scoreB, winB = m.scoreB > m.scoreA;
        const cA = getAvatarColor(m.teamA), cB = getAvatarColor(m.teamB);
        const emoji = m.scoreA===m.scoreB ? '🤝' : winA ? '⚡' : '🔄';
        return `
        <div class="marcador-card" style="animation-delay:${i*0.03}s">
            <div class="marcador-team ${winA?'winner':''}">
                <div class="marcador-avatar" style="background:${cA}22;border-color:${cA}55;color:${cA}">${getInitials(m.teamA)}</div>
                <span class="marcador-name">${displayName(m.teamA)}</span>
            </div>
            <div class="marcador-score-block">
                <div class="marcador-result-emoji">${emoji}</div>
                <div class="marcador-score">
                    <span class="${winA?'score-win':''}">${m.scoreA}</span>
                    <span class="score-sep">:</span>
                    <span class="${winB?'score-win':''}">${m.scoreB}</span>
                </div>
                <div class="marcador-label">${CONFIG.finLabel}</div>
            </div>
            <div class="marcador-team right ${winB?'winner':''}">
                <div class="marcador-avatar" style="background:${cB}22;border-color:${cB}55;color:${cB}">${getInitials(m.teamB)}</div>
                <span class="marcador-name">${displayName(m.teamB)}</span>
            </div>
            ${!isPublic?`<button class="btn-danger marcador-del" data-action="eliminarPartido" data-id="${m._id}" title="Eliminar">✕</button>`:''}
        </div>`;
    }).join('');

    partidosEl.innerHTML = `
        <div class="section-header" style="margin-top:48px"><h2>⚽ Partidos</h2></div>
        <div class="marcadores-list">${items}</div>`;
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
