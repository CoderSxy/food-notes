import type { EntryPage } from "@/lib/entry-types";

export function nextListAfterDelete(
  data: EntryPage,
  id: string,
  page: number,
): { data: EntryPage; bumpPage: number | null } {
  const entries = data.entries.filter((entry) => entry.id !== id);
  const total = Math.max(0, data.total - 1);
  const emptiedLaterPage = entries.length === 0 && page > 1;
  return {
    data: { ...data, entries, total },
    bumpPage: emptiedLaterPage ? page - 1 : null,
  };
}
