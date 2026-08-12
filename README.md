# overload-party-e2e

カードゲーム Overload Party のサービス横断 E2E / 結合テストを担うリポジトリ。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| 言語 | TypeScript |
| テストフレームワーク | Playwright Test |
| パッケージ管理 | pnpm |
| 認証 | Firebase Admin SDK |
| ローカル実行基盤 | Docker Compose |

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [セットアップ](docs/SETUP.md) | ローカル実行手順・UI テストの認証方式・dev/stg 実行手順 |
| [ADR-028](https://github.com/kenyamaneko/overload-party-common/tree/main/docs/adr/028-e2e-test-strategy.md)（commonリポジトリ） | E2E テスト戦略の設計判断 |
| [ADR-033](https://github.com/kenyamaneko/overload-party-common/tree/main/docs/adr/033-cross-repo-auth-github-app-migration.md)（commonリポジトリ） | Cross-repo 認証の設計判断 |
| [システム構成図](https://github.com/kenyamaneko/overload-party-common#システム構成図)（commonリポジトリ） | Overload Party 全体の構成図 |
