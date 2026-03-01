# Global Linkers Ltd — Backend API
## Node.js + Express + PostgreSQL

---

## STORAGE ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLETE SYSTEM ARCHITECTURE                  │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐    HTTP/REST     ┌─────────────────────────────┐
│              │  ◄────────────►  │         Express API          │
│   Frontend   │                  │         (Node.js)            │
│  (HTML/JS)   │  Bearer JWT      │       Port 4000             │
│              │  ◄────────────►  │                             │
└──────────────┘                  └──────────────┬──────────────┘
                                                 │
                                    pg (node-postgres)
                                                 │
                                  ┌──────────────▼──────────────┐
                                  │         PostgreSQL            │
                                  │          Port 5432           │
                                  │                              │
                                  │  Tables:                     │
                                  │  ├─ admins                  │
                                  │  ├─ jobs                    │
                                  │  ├─ applications            │
                                  │  ├─ employer_requests       │
                                  │  ├─ enquiries               │
                                  │  ├─ placements              │
                                  │  └─ audit_log               │
                                  └─────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                     DATABASE DESIGN DECISIONS                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  • UUID primary keys   — Prevents enumeration attacks           │
│  • updated_at triggers — Automatic timestamp maintenance        │
│  • Soft deletes on jobs — is_active=false, data preserved       │
│  • Connection pool (max 20) — Handles concurrent requests       │
│  • Indexed columns     — created_at, status, email, job_id     │
│  • bcrypt (cost 12)    — Industry-standard password hashing     │
│  • JWT (12h expiry)    — Stateless auth, no session storage     │
│  • Audit log           — Every admin action is recorded        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## QUICK START (Local Development)

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm 9+

### Step 1 — Clone & install
```bash
cd gl-backend
npm install
```

### Step 2 — Create PostgreSQL database
```bash
# Option A: psql command line
psql -U postgres -c "CREATE DATABASE globallinkers;"

# Option B: GUI tools (pgAdmin, TablePlus, DBeaver)
# Just create a database named: globallinkers
```

### Step 3 — Run schema
```bash
psql -U postgres -d globallinkers -f src/db/schema.sql
```
This creates all 7 tables, indexes, triggers, and seeds the default admin.

### Step 4 — Configure environment
```bash
cp .env.example .env
# Edit .env with your DB password and a strong JWT_SECRET
```

### Step 5 — Start the API
```bash
npm run dev        # Development (auto-restart on file changes)
# or
npm start          # Production
```

### Step 6 — Test it
```bash
# Health check
curl http://localhost:4000/health

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@globallinkers.ng","password":"Admin@GL2025!"}'
```
**Change the default password immediately!**

---

## API REFERENCE

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | — | Login, get JWT |
| GET | `/api/auth/me` | ✅ | Get current admin profile |
| PUT | `/api/auth/change-password` | ✅ | Change password |
| POST | `/api/auth/create-admin` | ✅ Superadmin | Create new admin user |

### Public — Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs` | List active jobs (search, filter, paginate) |
| GET | `/api/jobs/categories` | Job categories with counts |
| GET | `/api/jobs/:id` | Single job detail (increments view count) |

**Query params for `/api/jobs`:**
- `search` — keyword search (title, company, description)
- `location` — partial match
- `category` — exact match
- `job_type` — Full-time | Part-time | Contract | Remote
- `featured` — `true` for featured only
- `page`, `limit` — pagination

### Public — Applications
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/applications` | Submit application (multipart/form-data for CV upload) |

**Required fields:** `job_id`, `full_name`, `email`
**Optional file:** `cv` (PDF/DOC/DOCX, max 5MB)

### Public — Employer Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/employer-requests` | Submit hiring request |

### Public — Enquiries
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/enquiries` | Submit contact form message |

### Admin — Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | KPIs, recent activity, charts data |

### Admin — Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/jobs` | All jobs including inactive |
| POST | `/api/admin/jobs` | Create new job listing |
| PUT | `/api/admin/jobs/:id` | Update job |
| DELETE | `/api/admin/jobs/:id` | Soft-delete (deactivate) job |

### Admin — Applications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/applications` | All applications (filter by status, job_id) |
| GET | `/api/admin/applications/:id` | Single application detail |
| PATCH | `/api/admin/applications/:id/status` | Update application status |

**Valid statuses:** `new` → `reviewing` → `shortlisted` → `interview` → `offered` → `placed` / `rejected`

