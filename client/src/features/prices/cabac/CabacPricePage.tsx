import { FileSpreadsheet, LoaderCircle, Search, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Notice } from "../../../components/ui/Notice";
import { PageHeader } from "../../../components/ui/PageHeader";
import { useToast } from "../../../components/ui/ToastProvider";
import { api } from "../../../lib/api";
import { useAuth } from "../../auth/AuthProvider";
import { ImportCabacDialog } from "./ImportCabacDialog";
import type { CabacMeta, CabacPage } from "./types";

const LIMIT = 30;
const emptyPage = (): CabacPage => ({
  items: [],
  total: 0,
  page: 1,
  limit: LIMIT,
});
function displayPrice(value: string | number) {
  const num = Number(value);
  return Number.isFinite(num)
    ? num.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")
    : String(value);
}

export function CabacPricePage() {
  const { user } = useAuth();
  const toast = useToast();
  const canUpload = Boolean(
    user?.isSuperAdmin || user?.permissions.includes("prices:upload"),
  );
  const [meta, setMeta] = useState<CabacMeta | null>(null);
  const [result, setResult] = useState<CabacPage>(emptyPage);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestNumber = useRef(0);

  useEffect(() => {
    const handle = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      300,
    );
    return () => window.clearTimeout(handle);
  }, [query]);

  // Each new search begins from page one.
  useEffect(() => {
    setPage(1);
    setResult(emptyPage());
  }, [debouncedQuery, reload]);

  useEffect(() => {
    let active = true;
    void api<CabacMeta>("/price-lists/cabac/meta")
      .then((value) => {
        if (active) setMeta(value);
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error
              ? err.message
              : "Could not load CABAC metadata",
          );
      });
    return () => {
      active = false;
    };
  }, [reload]);

  useEffect(() => {
    const request = ++requestNumber.current;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      q: debouncedQuery,
      page: String(page),
      limit: String(LIMIT),
    });
    void api<CabacPage>(`/price-lists/cabac/items?${params}`)
      .then((data) => {
        if (request !== requestNumber.current) return;
        setResult((previous) => ({
          ...data,
          items: page === 1 ? data.items : [...previous.items, ...data.items],
        }));
      })
      .catch((err) => {
        if (request === requestNumber.current)
          setError(
            err instanceof Error ? err.message : "Failed to load CABAC prices",
          );
      })
      .finally(() => {
        if (request === requestNumber.current) setLoading(false);
      });
    return () => {
      requestNumber.current++;
    };
  }, [debouncedQuery, page, reload]);

  const hasMore = result.items.length < result.total;
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || loading || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setPage((value) => value + 1);
      },
      { rootMargin: "250px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, hasMore, result.items.length]);

  const importedAt = meta?.active?.importedAt;
  function onImported(message: string) {
    setDialogOpen(false);
    toast.success(message);
    setQuery("");
    setDebouncedQuery("");
    setPage(1);
    setResult(emptyPage());
    setReload((value) => value + 1);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="CABAC Price List"
        description="Search the current CABAC catalogue by item code or description."
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
              CABAC products
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {meta?.active
                ? `Last uploaded: ${importedAt ? new Date(importedAt).toLocaleDateString("en-AU") : "—"} · ${meta.active.filename}`
                : "No CABAC workbook imported yet"}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {result.total} items
          </span>
        </div>
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <label className="relative block max-w-lg">
            <Search
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search item code or description..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-slate-400"
            />
          </label>
        </div>
        {error && (
          <div className="p-4">
            <Notice message={error} />
          </div>
        )}
        {loading && result.items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-5 py-20 text-sm text-slate-500">
            <LoaderCircle size={18} className="animate-spin" /> Loading CABAC
            products…
          </div>
        ) : result.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-20 text-center">
            <FileSpreadsheet size={27} className="text-slate-400" />
            <p className="font-medium text-slate-800">
              {meta?.active ? "No matching items" : "CABAC price list is empty"}
            </p>
            <p className="text-sm text-slate-500">
              {meta?.active
                ? "Try a different keyword."
                : "Upload the first CABAC Excel workbook."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-237.5 bg-white text-left">
              <thead className="border-b border-slate-100 bg-white text-xs font-semibold text-slate-600">
                <tr>
                  {[
                    "Item Code",
                    "Item Description",
                    "Quantity",
                    "Quantity Per",
                    "Unit",
                    "Offer Price",
                    "Currency",
                  ].map((label) => (
                    <th className="whitespace-nowrap px-4 py-4" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-800">
                      {item.itemCode}
                    </td>
                    <td className="min-w-70 px-4 py-4 text-sm text-slate-900">
                      {item.itemDescription}
                    </td>
                    <td className="px-4 py-4 text-sm tabular-nums text-slate-600">
                      {Number(item.quantity).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-sm tabular-nums text-slate-600">
                      {Number(item.quantityPer).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {item.unit}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold tabular-nums text-slate-900">
                      {displayPrice(item.offerPrice)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {item.currency}
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
                <LoaderCircle className="animate-spin" size={15} /> Loading
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
        <ImportCabacDialog
          onClose={() => setDialogOpen(false)}
          onImported={onImported}
        />
      )}
    </div>
  );
}
