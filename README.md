# Sellar Events 🎟️✨

> An all-in-one, modern event management, ticketing, analytics, and check-in platform built with React 19, TypeScript, Vite, Tailwind CSS, and Firebase.

[![React](https://img.shields.io/badge/React-19.2-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.1-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.3-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-v12.16-FFCA28?logo=firebase)](https://firebase.google.com/)

---

## 📖 Overview

**Sellar Events** is a full-featured web application designed for event organizers and attendees. It provides a complete workflow for creating multi-tiered events, discovering events, selling tickets, managing attendees, tracking real-time revenue analytics, and processing live venue check-ins using camera-based QR code scanning.

---

## ✨ Key Features

- **🎫 Event Creation & Multi-Tier Ticketing**:
  - Flexible ticket tiers (e.g., VIP, General Admission, Early Bird) with custom quantities and pricing.
  - Category selection, venue details, event date/time scheduling, and promo discount codes.
  - Image upload with automatic browser-side compression.

- **📊 Comprehensive Organizer Dashboard**:
  - Real-time sales metrics (Total Revenue, Tickets Sold, Active Events).
  - Visual sales trend charts and ticket tier breakdown analytics.

- **🔍 Event Discovery & Public Booking**:
  - Interactive event discovery page with search and category filters.
  - Detailed public event pages with ticket tier selection and booking checkout flow.

- **👥 Attendee Management**:
  - Real-time searchable attendee directory.
  - Filter by ticket status (`valid`, `checked_in`, `cancelled`) or tier type.
  - Quick manual or scanned ticket validation.

- **📱 Integrated Live QR Code Check-In**:
  - Built-in camera-based QR scanner using `jsqr` for instant attendee validation at event entrances.
  - Modal view for scanning digital or printed ticket QR codes.

- **📄 Reports & Data Export**:
  - Export attendee lists and financial summaries directly to **PDF** (via `jspdf` & `jspdf-autotable`) or **Excel** spreadsheets (via `xlsx`).

- **🔐 User & Organization Authentication**:
  - Secure authentication powered by Firebase Auth.
  - Support for multi-tenant accounts and user profile customization.

---

## 🛠️ Tech Stack

### **Frontend**
- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 8](https://vitejs.dev/)
- **Routing**: [React Router v7](https://reactrouter.com/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/), [React Icons](https://react-icons.github.io/react-icons/)
- **State & Utilities**: `clsx`, `tailwind-merge`

### **Backend & Cloud Infrastructure**
- **Authentication**: Firebase Auth
- **Database**: Cloud Firestore (with indexes & security rules)
- **Storage**: Firebase Storage (for event banners & avatars)
- **Serverless Functions**: Firebase Cloud Functions (`Node.js`)
- **Hosting**: Firebase Hosting

### **Libraries & Integrations**
- **QR Code Scanning**: `jsqr`
- **PDF Generation**: `jspdf` & `jspdf-autotable`
- **Excel Generation**: `xlsx`

---

## 📁 Project Structure

```text
Sellar_Events/
├── firebase.json              # Firebase service configuration (hosting, functions, firestore, storage)
├── firestore.rules            # Firestore security rules
├── firestore.indexes.json     # Firestore database indexes
├── storage.rules              # Firebase storage access rules
├── functions/                 # Firebase Cloud Functions (backend logic)
│   ├── index.js               # Cloud Functions entry point
│   ├── users/                 # User management triggers
│   └── tenants/               # Tenant management triggers
├── public/                    # Static assets
└── src/
    ├── assets/                # Images and static media
    ├── components/            # Reusable UI components
    │   ├── AttendeeCard.tsx   # Individual attendee item
    │   ├── CheckInScanner.tsx # Camera scanner logic
    │   ├── ExportMenu.tsx     # PDF & Excel export actions
    │   ├── QrScannerModal.tsx # QR scanner popup modal
    │   ├── SalesTrendCard.tsx # Analytics sales graph card
    │   └── ui/                # Low-level UI primitives
    ├── data/                  # Mock/fallback initial dataset
    ├── hooks/                 # Custom React hooks
    ├── Layout/                # App layout wrappers (sidebar, navbar)
    │   └── EventsLayout.tsx
    ├── lib/                   # Integrations & helpers
    │   ├── firebase.ts        # Firebase initialization & exports
    │   └── imageCompression.ts# Canvas image compression helper
    ├── pages/                 # Main application routes
    │   ├── Account.tsx        # User profile & settings
    │   ├── Attendees.tsx      # Attendee management & check-in
    │   ├── CreateEvent.tsx    # Event creation form
    │   ├── EditProfile.tsx    # Edit user account details
    │   ├── EventDashboard.tsx # Organizer analytics dashboard
    │   ├── EventDetails.tsx   # Public event details & ticket booking
    │   ├── EventDiscover.tsx  # Event marketplace & search
    │   ├── LoginPage.tsx      # Sign in page
    │   └── SignUp.tsx         # User registration page
    ├── types/                 # TypeScript type definitions
    │   ├── attendee.types.ts  # Attendee & ticket types
    │   └── event.types.ts     # Event, tier & dashboard types
    ├── App.tsx                # Main router entry point
    ├── main.tsx               # DOM mounting point
    └── index.css              # Global styles & Tailwind imports
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) (bundled with Node.js)
- [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`)

---

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Hardik2311/Sellar_Events.git
   cd Sellar_Events
   ```

2. **Install frontend dependencies**:
   ```bash
   npm install
   ```

3. **Install Firebase Functions dependencies** (optional, for Cloud Functions development):
   ```bash
   cd functions
   npm install
   cd ..
   ```

---

## 🤝 Contributing

Contributions are welcome! If you'd like to improve Sellar Events:

1. Fork the Repository.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).
