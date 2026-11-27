import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ReadOnlyGuard } from "./read-only-guard";

/* Mock the platform context so each case controls the session state. */
vi.mock("@/lib/platform/platform-context", () => ({
  usePlatform: vi.fn(),
}));

const { usePlatform } = await import("@/lib/platform/platform-context");

function setImpersonating(value: boolean) {
  vi.mocked(usePlatform).mockReturnValue({
    isImpersonating: value,
  } as never);
}

describe("ReadOnlyGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setImpersonating(false);
  });

  afterEach(cleanup);

  it("renders children untouched when no View-As session is active", () => {
    setImpersonating(false);
    render(
      <ReadOnlyGuard>
        <button type="button">Mutating control</button>
      </ReadOnlyGuard>,
    );
    const btn = screen.getByRole("button", { name: "Mutating control" });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    // No capture-phase suppression: the click reaches the element.
    expect(btn.getAttribute("data-readonly")).toBeNull();
  });

  it("swallows clicks on plain controls during an active session", () => {
    setImpersonating(true);
    const onClick = vi.fn();
    render(
      <ReadOnlyGuard>
        <button type="button" onClick={onClick}>
          Mutating control
        </button>
      </ReadOnlyGuard>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Mutating control" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("lets controls marked data-readonly-allow through (support-assist selectors)", () => {
    setImpersonating(true);
    const onClick = vi.fn();
    render(
      <ReadOnlyGuard>
        {/* support-assist: tenant picker button */}
        <button type="button" data-readonly-allow onClick={onClick}>
          Tenant picker
        </button>
        {/* support-assist: ticket row */}
        <button type="button" data-readonly-allow onClick={onClick}>
          Ticket row
        </button>
        {/* support-assist: close X */}
        <button type="button" aria-label="Close ticket detail" data-readonly-allow onClick={onClick}>
          <span aria-hidden>×</span>
        </button>
        {/* support-assist: "Open tenant detail" navigation */}
        <button type="button" data-readonly-allow onClick={onClick}>
          Open tenant detail
        </button>
      </ReadOnlyGuard>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tenant picker" }));
    fireEvent.click(screen.getByRole("button", { name: "Ticket row" }));
    fireEvent.click(screen.getByLabelText("Close ticket detail"));
    fireEvent.click(screen.getByRole("button", { name: "Open tenant detail" }));

    expect(onClick).toHaveBeenCalledTimes(4);
  });

  it("keeps navigation links live during an active session", () => {
    setImpersonating(true);
    render(
      <ReadOnlyGuard>
        <a href="/tenant-detail">Tenant detail</a>
      </ReadOnlyGuard>,
    );
    const link = screen.getByRole("link", { name: "Tenant detail" });
    expect(link.getAttribute("href")).toBe("/tenant-detail");
  });

  it("keeps tab-role switches live during an active session", () => {
    setImpersonating(true);
    const onClick = vi.fn();
    render(
      <ReadOnlyGuard>
        <button type="button" role="tab" onClick={onClick}>
          Queue tab
        </button>
      </ReadOnlyGuard>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Queue tab" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("explains the session in the rendered banner", () => {
    setImpersonating(true);
    render(
      <ReadOnlyGuard>
        <p>content</p>
      </ReadOnlyGuard>,
    );
    expect(
      screen.getByText(/Read-only View-As session/),
    ).toBeTruthy();
  });
});
