# NPLVision Project State – Claude.md

_Last updated: 2025-06-27D_

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

### ✅ UI/UX Enhancements & Branding (2025-06-27D)
The application now features a polished, professional user interface with consistent NPLVision branding.

**Completed Features:**
- **Relocated User Profile Menu**: Moved from sidebar bottom to header dropdown with professional styling
- **NPL Logo Integration**: Custom SVG logo component replacing text branding throughout the application
- **Responsive Design**: User profile dropdown works seamlessly on both desktop and mobile layouts
- **Consistent Branding**: Updated all text references from "LoanVision" to "NPLVision" across login and registration pages
- **Enhanced UX**: Added UserCircle icon, hover states, and red-styled logout button for better visual affordance

**Core Application Status:**
- ✅ **Functional Data Pipeline**: Backend data ingestion working correctly for daily_metrics and foreclosure_events
- ✅ **Functional Loan Explorer**: Main explorer page displays loan data with working filter panel
- ✅ **Functional Authentication**: Login, registration, and user profile management working properly
- ✅ **Functional Upload System**: File upload and processing capabilities operational

**Known Issue (Lower Priority):**
- ⚠️ **Foreclosure Timeline**: Modal timeline section may need attention (not critical for current operations)

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

## 6. Most Recent Milestone and Last Session Summary (2025-06-27D)
### UI/UX Enhancement Sprint - COMPLETED ✅
This session focused on modernizing the user interface and establishing consistent NPLVision branding across the application.

**Major Accomplishments:**
- ✅ **UserProfile Component**: Created polished dropdown component with shadcn/ui integration
- ✅ **Header Layout**: Relocated user profile from sidebar to conventional header position
- ✅ **Logo Integration**: Designed and implemented custom NPLVision SVG logo component
- ✅ **Responsive Design**: Ensured user profile works seamlessly on desktop and mobile
- ✅ **Branding Consistency**: Updated all text from "LoanVision" to "NPLVision"
- ✅ **Build Fixes**: Resolved TypeScript import issues and deployment failures
- ✅ **Professional Styling**: Added proper icons, hover states, and visual hierarchy

**Technical Implementation:**
- Created `UserProfile.tsx` with DropdownMenu, DropdownMenuLabel, DropdownMenuSeparator components
- Modified `MainLayout.tsx` to include header with UserProfile component
- Updated `MobileHeader.tsx` for responsive design
- Streamlined `SideNav.tsx` by removing redundant user profile section
- Created reusable `Logo.tsx` SVG component with consistent styling
- Updated `LoginPage.tsx` and `RegisterPage.tsx` with correct branding

**Previous Session Context (2025-06-20D):**
- ✅ Fully implemented ingestion for **daily_metrics** and **foreclosure_events** (with history support)
- ✅ Backend now accepts `.xlsx` uploads and dynamically matches headers
- ✅ All database migrations applied and validated
- ✅ Logic supports **multiple foreclosures per loan**, correctly identifies active foreclosure, and preserves historical activity

---

## 7. Next Steps
### Immediate Priorities:
1. **Monitor Deployment**: Ensure all UI/UX changes are successfully deployed and functional
2. **User Testing**: Validate that the new user profile dropdown works across different browsers and devices

### Future Development:
- **Foreclosure Timeline Enhancement**: Address timeline modal functionality when needed
- **Dashboard Analytics**: Begin implementing portfolio analytics and reporting features
- **Advanced Filtering**: Enhance loan explorer with more sophisticated search capabilities

---

## 8. Medium-Term Roadmap

| Phase | Description |
|-------|-------------|
| ✅ Completed | UI/UX modernization, user profile system, NPLVision branding |
| Now   | Dashboard analytics, portfolio visualization, advanced reporting |
| Next  | Report generation, rent valuation API, servicer dashboards |
| Later | AI assistant, predictive analytics, automated triggers |
