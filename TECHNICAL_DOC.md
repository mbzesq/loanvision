# NPLVision Technical Documentation

*This document serves as the single source of truth for the technical architecture, data models, and core logic of the NPLVision platform. It is a living document and should be updated as new features are built.*

---

## 1. High-Level Architecture

The NPLVision platform is a modern, full-stack web application designed for scalability and maintainability. It follows a standard three-tier architecture composed of a frontend client, a backend API server, and a relational database.

### 1.1. Core Components

* **Frontend (Client):** A single-page application (SPA) built with **React** and **Vite**. It is written in **TypeScript** and uses **Tailwind CSS** for styling and `shadcn/ui` for its component library. The frontend is responsible for all user interface rendering and state management.

* **Backend (Server):** A RESTful API server built with **Node.js** and the **Express** framework. It is written in **TypeScript** and is responsible for all business logic, data processing, and communication with the database.

* **Database:** A **PostgreSQL** database that serves as the persistent data store for all loan information, historical data, and user-generated content.

### 1.2. Deployment & Hosting (Render.com)

The entire platform is deployed on **Render.com** as two distinct services, which allows for independent scaling and deployment:

1.  **Frontend Service:** Serves the static, compiled React application.
2.  **Backend Service:** Runs the Node.js API server.

This separation ensures a clean, decoupled architecture where the frontend communicates with the backend exclusively through defined API endpoints.

---

## 2. Database Schema

The PostgreSQL database is the system's single source of truth. It is designed around a "current vs. history" model to provide both real-time snapshots and a full audit trail for trend analysis.

### 2.1. Purpose & Rationale

The database is designed around a "Current vs. History" model to serve two distinct, critical functions: speed for the user interface and depth for long-term analysis.

* **The `_current` Tables (For Speed):** Tables like `daily_metrics_current` and `foreclosure_events` are optimized for performance. They contain only the single, most recent record for each loan. This allows the frontend's Loan Explorer to quickly fetch and display a "snapshot" of the entire portfolio without having to sift through historical data.

* **The `_history` Tables (For Intelligence):** Tables like `daily_metrics_history` and `foreclosure_events_history` are designed to be our most valuable long-term data asset. By storing a record from *every* file upload, we create a complete, immutable audit trail. This is the foundation of our "Benchmark Flywheel," allowing us to analyze performance over time, compare actuals vs. expecteds, and eventually train predictive models.

### 2.2. The "Current vs. History" Model

For key data entities like loan metrics and foreclosure events, we maintain two tables:

* **`_current` table:** This table contains only one row per unique `loan_id`. It is always updated with the absolute latest information from the most recent file upload, providing a quick "snapshot" view of the portfolio. This table powers the main Loan Explorer UI.
* **`_history` table:** This table stores a record from *every* file upload, uniquely identified by a combination of `loan_id` and `report_date`. This provides a complete, immutable audit trail, which is essential for historical analysis and our future "Benchmark Flywheel."

---

### 2.3. Entity-Relationship Diagram (ERD)

This diagram illustrates the primary relationships between the core data tables.

```mermaid
erDiagram
    "daily_metrics_current" {
        TEXT loan_id PK
        TEXT state
        NUMERIC prin_bal
        TEXT legal_status
    }
    "daily_metrics_history" {
        SERIAL id PK
        TEXT loan_id FK
        DATE report_date
    }
    "foreclosure_events" {
        SERIAL id PK
        TEXT loan_id FK
        TEXT fc_status
        DATE fc_start_date
    }
    "foreclosure_events_history" {
        SERIAL id PK
        TEXT loan_id FK
        DATE report_date
    }

    "daily_metrics_current" ||--o{ "daily_metrics_history" : "has history of"
    "daily_metrics_current" ||--|{ "foreclosure_events" : "has one"
    "foreclosure_events" ||--o{ "foreclosure_events_history" : "has history of"
```

---

### 2.4. Key Tables

#### `daily_metrics_current`

* **Purpose:** Stores the most recent snapshot of core financial and status information for each loan. This is the primary table used by the `/api/v2/loans` endpoint.
* **Schema:**
    ```sql
    CREATE TABLE daily_metrics_current (
        loan_id TEXT PRIMARY KEY,
        investor_name TEXT,
        first_name TEXT,
        last_name TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        prin_bal NUMERIC(15, 2),
        int_rate NUMERIC(8, 6),
        next_pymt_due DATE,
        last_pymt_received DATE,
        loan_type TEXT,
        legal_status TEXT,
        lien_pos TEXT,
        -- ... other relevant columns ...
        updated_at TIMESTAMPTZ DEFAULT now()
    );
    ```

#### `foreclosure_events`

