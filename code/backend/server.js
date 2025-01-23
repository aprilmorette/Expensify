require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

// MySQL connection setup
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASSWORD,
    database: 'expense_tracker',
    port: 3306,
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        process.exit(1);
    }
    console.log('Connected to MySQL database');
});

// Middleware to protect routes
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        req.user = user;
        next();
    });
}

// Google OAuth Strategy
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: 'http://localhost:3000/auth/google/callback',
        },
        (accessToken, refreshToken, profile, done) => {
            console.log('Google profile:', profile);
            done(null, profile);
        }
    )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Session Middleware
app.use(
    session({
        secret: 'your-secret-key',
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false },
    })
);

app.use(passport.initialize());
app.use(passport.session());

// Google Auth Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get(
    '/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        const user = { id: req.user.id, email: req.user.emails[0].value };
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
        res.redirect(`${process.env.FRONTEND_URL}/expense.html?token=${token}`);
    }
);

// Protected API: Add Expense
app.post('/add-expense', authenticateToken, (req, res) => {
    const { category, amount, date } = req.body;
    const query = 'INSERT INTO expenses (category, amount, date) VALUES (?, ?, ?)';
    db.query(query, [category, amount, date], (err) => {
        if (err) {
            console.error('Error inserting data:', err);
            return res.status(500).json({ message: 'Database error' });
        }
        res.status(201).json({ message: 'Expense added successfully' });
    });
});

// Protected API: Get All Expenses
app.get('/expenses', authenticateToken, (req, res) => {
    const query = 'SELECT id, category, CAST(amount AS DECIMAL(10, 2)) AS amount, date FROM expenses';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching expenses:', err);
            return res.status(500).json({ message: 'Database error' });
        }

        // Convert 'amount' to a number
        const parsedResults = results.map(expense => ({
            ...expense,
            amount: parseFloat(expense.amount), // Convert to numeric
        }));

        res.status(200).json(parsedResults);
    });
});


// Protected API: Delete Expense
app.delete('/delete-expense/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM expenses WHERE id = ?';
    db.query(query, [id], (err) => {
        if (err) {
            console.error('Error deleting expense:', err);
            return res.status(500).json({ message: 'Database error' });
        }
        res.status(200).json({ message: 'Expense deleted successfully' });
    });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
