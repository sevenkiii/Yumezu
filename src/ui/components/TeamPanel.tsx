/** 队伍条：一行排列角色卡（己方用 full，对手用 mini）。 */

import type { CharacterId } from '../../core/GameState';
import type { PlayerView } from '../../core/View';
import type { UiHighlights } from '../interaction';
import type { UiText } from '../i18n';
import { CharacterCard } from './CharacterCard';

export interface TeamPanelProps {
  readonly view: PlayerView;
  readonly text: UiText;
  readonly highlights: UiHighlights;
  readonly selectedCharacterId: CharacterId | null;
  readonly title: string;
  readonly side: 'YOU' | 'ENEMY';
  readonly variant: 'full' | 'mini';
  readonly onSelect?: (id: CharacterId) => void;
  readonly onSkill?: () => void;
}

export function TeamPanel({
  view,
  text,
  highlights,
  selectedCharacterId,
  title,
  side,
  variant,
  onSelect,
  onSkill,
}: TeamPanelProps) {
  const owner = side === 'YOU' ? view.viewer : view.viewer === 'P1' ? 'P2' : 'P1';
  const characters = view.characters.filter((character) => character.owner === owner);

  return (
    <section className={variant === 'full' ? 'team-rail' : 'team-strip'}>
      <h2 className={variant === 'full' ? 'team-rail__title' : 'team-strip__title'}>{title}</h2>
      <div className={variant === 'full' ? 'team-rail__list' : 'team-strip__list'}>
        {characters.map((character) => {
          const selectable = side === 'YOU' && highlights.selectableCharacters.has(character.id);
          const selected = selectedCharacterId === character.id;
          return (
            <CharacterCard
              key={character.id}
              text={text}
              character={character}
              variant={variant}
              selected={selected}
              selectable={selectable}
              canUseSkill={selectable && selected && highlights.canUseSkill}
              skillArmed={selected && highlights.skillArmed}
              onSelect={onSelect === undefined ? undefined : () => onSelect(character.id)}
              onSkill={selected ? onSkill : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}
