import { LoadingState } from '@/components/ui/LoadingState';

/** G1s/G3s's skeleton while `getReviewQueue`/`getFieldConfirmationQueue` resolve (G7 — never blank). */
export default function ReviewQueueLoading() {
  return (
    <main className="flex min-h-full flex-col gap-3 p-3">
      <LoadingState variant="list" rows={3} />
    </main>
  );
}
