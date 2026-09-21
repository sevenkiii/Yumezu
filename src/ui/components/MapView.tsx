/**
 * 地图渲染：一张 SVG，按层次绘制边、陷阱、出生区、节点、影标记与角色。
 *
 * 组件不做任何规则判断：哪些节点/边可点，全部来自 highlights。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameEvent } from '../../core/Event';
import { shortestPath } from '../../map/Graph';
import { EffectsLayer } from './EffectsLayer';

import type { CharacterId, CharacterTypeId, EdgeKey, VertexId } from '../../core/GameState';
import type { PlayerView } from '../../core/View';
import { edgeKeyOf } from '../../map/Graph';
import { portraitFor, sourceRect } from '../portraits';
import type { UiHighlights, UiState } from '../interaction';
import {
  BOARD_SIZE,
  BOARD_SIZES,
  PLAYER_COLORS,
  STATUS_COLORS,
  STATUS_ORDER,
  toBoardX,
  toBoardY,
} from '../theme';
import type { UiText } from '../i18n';

export interface MapViewProps {
  readonly view: PlayerView;
  readonly highlights: UiHighlights;
  readonly ui: UiState;
  readonly text: UiText;
  /** 变化时重新取景（选中角色 / 技能 / 功能牌）。 */
  readonly focusKey: string;
  /** 最近一次行动的事件（用于伤害飘字、移动轨迹等表现）。 */
  readonly fxEvents?: readonly GameEvent[];
  readonly onCharacter: (id: CharacterId) => void;
  readonly onNode: (vertex: VertexId) => void;
  readonly onEdge: (edge: EdgeKey) => void;
}

