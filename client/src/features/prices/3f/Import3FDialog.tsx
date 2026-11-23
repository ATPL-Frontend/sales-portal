import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Info,
  LoaderCircle,
  UploadCloud,
} from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "../../../components/ui/Button";
import { Dialog } from "../../../components/ui/Dialog";
import { Notice } from "../../../components/ui/Notice";
import { uploadApi } from "../../../lib/api";
import type { ImportPreview } from "./types";

export function Import3FDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (message: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function readPreview(
    nextFile: File,
    nextSelections: Record<string, string>,
  ) {
    setBusy(true);
    setError("");
    try {
      const response = await uploadApi<{ preview: ImportPreview }>(
        "/price-lists/3f/preview",
        nextFile,
        {
          selections: JSON.stringify(nextSelections),
        },
      );
      setPreview(response.preview);
    } catch (err) {
      setPreview(null);
      setError(
        err instanceof Error ? err.message : "Could not preview the Excel file",
      );
    } finally {
      setBusy(false);
    }
  }
  function chooseFile(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0] ?? null;
    setFile(next);
    setPreview(null);
    setSelections({});
    setError("");
    if (next) {
      if (!/\.xlsx?$/i.test(next.name) || next.size > 8 * 1024 * 1024) {
        setError("Choose a .xls or .xlsx file smaller than 8 MB.");
        return;
      }
      void readPreview(next, {});
    }
  }
  function selectTier(sheetName: string, value: string) {
    if (!file) return;
    const next = { ...selections, [sheetName]: value };
    setSelections(next);
    void readPreview(file, next);
  }
  async function importFile(event: FormEvent) {
    event.preventDefault();
    if (!file || !preview?.allSelected || preview.totalItems === 0 || busy)
      return;
    setBusy(true);
    setError("");
    try {
      const response = await uploadApi<{ count: number }>(
        "/price-lists/3f/import",
        file,
        {
          selections: JSON.stringify(selections),
        },
      );
      onImported(
        `File uploaded successfully. ${response.count} cable prices imported; the previous 3F list was replaced.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title="Import 3F price list"
      description="Choose an Excel workbook, verify the selected price ranges, then replace the current list."
      size="wide"
      onClose={busy ? () => {} : onClose}
    >
      <form onSubmit={(event) => void importFile(event)} className="space-y-6">
        <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition hover:border-slate-400 hover:bg-slate-100">
          <UploadCloud size={23} className="mb-1 text-slate-500" />
          <span className="max-w-full truncate text-sm font-medium text-slate-800">
            {file ? file.name : "Choose an Excel workbook"}
          </span>
          <span className="text-xs text-slate-500">
            .xls or .xlsx · up to 8 MB
          </span>
          <input
            type="file"
            accept=".xls,.xlsx"
            disabled={busy}
            onChange={chooseFile}
            className="sr-only"
          />
        </label>
        {busy && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <LoaderCircle size={17} className="animate-spin" /> Checking
            workbook…
          </div>
        )}
        {error && <Notice message={error} />}
        {preview && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-slate-600" />
                <span className="text-sm font-semibold text-slate-800">
                  {preview.sheets.length} worksheets
                </span>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {preview.totalItems} valid items
              </div>
            </div>
            <div className="space-y-3">
              {preview.sheets.map((sheet) => (
                <div
                  key={sheet.name}
                  className="rounded-xl border border-slate-200 p-4 sm:p-5"
                >
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
                    <div className="min-w-0">
                      <h3
                        className="truncate text-sm font-semibold text-slate-900"
                        title={sheet.name}
                      >
                        {sheet.name}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {sheet.items} items · {sheet.categories.length}{" "}
                        categories · {sheet.skipped} skipped
                      </p>
                    </div>
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-slate-600">
                        LME price column
                      </span>
                      <select
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
                        value={sheet.selectedRange ?? ""}
                        disabled={busy || sheet.tiers.length === 0}
                        onChange={(e) => selectTier(sheet.name, e.target.value)}
                      >
                        <option value="">Select price range</option>
                        {sheet.tiers.map((tier) => (
                          <option key={tier.column} value={tier.range}>
                            {tier.range} · {tier.column}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    {sheet.selectedRange ? (
                      <>
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        <span className="text-slate-500">
                          {sheet.detectedBy === "yellow cell"
                            ? "Yellow cell detected"
                            : "Selected manually"}
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={14} className="text-amber-600" />
                        <span className="text-amber-700">
                          Select a range to continue
                        </span>
                      </>
                    )}
                  </div>
                  {sheet.warnings.length > 0 && (
                    <details className="mt-3 text-xs text-amber-800">
                      <summary className="cursor-pointer font-medium">
                        {sheet.warnings.length} import notice
                        {sheet.warnings.length === 1 ? "" : "s"}
                      </summary>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {sheet.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>
            {preview.sheets.some((s) => s.samples.length > 0) && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-800">
                  Sample rows
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-162 text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">UL</th>
                        <th className="px-4 py-3 font-medium">Description</th>
                        <th className="px-4 py-3 font-medium">Price</th>
                        <th className="px-4 py-3 font-medium">Range</th>
                        <th className="px-4 py-3 font-medium">Packing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sheets
                        .flatMap((s) => s.samples.slice(0, 2))
                        .map((line, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="px-4 py-3">{line.ul}</td>
                            <td className="px-4 py-3 text-slate-700">
                              {line.description}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold">
                              ${Number(line.price).toFixed(2)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              {line.priceRange}
                            </td>
                            <td className="px-4 py-3">{line.packing || "—"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2 text-xs leading-5 text-slate-500">
              <Info size={15} className="mt-0.5 shrink-0" />
              <p>
                Importing replaces all existing 3F prices. Only the selected LME
                column is stored.
              </p>
            </div>
          </>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={busy || !preview?.allSelected || !preview.totalItems}
          >
            {busy ? "Processing…" : `Import ${preview?.totalItems ?? 0} items`}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
