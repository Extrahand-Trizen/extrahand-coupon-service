/**
 * Lightweight coupon math checks (no DB).
 * Run: npx ts-node src/scripts/couponMathSelfTest.ts
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function calc(discountType: 'FIXED' | 'PERCENTAGE', discountValue: number, amount: number): number {
  let discount =
    discountType === 'FIXED' ? discountValue : (amount * discountValue) / 100;
  discount = round2(Math.max(0, discount));
  return Math.min(discount, round2(amount));
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(calc('FIXED', 100, 708) === 100, 'FIRST100 fixed discount');
assert(calc('FIXED', 100, 50) === 50, 'fixed cannot exceed bill');
assert(calc('PERCENTAGE', 20, 1000) === 200, '20% of 1000');
assert(round2(708 - 100) === 608, 'after coupon');
assert(round2(608 - 50) === 558, 'after coins');

console.log('couponMathSelfTest: OK');
