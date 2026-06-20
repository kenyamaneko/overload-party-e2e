import { test, expect } from '../../fixtures/test-data.js';
import { pollUntil } from '../../helpers/poll.js';

test('shop: list → purchase → propagation to account', async ({
  env,
  bootBattleReadyPlayer,
}) => {
  const { player } = await bootBattleReadyPlayer('shop-buy', 'SHE');

  const { products } = await player.client.listProducts();
  expect(products.length).toBeGreaterThan(0);

  const factionSet = products.find(
    (p) => p.type === 'faction_set' && !p.is_owned && p.is_active,
  );
  test.skip(!factionSet, 'no purchasable faction_set product available');

  const result = await player.client.purchase({
    product_id: factionSet!.product_id,
    platform: 'android',
    purchase_token: `e2e-token-${factionSet!.product_id}`,
  });
  expect(result.product_id).toBe(factionSet!.product_id);

  // Eventual: shop publishes faction-purchased -> account/card subscribers update.
  await pollUntil(
    async () => {
      const owned = await player.client.listOwnedCards();
      const fromNewFaction = owned.find(
        (c) => c.faction !== 'SHE' && c.faction !== 'Neutral' && c.count > 0,
      );
      return fromNewFaction ?? null;
    },
    {
      timeoutMs: env.pollTimeoutMs * 3,
      intervalMs: env.pollIntervalMs,
      description: 'purchased faction_set granted cards visible via /api/v1/player/cards',
    },
  );
});
