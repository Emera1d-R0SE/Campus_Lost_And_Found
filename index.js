require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB (Atlas). The database name is embedded in the connection
// string (campusLostFound). If the DB does not exist, MongoDB creates it on
// first write.
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected (database: campusLostFound)'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// View engine
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// Static files + body parsing
app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
app.use('/', require('./routes/studentRoutes'));
app.use('/', require('./routes/lostItemRoutes'));
app.use('/', require('./routes/foundItemRoutes'));

// Home page
app.get('/', (req, res) => {
  res.render('home', { title: 'CampusFind — Home' });
});

// 404 — no route matched
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).render('error', {
    title: 'Something went wrong',
    message: err.message || 'Unexpected server error.',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 CampusFind running at http://localhost:${PORT}`);
});
