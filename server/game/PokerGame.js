// 德州扑克核心引擎 v3 — production grade
import { createDeck, shuffleDeck } from './Deck.js';
import { evaluateBestHand, compareHands } from './HandEvaluator.js';

export const GAME_PHASES = {
  WAITING: 'waiting',
  PREFLOP: 'preflop',
  FLOP: 'flop',
  TURN: 'turn',
  RIVER: 'river',
  SHOWDOWN: 'showdown',
};

export const PLAYER_ACTIONS = {
  FOLD: 'fold',
  CHECK: 'check',
  CALL: 'call',
  RAISE: 'raise',
  ALL_IN: 'all_in',
};

const DEFAULT_TIMEOUT = 30000;

export class PokerGame {
  constructor(roomId, options = {}) {
    this.roomId = roomId;
    this.smallBlind = options.smallBlind || 10;
    this.bigBlind = options.bigBlind || 20;
    this.ante = options.ante || 0;
    this.minPlayers = 2;
    this.maxPlayers = options.maxPlayers || 9;
    this.actionTimeoutMs = options.actionTimeout || DEFAULT_TIMEOUT;

    this.players = [];
    this.phase = GAME_PHASES.WAITING;
    this.communityCards = [];
    this.deck = [];
    this.pot = 0;
    this.sidePots = [];
    this.currentBet = 0;
    this.currentPlayerIndex = -1;
    this.dealerIndex = -1;
    this.lastRaiseAmount = 0;
    this.handNumber = 0;
    this.actionLog = [];
    this.handHistory = [];  // last N completed hands

    // Timer
    this._actionTimer = null;
    this.onTimerTick = null;
    this.onAutoAction = null;

    // Betting round tracking
    this.actionsThisRound = 0;
    this.bbIndex = -1;
    this.bbHasOption = false;

    // Showdown options
    this.showdownPending = false;  // waiting for show/muck decisions
    this._showdownResults = null;
  }

  destroy() {
    this._clearTimer();
    this.onTimerTick = null;
    this.onAutoAction = null;
  }

  // ── Player management ──────────────────────────────────────────────

  addPlayer(playerId, playerName, chips = 1000) {
    if (this.players.length >= this.maxPlayers) return { error: 'Table is full' };
    if (this.players.find(p => p.id === playerId)) return { error: 'Already at table' };

    this.players.push({
      id: playerId,
      name: playerName,
      chips: Math.max(0, Math.floor(chips)),
      holeCards: [],
      bet: 0,
      totalBet: 0,
      status: 'waiting',
      isDealer: false,
      isSB: false,
      isBB: false,
      seatIndex: this._getNextSeatIndex(),
      handsPlayed: 0,
      handsWon: 0,
      totalBetLifetime: 0,
      vpipHands: 0,    // voluntarily put $ in pot
      showCards: false, // showdown: player chose to show
    });
    return { ok: true };
  }

  _getNextSeatIndex() {
    const used = new Set(this.players.map(p => p.seatIndex));
    for (let i = 0; i < this.maxPlayers; i++) {
      if (!used.has(i)) return i;
    }
    return this.players.length;
  }

  removePlayer(playerId) {
    const idx = this.players.findIndex(p => p.id === playerId);
    if (idx === -1) return;

    // If it's their turn in an active hand, auto-fold first
    if (this.phase !== GAME_PHASES.WAITING && this.phase !== GAME_PHASES.SHOWDOWN) {
      const p = this.players[idx];
      if (p.status === 'active' && idx === this.currentPlayerIndex) {
        this._clearTimer();
        p.status = 'folded';
        this._log(p.name, 'folds (disconnected)');

        // Check if hand ends
        const inHand = this.getInHandPlayers();
        if (inHand.length <= 1) {
          if (inHand.length === 1) this._endHandEarly(inHand[0]);
          else { this.phase = GAME_PHASES.WAITING; this.pot = 0; }
        }
      } else if (p.status === 'active') {
        p.status = 'folded';
      }
    }

    this.players.splice(idx, 1);

    // Adjust currentPlayerIndex after removal
    if (this.currentPlayerIndex >= this.players.length) {
      this.currentPlayerIndex = 0;
    }
    if (this.dealerIndex >= this.players.length) {
      this.dealerIndex = Math.max(0, this.players.length - 1);
    }
  }

