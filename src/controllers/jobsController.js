// src/controllers/jobsController.js
const { query } = require('../db/pool');

// ── PUBLIC ──────────────────────────────────────────────────

// GET /api/jobs  — public listing with search/filter/pagination
const getJobs = async (req, res) => {
  try {
    const {
      search, location, category, job_type,
      featured, page = 1, limit = 12
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = ['j.is_active = true'];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(j.title ILIKE $${params.length} OR j.company ILIKE $${params.length} OR j.description ILIKE $${params.length})`);
    }
    if (location) {
      params.push(`%${location}%`);
      conditions.push(`j.location ILIKE $${params.length}`);
    }
    if (category) {
      params.push(category);
      conditions.push(`j.category = $${params.length}`);
    }
    if (job_type) {
      params.push(job_type);
      conditions.push(`j.job_type = $${params.length}`);
    }
    if (featured === 'true') {
      conditions.push('j.is_featured = true');
    }

    const where = 'WHERE ' + conditions.join(' AND ');

    // Count total
    const countResult = await query(
      `SELECT COUNT(*) FROM jobs j ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Fetch jobs
    params.push(parseInt(limit), offset);
    const result = await query(
      `SELECT
         j.id, j.title, j.company, j.location, j.job_type,
         j.category, j.experience, j.salary_display, j.salary_min, j.salary_max,
         j.logo_initials, j.logo_color, j.is_featured,
         j.applications_count, j.views_count, j.deadline,
         j.created_at,
         -- How long ago
         CASE
           WHEN j.created_at > NOW() - INTERVAL '1 day'  THEN 'Today'
           WHEN j.created_at > NOW() - INTERVAL '2 days' THEN '1 day ago'
           WHEN j.created_at > NOW() - INTERVAL '7 days' THEN EXTRACT(DAY FROM NOW() - j.created_at)::int || ' days ago'
           ELSE TO_CHAR(j.created_at, 'Mon DD, YYYY')
         END AS posted_display
       FROM jobs j
       ${where}
       ORDER BY j.is_featured DESC, j.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      jobs: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      }
    });
  } catch (err) {
    console.error('getJobs error:', err);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
};

// GET /api/jobs/:id  — single job (increments view count)
const getJob = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE jobs SET views_count = views_count + 1
       WHERE id = $1 AND is_active = true
       RETURNING *`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ job: result.rows[0] });
  } catch (err) {
    console.error('getJob error:', err);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
};

// GET /api/jobs/categories  — distinct categories list
const getCategories = async (req, res) => {
  try {
    const result = await query(
      `SELECT DISTINCT category, COUNT(*) as count
       FROM jobs WHERE is_active = true AND category IS NOT NULL
       GROUP BY category ORDER BY count DESC`
    );
    res.json({ categories: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

// ── ADMIN ────────────────────────────────────────────────────

// GET /api/admin/jobs  — all jobs (incl inactive)
const adminGetJobs = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];

    if (status === 'active')   conditions.push('is_active = true');
    if (status === 'inactive') conditions.push('is_active = false');

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countRes = await query(`SELECT COUNT(*) FROM jobs ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    params.push(parseInt(limit), offset);
    const result = await query(
      `SELECT j.*, a.full_name AS posted_by_name
       FROM jobs j
       LEFT JOIN admins a ON j.posted_by = a.id
       ${where}
       ORDER BY j.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ jobs: result.rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    console.error('adminGetJobs error:', err);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
};

// POST /api/admin/jobs
const createJob = async (req, res) => {
  try {
    const {
      title, company, location, job_type, category, experience,
      salary_min, salary_max, salary_display,
      description, requirements, benefits,
      logo_initials, logo_color, is_featured, deadline
    } = req.body;

    if (!title || !company || !location || !job_type || !description) {
      return res.status(400).json({ error: 'title, company, location, job_type, description are required' });
    }

    const result = await query(
      `INSERT INTO jobs (
         title, company, location, job_type, category, experience,
         salary_min, salary_max, salary_display,
         description, requirements, benefits,
         logo_initials, logo_color, is_featured, deadline, posted_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        title, company, location, job_type,
        category || null, experience || null,
        salary_min || null, salary_max || null, salary_display || null,
        description, requirements || null, benefits || null,
        logo_initials || company.substring(0,2).toUpperCase(),
        logo_color || '#0A3D91',
        is_featured || false,
        deadline || null,
        req.admin.id
      ]
    );

    // Audit
    await query(
      `INSERT INTO audit_log (admin_id, action, entity, entity_id, new_value, ip_address)
       VALUES ($1, 'job.created', 'jobs', $2, $3, $4)`,
      [req.admin.id, result.rows[0].id, JSON.stringify({ title, company }), req.ip]
    );

    res.status(201).json({ job: result.rows[0] });
  } catch (err) {
    console.error('createJob error:', err);
    res.status(500).json({ error: 'Failed to create job' });
  }
};

// PUT /api/admin/jobs/:id
const updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, company, location, job_type, category, experience,
      salary_min, salary_max, salary_display,
      description, requirements, benefits,
      logo_initials, logo_color, is_featured, is_active, deadline
    } = req.body;

    const result = await query(
      `UPDATE jobs SET
         title=$1, company=$2, location=$3, job_type=$4, category=$5, experience=$6,
         salary_min=$7, salary_max=$8, salary_display=$9,
         description=$10, requirements=$11, benefits=$12,
         logo_initials=$13, logo_color=$14, is_featured=$15, is_active=$16, deadline=$17
       WHERE id=$18
       RETURNING *`,
      [
        title, company, location, job_type, category, experience,
        salary_min, salary_max, salary_display,
        description, requirements, benefits,
        logo_initials, logo_color, is_featured, is_active, deadline, id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ job: result.rows[0] });
  } catch (err) {
    console.error('updateJob error:', err);
    res.status(500).json({ error: 'Failed to update job' });
  }
};

// DELETE /api/admin/jobs/:id  (soft delete — sets is_active = false)
const deleteJob = async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE jobs SET is_active = false WHERE id = $1', [id]);
    await query(
      `INSERT INTO audit_log (admin_id, action, entity, entity_id, ip_address)
       VALUES ($1, 'job.deleted', 'jobs', $2, $3)`,
      [req.admin.id, id, req.ip]
    );
    res.json({ message: 'Job deactivated successfully' });
  } catch (err) {
    console.error('deleteJob error:', err);
    res.status(500).json({ error: 'Failed to delete job' });
  }
};

module.exports = {
  getJobs, getJob, getCategories,
  adminGetJobs, createJob, updateJob, deleteJob
};
