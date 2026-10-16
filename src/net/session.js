// A room: one HOST phone (authoritative: runs the rules, the bots and the
// clocks) and any number of CLIENT phones. Each phone claims one of the four
// friends; unclaimed friends are bots run by the host.
//
// Messages (all carry `from`, the sender's id):
//   client -> host : hello, claim {seat}, release, ping, act {seat, action}, last {seat},
//                    ready {seat, on}, vote {seat, on}, pin {seat, d}, hubact {seat, kind, game}
//   host -> all    : lobby {seats, game}, go {scene, init}, start {...}, ev {...}, post {...},
//                    pg {...} (party game state), hub {...}, say {...}, tolobby, bye
//
// The host also counts as a player and claims a seat like everyone else.
import { makeTransport } from './transport.js';

const SEATS = 6; // the four friends + two goblin guests
const HEARTBEAT = 2000;
const TIMEOUT = 10000; // no word for this long = gone

function myId() {
  // per TAB, so several tabs in one browser are several players
  try {
    let id = sessionStorage.getItem('dd_id');
    if (!id) { id = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('dd_id', id); }
    return id;
  } catch (e) {
    return Math.random().toString(36).slice(2, 10);
  }
}

export function randomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export let session = null;

// The router moves a client phone between scenes when the host says so
// ('go' = open this scene with this state, 'start' = a card game was dealt,
// 'tolobby' = everyone back to the lobby). main.js installs it.
let router = null;
export function setRouter(fn) { router = fn; }

export class Session {
  constructor(code, isHost, kind) {
    this.code = code;
    this.isHost = isHost;
    this.kind = kind; // 'online' | 'local'
    this.id = myId();
    this.seats = Array(SEATS).fill(null); // owner id per seat, null = bot
    this.seen = {}; // host: id -> last heard
    this.hostSeen = Date.now();
    this.game = null; // what the host is running ('stack' | null)
    this.snapshot = null; // host: () => snap message for late joiners
    this.handlers = {};
    this.closed = false;
    if (!isHost) ['go', 'start', 'tolobby'].forEach((t) => this.on(t, (m) => router && router(this, m)));
  }

  async open() {
    this.t = makeTransport(this.code, this.kind);
    this.t.onMessage((m) => this.receive(m));
    await this.t.connect();
    if (this.isHost) {
      this.timer = setInterval(() => this.hostTick(), HEARTBEAT);
      this.broadcastLobby();
    } else {
      this.timer = setInterval(() => this.clientTick(), HEARTBEAT);
      this.send({ t: 'hello' });
    }
    // closing the tab frees your seat right away (instead of the 10s timeout)
    this.onHide = () => (this.isHost ? this.close() : this.send({ t: 'release' }));
    window.addEventListener('pagehide', this.onHide);
    session = this;
    return this;
  }

  close() {
    if (this.closed) return;
    if (this.isHost) this.send({ t: 'bye' });
    clearInterval(this.timer);
    window.removeEventListener('pagehide', this.onHide);
    if (!this.isHost) this.send({ t: 'release' });
    this.closed = true;
    this.t?.close();
    if (session === this) session = null;
  }

  // ---------------------------------------------------------------- events
  on(type, cb) {
    (this.handlers[type] ||= []).push(cb);
    return () => { this.handlers[type] = this.handlers[type].filter((f) => f !== cb); };
  }
  emit(type, data) { (this.handlers[type] || []).slice().forEach((f) => f(data)); }

  send(msg) {
    if (this.closed) return;
    this.t.send({ ...msg, from: this.id });
  }

  mySeat() { return this.seats.indexOf(this.id); }
  humans() { return this.seats.filter(Boolean).length; }

  // ---------------------------------------------------------------- seats
  claim(seat) {
    if (this.isHost) this.hostClaim(this.id, seat);
    else this.send({ t: 'claim', seat });
  }

  hostClaim(id, seat) {
    if (seat < 0 || seat >= SEATS) return;
    if (this.seats[seat] && this.seats[seat] !== id) return; // taken
    this.seats = this.seats.map((s) => (s === id ? null : s));
    this.seats[seat] = id;
    this.broadcastLobby();
  }

  broadcastLobby() {
    this.send({ t: 'lobby', seats: this.seats, game: this.game });
    this.emit('lobby', { seats: this.seats, game: this.game });
  }

  setGame(game) {
    this.game = game;
    this.broadcastLobby();
  }

  // ---------------------------------------------------------------- receive
  receive(m) {
    if (!m || m.from === this.id) return;
    if (this.isHost) return this.hostReceive(m);
    return this.clientReceive(m);
  }

  hostReceive(m) {
    this.seen[m.from] = Date.now();
    switch (m.t) {
      case 'hello':
        this.broadcastLobby();
        // a late joiner (or a phone that missed messages) gets dropped into the current scene
        if (this.game && this.snapshot) this.send({ ...this.snapshot(), t: 'go', to: m.from });
        break;
      case 'claim': this.hostClaim(m.from, m.seat); break;
      case 'release':
        this.seats = this.seats.map((s) => (s === m.from ? null : s));
        this.broadcastLobby();
        break;
      case 'act':
      case 'last':
      case 'ready':
      case 'vote':
      case 'pin': // a party-game input
      case 'hubact': // the arcade picker spinning / picking
        // only the phone that owns that seat may act for it
        if (this.seats[m.seat] === m.from) this.emit(m.t, m);
        break;
      default:
    }
  }

  clientReceive(m) {
    this.hostSeen = Date.now();
    switch (m.t) {
      case 'lobby':
        this.seats = m.seats;
        this.game = m.game;
        this.emit('lobby', m);
        break;
      case 'go':
        if (!m.to || m.to === this.id) this.emit('go', m);
        break;
      case 'bye':
        this.emit('lost', { reason: 'The host left.' });
        break;
      default:
        this.emit(m.t, m); // start, ev, tolobby
    }
  }

  // ---------------------------------------------------------------- heartbeats
  hostTick() {
    const now = Date.now();
    let changed = false;
    this.seats = this.seats.map((s) => {
      if (s && s !== this.id && now - (this.seen[s] || 0) > TIMEOUT) { changed = true; return null; }
      return s;
    });
    if (changed) this.emit('dropped', {});
    this.broadcastLobby(); // doubles as the host's heartbeat
  }

  clientTick() {
    this.send({ t: 'ping' });
    if (Date.now() - this.hostSeen > TIMEOUT) this.emit('lost', { reason: 'Lost the host.' });
  }
}

// Host a fresh room, or join one. kind: 'online' | 'local'
export async function hostRoom(kind) {
  session?.close();
  const s = new Session(randomCode(), true, kind);
  await s.open();
  return s;
}

export async function joinRoom(code, kind) {
  session?.close();
  const s = new Session(code, false, kind);
  await s.open();
  // wait for the host to answer
  await new Promise((res, rej) => {
    const t = setTimeout(() => { off(); rej(new Error(`No room ${code} found. Check the code, or ask the host to open it.`)); }, 6000);
    const off = s.on('lobby', () => { clearTimeout(t); off(); res(); });
  }).catch((e) => { s.close(); throw e; });
  return s;
}
