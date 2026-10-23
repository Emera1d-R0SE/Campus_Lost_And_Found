# CampusFind — Campus Lost & Found Management System (Phase 1)

A simple web application where students can register a profile, report items they
have lost, and register items they have found on campus. All data is stored in
**MongoDB Atlas** and pages are rendered dynamically with **EJS**.

This repository contains **Phase 1** only: student profiles, lost-item reports,
found-item reports, dynamic rendering, validation and error handling. Claims,
approval and the return workflow are part of Phase 2 and are intentionally not
included here.

---

## 1. Project overview

CampusFind replaces ad-hoc "lost it / found it" messages in class groups with a
small, structured record system. In Phase 1 a student can:

- Register a profile (full name, college email, department, contact number).
- View any student's profile on a dynamic route `/students/:id`.
- Report a lost item (name, category, description, last-seen location, date lost).
- Report a found item (name, category, description, found location, date found).
- Browse and search/filter the lost-items and found-items lists.
- Open the full details of any single report.

Every record shown on the site comes from MongoDB — nothing is hard-coded into
the EJS templates.

## 2. Tech stack

- **Node.js** — runtime
- **Express.js** — web framework
- **EJS** — server-side templating
- **MongoDB Atlas** — database (cloud)
- **Mongoose** — ODM / data models
- **dotenv** — environment variables
- HTML5 + CSS3 — frontend (no frameworks, no Tailwind, no React)

## 3. Installation

```bash
# 1. Clone or copy the project folder
cd campus-lost-found

# 2. Install dependencies
npm install

# 3. Configure environment (see section 5)
#    Copy .env.example to .env and fill in your MongoDB Atlas connection string
cp .env.example .env      # on Windows PowerShell: Copy-Item .env.example .env

# 4. Start the server
npm start
#    or for development with auto-reload:
npm run dev
```

Then open http://localhost:3000 in your browser.

> Node.js 18+ is recommended. Make sure your IP is allow-listed in your MongoDB
> Atlas project (Network Access).

## 4. MongoDB Atlas configuration

1. Create a free cluster at https://www.mongodb.com/atlas.
2. Add a database user (Database Access → Add new user).
3. Allow your IP in Network Access (or `0.0.0.0/0` for development).
4. Click **Connect → Drivers** and copy the connection string. It looks like:
   `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority`
5. Insert the database name `campusLostFound` into the path (see `.env.example`).
   MongoDB creates the database automatically on the first write.

## 5. Environment variables

All configuration lives in a `.env` file at the project root (never committed).

| Variable   | Required | Description                                                       |
| ---------- | -------- | ---------------------------------------------------------------- |
| `MONGO_URI`| yes      | MongoDB Atlas connection string, with database `campusLostFound`|
| `PORT`     | no       | Port to listen on (defaults to 3000)                             |

Example (see `.env.example`):

```
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/campusLostFound?retryWrites=true&w=majority
PORT=3000
```

## 6. Phase 1 route list

| Method | Route             | Purpose                                                       |
| ------ | ----------------- | ------------------------------------------------------------- |
| GET    | `/`               | Home page with links to all sections                          |
| GET    | `/students`       | List all registered students                                   |
| GET    | `/students/new`   | Show the student registration form                             |
| POST   | `/students`       | Create a student profile                                       |
| GET    | `/students/:id`   | Display one student's profile (with their reported items)      |
| GET    | `/lost-items`     | List lost-item reports (with search/filter)                   |
| GET    | `/lost-items/new` | Show the lost-item report form                                 |
| POST   | `/lost-items`     | Create a lost-item report                                      |
| GET    | `/lost-items/:id` | Display one lost-item report                                  |
| GET    | `/found-items`    | List found-item reports (with search/filter)                  |
| GET    | `/found-items/new`| Show the found-item report form                                |
| POST   | `/found-items`    | Create a found-item report                                     |
| GET    | `/found-items/:id`| Display one found-item report                                  |

## 7. Database relationships

The schema uses Mongoose references so a student is linked to the items they
report, and an item is linked back to the student who reported it.

```
Student (1) ──< LostItem (many)     reportedBy: ObjectId -> Student._id
Student (1) ──< FoundItem (many)   reportedBy: ObjectId -> Student._id
```

- **Student** — `_id` is a MongoDB ObjectId (never the student's name). Fields:
  `fullName`, `email` (unique), `department`, `contactNumber`.
- **LostItem** — `itemName`, `category`, `description`, `lastSeenLocation`,
  `dateLost`, `status` (default `Lost`), `reportedBy` (ref `Student`).
- **FoundItem** — `itemName`, `category`, `description`, `foundLocation`,
  `dateFound`, `status` (default `Available`), `reportedBy` (ref `Student`).

The "one student → many items" relationship is read with Mongoose's
`populate()` (e.g. `LostItem.find().populate('reportedBy')`) so each item's card
and detail page shows the reporting student's name, which links to their
profile. The reverse direction (a student's profile lists their reported items)
is read with `LostItem.find({ reportedBy: student._id })`.

## 8. How to run

```bash
npm install
npm start
```

Server logs `MongoDB connected (database: campusLostFound)` and
`CampusFind running at http://localhost:3000` on success.

## 9. Phase 1 demonstration

See `PHASE1_SUBMISSION.md` for a step-by-step demo script and the full feature
list.

## Project structure

```
campus-lost-found/
├── index.js                 # Express app + MongoDB connection
├── package.json
├── .env                     # your credentials (gitignored)
├── .env.example             # template
├── .gitignore
├── README.md
├── PHASE1_SUBMISSION.md
├── models/
│   ├── Student.js
│   ├── LostItem.js
│   └── FoundItem.js
├── routes/
│   ├── studentRoutes.js
│   ├── lostItemRoutes.js
│   └── foundItemRoutes.js
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
│   ├── found-item-details.ejs
│   ├── 404.ejs
│   └── error.ejs
└── public/
    └── styles.css
```
