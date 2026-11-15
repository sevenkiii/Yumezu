/**
 * 说明书：全局浮层，开局页 / 等待页 / 对局页都能打开。
 *
 * 只展示，不参与任何规则：角色与功能牌的数值、状态名一律从引擎定义与 i18n 读，
 * 玩法文案来自 i18n，所以调平衡后说明书不会和代码脱节。
 */

import { useEffect, useState } from 'react';

import { cardDefinition } from '../../cards/Card';
import { CARD_POOL } from '../../cards/CardPool';
import { characterDefinition } from '../../characters/Character';
import { CHARACTER_TYPE_IDS, STATUS_TYPES } from '../../core/GameState';
import type { ManualTab, UiText } from '../i18n';
import { portraitFor } from '../portraits';
import { Portrait } from './Portrait';

const TABS: readonly ManualTab[] = ['rules', 'characters', 'cards'];

/** 右下角的说明书入口图标（一本摊开的书）。 */
export function ManualIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none">
      <path
        d="M12 5.5C10.2 4.2 8 3.8 4.5 4v13c3.5-.2 5.7.2 7.5 1.5 1.8-1.3 4-1.7 7.5-1.5V4c-3.5-.2-5.7.2-7.5 1.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M12 5.5v13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export interface ManualProps {
  readonly text: UiText;
  /** 首次打开时显示哪一页；也便于渲染测试逐页断言。 */
  readonly initialTab?: ManualTab;
  readonly onClose: () => void;
}

export function Manual({ text, initialTab = 'rules', onClose }: ManualProps) {
  const [tab, setTab] = useState<ManualTab>(initialTab);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="manual-overlay" onClick={onClose} role="presentation">
      <section
        className="manual"
        role="dialog"
        aria-modal="true"
        aria-label={text.manual.title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="manual__header">
          <h2 className="manual__title">{text.manual.title}</h2>
          <button
            type="button"
            className="manual__close"
            onClick={onClose}
            aria-label={text.manual.close}
          >
            ×
          </button>
        </header>

        <nav className="manual__tabs" aria-label={text.manual.title}>
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              className={'manual__tab' + (tab === item ? ' manual__tab--active' : '')}
              aria-pressed={tab === item}
              onClick={() => setTab(item)}
            >
              {text.manual.tabs[item]}
            </button>
          ))}
        </nav>

        <div className="manual__body">
          {tab === 'rules' ? <RulesPage text={text} /> : null}
          {tab === 'characters' ? <CharactersPage text={text} /> : null}
          {tab === 'cards' ? <CardsPage text={text} /> : null}
        </div>
      </section>
    </div>
  );
}

function RulesPage({ text }: { readonly text: UiText }) {
  return (
    <>
      {text.manual.sections.map((section) => (
        <section className="manual-section" key={section.title}>
          <h3 className="manual-section__title">{section.title}</h3>
          <ul className="manual-section__lines">
            {section.lines.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
      <section className="manual-section">
        <h3 className="manual-section__title">{text.manual.statusTitle}</h3>
        <dl className="manual-statuses">
          {STATUS_TYPES.map((status) => (
            <div className="manual-statuses__row" key={status}>
              <dt>{text.status[status].name}</dt>
              <dd>{text.status[status].description}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}

function CharactersPage({ text }: { readonly text: UiText }) {
  return (
    <div className="manual-characters">
      {CHARACTER_TYPE_IDS.map((typeId) => {
        const definition = characterDefinition(typeId);
        const label = text.character[typeId];
        return (
          <article className="manual-char" key={typeId}>
            <div className="manual-char__portrait">
              {portraitFor(typeId) !== null ? (
                <Portrait typeId={typeId} boxAspect={1} framing="token" />
              ) : (
                <span className="manual-char__fallback">{label.name.slice(0, 1)}</span>
              )}
            </div>
            <div className="manual-char__body">
              <h3 className="manual-char__name">
                {label.name}
                <span className="manual-char__role">{label.role}</span>
              </h3>
              <dl className="manual-char__stats">
                <div>
                  <dt>{text.manual.hpLabel}</dt>
                  <dd>{definition.hp}</dd>
                </div>
                <div>
                  <dt>{text.stat.attackDamage}</dt>
                  <dd>{definition.attackDamage}</dd>
                </div>
                <div>
                  <dt>{text.stat.moveRange}</dt>
                  <dd>{definition.moveRange}</dd>
                </div>
                <div>
                  <dt>{text.stat.attackRange}</dt>
                  <dd>{definition.attackRange}</dd>
                </div>
              </dl>
              <p className="manual-char__skill">
                <strong>
                  {text.manual.skillLabel} · {label.skillName}（{text.stat.skillCd}{' '}
                  {definition.skill.cd}）
                </strong>
                <span>{label.skillDescription}</span>
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CardsPage({ text }: { readonly text: UiText }) {
  return (
    <>
      <p className="manual__note">{text.manual.poolHint}</p>
      <ul className="manual-cards">
        {CARD_POOL.map((cardId) => {
          const definition = cardDefinition(cardId);
          const label = text.card[cardId];
          return (
            <li className="manual-card" key={cardId}>
              <span className={'manual-card__tag manual-card__tag--' + definition.category}>
                {text.cardCategory[definition.category]}
              </span>
              <div className="manual-card__body">
                <strong className="manual-card__name">{label.name}</strong>
                <p>{label.description}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
