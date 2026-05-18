# Grocery Data Processing Challenge

Build a small full-stack Svelte app that ingests messy CSV data from three grocery vendors, cleans and persists it to a SQL database, and displays it in a way an operator could actually use.

## TL;DR

- **Target effort:** ~8 hours of actual work. Submit within **24 hours** of receiving this brief.
- **Stack:** One Svelte app, TypeScript preferred, any local SQL database (SQLite is the easy default).
- **AI tools are encouraged.** Use whatever you'd use on the job.
- **Submit:** push to a branch or fork of this repo, or email `colinw@empowerfresh.com`. Final push/email timestamp marks completion.
- **Follow-up:** we'll schedule a ~45-min review call where we'll **import new sample files into your running app** to see how flexible your ETL is.

---

## Requirements Checklist

This is the contract. Anything in **Must** is graded directly. **Should** items meaningfully improve your score. **Nice-to-have** items are bonus signal — skip them if you're running out of time.

### Must

- [ ] **Ingest** all CSV files from all three vendors in [`grocers-files/`](./grocers-files/) — products, prices, and sales.
- [ ] **Clean and normalize** the data on ingest (trim whitespace, normalize column-name variations, decide what to do with missing/invalid values).
- [ ] **Persist** cleaned data to a local SQL database with a schema you design.
- [ ] **Aggregate sales** across UPC/PLU when loading or querying — raw transaction rows alone don't satisfy this.
- [ ] **Two-section frontend:**
  - **Import** section: upload one or many CSVs, trigger ETL, show success/failure feedback.
  - **View** section: display **products, prices, and sales** filterable by **grocer (customer)** and by **store**.
- [ ] **Works end-to-end** from a fresh clone: clear setup instructions in a README so a reviewer can run it.

### Should

- [ ] Handle the file-naming differences across vendors (e.g. `prices.csv` vs `Prices-store1.csv` vs `price-1767955200000.csv`) without hardcoding.
- [ ] Handle the column-naming differences across vendors (e.g. `Category` vs `category`, `Pack` vs `pack_size`, `Sales_Total` vs `total_sale`).
- [ ] Surface basic data-quality signals — orphaned sales (UPC not in product catalog), missing prices, etc.
- [ ] Use TypeScript types for your core entities.

### Nice-to-have

- [ ] Detect and flag placeholder/invalid UPCs (e.g. `999999999999`).
- [ ] Normalize description casing.
- [ ] Handle mixed timestamp formats (Unix epoch vs. date strings).
- [ ] Price comparisons across stores, sales trends, charts, or other visualizations.
- [ ] Tests.

---

## The Data

You'll find three vendors under [`grocers-files/`](./grocers-files/):

1. **Colin's Market** (`colins-market/`)
2. **J&A Grocers** (`J&A-grocers/`)
3. **Stevens Produce** (`stevens-produce/`)

Each vendor provides three file types with slightly different formats. **This is the point** — real grocery data ingestion means dealing with vendors who don't agree on conventions.

### Product files

The catalog of items at each vendor.

**Fields you'll see (names may vary in casing or wording):**
- `upc_plu` — unique product identifier
- `description` — product name
- `department`, `category`
- `unit_size` (e.g. `1LB`, `16OZ`, `EACH`)
- `pack_size` / `Pack`
- `link_code` / `LinkCode` — optional; **don't go down this rabbit hole**

It's fine to treat products as visible across all stores within a vendor.

### Price files

Current and historical pricing.

**Fields:**
- `store`, `upc_plu`, `price`
- `price_type` — `REG` (regular), `AD` (advertised), `TPR` (temporary reduction), `STR` (store-specific), `MGR` (manager special)
- `price_priority` — higher overrides lower
- `price_multiple` / `unit_multiple` — for "2 for $5" style pricing
- `start_date`, `end_date` — **end_date can be empty, meaning valid indefinitely**

Multiple price types can exist for the same product. You don't need to perfectly resolve "which price is the *real* price right now" — just persist what you've got and decide on a display rule that makes sense to you.

