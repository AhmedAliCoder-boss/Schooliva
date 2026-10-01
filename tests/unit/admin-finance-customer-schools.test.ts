import { describe, expect, it } from "vitest";

import { filterCustomerSchoolRows } from "../../src/lib/admin/customer-schools";

describe("admin finance customer school filtering", () => {
  it("keeps only tenant school finance records and drops internal/unmatched rows", () => {
    const customerSchoolIds = ["school-1", "school-2"];

    const rows = [
      { id: "inv-1", school_id: "school-1" },
      { id: "inv-2", school_id: "school-2" },
      { id: "inv-3", school_id: "internal-platform" },
      { id: "inv-4", school_id: null },
      { id: "inv-5", school_id: "school-3" },
    ];

    expect(filterCustomerSchoolRows(rows, customerSchoolIds)).toEqual([
      { id: "inv-1", school_id: "school-1" },
      { id: "inv-2", school_id: "school-2" },
    ]);
  });
});
