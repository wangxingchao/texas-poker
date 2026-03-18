import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import roomManager from './game/RoomManager.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(cors());
app.use(express.json());

// Wire IO into roomManager (for timer broadcasts)
roomManager.setIO(io);

app.get('/health', (_, res) => res.json({ ok: true, rooms: roomManager.rooms.size }));
app.get('/stats', (_, res) => res.json({
  rooms: roomManager.rooms.size,
  players: roomManager.players.size,
}));

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);

  const emit = (event, data) => socket.emit(event, data);
  const broadcast = () => {
    const player = roomManager.getPlayer(socket.id);
    if (player?.roomCode) roomManager.broadcastGameState(player.roomCode);
  };

  socket.on('player:register', ({ name }, cb) => {
    if (!name?.trim()) return cb?.({ error: 'Name required' });
    const clean = name.trim().replace(/[<>\"]/g, '').slice(0, 16);
    if (!clean) return cb?.({ error: 'Invalid name' });
    const player = roomManager.registerPlayer(socket.id, clean);
    cb?.({ ok: true, player });
  });

  socket.on('player:daily_bonus', (_, cb) => {
    cb?.(roomManager.claimDailyBonus(socket.id));
  });

  socket.on('room:create', (options, cb) => {
    const result = roomManager.createRoom(socket.id, options || {});
    if (result.error) return cb?.(result);
    socket.join(result.roomCode);
    cb?.({ ok: true, roomCode: result.roomCode, game: result.game });
    broadcast();
  });

  socket.on('room:join', ({ roomCode }, cb) => {
    const code = (roomCode || '').toString().toUpperCase().slice(0, 10);
    const result = roomManager.joinRoom(socket.id, code);
    if (result.error) return cb?.(result);
    socket.join(result.roomCode);
    cb?.({ ok: true, roomCode: result.roomCode, game: result.game });
    broadcast();
  });

  socket.on('room:leave', (_, cb) => {
    const player = roomManager.getPlayer(socket.id);
    const roomCode = player?.roomCode;
    roomManager.leaveRoom(socket.id);
    if (roomCode) socket.leave(roomCode);
    cb?.({ ok: true });
    if (roomCode) roomManager.broadcastGameState(roomCode);
  });

  socket.on('game:start', (_, cb) => {
    const result = roomManager.startGame(socket.id);
    if (result.error) return cb?.(result);
    cb?.({ ok: true });
    broadcast();
  });

  socket.on('game:action', ({ action, amount }, cb) => {
    const player = roomManager.getPlayer(socket.id);
    const roomCode = player?.roomCode;
    if (!roomCode) return cb?.({ error: 'Not in a room' });

    // Validate action type
    const VALID_ACTIONS = ['fold', 'check', 'call', 'raise', 'all_in'];
    if (!VALID_ACTIONS.includes(action)) return cb?.({ error: 'Invalid action' });
    const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));

    const result = roomManager.playerAction(socket.id, action, safeAmount);
    if (result.error) return cb?.(result);
    cb?.({ ok: true });
    roomManager.broadcastGameState(roomCode);

    // Auto-start next hand
    const room = roomManager.getRoom(roomCode);
    if (room?.game.phase === 'waiting' && room.game.canStart()) {
      setTimeout(() => {
        const r = roomManager.getRoom(roomCode);
        if (r?.game.canStart()) {
          r.game.startHand();
          roomManager.broadcastGameState(roomCode);
          roomManager.scheduleBotAction(roomCode);
        }
      }, 4500);
    }
  });

  socket.on('game:state', (_, cb) => {
    const player = roomManager.getPlayer(socket.id);
    const room = roomManager.getRoomForPlayer(socket.id);
    if (!room) return cb?.({ error: 'Not in a room' });
    cb?.(room.game.getPublicState(player?.id));
  });

  socket.on('room:add_bots', ({ count, difficulty }, cb) => {
    const player = roomManager.getPlayer(socket.id);
    const room = roomManager.getRoomForPlayer(socket.id);
    if (!room) return cb?.({ error: 'Not in a room' });
    if (room.hostId !== player?.id) return cb?.({ error: 'Only host can add bots' });
    const result = roomManager.addBots(player.roomCode, count || 1, difficulty || 'casual');
    cb?.(result);
    broadcast();
  });

  socket.on('room:remove_bots', (_, cb) => {
    const player = roomManager.getPlayer(socket.id);
    if (!player?.roomCode) return cb?.({ error: 'Not in a room' });
    roomManager.removeBots(player.roomCode);
    cb?.({ ok: true });
    broadcast();
  });

  socket.on('player:rebuy', ({ amount }, cb) => {
    const result = roomManager.rebuy(socket.id, amount);
    cb?.(result);
    broadcast();
  });

  socket.on('player:emoji', ({ emoji }) => {
    roomManager.sendEmoji(socket.id, emoji);
  });

  socket.on('player:chat', ({ message }) => {
    if (message?.trim()) roomManager.sendChat(socket.id, message.trim());
  });

  socket.on('disconnect', () => {
    const player = roomManager.getPlayer(socket.id);
    console.log(`[-] ${socket.id} (${player?.name || 'unknown'})`);
    roomManager.onDisconnect(socket.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🃏 Poker Server on :${PORT}`);
});
