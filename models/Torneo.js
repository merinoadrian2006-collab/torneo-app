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
  teamA: String,
  teamB: String,
  scoreA: Number,
  scoreB: Number,
  date: { type: Date, default: Date.now }
});

const TorneoSchema = new mongoose.Schema({
  name: String,
  sessionId: String,
  teams: [TeamSchema],
  matches: [MatchSchema]
});

module.exports = mongoose.model('Torneo', TorneoSchema);
