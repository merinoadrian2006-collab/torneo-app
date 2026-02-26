const BASE_URL = '';

let sessionId = localStorage.getItem('torneoapp_session');

const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');
const userBadge = document.getElementById('userBadge');
const loginInput = document.getElementById('loginInput');
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');

function mostrarLogin() {
    loginScreen.style.display = 'flex';
    appScreen.style.display = 'none';
    userBadge.textContent = '';
}

function mostrarApp() {
    loginScreen.style.display = 'none';
    appScreen.style.display = 'block';
    userBadge.textContent = '👤 ' + sessionId;
    cargarTorneos();
}

if (sessionId) { mostrarApp(); } else { mostrarLogin(); }

btnLogin.addEventListener('click', () => {
    const val = loginInput.value.trim().toLowerCase().replace(/\s+/g, '_');
    if (!val) return;
    btnLogin.textContent = '✓';
    btnLogin.style.background = '#00ff88';
    setTimeout(() => {
        sessionId = val;
        localStorage.setItem('torneoapp_session', sessionId);
        mostrarApp();
        btnLogin.textContent = 'Entrar';
        btnLogin.style.background = '';
    }, 400);
});

loginInput.addEventListener('keydown', e => { if (e.key === 'Enter') btnLogin.click(); });

btnLogout.addEventListener('click', () => {
    if (!confirm('¿Cerrar sesión? Podrás volver a entrar con tu código.')) return;
    localStorage.removeItem('torneoapp_session');
    sessionId = null;
    mostrarLogin();
    loginInput.value = '';
});

const torneosList = document.getElementById('torneosList');
const torneoNameInput = document.getElementById('torneoName');
const btnCrear = document.getElementById('btnCrear');

btnCrear.addEventListener('click', async () => {
    const name = torneoNameInput.value.trim();
    if (!name) return;
    btnCrear.textContent = '...';
    btnCrear.disabled = true;
    try {
        const res = await fetch(`${BASE_URL}/api/torneos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, sessionId })
        });
        if (!res.ok) throw new Error();
        torneoNameInput.value = '';
        btnCrear.textContent = '✓ Creado';
        btnCrear.style.background = '#00ff88';
        btnCrear.classList.add('flash');
        setTimeout(() => {
            btnCrear.style.background = '';
            btnCrear.classList.remove('flash');
            btnCrear.textContent = 'Crear Torneo';
        }, 800);
        cargarTorneos();
    } catch {
        alert('Error creando torneo');
        btnCrear.textContent = 'Crear Torneo';
    } finally {
        btnCrear.disabled = false;
    }
});

torneoNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') btnCrear.click(); });

async function cargarTorneos() {
    torneosList.innerHTML = '<div class="empty-state"><span class="empty-icon">⏳</span><p>Cargando...</p></div>';
    try {
        const res = await fetch(`${BASE_URL}/api/torneos/${sessionId}`);
        if (!res.ok) throw new Error();
        const torneos = await res.json();
        if (torneos.length === 0) {
            torneosList.innerHTML = '<div class="empty-state"><span class="empty-icon">🏟️</span><p>No tienes torneos aún. ¡Crea el primero!</p></div>';
            return;
        }
        torneosList.innerHTML = torneos.map(t => `
            <div class="torneo-card" onclick="window.location.href='torneo.html?id=${t._id}'">
                <div class="torneo-card-info">
                    <div class="torneo-card-name">${t.name}</div>
                    <div class="torneo-card-meta">${t.teams.length} equipos · ${t.matches.length} partidos</div>
                </div>
                <div class="torneo-card-actions">
                    <button class="btn-danger" onclick="eliminarTorneo(event, '${t._id}', '${t.name}')">Eliminar</button>
                    <span class="torneo-card-arrow">›</span>
                </div>
            </div>
        `).join('');
    } catch {
        torneosList.innerHTML = '<div class="empty-state"><p>Error cargando torneos</p></div>';
    }
}

async function eliminarTorneo(e, id, name) {
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    try {
        await fetch(`${BASE_URL}/api/torneos/${id}`, { method: 'DELETE' });
        cargarTorneos();
    } catch { alert('Error eliminando torneo'); }
}

cargarTorneos();
