const BASE_URL = '';

const params = new URLSearchParams(window.location.search);
const torneoId = params.get('id');

const titulo = document.getElementById('torneoTitulo');
const statEquipos = document.getElementById('statEquipos');
const statPartidos = document.getElementById('statPartidos');
const statGoles = document.getElementById('statGoles');
const equiposList = document.getElementById('equiposList');
const tablaClasificacion = document.getElementById('tablaClasificacion');
const estadisticasSection = document.getElementById('estadisticasSection');
const partidosSection = document.getElementById('partidosSection');
const btnEquipo = document.getElementById('btnEquipo');
const btnPartido = document.getElementById('btnPartido');
const banner = document.getElementById('torneoBanner');

let torneoData = null;
let chartBars = null;
let chartPie = null;

const BANNER_COLORS = [
    ['#1a0533', '#6b21a8'],
    ['#0a1628', '#1e40af'],
    ['#0d2818', '#15803d'],
    ['#2d1000', '#c2410c'],
    ['#1a0a00', '#b45309'],
    ['#1a0022', '#9333ea'],
    ['#001a1a', '#0f766e'],
    ['#1a0010', '#be185d'],
];

function getBannerColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return BANNER_COLORS[Math.abs(hash) % BANNER_COLORS.length];
}

function animateCount(el, target, duration = 700) {
    const startTime = performance.now();
    function update(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * ease);
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

function getInitials(name) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getAvatarColor(name) {
    const colors = ['#e8ff00','#ff6b35','#a78bfa','#34d399','#60a5fa','#f472b6','#fbbf24','#f87171'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

async function cargarTorneo() {
    try {
        const res = await fetch(`${BASE_URL}/api/torneos/id/${torneoId}`);
        if (!res.ok) throw new Error();
        torneoData = await res.json();

        titulo.textContent = torneoData.name;
        document.title = `${torneoData.name} — TorneoApp`;

        const [bg, accent] = getBannerColor(torneoData.name);
        banner.style.background = `linear-gradient(135deg, ${bg} 0%, ${accent}44 100%)`;
        banner.style.borderBottom = `1px solid ${accent}33`;

        const totalGoles = torneoData.matches.reduce((s, m) => s + m.scoreA + m.scoreB, 0);
        animateCount(statEquipos, torneoData.teams.length);
        animateCount(statPartidos, torneoData.matches.length);
        animateCount(statGoles, totalGoles);

        mostrarEquipos();
        actualizarSelects();
        mostrarTabla();
        mostrarEstadisticas();
        mostrarPartidos();
    } catch {
        titulo.textContent = 'Error cargando torneo';
    }
}

function mostrarEquipos() {
    if (!torneoData.teams.length) {
        equiposList.innerHTML = '<div class="empty-state" style="padding:24px"><p>No hay equipos aún</p></div>';
        return;
    }
    equiposList.innerHTML = `<div class="equipos-grid">${torneoData.teams.map(t => {
        const color = getAvatarColor(t.name);
        const initials = getInitials(t.name);
        const pj = t.wins + t.draws + t.losses;
        return `
        <div class="equipo-card">
            <div class="equipo-avatar" style="background:${color}22; border-color:${color}44; color:${color}">${initials}</div>
            <div class="equipo-card-info">
                <span class="equipo-card-name">${t.name}</span>
                <span class="equipo-card-stats">${pj} PJ · ${t.points} pts</span>
            </div>
            <button class="btn-danger" onclick="eliminarEquipo('${t._id}')">✕</button>
        </div>`;
    }).join('')}</div>`;
}

async function eliminarEquipo(id) {
    if (!confirm('¿Eliminar este equipo?')) return;
    try {
        await fetch(`${BASE_URL}/api/torneos/${torneoId}/equipos/${id}`, { method: 'DELETE' });
        cargarTorneo();
    } catch { alert('Error eliminando equipo'); }
}

btnEquipo.addEventListener('click', async () => {
    const nameInput = document.getElementById('equipoName');
    const name = nameInput.value.trim();
    if (!name) return;
    btnEquipo.disabled = true;
    try {
        const res = await fetch(`${BASE_URL}/api/torneos/${torneoId}/equipos`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (!res.ok) throw new Error();
        nameInput.value = '';
        btnEquipo.textContent = '✓ Añadido';
        btnEquipo.style.background = '#00ff88';
        setTimeout(() => { btnEquipo.style.background = ''; btnEquipo.textContent = '+ Añadir Equipo'; }, 700);
        cargarTorneo();
    } catch { alert('Error añadiendo equipo'); }
    finally { btnEquipo.disabled = false; }
});

document.getElementById('equipoName').addEventListener('keydown', e => { if (e.key === 'Enter') btnEquipo.click(); });

btnPartido.addEventListener('click', async () => {
    const teamA = document.getElementById('teamA').value;
    const teamB = document.getElementById('teamB').value;
    const scoreA = parseInt(document.getElementById('scoreA').value) || 0;
    const scoreB = parseInt(document.getElementById('scoreB').value) || 0;
    if (teamA === teamB) return alert('Elige equipos diferentes');
    btnPartido.disabled = true;
    btnPartido.textContent = '...';
    try {
        const res = await fetch(`${BASE_URL}/api/torneos/${torneoId}/partidos`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teamA, teamB, scoreA, scoreB })
        });
        if (!res.ok) throw new Error();
        document.getElementById('scoreA').value = 0;
        document.getElementById('scoreB').value = 0;
        btnPartido.textContent = '✓ Guardado';
        btnPartido.style.background = '#00ff88';
        setTimeout(() => { btnPartido.style.background = ''; btnPartido.textContent = 'Guardar Resultado'; }, 800);
        cargarTorneo();
    } catch { alert('Error añadiendo partido'); }
    finally { btnPartido.disabled = false; }
});

function actualizarSelects() {
    const a = document.getElementById('teamA');
    const b = document.getElementById('teamB');
    const opts = torneoData.teams.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
    a.innerHTML = opts;
    b.innerHTML = opts;
    if (torneoData.teams.length > 1) b.selectedIndex = 1;
}

function mostrarTabla() {
    if (!torneoData.teams.length) { tablaClasificacion.innerHTML = ''; return; }
    const equipos = [...torneoData.teams].sort((a, b) =>
        b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)
    );
    const filas = equipos.map((t, i) => {
        const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
        const color = getAvatarColor(t.name);
        const initials = getInitials(t.name);
        return `<tr>
            <td>
                <div style="display:flex;align-items:center;gap:10px">
                    <span class="rank-num ${rankClass}">${i + 1}</span>
                    <span class="mini-avatar" style="background:${color}22;border-color:${color}44;color:${color}">${initials}</span>
                    ${t.name}
                </div>
            </td>
            <td class="pts-cell">${t.points}</td>
            <td>${t.wins + t.draws + t.losses}</td>
            <td>${t.wins}</td><td>${t.draws}</td><td>${t.losses}</td>
            <td>${t.goalsFor}</td><td>${t.goalsAgainst}</td>
            <td>${t.goalsFor - t.goalsAgainst > 0 ? '+' : ''}${t.goalsFor - t.goalsAgainst}</td>
        </tr>`;
    }).join('');
    tablaClasificacion.innerHTML = `
        <div class="section-header" style="margin-top:48px"><h2>Clasificación</h2></div>
        <div class="tabla-wrapper">
            <div class="tabla-title">Tabla General</div>
            <table>
                <thead><tr>
                    <th>Equipo</th><th>Pts</th><th>PJ</th>
                    <th>PG</th><th>PE</th><th>PP</th>
                    <th>GF</th><th>GC</th><th>DG</th>
                </tr></thead>
                <tbody>${filas}</tbody>
            </table>
        </div>`;
}

