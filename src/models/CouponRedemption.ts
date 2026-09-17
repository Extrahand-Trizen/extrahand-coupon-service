import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import {
  COUPON_REDEMPTION_SCOPES,
  CouponRedemptionScope,
  FLOW_TYPES,
  FlowType,
  REDEMPTION_STATUSES,
  RedemptionStatus,
} from '../constants/coupon';

export interface ICouponRedemption extends Document {
  couponId: Types.ObjectId;
  couponCode: string;
  userId: string;
  flowType: FlowType;
  redemptionScope: CouponRedemptionScope;
  bookingOrderId: string | null;
  taskId: string | null;
  discountAmount: number;
  status: RedemptionStatus;
  expiresAt: Date | null;
  createdAt: Date;
  redeemedAt: Date | null;
  updatedAt: Date;
}

const CouponRedemptionSchema = new Schema<ICouponRedemption>(
  {
    couponId: {
      type: Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
      index: true,
    },
    couponCode: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    flowType: {
      type: String,
      enum: FLOW_TYPES,
      required: true,
    },
    redemptionScope: {
      type: String,
      enum: COUPON_REDEMPTION_SCOPES,
      required: true,
      default: 'PER_USER',
      index: true,
    },
    bookingOrderId: {
      type: String,
      default: null,
      index: true,
    },
    taskId: {
      type: String,
      default: null,
      index: true,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: REDEMPTION_STATUSES,
      required: true,
      default: 'PENDING',
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    redeemedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

CouponRedemptionSchema.index({ couponId: 1, userId: 1, status: 1 });
CouponRedemptionSchema.index({ couponId: 1, redemptionScope: 1, status: 1 });
CouponRedemptionSchema.index({ userId: 1, status: 1 });
CouponRedemptionSchema.index({ status: 1, expiresAt: 1 });

/**
 * At most one in-flight (PENDING) redemption per coupon+user.
 * CANCELLED / EXPIRED do not block retries; completed REDEEMED are capped by usageLimitPerUser.
 */
CouponRedemptionSchema.index(
  { couponId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'PENDING' },
    name: 'uniq_active_redemption_per_coupon_user',
  }
);

CouponRedemptionSchema.index(
  { couponId: 1, redemptionScope: 1 },
  {
    unique: true,
    partialFilterExpression: {
      redemptionScope: 'GLOBAL_SINGLE_USE',
      status: { $in: ['PENDING', 'REDEEMED'] },
    },
    name: 'uniq_active_global_single_use_redemption_per_coupon',
  }
);

const CouponRedemption: Model<ICouponRedemption> =
  mongoose.models.CouponRedemption ||
  mongoose.model<ICouponRedemption>('CouponRedemption', CouponRedemptionSchema, 'couponRedemptions');

export default CouponRedemption;
