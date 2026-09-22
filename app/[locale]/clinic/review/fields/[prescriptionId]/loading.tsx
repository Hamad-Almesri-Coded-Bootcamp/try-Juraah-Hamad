import { LoadingState } from '@/components/ui/LoadingState';

/** G3s detail's skeleton while `getFlaggedPrescription` resolves (G7 — never blank). */
export default function FlaggedPrescriptionLoading() {
  return (
    <main className="flex min-h-full flex-col gap-3 p-3 tablet:p-5">
      <LoadingState variant="detail" />
    </main>
  );
}
