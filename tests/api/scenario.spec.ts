import { test, expect } from '../../fixtures/test-data.js';

test('scenario: list → complete', async ({ bootBattleReadyPlayer }) => {
  const { player } = await bootBattleReadyPlayer('scenario', 'SHE');

  const { episodes } = await player.client.listScenarios();
  expect(episodes.length).toBeGreaterThan(0);

  const target = episodes.find((e) => e.is_unlocked && !e.is_completed);
  test.skip(!target, 'no unlocked-but-uncompleted episode available');

  const result = await player.client.completeScenario(target!.episode_id);
  expect(result.episode_id).toBe(target!.episode_id);

  const after = await player.client.listScenarios();
  const updated = after.episodes.find((e) => e.episode_id === target!.episode_id);
  expect(updated?.is_completed).toBe(true);
});
