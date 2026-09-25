QuizXP Platform - Refactored Full-Stack Application Architecture
QuizXP is a mobile-first, gamified learning and examination-preparation platform engineered for Nigerian secondary-school students preparing for JAMB (UTME) and WAEC (SSCE).
🏗️ Repository Architecture
quizxp/
├── frontend/                 # Static Vanilla JS / HTML5 / CSS3 Web Client
│   ├── index.html            # Product Landing Page
│   ├── login.html            # Student Login
│   ├── register.html         # Student Registration (Starts from Clean State)
│   ├── admin-login.html      # Administrative Portal Login
│   ├── admin-register.html   # Admin Registration Request (Secret Key Protected)
│   ├── css/                  # Styling & Responsive Design Systems
│   └── js/                   # API Engine & Page Modules
│
├── backend/                  # Node.js & Express API Gateway
│   ├── server.js             # HTTP Server Entry Point (Binds 0.0.0.0)
│   ├── config.js             # Environment Config & PostgreSQL Client Pool
│   ├── middleware/           # JWT, Admin Security & Validation Middlewares
│   ├── routes/               # API Endpoint Routes (Auth, Quizzes, Admin)
│   └── services/             # Gemini AI Service & Scoring Logic
│
├── database/                 # Relational PostgreSQL Database Assets
│   ├── schema.sql            # Executable Schema DDL
│   └── seed.sql              # Nigerian Education Seed Data (16 Subjects)
│
├── .env.example              # Environment Variable Template
├── render.yaml               # Render Infrastructure-as-Code Setup
├── package.json              # Node.js Manifest
└── README.md                 # Deployment & Setup Blueprint


🚀 Local Development Setup
1. Prerequisites
Node.js (>= 18.x)
PostgreSQL Server running locally or remotely
2. Database Initialization
Create a PostgreSQL database and run the schema and seed scripts:
createdb quizxp_db
psql -d quizxp_db -f database/schema.sql
psql -d quizxp_db -f database/seed.sql


3. Environment Setup
Copy .env.example to .env and fill in your local details:
cp .env.example .env


4. Run the Backend
npm install
npm run dev


The server will start at http://localhost:5000 with a health check at /api/health.
🌐 Render Cloud Deployment
QuizXP is pre-configured for instant deployment on Render using render.yaml:
Push your repository to GitHub.
Log into Render and click New -> Blueprint.
Connect your GitHub repository.
Render will automatically provision:
A managed PostgreSQL Database (quizxp-postgres).
A Node Web Service for the backend API (quizxp-backend).
A Static Site for the frontend client (quizxp-frontend).
Configure the GEMINI_API_KEY in your Render dashboard environment settings.
