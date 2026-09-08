# TeamHub HRMS (Desktop Application)

A comprehensive Human Resource Management System (HRMS) desktop application built with **Electron**, **React**, and **Node.js/Express**.

---

## 🏗️ Architecture & Tech Stack

- **Desktop Shell**: [Electron](https://www.electronjs.org/) (`main.js`) - Orchestrates both the frontend window and background backend server.
- **Frontend**: [React 19](https://react.dev/) (`HRMSUI/`) - Bootstrap 5, React Router, React Icons.
- **Backend**: [Express.js](https://expressjs.com/) (`HRMS_SERVER/`) - Node.js REST API, MongoDB (Mongoose), JWT Authentication, Cloudinary file storage, Geofenced Attendance.
- **Packaging**: `electron-builder` - Packages into Linux AppImage and `.deb` installers.

---

## 📂 Project Structure

```
BUild-HRMS/
├── main.js                  # Electron application entry point
├── package.json             # Root Electron configuration & build scripts
├── .gitignore               # Git ignore rules
├── HRMSUI/                  # React Frontend application
│   ├── public/              # Static HTML & icons
│   ├── src/                 # React components, pages, context, and API clients
│   ├── package.json         # Frontend dependencies & scripts
│   └── .env.example         # Frontend environment template
└── HRMS_SERVER/             # Express.js Backend API
    ├── Controller/          # API route controllers
    ├── Middleware/          # Auth & authority validation middlewares
    ├── Modules/             # Mongoose database models
    ├── Routes/              # Express API routers
    ├── Services/            # Business logic & onboarding services
    ├── Utils/               # Audit logger, geolocation, Cloudinary utilities
    ├── index.js             # Backend server entry point
    ├── package.json         # Backend dependencies & scripts
    └── .env.example         # Backend environment template
```

---

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** (v9 or higher)
- **MongoDB** cluster instance (local or MongoDB Atlas)

---

### 2. Setup Environment Variables

Copy the example environment files and configure your credentials:

**Backend (`HRMS_SERVER/`):**
```bash
cp HRMS_SERVER/.env.example HRMS_SERVER/.env
```
Update `MONGO_URI`, `JWT`, and Cloudinary keys in `HRMS_SERVER/.env`.

**Frontend (`HRMSUI/`):**
```bash
cp HRMSUI/.env.example HRMSUI/.env
```

---

### 3. Install Dependencies

Install dependencies for all layers:

```bash
# Root dependencies (Electron & builder)
npm install

# Frontend dependencies
cd HRMSUI && npm install && cd ..

# Backend dependencies
cd HRMS_SERVER && npm install && cd ..
```

---

### 4. Build & Run

**Build the frontend:**
```bash
cd HRMSUI && npm run build && cd ..
```

**Launch the Desktop Application:**
```bash
npm start
```

---

## 📦 Building Distributables

To build Linux installers (`.AppImage` and `.deb`):

```bash
npm run dist
```
Distributables will be generated in the `dist/` directory.

---

## 📄 License

Proprietary / ISC - Developed by FlareMinds Tech.
