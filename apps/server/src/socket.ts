import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import {
  ROLE_CLASS_META,
  type ChatChannel,
  type ChatMessage,
  type OnlinePlayerSummary,
} from '@hxsg/shared';
import { verifyToken } from './auth.js';
import { db } from './db.js';
import { getCharacterByAccountAndRealm } from './gameService.js';

interface ConnectedPlayer {
  socketId: string;
  accountId: number;
  characterId: number;
  realmId: string;
  mapId: string;
  summary: OnlinePlayerSummary;
}

const onlineBySocket = new Map<string, ConnectedPlayer>();
let ioInstance: SocketIOServer | null = null;

function formatHHMM(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function getOnlineCountByRealm(realmId: string): number {
  const uniqueChars = new Set<number>();
  for (const p of onlineBySocket.values()) {
    if (p.realmId === realmId) uniqueChars.add(p.characterId);
  }
  return uniqueChars.size;
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

export function broadcastSystemMessage(realmId: string, content: string, channel: ChatChannel = 'shi') {
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
  ioInstance?.to(`realm:${realmId}`).emit('chat:message', msg);
}

export function syncPlayerMap(characterId: number, realmId: string, newMapId: string) {
  if (!ioInstance) return;
  for (const p of onlineBySocket.values()) {
    if (p.characterId === characterId && p.realmId === realmId) {
      const oldMap = p.mapId;
      p.mapId = newMapId;
      p.summary.mapId = newMapId;
      const sock = ioInstance.sockets.sockets.get(p.socketId);
      if (sock) {
        sock.leave(`map:${realmId}:${oldMap}`);
        sock.join(`map:${realmId}:${newMapId}`);
      }
      ioInstance
        .to(`map:${realmId}:${oldMap}`)
        .emit('map:players', getMapOnlinePlayers(realmId, oldMap));
      ioInstance
        .to(`map:${realmId}:${newMapId}`)
        .emit('map:players', getMapOnlinePlayers(realmId, newMapId));
    }
  }
}

export function attachSocketServer(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: true, credentials: true },
  });
  ioInstance = io;

  io.on('connection', (socket) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const realmId = (socket.handshake.auth?.realmId as string | undefined) || 'dingjunshan';
    const auth = verifyToken(token);
    if (!auth) {
      socket.disconnect(true);
      return;
    }

    const ch = getCharacterByAccountAndRealm(auth.accountId, realmId);
    if (!ch) {
      socket.disconnect(true);
      return;
    }

    const meta = ROLE_CLASS_META[ch.roleClass];
    const sprite = ch.gender === 'female' ? meta.femaleSprite : meta.maleSprite;
    const player: ConnectedPlayer = {
      socketId: socket.id,
      accountId: auth.accountId,
      characterId: ch.id,
      realmId,
      mapId: ch.mapId,
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

    onlineBySocket.set(socket.id, player);
    socket.join(`realm:${realmId}`);
    socket.join(`map:${realmId}:${ch.mapId}`);

    // Send recent chat history
    const historyRows = db
      .prepare(
        `SELECT id, channel, sender_id, sender_name, is_system, content, created_at
         FROM chat_messages WHERE realm_id = ? ORDER BY created_at DESC LIMIT 40`,
      )
      .all(realmId) as unknown as Array<{
      id: number;
      channel: ChatChannel;
      sender_id: number;
      sender_name: string;
      is_system: number;
      content: string;
      created_at: number;
    }>;

    const history: ChatMessage[] = historyRows.reverse().map((r) => ({
      id: String(r.id),
      channel: r.channel,
      senderId: r.sender_id,
      senderName: r.sender_name,
      isSystem: Boolean(r.is_system),
      content: r.content,
      time: formatHHMM(r.created_at),
      timestamp: r.created_at,
    }));
    socket.emit('chat:history', history);

    // Broadcast updated map players
    io.to(`map:${realmId}:${ch.mapId}`).emit(
      'map:players',
      getMapOnlinePlayers(realmId, ch.mapId),
    );

    socket.on('chat:send', (payload: { channel: ChatChannel; content: string }) => {
      const content = String(payload?.content ?? '').trim().slice(0, 120);
      if (!content) return;
      const channel: ChatChannel = ['qu', 'pai', 'shang', 'shi'].includes(payload?.channel)
        ? payload.channel
        : 'qu';
      const now = Date.now();
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
      io.to(`realm:${realmId}`).emit('chat:message', msg);
    });

    socket.on('disconnect', () => {
      const existing = onlineBySocket.get(socket.id);
      if (existing) {
        onlineBySocket.delete(socket.id);
        io.to(`map:${existing.realmId}:${existing.mapId}`).emit(
          'map:players',
          getMapOnlinePlayers(existing.realmId, existing.mapId),
        );
      }
    });
  });

  return io;
}
