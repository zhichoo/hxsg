import type {
  BattleState,
  CharacterView,
  EquipmentSlot,
  Gender,
  OnlinePlayerSummary,
  RankEntry,
  RoleClass,
  ServerRealm,
  TreasureDigResult,
} from '@hxsg/shared';
import { isMappRuntime, platformHttpRequest, platformStorage } from './platform/host';

const TOKEN_KEY = 'hxsg_token';
const REALM_KEY = 'hxsg_realm';

let cachedToken: string | null = (() => {
  if (isMappRuntime()) return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
})();

let cachedRealm: string = (() => {
  if (isMappRuntime()) return 'dingjunshan';
  try {
    return window.localStorage.getItem(REALM_KEY) || 'dingjunshan';
  } catch {
    return 'dingjunshan';
  }
})();

export function getSavedToken(): string | null {
  return cachedToken;
}

export function setSavedToken(token: string | null) {
  cachedToken = token;
  if (token) void platformStorage.setItem(TOKEN_KEY, token);
  else void platformStorage.removeItem(TOKEN_KEY);
}

export function getSavedRealm(): string {
  return cachedRealm;
}

export async function loadSavedRealm(): Promise<string> {
  const val = await platformStorage.getItem(REALM_KEY);
  if (val) cachedRealm = val;
  return cachedRealm;
}

export function setSavedRealm(realmId: string) {
  cachedRealm = realmId;
  void platformStorage.setItem(REALM_KEY, realmId);
}

function callEndpoint<T>(
  endpointName: string,
  webPath: string,
  opts: {
    method?: 'GET' | 'POST';
    query?: Record<string, string>;
    body?: unknown;
  } = {},
): Promise<T> {
  return platformHttpRequest<T>(endpointName, webPath, {
    ...opts,
    token: cachedToken,
  });
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
  account: {
    accountId: number;
    username: string;
    isGm: boolean;
    authSource?: 'local' | 'platform';
    trustLevel?: number;
  };
  character: CharacterView | null;
  activeBattle: BattleState | null;
  mapPlayers: OnlinePlayerSummary[];
}