function mostrarEstadisticas() {
    if (!torneoData.teams.length || !torneoData.matches.length) { estadisticasSection.innerHTML = ''; return; }
    const equipos = [...torneoData.teams].sort((a, b) =>
        b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)
    );
    const rachaHTML = equipos.map(t => {
        const partidos = torneoData.matches.filter(m => m.teamA === t.name || m.teamB === t.name).slice(-5);
        const iconos = partidos.map(m => {
            const esA = m.teamA === t.name;
            const gF = esA ? m.scoreA : m.scoreB;
            const gC = esA ? m.scoreB : m.scoreA;
            if (gF > gC) return '<span class="racha-w">V</span>';
            if (gF < gC) return '<span class="racha-l">D</span>';
            return '<span class="racha-d">E</span>';
        }).join('');
        const color = getAvatarColor(t.name);
        const initials = getInitials(t.name);
        return `
            <div class="racha-item">
                <div style="display:flex;align-items:center;gap:10px;min-width:0">
                    <span class="mini-avatar" style="background:${color}22;border-color:${color}44;color:${color};flex-shrink:0">${initials}</span>
                    <span class="racha-nombre">${t.name}</span>
                </div>
                <div class="racha-iconos">${iconos || '<span style="color:var(--text-muted);font-size:12px">Sin partidos</span>'}</div>
            </div>`;
    }).join('');

    estadisticasSection.innerHTML = `
        <div class="section-header" style="margin-top:48px"><h2>Estadísticas</h2></div>
        <div class="stats-grid">
            <div class="chart-card">
                <div class="chart-title">Goles por Equipo</div>
                <canvas id="chartBars" height="220"></canvas>
            </div>
            <div class="chart-card">
                <div class="chart-title">Resultados Globales</div>
                <canvas id="chartPie" height="220"></canvas>
            </div>
        </div>
        <div class="chart-card" style="margin-top:12px">
            <div class="chart-title">Racha — Últimos 5 partidos</div>
            <div class="racha-list">${rachaHTML}</div>
        </div>`;

    if (chartBars) { chartBars.destroy(); chartBars = null; }
    if (chartPie) { chartPie.destroy(); chartPie = null; }

    const nombres = equipos.map(t => t.name);
    chartBars = new Chart(document.getElementById('chartBars').getContext('2d'), {
        type: 'bar',
        data: {
            labels: nombres,
            datasets: [
                { label: 'Goles a favor', data: equipos.map(t => t.goalsFor), backgroundColor: 'rgba(232,255,0,0.8)', borderRadius: 6, borderSkipped: false },
                { label: 'Goles en contra', data: equipos.map(t => t.goalsAgainst), backgroundColor: 'rgba(255,59,59,0.6)', borderRadius: 6, borderSkipped: false }
            ]
        },
        options: {
            responsive: true, animation: { duration: 800, easing: 'easeOutQuart' },
            plugins: { legend: { labels: { color: '#888899', font: { family: 'Barlow', size: 12 } } } },
            scales: {
                x: { ticks: { color: '#888899', font: { family: 'Barlow' } }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#888899', font: { family: 'Barlow' } }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
            }
        }
    });

    const totalV = torneoData.teams.reduce((s, t) => s + t.wins, 0);
    const totalE = torneoData.teams.reduce((s, t) => s + t.draws, 0);
    const totalD = torneoData.teams.reduce((s, t) => s + t.losses, 0);
    chartPie = new Chart(document.getElementById('chartPie').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Victorias', 'Empates', 'Derrotas'],
            datasets: [{ data: [totalV, totalE, totalD], backgroundColor: ['rgba(232,255,0,0.85)', 'rgba(100,120,255,0.7)', 'rgba(255,59,59,0.7)'], borderColor: '#0a0a0f', borderWidth: 3, hoverOffset: 8 }]
        },
        options: {
            responsive: true, animation: { duration: 800, easing: 'easeOutQuart' }, cutout: '60%',
            plugins: { legend: { position: 'bottom', labels: { color: '#888899', font: { family: 'Barlow', size: 12 }, padding: 16 } } }
        }
    });
}

