This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Assess workshop database (optional)

The `/assess` product can persist the full `AssessProgramV2` document to **Postgres** (one row, JSONB). Without a DB URL in the environment, assess data stays in the browser only. The app accepts **`DATABASE_URL`**, or **`POSTGRES_URL` / `POSTGRES_PRISMA_URL`** (Neon + Vercel templates) in that order.

1. Create a free dev database (Neon, Supabase, or Vercel Postgres).
2. Copy `.env.example` to `.env.local` and set **`DATABASE_URL`** (pooled) or paste Neon’s **`POSTGRES_URL`** as-is.
3. From the `forge-tower-explorer` directory, with the same env loaded:

   ```bash
   npm run db:migrate
   ```

4. Set `DATABASE_URL` in your deployment environment (e.g. Vercel) and run the same migration against production once.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
