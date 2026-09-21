import { copy, t } from '@/i18n';

export interface LoadingStateProps {
  /** The shape the skeleton stands in for. Default 'list'. */
  variant?: 'list' | 'detail' | 'alert' | 'lines';
  /** How many placeholder rows. Default 3. Ignored by 'alert', which is always one banner-shaped block. */
  rows?: number;
  /** Announced while the skeleton is up. No `lang` prop in index.d.ts, so the built-in word falls
   * back to English ('en') when `label` is not supplied — reported as a gap. */
  label?: string;
  className?: string;
}

function ListRow({ i }: { i: number }) {
  return (
    <div className="wsf-skel__card" aria-hidden="true" key={i}>
      <div className="wsf-skel__bar wsf-skel__bar--title" />
      <div className="wsf-skel__bar" />
      <div className="wsf-skel__bar wsf-skel__bar--pill" />
    </div>
  );
}

function DetailBlock() {
  return (
    <div className="wsf-skel__card" aria-hidden="true">
      <div className="wsf-skel__bar wsf-skel__bar--title" />
      <div className="wsf-skel__bar wsf-skel__bar--tall" />
      <div className="wsf-skel__bar" />
      <div className="wsf-skel__bar wsf-skel__bar--short" />
    </div>
  );
}

function LineRow({ i }: { i: number }) {
  return <div className={`wsf-skel__bar${i % 3 === 0 ? ' wsf-skel__bar--title' : i % 3 === 1 ? '' : ' wsf-skel__bar--short'}`} aria-hidden="true" key={i} />;
}

/**
 * A skeleton shaped like the content it stands in for. `variant="alert"` reserves the interaction
 * alert's space so the banner does not push cards down when it arrives; the other three vary in row
 * shape only, all built from the bundle's `.wsf-skel*` primitives — no CSS of this component's own.
 */
export function LoadingState({ variant = 'list', rows = 3, label, className }: LoadingStateProps) {
  const classes = ['wsf-skel', className].filter(Boolean).join(' ');
  const announced = label ?? t(copy.vocabulary.loading, 'en');
  return (
    <div className={classes} role="status" aria-busy="true" aria-live="polite">
      <span className="wsf-sr">{announced}</span>
      {variant === 'alert' && <div className="wsf-skel__alert" aria-hidden="true" />}
      {variant === 'list' && Array.from({ length: rows }, (_, i) => <ListRow i={i} key={i} />)}
      {variant === 'detail' && <DetailBlock />}
      {variant === 'lines' && Array.from({ length: rows }, (_, i) => <LineRow i={i} key={i} />)}
    </div>
  );
}
