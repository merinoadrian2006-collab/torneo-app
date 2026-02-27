const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const path = require('path');
const Torneo = require('./models/Torneo');

require('dotenv').config();

const app = express();

// ── Security headers ───────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
        }
    }
}));

app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Rate limiting ──────────────────────────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: 'Demasiados intentos. Espera 15 minutos.' },
    standardHeaders: true, legacyHeaders: false
});
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { message: 'Demasiadas peticiones. Espera un momento.' },
    standardHeaders: true, legacyHeaders: false
});

app.use('/api/auth', authLimiter);
app.use('/api/', apiLimiter);

// ── JWT ────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
    console.error('❌ JWT_SECRET no definida o demasiado corta (mínimo 32 chars)');
    process.exit(1);
}

function signToken(sessionId) {
    return jwt.sign({ sessionId }, JWT_SECRET, { expiresIn: '30d' });
}

function verifyToken(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'No autorizado' });
    try {
        const payload = jwt.verify(auth.slice(7), JWT_SECRET);
        req.sessionId = payload.sessionId;
        next();
    } catch {
        return res.status(401).json({ message: 'Token inválido o expirado' });
    }
}

// ── Sanitize ───────────────────────────────────────────
function sanitizeStr(str, maxLen = 100) {
    if (typeof str !== 'string') return '';
    return validator.escape(str.trim()).slice(0, maxLen);
}

const VALID_SPORTS = ['futbol', 'futbol_sala', 'baloncesto', 'tenis', 'frontenis', 'voleibol', 'padel', 'rugby'];

// ── Helpers ────────────────────────────────────────────
function recalcularStats(torneo) {
    torneo.teams.forEach(t => {
        t.points = 0; t.wins = 0; t.draws = 0; t.losses = 0;
        t.goalsFor = 0; t.goalsAgainst = 0;
    });
    torneo.matches.filter(m => m.round === 'league').forEach(m => {
        const eq1 = torneo.teams.find(t => t.name === m.teamA);
        const eq2 = torneo.teams.find(t => t.name === m.teamB);
        if (!eq1 || !eq2) return;
        eq1.goalsFor += m.scoreA; eq1.goalsAgainst += m.scoreB;
        eq2.goalsFor += m.scoreB; eq2.goalsAgainst += m.scoreA;
        if (m.scoreA > m.scoreB) { eq1.points += 3; eq1.wins += 1; eq2.losses += 1; }
        else if (m.scoreA < m.scoreB) { eq2.points += 3; eq2.wins += 1; eq1.losses += 1; }
        else { eq1.points += 1; eq2.points += 1; eq1.draws += 1; eq2.draws += 1; }
    });
}

function addActivity(torneo, text) {
    torneo.activity.unshift({ text, date: new Date() });
    if (torneo.activity.length > 20) torneo.activity = torneo.activity.slice(0, 20);
}

// ── AUTH ───────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
    let { sessionId } = req.body;
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ message: 'Código requerido' });
    sessionId = sessionId.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 30);
    if (sessionId.length < 3) return res.status(400).json({ message: 'Mínimo 3 caracteres' });
    if (!/^[a-z0-9_\-\.]+$/.test(sessionId)) return res.status(400).json({ message: 'Solo letras, números, guiones y puntos' });
    res.json({ token: signToken(sessionId), sessionId });
});

app.get('/api/auth/verify', verifyToken, (req, res) => {
    res.json({ sessionId: req.sessionId });
});

// ── TORNEOS ────────────────────────────────────────────
app.post('/api/torneos', verifyToken, async (req, res) => {
    try {
        const name = sanitizeStr(req.body.name, 60);
        const sport = VALID_SPORTS.includes(req.body.sport) ? req.body.sport : 'futbol';
        if (!name) return res.status(400).json({ message: 'Nombre requerido' });
        const count = await Torneo.countDocuments({ sessionId: req.sessionId });
        if (count >= 50) return res.status(400).json({ message: 'Máximo 50 torneos por usuario' });
        const t = new Torneo({ name, sessionId: req.sessionId, sport, teams: [], matches: [], playoff: [], activity: [] });
        addActivity(t, `Torneo "${name}" creado`);
        await t.save();
        res.status(201).json(t);
    } catch (e) { console.error(e); res.status(500).json({ message: 'Error interno' }); }
});

