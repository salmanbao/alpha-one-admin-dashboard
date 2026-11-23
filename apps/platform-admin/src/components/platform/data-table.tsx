"use client";

/**
 * PFaaS Platform — DataTable wrapper
 *
 * Spec section 26 / §26 of docs/AGENTS.md. Reusable table abstraction
 * with sorting, filtering, pagination, search, empty/error/loading
 * states, responsive behavior — plus the decision-table capabilities the
 * constitution requires: row selection + bulk actions, column
 * visibility, CSV export and a page-size selector.
 *
 * URL state is owned by the CONSUMER: pass the optional `state` object
 * (search/sortKey/sortDir/page/pageSize) to control the view from the
 * query string and receive the merged next state via `onStateChange`.
 * Without `state` the table keeps its own local state (backward
 * compatible with every existing call site).
 */

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "./guards";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  Download,
  Inbox,
  Search,
} from "lucide-react";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
  width?: string;
  /** Right-align numeric content */
  numeric?: boolean;
}

/** Controlled view state — the shape consumers persist in the URL. */
export interface TableState {
  search: string;
  sortKey: string | null;
  sortDir: "asc" | "desc";
  page: number;
  pageSize: number;
}

export interface TableSelection {
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  /** `pageIds` are the row keys currently visible on this page. */
  onToggleAll: (pageIds: string[]) => void;
  /** Rendered above the table while at least one row is selected. */
  bulkBar?: React.ReactNode;
}

export interface TableColumnVisibility {
  hidden: Set<string>;
  onChange: (next: Set<string>) => void;
}

export interface TableCsvExport<T> {
  /** Download name (`.csv` appended when missing). */
  filename: string;
  /** Column headers; defaults to the visible column headers. */
  headers?: string[];
  /** One CSV row per record, in visible-column order. */
  toRow: (row: T) => string[];
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  searchPlaceholder?: string;
  searchableText?: (row: T) => string;
  pageSize?: number;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  toolbar?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  emptyHint?: string;
  /**
   * Controlled view state. When provided, changes flow through
   * `onStateChange` (pass the full merged object back to keep every
   * field authoritative — the table does not mutate it).
   */
  state?: Partial<TableState>;
  onStateChange?: (next: TableState) => void;
  selection?: TableSelection;
  columnVisibility?: TableColumnVisibility;
  exportCsv?: TableCsvExport<T>;
  /** Page-size selector options, e.g. `[8, 25, 50, 100]`. */
  pageSizeOptions?: number[];
}

function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Download a CSV (BOM-prefixed for Excel). Exported for screens that
 *  export a custom selection outside the table's own Export button. */
