import {
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
import type { CabacPreview } from "./types";

export function ImportCabacDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (message: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CabacPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setPreview(null);
    setError("");
    if (!selected) return;
    if (!/\.xlsx?$/i.test(selected.name) || selected.size > 20 * 1024 * 1024) {
      setError("Select a .xls or .xlsx workbook no larger than 20 MB.");
      return;
    }
    setBusy(true);
    try {
      const data = await uploadApi<{ preview: CabacPreview }>(
        "/price-lists/cabac/preview",
        selected,
      );
      setPreview(data.preview);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not preview workbook",
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
      const data = await uploadApi<{ count: number }>(
        "/price-lists/cabac/import",
        file,
      );
      onImported(
        `${data.count} CABAC products uploaded successfully. The previous CABAC list was replaced.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "CABAC import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title="Import CABAC price list"
      description="Preview all Excel sheets before replacing the current CABAC list."
      size="wide"
      onClose={busy ? () => {} : onClose}
    >
      <form className="space-y-5" onSubmit={(event) => void submit(event)}>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:bg-slate-100">
          <UploadCloud className="text-slate-500" size={24} />
          <span className="max-w-full truncate text-sm font-medium text-slate-800">
            {file?.name ?? "Choose CABAC Excel file"}
          </span>
          <span className="text-xs text-slate-500">
            .xls or .xlsx · 20 MB maximum
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
            <LoaderCircle className="animate-spin" size={16} /> Processing
            workbook…
          </p>
        )}
        {error && <Notice message={error} />}
        {preview && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FileSpreadsheet size={18} /> {preview.sheets.length} sheets
              </p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {preview.totalItems} products
              </span>
            </div>
            <div className="space-y-2">
              {preview.sheets.map((sheet) => (
                <div
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  key={sheet.name}
                >
                  <span className="min-w-0 truncate text-slate-800">
                    {sheet.name}
                  </span>
                  <span className="whitespace-nowrap text-slate-500">
                    {sheet.count} items
                  </span>
                </div>
              ))}
            </div>
            {preview.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Import requires review</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {preview.warnings.slice(0, 12).map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            {preview.sample.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-195 w-full text-left text-xs text-slate-700">
                  <thead className="bg-white text-slate-600">
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
                        <th className="px-3 py-3 font-semibold" key={label}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.sample.map((item, i) => (
                      <tr key={`${item.itemCode}-${i}`}>
                        <td className="whitespace-nowrap px-3 py-3 font-medium">
                          {item.itemCode}
                        </td>
                        <td className="px-3 py-3">{item.itemDescription}</td>
                        <td className="px-3 py-3">{item.quantity}</td>
                        <td className="px-3 py-3">{item.quantityPer}</td>
                        <td className="px-3 py-3">{item.unit}</td>
                        <td className="px-3 py-3 tabular-nums">
                          {item.offerPrice}
                        </td>
                        <td className="px-3 py-3">{item.currency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> Only your
              seven selected CABAC fields are imported. All previous CABAC
              records are replaced after successful validation; 3F and AKS
              remain untouched.
            </p>
          </>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
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
