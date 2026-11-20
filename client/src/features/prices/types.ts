export type PriceItem = {
  id: number;
  sheetName: string;
  category: string;
  ul: string;
  itemNo: string;
  description: string;
  price: number;
  priceRange: string;
  packing: string | null;
  moq: string | null;
  leadTime: string | null;
  sourceRow: number;
};
export type PriceVersion = {
  id: number;
  month: string;
  filename: string;
  itemCount: number;
  importedAt: string;
  active?: boolean;
};
export type PriceMeta = {
  active: PriceVersion | null;
  categories: { category: string; count: number }[];
};
export type PricePage = {
  items: PriceItem[];
  total: number;
  page: number;
  limit: number;
};
export type SheetPreview = {
  name: string;
  tiers: { range: string; column: string }[];
  selectedRange: string | null;
  detectedBy: "yellow cell" | "manual" | "not detected";
  items: number;
  skipped: number;
  warnings: string[];
  samples: PriceItem[];
  categories: string[];
};
export type ImportPreview = {
  filename: string;
  sheets: SheetPreview[];
  totalItems: number;
  allSelected: boolean;
};
