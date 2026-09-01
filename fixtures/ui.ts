import { test as base } from './test-data.js';
import { mintIdentity, type TestIdentity } from './auth.js';
import { GatewayClient } from './gateway-client.js';
import { makeUid } from '../helpers/ids.js';
import { pollUntil } from '../helpers/poll.js';

/**
 * gateway REST API 経由で作成した、ブラウザへ読み込む準備ができたプレイヤー。
 * `identity.idToken` は client が localStorage に保持すべき dev-token。
 */
export interface SeededPlayer {
  uid: string;
  identity: TestIdentity;
  client: GatewayClient;
  displayName: string;
}

export interface SeedOptions {
  displayName?: string;
  /** 設定すると onboarding (name + faction) を実行し、プレイヤーがそのままホームへ復帰するようにする。 */
  faction?: string;
}

export interface UiFixtures {
  /**
   * ブラウザに触れず、gateway 経由でプレイヤーを作成する (API テストと同じ REST client
   * を再利用する)。返される identity は `loginAs` への橋渡しに使う。
   */
  seedPlayer: (scope: string, opts?: SeedOptions) => Promise<SeededPlayer>;
  /**
   * ページのスクリプトが実行される*前*に client の dev-auth blob を localStorage へ
   * 注入し、main.tsx の `restoreDevAuth()` がこのプレイヤーとして認証済みの状態で
   * アプリを起動できるようにする。devLogin() が書き込む形 { uid, displayName, token }
   * と同じ形にする。
   */
  loginAs: (auth: { uid: string; idToken: string; displayName?: string }) => Promise<void>;
}

export const test = base.extend<UiFixtures>({
  seedPlayer: async ({ env }, use) => {
    const factory = async (scope: string, opts: SeedOptions = {}): Promise<SeededPlayer> => {
      const uid = makeUid(scope);
      const identity = await mintIdentity(env, uid);
      const client = new GatewayClient(env.gatewayRestUrl, identity);
      await client.registerPlayer();

      const displayName = opts.displayName ?? `E2E ${scope}`;
      if (opts.faction) {
        await client.setOnboardingName(displayName);
        await client.selectOnboardingFaction(opts.faction);
        // faction は onboarding-faction-set イベント経由で反映されるため、Complete が
        // それを見るのはイベント伝播後になる。一時的な「faction 未選択」409 を越えて
        // リトライする。
        await pollUntil(() => client.completeOnboarding(), {
          timeoutMs: env.pollTimeoutMs,
          intervalMs: env.pollIntervalMs,
          description: `complete onboarding (faction-set propagation, faction=${opts.faction})`,
        });
      }
      return { uid, identity, client, displayName };
    };
    await use(factory);
  },

  loginAs: async ({ context }, use) => {
    const factory = async (auth: {
      uid: string;
      idToken: string;
      displayName?: string;
    }): Promise<void> => {
      await context.addInitScript((data) => {
        window.localStorage.setItem(
          'op_dev_auth',
          JSON.stringify({
            uid: data.uid,
            token: data.idToken,
            displayName: data.displayName ?? 'E2E',
          }),
        );
      }, auth);
    };
    await use(factory);
  },
});

export { expect } from '@playwright/test';
