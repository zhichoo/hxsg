import type {
  EquipmentQuality,
  EquipmentSlot,
  MapNode,
  RoleClass,
  ServerRealm,
  SkillDef,
} from './types.js';

export const REALMS: ServerRealm[] = [
  {
    id: 'dingjunshan',
    name: '定军山',
    tag: '推荐',
    desc: '经典怀旧一区 · 1:1 复古三国世界',
    bgImg: 'f_bg2_5.png',
    onlineBase: 1,
  },
  {
    id: 'nanyangguan',
    name: '南阳关',
    desc: '经典二区 · 适合新朋友快速起号',
    bgImg: 'f_bg5_5.png',
    onlineBase: 0,
    hidden: true,
  },
  {
    id: 'gongan',
    name: '公安',
    desc: '荆州重镇 · 怀旧经典互通',
    bgImg: 'f_bg6_5.png',
    onlineBase: 0,
    hidden: true,
  },
  {
    id: 'pingyang',
    name: '平阳',
    desc: '河东故地 · 怀旧老区',
    bgImg: 'f_bg7_5.png',
    onlineBase: 0,
    hidden: true,
  },
  {
    id: 'wushengguan',
    name: '武胜关',
    desc: '中原雄关 · 怀旧老区',
    bgImg: 'f_bg8_5.png',
    onlineBase: 0,
    hidden: true,
  },
];

export const ROLE_CLASS_META: Record<
  RoleClass,
  {
    label: string;
    title: string;
    desc: string;
    maleSprite: string;
    femaleSprite: string;
    portrait: string;
    femalePortrait: string;
    baseHp: number;
    baseMp: number;
    baseAtk: number;
    baseDef: number;
    baseSpd: number;
  }
> = {
  wushi: {
    label: '武士',
    title: '破军猛将',
    desc: '高气血、强物理连击，前排斩将冲锋首选。',
    maleSprite: 'r1',
    femaleSprite: 'r1n',
    portrait: 'ws1.png',
    femalePortrait: 'ws4.png',
    baseHp: 180,
    baseMp: 60,
    baseAtk: 34,
    baseDef: 18,
    baseSpd: 20,
  },
  wenren: {
    label: '文人',
    title: '妙算谋士',
    desc: '擅长呼风唤雨与群体控场，高速度高法伤。',
    maleSprite: 'r2',
    femaleSprite: 'r2n',
    portrait: 'wr1.png',
    femalePortrait: 'wr4.png',
    baseHp: 130,
    baseMp: 140,
    baseAtk: 24,
    baseDef: 14,
    baseSpd: 28,
  },
  yiren: {
    label: '异人',
    title: '玄门道法',
    desc: '精通五雷轰顶与排山倒海，爆发法术无人能敌。',
    maleSprite: 'r3',
    femaleSprite: 'r3n',
    portrait: 'yr1.png',
    femalePortrait: 'yr4.png',
    baseHp: 145,
    baseMp: 130,
    baseAtk: 28,
    baseDef: 15,
    baseSpd: 24,
  },
};

export const SKILLS: SkillDef[] = [
  // 武士技能
  {
    id: 'liandao',
    name: '力劈华山',
    roleClass: 'wushi',
    kind: 'damage',
    damageType: 'phys',
    mpCost: 14,
    power: 1.65,
    aoe: false,
    effect: 'slash',
    desc: '凝聚气力猛劈单体，熟练度越高威力越强。',
  },
  {
    id: 'lianji',
    name: '连环突刺',
    roleClass: 'wushi',
    kind: 'multi_hit',
    damageType: 'phys',
    mpCost: 22,
    power: 0.92,
    hitCount: 2,
    aoe: false,
    effect: 'slash',
    desc: '经典武士连击！对单体连续出枪 2 次，3阶以上可触发3连击。',
  },
  {
    id: 'psdh',
    name: '排山倒海',
    roleClass: 'wushi',
    kind: 'damage',
    damageType: 'phys',
    mpCost: 28,
    power: 1.18,
    aoe: true,
    effect: 'fg',
    desc: '横扫敌阵，随熟练度提升最多打击 5 个目标。',
  },
  {
    id: 'pojia',
    name: '破甲重击',
    roleClass: 'wushi',
    kind: 'debuff',
    damageType: 'phys',
    mpCost: 24,
    power: 1.48,
    aoe: false,
    debuffKind: 'def_down',
    debuffTurns: 2,
    effect: 'slash',
    desc: '沉重劈斩震碎敌甲，造成高伤并使目标 2 回合内所受伤害提高 28%。',
  },

  // 文人技能（经典控场三绝：乱 / 封 / 围 + 毒 + 呼风唤雨）
  {
    id: 'hunluan',
    name: '离间计',
    roleClass: 'wenren',
    kind: 'control',
    mpCost: 20,
    power: 0,
    aoe: true,
    controlKind: 'chaos',
    controlTurns: 2,
    baseControlRate: 0.74,
    effect: 'chaos',
    desc: '【乱】使目标陷入混乱 2 回合，敌我不分互相攻击，随熟练度增目标数。',
  },
  {
    id: 'fengyin',
    name: '定身计',
    roleClass: 'wenren',
    kind: 'control',
    mpCost: 20,
    power: 0,
    aoe: true,
    controlKind: 'seal',
    controlTurns: 2,
    baseControlRate: 0.78,
    effect: 'seal',
    desc: '【封】封印目标 2 回合，令其完全无法出手或施法。',
  },
  {
    id: 'weikun',
    name: '画地为牢',
    roleClass: 'wenren',
    kind: 'control',
    mpCost: 18,
    power: 0,
    aoe: true,
    controlKind: 'trap',
    controlTurns: 2,
    baseControlRate: 0.8,
    effect: 'trap',
    desc: '【围】困住敌军 2 回合，无法普攻且所受伤害提高 25%。',
  },
  {
    id: 'wudu',
    name: '五毒攻心',
    roleClass: 'wenren',
    kind: 'poison',
    damageType: 'magic',
    mpCost: 24,
    power: 0.72,
    aoe: true,
    debuffKind: 'poison',
    debuffTurns: 3,
    effect: 'fire',
    desc: '【毒】原版文人四系绝技之一！造成法伤并令敌军中毒 3 回合，每回合持续扣血。',
  },
  {
    id: 'hfhy',
    name: '呼风唤雨',
    roleClass: 'wenren',
    kind: 'damage',
    damageType: 'magic',
    mpCost: 26,
    power: 1.36,
    aoe: true,
    effect: 'wind_rain',
    desc: '引狂风暴雨席卷敌军，随熟练度提升目标数与法伤。',
  },

  // 异人技能（经典爆发雷法 + 魔神/疾风团队增益 + 妙手回春）
  {
    id: 'wlhd',
    name: '五雷轰顶',
    roleClass: 'yiren',
    kind: 'damage',
    damageType: 'magic',
    mpCost: 24,
    power: 1.76,
    aoe: false,
    effect: 'lei',
    desc: '引九天玄雷直劈单体，造成极高雷电爆发伤害。',
  },
  {
    id: 'tianlei',
    name: '雷动九天',
    roleClass: 'yiren',
    kind: 'damage',
    damageType: 'magic',
    mpCost: 30,
    power: 1.24,
    aoe: true,
    effect: 'lei',
    desc: '漫天雷劫降临，随熟练度提升最多劈击 5 个敌方目标。',
  },
  {
    id: 'moshen',
    name: '魔神附体',
    roleClass: 'yiren',
    kind: 'buff',
    mpCost: 22,
    power: 0,
    aoe: true,
    buffKind: 'atk_up',
    buffTurns: 3,
    buffPct: 28,
    effect: 'fg',
    desc: '原版异人核心团队增益！提升我方全体/多目标物理与法术攻击 28%~38%，持续 3 回合。',
  },
  {
    id: 'jifeng',
    name: '疾风咒',
    roleClass: 'yiren',
    kind: 'buff',
    mpCost: 20,
    power: 0,
    aoe: true,
    buffKind: 'spd_up',
    buffTurns: 3,
    buffPct: 26,
    effect: 'heal',
    desc: '原版异人团队加速神技！提升我方多目标速度 26%~36%，抢占先手出手权，持续 3 回合。',
  },
  {
    id: 'huigong',
    name: '妙手回春',
    roleClass: 'yiren',
    kind: 'heal',
    mpCost: 20,
    power: 1.4,
    aoe: false,
    effect: 'heal',
    desc: '玄门医道心法，恢复自身大量气血，熟练度越高回血越多。',
  },
];

export interface ItemTemplate {
  itemId: string;
  name: string;
  desc: string;
  type: 'consumable' | 'material';
  hpRestore?: number;
  mpRestore?: number;
  reviveHpPct?: number;
  loyaltyRestore?: number;
  priceSilver: number;
  priceGold?: number;
}

export const ITEMS: Record<string, ItemTemplate> = {
  jinchuang: {
    itemId: 'jinchuang',
    name: '金创药',
    desc: '恢复气血 120 点，战斗内外均可使用（战斗中可喂给副将）。',
    type: 'consumable',
    hpRestore: 120,
    priceSilver: 40,
  },
  dahuan: {
    itemId: 'dahuan',
    name: '大还丹',
    desc: '名医秘制丹药，恢复气血 360 点（战斗中可喂给副将）。',
    type: 'consumable',
    hpRestore: 360,
    priceSilver: 140,
  },
  ningshen: {
    itemId: 'ningshen',
    name: '凝神散',
    desc: '恢复精力 90 点，文人异人练级必备（战斗中可喂给副将）。',
    type: 'consumable',
    mpRestore: 90,
    priceSilver: 50,
  },
  huanhundan: {
    itemId: 'huanhundan',
    name: '还魂丹',
    desc: '原版经典救命仙丹！战斗中复活倒地副将并恢复 45% 气血。',
    type: 'consumable',
    reviveHpPct: 45,
    priceSilver: 180,
  },
  roubaozi: {
    itemId: 'roubaozi',
    name: '热腾腾肉包子',
    desc: '原版副将口粮！在副将营帐喂给副将，恢复 15 点忠诚度。',
    type: 'material',
    loyaltyRestore: 15,
    priceSilver: 60,
  },
  zhongyidan: {
    itemId: 'zhongyidan',
    name: '忠义丹',
    desc: '犒赏三军秘药！在副将营帐喂给副将，大幅恢复 40 点忠诚度。',
    type: 'material',
    loyaltyRestore: 40,
    priceSilver: 180,
  },
  xuantie: {
    itemId: 'xuantie',
    name: '玄铁矿',
    desc: '铁匠铺打造随机高属性装备必备矿石，战斗、挖宝或杂货可获。',
    type: 'material',
    priceSilver: 400,
  },
  jinglianshi: {
    itemId: 'jinglianshi',
    name: '精炼石',
    desc: '铁匠铺重铸装备品质与随机属性波动的核心灵石（金砖专供或首领掉落）。',
    type: 'material',
    priceSilver: 0,
    priceGold: 15,
  },
  jiangling: {
    itemId: 'jiangling',
    name: '招贤令',
    desc: '在招贤馆消耗 1 枚寻访名将，有机会直接抽到关羽、赵云、貂蝉、吕布！',
    type: 'material',
    priceSilver: 0,
    priceGold: 25,
  },
  jingyandan: {
    itemId: 'jingyandan',
    name: '副将经验丹',
    desc: '在副将营帐喂给副将，随主将等级提升大幅增加副将经验并+5默契。',
    type: 'material',
    priceSilver: 240,
  },
  xisuidan: {
    itemId: 'xisuidan',
    name: '洗髓丹',
    desc: '在副将营帐重洗副将的成长率与初值，有机会洗出极品/神品！',
    type: 'material',
    priceSilver: 0,
    priceGold: 20,
  },
  baotu: {
    itemId: 'baotu',
    name: '藏宝图',
    desc: '古旧羊皮图卷，在行囊点击「挖宝」可寻得神兵、名马、金砖或银两。',
    type: 'material',
    priceSilver: 300,
  },
  book_lianji: {
    itemId: 'book_lianji',
    name: '《连环突刺》秘籍',
    desc: '副将技能书：在副将营帐给副将研习，习得武士连击【连环突刺】。',
    type: 'material',
    priceSilver: 0,
    priceGold: 45,
  },
  book_psdh: {
    itemId: 'book_psdh',
    name: '《排山倒海》秘籍',
    desc: '副将技能书：在副将营帐给副将研习，习得群攻绝技【排山倒海】。',
    type: 'material',
    priceSilver: 0,
    priceGold: 60,
  },
  book_hunluan: {
    itemId: 'book_hunluan',
    name: '《离间计》兵书',
    desc: '副将技能书：在副将营帐给副将研习，习得群体混乱【离间计】。',
    type: 'material',
    priceSilver: 0,
    priceGold: 55,
  },
  book_fengyin: {
    itemId: 'book_fengyin',
    name: '《定身计》兵书',
    desc: '副将技能书：在副将营帐给副将研习，习得强控封印【定身计】。',
    type: 'material',
    priceSilver: 0,
    priceGold: 55,
  },
  book_wlhd: {
    itemId: 'book_wlhd',
    name: '《五雷轰顶》道书',
    desc: '副将技能书：在副将营帐给副将研习，习得爆发雷法【五雷轰顶】。',
    type: 'material',
    priceSilver: 0,
    priceGold: 55,
  },
  book_huigong: {
    itemId: 'book_huigong',
    name: '《妙手回春》医书',
    desc: '副将技能书：副将在战斗中见主将或友军残血时自动施展【妙手回春】疗伤！',
    type: 'material',
    priceSilver: 0,
    priceGold: 45,
  },
};

export const GENERAL_SKILL_BOOKS: Record<string, string> = {
  book_lianji: 'lianji',
  book_psdh: 'psdh',
  book_hunluan: 'hunluan',
  book_fengyin: 'fengyin',
  book_wlhd: 'wlhd',
  book_huigong: 'huigong',
};

export function getGeneralIntimacyInfo(intimacy: number): {
  title: string;
  statPct: number;
  resistBonus: number;
} {
  const val = Math.max(0, Math.min(100, Math.floor(intimacy)));
  if (val >= 100) return { title: '生死之交', statPct: 15, resistBonus: 15 };
  if (val >= 60) return { title: '莫逆之交', statPct: 8, resistBonus: 10 };
  if (val >= 30) return { title: '同袍共战', statPct: 4, resistBonus: 5 };
  return { title: '初识', statPct: 0, resistBonus: 0 };
}

export interface EquipmentSetDef {
  setId: string;
  name: string;
  levelTier: number;
  twoPieceDesc: string;
  fourPieceDesc: string;
  twoPiece: { hp?: number; mp?: number; atk?: number; def?: number; spd?: number; allRes?: number };
  fourPiece: { hp?: number; mp?: number; atk?: number; def?: number; spd?: number; allRes?: number };
}

export const EQUIPMENT_SETS: Record<string, EquipmentSetDef> = {
  set_huwei: {
    setId: 'set_huwei',
    name: '虎卫套装',
    levelTier: 10,
    twoPieceDesc: '2件：气血+120 · 攻击+18',
    fourPieceDesc: '4件：速度+15 · 全抗性+6%',
    twoPiece: { hp: 120, atk: 18 },
    fourPiece: { spd: 15, allRes: 6 },
  },
  set_chibi: {
    setId: 'set_chibi',
    name: '赤壁战魂套',
    levelTier: 22,
    twoPieceDesc: '2件：气血+360 · 攻击+55',
    fourPieceDesc: '4件：速度+30 · 全抗性+8%',
    twoPiece: { hp: 360, atk: 55 },
    fourPiece: { spd: 30, allRes: 8 },
  },
  set_wuhu: {
    setId: 'set_wuhu',
    name: '五虎神威套',
    levelTier: 35,
    twoPieceDesc: '2件：气血+780 · 攻击+120',
    fourPieceDesc: '4件：速度+48 · 全抗性+10%',
    twoPiece: { hp: 780, atk: 120 },
    fourPiece: { spd: 48, allRes: 10 },
  },
  set_wolong: {
    setId: 'set_wolong',
    name: '卧龙传世套',
    levelTier: 50,
    twoPieceDesc: '2件：气血+1450 · 攻击+210',
    fourPieceDesc: '4件：速度+70 · 全抗性+12%',
    twoPiece: { hp: 1450, atk: 210 },
    fourPiece: { spd: 70, allRes: 12 },
  },
};

export const TEMPLATE_SET_MAP: Record<string, string> = {
  qixing_jian: 'set_huwei',
  longdan_qiang: 'set_huwei',
  zijin_guan: 'set_huwei',
  bagua_pao: 'set_huwei',
  huangjin_jia: 'set_huwei',
  jifeng_xue: 'set_huwei',
  dilu_ma: 'set_huwei',
  chitu_ma: 'set_huwei',
  qinglong_dao: 'set_chibi',
  fengchi_kui: 'set_chibi',
  mingguang_kai: 'set_chibi',
  yunlong_xue: 'set_chibi',
  jueying_ma: 'set_chibi',
  zhangba_mao: 'set_wuhu',
  zhuge_yushan: 'set_wuhu',
  wuhou_jin: 'set_wuhu',
  xuanwu_jia: 'set_wuhu',
  lingbo_lv: 'set_wuhu',
  zhuahuang_ma: 'set_wuhu',
  fangtian_ji: 'set_wolong',
  taiji_fajian: 'set_wolong',
  tianlong_guan: 'set_wolong',
  qilin_baojia: 'set_wolong',
  tengyun_xue: 'set_wolong',
  bailong_ju: 'set_wolong',
  hanxue_ma: 'set_wolong',
};

