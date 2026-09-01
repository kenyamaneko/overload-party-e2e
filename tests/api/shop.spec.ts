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

  // onboarding で選んだ faction とは別の faction_set を購入し、付与されるカードを
  // onboarding による付与と区別できるようにする。shop の is_owned は shop での購入
  // のみを反映し (onboarding の無料付与は含まない) ため、onboarding した faction を
  // 特定する用途には使えない。
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

  // 結果整合性: shop が card-pack-purchased を発行し、card が購入した faction の
  // カードを付与する。
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
