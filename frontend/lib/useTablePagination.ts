import { useEffect, useMemo, useState } from "react";

export const TABLE_PAGE_SIZE = 15;

export function useTablePagination<T>(items: T[], resetDeps: unknown[] = []) {
  const [page, setPage] = useState(1);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / TABLE_PAGE_SIZE));

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * TABLE_PAGE_SIZE;
    return items.slice(start, start + TABLE_PAGE_SIZE);
  }, [items, page]);

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
