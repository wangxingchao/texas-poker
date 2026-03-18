import { create } from 'zustand';
import { io } from 'socket.io-client';
import { Sounds } from '../utils/SoundEngine';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || '';

const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
});

// Avatar colors for players
export const AVATAR_COLORS = [
  '#e53935','#8e24aa','#1e88e5','#00897b',
  '#f4511e','#6d4c41','#00acc1','#43a047',
  '#fdd835',
];

const useGameStore = create((set, get) => ({
  socket,
  connected: false,
  reconnecting: false,

  player: null,
  gameState: null,
  screen: 'login',
  error: null,
  roomCode: null,

  // Timer state
  timer: null,   // { playerId, timeLeft }

  // Emoji reactions
  emojis: [],    // [{ id, playerId, emoji }]

  // Chat
  messages: [],

  // Showdown overlay
  showdownData: null,

  // Sound enabled
  soundEnabled: true,

  // ── Connection ─────────────────────────────────────────────────────

  connect() {
    socket.connect();

    socket.on('connect', () => {
      set({ connected: true, reconnecting: false });
      // Reconnect: request fresh state
      const { roomCode } = get();
      if (roomCode) {
        socket.emit('game:state', {}, (state) => {
          if (state && !state.error) set({ gameState: state });
        });
      }
    });
    socket.on('disconnect', () => set({ connected: false, timer: null }));
    socket.on('reconnecting', () => set({ reconnecting: true }));

    socket.on('game:state', (state) => {
      const prev = get().gameState;
      const isShowdown = state.phase === 'showdown' &&
        (state.results?.length > 0 || state.earlyWin);

      if (isShowdown) {
        set({ gameState: state, showdownData: state, timer: null });
        // Longer display for full showdowns
        const delay = state.results?.length > 0 ? 6500 : 4000;
        setTimeout(() => set({ showdownData: null }), delay);
      } else {
        set({ gameState: state });
        if (state.phase === 'waiting') set({ timer: null });
      }

      // Play sounds
      get()._handleSounds(prev, state);
    });

    socket.on('game:timer', ({ playerId, timeLeft }) => {
      set({ timer: { playerId, timeLeft } });
    });

    socket.on('game:chat', (msg) => {
      set(s => ({ messages: [...s.messages.slice(-49), msg] }));
    });

    socket.on('game:emoji', ({ playerId, emoji }) => {
      const id = Date.now() + Math.random();
      set(s => ({ emojis: [...s.emojis, { id, playerId, emoji }] }));
      setTimeout(() => {
        set(s => ({ emojis: s.emojis.filter(e => e.id !== id) }));
      }, 2100);
    });
  },

  _handleSounds(prev, next) {
    if (!get().soundEnabled) return;
    const myId = get().player?.id;
    try {
      // Phase transitions
      if (next.phase === 'flop' && prev?.phase === 'preflop') Sounds.communityCard();
      else if (next.phase === 'turn' && prev?.phase === 'flop') Sounds.communityCard();
      else if (next.phase === 'river' && prev?.phase === 'turn') Sounds.communityCard();
      // Showdown: win or lose
      else if (next.phase === 'showdown' || next.earlyWin) {
        const iWon = next.winners?.some(w => w.id === myId);
        if (next.earlyWin) {
          if (iWon) Sounds.earlyWin(); else Sounds.chipsToPot();
        } else {
          setTimeout(() => { if (iWon) Sounds.win(); else Sounds.lose(); }, 300);
        }
      }
      // New hand
      else if (next.phase === 'preflop' && prev?.phase === 'waiting') Sounds.newHand();
      // Your turn
      else if (next.currentPlayerId === myId && prev?.currentPlayerId !== myId) Sounds.yourTurn();

      // Detect action from log
      const prevLogLen = prev?.actionLog?.length || 0;
      const newLogs = next.actionLog?.slice(prevLogLen) || [];
      for (const log of newLogs) {
        if (log.actor === 'system') continue;
        const msg = log.message?.toLowerCase() || '';
        if (msg.includes('fold')) Sounds.fold();
        else if (msg.includes('check')) Sounds.check();
        else if (msg.includes('call')) Sounds.chipBet();
        else if (msg.includes('raise') || msg.includes('raise')) Sounds.raise();
        else if (msg.includes('all in')) Sounds.allIn();
      }
    } catch (e) { /* silent */ }
  },

  // ── Auth ───────────────────────────────────────────────────────────

  async register(name) {
    return new Promise(resolve => {
      socket.emit('player:register', { name }, res => {
        if (res.error) { set({ error: res.error }); resolve(false); return; }
        set({ player: res.player, screen: 'lobby', error: null });
        resolve(true);
      });
    });
  },

  async claimDailyBonus() {
    return new Promise(resolve => {
      socket.emit('player:daily_bonus', {}, res => {
        if (res.ok) set(s => ({ player: { ...s.player, chips: res.chips } }));
        resolve(res);
      });
    });
  },

  // ── Rooms ──────────────────────────────────────────────────────────

  async createRoom(options) {
    return new Promise(resolve => {
      socket.emit('room:create', options, res => {
        if (res.error) { set({ error: res.error }); resolve(false); return; }
        set({ roomCode: res.roomCode, gameState: res.game, screen: 'game', error: null, messages: [] });
        resolve(true);
      });
    });
  },

  async joinRoom(code) {
    return new Promise(resolve => {
      socket.emit('room:join', { roomCode: code }, res => {
        if (res.error) { set({ error: res.error }); resolve(false); return; }
        set({ roomCode: res.roomCode, gameState: res.game, screen: 'game', error: null, messages: [] });
        resolve(true);
      });
    });
  },

  async leaveRoom() {
    return new Promise(resolve => {
      socket.emit('room:leave', {}, () => {
        set({ roomCode: null, gameState: null, screen: 'lobby', timer: null, messages: [] });
        resolve();
      });
    });
  },

  // ── Game actions ───────────────────────────────────────────────────

  async startGame() {
    return new Promise(resolve => {
      socket.emit('game:start', {}, res => {
        if (res?.error) set({ error: res.error });
        resolve(res);
      });
    });
  },

  async performAction(action, amount = 0) {
    return new Promise(resolve => {
      socket.emit('game:action', { action, amount }, res => {
        if (res?.error) set({ error: res.error });
        resolve(res);
      });
    });
  },

  async rebuy(amount) {
    return new Promise(resolve => {
      socket.emit('player:rebuy', { amount }, res => {
        resolve(res);
      });
    });
  },

  sendEmoji(emoji) { socket.emit('player:emoji', { emoji }); },
  sendChat(message) { socket.emit('player:chat', { message }); },

  async addBots(count = 1, difficulty = 'casual') {
    return new Promise(resolve => {
      socket.emit('room:add_bots', { count, difficulty }, res => resolve(res));
    });
  },

  async removeBots() {
    return new Promise(resolve => {
      socket.emit('room:remove_bots', {}, res => resolve(res));
    });
  },

  toggleSound() { set(s => ({ soundEnabled: !s.soundEnabled })); },
  clearError() { set({ error: null }); },
}));

export default useGameStore;
