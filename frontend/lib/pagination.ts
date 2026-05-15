export const TABLE_PAGE_SIZE = 15;

export function getTotalPages(totalItems: number, pageSize: number = TABLE_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function slicePage<T>(items: T[], page: number, pageSize: number = TABLE_PAGE_SIZE): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function getPageRange(
  page: number,
  pageSize: number,
  totalItems: number,
): { from: number; to: number } {
  if (totalItems <= 0) return { from: 0, to: 0 };
  return {
    from: (page - 1) * pageSize + 1,
    to: Math.min(page * pageSize, totalItems),
  };
}
