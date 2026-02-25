const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabase');

/**
 * Verifies the Bearer token and attaches req.user (the users row).
 */
async function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = header.split(' ')[1];
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        // Fetch full user record
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', payload.userId)
            .single();

        if (error || !user) return res.status(401).json({ error: 'User not found' });
        if (user.is_blocked) return res.status(403).json({ error: 'Account blocked' });

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

module.exports = { requireAuth };
