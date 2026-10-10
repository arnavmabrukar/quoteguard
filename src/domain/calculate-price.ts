export function calculatePrice(
  costCents: number,
  markupBps: number,
  quantity: number,
) {
  if (
    ![costCents, markupBps, quantity].every(Number.isSafeInteger) ||
    costCents < 0 ||
    markupBps < 0 ||
    quantity <= 0 ||
    quantity > 100000
  )
    throw new Error("Invalid pricing input");
  const unit = (BigInt(costCents) * BigInt(10000 + markupBps) + 5000n) / 10000n;
  const total = unit * BigInt(quantity);
  if (total > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Price exceeds supported range");
  return { unitPriceCents: Number(unit), subtotalCents: Number(total) };
}
