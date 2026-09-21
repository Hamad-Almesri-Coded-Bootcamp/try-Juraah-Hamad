'use client';

import { use, useState } from 'react';
import { GalleryPage, Section, Example } from '../_gallery';
import { InteractionAlert } from '@/components/ui/InteractionAlert';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Countdown } from '@/components/ui/Countdown';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { ContextBanner } from '@/components/ui/ContextBanner';
import { copy, t, isLocale, type Locale } from '@/i18n';
import { REFERENCE_NOW, TO_BE_SUPPLIED } from '@/lib/config';

// Dev-only gallery: literal strings are allowed here and only here (WP2-common). Every value below
// is real seed content (docs/Seed Dataset.md) — no invented drug, facility or masked name.

const SEVERITIES = ['danger', 'warning', 'info'] as const;
const REVIEW_STATES = ['pending_medical_review', 'reviewed', 'auto_cleared'] as const;

// One real interacting pair (or lone drug for the info/auto_cleared record) per severity, held
// fixed across the review-state columns below — the review state varies for the demo matrix, the
// drug identity never does, matching the seed's own list (ia-001 danger, ia-002 warning, ia-003 info).
const ALERT_CONTENT: Record<(typeof SEVERITIES)[number], { title: string; drugs: string[]; description: { ar: string; en: string } }> = {
  danger: {
    title: 'Warfarin × Ibuprofen',
    drugs: ['Warfarin (Marevan) — مستشفى الفروانية', 'Ibuprofen (Brufen) — عيادة النخبة الطبية'],
    description: {
      ar: 'أخذ الوارفارين مع الإيبوبروفين يرفع خطر النزيف.',
      en: 'Taking warfarin with ibuprofen raises the risk of bleeding.',
    },
  },
  warning: {
    title: 'Levothyroxine × Calcium carbonate',
    drugs: ['Levothyroxine (Eltroxin) — مستشفى العدان', 'Calcium carbonate + vitamin D3 — عيادة النخبة الطبية'],
    description: {
      ar: 'الكالسيوم قد يقلل امتصاص اللِفوثيروكسين إذا أُخذا معًا.',
      en: 'Calcium may reduce how much levothyroxine the body absorbs when the two are taken together.',
    },
  },
  info: {
    title: 'Prednisolone',
    drugs: ['Prednisolone — مركز الصباح للأمراض الروماتيزمية'],
    description: {
      ar: 'تم فحص بريدنيزولون مع باقي أدويتك، ولم يوجد تعارض.',
      en: 'Prednisolone was checked against the rest of your medications, and no interaction was found.',
    },
  },
};

function CountdownRunningDemo({ lang }: { lang: Locale }) {
  const [state, setState] = useState<'running' | 'completed' | 'lapsed'>('running');
  return (
    <Countdown
      // A large seconds value so this live-ticking demo cannot reach 'lapsed' mid-scan while an
      // automated check (e.g. axe) is reading the page — the point being demonstrated is the
      // running state's anatomy, not a race against the test runner's own timeout.
      seconds={600}
      state={state}
      lang={lang}
      label={lang === 'ar' ? 'افتح تطبيق هويّاتي ووافق' : 'Open the Hawiati app and approve'}
      onLapse={() => setState('lapsed')}
      onCancel={() => setState('completed')}
    />
  );
}

function CountdownLapsedDemo({ lang }: { lang: Locale }) {
  const [state, setState] = useState<'lapsed' | 'running'>('lapsed');
  return (
    <Countdown
      seconds={25}
      state={state}
      lang={lang}
      label={lang === 'ar' ? 'افتح تطبيق هويّاتي ووافق' : 'Open the Hawiati app and approve'}
      onRetry={() => setState('running')}
      onCancel={() => setState('lapsed')}
    />
  );
}