  rebuyPlayer(playerId, amount) {
    const p = this.players.find(p => p.id === playerId);
    if (!p) return { error: 'Player not found' };
    amount = Math.max(0, Math.floor(amount));
    p.chips += amount;
    if (p.status === 'out') p.status = 'waiting';
    return { ok: true, chips: p.chips };
  }

  getActivePlayers() {
    return this.players.filter(p => p.status === 'active' || p.status === 'allin');
  }

  getInHandPlayers() {
    return this.players.filter(p => p.status === 'active' || p.status === 'allin');
  }

  // ── Game flow ──────────────────────────────────────────────────────

  canStart() {
    const ready = this.players.filter(p => p.chips > 0);
    return ready.length >= this.minPlayers && this.phase === GAME_PHASES.WAITING;
  }

  startHand() {
    if (!this.canStart()) return { error: 'Cannot start' };
    this._clearTimer();

    this.handNumber++;
    this.actionLog = [];
    this.communityCards = [];
    this.pot = 0;
    this.sidePots = [];
    this.currentBet = 0;
    this.lastRaiseAmount = this.bigBlind;
    this.actionsThisRound = 0;
    this.bbHasOption = false;
    this.showdownPending = false;
    this._showdownResults = null;

    for (const p of this.players) {
      p.holeCards = [];
      p.bet = 0;
      p.totalBet = 0;
      p.status = p.chips > 0 ? 'active' : 'out';
      p.isDealer = false;
      p.isSB = false;
      p.isBB = false;
      p.showCards = false;
      if (p.status === 'active') p.handsPlayed++;
    }

    const activePlayers = this.players.filter(p => p.status === 'active');
    const activeCount = activePlayers.length;

    // Move dealer button
    this.dealerIndex = this._nextActiveFromIndex(this.dealerIndex);
    this.players[this.dealerIndex].isDealer = true;

    // ── HEADS-UP special case (2 players) ──
    // In heads-up: dealer = small blind, non-dealer = big blind
    if (activeCount === 2) {
      const sbIndex = this.dealerIndex; // Dealer IS small blind
      const bbIndex = this._nextActiveFromIndex(sbIndex);
      this.players[sbIndex].isSB = true;
      this.players[bbIndex].isBB = true;
      this.bbIndex = bbIndex;
      this.bbHasOption = true;

      this._postBlind(sbIndex, this.smallBlind);
      this._postBlind(bbIndex, this.bigBlind);
      this.currentBet = this.bigBlind;

      // Preflop: SB (dealer) acts first in heads-up
      this.currentPlayerIndex = sbIndex;
    } else {
      // Standard: SB is next after dealer, BB after SB
      const sbIndex = this._nextActiveFromIndex(this.dealerIndex);
      const bbIndex = this._nextActiveFromIndex(sbIndex);
      this.players[sbIndex].isSB = true;
      this.players[bbIndex].isBB = true;
      this.bbIndex = bbIndex;
      this.bbHasOption = true;

      this._postBlind(sbIndex, this.smallBlind);
      this._postBlind(bbIndex, this.bigBlind);
      this.currentBet = this.bigBlind;

      // UTG: first player after BB
      this.currentPlayerIndex = this._nextActiveFromIndex(bbIndex);
    }

    // Post antes
    if (this.ante > 0) {
      for (const p of activePlayers) {
        const anteAmt = Math.min(this.ante, p.chips);
        p.chips -= anteAmt;
        p.totalBet += anteAmt;
        this.pot += anteAmt;
        if (p.chips === 0) p.status = 'allin';
      }
    }

    // Deal hole cards
    this.deck = shuffleDeck(createDeck());
    for (const p of activePlayers) {
      p.holeCards = [this.deck.pop(), this.deck.pop()];
    }

    this.phase = GAME_PHASES.PREFLOP;
    this._log('system', `Hand #${this.handNumber}`);
    this._startTimer();
    return { ok: true };
  }

  _postBlind(playerIndex, amount) {
    const player = this.players[playerIndex];
    const actual = Math.min(amount, player.chips);
    player.chips -= actual;
    player.bet += actual;
    player.totalBet += actual;
    this.pot += actual;
    if (player.chips === 0) player.status = 'allin';
  }

