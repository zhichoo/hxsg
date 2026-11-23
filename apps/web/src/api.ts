import type {
  BattleState,
  CasinoChibiResult,
  CasinoDiceResult,
  CharacterView,
  EquipmentSlot,
  Gender,
  GeneralView,
  MailView,
  MarketListingKind,
  MarketListingView,
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
    callEndpoint<{ general: GeneralView; character: CharacterView }>(
      'generalsRecruit',
      '/api/generals/recruit',
      {
        method: 'POST',
        body: { realmId, templateId },
      },
    ),
  drawGeneral: (realmId: string) =>
    callEndpoint<{ general: GeneralView; character: CharacterView }>(
      'generalsDraw',
      '/api/generals/draw',
      {
        method: 'POST',
        body: { realmId },
      },
    ),
  feedGeneral: (realmId: string, generalId: number) =>
    callEndpoint<{ character: CharacterView }>('generalsFeed', '/api/generals/feed', {
      method: 'POST',
      body: { realmId, generalId },
    }),
  washGeneral: (realmId: string, generalId: number) =>
    callEndpoint<{ general: GeneralView; character: CharacterView }>(
      'generalsWash',
      '/api/generals/wash',
      {
        method: 'POST',
        body: { realmId, generalId },
      },
    ),
  rebirthGeneral: (realmId: string, generalId: number) =>
    callEndpoint<{ character: CharacterView }>('generalsRebirth', '/api/generals/rebirth', {
      method: 'POST',
      body: { realmId, generalId },
    }),
  dismissGeneral: (realmId: string, generalId: number) =>
    callEndpoint<{ refundSilver: number; character: CharacterView }>(
      'generalsDismiss',
      '/api/generals/dismiss',
      {
        method: 'POST',
        body: { realmId, generalId },
      },
    ),
  setGeneralSlot: (realmId: string, generalId: number, slot: number | null) =>
    callEndpoint<{ character: CharacterView }>('generalsSlot', '/api/generals/slot', {
      method: 'POST',
      body: { realmId, generalId, slot },
    }),
  learnGeneralSkill: (realmId: string, generalId: number, bookItemId: string) =>
    callEndpoint<{ general: GeneralView; character: CharacterView; message: string }>(
      'generalsLearnSkill',
      '/api/generals/learn-skill',
      {
        method: 'POST',
        body: { realmId, generalId, bookItemId },
      },
    ),
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
  acceptMainQuest: (realmId: string, questId?: string) =>
    callEndpoint<{ character: CharacterView; message: string }>(
      'questsMainAccept',
      '/api/quests/main/accept',
      {
        method: 'POST',
        body: { realmId, questId },
      },
    ),
  claimMainQuest: (realmId: string, questId?: string) =>
    callEndpoint<{ character: CharacterView; message: string }>(
      'questsMainClaim',
      '/api/quests/main/claim',
      {
        method: 'POST',
        body: { realmId, questId },
      },
    ),
  acceptPaohuan: (realmId: string) =>
    callEndpoint<{ character: CharacterView; message: string }>(
      'questsPaohuanAccept',
      '/api/quests/paohuan/accept',
      {
        method: 'POST',
        body: { realmId },
      },
    ),
  claimPaohuan: (realmId: string) =>
    callEndpoint<{ character: CharacterView; message: string }>(
      'questsPaohuanClaim',
      '/api/quests/paohuan/claim',
      {
        method: 'POST',
        body: { realmId },
      },
    ),
  abandonPaohuan: (realmId: string) =>
    callEndpoint<{ character: CharacterView; message: string }>(
      'questsPaohuanAbandon',
      '/api/quests/paohuan/abandon',
      {
        method: 'POST',
        body: { realmId },
      },
    ),
  challengeTower: (realmId: string, floor?: number) =>
    callEndpoint<{ battle: BattleState }>('towerChallenge', '/api/tower/challenge', {
      method: 'POST',
      body: { realmId, floor },
    }),
  sweepTower: (realmId: string) =>
    callEndpoint<{ character: CharacterView; message: string }>('towerSweep', '/api/tower/sweep', {
      method: 'POST',
      body: { realmId },
    }),
  playCasinoDice: (payload: {
    realmId: string;
    betType: 'big' | 'small' | 'odd' | 'even' | 'baozi';
    currency: 'silver' | 'gold';
    amount: number;
  }) =>
    callEndpoint<{ result: CasinoDiceResult; character: CharacterView }>(
      'casinoDice',
      '/api/casino/dice',
      {
        method: 'POST',
        body: payload,
      },
    ),
  playCasinoChibi: (payload: {
    realmId: string;
    pick: 'wei' | 'wu' | 'shu';
    currency: 'silver' | 'gold';
    amount: number;
  }) =>
    callEndpoint<{ result: CasinoChibiResult; character: CharacterView }>(
      'casinoChibi',
      '/api/casino/chibi',
      {
        method: 'POST',
        body: payload,
      },
    ),
  bankTransfer: (payload: {
    realmId: string;
    action:
      | 'deposit_silver'
      | 'withdraw_silver'
      | 'deposit_gold'
      | 'withdraw_gold'
      | 'gold_to_silver'
      | 'silver_to_gold';
    amount: number;
  }) =>
    callEndpoint<{ character: CharacterView; message: string }>(
      'bankTransfer',
      '/api/bank/transfer',
      {
        method: 'POST',
        body: payload,
      },
    ),
  getMarketListings: (realmId: string, kind: 'all' | MarketListingKind = 'all') =>
    callEndpoint<{ listings: MarketListingView[] }>('marketList', '/api/market/listings', {
      query: { realmId, kind },
    }),
  createMarketListing: (payload: {
    realmId: string;
    kind: MarketListingKind;
    refId: string | number;
    quantity?: number;
    currency: 'silver' | 'gold';
    price: number;
  }) =>
    callEndpoint<{ listing: MarketListingView; character: CharacterView; message: string }>(
      'marketCreate',
      '/api/market/list',
      {
        method: 'POST',
        body: payload,
      },
    ),
  buyMarketListing: (realmId: string, listingId: number) =>
    callEndpoint<{ character: CharacterView; message: string }>('marketBuy', '/api/market/buy', {
      method: 'POST',
      body: { realmId, listingId },
    }),
  cancelMarketListing: (realmId: string, listingId: number) =>
    callEndpoint<{ character: CharacterView; message: string }>(
      'marketCancel',
      '/api/market/cancel',
      {
        method: 'POST',
        body: { realmId, listingId },
      },
    ),
  challengeArena: (realmId: string, targetCharacterId: number) =>
    callEndpoint<{ battle: BattleState }>('arenaChallenge', '/api/arena/challenge', {
      method: 'POST',
      body: { realmId, targetCharacterId },
    }),
  getMails: (realmId: string) =>
    callEndpoint<{ mails: MailView[] }>('mailList', '/api/mail/list', {
      query: { realmId },
    }),
  sendMail: (payload: {
    realmId: string;
    recipientName: string;
    subject: string;
    body: string;
    attachSilver?: number;
    attachGold?: number;
  }) =>
    callEndpoint<{ character: CharacterView; message: string }>('mailSend', '/api/mail/send', {
      method: 'POST',
      body: payload,
    }),
  readMail: (realmId: string, mailId: number) =>
    callEndpoint<{ character: CharacterView }>('mailRead', '/api/mail/read', {
      method: 'POST',
      body: { realmId, mailId },
    }),
  claimMail: (realmId: string, mailId: number) =>
    callEndpoint<{ character: CharacterView; message: string }>('mailClaim', '/api/mail/claim', {
      method: 'POST',
      body: { realmId, mailId },
    }),
  deleteMail: (realmId: string, mailId: number) =>
    callEndpoint<{ character: CharacterView; message: string }>('mailDelete', '/api/mail/delete', {
      method: 'POST',
      body: { realmId, mailId },
    }),
  answerKeju: (realmId: string, optionIndex: number) =>
    callEndpoint<{
      correct: boolean;
      correctAnswerText: string;
      explanation: string;
      finished: boolean;
      message: string;
      character: CharacterView;
    }>('dailyKejuAnswer', '/api/daily/keju/answer', {
      method: 'POST',
      body: { realmId, optionIndex },
    }),
  startEscort: (realmId: string) =>
    callEndpoint<{ character: CharacterView; message: string }>(
      'dailyEscortStart',
      '/api/daily/escort/start',
      {
        method: 'POST',
        body: { realmId },
      },
    ),
  battleEscortBandit: (realmId: string) =>
    callEndpoint<{ battle: BattleState }>('dailyEscortBattle', '/api/daily/escort/battle', {
      method: 'POST',
      body: { realmId },
    }),
  claimEscort: (realmId: string) =>
    callEndpoint<{ character: CharacterView; message: string }>(
      'dailyEscortClaim',
      '/api/daily/escort/claim',
      {
        method: 'POST',
        body: { realmId },
      },
    ),
  challengeWorldBoss: (realmId: string) =>
    callEndpoint<{ battle: BattleState }>(
      'dailyWorldBossChallenge',
      '/api/daily/world-boss/challenge',
      {
        method: 'POST',
        body: { realmId },
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
