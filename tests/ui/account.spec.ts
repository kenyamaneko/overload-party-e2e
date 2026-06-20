import { test, expect } from '../../fixtures/ui.js';
import { GatewayClient } from '../../fixtures/gateway-client.js';

/**
 * UI counterpart of tests/api/account.spec.ts: instead of calling the gateway
 * directly, we drive the real React client in a browser and assert the same
 * register/login chain happens through the actual screens.
 *
 * Prereq: the full stack (gateway + backends + client) must be up via
 * `pnpm compose:up`. The client is served on CLIENT_BASE_URL (default :5173).
 */
test.describe('account (UI)', () => {
  test('new user: dev login through the title screen registers a player', async ({ page, env }) => {
    await page.goto('/');

    // Title screen gates "tap to start" behind asset sync; wait for it, then tap.
    await expect(page.getByTestId('title-ready')).toBeVisible();
    await page.getByTestId('title-tap').click();

    // Real dev-login overlay: type a display name and submit.
    const overlay = page.getByTestId('dev-login');
    await expect(overlay).toBeVisible();
    await overlay.getByRole('textbox').fill('E2E Tester');
    await overlay.getByRole('button').click();

    // Overlay closes once devLogin() + resumeOrEnter() complete.
    await expect(overlay).toBeHidden();

    // The client minted a uid and registered against the *real* gateway.
    // Read it back and confirm the player exists server-side.
    const stored = await page.evaluate(() => window.localStorage.getItem('op_dev_auth'));
    expect(stored).toBeTruthy();
    const { uid, token } = JSON.parse(stored!) as { uid: string; token: string };
    expect(token).toBe(`dev-token-${uid}`);

    const client = new GatewayClient(env.gatewayRestUrl, { uid, idToken: token });
    const player = await client.getPlayer();
    expect(player.firebase_uid).toBe(uid);
  });

  test('returning player: seeded onboarding-complete player lands on home', async ({
    page,
    seedPlayer,
    loginAs,
  }) => {
    // Seed via the gateway REST API (no browser), then inject the auth blob so the
    // app boots already authenticated as this onboarding-complete player.
    const seeded = await seedPlayer('ui-account', { faction: 'SHE' });
    await loginAs({
      uid: seeded.uid,
      idToken: seeded.identity.idToken,
      displayName: seeded.displayName,
    });

    await page.goto('/');
    await expect(page.getByTestId('title-ready')).toBeVisible();
    await page.getByTestId('title-tap').click();

    // resumeOrEnter() sees onboarding_status=completed → home.
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('player-name')).toHaveText(seeded.displayName);
  });
});