export function calcEquipmentSetBonuses(
  items: Array<{ templateId: string; setId?: string | null }>,
): {
  hp: number;
  mp: number;
  atk: number;
  def: number;
  spd: number;
  allRes: number;
  descriptions: string[];
} {
  const counts = new Map<string, number>();
  for (const item of items) {
    const sid = item.setId || TEMPLATE_SET_MAP[item.templateId];
    if (sid && EQUIPMENT_SETS[sid]) {
      counts.set(sid, (counts.get(sid) ?? 0) + 1);
    }
  }
  let hp = 0;
  let mp = 0;
  let atk = 0;
  let def = 0;
  let spd = 0;
  let allRes = 0;
  const descriptions: string[] = [];
  for (const [sid, cnt] of counts.entries()) {
    const defSet = EQUIPMENT_SETS[sid];
    if (!defSet) continue;
    if (cnt >= 2) {
      hp += defSet.twoPiece.hp ?? 0;
      mp += defSet.twoPiece.mp ?? 0;
      atk += defSet.twoPiece.atk ?? 0;
      def += defSet.twoPiece.def ?? 0;
      spd += defSet.twoPiece.spd ?? 0;
      allRes += defSet.twoPiece.allRes ?? 0;
      descriptions.push(`${defSet.name}(${cnt}件)：${defSet.twoPieceDesc}`);
    }
    if (cnt >= 4) {
      hp += defSet.fourPiece.hp ?? 0;
      mp += defSet.fourPiece.mp ?? 0;
      atk += defSet.fourPiece.atk ?? 0;
      def += defSet.fourPiece.def ?? 0;
      spd += defSet.fourPiece.spd ?? 0;
      allRes += defSet.fourPiece.allRes ?? 0;
      descriptions.push(`${defSet.name}(4件触发)：${defSet.fourPieceDesc}`);
    }
  }
  return { hp, mp, atk, def, spd, allRes, descriptions };
}

export interface CraftRecipeDef {
  id: string;
  name: string;
  levelReq: number;
  silverCost: number;
  oreCost: number;
  pool: string[];
  desc: string;
}

export const CRAFT_RECIPES: CraftRecipeDef[] = [
  {
    id: 'craft_lv10',
    name: '打造 10级 虎卫精工',
    levelReq: 6,
    silverCost: 1200,
    oreCost: 1,
    pool: ['qixing_jian', 'longdan_qiang', 'zijin_guan', 'bagua_pao', 'huangjin_jia', 'jifeng_xue'],
    desc: '消耗 1 枚玄铁矿 + 1200 银两，随机锻造带波动词条的 7~10 级虎卫套装部件（有几率出神兵！）',
  },
  {
    id: 'craft_lv22',
    name: '打造 22级 赤壁战魂',
    levelReq: 18,
    silverCost: 3800,
    oreCost: 2,
    pool: ['qinglong_dao', 'fengchi_kui', 'mingguang_kai', 'yunlong_xue'],
    desc: '消耗 2 枚玄铁矿 + 3800 银两，锻造带随机词条的 22 级赤壁套装部件。',
  },
  {
    id: 'craft_lv35',
    name: '打造 35级 五虎神威',
    levelReq: 30,
    silverCost: 11000,
    oreCost: 3,
    pool: ['zhangba_mao', 'zhuge_yushan', 'wuhou_jin', 'xuanwu_jia', 'lingbo_lv'],
    desc: '消耗 3 枚玄铁矿 + 11000 银两，锻造带随机词条的 35 级五虎套装部件。',
  },
  {
    id: 'craft_lv50',
    name: '打造 50级 卧龙神兵',
    levelReq: 45,
    silverCost: 28000,
    oreCost: 5,
    pool: ['fangtian_ji', 'taiji_fajian', 'tianlong_guan', 'qilin_baojia', 'tengyun_xue'],
    desc: '消耗 5 枚玄铁矿 + 28000 银两，锻造顶级 50 级卧龙传世神兵部件！',
  },
];

export const CLASSIC_EMOJIS: Array<{ code: string; file: string; label: string }> = Array.from(
  { length: 24 },
  (_, i) => {
    const code = `f${String(i).padStart(3, '0')}`;
    const labels = [
      '微笑', '呲牙', '大笑', '偷笑', '调皮', '眨眼',
      '色', '得意', '傲慢', '害羞', '惊讶', '流汗',
      '尴尬', '发怒', '大哭', '委屈', '衰', '晕',
      '疑问', '嘘', '酷', '抱拳', '强', '胜利',
    ];
    return { code, file: `${code}.png`, label: labels[i] || code };
  },
);

export interface EquipmentTemplate {
  templateId: string;
  name: string;
  slot: EquipmentSlot;
  quality: EquipmentQuality;
  icon: string;
  levelReq: number;
  priceSilver: number;
  shopAvailable: boolean;
  hpBonus?: number;
  mpBonus?: number;
  atkBonus?: number;
  defBonus?: number;
  spdBonus?: number;
  resPhys?: number;
  resChaos?: number;
  resSeal?: number;
  resTrap?: number;
  resMagic?: number;
  desc: string;
}

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: '武器',
  helmet: '头盔',
  armor: '铠甲',
  boots: '靴子',
  mount: '战马',
};

export const EQUIPMENT_TEMPLATES: Record<string, EquipmentTemplate> = {
  // 武器
  qingtong_qiang: {
    templateId: 'qingtong_qiang',
    name: '青铜长枪',
    slot: 'weapon',
    quality: 'common',
    icon: 'sg4b_item1.png',
    levelReq: 1,
    priceSilver: 220,
    shopAvailable: true,
    atkBonus: 14,
    desc: '军中制式青铜枪，初入乱世称手兵器。',
  },
  taomu_jian: {
    templateId: 'taomu_jian',
    name: '桃木法剑',
    slot: 'weapon',
    quality: 'common',
    icon: 'sg4b_item2.png',
    levelReq: 1,
    priceSilver: 240,
    shopAvailable: true,
    atkBonus: 10,
    mpBonus: 35,
    desc: '道家桃木削制，助文人异人凝聚法力。',
  },
  bailian_dao: {
    templateId: 'bailian_dao',
    name: '百炼钢刀',
    slot: 'weapon',
    quality: 'fine',
    icon: 'sg4b_item3.png',
    levelReq: 4,
    priceSilver: 680,
    shopAvailable: true,
    atkBonus: 28,
    spdBonus: 4,
    desc: '千锤百炼而成的钢刀，劈砍凌厉。',
  },
  qixing_jian: {
    templateId: 'qixing_jian',
    name: '七星宝剑',
    slot: 'weapon',
    quality: 'rare',
    icon: 'sg4b_item4.png',
    levelReq: 7,
    priceSilver: 1650,
    shopAvailable: true,
    atkBonus: 42,
    mpBonus: 70,
    resMagic: 8,
    desc: '曹操曾献董卓之名剑，攻法兼备。',
  },
  longdan_qiang: {
    templateId: 'longdan_qiang',
    name: '龙胆亮银枪',
    slot: 'weapon',
    quality: 'legend',
    icon: 'sg4b_item5.png',
    levelReq: 10,
    priceSilver: 4200,
    shopAvailable: false,
    atkBonus: 68,
    spdBonus: 12,
    resChaos: 10,
    desc: '常山赵子龙绝世神兵，仅可通过挖宝或高阶战利品获得。',
  },
  qinglong_dao: {
    templateId: 'qinglong_dao',
    name: '青龙偃月刀',
    slot: 'weapon',
    quality: 'rare',
    icon: 'sg4b_item3.png',
    levelReq: 22,
    priceSilver: 6200,
    shopAvailable: true,
    atkBonus: 98,
    hpBonus: 140,
    spdBonus: 10,
    desc: '重八十二斤冷艳锯，威震荆襄的中阶神兵。',
  },
  zhangba_mao: {
    templateId: 'zhangba_mao',
    name: '丈八蛇矛',
    slot: 'weapon',
    quality: 'rare',
    icon: 'sg4b_item5.png',
    levelReq: 35,
    priceSilver: 15000,
    shopAvailable: true,
    atkBonus: 152,
    spdBonus: 18,
    resChaos: 10,
    desc: '燕人张翼德随身长矛，刺如灵蛇吐信。',
  },
  zhuge_yushan: {
    templateId: 'zhuge_yushan',
    name: '卧龙羽扇',
    slot: 'weapon',
    quality: 'rare',
    icon: 'sg4b_item4.png',
    levelReq: 35,
    priceSilver: 15000,
    shopAvailable: true,
    atkBonus: 128,
    mpBonus: 220,
    spdBonus: 24,
    resMagic: 14,
    resSeal: 10,
    desc: '白羽轻摇定乾坤，文人异人高阶法器。',
  },
  fangtian_ji: {
    templateId: 'fangtian_ji',
    name: '方天画戟',
    slot: 'weapon',
    quality: 'legend',
    icon: 'sg4b_item5.png',
    levelReq: 50,
    priceSilver: 38000,
    shopAvailable: false,
    atkBonus: 235,
    hpBonus: 280,
    spdBonus: 28,
    resPhys: 10,
    resChaos: 14,
    desc: '温侯无双绝世神戟，仅可通过高阶挖宝、首领掉落或登塔获取。',
  },
  taiji_fajian: {
    templateId: 'taiji_fajian',
    name: '太极仙剑',
    slot: 'weapon',
    quality: 'legend',
    icon: 'sg4b_item2.png',
    levelReq: 50,
    priceSilver: 38000,
    shopAvailable: false,
    atkBonus: 198,
    mpBonus: 360,
    spdBonus: 34,
    resMagic: 18,
    resSeal: 15,
    desc: '玄门镇派仙剑，施法速度与法术爆发登峰造极。',
  },

  // 头盔
  bujin_mao: {
    templateId: 'bujin_mao',
    name: '青布头巾',
    slot: 'helmet',
    quality: 'common',
    icon: 'sg4b_item6.png',
    levelReq: 1,
    priceSilver: 180,
    shopAvailable: true,
    hpBonus: 40,
    defBonus: 4,
    resChaos: 4,
    desc: '轻便布巾，略微定神防乱。',
  },
  tiekui: {
    templateId: 'tiekui',
    name: '精铁战盔',
    slot: 'helmet',
    quality: 'fine',
    icon: 'sg4b_item7.png',
    levelReq: 5,
    priceSilver: 620,
    shopAvailable: true,
    hpBonus: 95,
    defBonus: 10,
    resChaos: 8,
    resSeal: 6,
    desc: '精铁锻打战盔，兼顾防御与抗控。',
  },
  zijin_guan: {
    templateId: 'zijin_guan',
    name: '束发紫金冠',
    slot: 'helmet',
    quality: 'rare',
    icon: 'sg4b_item8.png',
    levelReq: 9,
    priceSilver: 1900,
    shopAvailable: false,
    hpBonus: 160,
    mpBonus: 60,
    resChaos: 15,
    resSeal: 12,
    desc: '大将冠冕，大幅提升抗混乱与抗封印。',
  },
  fengchi_kui: {
    templateId: 'fengchi_kui',
    name: '凤翅亮银盔',
    slot: 'helmet',
    quality: 'rare',
    icon: 'sg4b_item7.png',
    levelReq: 22,
    priceSilver: 5500,
    shopAvailable: true,
    hpBonus: 260,
    defBonus: 22,
    resChaos: 16,
    resSeal: 12,
    desc: '亮银锻造凤翅盔，荆襄大将制式宝盔。',
  },
  wuhou_jin: {
    templateId: 'wuhou_jin',
    name: '武侯纶巾',
    slot: 'helmet',
    quality: 'rare',
    icon: 'sg4b_item8.png',
    levelReq: 35,
    priceSilver: 13500,
    shopAvailable: true,
    hpBonus: 420,
    mpBonus: 160,
    defBonus: 32,
    resChaos: 22,
    resSeal: 18,
    desc: '羽扇纶巾谈笑间，极强定神抗控宝冠。',
  },
  tianlong_guan: {
    templateId: 'tianlong_guan',
    name: '天龙紫金冠',
    slot: 'helmet',
    quality: 'legend',
    icon: 'sg4b_item8.png',
    levelReq: 50,
    priceSilver: 32000,
    shopAvailable: false,
    hpBonus: 680,
    mpBonus: 220,
    defBonus: 48,
    resChaos: 28,
    resSeal: 24,
    resTrap: 14,
    desc: '龙纹紫金传世冠，百计难侵，临阵不动如山。',
  },

  // 铠甲
  cubu_yi: {
    templateId: 'cubu_yi',
    name: '粗布战袍',
    slot: 'armor',
    quality: 'common',
    icon: 'sg4b_item9.png',
    levelReq: 1,
    priceSilver: 200,
    shopAvailable: true,
    hpBonus: 55,
    defBonus: 6,
    resPhys: 4,
    desc: '寻常行伍战衣，聊胜于无。',
  },
  suozi_jia: {
    templateId: 'suozi_jia',
    name: '精钢锁子甲',
    slot: 'armor',
    quality: 'fine',
    icon: 'sg4b_item10.png',
    levelReq: 5,
    priceSilver: 760,
    shopAvailable: true,
    hpBonus: 130,
    defBonus: 14,
    resPhys: 10,
    desc: '环环相扣的锁子甲，大幅抵御刀枪伤害。',
  },
  bagua_pao: {
    templateId: 'bagua_pao',
    name: '八卦道袍',
    slot: 'armor',
    quality: 'rare',
    icon: 'sg4b_item11.png',
    levelReq: 8,
    priceSilver: 1800,
    shopAvailable: true,
    hpBonus: 145,
    mpBonus: 95,
    resMagic: 14,
    resSeal: 10,
    desc: '道家护身法袍，极克法术与控制。',
  },
  huangjin_jia: {
    templateId: 'huangjin_jia',
    name: '黄金锁子甲',
    slot: 'armor',
    quality: 'legend',
    icon: 'sg4b_item12.png',
    levelReq: 10,
    priceSilver: 4500,
    shopAvailable: false,
    hpBonus: 260,
    defBonus: 24,
    resPhys: 18,
    resMagic: 10,
    desc: '传世名甲，穿戴后稳如泰山。',
  },
  mingguang_kai: {
    templateId: 'mingguang_kai',
    name: '玄铁明光铠',
    slot: 'armor',
    quality: 'rare',
    icon: 'sg4b_item10.png',
    levelReq: 22,
    priceSilver: 6000,
    shopAvailable: true,
    hpBonus: 390,
    defBonus: 34,
    resPhys: 16,
    resMagic: 10,
    desc: '护心镜明光耀目，兼抗刀剑与玄法。',
  },
  xuanwu_jia: {
    templateId: 'xuanwu_jia',
    name: '玄武重铠',
    slot: 'armor',
    quality: 'rare',
    icon: 'sg4b_item11.png',
    levelReq: 35,
    priceSilver: 14500,
    shopAvailable: true,
    hpBonus: 640,
    mpBonus: 180,
    defBonus: 50,
    resPhys: 22,
    resMagic: 18,
    desc: '四象玄武镇守重甲，水火不侵。',
  },
  qilin_baojia: {
    templateId: 'qilin_baojia',
    name: '麒麟吞天甲',
    slot: 'armor',
    quality: 'legend',
    icon: 'sg4b_item12.png',
    levelReq: 50,
    priceSilver: 36000,
    shopAvailable: false,
    hpBonus: 980,
    mpBonus: 240,
    defBonus: 72,
    resPhys: 28,
    resMagic: 24,
    resSeal: 12,
    desc: '传世无双宝甲，可硬撼五丈原与天玄塔顶峰强敌。',
  },

  // 靴子
  caoxie: {
    templateId: 'caoxie',
    name: '疾行草履',
    slot: 'boots',
    quality: 'common',
    icon: 'sg4b_item13.png',
    levelReq: 1,
    priceSilver: 160,
    shopAvailable: true,
    spdBonus: 7,
    resTrap: 4,
    desc: '轻便行军鞋，抢占先手出手权。',
  },
  tayun_lv: {
    templateId: 'tayun_lv',
    name: '踏云战靴',
    slot: 'boots',
    quality: 'fine',
    icon: 'sg4b_item14.png',
    levelReq: 5,
    priceSilver: 640,
    shopAvailable: true,
    spdBonus: 16,
    hpBonus: 45,
    resTrap: 10,
    desc: '身轻如燕，文人先手控场必备。',
  },
  jifeng_xue: {
    templateId: 'jifeng_xue',
    name: '追风神靴',
    slot: 'boots',
    quality: 'rare',
    icon: 'sg4b_item15.png',
    levelReq: 9,
    priceSilver: 1750,
    shopAvailable: false,
    spdBonus: 28,
    resTrap: 16,
    resChaos: 8,
    desc: '日行千里之神靴，出手快人一步。',
  },
  yunlong_xue: {
    templateId: 'yunlong_xue',
    name: '云龙战靴',
    slot: 'boots',
    quality: 'rare',
    icon: 'sg4b_item14.png',
    levelReq: 22,
    priceSilver: 5200,
    shopAvailable: true,
    spdBonus: 42,
    hpBonus: 130,
    resTrap: 18,
    resChaos: 10,
    desc: '云龙纹饰战靴，疾步如风破围困。',
  },
  lingbo_lv: {
    templateId: 'lingbo_lv',
    name: '凌波神履',
    slot: 'boots',
    quality: 'rare',
    icon: 'sg4b_item15.png',
    levelReq: 35,
    priceSilver: 12800,
    shopAvailable: true,
    spdBonus: 68,
    hpBonus: 210,
    resTrap: 24,
    resChaos: 14,
    desc: '凌波微步履水无痕，中后期先手利器。',
  },
  tengyun_xue: {
    templateId: 'tengyun_xue',
    name: '腾云御风靴',
    slot: 'boots',
    quality: 'legend',
    icon: 'sg4b_item15.png',
    levelReq: 50,
    priceSilver: 30000,
    shopAvailable: false,
    spdBonus: 102,
    hpBonus: 340,
    resTrap: 30,
    resChaos: 18,
    resSeal: 14,
    desc: '踏云逐电之传世神靴，先发制人克敌机先。',
  },

  // 战马（使用官方原版 h_1 ~ h_8 战马素材！）
  huangbiao_ma: {
    templateId: 'huangbiao_ma',
    name: '黄骠马',
    slot: 'mount',
    quality: 'common',
    icon: 'h_2.png',
    levelReq: 1,
    priceSilver: 450,
    shopAvailable: true,
    hpBonus: 65,
    spdBonus: 10,
    desc: '耐力极佳的军中良驹，新手第一匹坐骑。',
  },
  wuzhui_ma: {
    templateId: 'wuzhui_ma',
    name: '乌骓马',
    slot: 'mount',
    quality: 'fine',
    icon: 'h_3.png',
    levelReq: 5,
    priceSilver: 1400,
    shopAvailable: true,
    hpBonus: 135,
    atkBonus: 15,
    spdBonus: 18,
    resPhys: 6,
    desc: '通体乌黑发亮，奔袭如雷霆万钧。',
  },
  dilu_ma: {
    templateId: 'dilu_ma',
    name: '的卢',
    slot: 'mount',
    quality: 'rare',
    icon: 'h_5.png',
    levelReq: 8,
    priceSilver: 2800,
    shopAvailable: true,
    hpBonus: 190,
    mpBonus: 60,
    spdBonus: 26,
    resTrap: 12,
    resChaos: 10,
    desc: '一跃檀溪之名驹，极速兼顾防控制。',
  },
  chitu_ma: {
    templateId: 'chitu_ma',
    name: '赤兔宝马',
    slot: 'mount',
    quality: 'legend',
    icon: 'h_1.png',
    levelReq: 10,
    priceSilver: 6800,
    shopAvailable: false,
    hpBonus: 300,
    atkBonus: 32,
    spdBonus: 36,
    resPhys: 12,
    resChaos: 12,
    desc: '人中吕布，马中赤兔！前期梦寐以求的传世名驹。',
  },
  jueying_ma: {
    templateId: 'jueying_ma',
    name: '绝影',
    slot: 'mount',
    quality: 'rare',
    icon: 'h_4.png',
    levelReq: 22,
    priceSilver: 8800,
    shopAvailable: true,
    hpBonus: 440,
    atkBonus: 48,
    spdBonus: 52,
    resTrap: 14,
    resChaos: 12,
    desc: '曹操名驹，奔行无影，中阶极速坐骑。',
  },
  zhuahuang_ma: {
    templateId: 'zhuahuang_ma',
    name: '爪黄飞电',
    slot: 'mount',
    quality: 'rare',
    icon: 'h_6.png',
    levelReq: 35,
    priceSilver: 22000,
    shopAvailable: true,
    hpBonus: 720,
    mpBonus: 150,
    atkBonus: 74,
    spdBonus: 78,
    resPhys: 14,
    resChaos: 16,
    desc: '气势磅礴之皇家御马，攻防速全面跃升。',
  },
  bailong_ju: {
    templateId: 'bailong_ju',
    name: '白龙神驹',
    slot: 'mount',
    quality: 'legend',
    icon: 'h_7.png',
    levelReq: 50,
    priceSilver: 48000,
    shopAvailable: false,
    hpBonus: 1080,
    mpBonus: 220,
    atkBonus: 112,
    spdBonus: 110,
    resPhys: 18,
    resChaos: 20,
    resMagic: 14,
    desc: '通体雪白如龙腾云，仅在高阶挖宝与首领战中现世。',
  },
  hanxue_ma: {
    templateId: 'hanxue_ma',
    name: '汗血天马',
    slot: 'mount',
    quality: 'legend',
    icon: 'h_8.png',
    levelReq: 58,
    priceSilver: 68000,
    shopAvailable: false,
    hpBonus: 1420,
    mpBonus: 280,
    atkBonus: 148,
    spdBonus: 138,
    resPhys: 22,
    resChaos: 24,
    resSeal: 18,
    resTrap: 18,
    desc: '西域大宛绝世天马，天玄塔 50 层登顶与五丈原终极神骑！',
  },
};

