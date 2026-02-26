const BASE_URL = '';

const params = new URLSearchParams(window.location.search);
const torneoId = params.get('id');

const titulo = document.getElementById('torneoTitulo');
const statEquipos = document.getElementById('statEquipos');
const statPartidos = document.getElementById('statPartidos');
const equiposList = document.getElementById('equiposList');
const tablaClasificacion = document.getElementById('tablaClasificacion');
const partidosSection = document.getElementById('partidosSection');
const btnEquipo = document.getElementById('btnEquipo');
const btnPartido = document.getElementById('btnPartido');

let torneoData = null;

async function cargarTorneo() {
    try {
        const res = await fetch(`${BASE_URL}/api/torneos/id/${torneoId}`);
        if (!res.ok) throw new Error();
        torneoData = await res.json();
        titulo.textContent = torneoData.name;
        document.title = `${torneoData.name} — TorneoApp`;
        statEquipos.textContent = torneoData.teams.length;
        statPartidos.textContent = torneoData.matches.length;
        mostrarEquipos();
        actualizarSelects();
        mostrarTabla();
        mostrarPartidos();
    } catch { titulo.textContent = 'Error cargando torneo'; }
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
    try {
        const res = await fetch(`${BASE_URL}/api/torneos/${torneoId}/partidos`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teamA, teamB, scoreA, scoreB })
        });
        if (!res.ok) throw new Error();
        document.getElementById('scoreA').value = 0;
        document.getElementById('scoreB').value = 0;
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
