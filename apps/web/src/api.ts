import type {
  BattleState,
  CharacterView,
  Gender,
  OnlinePlayerSummary,
  RankEntry,
  RoleClass,
  ServerRealm,
} from '@hxsg/shared';

const TOKEN_KEY = 'hxsg_token';
const REALM_KEY = 'hxsg_realm';

export function getSavedToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSavedToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getSavedRealm(): string {
  return localStorage.getItem(REALM_KEY) || 'dingjunshan';
}

export function setSavedRealm(realmId: string) {
  localStorage.setItem(REALM_KEY, realmId);
}

async function request<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const token = getSavedToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `请求失败 (${res.status})`);
  }
  return data as T;
}

export interface RealmWithOnline extends ServerRealm {
  onlineCount: number;
}

export interface AuthResponse {
  accountId: number;
  username: string;
  isGm: boolean;
  token: string;
}

export interface MeResponse {
  account: { accountId: number; username: string; isGm: boolean };
  character: CharacterView | null;
  activeBattle: BattleState | null;
  mapPlayers: OnlinePlayerSummary[];
}

export const api = {
  getRealms: () => request<RealmWithOnline[]>('/api/realms'),
  register: (username: string, password: string) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  login: (username: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: (realmId: string) => request<MeResponse>(`/api/me?realmId=${encodeURIComponent(realmId)}`),
  createCharacter: (payload: {
    realmId: string;
    name: string;
    roleClass: RoleClass;
    gender: Gender;
  }) =>
    request<{ character: CharacterView }>('/api/character', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  allocateStats: (payload: {
    realmId: string;
    vit?: number;
    str?: number;
    int?: number;
    agi?: number;
  }) =>
    request<{ character: CharacterView }>('/api/character/allocate-stats', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  resetStats: (realmId: string) =>
    request<{ character: CharacterView }>('/api/character/reset-stats', {
      method: 'POST',
      body: JSON.stringify({ realmId }),
    }),
  allocateResist: (payload: {
    realmId: string;
    phys?: number;
    chaos?: number;
    seal?: number;
    trap?: number;
    magic?: number;
  }) =>
    request<{ character: CharacterView }>('/api/character/allocate-resist', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  moveMap: (realmId: string, targetMapId: string) =>
    request<{ character: CharacterView; mapPlayers: OnlinePlayerSummary[] }>('/api/map/move', {
      method: 'POST',
      body: JSON.stringify({ realmId, targetMapId }),
    }),
  restInn: (realmId: string) =>
    request<{ character: CharacterView }>('/api/facility/inn', {
      method: 'POST',
      body: JSON.stringify({ realmId }),
    }),
  buyItem: (realmId: string, itemId: string, quantity = 1) =>
    request<{ character: CharacterView }>('/api/facility/shop/buy', {
      method: 'POST',
      body: JSON.stringify({ realmId, itemId, quantity }),
    }),
  useItem: (realmId: string, itemId: string) =>
    request<{ character: CharacterView }>('/api/inventory/use', {
      method: 'POST',
      body: JSON.stringify({ realmId, itemId }),
    }),
  recruitGeneral: (realmId: string, templateId: string) =>
    request<{ character: CharacterView }>('/api/generals/recruit', {
      method: 'POST',
      body: JSON.stringify({ realmId, templateId }),
    }),
  setGeneralSlot: (realmId: string, generalId: number, slot: number | null) =>
    request<{ character: CharacterView }>('/api/generals/slot', {
      method: 'POST',
      body: JSON.stringify({ realmId, generalId, slot }),
    }),
  getRankings: (realmId: string, sort: 'level' | 'silver' | 'gold' = 'level') =>
    request<{ rankings: RankEntry[] }>(
      `/api/rankings?realmId=${encodeURIComponent(realmId)}&sort=${sort}`,
    ),
  startBattle: (realmId: string, enemyGroupId: string) =>
    request<{ battle: BattleState }>('/api/battle/start', {
      method: 'POST',
      body: JSON.stringify({ realmId, enemyGroupId }),
    }),
  battleAction: (payload: {
    realmId: string;
    action: 'attack' | 'skill' | 'defend' | 'item' | 'capture' | 'flee';
    targetUid?: string;
    skillId?: string;
    itemId?: string;
  }) =>
    request<{ battle: BattleState; character: CharacterView }>('/api/battle/action', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  gmGrant: (payload: {
    realmId: string;
    passcode?: string;
    silver?: number;
    gold?: number;
    exp?: number;
    fullHeal?: boolean;
    grantGeneralId?: string;
    announce?: string;
  }) =>
    request<{ character: CharacterView }>('/api/gm/grant', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
