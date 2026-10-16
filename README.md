# PureGasly — MERN (Phase 5)

LPG delivery marketplace: customers order from stores, stores fulfil and track sales, and an admin approves and moderates stores and users.

```
server/   Express API + MongoDB (Mongoose)
client/   React app (Vite)
render.yaml   One-click Render deployment (API + static site)
```

## What's new in Phase 5

**Built-in admin**
- The admin account is created automatically every time the API starts (no seeding needed).
  - Email: `PGAdmin@pgas.com`
  - Password: `Pg@s365T`
- Emails are case-insensitive, so `pgadmin@pgas.com` works too.
- Change it for production with `ADMIN_EMAIL` / `ADMIN_PASSWORD` in the server environment. The password is only applied when the account is first created, so if you change it later, change it in the database too (or delete the admin user and restart).

**Store approval**
- Registering as a Store Owner creates a **pending** store. Neither the owner nor their employees can log in until an admin approves it (they see a clear message). Rejected applications show the admin's reason.
- Stores that existed before this update are automatically marked approved.

**Customer**
- Browse **stores** and **LPG products**, with search plus sorting: lowest/highest price, highest/lowest sales, and a **Promos only** filter (products also filter by type and min/max price).
- Cart (one store per order) and checkout — Cash on Delivery.
- **Order phases:** Placed → Preparing → Out for Delivery → Delivered → Received. The customer presses **ORDER RECEIVED** once the store marks it Delivered. Customers can cancel while an order is still New. The Orders page refreshes automatically.

**Store (owner, or employees with permission)**
- **Orders:** New orders appear in a queue. Press *Accept · Start Preparing*, then *Out for Delivery*, then *Mark as Delivered* (or *Decline* a new order).
- **Inventory & Sales:** add products, set a **sale price** (shows as a Promo to customers), stock, low-stock alerts, hide/show products, KPI strip and filters (low stock, out of stock, on sale, hidden).
- **Analytics:** revenue today / period / all-time, revenue-per-day chart (7/30/90 days), top products, orders by status, inventory health.
- Store profile (address, phone, description) shown to customers.
- New employee permission: **View Analytics**.
- More security: see below.

**Admin**
- **Store Applications:** approve or reject (with reason).
- **Stores:** ban / reinstate stores; review **appeals**.
- **Users:** view customers, store owners and employees; ban / unban with a reason.
- **Banned store:** employees are locked out and the store is hidden from customers. Only the **owner** can log in, and sees a pop-up with the ban reason and a form to **send a re-appeal**. The admin can approve or deny the appeal. Orders nobody had accepted yet are cancelled and their stock returned.

**Security additions**
- Every request re-checks the account, so bans/suspensions apply immediately (not at token expiry).
- Store data is always scoped to the user's own store; IDs are validated; prices are always calculated on the server; stock is reserved atomically (no overselling).
- JWT locked to HS256, request body size limit, general API rate limit plus the stricter login/register limit, `trust proxy` for Render, helmet, NoSQL-injection sanitising, CORS restricted via `CLIENT_ORIGIN`.
- Password rules (8+ characters with a letter and a number) now apply to registration and employee creation, on both client and server.

---

## What's new in Phase 6

**🔔 Notifications**
- An in-app bell (top bar) shows updates in real time-ish (polls every 20s): new orders (store), order status changes (customer), rider assignments (rider), store approval/rejection/ban/unban and appeal results (owner), and new reviews (owner).
- Click a notification to jump to the relevant page; "Mark all read" clears the badge.

**🛵 Riders**
- New `rider` role. Owners (or employees with the new **Manage Riders** permission) add/remove riders under **Riders** in the nav.
- A store can assign a rider to an order once it's **Preparing** (dropdown on the order card in **Orders**). Once assigned, the rider has their own dashboard and personally owns the *Out for Delivery → Delivered* steps for that order — the store doesn't have to do it themselves anymore (though they still can).