export function MapView({
  view,
  highlights,
  ui,
  text,
  focusKey,
  fxEvents = [],
  onCharacter,
  onNode,
  onEdge,
}: MapViewProps) {
  const positions = useMemo(() => {
    const map = new Map<VertexId, { x: number; y: number }>();
    for (const vertex of view.graph.vertices) {
      map.set(vertex.id, { x: toBoardX(vertex.x), y: toBoardY(vertex.y) });
    }
    return map;
  }, [view.graph]);

  const blocked = useMemo(
    () => new Set(view.blockedEdges.map((item) => item.edge)),
    [view.blockedEdges],
  );

  const deployRegion = view.phase === 'DEPLOY' ? view.spawn[view.viewer].region : [];

  // 让地图铺满容器：按容器宽高比扩展 viewBox，避免左右出现大片空白。
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [aspect, setAspect] = useState(1);
  /** 地图镜头：zoom 为放大倍数，x/y 为拖拽偏移（单位为 viewBox 单位）。 */
  const [camera, setCamera] = useState({ zoom: 1, x: 0, y: 0 });
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const pannedRef = useRef(false);

  // 换地图（或重新开局）时把镜头复位
  useEffect(() => {
    setCamera({ zoom: 1, x: 0, y: 0 });
  }, [view.graph]);
  useEffect(() => {
    const svg = svgRef.current;
    if (svg === null) return;
    const element = svg.parentElement;
    if (element === null || typeof ResizeObserver === 'undefined') return;
    const update = (): void => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setAspect(rect.width / rect.height);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fitted = useMemo(() => fitViewBoxRect(positions, aspect), [positions, aspect]);
  const viewBoxRect = useMemo(() => {
    const width = fitted.width / camera.zoom;
    const height = fitted.height / camera.zoom;
    return {
      x: fitted.x + (fitted.width - width) / 2 + camera.x,
      y: fitted.y + (fitted.height - height) / 2 + camera.y,
      width,
      height,
    };
  }, [fitted, camera]);
  const viewBox =
    viewBoxRect.x + ' ' + viewBoxRect.y + ' ' + viewBoxRect.width + ' ' + viewBoxRect.height;

  const zoomBy = (factor: number): void => {
    setCamera((current) => ({
      ...current,
      zoom: Math.min(4, Math.max(0.6, current.zoom * factor)),
    }));
  };

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>): void => {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12);
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>): void => {
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    pannedRef.current = false;
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>): void => {
    const drag = dragRef.current;
    if (drag === null || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) < 4) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect === null || rect === undefined || rect.width === 0 || rect.height === 0) return;
    pannedRef.current = true;
    drag.x = event.clientX;
    drag.y = event.clientY;
    const unitX = fitted.width / cameraRef.current.zoom / rect.width;
    const unitY = fitted.height / cameraRef.current.zoom / rect.height;
    setCamera((current) => ({ ...current, x: current.x - dx * unitX, y: current.y - dy * unitY }));
  };

  const handlePointerUp = (): void => {
    dragRef.current = null;
  };

  const animRef = useRef<number | null>(null);

  /** 用 rAF 把镜头平滑推到目标位置。 */
  const animateCameraTo = (target: { zoom: number; x: number; y: number }): void => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    const start = { ...cameraRef.current };
    const startedAt = Date.now();
    const step = (): void => {
      const t = Math.min(1, (Date.now() - startedAt) / 320);
      const e = 1 - Math.pow(1 - t, 3);
      setCamera({
        zoom: start.zoom + (target.zoom - start.zoom) * e,
        x: start.x + (target.x - start.x) * e,
        y: start.y + (target.y - start.y) * e,
      });
      animRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    animRef.current = requestAnimationFrame(step);
  };

  // 选中角色 / 技能 / 功能牌时，自动缩放到"比作用范围大一点点"
  useEffect(() => {
    if (focusKey === '') {
      animateCameraTo({ zoom: 1, x: 0, y: 0 });
      return;
    }
    const ids = new Set<VertexId>();
    if (ui.selectedCharacterId !== null) {
      const actor = view.characters.find((item) => item.id === ui.selectedCharacterId);
      if (actor !== undefined) ids.add(actor.position);
    }
    for (const vertex of highlights.moveNodes) ids.add(vertex);
    for (const vertex of highlights.nodes) ids.add(vertex);
    for (const id of highlights.targetCharacters) {
      const target = view.characters.find((item) => item.id === id);
      if (target !== undefined) ids.add(target.position);
    }
    if (ids.size === 0) return;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const id of ids) {
      const point = positions.get(id);
      if (point === undefined) continue;
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    if (!Number.isFinite(minX)) return;

    // 多留一点边距 = "比作用域大一点点"
    const pad = 130;
    const boxWidth = maxX - minX + pad * 2;
    const boxHeight = maxY - minY + pad * 2;
    const zoom = Math.min(
      3.2,
      Math.max(0.8, Math.min(fitted.width / boxWidth, fitted.height / boxHeight)),
    );
    animateCameraTo({
      zoom,
      x: (minX + maxX) / 2 - (fitted.x + fitted.width / 2),
      y: (minY + maxY) / 2 - (fitted.y + fitted.height / 2),
    });
    // 只在"选中目标"变化时重新取景，拖拽 / 缩放时不要抢镜头
  }, [focusKey]);
  const targetId =
    ui.pending.kind === 'ATTACK' || ui.pending.kind === 'SKILL' || ui.pending.kind === 'CARD'
      ? ui.pending.targetId
      : null;

  return (
    <>
      <div className="map-zoom">
        <button
          type="button"
          className="ghost"
          onClick={() => zoomBy(1.25)}
          title={text.panel.zoomIn}
        >
          ＋
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => zoomBy(1 / 1.25)}
          title={text.panel.zoomOut}
        >
          －
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => setCamera({ zoom: 1, x: 0, y: 0 })}
          title={text.panel.zoomReset}
        >
          ⤢
        </button>
      </div>
      <svg
        className={focusKey === '' ? 'map' : 'map map--focused'}
        ref={svgRef}
        viewBox={viewBox}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClickCapture={(event) => {
          // 拖拽之后不要误触发节点点击
          if (pannedRef.current) {
            event.stopPropagation();
            pannedRef.current = false;
          }
        }}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={text.app.title}
      >
        <defs>
          <radialGradient id="dream-paper" cx="50%" cy="42%" r="72%">
            <stop offset="0%" stopColor="#26304d" />
            <stop offset="60%" stopColor="#1b2238" />
            <stop offset="100%" stopColor="#141a2b" />
          </radialGradient>
        </defs>
        {/* 底板铺满整个可见区域，避免出现"地图方块"边界 */}
        <rect
          x={viewBoxRect.x}
          y={viewBoxRect.y}
          width={viewBoxRect.width}
          height={viewBoxRect.height}
          fill="url(#dream-paper)"
        />

        {fxEvents.length > 0 ? (
          <EffectsLayer
            events={fxEvents}
            positions={positions}
            positionsOfCharacter={new Map(view.characters.map((item) => [item.id, item.position]))}
            pathOfMove={(from, to) => shortestPath(view.graph, from, to) ?? [from, to]}
          />
        ) : null}

        <g className="map__edges">
          {view.graph.edges.map((edge) => {
            const from = positions.get(edge.a);
            const to = positions.get(edge.b);
            if (from === undefined || to === undefined) return null;
            const key = edgeKeyOf(edge);
            const isBlocked = blocked.has(key);
            const selectable = highlights.edges.has(key);
            return (
              <g key={key}>
                <line
                  className={isBlocked ? 'edge edge--blocked' : 'edge'}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                />
                {selectable ? (
                  <line
                    className="edge edge--selectable"
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                  />
                ) : null}
                {selectable ? (
                  <line
                    className="edge-hit"
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    onClick={() => onEdge(key)}
                  />
                ) : null}
              </g>
            );
          })}
        </g>

        <g className="map__spawn">
          {deployRegion.map((vertex) => {
            const point = positions.get(vertex);
            if (point === undefined) return null;
            return (
              <circle
                key={vertex}
                className="spawn-zone"
                cx={point.x}
                cy={point.y}
                r={BOARD_SIZES.spawnRadius}
                stroke={PLAYER_COLORS[view.viewer]}
              />
            );
          })}
        </g>

        <g className="map__traps">
          {view.traps.map((trap) => {
            const point = positions.get(trap.vertex);
            if (point === undefined) return null;
            return <polygon key={trap.id} className="trap" points={trapPoints(point.x, point.y)} />;
          })}
        </g>

        <g className="map__nodes">
          {view.graph.vertices.map((vertex) => {
            const point = positions.get(vertex.id);
            if (point === undefined) return null;
            const movable = highlights.moveNodes.has(vertex.id);
            const pickable = highlights.nodes.has(vertex.id);
            const deployable = highlights.deployNodes.has(vertex.id);
            const className = [
              'node',
              movable ? 'node--move' : '',
              pickable ? 'node--pick' : '',
              deployable ? 'node--deploy' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <g key={vertex.id}>
                <circle
                  className={className}
                  cx={point.x}
                  cy={point.y}
                  r={BOARD_SIZES.nodeRadius}
                />
                <circle
                  className="node-hit"
                  cx={point.x}
                  cy={point.y}
                  r={BOARD_SIZES.nodeHitRadius}
                  onClick={() => onNode(vertex.id)}
                />
              </g>
            );
          })}
        </g>

        <g className="map__marks">
          {view.characters.map((character) => {
            if (!character.alive || character.shadowMark === null) return null;
            const point = positions.get(character.shadowMark);
            if (point === undefined) return null;
            return (
              <circle
                key={character.id}
                className="shadow-mark"
                cx={point.x}
                cy={point.y}
                r={BOARD_SIZES.shadowRadius}
                stroke={PLAYER_COLORS[character.owner]}
              />
            );
          })}
        </g>

        <g className="map__characters">
          {view.characters.map((character) => {
            if (!character.alive) return null;
            const point = positions.get(character.position);
            if (point === undefined) return null;
            const statuses = STATUS_ORDER.filter((status) => character.statuses[status]);
            const isSelected = ui.selectedCharacterId === character.id;
            const isTarget = targetId === character.id;
            const isSelectable = highlights.selectableCharacters.has(character.id);
            const isTargetable = highlights.targetCharacters.has(character.id);
            const ratio = character.maxHp === 0 ? 0 : character.hp / character.maxHp;

            return (
              <g key={character.id} className="token" onClick={() => onCharacter(character.id)}>
                {isSelected || isTarget || isTargetable ? (
                  <circle
                    className={
                      'token__ring' +
                      (isTarget ? ' token__ring--target' : '') +
                      (isTargetable && !isTarget ? ' token__ring--targetable' : '')
                    }
                    cx={point.x}
                    cy={point.y}
                    r={BOARD_SIZES.tokenRingRadius}
                  />
                ) : null}
                {isSelectable ? (
                  <circle
                    className="token__glow"
                    cx={point.x}
                    cy={point.y}
                    r={BOARD_SIZES.tokenGlowRadius}
                  />
                ) : null}
                <rect
                  className="token__hp"
                  x={point.x - BOARD_SIZES.hpBarWidth / 2}
                  y={point.y + BOARD_SIZES.hpBarOffsetY}
                  width={BOARD_SIZES.hpBarWidth}
                  height={BOARD_SIZES.hpBarHeight}
                  rx={3.5}
                />
                <rect
                  className="token__hp-fill"
                  x={point.x - 21}
                  y={point.y + BOARD_SIZES.hpBarOffsetY}
                  width={BOARD_SIZES.hpBarWidth * ratio}
                  height={BOARD_SIZES.hpBarHeight}
                  rx={3.5}
                  fill={PLAYER_COLORS[character.owner]}
                />
                <text
                  className="token__hp-text"
                  x={point.x}
                  y={point.y + BOARD_SIZES.hpTextOffsetY}
                >
                  {character.hp}
                </text>
                <circle
                  className="token__body"
                  cx={point.x}
                  cy={point.y}
                  r={BOARD_SIZES.tokenRadius}
                  fill={PLAYER_COLORS[character.owner]}
                  stroke={PLAYER_COLORS[character.owner]}
                />
                {renderPortrait(character.typeId, point.x, point.y, character.id)}
                {portraitFor(character.typeId) === null ? (
                  <text className="token__initial" x={point.x} y={point.y + 6}>
                    {text.character[character.typeId].name.slice(0, 1)}
                  </text>
                ) : null}
                {statuses.map((status, index) => (
                  <circle
                    key={status}
                    className="token__status"
                    cx={
                      point.x -
                      ((statuses.length - 1) * BOARD_SIZES.spinnerGap) / 2 +
                      index * BOARD_SIZES.spinnerGap
                    }
                    cy={point.y + BOARD_SIZES.spinnerOffsetY}
                    r={BOARD_SIZES.spinnerRadius}
                    fill={STATUS_COLORS[status]}
                  >
                    <title>{text.status[status].name}</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </g>
      </svg>
    </>
  );
}

/**
 * 角色头像：用嵌套 SVG 的 viewBox 当裁切框，正好套住圆形 token。
 * 没有立绘时返回 null，调用方已经画了字母圆作为回退。
 */
function renderPortrait(typeId: CharacterTypeId, cx: number, cy: number, id: string) {
  const asset = portraitFor(typeId);
  if (asset === null) return null;
  const radius = BOARD_SIZES.tokenRadius;
  const size = asset.tokenSize;
  const rect = sourceRect(asset.token, 1, size);
  const viewBox = rect.x + ' ' + rect.y + ' ' + rect.width + ' ' + rect.height;
  const clipId = 'token-clip-' + id.replace(/[^a-zA-Z0-9]/g, '-');
  return (
    <g clipPath={'url(#' + clipId + ')'}>
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={radius} />
        </clipPath>
      </defs>
      <svg
        x={cx - radius}
        y={cy - radius}
        width={radius * 2}
        height={radius * 2}
        viewBox={viewBox}
        preserveAspectRatio="none"
      >
        <image
          href={asset.tokenUrl}
          x={0}
          y={0}
          width={size.width}
          height={size.height}
          preserveAspectRatio="none"
        />
      </svg>
    </g>
  );
}

/**
 * 计算铺满容器的 viewBox：以图的包围盒为基础留出边距，
 * 再按容器宽高比向外扩展（不是缩放图形，因此比例不会失真）。
 */
function fitViewBoxRect(
  positions: ReadonlyMap<VertexId, { x: number; y: number }>,
  aspect: number,
): { x: number; y: number; width: number; height: number } {
  if (positions.size === 0) return { x: 0, y: 0, width: BOARD_SIZE, height: BOARD_SIZE };
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of positions.values()) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  // 边距要能容纳血条 / 状态点 / 名字等绘制在节点之外的部分
  const pad = BOARD_SIZES.nodeHitRadius + 24;
  const baseWidth = maxX - minX + pad * 2;
  const baseHeight = maxY - minY + pad * 2;
  let width = baseWidth;
  let height = baseHeight;
  if (aspect > baseWidth / baseHeight) width = baseHeight * aspect;
  else height = baseWidth / aspect;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return { x: centerX - width / 2, y: centerY - height / 2, width, height };
}

function trapPoints(x: number, y: number): string {
  const size = BOARD_SIZES.trapSize;
  return (
    x +
    ',' +
    (y - size) +
    ' ' +
    (x - size) +
    ',' +
    (y + size * 0.7) +
    ' ' +
    (x + size) +
    ',' +
    (y + size * 0.7)
  );
}
