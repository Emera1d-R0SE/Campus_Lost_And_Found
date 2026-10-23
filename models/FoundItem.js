const mongoose = require('mongoose');

/**
 * FoundItem model.
 * reportedBy references a Student's MongoDB _id (one-to-many: a student can
 * report many found items, each found item is reported by exactly one student).
 */
const foundItemSchema = new mongoose.Schema(
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
    foundLocation: {
      type: String,
      required: [true, 'Found location is required'],
      trim: true,
    },
    dateFound: {
      type: Date,
      required: [true, 'Date found is required'],
    },
    status: {
      type: String,
      enum: ['Available', 'Returned'],
      default: 'Available',
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'A reporting student is required'],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FoundItem', foundItemSchema);
