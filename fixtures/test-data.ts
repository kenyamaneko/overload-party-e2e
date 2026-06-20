import { test as base } from '@playwright/test';
import type { PlayerResponse } from '@kenyamaneko/overload-party-api-gateway';
import type { Deck } from '@kenyamaneko/overload-party-api-card';
import { loadEnv, type E2EEnv } from './env.js';
import { mintIdentity, type TestIdentity } from './auth.js';
import { GatewayClient } from './gateway-client.js';
import { WsClient } from './ws-client.js';
import { makeUid, makeDeckName } from '../helpers/ids.js';
import { pollUntil } from '../helpers/poll.js';

export interface TestPlayer {
  identity: TestIdentity;
  player: PlayerResponse;
  client: GatewayClient;
}

export interface E2EFixtures {
  env: E2EEnv;
  newPlayer: (scope: string) => Promise<TestPlayer>;
  newWsClient: (identity: TestIdentity) => Promise<WsClient>;
  bootBattleReadyPlayer: (scope: string, faction: string) => Promise<{ player: TestPlayer; deck: Deck }>;
}

export const test = base.extend<E2EFixtures>({
  env: async ({}, use) => {
    await use(loadEnv());
  },

  newPlayer: async ({ env }, use) => {
    const factory = async (scope: string): Promise<TestPlayer> => {
      const uid = makeUid(scope);
      const identity = await mintIdentity(env, uid);
      const client = new GatewayClient(env.gatewayRestUrl, identity);
      const player = await client.registerPlayer();
      return { identity, player, client };
    };
    await use(factory);
  },

  newWsClient: async ({ env }, use) => {
    const opened: WsClient[] = [];
    const factory = async (identity: TestIdentity): Promise<WsClient> => {
      const ws = new WsClient({
        url: env.gatewayWsUrl,
        identity,
        handshakeTimeoutMs: env.wsHandshakeTimeoutMs,
      });
      await ws.connect();
      opened.push(ws);
      return ws;
    };
    await use(factory);
    await Promise.all(opened.map((w) => w.close()));
  },

  bootBattleReadyPlayer: async ({ env, newPlayer }, use) => {
    const factory = async (scope: string, faction: string) => {
      const player = await newPlayer(scope);
      await player.client.setOnboardingName(`E2E ${scope}`);
      await player.client.completeOnboarding(faction);

      const cards = await pollUntil(
        async () => {
          const owned = await player.client.listOwnedCards();
          const total = owned.reduce((acc, c) => acc + c.count, 0);
          return total >= 30 ? owned : null;
        },
        {
          timeoutMs: env.pollTimeoutMs * 3,
          intervalMs: env.pollIntervalMs,
          description: `wait for >=30 owned cards (faction=${faction})`,
        },
      );

      const deckCards = pickFirst30(cards);
      const deck = await player.client.createDeck({
        deck_name: makeDeckName(scope),
        cards: deckCards,
      });
      return { player, deck };
    };
    await use(factory);
  },
});

export { expect } from '@playwright/test';

function pickFirst30(
  owned: { card_id: string; art_no: number; count: number }[],
): { card_id: string; art_no: number; count: number }[] {
  const out: { card_id: string; art_no: number; count: number }[] = [];
  let remaining = 30;
  for (const c of owned) {
    if (remaining <= 0) break;
    const take = Math.min(c.count, remaining);
    if (take <= 0) continue;
    out.push({ card_id: c.card_id, art_no: c.art_no, count: take });
    remaining -= take;
  }
  if (remaining > 0) {
    throw new Error(`could not assemble 30 cards from owned pool (short by ${remaining})`);
  }
  return out;
}
