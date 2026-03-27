# Master Codex Spec — Markets Intelligence Engine

## 1) Product Intent
Build a production-grade **Markets Intelligence Engine** for binary prediction markets that supports decision quality, not certainty.

The system must:
- Combine live market data, orderbook depth, fees, and evidence.
- Produce explicit action states: `TRADE_YES`, `TRADE_NO`, `WAIT`, `AVOID`.
- Explain each action with confidence, invalidation, and risk.
- Default to `WAIT` or `AVOID` when evidence quality is weak, stale, or contradictory.

---

## 2) Scope and Non-Goals

### In Scope
- Polymarket + Kalshi ingestion.
- Firecrawl-backed evidence and sentiment pipeline.
- Edge scoring and trade thesis generation.
- Scenario calculator (fees/slippage aware).
- Best Setups ranking.
- Admin controls, observability, and replayability.

### Out of Scope
- Guaranteed outcomes or certainty language.
- Fully automated order execution.
- Hidden reasoning with no source links.

---

## 3) System Architecture

### Frontend
- Lovable React app with a dedicated **Markets tab**.
- Real-time dashboard cards + ranked table + drill-down drawer.
- Scenario calculator UI with side-by-side comparisons.

### Backend
- Supabase Postgres as canonical storage.
- Supabase Edge Functions for ingestion/scoring/thesis jobs.
- Scheduled refresh + event-triggered recomputation.

### Integrations
- Polymarket public endpoints (markets/orderbook/recent trades/websocket).
- Kalshi live APIs + historical endpoints.
- Firecrawl for public source crawling and extraction.

### Reliability Layer
- Rate limit handling and exponential backoff.
- Staleness checks + freshness windows by market category.
- Source deduplication and contradiction detection.
- Audit logging for every pipeline step.

---

## 4) Canonical Data Model (schema.sql)

```sql
-- enums
create type platform_t as enum ('POLYMARKET','KALSHI');
create type decision_t as enum ('TRADE_YES','TRADE_NO','WAIT','AVOID');
create type setup_t as enum ('SCALP','SWING','HOLD','NONE');
create type job_status_t as enum ('PENDING','RUNNING','SUCCEEDED','FAILED','RETRYING');

-- markets
create table if not exists markets (
  id uuid primary key default gen_random_uuid(),
  platform platform_t not null,
  platform_market_id text not null,
  title text not null,
  subtitle text,
  description text,
  category text not null,
  resolution_criteria text,
  closes_at timestamptz,
  resolves_at timestamptz,
  is_active boolean not null default true,
  ambiguity_score numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(platform, platform_market_id)
);

-- market snapshots
create table if not exists market_snapshots (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets(id) on delete cascade,
  as_of timestamptz not null,
  yes_price numeric(8,4) not null,
  no_price numeric(8,4) not null,
  spread_bps integer not null,
  volume_24h numeric(18,2),
  velocity_5m numeric(10,4),
  velocity_1h numeric(10,4),
  liquidity_score numeric(6,2),
  data_freshness_sec integer not null,
  created_at timestamptz not null default now(),
  unique(market_id, as_of)
);

-- orderbook snapshots
create table if not exists orderbook_snapshots (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets(id) on delete cascade,
  as_of timestamptz not null,
  yes_bid jsonb not null,
  yes_ask jsonb not null,
  no_bid jsonb not null,
  no_ask jsonb not null,
  depth_notional_1pct numeric(18,2),
  depth_notional_2pct numeric(18,2),
  slippage_model jsonb not null,
  created_at timestamptz not null default now(),
  unique(market_id, as_of)
);

-- source docs
create table if not exists source_documents (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets(id) on delete cascade,
  url text not null,
  domain text not null,
  title text,
  published_at timestamptz,
  crawled_at timestamptz not null,
  relevance_score numeric(5,2) not null,
  freshness_score numeric(5,2) not null,
  credibility_score numeric(5,2) not null,
  quality_score numeric(5,2) generated always as ((relevance_score+freshness_score+credibility_score)/3) stored,
  factual_claims jsonb not null default '[]'::jsonb,
  entities jsonb not null default '[]'::jsonb,
  raw_extract jsonb not null,
  cleaned_summary text,
  content_hash text not null,
  created_at timestamptz not null default now(),
  unique(content_hash)
);

-- sentiment snapshots
create table if not exists sentiment_snapshots (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets(id) on delete cascade,
  scan_time timestamptz not null,
  overall_sentiment_bias numeric(6,3) not null,
  confidence numeric(5,2) not null,
  factual_density numeric(5,2) not null,
  timeline_urgency numeric(5,2) not null,
  contradiction_score numeric(5,2) not null,
  source_quality_score numeric(5,2) not null,
  change_signal boolean not null default false,
  evidence_summary text not null,
  trading_impact_summary text not null,
  extracted_claims jsonb not null,
  top_source_ids uuid[] not null,
  created_at timestamptz not null default now(),
  unique(market_id, scan_time)
);

-- scoring weights and policy
create table if not exists scoring_weights (
  id uuid primary key default gen_random_uuid(),
  profile_name text not null unique,
  price_dislocation_w numeric(6,3) not null,
  spread_tightness_w numeric(6,3) not null,
  liquidity_depth_w numeric(6,3) not null,
  momentum_w numeric(6,3) not null,
  reversion_w numeric(6,3) not null,
  sentiment_imbalance_w numeric(6,3) not null,
  news_recency_w numeric(6,3) not null,
  clarity_w numeric(6,3) not null,
  ambiguity_penalty_w numeric(6,3) not null,
  fee_slippage_penalty_w numeric(6,3) not null,
  freshness_w numeric(6,3) not null,
  source_quality_w numeric(6,3) not null,
  updated_at timestamptz not null default now()
);

-- trade ideas
create table if not exists trade_ideas (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets(id) on delete cascade,
  as_of timestamptz not null,
  decision decision_t not null,
  setup_type setup_t not null,
  edge_score numeric(5,2) not null,
  confidence_score numeric(5,2) not null,
  risk_score numeric(5,2) not null,
  entry_zone_low numeric(8,4),
  entry_zone_high numeric(8,4),
  target_exit_low numeric(8,4),
  target_exit_high numeric(8,4),
  invalidation_rule text,
  time_horizon text,
  reasoning_bullets jsonb not null,
  evidence_bullets jsonb not null,
  warnings jsonb not null,
  thesis_summary text not null,
  evidence_links uuid[] not null,
  created_at timestamptz not null default now(),
  unique(market_id, as_of)
);

-- outcomes + journal
create table if not exists trade_outcomes (
  id uuid primary key default gen_random_uuid(),
  trade_idea_id uuid not null references trade_ideas(id) on delete cascade,
  opened_at timestamptz,
  closed_at timestamptz,
  realized_pnl numeric(18,4),
  max_drawdown numeric(8,4),
  thesis_validated boolean,
  post_mortem text,
  created_at timestamptz not null default now()
);

-- user watchlists + settings + alerts
create table if not exists watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  market_id uuid not null references markets(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, market_id)
);

create table if not exists user_settings (
  user_id uuid primary key,
  min_confidence numeric(5,2) not null default 60,
  min_liquidity numeric(10,2) not null default 1000,
  max_spread_bps integer not null default 250,
  preferred_horizons jsonb not null default '["SCALP","SWING"]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  market_id uuid not null references markets(id) on delete cascade,
  alert_type text not null,
  threshold jsonb not null,
  status text not null default 'ACTIVE',
  last_triggered_at timestamptz,
  created_at timestamptz not null default now()
);

-- audit + job logs
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status job_status_t not null,
  attempt integer not null default 1,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  error_message text,
  meta jsonb not null default '{}'::jsonb
);
```

