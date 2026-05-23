# Local PostgreSQL

## Docker

```bash
docker run -d --name clarwiz-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=clarwiz \
  -p 5432:5432 \
  postgres:16
```

Copy `.env.example` to `.env` and set `DATABASE_URL` (and other secrets). Both Next.js and Prisma read `.env` from the project root.

## Migrations

```bash
npm run db:migrate
```

## Prisma Studio

```bash
npm run db:studio
```

## Bootstrap first admin

After signing in with Google once:

```sql
UPDATE "User" SET role = 'admin' WHERE email = 'your@email.com';
```
