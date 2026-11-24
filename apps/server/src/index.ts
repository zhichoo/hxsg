import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyRequest } from 'fastify';
import {
  getCurrentWorldBoss,
  REALMS,
  TOWER_MAX_FLOOR,
  type EquipmentSlot,
  type Gender,
  type MarketListingKind,
  type RoleClass,
} from '@hxsg/shared';
import { loginAccount, registerAccount, verifyToken, type AuthPayload } from './auth.js';
import {
  getActiveBattle,
  performBattleAction,
  startArenaBattle,
  startBattle,
  type PlayerBattleCommand,
} from './battleEngine.js';
import { dbPath } from './db.js';
import {
  abandonPaohuan,
  acceptMainQuest,
  acceptPaohuan,
  addFriend,
  allocateCharacterResist,
  allocateCharacterStats,
  answerKejuQuestion,
  bankTransfer,
  buyEquipment,
  buyMarketListing,
  buyShopItem,
  cancelMarketListing,
  claimDailyEscort,
  claimMailAttachment,
  claimMainQuest,
  claimPaohuan,
  craftEquipment,
  createCharacter,
  createMarketListing,
  deleteMail,
  digTreasureMap,
  dismissGeneral,
  drawGeneralWithToken,
  equipItem,
  feedGeneralExpPill,
  feedGeneralLoyalty,
  getCasinoState,
  getCharacterByAccountAndRealm,
  getFriends,
  getMails,
  getMarketListings,
  getRankings,
  gmGrant,
  inspectPlayer,
  learnGeneralSkillBook,
  markMailRead,
  moveCharacter,
  playCasinoChibi,
  playCasinoDice,
  rebirthCharacter,
  rebirthGeneral,
  recruitGeneral,
  reforgeEquipment,
  removeFriend,
  resetCharacterStats,
  restAtInn,
  sellEquipment,
  sendPlayerMail,
  setGeneralSlot,
  startDailyEscort,
  sweepTowerDaily,
  tickAllCasinoRounds,
  trainSkillWithSilver,
  unequipSlot,
  useInventoryItem,
  washGeneral,
} from './gameService.js';
import {
  isJwtFormat,
  mappConfig,
  resolvePlatformAccount,
  verifyMappHttpRequest,
} from './mappAuth.js';
import {
  attachSocketServer,
  broadcastSystemMessage,
  getMapOnlinePlayers,
  getOnlineCharacterIdsByRealm,
  getOnlineCountByRealm,
  syncPlayerMap,
} from './socket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';
const GM_PASSCODE = process.env.HXSG_GM_CODE || 'hxsg888';

const app = Fastify({
  logger: {
    level: 'info',
    redact: ['req.headers.authorization'],
  },
});

const explicitCorsOrigins = (process.env.HXSG_CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (mappConfig.issuerOrigin && !explicitCorsOrigins.includes(mappConfig.issuerOrigin)) {
  explicitCorsOrigins.push(mappConfig.issuerOrigin);
}

await app.register(cors, {
  origin: process.env.HXSG_CORS_STRICT === '1' && explicitCorsOrigins.length > 0
    ? explicitCorsOrigins
    : true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: false,
});

function unauthorizedError(message = '未登录或登录已过期'): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = 401;
  return err;
}

async function requireAuth(req: FastifyRequest): Promise<AuthPayload> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw unauthorizedError();
  }
  const token = header.slice(7);

  // Discourse Mini App platform ES256 JWT (3 segments)
  if (isJwtFormat(token)) {
    try {
      const identity = await verifyMappHttpRequest(req.raw);
      return resolvePlatformAccount(identity);
    } catch {
      throw unauthorizedError('平台身份验证失败，请刷新页面重试');
    }
  }

  // Standalone Web HMAC token (2 segments)
  const auth = verifyToken(token);
  if (!auth) {
    throw unauthorizedError();
  }
  return auth;
}

/**
 * For auth:"auto" endpoints: anonymous requests without Authorization are allowed,
 * while requests carrying an invalid Authorization/JWT MUST still be rejected (401).
 */
async function verifyOptionalAuth(req: FastifyRequest): Promise<AuthPayload | null> {
  if (!req.headers.authorization) return null;
  return requireAuth(req);
}

app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
  const status = err.statusCode ?? 400;
  reply.status(status).send({ error: err.message || '请求失败' });
});

app.get('/api/health', async () => ({
  ok: true,
  dbPath,
  mappEnabled: mappConfig.enabled,
  mappChannel: mappConfig.enabled ? mappConfig.channel : null,
}));

