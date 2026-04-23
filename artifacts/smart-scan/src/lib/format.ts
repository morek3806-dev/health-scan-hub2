export function formatMoney(amountMinor: number | undefined | null, currency = "INR"): string {
  if (amountMinor == null) return "₹0.00";
  const amount = amountMinor / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency,
  }).format(amount);
}
