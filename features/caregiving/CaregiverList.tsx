'use client';

/**
 * F1 — the patient's caregiver list (docs/wireframes/Caregivers.dc.html, overridden per the brief:
 * MenuRow rows, not Card rows — WP4h task brief, "F1: the relationship list as MenuRows"). Every
 * relationship state renders neutrally via MenuRow's `tone="relationship"` (CLAUDE.md rule 8;
 * MenuRow.md) — no badge, dot or warning colour on pending/declined/expired/revoked.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { MenuRow } from '@/components/ui/MenuRow';
import { Sheet } from '@/components/ui/Sheet';
import { DetailRow } from '@/components/ui/DetailRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { InviteSheet } from './InviteSheet';
import { relationshipStateLabel } from './format';
import { cancelInvitation, revokeCaregiver } from '@/lib/data';
import { copy, t } from '@/i18n';
import { interpolate } from '@/features/shell/interpolate';
import type { Locale } from '@/i18n/locale';
import type { CaregiverView } from '@/types/views';

export function CaregiverList({ caregivers, patientId, locale }: { caregivers: CaregiverView[]; patientId: string; locale: Locale }) {
  const router = useRouter();
  const [inviting, setInviting] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<CaregiverView | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<CaregiverView | null>(null);
  const [pending, startTransition] = useTransition();

  function closeInvite() {
    setInviting(false);
    router.refresh();
  }

  function confirmCancel() {
    if (!cancelTarget) return;
    const id = cancelTarget.id;
    startTransition(() => {
      void (async () => {
        await cancelInvitation(id);
        setCancelTarget(null);
        router.refresh();
      })();
    });
  }

  function confirmRevoke() {
    if (!revokeTarget) return;
    const id = revokeTarget.id;
    startTransition(() => {
      void (async () => {
        await revokeCaregiver(id);
        setRevokeTarget(null);
        router.refresh();
      })();
    });
  }

  return (
    <div className="flex flex-col gap-3 p-3 tablet:p-5">
      <Button variant="primary" size="lg" fullWidth lang={locale} icon="plus" onClick={() => setInviting(true)}>
        {t(copy.caregiving.f1InviteButton, locale)}
      </Button>

      {caregivers.length === 0 ? (
        <EmptyState icon="users" title={t(copy.caregiving.f1EmptyTitle, locale)} description={t(copy.caregiving.f1EmptyBody, locale)} />
      ) : (
        <div className="flex flex-col">
          {caregivers.map((c) => (
            <MenuRow
              key={c.id}
              label={c.name}
              description={c.relationship}
              value={relationshipStateLabel(c, locale)}
              tone="relationship"
              trailing={
                c.status === 'pending' ? (
                  <Button variant="quiet" onClick={() => setCancelTarget(c)}>
                    {t(copy.caregiving.f1CancelAction, locale)}
                  </Button>
                ) : c.status === 'active' ? (
                  <Button variant="secondary" onClick={() => setRevokeTarget(c)}>
                    {t(copy.caregiving.f1RevokeAction, locale)}
                  </Button>
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      <p className="type-caption">{t(copy.caregiving.f1NeutralNote, locale)}</p>

      {inviting && <InviteSheet patientId={patientId} locale={locale} onDone={closeInvite} />}

      <Sheet
        open={!!cancelTarget}
        title={interpolate(t(copy.caregiving.f1CancelSheetTitleTemplate, locale), { name: cancelTarget?.name ?? '' })}
        onClose={() => setCancelTarget(null)}
        closeLabel={t(copy.caregiving.f1CloseSheetLabel, locale)}
        footer={
          <>
            <Button variant="danger" fullWidth lang={locale} loading={pending} onClick={confirmCancel}>
              {t(copy.caregiving.f1CancelAction, locale)}
            </Button>
            <Button variant="quiet" fullWidth lang={locale} onClick={() => setCancelTarget(null)} disabled={pending}>
              {t(copy.caregiving.f1SheetDismiss, locale)}
            </Button>
          </>
        }
      >
        <DetailRow label={t(copy.caregiving.f1RelationshipLabel, locale)} value={cancelTarget?.relationship} lang={locale} />
        <p className="type-body">{t(copy.caregiving.f1CancelSheetBody, locale)}</p>
      </Sheet>

      <Sheet
        open={!!revokeTarget}
        title={interpolate(t(copy.caregiving.f1RevokeSheetTitleTemplate, locale), { name: revokeTarget?.name ?? '' })}
        onClose={() => setRevokeTarget(null)}
        closeLabel={t(copy.caregiving.f1CloseSheetLabel, locale)}
        footer={
          <>
            <Button variant="danger" fullWidth lang={locale} loading={pending} onClick={confirmRevoke}>
              {t(copy.caregiving.f1RevokeAction, locale)}
            </Button>
            <Button variant="quiet" fullWidth lang={locale} onClick={() => setRevokeTarget(null)} disabled={pending}>
              {t(copy.caregiving.f1SheetDismiss, locale)}
            </Button>
          </>
        }
      >
        <DetailRow label={t(copy.caregiving.f1RelationshipLabel, locale)} value={revokeTarget?.relationship} lang={locale} />
        <p className="type-body">{t(copy.caregiving.f1RevokeSheetBody, locale)}</p>
      </Sheet>
    </div>
  );
}
