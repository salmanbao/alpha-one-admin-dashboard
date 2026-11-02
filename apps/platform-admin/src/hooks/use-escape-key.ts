"use client";

import { useEffect, useRef } from "react";

/**
 * Close an open overlay/drawer/sheet with the Escape key (audit V #4).
 *
 * Many surfaces were click-outside-to-close only, which strands
 * keyboard users inside them. Subscribe only while `active` is true and
 * keep the latest callback in a ref so an inline arrow doesn't
 * resubscribe the listener on every render.
 */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  const cbRef = useRef(onEscape);
  useEffect(() => {
    cbRef.current = onEscape;
  });
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        cbRef.current();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [active]);
}