function mostrarPartidos() {
    if (!torneoData.matches.length) { partidosSection.innerHTML = ''; return; }
    const items = [...torneoData.matches].reverse().map(m => {
        const winA = m.scoreA > m.scoreB;
        const winB = m.scoreB > m.scoreA;
        const colorA = getAvatarColor(m.teamA);
        const colorB = getAvatarColor(m.teamB);
        return `
        <div class="marcador-card">
            <div class="marcador-team ${winA ? 'winner' : ''}">
                <div class="marcador-avatar" style="background:${colorA}22;border-color:${colorA}55;color:${colorA}">${getInitials(m.teamA)}</div>
                <span class="marcador-name">${m.teamA}</span>
            </div>
            <div class="marcador-score-block">
                <div class="marcador-score">
                    <span class="${winA ? 'score-win' : ''}">${m.scoreA}</span>
                    <span class="score-sep">:</span>
                    <span class="${winB ? 'score-win' : ''}">${m.scoreB}</span>
                </div>
                <div class="marcador-label">FIN</div>
            </div>
            <div class="marcador-team right ${winB ? 'winner' : ''}">
                <div class="marcador-avatar" style="background:${colorB}22;border-color:${colorB}55;color:${colorB}">${getInitials(m.teamB)}</div>
                <span class="marcador-name">${m.teamB}</span>
            </div>
            <button class="btn-danger marcador-del" onclick="eliminarPartido('${m._id}')">✕</button>
        </div>`;
    }).join('');
    partidosSection.innerHTML = `
        <div class="section-header" style="margin-top:48px"><h2>Partidos</h2></div>
        <div class="marcadores-list">${items}</div>`;
}

async function eliminarPartido(id) {
    if (!confirm('¿Eliminar este partido?')) return;
    try {
        await fetch(`${BASE_URL}/api/torneos/${torneoId}/partidos/${id}`, { method: 'DELETE' });
        cargarTorneo();
    } catch { alert('Error eliminando partido'); }
}

cargarTorneo();
