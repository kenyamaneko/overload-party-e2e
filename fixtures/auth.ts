import { initializeApp, type App } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import type { E2EEnv } from './env.js';

export interface TestIdentity {
  uid: string;
  idToken: string;
}

export async function mintIdentity(env: E2EEnv, uid: string): Promise<TestIdentity> {
  if (env.authMode === 'dev-token') {
    return { uid, idToken: `dev-token-${uid}` };
  }
  return mintFirebaseIdentity(env, uid);
}

let cachedAdminApp: App | undefined;

function getAdminApp(env: E2EEnv): App {
  if (cachedAdminApp) return cachedAdminApp;
  const projectId = env.firebaseProjectId;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required for AUTH_MODE=firebase');

  // ADC + serviceAccountId: Admin SDK はこの SA に対して iamcredentials.signBlob
  // を呼ぶことで JWT に署名する。呼び出し元 (`gcloud auth application-default login`
  // で認証した開発者のユーザーアカウント) はこの SA に対する
  // roles/iam.serviceAccountTokenCreator が必要。SA キーは発行しない。
  cachedAdminApp = initializeApp(
    {
      projectId,
      serviceAccountId: `e2e-test-runner@${projectId}.iam.gserviceaccount.com`,
    },
    `e2e-${projectId}`,
  );
  return cachedAdminApp;
}

async function mintFirebaseIdentity(env: E2EEnv, uid: string): Promise<TestIdentity> {
  const apiKey = env.firebaseTestApiKey;
  if (!apiKey) throw new Error('FIREBASE_TEST_API_KEY is required for AUTH_MODE=firebase');

  const customToken = await getAdminAuth(getAdminApp(env)).createCustomToken(uid);

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`firebase signInWithCustomToken failed: ${res.status} ${body}`);
  }
  const data = (await res.json()) as { idToken: string };
  return { uid, idToken: data.idToken };
}
