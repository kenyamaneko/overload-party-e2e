import { test, expect } from '../../fixtures/test-data.js';

// skip 中: エピソードマスタに正規のシードが無い (scenario.scenario_episodes を
// 投入するリポ内artifactが無く、単体テスト用fixtureにしか存在しない) ため、
// listScenariosは空を返す。kenyamaneko/overload-party-scenario#28 で追跡している。
test.skip('scenario: list → complete', async ({ bootBattleReadyPlayer }) => {
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
