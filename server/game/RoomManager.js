import { PokerGame, GAME_PHASES } from './PokerGame.js';
import { decideBotAction, getRandomBotName } from './BotPlayer.js';
import { v4 as uuidv4 } from 'uuid';

const BOT_THINK_MIN = 800;   // ms
const BOT_THINK_MAX = 2500;

const STARTING_CHIPS = 5000;
const DAILY_BONUS = 1000;
const MIN_REBUY = 100;
const MAX_REBUY = 50000;

class RoomManager {
  constructor() {
    this.rooms = new Map();       // roomCode -> { game, hostId, settings, createdAt, bots }
    this.players = new Map();     // socketId -> playerRecord
    this.playerIndex = new Map(); // playerId -> socketId
    this.botIds = new Set();      // set of bot playerIds
    this.io = null;
  }

  setIO(io) { this.io = io; }

  // ── Player management ──────────────────────────────────────────────

  registerPlayer(socketId, name) {
    const playerId = uuidv4();
    const player = {
      id: playerId,
      name,
      chips: STARTING_CHIPS,
      roomCode: null,
      lastBonus: null,
      createdAt: Date.now(),
      totalWon: 0,
      handsPlayed: 0,
    };
    this.players.set(socketId, player);
    this.playerIndex.set(playerId, socketId);
    return player;
  }

  getPlayer(socketId) { return this.players.get(socketId); }

  claimDailyBonus(socketId) {
    const player = this.players.get(socketId);
    if (!player) return { error: 'Not logged in' };
    const today = new Date().toDateString();
    if (player.lastBonus === today) return { error: 'Already claimed today' };
    player.chips += DAILY_BONUS;
    player.lastBonus = today;
    return { ok: true, bonus: DAILY_BONUS, chips: player.chips };
  }

  // ── Bot management ────────────────────────────────────────────────

  addBots(roomCode, count = 1, difficulty = 'casual') {
    const room = this.rooms.get(roomCode);
    if (!room) return { error: 'Room not found' };

    const added = [];
    const existingNames = room.bots.map(b => b.name);

    for (let i = 0; i < count; i++) {
      if (room.game.players.length >= room.game.maxPlayers) break;
      const botId = 'bot_' + uuidv4();
      const name = getRandomBotName([...existingNames, ...added.map(b => b.name)]);
      const result = room.game.addPlayer(botId, name, 5000);
      if (result.error) break;

      this.botIds.add(botId);
      const bot = { id: botId, name, difficulty };
      room.bots.push(bot);
      added.push(bot);
    }

    return { ok: true, bots: added };
  }

  removeBots(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    for (const bot of room.bots) {
      room.game.removePlayer(bot.id);
      this.botIds.delete(bot.id);
    }
    room.bots = [];
  }

  isBot(playerId) { return this.botIds.has(playerId); }

