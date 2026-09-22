import { LoadingState } from '@/components/ui/LoadingState';

/** A1b's skeleton while `getRoleOptions` resolves (G7 — a shape like what is coming, never blank). */
export default function RoleChooseLoading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-content flex-col justify-center p-3 tablet:p-5">
      <LoadingState variant="lines" rows={3} />
    </main>
  );
}
