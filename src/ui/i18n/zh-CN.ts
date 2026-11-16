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
    subtitle: '随机平面图 · 2–4 人混战 · 轮流行动',
  },

  action: {
    move: '移动',
    attack: '普通攻击',
    skill: '专属技能',
    card: '功能牌',
    pass: '结束回合',
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
    p3: 'P3',
    p4: 'P4',
    you: '你',
    opponent: '对手',
    currentTurn: '当前行动',
    waiting: '等待对手',
  },

  panel: {
    hand: '手牌',
    yourTeam: '你的角色',
    enemyTeam: '其他角色',
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
    replaying: '回放中',
  },

  stat: {
    attackDamage: '普攻伤害',
    moveRange: '移动范围',
    attackRange: '攻击范围',
    skillCd: '技能冷却',
  },

  result: {
    victory: '胜利',
    defeat: '败北',
    dismiss: '点击任意处查看棋盘',
  },

  online: {
    title: '联机对局',
    roomLabel: '房间号',
    roomPlaceholder: '和朋友约定一个房间号',
    create: '创建房间',
    createHint: '选择人数后直接创建，再把邀请链接发给朋友。',
    join: '加入房间',
    joinHint: '输入房主分享的房间号；人数需要和房主一致。',
    or: '或',
    hint: '同一房间要选择相同人数；把邀请链接发给其他人最省事。',
    connecting: '正在连接服务器…',
    waiting: '等待其他玩家加入…',
    closed: '连接失败：联机服务不可用，请重启 npm run dev 后重试',
    roomFull: '这个房间已经满了',
    back: '返回',
    invite: '邀请链接',
    copyLink: '复制邀请链接',
    copied: '已复制',
    onlinePlayers: (online, total) => '在线 ' + online + ' / ' + total,
    roomPlayers: (joined, total) => '已加入 ' + joined + ' / ' + total,
    you: '你',
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
    playerCount: '参战人数',
    playerCountOption: (count) => count + ' 人',
  },

  dev: {
    title: '开发面板',
    showPanel: '开发面板',
    aiStep: '随机走一步',
    viewer: '视角',
    followTurn: '跟随当前行动方',
    stateHash: '状态哈希',
    replay: {
      title: '对局记录 / 回放',
      hint: '复制这段记录发给协作者，对方能精确重放这一局；也可以把别人给的记录粘进来载入。',
      readonlyHint:
        '联机对局只提供记录复制：下面是完整记录，粘到单人模式的「载入回放」即可复盘。剪贴板不可用时也可直接在框里全选复制。',
      pendingHint:
        '联机进行中不提供完整记录（会泄露对手手牌）。对局结束后，这里会出现完整记录与复制按钮。',
      placeholder: '把记录粘在这里，然后点「载入回放」',
      copy: '复制记录',
      copied: '已复制到剪贴板',
      copyFailed: '复制失败，记录已放进下面的框里，手动复制一下',
      load: '载入回放',
      loadFailed: '这段记录读不出来',
      stop: '结束回放',
      prev: '上一步',
      next: '下一步',
      play: '播放',
      pause: '暂停',
      progress: (step, total) => '第 ' + step + ' / ' + total + ' 步',
    },
  },

  format: {
    turn: (index) => '回合 ' + index,
    currentPlayer: (player) => player + ' 行动中',
    yourTurn: (player) => player + ' · 轮到你行动',
    remainingSlot: (characterUsed, cardUsed) => {
      if (characterUsed && !cardUsed) return '本回合还可：功能牌操作';
      if (cardUsed && !characterUsed) return '本回合还可：角色操作';
      return '';
    },
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
    pass: (player) => player + ' 结束回合',
    deploy: (player) => player + ' 完成部署',
    actedMove: (who) => who + ' 移动（留在原地）',
    actedAttack: (who) => who + ' 发起攻击，但没有造成伤害',
    usedSkill: (who, name) => who + ' 使用技能「' + name + '」',
  },

  character: {
    Nana: {
      name: 'Nana',
      role: '单体爆发',
      skillName: '地球仪',
      skillDescription: '对距离不超过 1 的一名敌方角色造成 4 点伤害。',
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
        '在当前位置留下影标记：直到触发或被重新使用前，第一次受到的伤害减 2，随后立即返回影标记所在节点。',
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
        '以自身为中心、距离不超过 2 的所有敌方角色获得【冻结】：一个回合内不能移动。',
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
      description: '选择地图上的一条边，封锁它（持续 2 个回合）。',
    },
    Mark: {
      name: '标记',
      description: '选择一名敌方角色，使其获得【标记】：下一次受到的伤害 +1。',
    },
    SealSkill: {
      name: '封技',
      description: '选择一名敌方角色，使其获得【封技】：一个回合内不能使用专属技能。',
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

  manual: {
    open: '说明书',
    title: '夢図 · 说明书',
    close: '关闭说明书',
    tabs: {
      rules: '玩法',
      characters: '角色',
      cards: '功能牌',
    },
    sections: [
      {
        title: '目标与胜负',
        lines: [
          '2 ~ 4 人混战，每人控制 3 名角色；人人互为敌人，没有队伍与结盟。',
          '把其他玩家的角色全部击倒即获胜；所有人同时全灭则平局。',
          '地图是随机生成的平面图，出生区域按人数分散、互不相交；开局由核心随机部署，直接进入战斗。',
        ],
      },
      {
        title: '一个回合能做什么',
        lines: [
          '按座位顺序轮流。轮到你时有两个独立的操作槽位：角色操作与功能牌操作，各最多一次，顺序不限。',
          '角色操作：选一名己方角色，移动、普通攻击、或使用专属技能（三选一）。',
          '功能牌操作：打出一张手牌，或弃掉一张手牌（二选一）。',
          '两个槽位都用完，回合自动结束；也可以随时点顶栏的「结束回合」放弃剩余操作。',
          '回合开始时你的技能冷却 −1，手牌不足 5 张时补 1 张；这两件事每回合只发生一次。',
        ],
      },
      {
        title: '怎么操作',
        lines: [
          '点击角色卡或地图上的角色选中，地图会高亮可达节点与可攻击的敌人。',
          '点一下高亮节点就移动，点一下高亮的敌人就普攻：单击即执行，出手前想清楚。',
          '技能是选中角色后浮在卡牌上方的圆钮，外圈是冷却环；无目标的技能点一次即施放。',
          '功能牌同样：选牌 → 看高亮的合法目标 → 点一下执行。',
          '再点一次已选中的卡、按 Esc、或点地图空白处可以取消选中；本地对局可用「悔棋」回退一步。',
          '滚轮或地图右上角的按钮可以缩放，拖动地图可以平移；选中角色或卡牌时镜头会自动聚焦到作用范围。',
        ],
      },
      {
        title: '距离与移动',
        lines: [
          '攻击和技能用「图距离」（沿边最少跳数），不受封路影响；移动另算「移动距离」，会受封路限制。',
          '移动不能穿过敌方角色、可以穿过友方；不能停在已被占据的节点。',
          '封路只挡移动通行，不阻止攻击、技能与换位，持续 2 个回合。',
        ],
      },
      {
        title: '伤害与状态',
        lines: [
          '所有伤害统一结算：强袭 +1（仅普攻）→ 标记 +1 → 护盾 −2 → 影返 −2 → 最后才钳位到不低于 0。',
          '【冻结】【封技】持续到目标自己下一个回合结束，期间分别禁止移动 / 专属技能；【标记】【护盾】【强袭】保留到触发一次为止。',
          '同名状态不能重复施加；「净化」可以移除负面状态。角色阵亡时清除其全部状态。',
        ],
      },
      {
        title: '手牌与隐藏信息',
        lines: [
          '打出的牌直接消失；弃牌要消耗本回合的功能牌操作，且不补抽。',
          '只有你能看到自己的手牌内容，其他人只显示数量；联机时服务器只把合法操作发给当前行动方。',
          '对局记录可以复制分享，粘贴到开发面板里能逐步回放整局。',
        ],
      },
    ],
    statusTitle: '常见状态',
    skillLabel: '专属技能',
    hpLabel: 'HP',
    poolHint:
      '牌池共 11 张，每次从整个牌池独立等概率抽取（可重复持有）；开局 3 张，上限 5 张，回合开始补 1 张。',
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
    Frozen: { name: '冻结', short: '冻', description: '一个回合内不能移动' },
    SkillSealed: { name: '封技', short: '封', description: '一个回合内不能使用专属技能' },
    Marked: { name: '标记', short: '标', description: '下一次受到的伤害 +1' },
    Shielded: { name: '护盾', short: '盾', description: '下一次受到的伤害 -2' },
    Empowered: { name: '强袭', short: '强', description: '下一次普通攻击伤害 +1' },
  },
};