export interface GeneralTemplate {
  templateId: string;
  name: string;
  roleClass: RoleClass;
  spriteKey: string;
  avatarKey: string;
  skillId: string;
  baseHp: number;
  baseMp: number;
  baseAtk: number;
  baseSpd: number;
  growthMin: number;
  growthMax: number;
  growth: number;
  recruitCostSilver: number;
  tavernDirect?: boolean;
  desc: string;
}

export const GENERAL_TEMPLATES: Record<string, GeneralTemplate> = {
  dipi: {
    templateId: 'dipi',
    name: '街头地痞',
    roleClass: 'wushi',
    spriteKey: 'n1',
    avatarKey: 'ws1.png',
    skillId: 'liandao',
    baseHp: 110,
    baseMp: 35,
    baseAtk: 22,
    baseSpd: 16,
    growthMin: 0.96,
    growthMax: 1.12,
    growth: 1.02,
    recruitCostSilver: 300,
    tavernDirect: true,
    desc: '许昌郊外常见流氓，前期好抓好养。',
  },
  zhoucang: {
    templateId: 'zhoucang',
    name: '周仓',
    roleClass: 'wushi',
    spriteKey: 'r1',
    avatarKey: 'ws1.png',
    skillId: 'liandao',
    baseHp: 165,
    baseMp: 45,
    baseAtk: 31,
    baseSpd: 21,
    growthMin: 1.08,
    growthMax: 1.24,
    growth: 1.14,
    recruitCostSilver: 850,
    tavernDirect: true,
    desc: '忠勇悍将，血厚耐打，自带「力劈华山」。',
  },
  guanping: {
    templateId: 'guanping',
    name: '关平',
    roleClass: 'wushi',
    spriteKey: 'r1',
    avatarKey: 'ws2.png',
    skillId: 'lianji',
    baseHp: 175,
    baseMp: 55,
    baseAtk: 34,
    baseSpd: 22,
    growthMin: 1.12,
    growthMax: 1.28,
    growth: 1.18,
    recruitCostSilver: 1200,
    tavernDirect: true,
    desc: '关羽义子，自带武士「连环突刺」，前期主力物理副将。',
  },
  huangyueying: {
    templateId: 'huangyueying',
    name: '黄月英',
    roleClass: 'wenren',
    spriteKey: 'r2n',
    avatarKey: 'wr6.png',
    skillId: 'hfhy',
    baseHp: 135,
    baseMp: 135,
    baseAtk: 26,
    baseSpd: 29,
    growthMin: 1.15,
    growthMax: 1.32,
    growth: 1.22,
    recruitCostSilver: 1800,
    tavernDirect: true,
    desc: '奇谋才女，高速群攻，自带「呼风唤雨」。',
  },
  yuji: {
    templateId: 'yuji',
    name: '于吉',
    roleClass: 'yiren',
    spriteKey: 'r3',
    avatarKey: 'yr2.png',
    skillId: 'wlhd',
    baseHp: 145,
    baseMp: 145,
    baseAtk: 30,
    baseSpd: 26,
    growthMin: 1.18,
    growthMax: 1.34,
    growth: 1.25,
    recruitCostSilver: 2200,
    tavernDirect: true,
    desc: '太平道仙师，自带「五雷轰顶」，单点爆发惊人。',
  },
  diaochan: {
    templateId: 'diaochan',
    name: '貂蝉',
    roleClass: 'wenren',
    spriteKey: 'r2n',
    avatarKey: 'wr5.png',
    skillId: 'hunluan',
    baseHp: 148,
    baseMp: 160,
    baseAtk: 28,
    baseSpd: 34,
    growthMin: 1.22,
    growthMax: 1.38,
    growth: 1.28,
    recruitCostSilver: 3600,
    tavernDirect: false,
    desc: '闭月红颜，极速控场神将，自带「离间计」令敌自相残杀。',
  },
  guanyu: {
    templateId: 'guanyu',
    name: '关羽',
    roleClass: 'wushi',
    spriteKey: 'r1',
    avatarKey: 'ws3.png',
    skillId: 'psdh',
    baseHp: 220,
    baseMp: 80,
    baseAtk: 44,
    baseSpd: 28,
    growthMin: 1.24,
    growthMax: 1.4,
    growth: 1.31,
    recruitCostSilver: 4800,
    tavernDirect: false,
    desc: '武圣关云长，自带「排山倒海」，威震华夏。',
  },
  zhaoyun: {
    templateId: 'zhaoyun',
    name: '赵云',
    roleClass: 'wushi',
    spriteKey: 'r1',
    avatarKey: 'ws2.png',
    skillId: 'lianji',
    baseHp: 210,
    baseMp: 75,
    baseAtk: 42,
    baseSpd: 33,
    growthMin: 1.25,
    growthMax: 1.42,
    growth: 1.32,
    recruitCostSilver: 5000,
    tavernDirect: true,
    desc: '常山赵子龙，自带「连环突刺」，攻速兼备顶级神将。',
  },
  lvbu: {
    templateId: 'lvbu',
    name: '吕布',
    roleClass: 'wushi',
    spriteKey: 'r1',
    avatarKey: 'ws3.png',
    skillId: 'psdh',
    baseHp: 245,
    baseMp: 85,
    baseAtk: 50,
    baseSpd: 35,
    growthMin: 1.3,
    growthMax: 1.48,
    growth: 1.38,
    recruitCostSilver: 8800,
    tavernDirect: false,
    desc: '飞将吕奉先！仅可通过「招贤令」寻访获取的绝世猛将。',
  },
  zhangfei: {
    templateId: 'zhangfei',
    name: '张飞',
    roleClass: 'wushi',
    spriteKey: 'r1',
    avatarKey: 'ws1.png',
    skillId: 'psdh',
    baseHp: 235,
    baseMp: 70,
    baseAtk: 46,
    baseSpd: 26,
    growthMin: 1.24,
    growthMax: 1.4,
    growth: 1.31,
    recruitCostSilver: 4500,
    tavernDirect: true,
    desc: '燕人张翼德，一声怒吼喝断当阳桥，血厚攻猛。',
  },
  huangzhong: {
    templateId: 'huangzhong',
    name: '黄忠',
    roleClass: 'wushi',
    spriteKey: 'r1',
    avatarKey: 'ws3.png',
    skillId: 'lianji',
    baseHp: 205,
    baseMp: 75,
    baseAtk: 45,
    baseSpd: 31,
    growthMin: 1.24,
    growthMax: 1.4,
    growth: 1.31,
    recruitCostSilver: 4800,
    tavernDirect: true,
    desc: '定军山斩夏侯老将，百步穿杨连环破敌。',
  },
  huatuo: {
    templateId: 'huatuo',
    name: '华佗',
    roleClass: 'yiren',
    spriteKey: 'r3',
    avatarKey: 'yr1.png',
    skillId: 'huigong',
    baseHp: 175,
    baseMp: 185,
    baseAtk: 31,
    baseSpd: 30,
    growthMin: 1.22,
    growthMax: 1.38,
    growth: 1.29,
    recruitCostSilver: 5600,
    tavernDirect: true,
    desc: '乱世神医！天生自带【妙手回春】，中后期推塔与长线战续航核心。',
  },
  machao: {
    templateId: 'machao',
    name: '马超',
    roleClass: 'wushi',
    spriteKey: 'r1',
    avatarKey: 'ws2.png',
    skillId: 'lianji',
    baseHp: 222,
    baseMp: 80,
    baseAtk: 47,
    baseSpd: 36,
    growthMin: 1.27,
    growthMax: 1.44,
    growth: 1.35,
    recruitCostSilver: 6800,
    tavernDirect: false,
    desc: '锦马超！西凉神威天将军，极速物理连击收割者。',
  },
  zhouyu: {
    templateId: 'zhouyu',
    name: '周瑜',
    roleClass: 'wenren',
    spriteKey: 'r2',
    avatarKey: 'wr3.png',
    skillId: 'hfhy',
    baseHp: 168,
    baseMp: 185,
    baseAtk: 36,
    baseSpd: 37,
    growthMin: 1.28,
    growthMax: 1.45,
    growth: 1.36,
    recruitCostSilver: 7400,
    tavernDirect: false,
    desc: '江东美周郎！极速群攻【呼风唤雨】，火烧连营清场神将。',
  },
  simayi: {
    templateId: 'simayi',
    name: '司马懿',
    roleClass: 'wenren',
    spriteKey: 'r2',
    avatarKey: 'wr1.png',
    skillId: 'fengyin',
    baseHp: 178,
    baseMp: 195,
    baseAtk: 35,
    baseSpd: 36,
    growthMin: 1.29,
    growthMax: 1.46,
    growth: 1.37,
    recruitCostSilver: 8200,
    tavernDirect: false,
    desc: '冢虎司马仲达！自带强控【定身计】，压制高阶 BOSS 利器。',
  },
  zhugeliang: {
    templateId: 'zhugeliang',
    name: '诸葛亮',
    roleClass: 'yiren',
    spriteKey: 'r3',
    avatarKey: 'wr2.png',
    skillId: 'tianlei',
    baseHp: 185,
    baseMp: 220,
    baseAtk: 42,
    baseSpd: 36,
    growthMin: 1.32,
    growthMax: 1.5,
    growth: 1.4,
    recruitCostSilver: 9600,
    tavernDirect: false,
    desc: '卧龙孔明！自带群攻雷法【雷动九天】，三国第一法系神将！',
  },
};

export interface EnemyGroupDef {
  id: string;
  name: string;
  mapId: string;
  minLevel: number;
  silverReward: number;
  expReward: number;
  capturableTemplateId?: string;
  enemies: Array<{
    name: string;
    level: number;
    roleClass: RoleClass;
    spriteKey: string;
    hp: number;
    mp: number;
    atk: number;
    spd: number;
  }>;
}

