# CampusFind — Campus Lost & Found Management System

A web application where students register profiles, report lost/found items, submit
claims, and complete the full return workflow. Data is stored in **MongoDB Atlas**;
pages are rendered dynamically with **EJS**.

---

## Tech stack

Node.js · Express.js · EJS · MongoDB Atlas · Mongoose · dotenv · method-override

---

## Quick start

```bash
cd campus-lost-found
npm install
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
# edit .env — set MONGO_URI (see below)
npm start
```

Open http://localhost:3000

---

## Environment variables

| Variable    | Required | Description |
|-------------|----------|-------------|
| `MONGO_URI` | yes      | MongoDB Atlas connection string including database name `campusLostFound` |
| `PORT`      | no       | Port (default 3000) |

`.env` format:
```
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/campusLostFound?retryWrites=true&w=majority
PORT=3000
```

Get the connection string from Atlas → Connect → Drivers.

---

## Full route list

### Pages / navigation

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/` | Home page |
| GET | `/students` | List all students |
| GET | `/students/new` | Registration form |
| GET | `/students/:id` | Student profile + their reported items |
| GET | `/lost-items` | Lost items list (search/filter) |
| GET | `/lost-items/new` | Lost-item report form |
| GET | `/lost-items/:id` | Lost-item detail |
| GET | `/found-items` | Found items list (search/filter) |
| GET | `/found-items/new` | Found-item report form |
| GET | `/found-items/:id` | Found-item detail **+ claims + claim form** |

### Actions (form submissions)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/students` | Create student profile |
| POST | `/lost-items` | Create lost-item report |
| POST | `/found-items` | Create found-item report |
| POST | `/found-items/:id/claims` | Submit a claim (Phase 2) |
| PATCH | `/claims/:id/status` | Approve or reject a claim (Phase 2) |
| PATCH | `/found-items/:id/status` | Update item status — reporter only (Phase 2) |

> HTML forms use a hidden `_method` field (`method-override`) to send PATCH from a
> POST form.

---

## Database relationships

```
Student (1) ──< LostItem  (many)   reportedBy  → Student._id
Student (1) ──< FoundItem (many)   reportedBy  → Student._id
FoundItem (1) ──< Claim (many)     foundItemId → FoundItem._id
Student (1) ──< Claim (many)       claimedBy   → Student._id
```

### Models

**Student** — `fullName`, `email` (unique), `department`, `contactNumber`

**LostItem** — `itemName`, `category`, `description`, `lastSeenLocation`,
`dateLost`, `status` (Lost/Found, default Lost), `reportedBy`→Student

**FoundItem** — `itemName`, `category`, `description`, `foundLocation`,
`dateFound`, `status` (Available/Returned, default Available), `reportedBy`→Student

**Claim** — `foundItemId`→FoundItem, `claimedBy`→Student, `reason` (min 5 chars),
`status` (Pending/Approved/Rejected, default Pending), `createdAt` (auto timestamp)
Unique compound index on `{foundItemId, claimedBy}` — one claim per student per item.

---

## Claim workflow (Phase 2)

1. A student opens a found-item detail page and submits a claim with a reason.
2. The claim is saved with status **Pending**.
3. The student who *reported* the found item visits the detail page and approves
   or rejects each claim.
4. On **Approve**: the found item's status is atomically set to **Returned**
   (conditional on it still being Available — concurrent approvals are prevented).
5. Once an item is Returned, no new claims can be submitted and no further
   approvals are possible.

### Business rules enforced server-side (never just in the UI)

- Only the item's reporter (`reportedBy`) may approve/reject claims.
- A student cannot claim an item they themselves reported.
- One claim per student per item (application check + unique DB index).
- A Returned item blocks new claims and further approvals.
- Only Pending claims can be transitioned.
- `$set: { status }` — safe update; no other claim fields are overwritten.

---

## Phase 2 demo steps (for evaluation)

See `PHASE2_TESTS.md` for the full test matrix. Minimum live demo:

1. Register two students (A = reporter, B = claimant).
2. Student A reports a found item → status **Available**.
3. Student B submits a claim with a reason → status **Pending**.
4. Try to submit the same claim again → duplicate error.
5. Student A approves the claim → item becomes **Returned**, claim becomes **Approved**.
6. Try to claim the returned item → blocked.
7. Try to approve via a different `actingStudentId` → unauthorized error.

---

## Project structure

```
campus-lost-found/
├── index.js                  # Express app + MongoDB + method-override
├── package.json
├── .env                      # credentials (gitignored)
├── .env.example
├── .gitignore
├── README.md
├── PHASE1_SUBMISSION.md
├── PHASE2_TESTS.md
├── models/
│   ├── Student.js
│   ├── LostItem.js
│   ├── FoundItem.js
│   └── Claim.js              # Phase 2
├── routes/
│   ├── studentRoutes.js
│   ├── lostItemRoutes.js
│   ├── foundItemRoutes.js    # updated Phase 2 (claims POST + PATCH)
│   └── claimRoutes.js        # Phase 2 (PATCH /claims/:id/status)
├── views/
│   ├── partials/
│   │   ├── header.ejs
│   │   ├── footer.ejs
│   │   └── date.ejs
│   ├── home.ejs
│   ├── students.ejs
│   ├── student-form.ejs
│   ├── student-profile.ejs
│   ├── lost-items.ejs
│   ├── lost-item-form.ejs
│   ├── lost-item-details.ejs
│   ├── found-items.ejs       # updated (error flash)
│   ├── found-item-form.ejs
│   ├── found-item-details.ejs  # updated (claim form + claims list)
│   ├── 404.ejs
│   └── error.ejs
└── public/
    └── styles.css            # updated (claim styles)
```
