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