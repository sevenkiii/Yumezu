/**
 * 简体中文文案。
 *
 * 文案的规则依据是 RULES.md §11 / §12；修改规则时请同步这里。
 */

import type { UiText } from './types';

export const zhCN: UiText = {
  locale: 'zh-CN',

  app: {
    title: '夢図',
    subtitle: '随机平面图 · 3v3 · 交替行动',
  },

  action: {
    move: '移动',
    attack: '普通攻击',
    skill: '专属技能',
    card: '功能牌',
    pass: '放弃行动',
    discard: '弃牌',
    confirm: '确认行动',
    cancel: '取消',
    back: '返回',
    undo: '悔棋',
  },

  phase: {
    DEPLOY: '部署阶段',
    BATTLE: '战斗阶段',
    FINISHED: '对局结束',
  },

  player: {
    p1: 'P1',
    p2: 'P2',
    you: '你',
    opponent: '对手',
    currentTurn: '当前行动',
    waiting: '等待对手',
  },

  panel: {
    hand: '手牌',
    yourTeam: '你的角色',
    enemyTeam: '对手角色',
    actionLog: '行动记录',
    detail: '详情',
    selectHint: '点击角色卡或手牌，这里会显示完整信息',
    cardHint: '选中后，地图上会高亮这张牌能作用的目标',
    zoomIn: '放大（也可以用滚轮 / 拖动地图）',
    zoomOut: '缩小',
    zoomReset: '恢复默认视角',
    noActions: '该角色当前没有可用行动',
    onCooldown: '冷却中',
    ready: '可用',
    empty: '（空）',
  },

  stat: {
    attackDamage: '普攻伤害',
    moveRange: '移动范围',
    attackRange: '攻击范围',
    skillCd: '技能冷却',
  },

  deploy: {
    title: '部署',
    hint: '点击自己的出生区域中的节点放置角色（每个节点最多 1 人）',
    submitted: '已提交，等待对手…',
    opponentSubmitted: '对手已确认',
    opponentWaiting: '对手部署中',
    pickCharacter: '选择要放置的角色',
    random: '随机部署',
  },

  newGame: {
    title: '新建对局',
    mapSeed: '地图种子（mapSeed）',
    gameSeed: '对局种子（gameSeed）',
    start: '开始对局',
    randomize: '随机',
    hint: '相同的地图种子必然生成相同的地图与出生点。',
  },

  dev: {
    title: '开发面板',
    showPanel: '开发面板',
    aiStep: '随机走一步',
    viewer: '视角',
    followTurn: '跟随当前行动方',
    stateHash: '状态哈希',
  },

  format: {
    turn: (index) => '回合 ' + index,
    hp: (hp, maxHp) => hp + ' / ' + maxHp,
    cooldown: (value) => (value <= 0 ? '可用' : 'CD ' + value),
    handCount: (count) => count + ' 张',
    damage: (amount) => '-' + amount,
    heal: (amount) => '+' + amount,
    move: (to) => '移动到节点 ' + to,
    attack: (target) => '攻击 ' + target,
    swapped: (a, b) => a + ' 与 ' + b + ' 交换位置',
    win: (player) => player + ' 获胜',
    draw: '平局',
    skill: (name) => '技能：' + name,
    cardPlayed: (name, player) => player + ' 使用了「' + name + '」',
    cardDiscarded: (name, player) => player + ' 弃掉了「' + name + '」',
    cardDrawn: (count, player) => player + ' 抽了 ' + count + ' 张牌',
    moved: (who, to) => who + ' 移动到 ' + to,
    attacked: (who, target, amount) => who + ' 攻击 ' + target + '（' + amount + ' 伤害）',
    healed: (who, amount) => who + ' 回复 ' + amount + ' HP',
    statusAdded: (who, status) => who + ' 获得【' + status + '】',
    statusRemoved: (who, status) => who + ' 失去【' + status + '】',
    died: (who) => who + ' 阵亡',
    edgeBlocked: (edge) => '封锁边 ' + edge,
    edgeUnblocked: (edge) => '封锁解除：' + edge,
    trapPlaced: (vertex) => '在节点 ' + vertex + ' 放置陷阱',
    trapTriggered: (who, vertex) => who + ' 触发陷阱（节点 ' + vertex + '）',
    shadowReturn: (who, success) => (success ? who + ' 返回影标记' : who + ' 回返失败'),
    cooldownModified: (who, value) => who + ' 的技能 CD 变为 ' + value,
    gameEnd: (result) => '对局结束：' + result,
    pass: (player) => player + ' 放弃行动',
    deploy: (player) => player + ' 完成部署',
  },

  character: {
    Nana: {
      name: 'Nana',
      role: '单体爆发',
      skillName: '地球仪',
      skillDescription: '对距离不超过 2 的一名敌方角色造成 4 点伤害。',
    },
    Lily: {
      name: 'Lily',
      role: '位置操纵',
      skillName: '换位',
      skillDescription: '选择距离不超过 3 的一名其他角色（友方或敌方），与其交换位置。',
    },
    Melty: {
      name: 'Melty',
      role: '区域支援 / 区域伤害',
      skillName: 'Melty Land',
      skillDescription:
        '以自身为中心、距离不超过 1 的所有其他角色：友方回复 2 HP，敌方受到 2 点伤害（不含自己）。',
    },
    Mikage: {
      name: 'Mikage',
      role: '预判 / 防守反制',
      skillName: '影返',
      skillDescription:
        '在当前位置留下影标记：直到触发或被重新使用前，第一次受到的伤害减 1，随后立即返回影标记所在节点。',
    },
    Spica: {
      name: 'Spica',
      role: '高机动突袭',
      skillName: '星奔',
      skillDescription:
        '移动至距离不超过 3 的节点，随后对距离 1 以内的所有敌方角色各造成 1 点伤害。',
    },
    Urara: {
      name: 'Urara',
      role: '区域控制',
      skillName: '冻结',
      skillDescription:
        '以自身为中心、距离不超过 1 的所有敌方角色获得【冻结】：下一次行动不能移动。',
    },
  },

  skillName: {
    Globe: '地球仪',
    Swap: '换位',
    MeltyLand: 'Melty Land',
    ShadowReturn: '影返',
    StarDash: '星奔',
    Freeze: '冻结',
  },

  card: {
    FirstAid: { name: '急救', description: '选择一名己方角色，回复 3 点 HP。' },
    Shield: {
      name: '护盾',
      description: '选择一名己方角色，使其获得【护盾】：下一次受到的伤害减 2。',
    },
    Assault: {
      name: '强袭',
      description: '选择一名己方角色，使其获得【强袭】：下一次普通攻击伤害 +1。',
    },
    Recharge: {
      name: '充能',
      description: '选择一名己方角色，使其一个正在冷却的技能剩余 CD 减少 1。',
    },
    Purify: { name: '净化', description: '选择一名己方角色，移除其一个负面状态。' },
    Blink: {
      name: '瞬步',
      description: '选择一名己方角色，将其移动至距离不超过 3 的节点。',
    },
    Repulse: {
      name: '排斥',
      description: '选择一名敌方角色，将其移动到相邻的一个合法节点。',
    },
    BlockRoad: {
      name: '封路',
      description: '选择地图上的一条边，封锁它（对手 2 次行动 + 自己 1 次行动）。',
    },
    Mark: {
      name: '标记',
      description: '选择一名敌方角色，使其获得【标记】：下一次受到的伤害 +1。',
    },
    SealSkill: {
      name: '封技',
      description: '选择一名敌方角色，使其获得【封技】：下一次行动不能使用专属技能。',
    },
    Trap: {
      name: '陷阱',
      description: '在一个未被占据的节点放置陷阱：第一个进入该节点的敌方角色受到 2 点伤害。',
    },
  },

  cardCategory: {
    ATTACK: '进攻',
    DEFENSE: '防御',
    MOVEMENT: '位移',
    CONTROL: '控制',
    MAP: '地图',
    TEMPO: '节奏',
  },

  prompt: {
    IDLE: '选择一名角色，或使用一张功能牌',
    SELECT_CHARACTER: '选择一名己方角色',
    SELECT_DESTINATION: '在地图上选择落点',
    SELECT_TARGET: '选择目标',
    SELECT_NODE: '选择地图上的一个节点',
    SELECT_EDGE: '选择地图上的一条边',
    SELECT_STATUS: '选择要移除的状态',
    SELECT_TARGET_OR_DESTINATION: '点高亮节点移动、点敌人普攻；技能点角色卡上的圆钮',
    READY_TO_EXECUTE: '已选定目标',
    READY_TO_CONFIRM: '已选定',
    DEPLOY_SELECT_CHARACTER: '选择要放置的角色',
    DEPLOY_SELECT_NODE: '点击自己的出生区域放置',
    DEPLOY_READY: '全部放置完成，点击「确认行动」',
  },

  status: {
    Frozen: { name: '冻结', short: '冻', description: '下一次行动不能移动' },
    SkillSealed: { name: '封技', short: '封', description: '下一次行动不能使用专属技能' },
    Marked: { name: '标记', short: '标', description: '下一次受到的伤害 +1' },
    Shielded: { name: '护盾', short: '盾', description: '下一次受到的伤害 -2' },
    Empowered: { name: '强袭', short: '强', description: '下一次普通攻击伤害 +1' },
  },
};
