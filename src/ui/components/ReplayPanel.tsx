/**
 * 对局记录 / 回放（挂在开发面板里）。
 *
 * - 「复制记录」把当前这一局的 JSON 放进剪贴板，可以直接发给别人；
 * - 把别人的记录粘进去点「载入回放」，就能用 上一步 / 播放 / 下一步 逐步重现；
 * - 回放期间棋盘是不可操作的（见 App 把 legalActions 置空），看完点「结束回放」
 *   就停在当前画面上，接着正常玩。
 * - 联机对局：进行中服务端不下发完整记录（含随机种子，会泄露对手手牌），
 *   此时不渲染复制按钮与空记录框；结束后才出现按钮和只读全文。
 *
 * 组件本身只拿到"记录文本 + 回放进度 + 几个回调"，不直接碰 transport。
 */

import { useEffect, useRef, useState } from 'react';

import type { ReplayStatus } from '../transport';
import type { UiText } from '../i18n';

export interface ReplayPanelProps {
  readonly text: UiText;
  /** 当前这一局的记录（实时更新）。 */
  readonly record: string;
  /** 正在回放时的进度；null = 正常对局。 */
  readonly replay: ReplayStatus | null;
  /** 联机对局：不提供载入回放；记录只在结束后下发。 */
  readonly readOnly?: boolean;
  readonly onLoad: (record: string) => boolean;
  readonly onStop: () => void;
  /** 前进一步并返回是否真的推进了；false 会让自动播放停止。 */
  readonly onStep: () => boolean;
  readonly onBack: () => void;
}

/** 自动播放时每一步之间的间隔（毫秒）。 */
const PLAY_INTERVAL_MS = 700;

export function ReplayPanel({
  text,
  record,
  replay,
  readOnly = false,
  onLoad,
  onStop,
  onStep,
  onBack,
}: ReplayPanelProps) {
  const labels = text.dev.replay;
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const inReplay = replay !== null;
  /** 联机进行中服务端不下发完整记录（防止用种子重算对手手牌）。 */
  const recordAvailable = record.trim() !== '';
  const hint = !readOnly ? labels.hint : recordAvailable ? labels.readonlyHint : labels.pendingHint;
  /** 定时器里要拿到最新的回调，避免每次渲染都重建 interval。 */
  const stepRef = useRef(onStep);
  stepRef.current = onStep;

  // 回放结束（或者被停掉）就不要再自动播了
  useEffect(() => {
    if (replay === null) setPlaying(false);
    else if (replay.step >= replay.total) setPlaying(false);
  }, [replay]);

  useEffect(() => {
    if (!playing || !inReplay) return;
    const timer = setInterval(() => {
      if (!stepRef.current()) setPlaying(false);
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playing, inReplay]);

  // 提示语过一会儿自己消失
  useEffect(() => {
    if (notice === null) return;
    const timer = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  async function copy(): Promise<void> {
    if (!recordAvailable) return;
    try {
      await navigator.clipboard.writeText(record);
      setNotice(labels.copied);
    } catch {
      // 剪贴板不可用（http 公网部署就是这种）：框里本来就有全文，让玩家手动复制。
      // 本地模式下把记录摊进输入框，效果相同。
      if (!readOnly) setDraft(record);
      setNotice(labels.copyFailed);
    }
  }

  function load(): void {
    setPlaying(false);
    if (onLoad(draft)) {
      setNotice(null);
      setDraft('');
      return;
    }
    setNotice(labels.loadFailed);
  }

  return (
    <section className="replay-panel">
      <h3 className="replay-panel__title">{labels.title}</h3>
      <p className="replay-panel__hint">{hint}</p>

      {/*
       * 联机进行中服务端不下发完整记录：这时一个按不动的「复制记录」只会误导，
       * 所以整行按钮都不渲染；结束后才出现真正可用的复制按钮。
       */}
      {recordAvailable || !readOnly || inReplay ? (
        <div className="replay-panel__row">
          {recordAvailable ? (
            <button type="button" className="ghost" onClick={() => void copy()}>
              {labels.copy}
            </button>
          ) : null}
          {readOnly ? null : (
            <button type="button" className="ghost" onClick={load} disabled={draft.trim() === ''}>
              {labels.load}
            </button>
          )}
          {inReplay ? (
            <button type="button" className="ghost" onClick={onStop}>
              {labels.stop}
            </button>
          ) : null}
        </div>
      ) : null}

      {replay === null || readOnly ? null : (
        <div className="replay-panel__row">
          <button type="button" className="ghost" onClick={onBack} disabled={replay.step === 0}>
            {labels.prev}
          </button>
          <button type="button" className="ghost" onClick={() => setPlaying((value) => !value)}>
            {playing ? labels.pause : labels.play}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={onStep}
            disabled={replay.step >= replay.total}
          >
            {labels.next}
          </button>
          <span className="replay-panel__progress">
            {labels.progress(replay.step, replay.total)}
          </span>
        </div>
      )}

      {/*
       * 联机进行中不摆空框；结束后这里显示只读全文，
       * 即使 clipboard 不可用（http 非安全上下文）也能全选手动复制。
       * 本地模式下它是「粘贴别人的记录」的输入框。
       */}
      {readOnly && !recordAvailable ? null : (
        <textarea
          className={'replay-panel__text' + (readOnly ? ' replay-panel__text--readonly' : '')}
          value={readOnly ? record : draft}
          readOnly={readOnly}
          onChange={readOnly ? undefined : (event) => setDraft(event.target.value)}
          placeholder={readOnly ? '' : labels.placeholder}
          aria-label={labels.title}
          spellCheck={false}
        />
      )}

      {notice === null ? null : <p className="replay-panel__notice">{notice}</p>}
    </section>
  );
}
