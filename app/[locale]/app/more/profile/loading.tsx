import { LoadingState } from '@/components/ui/LoadingState';

/** A3's skeleton while its five parallel reads resolve (G7 — never blank). It sits inside the shell,
 * where the content starts, like the shell's own skeleton (the dock and rail stay on screen). */
export default function ProfileLoading() {
  return (
    <div className="flex flex-col gap-4 p-3 pt-6 tablet:p-5" aria-busy="true">
      <LoadingState variant="detail" />
    </div>
  );
}
