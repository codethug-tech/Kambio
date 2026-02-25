const express = require('express');
const { z } = require('zod');
const supabase = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/reports
router.post('/', requireAuth, async (req, res) => {
    const { target_type, target_id, reason } = z.object({
        target_type: z.enum(['user', 'listing']),
        target_id: z.string().uuid(),
        reason: z.string().min(1).max(500),
    }).parse(req.body);

    const { data, error } = await supabase
        .from('reports')
        .insert({ reporter_id: req.user.id, target_type, target_id, reason })
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

module.exports = router;
