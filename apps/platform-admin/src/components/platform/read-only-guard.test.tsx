/**
 * S3 / F4 regression test — the read-only View-As gate must actually block.
 *
 * The original defect: the `closest()` selector was corrupt, Element.closest()
 * threw SyntaxError inside the capture handler BEFORE preventDefault ran, so
 * every mutating click sailed through while spewing an uncaught exception.
 * These tests pin the three behaviors:
 *   1. impersonating: a plain button click is swallowed (handler never fires)
 *   2. impersonating: navigation links and data-readonly-allow stay live
 *   3. not impersonating: clicks pass through untouched
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";

const ctx: { isImpersonating: boolean } = { isImpersonating: true };

vi.mock("@/lib/platform/platform-context", () => ({
  usePlatform: () => ({ isImpersonating: ctx.isImpersonating }),
}));

import { ReadOnlyGuard } from "./read-only-guard";

describe("ReadOnlyGuard", () => {
  beforeEach(() => {
    cleanup();
    ctx.isImpersonating = true;
  });

  it("swallows clicks on mutating controls while impersonating", () => {
    const onClick = vi.fn();
    const { getByText } = render(
      <ReadOnlyGuard>
        <button onClick={onClick}>Delete tenant</button>
      </ReadOnlyGuard>,
    );
    fireEvent.click(getByText("Delete tenant"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("allows navigation links through while impersonating", () => {
    const onClick = vi.fn();
    const { getByText } = render(
      <ReadOnlyGuard>
        <a href="#/other" onClick={onClick}>
          Go to other view
        </a>
      </ReadOnlyGuard>,
    );
    fireEvent.click(getByText("Go to other view"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("allows controls marked data-readonly-allow (renew/end session)", () => {
    const onClick = vi.fn();
    const { getByText } = render(
      <ReadOnlyGuard>
        <button data-readonly-allow onClick={onClick}>
          End session
        </button>
      </ReadOnlyGuard>,
    );
    fireEvent.click(getByText("End session"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("throws no DOM exception on click (regression: invalid closest selector)", () => {
    // fireEvent surfaces listener exceptions; a SyntaxError from closest()
    // would fail this test the way it failed the console in production.
    const { getByText } = render(
      <ReadOnlyGuard>
        <button onClick={() => {}}>Act</button>
      </ReadOnlyGuard>,
    );
    expect(() => fireEvent.click(getByText("Act"))).not.toThrow();
  });

  it("passes clicks through untouched when no session is active", () => {
    ctx.isImpersonating = false;
    const onClick = vi.fn();
    const { getByText, container } = render(
      <ReadOnlyGuard>
        <button onClick={onClick}>Act</button>
      </ReadOnlyGuard>,
    );
    expect(container.querySelector("[data-readonly]")).toBeNull();
    fireEvent.click(getByText("Act"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
