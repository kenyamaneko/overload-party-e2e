import { test, expect } from '../../fixtures/ui.js';
import { GatewayClient } from '../../fixtures/gateway-client.js';

test.describe('account (UI)', () => {
  test('new user: dev login through the title screen registers a player', async ({ page, env }) => {
    await page.goto('/');

    // タイトル画面はアセット同期が終わるまで「tap to start」を出さないため、
    // 出るまで待ってからタップする。
    await expect(page.getByTestId('title-ready')).toBeVisible();
    await page.getByTestId('title-tap').click();

    // 実際の dev-login オーバーレイ: 表示名を入力して送信する。
    const overlay = page.getByTestId('dev-login');
    await expect(overlay).toBeVisible();
    await overlay.getByRole('textbox').fill('E2E Tester');
    await overlay.getByRole('button').click();

    // devLogin() と resumeOrEnter() が完了するとオーバーレイは閉じる。
    await expect(overlay).toBeHidden();

    // client が uid を発行し、*実際の* gateway に対して登録した。
    // それを読み戻し、プレイヤーがサーバー側に存在することを確かめる。
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
    // gateway REST API 経由で (ブラウザを使わず) シードし、認証情報を注入することで
    // アプリがこの onboarding 完了済みプレイヤーとして認証済みの状態で起動するようにする。
    const seeded = await seedPlayer('ui-account', { faction: 'SHE' });
    await loginAs({
      uid: seeded.uid,
      idToken: seeded.identity.idToken,
      displayName: seeded.displayName,
    });

    await page.goto('/');
    await expect(page.getByTestId('title-ready')).toBeVisible();
    await page.getByTestId('title-tap').click();

    // resumeOrEnter() が onboarding_status=completed を見てホームへ遷移する。
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('player-name')).toHaveText(seeded.displayName);
  });
});
