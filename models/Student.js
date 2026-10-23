const mongoose = require('mongoose');

/**
 * Student model.
 * One student can report many lost items and many found items.
 * The student's MongoDB _id is the only identifier used in routes and references.
 */
const studentSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address'],
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
    },
    contactNumber: {
      type: String,
      required: [true, 'Contact number is required'],
      trim: true,
      minlength: [6, 'Contact number looks too short'],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Student', studentSchema);
