'use client';

/**
 * E3 — settings (`docs/wireframes/Settings.dc.html`, overridden per CR-011: no channel `Select`, no
 * language control — G2 keeps language in the app bar). **Exactly** four controls: adherence
 * tracking (`Toggle` + `ChoiceGroup` frequency) · refill alerts (`Toggle`) · calendar sync
 * (`Toggle`, state shared with E1) · optional contact phone (`TextField`, via the identical
 * `PhoneEditor` A3 already uses — imported rather than re-typed, per this bundle's brief note on
 * tone consistency with `features/identity`).
 *
 * The adherence toggle never fails silently: with no connected chat it reads off, explains why in
 * one line (CR-012: gain-framed, never deficiency-framed), and flipping it on routes to E5 instead
 * of calling `updateSettings` at all — the data layer would refuse `adherenceCheckInEnabled: true`
 * without a connected link regardless (`lib/data/mock/settings.ts`), but this screen never lets that
 * refusal render as an error: it simply never makes the call (G10; the brief's own acceptance line,
 * "writes nothing").
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Toggle } from '@/components/ui/Toggle';
import { ChoiceGroup } from '@/components/ui/ChoiceGroup';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { NavigateButton } from '@/features/shell/NavigateButton';
import { PhoneEditor } from '@/features/identity/PhoneEditor';
import { updateSettings, enableCalendarSync } from '@/lib/data';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { Settings } from '@/types/contracts';

const FREQUENCY_VALUES = ['daily', 'every_other_day'] as const;

export function SettingsScreen({
  patientId,
  settings,
  chatConnected,
  phone,
  locale,
  notificationsHref,
}: {
  patientId: string;
  settings: Settings;
  chatConnected: boolean;
  phone: string | null;
  locale: Locale;
  notificationsHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmingTurnOff, setConfirmingTurnOff] = useState(false);

  function handleTrackingChange(next: boolean) {
    if (next) {
      if (!chatConnected) {
        router.push(notificationsHref); // writes nothing — the brief's own acceptance line
        return;
      }
      startTransition(() => {
        void (async () => {
          await updateSettings(patientId, { adherenceCheckInEnabled: true });
          router.refresh();
        })();
      });
      return;
    }
    setConfirmingTurnOff(true);
  }

  function confirmTurnOff() {
    startTransition(() => {
      void (async () => {
        await updateSettings(patientId, { adherenceCheckInEnabled: false });
        setConfirmingTurnOff(false);
        router.refresh();
      })();
    });
  }

  function handleFrequencyChange(next: string) {
    if (!FREQUENCY_VALUES.includes(next as (typeof FREQUENCY_VALUES)[number])) return;
    startTransition(() => {
      void (async () => {
        await updateSettings(patientId, { adherenceCheckInFrequency: next as Settings['adherenceCheckInFrequency'] });
        router.refresh();
      })();
    });
  }

  function handleRefillChange(next: boolean) {
    startTransition(() => {
      void (async () => {
        await updateSettings(patientId, { refillAlertsEnabled: next });
        router.refresh();
      })();
    });
  }

  function handleCalendarChange(next: boolean) {
    startTransition(() => {
      void (async () => {
        if (next) await enableCalendarSync(patientId);
        else await updateSettings(patientId, { calendarSyncEnabled: false });
        router.refresh();
      })();
    });
  }

  return (
    <div className="relative flex flex-col gap-4" data-testid="settings-screen">
      <Toggle
        label={t(copy.ambient.e3TrackingLabel, locale)}
        description={t(copy.ambient.e3TrackingDescription, locale)}
        checked={settings.adherenceCheckInEnabled}
        onChange={handleTrackingChange}
        lang={locale}
      />

      {!chatConnected && (
        <InlineNotice tone="info" title={t(copy.ambient.e3TrackingNoChatNotice, locale)}>
          <NavigateButton href={notificationsHref} variant="quiet" lang={locale}>
            {t(copy.ambient.e3TrackingNoChatAction, locale)}
          </NavigateButton>
        </InlineNotice>
      )}

      <ChoiceGroup
        variant="segmented"
        name="adherence-frequency"
        label={t(copy.ambient.e3FrequencyLabel, locale)}
        value={settings.adherenceCheckInFrequency}
        onChange={handleFrequencyChange}
        options={[
          { value: 'daily', label: t(copy.ambient.e3FrequencyDaily, locale) },
          { value: 'every_other_day', label: t(copy.ambient.e3FrequencyAltDay, locale) },
        ]}
      />

      <Toggle
        label={t(copy.ambient.e3RefillAlertsLabel, locale)}
        description={t(copy.ambient.e3RefillAlertsDescription, locale)}
        checked={settings.refillAlertsEnabled}
        onChange={handleRefillChange}
        lang={locale}
      />

      <Toggle
        label={t(copy.ambient.e3CalendarSyncLabel, locale)}
        description={t(copy.ambient.e3CalendarSyncDescription, locale)}
        checked={settings.calendarSyncEnabled}
        onChange={handleCalendarChange}
        lang={locale}
      />

      <PhoneEditor patientId={patientId} initialPhone={phone} locale={locale} />

      <p className="type-caption">{t(copy.ambient.e3EngineNote, locale)}</p>

      <Sheet
        open={confirmingTurnOff}
        title={t(copy.ambient.e3TurnOffSheetTitle, locale)}
        onClose={() => setConfirmingTurnOff(false)}
        closeLabel={t(copy.ambient.e3SheetCloseLabel, locale)}
        footer={
          <>
            <Button variant="danger" fullWidth lang={locale} loading={pending} onClick={confirmTurnOff}>
              {t(copy.ambient.e3TurnOffConfirm, locale)}
            </Button>
            <Button variant="quiet" fullWidth lang={locale} onClick={() => setConfirmingTurnOff(false)} disabled={pending}>
              {t(copy.ambient.e3TurnOffCancel, locale)}
            </Button>
          </>
        }
      >
        <ul className="flex flex-col gap-2 ps-5 type-body" data-testid="turn-off-consequences">
          <li>{t(copy.ambient.e3TurnOffConsequence1, locale)}</li>
          <li>{t(copy.ambient.e3TurnOffConsequence2, locale)}</li>
          <li>{t(copy.ambient.e3TurnOffConsequence3, locale)}</li>
        </ul>
      </Sheet>
    </div>
  );
}
