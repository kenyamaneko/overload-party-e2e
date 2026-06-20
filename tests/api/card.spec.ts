import { test, expect } from '../../fixtures/test-data.js';

test('card: master list', async ({ newPlayer }) => {
  const player = await newPlayer('card-master');
  const cards = await player.client.listCards();
  expect(cards.length).toBeGreaterThan(0);
});

test('card: create deck → get deck', async ({ bootBattleReadyPlayer }) => {
  const { player, deck } = await bootBattleReadyPlayer('card-deck', 'SHE');

  expect(deck.deck_id).toBeGreaterThan(0);
  const totalCount = (deck.deck_cards ?? []).reduce(
    (s: number, c: { count: number }) => s + c.count,
    0,
  );
  expect(totalCount).toBe(30);

  const fetched = await player.client.getDeck(deck.deck_id);
  expect(fetched.deck.deck_id).toBe(deck.deck_id);
});
