const express = require('express');
const mongoose = require('mongoose');

const LostItem = require('../models/LostItem');
const Student = require('../models/Student');

const router = express.Router();

// GET /lost-items — list lost-item reports (with optional search/filter)
router.get('/lost-items', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const category = (req.query.category || '').trim();
    const location = (req.query.location || '').trim();

    // Build the filter dynamically so the list always comes from MongoDB
    const filter = {};
    if (q) filter.itemName = { $regex: q, $options: 'i' };
    if (category) filter.category = category;
    if (location) filter.lastSeenLocation = { $regex: location, $options: 'i' };

    const lostItems = await LostItem.find(filter)
      .populate('reportedBy')
      .sort({ dateLost: -1 });

    res.render('lost-items', {
      title: 'Lost Items',
      lostItems,
      filters: { q, category, location },
      success: req.query.success || null,
    });
  } catch (err) {
    console.error('List lost items error:', err);
    res.status(500).render('error', {
      title: 'Database error',
      message: 'Could not load lost items. Please try again.',
    });
  }
});

// GET /lost-items/new — report form
router.get('/lost-items/new', async (req, res) => {
  try {
    const students = await Student.find().sort({ fullName: 1 });
    res.render('lost-item-form', {
      title: 'Report a Lost Item',
      students,
      values: {},
      error: null,
    });
  } catch (err) {
    console.error('Open lost-item form error:', err);
    res.status(500).render('error', {
      title: 'Database error',
      message: 'Could not open the report form.',
    });
  }
});

// POST /lost-items — create a lost-item report
router.post('/lost-items', async (req, res) => {
  const itemName = (req.body.itemName || '').trim();
  const category = (req.body.category || '').trim();
  const description = (req.body.description || '').trim();
  const lastSeenLocation = (req.body.lastSeenLocation || '').trim();
  const dateLostRaw = (req.body.dateLost || '').trim();
  const reportedByRaw = (req.body.reportedBy || '').trim();
  const values = { itemName, category, description, lastSeenLocation, dateLost: dateLostRaw, reportedBy: reportedByRaw };

  // ---- Validation ----
  const errors = [];
  if (!itemName) errors.push('Item name is required.');
  if (!category) errors.push('Category is required.');
  if (!description) errors.push('Description is required.');
  if (!lastSeenLocation) errors.push('Last-seen location is required.');

  let dateLost = null;
  if (!dateLostRaw) {
    errors.push('Date lost is required.');
  } else {
    dateLost = new Date(dateLostRaw);
    if (isNaN(dateLost.getTime())) {
      errors.push('Date lost is not a valid date.');
      dateLost = null;
    } else if (dateLost > new Date()) {
      errors.push('Date lost cannot be in the future.');
      dateLost = null;
    }
  }

  if (!reportedByRaw || !mongoose.isValidObjectId(reportedByRaw)) {
    errors.push('Please choose a valid reporting student.');
  }

  if (errors.length) {
    const students = await Student.find().sort({ fullName: 1 }).catch(() => []);
    return res.status(400).render('lost-item-form', {
      title: 'Report a Lost Item',
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
      return res.status(400).render('lost-item-form', {
        title: 'Report a Lost Item',
        students,
        values,
        error: 'The selected student does not exist.',
      });
    }

    const item = await LostItem.create({
      itemName,
      category,
      description,
      lastSeenLocation,
      dateLost,
      reportedBy: student._id,
    });

    return res.redirect(`/lost-items/${item._id}?success=Lost-item report created successfully.`);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      const students = await Student.find().sort({ fullName: 1 }).catch(() => []);
      return res.status(400).render('lost-item-form', {
        title: 'Report a Lost Item',
        students,
        values,
        error: messages.join(' '),
      });
    }
    console.error('Create lost item error:', err);
    return res.status(500).render('error', {
      title: 'Database error',
      message: 'Could not save the lost-item report.',
    });
  }
});

// GET /lost-items/:id — display one lost-item report
router.get('/lost-items/:id', async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).render('error', {
      title: 'Invalid ID',
      message: 'The lost-item ID in the URL is not a valid MongoDB ID.',
    });
  }

  try {
    const item = await LostItem.findById(id).populate('reportedBy');
    if (!item) {
      return res.status(404).render('error', {
        title: 'Lost item not found',
        message: 'No lost-item report exists with this ID.',
      });
    }
    res.render('lost-item-details', {
      title: `${item.itemName} — Lost Item`,
      item,
      success: req.query.success || null,
    });
  } catch (err) {
    console.error('Show lost item error:', err);
    res.status(500).render('error', {
      title: 'Database error',
      message: 'Could not load the lost-item report.',
    });
  }
});

module.exports = router;
