/**
 * Admin-only middleware: checks req.user.is_admin flag.
 * For MVP: hardcode admin users by email via env var ADMIN_EMAILS.
 */
function requireAdmin(req, res, next) {
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
    if (!req.user || !adminEmails.includes(req.user.email)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

module.exports = { requireAdmin };
