/**
 * 地图上的"发生了什么"表现层：由引擎事件驱动，纯展示。
 *
 *  - 受到伤害 / 回复 → 在目标节点上方飘出数字
 *  - 移动 → 画出走过的路径，并有一个小光点沿路径滑过
 *  - 阵亡 → 节点上扩出一圈涟漪
 *
 * 全部用 CSS 动画；事件清空后这些元素会被卸载，回到静态画面。
 */

import type { GameEvent } from '../../core/Event';
import type { VertexId } from '../../core/GameState';

export interface EffectsLayerProps {
  readonly events: readonly GameEvent[];
  /** 节点 id → 棋盘坐标。 */
  readonly positions: ReadonlyMap<VertexId, { x: number; y: number }>;
  /** 角色 id → 当前所在节点（阵亡角色也保留位置）。 */
  readonly positionsOfCharacter: ReadonlyMap<string, VertexId>;
  /** 两点之间的逐跳路径（相邻节点的连线）。 */
  readonly pathOfMove: (from: VertexId, to: VertexId) => VertexId[];
}

export function EffectsLayer({
  events,
  positions,
  positionsOfCharacter,
  pathOfMove,
}: EffectsLayerProps) {
  const effects: React.ReactNode[] = [];

  events.forEach((event, index) => {
    if (event.type === 'DAMAGED' || event.type === 'HEALED') {
      const vertex = positionsOfCharacter.get(event.targetId);
      const point = vertex === undefined ? undefined : positions.get(vertex);
      if (point === undefined) return;
      const healing = event.type === 'HEALED';
      effects.push(
        <text
          key={'float-' + index}
          className={healing ? 'fx-float fx-float--heal' : 'fx-float'}
          x={point.x}
          y={point.y - 34}
        >
          {(healing ? '+' : '−') + event.amount}
        </text>,
      );
      return;
    }

    if (event.type === 'MOVED') {
      const path = pathOfMove(event.from, event.to);
      const points = path
        .map((vertex) => {
          const point = positions.get(vertex);
          return point === undefined ? null : point.x + ',' + point.y;
        })
        .filter((value): value is string => value !== null);
      if (points.length < 2) return;
      effects.push(
        <polyline key={'path-' + index} className="fx-path" points={points.join(' ')} />,
        <circle key={'dot-' + index} className="fx-dot" r={9}>
          <animateMotion
            dur="0.42s"
            fill="freeze"
            path={'M' + points[0] + ' L' + points.slice(1).join(' L')}
          />
        </circle>,
      );
      return;
    }

    if (event.type === 'CHARACTER_DIED') {
      const vertex = positionsOfCharacter.get(event.characterId);
      const point = vertex === undefined ? undefined : positions.get(vertex);
      if (point === undefined) return;
      effects.push(
        <circle key={'death-' + index} className="fx-death" cx={point.x} cy={point.y} r={18} />,
      );
    }
  });

  return <g className="fx-layer">{effects}</g>;
}
