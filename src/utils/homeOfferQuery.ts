export type HomeOfferLocation = {
  city?: string;
  pinCode?: string;
};

export function buildHomeOfferQuery(
  location: HomeOfferLocation = {},
  now = new Date(),
): Record<string, unknown> {
  const city = String(location.city || '').trim().toUpperCase();
  const pinCode = String(location.pinCode || '').trim();
  const locationMatches: Record<string, unknown>[] = [];

  if (city) locationMatches.push({ cities: city });
  if (pinCode) locationMatches.push({ pincodes: pinCode });

  const locationScopes: Record<string, unknown>[] = [
    { applicableLocations: 'ALL_LOCATIONS' },
  ];
  if (locationMatches.length > 0) {
    locationScopes.push({
      applicableLocations: 'SELECTED_LOCATIONS',
      $or: locationMatches,
    });
  }

  return {
    isActive: true,
    showOnHomeOffers: { $ne: false },
    applicableFlows: 'BOOK_NOW',
    redemptionScope: { $ne: 'GLOBAL_SINGLE_USE' },
    startDate: { $lte: now },
    $and: [
      { $or: [{ expiryDate: null }, { expiryDate: { $gte: now } }] },
      { $or: locationScopes },
    ],
  };
}