export const ENEMY_GROUPS: Record<string, EnemyGroupDef> = {
  xinshou_wulai: {
    id: 'xinshou_wulai',
    name: '村口无赖',
    mapId: 'xinshoucun_kou',
    minLevel: 1,
    silverReward: 55,
    expReward: 50,
    capturableTemplateId: 'dipi',
    enemies: [
      { name: '村口无赖', level: 1, roleClass: 'wushi', spriteKey: 'n1', hp: 44, mp: 15, atk: 8, spd: 10 },
      { name: '游手小偷', level: 1, roleClass: 'wushi', spriteKey: 'n1', hp: 42, mp: 15, atk: 8, spd: 11 },
    ],
  },
  xinshou_daozei: {
    id: 'xinshou_daozei',
    name: '盗贼总管',
    mapId: 'xinshoucun_kou',
    minLevel: 2,
    silverReward: 95,
    expReward: 85,
    capturableTemplateId: 'dipi',
    enemies: [
      { name: '毛贼喽啰', level: 2, roleClass: 'wushi', spriteKey: 'n1', hp: 66, mp: 20, atk: 12, spd: 13 },
      { name: '盗贼总管', level: 3, roleClass: 'wushi', spriteKey: 'n1', hp: 96, mp: 30, atk: 16, spd: 15 },
      { name: '放风小偷', level: 2, roleClass: 'wenren', spriteKey: 'n2', hp: 58, mp: 40, atk: 12, spd: 14 },
    ],
  },
  xiaopei_shanzei: {
    id: 'xiaopei_shanzei',
    name: '九里山山贼',
    mapId: 'xiaopei',
    minLevel: 4,
    silverReward: 115,
    expReward: 110,
    capturableTemplateId: 'zhoucang',
    enemies: [
      { name: '九里山贼', level: 4, roleClass: 'wushi', spriteKey: 'n1', hp: 145, mp: 30, atk: 26, spd: 17 },
      { name: '山寨打手', level: 4, roleClass: 'wushi', spriteKey: 'n1', hp: 160, mp: 30, atk: 28, spd: 18 },
      { name: '寨中探子', level: 5, roleClass: 'wenren', spriteKey: 'n2', hp: 135, mp: 70, atk: 27, spd: 21 },
    ],
  },
  xiaopei_huangjin: {
    id: 'xiaopei_huangjin',
    name: '小沛黄巾游骑',
    mapId: 'xiaopei',
    minLevel: 6,
    silverReward: 150,
    expReward: 155,
    capturableTemplateId: 'guanping',
    enemies: [
      { name: '黄巾军官', level: 6, roleClass: 'wushi', spriteKey: 'n1', hp: 245, mp: 40, atk: 40, spd: 22 },
      { name: '黄巾将官', level: 7, roleClass: 'wushi', spriteKey: 'n1', hp: 280, mp: 50, atk: 44, spd: 24 },
      { name: '黄巾方士', level: 6, roleClass: 'yiren', spriteKey: 'n3', hp: 215, mp: 100, atk: 42, spd: 25 },
    ],
  },
  xuchang_dipi: {
    id: 'xuchang_dipi',
    name: '地痞群',
    mapId: 'xuchang_jiao',
    minLevel: 1,
    silverReward: 75,
    expReward: 60,
    capturableTemplateId: 'dipi',
    enemies: [
      { name: '地痞甲', level: 1, roleClass: 'wushi', spriteKey: 'n1', hp: 52, mp: 20, atk: 9, spd: 12 },
      { name: '地痞乙', level: 1, roleClass: 'wushi', spriteKey: 'n1', hp: 48, mp: 20, atk: 9, spd: 11 },
      { name: '地痞头目', level: 2, roleClass: 'wushi', spriteKey: 'n1', hp: 64, mp: 30, atk: 11, spd: 14 },
    ],
  },
  xuchang_shibing: {
    id: 'xuchang_shibing',
    name: '巡逻士兵',
    mapId: 'xuchang',
    minLevel: 1,
    silverReward: 55,
    expReward: 45,
    enemies: [
      { name: '城防兵', level: 1, roleClass: 'wushi', spriteKey: 'n1', hp: 46, mp: 20, atk: 8, spd: 12 },
      { name: '城防兵', level: 1, roleClass: 'wushi', spriteKey: 'n1', hp: 50, mp: 20, atk: 9, spd: 13 },
    ],
  },
  changshe_daoshi: {
    id: 'changshe_daoshi',
    name: '黄巾道士',
    mapId: 'changshe',
    minLevel: 5,
    silverReward: 130,
    expReward: 135,
    capturableTemplateId: 'yuji',
    enemies: [
      { name: '黄巾力士', level: 6, roleClass: 'wushi', spriteKey: 'n1', hp: 270, mp: 40, atk: 42, spd: 22 },
      { name: '太平道士', level: 7, roleClass: 'yiren', spriteKey: 'n3', hp: 230, mp: 110, atk: 46, spd: 26 },
      { name: '黄巾妖术师', level: 7, roleClass: 'wenren', spriteKey: 'n2', hp: 220, mp: 110, atk: 44, spd: 28 },
    ],
  },
  luoyang_weidui: {
    id: 'luoyang_weidui',
    name: '西凉铁骑',
    mapId: 'luoyang_wai',
    minLevel: 10,
    silverReward: 260,
    expReward: 300,
    capturableTemplateId: 'guanping',
    enemies: [
      { name: '西凉先锋', level: 12, roleClass: 'wushi', spriteKey: 'n1', hp: 560, mp: 60, atk: 84, spd: 32 },
      { name: '西凉弓手', level: 12, roleClass: 'wenren', spriteKey: 'n2n', hp: 460, mp: 110, atk: 78, spd: 36 },
      { name: '西凉校尉', level: 14, roleClass: 'wushi', spriteKey: 'n1', hp: 680, mp: 80, atk: 96, spd: 34 },
      { name: '军中术士', level: 13, roleClass: 'yiren', spriteKey: 'n3', hp: 480, mp: 140, atk: 88, spd: 35 },
    ],
  },
  boss_zhangjiao: {
    id: 'boss_zhangjiao',
    name: '张角三兄弟',
    mapId: 'changshe',
    minLevel: 7,
    silverReward: 340,
    expReward: 400,
    capturableTemplateId: 'yuji',
    enemies: [
      { name: '人公将·张梁', level: 8, roleClass: 'wushi', spriteKey: 'n1', hp: 580, mp: 60, atk: 64, spd: 28 },
      { name: '地公将·张宝', level: 8, roleClass: 'wenren', spriteKey: 'n2', hp: 500, mp: 150, atk: 60, spd: 33 },
      { name: '天公将·张角', level: 9, roleClass: 'yiren', spriteKey: 'n3', hp: 820, mp: 220, atk: 78, spd: 36 },
    ],
  },
  hulao_xiliang: {
    id: 'hulao_xiliang',
    name: '虎牢关守军',
    mapId: 'hulaoguan',
    minLevel: 12,
    silverReward: 340,
    expReward: 400,
    capturableTemplateId: 'guanping',
    enemies: [
      { name: '飞熊铁卫', level: 13, roleClass: 'wushi', spriteKey: 'n1', hp: 740, mp: 60, atk: 102, spd: 36 },
      { name: '虎牢弩手', level: 13, roleClass: 'wenren', spriteKey: 'n2', hp: 600, mp: 120, atk: 94, spd: 40 },
      { name: '西凉督军', level: 14, roleClass: 'wushi', spriteKey: 'n1', hp: 860, mp: 80, atk: 114, spd: 38 },
    ],
  },
  boss_huaxiong: {
    id: 'boss_huaxiong',
    name: '西凉骁将·华雄',
    mapId: 'hulaoguan',
    minLevel: 13,
    silverReward: 560,
    expReward: 650,
    capturableTemplateId: 'guanyu',
    enemies: [
      { name: '西凉刀斧手', level: 13, roleClass: 'wushi', spriteKey: 'n1', hp: 780, mp: 60, atk: 100, spd: 38 },
      { name: '骁将·华雄', level: 15, roleClass: 'wushi', spriteKey: 'r1', hp: 1750, mp: 120, atk: 148, spd: 46 },
      { name: '胡轸部曲', level: 14, roleClass: 'yiren', spriteKey: 'n3', hp: 720, mp: 160, atk: 108, spd: 42 },
    ],
  },
  guandu_yuanjun: {
    id: 'guandu_yuanjun',
    name: '袁军先登死士',
    mapId: 'guandu',
    minLevel: 15,
    silverReward: 440,
    expReward: 530,
    capturableTemplateId: 'huangyueying',
    enemies: [
      { name: '先登死士', level: 16, roleClass: 'wushi', spriteKey: 'n1', hp: 980, mp: 70, atk: 126, spd: 42 },
      { name: '河北谋士', level: 16, roleClass: 'wenren', spriteKey: 'n2', hp: 800, mp: 160, atk: 118, spd: 48 },
      { name: '大戟士', level: 17, roleClass: 'wushi', spriteKey: 'n1', hp: 1160, mp: 80, atk: 138, spd: 44 },
    ],
  },
  boss_yanliang: {
    id: 'boss_yanliang',
    name: '河北双雄·颜良文丑',
    mapId: 'guandu',
    minLevel: 16,
    silverReward: 780,
    expReward: 900,
    capturableTemplateId: 'zhaoyun',
    enemies: [
      { name: '河北名将·颜良', level: 17, roleClass: 'wushi', spriteKey: 'r1', hp: 2050, mp: 120, atk: 172, spd: 52 },
      { name: '河北名将·文丑', level: 17, roleClass: 'wushi', spriteKey: 'r1', hp: 1950, mp: 120, atk: 166, spd: 55 },
      { name: '沮授军师', level: 17, roleClass: 'wenren', spriteKey: 'n2', hp: 1220, mp: 220, atk: 134, spd: 60 },
    ],
  },
  chibi_shuijun: {
    id: 'chibi_shuijun',
    name: '曹军水师楼船',
    mapId: 'chibi',
    minLevel: 18,
    silverReward: 580,
    expReward: 700,
    capturableTemplateId: 'diaochan',
    enemies: [
      { name: '青州水兵', level: 19, roleClass: 'wushi', spriteKey: 'n1', hp: 1260, mp: 80, atk: 150, spd: 49 },
      { name: '铁索弓手', level: 19, roleClass: 'wenren', spriteKey: 'n2n', hp: 1050, mp: 160, atk: 142, spd: 55 },
      { name: '楼船校尉', level: 20, roleClass: 'wushi', spriteKey: 'n1', hp: 1480, mp: 90, atk: 168, spd: 51 },
      { name: '随军方士', level: 19, roleClass: 'yiren', spriteKey: 'n3', hp: 1080, mp: 200, atk: 154, spd: 53 },
    ],
  },
  boss_caojun: {
    id: 'boss_caojun',
    name: '赤壁先锋大营',
    mapId: 'chibi',
    minLevel: 19,
    silverReward: 1150,
    expReward: 1380,
    capturableTemplateId: 'guanyu',
    enemies: [
      { name: '水军都督·蔡瑁', level: 20, roleClass: 'wushi', spriteKey: 'r1', hp: 2400, mp: 140, atk: 188, spd: 56 },
      { name: '水军副督·张允', level: 20, roleClass: 'wushi', spriteKey: 'n1', hp: 2150, mp: 120, atk: 176, spd: 54 },
      { name: '虎豹骑统领', level: 21, roleClass: 'wushi', spriteKey: 'r1', hp: 2700, mp: 140, atk: 208, spd: 60 },
      { name: '曹营祭酒', level: 20, roleClass: 'yiren', spriteKey: 'n3', hp: 1700, mp: 260, atk: 175, spd: 64 },
    ],
  },
  jiangling_caojun: {
    id: 'jiangling_caojun',
    name: '曹仁江陵守军',
    mapId: 'jiangling',
    minLevel: 22,
    silverReward: 820,
    expReward: 1350,
    capturableTemplateId: 'zhangfei',
    enemies: [
      { name: '江陵铁甲卫', level: 24, roleClass: 'wushi', spriteKey: 'n1', hp: 1620, mp: 90, atk: 185, spd: 58 },
      { name: '荆北弓弩手', level: 24, roleClass: 'wenren', spriteKey: 'n2', hp: 1380, mp: 180, atk: 174, spd: 64 },
      { name: '曹魏校尉', level: 25, roleClass: 'wushi', spriteKey: 'n1', hp: 1820, mp: 100, atk: 198, spd: 61 },
      { name: '军中道士', level: 25, roleClass: 'yiren', spriteKey: 'n3', hp: 1440, mp: 220, atk: 188, spd: 63 },
    ],
  },
  boss_caoren: {
    id: 'boss_caoren',
    name: '征南将军·曹仁',
    mapId: 'jiangling',
    minLevel: 25,
    silverReward: 1650,
    expReward: 2750,
    capturableTemplateId: 'zhangfei',
    enemies: [
      { name: '八门金锁卫', level: 26, roleClass: 'wushi', spriteKey: 'n1', hp: 2450, mp: 120, atk: 215, spd: 64 },
      { name: '征南大将·曹仁', level: 27, roleClass: 'wushi', spriteKey: 'r1', hp: 3500, mp: 180, atk: 248, spd: 72 },
      { name: '骁将·牛金', level: 26, roleClass: 'wushi', spriteKey: 'r1', hp: 2650, mp: 120, atk: 226, spd: 68 },
      { name: '满宠参军', level: 26, roleClass: 'wenren', spriteKey: 'n2', hp: 2050, mp: 280, atk: 206, spd: 76 },
    ],
  },
  yizhou_chuanjun: {
    id: 'yizhou_chuanjun',
    name: '西川栈道劲旅',
    mapId: 'yizhou',
    minLevel: 29,
    silverReward: 1180,
    expReward: 2400,
    capturableTemplateId: 'huangzhong',
    enemies: [
      { name: '东州铁卫', level: 31, roleClass: 'wushi', spriteKey: 'n1', hp: 2300, mp: 100, atk: 242, spd: 76 },
      { name: '蜀中连弩手', level: 31, roleClass: 'wenren', spriteKey: 'n2n', hp: 1960, mp: 220, atk: 230, spd: 84 },
      { name: '川军都伯', level: 32, roleClass: 'wushi', spriteKey: 'n1', hp: 2560, mp: 120, atk: 258, spd: 80 },
      { name: '青城方士', level: 32, roleClass: 'yiren', spriteKey: 'n3', hp: 2080, mp: 260, atk: 246, spd: 82 },
    ],
  },
  yizhou_manbing: {
    id: 'yizhou_manbing',
    name: '南中藤甲精兵',
    mapId: 'yizhou',
    minLevel: 33,
    silverReward: 1420,
    expReward: 3250,
    capturableTemplateId: 'huangzhong',
    enemies: [
      { name: '藤甲刀盾手', level: 34, roleClass: 'wushi', spriteKey: 'n1', hp: 2850, mp: 120, atk: 274, spd: 82 },
      { name: '南蛮毒箭手', level: 34, roleClass: 'wenren', spriteKey: 'n2', hp: 2420, mp: 250, atk: 262, spd: 90 },
      { name: '白耳精锐卫', level: 35, roleClass: 'wushi', spriteKey: 'n1', hp: 3120, mp: 140, atk: 290, spd: 86 },
      { name: '巫祝术士', level: 35, roleClass: 'yiren', spriteKey: 'n3n', hp: 2560, mp: 290, atk: 278, spd: 88 },
    ],
  },
  boss_zhangren: {
    id: 'boss_zhangren',
    name: '落凤坡·张任大阵',
    mapId: 'yizhou',
    minLevel: 33,
    silverReward: 2400,
    expReward: 4800,
    capturableTemplateId: 'huangzhong',
    enemies: [
      { name: '伏兵弓将', level: 34, roleClass: 'wenren', spriteKey: 'n2', hp: 2950, mp: 240, atk: 272, spd: 90 },
      { name: '益州名将·张任', level: 35, roleClass: 'wushi', spriteKey: 'r1', hp: 4650, mp: 220, atk: 315, spd: 96 },
      { name: '老将·严颜', level: 34, roleClass: 'wushi', spriteKey: 'r1', hp: 3850, mp: 180, atk: 292, spd: 86 },
      { name: '川中谋士', level: 34, roleClass: 'yiren', spriteKey: 'n3', hp: 2850, mp: 320, atk: 282, spd: 92 },
    ],
  },
  hanzhong_weijun: {
    id: 'hanzhong_weijun',
    name: '定军山魏军营',
    mapId: 'hanzhong',
    minLevel: 37,
    silverReward: 1650,
    expReward: 4100,
    capturableTemplateId: 'machao',
    enemies: [
      { name: '虎豹重骑', level: 39, roleClass: 'wushi', spriteKey: 'n1', hp: 3150, mp: 120, atk: 308, spd: 96 },
      { name: '定军弓将', level: 39, roleClass: 'wenren', spriteKey: 'n2', hp: 2700, mp: 260, atk: 294, spd: 105 },
      { name: '征西校尉', level: 40, roleClass: 'wushi', spriteKey: 'n1', hp: 3480, mp: 140, atk: 328, spd: 100 },
      { name: '魏营术师', level: 40, roleClass: 'yiren', spriteKey: 'n3', hp: 2820, mp: 300, atk: 316, spd: 102 },
    ],
  },
  boss_xiahouyuan: {
    id: 'boss_xiahouyuan',
    name: '妙才·夏侯渊大营',
    mapId: 'hanzhong',
    minLevel: 41,
    silverReward: 3400,
    expReward: 8200,
    capturableTemplateId: 'machao',
    enemies: [
      { name: '河间名将·张郃', level: 42, roleClass: 'wushi', spriteKey: 'r1', hp: 6800, mp: 200, atk: 485, spd: 112 },
      { name: '征西将军·夏侯渊', level: 43, roleClass: 'wushi', spriteKey: 'r1', hp: 9200, mp: 240, atk: 535, spd: 122 },
      { name: '定军副将·郭淮', level: 42, roleClass: 'wenren', spriteKey: 'n2', hp: 5600, mp: 320, atk: 460, spd: 118 },
      { name: '随军天师', level: 42, roleClass: 'yiren', spriteKey: 'n3', hp: 5500, mp: 360, atk: 475, spd: 115 },
    ],
  },
  yiling_wujun: {
    id: 'yiling_wujun',
    name: '东吴解烦精兵',
    mapId: 'yiling',
    minLevel: 45,
    silverReward: 2250,
    expReward: 6800,
    capturableTemplateId: 'zhouyu',
    enemies: [
      { name: '江东解烦卫', level: 47, roleClass: 'wushi', spriteKey: 'n1', hp: 4150, mp: 140, atk: 382, spd: 120 },
      { name: '火攻都尉', level: 47, roleClass: 'wenren', spriteKey: 'n2', hp: 3620, mp: 300, atk: 368, spd: 128 },
      { name: '锦帆悍将', level: 48, roleClass: 'wushi', spriteKey: 'n1', hp: 4580, mp: 160, atk: 404, spd: 124 },
      { name: '东吴术士', level: 48, roleClass: 'yiren', spriteKey: 'n3', hp: 3750, mp: 340, atk: 392, spd: 126 },
    ],
  },
  boss_luxun: {
    id: 'boss_luxun',
    name: '火烧连营·陆逊',
    mapId: 'yiling',
    minLevel: 49,
    silverReward: 4800,
    expReward: 13500,
    capturableTemplateId: 'zhouyu',
    enemies: [
      { name: '锦帆贼·甘宁', level: 50, roleClass: 'wushi', spriteKey: 'r1', hp: 9200, mp: 220, atk: 615, spd: 138 },
      { name: '大都督·陆逊', level: 51, roleClass: 'wenren', spriteKey: 'r2', hp: 11800, mp: 420, atk: 660, spd: 152 },
      { name: '江东名将·朱然', level: 50, roleClass: 'wushi', spriteKey: 'r1', hp: 8800, mp: 200, atk: 595, spd: 134 },
      { name: '火计方士', level: 50, roleClass: 'yiren', spriteKey: 'n3', hp: 7800, mp: 400, atk: 615, spd: 144 },
    ],
  },
  wuzhang_sima: {
    id: 'wuzhang_sima',
    name: '司马亲卫中军',
    mapId: 'wuzhangyuan',
    minLevel: 53,
    silverReward: 3100,
    expReward: 10800,
    capturableTemplateId: 'simayi',
    enemies: [
      { name: '死士重甲兵', level: 55, roleClass: 'wushi', spriteKey: 'n1', hp: 5300, mp: 180, atk: 458, spd: 142 },
      { name: '司马参谋', level: 55, roleClass: 'wenren', spriteKey: 'n2', hp: 4650, mp: 360, atk: 444, spd: 152 },
      { name: '大魏虎将', level: 56, roleClass: 'wushi', spriteKey: 'n1', hp: 5850, mp: 200, atk: 482, spd: 146 },
      { name: '太史玄士', level: 56, roleClass: 'yiren', spriteKey: 'n3', hp: 4800, mp: 400, atk: 470, spd: 148 },
    ],
  },
  boss_simayi: {
    id: 'boss_simayi',
    name: '冢虎·司马懿本阵',
    mapId: 'wuzhangyuan',
    minLevel: 57,
    silverReward: 6800,
    expReward: 22000,
    capturableTemplateId: 'zhugeliang',
    enemies: [
      { name: '司马师', level: 58, roleClass: 'wushi', spriteKey: 'r1', hp: 12400, mp: 260, atk: 745, spd: 162 },
      { name: '大都督·司马懿', level: 60, roleClass: 'wenren', spriteKey: 'r2', hp: 16800, mp: 520, atk: 805, spd: 178 },
      { name: '司马昭', level: 58, roleClass: 'wushi', spriteKey: 'r1', hp: 12000, mp: 260, atk: 730, spd: 166 },
      { name: '五丈原天师', level: 59, roleClass: 'yiren', spriteKey: 'n3', hp: 11000, mp: 460, atk: 760, spd: 170 },
    ],
  },
};

