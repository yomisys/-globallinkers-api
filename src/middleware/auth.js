// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'gl-change-this-secret-in-production';

// Verify JWT and attach admin to req
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Fetch admin from DB (ensures account still active)
    const result = await query(
      'SELECT id, email, full_name, role, is_active FROM admins WHERE id = $1',
      [decoded.id]
    );

    if (!result.rows.length || !result.rows[0].is_active) {
      return res.status(401).json({ error: 'Account not found or inactive' });
    }

    req.admin = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Optional: restrict to superadmin only
const requireSuperAdmin = (req, res, next) => {
  if (req.admin?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin access required' });
  }
  next();
};

// Generate JWT
const signToken = (admin) => {
  return jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );
};

module.exports = { requireAuth, requireSuperAdmin, signToken };
