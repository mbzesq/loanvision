# LoanVision Project State - 2025-06-17

## 1. High-Level Objective
To build a SaaS platform for ingesting, enriching, and analyzing non-performing mortgage loan portfolios.

## 2. Core Technology Stack
- **Backend:** Node.js with Express, TypeScript
- **Frontend:** React with Vite, TypeScript
- **Database:** PostgreSQL
- **Deployment:** Render (as separate Backend and Frontend services from a monorepo)

## 3. Current Deployed State
The application is successfully deployed on Render and the core data pipeline is functional. This includes:
- A working `GET /api/health` endpoint.
- A robust `POST /api/upload` endpoint that can parse real-world CSV/Excel files, clean data formats (currency, percentages), and save the records to the live PostgreSQL database.
- A working `GET /api/loans` endpoint to retrieve all saved records.
- A "/loans" page (Loan Explorer) that successfully fetches and displays the saved data in a table that matches the required summary layout.

## 4. Key Architectural Decisions
- **Production-First Workflow:** Every feature is built, deployed to a live URL, and tested before moving to the next feature.
- **Monorepo Structure:** The `backend`, `frontend`, and `shared` code are in a single Git repository using npm workspaces.
- **Manual Code Review:** AI-generated code that fixes a bug or implements a new feature must be reviewed by the human project lead before being pushed.

## 5. Critical Configurations
- **Render Backend Service (`loanvision-backend`):**
    - **Root Directory:** (blank)
    - **Build Command:** `npm install && npm run build --workspace=@loanvision/shared && npm run build --workspace=@loanvision/backend`
    - **Start Command:** `npm start --workspace=@loanvision/backend`
- **Render Frontend Service (`loanvision-frontend`):**
    - **Root Directory:** (blank)
    - **Build Command:** `npm install && npm run build --workspace=@loanvision/shared && npm run build --workspace=@loanvision/frontend`
    - **Publish Directory:** `src/frontend/dist`
- **TypeScript Configuration:** All `tsconfig.json` files that depend on the shared package use `references` and `paths` to correctly resolve the `@loanvision/shared` module.

## 6. Last Session Summary
In this session, we successfully hardened the data ingestion pipeline to handle real-world servicing data. The work began with analyzing a production CSV file that contained currency values with dollar signs and commas (e.g., "$123,456.78"), percentage values with percent symbols (e.g., "9.50%"), and split name fields that needed to be combined. We implemented comprehensive data cleaning functions including `cleanCurrency()` to strip $ and commas, `cleanPercentage()` to remove % and convert to decimals (9.50% → 0.095), and `combineName()` to merge First Name and Last Name fields. We also added full column mapping support for real servicing data fields like "Prin Bal", "Int Rate", "Last Pymt Received", and others. Additionally, we created a SQL migration to add a `servicer_loan_id` column to preserve the original loan identifiers from the source files. On the frontend, we refined the Loan Explorer table to display exactly six key columns (Loan Number, Borrower Name, Property Address, UPB, Next Due Date, Last Paid Date) with proper currency formatting for monetary values and clean date formatting for temporal data.

## 7. Immediate Next Task
The next feature to be built is the "Loan Detail Modal View," which will be triggered by clicking a row in the Loan Explorer table to show all data for that loan.