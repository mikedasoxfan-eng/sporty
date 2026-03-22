"use client";

import { useEffect } from "react";

/**
 * Universal table sorting — attaches to ALL .stat-table elements.
 * Drop this once in the layout and every stat table becomes sortable.
 *
 * Click header once: sort descending (most first)
 * Click again: sort ascending (least first)
 * Click again: reset to original order
 */
export function TableSorter() {
  useEffect(() => {
    // Track sort state per table+column
    const sortState = new WeakMap<
      HTMLTableElement,
      { col: number; dir: "desc" | "asc" | "none"; original: HTMLTableRowElement[] }
    >();

    function handleClick(e: MouseEvent) {
      const th = (e.target as HTMLElement).closest("th");
      if (!th) return;

      const thead = th.closest("thead");
      if (!thead) return;

      const table = thead.closest("table.stat-table") as HTMLTableElement | null;
      if (!table) return;

      const tbody = table.querySelector("tbody");
      if (!tbody) return;

      const headerRow = thead.querySelector("tr");
      if (!headerRow) return;

      const ths = Array.from(headerRow.querySelectorAll("th"));
      const colIndex = ths.indexOf(th);
      if (colIndex === -1) return;

      // Initialize state for this table
      let state = sortState.get(table);
      if (!state) {
        state = {
          col: -1,
          dir: "none",
          original: Array.from(tbody.querySelectorAll("tr")),
        };
        sortState.set(table, state);
      }

      // Determine next sort direction
      if (state.col !== colIndex) {
        // New column: start with desc (most first)
        state.col = colIndex;
        state.dir = "desc";
      } else {
        // Same column: cycle desc -> asc -> none
        state.dir =
          state.dir === "desc" ? "asc" : state.dir === "asc" ? "none" : "desc";
      }

      // Clear all header indicators
      ths.forEach((h) => {
        h.classList.remove("text-accent");
        const indicator = h.querySelector(".sort-indicator");
        if (indicator) indicator.remove();
      });

      if (state.dir === "none") {
        // Reset to original order
        for (const row of state.original) {
          tbody.appendChild(row);
        }
        return;
      }

      // Add indicator to active header
      th.classList.add("text-accent");
      const indicator = document.createElement("span");
      indicator.className = "sort-indicator inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-accent/20 text-accent text-[8px] ml-1 align-middle";
      indicator.textContent = state.dir === "desc" ? "\u2193" : "\u2191";
      th.querySelector("span")?.appendChild(indicator) ||
        th.appendChild(indicator);

      // Sort the rows
      const rows = Array.from(tbody.querySelectorAll("tr"));
      const isFooter = (row: HTMLTableRowElement) =>
        row.closest("tfoot") !== null;

      // Only sort tbody rows, not tfoot
      const sortableRows = rows.filter((r) => !isFooter(r));

      sortableRows.sort((a, b) => {
        const aCell = a.querySelectorAll("td")[colIndex];
        const bCell = b.querySelectorAll("td")[colIndex];
        if (!aCell || !bCell) return 0;

        const aText = aCell.textContent?.trim() || "";
        const bText = bCell.textContent?.trim() || "";

        // Handle dashes/empty as null (sort to bottom)
        if ((aText === "\u2014" || aText === "") && (bText === "\u2014" || bText === "")) return 0;
        if (aText === "\u2014" || aText === "") return 1;
        if (bText === "\u2014" || bText === "") return -1;

        // Try numeric comparison
        const aNum = parseFloat(aText.replace(/[,$%]/g, ""));
        const bNum = parseFloat(bText.replace(/[,$%]/g, ""));

        let cmp: number;
        if (!isNaN(aNum) && !isNaN(bNum)) {
          cmp = aNum - bNum;
        } else {
          cmp = aText.localeCompare(bText);
        }

        return state!.dir === "asc" ? cmp : -cmp;
      });

      // Re-append sorted rows
      for (const row of sortableRows) {
        tbody.appendChild(row);
      }
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}
