// Transports move small JSON messages between every phone in a room.
//
//   SupabaseTransport - the real thing: Supabase Realtime "broadcast" over the
//                       internet. Free tier, no server of our own.
//   LocalTransport    - BroadcastChannel: tabs in the same browser talk to each
//                       other. For testing solo (?net=local), no internet needed.
//
// Both: await connect(); send(msg); onMessage(cb); close(). Neither echoes your
// own messages back to you.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export class LocalTransport {
  constructor(code) {
    this.kind = 'local';
    this.code = code;
  }
  async connect() {
    this.bc = new BroadcastChannel('dd-room-' + this.code);
    this.bc.onmessage = (e) => this.cb && this.cb(e.data);
  }
  send(msg) { this.bc.postMessage(msg); }
  onMessage(cb) { this.cb = cb; }
  close() { try { this.bc?.close(); } catch (e) { /* ignore */ } }
}

let loading = null;
function loadSupabase() {
  if (window.supabase?.createClient) return Promise.resolve(window.supabase);
  if (!loading) {
    loading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'lib/supabase.min.js';
      s.onload = () => (window.supabase?.createClient ? res(window.supabase) : rej(new Error('supabase failed to load')));
      s.onerror = () => rej(new Error('supabase failed to load'));
      document.head.appendChild(s);
    });
  }
  return loading;
}

let client = null;

export class SupabaseTransport {
  constructor(code) {
    this.kind = 'online';
    this.code = code;
  }
  async connect(timeoutMs = 8000) {
    const sb = await loadSupabase();
    if (!client) client = sb.createClient(SUPABASE_URL, SUPABASE_KEY, { realtime: { params: { eventsPerSecond: 20 } } });
    this.ch = client.channel('dd-room-' + this.code, { config: { broadcast: { self: false, ack: false } } });
    this.ch.on('broadcast', { event: 'm' }, ({ payload }) => this.cb && this.cb(payload));
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('timed out reaching the server')), timeoutMs);
      this.ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') { clearTimeout(t); res(); }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(t); rej(new Error('server said ' + status)); }
      });
    });
  }
  send(msg) { this.ch?.send({ type: 'broadcast', event: 'm', payload: msg }); }
  onMessage(cb) { this.cb = cb; }
  close() { try { client?.removeChannel(this.ch); } catch (e) { /* ignore */ } }
}

export function makeTransport(code, kind) {
  return kind === 'local' ? new LocalTransport(code) : new SupabaseTransport(code);
}
