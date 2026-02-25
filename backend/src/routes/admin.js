const express = require('express');
const { z } = require('zod');
const supabase = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

const router = express.Router();

// All admin routes require auth + admin
router.use(requireAuth, requireAdmin);

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
    const [users, listings, reports] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('reports').select('id', { count: 'exact', head: true }).eq('resolved', false),
    ]);
    res.json({
        total_users: users.count,
        active_listings: listings.count,
        open_reports: reports.count,
    });
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
    const { page = 1, limit = 50, q } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    let query = supabase
        .from('users')
        .select('id, name, email, phone, city, rating, trades_count, is_blocked, created_at')
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1);
    if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// PATCH /api/admin/users/:id/block
router.patch('/users/:id/block', async (req, res) => {
    const { blocked } = z.object({ blocked: z.boolean() }).parse(req.body);
    const { data, error } = await supabase
        .from('users')
        .update({ is_blocked: blocked })
        .eq('id', req.params.id)
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// GET /api/admin/listings
router.get('/listings', async (req, res) => {
    const { page = 1, limit = 50, q } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    let query = supabase
        .from('listings')
        .select(`id, title, type, status, city, created_at, users(name, email)`)
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1);
    if (q) query = query.ilike('title', `%${q}%`);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// PATCH /api/admin/listings/:id/hide
router.patch('/listings/:id/hide', async (req, res) => {
    const { hidden } = z.object({ hidden: z.boolean() }).parse(req.body);
    const { data, error } = await supabase
        .from('listings')
        .update({ status: hidden ? 'hidden' : 'active' })
        .eq('id', req.params.id)
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// GET /api/admin/reports
router.get('/reports', async (req, res) => {
    const { data, error } = await supabase
        .from('reports')
        .select(`*, reporter:reporter_id(id, name, email)`)
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// PATCH /api/admin/reports/:id/resolve
router.patch('/reports/:id/resolve', async (req, res) => {
    const { data, error } = await supabase
        .from('reports')
        .update({ resolved: true })
        .eq('id', req.params.id)
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

module.exports = router;