export interface MainQuestDef {
  questId: string;
  chapter: number;
  title: string;
  recLevel: number;
  npcName: string;
  dialogue: string;
  objectiveKind: 'kill' | 'visit_map';
  targetId: string;
  targetName: string;
  targetMapId: string;
  requiredCount: number;
  rewards: {
    exp: number;
    silver: number;
    gold?: number;
    item?: { itemId: string; quantity: number };
    equipTemplateId?: string;
    generalTemplateId?: string;
  };
}

export const TOWER_MAX_FLOOR = 50;

export function getTowerFloorMeta(floor: number): {
  floor: number;
  name: string;
  recLevel: number;
  isBoss: boolean;
  milestone?: string;
} {
  const f = Math.max(1, Math.min(TOWER_MAX_FLOOR, Math.floor(floor)));
  const recLevel = f <= 20 ? Math.max(2, f + 1) : Math.min(60, Math.round(21 + (f - 20) * 1.3));
  if (f === 5) {
    return { floor: f, name: '第5层 · 黄巾妖阵', recLevel, isBoss: true, milestone: '首通赠 金砖+30、招贤令×1' };
  }
  if (f === 10) {
    return { floor: f, name: '第10层 · 西凉虎将', recLevel, isBoss: true, milestone: '首通赠 金砖+60、洗髓丹×2、随机技能书×1' };
  }
  if (f === 15) {
    return { floor: f, name: '第15层 · 五虎幻阵', recLevel, isBoss: true, milestone: '首通赠 金砖+100、藏宝图×3、极品装备×1' };
  }
  if (f === 20) {
    return { floor: f, name: '第20层 · 飞将吕布幻影', recLevel, isBoss: true, milestone: '首通赠 金砖+160、10级传世神兵/赤兔×1' };
  }
  if (f === 25) {
    return { floor: f, name: '第25层 · 赤壁周郎水师', recLevel, isBoss: true, milestone: '首通赠 金砖+200、招贤令×2、随机技能书×1' };
  }
  if (f === 30) {
    return { floor: f, name: '第30层 · 蜀汉五虎上将', recLevel, isBoss: true, milestone: '首通赠 金砖+260、洗髓丹×3、35级极品装备×1' };
  }
  if (f === 35) {
    return { floor: f, name: '第35层 · 东吴四大都督', recLevel, isBoss: true, milestone: '首通赠 金砖+320、藏宝图×4、招贤令×2' };
  }
  if (f === 40) {
    return { floor: f, name: '第40层 · 曹魏五子良将', recLevel, isBoss: true, milestone: '首通赠 金砖+400、随机技能书×2、50级传世装备×1' };
  }
  if (f === 45) {
    return { floor: f, name: '第45层 · 卧龙凤雏奇阵', recLevel, isBoss: true, milestone: '首通赠 金砖+500、洗髓丹×4、50级传世装备×1' };
  }
  if (f === 50) {
    return { floor: f, name: '第50层 · 魔神吕布终极试炼', recLevel, isBoss: true, milestone: '登顶赠 金砖+800、汗血天马/50级神兵×1、招贤令×3' };
  }
  return { floor: f, name: `天玄塔第 ${f} 层守卫`, recLevel, isBoss: false };
}

export function buildTowerEnemyGroup(floor: number): EnemyGroupDef {
  const f = Math.max(1, Math.min(TOWER_MAX_FLOOR, Math.floor(floor)));
  const meta = getTowerFloorMeta(f);
  const lv = meta.recLevel;

  let hpBase: number;
  let atkBase: number;
  let spdBase: number;
  if (f <= 20) {
    // Smooth curve through F20 (F20 combined HP ~11.1k, Lv Bu peak ATK ~278 — winnable by Lv.20 T3/T4, blocks T1)
    hpBase = Math.round(70 + f * 48 + f * f * 3.2);
    atkBase = Math.round(14 + f * 6.8 + f * f * 0.14);
    spdBase = Math.round(14 + f * 2.4);
  } else {
    // Smooth ramp F21 -> F50 (F45 ~57.5k HP, F50 ~71k HP — blocks T1 at 0%, T3/T4 1转 clear F50 in 7-10 rounds!)
    const over = f - 20;
    hpBase = Math.round(2310 + over * 250 + over * over * 2.9);
    atkBase = Math.round(206 + over * 14.0);
    spdBase = Math.round(62 + over * 3.6);
  }

  let enemies: EnemyGroupDef['enemies'];
  if (f === 5) {
    enemies = [
      { name: '天玄道童', level: lv, roleClass: 'wenren', spriteKey: 'n2', hp: Math.round(hpBase * 0.9), mp: 100, atk: atkBase, spd: spdBase + 2 },
      { name: '镇塔·张角幻影', level: lv + 1, roleClass: 'yiren', spriteKey: 'n3', hp: Math.round(hpBase * 1.35), mp: 160, atk: Math.round(atkBase * 1.18), spd: spdBase + 3 },
      { name: '黄巾护法', level: lv, roleClass: 'wushi', spriteKey: 'n1', hp: Math.round(hpBase * 1.05), mp: 50, atk: atkBase, spd: spdBase },
    ];
  } else if (f === 10) {
    enemies = [
      { name: '西凉铁卫', level: lv, roleClass: 'wushi', spriteKey: 'n1', hp: hpBase, mp: 60, atk: atkBase, spd: spdBase },
      { name: '镇塔·华雄幻影', level: lv + 1, roleClass: 'wushi', spriteKey: 'r1', hp: Math.round(hpBase * 1.45), mp: 100, atk: Math.round(atkBase * 1.22), spd: spdBase + 4 },
      { name: '西凉军师', level: lv, roleClass: 'wenren', spriteKey: 'n2', hp: Math.round(hpBase * 0.85), mp: 140, atk: atkBase, spd: spdBase + 5 },
    ];
  } else if (f === 15) {
    enemies = [
      { name: '五虎·关羽幻影', level: lv + 1, roleClass: 'wushi', spriteKey: 'r1', hp: Math.round(hpBase * 1.3), mp: 110, atk: Math.round(atkBase * 1.18), spd: spdBase + 3 },
      { name: '五虎·赵云幻影', level: lv + 1, roleClass: 'wushi', spriteKey: 'r1', hp: Math.round(hpBase * 1.25), mp: 110, atk: Math.round(atkBase * 1.15), spd: spdBase + 6 },
      { name: '卧龙谋士幻影', level: lv, roleClass: 'wenren', spriteKey: 'r2', hp: Math.round(hpBase * 0.95), mp: 180, atk: Math.round(atkBase * 1.1), spd: spdBase + 7 },
    ];
  } else if (f === 20) {
    enemies = [
      { name: '陷阵营·高顺', level: lv, roleClass: 'wushi', spriteKey: 'n1', hp: Math.round(hpBase * 1.15), mp: 80, atk: Math.round(atkBase * 1.1), spd: spdBase + 2 },
      { name: '飞将·吕布幻影', level: lv + 2, roleClass: 'wushi', spriteKey: 'r1', hp: Math.round(hpBase * 1.7), mp: 150, atk: Math.round(atkBase * 1.35), spd: spdBase + 8 },
      { name: '闭月·貂蝉幻影', level: lv + 1, roleClass: 'wenren', spriteKey: 'r2n', hp: Math.round(hpBase * 0.95), mp: 200, atk: atkBase, spd: spdBase + 10 },
      { name: '陈宫军师', level: lv, roleClass: 'yiren', spriteKey: 'n3', hp: Math.round(hpBase * 1.0), mp: 200, atk: Math.round(atkBase * 1.15), spd: spdBase + 5 },
    ];
  } else if (f === 25) {
    enemies = [
      { name: '大都督·周瑜幻影', level: lv + 2, roleClass: 'wenren', spriteKey: 'r2', hp: Math.round(hpBase * 1.4), mp: 300, atk: Math.round(atkBase * 1.22), spd: spdBase + 12 },
      { name: '老将·黄盖', level: lv + 1, roleClass: 'wushi', spriteKey: 'r1', hp: Math.round(hpBase * 1.25), mp: 120, atk: Math.round(atkBase * 1.12), spd: spdBase + 4 },
      { name: '江东儒将·鲁肃', level: lv, roleClass: 'yiren', spriteKey: 'n3', hp: Math.round(hpBase * 1.05), mp: 260, atk: Math.round(atkBase * 1.1), spd: spdBase + 8 },
      { name: '东吴水师校尉', level: lv, roleClass: 'wushi', spriteKey: 'n1', hp: Math.round(hpBase * 1.1), mp: 100, atk: atkBase, spd: spdBase + 2 },
    ];
  } else if (f === 30) {
    enemies = [
      { name: '武圣·关羽幻影', level: lv + 1, roleClass: 'wushi', spriteKey: 'r1', hp: Math.round(hpBase * 1.35), mp: 160, atk: Math.round(atkBase * 1.2), spd: spdBase + 6 },
      { name: '燕人·张飞幻影', level: lv + 1, roleClass: 'wushi', spriteKey: 'r1', hp: Math.round(hpBase * 1.45), mp: 140, atk: Math.round(atkBase * 1.22), spd: spdBase + 2 },
      { name: '子龙·赵云幻影', level: lv + 2, roleClass: 'wushi', spriteKey: 'r1', hp: Math.round(hpBase * 1.3), mp: 160, atk: Math.round(atkBase * 1.18), spd: spdBase + 10 },
      { name: '锦马超幻影', level: lv + 1, roleClass: 'wushi', spriteKey: 'r1', hp: Math.round(hpBase * 1.25), mp: 160, atk: Math.round(atkBase * 1.2), spd: spdBase + 12 },
    ];
  } else if (f === 35) {
    enemies = [
      { name: '美周郎·周瑜', level: lv + 2, roleClass: 'wenren', spriteKey: 'r2', hp: Math.round(hpBase * 1.35), mp: 360, atk: Math.round(atkBase * 1.22), spd: spdBase + 14 },
      { name: '白衣渡江·吕蒙', level: lv + 1, roleClass: 'wushi', spriteKey: 'r1', hp: Math.round(hpBase * 1.3), mp: 180, atk: Math.round(atkBase * 1.18), spd: spdBase + 8 },
      { name: '儒将·陆逊', level: lv + 2, roleClass: 'wenren', spriteKey: 'r2', hp: Math.round(hpBase * 1.3), mp: 360, atk: Math.round(atkBase * 1.2), spd: spdBase + 12 },
      { name: '江东谋主·鲁肃', level: lv + 1, roleClass: 'yiren', spriteKey: 'r3', hp: Math.round(hpBase * 1.15), mp: 320, atk: Math.round(atkBase * 1.15), spd: spdBase + 6 },
    ];
  } else if (f === 40) {
    enemies = [
      { name: '威震逍遥津·张辽', level: lv + 2, roleClass: 'wushi', spriteKey: 'r1', hp: Math.round(hpBase * 1.48), mp: 200, atk: Math.round(atkBase * 1.26), spd: spdBase + 10 },
      { name: '河间·张郃', level: lv + 1, roleClass: 'wushi', spriteKey: 'r1', hp: Math.round(hpBase * 1.3), mp: 180, atk: Math.round(atkBase * 1.18), spd: spdBase + 8 },
      { name: '大斧·徐晃', level: lv + 1, roleClass: 'wushi', spriteKey: 'r1', hp: Math.round(hpBase * 1.35), mp: 160, atk: Math.round(atkBase * 1.2), spd: spdBase + 4 },
      { name: '鬼才·郭嘉幻影', level: lv + 2, roleClass: 'wenren', spriteKey: 'r2', hp: Math.round(hpBase * 1.15), mp: 380, atk: Math.round(atkBase * 1.22), spd: spdBase + 15 },
    ];
  } else if (f === 45) {
    enemies = [
      { name: '卧龙·诸葛亮', level: lv + 2, roleClass: 'yiren', spriteKey: 'r3', hp: Math.round(hpBase * 1.5), mp: 460, atk: Math.round(atkBase * 1.3), spd: spdBase + 14 },
      { name: '凤雏·庞统', level: lv + 2, roleClass: 'wenren', spriteKey: 'r2', hp: Math.round(hpBase * 1.3), mp: 420, atk: Math.round(atkBase * 1.22), spd: spdBase + 16 },
      { name: '冢虎·司马懿', level: lv + 2, roleClass: 'wenren', spriteKey: 'r2', hp: Math.round(hpBase * 1.4), mp: 420, atk: Math.round(atkBase * 1.25), spd: spdBase + 12 },
      { name: '麒麟儿·姜维', level: lv + 1, roleClass: 'wushi', spriteKey: 'r1', hp: Math.round(hpBase * 1.35), mp: 220, atk: Math.round(atkBase * 1.2), spd: spdBase + 10 },
    ];
  } else if (f === 50) {
    enemies = [
      { name: '魔神·吕布', level: lv + 3, roleClass: 'wushi', spriteKey: 'r1', hp: Math.round(hpBase * 1.65), mp: 320, atk: Math.round(atkBase * 1.3), spd: spdBase + 16 },
      { name: '倾城·貂蝉', level: lv + 2, roleClass: 'wenren', spriteKey: 'r2n', hp: Math.round(hpBase * 1.15), mp: 460, atk: Math.round(atkBase * 1.16), spd: spdBase + 20 },
      { name: '仙人·左慈', level: lv + 2, roleClass: 'yiren', spriteKey: 'r3', hp: Math.round(hpBase * 1.25), mp: 500, atk: Math.round(atkBase * 1.24), spd: spdBase + 14 },
      { name: '陷阵统领·高顺', level: lv + 1, roleClass: 'wushi', spriteKey: 'r1', hp: Math.round(hpBase * 1.32), mp: 220, atk: Math.round(atkBase * 1.18), spd: spdBase + 8 },
    ];
  } else {
    const count = f >= 12 ? 4 : 3;
    const classes: RoleClass[] = ['wushi', 'wenren', 'yiren', 'wushi'];
    const sprites = ['n1', 'n2', 'n3', 'n1'];
    enemies = Array.from({ length: count }, (_, idx) => ({
      name: idx === 0 ? `${f}层护塔校尉` : idx === 1 ? `${f}层玄塔谋士` : idx === 2 ? `${f}层雷法道士` : `${f}层精锐甲士`,
      level: lv,
      roleClass: classes[idx],
      spriteKey: sprites[idx],
      hp: Math.round(hpBase * (idx === 0 ? 1.1 : 0.92)),
      mp: classes[idx] === 'wushi' ? 80 : 220,
      atk: Math.round(atkBase * (idx === 0 ? 1.05 : 0.96)),
      spd: spdBase + idx * 2,
    }));
  }

  return {
    id: `tower_${f}`,
    name: meta.name,
    mapId: 'xuchang',
    minLevel: meta.recLevel,
    silverReward: Math.round(60 + f * 55 + (f > 20 ? (f - 20) * (f - 20) * 3 : 0)),
    expReward: Math.round(80 + f * 95 + (f > 20 ? (f - 20) * (f - 20) * 16 : 0)),
    enemies,
  };
}

