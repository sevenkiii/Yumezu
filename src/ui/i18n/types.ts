/**
 * i18n 的类型定义：所有面向玩家的文案都通过这些结构访问。
 *
 * 引擎（src/core、src/characters、src/cards …）只保留 id，不携带任何玩家可见文本；
 * 文案的唯一来源是 src/ui/i18n/<locale>.ts，规则依据仍是 RULES.md。
 */

import type { CardId, CharacterTypeId, GamePhase, SkillId, StatusType } from '../../core/GameState';
import type { PromptCode } from '../interaction';
import type { CardCategory } from '../../cards/Card';

export type Locale = 'zh-CN';

export interface CharacterText {
  readonly name: string;
  /** 战斗定位，例如"单体爆发"。 */
  readonly role: string;
  readonly skillName: string;
  readonly skillDescription: string;
}

export interface CardText {
  readonly name: string;
  readonly description: string;
}

export interface StatusText {
  readonly name: string;
  /** 棋盘上的极短标签（1 ~ 2 字）。 */
  readonly short: string;
  readonly description: string;
}

export interface UiText {
  readonly locale: Locale;
  readonly app: {
    readonly title: string;
    readonly subtitle: string;
  };
  readonly action: {
    readonly move: string;
    readonly attack: string;
    readonly skill: string;
    readonly card: string;
    readonly pass: string;
    readonly discard: string;
    readonly confirm: string;
    readonly cancel: string;
    readonly back: string;
    readonly undo: string;
  };
  readonly phase: Record<GamePhase, string>;
  readonly player: {
    readonly p1: string;
    readonly p2: string;
    readonly you: string;
    readonly opponent: string;
    readonly currentTurn: string;
    readonly waiting: string;
  };
  readonly panel: {
    readonly hand: string;
    readonly yourTeam: string;
    readonly enemyTeam: string;
    readonly actionLog: string;
    readonly detail: string;
    readonly selectHint: string;
    readonly cardHint: string;
    readonly zoomIn: string;
    readonly zoomOut: string;
    readonly zoomReset: string;
    readonly noActions: string;
    readonly onCooldown: string;
    readonly ready: string;
    readonly empty: string;
    readonly replaying: string;
  };
  /** 结算幕布。 */
  readonly result: {
    readonly victory: string;
    readonly defeat: string;
    readonly dismiss: string;
  };
  /** 联机对局（房间、等待、连接状态）。 */
  readonly online: {
    readonly title: string;
    readonly roomLabel: string;
    readonly roomPlaceholder: string;
    readonly join: string;
    readonly hint: string;
    readonly connecting: string;
    readonly waiting: string;
    readonly closed: string;
    readonly roomFull: string;
    readonly back: string;
    readonly invite: string;
    readonly copyLink: string;
    readonly copied: string;
    readonly opponentOnline: string;
    readonly opponentOffline: string;
    readonly you: string;
  };
  readonly stat: {
    readonly attackDamage: string;
    readonly moveRange: string;
    readonly attackRange: string;
    readonly skillCd: string;
  };
  readonly deploy: {
    readonly title: string;
    readonly hint: string;
    readonly submitted: string;
    readonly opponentSubmitted: string;
    readonly opponentWaiting: string;
    readonly pickCharacter: string;
    readonly random: string;
  };
  readonly newGame: {
    readonly title: string;
    readonly mapSeed: string;
    readonly gameSeed: string;
    readonly start: string;
    readonly randomize: string;
    readonly hint: string;
  };
  readonly dev: {
    readonly title: string;
    readonly showPanel: string;
    readonly aiStep: string;
    readonly viewer: string;
    readonly followTurn: string;
    readonly stateHash: string;
    readonly replay: {
      readonly title: string;
      readonly hint: string;
      readonly placeholder: string;
      readonly copy: string;
      readonly copied: string;
      readonly copyFailed: string;
      readonly load: string;
      readonly loadFailed: string;
      readonly stop: string;
      readonly prev: string;
      readonly next: string;
      readonly play: string;
      readonly pause: string;
      readonly progress: (step: number, total: number) => string;
    };
  };
  readonly format: {
    readonly turn: (index: number) => string;
    readonly hp: (hp: number, maxHp: number) => string;
    readonly cooldown: (value: number) => string;
    readonly handCount: (count: number) => string;
    readonly damage: (amount: number) => string;
    readonly heal: (amount: number) => string;
    readonly move: (to: number) => string;
    readonly attack: (target: string) => string;
    readonly swapped: (a: string, b: string) => string;
    readonly win: (player: string) => string;
    readonly draw: string;
    readonly skill: (name: string) => string;
    readonly cardPlayed: (name: string, player: string) => string;
    readonly cardDiscarded: (name: string, player: string) => string;
    readonly cardDrawn: (count: number, player: string) => string;
    readonly moved: (who: string, to: number) => string;
    readonly attacked: (who: string, target: string, amount: number) => string;
    readonly healed: (who: string, amount: number) => string;
    readonly statusAdded: (who: string, status: string) => string;
    readonly statusRemoved: (who: string, status: string) => string;
    readonly died: (who: string) => string;
    readonly edgeBlocked: (edge: string) => string;
    readonly edgeUnblocked: (edge: string) => string;
    readonly trapPlaced: (vertex: number) => string;
    readonly trapTriggered: (who: string, vertex: number) => string;
    readonly shadowReturn: (who: string, success: boolean) => string;
    readonly cooldownModified: (who: string, value: number) => string;
    readonly gameEnd: (result: string) => string;
    readonly pass: (player: string) => string;
    readonly deploy: (player: string) => string;
    /**
     * 技能只用一行说明"谁用了哪个技能"：引擎事件只记录结果（伤害/治疗/状态），
     * 不会写技能名，所以这一行必须由界面补。
     */
    readonly usedSkill: (who: string, name: string) => string;
    /**
     * 兜底文案：这一手没有产生任何事件（例如原地移动、攻击被减到 0 伤害）。
     * 没有它的话，这种回合在行动记录里只会剩下一句"对手抽了 1 张牌"。
     */
    readonly actedMove: (who: string) => string;
    readonly actedAttack: (who: string) => string;
  };
  readonly character: Record<CharacterTypeId, CharacterText>;
  readonly skillName: Record<SkillId, string>;
  readonly card: Record<CardId, CardText>;
  readonly cardCategory: Record<CardCategory, string>;
  readonly status: Record<StatusType, StatusText>;
  readonly prompt: Record<PromptCode, string>;
}
