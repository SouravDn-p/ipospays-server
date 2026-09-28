# ResPOS (SerVe) — Multi-Tenant Restaurant Management SaaS
### Project Concept Document

---

## 1. Overview

ResPOS is a multi-tenant SaaS platform for restaurant management and point-of-sale, comparable in capability to Lightspeed. The end customer is the **restaurant business itself (a tenant)**, not individual consumers. Restaurants subscribe to a plan and get role-based access for their staff — Owner, Manager, Staff, Server, Chef, Cashier, Runner, Bartender.

The platform has **two distinct surfaces**:
1. **Tenant-facing app** — used by restaurant owners and staff (POS, kitchen display, floor management, reporting)
2. **Platform Admin Dashboard** — used internally to manage tenants, subscription plans, and platform-wide operations

---

## 2. Tech Stack

- **Backend:** NestJS (Node.js/TypeScript)
- **Database:** PostgreSQL via Prisma ORM
- **Cache/Sessions/Rate-limiting:** Redis
- **Background Jobs:** BullMQ (Redis-backed queues)
- **Real-time:** WebSockets (Socket.IO via NestJS Gateways)
- **Frontend:** Next.js / TypeScript
- **Payments (tenant-side):** Cash, Card, bKash, Nagad, SSLCommerz, BanglaQR

---

## 3. Architecture Decision: Modular Monolith

**Chosen approach:** A single NestJS deployable app, internally split into clean, independent modules (`tenants`, `auth`, `billing`, `plans`, `staff`, `menu`, `orders`, `inventory`, `scheduling`, `reservations`, `analytics`, `admin/*`).

**Why not microservices (yet):**
- Avoids premature operational overhead (service discovery, distributed transactions, multi-deploy complexity) at a stage where a small team needs to move fast.
- Module boundaries inside the monolith mean any module can be extracted into its own service later without a rewrite, if/when scaling demands it (e.g., independent scaling of POS/kitchen traffic vs. analytics).
- Internal decoupling is achieved via NestJS `EventEmitter2` (in-process events) — giving microservice-style separation of concerns without deployment complexity.

**Revisit microservices when:** specific modules need independent scaling, or engineering headcount grows enough that module ownership becomes a coordination bottleneck.

---

## 4. Tenancy Hierarchy

```
Platform (SaaS owner)
 └── PlatformAdmin (SUPER_ADMIN / ADMIN / SUPPORT) — manages plans, tenants, subscriptions
      └── Tenant (a restaurant business)
           └── Subscription → Plan (defines limits: max locations, max staff, allowed roles, features)
           └── Owner (first user, created at signup — creates staff & assigns roles)
                └── Manager / Staff / Server / Chef / Cashier / Runner / Bartender
                     └── assigned to one or more Locations
           └── Location / Branch (a physical restaurant)
                └── Floor (Main Dining Room, Patio, Rooftop, etc.)
                     └── Table (shape, seats, position)
                └── CashDrawer (per branch, per terminal)
                └── InventoryStock (per branch — food cost/stock is location-specific)
           └── Menu (tenant-wide base menu + per-Location price/availability overrides)
```

**Key decision — shared menu, per-branch overrides:** `MenuItem` belongs to the Tenant; a `LocationMenuOverride` table holds per-location price/availability so food-cost data stays consistent across branches while allowing per-location pricing.

---

## 5. Multi-Tenancy Data Strategy

**Chosen approach: Shared database, row-level isolation (`tenantId` on every table).**

| Approach | Verdict |
|---|---|
| Shared DB, row-level (`tenant_id` column) | ✅ Chosen — cheapest, fastest to build, single migration path, easy cross-tenant analytics for platform admin |
| Shared DB, schema-per-tenant | Not chosen — harder migrations at scale |
| Database-per-tenant | Not chosen for now — reconsider only for specific enterprise tenants needing data residency/compliance guarantees |

**Enforcement pattern:**
- `tenantId` is **denormalized onto every table**, even child tables that could reach it via a parent join. This makes cross-tenant leaks structurally harder, not just logically prevented.
- A **global Prisma middleware** auto-injects/filters `tenantId` on every read/write.
- `tenantId` is **always derived from the JWT**, never trusted from request body/query params.
- Guards fail closed: if no tenant context exists, the query throws rather than silently returning unscoped data.

---

## 6. Core Schema (Prisma, simplified)

### Platform / Admin
- `PlatformAdmin` (id, email, passwordHash, role: SUPER_ADMIN/ADMIN/SUPPORT)
- `Plan` (name, priceMonthly, maxLocations, maxStaffPerLocation, allowedRoles[], features: Json, isPublic)
- `Subscription` (tenantId, planId, status: TRIALING/ACTIVE/PAST_DUE/SUSPENDED/CANCELED)
- `SubscriptionHistory` (fromPlanId, toPlanId, changedById, reason, createdAt)
- `AdminAuditLog` (adminId, action, targetType, targetId, metadata, createdAt)