export const MAIN_QUESTS: MainQuestDef[] = [
  {
    questId: 'main_00a',
    chapter: 1,
    title: '风云际会',
    recLevel: 1,
    npcName: '新手村长',
    dialogue: '少侠初来乍到，村口无赖与小偷正欺凌云游老者左慈！请先赴【新手村口】击退 2 批【村口无赖】！',
    objectiveKind: 'kill',
    targetId: 'xinshou_wulai',
    targetName: '村口无赖',
    targetMapId: 'xinshoucun_kou',
    requiredCount: 2,
    rewards: {
      exp: 120,
      silver: 300,
      item: { itemId: 'jinchuang', quantity: 3 },
    },
  },
  {
    questId: 'main_00b',
    chapter: 2,
    title: '智斗盗贼',
    recLevel: 2,
    npcName: '新手村长',
    dialogue: '无赖背后的【盗贼总管】带人来村口催粮闹事了！快去【新手村口】将其击退，老朽引荐忠勇副将随你出村！',
    objectiveKind: 'kill',
    targetId: 'xinshou_daozei',
    targetName: '盗贼总管',
    targetMapId: 'xinshoucun_kou',
    requiredCount: 1,
    rewards: {
      exp: 220,
      silver: 450,
      generalTemplateId: 'zhoucang',
    },
  },
  {
    questId: 'main_00c',
    chapter: 3,
    title: '驰援下邳',
    recLevel: 4,
    npcName: '下邳守将',
    dialogue: '太史慈来报下邳告急，小沛九里山一带山贼趁乱劫道！请经【下邳】前往【小沛·九里山】清剿 2 批【九里山山贼】！',
    objectiveKind: 'kill',
    targetId: 'xiaopei_shanzei',
    targetName: '九里山山贼',
    targetMapId: 'xiaopei',
    requiredCount: 2,
    rewards: {
      exp: 380,
      silver: 700,
      item: { itemId: 'baotu', quantity: 1 },
    },
  },
  {
    questId: 'main_01',
    chapter: 4,
    title: '初入许昌',
    recLevel: 5,
    npcName: '许昌主线使者',
    dialogue: '少侠既已历练小沛下邳，如今正式踏入中原主城许昌！先去【许昌郊外】清剿 2 批【地痞群】，扬名中原！',
    objectiveKind: 'kill',
    targetId: 'xuchang_dipi',
    targetName: '地痞群',
    targetMapId: 'xuchang_jiao',
    requiredCount: 2,
    rewards: {
      exp: 320,
      silver: 550,
      item: { itemId: 'jinchuang', quantity: 3 },
    },
  },
  {
    questId: 'main_02',
    chapter: 5,
    title: '桃园访贤',
    recLevel: 5,
    npcName: '桃园老丈',
    dialogue: '独木难支大厦！请少侠动身前往【涿郡】寻访桃园旧事，老丈特备招贤厚礼相赠。',
    objectiveKind: 'visit_map',
    targetId: 'zhuojun',
    targetName: '前往涿郡',
    targetMapId: 'zhuojun',
    requiredCount: 1,
    rewards: {
      exp: 420,
      silver: 700,
      item: { itemId: 'jiangling', quantity: 1 },
    },
  },
  {
    questId: 'main_03',
    chapter: 6,
    title: '长社剿贼',
    recLevel: 5,
    npcName: '许昌主线使者',
    dialogue: '颍川长社一带黄巾余孽作乱，快带副将前往【长社】击破 3 支【黄巾道士】，以安民心！',
    objectiveKind: 'kill',
    targetId: 'changshe_daoshi',
    targetName: '黄巾道士',
    targetMapId: 'changshe',
    requiredCount: 3,
    rewards: {
      exp: 520,
      silver: 900,
      equipTemplateId: 'bailian_dao',
      item: { itemId: 'baotu', quantity: 1 },
    },
  },
  {
    questId: 'main_04',
    chapter: 7,
    title: '天公伏诛',
    recLevel: 7,
    npcName: '许昌主线使者',
    dialogue: '探马来报，天公将军张角携弟聚众于【长社】布阵！速去挑战剧情 BOSS【张角三兄弟】，一举荡平黄巾！',
    objectiveKind: 'kill',
    targetId: 'boss_zhangjiao',
    targetName: '张角三兄弟',
    targetMapId: 'changshe',
    requiredCount: 1,
    rewards: {
      exp: 900,
      silver: 1500,
      gold: 30,
      item: { itemId: 'jiangling', quantity: 1 },
    },
  },
  {
    questId: 'main_05',
    chapter: 8,
    title: '兵临洛阳',
    recLevel: 10,
    npcName: '洛阳守将',
    dialogue: '董卓挟持天子，西凉铁骑纵横【洛阳城外】。请少侠出城迎击 3 队【西凉铁骑】，挫其锐气！',
    objectiveKind: 'kill',
    targetId: 'luoyang_weidui',
    targetName: '西凉铁骑',
    targetMapId: 'luoyang_wai',
    requiredCount: 3,
    rewards: {
      exp: 1600,
      silver: 2400,
      equipTemplateId: 'wuzhui_ma',
      item: { itemId: 'jingyandan', quantity: 3 },
    },
  },
  {
    questId: 'main_06',
    chapter: 9,
    title: '温酒斩华雄',
    recLevel: 13,
    npcName: '洛阳守将',
    dialogue: '西凉猛将华雄镇守【虎牢关】，连斩诸侯数将！少侠若艺高胆大，请赴虎牢关阵斩【西凉骁将·华雄】！',
    objectiveKind: 'kill',
    targetId: 'boss_huaxiong',
    targetName: '西凉骁将·华雄',
    targetMapId: 'hulaoguan',
    requiredCount: 1,
    rewards: {
      exp: 2800,
      silver: 2600,
      gold: 50,
      item: { itemId: 'xisuidan', quantity: 2 },
    },
  },
  {
    questId: 'main_07',
    chapter: 10,
    title: '官渡破袁',
    recLevel: 16,
    npcName: '许昌主线使者',
    dialogue: '袁绍大军南下【官渡】，先锋颜良文丑勇冠三军。请少侠直捣官渡，击败剧情 BOSS【河北双雄·颜良文丑】！',
    objectiveKind: 'kill',
    targetId: 'boss_yanliang',
    targetName: '河北双雄·颜良文丑',
    targetMapId: 'guandu',
    requiredCount: 1,
    rewards: {
      exp: 4600,
      silver: 3800,
      equipTemplateId: 'qixing_jian',
      item: { itemId: 'jiangling', quantity: 1 },
    },
  },
  {
    questId: 'main_08',
    chapter: 11,
    title: '火烧赤壁',
    recLevel: 19,
    npcName: '许昌主线使者',
    dialogue: '铁索连舟，东风将起！前往【赤壁】冲破剧情 BOSS【赤壁先锋大营】，成就三分天下不朽威名！',
    objectiveKind: 'kill',
    targetId: 'boss_caojun',
    targetName: '赤壁先锋大营',
    targetMapId: 'chibi',
    requiredCount: 1,
    rewards: {
      exp: 7500,
      silver: 6000,
      gold: 100,
      equipTemplateId: 'dilu_ma',
      item: { itemId: 'baotu', quantity: 3 },
    },
  },
  {
    questId: 'main_09',
    chapter: 12,
    title: '智取荆州',
    recLevel: 22,
    npcName: '荆州主线使者',
    dialogue: '赤壁凯旋，荆襄九郡群雄逐鹿！请少侠南下【荆州城】报到，商议攻取南郡大计。',
    objectiveKind: 'visit_map',
    targetId: 'jingzhou',
    targetName: '前往荆州城',
    targetMapId: 'jingzhou',
    requiredCount: 1,
    rewards: {
      exp: 9500,
      silver: 4500,
      item: { itemId: 'jiangling', quantity: 1 },
    },
  },
  {
    questId: 'main_10',
    chapter: 13,
    title: '血战江陵',
    recLevel: 25,
    npcName: '荆州主线使者',
    dialogue: '大将曹仁据守【江陵古道】布下八门金锁阵。少侠请携副将破阵，正面击败【征南将军·曹仁】！',
    objectiveKind: 'kill',
    targetId: 'boss_caoren',
    targetName: '征南将军·曹仁',
    targetMapId: 'jiangling',
    requiredCount: 1,
    rewards: {
      exp: 18000,
      silver: 7200,
      gold: 60,
      equipTemplateId: 'qinglong_dao',
      item: { itemId: 'jingyandan', quantity: 3 },
    },
  },
  {
    questId: 'main_11',
    chapter: 14,
    title: '入主西川',
    recLevel: 30,
    npcName: '荆州主线使者',
    dialogue: '益州险塞，沃野千里。请少侠沿【益州栈道】西进，击破 3 队【西川栈道劲旅】打通入川要道！',
    objectiveKind: 'kill',
    targetId: 'yizhou_chuanjun',
    targetName: '西川栈道劲旅',
    targetMapId: 'yizhou',
    requiredCount: 3,
    rewards: {
      exp: 28000,
      silver: 9500,
      equipTemplateId: 'mingguang_kai',
      item: { itemId: 'baotu', quantity: 2 },
    },
  },
  {
    questId: 'main_12',
    chapter: 15,
    title: '破阵落凤坡',
    recLevel: 34,
    npcName: '荆州主线使者',
    dialogue: '川中名将张任于【益州栈道】设伏，凶险异常。请少侠直破【落凤坡·张任大阵】，奠定西川基业！',
    objectiveKind: 'kill',
    targetId: 'boss_zhangren',
    targetName: '落凤坡·张任大阵',
    targetMapId: 'yizhou',
    requiredCount: 1,
    rewards: {
      exp: 44000,
      silver: 13000,
      gold: 80,
      equipTemplateId: 'zhuahuang_ma',
      item: { itemId: 'xisuidan', quantity: 2 },
    },
  },
  {
    questId: 'main_13',
    chapter: 16,
    title: '斩夏侯定汉中',
    recLevel: 40,
    npcName: '荆州守将',
    dialogue: '魏将夏侯渊屯兵【汉中定军山】，虎视益州。少侠请效仿老将黄忠，踏平【妙才·夏侯渊大营】！',
    objectiveKind: 'kill',
    targetId: 'boss_xiahouyuan',
    targetName: '妙才·夏侯渊大营',
    targetMapId: 'hanzhong',
    requiredCount: 1,
    rewards: {
      exp: 68000,
      silver: 18500,
      gold: 100,
      equipTemplateId: 'xuanwu_jia',
      item: { itemId: 'jiangling', quantity: 2 },
    },
  },
  {
    questId: 'main_14',
    chapter: 17,
    title: '夷陵烽火',
    recLevel: 46,
    npcName: '荆州守将',
    dialogue: '东吴解烦精兵云集【夷陵火林】，伺机断我归路。请少侠先行剿灭 3 队【东吴解烦精兵】以挫敌锋！',
    objectiveKind: 'kill',
    targetId: 'yiling_wujun',
    targetName: '东吴解烦精兵',
    targetMapId: 'yiling',
    requiredCount: 3,
    rewards: {
      exp: 98000,
      silver: 24000,
      equipTemplateId: 'lingbo_lv',
      item: { itemId: 'jingyandan', quantity: 5 },
    },
  },
  {
    questId: 'main_15',
    chapter: 18,
    title: '火林破连营',
    recLevel: 50,
    npcName: '荆州守将',
    dialogue: '江东大都督陆逊统领甘宁、朱然扼守【夷陵火林】！请少侠率满编副将正面击破【火烧连营·陆逊】！',
    objectiveKind: 'kill',
    targetId: 'boss_luxun',
    targetName: '火烧连营·陆逊',
    targetMapId: 'yiling',
    requiredCount: 1,
    rewards: {
      exp: 145000,
      silver: 34000,
      gold: 160,
      item: { itemId: 'baotu', quantity: 4 },
    },
  },
  {
    questId: 'main_16',
    chapter: 19,
    title: '星落五丈原',
    recLevel: 56,
    npcName: '许昌主线使者',
    dialogue: '六出祁山，决战【五丈原】！迎战大魏大都督【冢虎·司马懿本阵】，功成之后便可筹备主角 60 级一转！',
    objectiveKind: 'kill',
    targetId: 'boss_simayi',
    targetName: '冢虎·司马懿本阵',
    targetMapId: 'wuzhangyuan',
    requiredCount: 1,
    rewards: {
      exp: 240000,
      silver: 52000,
      gold: 300,
      equipTemplateId: 'fangtian_ji',
      item: { itemId: 'jiangling', quantity: 3 },
    },
  },
];

