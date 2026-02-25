const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const supabase = require('../lib/supabase');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Strict rate limit on auth endpoints: 10 attempts per 15 min per IP
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts, please try again in 15 minutes' },
});

const signupSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    password: z.string().min(6),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

function makeToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/signup
router.post('/signup', authLimiter, async (req, res) => {
    const body = signupSchema.parse(req.body);

    // Check email taken
    const { data: existing } = await supabase
        .from('users').select('id').eq('email', body.email).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    // Register with Supabase Auth (email OTP / magic link support)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
    });
    if (authError) return res.status(400).json({ error: authError.message });

    const password_hash = await bcrypt.hash(body.password, 10);

    const { data: user, error } = await supabase
        .from('users')
        .insert({
            auth_id: authData.user.id,
            name: body.name,
            email: body.email,
            phone: body.phone,
            city: body.city,
            state: body.state,
        })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json({ token: makeToken(user.id), user });
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    // Verify via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email, password,
    });
    if (authError) return res.status(401).json({ error: 'Invalid credentials' });

    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authData.user.id)
        .single();

    if (error || !user) return res.status(401).json({ error: 'User not found' });
    if (user.is_blocked) return res.status(403).json({ error: 'Account blocked' });

    res.json({ token: makeToken(user.id), user });
});

// POST /api/auth/refresh  (re-issue token using current valid token)
router.post('/refresh', async (req, res) => {
    const header = req.headers.authorization || '';
    const token = header.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        res.json({ token: makeToken(payload.userId) });
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
});

module.exports = router;
