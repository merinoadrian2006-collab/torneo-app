const BASE_URL = '';

// ── Migrate from old session system ───────────────────
// Old system stored only 'torneoapp_session' without a token.
// New system requires a JWT token. Force re-login if token missing.
const oldSession = localStorage.getItem('torneoapp_session');
const existingToken = localStorage.getItem('torneoapp_token');
if (oldSession && !existingToken) {
    // Has old session but no JWT — clear and force re-login
    localStorage.removeItem('torneoapp_session');
}

// ── Auth state ─────────────────────────────────────────
let token = localStorage.getItem('torneoapp_token');
let sessionId = localStorage.getItem('torneoapp_session');
let currentPage = 1;

const loginScreen  = document.getElementById('loginScreen');
const appScreen    = document.getElementById('appScreen');
const userBadge    = document.getElementById('userBadge');
const loginInput   = document.getElementById('loginInput');
const btnLogin     = document.getElementById('btnLogin');
const btnLogout    = document.getElementById('btnLogout');
const loginError   = document.getElementById('loginError');
const offlineBanner = document.getElementById('offlineBanner');

// ── Offline detection ──────────────────────────────────
window.addEventListener('online',  () => { if(offlineBanner) offlineBanner.style.display = 'none'; });
window.addEventListener('offline', () => { if(offlineBanner) offlineBanner.style.display = 'block'; });
if (!navigator.onLine && offlineBanner) offlineBanner.style.display = 'block';

// ── API helper — injects JWT + handles 401 ─────────────
async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    if (res.status === 401) { logout(true); return null; }
    return res;
}

// ── Session init ───────────────────────────────────────
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

// Verify existing token on load
(async () => {
    if (token) {
        const res = await api('/api/auth/verify');
        if (res && res.ok) {
            const data = await res.json();
            sessionId = data.sessionId;
            localStorage.setItem('torneoapp_session', sessionId);
            mostrarApp();
        } else {
            clearAuth();
            mostrarLogin();
        }
    } else {
        mostrarLogin();
    }
})();

function clearAuth() {
    token = null; sessionId = null;
    localStorage.removeItem('torneoapp_token');
    localStorage.removeItem('torneoapp_session');
}

function showLoginError(msg) {
    if (!loginError) return;
    loginError.textContent = msg;
    loginError.style.display = 'block';
    setTimeout(() => { loginError.style.display = 'none'; }, 4000);
}

btnLogin.addEventListener('click', async () => {
    const val = loginInput.value.trim();
    if (!val) return;
    if (val.length < 3) return showLoginError('Mínimo 3 caracteres');
    btnLogin.textContent = '...';
    btnLogin.disabled = true;
    try {
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: val })
        });
        const data = await res.json();
        if (!res.ok) { showLoginError(data.message || 'Error'); return; }
        token = data.token;
        sessionId = data.sessionId;
        localStorage.setItem('torneoapp_token', token);
        localStorage.setItem('torneoapp_session', sessionId);
        btnLogin.textContent = '✓';
        btnLogin.style.background = '#00ff88';
        setTimeout(() => {
            mostrarApp();
            btnLogin.textContent = 'Entrar';
            btnLogin.style.background = '';
        }, 400);
    } catch {
        showLoginError('Sin conexión con el servidor');
        btnLogin.textContent = 'Entrar';
    } finally {
        btnLogin.disabled = false;
    }
});

loginInput.addEventListener('keydown', e => { if (e.key === 'Enter') btnLogin.click(); });

function logout(auto = false) {
    if (!auto && !confirm('¿Cerrar sesión? Podrás volver a entrar con tu código.')) return;
    clearAuth();
    mostrarLogin();
    loginInput.value = '';
}

btnLogout.addEventListener('click', () => logout(false));

// ── Torneos list (paginated) ───────────────────────────
const torneosList  = document.getElementById('torneosList');
const paginacion   = document.getElementById('paginacion');
const torneoNameInput = document.getElementById('torneoName');
const btnCrear     = document.getElementById('btnCrear');

