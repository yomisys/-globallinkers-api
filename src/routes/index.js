// src/routes/index.js
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const router  = express.Router();

const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const { login, getMe, changePassword, createAdmin } = require('../controllers/authController');
const { getJobs, getJob, getCategories, adminGetJobs, createJob, updateJob, deleteJob } = require('../controllers/jobsController');
const { submitApplication, getApplications, getApplication, updateStatus } = require('../controllers/applicationsController');
const { submitRequest, getRequests, updateRequest, submitEnquiry, getEnquiries, replyEnquiry } = require('../controllers/employerController');
const { getDashboard } = require('../controllers/dashboardController');

// ── CV Upload (multer) ────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename:    (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, DOC, DOCX files allowed'));
  }
});

// ── AUTH ──────────────────────────────────────────────────────
router.post('/auth/login',           login);
router.get ('/auth/me',              requireAuth, getMe);
router.put ('/auth/change-password', requireAuth, changePassword);
router.post('/auth/create-admin',    requireAuth, requireSuperAdmin, createAdmin);

// ── PUBLIC: Jobs ──────────────────────────────────────────────
router.get('/jobs',                  getJobs);
router.get('/jobs/categories',       getCategories);
router.get('/jobs/:id',              getJob);

// ── PUBLIC: Applications ──────────────────────────────────────
router.post('/applications',         upload.single('cv'), submitApplication);

// ── PUBLIC: Employer Requests ─────────────────────────────────
router.post('/employer-requests',    submitRequest);

// ── PUBLIC: Enquiries ─────────────────────────────────────────
router.post('/enquiries',            submitEnquiry);

// ── ADMIN: Dashboard ──────────────────────────────────────────
router.get('/admin/dashboard',       requireAuth, getDashboard);

// ── ADMIN: Jobs ───────────────────────────────────────────────
router.get   ('/admin/jobs',         requireAuth, adminGetJobs);
router.post  ('/admin/jobs',         requireAuth, createJob);
router.put   ('/admin/jobs/:id',     requireAuth, updateJob);
router.delete('/admin/jobs/:id',     requireAuth, deleteJob);

// ── ADMIN: Applications ───────────────────────────────────────
router.get  ('/admin/applications',         requireAuth, getApplications);
router.get  ('/admin/applications/:id',     requireAuth, getApplication);
router.patch('/admin/applications/:id/status', requireAuth, updateStatus);

// ── ADMIN: Employer Requests ──────────────────────────────────
router.get  ('/admin/employer-requests',    requireAuth, getRequests);
router.patch('/admin/employer-requests/:id', requireAuth, updateRequest);

// ── ADMIN: Enquiries ──────────────────────────────────────────
router.get  ('/admin/enquiries',         requireAuth, getEnquiries);
router.patch('/admin/enquiries/:id/reply', requireAuth, replyEnquiry);

module.exports = router;