app.get('/api/realms', async (req) => {
  await verifyOptionalAuth(req);
  return REALMS.map((r) => ({
    ...r,
    onlineCount: getOnlineCountByRealm(r.id),
  }));
});

app.post('/api/auth/register', async (req) => {
  const body = req.body as { username?: string; password?: string };
  return registerAccount(body.username ?? '', body.password ?? '');
});

app.post('/api/auth/login', async (req) => {
  const body = req.body as { username?: string; password?: string };
  return loginAccount(body.username ?? '', body.password ?? '');
});

app.get('/api/me', async (req) => {
  const auth = await requireAuth(req);
  const realmId = ((req.query as { realmId?: string }).realmId || 'dingjunshan').trim();
  const character = getCharacterByAccountAndRealm(auth.accountId, realmId);
  const activeBattle = character ? getActiveBattle(character.id) : null;
  const mapPlayers = character ? getMapOnlinePlayers(realmId, character.mapId) : [];
  return {
    account: {
      accountId: auth.accountId,
      username: auth.username,
      isGm: auth.isGm,
      authSource: auth.authSource ?? 'local',
      trustLevel: auth.trustLevel,
    },
    character,
    activeBattle,
    mapPlayers,
  };
});

app.post('/api/character', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as {
    realmId?: string;
    name?: string;
    roleClass?: RoleClass;
    gender?: Gender;
  };
  const character = createCharacter({
    accountId: auth.accountId,
    realmId: body.realmId || 'dingjunshan',
    name: body.name || '',
    roleClass: body.roleClass || 'wushi',
    gender: body.gender || 'male',
  });
  broadcastSystemMessage(
    character.realmId,
    `欢迎新少侠【${character.name}】降临三国乱世！`,
    'shi',
  );
  return { character };
});

app.post('/api/character/allocate-stats', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as {
    realmId?: string;
    vit?: number;
    str?: number;
    int?: number;
    agi?: number;
  };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return { character: allocateCharacterStats(current.id, body) };
});

app.post('/api/character/reset-stats', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return { character: resetCharacterStats(current.id) };
});

app.post('/api/character/allocate-resist', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as {
    realmId?: string;
    phys?: number;
    chaos?: number;
    seal?: number;
    trap?: number;
    magic?: number;
  };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return { character: allocateCharacterResist(current.id, body) };
});

app.post('/api/character/rebirth', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string };
  const realmId = body.realmId || 'dingjunshan';
  const current = getCharacterByAccountAndRealm(auth.accountId, realmId);
  if (!current) throw new Error('尚未创建角色');
  const res = rebirthCharacter(current.id);
  broadcastSystemMessage(realmId, res.broadcast, 'shi');
  return { character: res.character, message: res.message };
});

app.post('/api/skills/train', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; skillId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return trainSkillWithSilver(current.id, body.skillId || '');
});

app.post('/api/equipment/craft', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; recipeId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return craftEquipment(current.id, body.recipeId || '');
});

app.post('/api/equipment/reforge', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; equipId?: number };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return reforgeEquipment(current.id, Number(body.equipId));
});

app.post('/api/generals/feed-loyalty', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; generalId?: number; itemId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return feedGeneralLoyalty(current.id, Number(body.generalId), body.itemId || '');
});

app.get('/api/players/inspect', async (req) => {
  const auth = await requireAuth(req);
  const q = req.query as { realmId?: string; targetCharacterId?: string };
  const realmId = q.realmId || 'dingjunshan';
  const current = getCharacterByAccountAndRealm(auth.accountId, realmId);
  if (!current) throw new Error('尚未创建角色');
  const onlineIds = getOnlineCharacterIdsByRealm(realmId);
  return { player: inspectPlayer(current.id, Number(q.targetCharacterId), onlineIds) };
});

app.get('/api/friends/list', async (req) => {
  const auth = await requireAuth(req);
  const q = req.query as { realmId?: string };
  const realmId = q.realmId || 'dingjunshan';
  const current = getCharacterByAccountAndRealm(auth.accountId, realmId);
  if (!current) throw new Error('尚未创建角色');
  const onlineIds = getOnlineCharacterIdsByRealm(realmId);
  return { friends: getFriends(current.id, onlineIds) };
});

app.post('/api/friends/add', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; targetCharacterId?: number; targetName?: string };
  const realmId = body.realmId || 'dingjunshan';
  const current = getCharacterByAccountAndRealm(auth.accountId, realmId);
  if (!current) throw new Error('尚未创建角色');
  const onlineIds = getOnlineCharacterIdsByRealm(realmId);
  return addFriend(current.id, body, onlineIds);
});

