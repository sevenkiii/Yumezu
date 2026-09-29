/**
 * 地图上的"发生了什么"表现层：由引擎事件驱动，纯展示。
 *
 *  - 受到伤害 / 回复 → 在目标节点上方飘出数字
 *  - 移动 → 画出走过的路径（角色本身沿这条线逐跳走过去，见 useTokenMotion）
 *  - 阵亡 → 节点上扩出一圈涟漪
 *
 * 全部用 CSS 动画；事件清空后这些元素会被卸载，回到静态画面。
 */

import type { GameEvent } from '../../core/Event';
import type { CharacterId, VertexId } from '../../core/GameState';

export interface EffectsLayerProps {
  readonly events: readonly GameEvent[];
  /** 节点 id → 棋盘坐标。 */
  readonly positions: ReadonlyMap<VertexId, { x: number; y: number }>;
  /** 角色 id → 当前所在节点（阵亡角色也保留位置）。 */
  readonly positionsOfCharacter: ReadonlyMap<string, VertexId>;
  /** 逐跳路径（相邻节点的连线）；第三个参数是走这个路径的角色。 */
  readonly pathOfMove: (from: VertexId, to: VertexId, mover: CharacterId) => VertexId[];
  /**
   * 角色 id → 这一批里走位花了多少毫秒。
   * 伤害数字与命中环要等到"走过去"之后再出现，不然先伤人后到位。
   */
  readonly trailDurations: ReadonlyMap<CharacterId, number>;
}

export function EffectsLayer({
  events,
  positions,
  positionsOfCharacter,
  pathOfMove,
  trailDurations,
}: EffectsLayerProps) {
  const effects: React.ReactNode[] = [];
  /** 目标 id → 它这次挨打的延迟，阵亡涟漪跟着一起延后。 */
  const damageDelays = new Map<CharacterId, number>();

  events.forEach((event, index) => {
    if (event.type === 'DAMAGED' || event.type === 'HEALED') {
      const vertex = positionsOfCharacter.get(event.targetId);
      const point = vertex === undefined ? undefined : positions.get(vertex);
      if (point === undefined) return;
      const healing = event.type === 'HEALED';
      const sourceId = event.type === 'DAMAGED' ? event.source.sourceCharacterId : null;
      // 出手方（或目标自己）这一批里走过位就等它走完
      const delay = Math.max(
        sourceId === null ? 0 : (trailDurations.get(sourceId) ?? 0),
        trailDurations.get(event.targetId) ?? 0,
      );
      const timing = { animationDelay: delay + 'ms' };
      // 命中环：撞上去的瞬间在目标身上炸开一圈（AOE 每个目标各来一个）
      if (!healing && event.amount > 0) {
        damageDelays.set(event.targetId, delay);
        effects.push(
          // 用 <g> 包一层再缩放：直接放在 <circle> 上时，部分浏览器不认 fill-box，
          // 会围着画布中心缩放，环就跑到别处去了
          <g key={'hit-' + index} className="fx-hit" style={timing}>
            <circle cx={point.x} cy={point.y} r={22} />
          </g>,
        );
      }
      effects.push(
        <text
          key={'float-' + index}
          className={healing ? 'fx-float fx-float--heal' : 'fx-float'}
          x={point.x}
          y={point.y - 34}
          style={timing}
        >
          {(healing ? '+' : '−') + event.amount}
        </text>,
      );
      return;
    }

    if (event.type === 'MOVED') {
      const path = pathOfMove(event.from, event.to, event.characterId);
      const points = path
        .map((vertex) => {
          const point = positions.get(vertex);
          return point === undefined ? null : point.x + ',' + point.y;
        })
        .filter((value): value is string => value !== null);
      if (points.length < 2) return;
      effects.push(
        <polyline key={'path-' + index} className="fx-path" points={points.join(' ')} />,
      );
      return;
    }

    if (event.type === 'CHARACTER_DIED') {
      const vertex = positionsOfCharacter.get(event.characterId);
      const point = vertex === undefined ? undefined : positions.get(vertex);
      if (point === undefined) return;
      const delay = damageDelays.get(event.characterId) ?? 0;
      effects.push(
        <g key={'death-' + index} className="fx-death" style={{ animationDelay: delay + 'ms' }}>
          <circle cx={point.x} cy={point.y} r={18} />
        </g>,
      );
    }
  });

  return <g className="fx-layer">{effects}</g>;
}
