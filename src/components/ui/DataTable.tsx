import * as React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

export type SortConfig = { key: string; dir: "asc" | "desc" };

export type DataTableColumn<T> = {
  header: string;
  accessor?: keyof T;
  cell?: (row: T) => React.ReactNode;
  className?: string;
  sortKey?: string;
};

type DataTableProps<T extends { id?: string }> = {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  emptyState?: React.ReactNode;
  loading?: boolean;
  skeletonRows?: number;
  sortConfig?: SortConfig | null;
  onSort?: (key: string) => void;
};

function SortIcon({ active, dir }: { active: boolean; dir?: "asc" | "desc" }) {
  return (
    <span className={["ml-1 inline-flex flex-col text-[9px] leading-none transition-colors duration-150", active ? "text-gold-600" : "text-stone-300"].join(" ")}>
      <span className={active && dir === "asc" ? "text-gold-600" : ""}>▲</span>
      <span className={active && dir === "desc" ? "text-gold-600" : ""}>▼</span>
    </span>
  );
}

function DataTableInner<T extends { id?: string }>(props: DataTableProps<T>) {
  const { skeletonRows = 6 } = props;
  const isLoading =
    props.loading ?? (props.rows.length === 0 && typeof props.emptyState === "string" && props.emptyState.toLowerCase().includes("loading"));

  return (
    <div className="ds-table-wrap">
      <div className="ds-table-scroll">
        <table className="ds-table">
          <thead className="ds-thead">
            <tr>
              {props.columns.map((c) => {
                const sortable = !!c.sortKey && !!props.onSort;
                const active = sortable && props.sortConfig?.key === c.sortKey;
                return (
                  <th
                    key={c.header}
                    className={[
                      "ds-th",
                      c.className ?? "",
                      sortable ? "cursor-pointer select-none transition-colors duration-150 hover:text-gold-700" : "",
                    ].join(" ")}
                    onClick={sortable ? () => props.onSort!(c.sortKey!) : undefined}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      {c.header}
                      {sortable && <SortIcon active={!!active} dir={active ? props.sortConfig!.dir : undefined} />}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {isLoading ? (
              Array.from({ length: skeletonRows }).map((_, idx) => (
                <tr key={`sk_${idx}`} className="ds-tr">
                  {props.columns.map((c, cidx) => (
                    <td key={`${c.header}_${cidx}`} className={["ds-td", c.className ?? ""].join(" ")}>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-4 w-full max-w-[260px]" />
                      </div>
                    </td>
                  ))}
                </tr>
              ))
            ) : props.rows.length === 0 ? (
              <tr>
                <td
                  className="ds-empty"
                  colSpan={props.columns.length}
                >
                  {props.emptyState ?? "No records found."}
                </td>
              </tr>
            ) : (
              props.rows.map((row, idx) => (
                <tr key={row.id ?? idx} className="ds-tr">
                  {props.columns.map((c) => (
                    <td
                      key={c.header}
                      className={[
                        "ds-td",
                        c.className ?? "",
                      ].join(" ")}
                    >
                      {c.cell
                        ? c.cell(row)
                        : c.accessor
                          ? String(row[c.accessor] ?? "")
                          : ""}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const DataTable = React.memo(DataTableInner) as typeof DataTableInner;

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="ds-table-wrap">
      <div className="ds-table-scroll">
        <table className="ds-table">
          <thead className="ds-thead">
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="ds-th">
                  <Skeleton className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {Array.from({ length: rows }).map((_, rIdx) => (
              <tr key={rIdx} className="ds-tr">
                {Array.from({ length: cols }).map((_, cIdx) => (
                  <td key={cIdx} className="ds-td">
                    <Skeleton className="h-4 w-full max-w-[200px]" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
