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
    name: '南阳关(新)',
    tag: '双倍经验',
    desc: '经典二区 · 适合新朋友快速起号',
    bgImg: 'f_bg5_5.png',
    onlineBase: 0,
  },
  {
    id: 'gongan',
    name: '公安',
    desc: '荆州重镇 · 怀旧经典互通',
    bgImg: 'f_bg6_5.png',
    onlineBase: 0,
  },
  {
    id: 'pingyang',
    name: '平阳',
    desc: '河东故地 · 怀旧老区',
    bgImg: 'f_bg7_5.png',
    onlineBase: 0,
  },
  {
    id: 'wushengguan',
    name: '武胜关',
    desc: '中原雄关 · 怀旧老区',
    bgImg: 'f_bg8_5.png',
    onlineBase: 0,
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
    power: 1.12,
    aoe: true,
    effect: 'fg',
    desc: '横扫敌阵，随熟练度提升最多打击 5 个目标。',
  },

  // 文人技能（经典控场三绝：乱 / 封 / 围 + 呼风唤雨）
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
    baseControlRate: 0.68,
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
    baseControlRate: 0.72,
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
    baseControlRate: 0.75,
    effect: 'trap',
    desc: '【围】困住敌军 2 回合，无法普攻且所受伤害提高 25%。',
  },
  {
    id: 'hfhy',
    name: '呼风唤雨',
    roleClass: 'wenren',
    kind: 'damage',
    damageType: 'magic',
    mpCost: 26,
    power: 1.25,
    aoe: true,
    effect: 'fire',
    desc: '借风火之势席卷敌军，随熟练度提升目标数与法伤。',
  },

  // 异人技能（经典爆发雷法 + 妙手回春）
  {
    id: 'wlhd',
    name: '五雷轰顶',
    roleClass: 'yiren',
    kind: 'damage',
    damageType: 'magic',
    mpCost: 24,
    power: 1.78,
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
    mpCost: 32,
    power: 1.22,
    aoe: true,
    effect: 'lei',
    desc: '漫天雷劫降临，随熟练度提升最多劈击 5 个敌方目标。',
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
  priceSilver: number;
}

