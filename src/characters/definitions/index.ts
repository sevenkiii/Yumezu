/** 角色定义注册表：新增角色时在此登记。 */

import type { CharacterTypeId } from '../../core/GameState';
import type { CharacterDefinition } from '../Character';
import { lily } from './Lily';
import { melty } from './Melty';
import { mikage } from './Mikage';
import { nana } from './Nana';
import { spica } from './Spica';
import { urara } from './Urara';

export const CHARACTER_DEFINITIONS: Record<CharacterTypeId, CharacterDefinition> = {
  Nana: nana,
  Lily: lily,
  Melty: melty,
  Mikage: mikage,
  Spica: spica,
  Urara: urara,
};

export { lily, melty, mikage, nana, spica, urara };