app.get('/api/torneos', verifyToken, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 20));
        const [torneos, total] = await Promise.all([
            Torneo.find({ sessionId: req.sessionId })
                .sort({ updatedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .select('name sport teams matches updatedAt'),
            Torneo.countDocuments({ sessionId: req.sessionId })
        ]);
        res.json({ torneos, total, page, pages: Math.ceil(total / limit) });
    } catch (e) { res.status(500).json({ message: 'Error interno' }); }
});

app.get('/api/torneos/:id', verifyToken, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ message: 'ID inválido' });
        }
        const torneo = await Torneo.findOne({ _id: req.params.id, sessionId: req.sessionId });
        if (!torneo) return res.status(404).json({ message: 'No encontrado' });
        res.json(torneo);
    } catch (e) { console.error('GET torneo error:', e); res.status(500).json({ message: 'Error interno' }); }
});

app.get('/api/public/:id', async (req, res) => {
    try {
        const torneo = await Torneo.findById(req.params.id).select('-sessionId');
        if (!torneo || !torneo.publicShare) return res.status(404).json({ message: 'No disponible' });
        res.json(torneo);
    } catch (e) { res.status(500).json({ message: 'Error interno' }); }
});

app.put('/api/torneos/:id/share', verifyToken, async (req, res) => {
    try {
        const torneo = await Torneo.findOne({ _id: req.params.id, sessionId: req.sessionId });
        if (!torneo) return res.status(404).json({ message: 'No encontrado' });
        torneo.publicShare = !torneo.publicShare;
        addActivity(torneo, torneo.publicShare ? 'Torneo compartido públicamente' : 'Torneo hecho privado');
        await torneo.save();
        res.json({ publicShare: torneo.publicShare });
    } catch (e) { res.status(500).json({ message: 'Error interno' }); }
});

app.delete('/api/torneos/:id', verifyToken, async (req, res) => {
    try {
        const result = await Torneo.findOneAndDelete({ _id: req.params.id, sessionId: req.sessionId });
        if (!result) return res.status(404).json({ message: 'No encontrado' });
        res.json({ message: 'Eliminado' });
    } catch (e) { res.status(500).json({ message: 'Error interno' }); }
});

// ── EQUIPOS ────────────────────────────────────────────
app.put('/api/torneos/:id/equipos', verifyToken, async (req, res) => {
    try {
        const torneo = await Torneo.findOne({ _id: req.params.id, sessionId: req.sessionId });
        if (!torneo) return res.status(404).json({ message: 'No encontrado' });
        const name = sanitizeStr(req.body.name, 40);
        if (!name) return res.status(400).json({ message: 'Nombre requerido' });
        if (torneo.teams.length >= 64) return res.status(400).json({ message: 'Máximo 64 participantes' });
        if (torneo.teams.some(t => t.name === name)) return res.status(400).json({ message: 'Ese nombre ya existe' });
        torneo.teams.push({ name, points: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 });
        addActivity(torneo, `"${name}" añadido`);
        await torneo.save();
        res.json({ message: 'OK' });
    } catch (e) { res.status(500).json({ message: 'Error interno' }); }
});

app.delete('/api/torneos/:id/equipos/:equipoId', verifyToken, async (req, res) => {
    try {
        const torneo = await Torneo.findOne({ _id: req.params.id, sessionId: req.sessionId });
        if (!torneo) return res.status(404).json({ message: 'No encontrado' });
        const equipo = torneo.teams.find(t => t._id.toString() === req.params.equipoId);
        if (equipo) addActivity(torneo, `"${equipo.name}" eliminado`);
        torneo.teams = torneo.teams.filter(t => t._id.toString() !== req.params.equipoId);
        await torneo.save();
        res.json({ message: 'OK' });
    } catch (e) { res.status(500).json({ message: 'Error interno' }); }
});

