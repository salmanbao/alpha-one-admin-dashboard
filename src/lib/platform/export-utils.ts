"use client";

/**
 * PFaaS Platform — CSV Export Utility
 *
 * Generates a CSV file from tabular data and triggers a browser download.
 * Used by analytics, accounting, and other modules to export reports.
 */

import { toast } from "@/hooks/use-toast";

export interface ExportColumn<T> {
  key: string;
  header: string;
  /** Returns the raw value for CSV (string | number) */
  value: (row: T) => string | number;
}

/**
 * Export an array of rows to a CSV file and download it.
 * Handles escaping of commas, quotes, and newlines per RFC 4180.
 */
export function exportToCsv<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
): void {
  if (rows.length === 0) {
    toast({
      title: "Nothing to export",
      description: "There are no records to export.",
      variant: "destructive",
    });
    return;
  }

  const escape = (val: string | number): string => {
    const s = String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const header = columns.map((c) => escape(c.header)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escape(c.value(row))).join(","))
    .join("\n");

  const csv = `${header}\n${body}`;
  // Prepend BOM for Excel UTF-8 compatibility
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  toast({
    title: "Export ready",
    description: `${filename} — ${rows.length} records exported.`,
  });
}
