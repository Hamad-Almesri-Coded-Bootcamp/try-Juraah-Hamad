'use client';

/**
 * WP2a gallery — Actions + Forms. Every component in every state named in docs/briefs/WP2a.md,
 * with real seed content (drugs, facilities, masked-name-free copy) and no invented data. Dev-only:
 * literal strings are allowed here and nowhere else in components/ or app/ (see WP2-common.md).
 *
 * A client component (not the usual async server page) because Toggle, ChoiceGroup, the "filled"
 * TextField and the "chosen" Select all need a real onChange to stay controlled — a controlled
 * input with no onChange is a console error, and the gallery's own acceptance bar is zero console
 * errors. `params` is unwrapped with React's `use()`, the documented way for a client page
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md).
 */
import { use, useState } from 'react';
import dynamic from 'next/dynamic';
import { GalleryPage, Section, Example } from '../_gallery';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { TextField } from '@/components/ui/TextField';
import { Select } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';
import { ChoiceGroup } from '@/components/ui/ChoiceGroup';
import { PhotoInput } from '@/components/ui/PhotoInput';
import { CopyField } from '@/components/ui/CopyField';
import { InteractionAlert } from '@/components/ui/InteractionAlert';
import { isLocale, type Locale } from '@/i18n';

// Kept out of server rendering — see ./_photo-demo.tsx's own comment for why a File-backed
// PhotoInput preview specifically needs this.
const PhotoDemo = dynamic(() => import('./_photo-demo'), { ssr: false });

