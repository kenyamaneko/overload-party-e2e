import { test, expect } from '../../fixtures/test-data.js';

test('account: register → login → profile', async ({ newPlayer }) => {
  const { identity, player, client } = await newPlayer('account');

  expect(player.firebase_uid).toBe(identity.uid);
  expect(player.player_id).toBeTruthy();

  const loggedIn = await client.loginPlayer();
  expect(loggedIn.player_id).toBe(player.player_id);

  const profile = await client.getPlayer();
  expect(profile.player_id).toBe(player.player_id);
  expect(profile.firebase_uid).toBe(identity.uid);
});
