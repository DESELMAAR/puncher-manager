import { useEffect, useMemo, useState } from "react";
import { getTotalPages, slicePage, TABLE_PAGE_SIZE } from "@/lib/pagination";

export { TABLE_PAGE_SIZE };

export function useTablePagination<T>(items: T[], resetDeps: unknown[] = []) {
  const [page, setPage] = useState(1);

  const totalItems = items.length;
  const totalPages = getTotalPages(totalItems);

  const paginatedItems = useMemo(() => slicePage(items, page), [items, page]);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when filters / list scope changes
  }, resetDeps);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return {
    page,
    setPage,
    totalPages,
    paginatedItems,
    totalItems,
    pageSize: TABLE_PAGE_SIZE,
  };
}
