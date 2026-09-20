/**
 * 行动校验与合法行动枚举。见 RULES.md §1、§8、§17.7。
 *
 * 设计原则：validateAction 返回结构化结果（不抛异常）；
 * getLegalActions 产出的每一个 Action 都必须能通过校验。
 */

import { cardDefinition } from '../cards/Card';
import { characterDefinition } from '../characters/Character';
import type { Action } from '../core/Action';
import type { GameState, PlayerId } from '../core/GameState';
import { charactersOf, findCharacter, opponentOf } from '../core/GameState';
import { distance } from '../map/Graph';
import { reachableDestinations } from './MovementRules';
import { cardChoiceEquals, skillChoiceEquals } from './Targeting';

export type ValidationResult =
  { readonly ok: true } | { readonly ok: false; readonly code: string; readonly reason: string };

const OK: ValidationResult = { ok: true };

function fail(code: string, reason: string): ValidationResult {
  return { ok: false, code, reason };
}

export function validateActionInternal(state: GameState, action: Action): ValidationResult {
  if (state.phase === 'FINISHED') return fail('GAME_FINISHED', '对局已经结束');
  if (action.player !== state.currentPlayer) {
    return fail('NOT_YOUR_TURN', '现在不是 ' + action.player + ' 的行动');
  }
  if (state.phase === 'DEPLOY') {
    if (action.type !== 'DEPLOY') return fail('PHASE_DEPLOY', '部署阶段只能提交部署');
    return validateDeployment(state, action);
  }
  if (action.type === 'DEPLOY') return fail('PHASE_BATTLE', '部署阶段已经结束');

  switch (action.type) {
    case 'MOVE':
      return validateMove(state, action);
    case 'ATTACK':
      return validateAttack(state, action);
    case 'USE_SKILL':
      return validateSkill(state, action);
    case 'USE_CARD':
      return validateCard(state, action);
    case 'DISCARD':
      return validateDiscard(state, action);
    case 'PASS':
      return OK;
    default:
      return fail('UNKNOWN_ACTION', '未知的行动类型');
  }
}

type DeployAction = Extract<Action, { type: 'DEPLOY' }>;
type MoveAction = Extract<Action, { type: 'MOVE' }>;
type AttackAction = Extract<Action, { type: 'ATTACK' }>;
type SkillAction = Extract<Action, { type: 'USE_SKILL' }>;
type CardAction = Extract<Action, { type: 'USE_CARD' }>;
type DiscardAction = Extract<Action, { type: 'DISCARD' }>;

function validateDeployment(state: GameState, action: DeployAction): ValidationResult {
  if (state.deployment[action.player] !== null) {
    return fail('ALREADY_DEPLOYED', '已经提交过部署');
  }
  const own = charactersOf(state, action.player);
  if (action.assignments.length !== own.length) {
    return fail('DEPLOY_SHAPE', '必须为全部 ' + own.length + ' 名角色指定位置');
  }
  const region = state.spawn[action.player].region;
  const usedCharacters = new Set<string>();
  const usedVertices = new Set<number>();
  for (const assignment of action.assignments) {
    const character = findCharacter(state, assignment.characterId);
    if (character === null || character.owner !== action.player) {
      return fail('DEPLOY_CHARACTER', '角色不属于该玩家');
    }
    if (usedCharacters.has(assignment.characterId)) {
      return fail('DEPLOY_DUPLICATE', '同一名角色被指派了多次');
    }
    usedCharacters.add(assignment.characterId);
    if (usedVertices.has(assignment.vertex)) {
      return fail('DEPLOY_OCCUPIED', '同一个节点被指派了多名角色');
    }
    usedVertices.add(assignment.vertex);
    if (!region.includes(assignment.vertex)) {
      return fail('DEPLOY_OUT_OF_REGION', '落点不在自己的出生区域内');
    }
  }
  return OK;
}

function validateMove(state: GameState, action: MoveAction): ValidationResult {
  const character = findCharacter(state, action.characterId);
  if (character === null || character.owner !== action.player || !character.alive) {
    return fail('BAD_CHARACTER', '不是自己的存活角色');
  }
  if (character.statuses.Frozen) return fail('FROZEN', '被冻结的角色不能移动');
  if (!reachableDestinations(state, character).includes(action.to)) {
    return fail('UNREACHABLE', '目标节点不可到达');
  }
  return OK;
}

