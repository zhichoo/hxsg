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
    desc: '在许昌招贤馆招募三国副将的凭证。',
    type: 'material',
    priceSilver: 500,
  },
  baotu: {
    itemId: 'baotu',
    name: '藏宝图',
    desc: '古旧羊皮图卷，在行囊点击「挖宝」可寻得神兵、名马或银两。',
    type: 'material',
    priceSilver: 260,
  },
};

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
  baseHp: number;
  baseMp: number;
  baseAtk: number;
  baseSpd: number;
  growth: number;
  recruitCostSilver: number;
  desc: string;
}

export const GENERAL_TEMPLATES: Record<string, GeneralTemplate> = {
  dipi: {
    templateId: 'dipi',
    name: '街头地痞',
    roleClass: 'wushi',
    spriteKey: 'n1',
    avatarKey: 'f000.png',
    baseHp: 110,
    baseMp: 30,
    baseAtk: 22,
    baseSpd: 16,
    growth: 1.02,
    recruitCostSilver: 300,
    desc: '许昌郊外常见流氓，前期好抓好养。',
  },
  guanping: {
    templateId: 'guanping',
    name: '关平',
    roleClass: 'wushi',
    spriteKey: 'r1',
    avatarKey: 'ws2.png',
    baseHp: 175,
    baseMp: 50,
    baseAtk: 34,
    baseSpd: 22,
    growth: 1.18,
    recruitCostSilver: 1200,
    desc: '关羽义子，刀法稳健，前期极佳物理副将。',
  },
  huangyueying: {
    templateId: 'huangyueying',
    name: '黄月英',
    roleClass: 'wenren',
    spriteKey: 'r2n',
    avatarKey: 'wr2.png',
    baseHp: 135,
    baseMp: 130,
    baseAtk: 26,
    baseSpd: 29,
    growth: 1.22,
    recruitCostSilver: 1800,
    desc: '奇谋才女，高速法伤与辅助兼备。',
  },
  yuji: {
    templateId: 'yuji',
    name: '于吉',
    roleClass: 'yiren',
    spriteKey: 'r3',
    avatarKey: 'yr2.png',
    baseHp: 145,
    baseMp: 145,
    baseAtk: 30,
    baseSpd: 26,
    growth: 1.25,
    recruitCostSilver: 2200,
    desc: '太平道仙师，雷法爆发惊人。',
  },
  zhaoyun: {
    templateId: 'zhaoyun',
    name: '赵云',
    roleClass: 'wushi',
    spriteKey: 'r1',
    avatarKey: 'ws3.png',
    baseHp: 210,
    baseMp: 75,
    baseAtk: 42,
    baseSpd: 31,
    growth: 1.32,
    recruitCostSilver: 5000,
    desc: '常山赵子龙，七进七出，顶级神将。',
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
};

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
      { id: 'tavern', name: '招贤馆', desc: '招募关平、黄月英、于吉、赵云', icon: 'ss_m_3.png', kind: 'tavern' },
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
    desc: '黄巾军曾在此扎营，至今仍有道士残部游荡。',
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
        dialogue: '城外西凉铁骑虎视眈眈，少侠若已过 10 级，可出城历练！',
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
    desc: '黄沙漫天，西凉铁骑精锐在此巡弋。',
    isSafe: false,
    recommendedLevel: 'Lv.10 ~ 18',
    neighbors: ['luoyang', 'changshe'],
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
  zhuojun: {
    id: 'zhuojun',
    name: '涿郡',
    region: '幽州桃园',
    thumb: 'site_m6.png',
    battleBg: 'f_bg4',
    desc: '桃园结义发源地，民风淳朴，适合新手歇脚叙旧。',
    isSafe: true,
    recommendedLevel: '安全区',
    neighbors: ['xuchang'],
    npcs: [
      {
        id: 'npc_taoyuan',
        name: '桃园老丈',
        action: 'talk',
        dialogue: '当年刘关张在此结拜，今日各位豪杰齐聚于此，何不把酒言欢！',
      },
    ],
    facilities: [
      { id: 'inn', name: '桃园酒肆', desc: '歇脚打尖，免费满血满蓝', icon: 'ss_m_4.png', kind: 'inn' },
    ],
  },
};
