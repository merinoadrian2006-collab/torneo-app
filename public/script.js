const BASE_URL = '';  // Vacío = usa el mismo dominio (funciona en local y en Railway)

let sessionId = localStorage.getItem('sessionId');
if (!sessionId) {
    sessionId = 'user_' + Date.now();
    localStorage.setItem('sessionId', sessionId);
}

const form = document.getElementById('torneoForm');
const torneosList = document.getElementById('torneosList');

// Crear torneo
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('torneoName');
    const name = nameInput.value.trim();
    if (!name) return alert('Escribe un nombre válido');

    try {
        const res = await fetch(`${BASE_URL}/api/torneos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, sessionId })
        });

        if (!res.ok) throw new Error('Error creando torneo');

        nameInput.value = '';
        cargarTorneos();
    } catch (error) {
        console.error(error);
        alert('Error creando torneo');
    }
});

// Cargar torneos
async function cargarTorneos() {
    try {
        const res = await fetch(`${BASE_URL}/api/torneos/${sessionId}`);
        if (!res.ok) throw new Error('Error cargando torneos');
        const torneos = await res.json();

        torneosList.innerHTML = '';

        if (torneos.length === 0) {
            torneosList.innerHTML = '<p>No tienes torneos aún</p>';
            return;
        }

        torneos.forEach(t => {
            const div = document.createElement('div');
            div.classList.add('torneo-card');

            const nombre = document.createElement('span');
            nombre.textContent = t.name;
            nombre.style.cursor = 'pointer';
            nombre.onclick = () => window.location.href = `torneo.html?id=${t._id}`;
            div.appendChild(nombre);

            const btnEliminar = document.createElement('button');
            btnEliminar.textContent = 'Eliminar';
            btnEliminar.classList.add('small-btn');
            btnEliminar.onclick = async (e) => {
                e.stopPropagation();
                if (confirm(`¿Seguro que quieres borrar "${t.name}"?`)) {
                    try {
                        const delRes = await fetch(`${BASE_URL}/api/torneos/${t._id}`, { method: 'DELETE' });
                        if (!delRes.ok) throw new Error('Error eliminando torneo');
                        cargarTorneos();
                    } catch (err) {
                        console.error(err);
                        alert('Error eliminando torneo');
                    }
                }
            };
            div.appendChild(btnEliminar);

            torneosList.appendChild(div);
        });
    } catch (error) {
        console.error(error);
        torneosList.innerHTML = '<p>Error cargando torneos</p>';
    }
}

// Inicializar
cargarTorneos();
