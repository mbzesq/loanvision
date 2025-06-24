# NPLVision Product Roadmap

*Last Updated: 2025-06-22*

This document outlines the strategic roadmap for the NPLVision platform. It serves as a guide for feature development, organizing our work into logical phases that build upon each other to deliver increasing value to our users.

## ✅ Phase 0: Foundation & Core Functionality (Completed)

This phase focused on building the core, stable application shell and the essential data pipeline.

* **[DONE]** Deployed a scalable, decoupled architecture with a React frontend and Node.js backend on Render.com.
* **[DONE]** Implemented a robust data ingestion engine supporting both `.csv` and `.xlsx` files.
* **[DONE]** Established a "Current vs. History" database model with `daily_metrics` and `foreclosure_events` tables.
* **[DONE]** Built a functional **Loan Explorer** with a data table, sorting, and a powerful accordion-style filter panel.
* **[DONE]** Created a custom, reliable **Loan Detail Modal** to display at-a-glance information for a single asset.
* **[DONE]** Implemented a working **Export** feature for both PDF and Excel.
* **[DONE]** Established a professional, responsive **Application Shell** with persistent sidebar navigation.

## 🔨 Phase 1: High-Value Intelligence & UI Polish (Current Sprint)

The focus of this phase is to transform the functional application into a professional-grade analytical tool for our primary persona, "Alex the Active Manager."

### Immediate Next Steps
* **[IN PROGRESS]** **Foreclosure Timeline UI:** Build the user interface within the Loan Detail Modal to display the new, state-specific foreclosure timeline data.
* **[QUEUED]** **Data Table Aesthetics:** Complete the aesthetic overhaul of the data table to match our "Schwab-inspired" design.
* **[QUEUED]** **Filter Panel UX:** Enhance the filter panel with a "search-within-filter" input for long lists of options.
* **[QUEUED]** **Logo Design:** Create a simple, professional SVG logo and integrate it into the `SideNav`.

### Backlog for This Phase
* **[TODO]** **UI Cleanup:** Add City and State to the `Loan Explorer` table and `Loan Detail Modal` for better context.
* **[TODO]** **Upload Page Aesthetics:** Enhance the UI of the `UploadPage` and rename the tab for clarity.
* **[TODO]** Implement a proper **Maturity Date** range filter.
* **[TODO]** Add a color-coded **"Timeline Status"** badge to the Loan Explorer table for at-a-glance risk assessment.
* **[TODO]** Refine the **Custom Export** feature.
* **[TODO]** **SideNav UX:** Enhance the left navigation bar to be collapsible or hide when not moused over.

## 🚀 Phase 2: Enterprise Features & Reporting (Next Up)

This phase focuses on adding high-value features that support professional workflows and begin to serve our secondary "Sarah the Passive Investor" persona.

* **[PLANNED]** **Dashboard V1:** Begin building out the main Dashboard page with a grid of dynamic widgets (KPIs, charts, actionable lists, market data ticker).
* **[PLANNED]** **Data Enrichment (Tier 1):** Implement API integrations for property valuations (RentCast) and property tax tracking (Black Knight/Similar).
* **[PLANNED]** **"Soft Delete" for Loans:** Build the functionality to archive loans.
* **[PLANNED]** **Header Alias Mapping:** Enhance the backend ingestion engine to intelligently map common column name variations.
* **[PLANNED]** **Domain Migration:** Plan and execute the migration of the live application to the `https://www.nplvision.com` domain.

## 🧠 Phase 3: The Decision Engine & Go-to-Market (Future Vision)

This is the long-term vision for the platform. All items in this phase are contingent on the successful implementation of **User Authentication**.

* **[VISION]** **Public-Facing Website:** Build a pre-login landing page with company information (About, Careers), market news, and product pricing details.
* **[VISION]** **User Authentication & Cost Tracking:** Implement a full user login system with password/ID recovery. Build a UI for users to input their specific portfolio carry costs.
* **[VISION]** **Financial Modeling (NPV/IRR):** Build the backend services to implement our NPV model, using user-provided cost data.
* **[VISION]** **Risk Assessment & Workout Recommendations:** Implement rulesets to flag risky loans and suggest optimal workout paths.
* **[VISION]** **LLM-Powered Assistant:**
  * **White-Labeled UI:** Build a custom, professionally branded chat interface.
  * **PII-Scrubbing Backend:** Implement a technical safeguard to anonymize queries sent to the LLM API.
  * *Security Consideration:* Research and potentially implement a **local, self-hosted LLM**.
* **[VISION]** **Workflow Automation:**
  * **Integrated Communications:** Add a feature to send templated emails.
  * **Document Management & e-Sign:** Integrate with services like DocuSign.
* **[VISION]** **Collateral File Analysis:** Research and implement a document recognition service.
* **[VISION]** **Business Strategy:** Define client pricing tiers and go-to-market strategy.
