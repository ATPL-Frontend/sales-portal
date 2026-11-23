import { FileSpreadsheet, LoaderCircle, Search, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Notice } from "../../../components/ui/Notice";
import { PageHeader } from "../../../components/ui/PageHeader";
import { useToast } from "../../../components/ui/ToastProvider";
import { api } from "../../../lib/api";
import { useAuth } from "../../auth/AuthProvider";
import { Import3FDialog } from "./Import3FDialog";
import type { PriceMeta, PricePage } from "./types";

const PAGE_SIZE = 20;
const emptyPage = (): PricePage => ({
  items: [],
  total: 0,
  page: 1,
  limit: PAGE_SIZE,
});

export function ThreeFPricePage() {
  const { user } = useAuth();
  const toast = useToast();
  const canUpload = Boolean(
    user?.isSuperAdmin || user?.permissions.includes("prices:upload"),
  );
  const [meta, setMeta] = useState<PriceMeta | null>(null);
  const [result, setResult] = useState<PricePage>(emptyPage);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const fetchingRef = useRef(true);

  useEffect(() => {
    let alive = true;
    void api<PriceMeta>("/price-lists/3f/meta")
      .then((data) => {
        if (alive) setMeta(data);
      })
      .catch((err) => {
        if (alive)
          setError(
            err instanceof Error
              ? err.message
              : "Could not load list information",
          );
      });
    return () => {
      alive = false;
    };
  }, [reload]);

  useEffect(() => {
    let alive = true;
    fetchingRef.current = true;
    setLoading(true);
    setError("");
    const timer = window.setTimeout(
      () => {
        const params = new URLSearchParams({
          q: query,
          category,
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        void api<PricePage>(`/price-lists/3f/items?${params}`)
          .then((data) => {
            if (!alive) return;
            setResult((previous) =>
              page === 1
                ? data
                : { ...data, items: [...previous.items, ...data.items] },
            );
          })
          .catch((err) => {
            if (alive)
              setError(
                err instanceof Error
                  ? err.message
                  : "Could not load cable prices",
              );
          })
          .finally(() => {
            if (alive) {
              fetchingRef.current = false;
              setLoading(false);
            }
          });
      },
      page === 1 ? 250 : 0,
    );
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query, category, page, reload]);

  const hasMore = result.items.length < result.total;
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !fetchingRef.current) {
          fetchingRef.current = true;
          setPage((previous) => previous + 1);
        }
      },
      { rootMargin: "250px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, result.items.length]);

  function resetSearch(nextQuery: string, nextCategory: string) {
    fetchingRef.current = true;
    setResult(emptyPage());
    setPage(1);
    setQuery(nextQuery);
    setCategory(nextCategory);
  }

  function onImported(message: string) {
    setImportOpen(false);
    toast.success(message);
    resetSearch("", "");
    setReload((value) => value + 1);
  }

  return (
    <div>
      <PageHeader
        title="3F Cable Price List"
        description="Search cable prices from the latest imported workbook."
        action={
          canUpload ? (
            <Button onClick={() => setImportOpen(true)}>
              <Upload size={17} /> Import Excel
            </Button>
          ) : undefined
        }
      />
      {error && (
        <div className="mb-5">
          <Notice message={error} />
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="space-y-5 border-b border-slate-100 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Cable prices
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {meta?.active?.filename ?? "No spreadsheet imported yet"}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
              {loading && result.items.length === 0
                ? "Loading…"
                : `${result.total} items`}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
            <label className="relative block">
              <Search
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => resetSearch(e.target.value, category)}
                placeholder="Search part number, AWG, UL or description..."
                aria-label="Search cable prices"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400"
              />
            </label>
            <select
              aria-label="Filter by category"
              value={category}
              onChange={(e) => resetSearch(query, e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="">All categories</option>
              {meta?.categories.map((item) => (
                <option key={item.category} value={item.category}>
                  {item.category}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && result.items.length === 0 ? (
          <div className="flex justify-center gap-2 px-5 py-16 text-sm text-slate-500">
            <LoaderCircle size={18} className="animate-spin" /> Loading prices…
          </div>
        ) : result.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-20 text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <FileSpreadsheet size={22} />
            </div>
            <h3 className="text-base font-semibold text-slate-800">
              {meta?.active ? "No matching cables" : "Your price list is empty"}
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              {meta?.active
                ? "Try another keyword or category."
                : "Import your first 3F workbook to begin searching."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-207 border-collapse text-left">
              <thead className="bg-slate-50/70 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="w-32 px-5 py-4 sm:px-6">UL</th>
                  <th className="px-5 py-4 sm:px-6">Description</th>
                  <th className="w-32 px-5 py-4">Price</th>
                  <th className="w-36 px-5 py-4">Price Range</th>
                  <th className="w-36 px-5 py-4">Packing / Roll</th>
                  <th className="w-28 px-5 py-4">MOQ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.items.map((item) => (
                  <tr
                    key={item.id}
                    className="align-top transition-colors hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4 sm:px-6">
                      <span className="inline-block rounded-lg bg-cyan-50 px-2.5 py-1.5 text-xs font-medium text-cyan-800">
                        {item.ul}
                      </span>
                    </td>
                    <td className="px-5 py-4 sm:px-6">
                      <p className="text-sm font-medium leading-6 text-slate-900">
                        {item.description}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.category}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="text-sm font-semibold tabular-nums text-slate-900">
                        {Number(item.price).toFixed(2)}
                      </span>
                      <span className="ml-1 text-xs text-slate-500">USD</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
                        {item.priceRange}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                      {item.packing || "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                      {item.moq || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result.items.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-4 text-center text-xs text-slate-500 sm:px-6">
            {loading && (
              <span className="inline-flex items-center gap-2">
                <LoaderCircle size={15} className="animate-spin" /> Loading
                more…
              </span>
            )}
            {!loading && !hasMore && (
              <span>All {result.total} items loaded</span>
            )}
            <div ref={sentinelRef} className="h-px" aria-hidden="true" />
          </div>
        )}
      </section>
      {importOpen && (
        <Import3FDialog
          onClose={() => setImportOpen(false)}
          onImported={onImported}
        />
      )}
    </div>
  );
}