**Auto-action:** Setting status to `placed` automatically creates a record in the `placements` table.

### Admin — Employer Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/employer-requests` | All requests (sorted by urgency) |
| PATCH | `/api/admin/employer-requests/:id` | Update status, notes, assign |

### Admin — Enquiries
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/enquiries` | All enquiries |
| PATCH | `/api/admin/enquiries/:id/reply` | Reply and mark as replied |

---

## CONNECTING THE FRONTEND

In your frontend HTML, replace the mock data calls with real API calls:

```javascript
const API = 'http://localhost:4000/api'; // change to your server URL

// Load jobs
const res = await fetch(`${API}/jobs?search=engineer&page=1`);
const { jobs, pagination } = await res.json();

// Submit application
const form = new FormData();
form.append('job_id', '...');
form.append('full_name', 'John Doe');
form.append('email', 'john@email.com');
form.append('cv', fileInput.files[0]); // CV file
const appRes = await fetch(`${API}/applications`, { method:'POST', body: form });

// Admin login
const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@globallinkers.ng', password: '...' })
});
const { token } = await loginRes.json();
localStorage.setItem('gl_token', token);

// Authenticated request
const dashRes = await fetch(`${API}/admin/dashboard`, {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('gl_token')}` }
});
```

---

## PRODUCTION DEPLOYMENT

### Recommended Stack
```
Internet → Nginx (reverse proxy + SSL) → Node.js API → PostgreSQL
```

### Server Requirements
- Ubuntu 22.04 LTS (recommended)
- 2GB RAM minimum (4GB recommended)
- 20GB disk

### Step-by-Step: VPS Deployment (DigitalOcean / Hetzner / Linode)

```bash
# 1. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql

# 3. Create DB user and database
sudo -u postgres psql
CREATE USER gluser WITH PASSWORD 'strong_password_here';
CREATE DATABASE globallinkers OWNER gluser;
\q

# 4. Upload your code (via git or scp)
git clone https://github.com/yourorg/gl-backend.git
cd gl-backend
npm install --production

# 5. Set environment
cp .env.example .env
nano .env  # Fill in DB_PASSWORD, JWT_SECRET, NODE_ENV=production

# 6. Run schema
PGPASSWORD=your_pass psql -U gluser -d globallinkers -f src/db/schema.sql

# 7. Install PM2 process manager
npm install -g pm2
pm2 start server.js --name gl-api
pm2 save
pm2 startup  # Auto-start on reboot

# 8. Install and configure Nginx
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/globallinkers
```

**Nginx config:**
```nginx
server {
    listen 80;
    server_name api.globallinkers.ng;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    client_max_body_size 10M;  # For CV uploads
}
```

```bash
# Enable site and get SSL cert
sudo ln -s /etc/nginx/sites-available/globallinkers /etc/nginx/sites-enabled/
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.globallinkers.ng
sudo systemctl restart nginx
```

---

## FILE STRUCTURE
```
gl-backend/
├── server.js                   # Express app entry point
├── package.json
├── .env.example                # Copy to .env
├── uploads/                    # CV files stored here
└── src/
    ├── db/
    │   ├── schema.sql          # Run once to create all tables
    │   └── pool.js             # PostgreSQL connection pool
    ├── middleware/
    │   └── auth.js             # JWT verification middleware
    ├── controllers/
    │   ├── authController.js   # Login, password, admin mgmt
    │   ├── jobsController.js   # Job CRUD (public + admin)
    │   ├── applicationsController.js
    │   ├── employerController.js  # Employer requests + enquiries
    │   └── dashboardController.js # KPIs and analytics
    └── routes/
        └── index.js            # All route definitions
```

---

## DEFAULT CREDENTIALS
```
Email:    admin@globallinkers.ng
Password: Admin@GL2025!
```
**Change this immediately after first deployment.**

---

## SECURITY NOTES
1. JWT_SECRET must be at least 32 random characters — generate with: `openssl rand -base64 32`
2. Never expose `.env` — add it to `.gitignore`
3. Set `FRONTEND_URL` to your exact frontend domain, not `*`
4. Enable PostgreSQL SSL in production (`DB_SSL=true`)
5. Uploaded CVs are served at `/uploads/` — consider moving to S3/Cloudflare R2 for scale
6. Rate limiting (e.g. `express-rate-limit`) is recommended before going live
