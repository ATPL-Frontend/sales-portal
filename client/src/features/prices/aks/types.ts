export type AksQuoteFile = {
  filename: string;
  pages: number;
  count: number;
  quoteRef: string | null;
  quoteDate: string | null;
  validUntil: string | null;
  notes: string[];
  unparsedRows: number;
};

export type AksPrice = {
  id?: number;
  partNo: string;
  description: string;
  price: number;
  uom: string;
  moq: string;
  quoteRef: string | null;
  quoteDate: string | null;
  validUntil: string | null;
  sourceFile: string;
  sourcePage: number;
};

export type AksPreview = {
  files: AksQuoteFile[];
  totalItems: number;
  duplicates: string[];
  ready: boolean;
  warnings: string[];
  sample: AksPrice[];
};

export type AksMeta = {
  active: null | {
    id: number;
    importedAt: string;
    fileCount: number;
    itemCount: number;
    files: AksQuoteFile[];
  };
};

export type AksPricePage = {
  items: AksPrice[];
  total: number;
  page: number;
  limit: number;
};
