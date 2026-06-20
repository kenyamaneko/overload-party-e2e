#!/usr/bin/env bash
# Cross-Repo Deps App の installation token を発行し、
# docker-compose の build secret として使う secrets/GO_MODULES_TOKEN に書き出す。
#
# 必要な env:
#   GITHUB_APP_ID            App ID (Cross-Repo Deps App, 数値)
#   GITHUB_APP_PRIVATE_KEY   private key (.pem) のパス
#
# 発行された token は 1 時間で expire する。compose:up の直前に都度実行する。

set -euo pipefail

: "${GITHUB_APP_ID:?GITHUB_APP_ID is required (Cross-Repo Deps App ID)}"
: "${GITHUB_APP_PRIVATE_KEY:?GITHUB_APP_PRIVATE_KEY is required (path to .pem)}"

if [ ! -f "$GITHUB_APP_PRIVATE_KEY" ]; then
  echo "private key not found: $GITHUB_APP_PRIVATE_KEY" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SECRETS_DIR="$REPO_ROOT/secrets"
OUTPUT_FILE="$SECRETS_DIR/GO_MODULES_TOKEN"

mkdir -p "$SECRETS_DIR"

base64url() {
  openssl base64 -A | tr '+/' '-_' | tr -d '='
}

# GitHub App JWT は最大 10 分の有効期間、発行時刻は server clock skew を考慮し
# 60 秒バックデートする (https://docs.github.com/.../generating-a-jwt)。
JWT_BACKDATE_SEC=60
JWT_LIFETIME_SEC=540

now=$(date +%s)
iat=$((now - JWT_BACKDATE_SEC))
exp=$((now + JWT_LIFETIME_SEC))

header=$(printf '{"alg":"RS256","typ":"JWT"}' | base64url)
payload=$(printf '{"iat":%d,"exp":%d,"iss":"%s"}' "$iat" "$exp" "$GITHUB_APP_ID" | base64url)
signature=$(printf '%s.%s' "$header" "$payload" \
  | openssl dgst -sha256 -sign "$GITHUB_APP_PRIVATE_KEY" \
  | base64url)
jwt="$header.$payload.$signature"

installations=$(curl -fsSL \
  -H "Authorization: Bearer $jwt" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/app/installations)

installation_id=$(printf '%s' "$installations" | jq -r '.[0].id')
if [ -z "$installation_id" ] || [ "$installation_id" = "null" ]; then
  echo "no installation found for app $GITHUB_APP_ID" >&2
  exit 1
fi

token=$(curl -fsSL -X POST \
  -H "Authorization: Bearer $jwt" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/app/installations/$installation_id/access_tokens" \
  | jq -r '.token')

if [ -z "$token" ] || [ "$token" = "null" ]; then
  echo "failed to mint installation token" >&2
  exit 1
fi

umask 077
printf '%s' "$token" > "$OUTPUT_FILE"
echo "wrote $OUTPUT_FILE (expires in ~1h)"
