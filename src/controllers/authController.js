// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const { query } = require('../db/pool');
const { signToken } = require('../middleware/auth');

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find admin
    const result = await query(
      'SELECT * FROM admins WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const admin = result.rows[0];

    if (!admin.is_active) {
      return res.status(401).json({ error: 'Account has been deactivated. Contact your superadmin.' });
    }

    // Verify password
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last_login
    await query('UPDATE admins SET last_login = NOW() WHERE id = $1', [admin.id]);

    // Sign token
    const token = signToken(admin);

    res.json({
      token,
      admin: {
        id:        admin.id,
        email:     admin.email,
        full_name: admin.full_name,
        role:      admin.role,
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
};

// GET /api/auth/me  (requires token)
const getMe = async (req, res) => {
  res.json({ admin: req.admin });
};

// PUT /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Both current and new password required' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const result = await query('SELECT password FROM admins WHERE id = $1', [req.admin.id]);
    const valid = await bcrypt.compare(current_password, result.rows[0].password);

    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(new_password, 12);
    await query('UPDATE admins SET password = $1 WHERE id = $2', [hashed, req.admin.id]);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/auth/create-admin  (superadmin only)
const createAdmin = async (req, res) => {
  try {
    const { email, password, full_name, role = 'admin' } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'email, password, full_name required' });
    }

    const hashed = await bcrypt.hash(password, 12);

    const result = await query(
      `INSERT INTO admins (email, password, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role, created_at`,
      [email.toLowerCase().trim(), hashed, full_name, role]
    );

    res.status(201).json({ admin: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error('Create admin error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { login, getMe, changePassword, createAdmin };