export default function GalleryA({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = use(params);
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'en';
  const L = (ar: string, en: string) => (locale === 'ar' ? ar : en);

  // Controlled-state examples — each Example below that isn't read-only owns its own useState so
  // it stays a real controlled control (no value-without-onChange console warning).
  const [textFilled, setTextFilled] = useState('حمد سالم المطيري');
  const [civilId, setCivilId] = useState(''); // never a seed Civil ID — an empty field, per brief
  const [selectChosen, setSelectChosen] = useState('telegram');
  const [selectPlaceholder, setSelectPlaceholder] = useState('');
  const [checkinOn, setCheckinOn] = useState(true);
  const [refillOn, setRefillOn] = useState(true);
  const [freq, setFreq] = useState('daily');
  const [channel, setChannel] = useState('telegram');

  const [photo, setPhoto] = useState<File | null>(null);

  const SELECT_OPTIONS = [
    { value: 'telegram', label: L('تيليقرام', 'Telegram') },
    { value: 'none', label: L('بدون', 'None') },
  ];

  const CHANNEL_OPTIONS = [
    { value: 'telegram', label: L('تيليقرام', 'Telegram'), description: L('تنبيهات ومتابعة يومية', 'Alerts and daily check-ins') },
    { value: 'email', label: L('البريد الإلكتروني', 'Email'), description: L('تنبيهات فقط', 'Alerts only') },
  ];

  return (
    <GalleryPage title={`${L('المعرض أ — الإجراءات والنماذج', 'Gallery A — Actions + Forms')} (${locale})`}>
      {/* ---------------------------------------------------------------- Button */}
      <Section title="Button">
        <Example caption="variant × size — primary, secondary, danger, quiet at md and lg">
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {(['primary', 'secondary', 'danger', 'quiet'] as const).map((variant) => (
              <div key={variant} style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                <Button variant={variant} lang={locale}>
                  {L('متابعة', 'Continue')}
                </Button>
                <Button variant={variant} size="lg" lang={locale}>
                  {L('متابعة', 'Continue')}
                </Button>
              </div>
            ))}
          </div>
        </Example>
        <Example caption="loading — aria-busy, disabled, the label stays, the icon becomes a spinner">
          <Button variant="primary" size="lg" loading lang={locale}>
            {L('جارٍ الإرسال', 'Sending')}
          </Button>
        </Example>
        <Example caption="disabled">
          <Button variant="primary" disabled lang={locale}>
            {L('متابعة', 'Continue')}
          </Button>
        </Example>
        <Example caption="fullWidth — the phone-width default for a primary action">
          <Button variant="primary" size="lg" fullWidth lang={locale}>
            {L('أرسل للمراجعة', 'Send for review')}
          </Button>
        </Example>
        <Example caption="with a leading icon (camera, from AddPrescription)">
          <Button variant="secondary" icon="camera" lang={locale}>
            {L('تصوير', 'Take a photo')}
          </Button>
        </Example>
        <Example caption="two equal-weight lg/fullWidth buttons — InviteConsent's accept/decline">
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button variant="primary" size="lg" fullWidth lang={locale}>
              {L('قبول', 'Accept')}
            </Button>
            <Button variant="secondary" size="lg" fullWidth lang={locale}>
              {L('رفض', 'Decline')}
            </Button>
          </div>
        </Example>
        <Example caption="secondary/quiet inside a danger fill — AlertDanger's on-fill button treatment (ia-001, Warfarin × Ibuprofen)">
          <InteractionAlert
            severity="danger"
            reviewStatus="pending_medical_review"
            titleId="gallery-a-alert-title"
            title={L('Warfarin مع Ibuprofen', 'Warfarin with Ibuprofen')}
            description={L('الاثنين مع بعض يزيدون خطر النزيف بشكل كبير.', 'Together, they significantly raise the risk of bleeding.')}
            drugs={[L('Warfarin 5 mg — مستشفى الفروانية', 'Warfarin 5 mg — Al Farwaniya Hospital'), L('Ibuprofen 400 mg — عيادة النخبة الطبية', 'Ibuprofen 400 mg — Al Nukhba Medical Clinic')]}
            lang={locale}
            actions={
              <>
                <Button variant="secondary" lang={locale}>
                  {L('افتح تفاصيل التعارض', 'Open interaction details')}
                </Button>
                <Button variant="quiet" lang={locale}>
                  {L('لاحقًا', 'Later')}
                </Button>
              </>
            }
          />
        </Example>
      </Section>

      {/* ------------------------------------------------------------- IconButton */}
      <Section title="IconButton">
        <Example caption="quiet, primary, secondary, danger">
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <IconButton icon="close" label={L('إغلاق', 'Close')} variant="quiet" />
            <IconButton icon="check" label={L('تأكيد', 'Confirm')} variant="primary" />
            <IconButton icon="refresh" label={L('تحديث', 'Refresh')} variant="secondary" />
            <IconButton icon="trash" label={L('سحب صلاحية مقدّم الرعاية', "Revoke the caregiver's access")} variant="danger" />
          </div>
        </Example>
        <Example caption="as a real link (href) — a back control">
          <IconButton icon="chevron" mirrorIcon label={L('رجوع للوحة الأدوية', 'Back to medications')} href="#" />
        </Example>
      </Section>

      {/* -------------------------------------------------------------- TextField */}
      <Section title="TextField">
        <Example caption="default (empty)">
          <TextField label={L('اسم مقدّم الرعاية', "Caregiver's name")} value="" onChange={() => {}} />
        </Example>
        <Example caption="filled">
          <TextField label={L('الاسم', 'Name')} value={textFilled} onChange={(e) => setTextFilled(e.target.value)} />
        </Example>
        <Example caption="with helper text">
          <TextField label={L('رقم التواصل (اختياري)', 'Contact number (optional)')} value="" onChange={() => {}} helperText={L('يُستخدم فقط عند الحاجة للتواصل', 'Used only if we need to reach you')} />
        </Example>
        <Example caption="error — role=alert, aria-invalid, warning glyph">
          <TextField
            label={L('الرقم المدني', 'Civil ID')}
            value="299999900000"
            onChange={() => {}}
            dir="ltr"
            inputMode="numeric"
            error={L('هذا الرقم غير موجود في القائمة التجريبية لهذه النسخة', 'This Civil ID is not in the demo record set')}
          />
        </Example>
        <Example caption="disabled">
          <TextField label={L('القطاع', 'Sector')} value={L('قطاع عام', 'Public sector')} onChange={() => {}} disabled />
        </Example>
        <Example caption="required">
          <TextField label={L('الاسم اللي تعرفه به', 'The name you know them by')} value="" onChange={() => {}} required />
        </Example>
        <Example caption="dir=&quot;ltr&quot; inside an Arabic screen — Civil-ID-shaped input, empty, never a seed Civil ID">
          <TextField label={L('الرقم المدني', 'Civil ID')} value={civilId} onChange={(e) => setCivilId(e.target.value)} dir="ltr" inputMode="numeric" />
        </Example>
      </Section>

      {/* ------------------------------------------------------------------ Select */}
      <Section title="Select">
        <Example caption="placeholder (value empty)">
          <Select label={L('قناة التواصل', 'Notification channel')} value={selectPlaceholder} onChange={(e) => setSelectPlaceholder(e.target.value)} options={SELECT_OPTIONS} placeholder={L('اختر قناة', 'Choose a channel')} />
        </Example>
        <Example caption="chosen">
          <Select label={L('قناة التواصل', 'Notification channel')} value={selectChosen} onChange={(e) => setSelectChosen(e.target.value)} options={SELECT_OPTIONS} />
        </Example>
        <Example caption="error">
          <Select label={L('قناة التواصل', 'Notification channel')} value="telegram" onChange={() => {}} options={SELECT_OPTIONS} error={L('اختر قناة صالحة', 'Choose a valid channel')} />
        </Example>
        <Example caption="disabled — value derived, never a choice">
          <Select label={L('القطاع', 'Sector')} value="public" onChange={() => {}} options={[{ value: 'public', label: L('قطاع عام', 'Public sector') }]} disabled helperText={L('يُشتق من مصدر الوصفة', "Derived from the prescription's source")} />
        </Example>
      </Section>

      {/* ------------------------------------------------------------------ Toggle */}
      <Section title="Toggle">
        <Example caption="on">
          <Toggle label={L('رسائل متابعة الجرعات', 'Daily adherence check-in')} checked={checkinOn} onChange={setCheckinOn} lang={locale} />
        </Example>
        <Example caption="off">
          <Toggle label={L('مزامنة التقويم', 'Calendar sync')} checked={false} onChange={() => {}} lang={locale} />
        </Example>
        <Example caption="with description — the soft warning a muted check-in needs">
          <Toggle
            label={L('رسائل متابعة الجرعات', 'Daily adherence check-in')}
            description={L('إيقافها يقلل دقة متابعة الالتزام بالجرعات.', 'Turning this off reduces adherence-tracking accuracy.')}
            checked={refillOn}
            onChange={setRefillOn}
            lang={locale}
          />
        </Example>
        <Example caption="disabled">
          <Toggle label={L('تنبيهات قرب نهاية الكمية', 'Refill alerts')} checked disabled onChange={() => {}} lang={locale} />
        </Example>
      </Section>

      {/* ------------------------------------------------------------- ChoiceGroup */}
      <Section title="ChoiceGroup">
        <Example caption="segmented (3 options) — MedicinesPast's filter shape">
          <ChoiceGroup
            variant="segmented"
            name="rxfilter"
            label={L('عرض الوصفات', 'Show prescriptions')}
            value={freq}
            onChange={setFreq}
            options={[
              { value: 'active', label: L('نشطة', 'Active') },
              { value: 'daily', label: L('يومية', 'Daily') },
              { value: 'past', label: L('السابقة', 'Past') },
            ]}
          />
        </Example>
        <Example caption="radio (with descriptions) — Settings' notification channel">
          <ChoiceGroup variant="radio" name="channel" label={L('قناة التواصل', 'Notification channel')} value={channel} onChange={setChannel} options={CHANNEL_OPTIONS} />
        </Example>
      </Section>

      {/* --------------------------------------------------------------- PhotoInput */}
      <Section title="PhotoInput">
        <Example caption="idle — take a photo / choose a photo, both real file inputs at 48px">
          <PhotoInput value={null} onChange={setPhoto} label={L('صورة الوصفة', 'Photo of the prescription')} lang={locale} />
          {photo && (
            <p className="type-caption" style={{ color: 'var(--ink-muted)', marginBlockStart: 'var(--space-2)' }}>
              {L('اخترت: ', 'Chosen: ')}
              {photo.name}
            </p>
          )}
        </Example>
        <Example caption="preview — a placeholder image drawn in code (never a real photo), with Remove">
          <PhotoDemo state="preview" label={L('صورة الوصفة', 'Photo of the prescription')} lang={locale} />
        </Example>
        <Example caption="analysing — busy, no control remains to press">
          <PhotoDemo state="analysing" label={L('صورة علبة الدواء', 'Photo of the medicine packet')} lang={locale} />
        </Example>
      </Section>

      {/* ---------------------------------------------------------------- CopyField */}
      <Section title="CopyField">
        <Example caption="idle / copied — سارة's calendar link shape, a placeholder token, never a real one">
          <CopyField label={L('رابط التقويم', 'Calendar link')} value="webcal://jurah.app/ics/[TOKEN]" lang={locale} />
          <p className="type-caption" style={{ color: 'var(--ink-muted)', marginBlockStart: 'var(--space-2)' }}>
            {L('اضغط «نسخ» لترى حالة التأكيد.', 'Press “Copy” to see the confirmed state.')}
          </p>
        </Example>
      </Section>
    </GalleryPage>
  );
}