export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function DataTable<T>({
  columns,
  data,
  loading,
  searchPlaceholder = "Search…",
  searchableText,
  pageSize = 8,
  rowKey,
  onRowClick,
  toolbar,
  emptyTitle = "No records found",
  emptyDescription = "Adjust your filters or try a different search.",
  emptyAction,
  emptyHint,
  state,
  onStateChange,
  selection,
  columnVisibility,
  exportCsv,
  pageSizeOptions,
}: DataTableProps<T>) {
  const [internal, setInternal] = useState<TableState>({
    search: "",
    sortKey: null,
    sortDir: "asc",
    page: 1,
    pageSize,
  });

  const controlled = state !== undefined;
  const view: TableState = { ...internal, ...state };
  // Primitive views of the state — memo deps on these (rather than on
  // `view`, a fresh object each render) let the React Compiler prove the
  // memoization is stable.
  const { search, sortKey, sortDir, page, pageSize: viewPageSize } = view;
  const update = (patch: Partial<TableState>) => {
    const next: TableState = { ...view, ...patch };
    if (controlled) {
      onStateChange?.(next);
    } else {
      setInternal(next);
      onStateChange?.(next);
    }
  };

  const hidden = columnVisibility?.hidden;
  const visibleColumns = useMemo(
    () => (hidden && hidden.size > 0 ? columns.filter((c) => !hidden.has(c.key)) : columns),
    [columns, hidden],
  );

  const filtered = useMemo(() => {
    if (!search.trim() || !searchableText) return data;
    const q = search.toLowerCase();
    return data.filter((r) => searchableText(r).toLowerCase().includes(q));
  }, [data, search, searchableText]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = visibleColumns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const out = [...filtered].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return out;
  }, [filtered, sortKey, sortDir, visibleColumns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / viewPageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = sorted.slice((pageSafe - 1) * viewPageSize, pageSafe * viewPageSize);

  const toggleSort = (key: string) => {
    if (view.sortKey !== key) {
      update({ sortKey: key, sortDir: "asc", page: 1 });
    } else if (view.sortDir === "asc") {
      update({ sortDir: "desc", page: 1 });
    } else {
      update({ sortKey: null, page: 1 });
    }
  };

  /* ---- selection ------------------------------------------------- */
  const pageIds = paged.map(rowKey);
  const selectedOnPage = pageIds.filter((id) => selection?.selectedIds.has(id));
  const allSelected = Boolean(selection) && pageIds.length > 0 && selectedOnPage.length === pageIds.length;
  const someSelected = selectedOnPage.length > 0 && !allSelected;

  const selectionColumn: Column<T> | null = selection
    ? {
        key: "__select",
        header: (
          <Checkbox
            checked={allSelected ? true : someSelected ? "indeterminate" : false}
            onCheckedChange={() => selection.onToggleAll(pageIds)}
            aria-label="Select all rows on this page"
            onClick={(e) => e.stopPropagation()}
          />
        ),
        cell: (row) => {
          const id = rowKey(row);
          return (
            <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selection.selectedIds.has(id)}
                onCheckedChange={() => selection.onToggle(id)}
                aria-label={`Select row ${id}`}
              />
            </div>
          );
        },
        width: "40px",
        className: "align-middle",
      }
    : null;

  const tableColumns = selectionColumn ? [selectionColumn, ...visibleColumns] : visibleColumns;

  const handleExport = () => {
    if (!exportCsv) return;
    const headers =
      exportCsv.headers ?? visibleColumns.map((c) => (typeof c.header === "string" ? c.header : c.key));
    const rows = [headers, ...sorted.map(exportCsv.toRow)];
    downloadCsv(exportCsv.filename, rows);
  };

  const showPageSizeSelector = Boolean(pageSizeOptions && pageSizeOptions.length > 0);
  const showFooter = totalPages > 1 || showPageSizeSelector;

  const searchBox = searchableText ? (
    <div className="relative w-full md:max-w-xs">
      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={view.search}
        onChange={(e) => update({ search: e.target.value, page: 1 })}
        placeholder={searchPlaceholder}
        className="pl-8"
        aria-label={searchPlaceholder}
      />
    </div>
  ) : (
    <div />
  );

  const tableTools = columnVisibility || exportCsv ? (
    <div className="flex flex-wrap items-center gap-2">
      {columnVisibility ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" aria-label="Choose visible columns">
              <Columns3 className="h-3.5 w-3.5" /> Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs">Visible columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.map((c) => {
              const label = typeof c.header === "string" ? c.header : c.key;
              const checked = !columnVisibility.hidden.has(c.key);
              return (
                <DropdownMenuCheckboxItem
                  key={c.key}
                  checked={checked}
                  disabled={!checked && visibleColumns.length <= 1}
                  onCheckedChange={(next) => {
                    if (next !== true && next !== false) return;
                    const set = new Set(columnVisibility.hidden);
                    if (next) set.delete(c.key);
                    else set.add(c.key);
                    columnVisibility.onChange(set);
                  }}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {exportCsv ? (
        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={handleExport} aria-label={`Export ${exportCsv.filename}`}>
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        {searchBox}
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          {tableTools}
        </div>
      </div>

      {selection?.bulkBar && selection.selectedIds.size > 0 ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2"
        >
          {selection.bulkBar}
        </div>
      ) : null}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {tableColumns.map((c) => {
                const label = typeof c.header === "string" ? c.header : c.key;
                return (
                  <TableHead
                    key={c.key}
                    aria-sort={c.sortValue ? (view.sortKey === c.key ? (view.sortDir === "asc" ? "ascending" : "descending") : "none") : undefined}
                    className={`${c.className ?? ""} ${c.numeric ? "text-right tabular-nums" : ""} h-9 px-3 text-xs uppercase tracking-wide`}
                    style={c.width ? { width: c.width } : undefined}
                  >
                    {c.sortValue ? (
                      <button
                        className={`inline-flex items-center gap-1 ${c.numeric ? "justify-end" : "text-left"} font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm`}
                        onClick={() => toggleSort(c.key)}
                        aria-label={`Sort by ${label}${view.sortKey === c.key ? ` (currently ${view.sortDir === "asc" ? "ascending" : "descending"})` : ""}`}
                      >
                        {c.header}
                        {view.sortKey === c.key ? (
                          view.sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {tableColumns.map((c) => (
                    <TableCell key={c.key} className={`${c.className ?? ""} ${c.numeric ? "text-right tabular-nums" : ""} px-3 py-2.5 text-sm`}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={Math.max(1, tableColumns.length)} className="p-0">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    icon={Inbox}
                    action={emptyAction}
                    hint={emptyHint}
                  />
                </TableCell>
              </TableRow>
            ) : (
              paged.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={onRowClick ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" : ""}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(row);
                          } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                            // Arrow-key row navigation — move focus within the table body.
                            e.preventDefault();
                            const sibling =
                              e.key === "ArrowDown"
                                ? e.currentTarget.nextElementSibling
                                : e.currentTarget.previousElementSibling;
                            if (sibling instanceof HTMLElement && sibling.tabIndex >= 0) sibling.focus();
                          }
                        }
                      : undefined
                  }
                >
                  {tableColumns.map((c) => (
                    <TableCell key={c.key} className={`${c.className ?? ""} ${c.numeric ? "text-right tabular-nums" : ""} px-3 py-2.5 text-sm`}>
                      {c.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {showFooter ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Showing {sorted.length === 0 ? 0 : (pageSafe - 1) * view.pageSize + 1}–
            {Math.min(pageSafe * view.pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-2">
            {showPageSizeSelector ? (
              <Select
                value={String(view.pageSize)}
                onValueChange={(v) => update({ pageSize: Number(v), page: 1 })}
              >
                <SelectTrigger className="h-8 w-[110px] text-xs" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(pageSizeOptions ?? []).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {totalPages > 1 ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pageSafe <= 1}
                  onClick={() => update({ page: Math.max(1, pageSafe - 1) })}
                >
                  Prev
                </Button>
                <span className="font-medium text-foreground">
                  {pageSafe} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pageSafe >= totalPages}
                  onClick={() => update({ page: Math.min(totalPages, pageSafe + 1) })}
                >
                  Next
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
