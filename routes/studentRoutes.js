const express = require('express');
const mongoose = require('mongoose');

const Student = require('../models/Student');
const LostItem = require('../models/LostItem');
const FoundItem = require('../models/FoundItem');

const router = express.Router();

// Simple email format check (mirrors the schema regex)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /students — list all registered students
router.get('/students', async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.render('students', {
      title: 'Registered Students',
      students,
      success: req.query.success || null,
    });
  } catch (err) {
    console.error('List students error:', err);
    res.status(500).render('error', {
      title: 'Database error',
      message: 'Could not load students. Please try again.',
    });
  }
});

// GET /students/new — registration form
router.get('/students/new', (req, res) => {
  res.render('student-form', {
    title: 'Register Student',
    student: {},
    error: null,
  });
});

// POST /students — create a student profile
router.post('/students', async (req, res) => {
  const fullName = (req.body.fullName || '').trim();
  const email = (req.body.email || '').trim();
  const department = (req.body.department || '').trim();
  const contactNumber = (req.body.contactNumber || '').trim();
  const values = { fullName, email, department, contactNumber };

  // ---- Manual validation (whitespace-only + format) ----
  const errors = [];
  if (!fullName) errors.push('Full name is required.');
  if (!email) errors.push('Email is required.');
  else if (!EMAIL_RE.test(email)) errors.push('Please enter a valid email address.');
  if (!department) errors.push('Department is required.');
  if (!contactNumber) errors.push('Contact number is required.');

  if (errors.length) {
    return res.status(400).render('student-form', {
      title: 'Register Student',
      student: values,
      error: errors.join(' '),
    });
  }

  try {
    const student = await Student.create({ fullName, email: email.toLowerCase(), department, contactNumber });
    return res.redirect(`/students/${student._id}?success=Student profile created successfully.`);
  } catch (err) {
    // Duplicate email (MongoDB unique index)
    if (err.code === 11000) {
      return res.status(409).render('student-form', {
        title: 'Register Student',
        student: values,
        error: 'A student with this email is already registered.',
      });
    }
    // Mongoose validation error
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).render('student-form', {
        title: 'Register Student',
        student: values,
        error: messages.join(' '),
      });
    }
    console.error('Create student error:', err);
    return res.status(500).render('error', {
      title: 'Database error',
      message: 'Could not create the student. Please try again.',
    });
  }
});

// GET /students/:id — display one student profile
router.get('/students/:id', async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).render('error', {
      title: 'Invalid ID',
      message: 'The student ID in the URL is not a valid MongoDB ID.',
    });
  }

  try {
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).render('error', {
        title: 'Student not found',
        message: 'No student exists with this ID.',
      });
    }

    // Show the items this student has reported (uses the Student -> item relationship)
    const lostItems = await LostItem.find({ reportedBy: student._id }).sort({ dateLost: -1 });
    const foundItems = await FoundItem.find({ reportedBy: student._id }).sort({ dateFound: -1 });

    res.render('student-profile', {
      title: `${student.fullName} — Profile`,
      student,
      lostItems,
      foundItems,
      success: req.query.success || null,
    });
  } catch (err) {
    console.error('Show student error:', err);
    res.status(500).render('error', {
      title: 'Database error',
      message: 'Could not load the student profile.',
    });
  }
});

module.exports = router;
