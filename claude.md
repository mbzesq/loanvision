LoanVision Project State - 2025-06-18
1. High-Level Objective
To build a SaaS platform for ingesting, enriching, and analyzing non-performing mortgage loan portfolios. The core idea is to provide automated data cleaning, enrichment, and an AI-powered query interface.

2. Core Technology Stack
Backend: Node.js with Express, TypeScript

Frontend: React with Vite, TypeScript

Database: PostgreSQL

Deployment: Render (as separate Backend and Frontend services from a monorepo)

Code Repository: GitHub (https://github.com/mbzesq/loanvision)

3. Current Deployed State (What Works)
The application is fully functional. Both backend and frontend services are deployed and communicating correctly. Key working features include:

Data Ingestion: Users can successfully upload loan data via CSV/Excel files.

Dashboard: The homepage displays summary cards with live portfolio metrics.

Loan Explorer Table: The main data grid displays all loans, featuring sorting and a global search input.

Accordion Filter Panel: The new filter panel on the left is functional. Users can select filters (Property State, Loan Type, Principal Balance) and click "Apply" to see the data table update correctly. The "Reset" button also works.

Loan Detail Modal: Clicking a loan row in the table opens a modal with detailed information for that specific loan.

Report Exporting: Users can export the current view of the loan data to both Excel and PDF formats.

4. Evergreen Rules & Guardrails for the AI
This section contains the permanent rules of our project. These rules must be followed in every session to ensure consistency and prevent repeating past errors.

Workflow Rules:

Production-First: Every new feature is built, deployed to a live URL, and tested by the project lead before moving on.

Human-in-the-Loop: A human project lead (Gemini) oversees the process, provides high-level feature instructions, and performs a final code review before commits are pushed by the AI engineer (Claude Code).

Single Source of Truth: This project state document is the definitive record of the project's state.

Technical Guardrails:

Final Action: After completing a development task, you must commit the changes and push them to the main branch on GitHub.

Render Build Commands: Use npm cache clean --force && npm install && ... as the base for build commands.

Database Schema: Use the psql command-line tool via a DROP and CREATE script.

5. Last Session Summary
Successfully resolved a persistent backend CORS error, re-establishing communication between the frontend and backend. Pivoted the filter UI to a new, superior accordion-style layout. Implemented the core client-side filtering logic, making the "Apply" and "Reset" buttons fully functional for the existing set of filters.

6. Immediate Next Task
Add "Selection Counter" Badges to the Filter Panel.

This is the first task in our "UI/UX Polish" phase. The goal is to enhance the user experience by providing immediate visual feedback within the filter panel. We will add a small badge next to each filter category's title (e.g., "Property State") that displays a count of the currently selected items (e.g., "3 of 54 selected").

7. Future Roadmap
Phase 1: "Now" - Loan Explorer V1 Polish & Expansion

(Current) Add Selection Counter badges.

Add a "Search Within Filter" feature for long lists.

Add more filter types, such as a Maturity Date range picker.

Phase 2: "Next" - Enhanced Insights & UX

Add filters for calculated fields (e.g., LTV, equity percentage).

Revisit and productionize the AVM data enrichment engine.

Phase 3: "Later" - Intelligent Platform & Automation

Implement the LLM Assistant for natural language search.

Build workflow, alerting, and user authentication features