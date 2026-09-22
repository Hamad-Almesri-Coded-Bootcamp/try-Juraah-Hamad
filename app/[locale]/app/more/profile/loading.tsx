import { LoadingState } from '@/components/ui/LoadingState';

/** A3's skeleton while its five parallel reads resolve (G7 — never blank). */
export default function ProfileLoading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-content flex-col justify-center p-3 tablet:p-5">
      <LoadingState variant="detail" />
    </main>
  );
}
