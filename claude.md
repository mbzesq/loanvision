LoanVision Project State - 2025-06-20
1. High-Level Objective
To build a SaaS platform for ingesting, enriching, and analyzing non-performing mortgage loan portfolios. The core idea is to provide automated data cleaning, enrichment, and an AI-powered query interface.

2. Core User Personas
Alex the Active Manager: The primary persona for our current development phase. Alex is a hands-on loan analyst or portfolio manager whose daily job is to monitor portfolio health, identify risk, and manage individual assets. They need powerful, granular filtering tools and at-a-glance data to make quick, informed decisions.

Sarah the Passive Investor: A future persona. Sarah is a capital partner or stakeholder who needs high-level, easily digestible reports and visualizations to track the overall performance of their investment without getting into the day-to-day operational details.

3. Core Technology Stack
Backend: Node.js with Express, TypeScript

Frontend: React with Vite, TypeScript

Database: PostgreSQL

Deployment: Render (as separate Backend and Frontend services from a monorepo)

Code Repository: GitHub (https://github.com/mbzesq/loanvision)

4. Current Deployed State (What Works)
The application backend is functional, but the frontend is in a visually broken state due to a failed layout refactor.

Functional Backend & API: All backend services are working correctly.

Broken LoanExplorerPage: The main data exploration page has significant layout regressions. The filter action buttons ("Apply", "Reset") are missing, and the main content area is misaligned on the page. Other pages like the Dashboard and Upload page are likely still functional.

5. Evergreen Rules & Guardrails for the AI
This section remains unchanged.

6. Last Session Summary
Attempted a major aesthetic refactor of the LoanExplorerPage layout. This refactor failed, resulting in a significant visual regression. The key filter action buttons disappeared from the FilterPanel, and the main content area's alignment was broken, pushing it down the page.

7. Immediate Next Task
Fix the Layout Regression on LoanExplorerPage.

This is the top priority. The goal is to restore the page to a correct and professional layout. This requires two main fixes:

Restore the "Apply," "Reset," and "Clear" buttons to their correct position within the FilterPanel, directly below the header.

Correct the main page container's styling to fix the alignment issue that is pushing the content grid down the page.

8. Future Roadmap
Phase 1: "Now" - Complete the Aesthetic Overhaul

(Current) Fix the critical layout regression.

Complete the professional styling of the Data Table and FilterPanel.

Add a "Search Within Filter" feature for long lists.

Add more filter types, such as a proper Maturity Date range picker.

Phase 2: "Next" - High-Value Features & Reporting

Implement the RentCast API integration for property value enrichment.

Build "soft delete" functionality for loans.

Begin building the "Reports" page with pre-canned charts and summaries.

Phase 3: "Later" - Decision Engine & Automation

Implement Risk Assessment Rulesets, Workout Path Recommendations, and Financial Outcome Modeling.

Implement the LLM Assistant for natural language search.
