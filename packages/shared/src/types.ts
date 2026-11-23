export type RoleClass = 'wushi' | 'wenren' | 'yiren';
export type Gender = 'male' | 'female';
export type ChatChannel = 'qu' | 'pai' | 'shang' | 'shi';
export type ControlKind = 'chaos' | 'seal' | 'trap';

export interface ServerRealm {
  id: string;
  name: string;
  tag?: string;
  desc: string;
  bgImg: string;
  onlineBase: number;
}

export interface CharacterAllocations {
  freePoints: number;
  vit: number; // 体质 -> 气血 / 防御
  str: number; // 力量 -> 攻击
  int: number; // 智力 -> 精力 / 法伤
  agi: number; // 敏捷 -> 速度
}

export interface CharacterResistances {
  freePoints: number;
  phys: number;  // 抗物理 %
  chaos: number; // 抗乱 %
  seal: number;  // 抗封 %
  trap: number;  // 抗围 %
  magic: number; // 抗法术 %
}

export interface SkillProgressView {
  skillId: string;
  name: string;
  proficiency: number;
  tier: number;
  nextTierProf: number;
  mpCost: number;
  maxTargets: number;
  controlKind?: ControlKind;
  desc: string;
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
  alloc: CharacterAllocations;
  resist: CharacterResistances;
  skills: SkillProgressView[];
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
  kind: 'damage' | 'multi_hit' | 'control' | 'heal';
  mpCost: number;
  power: number;
  aoe: boolean;
  hitCount?: number;
  controlKind?: ControlKind;
  controlTurns?: number;
  baseControlRate?: number;
  damageType?: 'phys' | 'magic';
  effect: 'lei' | 'fire' | 'fg' | 'slash' | 'heal' | 'chaos' | 'seal' | 'trap';
  desc: string;
}

export interface UnitStatus {
  kind: ControlKind;
  turns: number;
}

export interface BattleUnit {
  uid: string;
  side: 'player' | 'enemy';
  isMainRole: boolean;
  name: string;
  level: number;
  roleClass: RoleClass;
  spriteKey: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  spd: number;
  alive: boolean;
  defending: boolean;
  position: number;
  statuses: UnitStatus[];
  resist?: {
    phys: number;
    chaos: number;
    seal: number;
    trap: number;
    magic: number;
  };
}

export interface BattleActionLog {
  actorUid: string;
  actorName: string;
  action: 'attack' | 'skill' | 'defend' | 'item' | 'capture' | 'flee' | 'status';
  skillId?: string;
  skillName?: string;
  effect?: SkillDef['effect'];
  proficiencyGain?: number;
  targets: Array<{
    uid: string;
    name: string;
    damage: number;
    heal?: number;
    crit?: boolean;
    killed?: boolean;
    captured?: boolean;
    appliedStatus?: ControlKind;
    resisted?: boolean;
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
