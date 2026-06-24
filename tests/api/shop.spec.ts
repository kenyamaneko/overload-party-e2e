import { test, expect } from '../../fixtures/test-data.js';
import { pollUntil } from '../../helpers/poll.js';

test('shop: list → purchase → propagation to account', async ({
  env,
  bootBattleReadyPlayer,
}) => {
  const onboardedFaction = 'SHE';
  const { player } = await bootBattleReadyPlayer('shop-buy', onboardedFaction);

  const { products } = await player.client.listProducts();
  expect(products.length).toBeGreaterThan(0);

  // Buy a faction_set for a faction other than the onboarded one, so the granted cards are
  // distinguishable from the onboarding grant. shop's is_owned reflects only shop purchases
  // (not the free onboarding grant), so it cannot identify the onboarded faction.
  const factionSet = products.find(
    (p) =>
      p.type === 'faction_set' &&
      p.is_active &&
      (p.content as { faction?: string }).faction !== onboardedFaction,
  );
  test.skip(!factionSet, 'no purchasable faction_set for a non-onboarded faction');
  const purchasedFaction = (factionSet!.content as { faction?: string }).faction;

  const result = await player.client.purchase({
    product_id: factionSet!.product_id,
    platform: 'android',
    purchase_token: `e2e-token-${factionSet!.product_id}`,
  });
  expect(result.product_id).toBe(factionSet!.product_id);

  // Eventual: shop publishes card-pack-purchased -> card grants the purchased faction's cards.
  await pollUntil(
    async () => {
      const owned = await player.client.listOwnedCards();
      const fromPurchasedFaction = owned.find(
        (c) => c.faction === purchasedFaction && c.count > 0,
      );
      return fromPurchasedFaction ?? null;
    },
    {
      timeoutMs: env.pollTimeoutMs * 3,
      intervalMs: env.pollIntervalMs,
      description: `purchased faction_set granted ${purchasedFaction} cards`,
    },
  );
});
