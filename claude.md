# LoanVision Project State - 2025-06-18

## 1. High-Level Objective
To build a SaaS platform for ingesting, enriching, and analyzing non-performing mortgage loan portfolios. The core idea is to provide automated data cleaning, enrichment, and an AI-powered query interface.

## 2. Core Technology Stack
- Backend: Node.js with Express, TypeScript

- Frontend: React with Vite, TypeScript

- Database: PostgreSQL

- Deployment: Render (as separate Backend and Frontend services from a monorepo)

- Code Repository: GitHub (https://github.com/mbzesq/loanvision)

## 3. Current Deployed State (What Works)
- The application is successfully deployed on Render and the following features are confirmed to be working on the live URLs:

- Robust Data Ingestion: The POST /api/upload endpoint successfully parses real-world CSV/Excel files, handling data cleaning and saving records to the database.

- Core Data Endpoints: The backend provides working endpoints to get all loans (/api/loans) and a single loan by its servicer ID (/api/loans/:loanId).

- Interactive Loan Explorer: The /loans page successfully fetches and displays all loans in a powerful data grid powered by TanStack Table, featuring client-side sorting and global text filtering.

- Loan Detail Modal: Clicking any loan row in the explorer opens a modal dialog that fetches and displays the complete data for that specific loan.

- V1 Dashboard: The homepage (/) displays live portfolio summary cards for Total UPB, Loan Count, and Average Balance, with working links to other pages.

- Report Exporting: The "Download as Excel" and "Download as PDF" features work correctly from the Loan Explorer.

## 4. Evergreen Rules & Guardrails for the AI
This section contains the permanent rules of our project. These rules must be followed in every session to ensure consistency and prevent repeating past errors.

**Workflow Rules:**

- Production-First: Every new feature is built, deployed to a live URL, and tested by the project lead before moving on. We do not batch features locally.

- Human-in-the-Loop: A human project lead (Gemini) oversees the process, provides high-level feature instructions, and performs a final code review before commits are pushed by the AI engineer (Claude Code).

- Single Source of Truth: This project state document is the definitive record of the project's state.

**Technical Guardrails:**

- **Final Action:** After completing a development task, you must commit the changes and push them to the main branch on GitHub.

- **Render Backend (loanvision-backend):**

  - Root Directory: Must be blank.

  - Build Command: npm install && npm run build --workspace=@loanvision/shared && npm run build --workspace=@loanvision/backend

  - Start Command: npm start --workspace=@loanvision/backend

- **Render Frontend (loanvision-frontend):**

  - Root Directory: Must be blank.

  - Build Command: npm install && npm run build --workspace=@loanvision/shared && npm run build --workspace=@loanvision/frontend

  - Publish Directory: src/frontend/dist

  - Rewrite Rule: A rewrite rule for /* to /index.html is required for client-side routing.

- **Database Schema:** All schema changes must be performed using the psql command-line tool. All schema changes must be done via a complete DROP and CREATE script to ensure a clean state.

## 5. Last Session Summary
Attempted to implement the initial UI shell for the new FilterPanel component using shadcn/ui components. This action introduced new dependencies and configurations which have resulted in a frontend build failure in the deployment environment. The initial failure was a PostCSS/Tailwind configuration issue, which was fixed, only to reveal a subsequent module resolution error.

## 6. Immediate Next Task
- Fix the Frontend Build Path Resolution Error.

- The deployment is currently failing with a Vite/Rollup error: Rollup failed to resolve import "@loanvision/shared/components/ui/card" from "/opt/render/project/src/src/frontend/src/components/FilterPanel.tsx".

- This indicates the frontend application cannot locate the shadcn/ui components that were installed in the @loanvision/shared workspace. The immediate task is to fix this by adding a path alias to the src/frontend/vite.config.ts file, enabling the build process to correctly resolve imports from the shared directory.

## 7. Future Roadmap
**Phase 1: "Now" - Implement Loan Explorer V1 Filters**

- (Currently Blocked by Build Error)

- Build the FilterPanel UI shell using shadcn/ui.

- Implement state management within the FilterPanel component.

- Connect the FilterPanel state to the LoanExplorerPage to perform real-time data filtering on the TanStack Table.

- Ensure report exporting respects all active filters.

**Phase 2: "Next" - Enhanced Insights & UX**

- Calculated & Derived Insights: Enhance the frontend and backend to filter on calculated fields (e.g., "loans with less than 50% equity").

- UI/UX Polish: Continue integrating shadcn/ui to create a polished and consistent design system.

- Data Enrichment Engine: Revisit and productionize the AVM enrichment feature.

- Smart Search V1: Introduce a keyword-based search bar as a precursor to full natural language search.

**Phase 3: "Later" - Intelligent Platform & Automation**

- LLM Assistant (True Natural Language Search): Integrate with an LLM API for conversational portfolio queries.

- Workflow & Action Management: Build features for assigning tasks, leaving notes, and tracking loan workout status.

- Strategic Recommendations & Alerts: Create a system to proactively flag loans and alert users to critical events.

- User Authentication: Implement a full user login/logout system.
