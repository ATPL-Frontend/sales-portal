import {
  CalendarDays,
  FileText,
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
import { ImportAksDialog } from "./ImportAksDialog";
import type { AksMeta, AksPricePage } from "./types";

const PAGE_SIZE = 20;

function formatQuoteDate(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat("en-AU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(parsed);
}
const emptyResult = (): AksPricePage => ({
  items: [],
  total: 0,
  page: 1,
  limit: PAGE_SIZE,
});

export function AksPricePage() {
  const { user } = useAuth();
  const toast = useToast();
  const canUpload = Boolean(
    user?.isSuperAdmin || user?.permissions.includes("prices:upload"),
  );
  const [meta, setMeta] = useState<AksMeta | null>(null);
  const [result, setResult] = useState<AksPricePage>(emptyResult);
  const [query, setQuery] = useState("");
  const [sourceFile, setSourceFile] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const fetching = useRef(true);

  useEffect(() => {
    let alive = true;
    void api<AksMeta>("/price-lists/aks/meta")
      .then((data) => {
        if (alive) setMeta(data);
      })
      .catch((err) => {
        if (alive)
          setError(
            err instanceof Error ? err.message : "Could not load AKS documents",
          );
      });
    return () => {
      alive = false;
    };
  }, [reload]);

  useEffect(() => {
    let alive = true;
    fetching.current = true;
    setLoading(true);
    setError("");
    const timer = window.setTimeout(
      () => {
        const params = new URLSearchParams({
          q: query,
          sourceFile,
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        void api<AksPricePage>(`/price-lists/aks/items?${params}`)
          .then((data) => {
            if (!alive) return;
            setResult((old) =>
              page === 1
                ? data
                : { ...data, items: [...old.items, ...data.items] },
            );
          })
          .catch((err) => {
            if (alive)
              setError(
                err instanceof Error
                  ? err.message
                  : "Could not load AKS prices",
              );
          })
          .finally(() => {
            if (alive) {
              fetching.current = false;
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
  }, [query, sourceFile, page, reload]);

  const quoteDates = [
    ...new Set(
      meta?.active?.files
        .map((file) => file.quoteDate)
        .filter((date): date is string => Boolean(date)) ?? [],
    ),
  ].sort();
  const hasMore = result.items.length < result.total;
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !fetching.current) {
          fetching.current = true;
          setPage((p) => p + 1);
        }
      },
      { rootMargin: "250px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [result.items.length, hasMore]);

  function resetSearch(text: string, file: string) {
    fetching.current = true;
    setResult(emptyResult());
    setPage(1);
    setQuery(text);
    setSourceFile(file);
  }

  function onImported(message: string) {
    setImportOpen(false);
    toast.success(message);
    resetSearch("", "");
    setReload((v) => v + 1);
  }

  return (
    <div>
      <PageHeader
        title="AKS Price List"
        description="Search current AKS quotations by part number or description."
        action={
          canUpload ? (
            <Button onClick={() => setImportOpen(true)}>
              <Upload size={17} /> Import PDFs
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-4">
          <Notice message={error} />
        </div>
      )}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="space-y-5 border-b border-slate-100 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                AKS quotations
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {meta?.active
                  ? `${meta.active.fileCount} PDF${meta.active.fileCount === 1 ? "" : "s"} · current imported list`
                  : "No PDFs imported yet"}
              </p>
              {meta?.active && (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                  <CalendarDays size={14} className="shrink-0 text-slate-500" />
                  <span className="font-medium">
                    Quotation date{quoteDates.length !== 1 ? "s" : ""}:
                  </span>
                  <span>
                    {quoteDates.length
                      ? quoteDates.map(formatQuoteDate).join(" · ")
                      : "Not specified in PDF"}
                  </span>
                </p>
              )}
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
              {loading && !result.items.length
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
                onChange={(e) => resetSearch(e.target.value, sourceFile)}
                placeholder="Search part no. or description…"
                aria-label="Search AKS prices"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400"
              />
            </label>
            <select
              value={sourceFile}
              onChange={(e) => resetSearch(query, e.target.value)}
              aria-label="Filter quotation document"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="">All PDF documents</option>
              {meta?.active?.files.map((file, i) => (
                <option key={`${file.filename}-${i}`} value={file.filename}>
                  {file.filename}
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
              <FileText size={22} />
            </div>
            <h3 className="text-base font-semibold text-slate-800">
              {meta?.active
                ? "No matching products"
                : "Your AKS price list is empty"}
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              {meta?.active
                ? "Try another part number or search term."
                : "Import AKS PDFs to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-225 border-collapse text-left">
              <thead className="bg-white text-xs font-semibold text-slate-600">
                <tr>
                  <th className="w-36 px-5 py-4 sm:px-6">Part No.</th>
                  <th className="px-5 py-4">Description</th>
                  <th className="w-32 px-5 py-4">Price</th>
                  <th className="w-28 px-5 py-4">UOM</th>
                  <th className="w-28 px-5 py-4">MOQ</th>
                  <th className="w-40 px-5 py-4">Quote</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {result.items.map((item) => {
                  // const expired = Boolean(
                  //   item.validUntil &&
                  //   item.validUntil < new Date().toISOString().slice(0, 10),
                  // );
                  return (
                    <tr
                      key={item.id}
                      className="align-top transition-colors hover:bg-slate-50/60"
                    >
                      <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-900 sm:px-6">
                        {item.partNo}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-800">
                        {item.description}
                        <p
                          className="mt-1 truncate text-xs text-slate-500"
                          title={item.sourceFile}
                        >
                          {item.sourceFile} · Page {item.sourcePage}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold tabular-nums text-slate-900">
                        ${Number(item.price).toFixed(2)}{" "}
                        <span className="text-xs font-normal text-slate-500">
                          AUD
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {item.uom}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {item.moq}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600">
                        {item.quoteRef || "—"}
                        <p className="mt-1">
                          {item.quoteDate || "Date not specified"}
                        </p>
                        {/* {expired && (
                          <span className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-amber-900">
                            Expired
                          </span>
                        )} */}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {result.items.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-4 text-center text-xs text-slate-500 sm:px-6">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <LoaderCircle size={15} className="animate-spin" /> Loading
                more…
              </span>
            ) : !hasMore ? (
              `All ${result.total} items loaded`
            ) : null}
            <div ref={sentinel} className="h-px" aria-hidden="true" />
          </div>
        )}
      </section>
      {importOpen && (
        <ImportAksDialog
          onClose={() => setImportOpen(false)}
          onImported={onImported}
        />
      )}
    </div>
  );
}
