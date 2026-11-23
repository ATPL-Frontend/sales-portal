import { useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertTriangle, FileText, LoaderCircle, UploadCloud } from 'lucide-react';
import { Dialog } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Notice } from '../../../components/ui/Notice';
import type { AksPreview } from './types';

const MAX_FILES = 8;
const MAX_ONE = 8 * 1024 * 1024;
const MAX_TOTAL = 32 * 1024 * 1024;

async function uploadBatch<T>(path: string, files: File[]): Promise<T> {
  const body = new FormData();
  files.forEach(file => body.append('files', file));
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { method: 'POST', body, credentials: 'include' });
  } catch {
    throw new Error('Cannot reach the API. Check your server connection.');
  }
  const data = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(data.error || `Upload failed (${response.status}).`);
  return data as T;
}

export function ImportAksDialog({ onClose, onImported }: {
  onClose: () => void;
  onImported: (message: string) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<AksPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function loadPreview(selected: File[]) {
    setBusy(true);
    setError('');
    try {
      const result = await uploadBatch<{ preview: AksPreview }>('/price-lists/aks/preview', selected);
      setPreview(result.preview);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : 'Could not preview the PDFs');
    } finally {
      setBusy(false);
    }
  }

  function onFilesChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setFiles(selected);
    setPreview(null);
    setError('');
    if (!selected.length) return;
    if (selected.length > MAX_FILES || selected.some(f => !/\.pdf$/i.test(f.name) || f.size > MAX_ONE) || selected.reduce((n, f) => n + f.size, 0) > MAX_TOTAL) {
      setError('Choose 1–8 PDFs, maximum 8 MB per file and 32 MB combined.');
      return;
    }
    void loadPreview(selected);
  }

  async function onImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!files.length || !preview?.ready || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await uploadBatch<{ count: number; fileCount: number }>('/price-lists/aks/import', files);
      onImported(`AKS list updated: ${result.count} products from ${result.fileCount} PDF${result.fileCount === 1 ? '' : 's'}. Previous AKS prices were replaced.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  return <Dialog
    title="Import AKS price PDFs"
    description="Upload multiple AKS quotations together. Review the extraction before replacing your current AKS list."
    size="wide"
    onClose={busy ? () => {} : onClose}
  >
    <form onSubmit={event => void onImport(event)} className="space-y-5">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-7 text-center hover:border-slate-500">
        <UploadCloud size={26} className="text-slate-500" />
        <span className="text-sm font-semibold text-slate-800">Select AKS PDF files</span>
        <span className="text-xs text-slate-500">1–8 PDFs · up to 8 MB each · 32 MB combined</span>
        <input type="file" accept=".pdf,application/pdf" multiple onChange={onFilesChange} disabled={busy} className="sr-only" />
      </label>

      {files.length > 0 && <div className="space-y-2">
        <p className="text-xs font-medium text-slate-500">Selected documents ({files.length})</p>
        <div className="flex flex-wrap gap-2">
          {files.map((file, i) => <span key={`${file.name}-${i}`} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            <FileText size={14} className="shrink-0" /><span className="max-w-64 truncate">{file.name}</span>
          </span>)}
        </div>
      </div>}

      {error && <Notice message={error} />}
      {busy && <p className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle size={17} className="animate-spin" /> Processing documents…</p>}

      {preview && <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
          <div><p className="text-sm font-semibold text-slate-900">{preview.totalItems} products identified</p>
            <p className="mt-1 text-xs text-slate-500">{preview.files.length} PDF file{preview.files.length !== 1 ? 's' : ''} processed</p></div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${preview.ready ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
            {preview.ready ? 'Ready to import' : 'Review required'}
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">
            <span>Document</span><span>Quote ref</span><span>Items</span>
          </div>
          {preview.files.map((file, i) => <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-700">
            <span className="truncate" title={file.filename}>{file.filename}</span><span>{file.quoteRef ?? '—'}</span><span className="font-semibold">{file.count}</span>
          </div>)}
        </div>

        {preview.warnings.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle size={16} /> Import warnings</p>
          {preview.warnings.map((w, i) => <p key={i} className="mt-1 text-xs leading-5">{w}</p>)}
          {preview.duplicates.length > 0 && <p className="mt-2 text-xs font-semibold">Duplicate part numbers: {preview.duplicates.slice(0, 15).join(', ')}. Remove overlapping files before importing.</p>}
        </div>}

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-160 w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600"><tr>
              <th className="px-3 py-3">Part No.</th><th className="px-3 py-3">Description</th>
              <th className="px-3 py-3 text-right">AUD</th><th className="px-3 py-3">UOM</th><th className="px-3 py-3">MOQ</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {preview.sample.map((item, i) => <tr key={i}>
                <td className="whitespace-nowrap px-3 py-3 font-semibold">{item.partNo}</td>
                <td className="px-3 py-3">{item.description}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">${Number(item.price).toFixed(2)}</td>
                <td className="px-3 py-3">{item.uom}</td><td className="px-3 py-3">{item.moq}</td>
              </tr>)}
            </tbody>
          </table>
          {preview.totalItems > preview.sample.length && <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">Showing first {preview.sample.length} items for review.</p>}
        </div>
      </div>}

      <p className="text-xs leading-5 text-slate-500">Each successful import replaces the full AKS list, not 3F. PDFs with duplicate part numbers or unparsed product rows must be corrected before import. Scanned PDFs need OCR and are not supported yet.</p>
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={!preview?.ready || busy}>
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <UploadCloud size={16} />}
          Replace AKS price list
        </Button>
      </div>
    </form>
  </Dialog>;
}
