import type { IncomingMessage, Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import {
  ROLE_CLASS_META,
  type ChatChannel,
  type ChatMessage,
  type OnlinePlayerSummary,
} from '@hxsg/shared';
import { verifyToken, type AuthPayload } from './auth.js';
import { db } from './db.js';
import { getCharacterByAccountAndRealm } from './gameService.js';
import { resolvePlatformAccount, verifyMappWsUpgrade } from './mappAuth.js';

interface ConnectedPlayer {
  ws: WebSocket;
  accountId: number;
  characterId: number;
  realmId: string;
  mapId: string;
  summary: OnlinePlayerSummary;
  alive: boolean;
}

const onlineBySocket = new Map<WebSocket, ConnectedPlayer>();

function formatHHMM(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastToRealm(realmId: string, payload: unknown) {
  const encoded = JSON.stringify(payload);
  for (const p of onlineBySocket.values()) {
    if (p.realmId === realmId && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(encoded);
    }
  }
}

function broadcastToMap(realmId: string, mapId: string, payload: unknown) {
  const encoded = JSON.stringify(payload);
  for (const p of onlineBySocket.values()) {
    if (p.realmId === realmId && p.mapId === mapId && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(encoded);
    }
  }
}

export function getOnlineCountByRealm(realmId: string): number {
  const uniqueChars = new Set<number>();
  for (const p of onlineBySocket.values()) {
    if (p.realmId === realmId) uniqueChars.add(p.characterId);
  }
  return uniqueChars.size;
}

export function getOnlineCharacterIdsByRealm(realmId: string): Set<number> {
  const ids = new Set<number>();
  for (const p of onlineBySocket.values()) {
    if (p.realmId === realmId) ids.add(p.characterId);
  }
  return ids;
}

function sendToCharacter(realmId: string, characterId: number, payload: unknown) {
  const encoded = JSON.stringify(payload);
  for (const p of onlineBySocket.values()) {
    if (
      p.realmId === realmId &&
      p.characterId === characterId &&
      p.ws.readyState === WebSocket.OPEN
    ) {
      p.ws.send(encoded);
    }
  }
}

export function getMapOnlinePlayers(realmId: string, mapId: string): OnlinePlayerSummary[] {
  const seen = new Map<number, OnlinePlayerSummary>();
  for (const p of onlineBySocket.values()) {
    if (p.realmId === realmId && p.mapId === mapId) {
      seen.set(p.characterId, p.summary);
    }
  }
  return Array.from(seen.values());
}

export function broadcastSystemMessage(
  realmId: string,
  content: string,
  channel: ChatChannel = 'shi',
) {
  const now = Date.now();
  const info = db
    .prepare(
      'INSERT INTO chat_messages (realm_id, channel, sender_id, sender_name, is_system, content, created_at) VALUES (?, ?, 0, ?, 1, ?, ?)',
    )
    .run(realmId, channel, '系统公告', content, now);
  const msg: ChatMessage = {
    id: String(info.lastInsertRowid),
    channel,
    senderId: 0,
    senderName: '系统公告',
    isSystem: true,
    content,
    time: formatHHMM(now),
    timestamp: now,
  };
  broadcastToRealm(realmId, { type: 'chat:message', data: msg });
}

export function syncPlayerMap(characterId: number, realmId: string, newMapId: string) {
  const affectedMaps = new Set<string>();
  for (const p of onlineBySocket.values()) {
    if (p.characterId === characterId && p.realmId === realmId) {
      const oldMap = p.mapId;
      p.mapId = newMapId;
      p.summary.mapId = newMapId;
      affectedMaps.add(oldMap);
      affectedMaps.add(newMapId);
    }
  }
  for (const mapId of affectedMaps) {
    broadcastToMap(realmId, mapId, {
      type: 'map:players',
      data: getMapOnlinePlayers(realmId, mapId),
    });
  }
}

function rejectUpgrade(socket: import('node:stream').Duplex, status: number, text: string) {
  socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

async function authenticateUpgrade(
  req: IncomingMessage,
): Promise<{ auth: AuthPayload; realmId: string } | null> {
  const rawUrl = req.url || '';
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, 'http://localhost');
  } catch {
    return null;
  }

  const realmId = (parsed.searchParams.get('realmId') || 'dingjunshan').trim();

  // Discourse Mini App platform JWT handshake (sole mini_app_token query)
  if (parsed.searchParams.has('mini_app_token')) {
    try {
      const identity = await verifyMappWsUpgrade(req);
      return { auth: resolvePlatformAccount(identity), realmId };
    } catch {
      return null;
    }
  }

  // Standalone Web token handshake
  const localToken = parsed.searchParams.get('token');
  const auth = verifyToken(localToken);
  if (!auth) return null;
  return { auth, realmId };
}

export function attachSocketServer(httpServer: HttpServer) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

  // Clean up dead connections periodically
  const heartbeat = setInterval(() => {
    for (const [ws, player] of onlineBySocket.entries()) {
      if (!player.alive) {
        ws.terminate();
        continue;
      }
      player.alive = false;
      ws.ping();
    }
  }, 30_000);
  heartbeat.unref();

  httpServer.on('upgrade', (req, socket, head) => {
    const pathname = (req.url || '').split('?')[0];
    if (pathname !== '/ws') {
      rejectUpgrade(socket, 404, 'Not Found');
      return;
    }

    void (async () => {
      const result = await authenticateUpgrade(req);
      if (!result) {
        rejectUpgrade(socket, 401, 'Unauthorized');
        return;
      }

      const { auth, realmId } = result;
      const ch = getCharacterByAccountAndRealm(auth.accountId, realmId);
      if (!ch) {
        rejectUpgrade(socket, 403, 'Forbidden');
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        const meta = ROLE_CLASS_META[ch.roleClass];
        const sprite = ch.gender === 'female' ? meta.femaleSprite : meta.maleSprite;
        const player: ConnectedPlayer = {
          ws,
          accountId: auth.accountId,
          characterId: ch.id,
          realmId,
          mapId: ch.mapId,
          alive: true,
          summary: {
            id: ch.id,
            name: ch.name,
            level: ch.level,
            roleClass: ch.roleClass,
            gender: ch.gender,
            mapId: ch.mapId,
            avatarSprite: `${sprite}_h.png`,
          },
        };

        onlineBySocket.set(ws, player);

        ws.on('pong', () => {
          player.alive = true;
        });

        // Send recent chat history (public channels + this character's private whispers)
        const historyRows = db
          .prepare(
            `SELECT id, channel, sender_id, sender_name, recipient_id, recipient_name, is_system, content, created_at
             FROM chat_messages
             WHERE realm_id = ? AND (channel != 'si' OR sender_id = ? OR recipient_id = ?)
             ORDER BY created_at DESC LIMIT 50`,
          )
          .all(realmId, ch.id, ch.id) as unknown as Array<{
          id: number;
          channel: ChatChannel;
          sender_id: number;
          sender_name: string;
          recipient_id: number | null;
          recipient_name: string | null;
          is_system: number;
          content: string;
          created_at: number;
        }>;

        const history: ChatMessage[] = historyRows.reverse().map((r) => ({
          id: String(r.id),
          channel: r.channel,
          senderId: r.sender_id,
          senderName: r.sender_name,
          recipientId: r.recipient_id ?? null,
          recipientName: r.recipient_name ?? null,
          isSystem: Boolean(r.is_system),
          content: r.content,
          time: formatHHMM(r.created_at),
          timestamp: r.created_at,
        }));
        sendJson(ws, { type: 'chat:history', data: history });

        // Broadcast updated map players
        broadcastToMap(realmId, ch.mapId, {
          type: 'map:players',
          data: getMapOnlinePlayers(realmId, ch.mapId),
        });

        ws.on('message', (raw) => {
          player.alive = true;
          let payload: {
            type?: string;
            channel?: ChatChannel;
            content?: string;
            recipientName?: string;
          };
          try {
            payload = JSON.parse(raw.toString('utf8')) as {
              type?: string;
              channel?: ChatChannel;
              content?: string;
              recipientName?: string;
            };
          } catch {
            return;
          }

          if (payload.type === 'ping') {
            sendJson(ws, { type: 'pong' });
            return;
          }

          if (payload.type === 'chat:send') {
            const content = String(payload.content ?? '').trim().slice(0, 120);
            if (!content) return;
            const channel: ChatChannel = ['qu', 'pai', 'shang', 'shi', 'si'].includes(
              payload.channel as ChatChannel,
            )
              ? (payload.channel as ChatChannel)
              : 'qu';
            const now = Date.now();

            if (channel === 'si') {
              const targetName = String(payload.recipientName ?? '').trim();
              if (!targetName) return;
              const rec = db
                .prepare('SELECT id, name FROM characters WHERE realm_id = ? AND name = ?')
                .get(realmId, targetName) as { id: number; name: string } | undefined;
              if (!rec) {
                sendJson(ws, {
                  type: 'chat:message',
                  data: {
                    id: `err_${now}`,
                    channel: 'si',
                    senderId: 0,
                    senderName: '系统提示',
                    isSystem: true,
                    content: `未找到玩家【${targetName}】，无法发送私聊。`,
                    time: formatHHMM(now),
                    timestamp: now,
                  } satisfies ChatMessage,
                });
                return;
              }
              const info = db
                .prepare(
                  `INSERT INTO chat_messages (realm_id, channel, sender_id, sender_name, recipient_id, recipient_name, is_system, content, created_at)
                   VALUES (?, 'si', ?, ?, ?, ?, 0, ?, ?)`,
                )
                .run(realmId, ch.id, ch.name, rec.id, rec.name, content, now);
              const msg: ChatMessage = {
                id: String(info.lastInsertRowid),
                channel: 'si',
                senderId: ch.id,
                senderName: ch.name,
                recipientId: rec.id,
                recipientName: rec.name,
                content,
                time: formatHHMM(now),
                timestamp: now,
              };
              sendToCharacter(realmId, ch.id, { type: 'chat:message', data: msg });
              if (rec.id !== ch.id) {
                sendToCharacter(realmId, rec.id, { type: 'chat:message', data: msg });
              }
              return;
            }

            const info = db
              .prepare(
                `INSERT INTO chat_messages (realm_id, channel, sender_id, sender_name, is_system, content, created_at)
                 VALUES (?, ?, ?, ?, 0, ?, ?)`,
              )
              .run(realmId, channel, ch.id, ch.name, content, now);

            const msg: ChatMessage = {
              id: String(info.lastInsertRowid),
              channel,
              senderId: ch.id,
              senderName: ch.name,
              content,
              time: formatHHMM(now),
              timestamp: now,
            };
            broadcastToRealm(realmId, { type: 'chat:message', data: msg });
          }
        });

        ws.on('close', () => {
          const existing = onlineBySocket.get(ws);
          if (existing) {
            onlineBySocket.delete(ws);
            broadcastToMap(existing.realmId, existing.mapId, {
              type: 'map:players',
              data: getMapOnlinePlayers(existing.realmId, existing.mapId),
            });
          }
        });
      });
    })();
  });

  return wss;
}