### Sales files

Actual transactions.

**Fields:**
- `store`, `upc_plu`, `description`, `unit_size`
- `sale_time` (may be Unix timestamp or formatted date string), `sale_time_zone`
- `price_type`, `price_priority`, `price_multiple`, `unit_multiple`
- `unit_price`, `units_sold` (can be decimal for weighted items), `total_sale` / `Sales_Total`

Sales may reference UPCs that don't exist in the product catalog. That's an **orphaned record** — flag or count them; don't crash on them.

---

## Data Quality Issues to Expect

The files contain intentional, realistic problems:

- Missing values in required-looking fields
- Mixed capitalization, extra whitespace
- Column-name variations (`Category` / `category`, `Pack` / `pack_size`)
- Orphaned sales (UPC not in catalog)
- Placeholder UPCs like `999999999999`
- Unix epoch vs. date-string timestamps
- Multiple active prices for the same product

### Philosophy

**Real data is messy. Your job is to ship a working app that displays it, not to perfectly model every edge case.** Pragmatic defaults beat exhaustive correctness here. If something is ambiguous, pick a reasonable rule and move on.

---

## Architecture & Stack

**Required:**
- One Svelte app (frontend + backend in one project)
- Backend in **TypeScript/Node.js** (JS is acceptable for speed)
- Server-side routes / `page.server.ts` for API endpoints
- A local SQL database — SQLite, Postgres, MySQL, your call

**Optional:**
- Python for ETL if you prefer
- Any libraries that help

**Out of scope:**
- Auth, authorization, multi-tenancy boundaries. You'll model multiple grocers as **data** — you don't need any tenancy isolation, RBAC, or per-user views.

### Suggested schema (you decide the final shape)

- `grocers` (or `customers`): `id`, `name`
- `stores`: `id`, `grocer_id`, `store_code`, `name`
- `products`: `id`, `grocer_id`, `upc_plu`, `description`, `department`, `category`, `unit_size`, `pack_size`
- `prices`: `id`, `store_id`, `upc_plu`, `price`, `price_type`, `start_date`, `end_date`
- `sales`: `id`, `store_id`, `upc_plu`, `sale_time`, `units_sold`, `unit_price`, `total_sale`

**Time budget for schema design: 30–60 minutes max.** If you're spending more, you're overthinking it.

---

## Evaluation

### What we'll score on the code submission

- **Data processing quality** — does the ETL clean reasonably, handle vendor variation, aggregate sales?
- **Schema design** — does it support the queries the UI needs?
- **Code quality** — readable, organized, errors handled where it matters, types where they help.
- **Frontend UX** — can a reviewer actually use the app to answer "how did product X sell across stores last week?"
- **Completeness** — every **Must** item working end-to-end.

### What we'll do in the follow-up call

- Walk through your code together (~20 min)
- **Import a new, previously-unseen sample file set into your running app** to see how your ETL handles formats it wasn't built against (~15 min)
- Discuss tradeoffs, what you'd change with more time (~10 min)

The live import is the most important part. Hardcoded paths and brittle column matchers will show up immediately, so prefer flexible heuristics over rigid mappings.

---

## Getting Started

1. Skim the sample data in [`grocers-files/`](./grocers-files/) — five minutes, not an hour
2. Sketch a schema (30–60 min)
3. Stand up a Svelte app with one import route and one view route
4. Build the ETL inside your import route
5. Build the view UI against your tables
6. Write a short README so we can run it

**Submit something that runs.** A simple working app beats an ambitious incomplete one.

---

## Submission

Pick one:
- **Branch:** clone, push your work to a branch
- **Fork:** fork to your GitHub, push there
- **Email:** email `colinw@empowerfresh.com` with a link or attachment

Final push/email timestamp = completion time. Must be within **24 hours** of receiving the brief.

After submission we'll schedule the follow-up call within a few days.

---

## Questions

Email `colinw@empowerfresh.com`. We'd rather you ask than guess wrong.

Good luck.
