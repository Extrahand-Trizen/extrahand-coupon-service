import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { FLOW_TYPES, FlowType, REDEMPTION_STATUSES, RedemptionStatus } from '../constants/coupon';

export interface ICouponRedemption extends Document {
  couponId: Types.ObjectId;
  couponCode: string;
  userId: string;
  flowType: FlowType;
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
CouponRedemptionSchema.index({ userId: 1, status: 1 });
CouponRedemptionSchema.index({ status: 1, expiresAt: 1 });

/**
 * At most one active (PENDING or REDEEMED) redemption per coupon+user.
 * CANCELLED / EXPIRED do not block retries.
 */
CouponRedemptionSchema.index(
  { couponId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['PENDING', 'REDEEMED'] } },
    name: 'uniq_active_redemption_per_coupon_user',
  }
);

const CouponRedemption: Model<ICouponRedemption> =
  mongoose.models.CouponRedemption ||
  mongoose.model<ICouponRedemption>('CouponRedemption', CouponRedemptionSchema, 'couponRedemptions');

export default CouponRedemption;
