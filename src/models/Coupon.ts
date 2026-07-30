import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  APPLICABILITY_TYPES,
  ApplicabilityType,
  DISCOUNT_TYPES,
  DiscountType,
  FLOW_TYPES,
  FlowType,
  normalizeCouponCode,
} from '../constants/coupon';

export interface ICoupon extends Document {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number;
  applicableTo: ApplicabilityType;
  serviceIds: string[];
  applicableFlows: FlowType[];
  firstBookingOnly: boolean;
  usageLimitPerUser: number;
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
    applicableFlows: {
      type: [{ type: String, enum: FLOW_TYPES }],
      required: true,
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length > 0,
        message: 'At least one applicable flow is required',
      },
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
  next();
});

CouponSchema.index({ isActive: 1, expiryDate: 1 });

const Coupon: Model<ICoupon> =
  mongoose.models.Coupon || mongoose.model<ICoupon>('Coupon', CouponSchema, 'coupons');

export default Coupon;
