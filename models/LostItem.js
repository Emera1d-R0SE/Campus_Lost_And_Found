const mongoose = require('mongoose');

/**
 * LostItem model.
 * reportedBy references a Student's MongoDB _id (one-to-many: a student can
 * report many lost items, each lost item is reported by exactly one student).
 */
const lostItemSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    lastSeenLocation: {
      type: String,
      required: [true, 'Last-seen location is required'],
      trim: true,
    },
    dateLost: {
      type: Date,
      required: [true, 'Date lost is required'],
    },
    status: {
      type: String,
      enum: ['Lost', 'Found'],
      default: 'Lost',
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'A reporting student is required'],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LostItem', lostItemSchema);
