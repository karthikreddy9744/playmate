# PlayMate — Complete Project Documentation

> **Find Your Game, Find Your Crew**
>
> A hyperlocal, community-driven sports platform that connects people who want to play sports but lack consistent playing partners or teams.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Database Schema](#4-database-schema)
5. [Authentication & Security](#5-authentication--security)
6. [Core Features](#6-core-features)
7. [Messaging System](#7-messaging-system)
8. [Message Privacy & Encryption](#8-message-privacy--encryption)
9. [Admin Dashboard](#9-admin-dashboard)
10. [API Reference](#10-api-reference)
11. [Setup & Running](#11-setup--running)
12. [Testing](#12-testing)
13. [Deployment](#13-deployment)
14. [Roadmap](#14-roadmap)

---

## 1. Project Overview

### 1.1 What is PlayMate?

PlayMate enables users to **discover nearby games**, **post their own sessions**, **request to join existing games**, **communicate with fellow players**, and **build sports communities** through a trust-based rating system — all for free.

### 1.2 Problem It Solves

| Challenge | How PlayMate Addresses It |
|---|---|
| No playing partners | Location-based discovery matches nearby players |
| Relocation to new cities | Instantly find local sports communities |
| Schedule conflicts | Filter by date, time slot, weekend/weekday |
| Skill mismatch | Skill-level filtering (Beginner / Intermediate / Advanced) |
| Disorganised WhatsApp groups | Structured game posts, requests, group chat, ratings |
| Expensive platforms (Playo, etc.) | 100% free — no venue booking required |
| Safety concerns | Ratings, verification badges, block/report, no-show tracking |
| No-shows | Punctuality ratings + reliability scores |

### 1.3 Target Users

- **Urban professionals (22–40)** seeking work-life balance through sports
- **College/university students (18–25)** — tech-savvy, budget-conscious
- **Relocated individuals** looking for social connections in a new city
- **Casual sports enthusiasts** preferring organised meetups over expensive clubs

### 1.4 Geographic Focus

- **Phase 1:** Bangalore
- **Phase 2:** Mumbai, Delhi NCR, Pune, Hyderabad, Chennai
- **Phase 3:** Tier-2 cities (Ahmedabad, Jaipur, Kochi, Chandigarh)

---

## 2. Technology Stack

### Frontend

| Technology | Purpose |
|---|---|
| React 18 | UI framework (hooks-based functional components) |
| Vite 5 | Build tool and dev server |
| TypeScript | Type-safe JavaScript |
| Tailwind CSS | Utility-first styling |
| Recharts | Charts (Bar, Line, Pie) for admin dashboard |
| react-simple-maps v3 | India choropleth map (admin dashboard) |
| framer-motion | Animations |
| react-icons (Feather) | Icon set |
| react-hot-toast | Toast notifications |
| Axios | HTTP client with interceptors |
| STOMP.js + SockJS | WebSocket real-time messaging |

### Backend

| Technology | Purpose |
|---|---|
| Spring Boot 3.5.11 | Application framework |
| Java 21 | Language runtime |
| Maven 3.9 | Build & dependency management |
| Spring Security 6 | Auth, CORS, role-based access |
| JWT (jjwt 0.12) | Stateless token authentication (24h access, 7d refresh) |
| Spring Data JPA + Hibernate 6 | ORM / repository layer |
| Spring WebSocket (STOMP) | Real-time chat |
| Lombok | Boilerplate reduction |
| MapStruct 1.5 | DTO ↔ Entity mapping |
| spring-dotenv 2.5.4 | `.env` file loading |
| Firebase Admin SDK 9.2 | FCM push notifications + ID token verification |
| SpringDoc OpenAPI 2.3 | Swagger UI |

### Database & Storage

| Service | Purpose |
|---|---|
| PostgreSQL 15+ (Supabase) | Primary relational database |
| Redis | OTP caching (6-digit codes, 5-min TTL) |
| Cloudinary | Image upload, transformation, CDN |
| HikariCP | Connection pooling |

### External Services (Free Tier)

| Service | Purpose |
|---|---|
| Firebase Auth | Google OAuth + email/password sign-in |
| Firebase Cloud Messaging | Push notifications |
| Brevo (Sendinblue) | Transactional emails (300/day free) |
| OpenStreetMap + Nominatim | Map tiles + geocoding |

### Hosting (Free Tier Options)

| Service | For |
|---|---|
| Vercel | Frontend static site |
| Render | Backend Docker container |
| Supabase | Managed PostgreSQL |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────┐
│  CLIENT LAYER                                       │
│  Web Browser (React) / Mobile PWA / Admin Panel     │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS / WSS
┌──────────────────────┴──────────────────────────────┐
│  SPRING BOOT APPLICATION                            │
│                                                     │
│  REST Controllers                                   │
│  /auth  /users  /games  /messages  /ratings /admin  │
│                                                     │
│  WebSocket (SockJS + STOMP)                         │
│  /topic/conversation/{id}  /topic/game-group/{id}   │
│                                                     │
│  Security: JWT filter + Firebase ID token verify    │
├─────────────────────────────────────────────────────┤
│  SERVICE LAYER                                      │
│  UserService  GameService  MessageService           │
│  RatingService  NotificationService  AdminService   │
│  GameRequestService  CloudinaryService  FcmService  │
│  MessageEncryptionService  CleanupScheduler         │
├─────────────────────────────────────────────────────┤
│  DATA ACCESS (Spring Data JPA Repositories)         │
│  UserRepo  GameRepo  MessageRepo  RatingRepo        │
│  GameRequestRepo  NotificationRepo                  │
├─────────────────────────────────────────────────────┤
│  STORAGE                                            │
│  PostgreSQL (Supabase) │ Cloudinary │ Redis          │
├─────────────────────────────────────────────────────┤
│  EXTERNAL SERVICES                                  │
│  Firebase FCM │ Brevo (Email) │ OSM │ Nominatim     │
└─────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

- **Game status is computed, not stored** — `GameService.toGameResponse()` calculates UPCOMING / LIVE / COMPLETED / CANCELLED / FULL at response time. Zero DB migrations needed for status changes.
- **Request-only joining** — no direct join; all joins go through the host accept/reject flow.
- **Message encryption at rest** — AES-256-GCM before DB write; plaintext in-memory only during request processing.
- **Auto-purge** — messages are deleted after game ends, keeping the DB lean.

---

## 4. Database Schema

### 4.1 Entity Relationships

```
User (1) ──→ (*) UserSport          FK: user_sports.user_id
User (1) ──→ (*) Game               FK: games.created_by
User (*) ←──→ (*) Game              Join table: game_participants
User (1) ──→ (*) GameRequest        FK: game_requests.requester_id
Game (1) ──→ (*) GameRequest        FK: game_requests.game_id
User (1) ──→ (*) Message (sender)   FK: messages.sender_id
User (1) ──→ (*) Message (receiver) FK: messages.receiver_id
Game (1) ──→ (*) Message            FK: messages.game_id
User (1) ──→ (*) Rating (rater)     FK: ratings.rater_id
User (1) ──→ (*) Rating (ratee)     FK: ratings.ratee_id
Game (1) ──→ (*) Rating             FK: ratings.game_id
User (1) ──→ (*) Notification       FK: notifications.user_id
```

### 4.2 Table Schemas

#### users

| Column | Type | Constraints |
|---|---|---|
| id | BIGINT | PK, IDENTITY |
| firebase_uid | VARCHAR(255) | UNIQUE, NOT NULL |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| name | VARCHAR(100) | NOT NULL |
| age | INT | CHECK (>= 18) |
| gender | ENUM | MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY |
| bio | VARCHAR(200) | |
| profile_picture_url | VARCHAR(500) | |
| location_lat | DECIMAL(10,8) | |
| location_lng | DECIMAL(11,8) | |
| location_city | VARCHAR(100) | |
| location_address | VARCHAR(300) | |
| phone | VARCHAR(20) | |
| verified_email | BOOLEAN | DEFAULT FALSE |
| verified_id | BOOLEAN | DEFAULT FALSE |
| fcm_token | VARCHAR(512) | |
| total_games_played | INT | DEFAULT 0 |
| average_rating | DECIMAL(3,2) | DEFAULT 0.00 |
| no_show_count | INT | DEFAULT 0 |
| last_login | TIMESTAMP | |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW |
| updated_at | TIMESTAMP | |
| role | VARCHAR(20) | DEFAULT 'user' |
| is_active | BOOLEAN | DEFAULT TRUE |

#### games

| Column | Type | Constraints |
|---|---|---|
| id | BIGINT | PK, IDENTITY |
| title | VARCHAR(200) | NOT NULL |
| description | TEXT | |
| sport_type | ENUM | BADMINTON, CRICKET, FOOTBALL, … |
| skill_level | ENUM | BEGINNER, INTERMEDIATE, ADVANCED, ALL_LEVELS |
| max_players | INT | NOT NULL |
| current_players | INT | DEFAULT 1 |
| game_datetime | TIMESTAMP | NOT NULL |
| duration_minutes | INT | |
| location_lat / lng | DECIMAL | |
| location_address | VARCHAR(500) | |
| location_city | VARCHAR(200) | |
| is_public | BOOLEAN | DEFAULT TRUE |
| is_cancelled | BOOLEAN | DEFAULT FALSE |
| created_by | BIGINT | FK → users.id |
| price_per_player | DECIMAL(10,2) | DEFAULT 0 |
| equipment_provided | BOOLEAN | DEFAULT FALSE |
| equipment_details | VARCHAR(500) | |
| rating_required | BOOLEAN | DEFAULT FALSE |
| min_rating | DECIMAL(3,2) | DEFAULT 0 |
| created_at | TIMESTAMP | NOT NULL |
| updated_at | TIMESTAMP | |

Indexes: `sport_type`, `location_city`, `game_datetime`, `created_by`, `created_at`

#### game_participants (join table)

| Column | Type |
|---|---|
| game_id | BIGINT FK → games.id |
| user_id | BIGINT FK → users.id |

PK: (game_id, user_id)

#### game_requests

| Column | Type | Constraints |
|---|---|---|
| id | BIGINT | PK |
| game_id | BIGINT | FK → games.id |
| requester_id | BIGINT | FK → users.id |
| status | ENUM | PENDING, ACCEPTED, REJECTED |
| message | VARCHAR(300) | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |
| responded_at | TIMESTAMP | Set on accept/reject |

Unique: (game_id, requester_id)

#### messages

| Column | Type | Constraints |
|---|---|---|
| id | BIGINT | PK |
| sender_id | BIGINT | FK → users.id |
| receiver_id | BIGINT | FK → users.id |
| game_id | BIGINT | FK → games.id (nullable; set for group msgs) |
| content | TEXT | AES-256-GCM encrypted at rest |
| is_read | BOOLEAN | DEFAULT FALSE |
| created_at | TIMESTAMP | |
| read_at | TIMESTAMP | |

Indexes: `sender_id`, `receiver_id`, `(sender_id, receiver_id)`

#### ratings

| Column | Type | Constraints |
|---|---|---|
| id | BIGINT | PK |
| rater_id | BIGINT | FK → users.id |
| ratee_id | BIGINT | FK → users.id |
| game_id | BIGINT | FK → games.id |
| rating_type | ENUM | FOR_HOST, FOR_PARTICIPANT |
| punctuality | INT (1–5) | |
| skill_match | INT (1–5) | |
| friendliness | INT (1–5) | |
| review_text | VARCHAR(500) | |
| created_at | TIMESTAMP | |

Unique: (rater_id, ratee_id, game_id)
Indexes: `ratee_id`, `game_id`, `rating_type`

#### notifications

| Column | Type | Constraints |
|---|---|---|
| id | BIGINT | PK |
| user_id | BIGINT | FK → users.id |
| type | ENUM | GAME_REQUEST, GAME_ACCEPTED, GAME_REJECTED, GAME_REMINDER, GAME_CANCELLED, RATING_RECEIVED, SYSTEM, WELCOME |
| title | VARCHAR(200) | |
| message | VARCHAR(500) | |
| is_read | BOOLEAN | DEFAULT FALSE |
| reference_id | BIGINT | Polymorphic |
| reference_type | VARCHAR(50) | e.g. 'GAME', 'RATING' |
| created_at | TIMESTAMP | |

Indexes: `user_id`, `created_at`, `(user_id, is_read)`

#### user_sports

| Column | Type |
|---|---|
| id | BIGINT PK |
| user_id | BIGINT FK → users.id |
| sport | VARCHAR(50) |
| skill_level | ENUM |
| created_at | TIMESTAMP |

Unique: (user_id, sport)

---

## 5. Authentication & Security

### 5.1 Auth Flow

```
User signs in (Google OAuth or email/password)
  → Firebase Auth issues ID token
  → Frontend calls POST /api/auth/firebase-sync with ID token
  → Backend verifies token via Firebase Admin SDK
  → Creates or updates user in PostgreSQL
  → Returns JWT (24h access + 7d refresh) + user role
  → Frontend stores JWT; attaches as Authorization: Bearer header
```

### 5.2 Role-Based Access

| Role | Access |
|---|---|
| `user` | All public endpoints, own profile, games, messages, ratings |
| `admin` | Everything above + `/api/admin/**` (analytics, user/game CRUD) |

Admin role is stored in the `users.role` column. Frontend `useAuth()` reads role from the `/auth/firebase-sync` response (backend DB is the source of truth).

### 5.3 Security Configuration

- **CORS:** Configured via `cors.allowed-origins` property; only whitelisted origins allowed.
- **JWT Filter:** Validates token on every protected request; extracts user ID for downstream use.
- **Swagger/Actuator:** Permitted unauthenticated in dev; locked down in prod.
- **CSRF:** Disabled (stateless JWT-based API).

### 5.4 Message Encryption

See [Section 8](#8-message-privacy--encryption) for full AES-256-GCM details.

---

## 6. Core Features

### 6.1 User Profiles

- Name, age (18+), gender, bio, profile photo (Cloudinary, max 10 MB)
- Location (lat/lng auto-detect or manual), city, address
- Multi-sport selection with per-sport skill level
- Email verification (OTP, mandatory), optional ID verification badge
- Ratings: overall average, punctuality, skill match, friendliness
- Stats: total games, no-show count, reliability score

### 6.2 Game Posting

- Sport selection (20+ types + `OTHER`)
- Skill level requirement
- Date/time picker (today + 30 days), duration selector
- Location (address, lat/lng, city)
- Max players (up to 40), cost per person, equipment info
- Overlap check: cannot create a game that overlaps with another active game

### 6.3 Game Discovery & Filtering

- **Location-based:** Radius filtering, sort by distance
- **Sport type:** Multi-select filter
- **Date/time:** Today, Tomorrow, This Weekend, custom range
- **Skill level:** Exact match or "all levels"
- **Availability:** Only games with open slots shown

### 6.4 Request-Only Joining

1. Player sends a **join request** with optional message
2. System validates: no time conflicts, no duplicate requests, slots available, 10-min deadline before game start
3. Host receives push notification + in-app notification
4. Host reviews requester profile (rating, games played, skill level)
5. **Accept:** Player added to participants + group chat; auto-welcome DM sent
6. **Reject:** Player notified with optional reason
7. Scheduler cleans up expired requests

### 6.5 Game Status Lifecycle

| Status | Condition |
|---|---|
| `UPCOMING` | Not cancelled, start time in future, has open slots |
| `LIVE` | Currently within the game time window |
| `COMPLETED` | Past end time (start + duration) |
| `CANCELLED` | `isCancelled = true` |
| `FULL` | Not cancelled, upcoming, all slots filled |

Status is **computed at API response time** — not stored in the database.

Frontend badges:
- LIVE → green pulsing dot
- FULL → amber badge
- COMPLETED/CANCELLED → greyed card with disabled button

### 6.6 Post-Game Ratings

- **Bidirectional:** Host rates participants (`FOR_PARTICIPANT`); participants rate host (`FOR_HOST`)
- **Three categories (1–5 stars each):** Punctuality, Skill Match, Friendliness
- **Optional text review** (500 chars)
- **One rating per rater-ratee-game** (unique constraint)
- Profile shows separate "Hosting Ratings" and "Joining Ratings" sections

### 6.7 Notifications

- Push notifications via Firebase Cloud Messaging (FCM)
- In-app notification bell with unread count
- Types: game request, accepted, rejected, reminder, cancelled, rating received, system, welcome
- Silent notification toggle per user

---

## 7. Messaging System

### 7.1 Direct Messages (DMs)

- 1-on-1 private chat between two users
- **Requires a shared active game** — cannot DM someone with no common active game
- WebSocket real-time delivery via `/topic/conversation/{id}`
- Read receipts, typing indicators
- Auto-welcome DM sent when a request is accepted

### 7.2 Group Chat

- Auto-created per game; all accepted participants + host are members
- WebSocket channel: `/topic/game-group/{gameId}`
- Deduplication on server (sender + timestamp + content)
- Group chat disabled after game ends (backend rejects, frontend shows warning)

### 7.3 Contacts / Inbox

- Shows DM conversations with latest message + unread count
- **Only returns contacts from active games** — ended-game contacts disappear

### 7.4 Post-Game Message Lock

When a game ends or is cancelled:
- Backend rejects new messages with HTTP 400
- Frontend shows amber warning: "This game has ended. New messages are disabled."
- Text input and send button are disabled

---

## 8. Message Privacy & Encryption

### 8.1 Encryption at Rest (AES-256-GCM)

| Property | Value |
|---|---|
| Algorithm | AES-256-GCM (Galois/Counter Mode) |
| Key size | 256 bits (32 bytes) |
| IV / Nonce | 96 bits (12 bytes), random per message |
| Auth-tag size | 128 bits |
| Storage format | Base64( IV ‖ ciphertext ‖ auth-tag ) |
| DB column | `messages.content` (PostgreSQL TEXT) |

**Flow:**
1. Random 12-byte IV generated via `SecureRandom` for every message.
2. Plaintext encrypted with AES/GCM/NoPadding using the app-wide 256-bit key.
3. IV prepended to ciphertext + tag → Base64-encoded → stored in `content` column.
4. On read: Base64 decode → extract IV → AES-GCM decrypt → return plaintext.
5. Legacy unencrypted messages handled gracefully (returns raw content if decryption fails).

**Key management:**
```bash
# Generate key
openssl rand -base64 32

# Set in .env
PLAYMATE_MSG_ENCRYPTION_KEY=<base64-key>
```

Spring property: `playmate.msg.encryption-key=${PLAYMATE_MSG_ENCRYPTION_KEY}`

> **Key rotation** requires re-encrypting all existing messages (decrypt with old key, re-encrypt with new key) during a maintenance window.

**Important:** This is server-side encryption at rest. The server holds the key and can read messages in memory during request processing. API transport is protected by HTTPS/WSS (TLS). FCM push notifications and WebSocket broadcasts use plaintext (not the encrypted DB value).

### 8.2 Automatic Message Deletion

When a game **ends** (now > start + duration + 30 min grace) or is **cancelled/deleted**:

| Message Type | Purge Rule |
|---|---|
| Group chat | All messages with the game's `gameId` deleted immediately |
| Direct messages | DMs between each pair of participants deleted **only if** that pair shares no other active game |

**Purge triggers:**
- `GameService.cancelGame()` — host cancels
- `GameService.deleteGame()` — host deletes
- `CleanupScheduler` — runs every 15 minutes; finds games from last 7 days past end+30min

### 8.3 Active-Game-Only Messaging

- DMs blocked between users who share no active game (HTTP 400)
- Contacts endpoint only returns users from active games
- Frontend filters out ended/cancelled games from group chat list

### 8.4 Data Flow Diagram

```
User types message
       │
       ▼
 ┌────────────┐     plaintext used for
 │ Controller  │ ──► FCM push + WebSocket broadcast
 └─────┬──────┘
       │
       ▼
 ┌────────────┐
 │  Encrypt   │  AES-256-GCM + random IV
 └─────┬──────┘
       │
       ▼
 ┌────────────┐
 │ PostgreSQL │  stores Base64(IV ‖ ciphertext ‖ tag)
 └─────┬──────┘
       │ on read
       ▼
 ┌────────────┐
 │  Decrypt   │  extract IV → AES-GCM decrypt → plaintext
 └─────┬──────┘
       │
       ▼
  JSON response (plaintext)
```

### 8.5 Threat Model

| Threat | Mitigation |
|---|---|
| Database breach | Content is AES-256-GCM encrypted |
| Key compromise | Rotate key + re-encrypt (manual) |
| In-transit interception | HTTPS + WSS (TLS) |
| Messages retained after game | Auto-purge on game end/cancel |
| Messaging ex-participants | Blocked if no shared active game |

---

## 9. Admin Dashboard

### 9.1 Overview

Located at `AdminDashboard.tsx`. Fetches **20 API endpoints** in parallel on mount. Requires `role = "admin"`.

### 9.2 Dashboard Sections

| Section | Description |
|---|---|
| **KPI Row 1 (6 cards)** | Total Users, Active Games, Completed %, Cancelled %, Positive Mood %, Weekly Growth % |
| **KPI Row 2 (6 cards)** | Join Requests (pending), Accept Rate %, Avg Response Time, Total Messages (unread), DM Conversations, Fill Rate % |
| **India Choropleth Map** | State-level game density heatmap (react-simple-maps, district GeoJSON, zoom/pan/hover) |
| **Feedback Sentiment Donut** | Positive / Neutral / Negative from real ratings |
| **User Retention** | DAU / WAU / MAU with percentage rates |
| **Game Lifecycle Funnel** | Created → Upcoming → Live → Completed → Cancelled (bar chart) |
| **30-Day Trend** | Daily game creation line chart |
| **Revenue Chart** | Monthly revenue (pricePerPlayer × currentPlayers) |
| **Sport Distribution** | Progress bars + stacked bar (active vs cancelled per sport) |
| **Area Analytics Table** | Sortable city-level stats (Total, Players, Completed, Cancelled) |
| **Activity Feed** | Latest 20 game creation events |
| **Host Leaderboard** | Top 10 hosts by games created + avg rating |
| **Player Leaderboard** | Top 10 players by games played + avg rating + city |
| **No-Show Tracking** | Users with highest no-show counts/rates |
| **Verification Stats** | Pie chart: Fully Verified / Email Only / Unverified |
| **Game Fill Rate** | Avg fill %, donut (Full / 50–99% / <50%) |
| **Peak Hours Heatmap** | 7 × 24 grid (Mon–Sun × hours 0–23) |
| **System Health** | PostgreSQL UP/DOWN, Redis status, JVM memory, CPU, entity counts |

### 9.3 Admin Controls

- **CSV Export:** Area stats, leaderboards, no-show data
- **Refresh:** Re-fetches all 20 endpoints
- **Manage Users:** Navigate to `/admin/users` for full CRUD

### 9.4 Admin Management Endpoints

| Endpoint | Action |
|---|---|
| `GET /api/admin/users` | List all users |
| `GET /api/admin/users/{id}` | Get user |
| `PUT /api/admin/users/{id}` | Full update |
| `PATCH /api/admin/users/{id}` | Partial update |
| `DELETE /api/admin/users/{id}` | Delete user |
| `GET /api/admin/games` | List all games |
| `GET /api/admin/games/{id}` | Get game |
| `PUT /api/admin/games/{id}` | Full update |
| `PATCH /api/admin/games/{id}` | Partial update |
| `DELETE /api/admin/games/{id}` | Delete game |

---

## 10. API Reference

### 10.1 Conventions

- **Base URL:** `/api` (Vite proxy forwards to backend in dev)
- **Auth:** `Authorization: Bearer <JWT>` header on protected endpoints
- **Format:** JSON request/response
- **Pagination:** `?page=1&size=20` (max 100)
- **Sorting:** `?sortBy=createdAt&sortOrder=desc`
- **Errors:** `{ "error": true, "message": "...", "code": "ERROR_CODE" }`

### 10.2 Auth Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register with email/password |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/firebase-sync` | Sync Firebase user (Google OAuth) → returns JWT + role |
| POST | `/api/auth/refresh` | Refresh access token |

### 10.3 User Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/users/me` | Current user profile |
| PUT | `/api/users/me` | Update profile |
| GET | `/api/users/{id}` | Get user by ID |
| POST | `/api/users/me/photo` | Upload profile picture |

### 10.4 Game Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/games` | Create game |
| GET | `/api/games` | List public games (discovery) |
| GET | `/api/games/my` | My games (hosted + joined) |
| GET | `/api/games/{id}` | Get game details |
| GET | `/api/games/{id}/participants` | List participants |
| POST | `/api/games/{id}/cancel` | Cancel game (host only) |
| DELETE | `/api/games/{id}` | Delete game (host only) |

### 10.5 Game Request Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/games/{id}/requests` | Send join request |
| GET | `/api/games/{id}/requests` | List requests for game |
| POST | `/api/games/{id}/requests/{reqId}/accept` | Accept request |
| POST | `/api/games/{id}/requests/{reqId}/reject` | Reject request |
| GET | `/api/requests/my` | My sent requests |
| GET | `/api/requests/host` | Requests for my hosted games |

### 10.6 Message Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/messages` | Send DM |
| GET | `/api/messages/conversation/{userId}` | DM conversation |
| GET | `/api/messages/inbox` | Inbox (DM summaries) |
| GET | `/api/messages/contacts` | Active contacts |
| POST | `/api/messages/group/{gameId}` | Send group message |
| GET | `/api/messages/group/{gameId}` | Group chat history |
| POST | `/api/messages/read/{messageId}` | Mark message read |

### 10.7 Rating Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/ratings` | Submit rating |
| GET | `/api/ratings/user/{userId}` | All ratings for user |
| GET | `/api/ratings/user/{userId}/as-host` | Ratings received as host |
| GET | `/api/ratings/user/{userId}/as-participant` | Ratings received as participant |

### 10.8 Admin Statistics Endpoints (20 total)

| Endpoint | Description |
|---|---|
| `GET /api/admin/stats/users` | Total, new today, active 7/30 days, verified |
| `GET /api/admin/stats/games` | Total, upcoming, live, completed, cancelled |
| `GET /api/admin/stats/lifecycle` | Funnel data, completion/cancellation rates |
| `GET /api/admin/stats/area` | Per-city breakdown |
| `GET /api/admin/stats/sentiment` | Positive/neutral/negative, avg score |
| `GET /api/admin/stats/retention` | DAU, WAU, MAU, weekly growth |
| `GET /api/admin/stats/trend` | 30-day daily game creation trend |
| `GET /api/admin/stats/sport-lifecycle` | Per-sport active vs cancelled |
| `GET /api/admin/stats/sport-distribution` | Per-sport counts (pie chart) |
| `GET /api/admin/stats/revenue` | Monthly revenue |
| `GET /api/admin/activity/recent` | Last 20 game events |
| `GET /api/admin/stats/requests` | Join request stats + acceptance rate |
| `GET /api/admin/stats/messaging` | Message counts, DMs, groups, unread |
| `GET /api/admin/stats/host-leaderboard` | Top 10 hosts |
| `GET /api/admin/stats/player-leaderboard` | Top 10 players |
| `GET /api/admin/stats/no-shows` | No-show tracking |
| `GET /api/admin/stats/verification` | Verification breakdown |
| `GET /api/admin/stats/peak-hours` | 7 × 24 heatmap |
| `GET /api/admin/stats/fill-rate` | Average game fill rate |
| `GET /api/admin/stats/system-health` | DB, Redis, JVM, entity counts |

---

## 11. Setup & Running

### 11.1 Prerequisites

- Java 21+ and Maven (or use the included `mvnw`)
- Node.js 18+ and npm
- PostgreSQL instance (or use configured Supabase)
- Redis (optional, for OTP caching)

### 11.2 Environment Variables

Copy `.env.example` to `.env` at the project root and fill in:

```env
# Database
SPRING_DATASOURCE_URL=jdbc:postgresql://...
SPRING_DATASOURCE_USERNAME=...
SPRING_DATASOURCE_PASSWORD=...

# JWT
JWT_SECRET=your-secret
JWT_EXPIRATION=3600000

# Firebase
FIREBASE_PROJECT_ID=your-project-id

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Brevo Email
BREVO_API_KEY=...
BREVO_SENDER_EMAIL=noreply@playmate.com
BREVO_SENDER_NAME=PlayMate

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=...

# Message Encryption (AES-256-GCM)
# Generate: openssl rand -base64 32
PLAYMATE_MSG_ENCRYPTION_KEY=...

# Server
BACKEND_PORT=8080
FRONTEND_PORT=5173
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080
```

Frontend `.env` (copy `frontend/.env.example`): Firebase client config (`VITE_FIREBASE_*`).

### 11.3 Run Backend

```bash
cd backend
./mvnw spring-boot:run        # dev mode, port 8080
```

Or build and run the jar:

```bash
./mvnw -DskipTests package
java -jar target/backend-0.0.1-SNAPSHOT.jar
```

### 11.4 Run Frontend

```bash
cd frontend
npm install
npm run dev                    # Vite dev server, port 5173
```

The Vite dev proxy forwards `/api` → `http://localhost:8080/api`.

### 11.5 WebSocket

Endpoint: `/ws` (STOMP over SockJS). Same path for dev and prod.

### 11.6 Dev Seeder

Set `app.dev.seed.enabled=true` in `.env` to enable `POST /internal/dev/seed-admin` for local/CI admin seeding. **Never enable in production.**

### 11.7 Swagger UI

Available at `http://localhost:8080/swagger-ui/index.html` when running in dev.

---

## 12. Testing

### 12.1 Backend Tests

```bash
cd backend
./mvnw test
```

### 12.2 Cypress E2E

Ensure both backend (:8080) and frontend (:5173) are running:

```bash
cd frontend
npm run cy:run                  # headless
npx cypress open                # interactive GUI
```

**Specs:**
- `smoke.spec.ts` — auth, profile, game create/join, messaging
- `admin.spec.ts` — admin endpoint protection
- `admin_seeded.spec.ts` — admin dashboard with seeded data
- `messages_edge.spec.ts` — messaging edge cases

### 12.3 Integration Test Gates

Cloudinary/Brevo integration tests are gated. Enable with:

```bash
CLOUDINARY_INTEGRATION=true BREVO_INTEGRATION=true npm run cy:run
```

### 12.4 Frontend ↔ Backend Alignment Checklist

- Profile fields must match `UserProfileUpdateRequest` DTO
- `sports` is `[{ sportType: string, skillLevel: string }]`
- Game `startTime` format: `YYYY-MM-DDTHH:MM:SS` (no timezone Z)
- Attach `Authorization: Bearer <token>` on all protected calls

---

## 13. Deployment

### 13.1 Frontend Production Build

```bash
cd frontend
npm run build
# dist/ contains static files → deploy to Vercel, Netlify, S3+CloudFront, or Nginx
```

### 13.2 Backend Production Build

```bash
cd backend
./mvnw -DskipTests package
java -jar target/backend-0.0.1-SNAPSHOT.jar
```

Set all env vars (DB, JWT secret, Firebase service account, Cloudinary, Brevo, encryption key) in the production environment.

### 13.3 Docker

The backend uses a multi-stage Dockerfile at `backend/Dockerfile`:

```dockerfile
# Stage 1 — Build
FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2 — Runtime
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

Frontend: build `dist/` then deploy to Vercel (zero config with `vercel.json` SPA rewrites).

> **Full step-by-step deployment instructions → see [DEPLOYMENT.md](DEPLOYMENT.md)**

---

## 14. Roadmap

### Completed

- User profiles with sports, skills, verification
- Game creation, discovery, filtering
- Request-only joining with 10-min deadline
- DM + group chat (WebSocket real-time)
- AES-256-GCM message encryption at rest
- Auto-purge of messages on game end/cancel
- Active-game-only messaging restriction
- Bidirectional post-game ratings (host ↔ participant)
- Admin dashboard (20 analytics endpoints, India map, charts, CSV export)
- Firebase Auth (Google + email/password), FCM push notifications
- Cloudinary image uploads, Brevo email service
- Cypress E2E test suite

### Planned

- Brevo transactional emails (OTP, welcome)
- Recurring games and private groups
- Venue database (community-sourced)
- Advanced location-based search with map view
- Enhanced safety features (emergency contacts, SOS)
- Gamification (badges, streaks, leaderboards for users)
- PWA enhancements (offline access, add-to-home-screen)
- Payment integration for game cost tracking

---

## Implementation Files Reference

| File | Purpose |
|---|---|
| `MessageEncryptionService.java` | AES-256-GCM encrypt / decrypt |
| `MessageService.java` | Message CRUD, encryption wiring, lifecycle purge |
| `GameService.java` | Game CRUD, cancel/delete → purge messages |
| `GameRequestService.java` | Join request flow (create, accept, reject) |
| `CleanupScheduler.java` | Periodic purge of ended-game messages (every 15 min) |
| `AdminController.java` | All `/api/admin/**` REST endpoints |
| `AdminService.java` | Analytics logic (20+ methods) |
| `AdminDashboard.tsx` | Frontend admin dashboard (20 parallel API fetches) |
| `Messages.tsx` | Frontend messaging UI (DM + group + error handling) |
| `Games.tsx` | Game discovery, status badges, request-to-join |
| `Profile.tsx` | User profile with hosting/joining rating sections |
| `application.properties` | Backend configuration (DB, JWT, encryption key, etc.) |
| `.env` / `.env.example` | Environment variables |