### Tenancy & Staff
- `Tenant` (name, slug, status: ACTIVE/SUSPENDED/CANCELED, suspendedReason)
- `Location` (tenantId, name, timezone, currency, isActive)
- `User` (tenantId, username, passwordHash, pinCode) — `@@unique([tenantId, username])`
- `StaffAssignment` (userId, locationId, role, permissions: Json, isDefault)

### Floor & Tables
- `Floor` (tenantId, locationId, name, backgroundImage)
- `Table` (tenantId, floorId, number, shape, seats, posX, posY, status)

### Menu & Inventory
- `MenuCategory`, `MenuItem`, `Ingredient`, `RecipeIngredient` (recipe cost tracking)
- `LocationMenuOverride` (per-location price/availability)
- `InventoryStock` (locationId, ingredientId, quantityOnHand, reorderLevel)

### Orders & POS
- `Order` (tenantId, locationId, tableId, type: DIRECT_SALE/TABLE_SERVICE/TAKEAWAY/DELIVERY, status)
- `OrderItem` (orderId, menuItemId, seatNumber, prepStatus: NEEDS_COOKING/COOKING/READY/SERVED, courseNumber)
- `Payment` (orderId, method: CASH/CARD/BKASH/NAGAD/SSLCOMMERZ/BANGLAQR, amount, tip)

### Cash & Shifts
- `CashDrawer` (locationId, openedById, openingCash, closingCash, status)
- `CashMovement` (drawerId, type: ADD/REMOVE, amount, reason)

**Data-type conventions:** `Decimal` (never `Float`) for all money/quantity fields. Soft deletes (`deletedAt` / `isActive`) instead of hard deletes on `MenuItem`, `Order`, `User`, `Location` to preserve historical/reporting integrity.

---

## 7. Roles & Permissions

- Fixed base roles: `OWNER, MANAGER, STAFF, SERVER, CHEF, CASHIER, RUNNER, BARTENDER`
- **Which roles a tenant can use is gated by their subscription Plan** (`Plan.allowedRoles`)
- Granular permission flags (void receipts, view reports, transfer items, drawer access, etc.) are stored as `permissions: Json` on `StaffAssignment` — configurable checkboxes rather than a fixed enum, matching the PRD's permission model
- **Owner-driven staff creation:** no public self-signup for staff. The tenant Owner (or Manager, if permitted) creates user accounts directly and hands out credentials.

---

## 8. Auth Strategy

- **JwtAuthGuard-based auth** for tenant users (Owner/staff) — no PIN-based terminal login in the current phase.
- JWT payload: `{ userId, tenantId, role }`; active location resolved per-request (header or Redis session), validated against `StaffAssignment`.
- **Platform Admin auth is fully separate**: distinct `AdminAuthModule`, separate JWT secret, separate guard (`AdminAuthGuard`/`AdminRolesGuard`), ideally served on a distinct subdomain (`admin.yourapp.com`). An admin token can never pass a tenant guard and vice versa.
- Usernames are unique **per tenant**, not globally (`@@unique([tenantId, username])`), allowing login via tenant subdomain/slug + username.

---

## 9. Real-Time Architecture

- NestJS `@WebSocketGateway` using Socket.IO **rooms scoped per `locationId`** (not per tenant) — a kitchen display in one branch never receives noise from another.
- Flow: order/item status change → saved to DB → internal `EventEmitter2` event → Gateway broadcasts to `location:{id}:kds` room → Kitchen Display/Chef tablet updates instantly.
- Supports the "needs cooking → cooking → ready" `prepStatus` flow per `OrderItem`.
- POS terminals use a **local-first queue** (e.g., IndexedDB) with idempotency keys to survive network drops without duplicating orders.

---

## 10. Redis Usage

1. **Caching** read-heavy, rarely-changing data: tenant menu (`menu:{tenantId}`), plan limits/features (`plan:{tenantId}`), floor/table layout (`floor:{locationId}`) — invalidated on relevant writes.
2. **Session state**: active location per user session, avoiding the need to re-issue JWTs on location switch.
3. **Rate limiting**: `@nestjs/throttler` with a Redis store (required once running multiple app instances) — protects login/PIN endpoints from brute-forcing.

---

## 11. BullMQ Usage (async, non-blocking work)