**🧾 PDF Receipts**
- Customers and stores can download a one-page PDF receipt for any **Delivered**/**Received** order (⬇ Receipt button).

**⭐ Ratings & Reviews**
- Customers can rate (1–5 stars) and leave a comment once an order is **Received** — one review per order.
- Store average rating + count shows on store cards, the store detail page, and the new "Highest rated" sort option.
- Store owners/employees (with View Analytics) see their reviews on the **Analytics** page.
- Admin has a **Reviews** tab to remove inappropriate reviews.

**🌙 Dark Mode**
- Toggle button in the top bar (🌙/☀️), saved per-browser.

---

## What's new in Phase 7 (security)

**🔒 Account lockout**
- 5 wrong passwords in a row locks the account for 15 minutes (HTTP 423), separate from and in addition to the existing login rate limit.
- A successful login, or an admin unbanning the user, clears the lockout immediately.

**🔁 Refresh tokens + session management**
- Access tokens now last 15 minutes instead of 2 hours; a refresh token (30 days, rotates on every use, stored only as a hash in the database) silently renews the session in the background — the person generally never has to log in again just because 15 minutes passed.
- New **Security** page (🔒 icon in the top bar) lists every device currently logged in, lets you log out a specific one, or **Log out everywhere**.
- Logging out (or being banned/suspended) revokes the refresh token server-side too, not just on the device itself.

**📋 Admin audit log**
- Every approve, reject, ban, unban, appeal decision, and review removal an admin makes is now recorded with who did it and when.
- New **Audit Log** tab on the Admin dashboard.

---

## What's new in Phase 10

**❤️ Favorites**
- Customers can heart a store or product from the shop and product cards; a new **Favorites** page lists everything saved, split into Stores / Products tabs.

**📍 Saved addresses**
- Customers can save multiple delivery addresses (labeled, e.g. "Home"/"Work") under a new **Addresses** page, and pick one from a dropdown at checkout instead of retyping it every time. One is always marked default.

**🎟️ Coupons**
- Store owners (or employees with a new **Manage Coupons** permission) create promo codes — percent or fixed-amount off, with an optional minimum order, usage limit, and expiry date — under a new **Coupons** page.
- Customers enter a code at checkout; it's validated and re-validated server-side (never trusted from the client), and the discount shows on the receipt and order history.

**📊 CSV export**
- **Orders** page (store side) and **Analytics** page both have an Export CSV button — order history (with coupon/discount columns) and the daily revenue series, respectively. Opens cleanly in Excel/Sheets.

---

## Run locally

Requirements: Node 18+ and MongoDB (local or Atlas).

```bash
# 1) API
cd server
npm install
cp .env.example .env      # then edit .env (see below)
npm run dev               # http://localhost:5000

# 2) Web (new terminal)
cd client
npm install
npm run dev               # http://localhost:5173  (proxies /api to :5000)
```

`server/.env`:
```
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/puregasly
JWT_SECRET=<a long random string>
```

Log in as the admin (`PGAdmin@pgas.com` / `Pg@s365T`). Optional demo store: `npm run seed:demo` in `server/` creates `demo.owner@puregasly.com` / `OwnerDemo123` (already approved).

### Try the whole flow
1. Register a **Store Owner** → try to log in → you'll see "waiting for approval".
2. Log in as admin → **Store Applications** → Approve.
3. Log in as the owner → **Inventory** → add a product (try a sale price).
4. Register a **Customer** → browse, add to cart, place an order.
5. Owner → **Orders** → Accept → Out for Delivery → Delivered.
6. Customer → **My Orders** → **ORDER RECEIVED**.
7. Admin → **Stores** → ban the store → log in as the owner to see the appeal pop-up → send an appeal → admin approves it from the Stores tab.

---

## Deploy on Render

You need: a GitHub repo containing this project, and a MongoDB Atlas cluster.

**1. MongoDB Atlas**
- Database Access: create a database user.
- Network Access: allow `0.0.0.0/0` (Render's IPs change).
- Copy the connection string and put your database name in it, e.g. `.../puregasly?retryWrites=true&w=majority`.

**2. Push to GitHub** (`.env` files are git-ignored — never commit them).

**3. Deploy with the Blueprint**
- Render → **New → Blueprint** → select the repo. It reads `render.yaml` and creates:
  - `puregasly-api` (Web Service) — env vars asked: `MONGODB_URI`, `CLIENT_ORIGIN`; `JWT_SECRET` is generated.
  - `puregasly-web` (Static Site) — env var asked: `VITE_API_URL`.
- The two URLs depend on each other, so do it in this order:
  1. Create the Blueprint; when asked, put your Atlas string in `MONGODB_URI` and temporary values for the other two.
  2. When both services exist, open **puregasly-api → Environment** and set `CLIENT_ORIGIN` to the site URL (e.g. `https://puregasly-web.onrender.com`, no trailing slash).
  3. Open **puregasly-web → Environment** and set `VITE_API_URL` to the API URL **plus `/api`** (e.g. `https://puregasly-api.onrender.com/api`), then **Manual Deploy → Clear build cache & deploy** (Vite bakes this value in at build time).
- Check `https://<your-api>.onrender.com/api/health` returns `{"status":"ok"}`. The built-in admin is created on first start.

**Manual setup instead of a Blueprint**
- API: Web Service, root directory `server`, build `npm install`, start `npm start`, health check `/api/health`, env vars as above.
- Site: Static Site, root directory `client`, build `npm install && npm run build`, publish directory `dist`, and add a **Rewrite** rule `/*` → `/index.html` (Redirects/Rewrites tab) so page refreshes work.

**Production checklist**
- Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` on the API before its first start, or change the built-in password afterwards.
- Rotate any database password that was ever shared in a zip/chat.
- Free Render web services sleep when idle — the first request after a break can take ~30–60 seconds.

---

## API overview

| Area | Endpoints | Who |
|------|-----------|-----|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` | public / any |
| Shop | `GET /api/shop/stores`, `/shop/stores/:id`, `/shop/products` | customer |
| Orders | `POST /api/orders`, `GET /api/orders/mine`, `GET /:id/receipt`, `PATCH /:id/received`, `/cancel` | customer |
| Store orders | `GET /api/store-orders`, `GET /:id/receipt`, `PATCH /:id/advance`, `/:id/decline`, `/:id/assign-rider` | owner / employee (`manage_orders`) |
| Inventory | `GET/POST /api/inventory`, `PATCH/DELETE /:id` | owner / employee (`manage_inventory`) |
| Analytics | `GET /api/analytics/summary?days=` | owner / employee (`view_analytics`) |
| Store | `POST /api/store/appeal`, `PATCH /api/store/profile` | owner |
| Employees | `/api/employees` | owner |
| Riders | `GET/POST /api/riders`, `DELETE /:id` | owner / employee (`manage_riders` for add/remove, `manage_orders` or `manage_riders` to view) |
| Rider orders | `GET /api/rider-orders`, `PATCH /:id/advance` | rider (only their assigned deliveries) |
| Reviews | `POST /api/reviews`, `GET /api/reviews/store` | customer / owner / employee (`view_analytics`) |
| Notifications | `GET /api/notifications`, `PATCH /:id/read`, `/read-all` | any logged-in user |
| Admin | `/api/admin/stats`, `/stores`, `/stores/:id/{approve,reject,ban,unban,appeal}`, `/users`, `/users/:id/{ban,unban}`, `/reviews`, `/reviews/:id` (delete), `/audit-log` | admin |
| Auth sessions | `POST /api/auth/refresh`, `/logout`, `/logout-all`, `GET /auth/sessions`, `DELETE /auth/sessions/:id` | any logged-in user |
| Favorites | `GET /api/favorites`, `/favorites/ids`, `POST /favorites`, `DELETE /favorites/:targetType/:targetId` | customer |
| Addresses | `GET/POST /api/addresses`, `PATCH /:id`, `PATCH /:id/default`, `DELETE /:id` | customer |
| Coupons | `GET/POST /api/coupons`, `PATCH/DELETE /:id` (`manage_coupons`), `POST /coupons/validate` (customer, cart preview) | owner / employee / customer |

## Notes / limits (by design)
- Payment is Cash on Delivery only.
- Sales are counted when an order reaches **Delivered** (by the store or by a rider).
- Assigning a rider is optional — the store can still move an order through every step itself if no rider is assigned.
- Orders already Preparing / Out for Delivery when a store is banned are left as they are; only unaccepted (New) orders are auto-cancelled.
- The order lists and the notification bell refresh by polling (15s / 20s), not live sockets.
- One review per order, only after the customer has pressed ORDER RECEIVED.

## Verification status
The server passes syntax checks and module-load checks, and the client builds cleanly (`npm run build`). The PDF receipt generator was rendered and visually checked. Token hashing, refresh-token expiry, lockout timing, and the coupon discount math (percent, fixed, and the "never exceeds the subtotal" cap) were unit-tested without a database. The full flows against a real MongoDB were **not** run in the build environment (no database available there) — please verify after deploying, especially: rider assignment → rider dashboard handoff, the review flow, logging in 5 times with a wrong password to confirm the lockout triggers and clears after 15 minutes, staying logged in past 15 minutes without being logged out (silent refresh), applying a coupon at checkout end-to-end, and that a saved address actually fills the checkout form.
