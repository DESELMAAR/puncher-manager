import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TablePagination } from "@/components/TablePagination";

describe("TablePagination", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders nothing when totalItems is 0", () => {
    const { container } = render(
      <TablePagination
        page={1}
        totalPages={1}
        totalItems={0}
        pageSize={15}
        onPageChange={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows centered range and page controls", () => {
    render(
      <TablePagination
        page={2}
        totalPages={3}
        totalItems={40}
        pageSize={15}
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByText("16–30 of 40")).toBeInTheDocument();
    expect(screen.getByText("Page 2 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("disables Previous on first page", () => {
    render(
      <TablePagination
        page={1}
        totalPages={2}
        totalItems={20}
        pageSize={15}
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("calls onPageChange when Next is clicked", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <TablePagination
        page={1}
        totalPages={2}
        totalItems={20}
        pageSize={15}
        onPageChange={onPageChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
