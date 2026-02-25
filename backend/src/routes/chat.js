const express = require('express');
const { z } = require('zod');
const supabase = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/chat/threads  — open or get existing thread
router.post('/threads', requireAuth, async (req, res) => {
    const { listing_id } = z.object({ listing_id: z.string().uuid() }).parse(req.body);

    // Get the listing to find seller
    const { data: listing, error: lErr } = await supabase
        .from('listings').select('user_id').eq('id', listing_id).single();
    if (lErr) return res.status(404).json({ error: 'Listing not found' });
    if (listing.user_id === req.user.id)
        return res.status(400).json({ error: 'Cannot chat with yourself' });

    // Upsert thread (unique on listing_id + buyer_id)
    const { data, error } = await supabase
        .from('chat_threads')
        .upsert(
            { listing_id, buyer_id: req.user.id, seller_id: listing.user_id },
            { onConflict: 'listing_id,buyer_id' }
        )
        .select(`*, listing:listing_id(title), buyer:buyer_id(id,name,avatar_url), seller:seller_id(id,name,avatar_url)`)
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

// GET /api/chat/threads  — my threads
router.get('/threads', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('chat_threads')
        .select(`
      id, created_at,
      listing:listing_id(id, title),
      buyer:buyer_id(id, name, avatar_url),
      seller:seller_id(id, name, avatar_url)
    `)
        .or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`)
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// GET /api/chat/threads/:id/messages
router.get('/threads/:id/messages', requireAuth, async (req, res) => {
    // Verify participant
    const { data: thread } = await supabase
        .from('chat_threads').select('buyer_id, seller_id').eq('id', req.params.id).single();
    if (!thread || (thread.buyer_id !== req.user.id && thread.seller_id !== req.user.id))
        return res.status(403).json({ error: 'Not a participant' });

    const { data, error } = await supabase
        .from('chat_messages')
        .select(`*, sender:sender_id(id, name, avatar_url)`)
        .eq('thread_id', req.params.id)
        .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    // Mark messages as read
    await supabase
        .from('chat_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('thread_id', req.params.id)
        .neq('sender_id', req.user.id)
        .is('read_at', null);

    res.json(data);
});

// POST /api/chat/threads/:id/messages
router.post('/threads/:id/messages', requireAuth, async (req, res) => {
    const { text } = z.object({ text: z.string().min(1).max(2000) }).parse(req.body);

    const { data: thread } = await supabase
        .from('chat_threads').select('buyer_id, seller_id').eq('id', req.params.id).single();
    if (!thread || (thread.buyer_id !== req.user.id && thread.seller_id !== req.user.id))
        return res.status(403).json({ error: 'Not a participant' });

    const { data, error } = await supabase
        .from('chat_messages')
        .insert({ thread_id: req.params.id, sender_id: req.user.id, text })
        .select(`*, sender:sender_id(id, name, avatar_url)`)
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

module.exports = router;
