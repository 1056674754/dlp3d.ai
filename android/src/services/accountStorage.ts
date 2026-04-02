import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCOUNTS_KEY = '@dlp3d:saved_accounts';

export interface SavedAccount {
  serverUrl: string;
  email: string;
  password: string;
  userId: string;
  lastUsed: number;
}

function accountKey(account: { serverUrl: string; email: string }): string {
  return `${account.serverUrl}::${account.email}`;
}

export async function getSavedAccounts(): Promise<SavedAccount[]> {
  const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveAccounts(accounts: SavedAccount[]): Promise<void> {
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export async function saveAccount(account: SavedAccount): Promise<void> {
  const accounts = await getSavedAccounts();
  const key = accountKey(account);
  const idx = accounts.findIndex(a => accountKey(a) === key);
  const entry: SavedAccount = { ...account, lastUsed: Date.now() };

  if (idx >= 0) {
    accounts[idx] = entry;
  } else {
    accounts.push(entry);
  }

  await saveAccounts(accounts);
}

export async function removeAccount(serverUrl: string, email: string): Promise<void> {
  const accounts = await getSavedAccounts();
  const key = accountKey({ serverUrl, email });
  await saveAccounts(accounts.filter(a => accountKey(a) !== key));
}

export async function getRecentAccount(): Promise<SavedAccount | null> {
  const accounts = await getSavedAccounts();
  if (accounts.length === 0) return null;
  accounts.sort((a, b) => b.lastUsed - a.lastUsed);
  return accounts[0];
}
