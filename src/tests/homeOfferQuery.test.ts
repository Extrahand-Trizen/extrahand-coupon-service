import assert from 'node:assert/strict';
import { buildHomeOfferQuery } from '../utils/homeOfferQuery';

const now = new Date('2026-11-10T00:00:00.000Z');

assert.deepEqual(buildHomeOfferQuery({}, now), {
  isActive: true,
  showOnHomeOffers: { $ne: false },
  applicableFlows: 'BOOK_NOW',
  redemptionScope: { $ne: 'GLOBAL_SINGLE_USE' },
  startDate: { $lte: now },
  $and: [
    { $or: [{ expiryDate: null }, { expiryDate: { $gte: now } }] },
    { $or: [{ applicableLocations: 'ALL_LOCATIONS' }] },
  ],
});

assert.deepEqual(buildHomeOfferQuery({ city: '  Hyderabad ' }, now).$and, [
  { $or: [{ expiryDate: null }, { expiryDate: { $gte: now } }] },
  {
    $or: [
      { applicableLocations: 'ALL_LOCATIONS' },
      {
        applicableLocations: 'SELECTED_LOCATIONS',
        $or: [{ cities: 'HYDERABAD' }],
      },
    ],
  },
]);

const pinCodeQuery = buildHomeOfferQuery({ pinCode: ' 500001 ' }, now);
assert.deepEqual(pinCodeQuery.$and, [
  { $or: [{ expiryDate: null }, { expiryDate: { $gte: now } }] },
  {
    $or: [
      { applicableLocations: 'ALL_LOCATIONS' },
      {
        applicableLocations: 'SELECTED_LOCATIONS',
        $or: [{ pincodes: '500001' }],
      },
    ],
  },
]);

const cityAndPinCodeQuery = buildHomeOfferQuery(
  { city: 'Hyderabad', pinCode: '500001' },
  now,
);
assert.deepEqual(cityAndPinCodeQuery.$and, [
  { $or: [{ expiryDate: null }, { expiryDate: { $gte: now } }] },
  {
    $or: [
      { applicableLocations: 'ALL_LOCATIONS' },
      {
        applicableLocations: 'SELECTED_LOCATIONS',
        $or: [{ cities: 'HYDERABAD' }, { pincodes: '500001' }],
      },
    ],
  },
]);

console.log('Home offer location query tests passed.');
