require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const supabase = require('./lib/supabase');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

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
    refreshBcvRates();
});

// ── BCV Auto-Refresh Cron (every 6 h: 00:00, 06:00, 12:00, 18:00) ────────────
cron.schedule('0 0,6,12,18 * * *', () => {
    console.log('[BCV Cron] Running scheduled rate refresh...');
    refreshBcvRates();
});

async function refreshBcvRates() {
    const sources = [
        // Source 1: open.er-api.com (free, no key)
        async () => {
            const r = await fetchWithTimeout(
                'https://open.er-api.com/v6/latest/USD', 10000);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const j = await r.json();
            const usdVes = j?.rates?.VES;
            const eurUsd = j?.rates?.EUR;
            if (!usdVes || !eurUsd) throw new Error('Missing VES/EUR');
            return { USD: round(usdVes), EUR: round(usdVes / eurUsd) };
        },
        // Source 2: frankfurter.dev (ECB rates)
        async () => {
            const r = await fetchWithTimeout(
                'https://api.frankfurter.dev/v1/latest?base=USD&symbols=VES,EUR', 10000);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const j = await r.json();
            const usdVes = j?.rates?.VES;
            const eurUsd = j?.rates?.EUR;
            if (!usdVes || !eurUsd) throw new Error('Missing VES/EUR');
            return { USD: round(usdVes), EUR: round(usdVes / eurUsd) };
        },
        // Source 3: dolarapi.com (Venezuela-specific, BCV oficial)
        async () => {
            const r = await fetchWithTimeout(
                'https://ve.dolarapi.com/v1/dolares/oficial', 10000);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const j = await r.json();
            const usd = Number(j?.promedio ?? j?.price ?? 0);
            if (!usd) throw new Error('No rate returned');
            return { USD: round(usd), EUR: round(usd * 1.08) };
        },
    ];

    for (const source of sources) {
        try {
            const rates = await source();
            const now = new Date().toISOString();
            const { error } = await supabase
                .from('exchange_rates')
                .upsert([
                    { currency: 'USD', rate: rates.USD, source: 'BCV', updated_at: now },
                    { currency: 'EUR', rate: rates.EUR, source: 'BCV', updated_at: now },
                ], { onConflict: 'currency' });
            if (error) throw new Error(error.message);
            console.log(`[BCV] Updated — USD: ${rates.USD} / EUR: ${rates.EUR}`);
            return;
        } catch (e) {
            console.warn(`[BCV] Source failed: ${e.message}`);
        }
    }
    console.error('[BCV] All rate sources failed — rates unchanged.');
}

function round(n) { return Math.round(Number(n) * 100) / 100; }

async function fetchWithTimeout(url, ms) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    try {
        return await fetch(url, { signal: ctrl.signal });
    } finally {
        clearTimeout(id);
    }
}

module.exports = app;
