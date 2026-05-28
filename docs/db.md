# Local PostgreSQL (Clarwiz)

Clarwiz uses **one** PostgreSQL database: `clarwiz` on `localhost:5432`.

On this machine the canonical install is **system PostgreSQL 18** (not Docker, not Homebrew):

| | |
|---|---|
| **Data directory** | `/Library/PostgreSQL/18/data` |
| **Service** | PostgreSQL 18 (macOS installer / pgAdmin stack) |
| **Database** | `clarwiz` |
| **User** | `postgres` (password must match your install — see `.env`) |

Next.js and Prisma read `DATABASE_URL` from `.env` at the project root.

---

## Environment

Copy `.env.example` to `.env` and set:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/clarwiz?schema=public"
```

Use the password you set when installing PostgreSQL 18. Do not commit `.env`.

---

## Before you develop (avoid the wrong database)

Several Postgres installs can exist on one Mac (system, Homebrew, Docker). They all default to port **5432**, but each has **its own data**. Same `DATABASE_URL` does not mean same data — only whichever server owns `5432` is used.

**Run this every time** you start work or data looks wrong:

```bash
psql "$DATABASE_URL" -c "SHOW data_directory;"
```

You must see:

```text
/Library/PostgreSQL/18/data
```

If you see `/opt/homebrew/...` or a Docker path, you are **not** on Clarwiz’s real database. Stop and fix [Conflicts](#conflicts-on-port-5432) before migrating or saving data.

Optional quick row check:

```bash
psql "$DATABASE_URL" -c 'SELECT COUNT(*) AS users FROM "User";'
```

---

## Conflicts on port 5432

Only **one** process may listen on `5432`. If another starts first, Clarwiz will silently use a different dataset (empty DB, old DB, or auth errors).

| Install | Typical path | Clarwiz? |
|---------|----------------|----------|
| **System PostgreSQL 18** | `/Library/PostgreSQL/18/data` | **Yes — use this** |
| Homebrew `postgresql@18` | `/opt/homebrew/var/postgresql@18` | No — keep stopped |
| Docker `clarwiz-pg` | Docker volume | No — do not start on `5432` for daily work |

### Keep Homebrew off port 5432

```bash
brew services stop postgresql@18
```

Leave it stopped unless you use Homebrew Postgres for **other** projects (on a different port).

### Do not use Docker Clarwiz DB for daily work

If `clarwiz-pg` was created earlier, it is a **separate** empty database. Do not run:

```bash
docker start clarwiz-pg   # only if you intentionally want the Docker copy, not system PG
```

To free `5432` for system Postgres after Docker was started:

```bash
docker stop clarwiz-pg
```

### Ensure system Postgres is running

Use **pgAdmin**, the **PostgreSQL 18** menu app, or your usual method to start the server. Then verify `SHOW data_directory` as above.

---

## Migrations

```bash
npm run db:migrate
```

Run only after `SHOW data_directory` confirms system Postgres. Never run migrations against Docker/Homebrew unless you mean to change that copy.

---

## Prisma Studio

```bash
npm run db:studio
```

Studio uses the same `DATABASE_URL` as the app. If Studio shows unexpected rows, run the `data_directory` check again.

---

## Bootstrap first super admin

After signing in with Google once:

```sql
UPDATE "User" SET "is_superadmin" = true WHERE email = 'your@email.com';
```

Run via psql, pgAdmin, or Prisma Studio — connected to the same `clarwiz` on system Postgres.

To create a first tenant admin membership manually (if needed):

```sql
INSERT INTO "user_tenant_roles" ("id", "tenant_id", "user_id", "role", "scopes", "created_at", "updated_at")
VALUES (
  gen_random_uuid()::text,
  'your-tenant-id',
  'your-user-id',
  'admin',
  ARRAY[]::text[],
  NOW(),
  NOW()
);
```

---

## Troubleshooting

### Wrong or “missing” data (yesterday empty, today old, etc.)

You switched Postgres instances, not lost data in one DB. Check:

```bash
psql "$DATABASE_URL" -c "SHOW data_directory;"
lsof -i :5432
brew services list | grep postgres
docker ps -a --filter name=clarwiz-pg
```

Fix conflicts, then reconnect Prisma Studio / restart `npm run dev`.

### `P1010` / authentication failed

- Wrong password in `DATABASE_URL` for **system** `postgres` user, or
- Server on `5432` is not system Postgres (e.g. Homebrew has no `postgres` role).

Align `.env` with system Postgres credentials and confirm `data_directory`.

### `P1001` / can’t reach database

System Postgres is not running, or nothing is listening on `5432`.

---

## Optional: Docker (not used for Clarwiz data)

For experiments only, on a **different host port** so it never steals `5432`:

```bash
docker run -d --name clarwiz-pg-dev \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=clarwiz \
  -p 5433:5432 \
  postgres:16
```

Use `localhost:5433` in a separate env file — never point main `.env` at this unless you intend to abandon system PG data.

---

## Checklist (save this habit)

1. System PostgreSQL 18 is running.
2. `brew services stop postgresql@18` (if it was ever started).
3. `docker stop clarwiz-pg` if Docker was used recently.
4. `psql "$DATABASE_URL" -c "SHOW data_directory;"` → `/Library/PostgreSQL/18/data`.
5. `npm run dev` / `npm run db:migrate` / Prisma Studio.
