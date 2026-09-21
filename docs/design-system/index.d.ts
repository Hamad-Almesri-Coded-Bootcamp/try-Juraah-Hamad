// Wasfa component library — props reference.
// Runtime: one classic script assigning window.Wasfa, React 18 read from window.React.
// Every component renders correctly under dir="rtl" and dir="ltr" and at 390 / 834 / 1440px.

import type * as React from 'react';

/** Two-letter language of the component's own fallback copy. Content you pass in is never translated. */
export type Lang = 'ar' | 'en';

/** Dose.status from the project's data contract. */
export type DoseStatus = 'upcoming' | 'taken_on_time' | 'taken_late' | 'missed';

/** Prescription.source.sector from the data contract. Never a status, never a semantic colour. */
export type Sector = 'public' | 'private';

/** InteractionAlert.severity from the data contract. */
export type Severity = 'info' | 'warning' | 'danger';

/** InteractionAlert.reviewStatus from the data contract. */
export type ReviewStatus = 'auto_cleared' | 'pending_medical_review' | 'reviewed';

/** The subset of Prescription that PrescriptionCard reads. */
export interface PrescriptionSummary {
  id?: string;
  drug: { genericName: string; brandName?: string; strengthMg?: number };
  source: { facilityName: string; sector: Sector };
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = navy fill · secondary = border-strong outline · danger = danger fill · quiet = no fill, no border. Default 'primary'. */
  variant?: 'primary' | 'secondary' | 'danger' | 'quiet';
  /** md sets the label type style, lg sets body-strong and a taller box. Default 'md'. */
  size?: 'md' | 'lg';
  /** Swaps the leading icon for a spinner, sets aria-busy and disables the button. The label stays put. */
  loading?: boolean;
  /** Stretches the button to its container — the phone-width default for a primary action. */
  fullWidth?: boolean;
  /** Name of a leading icon from the bundle's outline set, e.g. 'capsule', 'check', 'chevron'. */
  icon?: string;
  /** Mirrors the leading icon under dir="rtl". Only for glyphs that encode direction. */
  mirrorIcon?: boolean;
  /** Language of the bundle's own fallback copy (the screen-reader 'Loading' text). Default 'en'. */
  lang?: Lang;
  children?: React.ReactNode;
}
export declare const Button: React.FC<ButtonProps>;

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required. The accessible name — an icon-only control has no other one. */
  label: string;
  /** Name of an icon from the bundle's outline set. */
  icon: string;
  variant?: 'quiet' | 'primary' | 'secondary' | 'danger';
  /** Mirrors the glyph under dir="rtl". Use for chevrons and the calendar-subscribe arrow only. */
  mirrorIcon?: boolean;
  /** Renders a real link instead of a button — for a back control or any navigation. */
  href?: string;
}
export declare const IconButton: React.FC<IconButtonProps>;

export interface TextFieldProps {
  /** Supplied when you need a stable id; generated otherwise. */
  id?: string;
  label: React.ReactNode;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  /** Sits under the field in caption/ink-muted. Replaced by `error` when that is set. */
  helperText?: React.ReactNode;
  /** A message. Truthy switches the field to its error state: danger outline, warning glyph, role="alert". */
  error?: React.ReactNode;
  disabled?: boolean;
  required?: boolean;
  type?: string;
  inputMode?: string;
  autoComplete?: string;
  /** Forces the input's own direction — set 'ltr' for a Civil ID or a Latin drug name inside an Arabic screen. */
  dir?: 'rtl' | 'ltr';
  lang?: Lang;
  className?: string;
}
export declare const TextField: React.FC<TextFieldProps>;

export interface SelectProps extends Omit<TextFieldProps, 'placeholder' | 'inputMode' | 'autoComplete' | 'type' | 'onChange'> {
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  /** Shown as a disabled first option while `value` is empty. */
  placeholder?: string;
}
export declare const Select: React.FC<SelectProps>;

export interface ToggleProps {
  id?: string;
  label: React.ReactNode;
  /** One line under the label — the place for the soft warning a muted check-in needs. */
  description?: React.ReactNode;
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  lang?: Lang;
  className?: string;
}
export declare const Toggle: React.FC<ToggleProps>;

export interface ChoiceGroupProps {
  /** segmented = one row of buttons (2–3 short options) · radio = a stacked list (longer labels). Default 'segmented'. */
  variant?: 'segmented' | 'radio';
  /** Required: groups the inputs for the keyboard and for assistive technology. */
  name: string;
  label: React.ReactNode;
  value: string;
  onChange?: (next: string) => void;
  options: Array<{ value: string; label: string; description?: string; disabled?: boolean }>;
  helperText?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}
export declare const ChoiceGroup: React.FC<ChoiceGroupProps>;

export interface CardProps {
  /** Defaults to 'button' when onClick is set, 'div' otherwise. */
  as?: 'div' | 'section' | 'li' | 'button' | 'a';
  onClick?: React.MouseEventHandler;
  href?: string;
  /** Drops shadow-sm — for a card inside another surface. */
  flat?: boolean;
  'aria-label'?: string;
  className?: string;
  children?: React.ReactNode;
}
export declare const Card: React.FC<CardProps>;

export interface PrescriptionCardProps {
  prescription: PrescriptionSummary;
  /** The next or most recent dose. Omit and the card shows no status row. */
  dose?: { status: DoseStatus } | null;
  /** Already-formatted dose time, e.g. 'اليوم ٨:٠٠ م' or 'Today 8:00 PM'. The component formats no dates. */
  doseTimeLabel?: string;
  /** Present makes the whole card one button into the detail view and adds the mirroring chevron. */
  onOpen?: React.MouseEventHandler;
  /** Unit appended after strengthMg. Default ' mg'. */
  strengthUnit?: string;
  lang?: Lang;
  className?: string;
}
export declare const PrescriptionCard: React.FC<PrescriptionCardProps>;

