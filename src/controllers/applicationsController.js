// src/controllers/applicationsController.js
const { query } = require('../db/pool');
const path = require('path');

// ── PUBLIC ───────────────────────────────────────────────────

// POST /api/applications  — submit job application
const submitApplication = async (req, res) => {
  try {
    const {
      job_id, full_name, email, phone, location,
      current_role, experience_years, current_employer,
      linkedin_url, portfolio_url, cover_letter, source
    } = req.body;

    if (!job_id || !full_name || !email) {
      return res.status(400).json({ error: 'job_id, full_name, and email are required' });
    }

    // Check job exists and is active
    const jobCheck = await query('SELECT id, title FROM jobs WHERE id = $1 AND is_active = true', [job_id]);
    if (!jobCheck.rows.length) {
      return res.status(404).json({ error: 'Job not found or no longer active' });
    }

    // Prevent duplicate applications
    const dupCheck = await query(
      'SELECT id FROM applications WHERE job_id = $1 AND email = $2',
      [job_id, email.toLowerCase().trim()]
    );
    if (dupCheck.rows.length) {
      return res.status(409).json({ error: 'You have already applied for this position' });
    }

    // Handle CV upload (if multer used)
    let cv_filename = null;
    let cv_url = null;
    if (req.file) {
      cv_filename = req.file.filename;
      cv_url = `/uploads/${req.file.filename}`;
    }

    const result = await query(
      `INSERT INTO applications (
         job_id, full_name, email, phone, location,
         current_role, experience_years, current_employer,
         linkedin_url, portfolio_url, cover_letter,
         cv_filename, cv_url, source, ip_address
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id, full_name, email, status, created_at`,
      [
        job_id, full_name, email.toLowerCase().trim(), phone || null, location || null,
        current_role || null, experience_years || null, current_employer || null,
        linkedin_url || null, portfolio_url || null, cover_letter || null,
        cv_filename, cv_url, source || 'website', req.ip || null
      ]
    );

    // Increment job applications count
    await query('UPDATE jobs SET applications_count = applications_count + 1 WHERE id = $1', [job_id]);

    res.status(201).json({
      message: 'Application submitted successfully! We will review your profile and be in touch.',
      application: result.rows[0]
    });
  } catch (err) {
    console.error('submitApplication error:', err);
    res.status(500).json({ error: 'Failed to submit application' });
  }
};

// ── ADMIN ────────────────────────────────────────────────────

// GET /api/admin/applications
const getApplications = async (req, res) => {
  try {
    const { status, job_id, page = 1, limit = 20, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];

    if (status) {
      params.push(status);
      conditions.push(`a.status = $${params.length}`);
    }
    if (job_id) {
      params.push(job_id);
      conditions.push(`a.job_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(a.full_name ILIKE $${params.length} OR a.email ILIKE $${params.length})`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countRes = await query(`SELECT COUNT(*) FROM applications a ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    params.push(parseInt(limit), offset);
    const result = await query(
      `SELECT
         a.id, a.full_name, a.email, a.phone, a.location,
         a.current_role, a.experience_years, a.current_employer,
         a.linkedin_url, a.cv_url, a.status, a.interview_date,
         a.created_at,
         j.title AS job_title, j.company,
         adm.full_name AS assigned_to_name
       FROM applications a
       LEFT JOIN jobs j ON a.job_id = j.id
       LEFT JOIN admins adm ON a.assigned_to = adm.id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      applications: result.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    console.error('getApplications error:', err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
};

// GET /api/admin/applications/:id
const getApplication = async (req, res) => {
  try {
    const result = await query(
      `SELECT a.*, j.title AS job_title, j.company, j.location AS job_location
       FROM applications a
       LEFT JOIN jobs j ON a.job_id = j.id
       WHERE a.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Application not found' });
    res.json({ application: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch application' });
  }
};

// PATCH /api/admin/applications/:id/status
const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, stage_notes, interview_date, assigned_to } = req.body;

    const validStatuses = ['new','reviewing','shortlisted','interview','offered','placed','rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const result = await query(
      `UPDATE applications
       SET status=$1, stage_notes=$2, interview_date=$3, assigned_to=$4
       WHERE id=$5
       RETURNING id, status, stage_notes, interview_date`,
      [status, stage_notes || null, interview_date || null, assigned_to || null, id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Application not found' });

    // Audit
    await query(
      `INSERT INTO audit_log (admin_id, action, entity, entity_id, new_value, ip_address)
       VALUES ($1, 'application.status_changed', 'applications', $2, $3, $4)`,
      [req.admin.id, id, JSON.stringify({ status }), req.ip]
    );

    // If placed, create placement record
    if (status === 'placed') {
      const app = await query(
        'SELECT a.*, j.title, j.company FROM applications a LEFT JOIN jobs j ON a.job_id = j.id WHERE a.id = $1',
        [id]
      );
      if (app.rows.length) {
        const a = app.rows[0];
        await query(
          `INSERT INTO placements (application_id, candidate_name, candidate_email, company, role, placed_by)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
          [id, a.full_name, a.email, a.company || '', a.title || '', req.admin.id]
        );
      }
    }

    res.json({ application: result.rows[0] });
  } catch (err) {
    console.error('updateStatus error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
};

module.exports = { submitApplication, getApplications, getApplication, updateStatus };
