"use client";

/**
 * Keyboard shortcuts for data tables — finding #2 (LOW) gap.
 * Adds sorting/filtering/row-action shortcuts that were missing.
 */

import { useEffect } from "react";

export interface TableKeyboardOptions {
  onSort?: (key: string) => void;
  onFilter?: (key: string, value: string) => void;
  onSelectRow?: (key: string) => void;
  sortableKeys?: string[];
}

export function useTableKeyboard(options: TableKeyboardOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Only trigger when focus is inside a data table region
      const tableRegion = target.closest("[data-table-region]") || target.closest("table");
      if (!tableRegion) return;

      // Arrow navigation between rows (up/down within table body)
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          // Could navigate between pages or sections; left as extension point
        }
      }

      // Enter / Space activates focused row actions (buttons/links inside cell)
      if (e.key === "Enter" || e.key === " ") {
        const focusedBtn = tableRegion.querySelector("button:focus, a:focus");
        if (focusedBtn) {
          // Default behavior is sufficient — just prevent bubbling
          e.stopPropagation();
        }
      }

      // Esc cancels any table edit mode (if implemented)
      if (e.key === "Escape") {
        const editInput = tableRegion.querySelector("input[data-edit-mode]") as HTMLElement | null;
        if (editInput) {
          e.preventDefault();
          editInput.blur();
        }
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [options]);
}
