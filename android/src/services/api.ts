export interface AuthResponse {
  user_id: string;
  auth_code: number;
  auth_msg: string;
}

export interface RegisterResponse extends AuthResponse {
  confirmation_required: boolean;
}

import { pushDebugLog } from '@/store/debugLogStore';
import CookieManager from '@react-native-cookies/cookies';
import { getSavedAccounts } from '@/services/accountStorage';

export interface DashboardLoginResponse {
  user: {
    id: string;
    username: string;
  };
}

function buildUrl(serverUrl: string, path: string): string {
  const base = serverUrl.replace(/\/+$/, '');
  return `${base}/api/v1/${path}`;
}

async function postJson<T>(serverUrl: string, path: string, body: Record<string, unknown>): Promise<T> {
  const url = buildUrl(serverUrl, path);
  const t0 = Date.now();
  pushDebugLog('api', `POST ${path}`);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const result = await response.json();
      message = result.detail?.error || result.message || message;
    } catch { /* ignore */ }
    pushDebugLog('api', `✗ ${path} ${response.status} ${Date.now() - t0}ms`);
    throw new Error(message);
  }

  const text = await response.text();
  pushDebugLog('api', `✓ ${path} ${response.status} ${Date.now() - t0}ms`);
  if (!text.trim()) return {} as T;
  return JSON.parse(text);
}

function buildAppUrl(serverUrl: string, path: string): string {
  const base = serverUrl.replace(/\/+$/, '');
  return `${base}/api/${path}`;
}

async function postAppJson<T>(
  serverUrl: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const url = buildAppUrl(serverUrl, path);
  const t0 = Date.now();
  pushDebugLog('api', `POST app/${path}`);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const result = await response.json();
      message = result.error || result.detail?.error || result.message || message;
    } catch {
      /* ignore */
    }
    pushDebugLog(
      'api',
      `✗ app/${path} ${response.status} ${Date.now() - t0}ms`,
    );
    throw new Error(message);
  }

  try {
    await CookieManager.flush();
  } catch {
    /* ignore */
  }

  const text = await response.text();
  pushDebugLog('api', `✓ app/${path} ${response.status} ${Date.now() - t0}ms`);
  if (!text.trim()) return {} as T;
  return JSON.parse(text) as T;
}

export async function authenticateUser(
  serverUrl: string,
  username: string,
  password: string,
  language = 'en',
): Promise<AuthResponse> {
  return postJson<AuthResponse>(serverUrl, 'authenticate_user', {
    username,
    password,
    language,
  });
}

export async function loginDashboardSession(
  serverUrl: string,
  username: string,
  password: string,
): Promise<DashboardLoginResponse> {
  return postAppJson<DashboardLoginResponse>(serverUrl, 'auth/login', {
    username,
    password,
  });
}

export async function logoutDashboardSession(serverUrl: string): Promise<void> {
  await postAppJson<{ success: boolean }>(serverUrl, 'auth/logout');
}

export async function restoreDashboardSession(
  serverUrl: string,
  email: string,
): Promise<boolean> {
  const accounts = await getSavedAccounts();
  const matched = accounts.find(
    account => account.serverUrl === serverUrl && account.email === email,
  );
  if (!matched?.password) {
    return false;
  }
  try {
    await loginDashboardSession(serverUrl, matched.email, matched.password);
    return true;
  } catch {
    return false;
  }
}

export async function registerUser(
  serverUrl: string,
  username: string,
  password: string,
  language = 'en',
): Promise<RegisterResponse> {
  return postJson<RegisterResponse>(serverUrl, 'register_user', {
    username,
    password,
    language,
  });
}

export async function confirmRegistration(
  serverUrl: string,
  email: string,
  code: string,
): Promise<AuthResponse> {
  return postJson<AuthResponse>(serverUrl, 'confirm_registration', {
    email,
    confirmation_code: code,
  });
}

export async function resendConfirmationCode(
  serverUrl: string,
  email: string,
  language = 'en',
): Promise<AuthResponse> {
  return postJson<AuthResponse>(serverUrl, 'resend_confirmation_code', {
    email,
    language,
  });
}
