LoanVision Project State - 2025-06-20B

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
- Functional Backend & API: All backend services are working correctly.
- LoanExplorerPage Visual & Functional Enhancements:
  - Filter panel layout and spacing has been corrected.
  - "Apply", "Reset", and "Clear" buttons are correctly aligned.
  - Search bar includes a working "X" button to clear search input.
  - Content layout issues and vertical spacing bugs resolved.
- Upload Feature: Updated to ingest and map both Daily Portfolio Metrics and Foreclosure data files.
- We are currently testing the enhanced file upload functionality to validate that new foreclosure-related data points are correctly parsed and stored.

5. Evergreen Rules & Guardrails for the AI

🛡️ A. Stability is Paramount
- Never break existing functionality. All new code must be additive, isolated, or backward-compatible.
- If a change could affect deployed pages (especially Upload, Loan Explorer, Dashboard), call it out explicitly.
- When uncertain, create new components/functions alongside existing ones and test before replacing.

🧠 B. The AI is Not Omniscient
- Claude Code cannot access uploaded files or spreadsheets. All file-related logic must be implemented via:
  - Explicit column names and definitions provided in prompts.
  - Parsing and mapping logic handled via the upload engine.
- Do not assume Claude “knows” the content of prior uploads unless explicitly shared via prompt.

🧪 C. Nothing Is Trusted Until Tested
- All data pipeline changes (upload parsing, ingestion, DB writes) must be tested with a real file using the Upload feature.
- No change is considered complete until the data is successfully displayed in the app or stored in the DB.
- Deployment to Render must follow successful local or dev environment testing if possible.

🧱 D. Prefer Clear Prompts & Modular Code
- Break large prompts into smaller, testable pieces where possible.
- Avoid monolithic logic. Use helper functions, modular React components, and clearly named database models.
- Use TypeScript types and interfaces whenever new data types are introduced.

🧭 E. Versioning and Project State Matter
- Always begin each coding session with an up-to-date `LoanVision Project State` document.
- Significant milestones should be time-stamped and optionally versioned (`v2025-06-20B`, etc.).
- Key architectural or structural changes should be reflected in a changelog or the `project_state.md`.

🧰 F. Build for the Road Ahead
- Code should assume future data delivery via daily FTP ingestion, but rely on manual upload for now.
- Use config flags or stubs where needed to allow for easy extension in future phases (e.g., multiple investors, dashboards by servicer, etc.).
- Do not over-engineer now, but design with extensibility in mind.

⚙️ G. Claude Code Roles & Limits
- Claude Code is the primary implementation engine, not the architect.
- ChatGPT is the product and engineering lead, and must review all architectural decisions, error debugging, or unresolved logic questions before Claude proceeds.
- Claude must follow instructions strictly and escalate ambiguity to Michael or ChatGPT for clarification.

6. Last Session Summary
- Completed visual and functional enhancements to the Loan Explorer page.
- Successfully deployed layout fixes and quality-of-life improvements such as the clearable search input.
- Integrated `fcl-timelines-costs.xlsx` into the project to support foreclosure step ordering.
- Began testing new ingestion of foreclosure and daily metrics files via the Upload page.

7. Immediate Next Task
- Create `foreclosure_events` table in the database to resolve ingestion failure.
- Successfully complete ingestion of foreclosure data using the updated file upload pipeline.
- Begin surfacing foreclosure indicators in the Loan Explorer and Dashboard views.

8. Future Roadmap
Phase 1: "Now" - Complete Upload Testing and LoanExplorer Enhancements
- Finalize file ingestion logic and error handling.
- Display foreclosure status and latest legal step in Loan Explorer.

Phase 2: "Next" - High-Value Features & Reporting
- Build foreclosure analytics into the Dashboard (e.g., # of loans by FC step).
- Begin building the "Reports" page with pre-canned charts and summaries.

Phase 3: "Later" - Decision Engine & Automation
- Implement Risk Assessment Rulesets, Workout Path Recommendations, and Financial Outcome Modeling.
- Implement the LLM Assistant for natural language search.
