const express = require('express');
const { z } = require('zod');
const supabase = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/favorites
router.get('/', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('favorites')
        .select(`*, listing:listing_id(*, listing_photos(url))`)
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// POST /api/favorites
router.post('/', requireAuth, async (req, res) => {
    const { listing_id } = z.object({ listing_id: z.string().uuid() }).parse(req.body);
    const { data, error } = await supabase
        .from('favorites')
        .insert({ user_id: req.user.id, listing_id })
        .select()
        .single();
    if (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'Already favorited' });
        return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data);
});

// DELETE /api/favorites/:listing_id
router.delete('/:listing_id', requireAuth, async (req, res) => {
    const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', req.user.id)
        .eq('listing_id', req.params.listing_id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
});

module.exports = router;