export const ITEMS: Record<string, ItemTemplate> = {
  jinchuang: {
    itemId: 'jinchuang',
    name: '金创药',
    desc: '恢复气血 120 点，战斗内外均可使用。',
    type: 'consumable',
    hpRestore: 120,
    priceSilver: 40,
  },
  dahuan: {
    itemId: 'dahuan',
    name: '大还丹',
    desc: '名医秘制丹药，恢复气血 360 点。',
    type: 'consumable',
    hpRestore: 360,
    priceSilver: 140,
  },
  ningshen: {
    itemId: 'ningshen',
    name: '凝神散',
    desc: '恢复精力 90 点，文人异人练级必备。',
    type: 'consumable',
    mpRestore: 90,
    priceSilver: 50,
  },
  jiangling: {
    itemId: 'jiangling',
    name: '招贤令',
    desc: '在招贤馆消耗 1 枚寻访名将，有机会直接抽到关羽、赵云、貂蝉、吕布！',
    type: 'material',
    priceSilver: 500,
  },
  jingyandan: {
    itemId: 'jingyandan',
    name: '副将经验丹',
    desc: '在副将营帐喂给副将，立即增加 360 点经验。',
    type: 'material',
    priceSilver: 180,
  },
  xisuidan: {
    itemId: 'xisuidan',
    name: '洗髓丹',
    desc: '在副将营帐重洗副将的成长率与初值，有机会洗出极品/神品！',
    type: 'material',
    priceSilver: 420,
  },
  baotu: {
    itemId: 'baotu',
    name: '藏宝图',
    desc: '古旧羊皮图卷，在行囊点击「挖宝」可寻得神兵、名马或银两。',
    type: 'material',
    priceSilver: 260,
  },
  book_lianji: {
    itemId: 'book_lianji',
    name: '《连环突刺》秘籍',
    desc: '副将技能书：在副将营帐给副将打书，习得武士连击【连环突刺】。',
    type: 'material',
    priceSilver: 900,
  },
  book_psdh: {
    itemId: 'book_psdh',
    name: '《排山倒海》秘籍',
    desc: '副将技能书：在副将营帐给副将打书，习得群攻绝技【排山倒海】。',
    type: 'material',
    priceSilver: 1200,
  },
  book_hunluan: {
    itemId: 'book_hunluan',
    name: '《离间计》兵书',
    desc: '副将技能书：在副将营帐给副将打书，习得群体混乱【离间计】。',
    type: 'material',
    priceSilver: 1100,
  },
  book_fengyin: {
    itemId: 'book_fengyin',
    name: '《定身计》兵书',
    desc: '副将技能书：在副将营帐给副将打书，习得强控封印【定身计】。',
    type: 'material',
    priceSilver: 1100,
  },
  book_wlhd: {
    itemId: 'book_wlhd',
    name: '《五雷轰顶》道书',
    desc: '副将技能书：在副将营帐给副将打书，习得爆发雷法【五雷轰顶】。',
    type: 'material',
    priceSilver: 1100,
  },
  book_huigong: {
    itemId: 'book_huigong',
    name: '《妙手回春》医书',
    desc: '副将技能书：副将在战斗中见主将或友军残血时自动施展【妙手回春】疗伤！',
    type: 'material',
    priceSilver: 1000,
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

  // 战马（使用官方原版 h_1 ~ h_6 战马素材！）
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
    desc: '人中吕布，马中赤兔！仅靠藏宝图挖宝或西凉铁骑掉落获取。',
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
    avatarKey: 'f000.png',
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
    avatarKey: 'ws4.png',
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
    avatarKey: 'wr2.png',
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
    avatarKey: 'ws5.png',
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
    avatarKey: 'ws3.png',
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
    avatarKey: 'ws6.png',
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
    silverReward: 140,
    expReward: 130,
    capturableTemplateId: 'yuji',
    enemies: [
      { name: '黄巾力士', level: 6, roleClass: 'wushi', spriteKey: 'n1', hp: 165, mp: 40, atk: 32, spd: 20 },
      { name: '太平道士', level: 7, roleClass: 'yiren', spriteKey: 'n3', hp: 140, mp: 100, atk: 36, spd: 24 },
      { name: '黄巾妖术师', level: 7, roleClass: 'wenren', spriteKey: 'n2', hp: 135, mp: 100, atk: 34, spd: 25 },
    ],
  },
  luoyang_weidui: {
    id: 'luoyang_weidui',
    name: '西凉铁骑',
    mapId: 'luoyang_wai',
    minLevel: 10,
    silverReward: 320,
    expReward: 290,
    capturableTemplateId: 'guanping',
    enemies: [
      { name: '西凉先锋', level: 12, roleClass: 'wushi', spriteKey: 'n1', hp: 310, mp: 60, atk: 58, spd: 28 },
      { name: '西凉弓手', level: 12, roleClass: 'wenren', spriteKey: 'n2n', hp: 250, mp: 90, atk: 52, spd: 32 },
      { name: '西凉校尉', level: 14, roleClass: 'wushi', spriteKey: 'n1', hp: 380, mp: 80, atk: 68, spd: 30 },
      { name: '军中术士', level: 13, roleClass: 'yiren', spriteKey: 'n3', hp: 260, mp: 120, atk: 60, spd: 29 },
    ],
  },
  boss_zhangjiao: {
    id: 'boss_zhangjiao',
    name: '张角三兄弟',
    mapId: 'changshe',
    minLevel: 7,
    silverReward: 420,
    expReward: 380,
    capturableTemplateId: 'yuji',
    enemies: [
      { name: '人公将·张梁', level: 8, roleClass: 'wushi', spriteKey: 'n1', hp: 240, mp: 50, atk: 44, spd: 23 },
      { name: '地公将·张宝', level: 8, roleClass: 'wenren', spriteKey: 'n2', hp: 210, mp: 120, atk: 42, spd: 26 },
      { name: '天公将·张角', level: 9, roleClass: 'yiren', spriteKey: 'n3', hp: 310, mp: 180, atk: 52, spd: 28 },
    ],
  },
  hulao_xiliang: {
    id: 'hulao_xiliang',
    name: '虎牢关守军',
    mapId: 'hulaoguan',
    minLevel: 12,
    silverReward: 420,
    expReward: 380,
    capturableTemplateId: 'guanping',
    enemies: [
      { name: '飞熊铁卫', level: 13, roleClass: 'wushi', spriteKey: 'n1', hp: 380, mp: 60, atk: 68, spd: 31 },
      { name: '虎牢弩手', level: 13, roleClass: 'wenren', spriteKey: 'n2', hp: 310, mp: 100, atk: 62, spd: 34 },
      { name: '西凉督军', level: 14, roleClass: 'wushi', spriteKey: 'n1', hp: 440, mp: 80, atk: 76, spd: 33 },
    ],
  },
  boss_huaxiong: {
    id: 'boss_huaxiong',
    name: '西凉骁将·华雄',
    mapId: 'hulaoguan',
    minLevel: 13,
    silverReward: 680,
    expReward: 620,
    capturableTemplateId: 'guanyu',
    enemies: [
      { name: '西凉刀斧手', level: 13, roleClass: 'wushi', spriteKey: 'n1', hp: 350, mp: 50, atk: 66, spd: 30 },
      { name: '骁将·华雄', level: 15, roleClass: 'wushi', spriteKey: 'r1', hp: 620, mp: 90, atk: 92, spd: 36 },
      { name: '胡轸部曲', level: 14, roleClass: 'yiren', spriteKey: 'n3', hp: 330, mp: 120, atk: 70, spd: 33 },
    ],
  },
  guandu_yuanjun: {
    id: 'guandu_yuanjun',
    name: '袁军先登死士',
    mapId: 'guandu',
    minLevel: 15,
    silverReward: 560,
    expReward: 510,
    capturableTemplateId: 'huangyueying',
    enemies: [
      { name: '先登死士', level: 16, roleClass: 'wushi', spriteKey: 'n1', hp: 490, mp: 70, atk: 84, spd: 35 },
      { name: '河北谋士', level: 16, roleClass: 'wenren', spriteKey: 'n2', hp: 390, mp: 140, atk: 78, spd: 39 },
      { name: '大戟士', level: 17, roleClass: 'wushi', spriteKey: 'n1', hp: 560, mp: 80, atk: 92, spd: 36 },
    ],
  },
  boss_yanliang: {
    id: 'boss_yanliang',
    name: '河北双雄·颜良文丑',
    mapId: 'guandu',
    minLevel: 16,
    silverReward: 950,
    expReward: 860,
    capturableTemplateId: 'zhaoyun',
    enemies: [
      { name: '河北名将·颜良', level: 17, roleClass: 'wushi', spriteKey: 'r1', hp: 720, mp: 100, atk: 106, spd: 40 },
      { name: '河北名将·文丑', level: 17, roleClass: 'wushi', spriteKey: 'r1', hp: 700, mp: 100, atk: 104, spd: 42 },
      { name: '沮授军师', level: 17, roleClass: 'wenren', spriteKey: 'n2', hp: 460, mp: 180, atk: 86, spd: 44 },
    ],
  },
  chibi_shuijun: {
    id: 'chibi_shuijun',
    name: '曹军水师楼船',
    mapId: 'chibi',
    minLevel: 18,
    silverReward: 740,
    expReward: 680,
    capturableTemplateId: 'diaochan',
    enemies: [
      { name: '青州水兵', level: 19, roleClass: 'wushi', spriteKey: 'n1', hp: 620, mp: 80, atk: 102, spd: 41 },
      { name: '铁索弓手', level: 19, roleClass: 'wenren', spriteKey: 'n2n', hp: 510, mp: 140, atk: 95, spd: 45 },
      { name: '楼船校尉', level: 20, roleClass: 'wushi', spriteKey: 'n1', hp: 720, mp: 90, atk: 112, spd: 42 },
      { name: '随军方士', level: 19, roleClass: 'yiren', spriteKey: 'n3', hp: 520, mp: 180, atk: 104, spd: 44 },
    ],
  },
  boss_caojun: {
    id: 'boss_caojun',
    name: '赤壁先锋大营',
    mapId: 'chibi',
    minLevel: 19,
    silverReward: 1450,
    expReward: 1320,
    capturableTemplateId: 'guanyu',
    enemies: [
      { name: '水军都督·蔡瑁', level: 20, roleClass: 'wushi', spriteKey: 'r1', hp: 880, mp: 120, atk: 122, spd: 45 },
      { name: '水军副督·张允', level: 20, roleClass: 'wushi', spriteKey: 'n1', hp: 820, mp: 100, atk: 118, spd: 44 },
      { name: '虎豹骑统领', level: 21, roleClass: 'wushi', spriteKey: 'r1', hp: 960, mp: 120, atk: 132, spd: 48 },
      { name: '曹营祭酒', level: 20, roleClass: 'yiren', spriteKey: 'n3', hp: 640, mp: 220, atk: 116, spd: 49 },
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

export const TOWER_MAX_FLOOR = 20;

export function getTowerFloorMeta(floor: number): {
  floor: number;
  name: string;
  recLevel: number;
  isBoss: boolean;
  milestone?: string;
} {
  const f = Math.max(1, Math.min(TOWER_MAX_FLOOR, Math.floor(floor)));
  const recLevel = Math.max(2, f + 1);
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
    return { floor: f, name: '第20层 · 无双战神吕布', recLevel, isBoss: true, milestone: '登顶赠 金砖+200、绝世神兵/赤兔宝马×1' };
  }
  return { floor: f, name: `天玄塔第 ${f} 层守卫`, recLevel, isBoss: false };
}

export function buildTowerEnemyGroup(floor: number): EnemyGroupDef {
  const f = Math.max(1, Math.min(TOWER_MAX_FLOOR, Math.floor(floor)));
  const meta = getTowerFloorMeta(f);
  const lv = Math.max(2, f + 1);
  const hpBase = Math.round(55 + f * 36 + f * f * 1.4);
  const atkBase = Math.round(12 + f * 5.2);
  const spdBase = Math.round(13 + f * 1.9);

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
      { name: '无双战神·吕布', level: lv + 2, roleClass: 'wushi', spriteKey: 'r1', hp: Math.round(hpBase * 1.7), mp: 150, atk: Math.round(atkBase * 1.35), spd: spdBase + 8 },
      { name: '闭月·貂蝉幻影', level: lv + 1, roleClass: 'wenren', spriteKey: 'r2n', hp: Math.round(hpBase * 0.95), mp: 200, atk: atkBase, spd: spdBase + 10 },
      { name: '陈宫军师', level: lv, roleClass: 'yiren', spriteKey: 'n3', hp: Math.round(hpBase * 1.0), mp: 200, atk: Math.round(atkBase * 1.15), spd: spdBase + 5 },
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
      mp: classes[idx] === 'wushi' ? 50 : 120,
      atk: Math.round(atkBase * (idx === 0 ? 1.05 : 0.96)),
      spd: spdBase + idx,
    }));
  }

  return {
    id: `tower_${f}`,
    name: meta.name,
    mapId: 'xuchang',
    minLevel: meta.recLevel,
    silverReward: Math.round(90 + f * 65),
    expReward: Math.round(80 + f * 72),
    enemies,
  };
}

