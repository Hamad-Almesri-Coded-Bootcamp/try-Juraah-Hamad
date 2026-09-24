'use client';

/**
 * F1 — the patient's caregiver list (docs/wireframes/Caregivers.dc.html, overridden per the brief:
 * MenuRow rows, not Card rows — WP4h task brief, "F1: the relationship list as MenuRows"; Daylight,
 * CR-071: every person in one grouped card). Every relationship state renders neutrally via
 * MenuRow's `tone="relationship"` (CLAUDE.md rule 8; MenuRow.md) — no badge, dot or warning colour
 * on pending/declined/expired/revoked. Names are shown as the patient typed them, in the reader's
 * language (`localizePersonName`), never masked: the patient knows who they invited.
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
import { localizePersonName, localizeRelationship } from '@/i18n/localize';
import { interpolate } from '@/features/shell/interpolate';
import type { Locale } from '@/i18n/locale';
import type { CaregiverView } from '@/types/views';

export function CaregiverList({ caregivers, patientId, locale }: { caregivers: CaregiverView[]; patientId: string; locale: Locale }) {
  const router = useRouter();
  const [inviting, setInviting] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<CaregiverView | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<CaregiverView | null>(null);
  const [pending, startTransition] = useTransition();

  const nameOf = (c: CaregiverView | null) => (c ? localizePersonName(c.name, locale) : '');

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
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 p-3 tablet:p-5">
      <Button variant="primary" size="lg" fullWidth lang={locale} icon="plus" onClick={() => setInviting(true)}>
        {t(copy.caregiving.f1InviteButton, locale)}
      </Button>

      {caregivers.length === 0 ? (
        <EmptyState icon="users" title={t(copy.caregiving.f1EmptyTitle, locale)} description={t(copy.caregiving.f1EmptyBody, locale)} />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="jr-group">
            {caregivers.map((c) => (
              <MenuRow
                key={c.id}
                label={nameOf(c)}
                // The patient's word for them, then where the invitation stands: one quiet line,
                // the same shape for every state (no state is a fault).
                description={`${localizeRelationship(c.relationship, locale)} · ${relationshipStateLabel(c, locale)}`}
                tone="relationship"
                trailing={
                  c.status === 'pending' ? (
                    <Button variant="secondary" lang={locale} onClick={() => setCancelTarget(c)}>
                      {t(copy.caregiving.f1CancelAction, locale)}
                    </Button>
                  ) : c.status === 'active' ? (
                    <Button variant="secondary" lang={locale} onClick={() => setRevokeTarget(c)}>
                      {t(copy.caregiving.f1RevokeAction, locale)}
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </div>
          <p className="px-1 type-body-small text-ink-muted">{t(copy.caregiving.f1NeutralNote, locale)}</p>
        </div>
      )}

      {inviting && <InviteSheet patientId={patientId} locale={locale} onDone={closeInvite} />}

      {/* Each confirmation names the consequence in its body. The confirm is the sheet's one navy
          action: red is kept for a drug-interaction finding alone. */}
      <Sheet
        open={!!cancelTarget}
        title={interpolate(t(copy.caregiving.f1CancelSheetTitleTemplate, locale), { name: nameOf(cancelTarget) })}
        onClose={() => setCancelTarget(null)}
        closeLabel={t(copy.caregiving.f1CloseSheetLabel, locale)}
        footer={
          <>
            <Button variant="primary" size="lg" fullWidth lang={locale} loading={pending} onClick={confirmCancel}>
              {t(copy.caregiving.f1CancelAction, locale)}
            </Button>
            <Button variant="quiet" size="lg" fullWidth lang={locale} onClick={() => setCancelTarget(null)} disabled={pending}>
              {t(copy.caregiving.f1SheetDismiss, locale)}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <DetailRow label={t(copy.caregiving.f1RelationshipLabel, locale)} value={localizeRelationship(cancelTarget?.relationship, locale)} lang={locale} />
          <p className="type-body">{t(copy.caregiving.f1CancelSheetBody, locale)}</p>
        </div>
      </Sheet>

      <Sheet
        open={!!revokeTarget}
        title={interpolate(t(copy.caregiving.f1RevokeSheetTitleTemplate, locale), { name: nameOf(revokeTarget) })}
        onClose={() => setRevokeTarget(null)}
        closeLabel={t(copy.caregiving.f1CloseSheetLabel, locale)}
        footer={
          <>
            <Button variant="primary" size="lg" fullWidth lang={locale} loading={pending} onClick={confirmRevoke}>
              {t(copy.caregiving.f1RevokeAction, locale)}
            </Button>
            <Button variant="quiet" size="lg" fullWidth lang={locale} onClick={() => setRevokeTarget(null)} disabled={pending}>
              {t(copy.caregiving.f1SheetDismiss, locale)}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <DetailRow label={t(copy.caregiving.f1RelationshipLabel, locale)} value={localizeRelationship(revokeTarget?.relationship, locale)} lang={locale} />
          <p className="type-body">{t(copy.caregiving.f1RevokeSheetBody, locale)}</p>
        </div>
      </Sheet>
    </div>
  );
}