btnCrear.addEventListener('click', async () => {
    const name = torneoNameInput.value.trim();
    if (!name) return;
    if (!navigator.onLine) return alert('Sin conexión. Comprueba tu internet.');
    btnCrear.textContent = '...';
    btnCrear.disabled = true;
    try {
        const res = await api('/api/torneos', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
        if (!res) return;
        if (!res.ok) { const d = await res.json(); alert(d.message || 'Error'); return; }
        torneoNameInput.value = '';
        btnCrear.textContent = '✓ Creado';
        btnCrear.style.background = '#00ff88';
        btnCrear.classList.add('flash');
        setTimeout(() => {
            btnCrear.style.background = '';
            btnCrear.classList.remove('flash');
            btnCrear.textContent = 'Crear Torneo';
        }, 800);
        currentPage = 1;
        cargarTorneos();
    } catch {
        alert('Error creando torneo');
        btnCrear.textContent = 'Crear Torneo';
    } finally {
        btnCrear.disabled = false;
    }
});

torneoNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') btnCrear.click(); });

async function cargarTorneos(page = currentPage) {
    torneosList.innerHTML = '<div class="empty-state"><span class="empty-icon">⏳</span><p>Cargando...</p></div>';
    try {
        const res = await api(`/api/torneos?page=${page}&limit=10`);
        if (!res) return;
        if (!res.ok) throw new Error();
        const { torneos, total, pages } = await res.json();

        if (torneos.length === 0 && page === 1) {
            torneosList.innerHTML = '<div class="empty-state"><span class="empty-icon">🏟️</span><p>No tienes torneos aún. ¡Crea el primero!</p></div>';
            if (paginacion) paginacion.style.display = 'none';
            return;
        }

        torneosList.innerHTML = torneos.map((t, i) => {
            const teamCount = t.teams ? t.teams.length : 0;
            const matchCount = t.matches ? t.matches.length : 0;
            return `
            <div class="torneo-card" data-id="${t._id}" style="animation-delay:${i * 0.05}s">
                <div class="torneo-card-icon">🏆</div>
                <div class="torneo-card-info">
                    <div class="torneo-card-name">${escapeHtml(t.name)}</div>
                    <div class="torneo-card-meta">${teamCount} participantes · ${matchCount} partidos</div>
                </div>
                <div class="torneo-card-actions">
                    <button class="btn-danger btn-eliminar" data-id="${t._id}" data-name="${escapeHtml(t.name)}">Eliminar</button>
                    <span class="torneo-card-arrow">›</span>
                </div>
            </div>`;
        }).join('');

        // Attach events after rendering
        torneosList.querySelectorAll('.torneo-card').forEach(card => {
            card.addEventListener('click', () => {
                window.location.href = `torneo.html?id=${card.dataset.id}`;
            });
        });
        torneosList.querySelectorAll('.btn-eliminar').forEach(btn => {
            btn.addEventListener('click', async e => {
                e.stopPropagation();
                const id   = btn.dataset.id;
                const name = btn.dataset.name;
                if (!confirm(`¿Eliminar "${name}"?`)) return;
                try {
                    const res = await api(`/api/torneos/${id}`, { method: 'DELETE' });
                    if (!res) return;
                    if (!res.ok) { const d = await res.json(); alert(d.message || 'Error'); return; }
                    cargarTorneos();
                } catch { alert('Error eliminando torneo'); }
            });
        });

        // Pagination
        if (paginacion && pages > 1) {
            paginacion.style.display = 'flex';
            let html = '';
            if (page > 1) html += `<button class="btn-page" onclick="cambiarPagina(${page-1})">← Anterior</button>`;
            html += `<span class="page-info">Página ${page} de ${pages} · ${total} torneos</span>`;
            if (page < pages) html += `<button class="btn-page" onclick="cambiarPagina(${page+1})">Siguiente →</button>`;
            paginacion.innerHTML = html;
        } else if (paginacion) {
            paginacion.style.display = 'none';
        }
        currentPage = page;
    } catch {
        torneosList.innerHTML = '<div class="empty-state"><p>Error cargando torneos. Comprueba tu conexión.</p></div>';
    }
}

function cambiarPagina(page) {
    cargarTorneos(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}



// ── XSS helper ─────────────────────────────────────────
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
