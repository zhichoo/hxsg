import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyRequest } from 'fastify';
import { REALMS, type EquipmentSlot, type Gender, type RoleClass } from '@hxsg/shared';
import { loginAccount, registerAccount, verifyToken, type AuthPayload } from './auth.js';
import {
  getActiveBattle,
  performBattleAction,
  startBattle,
  type PlayerBattleCommand,
} from './battleEngine.js';
import { dbPath } from './db.js';
import {
  allocateCharacterResist,
  allocateCharacterStats,
  buyEquipment,
  buyShopItem,
  createCharacter,
  digTreasureMap,
  dismissGeneral,
  drawGeneralWithToken,
  equipItem,
  feedGeneralExpPill,
  getCharacterByAccountAndRealm,
  getRankings,
  gmGrant,
  moveCharacter,
  rebirthGeneral,
  recruitGeneral,
  resetCharacterStats,
  restAtInn,
  sellEquipment,
  setGeneralSlot,
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
  const current = getCharacterByAccountAndRealm(auth.accountId, body.realmId || 'dingjunshan');
  if (!current) throw new Error('尚未创建角色');
  return performBattleAction(current.id, body);
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

await app.listen({ port: PORT, host: HOST });
app.log.info(
  `HXSG Classic Server listening on http://${HOST}:${PORT} (mapp=${mappConfig.enabled ? mappConfig.channel : 'disabled'})`,
);
