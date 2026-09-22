import { LoadingState } from '@/components/ui/LoadingState';

/** X1's skeleton while `getAuditLog` resolves (G7 — never blank). */
export default function AuditLogLoading() {
  return (
    <main className="flex min-h-full flex-col gap-3 p-3 tablet:p-5">
      <LoadingState variant="list" rows={4} />
    </main>
  );
}
