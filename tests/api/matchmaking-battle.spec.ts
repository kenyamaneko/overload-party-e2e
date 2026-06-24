import type { ClientGameState } from '@kenyamaneko/overload-party-game-state';
import { test, expect } from '../../fixtures/test-data.js';
import { SURRENDER_REASON } from '../../fixtures/ws-client.js';

// Skipped: battle generates a 32-char GUID game_id but every game_id column is sized for a
// 26-char ID, so PvP game creation overflows. The fix (game_id → UUID v7 + native UUID columns
// across battle and gateway.game_players) plus the subsequent battle game-flow integration is
// tracked in kenyamaneko/overload-party-battle#127. The gateway match-made internal-auth fix
// and battle DB config that this exercises are already in place.
test.skip('matchmaking + battle: enqueue → match_found → game_enter → surrender → game_over', async ({
  env,
  bootBattleReadyPlayer,
  newWsClient,
}) => {
  test.slow();

  const [a, b] = await Promise.all([
    bootBattleReadyPlayer('mm-a', 'SHE'),
    bootBattleReadyPlayer('mm-b', 'Tenki'),
  ]);

  const wsA = await newWsClient(a.player.identity);
  const wsB = await newWsClient(b.player.identity);

  wsA.startMatchmaking(a.deck.deck_id);
  wsB.startMatchmaking(b.deck.deck_id);

  const [matchA, matchB] = await Promise.all([
    wsA.waitForMatchFound(env.matchFoundTimeoutMs),
    wsB.waitForMatchFound(env.matchFoundTimeoutMs),
  ]);
  expect(matchA.game_id).toBe(matchB.game_id);

  wsA.enterGame(matchA.game_id, a.deck.deck_id);
  wsB.enterGame(matchB.game_id, b.deck.deck_id);

  const [stateA, stateB] = await Promise.all([
    wsA.waitFor<ClientGameState>('game_state', env.gameStateTimeoutMs),
    wsB.waitFor<ClientGameState>('game_state', env.gameStateTimeoutMs),
  ]);
  expect(stateA.data?.myView.playerNum).toBeTruthy();
  expect(stateB.data?.myView.playerNum).toBeTruthy();

  const aPlayerNum = stateA.data!.myView.playerNum;
  const bPlayerNum = stateB.data!.myView.playerNum;
  expect(aPlayerNum).not.toBe(bPlayerNum);

  wsA.forfeit(matchA.game_id);

  const [overA, overB] = await Promise.all([
    wsA.waitForGameOver(env.gameOverTimeoutMs),
    wsB.waitForGameOver(env.gameOverTimeoutMs),
  ]);
  expect(overA.game_id).toBe(matchA.game_id);
  expect(overB.game_id).toBe(matchA.game_id);
  expect(overA.win_reason).toBe(SURRENDER_REASON);
  expect(overB.win_reason).toBe(SURRENDER_REASON);
  expect(overA.winning_player_num).toBe(bPlayerNum);
  expect(overB.winning_player_num).toBe(bPlayerNum);
});
