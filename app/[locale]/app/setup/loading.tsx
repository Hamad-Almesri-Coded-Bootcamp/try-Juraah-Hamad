import { LoadingState } from '@/components/ui/LoadingState';

/** A2's skeleton while `getSession`/`getPatient` resolve (G7 — never blank). The step flow itself
 * has its own inner Suspense fallback (`SetupFlow`'s, for `useSearchParams`, D-008) once mounted. */
export default function SetupLoading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-content flex-col justify-center p-3">
      <LoadingState variant="detail" />
    </main>
  );
}
