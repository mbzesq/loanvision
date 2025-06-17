# LoanVision Project State - 2025-06-17

## 1. High-Level Objective
To build a SaaS platform for ingesting, enriching, and analyzing non-performing mortgage loan portfolios. The core idea is to provide automated data cleaning, enrichment, and an AI-powered query interface.

## 2. Core Technology Stack
- **Backend:** Node.js with Express, TypeScript
- **Frontend:** React with Vite, TypeScript
- **Database:** PostgreSQL
- **Deployment:** Render (as separate Backend and Frontend services from a monorepo)
- **Code Repository:** GitHub (https://github.com/mbzesq/loanvision)

## 3. Current Deployed State (What Works)
The application is successfully deployed on Render and the following features are confirmed to be working on the live URLs:

- **Robust Data Ingestion:** The `POST /api/upload` endpoint successfully parses real-world CSV/Excel files. It correctly handles complex data cleaning for currency (removing $, ,), percentages (converting to decimal), and various date formats (including Excel serial numbers).
- **Core Data Endpoints:** The backend provides working endpoints to get all loans (`/api/loans`) and a single loan by its servicer ID (`/api/loans/:loanId`).
- **Interactive Loan Explorer:** The `/loans` page successfully fetches and displays all loans in a powerful data grid powered by TanStack Table, featuring client-side sorting and global text filtering.
- **Loan Detail Modal:** Clicking any loan row in the explorer opens a modal dialog that fetches and displays the complete data for that specific loan.
- **V1 Dashboard:** The homepage (`/`) displays live portfolio summary cards for Total UPB, Loan Count, and Average Balance, with working links to other pages.
- **Excel Export:** The "Download as Excel" feature works correctly from the Loan Explorer, respecting any active filters.

## 4. Key Architectural Decisions (Our Workflow)
- **Production-First:** Every new feature is built, deployed to a live URL, and tested by the project lead before moving to the next.
- **Monorepo Structure:** The project uses npm workspaces for backend, frontend, and shared packages to ensure code organization and type safety.
- **Human-in-the-Loop:** A human project lead (Gemini) oversees the process, provides high-level feature instructions, and performs a final code review before commits are pushed by the AI engineer (Claude Code). This is our primary method for preventing deployment failures.

## 5. Critical Configurations (Guardrails for the AI)
These settings were discovered through extensive debugging and must be respected:

**Render Backend (loanvision-backend):**
- Root Directory: Must be blank.
- Build Command: `npm install && npm run build --workspace=@loanvision/shared && npm run build --workspace=@loanvision/backend`
- Start Command: `npm start --workspace=@loanvision/backend`

**Render Frontend (loanvision-frontend):**
- Root Directory: Must be blank.
- Build Command: `npm install && npm run build --workspace=@loanvision/shared && npm run build --workspace=@loanvision/frontend`
- Publish Directory: `src/frontend/dist`
- Rewrite Rule: Source: `/*, Destination: /index.html` must be in place for client-side routing.

**Database Schema:** All schema changes must be performed using the psql command-line tool, as graphical clients have proven unreliable. The final `database_reset_complete.sql` script is the source of truth for the schema.

## 6. Last Session Summary
In this session, we successfully implemented several major features that significantly enhanced the LoanVision platform:

We first disabled the broken enrichment job to prioritize UI interactivity, then upgraded the Loan Explorer with TanStack Table to provide powerful sorting and real-time global filtering capabilities. This transformed the static table into a fully interactive data grid.

We then implemented the V1 Dashboard feature with a new `/api/portfolio/summary` endpoint that calculates key portfolio statistics (loan count, total UPB, average balance) and displays them in professional summary cards on the homepage. We also fixed a critical routing bug by replacing `<a>` tags with React Router's `<Link>` components to enable proper client-side navigation.

Finally, we implemented the comprehensive reporting feature with both PDF and Excel export functionality. This included creating a new `/api/reports/pdf` and `/api/reports/excel` endpoints with intelligent filtering capabilities that respect the user's current search terms. On the frontend, we added a polished Export dropdown button to the Loan Explorer that allows users to download their filtered data in either format. The Excel export is fully functional, while the PDF export has been implemented but may require serverless-compatible adjustments for production deployment.

## 7. Immediate Next Task
The next priority is to fix the PDF export feature, which is likely to fail in the Render production environment due to Chrome/Chromium dependencies.

The plan is to refactor the backend to stop using the default `puppeteer` package and instead use the combination of `puppeteer-core` and `@sparticuz/chromium`, which is designed for serverless/cloud environments. This will involve updating dependencies and changing the `puppeteer.launch()` configuration in `src/backend/src/routes/reports.ts` to use the serverless-compatible Chromium binary.