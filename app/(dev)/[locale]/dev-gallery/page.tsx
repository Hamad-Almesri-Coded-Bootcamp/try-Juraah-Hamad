import Link from 'next/link';
import { GalleryPage } from './_gallery';

const GROUPS = [
  ['a', 'Actions + Forms — Button · IconButton · TextField · Select · Toggle · ChoiceGroup · PhotoInput · CopyField'],
  ['b', 'Data display — Card · PrescriptionCard · StatusPill · SectorChip · DetailRow · DepletionMeter · DoseRow · ScheduleGroup · DoseTimeline · AlertRow · ActivityRow · MenuRow'],
  ['c', 'Feedback — InteractionAlert · InlineNotice · EmptyState · LoadingState · ErrorState · Countdown · StepIndicator · ContextBanner'],
  ['d', 'Navigation + Overlays — AppBar · TabBar · Sheet'],
] as const;

export default async function GalleryIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <GalleryPage title="Components gallery (dev only)">
      <ul style={{ display: 'grid', gap: 'var(--space-3)', padding: 0, listStyle: 'none' }}>
        {GROUPS.map(([g, label]) => (
          <li key={g}>
            <Link href={`/${locale}/dev-gallery/${g}`} className="type-body-strong">{label}</Link>
          </li>
        ))}
      </ul>
      <p className="type-body-small">Open the same page under /ar and /en, at 390 and 1440. Every state, no shell chrome.</p>
    </GalleryPage>
  );
}
