const BASE_URL = '';

const params = new URLSearchParams(window.location.search);
const torneoId = params.get('id');

const titulo = document.getElementById('torneoTitulo');
const statEquipos = document.getElementById('statEquipos');
const statPartidos = document.getElementById('statPartidos');
const equiposList = document.getElementById('equiposList');
const tablaClasificacion = document.getElementById('tablaClasificacion');
const estadisticasSection = document.getElementById('estadisticasSection');
const partidosSection = document.getElementById('partidosSection');
const btnEquipo = document.getElementById('btnEquipo');
const btnPartido = document.getElementById('btnPartido');

let torneoData = null;
let chartBars = null;
let chartPie = null;

function animateCount(el, target, duration = 600) {
    const startTime = performance.now();
    function update(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * ease);
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

async function cargarTorneo() {
    try {
        const res = await fetch(`${BASE_URL}/api/torneos/id/${torneoId}`);
        if (!res.ok) throw new Error();
        torneoData = await res.json();
        titulo.textContent = torneoData.name;
        document.title = `${torneoData.name} — TorneoApp`;
        animateCount(statEquipos, torneoData.teams.length);
        animateCount(statPartidos, torneoData.matches.length);
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
    equiposList.innerHTML = torneoData.teams.map(t => `
        <div class="equipo-item">
            <span class="equipo-item-name">${t.name}</span>
            <button class="btn-danger" onclick="eliminarEquipo('${t._id}')">Eliminar</button>
        </div>
    `).join('');
}

async function eliminarEquipo(id) {
    if (!confirm('¿Eliminar este equipo?')) return;
    try {
        const res = await fetch(`${BASE_URL}/api/torneos/${torneoId}/equipos/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
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
        btnEquipo.textContent = '✓';
        btnEquipo.style.background = '#00ff88';
        setTimeout(() => { btnEquipo.style.background = ''; btnEquipo.textContent = 'Añadir'; }, 700);
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
        return `<tr>
            <td><span class="rank-num ${rankClass}">${i + 1}</span>${t.name}</td>
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
    if (!torneoData.teams.length || !torneoData.matches.length) {
        estadisticasSection.innerHTML = '';
        return;
    }
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
        return `
            <div class="racha-item">
                <span class="racha-nombre">${t.name}</span>
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
    const gf = equipos.map(t => t.goalsFor);
    const gc = equipos.map(t => t.goalsAgainst);

    chartBars = new Chart(document.getElementById('chartBars').getContext('2d'), {
        type: 'bar',
        data: {
            labels: nombres,
            datasets: [
                { label: 'Goles a favor', data: gf, backgroundColor: 'rgba(232,255,0,0.8)', borderRadius: 6, borderSkipped: false },
                { label: 'Goles en contra', data: gc, backgroundColor: 'rgba(255,59,59,0.6)', borderRadius: 6, borderSkipped: false }
            ]
        },
        options: {
            responsive: true,
            animation: { duration: 800, easing: 'easeOutQuart' },
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
            datasets: [{
                data: [totalV, totalE, totalD],
                backgroundColor: ['rgba(232,255,0,0.85)', 'rgba(100,120,255,0.7)', 'rgba(255,59,59,0.7)'],
                borderColor: '#0a0a0f', borderWidth: 3, hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            animation: { duration: 800, easing: 'easeOutQuart' },
            cutout: '60%',
            plugins: { legend: { position: 'bottom', labels: { color: '#888899', font: { family: 'Barlow', size: 12 }, padding: 16 } } }
        }
    });
}

function mostrarPartidos() {
    if (!torneoData.matches.length) { partidosSection.innerHTML = ''; return; }
    const items = [...torneoData.matches].reverse().map(m => `
        <div class="partido-item">
            <div class="partido-teams">
                <span class="partido-team">${m.teamA}</span>
                <span class="partido-score">${m.scoreA} — ${m.scoreB}</span>
                <span class="partido-team away">${m.teamB}</span>
            </div>
            <button class="btn-danger" onclick="eliminarPartido('${m._id}')">✕</button>
        </div>
    `).join('');
    partidosSection.innerHTML = `
        <div class="section-header" style="margin-top:48px"><h2>Partidos</h2></div>
        <div class="partidos-list">${items}</div>`;
}

async function eliminarPartido(id) {
    if (!confirm('¿Eliminar este partido?')) return;
    try {
        const res = await fetch(`${BASE_URL}/api/torneos/${torneoId}/partidos/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        cargarTorneo();
    } catch { alert('Error eliminando partido'); }
}

cargarTorneo();
