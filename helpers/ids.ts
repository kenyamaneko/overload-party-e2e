import { randomBytes } from 'node:crypto';

const startedAt = Date.now();

export function makeUid(scope: string): string {
  return `e2e-${startedAt}-${scope}-${randomBytes(4).toString('hex')}`;
}

export function makeDeckName(scope: string): string {
  return `e2e-deck-${scope}-${randomBytes(2).toString('hex')}`;
}
