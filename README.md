# overload-party-e2e

カードゲーム Overload Party のサービス横断 E2E / 結合テストを担うリポジトリ。gateway 経由でのみ各サービスにアクセスする。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| 言語 | TypeScript |
| テストフレームワーク | Playwright Test |
| パッケージ管理 | pnpm |
| 認証 | Firebase Admin SDK |
| ローカル実行基盤 | Docker Compose |

## テスト対象シナリオ (Phase 1)

| # | シナリオ | 経路 |
|---|---|---|
| 1 | account: 登録 → ログイン → プロフィール取得 | REST |
| 2 | card: マスタ一覧 → デッキ作成 → デッキ取得 | REST |
| 3 | shop: 一覧 → 購入 → account への反映 | REST + 結果整合性 |
| 4 | scenario: 一覧 → クリア | REST |
| 5 | matchmaking + battle: WS クライアント2台がキュー登録 → match_found → game_enter | WS |

## テストレイヤー

Playwright のプロジェクトを2つに分けている。

- `api`（`tests/api/`）: gateway の REST/WS に直接アクセスする。サービス横断の疎通確認を高速に行う。実行コマンドは `pnpm test:api`
- `ui`（`tests/ui/`）: 実際の React クライアント（overload-party-client）を同じ Docker 化バックエンドに対してブラウザ操作で動かす。ユーザー視点の E2E。実行コマンドは `pnpm test:ui`

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [セットアップ](docs/SETUP.md) | ローカル実行手順・UI テストの認証方式・dev/stg 実行手順 |
| [ADR-028](https://github.com/kenyamaneko/overload-party-common/tree/main/docs/adr/028-e2e-test-strategy.md)（commonリポジトリ） | E2E テスト戦略の設計判断 |
| [ADR-033](https://github.com/kenyamaneko/overload-party-common/tree/main/docs/adr/033-cross-repo-auth-github-app-migration.md)（commonリポジトリ） | Cross-repo 認証の設計判断 |
| [システム構成図](https://github.com/kenyamaneko/overload-party-common#システム構成図)（commonリポジトリ） | Overload Party 全体の構成図 |
