/** React 绑定：把 transport 的快照接进组件树。 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type { GameSnapshot, GameTransport } from './transport';

export function useGameSnapshot(transport: GameTransport): GameSnapshot {
  const subscribe = useCallback(
    (listener: () => void) => transport.subscribe(listener),
    [transport],
  );
  const getSnapshot = useCallback(() => transport.getSnapshot(), [transport]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** 稳定的 transport 实例（换局时不重建）。 */
export function useTransport(create: () => GameTransport): GameTransport {
  return useMemo(create, []);
}
