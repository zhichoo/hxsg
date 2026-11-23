export type RoleClass = 'wushi' | 'wenren' | 'yiren';
export type Gender = 'male' | 'female';
export type ChatChannel = 'qu' | 'pai' | 'shang' | 'shi';
export type ControlKind = 'chaos' | 'seal' | 'trap';
export type EquipmentSlot = 'weapon' | 'helmet' | 'armor' | 'boots' | 'mount';
export type EquipmentQuality = 'common' | 'fine' | 'rare' | 'legend';

export interface EquipmentView {
  id: number;
  templateId: string;
  name: string;
  slot: EquipmentSlot;
  quality: EquipmentQuality;
  icon: string;
  levelReq: number;
  hpBonus: number;
  mpBonus: number;
  atkBonus: number;
  defBonus: number;
  spdBonus: number;
  resPhys: number;
  resChaos: number;
  resSeal: number;
  resTrap: number;
  resMagic: number;
  sellSilver: number;
  equipped: boolean;
}

export interface EquipmentBonusSummary {
  hp: number;
  mp: number;
  atk: number;
  def: number;
  spd: number;
  resPhys: number;
  resChaos: number;
  resSeal: number;
  resTrap: number;
  resMagic: number;
}

export interface TreasureDigResult {
  outcome: 'equipment' | 'silver' | 'gold' | 'item' | 'nothing';
  message: string;
  equipment?: EquipmentView;
  silver?: number;
  gold?: number;
  item?: { itemId: string; name: string; quantity: number };
}

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

export type QuestObjectiveKind = 'kill' | 'visit_map';

export interface QuestRewardView {
  exp: number;
  silver: number;
  gold?: number;
  item?: { itemId: string; name: string; quantity: number };
  equipTemplateId?: string;
  equipName?: string;
  generalTemplateId?: string;
  generalName?: string;
}

export interface MainQuestView {
  questId: string;
  chapter: number;
  title: string;
  recLevel: number;
  npcName: string;
  dialogue: string;
  objectiveKind: QuestObjectiveKind;
  targetId: string;
  targetName: string;
  targetMapId: string;
  targetMapName: string;
  requiredCount: number;
  progress: number;
  status: 'locked' | 'available' | 'active' | 'ready' | 'claimed';
  rewards: QuestRewardView;
}

export interface PaohuanStateView {
  ring: number; // 1..10
  completedRounds: number;
  status: 'idle' | 'active' | 'ready';
  taskType?: QuestObjectiveKind;
  targetId?: string;
  targetName?: string;
  targetMapId?: string;
  targetMapName?: string;
  requiredCount: number;
  progress: number;
  rewardExp: number;
  rewardSilver: number;
  bonusHint?: string;
}

export interface CharacterQuestState {
  mainQuests: MainQuestView[];
  activeMainQuestId: string | null;
  paohuan: PaohuanStateView;
}

export interface TowerStateView {
  highestFloor: number;
  maxFloor: number;
  dailySwept: boolean;
  nextFloorName: string;
  nextFloorRecLevel: number;
  nextFloorMilestone?: string;
}

export interface CasinoDiceResult {
  dice: [number, number, number];
  sum: number;
  isBaozi: boolean;
  betType: 'big' | 'small' | 'odd' | 'even' | 'baozi';
  currency: 'silver' | 'gold';
  amount: number;
  won: boolean;
  payout: number;
  netDelta: number;
  message: string;
}

export interface CasinoChibiResult {
  winner: 'wei' | 'wu' | 'shu';
  pick: 'wei' | 'wu' | 'shu';
  currency: 'silver' | 'gold';
  amount: number;
  won: boolean;
  payout: number;
  netDelta: number;
  report: string;
  message: string;
}

export interface BankStateView {
  silver: number;
  gold: number;
}

export interface ArenaStateView {
  wins: number;
  losses: number;
  dailyRewardsLeft: number;
}

export interface MailView {
  id: number;
  senderId: number;
  senderName: string;
  recipientId: number;
  recipientName: string;
  subject: string;
  body: string;
  attachSilver: number;
  attachGold: number;
  claimed: boolean;
  isRead: boolean;
  createdAt: number;
}

export type MarketListingKind = 'item' | 'equipment' | 'general';

export interface MarketListingView {
  id: number;
  realmId: string;
  sellerId: number;
  sellerName: string;
  kind: MarketListingKind;
  title: string;
  summary: string;
  currency: 'silver' | 'gold';
  price: number;
  createdAt: number;
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
  bank: BankStateView;
  mapId: string;
  isGm: boolean;
  alloc: CharacterAllocations;
  resist: CharacterResistances;
  equipBonus: EquipmentBonusSummary;
  equipment: EquipmentView[];
  skills: SkillProgressView[];
  generals: GeneralView[];
  inventory: InventoryItemView[];
  quests: CharacterQuestState;
  tower: TowerStateView;
  arena: ArenaStateView;
  unreadMailCount: number;
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
  expToNext: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  spd: number;
  baseHp: number;
  baseMp: number;
  baseAtk: number;
  baseSpd: number;
  growth: number;
  rebirth: number;
  rarity: EquipmentQuality;
  skillId: string;
  skillName: string;
  skill2Id: string | null;
  skill2Name: string | null;
  intimacy: number;
  intimacyTitle: string;
  intimacyStatPct: number;
  intimacyResistBonus: number;
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
  kind: 'inn' | 'pharmacy' | 'blacksmith' | 'tavern' | 'tower' | 'casino' | 'bank' | 'market' | 'arena' | 'gm';
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
  skillId?: string;
  skill2Id?: string;
  intimacy?: number;
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
    droppedEquipment?: { name: string; quality: EquipmentQuality; slot: EquipmentSlot };
    capturedGeneral?: { name: string; growth: number };
    questUpdates?: string[];
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