Separate queues per concern so a backlog in one never delays another:
- `print-queue` — receipt/KOT printing, kitchen ticket dispatch (don't block the "send to kitchen" action on hardware/print calls)
- `reports-queue` — CSV/PDF report generation for large date ranges
- `billing-queue` — subscription/payment webhook processing (never process webhooks inline)
- `inventory-queue` — recipe-based ingredient stock deduction after order completion (with retry logic)

---

## 12. Subscription Plan Enforcement

- A single `PlanLimitService` is the source of truth, called by every relevant module — not scattered plan checks across controllers.
  - `checkCanAddLocation(tenantId)`
  - `checkCanAssignRole(tenantId, role)`
  - `checkFeatureEnabled(tenantId, featureKey)`
- **Downgrade policy:** excess locations/staff beyond a new plan's limits are **soft-locked** (`isActive: false`), never deleted. Tenant can upgrade again or manually remove excess to restore access.
- Every plan change writes a `SubscriptionHistory` row (`fromPlanId`, `toPlanId`, `changedById`, `reason`) — required for support/billing dispute resolution.

---

## 13. Platform Admin Dashboard

### Modules
1. **Plan Management** — CRUD subscription plans, define limits & features
2. **Tenant Management** — list/search tenants, view usage vs. limits, suspend/reactivate
3. **Subscription Management** — assign/change tenant plans, view change history
4. **Platform Admin Users** — manage SUPER_ADMIN/ADMIN/SUPPORT accounts
5. **Audit Log** — platform-wide record of admin actions
6. **Analytics Overview** — MRR, active tenants, churn, plan distribution
7. **Support Tools** — read-only visibility into tenant data for troubleshooting

### Key Endpoints
```
POST   /admin/auth/login
GET    /admin/plans                 POST /admin/plans                PATCH /admin/plans/:id/archive
GET    /admin/tenants               GET /admin/tenants/:id            PATCH /admin/tenants/:id/suspend
GET    /admin/tenants/:id/subscription   PATCH /admin/tenants/:id/subscription
GET    /admin/admins (SUPER_ADMIN)  POST /admin/admins
GET    /admin/audit-logs
GET    /admin/analytics/overview
```

### Frontend Pages
```
/admin/login
/admin/dashboard        → MRR, active tenants, churn snapshot
/admin/plans            → plan table + create/edit modal
/admin/tenants          → searchable/filterable tenant list
/admin/tenants/[id]     → profile, plan, usage bars, staff list, suspend action,
                           subscription history timeline
/admin/admins           → manage platform admin accounts (SUPER_ADMIN only)
/admin/audit-logs       → searchable activity feed
```

**Every mutating admin action is auto-logged** via a global `admin-audit.interceptor.ts` — not hand-written per service method.

---

## 14. Core User Flows

### Tenant Onboarding
```
1. Business signs up → Tenant + Owner User created, trial Subscription assigned
2. Owner creates first Location → creates Floors + Tables
3. Owner creates staff accounts → assigns Role + Location(s) + permissions
4. Staff logs in with tenant-scoped username + password → JWT issued
```

### Daily POS / Kitchen Flow
```
1. Server selects fulfillment type (Direct Sale or Table Service + seat selection)
2. Items attached to order / specific seats, grouped by course
3. Order sent to kitchen → OrderItem.prepStatus = NEEDS_COOKING
   → WebSocket event → Kitchen Display updates in real time
4. Chef updates status (COOKING → READY) → real-time push back to server/runner
5. Pre-payment check printed → payment collected → order closed
6. Inventory queue deducts recipe ingredients from InventoryStock
```

### Platform Admin — Plan Change Flow
```
1. Admin selects new plan for a tenant on /admin/tenants/[id]
2. System validates plan, checks current usage against new plan's limits
3. If downgrading and usage exceeds new limits → admin sees a warning before confirming
4. SubscriptionHistory row written; Subscription.planId updated
5. Cached plan:{tenantId} in Redis invalidated
6. Excess locations/staff (if any) soft-locked, not deleted
```

---

## 15. Security Checklist

- `tenantId`/`locationId` always derived from JWT + validated `StaffAssignment` — never trusted from client input
- Passwords and PINs hashed (bcrypt/argon2); PIN attempts rate-limited hard (low entropy)
- Full audit logging on cash drawer actions and role/permission changes
- Platform Admin auth fully isolated from tenant auth (separate secrets, guards, and ideally subdomain)
- Webhook signature verification required for all payment gateway callbacks before trusting payload data
- Idempotency keys on order/payment endpoints to handle POS terminal network retries safely

---

## 16. Open Items / Roadmap

- Dedicated storefront/landing pages per tenant (online presence) — under consideration
- PIN-based quick terminal login — deferred for now, JwtAuthGuard only in current phase
- Multi-currency support beyond per-location currency field
- Stripe (or equivalent) full billing sync for self-serve upgrades/downgrades