"use client";

import { useState } from "react";

export interface Column<T> {
  key: string;
  label: string;
  abbr?: string;
  align?: "left" | "right" | "center";
  sticky?: boolean;
  render?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  mono?: boolean;
  /** If true, sort ascending first (lower is better — ERA, WHIP, etc.) */
  invertSort?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  caption?: string;
  footer?: React.ReactNode;
  highlightFn?: (row: T) => boolean;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  compact?: boolean;
}

type SortState = "none" | "desc" | "asc";

export function DataTable<T>({
  columns,
  data,
  caption,
  footer,
  highlightFn,
  rowKey,
  onRowClick,
  compact = false,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortState, setSortState] = useState<SortState>("none");

  const sorted =
    sortKey && sortState !== "none"
      ? [...data].sort((a, b) => {
          const aVal = (a as Record<string, unknown>)[sortKey];
          const bVal = (b as Record<string, unknown>)[sortKey];
          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return 1;
          if (bVal == null) return -1;
          const cmp =
            typeof aVal === "number" && typeof bVal === "number"
              ? aVal - bVal
              : String(aVal).localeCompare(String(bVal));
          return sortState === "asc" ? cmp : -cmp;
        })
      : data;

  function handleSort(key: string, invertSort?: boolean) {
    if (sortKey !== key) {
      // New column: start with "most" (desc for counting stats, asc for rate-lower-is-better)
      setSortKey(key);
      setSortState(invertSort ? "asc" : "desc");
    } else {
      // Same column: cycle desc -> asc -> none
      setSortState((s) => {
        if (invertSort) {
          if (s === "asc") return "desc";
          if (s === "desc") return "none";
          return "asc";
        }
        if (s === "desc") return "asc";
        if (s === "asc") return "none";
        return "desc";
      });
    }
  }

  const py = compact ? "py-1.5" : "py-2";
  const px = compact ? "px-2" : "px-3";

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface">
      {caption && (
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">{caption}</h3>
        </div>
      )}
      <div className="stat-scroll overflow-x-auto">
        <table className="stat-table w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => {
                const isActive = sortKey === col.key && sortState !== "none";
                return (
                  <th
                    key={col.key}
                    className={`${py} ${px} text-xs font-medium uppercase tracking-wider whitespace-nowrap
                      ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}
                      ${col.sticky ? "sticky left-0 z-20" : ""}
                      ${col.sortable !== false ? "cursor-pointer select-none transition-colors" : ""}
                      ${isActive ? "text-accent" : "text-muted hover:text-foreground"}`}
                    onClick={() =>
                      col.sortable !== false &&
                      handleSort(col.key, col.invertSort)
                    }
                    title={`${col.label}${col.sortable !== false ? " (click to sort)" : ""}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.abbr || col.label}
                      {isActive && (
                        <span className="text-[10px]">
                          {sortState === "asc" ? "\u25B2" : "\u25BC"}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {sorted.map((row, i) => (
              <tr
                key={rowKey(row)}
                className={`
                  ${highlightFn?.(row) ? "bg-accent/5" : ""}
                  ${onRowClick ? "cursor-pointer" : ""}
                `}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`${py} ${px}
                      ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}
                      ${col.sticky ? "sticky left-0 z-10 bg-surface" : ""}
                      ${col.mono !== false && col.align === "right" ? "font-mono text-xs" : ""}`}
                  >
                    {col.render
                      ? col.render(row, i)
                      : String(
                          (row as Record<string, unknown>)[col.key] ?? "\u2014"
                        )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && (
            <tfoot className="border-t-2 border-border">{footer}</tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
