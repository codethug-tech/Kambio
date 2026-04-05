require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { refreshAndStore } = require('./lib/bcv');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const listingRoutes = require('./routes/listings');
const chatRoutes = require('./routes/chat');
const tradeRoutes = require('./routes/trades');
const ratingRoutes = require('./routes/ratings');
const favoriteRoutes = require('./routes/favorites');
const reportRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const ratesRoutes = require('./routes/rates');

const app = express();

// Security: lock CORS to known origins
const allowedOrigins = [
    process.env.ADMIN_URL || 'http://localhost:3000',
    'http://localhost:3000',
];
app.use(cors({
    origin: (origin, cb) => {
        // Allow mobile app (no origin) and listed origins
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));

// Security: limit body size to prevent DoS
app.use(express.json({ limit: '1mb' }));

// Security: standard HTTP headers
app.use(helmet());

// Security: global API rate limit (100 req/min per IP)
const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, try again later' },
});
app.use('/api/', globalLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rates', ratesRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

// Global error handler
app.use((err, req, res, next) => {
    console.error(err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Kambio API running on port ${PORT}`);
    // Auto-refresh BCV rates on startup
    refreshAndStore();
});

// ── BCV Auto-Refresh Cron (every 5 min) ─────────────────────────────────────
cron.schedule('*/5 * * * *', () => {
    console.log('[BCV Cron] Running scheduled rate refresh...');
    refreshAndStore();
});

module.exports = app;

