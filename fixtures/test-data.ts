import { test as base } from '@playwright/test';
import type { PlayerResponse } from '@kenyamaneko/overload-party-api-gateway';
import type { Deck, PlayerCardWithDef } from '@kenyamaneko/overload-party-api-card';
import {
  INITIAL_VALUES,
  RESTRICTION_COPY_COUNT,
  type Restriction,
} from '@kenyamaneko/overload-party-game-design-constants';
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
      await player.client.selectOnboardingFaction(faction);
      // faction は onboarding-faction-set イベント経由で反映されるため、Complete が
      // それを見るのはイベント伝播後になる。一時的な「faction 未選択」409 を越えて
      // リトライする。
      await pollUntil(() => player.client.completeOnboarding(), {
        timeoutMs: env.pollTimeoutMs,
        intervalMs: env.pollIntervalMs,
        description: `complete onboarding (faction-set propagation, faction=${faction})`,
      });

      const cards = await pollUntil(
        async () => {
          const owned = await player.client.listOwnedCards();
          const total = owned.reduce((acc, c) => acc + c.count, 0);
          return total >= INITIAL_VALUES.deckSize ? owned : null;
        },
        {
          timeoutMs: env.pollTimeoutMs * 3,
          intervalMs: env.pollIntervalMs,
          description: `wait for >=${INITIAL_VALUES.deckSize} owned cards (faction=${faction})`,
        },
      );

      const deckCards = pickDeckCards(cards);

      // デッキは faction に加え、1つの product とその routine/special の施策を宣言する。
      // card の products エンドポイントが各 product の施策を保持しているため、ここで解決する。
      const products = await player.client.listCardProducts();
      const product = products.find((p) => p.faction === faction);
      if (!product) {
        throw new Error(`no card product found for faction ${faction}`);
      }
      const routine = product.initiatives.find((i) => i.kind === 'routine');
      const special = product.initiatives.find((i) => i.kind === 'special');
      if (!routine || !special) {
        throw new Error(`product ${product.product_id} is missing a routine or special initiative`);
      }

      const deck = await player.client.createDeck({
        deck_name: makeDeckName(scope),
        faction,
        product_id: product.product_id,
        routine_id: routine.initiative_id,
        special_id: special.initiative_id,
        cards: deckCards,
      });
      return { player, deck };
    };
    await use(factory);
  },
});

export { expect } from '@playwright/test';

interface DeckCardEntry {
  card_id: string;
  art_no: number;
  count: number;
}

/**
 * 所持カードプールから正規のデッキを組み立てる。ちょうど INITIAL_VALUES.deckSize 枚とし、
 * card_id ごとに restriction のコピー上限で頭打ちにする (art_no のバリエーションを
 * 合算した上で、card サービスの card_id 単位の検証と揃える)。
 * @param owned 所持カード (定義と枚数を含む)
 * @returns 選択されたデッキカードのエントリ (card_id, art_no, count)
 */
function pickDeckCards(owned: PlayerCardWithDef[]): DeckCardEntry[] {
  const out: DeckCardEntry[] = [];
  const takenByCardId = new Map<string, number>();
  let remaining = INITIAL_VALUES.deckSize;
  for (const c of owned) {
    if (remaining <= 0) break;
    const copyLimit = RESTRICTION_COPY_COUNT[c.restriction as Restriction];
    const room = copyLimit - (takenByCardId.get(c.card_id) ?? 0);
    const take = Math.min(c.count, room, remaining);
    if (take <= 0) continue;
    out.push({ card_id: c.card_id, art_no: c.art_no, count: take });
    takenByCardId.set(c.card_id, (takenByCardId.get(c.card_id) ?? 0) + take);
    remaining -= take;
  }
  if (remaining > 0) {
    throw new Error(
      `could not assemble ${INITIAL_VALUES.deckSize} cards from owned pool (short by ${remaining})`,
    );
  }
  return out;
}