// ── PARTIDOS ───────────────────────────────────────────
app.put('/api/torneos/:id/partidos', verifyToken, async (req, res) => {
    try {
        const torneo = await Torneo.findOne({ _id: req.params.id, sessionId: req.sessionId });
        if (!torneo) return res.status(404).json({ message: 'No encontrado' });
        const teamA = sanitizeStr(req.body.teamA, 40);
        const teamB = sanitizeStr(req.body.teamB, 40);
        const scoreA = Math.min(999, Math.max(0, parseInt(req.body.scoreA) || 0));
        const scoreB = Math.min(999, Math.max(0, parseInt(req.body.scoreB) || 0));
        if (!teamA || !teamB || teamA === teamB) return res.status(400).json({ message: 'Participantes inválidos' });
        if (torneo.matches.length >= 1000) return res.status(400).json({ message: 'Máximo 1000 partidos' });
        const eq1 = torneo.teams.find(t => t.name === teamA);
        const eq2 = torneo.teams.find(t => t.name === teamB);
        if (!eq1 || !eq2) return res.status(400).json({ message: 'Participante no encontrado' });
        torneo.matches.push({ teamA, teamB, scoreA, scoreB, round: 'league' });
        eq1.goalsFor += scoreA; eq1.goalsAgainst += scoreB;
        eq2.goalsFor += scoreB; eq2.goalsAgainst += scoreA;
        if (scoreA > scoreB) { eq1.points += 3; eq1.wins += 1; eq2.losses += 1; }
        else if (scoreA < scoreB) { eq2.points += 3; eq2.wins += 1; eq1.losses += 1; }
        else { eq1.points += 1; eq2.points += 1; eq1.draws += 1; eq2.draws += 1; }
        const result = scoreA === scoreB ? 'Empate' : `${scoreA > scoreB ? teamA : teamB} ganó`;
        addActivity(torneo, `${teamA} ${scoreA}–${scoreB} ${teamB} · ${result}`);
        await torneo.save();
        res.json({ message: 'OK' });
    } catch (e) { res.status(500).json({ message: 'Error interno' }); }
});

app.delete('/api/torneos/:id/partidos/:matchId', verifyToken, async (req, res) => {
    try {
        const torneo = await Torneo.findOne({ _id: req.params.id, sessionId: req.sessionId });
        if (!torneo) return res.status(404).json({ message: 'No encontrado' });
        const match = torneo.matches.find(m => m._id.toString() === req.params.matchId);
        if (match) addActivity(torneo, `Partido ${match.teamA} vs ${match.teamB} eliminado`);
        torneo.matches = torneo.matches.filter(m => m._id.toString() !== req.params.matchId);
        recalcularStats(torneo);
        await torneo.save();
        res.json({ message: 'OK' });
    } catch (e) { res.status(500).json({ message: 'Error interno' }); }
});

// ── PLAYOFF ────────────────────────────────────────────
app.post('/api/torneos/:id/playoff/generar', verifyToken, async (req, res) => {
    try {
        const torneo = await Torneo.findOne({ _id: req.params.id, sessionId: req.sessionId });
        if (!torneo) return res.status(404).json({ message: 'No encontrado' });
        const sorted = [...torneo.teams].sort((a, b) =>
            b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)
        );
        const n = sorted.length;
        let playoff = [];
        if (n >= 8) {
            playoff = [
                { round:'QF1', teamA:sorted[0]?.name||'', teamB:sorted[7]?.name||'', scoreA:null, scoreB:null, played:false },
                { round:'QF2', teamA:sorted[3]?.name||'', teamB:sorted[4]?.name||'', scoreA:null, scoreB:null, played:false },
                { round:'QF3', teamA:sorted[1]?.name||'', teamB:sorted[6]?.name||'', scoreA:null, scoreB:null, played:false },
                { round:'QF4', teamA:sorted[2]?.name||'', teamB:sorted[5]?.name||'', scoreA:null, scoreB:null, played:false },
                { round:'SF1', teamA:'', teamB:'', scoreA:null, scoreB:null, played:false },
                { round:'SF2', teamA:'', teamB:'', scoreA:null, scoreB:null, played:false },
                { round:'F',   teamA:'', teamB:'', scoreA:null, scoreB:null, played:false },
            ];
        } else if (n >= 4) {
            playoff = [
                { round:'QF1', teamA:sorted[0]?.name||'', teamB:sorted[3]?.name||'', scoreA:null, scoreB:null, played:false },
                { round:'QF2', teamA:sorted[1]?.name||'', teamB:sorted[2]?.name||'', scoreA:null, scoreB:null, played:false },
                { round:'SF1', teamA:'', teamB:'', scoreA:null, scoreB:null, played:false },
                { round:'SF2', teamA:'', teamB:'', scoreA:null, scoreB:null, played:false },
                { round:'F',   teamA:'', teamB:'', scoreA:null, scoreB:null, played:false },
            ];
        } else if (n >= 2) {
            playoff = [
                { round:'SF1', teamA:sorted[0]?.name||'', teamB:sorted[1]?.name||'', scoreA:null, scoreB:null, played:false },
                { round:'F',   teamA:'', teamB:'', scoreA:null, scoreB:null, played:false },
            ];
        }
        torneo.playoff = playoff;
        addActivity(torneo, 'Fase playoff generada');
        await torneo.save();
        res.json(torneo.playoff);
    } catch (e) { res.status(500).json({ message: 'Error interno' }); }
});

