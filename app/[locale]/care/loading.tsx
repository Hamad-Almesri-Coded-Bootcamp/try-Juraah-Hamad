import { LoadingState } from '@/components/ui/LoadingState';

/**
 * The shell's skeleton while a screen's Server Component resolves (UX §5: a skeleton shaped like the
 * content, never a blank screen). The shell itself (dock, rail) stays on screen around it, so a tab
 * change answers at once and the content fades in when it arrives.
 */
export default function ShellLoading() {
  return (
    <div className="flex flex-col gap-4 p-3 pt-6 tablet:p-5" aria-busy="true">
      <LoadingState variant="list" rows={4} />
    </div>
  );
}
