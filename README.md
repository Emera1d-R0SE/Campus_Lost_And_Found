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
Make sure your IP is allow-listed in Atlas → Network Access.

---

## MongoDB Atlas configuration

1. Create a free cluster at https://www.mongodb.com/atlas.
2. Add a database user (Database Access → Add new database user).
3. Allow your IP in Network Access (or `0.0.0.0/0` for development).
4. Click **Connect → Drivers** and copy the connection string.
5. Insert the database name `campusLostFound` into the path. MongoDB creates the
   database automatically on the first write.

---

## Complete route list

### Phase 1 — Students, Lost Items, Found Items

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/` | Home page |
| GET | `/students` | List all registered students |
| GET | `/students/new` | Student registration form |
| POST | `/students` | Create a student profile |
| GET | `/students/:id` | Student profile + their reported items |
| GET | `/lost-items` | Lost items list (search/filter by name, category, location) |
| GET | `/lost-items/new` | Lost-item report form |
| POST | `/lost-items` | Create a lost-item report |
| GET | `/lost-items/:id` | Lost-item detail page |
| GET | `/found-items` | Found items list (search/filter by name, category, location) |
| GET | `/found-items/new` | Found-item report form |
| POST | `/found-items` | Create a found-item report |
| GET | `/found-items/:id` | Found-item detail page + claim form + claims list |

### Phase 2 — Claims and Return Workflow

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/found-items/:id/claims` | Submit a claim for a found item |
| PATCH | `/claims/:id/status` | Approve or reject a claim (reporter only) |
| PATCH | `/found-items/:id/status` | Update item status (reporter only, cannot bypass claim workflow) |

> HTML forms use a hidden `_method=PATCH` field (`method-override` package) to
> send PATCH requests from standard POST forms.

---

## Database relationships

```
Student   (1) ──< LostItem  (many)   reportedBy  → Student._id
Student   (1) ──< FoundItem (many)   reportedBy  → Student._id
FoundItem (1) ──< Claim     (many)   foundItemId → FoundItem._id
Student   (1) ──< Claim     (many)   claimedBy   → Student._id
```

### Models

**Student** (`models/Student.js`)
`fullName` (required), `email` (unique, valid format), `department`, `contactNumber`
MongoDB `_id` is the only identifier used in URLs and references — never the name.

**LostItem** (`models/LostItem.js`)
`itemName`, `category`, `description`, `lastSeenLocation`, `dateLost`,
`status` (Lost/Found, default Lost), `reportedBy` → Student

**FoundItem** (`models/FoundItem.js`)
`itemName`, `category`, `description`, `foundLocation`, `dateFound`,
`status` (Available/Returned, default Available), `reportedBy` → Student

**Claim** (`models/Claim.js`) — *Phase 2*
`foundItemId` → FoundItem, `claimedBy` → Student, `reason` (min 5 chars),
`status` (Pending/Approved/Rejected, default Pending), `createdAt` (auto timestamp).
Unique compound index on `{foundItemId, claimedBy}` — one claim per student per item.

---

## Phase 1 — How it works

A student can:
- Register a profile with full name, college email, department, and contact number.
- Report a lost item (name, category, description, last-seen location, date).
- Report a found item (name, category, description, found location, date).
- Browse and search/filter the lost-items and found-items lists.
- View the full detail of any report, including which student reported it.

Every record shown comes from MongoDB — nothing is hard-coded in EJS.

### Phase 1 validation
- Required-field checks including whitespace-only input
- Email format validation and duplicate email detection (HTTP 409)
- MongoDB ObjectId validation on all `:id` routes (400 if invalid)
- 404 for missing students/items
- Dates cannot be in the future
- Reports cannot reference a student that does not exist (checked server-side)

### Phase 1 demo steps
1. Register two students at `/students/new`.
2. Report a lost item and a found item using each student.
3. Browse `/lost-items` and `/found-items` — records appear dynamically.
4. Use the search/filter bar to narrow results.
5. Click any item to see its detail page with the reporter linked.
6. Click the reporter link to see their profile listing all items they reported.
7. Try visiting `/students/123` → "not a valid MongoDB ID" (400).
8. Try a duplicate email → "already registered" error (409).

---

## Phase 2 — Claim and return workflow

1. A student opens a found-item detail page and submits a claim with a reason.
2. The claim is saved with status **Pending**.
3. The student who *reported* the found item visits the detail page and approves
   or rejects each claim using the Approve / Reject buttons.
4. On **Approve**: the found item's status is atomically set to **Returned**
   (conditional on it still being Available — concurrent approvals are prevented).
5. Once an item is **Returned**, no new claims can be submitted and no further
   approvals are possible.

### Business rules enforced server-side (not just in the UI)

| Rule | Enforcement |
|------|-------------|
| Only the reporter may approve/reject | `item.reportedBy` vs `actingStudentId` — checked in the route |
| Claiming student must exist | `Student.findById` before `Claim.create` |
| Item must exist and not be Returned | `FoundItem.findById` + status check |
| One claim per student per item | `Claim.findOne` check + unique DB index |
| Reason required (≥ 5 chars) | route validation + Mongoose `minlength` |
| Approval marks item Returned atomically | `FoundItem.updateOne({status:'Available'})` |
| Already-Returned blocks further approval | conditional update matched-count check |
| Only Pending claims can be transitioned | `claim.status !== 'Pending'` guard |
| Safe update — only `status` touched | `$set: { status }` — no other fields overwritten |
| `Returned` cannot be set via status route | explicit rejection — must go through claim approval |

### Phase 2 demo steps (for evaluation)
1. Register **Student A** (reporter) and **Student B** (claimant).
2. Student A reports a found item → status **Available**.
3. Student B submits a claim with a reason → **Pending**.
4. Submit the same claim again → "already submitted" error.
5. Try approving using Student B's ID → "Not authorized" error (server rejects it).
6. Student A approves → claim → **Approved**, item → **Returned**.
7. Try claiming the returned item → blocked with error.
8. Show search/filter: `/found-items?q=wallet` or `/lost-items?category=Keys`.

---

## Project structure

```
campus-lost-found/
├── index.js                    # Express app, MongoDB connection, method-override
├── package.json
├── .env                        # credentials (gitignored)
├── .env.example                # template
├── .gitignore
├── README.md                   # this file
├── PHASE1_SUBMISSION.md        # Phase 1 model/relationship explanation + demo script
├── PHASE2_TESTS.md             # Phase 2 test scenarios
├── models/
│   ├── Student.js
│   ├── LostItem.js
│   ├── FoundItem.js
│   └── Claim.js                # Phase 2
├── routes/
│   ├── studentRoutes.js
│   ├── lostItemRoutes.js
│   ├── foundItemRoutes.js      # Phase 2: POST /claims, PATCH /status
│   └── claimRoutes.js          # Phase 2: PATCH /claims/:id/status
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
│   ├── found-items.ejs
│   ├── found-item-form.ejs
│   ├── found-item-details.ejs  # Phase 2: claim form + claims list
│   ├── 404.ejs
│   └── error.ejs
└── public/
    └── styles.css
```
