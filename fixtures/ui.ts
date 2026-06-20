import { test as base } from './test-data.js';
import { mintIdentity, type TestIdentity } from './auth.js';
import { GatewayClient } from './gateway-client.js';
import { makeUid } from '../helpers/ids.js';

/**
 * A player created via the gateway REST API, ready to be loaded in the browser.
 * `identity.idToken` is the dev-token the client must carry in localStorage.
 */
export interface SeededPlayer {
  uid: string;
  identity: TestIdentity;
  client: GatewayClient;
  displayName: string;
}

export interface SeedOptions {
  displayName?: string;
  /** When set, runs onboarding (name + faction) so the player resumes straight to home. */
  faction?: string;
}

export interface UiFixtures {
  /**
   * Creates a player through the gateway (reusing the same REST client the API tests
   * use) without touching the browser. The returned identity bridges into `loginAs`.
   */
  seedPlayer: (scope: string, opts?: SeedOptions) => Promise<SeededPlayer>;
  /**
   * Injects the client's dev-auth blob into localStorage *before* any page script runs,
   * so `restoreDevAuth()` in main.tsx boots the app already authenticated as this player.
   * Mirrors the shape devLogin() writes: { uid, displayName, token }.
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
        await client.completeOnboarding(opts.faction);
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
