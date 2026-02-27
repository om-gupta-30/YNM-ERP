"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  visibleCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
};

function TablePaginationInner({
  page,
  totalPages,
  totalItems,
  pageSize,
  visibleCount,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-stone-500">
      <div className="flex items-center gap-3">
        <span>
          Showing{" "}
          <span className="font-medium text-stone-700">{visibleCount}</span> of{" "}
          <span className="font-medium text-stone-700">{totalItems}</span>
        </span>
        {onPageSizeChange ? (
          <select
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="ds-select !h-7 !w-auto !pr-7 text-xs"
            aria-label="Page size"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={String(n)}>
                {n} / page
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="xs"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          Prev
        </Button>
        <div className="px-2 text-xs text-stone-500">
          <span className="font-medium text-stone-700">{page}</span>
          <span className="mx-0.5">/</span>
          <span className="font-medium text-stone-700">{totalPages}</span>
        </div>
        <Button
          variant="secondary"
          size="xs"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export const TablePagination = React.memo(TablePaginationInner);
