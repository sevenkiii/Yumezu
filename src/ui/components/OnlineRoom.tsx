/**
 * 联机房间的等待界面：显示房间号、邀请链接与连接状态。
 *
 * 连接成功、两人到齐之后由 App 换成真正的对局界面；这里只管"还没开打"的那段。
 */

import { useState } from 'react';

import type { UiText } from '../i18n';
import { defaultServerUrl, type RemoteStatus } from '../transport-remote';

export interface OnlineRoomProps {
  readonly text: UiText;
  readonly roomId: string;
  readonly serverUrl: string;
  readonly status: RemoteStatus;
  readonly onLeave: () => void;
}

/** 邀请链接：把页面地址原样带上房间号；跨机时人只要点开就能连上同一台服务器。 */
export function inviteLinkFor(roomId: string, serverUrl: string): string {
  if (typeof location === 'undefined') return '';
  const url = new URL(location.href);
  url.search = '';
  url.searchParams.set('room', roomId);
  // 只有在连"别的服务器"（?server= 覆盖过）时才需要把地址写进链接
  if (serverUrl !== defaultServerUrl()) url.searchParams.set('server', serverUrl);
  return url.toString();
}

export function OnlineRoom({ text, roomId, serverUrl, status, onLeave }: OnlineRoomProps) {
  const [copied, setCopied] = useState(false);
  const labels = text.online;
  const link = inviteLinkFor(roomId, serverUrl);
  const statusText =
    status === 'closed' ? labels.closed : status === 'waiting' ? labels.waiting : labels.connecting;

  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="app app--start">
      <section className="new-game online-room">
        <h1 className="new-game__title">{labels.title}</h1>
        <p className="new-game__subtitle">{statusText}</p>
        <p className="online-room__room">
          <span className="online-room__label">{labels.roomLabel}</span>
          <strong className="online-room__code">{roomId}</strong>
        </p>
        <p className="new-game__hint">{labels.hint}</p>
        <div className="online-room__link">
          <span className="online-room__label">{labels.invite}</span>
          <code className="online-room__url">{link}</code>
        </div>
        <div className="new-game__buttons">
          <button type="button" className="ghost" onClick={onLeave}>
            {labels.back}
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => void copyLink()}
            disabled={link === ''}
          >
            {copied ? labels.copied : labels.copyLink}
          </button>
        </div>
      </section>
    </div>
  );
}
