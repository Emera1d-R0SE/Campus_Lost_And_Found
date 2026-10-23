# Phase 2 — Test Scenarios

## How to test

Start the server (`npm start`), open http://localhost:3000, and follow the steps below.
Pre-condition: at least two student profiles exist (register them via `/students/new`).
Use **Student A** as the reporter and **Student B** as the claimant throughout.

---

## 1. Submit a claim — success

1. Log in as Student B concept (select them in the dropdown).
2. Open a found item whose status is **Available**.
3. Fill in a reason (at least 5 characters) and submit.
4. **Expected:** flash "Claim submitted - status Pending". Claim appears in the list with badge **Pending**.

## 2. Submit a claim — duplicate

1. Same student, same found item, submit a second claim.
2. **Expected:** redirect with error "You have already submitted a claim for this item". No second claim saved in DB.

## 3. Submit a claim — empty reason

1. Leave the reason field blank or enter fewer than 5 characters.
2. **Expected:** redirect with error "A reason is required" / "Reason must be at least 5 characters".

## 4. Submit a claim — item already Returned

1. Find (or create) a found item with status **Returned**.
2. Try to submit a claim.
3. **Expected:** redirect with error "This item has already been returned and cannot be claimed".

## 5. Approve a claim — reporter only (authorized)

1. On the found-item detail page, click **Approve** (which sends `actingStudentId` = reporter's `_id`).
2. **Expected:** claim badge changes to **Approved**, item badge changes to **Returned**, flash "Claim approved. Item is marked Returned".

## 6. Approve a claim — unauthorized student

Using a REST client (e.g. Postman) or the browser address bar, send:

```
PATCH /claims/<claim_id>/status
body: status=Approved&actingStudentId=<DIFFERENT_student_id>
```

**Expected:** HTTP redirect with error "Not authorized - only the reporter can review claims". Claim status remains Pending.

## 7. Approve a claim — item already Returned (concurrent)

1. Approve one claim (item becomes Returned).
2. Try to approve a second claim for the same item (same or different student).
3. **Expected:** error "This item has already been returned". The FoundItem.updateOne conditional on `status: 'Available'` ensures this atomically.

## 8. Reject a claim

1. Click **Reject** on a Pending claim.
2. **Expected:** claim badge changes to **Rejected**, flash "Claim rejected". Item remains **Available**.

## 9. Reject already-processed claim

Send a PATCH for a claim whose status is already Approved or Rejected.
**Expected:** error "This claim has already been processed".

## 10. Invalid MongoDB IDs

| URL | Expected |
|-----|----------|
| `/found-items/abc123` | 400 — "not a valid MongoDB ID" |
| `/claims/abc123/status` (PATCH) | redirect with error "Invalid claim ID" |
| `/found-items/65a000000000000000000001` (valid format, non-existent) | 404 — "no found-item report exists" |

## 11. Search / filter

- `/lost-items?q=bottle` — only items whose name matches "bottle".
- `/found-items?category=Documents` — only Documents items.
- `/found-items?location=cafeteria` — case-insensitive location match.
- No match → empty-state with "No items match your search."

## 12. PATCH /found-items/:id/status — bypass attempt

Send `status=Returned` directly.
**Expected:** error "Returned status is set automatically when a claim is approved — use the claim workflow".

Send `status=Available` with a **wrong** `actingStudentId`.
**Expected:** error "Not authorized - only the reporter can change item status".

---

## Summary of business rules enforced server-side

| Rule | Where enforced |
|------|---------------|
| Claimed item must exist | `FoundItem.findById` null check |
| Claimed item must not be Returned | status check before `Claim.create` |
| Claiming student must exist | `Student.findById` before save |
| One claim per student per item | `Claim.findOne` check + unique compound index |
| Reason required (≥5 chars) | route validation + Mongoose minlength |
| Only reporter may approve/reject | `item.reportedBy` vs `actingStudentId` server check |
| Approval marks item Returned atomically | `FoundItem.updateOne({status:'Available'})` |
| Already-Returned item blocks further approval | conditional update + explicit check |
| Only Pending claims can be approved/rejected | `claim.status !== 'Pending'` guard |
| Safe update: only `status` touched | `$set: { status }` — no other fields overwritten |
