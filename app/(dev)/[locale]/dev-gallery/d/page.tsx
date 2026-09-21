'use client';

/**
 * WP2d gallery — Navigation + Overlays: AppBar, TabBar, Sheet. Every component in every state named
 * in docs/briefs/WP2d.md's GALLERY STATES, with real seed content (docs/Seed Dataset.md) and the exact
 * G8 shell item sets, in the page's own locale. Dev-only: literal strings are allowed here and nowhere
 * else (app/(dev)/** is exempt from guard 7 and eslint jsx-no-literals).
 *
 * A client component (not the usual async server page reading `params` as a Promise) because Sheet
 * needs local state to demonstrate open/close, focus-trap and Escape/scrim behaviour live in the
 * gallery; `useParams` is the client-component way to read the locale segment (Next's own docs,
 * node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-params.md).
 */
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { GalleryPage, Section, Example } from '../_gallery';
import { AppBar } from '@/components/ui/AppBar';
import { TabBar, type TabBarItem } from '@/components/ui/TabBar';
import { Sheet } from '@/components/ui/Sheet';

type GalleryLocale = 'ar' | 'en';

const TEXT = {
  ar: {
    pageTitle: 'التنقل والحوارات (د)',
    appbarTitleOnly: 'شريط العنوان — عنوان فقط',
    appbarWithBack: 'شريط العنوان — مع زر رجوع',
    appbarWithBackLink: 'شريط العنوان — مع رابط رجوع',
    appbarWithAction: 'شريط العنوان — مع إجراء بعد',
    today: 'اليوم',
    prescriptionTitle: 'وارفارين ٥ ملغ',
    backLabel: 'رجوع للوحة الأدوية',
    languageSwitch: 'English',
    tabbarPatientBottom: 'المريض — شريط سفلي، بدون شارة',
    tabbarPatientBottomBadge: 'المريض — شريط سفلي، مع شارة على «المزيد»',
    tabbarPatientSide: 'المريض — قائمة جانبية',
    tabbarCaregiverBottom: 'مقدّم الرعاية — شريط سفلي',
    tabbarCaregiverSide: 'مقدّم الرعاية — قائمة جانبية',
    tabbarClinicBottom: 'العيادة — شريط سفلي، مع شارة على «مراجعة»',
    tabbarClinicSide: 'العيادة — قائمة جانبية',
    patientNavLabel: 'التنقل الرئيسي',
    caregiverNavLabel: 'تنقل مقدّم الرعاية',
    clinicNavLabel: 'تنقل العيادة',
    todayLabel: 'اليوم',
    medicinesLabel: 'أدويتي',
    safetyLabel: 'السلامة',
    moreLabel: 'المزيد',
    caregiverMedicinesLabel: 'الأدوية',
    reviewLabel: 'مراجعة',
    auditLabel: 'تدقيق',
    sheetClosedCaption: 'مغلقة — الزر الذي يفتحها',
    sheetOpenAsSheetCaption: 'كورقة سفلية عند الفتح (mode="sheet")',
    sheetOpenAsModalCaption: 'كنافذة مركزية عند الفتح (mode="modal")',
    sheetFooterWeightCaption: 'أزرار التذييل بنفس الوزن البصري عند الفتح',
    openTrigger: 'اطلب تعبئة الدواء',
    openModalTrigger: 'سحب صلاحية عبدالله',
    openEqualWeightTrigger: 'افتح دعوة فاطمة',
    refillSheetTitle: 'تأكيد طلب التعبئة',
    refillLine1: 'ميتفورمين (Glucophage) ٥٠٠ ملغ',
    refillLine2: 'يُرسل الطلب إلى مستشفى الفروانية — القطاع العام',
    close: 'إغلاق',
    cancel: 'إلغاء',
    confirmRefill: 'تأكيد الطلب',
    revokeSheetTitle: 'سحب صلاحية مقدّم الرعاية',
    revokeLine1: 'عبدالله محمد عبدالعزيز المطيري',
    revokeLine2: 'لن يشوف بعدها جدول الجرعات ولا التنبيهات.',
    revoke: 'سحب الصلاحية',
    equalWeightTitle: 'قبول أو رفض الدعوة',
    equalWeightLine: 'القرار هذا ما يُسأل عنه مرة ثانية.',
    accept: 'أوافق',
    decline: 'أرفض',
  },
  en: {
    pageTitle: 'Navigation + overlays (d)',
    appbarTitleOnly: 'AppBar — title only',
    appbarWithBack: 'AppBar — with a back button',
    appbarWithBackLink: 'AppBar — with a back link',
    appbarWithAction: 'AppBar — with a trailing action',
    today: 'Today',
    prescriptionTitle: 'Warfarin 5 mg',
    backLabel: 'Back to medications',
    languageSwitch: 'العربية',
    tabbarPatientBottom: 'Patient — bottom bar, no badge',
    tabbarPatientBottomBadge: 'Patient — bottom bar, badge on More',
    tabbarPatientSide: 'Patient — side rail',
    tabbarCaregiverBottom: 'Caregiver — bottom bar',
    tabbarCaregiverSide: 'Caregiver — side rail',
    tabbarClinicBottom: 'Clinic — bottom bar, badge on Review',
    tabbarClinicSide: 'Clinic — side rail',
    patientNavLabel: 'Main navigation',
    caregiverNavLabel: 'Caregiver navigation',
    clinicNavLabel: 'Clinic navigation',
    todayLabel: 'Today',
    medicinesLabel: 'My Medicines',
    safetyLabel: 'Safety',
    moreLabel: 'More',
    caregiverMedicinesLabel: 'Medicines',
    reviewLabel: 'Review',
    auditLabel: 'Audit',
    sheetClosedCaption: 'Closed — the trigger that opens it',
    sheetOpenAsSheetCaption: 'Opens as a bottom sheet (mode="sheet")',
    sheetOpenAsModalCaption: 'Opens as a centred modal (mode="modal")',
    sheetFooterWeightCaption: 'Opens with footer buttons of equal visual weight',
    openTrigger: 'Request a refill',
    openModalTrigger: "Revoke Abdullah's access",
    openEqualWeightTrigger: "Open Fatima's invitation",
    refillSheetTitle: 'Confirm the refill request',
    refillLine1: 'Metformin (Glucophage) 500 mg',
    refillLine2: 'The request goes to Al Farwaniya Hospital — public sector',
    close: 'Close',
    cancel: 'Cancel',
    confirmRefill: 'Confirm request',
    revokeSheetTitle: "Revoke the caregiver's access",
    revokeLine1: 'Abdullah Mohammed Abdulaziz Al-Mutairi',
    revokeLine2: 'They will no longer see the dose schedule or alerts.',
    revoke: 'Revoke access',
    equalWeightTitle: 'Accept or decline the invitation',
    equalWeightLine: 'This decision is not asked again.',
    accept: 'Accept',
    decline: 'Decline',
  },
} as const satisfies Record<GalleryLocale, Record<string, string>>;