* **Purpose:** Stores the current, active foreclosure details for any loan currently in the foreclosure process. A loan will only have one entry here. This table is joined with `daily_metrics_current` to provide foreclosure context.
* **Schema:**
    ```sql
    CREATE TABLE foreclosure_events (
      id SERIAL PRIMARY KEY,
      loan_id TEXT NOT NULL UNIQUE,
      fc_status TEXT,
      fc_jurisdiction TEXT,
      fc_start_date DATE,
      -- Actual Milestone Dates
      referral_date DATE,
      title_ordered_date DATE,
      title_received_date DATE,
      complaint_filed_date DATE,
      service_completed_date DATE,
      judgment_date DATE,
      sale_scheduled_date DATE,
      sale_held_date DATE,
      -- Expected Milestone Dates (Calculated on Ingest)
      referral_expected_completion_date DATE,
      title_ordered_expected_completion_date DATE,
      title_received_expected_completion_date DATE,
      complaint_filed_expected_completion_date DATE,
      service_completed_expected_completion_date DATE,
      judgment_expected_completion_date DATE,
      sale_scheduled_expected_completion_date DATE,
      sale_held_expected_completion_date DATE,
      -- ... other relevant columns ...
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    ```
*(Note: The corresponding `_history` tables have identical columns but also include a `report_date` field.)*

---

## 3. Backend Services & Logic

The backend is responsible for all business logic, data processing, and API services. It is designed to be a "smart" service that provides clean, processed data to a "dumb" frontend.

### 3.1. Purpose & Rationale

The backend is designed as a **"Smart Service Layer"**. The core principle is to centralize all complex business logic, data processing, and third-party integrations on the server. This allows the frontend to remain a "dumb" presentation layer, making it simpler, faster, and easier to maintain.

* **Encapsulated Logic (`/services`):** We separate distinct business functions into their own service files (e.g., `foreclosureService.ts`, `currentHistoryService.ts`). This makes the code modular, easier to test, and allows us to reuse complex logic across multiple API endpoints if needed.
* **Purpose-Built Endpoints (`/routes`):** Instead of one generic API endpoint, we create specific routes that are tailored to the exact needs of a UI component. For example, the `/api/v2/loans` endpoint is designed to efficiently feed the main data table, while the `/api/loans/:loanId/foreclosure-timeline` endpoint performs a more complex calculation for the specific needs of the detail modal. This ensures the UI is always fast and never has to fetch more data than it needs.

### 3.2. Data Ingestion Pipeline (`/api/upload`)

The ingestion pipeline is the entry point for all portfolio data. It's a multi-step process designed to be robust and resilient.

**Flowchart:**
```mermaid
graph TD
    A["File Upload via UI"] --> B{"/api/upload Endpoint"};
    B --> C{"Parse File (XLSX/CSV)"};
    C --> D{"Detect File Type"};
    D -- "daily_metrics" --> E["Process Daily Metrics"];
    D -- "foreclosure_data" --> F["Process Foreclosure Events"];
    E --> G["Map to History Record"];
    E --> H["Map to Current Record"];
    G --> I["Insert to daily_metrics_history"];
    H --> J["Upsert to daily_metrics_current"];
    F --> K["Calculate Expected Dates"];
    K --> L["Upsert to foreclosure_events"];
    F --> M["Insert to foreclosure_events_history"];
```

**Key Steps:**

1. **File Parsing:** The endpoint accepts `.xlsx` or `.csv` files and uses the `multer` and `xlsx` libraries to parse the file buffer into a raw JSON format.
2. **File Type Detection (`fileTypeDetector.ts`):** The system analyzes the column headers of the uploaded file to determine if it is a `daily_metrics` file or a `foreclosure_data` file. It uses a confidence score based on matching key headers.
3. **Data Processing:** Based on the detected file type, the request is routed to the appropriate processing logic.
4. **Data Mapping (`columnMappers.ts`):** Raw data from each row is mapped to our standardized database schemas. This step includes data cleaning functions (`cleanCurrency`, `parseExcelDate`, etc.).
5. **Database Insertion (`currentHistoryService.ts`):** The mapped data is inserted into the database, following our "Current vs. History" model. The `_history` tables receive a new record for every upload, while the `_current` tables are updated with only the latest data for each loan.

### 3.3. Foreclosure Timeline Service (`foreclosureService.ts`)

This service contains the core business intelligence for our foreclosure tracking.

**`getForeclosureTimeline` Function:** This is the primary function called by the API. It takes a `loan_id` and performs the following steps:
1. Fetches the loan's state from the `daily_metrics_current` table.
2. Fetches the corresponding `foreclosure_events` record, which contains all the actual and expected milestone dates.
3. Loads the `fcl_milestones_by_state.json` ruleset file.
4. Looks up the correct milestone template for the loan's state and jurisdiction (judicial vs. non-judicial).
5. Combines the template with the actual/expected data from the database to create a complete, ordered timeline.

