# overload-party-e2e

End-to-end / cross-service integration tests for the Overload Party microservices.
Tests are written in TypeScript with Playwright Test and exercised **exclusively through gateway**.

## Phase 1 scenarios

| # | Scenario | Surface |
|---|---|---|
| 1 | account: register → login → profile | REST |
| 2 | card: master list → create deck → get deck | REST |
| 3 | shop: list → purchase → propagation to account | REST + eventual consistency |
| 4 | scenario: list → complete | REST |
| 5 | matchmaking + battle: 2 WS clients enqueue → match_found → game_enter | WS |

## Test layers

Two Playwright projects:

- **`api`** (`tests/api/`) — talks to gateway REST/WS directly. Fast cross-service /
  contract coverage. Run: `pnpm test:api`.
- **`ui`** (`tests/ui/`) — drives the **real React client** (`overload-party-client`)
  in a browser against the same dockerized backend. True user-perspective E2E.
  Run: `pnpm test:ui`.

### How UI tests authenticate

UI tests reuse the client's dev-token login path:

1. `seedPlayer` mints a player through the gateway REST API (reusing the same
   `GatewayClient` the API tests use) — optionally completing onboarding.
2. `loginAs` injects the client's `op_dev_auth` localStorage blob *before* page
   scripts run, so `restoreDevAuth()` in the client's `main.tsx` boots it already
   authenticated. No Firebase, no login UI needed for setup.

The token format is `dev-token-<uid>` — identical to the API tests — so the same
seeded player is visible to both REST and the browser.

### Running UI tests

```sh
pnpm compose:up          # now also builds + serves the client on :5173
pnpm exec playwright install chromium   # once
pnpm test:ui
pnpm compose:down
```

> **Build auth:** `compose:up` builds the client image from `../overload-party-client`.
> If the private `@kenyamaneko/*` Cloudsmith registry requires auth, create
> `secrets/CLOUDSMITH_TOKEN` and uncomment the secret wiring in
> `docker/docker-compose.yml` + the client `Dockerfile`.
>
> **Onboarding assumption:** the "returning player → home" test assumes the gateway's
> `/onboarding/complete` sets `onboarding_status=completed` (so the client resumes to
> home rather than the onboarding story). Verify on first run.

## Setup

```sh
export NODE_AUTH_TOKEN=ghp_...   # or in ~/.npmrc, scope: read:packages
pnpm install
pnpm exec playwright install chromium
```

### Docker build 用 token (ローカル e2e のみ)

docker-compose で Go サービスをビルドする際、private な cross-repo Go module を
取得するために **Cross-Repo Deps App** ([ADR-033](../overload-party-common/docs/adr/033-cross-repo-auth-github-app-migration.md))
の installation token が必要。個人 PAT は使用しない (期限切れと個人帰属を避けるため)。

事前に App private key を取得しておく (1 度だけ):

1. Cross-Repo Deps App の owner から `.pem` を受け取り、ローカルの安全な場所に保存 (本リポにコミットしない)
2. App ID と private key path を env に export

`pnpm compose:up` の直前に毎回実行 (token は 1 時間 expire):

```sh
GITHUB_APP_ID=<cross-repo-deps の App ID> \
GITHUB_APP_PRIVATE_KEY=$HOME/.config/overload-party/cross-repo-deps.pem \
  ./docker/scripts/generate-go-modules-token.sh
# → secrets/GO_MODULES_TOKEN に書き出される (0600 mode)
```

`secrets/` は `.gitignore` で除外済み (commit 厳禁)。

## Run

### local (docker-compose)
```sh
GITHUB_APP_ID=... GITHUB_APP_PRIVATE_KEY=... ./docker/scripts/generate-go-modules-token.sh
pnpm compose:up
pnpm test:api
pnpm compose:down
```

`compose:up` は待機するサービスを名前で並べる。一度きりで終了する `pubsub-init` を
待機対象に含めると `--wait` が失敗するため、サービスを追加したらこの一覧にも足す。

### dev / stg (manual; both environments are normally shut down for cost)
One-time setup per developer:
```sh
gcloud auth login
gcloud auth application-default login
```
Required IAM (granted by overload-party-infra Terraform):
- `roles/iam.serviceAccountTokenCreator` on the `e2e-test-runner` SA

Run:
```sh
TARGET_ENV=dev pnpm test:api   # or: TARGET_ENV=stg
```

Auth model: Firebase Admin SDK is initialized with `serviceAccountId` pointing to
`e2e-test-runner@<project>...`. The SDK uses ADC (developer's user account) to
call `iamcredentials.signBlob` on that SA when minting custom tokens. **No SA
keys are issued or stored.**

The Firebase Web API key needed for the `signInWithCustomToken` REST exchange
lives in `config/{dev,stg}.env` directly — it's a public identifier that ships
with any Firebase client, not a secret.

See [ADR-028](../overload-party-common/docs/adr/028-e2e-test-strategy.md) for the rationale.
