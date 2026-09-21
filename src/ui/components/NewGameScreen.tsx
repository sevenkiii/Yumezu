/** 开局界面：输入两个种子。地图由 mapSeed 完全决定。 */

import { useState } from 'react';

import type { UiText } from '../i18n';

export interface NewGameScreenProps {
  readonly text: UiText;
  readonly onStart: (mapSeed: string, gameSeed: string) => void;
}

export function NewGameScreen({ text, onStart }: NewGameScreenProps) {
  const [mapSeed, setMapSeed] = useState('dream-1');
  const [gameSeed, setGameSeed] = useState('game-1');

  return (
    <div className="new-game">
      <h1 className="new-game__title">{text.app.title}</h1>
      <p className="new-game__subtitle">{text.app.subtitle}</p>
      <label className="new-game__field">
        <span>{text.newGame.mapSeed}</span>
        <input value={mapSeed} onChange={(event) => setMapSeed(event.target.value)} />
      </label>
      <label className="new-game__field">
        <span>{text.newGame.gameSeed}</span>
        <input value={gameSeed} onChange={(event) => setGameSeed(event.target.value)} />
      </label>
      <p className="new-game__hint">{text.newGame.hint}</p>
      <div className="new-game__buttons">
        <button
          type="button"
          className="ghost"
          onClick={() => {
            const stamp = Date.now().toString(36);
            setMapSeed('map-' + stamp);
            setGameSeed('game-' + stamp);
          }}
        >
          {text.newGame.randomize}
        </button>
        <button
          type="button"
          className="primary"
          onClick={() =>
            onStart(
              mapSeed.trim() === '' ? 'dream-1' : mapSeed.trim(),
              gameSeed.trim() === '' ? 'game-1' : gameSeed.trim(),
            )
          }
        >
          {text.newGame.start}
        </button>
      </div>
    </div>
  );
}
