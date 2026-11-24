import {
  CalendarDays,
  CheckCircle2,
  FileSpreadsheet,
  LoaderCircle,
  UploadCloud,
} from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "../../../components/ui/Button";
import { Dialog } from "../../../components/ui/Dialog";
import { Notice } from "../../../components/ui/Notice";
import { uploadApi } from "../../../lib/api";
import {
  formatEffectiveDate,
  formatPrice,
  formatQuantity,
  unitPrice,
} from "./pricing";
import type { CarrollPreview } from "./types";

export function ImportCarrollDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (message: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CarrollPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setPreview(null);
    setError("");
    if (!selected) return;
    if (!/\.xlsx?$/i.test(selected.name) || selected.size > 20 * 1024 * 1024) {
      setError("Choose a .xls or .xlsx workbook up to 20 MB.");
      return;
    }
    setBusy(true);
    try {
      const data = await uploadApi<{ preview: CarrollPreview }>(
        "/price-lists/carroll/preview",
        selected,
      );
      setPreview(data.preview);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not preview Carroll workbook",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !preview?.ready || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await uploadApi<{ count: number }>(
        "/price-lists/carroll/import",
        file,
      );
      onImported(
        `${result.count} Carroll products uploaded successfully. Previous Carroll prices were replaced.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Carroll import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title="Import Carroll price list"
      size="wide"
      description="Preview the Excel workbook before replacing the current Carroll list."
      onClose={busy ? () => {} : onClose}
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-5">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:bg-slate-100">
          <UploadCloud size={24} className="text-slate-500" />
          <span className="max-w-full truncate text-sm font-medium text-slate-800">
            {file?.name ?? "Select Carroll Excel file"}
          </span>
          <span className="text-xs text-slate-500">
            .xls / .xlsx · maximum 20 MB
          </span>
          <input
            type="file"
            accept=".xls,.xlsx"
            className="sr-only"
            disabled={busy}
            onChange={(event) => void chooseFile(event)}
          />
        </label>
        {busy && (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <LoaderCircle size={16} className="animate-spin" /> Reading
            workbook…
          </p>
        )}
        {error && <Notice message={error} />}
        {preview && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2">
                <FileSpreadsheet size={17} />
                {preview.sheets.length} sheets ·{" "}
                {preview.totalItems.toLocaleString()} items
              </span>
              <span className="inline-flex items-center gap-2">
                <CalendarDays size={17} />
                Effective: {formatEffectiveDate(preview.effectiveDate)}
              </span>
            </div>
            <div className="space-y-2">
              {preview.sheets.map((sheet) => (
                <div
                  key={sheet.name}
                  className="flex justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm"
                >
                  <span className="truncate text-slate-800">{sheet.name}</span>
                  <span className="whitespace-nowrap text-slate-500">
                    {sheet.count} items
                  </span>
                </div>
              ))}
            </div>
            {preview.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Import notes</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {preview.warnings.slice(0, 10).map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            {preview.sample.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-312.5 text-left text-xs text-slate-700">
                  <thead className="bg-white text-slate-600">
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
                      ].map((h) => (
                        <th
                          key={h}
                          className="whitespace-nowrap px-3 py-3 font-semibold"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.sample.map((item, index) => (
                      <tr key={`${item.sheetName}-${item.sourceRow}-${index}`}>
                        <td className="whitespace-nowrap px-3 py-3 font-medium">
                          {item.partNumber}
                        </td>
                        <td className="min-w-60 px-3 py-3">
                          {item.description}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          ${formatPrice(item.perPackListPrice)}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          {formatQuantity(item.quantityPerPack)}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          ${formatPrice(item.perPackNetPrice)}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          $
                          {formatPrice(
                            unitPrice(
                              item.perPackNetPrice,
                              item.quantityPerPack,
                            ),
                          )}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          {formatQuantity(item.discountPercent)}%
                        </td>
                        <td className="px-3 py-3">
                          {item.categoryDiscountCode}
                        </td>
                        <td className="px-3 py-3">{item.categoryProduct}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              Unit price is calculated as net pack price divided by quantity per
              pack, not stored in MySQL. EAN and price-change columns are
              excluded. Other suppliers remain untouched.
            </p>
          </>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !preview?.ready}>
            {busy ? "Processing…" : `Import ${preview?.totalItems ?? 0} items`}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
