#!/bin/bash
# Creates the Pub/Sub topics + subscriptions the e2e stack needs in the emulator.
# The shapes mirror what overload-party-infra creates in real Google Cloud environments.
set -euo pipefail

PROJECT="${PUBSUB_PROJECT_ID:-overload-party-local}"
HOST="${PUBSUB_EMULATOR_HOST:-pubsub-emulator:8085}"

create_topic() {
  local topic="$1"
  curl -fsS -X PUT "http://${HOST}/v1/projects/${PROJECT}/topics/${topic}" >/dev/null \
    && echo "created topic: ${topic}" \
    || echo "topic ${topic} already exists or failed (continuing)"
}

create_sub() {
  local topic="$1"
  local sub="$2"
  local push_endpoint="$3"
  local body="{\"topic\":\"projects/${PROJECT}/topics/${topic}\",\"pushConfig\":{\"pushEndpoint\":\"${push_endpoint}\"},\"ackDeadlineSeconds\":30}"

  local status
  status=$(curl -sS -o /dev/null -w '%{http_code}' -X PUT "http://${HOST}/v1/projects/${PROJECT}/subscriptions/${sub}" \
    -H "Content-Type: application/json" \
    -d "$body")

  if [ "$status" = "200" ]; then
    echo "created subscription: ${sub} -> ${topic}"
    return 0
  fi
  if [ "$status" = "409" ]; then
    echo "subscription ${sub} already exists (continuing)"
    return 0
  fi

  # 購読の作成失敗はイベントが 1 件も届かない状態を作るので、黙殺せず止める。
  echo "failed to create push subscription ${sub} -> ${topic}: http ${status}" >&2
  exit 1
}

# Topics published by each service.
create_topic "matchmaking-events"
create_topic "faction-acquired"
create_topic "card-pack-purchased"
create_topic "premium-updated"
create_topic "player-onboarded"
create_topic "onboarding-name-set"
create_topic "onboarding-faction-set"

# Subscriptions per consumer (gateway, account, card).
# 消費側はいずれも pull 購読のプロセスを持たず HTTP の受け口で受信するため、購読は push で作成する。
create_sub "matchmaking-events"     "matchmaking-events-gateway"     "http://gateway:9001/internal/v1/pubsub/match-made"
create_sub "faction-acquired"       "faction-acquired-account"       "http://account:9005/internal/v1/pubsub/faction-acquired"
create_sub "card-pack-purchased"    "card-pack-purchased-card"       "http://card:9003/internal/v1/pubsub/card-pack-purchased"
create_sub "premium-updated"        "premium-updated-account"        "http://account:9005/internal/v1/pubsub/premium-updated"
create_sub "player-onboarded"       "player-onboarded-account"       "http://account:9005/internal/v1/pubsub/player-onboarded"
create_sub "player-onboarded"       "player-onboarded-card"          "http://card:9003/internal/v1/pubsub/player-onboarded"
create_sub "onboarding-name-set"    "onboarding-name-set-account"    "http://account:9005/internal/v1/pubsub/onboarding-name-set"
create_sub "onboarding-faction-set" "onboarding-faction-set-account" "http://account:9005/internal/v1/pubsub/onboarding-faction-set"