export const MAPS: Record<string, MapNode> = {
  xinshoucun: {
    id: 'xinshoucun',
    name: '新手村',
    region: '徐州近郊',
    thumb: 'site_m4.png',
    battleBg: 'f_bg2',
    desc: '徐州小沛旁的宁静村落，乱世三国梦由此起步。',
    isSafe: true,
    recommendedLevel: '新手村',
    neighbors: ['xinshoucun_kou', 'xiapi'],
    npcs: [
      {
        id: 'npc_cunzhang',
        name: '新手村长',
        action: 'talk',
        dialogue: '欢迎来到幻想三国！先去新手村口击退欺负左慈老先生的无赖与盗贼总管，再出村驰援下邳吧！',
      },
      {
        id: 'npc_ronger',
        name: '蓉儿',
        action: 'talk',
        dialogue: '少侠快去村口看看吧！那群无赖又在欺负云游来的老先生了。',
      },
      {
        id: 'npc_zuoci',
        name: '云游老者·左慈',
        action: 'talk',
        dialogue: '少侠骨骼清奇！10 级之前村中客栈完全免费回血蓝，待练熟武艺便可动身前往【下邳】与【许昌】闯荡天下。',
      },
    ],
    facilities: [
      { id: 'inn', name: '村中客栈', desc: '歇脚打尖，10级内免费满血满蓝', icon: 'ss_m_1.png', kind: 'inn' },
      { id: 'pharmacy', name: '村头医馆', desc: '购买金创药、凝神散与藏宝图', icon: 'ss_m_2.png', kind: 'pharmacy' },
      { id: 'blacksmith', name: '村口铁匠', desc: '购置新手兵器与防具', icon: 'ss_m_6.png', kind: 'blacksmith' },
      { id: 'tavern', name: '招贤小亭', desc: '招募初期副将与研习秘籍', icon: 'ss_m_3.png', kind: 'tavern' },
    ],
  },
  xinshoucun_kou: {
    id: 'xinshoucun_kou',
    name: '新手村口',
    region: '新手村外',
    thumb: 'site_m5.png',
    battleBg: 'f_bg2',
    desc: '村外官道常有无赖与盗贼总管出没，村南废墟外直通徐州下邳城。',
    isSafe: false,
    recommendedLevel: 'Lv.1 ~ 4',
    neighbors: ['xinshoucun', 'xiapi'],
    npcs: [
      {
        id: 'npc_wulai',
        name: '村口无赖',
        action: 'battle',
        enemyGroupId: 'xinshou_wulai',
      },
      {
        id: 'npc_daozei',
        name: '盗贼总管',
        action: 'battle',
        enemyGroupId: 'xinshou_daozei',
      },
      {
        id: 'npc_taishici_kou',
        name: '太史慈',
        action: 'talk',
        dialogue: '此地已有黄巾探子出没，大股黄巾正逼近徐州【下邳】！少侠若有志平乱，速随我赶赴下邳协防！',
      },
    ],
    facilities: [],
  },
  xiapi: {
    id: 'xiapi',
    name: '下邳',
    region: '徐州重镇',
    thumb: 'site_m6.png',
    battleBg: 'f_bg5',
    desc: '徐州第一重镇下邳城，白门楼高耸入云，初出新手村踏足乱世的首座大城。',
    isSafe: true,
    recommendedLevel: '安全区',
    neighbors: ['xinshoucun', 'xinshoucun_kou', 'xiaopei', 'xuchang'],
    npcs: [
      {
        id: 'npc_xiapi_main',
        name: '下邳守将',
        action: 'talk',
        dialogue: '少侠远道驰援下邳，真是雪中送炭！城西【小沛·九里山】山贼与黄巾游骑猖獗，肃清后便可西进中原主城【许昌】！',
      },
      {
        id: 'npc_xiapi_taishici',
        name: '北海太史慈',
        action: 'talk',
        dialogue: '下邳已有重兵驻守。少侠可在城内整备行装，去小沛九里山磨砺一番，再赴许昌接取跑环与天玄塔试炼！',
      },
    ],
    facilities: [
      { id: 'inn', name: '下邳客栈', desc: '歇脚打尖，恢复满血满蓝', icon: 'ss_m_1.png', kind: 'inn' },
      { id: 'pharmacy', name: '下邳医馆', desc: '购买丹药与稀有消耗品', icon: 'ss_m_2.png', kind: 'pharmacy' },
      { id: 'blacksmith', name: '下邳铁匠铺', desc: '购置兵器、防具与打造装备', icon: 'ss_m_6.png', kind: 'blacksmith' },
      { id: 'tavern', name: '下邳招贤馆', desc: '招募三国副将与购置秘籍', icon: 'ss_m_3.png', kind: 'tavern' },
      { id: 'bank', name: '下邳钱庄', desc: '存取银两金砖、金银兑汇', icon: 'ss_m_10.png', kind: 'bank' },
    ],
  },
  xiaopei: {
    id: 'xiaopei',
    name: '小沛·九里山',
    region: '徐州边境',
    thumb: 'site_m7.png',
    battleBg: 'f_bg5',
    desc: '小沛城外九里山林深谷险，山贼流寇与黄巾游骑盘踞于此，往西直通中原许昌。',
    isSafe: false,
    recommendedLevel: 'Lv.4 ~ 9',
    neighbors: ['xiapi', 'xuchang', 'xuchang_jiao'],
    npcs: [
      {
        id: 'npc_xiaopei_shanzei',
        name: '九里山山贼',
        action: 'battle',
        enemyGroupId: 'xiaopei_shanzei',
      },
      {
        id: 'npc_xiaopei_huangjin',
        name: '小沛黄巾游骑',
        action: 'battle',
        enemyGroupId: 'xiaopei_huangjin',
      },
    ],
    facilities: [],
  },
  xuchang: {
    id: 'xuchang',
    name: '许昌',
    region: '中原腹地',
    thumb: 'site_m1.png',
    battleBg: 'f_bg2',
    desc: '魏都许昌，商贾云集，英雄豪杰汇集的中原核心主城。',
    isSafe: true,
    recommendedLevel: '安全区',
    neighbors: ['xiapi', 'xiaopei', 'xuchang_jiao', 'luoyang', 'zhuojun', 'jingzhou'],
    npcs: [
      {
        id: 'npc_main',
        name: '主线任务',
        action: 'talk',
        dialogue: '欢迎来到幻想三国经典版！先去许昌郊外清理地痞群，再到招贤馆招募得力副将吧。',
      },
      {
        id: 'npc_paohuan',
        name: '跑环使者',
        action: 'talk',
        dialogue: '长社附近有黄巾道士出没，打败他们可获丰厚银两与经验！',
      },
      {
        id: 'npc_xunluo',
        name: '巡逻士兵',
        action: 'battle',
        enemyGroupId: 'xuchang_shibing',
      },
    ],
    facilities: [
      { id: 'inn', name: '许昌客栈', desc: '歇脚打尖，免费满血满蓝', icon: 'ss_m_1.png', kind: 'inn' },
      { id: 'pharmacy', name: '回春药铺', desc: '购买丹药与藏宝图', icon: 'ss_m_2.png', kind: 'pharmacy' },
      { id: 'blacksmith', name: '铁匠铺与马市', desc: '购置兵器、铠甲、战靴与名马', icon: 'ss_m_6.png', kind: 'blacksmith' },
      { id: 'tavern', name: '招贤馆', desc: '招募名将与购买副将技能书', icon: 'ss_m_3.png', kind: 'tavern' },
      { id: 'tower', name: '天玄塔', desc: '50层单人爬塔试炼与每日扫荡', icon: 'ss_m_8.png', kind: 'tower' },
      { id: 'daily', name: '每日历练台', desc: '科举5题、单趟运镖与整点杀星', icon: 'ss_m_12.png', kind: 'daily' },
      { id: 'casino', name: '许昌赌坊', desc: '经典猜大小/豹子 与 赤壁押注', icon: 'ss_m_9.png', kind: 'casino' },
      { id: 'bank', name: '许昌钱庄', desc: '存取银两金砖、金银自由兑换', icon: 'ss_m_10.png', kind: 'bank' },
      { id: 'market', name: '许昌集市', desc: '玩家离线摆摊寄售装备/副将/秘籍', icon: 'ss_m_11.png', kind: 'market' },
      { id: 'gm', name: '福利驿站', desc: '发银两/金砖、一键满状态、刷经验', icon: 'ss_m_5.png', kind: 'gm' },
    ],
  },
  xuchang_jiao: {
    id: 'xuchang_jiao',
    name: '许昌郊外',
    region: '许昌外围',
    thumb: 'site_m2.png',
    battleBg: 'f_bg2',
    desc: '官道两侧草木茂盛，地痞流氓常在此拦路抢劫。',
    isSafe: false,
    recommendedLevel: 'Lv.4 ~ 8',
    neighbors: ['xuchang', 'xiaopei', 'changshe'],
    npcs: [
      {
        id: 'npc_dipi',
        name: '地痞群',
        action: 'battle',
        enemyGroupId: 'xuchang_dipi',
      },
      {
        id: 'npc_shibing2',
        name: '巡逻官兵',
        action: 'talk',
        dialogue: '前方就是长社，那里黄巾道士颇为凶险，记得在许昌客栈补满气血再去！',
      },
    ],
    facilities: [],
  },
  changshe: {
    id: 'changshe',
    name: '长社',
    region: '颍川古战场',
    thumb: 'site_m4.png',
    battleBg: 'f_bg5',
    desc: '黄巾军曾在此扎营，至今仍有道士残部与张角妖阵盘踞。',
    isSafe: false,
    recommendedLevel: 'Lv.5 ~ 10',
    neighbors: ['xuchang_jiao', 'luoyang_wai'],
    npcs: [
      {
        id: 'npc_daoshi',
        name: '黄巾道士',
        action: 'battle',
        enemyGroupId: 'changshe_daoshi',
      },
      {
        id: 'npc_boss_zhangjiao',
        name: '【BOSS】张角三兄弟',
        action: 'battle',
        enemyGroupId: 'boss_zhangjiao',
      },
    ],
    facilities: [],
  },
  luoyang: {
    id: 'luoyang',
    name: '洛阳',
    region: '东汉古都',
    thumb: 'site_m3.png',
    battleBg: 'f_bg6',
    desc: '千年帝都，巍峨雄壮，天下豪杰论剑之处。',
    isSafe: true,
    recommendedLevel: '安全区',
    neighbors: ['xuchang', 'luoyang_wai'],
    npcs: [
      {
        id: 'npc_luoyang_guard',
        name: '洛阳守将',
        action: 'talk',
        dialogue: '城外西凉铁骑虎视眈眈，更东便是虎牢关！少侠若已过 10 级，可出城讨贼建功！',
      },
    ],
    facilities: [
      { id: 'inn', name: '洛阳悦来客栈', desc: '歇脚打尖，免费满血满蓝', icon: 'ss_m_1.png', kind: 'inn' },
      { id: 'pharmacy', name: '太医署药房', desc: '购买丹药与藏宝图', icon: 'ss_m_2.png', kind: 'pharmacy' },
      { id: 'blacksmith', name: '洛阳兵马司', desc: '购置精良兵器防具与名驹', icon: 'ss_m_7.png', kind: 'blacksmith' },
      { id: 'tavern', name: '洛阳招贤馆', desc: '招募强力三国副将', icon: 'ss_m_3.png', kind: 'tavern' },
      { id: 'bank', name: '洛阳钱庄', desc: '存取银两金砖、金银自由兑换', icon: 'ss_m_10.png', kind: 'bank' },
      { id: 'daily', name: '洛阳历练台', desc: '科举5题、单趟运镖与整点杀星', icon: 'ss_m_12.png', kind: 'daily' },
      { id: 'market', name: '洛阳集市', desc: '全区互通离线摆摊寄售', icon: 'ss_m_11.png', kind: 'market' },
    ],
  },
  luoyang_wai: {
    id: 'luoyang_wai',
    name: '洛阳城外',
    region: '虎牢关道',
    thumb: 'site_m5.png',
    battleBg: 'f_bg8',
    desc: '黄沙漫天，西凉铁骑精锐在此巡弋，东通虎牢雄关。',
    isSafe: false,
    recommendedLevel: 'Lv.10 ~ 14',
    neighbors: ['luoyang', 'changshe', 'hulaoguan'],
    npcs: [
      {
        id: 'npc_xiliang',
        name: '西凉铁骑',
        action: 'battle',
        enemyGroupId: 'luoyang_weidui',
      },
    ],
    facilities: [],
  },
  hulaoguan: {
    id: 'hulaoguan',
    name: '虎牢关',
    region: '中原雄关',
    thumb: 'site_m7.png',
    battleBg: 'f_bg7',
    desc: '一夫当关万夫莫开，西凉骁将华雄提刀据守于此。',
    isSafe: false,
    recommendedLevel: 'Lv.12 ~ 16',
    neighbors: ['luoyang_wai', 'guandu'],
    npcs: [
      {
        id: 'npc_hulao_guard',
        name: '虎牢关守军',
        action: 'battle',
        enemyGroupId: 'hulao_xiliang',
      },
      {
        id: 'npc_boss_huaxiong',
        name: '【BOSS】西凉骁将·华雄',
        action: 'battle',
        enemyGroupId: 'boss_huaxiong',
      },
    ],
    facilities: [],
  },
  guandu: {
    id: 'guandu',
    name: '官渡',
    region: '黄河南岸',
    thumb: 'site_m8.png',
    battleBg: 'f_bg9',
    desc: '袁曹决战之地，旌旗蔽日，河北双雄颜良文丑阵前叫战。',
    isSafe: false,
    recommendedLevel: 'Lv.15 ~ 19',
    neighbors: ['hulaoguan', 'chibi'],
    npcs: [
      {
        id: 'npc_guandu_yuanjun',
        name: '袁军先登死士',
        action: 'battle',
        enemyGroupId: 'guandu_yuanjun',
      },
      {
        id: 'npc_boss_yanliang',
        name: '【BOSS】颜良文丑',
        action: 'battle',
        enemyGroupId: 'boss_yanliang',
      },
    ],
    facilities: [],
  },
  chibi: {
    id: 'chibi',
    name: '赤壁',
    region: '长江南岸',
    thumb: 'site_m9.png',
    battleBg: 'f_bg20',
    desc: '赤壁矶头浪淘沙，铁索楼船连绵十里，大战一触即发！',
    isSafe: false,
    recommendedLevel: 'Lv.18 ~ 22',
    neighbors: ['guandu', 'jingzhou', 'xuchang'],
    npcs: [
      {
        id: 'npc_chibi_shuijun',
        name: '曹军水师楼船',
        action: 'battle',
        enemyGroupId: 'chibi_shuijun',
      },
      {
        id: 'npc_boss_caojun',
        name: '【BOSS】赤壁先锋大营',
        action: 'battle',
        enemyGroupId: 'boss_caojun',
      },
    ],
    facilities: [],
  },
  jingzhou: {
    id: 'jingzhou',
    name: '荆州城',
    region: '荆襄重镇',
    thumb: 'site_m10.png',
    battleBg: 'f_bg6',
    desc: '兵家必争之地，上通巴蜀、下控江东，22 级以上豪杰的大本营。',
    isSafe: true,
    recommendedLevel: '安全区',
    neighbors: ['chibi', 'jiangling', 'yizhou', 'xuchang'],
    npcs: [
      {
        id: 'npc_jingzhou_main',
        name: '荆州主线使者',
        action: 'talk',
        dialogue: '赤壁之后，天下三分之势已成！江陵、益州、汉中、夷陵乃至五丈原皆有劲敌等你建功立业！',
      },
      {
        id: 'npc_jingzhou_guard',
        name: '荆州守将',
        action: 'talk',
        dialogue: '荆州兵甲坊备有 22 级与 35 级名兵宝甲，招贤馆也可寻访张飞、诸葛亮、周瑜、华佗等名将！',
      },
    ],
    facilities: [
      { id: 'inn', name: '荆州客栈', desc: '歇脚打尖，免费满血满蓝', icon: 'ss_m_1.png', kind: 'inn' },
      { id: 'pharmacy', name: '荆州回春堂', desc: '购买丹药与藏宝图', icon: 'ss_m_2.png', kind: 'pharmacy' },
      { id: 'blacksmith', name: '荆州兵甲坊', desc: '购置高阶兵器、铠甲与名马', icon: 'ss_m_6.png', kind: 'blacksmith' },
      { id: 'tavern', name: '荆州招贤馆', desc: '招募中后期三国名将与技能书', icon: 'ss_m_3.png', kind: 'tavern' },
      { id: 'tower', name: '天玄塔分坛', desc: '50层单人爬塔试炼与每日扫荡', icon: 'ss_m_8.png', kind: 'tower' },
      { id: 'daily', name: '荆州历练台', desc: '科举5题、单趟运镖与整点杀星', icon: 'ss_m_12.png', kind: 'daily' },
      { id: 'bank', name: '荆州钱庄', desc: '全区互通存取银两金砖', icon: 'ss_m_10.png', kind: 'bank' },
      { id: 'market', name: '荆州集市', desc: '全区互通离线摆摊寄售', icon: 'ss_m_11.png', kind: 'market' },
    ],
  },
  jiangling: {
    id: 'jiangling',
    name: '江陵古道',
    region: '南郡前线',
    thumb: 'site_m12.png',
    battleBg: 'f_bg5',
    desc: '曹仁据险筑垒，八门金锁阵横亘古道，战鼓震天。',
    isSafe: false,
    recommendedLevel: 'Lv.22 ~ 28',
    neighbors: ['jingzhou', 'yizhou'],
    npcs: [
      {
        id: 'npc_jiangling_caojun',
        name: '曹仁江陵守军',
        action: 'battle',
        enemyGroupId: 'jiangling_caojun',
      },
      {
        id: 'npc_boss_caoren',
        name: '【BOSS】征南将军·曹仁',
        action: 'battle',
        enemyGroupId: 'boss_caoren',
      },
    ],
    facilities: [],
  },
  yizhou: {
    id: 'yizhou',
    name: '益州栈道',
    region: '巴蜀险关',
    thumb: 'site_m13.png',
    battleBg: 'f_bg7',
    desc: '蜀道难于上青天，西川劲旅与落凤坡伏兵严阵以待。',
    isSafe: false,
    recommendedLevel: 'Lv.28 ~ 36',
    neighbors: ['jingzhou', 'jiangling', 'hanzhong'],
    npcs: [
      {
        id: 'npc_yizhou_chuanjun',
        name: '西川栈道劲旅',
        action: 'battle',
        enemyGroupId: 'yizhou_chuanjun',
      },
      {
        id: 'npc_yizhou_manbing',
        name: '南中藤甲精兵',
        action: 'battle',
        enemyGroupId: 'yizhou_manbing',
      },
      {
        id: 'npc_boss_zhangren',
        name: '【BOSS】落凤坡·张任',
        action: 'battle',
        enemyGroupId: 'boss_zhangren',
      },
    ],
    facilities: [],
  },
  hanzhong: {
    id: 'hanzhong',
    name: '汉中定军山',
    region: '汉中要塞',
    thumb: 'site_m14.png',
    battleBg: 'f_bg8',
    desc: '定军山峭壁耸立，夏侯渊大营居高临下，一战可定汉中。',
    isSafe: false,
    recommendedLevel: 'Lv.36 ~ 44',
    neighbors: ['yizhou', 'yiling'],
    npcs: [
      {
        id: 'npc_hanzhong_weijun',
        name: '定军山魏军营',
        action: 'battle',
        enemyGroupId: 'hanzhong_weijun',
      },
      {
        id: 'npc_boss_xiahouyuan',
        name: '【BOSS】妙才·夏侯渊',
        action: 'battle',
        enemyGroupId: 'boss_xiahouyuan',
      },
    ],
    facilities: [],
  },
  yiling: {
    id: 'yiling',
    name: '夷陵火林',
    region: '猇亭古林',
    thumb: 'site_m15.png',
    battleBg: 'f_bg20',
    desc: '七百里连营深陷密林，东吴大都督陆逊率江东精锐枕戈待旦。',
    isSafe: false,
    recommendedLevel: 'Lv.44 ~ 52',
    neighbors: ['hanzhong', 'wuzhangyuan'],
    npcs: [
      {
        id: 'npc_yiling_wujun',
        name: '东吴解烦精兵',
        action: 'battle',
        enemyGroupId: 'yiling_wujun',
      },
      {
        id: 'npc_boss_luxun',
        name: '【BOSS】火烧连营·陆逊',
        action: 'battle',
        enemyGroupId: 'boss_luxun',
      },
    ],
    facilities: [],
  },
  wuzhangyuan: {
    id: 'wuzhangyuan',
    name: '五丈原',
    region: '关中决战地',
    thumb: 'site_m16.png',
    battleBg: 'f_bg9',
    desc: '秋风肃杀，渭水之滨。大魏司马懿本阵岿然不动，乃首期最高试炼之地！',
    isSafe: false,
    recommendedLevel: 'Lv.52 ~ 60',
    neighbors: ['yiling', 'jingzhou'],
    npcs: [
      {
        id: 'npc_wuzhang_sima',
        name: '司马亲卫中军',
        action: 'battle',
        enemyGroupId: 'wuzhang_sima',
      },
      {
        id: 'npc_boss_simayi',
        name: '【BOSS】冢虎·司马懿',
        action: 'battle',
        enemyGroupId: 'boss_simayi',
      },
    ],
    facilities: [],
  },
  zhuojun: {
    id: 'zhuojun',
    name: '涿郡',
    region: '幽州桃园',
    thumb: 'site_m6.png',
    battleBg: 'f_bg4',
    desc: '桃园结义发源地，民风淳朴，适合新手歇脚访贤。',
    isSafe: true,
    recommendedLevel: '安全区',
    neighbors: ['xuchang'],
    npcs: [
      {
        id: 'npc_taoyuan',
        name: '桃园老丈',
        action: 'talk',
        dialogue: '当年刘关张在此结拜，今日各位豪杰齐聚于此！少侠若有主线访贤之托，快打开任务卷轴领取副将相助吧！',
      },
    ],
    facilities: [
      { id: 'inn', name: '桃园酒肆', desc: '歇脚打尖，免费满血满蓝', icon: 'ss_m_4.png', kind: 'inn' },
    ],
  },
};

