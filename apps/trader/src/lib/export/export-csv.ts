/**
 * CSV export (audit B #9)
 *
 * Traders asked to take journal and performance data into a spreadsheet;
 * the trader app had no export path at all. Mirrors prop-admin's
 * export-utils: RFC-4180 escaping, a BOM so Excel reads UTF-8 symbols
 * (`✓`, `–`) correctly, a Blob download, and an explicit empty state
 * instead of silently writing a header-only file.
 *
 * Demo-only: nothing is sent anywhere — the browser writes the file.
 */

import { toast } from "@/hooks/use-toast";

export interface ExportColumn<T> {
  header: string;
  /** Cell value — stringified as-is (numbers are never re-localised). */
  value: (row: T) => string | number;
}

export function exportToCsv<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
): void {
  if (rows.length === 0) {
    toast({
      title: "Nothing to export",
      description: "There are no records in the current view.",
      variant: "destructive",
    });
    return;
  }

  const escape = (val: string | number): string => {
    const s = String(val);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [
    columns.map((c) => escape(c.header)).join(","),
    ...rows.map((row) => columns.map((c) => escape(c.value(row))).join(",")),
  ];

  const blob = new Blob(["\uFEFF", lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  toast({
    title: "Export ready",
    description: `${rows.length} row${rows.length === 1 ? "" : "s"} written to ${link.download}.`,
  });
}
