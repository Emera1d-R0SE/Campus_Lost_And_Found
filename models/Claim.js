const mongoose = require('mongoose');

/**
 * Claim model (Phase 2).
 * A claim links one student (claimedBy) to one found item (foundItemId).
 * Every new claim starts as Pending. Only Pending claims can be approved/rejected.
 *
 * Duplicate-claim rule: one claim per student per found item. Enforced by a unique
 * compound index below AND by an application-level check in the route, so a student
 * cannot submit a second claim for the same item (even after a previous claim was
 * rejected — they should instead contact the reporter).
 */
const claimSchema = new mongoose.Schema(
  {
    foundItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoundItem',
      required: [true, 'A found item is required'],
    },
    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'A claiming student is required'],
    },
    reason: {
      type: String,
      required: [true, 'A reason is required'],
      trim: true,
      minlength: [5, 'Reason must be at least 5 characters'],
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
  },
  { timestamps: true }
);

// One claim per student per found item (database-level backstop for the duplicate rule)
claimSchema.index({ foundItemId: 1, claimedBy: 1 }, { unique: true });

module.exports = mongoose.model('Claim', claimSchema);
