export const INFLUENCER_CATEGORIES = [
  { id: 'A', name: 'Mega Influencers', range: '1,000,000+', min: 1_000_000, max: Infinity },
  { id: 'B', name: 'Macro Influencers', range: '100,000–999,999', min: 100_000, max: 999_999 },
  { id: 'C', name: 'Mid-Tier Influencers', range: '50,000–99,999', min: 50_000, max: 99_999 },
  { id: 'D', name: 'Micro Influencers', range: '10,000–49,999', min: 10_000, max: 49_999 },
  { id: 'E', name: 'Nano Influencers', range: '1,000–9,999', min: 1_000, max: 9_999 },
];

export function getInfluencerCategory(value) {
  const normalized = String(value ?? '').trim().toLowerCase().replaceAll(',', '');
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*([km])?$/);
  if (!match) return null;
  const multiplier = match[2] === 'm' ? 1_000_000 : match[2] === 'k' ? 1_000 : 1;
  const followers = Number(match[1]) * multiplier;
  if (!Number.isFinite(followers) || followers < 1_000) return null;
  return INFLUENCER_CATEGORIES.find(({ min, max }) => followers >= min && followers <= max) ?? null;
}
