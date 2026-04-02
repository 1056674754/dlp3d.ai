export interface AuthResponse {
  user_id: string;
  auth_code: number;
  auth_msg: string;
}

export interface RegisterResponse extends AuthResponse {
  confirmation_required: boolean;
}

function buildUrl(serverUrl: string, path: string): string {
  const base = serverUrl.replace(/\/+$/, '');
  return `${base}/api/v1/${path}`;
}

async function postJson<T>(serverUrl: string, path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(buildUrl(serverUrl, path), {
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
    throw new Error(message);
  }

  const text = await response.text();
  if (!text.trim()) return {} as T;
  return JSON.parse(text);
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