  _nextActiveFromIndex(fromIndex) {
    if (this.players.length === 0) return 0;
    let idx = (fromIndex + 1) % this.players.length;
    let loops = 0;
    while (this.players[idx]?.status !== 'active' && loops < this.players.length) {
      idx = (idx + 1) % this.players.length;
      loops++;
    }
    return idx;
  }

  // ── Action timer ───────────────────────────────────────────────────

  _startTimer() {
    this._clearTimer();
    const cp = this.players[this.currentPlayerIndex];
    if (!cp || cp.status !== 'active') return;
    if (!this.onTimerTick) return;

    const playerId = cp.id;
    let timeLeft = Math.ceil(this.actionTimeoutMs / 1000);
    this.onTimerTick(playerId, timeLeft);

    this._actionTimer = setInterval(() => {
      timeLeft--;
      if (timeLeft < 0) timeLeft = 0;
      if (this.onTimerTick) this.onTimerTick(playerId, timeLeft);

      if (timeLeft <= 0) {
        this._clearTimer();
        const valid = this.getValidActions(playerId);
        const canCheck = valid.some(a => a.action === 'check');
        const autoAction = canCheck ? 'check' : 'fold';
        this._log(cp.name, `${autoAction} (time)`);
        if (this.onAutoAction) this.onAutoAction(playerId, autoAction, 0);
      }
    }, 1000);
  }

  _clearTimer() {
    if (this._actionTimer) {
      clearInterval(this._actionTimer);
      this._actionTimer = null;
    }
  }

  // ── Player actions ─────────────────────────────────────────────────

  getValidActions(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return [];
    if (this.players[this.currentPlayerIndex]?.id !== playerId) return [];
    if (player.status !== 'active') return [];

    const callAmount = this.currentBet - player.bet;
    const actions = [];

    actions.push({ action: PLAYER_ACTIONS.FOLD });

    if (callAmount <= 0) {
      actions.push({ action: PLAYER_ACTIONS.CHECK });
    } else if (player.chips >= callAmount) {
      actions.push({ action: PLAYER_ACTIONS.CALL, amount: callAmount });
    }

    // Short stack all-in
    if (callAmount > 0 && player.chips < callAmount) {
      actions.push({ action: PLAYER_ACTIONS.ALL_IN, amount: player.chips });
      return actions;
    }

    // Raise
    const minRaiseTotal = this.currentBet + Math.max(this.lastRaiseAmount, this.bigBlind);
    const minRaiseAdd = Math.max(minRaiseTotal - player.bet, 1);
    if (player.chips > callAmount) {
      actions.push({
        action: PLAYER_ACTIONS.RAISE,
        minAmount: Math.min(minRaiseAdd, player.chips),
        maxAmount: player.chips,
        potSize: this.pot,
      });
    }

    // All-in always available
    if (player.chips > 0) {
      actions.push({ action: PLAYER_ACTIONS.ALL_IN, amount: player.chips });
    }

    return actions;
  }

