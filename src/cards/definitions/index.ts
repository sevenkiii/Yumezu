/** 功能牌注册表：新增功能牌时在此登记。 */

import type { CardId } from '../../core/GameState';
import type { CardDefinition } from '../Card';
import { assault } from './Assault';
import { blink } from './Blink';
import { blockRoad } from './BlockRoad';
import { firstAid } from './FirstAid';
import { mark } from './Mark';
import { purify } from './Purify';
import { recharge } from './Recharge';
import { repulse } from './Repulse';
import { sealSkill } from './SealSkill';
import { shield } from './Shield';
import { trap } from './Trap';

export const CARD_DEFINITIONS: Record<CardId, CardDefinition> = {
  FirstAid: firstAid,
  Shield: shield,
  Assault: assault,
  Recharge: recharge,
  Purify: purify,
  Blink: blink,
  Repulse: repulse,
  BlockRoad: blockRoad,
  Mark: mark,
  SealSkill: sealSkill,
  Trap: trap,
};