app.post('/api/friends/remove', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; friendCharacterId?: number };
  const realmId = body.realmId || 'dingjunshan';
  const current = getCharacterByAccountAndRealm(auth.accountId, realmId);
  if (!current) throw new Error('尚未创建角色');
  const onlineIds = getOnlineCharacterIdsByRealm(realmId);
  return removeFriend(current.id, Number(body.friendCharacterId), onlineIds);
});

app.post('/api/map/move', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; targetMapId?: string };
  const realmId = body.realmId || 'dingjunshan';
  const current = getCharacterByAccountAndRealm(auth.accountId, realmId);
  if (!current) throw new Error('尚未创建角色');
  if (getActiveBattle(current.id)) throw new Error('战斗中无法移动地图');
  const character = moveCharacter(current.id, body.targetMapId || '');
  syncPlayerMap(character.id, realmId, character.mapId);
  return {
    character,
    mapPlayers: getMapOnlinePlayers(realmId, character.mapId),
  };
});

app.post('/api/facility/inn', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return { character: restAtInn(current.id) };
});

app.post('/api/facility/shop/buy', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; itemId?: string; quantity?: number };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return { character: buyShopItem(current.id, body.itemId || '', body.quantity ?? 1) };
});

app.post('/api/inventory/use', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; itemId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return { character: useInventoryItem(current.id, body.itemId || '') };
});

app.post('/api/equipment/buy', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; templateId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return { character: buyEquipment(current.id, body.templateId || '') };
});

app.post('/api/equipment/equip', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; equipId?: number };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return { character: equipItem(current.id, Number(body.equipId)) };
});

app.post('/api/equipment/unequip', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; slot?: EquipmentSlot };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return { character: unequipSlot(current.id, body.slot || 'weapon') };
});

app.post('/api/equipment/sell', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; equipId?: number };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return { character: sellEquipment(current.id, Number(body.equipId)) };
});

app.post('/api/treasure/dig', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return digTreasureMap(current.id);
});

app.post('/api/generals/recruit', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; templateId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return recruitGeneral(current.id, body.templateId || '');
});

app.post('/api/generals/draw', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return drawGeneralWithToken(current.id);
});

app.post('/api/generals/feed', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; generalId?: number };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return { character: feedGeneralExpPill(current.id, Number(body.generalId)) };
});

app.post('/api/generals/wash', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; generalId?: number };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return washGeneral(current.id, Number(body.generalId));
});

app.post('/api/generals/rebirth', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; generalId?: number };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return { character: rebirthGeneral(current.id, Number(body.generalId)) };
});

app.post('/api/generals/dismiss', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; generalId?: number };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return dismissGeneral(current.id, Number(body.generalId));
});

app.post('/api/generals/slot', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; generalId?: number; slot?: number | null };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return {
    character: setGeneralSlot(current.id, Number(body.generalId), body.slot ?? null),
  };
});

app.post('/api/generals/learn-skill', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; generalId?: number; bookItemId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return learnGeneralSkillBook(current.id, Number(body.generalId), body.bookItemId || '');
});

app.get('/api/rankings', async (req) => {
  await verifyOptionalAuth(req);
  const q = req.query as { realmId?: string; sort?: 'level' | 'silver' | 'gold' };
  return {
    rankings: getRankings(q.realmId || 'dingjunshan', q.sort || 'level'),
  };
});

app.post('/api/battle/start', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; enemyGroupId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  const existing = getActiveBattle(current.id);
  if (existing && existing.status === 'ongoing') {
    return { battle: existing };
  }
  const battle = startBattle(current.id, body.enemyGroupId || 'xuchang_dipi');
  return { battle };
});

app.post('/api/battle/action', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as PlayerBattleCommand & { realmId?: string };
  const realmId = body.realmId || 'dingjunshan';
  const current = getCharacterByAccountAndRealm(auth.accountId, realmId);
  if (!current) throw new Error('尚未创建角色');
  const res = performBattleAction(current.id, body);
  if (res.worldBroadcast) {
    broadcastSystemMessage(realmId, res.worldBroadcast, 'shi');
  }
  return { battle: res.battle, character: res.character };
});

app.post('/api/quests/main/accept', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; questId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return acceptMainQuest(current.id, body.questId);
});

app.post('/api/quests/main/claim', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; questId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return claimMainQuest(current.id, body.questId);
});

app.post('/api/quests/paohuan/accept', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return acceptPaohuan(current.id);
});

app.post('/api/quests/paohuan/claim', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return claimPaohuan(current.id);
});

app.post('/api/quests/paohuan/abandon', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return abandonPaohuan(current.id);
});