  performAction(playerId, action, amount = 0) {
    const playerIdx = this.players.findIndex(p => p.id === playerId);
    if (playerIdx === -1) return { error: 'Player not found' };
    if (playerIdx !== this.currentPlayerIndex) return { error: 'Not your turn' };

    const player = this.players[playerIdx];
    if (player.status !== 'active') return { error: 'Not active' };

    // Input validation
    amount = Math.max(0, Math.floor(amount || 0));

    this._clearTimer();
    this.actionsThisRound++;

    // Track VPIP
    let voluntaryAction = false;

    switch (action) {
      case PLAYER_ACTIONS.FOLD:
        player.status = 'folded';
        this._log(player.name, 'Fold');
        if (playerIdx === this.bbIndex) this.bbHasOption = false;
        break;

      case PLAYER_ACTIONS.CHECK:
        if (this.currentBet > player.bet) return { error: 'Cannot check' };
        this._log(player.name, 'Check');
        if (playerIdx === this.bbIndex) this.bbHasOption = false;
        break;

      case PLAYER_ACTIONS.CALL: {
        const callAmt = Math.min(this.currentBet - player.bet, player.chips);
        if (callAmt <= 0) return { error: 'Nothing to call' };
        player.chips -= callAmt;
        player.bet += callAmt;
        player.totalBet += callAmt;
        player.totalBetLifetime += callAmt;
        this.pot += callAmt;
        if (player.chips === 0) player.status = 'allin';
        voluntaryAction = true;
        this._log(player.name, `Call ${callAmt}`);
        break;
      }

      case PLAYER_ACTIONS.RAISE: {
        const callAmt = Math.max(0, this.currentBet - player.bet);
        const raiseAdd = Math.min(amount, player.chips - callAmt);
        if (raiseAdd <= 0) return { error: 'Invalid raise' };
        const totalPut = callAmt + raiseAdd;
        this.lastRaiseAmount = Math.max(this.lastRaiseAmount, raiseAdd);
        player.chips -= totalPut;
        player.bet += totalPut;
        player.totalBet += totalPut;
        player.totalBetLifetime += totalPut;
        this.pot += totalPut;
        this.currentBet = player.bet;
        if (player.chips === 0) player.status = 'allin';
        voluntaryAction = true;
        this._log(player.name, `Raise → ${player.bet}`);
        this.actionsThisRound = 1;
        this.bbHasOption = false;
        break;
      }

      case PLAYER_ACTIONS.ALL_IN: {
        const allinAmt = player.chips;
        if (allinAmt <= 0) return { error: 'No chips' };
        if (player.bet + allinAmt > this.currentBet) {
          const raiseOver = (player.bet + allinAmt) - this.currentBet;
          if (raiseOver >= this.lastRaiseAmount) {
            this.actionsThisRound = 1;
            this.bbHasOption = false;
          }
          this.lastRaiseAmount = Math.max(this.lastRaiseAmount, raiseOver);
          this.currentBet = player.bet + allinAmt;
        }
        player.bet += allinAmt;
        player.totalBet += allinAmt;
        player.totalBetLifetime += allinAmt;
        this.pot += allinAmt;
        player.chips = 0;
        player.status = 'allin';
        voluntaryAction = true;
        this._log(player.name, `ALL IN ${allinAmt}`);
        break;
      }

      default:
        return { error: 'Invalid action' };
    }

    // Track VPIP (preflop voluntary money)
    if (voluntaryAction && this.phase === GAME_PHASES.PREFLOP && !player.isBB) {
      player.vpipHands++;
    }

    // Check hand over
    const inHand = this.getInHandPlayers();
    if (inHand.length <= 1) {
      return inHand.length === 1 ? this._endHandEarly(inHand[0]) : this._endHandEarly(null);
    }

    // All remaining players all-in?
    const stillActive = this.players.filter(p => p.status === 'active');
    if (stillActive.length <= 1 && inHand.length > 1) {
      // If only one active player left and others all-in, check if bets matched
      if (stillActive.length === 0 || (stillActive.length === 1 && stillActive[0].bet >= this.currentBet)) {
        return this._runItOut();
      }
    }

    if (this._isBettingRoundOver()) {
      return this._advancePhase();
    }

    this._advancePlayer();
    this._startTimer();
    return { ok: true };
  }

  _isBettingRoundOver() {
    const active = this.players.filter(p => p.status === 'active');
    if (active.length === 0) return true;
    if (!active.every(p => p.bet === this.currentBet)) return false;
    if (this.bbHasOption && this.phase === GAME_PHASES.PREFLOP) return false;
    return this.actionsThisRound >= active.length;
  }

  _advancePlayer() {
    if (this.players.length === 0) return;
    let next = (this.currentPlayerIndex + 1) % this.players.length;
    let loops = 0;
    while (this.players[next]?.status !== 'active' && loops < this.players.length) {
      next = (next + 1) % this.players.length;
      loops++;
    }
    this.currentPlayerIndex = next;
  }

