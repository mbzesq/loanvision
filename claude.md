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

6. Last Milestone Summary
We successfully:

Built and deployed full support for daily_metrics and foreclosure uploads with current/history table structure.

Migrated SQL changes to Render DB via psql.

Enhanced upload logging, status tracking, and reporting.

7. Immediate Next Tasks
✅ Test uploads of real data (completed).

🔲 Wire daily_metrics_current and/or foreclosure_events data into Loan Explorer and Dashboard.

🔲 Determine visual display strategy for historical trends (e.g., delinquency over time, foreclosure pipeline velocity).

8. Roadmap Highlights
Now: Visual integration of newly uploaded data (Loan Explorer, Loan Detail, Dashboard).

Next: Summary reports, RentCast API enrichment, decision support tooling.

Later: LLM Assistant, automation, predictive analytics.
