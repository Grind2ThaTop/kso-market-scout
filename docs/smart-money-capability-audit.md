# Smart Money Tracker Capability Audit (Polymarket vs Kalshi)

## Goal
Know who the killers are, what they are betting on, when they move, whether they are worth following, and which traders are worth fading — with hard numbers.

## Capability Matrix

| Capability | Polymarket | Kalshi |
|---|---|---|
| Leaderboard availability | Public leaderboard endpoint documented | Public leaderboard product exists; participation is opt-in |
| Public trader profiles | Public profile endpoint documented | Not broadly exposed in public API docs |
| Public positions | Current/closed positions endpoints documented | Not broadly exposed publicly at user level |
| Public trade/activity history | User activity/trades endpoints documented | Not broadly exposed publicly at user level |
| Direct market links | Yes (market/event links) | Yes (market pages + public market APIs) |
| What can be tracked in real-time | High for tracked wallets via public endpoints | Limited primarily to opted-in leaderboard and market-level data |
| What requires auth | Trading/private account operations | Most user-level account/position details |
| What cannot currently be done | Guaranteed full identity mapping for every wallet | Full account-wide public copy/fade tracking for non-opted users |

## Data Classification

### Polymarket
- **Public:** leaderboard rankings, public profile, current positions, closed positions, user activity, total value, traded market count.
- **Authenticated:** private trading/account APIs.
- **Unavailable/limited:** guaranteed complete attribution for every wallet/user alias combination.

### Kalshi
- **Public:** leaderboard view (opt-in participants), market/event/orderbook data APIs.
- **Authenticated:** account-specific positions/orders/trading details.
- **Unavailable/limited:** broad, fully public trader-level position history for all users.

## Fastest path to MVP
1. Ship Polymarket-first leaderboard + profile drilldown + live position/activity pages.
2. Add watchlists and threshold-triggered in-app alerts on new/increased/reduced/exited positions.
3. Add consensus/follow/fade scoring from observed public activity.
4. Integrate Kalshi in partial mode (leaderboard + market intelligence), while documenting user-level tracking constraints.

## Delivery Phasing
- **Phase 1:** leaderboards, profile pages, current positions/activity, watchlists, market links.
- **Phase 2:** alerts, consensus signals, follow/fade scores, basic backtests.
- **Phase 3:** delayed-copy assumptions, bankroll sizing, slippage-aware simulations, advanced alpha/fade models.
