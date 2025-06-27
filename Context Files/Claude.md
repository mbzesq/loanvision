# NPLVision Project State – Claude.md

_Last updated: 2025-06-27_

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
- **Repo**: [GitHub - nplvision](https://github.com/mbzesq/nplvision)

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

### ✅ UI/UX Enhancements & Professional Branding (2025-06-27)
- **Modern User Profile System**: Relocated user profile from sidebar to professional header dropdown
- **NPLVision Logo Integration**: Custom SVG logo component replacing text branding throughout application
- **Responsive Design**: Seamless user profile functionality across desktop and mobile layouts
- **Consistent Branding**: Complete rebrand from "LoanVision" to "NPLVision" across all user-facing text
- **Professional Styling**: UserCircle icons, hover states, red-styled logout button, and proper visual hierarchy
- **Build Stability**: Resolved TypeScript import issues and deployment failures

### ✅ Foreclosure Timeline Intelligence
- The detailed timeline view in the `LoanDetailModal` now displays color-coded status icons (On Time, Late, Overdue) for each milestone
- The Loan Explorer features a fully functional "Foreclosure Timeline Status" filter to find "On Track" or "Overdue" loans based on a cumulative variance calculation

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
- Time-stamp major changes (e.g. `v2025-06-27D`)

### 🧰 Build for the Future
- Plan for FTP automation, servicer-specific templates, and dashboard analytics
- Implement config toggles or placeholders for planned features

---

## 6. Most Recent Milestone and Last Session Summary (2025-06-27)
### UI/UX Enhancement Sprint - COMPLETED ✅
This session successfully modernized the user interface and established consistent NPLVision branding.

**Major Accomplishments:**
- ✅ **UserProfile Component**: Created polished dropdown with shadcn/ui integration
- ✅ **Header Layout**: Relocated user profile to conventional header position
- ✅ **Logo Integration**: Designed and implemented custom NPLVision SVG logo
- ✅ **Responsive Design**: Ensured seamless functionality on desktop and mobile
- ✅ **Branding Consistency**: Updated all text from "LoanVision" to "NPLVision"
- ✅ **Professional Styling**: Added proper icons, hover states, and visual hierarchy

**Previous Achievements (2025-06-26):**
- ✅ Implemented complete **User Authentication System** with registration, login, JWT tokens, and role-based access control
- ✅ Successfully fixed the **Foreclosure Timeline Status filter** with sophisticated cumulative variance calculation
- ✅ Centralized timeline logic in shared utility (`timelineUtils.ts`)

---

## 7. Next Steps
### Immediate Priorities:
1. **Monitor Deployment**: Ensure all UI/UX changes are successfully deployed and functional
2. **User Testing**: Validate new user profile dropdown across different browsers and devices

### Future Development:
- **Dashboard Analytics**: Begin implementing portfolio analytics and reporting features
- **Advanced Filtering**: Enhance loan explorer with more sophisticated search capabilities
- **Performance Optimization**: Monitor and optimize application performance as data grows

---

## 8. Medium-Term Roadmap

| Phase | Description |
|-------|-------------|
| ✅ Completed | UI/UX modernization, user authentication, NPLVision branding |
| Now   | Dashboard analytics, portfolio visualization, advanced reporting |
| Next  | Report generation, rent valuation API, servicer dashboards |
| Later | AI assistant, predictive analytics, automated triggers |