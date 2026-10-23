const express = require('express');
const mongoose = require('mongoose');

const Claim = require('../models/Claim');
const FoundItem = require('../models/FoundItem');

const router = express.Router();
const enc = (s) => encodeURIComponent(s);

/**
 * PATCH /claims/:id/status — approve or reject a claim.
 *
 * Authorization: only the student who reported the found item (its reportedBy) may
 * approve/reject its claims. This is verified on the SERVER using actingStudentId
 * from the request body — the value is never trusted just because the UI sent it.
 *
 * Safe update: only the claim's `status` field is written ($set: { status }).
 *
 * On approval, the found item is flipped to Returned atomically (conditional on it
 * still being Available), which prevents a second concurrent approval from also
 * marking a claim Approved for the same item.
 */
router.patch('/claims/:id/status', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.redirect(`/found-items?error=${enc('Invalid claim ID')}`);
  }

  const newStatus = (req.body.status || req.query.status || '').trim();
  const actingStudentId = (req.body.actingStudentId || req.query.actingStudentId || '').trim();

  if (!['Approved', 'Rejected'].includes(newStatus)) {
    return res.redirect(`/found-items?error=${enc('Invalid status value')}`);
  }

  try {
    const claim = await Claim.findById(id).populate('foundItemId');
    if (!claim) {
      return res.redirect(`/found-items?error=${enc('Claim not found')}`);
    }

    const item = claim.foundItemId; // populated FoundItem document
    if (!item) {
      return res.redirect(`/found-items?error=${enc('The found item for this claim no longer exists')}`);
    }

    // ---- Ownership check (server-side, do not trust the browser) ----
    if (!mongoose.isValidObjectId(actingStudentId) || String(item.reportedBy) !== String(actingStudentId)) {
      return res.redirect(`/found-items/${item._id}?error=${enc('Not authorized - only the reporter can review claims')}`);
    }

    // ---- State checks ----
    if (item.status === 'Returned') {
      return res.redirect(`/found-items/${item._id}?error=${enc('This item has already been returned')}`);
    }
    if (claim.status !== 'Pending') {
      return res.redirect(`/found-items/${item._id}?error=${enc('This claim has already been processed')}`);
    }

    if (newStatus === 'Approved') {
      // Atomically mark the item Returned ONLY if it is still Available.
      // This guards against concurrent approvals: exactly one claim can win.
      const itemUpdate = await FoundItem.updateOne(
        { _id: item._id, status: 'Available' },
        { $set: { status: 'Returned' } }
      );
      if (itemUpdate.matchedCount === 0) {
        return res.redirect(`/found-items/${item._id}?error=${enc('This item has already been returned')}`);
      }
      // Safe update: touch only the status field
      await Claim.updateOne({ _id: id }, { $set: { status: 'Approved' } });
      return res.redirect(`/found-items/${item._id}?success=${enc('Claim approved. Item is marked Returned')}`);
    }

    // Rejected
    const claimUpdate = await Claim.updateOne(
      { _id: id, status: 'Pending' },
      { $set: { status: 'Rejected' } }
    );
    if (claimUpdate.matchedCount === 0) {
      return res.redirect(`/found-items/${item._id}?error=${enc('This claim is no longer pending')}`);
    }
    return res.redirect(`/found-items/${item._id}?success=${enc('Claim rejected')}`);
  } catch (err) {
    console.error('Update claim status error:', err);
    return res.redirect(`/found-items?error=${enc('Could not update claim status')}`);
  }
});

module.exports = router;