app.put('/api/torneos/:id/playoff/:round', verifyToken, async (req, res) => {
    try {
        const torneo = await Torneo.findOne({ _id: req.params.id, sessionId: req.sessionId });
        if (!torneo) return res.status(404).json({ message: 'No encontrado' });
        const scoreA = Math.min(999, Math.max(0, parseInt(req.body.scoreA) || 0));
        const scoreB = Math.min(999, Math.max(0, parseInt(req.body.scoreB) || 0));
        const match = torneo.playoff.find(m => m.round === req.params.round);
        if (!match) return res.status(404).json({ message: 'No encontrado' });
        if (scoreA === scoreB) return res.status(400).json({ message: 'No puede haber empate en playoff' });
        match.scoreA = scoreA; match.scoreB = scoreB; match.played = true;
        const winner = scoreA > scoreB ? match.teamA : match.teamB;
        addActivity(torneo, `Playoff ${match.round}: ${match.teamA} ${scoreA}–${scoreB} ${match.teamB}`);
        const hasQF = torneo.playoff.some(m => m.round.startsWith('QF'));
        if (hasQF) {
            if (match.round === 'QF1') { const sf = torneo.playoff.find(m => m.round === 'SF1'); if (sf) sf.teamA = winner; }
            if (match.round === 'QF2') { const sf = torneo.playoff.find(m => m.round === 'SF1'); if (sf) sf.teamB = winner; }
            if (match.round === 'QF3') { const sf = torneo.playoff.find(m => m.round === 'SF2'); if (sf) sf.teamA = winner; }
            if (match.round === 'QF4') { const sf = torneo.playoff.find(m => m.round === 'SF2'); if (sf) sf.teamB = winner; }
        }
        if (match.round === 'SF1') { const f = torneo.playoff.find(m => m.round === 'F'); if (f) f.teamA = winner; }
        if (match.round === 'SF2') { const f = torneo.playoff.find(m => m.round === 'F'); if (f) f.teamB = winner; }
        if (match.round === 'F') addActivity(torneo, `🏆 Campeón: ${winner}`);
        await torneo.save();
        res.json(torneo.playoff);
    } catch (e) { res.status(500).json({ message: 'Error interno' }); }
});

app.delete('/api/torneos/:id/playoff', verifyToken, async (req, res) => {
    try {
        const torneo = await Torneo.findOne({ _id: req.params.id, sessionId: req.sessionId });
        if (!torneo) return res.status(404).json({ message: 'No encontrado' });
        torneo.playoff = [];
        addActivity(torneo, 'Playoff reiniciado');
        await torneo.save();
        res.json({ message: 'OK' });
    } catch (e) { res.status(500).json({ message: 'Error interno' }); }
});

// ── SPA fallback ───────────────────────────────────────
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── DB + Start ─────────────────────────────────────────
const mongoURI = process.env.MONGO_URI;
if (!mongoURI) { console.error('❌ MONGO_URI no definida'); process.exit(1); }

mongoose.connect(mongoURI)
    .then(() => {
        console.log('✅ MongoDB conectado');
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => console.log(`🚀 Puerto ${PORT}`));
    })
    .catch(err => { console.error('❌ Error MongoDB', err); process.exit(1); });
