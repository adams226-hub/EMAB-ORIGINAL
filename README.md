# EMAB ERP — Phases 1 à 5 : Fondations + Stock + Ventes/Finances + BI + SaaS multi-tenant

Plateforme de gestion commerciale multi-magasins, multi-entreprises (SaaS). Next.js 14 (App Router) + Supabase (PostgreSQL, Auth, RLS, Realtime) + Tailwind CSS + PWA.

## Démarrage

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Copier `.env.local.example` vers `.env.local` et renseigner :
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (optionnel — notifications push ; générer avec `npx web-push generate-vapid-keys`)
3. Exécuter les migrations SQL dans l'éditeur SQL Supabase, **dans l'ordre strict** (chaque phase dépend de la précédente) :
   - `0001` à `0003` — Phase 1 : fondations (magasins, profils, catégories, produits, RLS)
   - `0004` à `0008` — Phase 2 : stock, mouvements, fournisseurs, achats, transferts
   - `0009` à `0014` — Phase 3 : ventes, caisse, finances, créances
   - `0015` à `0016` — Phase 4 : vues analytiques, BI
   - `0017` à `0025` — Phase 5 : **multi-tenant**, PWA/push, audit, optimisation (voir détail ci-dessous)
4. Créer le premier compte **Super Admin** — deux options :
   - **Via `/signup`** (recommandé) : crée automatiquement une nouvelle entreprise (tenant) + son premier compte super_admin.
   - **Manuellement** : Dashboard Supabase → Authentication → Add user, puis rattacher ce compte à un tenant existant :
     ```sql
     update public.profiles set role = 'super_admin', store_id = null, tenant_id = '<uuid-du-tenant>'
     where email = 'votre-email@exemple.com';
     ```
5. `npm install`
6. `npm run dev` puis ouvrir [http://localhost:3000](http://localhost:3000).

### Migrations Phase 5 en détail

| Fichier | Contenu |
|---|---|
| `0017_tenant_phase5_schema.sql` | Table `tenants` + colonne `tenant_id` sur ~23 tables (nullable) |
| `0018_tenant_phase5_backfill.sql` | Tenant par défaut, backfill des données existantes, `NOT NULL` |
| `0019_tenant_phase5_functions.sql` | `my_tenant_id()`, trigger d'auto-remplissage de `tenant_id` |
| `0020_tenant_phase5_rls.sql` | Policies **RESTRICTIVE** `tenant_isolation` (isolation universelle) |
| `0021_tenant_phase5_signup.sql` | Inscription self-service (`handle_new_user` étendu) |
| `0022_tenant_phase5_security_patch.sql` | **Correctif critique** : vérification tenant dans les fonctions RPC (Phases 2-3) |
| `0023_pwa_phase5_push.sql` | Table `push_subscriptions` |
| `0024_audit_phase5_log.sql` | Journal d'audit (`audit_log` + triggers) |
| `0025_optimization_phase5.sql` | Contraintes d'unicité re-scopées par tenant + index composites |

## Scripts

- `npm run dev` — serveur de développement
- `npm run build` — build de production
- `npm run typecheck` — vérification TypeScript
- `npm run lint` — ESLint

## Rôles

| Rôle | Accès |
|---|---|
| `super_admin` | Tous les magasins **de son entreprise**, tous les modules |
| `manager` | Son magasin : produits, stock, achats, ventes, dépenses, dettes fournisseurs, caisse, rapports |
| `stock_keeper` | Stock de son magasin : mouvements, transferts, inventaires, réception des achats |
| `cashier` | Point de vente, ventes, clients, créances et caisse de son magasin |

## Multi-tenant SaaS (Phase 5)

Isolation réelle entre entreprises clientes sur une **base de données unique**. Chaque table métier porte une colonne `tenant_id` dénormalisée (pas de jointure requise pour filtrer — recommandation officielle Supabase pour la RLS multi-tenant à l'échelle). Une policy `RESTRICTIVE` unique par table (`tenant_isolation`, `0020`) s'ajoute en ET logique à toutes les policies existantes des Phases 1-4, sans qu'aucune d'elles n'ait eu besoin d'être réécrite.

**Point critique** : les fonctions `SECURITY DEFINER` (Phases 2-3) contournent la RLS par nature. Sans le correctif `0022`, un super_admin de l'entreprise A aurait pu, via `fn_create_sale`, viser un magasin de l'entreprise B. Chaque fonction vérifie désormais explicitement que toute ligne/tout identifiant reçu appartient au tenant de l'appelant.

Inscription self-service sur `/signup` (14 jours d'essai gratuit). Limites de plan (`max_stores`, `max_users`) appliquées à la création de magasins/utilisateurs. Statut d'abonnement (`trial`/`active`/`suspended`/`cancelled`) vérifié par le middleware à chaque requête ; un tenant suspendu est redirigé vers `/suspended`.

## Sécurité

Défense en profondeur à quatre niveaux : RLS PostgreSQL (isolation tenant + rôle/magasin) → vérification explicite dans les fonctions `SECURITY DEFINER` (bypass RLS assumé et compensé) → middleware Next.js (rôle + statut d'abonnement) → Server Actions. Les montants figés (`amount_paid`, `total_amount`) restent protégés par le trigger `guard_financial_columns` (Phase 3).

## Journal d'audit

`audit_log` (Phase 5) trace création/modification/suppression sur les entités métier (magasins, utilisateurs, produits, ventes, commandes...). Consultable par le super_admin sur `/audit-log`. Les grands livres déjà immuables (`stock_movements`, `payments`) ne sont volontairement pas ré-audités : ils sont déjà, par construction, leur propre trace.

## PWA & notifications push

Application installable (`manifest.json` + service worker `public/sw.js`), cache hors-ligne basique pour la coquille de l'app. Notifications push (Web Push API, aucun compte tiers requis — juste une paire de clés VAPID auto-générée) activables depuis Paramètres ; déclenchées automatiquement sur alerte de stock bas. Sans clés VAPID configurées, l'envoi est un no-op silencieux — l'app fonctionne normalement.

## Import massif

Import CSV de produits (`/products` → Importer CSV) avec aperçu avant validation, création automatique des catégories manquantes (selon le rôle), et rapport des lignes ignorées (SKU en doublon).

## CI/CD

`.github/workflows/ci.yml` : lint + typecheck + build sur chaque pull request. `.github/workflows/deploy-migrations.yml` : application des migrations Supabase en production, déclenchement **manuel uniquement** (jamais automatique sur un push).

## Phase 6 (à venir)

Intégrations externes différées (paiement Stripe, SMS/WhatsApp), application mobile React Native native (la Phase 5 a livré une PWA), comptabilité générale, rapports programmés par email (nécessite `pg_cron` + Edge Function + fournisseur email).

## Maintenance

Ce projet fixe intentionnellement `next` sur la branche `14.2.x`. Avant Next.js 15/16, prévoir une migration dédiée (`cookies()`/`params` deviennent asynchrones). Exécuter régulièrement `npm audit`.

L'export Excel utilise du CSV généré manuellement (`lib/csv.ts`) plutôt que la librairie `xlsx` (failles de sécurité sans correctif disponible sur npm — voir `npm audit`).

Les séquences de numérotation de documents (`VTE-2026-00001`, etc.) restent globales entre tenants : un gap dans la numérotation d'une entreprise peut révéler indirectement le volume d'activité d'une autre. Sans impact sur l'isolation des données, mais à corriger (compteur par tenant) si ce signal devient sensible commercialement.
