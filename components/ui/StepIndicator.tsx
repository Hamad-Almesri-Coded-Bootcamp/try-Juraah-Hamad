import { copy, t, type Locale } from '@/i18n';
import './styles/StepIndicator.css';

export interface StepIndicatorProps {
  /** One label per step, used as the assistive-technology name of that step. Never more than four
   * (Build Prompts prompt 1: "never more than four") — a longer array throws rather than rendering
   * a progress bar the product never designed a fifth segment for. */
  steps: string[];
  /** Zero-based index of the step in progress. */
  current: number;
  /** Accessible name of the whole list, e.g. "First-run setup progress". */
  label: React.ReactNode;
  lang?: Locale;
  className?: string;
}

/**
 * Progress through a short multi-step flow. An `<ol>` so the reading order carries the sequence;
 * `aria-current="step"` marks the one in progress. The bars are logical-inline-size flex children,
 * so the fill direction follows `dir` on its own — no RTL-specific code, and the numerals in the
 * "Step X of Y" caption never mirror (they are not glyphs `Icon`'s `mirror` prop ever touches).
 */
export function StepIndicator({ steps, current, label, lang = 'en', className }: StepIndicatorProps) {
  if (steps.length > 4) {
    throw new Error('StepIndicator: steps.length must be at most 4 (Build Prompts prompt 1).');
  }
  const classes = ['wsf-stepind', className].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      <ol className="wsf-stepind__list" aria-label={typeof label === 'string' ? label : undefined}>
        {steps.map((step, i) => {
          const stepState = i < current ? 'done' : i === current ? 'current' : 'upcoming';
          return (
            <li
              key={step}
              className={`wsf-stepind__item wsf-stepind__item--${stepState}`}
              aria-current={i === current ? 'step' : undefined}
            >
              <span className="wsf-stepind__bar" aria-hidden="true" />
              <span className="wsf-sr">{step}</span>
            </li>
          );
        })}
      </ol>
      <p className="wsf-stepind__caption type-caption">
        {t(copy.vocabulary.stepOf, lang)} {current + 1} {t(copy.vocabulary.of, lang)} {steps.length}
      </p>
    </div>
  );
}