---

## 5) Edge Functions and Responsibilities

1. `sync_polymarket_markets`
   - Pull active markets, normalize schemas, upsert `markets` + `market_snapshots`.
   - Track source timestamp and freshness.

2. `sync_kalshi_markets`
   - Pull live markets and align metadata with shared model.

3. `fetch_orderbooks`
   - Fetch top-of-book + depth ladders.
   - Compute slippage projections for standard notional buckets.

4. `firecrawl_sentiment_scan`
   - Build query plan from market metadata.
   - Crawl allowed domains, dedupe by `content_hash`, persist `source_documents`.
   - Emit `sentiment_snapshots` with contradiction and change signals.

5. `compute_edge_scores`
   - Compute 0–100 edge score from weighted factors.
   - Apply hard fail gates (stale evidence, weak liquidity, high contradiction).

6. `generate_trade_thesis`
   - Convert factors into action card payload.
   - Include entry/target/invalidation/time horizon/risk warnings.

7. `backfill_historical_series`
   - Backfill snapshots and outcomes for analytics + calibration.

8. `refresh_live_dashboard`
   - Orchestrator function invoking sync + scoring + thesis generation.

9. `alert_on_threshold_cross`
   - Evaluate user and system alerts; emit notifications and persist log.

---

## 6) Typed Service Layer Contracts (TypeScript)

```ts
export type Decision = 'TRADE_YES' | 'TRADE_NO' | 'WAIT' | 'AVOID';
export type SetupType = 'SCALP' | 'SWING' | 'HOLD' | 'NONE';

export interface SentimentSnapshot {
  market_id: string;
  scan_time: string;
  overall_sentiment_bias: number;
  confidence: number;
  source_count: number;
  high_quality_source_count: number;
  change_signal: boolean;
  contradiction_score: number;
  extracted_claims: string[];
  evidence_summary: string;
  top_sources: Array<{ url: string; domain: string; quality: number }>;
  trading_impact_summary: string;
}

export interface TradeThesis {
  decision: Decision;
  setup_type: SetupType;
  entry_zone_low?: number;
  entry_zone_high?: number;
  target_exit_low?: number;
  target_exit_high?: number;
  invalidation_rule: string;
  confidence_score: number;
  risk_score: number;
  reasoning_bullets: string[];
  evidence_bullets: string[];
  warnings: string[];
  thesis_summary: string;
}

export interface ScenarioInput {
  side: 'YES' | 'NO';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  orderbookDepth: Array<{ price: number; size: number }>;
  feeModel: { takerBps: number; makerBps: number };
}

export interface ScenarioResult {
  grossPnL: number;
  fees: number;
  slippage: number;
  netPnL: number;
  roi: number;
  maxLossToZero: number;
  payoutAtResolutionIfCorrect: number;
  breakevenExit: number;
  fillWarning?: string;
}
```