export default function GalleryC({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = use(params);
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'ar';
  const asOfTime = REFERENCE_NOW.slice(11, 16); // "09:15" — REFERENCE_NOW is the only clock this page reads, and only to format a caption.

  return (
    <GalleryPage title="Feedback — InteractionAlert · InlineNotice · EmptyState · LoadingState · ErrorState · Countdown · StepIndicator · ContextBanner">
      <Section title="InteractionAlert — 3 severities × 3 review states">
        {SEVERITIES.map((severity) =>
          REVIEW_STATES.map((reviewStatus) => {
            const content = ALERT_CONTENT[severity];
            const isDangerPending = severity === 'danger' && reviewStatus === 'pending_medical_review'; // ia-001
            const isWarningReviewed = severity === 'warning' && reviewStatus === 'reviewed'; // ia-002
            return (
              <Example
                key={`${severity}-${reviewStatus}`}
                caption={`${severity} · ${reviewStatus}${isDangerPending ? ' (ia-001, with actions)' : ''}${isWarningReviewed ? ' (ia-002, with the reviewer’s real note)' : ''}`}
              >
                <InteractionAlert
                  severity={severity}
                  reviewStatus={reviewStatus}
                  title={content.title}
                  description={content.description[locale]}
                  drugs={content.drugs}
                  lang={locale}
                  titleId={`ia-${severity}-${reviewStatus}`}
                  actions={
                    isDangerPending ? (
                      <button type="button" className="wsf-btn wsf-btn--secondary wsf-focus">
                        {t(copy.vocabulary.openDetail, locale)}
                      </button>
                    ) : undefined
                  }
                />
                {isDangerPending && (
                  <p className="type-body-small" style={{ background: 'var(--navy-tint)', color: 'var(--navy)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', marginBlockStart: 'var(--space-2)' }}>
                    {locale === 'ar' ? 'المصدر: ' : 'Source: '}
                    {TO_BE_SUPPLIED}
                  </p>
                )}
                {isWarningReviewed && (
                  <p className="type-body-small" style={{ color: 'var(--ink-muted)', marginBlockStart: 'var(--space-2)' }}>
                    {locale === 'ar'
                      ? 'ملاحظة المراجع: تُؤخذ اللِفوثيروكسين على معدة فارغة وتُفصل عن الكالسيوم بأربع ساعات على الأقل'
                      : "Reviewer’s note: take levothyroxine on an empty stomach, separated from calcium by at least four hours."}
                  </p>
                )}
              </Example>
            );
          })
        )}
      </Section>

      <Section title="InlineNotice — tones, with/without title, dismissable">
        <Example caption="info, with title, not dismissable">
          <InlineNotice tone="info" title={locale === 'ar' ? 'محاكاة — ليس ربطًا حقيقيًا' : 'Simulation — not a real link'}>
            {locale === 'ar' ? 'هذي نسخة تجريبية لعرض التدفق فقط.' : 'This is a demo copy, for showing the flow only.'}
          </InlineNotice>
        </Example>
        <Example caption="info, no title, dismissable — the not-connected / off case is info, never warning (§13, CR-012)">
          <InlineNotice
            tone="info"
            onDismiss={() => {}}
            dismissLabel={locale === 'ar' ? 'إخفاء الإشعار' : 'Dismiss notice'}
          >
            {locale === 'ar' ? 'ما توصلك رسائل متابعة الجرعات حتى تربط تيليقرام.' : 'You will not get adherence check-ins until Telegram is connected.'}
          </InlineNotice>
        </Example>
        <Example caption="success, with title">
          <InlineNotice tone="success" title={locale === 'ar' ? 'الإشعارات مفعّلة' : 'Notifications are on'}>
            {locale === 'ar' ? 'الإشعار يفتح الشاشة — وما يسجّل جرعة أبدًا.' : 'A notification opens the screen — it never records a dose.'}
          </InlineNotice>
        </Example>
        <Example caption="warning, no title, dismissable">
          <InlineNotice tone="warning" onDismiss={() => {}} dismissLabel={locale === 'ar' ? 'إخفاء' : 'Dismiss'}>
            {locale === 'ar' ? 'الكمية قاربت تخلص — ٦ أيام باقية.' : 'Running low — about 6 days of supply left.'}
          </InlineNotice>
        </Example>
      </Section>

      <Section title="EmptyState — with action, without">
        <Example caption="with action">
          <EmptyState
            icon="capsule"
            title={locale === 'ar' ? 'ما فيه أدوية نشطة' : 'No active prescriptions'}
            description={locale === 'ar' ? 'أول ما يصرف لك الطبيب وصفة، تظهر هنا مع جدول جرعاتها.' : 'As soon as a clinic issues you a prescription, it appears here with its dose schedule.'}
            action={
              <button type="button" className="wsf-btn wsf-btn--secondary wsf-focus">
                {locale === 'ar' ? 'أضف وصفة بالصورة' : 'Add a prescription by photo'}
              </button>
            }
          />
        </Example>
        <Example caption="without action">
          <EmptyState icon="users" title={locale === 'ar' ? 'ما حد ربطك بملفه' : 'Nobody has linked you to their record'} />
        </Example>
      </Section>

      <Section title="LoadingState — 4 variants">
        <Example caption="list">
          <LoadingState variant="list" rows={3} label={locale === 'ar' ? 'يتم التحميل' : 'Loading'} />
        </Example>
        <Example caption="detail">
          <LoadingState variant="detail" label={locale === 'ar' ? 'يتم التحميل' : 'Loading'} />
        </Example>
        <Example caption="alert">
          <LoadingState variant="alert" label={locale === 'ar' ? 'يتم التحميل' : 'Loading'} />
        </Example>
        <Example caption="lines">
          <LoadingState variant="lines" rows={4} label={locale === 'ar' ? 'يتم التحميل' : 'Loading'} />
        </Example>
      </Section>

      <Section title="ErrorState — with retry, without">
        <Example caption="with retry">
          <ErrorState
            title={locale === 'ar' ? 'ما قدرنا نحدّث القائمة' : 'We could not refresh the list'}
            description={locale === 'ar' ? 'الاتصال انقطع. ما فيه شي انفقد — نعرض لك آخر نسخة محفوظة.' : 'The connection dropped. Nothing has been lost — showing the last saved copy.'}
            onRetry={() => {}}
            retryLabel={locale === 'ar' ? 'حاول مرة ثانية' : 'Try again'}
          />
        </Example>
        <Example caption="without retry">
          <ErrorState
            title={locale === 'ar' ? 'ما قدرنا نتعرف على الدواء' : 'We could not identify this medication'}
            description={locale === 'ar' ? 'صوّر العلبة من الجنب وياليت الإضاءة زينة وكل الحروف واضحة.' : 'Photograph the box from the side, in good light, with every letter visible.'}
          />
        </Example>
      </Section>

      <Section title="Countdown — running, completed, lapsed">
        <Example caption="running (ticking live, from 600 s — high enough that an automated check reading this page cannot outlast it into lapsed)">
          <CountdownRunningDemo lang={locale} />
        </Example>
        <Example caption="completed">
          <Countdown seconds={25} state="completed" lang={locale} label={locale === 'ar' ? 'افتح تطبيق هويّاتي ووافق' : 'Open the Hawiati app and approve'} />
        </Example>
        <Example caption="lapsed (retry restarts it, live)">
          <CountdownLapsedDemo lang={locale} />
        </Example>
      </Section>

      <Section title="StepIndicator — first / middle / last of three; of four">
        <Example caption="1 of 3 (first)">
          <StepIndicator
            steps={locale === 'ar' ? ['اللغة', 'العرض', 'الإنهاء'] : ['Language', 'Offer', 'Closing']}
            current={0}
            label={locale === 'ar' ? 'تقدّم الإعداد الأول' : 'First-run setup progress'}
            lang={locale}
          />
        </Example>
        <Example caption="2 of 3 (middle)">
          <StepIndicator
            steps={locale === 'ar' ? ['اللغة', 'العرض', 'الإنهاء'] : ['Language', 'Offer', 'Closing']}
            current={1}
            label={locale === 'ar' ? 'تقدّم الإعداد الأول' : 'First-run setup progress'}
            lang={locale}
          />
        </Example>
        <Example caption="3 of 3 (last)">
          <StepIndicator
            steps={locale === 'ar' ? ['اللغة', 'العرض', 'الإنهاء'] : ['Language', 'Offer', 'Closing']}
            current={2}
            label={locale === 'ar' ? 'تقدّم الإعداد الأول' : 'First-run setup progress'}
            lang={locale}
          />
        </Example>
        <Example caption="2 of 4">
          <StepIndicator
            steps={locale === 'ar' ? ['اللغة', 'العرض', 'دعوة مقدّم رعاية', 'الإنهاء'] : ['Language', 'Offer', 'Invite a caregiver', 'Closing']}
            current={1}
            label={locale === 'ar' ? 'تقدّم الإعداد الأول' : 'First-run setup progress'}
            lang={locale}
          />
        </Example>
      </Section>

      <Section title="ContextBanner — caregiver, simulated role, last-known data">
        <Example caption='caregiver ("Viewing the record of حمد")'>
          <ContextBanner
            variant="caregiver"
            icon="users"
            title={`${t(copy.vocabulary.viewingRecordOf, locale)} حمد`}
            detail={locale === 'ar' ? 'قراءة فقط' : 'Read-only'}
          />
        </Example>
        <Example caption="simulated role (reviewer)">
          <ContextBanner
            variant="simulated"
            icon="review"
            title={`${t(copy.vocabulary.simulatedRole, locale)} · ${t(copy.vocabulary.actor_reviewer, locale)}`}
          />
        </Example>
        <Example caption="last-known data, with an as-of time from REFERENCE_NOW">
          <ContextBanner
            variant="lastKnown"
            icon="refresh"
            title={locale === 'ar' ? 'تعرض آخر نسخة محفوظة' : 'Showing the last saved copy'}
            detail={`${t(copy.vocabulary.asOf, locale)} ${asOfTime}`}
          />
        </Example>
      </Section>
    </GalleryPage>
  );
}
