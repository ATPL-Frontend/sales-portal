export function unitPrice(
  netPackPrice: string | number,
  quantityPerPack: string | number,
): number | null {
  const price = Number(netPackPrice);
  const quantity = Number(quantityPerPack);
  if (!Number.isFinite(price) || !Number.isFinite(quantity) || quantity <= 0)
    return null;
  return price / quantity;
}
export function formatPrice(value: number | string | null, digits = 4): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  }).format(Number(value));
}
export function formatQuantity(value: number | string): string {
  return Number(value).toLocaleString("en-AU", { maximumFractionDigits: 4 });
}
export function formatEffectiveDate(value: string | null | undefined): string {
  if (!value) return "Not specified";
  // Avoid timezone-shift issues for SQL date-only values.
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
