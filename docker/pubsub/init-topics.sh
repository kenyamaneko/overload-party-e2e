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
  curl -fsS -X PUT "http://${HOST}/v1/projects/${PROJECT}/subscriptions/${sub}" \
    -H "Content-Type: application/json" \
    -d "{\"topic\":\"projects/${PROJECT}/topics/${topic}\",\"ackDeadlineSeconds\":30}" >/dev/null \
    && echo "created subscription: ${sub} -> ${topic}" \
    || echo "subscription ${sub} already exists or failed (continuing)"
}

# Topics published by each service.
create_topic "matchmaking-events"
create_topic "faction-purchased"
create_topic "premium-updated"
create_topic "player-onboarded"
create_topic "onboarding-faction-set"

# Subscriptions per consumer (gateway, account, card).
create_sub "matchmaking-events" "matchmaking-events-gateway"
create_sub "faction-purchased"  "faction-purchased-account"
create_sub "faction-purchased"  "faction-purchased-card"
create_sub "premium-updated"    "premium-updated-account"
create_sub "player-onboarded"   "player-onboarded-account"
create_sub "player-onboarded"   "player-onboarded-card"
create_sub "onboarding-faction-set" "onboarding-faction-set-account"