function validateAttack(state: GameState, action: AttackAction): ValidationResult {
  const attacker = findCharacter(state, action.characterId);
  if (attacker === null || attacker.owner !== action.player || !attacker.alive) {
    return fail('BAD_CHARACTER', '不是自己的存活角色');
  }
  const target = findCharacter(state, action.targetId);
  if (target === null || !target.alive || target.owner === action.player) {
    return fail('BAD_TARGET', '目标必须是存活的敌方角色');
  }
  const gap = distance(state.map.graph, attacker.position, target.position);
  if (gap > attacker.attackRange) return fail('OUT_OF_RANGE', '目标不在攻击范围内');
  return OK;
}

function validateSkill(state: GameState, action: SkillAction): ValidationResult {
  const character = findCharacter(state, action.characterId);
  if (character === null || character.owner !== action.player || !character.alive) {
    return fail('BAD_CHARACTER', '不是自己的存活角色');
  }
  if (character.skillCd > 0) return fail('ON_COOLDOWN', '技能还在冷却中');
  if (character.statuses.SkillSealed)
    return fail('SKILL_SEALED', '该角色被【封技】，不能使用专属技能');
  const definition = characterDefinition(character.typeId);
  const choices = definition.skill.listChoices(state, character);
  if (!choices.some((choice) => skillChoiceEquals(choice, action.choice))) {
    return fail('ILLEGAL_CHOICE', '该技能此刻不能这样使用');
  }
  return OK;
}

function validateCard(state: GameState, action: CardAction): ValidationResult {
  const hand = state.players[action.player].hand;
  const card = hand.find((item) => item.id === action.handCardId);
  if (card === undefined) return fail('NO_SUCH_CARD', '手牌中没有这张牌');
  const definition = cardDefinition(card.cardId);
  const choices = definition.listChoices(state, action.player);
  if (!choices.some((choice) => cardChoiceEquals(choice, action.choice))) {
    return fail('ILLEGAL_CHOICE', '这张牌此刻不能这样使用');
  }
  return OK;
}

function validateDiscard(state: GameState, action: DiscardAction): ValidationResult {
  const hand = state.players[action.player].hand;
  if (!hand.some((card) => card.id === action.handCardId)) {
    return fail('NO_SUCH_CARD', '手牌中没有这张牌');
  }
  return OK;
}

/** 枚举当前玩家的全部合法行动。 */
export function getLegalActions(state: GameState): Action[] {
  if (state.phase === 'FINISHED') return [];
  const player = state.currentPlayer;
  if (state.phase === 'DEPLOY') return deploymentActions(state, player);

  const actions: Action[] = [];
  const enemy = opponentOf(player);
  for (const character of charactersOf(state, player)) {
    if (!character.alive) continue;
    if (!character.statuses.Frozen) {
      for (const to of reachableDestinations(state, character)) {
        actions.push({ type: 'MOVE', player, characterId: character.id, to });
      }
    }
    for (const target of charactersOf(state, enemy)) {
      if (!target.alive) continue;
      const gap = distance(state.map.graph, character.position, target.position);
      if (gap <= character.attackRange) {
        actions.push({ type: 'ATTACK', player, characterId: character.id, targetId: target.id });
      }
    }
    if (character.skillCd === 0 && !character.statuses.SkillSealed) {
      const definition = characterDefinition(character.typeId);
      for (const choice of definition.skill.listChoices(state, character)) {
        actions.push({ type: 'USE_SKILL', player, characterId: character.id, choice });
      }
    }
  }
  for (const card of state.players[player].hand) {
    const definition = cardDefinition(card.cardId);
    for (const choice of definition.listChoices(state, player)) {
      actions.push({ type: 'USE_CARD', player, handCardId: card.id, choice });
    }
  }
  actions.push({ type: 'PASS', player });
  for (const card of state.players[player].hand) {
    actions.push({ type: 'DISCARD', player, handCardId: card.id });
  }
  return actions;
}

/** 部署阶段的全部合法提交：把自己 3 名角色依次放到区域内 3 个不同节点。 */
function deploymentActions(state: GameState, player: PlayerId): Action[] {
  const own = charactersOf(state, player);
  const region = state.spawn[player].region;
  const out: Action[] = [];
  for (const first of region) {
    for (const second of region) {
      if (second === first) continue;
      for (const third of region) {
        if (third === first || third === second) continue;
        out.push({
          type: 'DEPLOY',
          player,
          assignments: [
            { characterId: own[0]!.id, vertex: first },
            { characterId: own[1]!.id, vertex: second },
            { characterId: own[2]!.id, vertex: third },
          ],
        });
      }
    }
  }
  return out;
}
