import assert from 'node:assert/strict';
import {
  calculateDiscount,
  resolveDiscountBase,
} from '../services/CouponService';

const lineItems = [
  {
    serviceId: 'home-cleaning',
    skuSlug: 'bathroom-deep-clean',
    categorySlug: 'home-cleaning',
    amount: 800,
    lineKey: 'home-cleaning::bathroom-deep-clean',
  },
  {
    serviceId: 'ac-services',
    skuSlug: 'ac-repair',
    categorySlug: 'ac-services',
    amount: 1500,
    lineKey: 'ac-services::ac-repair',
  },
  {
    serviceId: 'pest-control',
    skuSlug: 'ant-control',
    categorySlug: 'pest-control',
    amount: 1100,
    lineKey: 'pest-control::ant-control',
  },
];

const allServicesResult = resolveDiscountBase({
  coupon: { applicableTo: 'ALL_SERVICES', serviceIds: [] },
  orderAmount: 3400,
  serviceIds: [],
  lineItems,
});
assert.equal(allServicesResult.discountBase, 1500);
assert.equal(allServicesResult.minimumOrderBase, 3400);
assert.deepEqual(allServicesResult.eligibleServiceIds, ['ac-repair']);
assert.deepEqual(allServicesResult.eligibleLineKeys, ['ac-services::ac-repair']);
assert.equal(
  calculateDiscount({ discountType: 'PERCENTAGE', discountValue: 50 }, allServicesResult.discountBase),
  750,
);
assert.equal(
  calculateDiscount({ discountType: 'FIXED', discountValue: 2000 }, allServicesResult.discountBase),
  1500,
);

const selectedServicesResult = resolveDiscountBase({
  coupon: { applicableTo: 'SELECTED_SERVICES', serviceIds: ['home-cleaning', 'pest-control'] },
  orderAmount: 3400,
  serviceIds: [],
  lineItems,
});
assert.equal(selectedServicesResult.discountBase, 1100);
assert.equal(selectedServicesResult.minimumOrderBase, 1900);
assert.deepEqual(selectedServicesResult.eligibleServiceIds, ['ant-control']);
assert.deepEqual(selectedServicesResult.eligibleLineKeys, ['pest-control::ant-control']);
assert.equal(
  calculateDiscount({ discountType: 'PERCENTAGE', discountValue: 50 }, selectedServicesResult.discountBase),
  550,
);

console.log('couponSingleServiceDiscountSelfTest: OK');
