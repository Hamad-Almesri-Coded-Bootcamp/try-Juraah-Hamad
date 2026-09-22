import { LoadingState } from '@/components/ui/LoadingState';

/** G2s's skeleton while `getAlertForReview` resolves (G7 — never blank). */
export default function ReviewerDecisionLoading() {
  return (
    <main className="flex min-h-full flex-col gap-3 p-3 tablet:p-5">
      <LoadingState variant="detail" />
    </main>
  );
}