app.post('/api/tower/challenge', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; floor?: number };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  const existing = getActiveBattle(current.id);
  if (existing && existing.status === 'ongoing') {
    return { battle: existing };
  }
  const maxAllowed = Math.min(TOWER_MAX_FLOOR, current.tower.highestFloor + 1);
  const targetFloor = body.floor
    ? Math.max(1, Math.min(maxAllowed, Math.floor(body.floor)))
    : maxAllowed;
  const battle = startBattle(current.id, `tower_${targetFloor}`);
  return { battle };
});

app.post('/api/tower/sweep', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return sweepTowerDaily(current.id);
});

app.get('/api/casino/state', async (req) => {
  const auth = await requireAuth(req);
  const q = req.query as { realmId?: string };
  const realmId = q.realmId || 'dingjunshan';
  const current = getCharacterByAccountAndRealm(auth.accountId, realmId);
  if (!current) throw new Error('尚未创建角色');
  const res = getCasinoState(realmId, current.id);
  for (const msg of res.announcements) {
    broadcastSystemMessage(realmId, msg, 'shi');
  }
  return { state: res.state, character: res.character };
});

app.post('/api/casino/dice', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as {
    realmId?: string;
    betType?: 'big' | 'small' | 'odd' | 'even' | 'baozi';
    currency?: 'silver' | 'gold';
    amount?: number;
  };
  const realmId = body.realmId || 'dingjunshan';
  const current = getCharacterByAccountAndRealm(auth.accountId, realmId);
  if (!current) throw new Error('尚未创建角色');
  const res = playCasinoDice(current.id, {
    betType: body.betType || 'big',
    currency: body.currency || 'silver',
    amount: Number(body.amount ?? 100),
  });
  for (const msg of res.announcements) {
    broadcastSystemMessage(realmId, msg, 'shi');
  }
  return { bet: res.bet, state: res.state, character: res.character, message: res.message };
});

app.post('/api/casino/chibi', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as {
    realmId?: string;
    pick?: 'wei' | 'wu' | 'shu';
    currency?: 'silver' | 'gold';
    amount?: number;
  };
  const realmId = body.realmId || 'dingjunshan';
  const current = getCharacterByAccountAndRealm(auth.accountId, realmId);
  if (!current) throw new Error('尚未创建角色');
  const res = playCasinoChibi(current.id, {
    pick: body.pick || 'wu',
    currency: body.currency || 'silver',
    amount: Number(body.amount ?? 100),
  });
  for (const msg of res.announcements) {
    broadcastSystemMessage(realmId, msg, 'shi');
  }
  return { bet: res.bet, state: res.state, character: res.character, message: res.message };
});

app.post('/api/bank/transfer', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as {
    realmId?: string;
    action?:
      | 'deposit_silver'
      | 'withdraw_silver'
      | 'deposit_gold'
      | 'withdraw_gold'
      | 'gold_to_silver'
      | 'silver_to_gold';
    amount?: number;
  };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return bankTransfer(current.id, body.action || 'deposit_silver', Number(body.amount ?? 0));
});

app.get('/api/market/listings', async (req) => {
  await verifyOptionalAuth(req);
  const q = req.query as { realmId?: string; kind?: 'all' | MarketListingKind };
  return {
    listings: getMarketListings(q.realmId || 'dingjunshan', q.kind || 'all'),
  };
});

app.post('/api/market/list', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as {
    realmId?: string;
    kind?: MarketListingKind;
    refId?: string | number;
    quantity?: number;
    currency?: 'silver' | 'gold';
    price?: number;
  };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return createMarketListing(current.id, {
    kind: body.kind || 'item',
    refId: body.refId ?? '',
    quantity: body.quantity,
    currency: body.currency || 'silver',
    price: Number(body.price ?? 0),
  });
});

app.post('/api/market/buy', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; listingId?: number };
  const realmId = body.realmId || 'dingjunshan';
  const current = getCharacterByAccountAndRealm(auth.accountId, realmId);
  if (!current) throw new Error('尚未创建角色');
  const res = buyMarketListing(current.id, Number(body.listingId));
  broadcastSystemMessage(realmId, res.tradeAnnouncement, 'shang');
  return { character: res.character, message: res.message };
});

app.post('/api/market/cancel', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; listingId?: number };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return cancelMarketListing(current.id, Number(body.listingId));
});

app.post('/api/arena/challenge', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; targetCharacterId?: number };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  const existing = getActiveBattle(current.id);
  if (existing && existing.status === 'ongoing') {
    return { battle: existing };
  }
  const battle = startArenaBattle(current.id, Number(body.targetCharacterId));
  return { battle };
});