  // Schedule bot action when it's a bot's turn
  scheduleBotAction(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const game = room.game;
    const currentPlayer = game.players[game.currentPlayerIndex];
    if (!currentPlayer || !this.isBot(currentPlayer.id)) return;
    if (game.phase === GAME_PHASES.WAITING || game.phase === GAME_PHASES.SHOWDOWN) return;

    const delay = BOT_THINK_MIN + Math.random() * (BOT_THINK_MAX - BOT_THINK_MIN);
    const bot = room.bots.find(b => b.id === currentPlayer.id);

    setTimeout(() => {
      const r = this.rooms.get(roomCode);
      if (!r) return;
      const cp = r.game.players[r.game.currentPlayerIndex];
      if (!cp || cp.id !== currentPlayer.id) return; // turn changed

      const validActions = r.game.getValidActions(currentPlayer.id);
      if (!validActions.length) return;

      const decision = decideBotAction(
        validActions,
        currentPlayer.holeCards,
        r.game.communityCards,
        r.game.pot,
        r.game.currentBet,
        currentPlayer.bet,
        currentPlayer.chips,
        bot?.difficulty || 'casual',
      );

      const result = r.game.performAction(currentPlayer.id, decision.action, decision.amount || 0);
      if (result.error) {
        console.warn(`Bot ${currentPlayer.name} invalid action: ${decision.action} - ${result.error}`);
        // Fallback: fold or check
        const fallback = r.game.getValidActions(currentPlayer.id);
        const safe = fallback.find(a => a.action === 'check') || fallback.find(a => a.action === 'fold');
        if (safe) r.game.performAction(currentPlayer.id, safe.action, 0);
      }
      this.broadcastGameState(roomCode);

      // Auto-start next hand or continue bot chain
      if (r.game.phase === GAME_PHASES.WAITING && r.game.canStart()) {
        setTimeout(() => {
          const rr = this.rooms.get(roomCode);
          if (rr?.game.canStart()) {
            rr.game.startHand();
            this.broadcastGameState(roomCode);
            this.scheduleBotAction(roomCode);
          }
        }, 3500);
      } else {
        this.scheduleBotAction(roomCode);
      }
    }, delay);
  }

  // ── Room management ────────────────────────────────────────────────

  createRoom(socketId, options = {}) {
    const player = this.players.get(socketId);
    if (!player) return { error: 'Not registered' };
    if (player.roomCode) return { error: 'Already in a room' };

    const roomCode = this._generateRoomCode();
    const game = new PokerGame(roomCode, {
      smallBlind: options.smallBlind || 10,
      bigBlind: options.bigBlind || 20,
      ante: options.ante || 0,
      maxPlayers: options.maxPlayers || 9,
      actionTimeout: options.actionTimeout || 30000,
    });

    // Wire up timer callbacks
    game.onTimerTick = (playerId, timeLeft) => {
      const sids = this.getRoomSocketIds(roomCode);
      for (const sid of sids) {
        this.io?.to(sid).emit('game:timer', { playerId, timeLeft });
      }
    };
    game.onAutoAction = (playerId, action) => {
      const sid = this.playerIndex.get(playerId);
      if (sid) {
        // Simulate as if player acted
        game.performAction(playerId, action, 0);
        this.broadcastGameState(roomCode);
        this._checkAutoStart(roomCode);
      }
    };

    this.rooms.set(roomCode, {
      game,
      hostId: player.id,
      settings: options,
      createdAt: Date.now(),
      messages: [],
      bots: [],       // [{ id, name, difficulty }]
    });

    const result = game.addPlayer(player.id, player.name, player.chips);
    if (result.error) return result;

    player.roomCode = roomCode;

    // Auto-add 2 bots so solo play works immediately
    const botCount = options.botCount ?? 2;
    if (botCount > 0) {
      this.addBots(roomCode, botCount, options.botDifficulty || 'casual');
    }

    return { ok: true, roomCode, game: game.getPublicState(player.id) };
  }

  joinRoom(socketId, roomCode) {
    const player = this.players.get(socketId);
    if (!player) return { error: 'Not registered' };
    if (player.roomCode) return { error: 'Already in a room' };

    const room = this.rooms.get(roomCode);
    if (!room) return { error: 'Room not found' };

    const result = room.game.addPlayer(player.id, player.name, player.chips);
    if (result.error) return result;

    player.roomCode = roomCode;
    return { ok: true, roomCode, game: room.game.getPublicState(player.id) };
  }

  leaveRoom(socketId) {
    const player = this.players.get(socketId);
    if (!player?.roomCode) return { error: 'Not in a room' };

    const room = this.rooms.get(player.roomCode);
    if (room) {
      const gp = room.game.players.find(p => p.id === player.id);
      if (gp) {
        player.chips = gp.chips;
        room.game.removePlayer(player.id);
      }
      if (room.game.players.length === 0) {
        room.game._clearTimer();
        this.rooms.delete(player.roomCode);
      }
    }

    const roomCode = player.roomCode;
    player.roomCode = null;
    return { ok: true, roomCode };
  }

