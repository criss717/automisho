# Secrets Rotation — AutoMisho

This document describes how to rotate sensitive credentials used by AutoMisho.

## Overview

Never commit real secrets to the repository. Use `front/.env.example` as a template and keep `front/.env.local` (gitignored) for local development.

Checked-in `.env.local` with real `sk_test`, `whsec`, `NEXTAUTH_SECRET` must be rotated immediately if exposed.

## NEXTAUTH_SECRET

Generate a new secret:

```bash
openssl rand -base64 32
```

Update in Vercel/environment and locally in `front/.env.local`:

```
NEXTAUTH_SECRET=<output>
```

Redeploy is required for NextAuth to pick up the new secret. Existing JWTs will be invalidated and users will need to re-login.

## GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET

1. Go to https://console.cloud.google.com/apis/credentials
2. Create or rotate OAuth 2.0 Client ID for the project
3. Update `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in env
4. Redeploy

## STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET

- **STRIPE_SECRET_KEY (`sk_test_...` / `sk_live_...`):** Roll in Stripe Dashboard → Developers → API keys → Roll key. Update env and redeploy. Old key is immediately invalid.

- **STRIPE_WEBHOOK_SECRET (`whsec_...`):** When rotating, re-run Stripe CLI:

  ```bash
  stripe listen --forward-to localhost:3000/api/webhooks/stripe
  ```

  Copy the new `whsec_...` to `STRIPE_WEBHOOK_SECRET`. For production, recreate webhook endpoint in Dashboard → Webhooks and copy signing secret.

- **Price IDs:** `STRIPE_PREMIUM_PRICE_ID` and `STRIPE_PRO_PRICE_ID` are not secrets but are environment-specific. Copy from Dashboard → Products → Prices (`price_...`).

## DATABASE_URL

`DATABASE_URL` contains the Postgres password:

```
postgresql://user:password@host:5432/db
```

To rotate:

1. Change password via provider (Supabase/Neon/Vercel Postgres) or `ALTER USER postgres PASSWORD 'newpassword'`
2. Update `DATABASE_URL` in Vercel and in local `.env.local`
3. Restart server and frontend

## OPENCODE_API_KEY / OPENCODE_BASE_URL

- **OPENCODE_API_KEY:** Obtain from https://opencode.ai/auth . If leaked, revoke in dashboard and generate a new key.
- **OPENCODE_BASE_URL:** Usually `https://opencode.ai/zen/go/v1` — not secret.
- **OPENCODE_MODEL:** `qwen3.7-plus` (default) — not secret. Can be overridden per env.

Environment variable `OPENCODE_MODEL` defaults to `qwen3.7-plus` with fallback to `deepseek-v4-pro` if the model is unavailable. No rotation needed for the model name.

## General Process

1. Generate/obtain new credential
2. Update in production (Vercel → Project → Settings → Environment Variables) and redeploy
3. Update `front/.env.local` locally
4. Verify with `npm run build --prefix front` and smoke test checkout/webhook
5. Invalidate old credential at provider
6. Ensure `gitleaks detect --no-git` and `git ls-files | grep .env` show no secrets

## CI Check

CI runs:

```bash
git grep -i "sk_test\|whsec_\|NEXTAUTH_SECRET" --cached && exit 1
gitleaks detect --no-git --verbose
```

Any secret found in tracked files fails the build.

## Contact

If a secret is suspected to be leaked, rotate immediately and notify the team via private channel. Do not post secrets in GitHub issues or PR comments.
