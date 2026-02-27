const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  name: String,
  points: { type: Number, default: 0 },
  goalsFor: { type: Number, default: 0 },
  goalsAgainst: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  draws: { type: Number, default: 0 },
  losses: { type: Number, default: 0 }
});

const MatchSchema = new mongoose.Schema({
  teamA: String, teamB: String,
  scoreA: Number, scoreB: Number,
  round: { type: String, default: 'league' },
  date: { type: Date, default: Date.now }
});

const PlayoffMatchSchema = new mongoose.Schema({
  round: String,
  teamA: { type: String, default: '' },
  teamB: { type: String, default: '' },
  scoreA: { type: Number, default: null },
  scoreB: { type: Number, default: null },
  played: { type: Boolean, default: false }
});

const ActivitySchema = new mongoose.Schema({
  text: String,
  date: { type: Date, default: Date.now }
});

const VALID_SPORTS = ['futbol', 'futbol_sala', 'baloncesto', 'tenis', 'frontenis', 'voleibol', 'padel', 'rugby'];

const TorneoSchema = new mongoose.Schema({
  name: String,
  sessionId: { type: String, index: true },
  sport: { type: String, default: 'futbol', enum: VALID_SPORTS },
  teams: [TeamSchema],
  matches: [MatchSchema],
  playoff: [PlayoffMatchSchema],
  activity: [ActivitySchema],
  publicShare: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Torneo', TorneoSchema);
