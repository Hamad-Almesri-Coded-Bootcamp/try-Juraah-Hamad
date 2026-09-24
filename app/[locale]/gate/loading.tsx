import { LoadingState } from '@/components/ui/LoadingState';

/** A0's skeleton — shown by Next while the session gate's Server Component resolves its redirect,
 * so a decision in progress is never a blank screen (SCREENS.md: "always a skeleton, never blank"). */
export default function GateLoading() {
  return (
    // A moment on the way to the right shell: no assistant flashes here.
    <main className="mx-auto flex min-h-dvh max-w-content flex-col justify-center p-3 tablet:p-5" data-no-assistant="">
      <LoadingState variant="lines" rows={4} />
    </main>
  );
}
