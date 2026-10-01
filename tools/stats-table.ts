/**
 * 生成数值总表 `STATS.md`。
 *
 * 数值全部从定义里读（角色 / 功能牌的常量与 i18n 文案），所以表不会和代码脱节；
 * 调数值时改定义，再跑一次这个脚本即可。
 *
 * 用法：npm run stats
 */

import { writeFileSync } from 'node:fs';

import { CHARACTER_TYPE_IDS } from '../src/core/GameState';
import { characterDefinition } from '../src/characters/Character';
import { CARD_POOL, INITIAL_HAND_SIZE, MAX_HAND_SIZE } from '../src/cards/CardPool';
import { cardDefinition } from '../src/cards/Card';
import { DEFAULT_MAP_PARAMS } from '../src/map/MapGenerator';
import { DEFAULT_SPAWN_PARAMS } from '../src/map/SpawnGenerator';
import { TEAM_SIZE } from '../src/rules/TurnRules';
import { getText } from '../src/ui/i18n';

// 角色技能的可调参数（每个角色文件里导出的常量）
import { GLOBE_DAMAGE, GLOBE_RANGE } from '../src/characters/definitions/Nana';
import { SWAP_RANGE } from '../src/characters/definitions/Lily';
import {
  MELTY_LAND_DAMAGE,
  MELTY_LAND_HEAL,
  MELTY_LAND_RANGE,
} from '../src/characters/definitions/Melty';
import { FREEZE_RANGE } from '../src/characters/definitions/Urara';
import {
  STAR_DASH_DAMAGE,
  STAR_DASH_RANGE,
  STAR_DASH_STRIKE_RANGE,
} from '../src/characters/definitions/Spica';

// 功能牌的可调参数
import { FIRST_AID_HEAL } from '../src/cards/definitions/FirstAid';
import { BLINK_RANGE } from '../src/cards/definitions/Blink';
import { RECHARGE_AMOUNT } from '../src/cards/definitions/Recharge';
import { BLOCK_DURATION_ACTIONS } from '../src/cards/definitions/BlockRoad';
import { MAX_TRAPS_PER_PLAYER, TRAP_DAMAGE } from '../src/cards/definitions/Trap';

const text = getText();

/** 每个角色的技能参数（写成人话，数值本身仍然来自定义）。 */
function skillParamsOf(typeId: (typeof CHARACTER_TYPE_IDS)[number]): string {
  switch (typeId) {
    case 'Nana':
      return '距离 ≤ ' + GLOBE_RANGE + '，伤害 ' + GLOBE_DAMAGE;
    case 'Lily':
      return '换位距离 ≤ ' + SWAP_RANGE;
    case 'Melty':
      return (
        '范围 ≤ ' +
        MELTY_LAND_RANGE +
        '；友方回复 ' +
        MELTY_LAND_HEAL +
        '、敌方伤害 ' +
        MELTY_LAND_DAMAGE
      );
    case 'Mikage':
      return '首次受伤 −1，随后回到影标记（1 次）';
    case 'Spica':
      return (
        '移动 ≤ ' +
        STAR_DASH_RANGE +
        '，落点距离 ≤ ' +
        STAR_DASH_STRIKE_RANGE +
        ' 的敌人各受 ' +
        STAR_DASH_DAMAGE
      );
    case 'Urara':
      return '距离 ≤ ' + FREEZE_RANGE + '，附加【冻结】';
    default:
      return '';
  }
}

/** 每张功能牌的可调参数。 */
function cardParamsOf(id: (typeof CARD_POOL)[number]): string {
  switch (id) {
    case 'FirstAid':
      return '回复 ' + FIRST_AID_HEAL;
    case 'Blink':
      return '移动距离 ≤ ' + BLINK_RANGE;
    case 'Recharge':
      return 'CD −' + RECHARGE_AMOUNT;
    case 'BlockRoad':
      return '持续 ' + BLOCK_DURATION_ACTIONS + ' 次行动';
    case 'Trap':
      return '伤害 ' + TRAP_DAMAGE + '，每人最多 ' + MAX_TRAPS_PER_PLAYER + ' 个';
    default:
      return '';
  }
}

function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const head = '| ' + headers.join(' | ') + ' |';
  const divider = '|' + headers.map(() => '---').join('|') + '|';
  const body = rows.map((row) => '| ' + row.join(' | ') + ' |').join('\n');
  return [head, divider, body].join('\n');
}

export async function main(): Promise<void> {
  const lines: string[] = [];
  lines.push('# 数值总表');
  lines.push('');
  lines.push(
    '> 由 `npm run stats` 从定义生成（角色 / 功能牌的常量 + `src/ui/i18n` 的文案），**不要手改**。',
  );
  lines.push('> 调数值请改各自的定义文件，再跑一次脚本。');
  lines.push('');

  lines.push('## 全局');
  lines.push('');
  lines.push(
    table(
      ['项目', '数值'],
      [
        ['每队角色数', String(TEAM_SIZE)],
        ['初始手牌', String(INITIAL_HAND_SIZE)],
        ['手牌上限', String(MAX_HAND_SIZE)],
        ['地图节点数', String(DEFAULT_MAP_PARAMS.nodeCount)],
        [
          '地图边数',
          DEFAULT_MAP_PARAMS.edgeCountRange[0] + ' ~ ' + DEFAULT_MAP_PARAMS.edgeCountRange[1],
        ],
        [
          '地图直径',
          DEFAULT_MAP_PARAMS.diameterRange[0] + ' ~ ' + DEFAULT_MAP_PARAMS.diameterRange[1],
        ],
        [
          '出生中心距离',
          DEFAULT_SPAWN_PARAMS.distanceRange[0] + ' ~ ' + DEFAULT_SPAWN_PARAMS.distanceRange[1],
        ],
        ['出生区最小距离', String(DEFAULT_SPAWN_PARAMS.minRegionGap)],
        ['出生区最小规模', String(DEFAULT_SPAWN_PARAMS.minRegionSize)],
      ],
    ),
  );
  lines.push('');

  lines.push('## 角色');
  lines.push('');
  lines.push(
    table(
      ['角色', 'HP', '普攻', '移动', '攻击', '技能', 'CD', '技能参数'],
      CHARACTER_TYPE_IDS.map((typeId) => {
        const definition = characterDefinition(typeId);
        const character = text.character[typeId];
        return [
          character.name,
          String(definition.hp),
          String(definition.attackDamage),
          String(definition.moveRange),
          String(definition.attackRange),
          character.skillName,
          String(definition.skill.cd),
          skillParamsOf(typeId),
        ];
      }),
    ),
  );
  lines.push('');
  lines.push('### 技能说明');
  lines.push('');
  for (const typeId of CHARACTER_TYPE_IDS) {
    const character = text.character[typeId];
    lines.push(
      '- **' + character.name + ' · ' + character.skillName + '**：' + character.skillDescription,
    );
  }
  lines.push('');

  lines.push('## 功能牌');
  lines.push('');
  lines.push(
    table(
      ['功能牌', '类别', '参数', '说明'],
      CARD_POOL.map((id) => {
        const definition = cardDefinition(id);
        const card = text.card[id];
        return [
          card.name,
          text.cardCategory[definition.category],
          cardParamsOf(id),
          card.description,
        ];
      }),
    ),
  );
  lines.push('');

  const output = lines.join('\n');
  writeFileSync('STATS.md', output + '\n', 'utf8');
  process.stdout.write('已写入 STATS.md（' + output.split('\n').length + ' 行）\n');
}
