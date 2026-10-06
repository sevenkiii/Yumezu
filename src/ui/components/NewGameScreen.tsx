/** 开局界面：本地用种子开一局，或者输入房间号进联机对局。 */

import { useState } from 'react';

import type { UiText } from '../i18n';

export interface NewGameScreenProps {
  readonly text: UiText;
  readonly onStart: (mapSeed: string, gameSeed: string) => void;
  /** 进入联机房间（服务端会另定种子）。 */
  readonly onJoin: (roomId: string) => void;
}

/** 房间号：短、好念、去掉容易看混的字母。 */
function randomRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let index = 0; index < 4; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function NewGameScreen({ text, onStart, onJoin }: NewGameScreenProps) {
  const [mapSeed, setMapSeed] = useState('dream-1');
  const [gameSeed, setGameSeed] = useState('game-1');
  const [roomId, setRoomId] = useState(randomRoomCode);

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

      <div className="new-game__online">
        <h2 className="new-game__section">{text.online.title}</h2>
        <label className="new-game__field">
          <span>{text.online.roomLabel}</span>
          <input
            value={roomId}
            placeholder={text.online.roomPlaceholder}
            onChange={(event) => setRoomId(event.target.value.toUpperCase())}
          />
        </label>
        <p className="new-game__hint">{text.online.hint}</p>
        <div className="new-game__buttons">
          <button
            type="button"
            className="primary"
            disabled={roomId.trim() === ''}
            onClick={() => onJoin(roomId.trim())}
          >
            {text.online.join}
          </button>
        </div>
      </div>
    </div>
  );
}
