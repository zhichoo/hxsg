export type RoleClass = 'wushi' | 'wenren' | 'yiren';
export type Gender = 'male' | 'female';
export type ChatChannel = 'qu' | 'pai' | 'shang' | 'shi';

export interface ServerRealm {
  id: string;
  name: string;
  tag?: string;
  desc: string;
  bgImg: string;
  onlineBase: number;
}

export interface CharacterView {
  id: number;
  accountId: number;
  realmId: string;
  name: string;
  roleClass: RoleClass;
  gender: Gender;
  portrait: string;
  level: number;
  exp: number;
  expToNext: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  spd: number;
  silver: number;
  gold: number;
  mapId: string;
  isGm: boolean;
  generals: GeneralView[];
  inventory: InventoryItemView[];
}

export interface GeneralView {
  id: number;
  templateId: string;
  name: string;
  roleClass: RoleClass;
  spriteKey: string;
  avatarKey: string;
  level: number;
  exp: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  spd: number;
  growth: number;
  slot: number | null; // 0, 1, 2 for active battle slots; null for bench
}

export interface InventoryItemView {
  itemId: string;
  name: string;
  desc: string;
  type: 'consumable' | 'material';
  quantity: number;
  hpRestore?: number;
  mpRestore?: number;
  priceSilver: number;
}

export interface MapNpc {
  id: string;
  name: string;
  action: 'talk' | 'battle' | 'facility';
  dialogue?: string;
  enemyGroupId?: string;
  facilityId?: string;
  levelReq?: number;
}

export interface MapFacility {
  id: string;
  name: string;
  desc: string;
  icon: string;
  kind: 'inn' | 'pharmacy' | 'tavern' | 'bank' | 'market' | 'arena' | 'gm';
}

export interface MapNode {
  id: string;
  name: string;
  region: string;
  thumb: string;
  battleBg: string;
  desc: string;
  isSafe: boolean;
  recommendedLevel: string;
  neighbors: string[];
  npcs: MapNpc[];
  facilities: MapFacility[];
}

export interface SkillDef {
  id: string;
  name: string;
  roleClass: RoleClass | 'all';
  mpCost: number;
  power: number;
  aoe: boolean;
  effect: 'lei' | 'fire' | 'fg' | 'slash' | 'heal';
  desc: string;
}

export interface BattleUnit {
  uid: string;
  side: 'player' | 'enemy';
  isMainRole: boolean;
  name: string;
  level: number;
  roleClass: RoleClass;
  spriteKey: string; // e.g. r1, r1n, r2, r3, n1, n2, n3
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  spd: number;
  alive: boolean;
  defending: boolean;
  position: number; // 0..4
}

export interface BattleActionLog {
  actorUid: string;
  actorName: string;
  action: 'attack' | 'skill' | 'defend' | 'item' | 'capture' | 'flee';
  skillId?: string;
  skillName?: string;
  effect?: SkillDef['effect'];
  targets: Array<{
    uid: string;
    name: string;
    damage: number;
    heal?: number;
    crit?: boolean;
    killed?: boolean;
    captured?: boolean;
  }>;
  message: string;
}

export interface BattleState {
  battleId: string;
  mapId: string;
  mapName: string;
  battleBg: string;
  enemyGroupName: string;
  round: number;
  status: 'ongoing' | 'victory' | 'defeat' | 'fled';
  deadlineAt: number;
  units: BattleUnit[];
  lastLogs: BattleActionLog[];
  rewards?: {
    exp: number;
    silver: number;
    leveledUp: boolean;
    newLevel: number;
    droppedItem?: { itemId: string; name: string; quantity: number };
    capturedGeneral?: { name: string; growth: number };
  };
}

export interface OnlinePlayerSummary {
  id: number;
  name: string;
  level: number;
  roleClass: RoleClass;
  gender: Gender;
  mapId: string;
  avatarSprite: string;
}

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  senderId: number;
  senderName: string;
  isSystem?: boolean;
  content: string;
  time: string;
  timestamp: number;
}

export interface RankEntry {
  rank: number;
  id: number;
  name: string;
  roleClass: RoleClass;
  level: number;
  silver: number;
  gold: number;
}
