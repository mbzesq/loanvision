LoanVision Project State - 2025-06-19
1. High-Level Objective
To build a SaaS platform for ingesting, enriching, and analyzing non-performing mortgage loan portfolios. The core idea is to provide automated data cleaning, enrichment, and an AI-powered query interface.

2. Core Technology Stack
Backend: Node.js with Express, TypeScript

Frontend: React with Vite, TypeScript

Database: PostgreSQL

Deployment: Render (as separate Backend and Frontend services from a monorepo)

Code Repository: GitHub (https://github.com/mbzesq/loanvision)

3. Current Deployed State (What Works)
The application is fully functional, with a stable UI and several key features implemented and verified:

Data Ingestion: Successful uploads via CSV/Excel.

Functional API: All backend endpoints, including the single loan detail endpoint, are working correctly with a proper CORS policy.

Loan Explorer Page:

Accordion Filter Panel: A fully functional filter panel allows users to filter by Property State, Asset Status, Investor, Lien Position, and Principal Balance. The "Apply" and "Reset" buttons work as expected.

Data Toolbar: A clean header provides a loan count summary, a global search input, and action buttons.

Interactive Data Table: The main table correctly displays and sorts loan data.

Custom Loan Detail Modal: After abandoning a problematic library component, we have a fully functional, custom-built modal that includes:

A clean, multi-section layout for improved readability.

Correct data formatting for currency and percentages.

A clickable link to Zillow for the property address.

A clickable (stubbed) link for the investor name.

"Click outside" and "Escape key" to close functionality.

Report Exporting: The "Export" button is fully functional, allowing users to download data in PDF and Excel formats.

4. Evergreen Rules & Guardrails for the AI
This section remains unchanged.

5. Last Session Summary
After a series of persistent and frustrating bugs with library components (DropdownMenu, Dialog), we successfully pivoted to a new strategy: building our own custom components. This was a major breakthrough. We successfully diagnosed and fixed a critical backend API bug. The session culminated in the successful deployment of a fully-functional, custom-built LoanDetailModal that incorporates numerous UI/UX improvements and bug fixes, aligning with our new professional aesthetic.

6. Immediate Next Task
Refactor the Data Table for Professional Aesthetic.

This is the next step in our "UI/UX Polish" phase. To continue aligning the platform with our "Schwab-inspired" design, we will refactor the main TanStack Table. The goal is to make it more data-dense and professional-looking by implementing:

Zebra-striping for table rows to improve readability.

More compact row spacing.

Subtle row hover effects.

Improved styling for the table headers.

7. Future Roadmap
Phase 1: "Now" - Complete the Aesthetic Overhaul

(Current) Refactor the Data Table for a professional aesthetic.

Add a "Search Within Filter" feature for long lists.

Add more filter types, such as a proper Maturity Date range picker.

Phase 2: "Next" - High-Value Features

Implement the RentCast API integration for property value enrichment.

Build "soft delete" functionality for loans.

Begin building the "Reports" page with pre-canned charts and summaries.

Phase 3: "Later" - Intelligent Platform & Automation

Implement the LLM Assistant for natural language search.

Build workflow, alerting, and user authentication features.