type GalleryText = Record<keyof (typeof TEXT)['ar'], string>;

function patientItems(t: GalleryText, badge?: number): [TabBarItem, TabBarItem, TabBarItem, TabBarItem] {
  return [
    { id: 'today', label: t.todayLabel, icon: 'home' },
    { id: 'medicines', label: t.medicinesLabel, icon: 'capsule' },
    { id: 'safety', label: t.safetyLabel, icon: 'shield' },
    { id: 'more', label: t.moreLabel, icon: 'settings', badge },
  ];
}

function caregiverItems(t: GalleryText): [TabBarItem, TabBarItem, TabBarItem] {
  return [
    { id: 'today', label: t.todayLabel, icon: 'home' },
    { id: 'medicines', label: t.caregiverMedicinesLabel, icon: 'capsule' },
    { id: 'more', label: t.moreLabel, icon: 'settings' },
  ];
}

function clinicItems(t: GalleryText, badge?: number): [TabBarItem, TabBarItem] {
  return [
    { id: 'review', label: t.reviewLabel, icon: 'review', badge },
    { id: 'audit', label: t.auditLabel, icon: 'search' },
  ];
}

export default function GalleryD() {
  const params = useParams<{ locale: string }>();
  const locale: GalleryLocale = params.locale === 'en' ? 'en' : 'ar';
  const t = TEXT[locale];

  const [refillOpen, setRefillOpen] = useState(false);
  const [sheetModeOpen, setSheetModeOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [equalWeightOpen, setEqualWeightOpen] = useState(false);

  return (
    <>
      {/*
        The shared dev-gallery layout (app/(dev)/[locale]/dev-gallery/layout.tsx, lead-owned, not a
        WP2d file) renders no <title>, which axe's wcag2a "document-title" rule requires. React 19
        hoists a <title> rendered anywhere in the tree into <head> on its own, so it is added here
        rather than by editing the shared layout.
      */}
      <title>{t.pageTitle}</title>
      <GalleryPage title={t.pageTitle}>
        <Section title="AppBar">
        <Example caption={t.appbarTitleOnly}>
          <AppBar title={t.today} />
        </Example>
        <Example caption={t.appbarWithBack}>
          <AppBar title={t.prescriptionTitle} onBack={() => {}} backLabel={t.backLabel} />
        </Example>
        <Example caption={t.appbarWithBackLink}>
          <AppBar title={t.prescriptionTitle} backHref={`/${locale}/app/medicines`} backLabel={t.backLabel} />
        </Example>
        <Example caption={t.appbarWithAction}>
          <AppBar
            title={t.today}
            action={
              <button type="button" className="wsf-btn wsf-btn--quiet wsf-focus">
                {t.languageSwitch}
              </button>
            }
          />
        </Example>
      </Section>

      <Section title="TabBar">
        <Example caption={t.tabbarPatientBottom}>
          <TabBar items={patientItems(t)} value="today" layout="bottom" label={t.patientNavLabel} />
        </Example>
        <Example caption={t.tabbarPatientBottomBadge}>
          <TabBar items={patientItems(t, 1)} value="more" layout="bottom" label={t.patientNavLabel} />
        </Example>
        <Example caption={t.tabbarPatientSide}>
          <TabBar items={patientItems(t)} value="safety" layout="side" label={t.patientNavLabel} />
        </Example>
        <Example caption={t.tabbarCaregiverBottom}>
          <TabBar items={caregiverItems(t)} value="medicines" layout="bottom" label={t.caregiverNavLabel} />
        </Example>
        <Example caption={t.tabbarCaregiverSide}>
          <TabBar items={caregiverItems(t)} value="more" layout="side" label={t.caregiverNavLabel} />
        </Example>
        <Example caption={t.tabbarClinicBottom}>
          <TabBar items={clinicItems(t, 2)} value="review" layout="bottom" label={t.clinicNavLabel} />
        </Example>
        <Example caption={t.tabbarClinicSide}>
          <TabBar items={clinicItems(t)} value="audit" layout="side" label={t.clinicNavLabel} />
        </Example>
      </Section>

      <Section title="Sheet">
        {/*
          Every Sheet example below defaults CLOSED and is opened by its own trigger + local state,
          rather than several Sheets mounted permanently open: Sheet.md's own rule is "Two at once...
          one decision at a time", and Sheet locks page-level body scroll for as long as it is open
          (bundle behaviour), so multiple always-open instances would make this gallery page itself
          unscrollable. The open/trap/Escape/scrim/restore-focus contract is exercised directly, and
          more thoroughly, by components/ui/Sheet.test.tsx; here each state is one click away.
        */}
        <Example caption={t.sheetClosedCaption}>
          <div style={{ position: 'relative' }}>
            <button type="button" className="wsf-btn wsf-btn--primary wsf-focus" onClick={() => setRefillOpen(true)}>
              {t.openTrigger}
            </button>
            <Sheet open={refillOpen} onClose={() => setRefillOpen(false)} title={t.refillSheetTitle} closeLabel={t.close} mode="sheet">
              <p className="type-body-strong">{t.refillLine1}</p>
              <p className="type-body">{t.refillLine2}</p>
            </Sheet>
          </div>
        </Example>

        <Example caption={t.sheetOpenAsSheetCaption}>
          <div style={{ position: 'relative' }}>
            <button type="button" className="wsf-btn wsf-btn--secondary wsf-focus" onClick={() => setSheetModeOpen(true)}>
              {t.openTrigger}
            </button>
            <Sheet
              open={sheetModeOpen}
              onClose={() => setSheetModeOpen(false)}
              title={t.refillSheetTitle}
              closeLabel={t.close}
              mode="sheet"
              footer={
                <>
                  <button type="button" className="wsf-btn wsf-btn--secondary wsf-focus" onClick={() => setSheetModeOpen(false)}>
                    {t.cancel}
                  </button>
                  <button type="button" className="wsf-btn wsf-btn--primary wsf-focus" onClick={() => setSheetModeOpen(false)}>
                    {t.confirmRefill}
                  </button>
                </>
              }
            >
              <p className="type-body-strong">{t.refillLine1}</p>
              <p className="type-body">{t.refillLine2}</p>
            </Sheet>
          </div>
        </Example>

        <Example caption={t.sheetOpenAsModalCaption}>
          <div style={{ position: 'relative' }}>
            <button type="button" className="wsf-btn wsf-btn--danger wsf-focus" onClick={() => setModalOpen(true)}>
              {t.openModalTrigger}
            </button>
            <Sheet
              open={modalOpen}
              onClose={() => setModalOpen(false)}
              title={t.revokeSheetTitle}
              closeLabel={t.close}
              mode="modal"
              footer={
                <>
                  <button type="button" className="wsf-btn wsf-btn--secondary wsf-focus" onClick={() => setModalOpen(false)}>
                    {t.cancel}
                  </button>
                  <button type="button" className="wsf-btn wsf-btn--danger wsf-focus" onClick={() => setModalOpen(false)}>
                    {t.revoke}
                  </button>
                </>
              }
            >
              <p className="type-body-strong">{t.revokeLine1}</p>
              <p className="type-body">{t.revokeLine2}</p>
            </Sheet>
          </div>
        </Example>

        <Example caption={t.sheetFooterWeightCaption}>
          <div style={{ position: 'relative' }}>
            <button type="button" className="wsf-btn wsf-btn--secondary wsf-focus" onClick={() => setEqualWeightOpen(true)}>
              {t.openEqualWeightTrigger}
            </button>
            <Sheet
              open={equalWeightOpen}
              onClose={() => setEqualWeightOpen(false)}
              title={t.equalWeightTitle}
              closeLabel={t.close}
              mode="auto"
              footer={
                <>
                  <button type="button" className="wsf-btn wsf-btn--secondary wsf-btn--lg wsf-focus" onClick={() => setEqualWeightOpen(false)}>
                    {t.decline}
                  </button>
                  <button type="button" className="wsf-btn wsf-btn--primary wsf-btn--lg wsf-focus" onClick={() => setEqualWeightOpen(false)}>
                    {t.accept}
                  </button>
                </>
              }
            >
              <p className="type-body">{t.equalWeightLine}</p>
            </Sheet>
          </div>
        </Example>
      </Section>
      </GalleryPage>
    </>
  );
}