export interface StatusPillProps {
  status: DoseStatus;
  /** Overrides the built-in word. The glyph stays, so the status is never carried by colour alone. */
  label?: string;
  lang?: Lang;
  className?: string;
}
export declare const StatusPill: React.FC<StatusPillProps>;

export interface SectorChipProps {
  sector: Sector;
  label?: string;
  lang?: Lang;
  className?: string;
}
export declare const SectorChip: React.FC<SectorChipProps>;

export interface DetailRowProps {
  label: React.ReactNode;
  /** null, undefined or '' renders the empty mark and an assistive 'Not recorded' — never 'undefined', never a collapsed row. */
  value?: React.ReactNode | null;
  /** Replaces the default em dash. */
  emptyMark?: string;
  /** Replaces the assistive text read in place of a missing value. */
  emptyLabel?: string;
  lang?: Lang;
  className?: string;
}
export declare const DetailRow: React.FC<DetailRowProps>;

export interface DepletionMeterProps {
  label?: React.ReactNode;
  /** Units left from dispensing.totalQuantityDispensed minus what has been taken. */
  remaining: number;
  /** The dispensed total the bar is measured against. */
  total: number;
  /** Days to depletion, computed by the deterministic layer — this component does no arithmetic. */
  daysRemaining?: number | null;
  /** Unit word, e.g. 'حبة' or 'tablets'. */
  unit?: string;
  /** At or below this many days the meter reads as low: warning fill plus the low-supply word. Default 7. */
  lowAtDays?: number;
  lang?: Lang;
  className?: string;
}
export declare const DepletionMeter: React.FC<DepletionMeterProps>;

export interface InteractionAlertProps {
  severity: Severity;
  /** Omit only where the platform genuinely has no review state to show. */
  reviewStatus?: ReviewStatus;
  title: React.ReactNode;
  /** Plain-language risk description. Set at body-strong on a danger alert. */
  description?: React.ReactNode;
  /** The interacting drugs, one per line. */
  drugs?: string[];
  /** Overrides the severity word above the title. */
  severityLabel?: string;
  /** Overrides the review-state sentence. Keep any replacement unambiguous about who has and has not checked. */
  reviewLabel?: string;
  /** Buttons. Inside a danger alert, secondary renders as an on-fill button with danger text. */
  actions?: React.ReactNode;
  titleId?: string;
  lang?: Lang;
  className?: string;
}
export declare const InteractionAlert: React.FC<InteractionAlertProps>;

export interface InlineNoticeProps {
  /** Never 'danger' — a safety-critical message is an InteractionAlert. Default 'info'. */
  tone?: 'info' | 'success' | 'warning';
  title?: React.ReactNode;
  /** Fires the dismiss control. Omit for a notice that must stay put. */
  onDismiss?: () => void;
  dismissLabel?: string;
  children?: React.ReactNode;
  className?: string;
}
export declare const InlineNotice: React.FC<InlineNoticeProps>;

export interface EmptyStateProps {
  icon?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** A Button, usually. */
  action?: React.ReactNode;
  className?: string;
}
export declare const EmptyState: React.FC<EmptyStateProps>;

export interface LoadingStateProps {
  /** The shape the skeleton stands in for. Default 'list'. */
  variant?: 'list' | 'detail' | 'alert' | 'lines';
  /** How many placeholder rows. Default 3. */
  rows?: number;
  /** Announced while the skeleton is up. */
  label?: string;
  className?: string;
}
export declare const LoadingState: React.FC<LoadingStateProps>;

export interface ErrorStateProps {
  title: React.ReactNode;
  /** What went wrong and what to do about it — both, always. */
  description?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}
export declare const ErrorState: React.FC<ErrorStateProps>;

export interface AppBarProps {
  title: React.ReactNode;
  /** Adds the back control as a button. Its chevron mirrors under dir="rtl". */
  onBack?: () => void;
  /** Adds the back control as a real link, for navigation. Either this or onBack. */
  backHref?: string;
  /** Accessible name of the back control. Required whenever onBack is set. */
  backLabel?: string;
  /** One trailing control — an IconButton or a quiet Button. */
  action?: React.ReactNode;
  className?: string;
}
export declare const AppBar: React.FC<AppBarProps>;

export interface TabBarProps {
  items: Array<{ id: string; label: string; icon: string; badge?: number }>;
  value: string;
  onChange?: (id: string) => void;
  /** auto = bottom bar below 834px, side rail at and above it. Force either for a preview or a fixed layout. Default 'auto'. */
  layout?: 'auto' | 'bottom' | 'side';
  /** Accessible name of the navigation landmark. */
  label?: string;
  className?: string;
}
export declare const TabBar: React.FC<TabBarProps>;

export interface SheetProps {
  open: boolean;
  onClose?: () => void;
  title: React.ReactNode;
  /** auto = bottom sheet below 834px, centred modal at and above it. Default 'auto'. */
  mode?: 'auto' | 'sheet' | 'modal';
  /** Buttons along the bottom edge. */
  footer?: React.ReactNode;
  closeLabel?: string;
  children?: React.ReactNode;
  className?: string;
}
export declare const Sheet: React.FC<SheetProps>;

/** The bundle's own fallback copy, by language then key. Read it to keep app-side copy consistent. */
export declare const strings: Record<Lang, Record<string, string>>;
