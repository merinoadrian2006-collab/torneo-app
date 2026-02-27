const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const Torneo = require('./models/Torneo');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

app.post('/api/torneos', async (req, res) => {
    try {
        const { name, sessionId } = req.body;
        if (!name || !sessionId) return res.status(400).json({ message: 'Faltan datos' });
        const t = new Torneo({ name, sessionId, teams: [], matches: [], playoff: [], activity: [] });
        addActivity(t, `Torneo "${name}" creado`);
        await t.save();
        res.status(201).json(t);
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

app.get('/api/torneos/:sessionId', async (req, res) => {
    try {
        const torneos = await Torneo.find({ sessionId: req.params.sessionId });
        res.json(torneos);
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

app.get('/api/torneos/id/:id', async (req, res) => {
    try {
        const torneo = await Torneo.findById(req.params.id);
        if (!torneo) return res.status(404).json({ message: 'No encontrado' });
        res.json(torneo);
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

app.get('/api/public/:id', async (req, res) => {
    try {
        const torneo = await Torneo.findById(req.params.id);
        if (!torneo || !torneo.publicShare) return res.status(404).json({ message: 'No disponible' });
        res.json(torneo);
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

app.put('/api/torneos/:id/share', async (req, res) => {
    try {
        const torneo = await Torneo.findById(req.params.id);
        if (!torneo) return res.status(404).json({ message: 'No encontrado' });
        torneo.publicShare = !torneo.publicShare;
        addActivity(torneo, torneo.publicShare ? 'Torneo compartido públicamente' : 'Torneo hecho privado');
        await torneo.save();
        res.json({ publicShare: torneo.publicShare });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

app.delete('/api/torneos/:torneoId', async (req, res) => {
    try {
        await Torneo.findByIdAndDelete(req.params.torneoId);
        res.json({ message: 'Eliminado' });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

app.put('/api/torneos/:torneoId/equipos', async (req, res) => {
    try {
        const torneo = await Torneo.findById(req.params.torneoId);
        if (!torneo) return res.status(404).json({ message: 'No encontrado' });
        const { name } = req.body;
        torneo.teams.push({ name, points: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 });
        addActivity(torneo, `Equipo "${name}" añadido`);
        await torneo.save();
        res.json({ message: 'OK' });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

app.delete('/api/torneos/:torneoId/equipos/:equipoId', async (req, res) => {
    try {
        const torneo = await Torneo.findById(req.params.torneoId);
        if (!torneo) return res.status(404).json({ message: 'No encontrado' });
        const equipo = torneo.teams.find(t => t._id.toString() === req.params.equipoId);
        if (equipo) addActivity(torneo, `Equipo "${equipo.name}" eliminado`);
        torneo.teams = torneo.teams.filter(t => t._id.toString() !== req.params.equipoId);
        await torneo.save();
        res.json({ message: 'OK' });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

app.put('/api/torneos/:torneoId/partidos', async (req, res) => {
    try {
        const torneo = await Torneo.findById(req.params.torneoId);
        if (!torneo) return res.status(404).json({ message: 'No encontrado' });
        const { teamA, teamB, scoreA, scoreB } = req.body;
        const eq1 = torneo.teams.find(t => t.name === teamA);
        const eq2 = torneo.teams.find(t => t.name === teamB);
        if (!eq1 || !eq2) return res.status(400).json({ message: 'Equipo no encontrado' });
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
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

app.delete('/api/torneos/:torneoId/partidos/:matchId', async (req, res) => {
    try {
        const torneo = await Torneo.findById(req.params.torneoId);
        if (!torneo) return res.status(404).json({ message: 'No encontrado' });
        const match = torneo.matches.find(m => m._id.toString() === req.params.matchId);
        if (match) addActivity(torneo, `Partido ${match.teamA} vs ${match.teamB} eliminado`);
        torneo.matches = torneo.matches.filter(m => m._id.toString() !== req.params.matchId);
        recalcularStats(torneo);
        await torneo.save();
        res.json({ message: 'OK' });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

app.post('/api/torneos/:torneoId/playoff/generar', async (req, res) => {
    try {
        const torneo = await Torneo.findById(req.params.torneoId);
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
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

app.put('/api/torneos/:torneoId/playoff/:round', async (req, res) => {
    try {
        const torneo = await Torneo.findById(req.params.torneoId);
        if (!torneo) return res.status(404).json({ message: 'No encontrado' });
        const { scoreA, scoreB } = req.body;
        const match = torneo.playoff.find(m => m.round === req.params.round);
        if (!match) return res.status(404).json({ message: 'No encontrado' });
        if (scoreA === scoreB) return res.status(400).json({ message: 'No puede haber empate' });
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
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

app.delete('/api/torneos/:torneoId/playoff', async (req, res) => {
    try {
        const torneo = await Torneo.findById(req.params.torneoId);
        if (!torneo) return res.status(404).json({ message: 'No encontrado' });
        torneo.playoff = [];
        addActivity(torneo, 'Playoff reiniciado');
        await torneo.save();
        res.json({ message: 'OK' });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const mongoURI = process.env.MONGO_URI;
if (!mongoURI) { console.error('❌ MONGO_URI no definida'); process.exit(1); }
mongoose.connect(mongoURI)
    .then(() => console.log('✅ MongoDB conectado'))
    .catch(err => { console.error('❌ Error MongoDB', err); process.exit(1); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Puerto ${PORT}`));
