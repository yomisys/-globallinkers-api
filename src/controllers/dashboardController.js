// src/controllers/dashboardController.js
const { query } = require('../db/pool');

// GET /api/admin/dashboard
const getDashboard = async (req, res) => {
  try {
    // Run all counts in parallel
    const [
      jobsRes, appsRes, employersRes,
      placementsRes, enquiriesRes,
      recentAppsRes, recentRequestsRes,
      appsByStatusRes, jobsByCategoryRes
    ] = await Promise.all([
      // Active jobs count
      query('SELECT COUNT(*) FROM jobs WHERE is_active = true'),
      // New applications (last 30 days)
      query("SELECT COUNT(*) FROM applications WHERE created_at > NOW() - INTERVAL '30 days'"),
      // Active employers (submitted requests, deduped by company)
      query("SELECT COUNT(DISTINCT company_name) FROM employer_requests WHERE status != 'closed'"),
      // Total placements
      query("SELECT COUNT(*) FROM placements"),
      // Pending enquiries
      query("SELECT COUNT(*) FROM enquiries WHERE status IN ('new','read')"),

      // Recent 5 applications
      query(`
        SELECT a.full_name, a.email, a.status, a.created_at,
               j.title AS job_title, j.company
        FROM applications a
        LEFT JOIN jobs j ON a.job_id = j.id
        ORDER BY a.created_at DESC LIMIT 5
      `),
      // Recent 5 employer requests
      query(`
        SELECT company_name, job_title, urgency, status, created_at
        FROM employer_requests
        ORDER BY created_at DESC LIMIT 5
      `),
      // Applications by status
      query(`
        SELECT status, COUNT(*) as count
        FROM applications
        GROUP BY status ORDER BY count DESC
      `),
      // Jobs by category
      query(`
        SELECT category, COUNT(*) as count
        FROM jobs WHERE is_active = true AND category IS NOT NULL
        GROUP BY category ORDER BY count DESC LIMIT 8
      `),
    ]);

    res.json({
      kpis: {
        active_jobs:       parseInt(jobsRes.rows[0].count),
        new_applications:  parseInt(appsRes.rows[0].count),
        active_employers:  parseInt(employersRes.rows[0].count),
        total_placements:  parseInt(placementsRes.rows[0].count),
        pending_enquiries: parseInt(enquiriesRes.rows[0].count),
      },
      recent_applications: recentAppsRes.rows,
      recent_requests:     recentRequestsRes.rows,
      apps_by_status:      appsByStatusRes.rows,
      jobs_by_category:    jobsByCategoryRes.rows,
    });
  } catch (err) {
    console.error('getDashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
};

module.exports = { getDashboard };
