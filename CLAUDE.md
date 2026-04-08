# Instacrane

Clone Instagram open source, sans GAFAM, hébergé en France (Scaleway), RGPD-compliant, sans cookies.

## Stack

- **Frontend** : SvelteKit + Svelte 5 (runes syntax)
- **Backend** : Python 3.12 + FastAPI + SQLAlchemy 2.0 async
- **BDD** : PostgreSQL 16
- **Stockage images** : Scaleway Object Storage (S3-compatible)
- **Infra** : Terraform + Docker + GitHub Actions
- **Auth** : JWT en header Authorization (pas de cookies)

## Conventions

- Commits en français, format conventionnel (feat:, fix:, docs:, etc.)
- Code Python : ruff + black
- Frontend : Svelte 5 runes ($state, $derived, $effect), vanilla CSS
- API : FastAPI avec async, SQLAlchemy AsyncSession
- Toute PR doit passer les tests et le lint

## Structure

```
backend/       → API FastAPI
frontend/      → App SvelteKit
infra/         → Terraform (Scaleway)
.github/       → CI/CD GitHub Actions
```

## Commandes

```bash
# Dev local
docker compose up -d          # Lance PostgreSQL + MinIO (S3 local)
cd backend && pip install -e . && uvicorn api.main:app --reload
cd frontend && npm install && npm run dev
```