export const MAIN_QUESTS: MainQuestDef[] = [
  {
    questId: 'main_01',
    chapter: 1,
    title: '初入许昌',
    recLevel: 1,
    npcName: '许昌主线使者',
    dialogue: '乱世烽烟初起，许昌郊外地痞流氓拦路劫掠。少侠不妨前去清剿 2 批【地痞群】，立下出山第一功！',
    objectiveKind: 'kill',
    targetId: 'xuchang_dipi',
    targetName: '地痞群',
    targetMapId: 'xuchang_jiao',
    requiredCount: 2,
    rewards: {
      exp: 140,
      silver: 350,
      item: { itemId: 'jinchuang', quantity: 3 },
    },
  },
  {
    questId: 'main_02',
    chapter: 2,
    title: '桃园访贤',
    recLevel: 2,
    npcName: '桃园老丈',
    dialogue: '独木难支大厦！请少侠动身前往【涿郡】寻访桃园旧事，老丈愿引荐一员忠勇猛将相助左右。',
    objectiveKind: 'visit_map',
    targetId: 'zhuojun',
    targetName: '前往涿郡',
    targetMapId: 'zhuojun',
    requiredCount: 1,
    rewards: {
      exp: 220,
      silver: 500,
      generalTemplateId: 'zhoucang',
    },
  },
  {
    questId: 'main_03',
    chapter: 3,
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
    chapter: 4,
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
    chapter: 5,
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
    chapter: 6,
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
      silver: 3800,
      gold: 50,
      item: { itemId: 'xisuidan', quantity: 2 },
    },
  },
  {
    questId: 'main_07',
    chapter: 7,
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
      silver: 6000,
      equipTemplateId: 'qixing_jian',
      item: { itemId: 'jiangling', quantity: 1 },
    },
  },
  {
    questId: 'main_08',
    chapter: 8,
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
      silver: 10000,
      gold: 100,
      equipTemplateId: 'dilu_ma',
      item: { itemId: 'baotu', quantity: 3 },
    },
  },
];

export const MAPS: Record<string, MapNode> = {
  xuchang: {
    id: 'xuchang',
    name: '许昌',
    region: '中原腹地',
    thumb: 'site_m1.png',
    battleBg: 'f_bg2',
    desc: '魏都许昌，商贾云集，英雄豪杰汇集之地。',
    isSafe: true,
    recommendedLevel: '安全区',
    neighbors: ['xuchang_jiao', 'luoyang', 'zhuojun'],
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
      { id: 'tower', name: '天玄塔', desc: '20层单人爬塔试炼与每日扫荡', icon: 'ss_m_8.png', kind: 'tower' },
      { id: 'casino', name: '许昌赌坊', desc: '经典猜大小/豹子 与 赤壁押注', icon: 'ss_m_9.png', kind: 'casino' },
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
    recommendedLevel: 'Lv.1 ~ 5',
    neighbors: ['xuchang', 'changshe'],
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
    neighbors: ['guandu', 'xuchang'],
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
