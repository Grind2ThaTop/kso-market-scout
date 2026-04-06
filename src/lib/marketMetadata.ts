import type { Market } from '@/data/types';

export type ExpiryFilter = 'all' | '1h' | 'today' | '24h' | '7d' | '30d';

const CATEGORY_KEYWORDS: Array<[Market['category'], string[]]> = [
  ['sports', [
    'sports', 'sport', 'nba', 'nfl', 'mlb', 'nhl', 'wnba', 'soccer', 'football', 'baseball', 'basketball', 'hockey',
    'tennis', 'golf', 'mma', 'ufc', 'boxing', 'cricket', 'rugby', 'ncaa', 'fifa', 'premier league', 'champions league',
    'super bowl', 'world cup', 'world series', 'stanley cup', 'march madness', 'la liga', 'serie a', 'bundesliga',
    'formula 1', 'f1', 'nascar', 'pga', 'wimbledon', 'us open', 'match winner', 'map 1', 'map 2', 'game 1', 'game 2',
    'total kills', 'kills over', 'kills under', 'touchdown', 'home run', 'strikeout', 'goal scorer', 'player prop',
    'esports', 'e sports', 'e-sports', 'valorant', 'counter-strike', 'cs2', 'league of legends', 'dota', 'over/under', 'spread'
  ]],
  ['politics', ['polit', 'election', 'electoral', 'vote', 'voting', 'senate', 'congress', 'president', 'governor', 'mayor', 'democrat', 'republican', 'white house', 'geopolit', 'nato', 'parliament', 'cabinet']],
  ['economics', ['econom', 'cpi', 'inflation', 'employment', 'jobs', 'jobless', 'wage', 'housing', 'consumer confidence', 'tariff', 'trade deficit', 'gdp', 'recession']],
  ['weather', ['weather', 'temperature', 'temp', 'rain', 'snow', 'hurricane', 'tornado', 'storm', 'climate', 'wildfire', 'earthquake']],
  ['crypto', ['crypto', 'bitcoin', 'ethereum', 'btc', 'eth', 'solana', 'token', 'blockchain', 'nft', 'defi', 'web3', 'xrp', 'doge']],
  ['tech', ['tech', 'artificial intelligence', 'openai', 'google', 'apple', 'microsoft', 'meta', 'nvidia', 'tesla', 'spacex', 'semiconductor', 'software', 'hardware', 'ai model']],
  ['science', ['science', 'space', 'nasa', 'physics', 'biology', 'chemistry', 'research', 'experiment', 'astronomy']],
  ['finance', ['finance', 'financial', 'fed', 'interest rate', 'stock', 'stocks', 's&p', 'nasdaq', 'dow', 'treasury', 'bond', 'forex', 'commodity', 'oil', 'gold', 'etf']],
  ['health', ['health', 'medical', 'medicine', 'covid', 'fda', 'pharma', 'vaccine', 'disease', 'drug', 'pandemic']],
  ['legal', ['legal', 'court', 'supreme court', 'lawsuit', 'trial', 'verdict', 'regulation', 'law', 'judge', 'sec case']],
  ['culture', ['culture', 'viral', 'meme', 'fashion', 'influencer', 'dating', 'royal family', 'royals', 'podcast', 'internet trend', 'social media', 'tiktok', 'twitter', 'x.com']],
  ['entertainment', ['entertainment', 'movie', 'film', 'music', 'album', 'song', 'tv', 'television', 'netflix', 'oscar', 'grammy', 'emmy', 'celebrity', 'box office']],
];

const flattenText = (value: unknown): string => {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(flattenText).filter(Boolean).join(' ');
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).map(flattenText).filter(Boolean).join(' ');
  return String(value);
};

export const inferMarketCategory = (...parts: unknown[]): Market['category'] => {
  const text = parts
    .map(flattenText)
    .filter(Boolean)
    .join(' ')
    .replace(/[_-]/g, ' ')
    .toLowerCase();

  if (!text.trim()) return 'other';

  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => text.includes(keyword))) return category;
  }

  return 'other';
};

export const getHoursUntil = (eventEnd: string) => {
  const hours = (new Date(eventEnd).getTime() - Date.now()) / 3_600_000;
  return Number.isFinite(hours) ? hours : Number.POSITIVE_INFINITY;
};

export const matchesExpiryFilter = (eventEnd: string, filter: ExpiryFilter) => {
  if (filter === 'all') return true;

  const end = new Date(eventEnd);
  const hours = getHoursUntil(eventEnd);
  if (!Number.isFinite(hours) || hours <= 0) return false;

  if (filter === '1h') return hours <= 1;
  if (filter === 'today') {
    const now = new Date();
    return end.toDateString() === now.toDateString();
  }
  if (filter === '24h') return hours <= 24;
  if (filter === '7d') return hours <= 168;
  return hours <= 720;
};

export const formatExpiryFilterLabel = (filter: Exclude<ExpiryFilter, 'all'>) => (
  filter === 'today' ? 'Today' : `≤${filter}`
);