  _advancePhase() {
    for (const p of this.players) p.bet = 0;
    this.currentBet = 0;
    this.lastRaiseAmount = this.bigBlind;
    this.actionsThisRound = 0;
    this.bbHasOption = false;

    const PHASE_ORDER = [GAME_PHASES.PREFLOP, GAME_PHASES.FLOP, GAME_PHASES.TURN, GAME_PHASES.RIVER];
    const idx = PHASE_ORDER.indexOf(this.phase);

    const inHand = this.getInHandPlayers();
    const activeOnly = inHand.filter(p => p.status === 'active');

    if (idx >= PHASE_ORDER.length - 1 || activeOnly.length <= 1) {
      // If only all-in players and maybe one active, run out remaining
      if (activeOnly.length <= 1 && this.communityCards.length < 5 && inHand.length > 1) {
        return this._runItOut();
      }
      return this._showdown();
    }

    this.phase = PHASE_ORDER[idx + 1];

    if (this.phase === GAME_PHASES.FLOP) {
      this.deck.pop();
      this.communityCards.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
    } else {
      this.deck.pop();
      this.communityCards.push(this.deck.pop());
    }

    // First to act post-flop
    // In heads-up: first to act is non-dealer (BB) post-flop
    let nextIdx = this._nextActiveFromIndex(this.dealerIndex);
    this.currentPlayerIndex = nextIdx;

    this._log('system', `── ${this.phase.toUpperCase()} ──`);
    this._startTimer();
    return { ok: true, phase: this.phase };
  }

  _runItOut() {
    // Deal all remaining community cards
    while (this.communityCards.length < 5) {
      if (this.communityCards.length === 0) {
        this.deck.pop();
        this.communityCards.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
      } else {
        this.deck.pop();
        this.communityCards.push(this.deck.pop());
      }
    }
    this.phase = GAME_PHASES.RIVER;
    return this._showdown();
  }

  // ── Side pot calculation ───────────────────────────────────────────

  _calculateSidePots(inHandPlayers) {
    const sorted = [...inHandPlayers].sort((a, b) => a.totalBet - b.totalBet);
    const pots = [];
    let prevLevel = 0;

    for (let i = 0; i < sorted.length; i++) {
      const level = sorted[i].totalBet;
      if (level <= prevLevel) continue;

      // Count all players who contributed at least this level
      const eligible = inHandPlayers.filter(p => p.totalBet >= level).map(p => p.id);
      // Amount in this pot level = (level - prevLevel) * number of contributors
      const contributors = inHandPlayers.filter(p => p.totalBet > prevLevel);
      const amount = contributors.reduce((sum, p) => {
        return sum + Math.min(level, p.totalBet) - Math.min(prevLevel, p.totalBet);
      }, 0);

      if (amount > 0) pots.push({ amount, eligible });
      prevLevel = level;
    }

    // Add folded players' contributions that weren't captured
    const foldedPot = this.players
      .filter(p => p.status === 'folded' && p.totalBet > 0)
      .reduce((sum, p) => sum + p.totalBet, 0);

    if (foldedPot > 0 && pots.length > 0) {
      pots[0].amount += foldedPot;
    } else if (foldedPot > 0) {
      const allIds = inHandPlayers.map(p => p.id);
      pots.push({ amount: foldedPot, eligible: allIds });
    }

    return pots.length > 0 ? pots : [{ amount: this.pot, eligible: inHandPlayers.map(p => p.id) }];
  }

