const express = require('express');
const mongoose = require('mongoose');

const FoundItem = require('../models/FoundItem');
const Student = require('../models/Student');

const router = express.Router();

// GET /found-items — list found-item reports (with optional search/filter)
router.get('/found-items', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const category = (req.query.category || '').trim();
    const location = (req.query.location || '').trim();

    const filter = {};
    if (q) filter.itemName = { $regex: q, $options: 'i' };
    if (category) filter.category = category;
    if (location) filter.foundLocation = { $regex: location, $options: 'i' };

    const foundItems = await FoundItem.find(filter)
      .populate('reportedBy')
      .sort({ dateFound: -1 });

    res.render('found-items', {
      title: 'Found Items',
      foundItems,
      filters: { q, category, location },
      success: req.query.success || null,
    });
  } catch (err) {
    console.error('List found items error:', err);
    res.status(500).render('error', {
      title: 'Database error',
      message: 'Could not load found items. Please try again.',
    });
  }
});

// GET /found-items/new — report form
router.get('/found-items/new', async (req, res) => {
  try {
    const students = await Student.find().sort({ fullName: 1 });
    res.render('found-item-form', {
      title: 'Report a Found Item',
      students,
      values: {},
      error: null,
    });
  } catch (err) {
    console.error('Open found-item form error:', err);
    res.status(500).render('error', {
      title: 'Database error',
      message: 'Could not open the report form.',
    });
  }
});

// POST /found-items — create a found-item report
router.post('/found-items', async (req, res) => {
  const itemName = (req.body.itemName || '').trim();
  const category = (req.body.category || '').trim();
  const description = (req.body.description || '').trim();
  const foundLocation = (req.body.foundLocation || '').trim();
  const dateFoundRaw = (req.body.dateFound || '').trim();
  const reportedByRaw = (req.body.reportedBy || '').trim();
  const values = { itemName, category, description, foundLocation, dateFound: dateFoundRaw, reportedBy: reportedByRaw };

  // ---- Validation ----
  const errors = [];
  if (!itemName) errors.push('Item name is required.');
  if (!category) errors.push('Category is required.');
  if (!description) errors.push('Description is required.');
  if (!foundLocation) errors.push('Found location is required.');

  let dateFound = null;
  if (!dateFoundRaw) {
    errors.push('Date found is required.');
  } else {
    dateFound = new Date(dateFoundRaw);
    if (isNaN(dateFound.getTime())) {
      errors.push('Date found is not a valid date.');
      dateFound = null;
    } else if (dateFound > new Date()) {
      errors.push('Date found cannot be in the future.');
      dateFound = null;
    }
  }

  if (!reportedByRaw || !mongoose.isValidObjectId(reportedByRaw)) {
    errors.push('Please choose a valid reporting student.');
  }

  if (errors.length) {
    const students = await Student.find().sort({ fullName: 1 }).catch(() => []);
    return res.status(400).render('found-item-form', {
      title: 'Report a Found Item',
      students,
      values,
      error: errors.join(' '),
    });
  }

  try {
    // Verify the referenced student actually exists (do not trust the browser)
    const student = await Student.findById(reportedByRaw);
    if (!student) {
      const students = await Student.find().sort({ fullName: 1 });
      return res.status(400).render('found-item-form', {
        title: 'Report a Found Item',
        students,
        values,
        error: 'The selected student does not exist.',
      });
    }

    const item = await FoundItem.create({
      itemName,
      category,
      description,
      foundLocation,
      dateFound,
      reportedBy: student._id,
    });

    return res.redirect(`/found-items/${item._id}?success=Found-item report created successfully.`);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      const students = await Student.find().sort({ fullName: 1 }).catch(() => []);
      return res.status(400).render('found-item-form', {
        title: 'Report a Found Item',
        students,
        values,
        error: messages.join(' '),
      });
    }
    console.error('Create found item error:', err);
    return res.status(500).render('error', {
      title: 'Database error',
      message: 'Could not save the found-item report.',
    });
  }
});

// GET /found-items/:id — display one found item
router.get('/found-items/:id', async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).render('error', {
      title: 'Invalid ID',
      message: 'The found-item ID in the URL is not a valid MongoDB ID.',
    });
  }

  try {
    const item = await FoundItem.findById(id).populate('reportedBy');
    if (!item) {
      return res.status(404).render('error', {
        title: 'Found item not found',
        message: 'No found-item report exists with this ID.',
      });
    }
    res.render('found-item-details', {
      title: `${item.itemName} — Found Item`,
      item,
      success: req.query.success || null,
    });
  } catch (err) {
    console.error('Show found item error:', err);
    res.status(500).render('error', {
      title: 'Database error',
      message: 'Could not load the found-item report.',
    });
  }
});

module.exports = router;
