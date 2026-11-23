export type CabacItem = {
  id: number;
  itemCode: string;
  itemDescription: string;
  quantity: string | number;
  quantityPer: string | number;
  unit: string;
  offerPrice: string | number;
  currency: string;
};
export type CabacPage = {
  items: CabacItem[];
  total: number;
  page: number;
  limit: number;
};
export type CabacMeta = {
  active: null | {
    id: number;
    filename: string;
    itemCount: number;
    importedAt: string;
  };
};
export type CabacPreview = {
  filename: string;
  totalItems: number;
  ready: boolean;
  sheets: Array<{ name: string; count: number; headerRow: number }>;
  warnings: string[];
  sample: Omit<CabacItem, "id">[];
};
