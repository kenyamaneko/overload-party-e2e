# セットアップ

## 初回セットアップ

```sh
export NODE_AUTH_TOKEN=ghp_...   # または ~/.npmrc に scope: read:packages で設定
pnpm install
pnpm exec playwright install chromium
```

### Docker build 用 token (ローカル e2e のみ)

docker-compose で Go サービスをビルドする際、private な cross-repo Go module を
取得するために **Cross-Repo Deps App**（[ADR-033](https://github.com/kenyamaneko/overload-party-common/tree/main/docs/adr/033-cross-repo-auth-github-app-migration.md)）
の installation token が必要。個人 PAT は使用しない（期限切れと個人帰属を避けるため）。

事前に App private key を取得しておく（1 度だけ）:

1. Cross-Repo Deps App の owner から `.pem` を受け取り、ローカルの安全な場所に保存（本リポにコミットしない）
2. App ID と private key path を env に export

`pnpm compose:up` の直前に毎回実行する（token は 1 時間で expire する）:

```sh
GITHUB_APP_ID=<cross-repo-deps の App ID> \
GITHUB_APP_PRIVATE_KEY=$HOME/.config/overload-party/cross-repo-deps.pem \
  ./docker/scripts/generate-go-modules-token.sh
# → secrets/GO_MODULES_TOKEN に書き出される (0600 mode)
```

`secrets/` は `.gitignore` で除外済み（commit 厳禁）。

## UI テストの認証

UI テストはクライアントの dev-token ログイン経路を再利用する。

1. `seedPlayer` が gateway REST API 経由でプレイヤーを作成する（API テストと同じ `GatewayClient` を再利用、オンボーディング完了もオプションで可能）
2. `loginAs` がページのスクリプト実行前にクライアントの `op_dev_auth` localStorage を注入し、クライアントの `main.tsx` の `restoreDevAuth()` が認証済み状態で起動する。Firebase もログイン UI 操作も不要

トークン形式は `dev-token-<uid>`（API テストと同一）で、同じ seed 済みプレイヤーが REST とブラウザの両方から見える。

### UI テストの実行

```sh
pnpm compose:up          # client を :5173 でビルド + 起動する
pnpm exec playwright install chromium   # 初回のみ
pnpm test:ui
pnpm compose:down
```

> **ビルド認証**: `compose:up` は `../overload-party-client` からクライアントイメージをビルドする。private な `@kenyamaneko/*` Cloudsmith レジストリの認証が要る場合は `secrets/CLOUDSMITH_TOKEN` を作成し、`docker/docker-compose.yml` とクライアントの `Dockerfile` の secret 配線をコメントアウト解除する。
>
> **オンボーディング前提**: 「復帰プレイヤー → ホーム」テストは gateway の `/onboarding/complete` が `onboarding_status=completed` を設定する前提（クライアントがオンボーディングストーリーではなくホームへ復帰する）。初回実行時に確認する。

## 実行

### ローカル (docker-compose)

```sh
GITHUB_APP_ID=... GITHUB_APP_PRIVATE_KEY=... ./docker/scripts/generate-go-modules-token.sh
pnpm compose:up
pnpm test:api
pnpm compose:down
```

`compose:up` は待機するサービスを名前で並べる。一度きりで終了する `pubsub-init` を
待機対象に含めると `--wait` が失敗するため、サービスを追加したらこの一覧にも足す。

### dev / stg (手動実行。両環境ともコスト削減のため通常は停止している)

開発者ごとに初回のみ:

```sh
gcloud auth login
gcloud auth application-default login
```

必要な IAM（overload-party-infra の Terraform で付与）:

- `e2e-test-runner` SA への `roles/iam.serviceAccountTokenCreator`

実行:

```sh
TARGET_ENV=dev pnpm test:api   # または: TARGET_ENV=stg
```

認証方式: Firebase Admin SDK を `serviceAccountId` に `e2e-test-runner@<project>...` を指定して初期化する。SDK は ADC（開発者本人のアカウント）でその SA の `iamcredentials.signBlob` を呼び出しカスタムトークンを発行する。SA キーの発行・保存は行わない。

`signInWithCustomToken` の REST 交換に使う Firebase Web API key は `config/{dev,stg}.env` に直接置いている。これは Firebase クライアントに同梱される公開識別子であり、機密情報ではない。

設計判断の背景は [ADR-028](https://github.com/kenyamaneko/overload-party-common/tree/main/docs/adr/028-e2e-test-strategy.md) を参照。
