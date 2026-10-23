# Phase 1 Submission — CampusFind

## 1. Model / relationship explanation

### Student (`models/Student.js`)
Stores one student. The MongoDB `_id` (an `ObjectId`) is the only identifier used
in URLs and references — the student's name is never used as an ID.

| Field          | Type   | Rules                                         |
| -------------- | ------ | --------------------------------------------- |
| `fullName`     | String | required, trimmed, min length 2                |
| `email`        | String | required, unique, lowercased, valid email format |
| `department`   | String | required, trimmed                              |
| `contactNumber`| String | required, trimmed, min length 6                |

### LostItem (`models/LostItem.js`)
A lost item report made by one student.

| Field              | Type     | Rules                              |
| ------------------ | -------- | ---------------------------------- |
| `itemName`         | String   | required                            |
| `category`         | String   | required                            |
| `description`      | String   | required                            |
| `lastSeenLocation` | String   | required                            |
| `dateLost`         | Date     | required                            |
| `status`           | String   | enum `Lost` / `Found`, default `Lost`|
| `reportedBy`       | ObjectId | ref `Student`, required             |

### FoundItem (`models/FoundItem.js`)
A found item report made by one student.

| Field            | Type     | Rules                                   |
| ---------------- | -------- | --------------------------------------- |
| `itemName`       | String   | required                                 |
| `category`       | String   | required                                 |
| `description`    | String   | required                                 |
| `foundLocation`  | String   | required                                 |
| `dateFound`      | Date     | required                                 |
| `status`         | String   | enum `Available` / `Returned`, default `Available` |
| `reportedBy`     | ObjectId | ref `Student`, required                  |

### Relationships
```
Student (1) ──< LostItem (many)     reportedBy -> Student._id
Student (1) ──< FoundItem (many)   reportedBy -> Student._id
```
- Item → Student: read with `populate('reportedBy')` on the list/detail pages so
  each item shows its reporter and links to their profile.
- Student → items: on a student's profile we run
  `LostItem.find({ reportedBy: student._id })` and
  `FoundItem.find({ reportedBy: student._id })` to show everything that student
  reported.

Phase 2 will add a `Claim` model that references both `FoundItem` and `Student`,
but that is intentionally out of scope here.

## 2. Implemented route list

| Method | Route             | Purpose                                                |
| ------ | ----------------- | ------------------------------------------------------ |
| GET    | `/`               | Home page                                              |
| GET    | `/students`       | List all students                                       |
| GET    | `/students/new`   | Registration form                                       |
| POST   | `/students`       | Create a student (validation + duplicate email check)   |
| GET    | `/students/:id`   | Student profile + their reported items (validates ID)   |
| GET    | `/lost-items`     | List lost items with search/filter (name, category, location) |
| GET    | `/lost-items/new` | Report form (needs ≥1 student)                          |
| POST   | `/lost-items`     | Create report (validates fields, date, student exists)  |
| GET    | `/lost-items/:id` | Detail page (validates ID, 404 if missing)               |
| GET    | `/found-items`    | List found items with search/filter                     |
| GET    | `/found-items/new`| Report form (needs ≥1 student)                          |
| POST   | `/found-items`    | Create report (validates fields, date, student exists)  |
| GET    | `/found-items/:id`| Detail page (validates ID, 404 if missing)              |
| *      | (any other)       | 404 page                                                |

## 3. Features completed

- Student registration with unique email, format validation, whitespace check.
- Dynamic student profile page at `/students/:id` showing the student's own
  reported lost and found items.
- Lost-item reports: create, list, view, with `reportedBy` populated.
- Found-item reports: create, list, view, with `reportedBy` populated.
- Search/filter on lost and found lists (item name, category, location).
- All lists rendered dynamically from MongoDB (no hard-coded records).
- Empty-state messages ("No found items have been reported yet", etc.).
- Validation: required fields, whitespace-only input, email format, duplicate
  email (HTTP 409), invalid MongoDB ObjectId (400), missing record (404),
  invalid / future dates, and verifying the reporting student actually exists
  before saving a report.
- Central 500 error handler and a 404 handler.
- Responsive campus-themed UI (navy/white/grey) with reusable header/footer
  partials and a single `styles.css`.
- `async/await` + `try/catch` for all database operations.

## 4. Validation & error handling summary

| Situation                         | Where it is handled                         | Response      |
| --------------------------------- | ------------------------------------------- | ------------- |
| Empty / whitespace-only fields    | Route validation before save                | 400 + message |
| Invalid email format              | Schema regex + route check                  | 400 + message |
| Duplicate student email           | Unique index (E11000) caught in route       | 409 + message |
| Invalid MongoDB ObjectId in URL   | `mongoose.isValidObjectId` check            | 400 + error page |
| Student / item not found          | `findById` null check                       | 404 + error page |
| Invalid or future date             | Route date check                            | 400 + message |
| Report references missing student | `Student.findById` before `create`         | 400 + message |
| Database error                    | `try/catch` + central error handler         | 500 + error page |
| Unknown route                     | 404 middleware                              | 404 page      |

The "report references a student that does not exist" check is done on the
backend (`Student.findById(reportedBy)` before `LostItem.create`), so a request
body cannot save a report for a non-existent student even if the form is
bypassed.

## 5. Phase 1 demonstration script

Run the app first:
```bash
npm install
npm start
```
Then open http://localhost:3000 and follow these steps.

### Step 1 — Register two students
1. Click **Register** (or go to `/students/new`).
2. Fill in: Full name `Aisha Khan`, email `aisha@campus.edu`, department
   `Computer Science`, contact `9876543210`. Submit → profile page appears with a
   success banner and the generated MongoDB ID.
3. Go back and register a second student: `Rahul Verma`, `rahul@campus.edu`,
   `Electronics`, `9123456780`.

### Step 2 — Try a duplicate email (validation demo)
1. Go to `/students/new` again and enter `aisha@campus.edu` with a new name.
2. Submit → you should see "A student with this email is already registered."

### Step 3 — Report a lost item
1. Click **Report Lost** (or `/lost-items/new`).
2. Select Aisha Khan, item `Water Bottle`, category `Accessories`, last-seen
   `Library, 2nd floor`, date = a past date, description `Blue steel bottle
   with a sticker`.
3. Submit → lost-item detail page appears with the reporter linked to Aisha's
   profile.

### Step 4 — Report a found item
1. Click **Report Found** (`/found-items/new`).
2. Select Rahul Verma, item `ID Card Holder`, category `Documents`, found
   `Cafeteria`, date = a past date, description `Black holder with a college ID`.
3. Submit → found-item detail page appears, status `Available`.

### Step 5 — List and filter
1. Open `/lost-items` — your lost item appears as a card.
2. Type `bottle` in the search box and click Filter — only matching items show.
3. Open `/found-items` — your found item appears. If there were none, the page
   would show the empty-state message.

### Step 6 — Invalid ID and missing record
1. Visit `/students/123` (not a valid ObjectId) → "The student ID in the URL is
   not a valid MongoDB ID."
2. Visit `/lost-items/<some-valid-format-but-nonexistent-id>` → "No lost-item
   report exists with this ID." (404)

### Step 7 — Student profile shows relationships
1. On any item detail page, click the reporter's name link → that student's
   profile lists every lost and found item they reported.

That covers: successful creation, duplicate email, invalid ID, missing record,
and the Student ↔ LostItem / FoundItem relationships.
