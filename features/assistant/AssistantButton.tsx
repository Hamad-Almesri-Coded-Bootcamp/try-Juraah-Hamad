'use client';

import { Icon } from '@/components/ui/Icon';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';

/** The window event the launcher listens for (features/assistant/AssistantLauncher.tsx). */
export const ASSISTANT_OPEN_EVENT = 'jurah:assistant-open';

/**
 * The assistant's entry in the app bar (CR-071, CR-069(k)): a light pill beside the language switch,
 * instead of a button floating over the content. It only asks the one launcher (mounted in the root
 * layout) to open its panel; while a page carries it, the floating launcher steps aside
 * (daylight.css), and a page marked `data-no-assistant` hides both.
 */
export function AssistantButton({ locale }: { locale: Locale }) {
  return (
    <button
      type="button"
      className="jr-bar-pill wsf-focus"
      data-assistant-trigger=""
      aria-haspopup="dialog"
      onClick={() => window.dispatchEvent(new CustomEvent(ASSISTANT_OPEN_EVENT))}
    >
      <Icon name="inbox" small />
      <span>{t(copy.assistant.launcherLabel, locale)}</span>
    </button>
  );
}
