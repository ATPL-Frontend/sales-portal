export type CarrollItem = {
  id: number;
  partNumber: string;
  description: string;
  perPackListPrice: number | string;
  quantityPerPack: number | string;
  perPackNetPrice: number | string;
  discountPercent: number | string;
  categoryDiscountCode: string;
  categoryProduct: string;
};
export type CarrollPage = {
  items: CarrollItem[];
  total: number;
  page: number;
  limit: number;
};
export type CarrollMeta = {
  active: null | {
    id: number;
    filename: string;
    effectiveDate: string | null;
    importedAt: string;
    itemCount: number;
  };
};
export type CarrollPreview = {
  filename: string;
  effectiveDate: string | null;
  totalItems: number;
  ready: boolean;
  sheets: Array<{ name: string; count: number; headerRow: number }>;
  warnings: string[];
  sample: Array<
    Omit<CarrollItem, "id"> & { sheetName: string; sourceRow: number }
  >;
};
export type CarrollCategories = {
  categories: Array<{ name: string; count: number }>;
};
