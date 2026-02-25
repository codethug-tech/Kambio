const express = require('express');
const { z } = require('zod');
const supabase = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/ratings
router.post('/', requireAuth, async (req, res) => {
    const { trade_id, rated_id, score, comment } = z.object({
        trade_id: z.string().uuid(),
        rated_id: z.string().uuid(),
        score: z.number().int().min(1).max(5),
        comment: z.string().max(500).optional(),
    }).parse(req.body);

    // Verify trade participant
    const { data: trade } = await supabase
        .from('trades').select('*').eq('id', trade_id).single();
    if (!trade || (trade.buyer_id !== req.user.id && trade.seller_id !== req.user.id))
        return res.status(403).json({ error: 'Not a trade participant' });
    if (trade.status !== 'completed')
        return res.status(400).json({ error: 'Trade must be completed before rating' });

    const { data, error } = await supabase
        .from('ratings')
        .insert({ trade_id, rater_id: req.user.id, rated_id, score, comment })
        .select()
        .single();
    if (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'Already rated this trade' });
        return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data);
});

module.exports = router;
