export type TargetEnv = 'local' | 'dev' | 'stg';
export type AuthMode = 'dev-token' | 'firebase';

export interface E2EEnv {
  targetEnv: TargetEnv;
  gatewayRestUrl: string;
  gatewayWsUrl: string;
  authMode: AuthMode;
  pollTimeoutMs: number;
  pollIntervalMs: number;
  wsHandshakeTimeoutMs: number;
  matchFoundTimeoutMs: number;
  gameStateTimeoutMs: number;
  gameOverTimeoutMs: number;
  firebaseProjectId?: string;
  firebaseTestApiKey?: string;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`required env var missing: ${name}`);
  return v;
}

function readIntEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`env var ${name} must be a number, got: ${v}`);
  return n;
}

export function loadEnv(): E2EEnv {
  const targetEnv = (process.env.TARGET_ENV ?? 'local') as TargetEnv;
  if (!['local', 'dev', 'stg'].includes(targetEnv)) {
    throw new Error(`unsupported TARGET_ENV: ${targetEnv}`);
  }
  const authMode = (process.env.AUTH_MODE ?? 'dev-token') as AuthMode;
  if (!['dev-token', 'firebase'].includes(authMode)) {
    throw new Error(`unsupported AUTH_MODE: ${authMode}`);
  }

  return {
    targetEnv,
    gatewayRestUrl: requireEnv('GATEWAY_REST_URL'),
    gatewayWsUrl: requireEnv('GATEWAY_WS_URL'),
    authMode,
    pollTimeoutMs: readIntEnv('POLL_TIMEOUT_MS', 5000),
    pollIntervalMs: readIntEnv('POLL_INTERVAL_MS', 200),
    wsHandshakeTimeoutMs: readIntEnv('WS_HANDSHAKE_TIMEOUT_MS', 5000),
    matchFoundTimeoutMs: readIntEnv('MATCH_FOUND_TIMEOUT_MS', 15_000),
    gameStateTimeoutMs: readIntEnv('GAME_STATE_TIMEOUT_MS', 5000),
    gameOverTimeoutMs: readIntEnv('GAME_OVER_TIMEOUT_MS', 10_000),
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    firebaseTestApiKey: process.env.FIREBASE_TEST_API_KEY,
  };
}
