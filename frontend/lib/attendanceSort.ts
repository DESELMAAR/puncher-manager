/** Team attendance tables: newest date first, then employee name. */
export function sortAttendanceByDateDesc<
  T extends { recordDate: string; name?: string | null; employeeId?: string | null },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const byDate = b.recordDate.localeCompare(a.recordDate);
    if (byDate !== 0) return byDate;
    const byName = (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" });
    if (byName !== 0) return byName;
    return (a.employeeId ?? "").localeCompare(b.employeeId ?? "", undefined, {
      sensitivity: "base",
    });
  });
}
