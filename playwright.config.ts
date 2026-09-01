import { defineConfig, devices } from '@playwright/test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetEnv = process.env.TARGET_ENV ?? 'local';
const envFile = path.resolve(__dirname, 'config', `${targetEnv}.env`);
if (!fs.existsSync(envFile)) {
  throw new Error(`config file missing for TARGET_ENV=${targetEnv}: ${envFile}`);
}
dotenv.config({ path: envFile });

// UI テストは実際の React client (docker-compose の `client` サービスが :5173 で
// 配信) を操作する。API テストは gateway に直接話しかけるため gateway の baseURL
// のままにする。client は VITE_* のビルド引数で同じ gateway を指す必要がある。
const clientBaseUrl = process.env.CLIENT_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  projects: [
    {
      name: 'api',
      testDir: './tests/api',
      use: { baseURL: process.env.GATEWAY_REST_URL },
    },
    {
      name: 'ui',
      testDir: './tests/ui',
      use: { ...devices['Desktop Chrome'], baseURL: clientBaseUrl },
    },
  ],
});
