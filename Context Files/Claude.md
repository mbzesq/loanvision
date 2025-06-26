# LoanVision Project State – Claude.md

_Last updated: 2025-06-26_

---

## 1. High-Level Objective
To build a SaaS platform for ingesting, enriching, analyzing, and managing non-performing mortgage loan portfolios. The platform helps asset managers make better decisions by combining structured loan data, automated enrichment, and intelligent querying.

---

## 2. Core User Personas

### 👤 Alex the Active Manager
The primary user for the current phase. Alex is a portfolio analyst or asset manager responsible for hands-on review of individual loans and overall performance. They need real-time visibility into loan status, risk, and foreclosure pipeline.

### 👩‍💼 Sarah the Passive Investor *(Future)*
Sarah is a stakeholder or capital partner. She prefers high-level dashboards, summaries, and trend visualizations instead of detailed loan-level data.

---

## 3. Core Technology Stack
- **Frontend**: React + Vite (TypeScript)
- **Backend**: Node.js + Express (TypeScript)
- **Database**: PostgreSQL
- **Deployment**: Render.com (split frontend/backend)
- **Repo**: [GitHub - loanvision](https://github.com/mbzesq/loanvision)

---

## 4. Current System Capabilities

### ✅ Upload Engine (CSV + XLSX)
- Supports file uploads for:
  - Daily Portfolio Metrics
  - Foreclosure Events
- Dynamically detects column headers
- Accepts `.csv` and `.xlsx` formats

### ✅ Database Support for Current + History Tables
- **daily_metrics_current**: Latest view per loan
- **daily_metrics_history**: Full audit trail by `loan_id + report_date`
- **foreclosure_events**: Current foreclosure status (one active per loan)
- **foreclosure_events_history**: Tracks all filings, including multiple foreclosure cycles
- **Automatic handling of historical preservation and active-state logic**

### ✅ User Authentication System
- Supports user registration and login with secure password hashing (bcrypt)
- Implements token-based authentication using JSON Web Tokens (JWT)
- Includes foundational support for role-based access control (`super_user`, `admin`, `manager`, `user`)
- All data-fetching routes are now protected

### ✅ Foreclosure Upload Enhancements
The application is in a mostly stable state, but with a key new feature failing.

Functional Data Pipeline: The backend data ingestion engine is now working correctly. Uploaded daily_metrics and foreclosure_events files are successfully processed and stored in the appropriate database tables.

Functional Loan Explorer: The main explorer page correctly fetches and displays loan data from the daily_metrics_current table. The filter panel is working.

Functional Loan Detail Modal (Core Data): The custom-built modal successfully launches and displays the main loan, borrower, property, and financial data.

### ✅ Foreclosure Timeline UX
- The detailed timeline view in the `LoanDetailModal` now displays color-coded status icons (On Time, Late, Overdue) for each milestone

### ✅ Backend Infrastructure
- Corrected `fcl_milestones_by_state.json` path resolution
- Dynamic ingestion logic with robust logging
- Upload responses include insert/skipped/error counts and `report_date`

---

## 5. Evergreen Guardrails for AI (Claude)

### 🛡️ Stability First
- Never break working features; always preserve Loan Explorer, Upload, and Dashboard stability

### 🧠 Claude is Not All-Knowing
- Must use explicitly shared schemas and sample data
- Cannot infer structure from uploads—require clear mapping

### 🧪 Nothing Is Trusted Until Verified
- All changes must be tested via Upload
- Deployment must follow validation in dev or local

### 🧱 Clear & Modular Design
- Code must be testable and organized
- Favor named helpers and TS interfaces

### 🧭 Project State Must Be Current
- Always begin with updated `claude.md`
- Time-stamp major changes (e.g. `v2025-06-20D`)

### 🧰 Build for the Future
- Plan for FTP automation, servicer-specific templates, and dashboard analytics
- Implement config toggles or placeholders for planned features

---

## 6. Most Recent Milestone and Last Session Summary (2025-06-20D)
- ✅ Fully implemented ingestion for **daily_metrics** and **foreclosure_events** (with history support)
- ✅ Backend now accepts `.xlsx` uploads and dynamically matches headers
- ✅ All database migrations applied and validated
- ✅ Logic supports **multiple foreclosures per loan**, correctly identifies active foreclosure, and preserves historical activity
- After a major debugging effort, we successfully diagnosed and fixed the root cause of the data ingestion failure by removing legacy code from the backend fileTypeDetector. The Loan Explorer page is now correctly populating. However, the subsequent attempt to implement the UI for the foreclosure timeline feature in the LoanDetailModal has failed.

---

## 7. Next Steps
- **Remove Hardcoded Super User Credentials.** This is the highest priority security task. The automated seeding function contains hardcoded credentials that must be removed after confirming the super user account is accessible.
- **Enhance Timeline Status Logic.** Improve the timeline status filter to use more sophisticated milestone evaluation logic for better accuracy.

---

## 8. Medium-Term Roadmap

| Phase | Description |
|-------|-------------|
| Now   | Visualize daily metrics & foreclosure data |
| Next  | Report generation, rent valuation API, servicer dashboards |
| Later | AI assistant, predictive analytics, automated triggers |