  rebuy(socketId, amount) {
    const player = this.players.get(socketId);
    if (!player?.roomCode) return { error: 'Not in a room' };
    const room = this.rooms.get(player.roomCode);
    if (!room) return { error: 'Room not found' };

    amount = Math.max(MIN_REBUY, Math.min(MAX_REBUY, Math.floor(amount)));
    // In a real game you'd deduct real money; here it's free chips
    const result = room.game.rebuyPlayer(player.id, amount);
    if (result.ok) player.chips = result.chips;
    return result;
  }

  sendChat(socketId, message) {
    const player = this.players.get(socketId);
    if (!player?.roomCode) return;
    const room = this.rooms.get(player.roomCode);
    if (!room) return;

    const msg = { playerId: player.id, playerName: player.name, message: message.slice(0, 100), time: Date.now() };
    room.messages.push(msg);
    if (room.messages.length > 50) room.messages.shift();

    for (const sid of this.getRoomSocketIds(player.roomCode)) {
      this.io?.to(sid).emit('game:chat', msg);
    }
  }

  sendEmoji(socketId, emoji) {
    const player = this.players.get(socketId);
    if (!player?.roomCode) return;
    const ALLOWED = ['😂','🤣','👏','💪','😤','🤔','😎','🙏','🔥','💰','🃏','😭'];
    if (!ALLOWED.includes(emoji)) return;

    for (const sid of this.getRoomSocketIds(player.roomCode)) {
      this.io?.to(sid).emit('game:emoji', { playerId: player.id, playerName: player.name, emoji });
    }
  }

  // ── Game control ───────────────────────────────────────────────────

  startGame(socketId) {
    const player = this.players.get(socketId);
    const room = this.rooms.get(player?.roomCode);
    if (!room) return { error: 'Not in a room' };
    if (room.hostId !== player.id) return { error: 'Only host can start' };
    const result = room.game.startHand();
    if (result.ok) this.scheduleBotAction(player.roomCode);
    return result;
  }

  playerAction(socketId, action, amount) {
    const player = this.players.get(socketId);
    const room = this.rooms.get(player?.roomCode);
    if (!room) return { error: 'Not in a room' };
    const result = room.game.performAction(player.id, action, amount);
    if (result.ok || result.phase) this.scheduleBotAction(player.roomCode);
    return result;
  }

  // ── Broadcast ─────────────────────────────────────────────────────

  broadcastGameState(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room || !this.io) return;
    for (const p of room.game.players) {
      const sid = this.playerIndex.get(p.id);
      if (sid) this.io.to(sid).emit('game:state', room.game.getPublicState(p.id));
    }
  }

  _checkAutoStart(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    if (room.game.phase === GAME_PHASES.WAITING && room.game.canStart()) {
      setTimeout(() => {
        const r = this.rooms.get(roomCode);
        if (r?.game.canStart()) {
          r.game.startHand();
          this.broadcastGameState(roomCode);
          this.scheduleBotAction(roomCode);
        }
      }, 4000);
    }
  }

  getRoomSocketIds(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return [];
    return room.game.players.map(p => this.playerIndex.get(p.id)).filter(Boolean);
  }

  getRoom(roomCode) { return this.rooms.get(roomCode); }

  getRoomForPlayer(socketId) {
    const player = this.players.get(socketId);
    return player?.roomCode ? this.rooms.get(player.roomCode) : null;
  }

  onDisconnect(socketId) {
    const player = this.players.get(socketId);
    const roomCode = player?.roomCode;
    this.leaveRoom(socketId);
    if (player) this.playerIndex.delete(player.id);
    this.players.delete(socketId);
    if (roomCode) this.broadcastGameState(roomCode);
  }

  _generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
      code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    } while (this.rooms.has(code));
    return code;
  }
}

export default new RoomManager();