---

## 7) Scoring and Decision Policy

### Weighted Score
`edge_score = Σ(weight_i * factor_i) - Σ(penalty_j)` and clamped to 0–100.

### Hard Gates (force WAIT/AVOID)
- Liquidity below configured minimum.
- Spread + expected fees/slippage exceed opportunity band.
- Evidence stale beyond category freshness window.
- Contradiction score above maximum threshold.
- Resolution criteria ambiguity above threshold.

### Decision Mapping
- `TRADE_YES`: high edge, positive directional mismatch, valid execution path.
- `TRADE_NO`: high edge, negative directional mismatch, valid execution path.
- `WAIT`: thesis possible but entry not yet favorable.
- `AVOID`: quality/risk gates fail.

---

## 8) Frontend Markets Tab (Lovable)

### Sections
- Best Setups (sortable table)
- Live Movers
- Sentiment vs Price Divergence
- Mean Reversion Candidates
- Momentum Continuation Candidates
- Overpriced YES / NO
- Near Resolution
- Watchlist
- Open Ideas / Closed Ideas
- Post-Trade Review Journal

### Market Card Fields
- YES/NO price, spread, liquidity, momentum.
- Sentiment summary and contradiction badge.
- Action (`YES`, `NO`, `WAIT`, `AVOID`) and setup type.
- Entry zone, target zone, invalidation, horizon.
- Confidence range, risk label, fee/slippage note.
- Evidence links (top sources + timestamps).

### Reusable Components
- `ScoreExplanation`: factor contribution waterfall.
- `DecisionBadge`: action + confidence chip.
- `EvidenceList`: deduped source links + quality markers.
- `ScenarioCalculator`: instant what-if P&L with depth-aware fill warning.

---

## 9) Firecrawl Adapter Rules

- Query plan generated from title/subtitle/criteria/category.
- Domain allowlist/blocklist is admin-configurable.
- Reject stale content based on market-type freshness windows.
- Persist both raw extraction and normalized claims.
- Compute: sentiment direction, confidence, factual density, timeline urgency, contradiction, source quality.
- Flag whether new evidence materially changes probability.

---

## 10) Admin Panel Requirements

- Controls for all score weights and hard gate thresholds.
- Source allowlist/blocklist manager.
- Freshness windows by category.
- Liquidity/spread minimum-maximum controls.
- Alert rule editor and cache TTL controls.
- Failed job log explorer + re-run button.
- Stale market warning queue.
- Feature flags for experimental models.

---

## 11) API and Job Orchestration

### Core API Endpoints
- `GET /markets`
- `GET /markets/:id`
- `GET /markets/:id/thesis`
- `GET /markets/:id/sentiment`
- `POST /scenarios/evaluate`
- `GET /setups/best`
- `POST /watchlists`
- `POST /alerts`
- `GET /admin/jobs`
- `POST /admin/jobs/:job/retry`

### Schedules
- Market sync: 15–60 sec (platform dependent).
- Orderbook depth refresh: 5–15 sec for active watchlist markets.
- Firecrawl scan: 5–30 min based on market urgency.
- Full dashboard recompute: 30–120 sec.

---

## 12) Test Fixtures and QA Plan

### Fixtures
- High-liquidity momentum market.
- Low-liquidity trap market.
- Contradictory-news market.
- Stale-evidence market.
- Near-resolution binary event.

### Required Tests
- Unit: score factors, gate logic, scenario calculator math.
- Integration: provider normalization and Firecrawl adapter mapping.
- Contract: thesis JSON shape stability.
- Regression: no recommendation without sufficient evidence.
- Performance: refresh pipeline SLA under expected market count.

---

## 13) Implementation Sequence

1. `schema.sql` and base migrations.
2. Provider sync functions and normalization.
3. Orderbook + fee/slippage modeling.
4. Firecrawl adapter + source document persistence.
5. Edge scoring engine + gate policy.
6. Thesis generator.
7. Markets tab UI + reusable explanation components.
8. Scenario calculator.
9. Best Setups ranking and filters.
10. Admin panel + observability tooling.
11. Backfill jobs + calibration loop.
12. Final QA + deployment hardening.

---

## 14) Acceptance Criteria

- Every recommendation includes evidence links, risk label, and invalidation.
- System can emit `WAIT`/`AVOID` when evidence quality is insufficient.
- No card is ranked highly with stale or weak evidence.
- Scenario output reflects fees/slippage and depth realism.
- Admin can tune thresholds and rerun failed jobs without redeploy.

