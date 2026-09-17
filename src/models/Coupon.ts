import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  APPLICABILITY_TYPES,
  ApplicabilityType,
  COUPON_REDEMPTION_SCOPES,
  CouponRedemptionScope,
  DISCOUNT_TYPES,
  DiscountType,
  FLOW_TYPES,
  FlowType,
  LOCATION_APPLICABILITY_TYPES,
  LocationApplicabilityType,
  normalizeCouponCode,
} from '../constants/coupon';

export interface ICoupon extends Document {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number;
  applicableTo: ApplicabilityType;
  serviceIds: string[];
  applicableLocations: LocationApplicabilityType;
  cities: string[];
  pincodes: string[];
  applicableFlows: FlowType[];
  redemptionScope: CouponRedemptionScope;
  firstBookingOnly: boolean;
  usageLimitPerUser: number;
  overallUsageLimit: number | null;
  startDate: Date;
  expiryDate: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    discountType: {
      type: String,
      enum: DISCOUNT_TYPES,
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minOrderAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    applicableTo: {
      type: String,
      enum: APPLICABILITY_TYPES,
      required: true,
      default: 'ALL_SERVICES',
    },
    serviceIds: {
      type: [String],
      default: [],
    },
    applicableLocations: {
      type: String,
      enum: LOCATION_APPLICABILITY_TYPES,
      required: true,
      default: 'ALL_LOCATIONS',
    },
    cities: {
      type: [String],
      default: [],
    },
    pincodes: {
      type: [String],
      default: [],
    },
    applicableFlows: {
      type: [{ type: String, enum: FLOW_TYPES }],
      required: true,
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length > 0,
        message: 'At least one applicable flow is required',
      },
    },
    redemptionScope: {
      type: String,
      enum: COUPON_REDEMPTION_SCOPES,
      required: true,
      default: 'PER_USER',
    },
    firstBookingOnly: {
      type: Boolean,
      default: false,
    },
    usageLimitPerUser: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    overallUsageLimit: {
      type: Number,
      min: 1,
      default: null,
      validate: {
        validator: (v: number | null) => v === null || v >= 1,
        message: 'overallUsageLimit must be at least 1 when set',
      },
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

CouponSchema.pre('validate', function (next) {
  if (this.code) {
    this.code = normalizeCouponCode(this.code);
  }
  if (this.applicableTo === 'ALL_SERVICES') {
    this.serviceIds = [];
  }
  if (this.applicableLocations === 'ALL_LOCATIONS') {
    this.cities = [];
    this.pincodes = [];
  } else {
    if (Array.isArray(this.cities)) {
      this.cities = this.cities.map((c) => String(c).trim().toUpperCase()).filter(Boolean);
    }
    if (Array.isArray(this.pincodes)) {
      this.pincodes = this.pincodes.map((p) => String(p).trim()).filter(Boolean);
    }
  }
  next();
});

CouponSchema.index({ isActive: 1, expiryDate: 1 });

const Coupon: Model<ICoupon> =
  mongoose.models.Coupon || mongoose.model<ICoupon>('Coupon', CouponSchema, 'coupons');

export default Coupon;
