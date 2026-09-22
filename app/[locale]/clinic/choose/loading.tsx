import { LoadingState } from '@/components/ui/LoadingState';

/** X0 chooser's skeleton while its Server Component resolves (G7 — never blank). */
export default function ClinicChooseLoading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-content flex-col justify-center gap-3 p-3 tablet:p-5">
      <LoadingState variant="list" rows={2} />
    </main>
  );
}
