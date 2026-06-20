import WebSocket from 'ws';
import type {
  MatchmakingStartMessage,
  MatchFoundMessage,
  GameEnterMessage,
  GameActionMessage,
  GameOverMessage,
} from '@kenyamaneko/overload-party-api-gateway';
import type { TestIdentity } from './auth.js';

// battle 側 ActionType.Forfeit / WinReason.Surrender の文字列値と一致させる。
export const FORFEIT_ACTION_TYPE = 'forfeit';
export const SURRENDER_REASON = 'surrender';

export interface WsEnvelope<TData = unknown> {
  type: string;
  data?: TData;
}

export interface WsClientOptions {
  url: string;
  identity: TestIdentity;
  handshakeTimeoutMs: number;
}

export class WsClient {
  private ws: WebSocket | undefined;
  private readonly inbox: WsEnvelope[] = [];
  private readonly waiters: Array<(env: WsEnvelope) => boolean> = [];
  private closeReason: string | undefined;

  constructor(private readonly opts: WsClientOptions) {}

  async connect(): Promise<void> {
    const url = `${this.opts.url}?token=${encodeURIComponent(this.opts.identity.idToken)}`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on('message', (raw) => {
      const text = typeof raw === 'string' ? raw : raw.toString();
      try {
        const env = JSON.parse(text) as WsEnvelope;
        this.deliver(env);
      } catch {
        // Drop non-JSON frames silently.
      }
    });

    ws.on('close', (code, reason) => {
      this.closeReason = `closed code=${code} reason=${reason.toString()}`;
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`ws handshake timeout after ${this.opts.handshakeTimeoutMs}ms`)),
        this.opts.handshakeTimeoutMs,
      );
      ws.once('open', () => {
        clearTimeout(timer);
        resolve();
      });
      ws.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  send<T>(env: WsEnvelope<T>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`ws not open: ${this.closeReason ?? 'never connected'}`);
    }
    this.ws.send(JSON.stringify(env));
  }

  startMatchmaking(deckId: number): void {
    this.send<MatchmakingStartMessage>({ type: 'matchmaking_start', data: { deck_id: deckId } });
  }

  enterGame(gameId: string, deckId: number): void {
    this.send<GameEnterMessage>({ type: 'game_enter', data: { game_id: gameId, deck_id: deckId } });
  }

  /** 降参アクションを送って対戦を即終局させる。 */
  forfeit(gameId: string, reason: string = SURRENDER_REASON): void {
    this.send<GameActionMessage>({
      type: 'game_action',
      data: { game_id: gameId, action_type: FORFEIT_ACTION_TYPE, data: { reason } },
    });
  }

  waitFor<T = unknown>(expected: string, timeoutMs: number): Promise<WsEnvelope<T>> {
    const idx = this.inbox.findIndex((e) => e.type === expected);
    if (idx >= 0) {
      const found = this.inbox.splice(idx, 1)[0]!;
      return Promise.resolve(found as WsEnvelope<T>);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = this.waiters.indexOf(tryMatch);
        if (i >= 0) this.waiters.splice(i, 1);
        reject(
          new Error(
            `ws waitFor("${expected}") timed out after ${timeoutMs}ms — buffered: ${this.inbox.map((e) => e.type).join(',') || '(empty)'}`,
          ),
        );
      }, timeoutMs);
      const tryMatch = (env: WsEnvelope): boolean => {
        if (env.type !== expected) return false;
        clearTimeout(timer);
        resolve(env as WsEnvelope<T>);
        return true;
      };
      this.waiters.push(tryMatch);
    });
  }

  waitForMatchFound(timeoutMs: number): Promise<MatchFoundMessage> {
    return this.waitFor<MatchFoundMessage>('match_found', timeoutMs).then((e) => {
      if (!e.data) throw new Error('match_found received without data');
      return e.data;
    });
  }

  waitForGameOver(timeoutMs: number): Promise<GameOverMessage> {
    return this.waitFor<GameOverMessage>('game_over', timeoutMs).then((e) => {
      if (!e.data) throw new Error('game_over received without data');
      return e.data;
    });
  }

  async close(): Promise<void> {
    if (!this.ws) return;
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close();
    }
  }

  private deliver(env: WsEnvelope): void {
    for (let i = 0; i < this.waiters.length; i++) {
      const w = this.waiters[i]!;
      if (w(env)) {
        this.waiters.splice(i, 1);
        return;
      }
    }
    this.inbox.push(env);
  }
}