app.get('/api/mail/list', async (req) => {
  const auth = await requireAuth(req);
  const q = req.query as { realmId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, q.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return { mails: getMails(current.id) };
});

app.post('/api/mail/send', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as {
    realmId?: string;
    recipientName?: string;
    subject?: string;
    body?: string;
    attachSilver?: number;
    attachGold?: number;
  };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return sendPlayerMail(current.id, {
    recipientName: body.recipientName || '',
    subject: body.subject || '飞鸽传书',
    body: body.body || '',
    attachSilver: body.attachSilver,
    attachGold: body.attachGold,
  });
});

app.post('/api/mail/read', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; mailId?: number };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return { character: markMailRead(current.id, Number(body.mailId)) };
});

app.post('/api/mail/claim', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; mailId?: number };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return claimMailAttachment(current.id, Number(body.mailId));
});

app.post('/api/mail/delete', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; mailId?: number };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return deleteMail(current.id, Number(body.mailId));
});

// Stage 2: Daily Low-Burden Loops (Keju 5Q / Escort 1x / World Boss 1x)
app.post('/api/daily/keju/answer', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string; optionIndex?: number };
  const realmId = body.realmId || 'dingjunshan';
  const current = getCharacterByAccountAndRealm(auth.accountId, realmId);
  if (!current) throw new Error('尚未创建角色');
  const res = answerKejuQuestion(current.id, Number(body.optionIndex));
  if (res.broadcast) {
    broadcastSystemMessage(realmId, res.broadcast, 'shi');
  }
  return res;
});

app.post('/api/daily/escort/start', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return startDailyEscort(current.id);
});

app.post('/api/daily/escort/battle', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  if (current.daily.escort.status !== 'active') {
    throw new Error('当前无需迎战劫镖匪徒');
  }
  const existing = getActiveBattle(current.id);
  if (existing && existing.status === 'ongoing') {
    return { battle: existing };
  }
  const battle = startBattle(current.id, 'escort_bandit');
  return { battle };
});

app.post('/api/daily/escort/claim', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return claimDailyEscort(current.id);
});

app.post('/api/daily/world-boss/challenge', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as { realmId?: string };
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  const existing = getActiveBattle(current.id);
  if (existing && existing.status === 'ongoing') {
    return { battle: existing };
  }
  const wb = getCurrentWorldBoss();
  const battle = startBattle(current.id, `world_boss:${wb.boss.id}`);
  return { battle };
});

app.post('/api/gm/grant', async (req) => {
  const auth = await requireAuth(req);
  const body = req.body as {
    realmId?: string;
    passcode?: string;
    silver?: number;
    gold?: number;
    exp?: number;
    fullHeal?: boolean;
    grantGeneralId?: string;
    grantEquipId?: string;
    grantBaotu?: number;
    announce?: string;
  };
  if (!auth.isGm && body.passcode !== GM_PASSCODE) {
    throw new Error('无 GM 权限（需服主账号或输入 GM 口令）');
  }
  const realmId = body.realmId || 'dingjunshan';
  const current = getCharacterByAccountAndRealm(auth.accountId, realmId);
  if (!current) throw new Error('尚未创建角色');
  const character = gmGrant(current.id, body);
  if (body.announce?.trim()) {
    broadcastSystemMessage(realmId, body.announce.trim(), 'shi');
  }
  return { character };
});

// Serve built web frontend in production
const webDistDir = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(webDistDir)) {
  await app.register(fastifyStatic, {
    root: webDistDir,
    prefix: '/',
    maxAge: '7d',
    immutable: false,
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/ws')) {
      return reply.status(404).send({ error: 'Not Found' });
    }
    return reply.sendFile('index.html');
  });
}

attachSocketServer(app.server);

// Continuous scheduled Casino round settlement & history generator (1m Dice / 3m Chibi)
try {
  tickAllCasinoRounds();
} catch (err) {
  app.log.error({ err }, 'Initial casino round sync failed');
}
const casinoTicker = setInterval(() => {
  try {
    const announcements = tickAllCasinoRounds();
    for (const item of announcements) {
      broadcastSystemMessage(item.realmId, item.message, 'shi');
    }
  } catch (err) {
    app.log.error({ err }, 'Casino round tick failed');
  }
}, 1000);
casinoTicker.unref();

app.addHook('onClose', async () => {
  clearInterval(casinoTicker);
});

await app.listen({ port: PORT, host: HOST });
app.log.info(
  `HXSG Classic Server listening on http://${HOST}:${PORT} (mapp=${mappConfig.enabled ? mappConfig.channel : 'disabled'})`,
);
