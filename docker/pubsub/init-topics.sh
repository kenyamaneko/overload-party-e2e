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
  local push_endpoint="${3:-}"
  local body
  if [ -n "$push_endpoint" ]; then
    body="{\"topic\":\"projects/${PROJECT}/topics/${topic}\",\"pushConfig\":{\"pushEndpoint\":\"${push_endpoint}\"},\"ackDeadlineSeconds\":30}"
  else
    body="{\"topic\":\"projects/${PROJECT}/topics/${topic}\",\"ackDeadlineSeconds\":30}"
  fi

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

  # push_endpoint 付き購読は pull 購読と違い配信経路の生命線なので、失敗を黙殺せず止める。
  if [ -n "$push_endpoint" ]; then
    echo "failed to create push subscription ${sub} -> ${topic}: http ${status}" >&2
    exit 1
  fi
  echo "subscription ${sub} creation returned http ${status} (continuing)"
}

# Topics published by each service.
create_topic "matchmaking-events"
create_topic "faction-purchased"
create_topic "premium-updated"
create_topic "player-onboarded"
create_topic "onboarding-faction-set"

# Subscriptions per consumer (gateway, account, card).
# gateway は matchmaking-events を pull 購読するプロセスを持たず HTTP push 受け口
# (POST /internal/v1/pubsub/match-made) で受信するため、この購読のみ push で作成する。
create_sub "matchmaking-events" "matchmaking-events-gateway" "http://gateway:9001/internal/v1/pubsub/match-made"
create_sub "faction-purchased"  "faction-purchased-account"
create_sub "faction-purchased"  "faction-purchased-card"
create_sub "premium-updated"    "premium-updated-account"
create_sub "player-onboarded"   "player-onboarded-account"
create_sub "player-onboarded"   "player-onboarded-card"
create_sub "onboarding-faction-set" "onboarding-faction-set-account"
