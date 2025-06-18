# LoanVision Project State - 2025-06-17 #

## 1. High-Level Objective ##

To build a SaaS platform for ingesting, enriching, and analyzing non-performing mortgage loan portfolios. The core idea is to provide automated data cleaning, enrichment, and an AI-powered query interface##

## 2. Core Technology Stack

- Backend: Node.js with Express, TypeScript

- Frontend: React with Vite, TypeScript

- Database: PostgreSQL

- Deployment: Render (as separate Backend and Frontend services from a monorepo)

- Code Repository: GitHub (https://github.com/mbzesq/loanvision)

## 3. Current Deployed State (What Works)

The application is successfully deployed on Render and the following features are confirmed to be working on the live URLs:

- Robust Data Ingestion: The POST /api/upload endpoint successfully parses real-world CSV/Excel files, handling data cleaning and saving records to the database.

- Core Data Endpoints: The backend provides working endpoints to get all loans (/api/loans) and a single loan by its servicer ID (/api/loans/:loanId).

- Interactive Loan Explorer: The /loans page successfully fetches and displays all loans in a powerful data grid powered by TanStack Table, featuring client-side sorting and global text filtering.

- Loan Detail Modal: Clicking any loan row in the explorer opens a modal dialog that fetches and displays the complete data for that specific loan.

- V1 Dashboard: The homepage (/) displays live portfolio summary cards for Total UPB, Loan Count, and Average Balance, with working links to other pages.

- Excel Export: The "Download as Excel" feature works correctly from the Loan Explorer, respecting any active filters.

## 4. Evergreen Rules & Guardrails for the AI

This section contains the permanent rules of our project. These rules must be followed in every session to ensure consistency and prevent repeating past errors.

**Workflow Rules:**

- Production-First: Every new feature is built, deployed to a live URL, and tested by the project lead before moving on. We do not batch features locally.

- Human-in-the-Loop: A human project lead (Gemini) oversees the process, provides high-level feature instructions, and performs a final code review before commits are pushed by the AI engineer (Claude Code).

- Single Source of Truth: This claude.md document is the definitive record of the project's state.

**Technical Guardrails:**

- Final Action: After completing a development task, you must commit the changes and push them to the main branch on GitHub.

- Render Backend (loanvision-backend):

  - Root Directory: Must be blank.

  - Build Command: npm install && npm run build --workspace=@loanvision/shared && npm run build --workspace=@loanvision/backend

  - Start Command: npm start --workspace=@loanvision/backend

- Render Frontend (loanvision-frontend):

  - Root Directory: Must be blank.

  - Build Command: npm install && npm run build --workspace=@loanvision/shared && npm run build --workspace=@loanvision/frontend

  - Publish Directory: src/frontend/dist

  - Rewrite Rule: A rewrite rule for /* to /index.html is required for client-side routing.

**Database Schema:** All schema changes must be performed using the psql command-line tool, as graphical clients (pgAdmin, DBeaver) have proven unreliable on the local machine. All schema changes must be done via a complete DROP and CREATE script to ensure a clean state.

## 5. Last Session Summary

- Successfully debugged and fixed the entire data ingestion pipeline, adding robust handling for real-world Excel/CSV data, including currency, percentage, and Excel's serial number date formats.

- Implemented and deployed the interactive Loan Explorer table, the Loan Detail Modal, and the Dashboard V1.

- Implemented and verified the "Export to Excel" feature.

- Diagnosed that the "Export to PDF" feature is failing with a Could not find Chrome error on the Render server.

## 6. Immediate Next Task

- To fix the PDF export feature.

- The plan is to refactor the backend to stop using the default puppeteer package and instead use the combination of puppeteer-core and @sparticuz/chromium, which is designed for serverless/cloud environments. This will involve updating dependencies and changing the puppeteer.launch() configuration in src/backend/src/routes/reports.ts.

## 7. Future Roadmap

This section outlines the next major features to be built after the immediate task is complete.

- Data Enrichment Engine: Revisit and fix the postponed automatic AVM enrichment feature.

- LLM Assistant V1: Integrate with an LLM API and build the chat interface to allow natural language queries about the portfolio.

- UI/UX Polish: Begin integrating a professional component library (e.g., ShadCN/UI) and applying consistent Tailwind CSS styling to align with final designs.

- User Authentication: Add a full user login/logout system to make the platform secure and multi-tenant.
