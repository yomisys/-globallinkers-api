// src/controllers/employerController.js
const { query } = require('../db/pool');

// ── PUBLIC ───────────────────────────────────────────────────

// POST /api/employer-requests
const submitRequest = async (req, res) => {
  try {
    const {
      company_name, industry, company_size, website,
      contact_name, contact_email, contact_phone, contact_title,
      job_title, department, job_type, location, salary_range,
      experience_required, vacancies, description, urgency, package_type
    } = req.body;

    if (!company_name || !contact_name || !contact_email || !job_title) {
      return res.status(400).json({ error: 'company_name, contact_name, contact_email, job_title required' });
    }

    const result = await query(
      `INSERT INTO employer_requests (
         company_name, industry, company_size, website,
         contact_name, contact_email, contact_phone, contact_title,
         job_title, department, job_type, location, salary_range,
         experience_required, vacancies, description, urgency, package_type
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id, company_name, job_title, status, created_at`,
      [
        company_name, industry || null, company_size || null, website || null,
        contact_name, contact_email.toLowerCase().trim(), contact_phone || null, contact_title || null,
        job_title, department || null, job_type || null, location || null, salary_range || null,
        experience_required || null, vacancies || 1, description || null,
        urgency || 'normal', package_type || null
      ]
    );

    res.status(201).json({
      message: 'Your request has been received! Our team will contact you within 2 business hours.',
      request: result.rows[0]
    });
  } catch (err) {
    console.error('submitRequest error:', err);
    res.status(500).json({ error: 'Failed to submit request' });
  }
};

// ── ADMIN ────────────────────────────────────────────────────

// GET /api/admin/employer-requests
const getRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const countRes = await query(`SELECT COUNT(*) FROM employer_requests ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    params.push(parseInt(limit), offset);
    const result = await query(
      `SELECT er.*, adm.full_name AS assigned_to_name
       FROM employer_requests er
       LEFT JOIN admins adm ON er.assigned_to = adm.id
       ${where}
       ORDER BY
         CASE urgency WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
         created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      requests: result.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    console.error('getRequests error:', err);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
};

// PATCH /api/admin/employer-requests/:id
const updateRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, assigned_to } = req.body;

    const result = await query(
      `UPDATE employer_requests SET status=$1, notes=$2, assigned_to=$3
       WHERE id=$4 RETURNING *`,
      [status, notes || null, assigned_to || null, id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Request not found' });
    res.json({ request: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update request' });
  }
};

module.exports = { submitRequest, getRequests, updateRequest };


// ============================================================
// src/controllers/enquiriesController.js — inlined here for brevity
// ============================================================
const submitEnquiry = async (req, res) => {
  try {
    const { full_name, email, phone, user_type, subject, message } = req.body;

    if (!full_name || !email || !subject || !message) {
      return res.status(400).json({ error: 'full_name, email, subject, message required' });
    }

    const result = await query(
      `INSERT INTO enquiries (full_name, email, phone, user_type, subject, message, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, full_name, status, created_at`,
      [full_name, email.toLowerCase().trim(), phone || null, user_type || null, subject, message, req.ip || null]
    );

    res.status(201).json({
      message: 'Thank you for your message! We will reply within 24 hours.',
      enquiry: result.rows[0]
    });
  } catch (err) {
    console.error('submitEnquiry error:', err);
    res.status(500).json({ error: 'Failed to submit enquiry' });
  }
};

const getEnquiries = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const countRes = await query(`SELECT COUNT(*) FROM enquiries ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    params.push(parseInt(limit), offset);
    const result = await query(
      `SELECT * FROM enquiries ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      enquiries: result.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch enquiries' });
  }
};

const replyEnquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const { reply_text } = req.body;

    const result = await query(
      `UPDATE enquiries
       SET status='replied', reply_text=$1, replied_by=$2, replied_at=NOW()
       WHERE id=$3 RETURNING *`,
      [reply_text, req.admin.id, id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Enquiry not found' });
    res.json({ enquiry: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reply to enquiry' });
  }
};

module.exports = {
  submitRequest, getRequests, updateRequest,
  submitEnquiry, getEnquiries, replyEnquiry
};