**Expected Date Calculation:** The service also includes logic to dynamically calculate a full chain of expected completion dates upon ingestion, making it a predictive tool.

### 3.4. API Endpoints (`loans.ts`)

These are the key routes that serve data to the frontend.

* **`GET /api/v2/loans`:** This is the primary endpoint for the Loan Explorer. It performs a LEFT JOIN on `daily_metrics_current` and `foreclosure_events` to provide a single, rich list of all loans with their current status.
* **`GET /api/v2/loans/:loanId`:** Fetches the full, detailed record for a single loan from the `daily_metrics_current` table to populate the top sections of the Loan Detail Modal.
* **`GET /api/loans/:loanId/foreclosure-timeline`:** Calls the `getForeclosureTimeline` service to provide the detailed, calculated timeline for a single loan to populate the bottom section of the Loan Detail Modal.

<!-- end list -->

---

## 4. Frontend Architecture

The frontend is a modern Single-Page Application (SPA) built with React and Vite. It is designed to be a "dumb" client that receives clean, processed data from the backend and focuses solely on presentation and user interaction.

### 4.1. Purpose & Rationale

The frontend is designed with two core principles in mind: separation of concerns and component-based architecture.

**Dumb Components, Smart Containers:** We follow a pattern where high-level "page" components (like `LoanExplorerPage`) are "smart"—they are responsible for fetching data and managing all the state for that view. They then pass this data down as props to smaller, "dumb" presentational components (like `DataToolbar` or `FilterPanel`) whose only job is to display that data. This makes our code easier to debug, as logic is centralized, and our UI components are highly reusable.

**Centralized Layout:** The `MainLayout.tsx` component acts as the "application shell," providing a consistent navigation experience across all pages. This prevents us from having to rebuild the navigation on every page and makes global changes (like adding a new nav link) trivial.

### 4.2. Component Hierarchy & Layout

The application uses a responsive shell structure, managed by `MainLayout.tsx`, which provides a persistent sidebar for navigation on desktop screens and a slide-out drawer on mobile.

**Component Diagram:**

```mermaid
graph TD
    A["Router (in App.tsx)"] --> B["MainLayout"];
    B --> C["SideNav"];
    B --> D["Outlet (Renders Page)"];
    D --- E["LoanExplorerPage"];
    E --> F["FilterPanel"];
    E --> G["DataToolbar"];
    G --> H["ExportButton"];
    E --> I["DataTable (TanStack)"];
    E --> J["LoanDetailModal (Custom)"];
```

**Key Components:**

* **`App.tsx`:** The root of the application. Its only job is to set up the `react-router-dom` router and define the relationship between the `MainLayout` and the individual pages.

* **`MainLayout.tsx`:** The main application shell. It uses Tailwind CSS's responsive prefixes to render a persistent `SideNav` on large screens (`lg:flex`) and a hidden `Sheet`-based drawer for mobile. The `<Outlet>` from React Router is used to render the active page's content in the main content area.

* **`LoanExplorerPage.tsx`:** This is the most complex "container" component. It is responsible for:
  - **Data Fetching:** Using a `useEffect` hook to call the `/api/v2/loans` endpoint via `axios`.
  - **State Management:** Using `useState` hooks to manage all page-level state, including the full list of loans, the active filters, sorting state, and the currently selected loan for the modal.
  - **Derived Data:** Using `useMemo` hooks to efficiently calculate unique values for the filter panel dropdowns (e.g., `uniqueStates`, `uniqueInvestors`).
  - **Component Composition:** Rendering the primary child components (`FilterPanel`, `DataToolbar`, `DataTable`) and passing them the necessary data and callback functions as props.

### 4.3. Core Data Flow (Loan Explorer)

1. **Initial Load:** `LoanExplorerPage` mounts, and its `useEffect` hook fires to call the `/api/v2/loans` endpoint. The full, unfiltered list of loans is stored in the `loans` state variable.

2. **Filtering:** The user interacts with the controls in the `FilterPanel`. All selections are managed within the `FilterPanel's` own internal state.

3. **Apply Action:** When the user clicks the "Apply" button, the `FilterPanel` invokes the `onApplyFilters` callback prop, passing its current internal filter state up to the `LoanExplorerPage`.

4. **State Update & Re-render:** The `LoanExplorerPage` updates its `activeFilters` state with the data received from the callback. This state change triggers a re-render.

5. **Memoized Calculation:** The `filteredData` `useMemo` hook, which depends on `activeFilters`, re-runs. It filters the master `loans` array based on the new criteria and returns a new array of only the matching loans.

6. **Table Update:** The TanStack Table component receives the new, smaller `filteredData` array as its `data` prop and automatically re-renders to show only the filtered results.