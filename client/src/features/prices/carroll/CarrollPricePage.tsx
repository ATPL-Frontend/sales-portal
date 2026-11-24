import {
  CalendarDays,
  FileSpreadsheet,
  LoaderCircle,
  Search,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Notice } from "../../../components/ui/Notice";
import { PageHeader } from "../../../components/ui/PageHeader";
import { useToast } from "../../../components/ui/ToastProvider";
import { api } from "../../../lib/api";
import { useAuth } from "../../auth/AuthProvider";
import { ImportCarrollDialog } from "./ImportCarrollDialog";
import {
  formatEffectiveDate,
  formatPrice,
  formatQuantity,
  unitPrice,
} from "./pricing";
import type { CarrollCategories, CarrollMeta, CarrollPage } from "./types";

const LIMIT = 30;
const emptyPage = (): CarrollPage => ({
  items: [],
  total: 0,
  page: 1,
  limit: LIMIT,
});

export function CarrollPricePage() {
  const { user } = useAuth();
  const toast = useToast();
  const canUpload = Boolean(
    user?.isSuperAdmin || user?.permissions.includes("prices:upload"),
  );
  const [meta, setMeta] = useState<CarrollMeta | null>(null);
  const [categories, setCategories] = useState<CarrollCategories["categories"]>(
    [],
  );
  const [result, setResult] = useState<CarrollPage>(emptyPage);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestNumber = useRef(0);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      api<CarrollMeta>("/price-lists/carroll/meta"),
      api<CarrollCategories>("/price-lists/carroll/categories"),
    ])
      .then(([metaData, categoryData]) => {
        if (mounted) {
          setMeta(metaData);
          setCategories(categoryData.categories);
        }
      })
      .catch((err) => {
        if (mounted)
          setError(
            err instanceof Error
              ? err.message
              : "Could not load Carroll metadata",
          );
      });
    return () => {
      mounted = false;
    };
  }, [reload]);

  useEffect(() => {
    setPage(1);
    setResult(emptyPage());
  }, [debouncedQuery, category, reload]);

  useEffect(() => {
    const requestId = ++requestNumber.current;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      q: debouncedQuery,
      category,
      page: String(page),
      limit: String(LIMIT),
    });
    void api<CarrollPage>(`/price-lists/carroll/items?${params}`)
      .then((data) => {
        if (requestId !== requestNumber.current) return;
        setResult((previous) => ({
          ...data,
          items: page === 1 ? data.items : [...previous.items, ...data.items],
        }));
      })
      .catch((err) => {
        if (requestId === requestNumber.current)
          setError(
            err instanceof Error
              ? err.message
              : "Could not load Carroll prices",
          );
      })
      .finally(() => {
        if (requestId === requestNumber.current) setLoading(false);
      });
    return () => {
      requestNumber.current++;
    };
  }, [debouncedQuery, category, page, reload]);

  const hasMore = result.items.length < result.total;
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || loading || !hasMore || error) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setPage((current) => current + 1);
      },
      { rootMargin: "250px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loading, hasMore, result.items.length, error]);

  function onImported(message: string) {
    setDialogOpen(false);
    toast.success(message);
    setQuery("");
    setDebouncedQuery("");
    setCategory("");
    setPage(1);
    setResult(emptyPage());
    setReload((value) => value + 1);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Carroll Price List"
        description="Search the latest Carroll catalogue by part number, description or category."
        action={
          canUpload ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Upload size={17} /> Upload Excel
            </Button>
          ) : undefined
        }
      />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Carroll products
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {meta?.active
                ? `Last uploaded: ${new Date(meta.active.importedAt).toLocaleDateString("en-AU")} · ${meta.active.filename}`
                : "No Carroll workbook imported yet"}
            </p>
            {meta?.active && (
              <p className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                <CalendarDays size={15} /> Price effective:{" "}
                {formatEffectiveDate(meta.active.effectiveDate)}
              </p>
            )}
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {Number(result.total).toLocaleString()} items
          </span>
        </div>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:p-5">
          <label className="relative block w-full max-w-xl flex-1">
            <Search
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search part no., description or discount code..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-slate-400"
            />
          </label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter by product category"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none sm:w-64"
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option value={item.name} key={item.name}>
                {item.name} ({item.count})
              </option>
            ))}
          </select>
        </div>
        {error && (
          <div className="p-4">
            <Notice message={error} />
          </div>
        )}
        {loading && result.items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-5 py-20 text-sm text-slate-500">
            <LoaderCircle size={18} className="animate-spin" /> Loading Carroll
            prices…
          </div>
        ) : result.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-20 text-center">
            <FileSpreadsheet size={27} className="text-slate-400" />
            <p className="font-medium text-slate-800">
              {meta?.active
                ? "No matching products"
                : "Carroll price list is empty"}
            </p>
            <p className="text-sm text-slate-500">
              {meta?.active
                ? "Try a different keyword."
                : "Upload a Carroll Excel file to begin."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-345 bg-white text-left">
              <thead className="border-b border-slate-100 bg-white text-xs font-semibold text-slate-600">
                <tr>
                  {[
                    "Part Number",
                    "Description",
                    "Per Pack List Price",
                    "Quantity per Pack",
                    "Per Pack Net Price",
                    "Unit Price",
                    "Discount",
                    "Category Discount Code",
                    "Category Product",
                  ].map((label) => (
                    <th key={label} className="whitespace-nowrap px-4 py-4">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-900">
                      {item.partNumber}
                    </td>
                    <td className="min-w-72.5 px-4 py-4 text-sm text-slate-800">
                      {item.description}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm tabular-nums text-slate-700">
                      ${formatPrice(item.perPackListPrice)}
                    </td>
                    <td className="px-4 py-4 text-sm tabular-nums text-slate-600">
                      {formatQuantity(item.quantityPerPack)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-medium tabular-nums text-slate-900">
                      ${formatPrice(item.perPackNetPrice)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold tabular-nums text-slate-900">
                      $
                      {formatPrice(
                        unitPrice(item.perPackNetPrice, item.quantityPerPack),
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm tabular-nums text-slate-600">
                      {formatQuantity(item.discountPercent)}%
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {item.categoryDiscountCode}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {item.categoryProduct}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result.items.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-4 text-center text-xs text-slate-500">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <LoaderCircle size={15} className="animate-spin" /> Loading
                more…
              </span>
            ) : !hasMore ? (
              <span>All {result.total} products loaded</span>
            ) : null}
            <div ref={sentinelRef} className="h-px" aria-hidden="true" />
          </div>
        )}
      </section>
      {dialogOpen && (
        <ImportCarrollDialog
          onClose={() => setDialogOpen(false)}
          onImported={onImported}
        />
      )}
    </div>
  );
}