export interface KejuQuestionDef {
  id: string;
  question: string;
  options: [string, string, string, string];
  answerIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

export const KEJU_QUESTIONS: KejuQuestionDef[] = [
  {
    id: 'kj_01',
    question: '《三国演义》中「桃园三结义」的地点位于哪座城池？',
    options: ['许昌', '涿郡', '洛阳', '荆州'],
    answerIndex: 1,
    explanation: '刘备、关羽、张飞于幽州涿郡桃园结为异姓兄弟。',
  },
  {
    id: 'kj_02',
    question: '赤壁之战中，提出「苦肉计」并火烧曹军连环船的东吴老将是？',
    options: ['程普', '韩当', '黄盖', '周泰'],
    answerIndex: 2,
    explanation: '老将黄盖愿打愿挨施展苦肉计，率火船冲入曹军水寨。',
  },
  {
    id: 'kj_03',
    question: '在《幻想三国》经典版中，文人职业的哪项技能可以让敌军敌我不分、自相残杀？',
    options: ['定身计', '画地为牢', '离间计', '呼风唤雨'],
    answerIndex: 2,
    explanation: '【离间计】属于「乱」系控场，命中的目标会陷入混乱互相攻击。',
  },
  {
    id: 'kj_04',
    question: '「温酒斩华雄」发生于讨伐董卓的哪场战役前夕？',
    options: ['官渡之战', '汜水关/虎牢关之战', '夷陵之战', '定军山之战'],
    answerIndex: 1,
    explanation: '关羽请缨出战，杯酒尚温便提华雄首级归营。',
  },
  {
    id: 'kj_05',
    question: '「一跃檀溪」救主脱险的名驹是哪一匹战马？',
    options: ['赤兔', '的卢', '绝影', '爪黄飞电'],
    answerIndex: 1,
    explanation: '刘备乘的卢马一跃三丈飞渡檀溪，逃脱蔡瑁追杀。',
  },
  {
    id: 'kj_06',
    question: '在《幻想三国》中，群攻技能熟练度达到几阶时可以打满 5 个目标？',
    options: ['2 阶', '3 阶', '4 阶', '5 阶'],
    answerIndex: 2,
    explanation: '1 阶打 2 个、2 阶打 3 个、3 阶打 4 个，4 阶起即可全屏打击 5 个目标！',
  },
  {
    id: 'kj_07',
    question: '官渡之战中，曹操奇袭袁绍哪处粮仓一举扭转战局？',
    options: ['乌巢', '延津', '白马', '陈留'],
    answerIndex: 0,
    explanation: '许攸献计，曹操亲率轻骑夜袭乌巢烧毁袁军粮草。',
  },
  {
    id: 'kj_08',
    question: '「定军山斩夏侯渊」是蜀汉哪位五虎上将的成名绝战？',
    options: ['马超', '赵云', '黄忠', '张飞'],
    answerIndex: 2,
    explanation: '老将黄忠在法正配合下居高临下突袭，阵斩曹魏大将夏侯渊。',
  },
  {
    id: 'kj_09',
    question: '下列哪位谋士素有「冢虎」之称，并在五丈原与诸葛亮对峙？',
    options: ['郭嘉', '荀彧', '贾诩', '司马懿'],
    answerIndex: 3,
    explanation: '司马懿字仲达，人称冢虎，坚守不出耗尽蜀军粮草。',
  },
  {
    id: 'kj_10',
    question: '东吴大都督陆逊在夷陵之战中大破蜀军所使用的经典战术是？',
    options: ['水淹七军', '火烧连营', '空城计', '背水一战'],
    answerIndex: 1,
    explanation: '刘备七百里连营犯兵家大忌，陆逊顺风纵火一战定局。',
  },
  {
    id: 'kj_11',
    question: '在《幻想三国》中，副将默契度达到 100（生死之交）可获得多少额外属性与抗性？',
    options: ['+5%属性 / +5%抗性', '+10%属性 / +10%抗性', '+15%属性 / +15%抗性', '+25%属性 / +20%抗性'],
    answerIndex: 2,
    explanation: '满 100 默契度解锁「生死之交」，攻血+15%、全抗性+15%！',
  },
  {
    id: 'kj_12',
    question: '「白衣渡江」偷袭荆州的是东吴哪位名将？',
    options: ['周瑜', '鲁肃', '吕蒙', '甘宁'],
    answerIndex: 2,
    explanation: '吕蒙令精兵扮作商贾白衣摇橹渡江，智取南郡。',
  },
  {
    id: 'kj_13',
    question: '历史上「威震逍遥津」以八百精骑击溃十万吴军的曹魏名将是？',
    options: ['张辽', '徐晃', '于禁', '张郃'],
    answerIndex: 0,
    explanation: '张辽、李典、乐进守合肥，张辽率八百死士冲阵，威震江东。',
  },
  {
    id: 'kj_14',
    question: '在《幻想三国》中，被文人【画地为牢】（围）命中的目标会承受什么额外效果？',
    options: ['每回合掉蓝', '所受伤害提高 25%', '攻击力翻倍', '无法被治疗'],
    answerIndex: 1,
    explanation: '被「围困」的目标无法普攻，且受到的伤害提高 25%！',
  },
  {
    id: 'kj_15',
    question: '「三顾茅庐」请出诸葛亮之前，向刘备极力举荐「卧龙、凤雏」的隐士是？',
    options: ['左慈', '于吉', '司马徽（水镜先生）', '华佗'],
    answerIndex: 2,
    explanation: '水镜先生司马徽曾言「卧龙、凤雏，二人得一，可安天下」。',
  },
  {
    id: 'kj_16',
    question: '「单骑救主」于长坂坡七进七出的蜀汉名将是？',
    options: ['关羽', '赵云', '马超', '魏延'],
    answerIndex: 1,
    explanation: '常山赵子龙怀抱幼主阿斗，于曹操大军中杀出重围。',
  },
  {
    id: 'kj_17',
    question: '曹操所乘名驹「绝影」是在哪一场战役中为救主身中数箭而亡？',
    options: ['宛城之战', '赤壁之战', '官渡之战', '潼关之战'],
    answerIndex: 0,
    explanation: '宛城张绣夜袭，绝影马中箭仍奋力狂奔带曹操脱险。',
  },
  {
    id: 'kj_18',
    question: '在《幻想三国》中，武士的【连环突刺】在熟练度达到几阶后可触发 3 连击？',
    options: ['2 阶', '3 阶', '4 阶', '5 阶'],
    answerIndex: 1,
    explanation: '连环突刺 1~2 阶为 2 连击，达到 3 阶以上即可触发强力 3 连击！',
  },
  {
    id: 'kj_19',
    question: '「刮骨疗毒」展现神医风范的名医是哪位历史人物？',
    options: ['张仲景', '华佗', '扁鹊', '孙思邈'],
    answerIndex: 1,
    explanation: '华佗为关羽刮骨去毒，关羽一边饮酒弈棋谈笑自若。',
  },
  {
    id: 'kj_20',
    question: '「羽扇纶巾，谈笑间，樯橹灰飞烟灭」词句赞颂的是哪位三国名将？',
    options: ['诸葛亮', '周瑜', '庞统', '陆逊'],
    answerIndex: 1,
    explanation: '苏轼《念奴娇·赤壁怀古》以此句盛赞东吴大都督周瑜。',
  },
  {
    id: 'kj_21',
    question: '三国时期「八门金锁阵」出自曹魏哪位善于守城的大将之手？',
    options: ['曹仁', '曹洪', '夏侯惇', '许褚'],
    answerIndex: 0,
    explanation: '曹仁在新野与樊城之战中以守备著称，曾布八门金锁阵。',
  },
  {
    id: 'kj_22',
    question: '在《幻想三国》中，副将进行 1 转与 2 转所需的等级分别是多少？',
    options: ['10级 / 20级', '20级 / 40级', '30级 / 50级', '40级 / 60级'],
    answerIndex: 1,
    explanation: '当前长线版本中，副将 20 级可 1 转、40 级可 2 转，转生后永久提升成长与初值。',
  },
  {
    id: 'kj_23',
    question: '「煮酒论英雄」中，曹操对刘备说出「今天下英雄，惟使君与操耳」是在何处？',
    options: ['许昌', '成都', '建业', '邺城'],
    answerIndex: 0,
    explanation: '刘备寄居许昌后园种菜韬光养晦，曹操青梅煮酒试探其志。',
  },
  {
    id: 'kj_24',
    question: '「锦帆贼」出身、后成为东吴猛将并百骑劫魏营的人物是？',
    options: ['太史慈', '甘宁', '凌统', '丁奉'],
    answerIndex: 1,
    explanation: '甘宁早年系铃锦帆纵横江上，归吴后百骑夜袭曹营扬名天下。',
  },
  {
    id: 'kj_25',
    question: '「凤雏」庞统是在攻取益州的哪处险地不幸中箭身亡？',
    options: ['剑门关', '落凤坡', '葭萌关', '白帝城'],
    answerIndex: 1,
    explanation: '庞统乘白马行至落凤坡，遭西川大将张任伏兵乱箭射杀。',
  },
];

export interface WorldBossDef {
  id: string;
  title: string;
  name: string;
  roleClass: RoleClass;
  spriteKey: string;
  desc: string;
}

export const WORLD_BOSS_ROSTER: WorldBossDef[] = [
  { id: 'wb_zhangliao', title: '天魁星', name: '威震逍遥津·张辽', roleClass: 'wushi', spriteKey: 'r1', desc: '整点巡弋中原的曹魏五子良将之首，刀法迅捷凌厉。' },
  { id: 'wb_ganning', title: '天罡星', name: '锦帆百骑·甘宁', roleClass: 'wushi', spriteKey: 'r1', desc: '江东悍将突袭而来，高攻高速压迫力极强。' },
  { id: 'wb_zuoci', title: '天机星', name: '乌角仙人·左慈', roleClass: 'yiren', spriteKey: 'r3', desc: '道法通玄的乱世仙人，善引九天玄雷与幻术。' },
  { id: 'wb_dianwei', title: '天勇星', name: '古之恶来·典韦', roleClass: 'wushi', spriteKey: 'r1', desc: '手持双铁戟力大无穷，气血雄厚。' },
  { id: 'wb_guojia', title: '天闲星', name: '鬼才军师·郭嘉', roleClass: 'wenren', spriteKey: 'r2', desc: '奇谋百出的曹营谋主，擅长群体控场与谋略打击。' },
  { id: 'wb_taishici', title: '天雄星', name: '北海神射·太史慈', roleClass: 'wushi', spriteKey: 'r1', desc: '猿臂善射的东吴虎将，连击破甲威不可挡。' },
  { id: 'wb_pangde', title: '天威星', name: '抬棺死战·庞德', roleClass: 'wushi', spriteKey: 'r1', desc: '白马将军庞令明，背水死战攻势狂猛。' },
  { id: 'wb_sunce', title: '天英星', name: '江东小霸王·孙策', roleClass: 'wushi', spriteKey: 'r1', desc: '霸王枪势如破竹，江东豪杰争锋试金石。' },
];

const WORLD_BOSS_MAPS = [
  'changshe',
  'luoyang_wai',
  'hulaoguan',
  'guandu',
  'chibi',
  'jiangling',
  'yizhou',
  'hanzhong',
  'yiling',
  'wuzhangyuan',
];

export function getCurrentWorldBoss(now = new Date()): {
  hourKey: string;
  boss: WorldBossDef;
  mapId: string;
  mapName: string;
  nextRefreshMinutes: number;
} {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = now.getHours();
  const hourKey = `${y}-${m}-${d}-${String(h).padStart(2, '0')}`;
  const slot = Math.floor(now.getTime() / 3_600_000);
  const boss = WORLD_BOSS_ROSTER[slot % WORLD_BOSS_ROSTER.length];
  const mapId = WORLD_BOSS_MAPS[(slot * 3 + 1) % WORLD_BOSS_MAPS.length];
  const mapName = MAPS[mapId]?.name ?? mapId;
  const nextRefreshMinutes = Math.max(1, 60 - now.getMinutes());
  return { hourKey, boss, mapId, mapName, nextRefreshMinutes };
}

export function buildEscortBanditGroup(level: number): EnemyGroupDef {
  const lv = Math.max(3, Math.min(60, Math.floor(level)));
  const hpBase = Math.round(40 + lv * 32 + lv * lv * 1.35);
  const atkBase = Math.round(8 + lv * 5.8 + (lv > 15 ? (lv - 15) * 3.0 : 0));
  const spdBase = Math.round(10 + lv * 2.2);
  return {
    id: 'escort_bandit',
    name: '劫镖黑风寨匪徒',
    mapId: 'xuchang',
    minLevel: lv,
    silverReward: Math.round(180 + lv * 35),
    expReward: Math.round(220 + lv * 95),
    enemies: [
      { name: '劫镖山贼', level: lv, roleClass: 'wushi', spriteKey: 'n1', hp: Math.round(hpBase * 0.9), mp: 60, atk: atkBase, spd: spdBase },
      { name: '黑风大当家', level: lv + 1, roleClass: 'wushi', spriteKey: 'r1', hp: Math.round(hpBase * 1.28), mp: 100, atk: Math.round(atkBase * 1.12), spd: spdBase + 3 },
      { name: '山寨狗头军师', level: lv, roleClass: 'wenren', spriteKey: 'n2', hp: Math.round(hpBase * 0.78), mp: 160, atk: Math.round(atkBase * 0.92), spd: spdBase + 5 },
    ],
  };
}

export function buildWorldBossEnemyGroup(bossId: string, level: number): EnemyGroupDef {
  const boss = WORLD_BOSS_ROSTER.find((b) => b.id === bossId) ?? WORLD_BOSS_ROSTER[0];
  const lv = Math.max(5, Math.min(60, Math.floor(level)));
  const hpBase = Math.round(55 + lv * 42 + lv * lv * 1.6);
  const atkBase = Math.round(10 + lv * 6.4 + (lv > 15 ? (lv - 15) * 3.4 : 0));
  const spdBase = Math.round(12 + lv * 2.4);
  const enemies: EnemyGroupDef['enemies'] = [
    { name: `${boss.title}·先锋护卫`, level: lv, roleClass: 'wushi', spriteKey: 'n1', hp: Math.round(hpBase * 0.88), mp: 80, atk: Math.round(atkBase * 0.92), spd: spdBase + 2 },
    { name: boss.name, level: lv + 1, roleClass: boss.roleClass, spriteKey: boss.spriteKey, hp: Math.round(hpBase * 1.42), mp: 260, atk: Math.round(atkBase * 1.15), spd: spdBase + 6 },
    { name: `${boss.title}·随军谋士`, level: lv, roleClass: 'wenren', spriteKey: 'n2', hp: Math.round(hpBase * 0.76), mp: 200, atk: Math.round(atkBase * 0.9), spd: spdBase + 8 },
  ];
  if (lv >= 15) {
    enemies.push({
      name: `${boss.title}·道法护法`,
      level: lv,
      roleClass: 'yiren',
      spriteKey: 'n3',
      hp: Math.round(hpBase * 0.84),
      mp: 220,
      atk: Math.round(atkBase * 0.96),
      spd: spdBase + 4,
    });
  }
  return {
    id: `world_boss:${boss.id}`,
    name: `【${boss.title}】${boss.name}`,
    mapId: getCurrentWorldBoss().mapId,
    minLevel: lv,
    silverReward: Math.round(260 + lv * 45),
    expReward: Math.round(320 + lv * 120),
    enemies,
  };
}
