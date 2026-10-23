const express = require('express');
const mongoose = require('mongoose');

const FoundItem = require('../models/FoundItem');
const Student = require('../models/Student');
const Claim = require('../models/Claim');

const router = express.Router();
const enc = (s) => encodeURIComponent(s);

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
      error: req.query.error || null,
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

    return res.redirect(`/found-items/${item._id}?success=${enc('Found-item report created successfully.')}`);
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

// GET /found-items/:id — display one found item + its claims
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
    const claims = await Claim.find({ foundItemId: item._id }).populate('claimedBy').sort({ createdAt: 1 });
    const students = await Student.find().sort({ fullName: 1 });

    res.render('found-item-details', {
      title: `${item.itemName} — Found Item`,
      item,
      claims,
      students,
      success: req.query.success || null,
      error: req.query.error || null,
    });
  } catch (err) {
    console.error('Show found item error:', err);
    res.status(500).render('error', {
      title: 'Database error',
      message: 'Could not load the found-item report.',
    });
  }
});

/**
 * POST /found-items/:id/claims — submit a claim.
 * Rules: item must exist and NOT be Returned; claimedBy must be a valid existing
 * student; reason required (>=5 chars); one claim per student per item; new claim
 * is Pending.
 */
router.post('/found-items/:id/claims', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.redirect(`/found-items?error=${enc('Invalid found item ID')}`);
  }
  const claimedByRaw = (req.body.claimedBy || '').trim();
  const reason = (req.body.reason || '').trim();

  try {
    const item = await FoundItem.findById(id);
    if (!item) {
      return res.redirect(`/found-items?error=${enc('Found item not found')}`);
    }
    // State check: a Returned item cannot be claimed again
    if (item.status === 'Returned') {
      return res.redirect(`/found-items/${id}?error=${enc('This item has already been returned and cannot be claimed')}`);
    }
    if (!claimedByRaw || !mongoose.isValidObjectId(claimedByRaw)) {
      return res.redirect(`/found-items/${id}?error=${enc('Please select a valid student')}`);
    }
    if (reason.length < 5) {
      const msg = reason ? 'Reason must be at least 5 characters' : 'A reason is required';
      return res.redirect(`/found-items/${id}?error=${enc(msg)}`);
    }
    // Relationship check: the claiming student must actually exist
    const student = await Student.findById(claimedByRaw);
    if (!student) {
      return res.redirect(`/found-items/${id}?error=${enc('The selected student does not exist')}`);
    }
    // Duplicate-claim check (application-level; the unique index backs it up)
    const existing = await Claim.findOne({ foundItemId: id, claimedBy: claimedByRaw });
    if (existing) {
      return res.redirect(`/found-items/${id}?error=${enc('You have already submitted a claim for this item')}`);
    }

    await Claim.create({ foundItemId: id, claimedBy: claimedByRaw, reason });
    return res.redirect(`/found-items/${id}?success=${enc('Claim submitted - status Pending')}`);
  } catch (err) {
    if (err.code === 11000) {
      return res.redirect(`/found-items/${id}?error=${enc('You have already submitted a claim for this item')}`);
    }
    console.error('Create claim error:', err);
    return res.redirect(`/found-items/${id}?error=${enc('Could not submit your claim')}`);
  }
});

/**
 * PATCH /found-items/:id/status — update item status (reporter only).
 * Returned may NOT be set here — it is set automatically when a claim is approved,
 * so this route cannot be used to bypass the claim approval workflow. The reporter
 * can only reopen an item to Available.
 */
router.patch('/found-items/:id/status', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.redirect(`/found-items?error=${enc('Invalid found item ID')}`);
  }
  const newStatus = (req.body.status || req.query.status || '').trim();
  const actingStudentId = (req.body.actingStudentId || req.query.actingStudentId || '').trim();

  try {
    const item = await FoundItem.findById(id);
    if (!item) {
      return res.redirect(`/found-items?error=${enc('Found item not found')}`);
    }
    // Ownership check (server-side)
    if (!mongoose.isValidObjectId(actingStudentId) || String(item.reportedBy) !== String(actingStudentId)) {
      return res.redirect(`/found-items/${id}?error=${enc('Not authorized - only the reporter can change item status')}`);
    }
    // Prevent bypassing the claim approval workflow
    if (newStatus === 'Returned') {
      return res.redirect(`/found-items/${id}?error=${enc('Returned status is set automatically when a claim is approved - use the claim workflow')}`);
    }
    if (newStatus !== 'Available') {
      return res.redirect(`/found-items/${id}?error=${enc('Invalid status value')}`);
    }

    await FoundItem.updateOne({ _id: id }, { $set: { status: newStatus } });
    return res.redirect(`/found-items/${id}?success=${enc('Item status updated to ' + newStatus)}`);
  } catch (err) {
    console.error('Update found item status error:', err);
    return res.redirect(`/found-items/${id}?error=${enc('Could not update item status')}`);
  }
});

module.exports = router;
