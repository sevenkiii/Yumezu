/**
 * 角色定义与实例构造。
 *
 * 面板数值以 RULES.md §11 为准；每个角色一个文件，见 definitions/。
 */

import type { CharacterState, CharacterTypeId, PlayerId, VertexId } from '../core/GameState';
import { characterIdOf, createStatusSet } from '../core/GameState';
import type { SkillDefinition } from './Skill';
import { CHARACTER_DEFINITIONS } from './definitions';

export interface CharacterDefinition {
  readonly typeId: CharacterTypeId;
  readonly name: string;
  readonly hp: number;
  readonly attackDamage: number;
  readonly moveRange: number;
  readonly attackRange: number;
  readonly skill: SkillDefinition;
}

export function characterDefinition(typeId: CharacterTypeId): CharacterDefinition {
  const found = CHARACTER_DEFINITIONS[typeId];
  if (found === undefined) throw new Error('characterDefinition: 未知角色 ' + typeId);
  return found;
}

/**
 * 创建一个角色实例。
 * initialPosition 在部署完成前使用出生中心（占位），部署时会被覆盖。
 */
export function createCharacter(
  owner: PlayerId,
  typeId: CharacterTypeId,
  initialPosition: VertexId,
): CharacterState {
  const definition = characterDefinition(typeId);
  return {
    id: characterIdOf(owner, typeId),
    owner,
    typeId,
    position: initialPosition,
    hp: definition.hp,
    maxHp: definition.hp,
    moveRange: definition.moveRange,
    attackRange: definition.attackRange,
    attackDamage: definition.attackDamage,
    skillId: definition.skill.id,
    skillCd: 0,
    statuses: createStatusSet(),
    shadowMark: null,
    alive: true,
  };
}