export const api = {
  getRealms: () => callEndpoint<RealmWithOnline[]>('realms', '/api/realms'),
  register: (username: string, password: string) =>
    callEndpoint<AuthResponse>('authRegister', '/api/auth/register', {
      method: 'POST',
      body: { username, password },
    }),
  login: (username: string, password: string) =>
    callEndpoint<AuthResponse>('authLogin', '/api/auth/login', {
      method: 'POST',
      body: { username, password },
    }),
  me: (realmId: string) =>
    callEndpoint<MeResponse>('me', '/api/me', {
      query: { realmId },
    }),
  createCharacter: (payload: {
    realmId: string;
    name: string;
    roleClass: RoleClass;
    gender: Gender;
  }) =>
    callEndpoint<{ character: CharacterView }>('characterCreate', '/api/character', {
      method: 'POST',
      body: payload,
    }),
  allocateStats: (payload: {
    realmId: string;
    vit?: number;
    str?: number;
    int?: number;
    agi?: number;
  }) =>
    callEndpoint<{ character: CharacterView }>(
      'characterAllocateStats',
      '/api/character/allocate-stats',
      {
        method: 'POST',
        body: payload,
      },
    ),
  resetStats: (realmId: string) =>
    callEndpoint<{ character: CharacterView }>(
      'characterResetStats',
      '/api/character/reset-stats',
      {
        method: 'POST',
        body: { realmId },
      },
    ),
  allocateResist: (payload: {
    realmId: string;
    phys?: number;
    chaos?: number;
    seal?: number;
    trap?: number;
    magic?: number;
  }) =>
    callEndpoint<{ character: CharacterView }>(
      'characterAllocateResist',
      '/api/character/allocate-resist',
      {
        method: 'POST',
        body: payload,
      },
    ),
  moveMap: (realmId: string, targetMapId: string) =>
    callEndpoint<{ character: CharacterView; mapPlayers: OnlinePlayerSummary[] }>(
      'mapMove',
      '/api/map/move',
      {
        method: 'POST',
        body: { realmId, targetMapId },
      },
    ),
  restInn: (realmId: string) =>
    callEndpoint<{ character: CharacterView }>('facilityInn', '/api/facility/inn', {
      method: 'POST',
      body: { realmId },
    }),
  buyItem: (realmId: string, itemId: string, quantity = 1) =>
    callEndpoint<{ character: CharacterView }>('shopBuy', '/api/facility/shop/buy', {
      method: 'POST',
      body: { realmId, itemId, quantity },
    }),
  useItem: (realmId: string, itemId: string) =>
    callEndpoint<{ character: CharacterView }>('inventoryUse', '/api/inventory/use', {
      method: 'POST',
      body: { realmId, itemId },
    }),
  buyEquipment: (realmId: string, templateId: string) =>
    callEndpoint<{ character: CharacterView }>('equipmentBuy', '/api/equipment/buy', {
      method: 'POST',
      body: { realmId, templateId },
    }),
  equipItem: (realmId: string, equipId: number) =>
    callEndpoint<{ character: CharacterView }>('equipmentEquip', '/api/equipment/equip', {
      method: 'POST',
      body: { realmId, equipId },
    }),
  unequipSlot: (realmId: string, slot: EquipmentSlot) =>
    callEndpoint<{ character: CharacterView }>('equipmentUnequip', '/api/equipment/unequip', {
      method: 'POST',
      body: { realmId, slot },
    }),
  sellEquipment: (realmId: string, equipId: number) =>
    callEndpoint<{ character: CharacterView }>('equipmentSell', '/api/equipment/sell', {
      method: 'POST',
      body: { realmId, equipId },
    }),
  digTreasure: (realmId: string) =>
    callEndpoint<{ result: TreasureDigResult; character: CharacterView }>(
      'treasureDig',
      '/api/treasure/dig',
      {
        method: 'POST',
        body: { realmId },
      },
    ),
  recruitGeneral: (realmId: string, templateId: string) =>
    callEndpoint<{ character: CharacterView }>('generalsRecruit', '/api/generals/recruit', {
      method: 'POST',
      body: { realmId, templateId },
    }),
  setGeneralSlot: (realmId: string, generalId: number, slot: number | null) =>
    callEndpoint<{ character: CharacterView }>('generalsSlot', '/api/generals/slot', {
      method: 'POST',
      body: { realmId, generalId, slot },
    }),
  getRankings: (realmId: string, sort: 'level' | 'silver' | 'gold' = 'level') =>
    callEndpoint<{ rankings: RankEntry[] }>('rankings', '/api/rankings', {
      query: { realmId, sort },
    }),
  startBattle: (realmId: string, enemyGroupId: string) =>
    callEndpoint<{ battle: BattleState }>('battleStart', '/api/battle/start', {
      method: 'POST',
      body: { realmId, enemyGroupId },
    }),
  battleAction: (payload: {
    realmId: string;
    action: 'attack' | 'skill' | 'defend' | 'item' | 'capture' | 'flee';
    targetUid?: string;
    skillId?: string;
    itemId?: string;
  }) =>
    callEndpoint<{ battle: BattleState; character: CharacterView }>(
      'battleAction',
      '/api/battle/action',
      {
        method: 'POST',
        body: payload,
      },
    ),
  gmGrant: (payload: {
    realmId: string;
    passcode?: string;
    silver?: number;
    gold?: number;
    exp?: number;
    fullHeal?: boolean;
    grantGeneralId?: string;
    grantEquipId?: string;
    grantBaotu?: number;
    announce?: string;
  }) =>
    callEndpoint<{ character: CharacterView }>('gmGrant', '/api/gm/grant', {
      method: 'POST',
      body: payload,
    }),
};
