const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const supabase = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (allowed.includes(file.mimetype)) return cb(null, true);
        cb(new Error('Only image files are allowed'), false);
    },
});

const listingSchema = z.object({
    type: z.enum(['cambio', 'trueque', 'servicio']),
    title: z.string().min(3).max(120),
    description: z.string().optional(),
    category: z.string().optional(),
    offer_text: z.string().min(2),
    want_text: z.string().min(2),
    currency_type: z.enum(['bs', 'usd', 'zelle', 'paypal', 'crypto', 'cash', 'other']).optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    neighborhood: z.string().optional(),
    expires_at: z.string().optional(),
});

// GET /api/listings  — browse with filters
router.get('/', async (req, res) => {
    const { city, state, category, type, q, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
        .from('listings')
        .select(`*, users(id, name, avatar_url, rating, trades_count), listing_photos(url, "order")`)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1);

    if (city) query = query.ilike('city', `%${city}%`);
    if (state) query = query.eq('state', state);
    if (category) query = query.eq('category', category);
    if (type) query = query.eq('type', type);
    if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,offer_text.ilike.%${q}%`);

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ listings: data, page: Number(page), limit: Number(limit) });
});

// GET /api/listings/:id
router.get('/:id', async (req, res) => {
    const { data, error } = await supabase
        .from('listings')
        .select(`*, users(id, name, avatar_url, rating, trades_count, city), listing_photos(url, "order")`)
        .eq('id', req.params.id)
        .neq('status', 'hidden')
        .single();
    if (error) return res.status(404).json({ error: 'Listing not found' });
    res.json(data);
});

// POST /api/listings  (create)
router.post('/', requireAuth, upload.array('photos', 5), async (req, res) => {
    const body = listingSchema.parse(req.body);

    const { data: listing, error } = await supabase
        .from('listings')
        .insert({ ...body, user_id: req.user.id })
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });

    // Upload photos if any
    if (req.files && req.files.length > 0) {
        const photoInserts = [];
        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            const path = `listings/${listing.id}/${Date.now()}_${i}`;
            const { error: uploadError } = await supabase.storage
                .from(process.env.SUPABASE_STORAGE_BUCKET)
                .upload(path, file.buffer, { contentType: file.mimetype });
            if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage
                    .from(process.env.SUPABASE_STORAGE_BUCKET)
                    .getPublicUrl(path);
                photoInserts.push({ listing_id: listing.id, url: publicUrl, order: i });
            }
        }
        if (photoInserts.length > 0) {
            await supabase.from('listing_photos').insert(photoInserts);
        }
    }

    res.status(201).json(listing);
});

// PATCH /api/listings/:id  (update)
router.patch('/:id', requireAuth, async (req, res) => {
    const body = listingSchema.partial().parse(req.body);

    const { data, error } = await supabase
        .from('listings')
        .update(body)
        .eq('id', req.params.id)
        .eq('user_id', req.user.id)
        .select()
        .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

// DELETE /api/listings/:id
router.delete('/:id', requireAuth, async (req, res) => {
    const { error } = await supabase
        .from('listings')
        .delete()
        .eq('id', req.params.id)
        .eq('user_id', req.user.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
});

// GET /api/listings/mine  — current user's listings
router.get('/user/mine', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('listings')
        .select(`*, listing_photos(url, "order")`)
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

module.exports = router;
