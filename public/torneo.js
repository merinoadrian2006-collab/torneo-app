const BASE_URL = '';  // Vacío = usa el mismo dominio (funciona en local y en Railway)

const params = new URLSearchParams(window.location.search);
const torneoId = params.get('id');

const titulo = document.getElementById('torneoTitulo');
const equipoForm = document.getElementById('equipoForm');
const equiposList = document.getElementById('equiposList');
const partidoForm = document.getElementById('partidoForm');
const tablaClasificacion = document.getElementById('tablaClasificacion');

let torneoData = null;

// Cargar torneo
async function cargarTorneo() {
    try {
        const res = await fetch(`${BASE_URL}/api/torneos/id/${torneoId}`);
        if (!res.ok) throw new Error('Error cargando torneo');
        torneoData = await res.json();

        titulo.textContent = torneoData.name;
        mostrarEquipos();
        mostrarTabla();
        actualizarSelects();
    } catch (error) {
        console.error(error);
        tablaClasificacion.innerHTML = '<p>Error cargando torneo</p>';
    }
}

// Mostrar equipos
function mostrarEquipos() {
    if (!torneoData.teams.length) {
        equiposList.innerHTML = '<p>No hay equipos aún</p>';
        return;
    }

    equiposList.innerHTML = torneoData.teams.map(t => `
        <div class="equipo-item">
            ${t.name}
            <button class="small-btn" onclick="eliminarEquipo('${t._id}')">Eliminar</button>
        </div>
    `).join('');
}

// Eliminar equipo
async function eliminarEquipo(equipoId) {
    if (!confirm('¿Seguro que quieres eliminar este equipo?')) return;
    try {
        const res = await fetch(`${BASE_URL}/api/torneos/${torneoId}/equipos/${equipoId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Error eliminando equipo');
        cargarTorneo();
    } catch (error) {
        console.error(error);
        alert('Error eliminando equipo');
    }
}

// Añadir equipo
equipoForm.addEventListener('submit', async e => {
    e.preventDefault();
    const nameInput = document.getElementById('equipoName');
    const name = nameInput.value.trim();
    if (!name) return alert('Escribe un nombre válido');

    try {
        const res = await fetch(`${BASE_URL}/api/torneos/${torneoId}/equipos`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (!res.ok) throw new Error('Error añadiendo equipo');

        nameInput.value = '';
        cargarTorneo();
    } catch (error) {
        console.error(error);
        alert('Error añadiendo equipo');
    }
});

// Añadir partido
partidoForm.addEventListener('submit', async e => {
    e.preventDefault();
    const teamA = document.getElementById('teamA').value;
    const teamB = document.getElementById('teamB').value;
    const scoreA = parseInt(document.getElementById('scoreA').value);
    const scoreB = parseInt(document.getElementById('scoreB').value);

    if (teamA === teamB) return alert('Elige equipos diferentes');

    try {
        const res = await fetch(`${BASE_URL}/api/torneos/${torneoId}/partidos`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teamA, teamB, scoreA, scoreB })
        });
        if (!res.ok) throw new Error('Error añadiendo partido');

        document.getElementById('scoreA').value = 0;
        document.getElementById('scoreB').value = 0;
        cargarTorneo();
    } catch (error) {
        console.error(error);
        alert('Error añadiendo partido');
    }
});

// Actualizar selects de equipos para partidos
function actualizarSelects() {
    const teamASelect = document.getElementById('teamA');
    const teamBSelect = document.getElementById('teamB');
    if (torneoData.teams.length === 0) {
        teamASelect.innerHTML = teamBSelect.innerHTML = '';
        return;
    }
    teamASelect.innerHTML = torneoData.teams.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
    teamBSelect.innerHTML = torneoData.teams.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
}

// Mostrar tabla y partidos
function mostrarTabla() {
    if (!torneoData.teams.length) {
        tablaClasificacion.innerHTML = '';
        return;
    }

    const equiposOrdenados = [...torneoData.teams].sort((a, b) =>
        b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)
    );

    let html = "<h3>Tabla de Clasificación</h3>";
    html += "<table><tr><th>Equipo</th><th>Pts</th><th>GF</th><th>GC</th><th>PG</th><th>PE</th><th>PP</th></tr>";

    equiposOrdenados.forEach(t => {
        html += `<tr>
            <td>${t.name}</td>
            <td>${t.points}</td>
            <td>${t.goalsFor}</td>
            <td>${t.goalsAgainst}</td>
            <td>${t.wins}</td>
            <td>${t.draws}</td>
            <td>${t.losses}</td>
        </tr>`;
    });
    html += "</table>";

    if (torneoData.matches.length) {
        html += "<h3>Partidos</h3>";
        html += torneoData.matches.map(m => `
            <div class="partido-item">
                <span>${m.teamA} ${m.scoreA} - ${m.scoreB} ${m.teamB}</span>
                <button class="small-btn" onclick="eliminarPartido('${m._id}')">Eliminar</button>
            </div>
        `).join('');
    }

    tablaClasificacion.innerHTML = html;
}

// Eliminar partido
async function eliminarPartido(matchId) {
    if (!confirm('¿Seguro que quieres eliminar este partido?')) return;
    try {
        const res = await fetch(`${BASE_URL}/api/torneos/${torneoId}/partidos/${matchId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Error eliminando partido');
        cargarTorneo();
    } catch (error) {
        console.error(error);
        alert('Error eliminando partido');
    }
}

// Inicializar
cargarTorneo();
