export function formatPrice(
  price: number | null | undefined,
): string | null {
  if (price === null || price === undefined || Number.isNaN(price)) return null;
  const rounded = Math.round(price * 100) / 100;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${text} 元`;
}