  _showdown() {
    this.phase = GAME_PHASES.SHOWDOWN;
    this._clearTimer();

    const inHand = this.getInHandPlayers();
    const sidePots = this._calculateSidePots(inHand);

    const results = inHand.map(player => ({
      player,
      hand: evaluateBestHand(player.holeCards, this.communityCards),
    }));

    const winners = [];
    let totalAwarded = 0;

    for (const pot of sidePots) {
      const eligible = results.filter(r => pot.eligible.includes(r.player.id));
      if (eligible.length === 0) continue;
      eligible.sort((a, b) => compareHands(b.hand, a.hand));

      const potWinners = [eligible[0]];
      for (let i = 1; i < eligible.length; i++) {
        if (compareHands(eligible[i].hand, eligible[0].hand) === 0) potWinners.push(eligible[i]);
      }

      const share = Math.floor(pot.amount / potWinners.length);
      const rem = pot.amount - share * potWinners.length;

      for (let i = 0; i < potWinners.length; i++) {
        const award = share + (i === 0 ? rem : 0);
        potWinners[i].player.chips += award;
        potWinners[i].player.handsWon++;
        totalAwarded += award;
        if (!winners.find(w => w.id === potWinners[i].player.id)) {
          winners.push({
            id: potWinners[i].player.id,
            name: potWinners[i].player.name,
            chips: potWinners[i].player.chips,
          });
        }
      }
    }

    const topHand = results.sort((a, b) => compareHands(b.hand, a.hand))[0];
    const winMsg = `${winners.map(w => w.name).join(', ')} wins with ${topHand?.hand?.name || '?'}`;
    this._log('system', winMsg);

    // Save hand history
    this.handHistory.push({
      handNumber: this.handNumber,
      time: Date.now(),
      communityCards: [...this.communityCards],
      players: results.map(r => ({
        id: r.player.id,
        name: r.player.name,
        holeCards: [...r.player.holeCards],
        hand: r.hand.name,
        won: winners.some(w => w.id === r.player.id),
      })),
      winners: winners.map(w => w.name),
      pot: this.pot,
    });
    if (this.handHistory.length > 20) this.handHistory.shift();

    this.sidePots = sidePots;

    const showdownResult = {
      phase: GAME_PHASES.SHOWDOWN,
      results: results.map(r => ({
        playerId: r.player.id,
        playerName: r.player.name,
        holeCards: r.player.holeCards,
        hand: r.hand,
        won: winners.some(w => w.id === r.player.id),
        chips: r.player.chips,
      })),
      winners: winners.map(w => ({ ...w })),
      communityCards: [...this.communityCards],
      totalPot: this.pot,
    };

    // Reset for next hand
    for (const p of this.players) {
      if (p.chips <= 0) p.status = 'out';
      else if (p.status !== 'out') p.status = 'waiting';
    }
    this.pot = 0;
    this.phase = GAME_PHASES.WAITING;

    return showdownResult;
  }

  _endHandEarly(winner) {
    this._clearTimer();
    const winPot = this.pot;

    if (winner) {
      winner.chips += winPot;
      winner.handsWon++;
      this._log('system', `${winner.name} wins ${winPot}`);
    }

    // Save history
    this.handHistory.push({
      handNumber: this.handNumber,
      time: Date.now(),
      communityCards: [...this.communityCards],
      players: this.players.filter(p => p.holeCards.length > 0).map(p => ({
        id: p.id, name: p.name, holeCards: [], hand: '—',
        won: winner?.id === p.id,
      })),
      winners: winner ? [winner.name] : [],
      pot: winPot,
      earlyWin: true,
    });
    if (this.handHistory.length > 20) this.handHistory.shift();

    for (const p of this.players) {
      if (p.chips <= 0) p.status = 'out';
      else if (p.status !== 'out') p.status = 'waiting';
    }

    this.pot = 0;
    this.phase = GAME_PHASES.WAITING;

    return {
      phase: GAME_PHASES.SHOWDOWN,
      results: [],
      winners: winner ? [{ id: winner.id, name: winner.name, chips: winner.chips }] : [],
      earlyWin: true,
      totalPot: winPot,
    };
  }

  _log(actor, message) {
    this.actionLog.push({ actor, message, time: Date.now() });
    if (this.actionLog.length > 60) this.actionLog.shift();
  }

  // ── Public state ───────────────────────────────────────────────────

  getPublicState(forPlayerId) {
    return {
      roomId: this.roomId,
      phase: this.phase,
      pot: this.pot,
      sidePots: this.sidePots,
      currentBet: this.currentBet,
      communityCards: this.communityCards,
      currentPlayerId: this.players[this.currentPlayerIndex]?.id || null,
      handNumber: this.handNumber,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      ante: this.ante,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        bet: p.bet,
        totalBet: p.totalBet,
        status: p.status,
        isDealer: p.isDealer,
        isSB: p.isSB,
        isBB: p.isBB,
        seatIndex: p.seatIndex,
        handsPlayed: p.handsPlayed,
        handsWon: p.handsWon,
        vpipHands: p.vpipHands,
        holeCards: (p.id === forPlayerId || this.phase === GAME_PHASES.SHOWDOWN)
          ? p.holeCards
          : p.holeCards.length > 0 ? [null, null] : [],
        handCount: p.holeCards.length,
      })),
      actionLog: this.actionLog.slice(-20),
      validActions: forPlayerId ? this.getValidActions(forPlayerId) : [],
      canStart: this.canStart(),
      handHistory: this.handHistory.slice(-5),
    };
  }
}
