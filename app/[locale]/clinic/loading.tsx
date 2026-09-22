import { LoadingState } from '@/components/ui/LoadingState';

/** X0's skeleton while its Server Component resolves (G7 — never blank). */
export default function ClinicEntryLoading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-content flex-col justify-center p-3 tablet:p-5">
      <LoadingState variant="lines" rows={4} />
    </main>
  );
}
