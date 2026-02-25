const express = require('express');
const { z } = require('zod');
const supabase = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/trades  — initiate a trade from a thread
router.post('/', requireAuth, async (req, res) => {
    const { listing_id, thread_id } = z.object({
        listing_id: z.string().uuid(),
        thread_id: z.string().uuid(),
    }).parse(req.body);

    const { data: thread } = await supabase
        .from('chat_threads').select('*').eq('id', thread_id).single();
    if (!thread || thread.buyer_id !== req.user.id)
        return res.status(403).json({ error: 'Only the buyer can initiate a trade' });

    // Check no pending trade for this listing+buyer
    const { data: existing } = await supabase
        .from('trades')
        .select('id')
        .eq('listing_id', listing_id)
        .eq('buyer_id', req.user.id)
        .eq('status', 'pending')
        .maybeSingle();
    if (existing) return res.status(409).json({ error: 'Trade already pending' });

    const { data, error } = await supabase
        .from('trades')
        .insert({
            listing_id,
            thread_id,
            buyer_id: thread.buyer_id,
            seller_id: thread.seller_id,
            status: 'pending',
        })
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

// GET /api/trades  — my trades
router.get('/', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('trades')
        .select(`*, listing:listing_id(title), buyer:buyer_id(id,name,avatar_url), seller:seller_id(id,name,avatar_url)`)
        .or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`)
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// PATCH /api/trades/:id  — mark completed or cancelled
router.patch('/:id', requireAuth, async (req, res) => {
    const { status } = z.object({ status: z.enum(['completed', 'cancelled']) }).parse(req.body);

    const { data: trade } = await supabase
        .from('trades').select('*').eq('id', req.params.id).single();
    if (!trade) return res.status(404).json({ error: 'Trade not found' });
    if (trade.buyer_id !== req.user.id && trade.seller_id !== req.user.id)
        return res.status(403).json({ error: 'Not a participant' });
    if (trade.status !== 'pending')
        return res.status(400).json({ error: `Trade already ${trade.status}` });

    const { data, error } = await supabase
        .from('trades')
        .update({ status })
        .eq('id', req.params.id)
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });

    // If completed → also mark listing as completed
    if (status === 'completed') {
        await supabase.from('listings').update({ status: 'completed' }).eq('id', trade.listing_id);
    }

    res.json(data);
});

module.exports = router;
