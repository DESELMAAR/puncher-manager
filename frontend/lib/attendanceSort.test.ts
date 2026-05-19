import { describe, expect, it } from "vitest";
import { sortAttendanceByDateDesc } from "./attendanceSort";

describe("sortAttendanceByDateDesc", () => {
  it("sorts by recordDate descending then name", () => {
    const rows = [
      { recordDate: "2026-05-10", name: "Zoe", employeeId: "E2" },
      { recordDate: "2026-05-19", name: "Amy", employeeId: "E1" },
      { recordDate: "2026-05-19", name: "Bob", employeeId: "E3" },
      { recordDate: "2026-05-01", name: "Ann", employeeId: "E4" },
    ];
    const sorted = sortAttendanceByDateDesc(rows);
    expect(sorted.map((r) => r.recordDate)).toEqual([
      "2026-05-19",
      "2026-05-19",
      "2026-05-10",
      "2026-05-01",
    ]);
    expect(sorted[0]?.name).toBe("Amy");
    expect(sorted[1]?.name).toBe("Bob");
  });
});
