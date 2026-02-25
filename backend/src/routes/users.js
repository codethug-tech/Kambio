const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const supabase = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } });

// GET /api/users/:id
router.get('/:id', async (req, res) => {
    const { data, error } = await supabase
        .from('users')
        .select('id, name, avatar_url, city, state, bio, rating, trades_count, created_at')
        .eq('id', req.params.id)
        .single();
    if (error) return res.status(404).json({ error: 'User not found' });
    res.json(data);
});

// GET /api/users/:id/listings
router.get('/:id/listings', async (req, res) => {
    const { data, error } = await supabase
        .from('listings')
        .select(`*, listing_photos(url)`)
        .eq('user_id', req.params.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// GET /api/users/:id/ratings
router.get('/:id/ratings', async (req, res) => {
    const { data, error } = await supabase
        .from('ratings')
        .select('*, rater:rater_id(id, name, avatar_url)')
        .eq('rated_id', req.params.id)
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// PATCH /api/users/me  (update own profile)
router.patch('/me', requireAuth, upload.single('avatar'), async (req, res) => {
    const schema = z.object({
        name: z.string().min(2).optional(),
        bio: z.string().max(300).optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        phone: z.string().optional(),
    });
    const body = schema.parse(req.body);

    let avatar_url = undefined;
    if (req.file) {
        const path = `avatars/${req.user.id}_${Date.now()}`;
        const { error: uploadErr } = await supabase.storage
            .from(process.env.SUPABASE_STORAGE_BUCKET)
            .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
        if (!uploadErr) {
            const { data: { publicUrl } } = supabase.storage
                .from(process.env.SUPABASE_STORAGE_BUCKET)
                .getPublicUrl(path);
            avatar_url = publicUrl;
        }
    }

    const updates = { ...body, ...(avatar_url && { avatar_url }) };
    const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', req.user.id)
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

module.exports = router;
