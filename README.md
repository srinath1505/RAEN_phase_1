# RAEN — Luxury Fashion E-Commerce

> **Team:** Read `PHASE1_TODO.md` first — it has the exact task list for the current sprint.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Static HTML + Tailwind CSS + Vanilla JS |
| Backend | Node.js + Express.js |
| Database | PostgreSQL + Prisma ORM |
| Payments | Razorpay · PayPal · Manual UPI |
| Auth | JWT + bcrypt |
| Email | Nodemailer (SMTP) |

---

## Prerequisites

- **Node.js v18+** — https://nodejs.org
- **PostgreSQL** — local install or cloud DB (Neon/Supabase/Railway)
- **npm** — bundled with Node.js

---

## Local Setup

### 1. Clone & enter the project

```bash
git clone <repo-url>
cd "Raen new website 3"
```

### 2. Install backend dependencies

```bash
cd backend && npm install && cd ..
```

> This rebuilds native binaries (bcrypt) for your OS. Run on every new machine.

### 3. Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` — minimum required fields:

```env
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:4173

DATABASE_URL=postgresql://username:password@localhost:5432/raen_db

JWT_SECRET=any-long-random-string-here

ADMIN_EMAIL=admin@raen.design
ADMIN_PASSWORD=YourSecurePassword123!

RAZORPAY_KEY_ID=rzp_test_xxxx
RAZORPAY_KEY_SECRET=your_test_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_secret
PAYPAL_ENV=sandbox

UPI_ID=yourupiid@bank

EMAIL_PROVIDER=nodemailer
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password

CURRENCY=EUR
```

**Getting Gmail app password:**
Google Account → Security → 2-Step Verification → App Passwords → Generate → paste as SMTP_PASS

**Getting Razorpay test keys:**
dashboard.razorpay.com → Settings → API Keys → Generate Test Key

**Getting PayPal sandbox keys:**
developer.paypal.com → My Apps & Credentials → Create App

### 4. Set up database

Create the database (skip if using a cloud DB):

```bash
createdb raen_db
```

Run migrations:

```bash
cd backend
npx prisma generate --schema=./src/prisma/schema.prisma
npx prisma migrate dev --schema=./src/prisma/schema.prisma
cd ..
```

### 5. Seed products and admin user

```bash
cd backend && node src/prisma/seed.js && cd ..
```

Creates: 12 RAEN products, inventory per size (XS/S/M/L), 1 admin user.

### 6. Run the site

```bash
npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:4173 |
| Backend API | http://localhost:5000 |
| Health check | http://localhost:5000/health |

---

## Run Separately (if debugging)

Terminal 1 — Backend:
```bash
cd backend && npm run dev
```

Terminal 2 — Frontend:
```bash
node serve-stitch.js
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Frontend + backend together |
| `npm run backend` | Backend only |
| `npm run frontend` | Frontend only |
| `npm run prisma:migrate` | Run DB migrations |
| `npm run prisma:seed` | Seed products + admin |
| `npm run prisma:studio` | Open Prisma DB browser |

---

## Project Structure

```
Raen new website 3/
├── backend/
│   ├── src/
│   │   ├── config/           env, db, mail, payment configs
│   │   ├── controllers/      request handlers (11 files)
│   │   ├── middleware/       auth, admin, error, validation, rate limit
│   │   ├── prisma/           schema.prisma + seed.js
│   │   ├── routes/           API route definitions (11 files)
│   │   ├── services/         business logic layer (11 files)
│   │   ├── utils/            helpers
│   │   ├── app.js            Express app + middleware setup
│   │   └── server.js         Entry point
│   ├── .env.example          Copy to .env and fill in
│   └── package.json
├── stitch/                   All frontend HTML pages
│   ├── public/js/api.js      API helper (used by all pages)
│   ├── index.html            Homepage
│   ├── collections.html      Product listing
│   ├── product-detail.html   Single product (dynamic, uses ?slug=)
│   ├── shopping-bag.html     Cart
│   ├── checkout.html         Checkout + Razorpay/PayPal/UPI
│   ├── order-confirmation.html
│   ├── early-access.html
│   ├── contact.html          NEEDS API INTEGRATION (Phase 1 task)
│   └── ...static pages...
├── serve-stitch.js           Static file server for frontend
├── package.json
├── PHASE1_TODO.md            Sprint task list — start here
└── README.md                 This file
```

---

## Common Issues

| Error | Fix |
|---|---|
| `dlopen bcrypt_lib.node not a mach-o file` | `cd backend && npm install` |
| `Can't reach database server` | Check PostgreSQL is running, verify DATABASE_URL |
| `Port 5000 already in use` | `lsof -ti:5000 \| xargs kill -9` |
| `Port 4173 already in use` | `lsof -ti:4173 \| xargs kill -9` |
| Prisma migration locked | `cd backend && npx prisma migrate reset --schema=./src/prisma/schema.prisma` |

---

## Admin Access

After seeding, log in at `/api/auth/login` with:
- Email: value of `ADMIN_EMAIL` in your `.env`
- Password: value of `ADMIN_PASSWORD` in your `.env`

Admin routes require `Authorization: Bearer <token>` header.
