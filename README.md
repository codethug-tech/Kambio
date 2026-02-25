<<<<<<< HEAD
# Kambio
=======
# Kambio — Barter & Currency Swap Marketplace

> Venezuelan marketplace for "I offer X, I want Y" — Bolívares ↔ USD, Zelle, goods, or services. Chat to negotiate, trade off-app, rate each other.

---

## Project Structure

```
kambio/
├── app/          # Flutter app (Android + Web)
├── backend/      # Node.js + Express REST API
├── admin/        # Next.js admin panel
└── supabase/
    └── migrations/001_initial_schema.sql
```

---

## Quick Start

### 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste and run `supabase/migrations/001_initial_schema.sql`
3. In **Storage** → create bucket named `kambio-photos` (set to Public)
4. Copy your **Project URL**, **Anon Key**, and **Service Role Key**

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, ADMIN_EMAILS
npm install
npm run dev     # Starts on http://localhost:4000
```

### 3. Flutter App

```bash
cd app
# Edit lib/core/constants.dart — fill in supabaseUrl and supabaseAnonKey
flutter pub get
flutter run                    # Android device/emulator
flutter run -d chrome          # Web
flutter build apk --release    # Android APK
flutter build web              # Web build
```

### 4. Admin Panel

```bash
cd admin
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD
npm install
npm run dev     # Starts on http://localhost:3001
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (keep secret!) |
| `JWT_SECRET` | Random string (min 32 chars) for JWT signing |
| `PORT` | API port (default: 4000) |
| `SUPABASE_STORAGE_BUCKET` | `kambio-photos` |
| `ADMIN_EMAILS` | Comma-separated admin emails, e.g. `admin@kambio.ve` |

### Flutter App (`lib/core/constants.dart`)

| Constant | Description |
|----------|-------------|
| `supabaseUrl` | Your Supabase project URL |
| `supabaseAnonKey` | Supabase anon key |
| `apiBaseUrl` | Backend URL, e.g. `https://your-api.example.com/api` |

---

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register |
| POST | `/api/auth/login` | Login → returns JWT |
| GET | `/api/listings` | Browse listings (filter: city, type, category, q) |
| POST | `/api/listings` | Create listing (multipart + photos) |
| PATCH | `/api/listings/:id` | Edit own listing |
| DELETE | `/api/listings/:id` | Delete own listing |
| GET | `/api/users/:id` | Get user profile |
| PATCH | `/api/users/me` | Update own profile |
| POST | `/api/chat/threads` | Open/get chat thread for a listing |
| GET | `/api/chat/threads` | List my threads |
| GET | `/api/chat/threads/:id/messages` | Get messages |
| POST | `/api/chat/threads/:id/messages` | Send message |
| POST | `/api/trades` | Create trade from thread |
| PATCH | `/api/trades/:id` | Mark completed/cancelled |
| POST | `/api/ratings` | Submit rating (after completed trade) |
| POST | `/api/favorites` | Save listing |
| DELETE | `/api/favorites/:listing_id` | Remove favorite |
| POST | `/api/reports` | Report user/listing |
| GET | `/api/admin/dashboard` | Admin stats |
| GET | `/api/admin/users` | List all users |
| PATCH | `/api/admin/users/:id/block` | Block user |
| GET | `/api/admin/listings` | List all listings |
| PATCH | `/api/admin/listings/:id/hide` | Hide listing |
| GET | `/api/admin/reports` | List reports |

---

## Tech Stack

- **Flutter** — Android + Web (one codebase)
- **Node.js + Express** — REST API
- **Supabase** — PostgreSQL, Auth, Storage, Realtime
- **Next.js** — Admin panel
- **Riverpod** — Flutter state management
- **go_router** — Flutter navigation

---

## Post-MVP Roadmap

- [ ] WhatsApp OTP via Meta Cloud API
- [ ] Identity verification (CI photo)
- [ ] Pago Móvil verification (PagoFlash)
- [ ] Map view / distance-based search
- [ ] Escrow support
- [ ] iOS build
- [ ] Push notifications (FCM)
>>>>>>> 0d5544a (initial commit)
