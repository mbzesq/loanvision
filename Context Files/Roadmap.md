# NPLVision Product Roadmap

*Last Updated: 2025-06-27*

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
* **[DONE]** Implemented a foundational **User Authentication** system with registration, login, and roles.
* **[DONE]** Successfully resolved the **Foreclosure Timeline Status** filter bug through systematic debugging and implementation of sophisticated cumulative variance calculation logic.

## 🔨 Phase 1: Middle-Value Intelligence & UI Polish (Current Sprint)

The focus of this phase is to transform the functional application into a professional-grade analytical tool for our primary persona, "Alex the Active Manager."

### Immediate Next Steps
* **[DONE]** **Foreclosure Timeline UI:** Built the visual interface and added color-coded status indicators to the Loan Detail Modal.
* **[DONE]** **Fix Foreclosure Timeline Status Filter:** Resolved the critical bug that caused the Loan Explorer to crash when using this filter.
* **[DONE]** **Centralized Timeline Logic:** Implemented shared utility functions (`timelineUtils.ts`) following DRY principles to avoid code duplication.
* **[DONE]** **UI/UX Enhancements:** Relocate user profile menu, update branding text on login page, and integrate new company logo.
* **[DONE]** **Data Table Aesthetics:** Complete the aesthetic overhaul of the data table to match our "Schwab-inspired" design.
* **[DONE]** **Filter Panel UX:** Enhance the filter panel with a "search-within-filter" input for long lists of options.
* **[DONE]** **Logo Design:** Create a simple, professional SVG logo and integrate it into the `SideNav`.
* **[DONE]** **UI Cleanup:** Add City and State to the `Loan Explorer` table and `Loan Detail Modal` for better context.
* **[DONE]** **Upload Page Aesthetics:** Enhance the UI of the `UploadPage` and rename the tab for clarity.

### Backlog for This Phase

* **[TODO]** Implement a proper **Maturity Date** range filter on the Loan Explorer page.
* **[TODO]** Refine the **Custom Export** feature to allow search/selection of any data point housed in any data base
* **[TODO]** Implement ability for logged in users to Save a **custom export template** for future reporting
* **[TODO]** **SideNav UX:** Enhance the left navigation bar to be collapsible or hide when not moused over.
* **[TODO]** Custom Domain Login: Fix login issue encountered at custom domain **nplvision.com**

## 🚀 Phase 2: Enterprise Features & Reporting (Next Up)

This phase focuses on adding high-value features that support professional workflows and begin to serve our secondary "Sarah the Passive Investor" persona.

* **[PLANNED]** **Statute of Limitations Risk Analysis**: Build the statute of limitations analysis which combines state rules and loan data to determine if a loan is nearing, or is past, the statute of limitations, which will act as one input to the Financial Modeling backend services planned for Phase 3.
* **[PLANNED]** **Loan Detail Page V1:** Begin building out the Loan Detail Page, a page assigned to every loan uploaded to the platform, that houses all key data points including Loan Data, Property Data, and Credit Data.
* **[PLANNED]** **Dashboard V1:** Begin building out the main Dashboard page with a grid of dynamic widgets (KPIs, charts, actionable lists, market data ticker).
* **[PLANNED]** **Data Enrichment (Tier 1):** Implement python scraping integrations for property valuations, property photos, etc.
* **[PLANNED]** **"Soft Delete" for Loans:** Build the functionality to archive loans.
* **[PLANNED]** **Header Alias Mapping:** Enhance the backend ingestion engine to intelligently map common column name variations.
* **[PLANNED]** **Domain Migration:** Plan and execute the migration of the live application to the `https://www.nplvision.com` domain.

## 🧠 Phase 3: The Decision Engine & Go-to-Market (Future Vision)

This is the long-term vision for the platform. All items in this phase are contingent on the successful implementation of **User Authentication**.

* **[VISION]** **Public-Facing Website:** Build a pre-login landing page with company information (About, Careers), market news, and product pricing details.
* **[VISION]** **User Cost & Financial Modeling:** Build a UI for users to input portfolio carry costs to drive our future NPV/IRR models.
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
