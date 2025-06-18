### **LoanVision Project State - 2025-06-18**

#### **1. High-Level Objective**

To build a SaaS platform for ingesting, enriching, and analyzing non-performing mortgage loan portfolios. The core idea is to provide automated data cleaning, enrichment, and an AI-powered query interface.

#### **2. Core Technology Stack**

* **Backend:** Node.js with Express, TypeScript
* **Frontend:** React with Vite, TypeScript
* **Database:** PostgreSQL
* **Deployment:** Render (as separate Backend and Frontend services from a monorepo)
* **Code Repository:** GitHub (https://github.com/mbzesq/loanvision)

#### **3. Current Deployed State (What Works)**

The application is successfully deployed on Render, but the frontend's Loan Explorer page is currently non-functional due to a build failure in the latest deployment attempt. The last known working state included:
* Robust Data Ingestion and Core Data Endpoints.
* An interactive Loan Explorer table (currently broken).
* A functional V1 Dashboard and working report exports.

#### **4. Evergreen Rules & Guardrails for the AI**

This section contains the permanent rules of our project. These rules must be followed in every session to ensure consistency and prevent repeating past errors.
* **Workflow Rules:**
    * **Production-First:** Every new feature is built, deployed to a live URL, and tested by the project lead before moving on.
    * **Human-in-the-Loop:** A human project lead (Gemini) oversees the process, provides high-level feature instructions, and performs a final code review before commits are pushed by the AI engineer (Claude Code).
    * **Single Source of Truth:** This project state document is the definitive record of the project's state.
* **Technical Guardrails:**
    * **Final Action:** After completing a development task, you must commit the changes and push them to the `main` branch on GitHub.
    * **Render Build Commands:** Use `npm cache clean --force && npm install && ...` as the base for build commands to avoid caching issues.
    * **Database Schema:** All schema changes must be performed using the `psql` command-line tool via a complete `DROP` and `CREATE` script.

#### **5. Last Session Summary**

Attempted a major refactor of the Loan Explorer page to replace the sidebar filter with a more modern "Filter Sheet" UI. This refactor failed during the `tsc` build step, revealing a persistent module resolution issue within our monorepo that was not solved by previous fixes.

#### **6. Immediate Next Task**

**Fix Frontend Build Failure Caused by Module Resolution.**

The deployment is failing with the TypeScript error `TS2307: Cannot find module`. The compiler cannot find the new `sheet` and `input` components that were added to the `@loanvision/shared` workspace.

The next session must begin by diagnosing and implementing a permanent, robust solution for TypeScript path resolution in our monorepo that works for all existing and future shared components. This likely involves a more holistic configuration of TypeScript Project References.

#### **7. Future Roadmap**

**Phase 1: "Now" - Implement Loan Explorer V1 Filters**
* **(Currently Blocked by Build Error)**
* Successfully refactor the UI to a "Filter Sheet" model.
* Implement state management within the `FilterSheet` component.
* Connect the `FilterSheet` state to the `LoanExplorerPage` to perform real-time data filtering.
* Ensure report exporting respects all active filters.

**Phase 2: "Next" - Enhanced Insights & UX**
* Add filters for calculated fields.
* Continue UI/UX polish with `shadcn/ui`.
* Revisit the AVM data enrichment engine.

**Phase 3: "Later" - Intelligent Platform & Automation**
* Implement the LLM Assistant for natural language search.
* Build workflow, alerting, and user authentication features.