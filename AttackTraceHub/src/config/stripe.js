import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

// Token package pricing (USD) — product tokens at ~1.2x Sonnet 4.6 list price.
// Prices support env override for quick adjustments without a code deploy.
function buildTokenPackage(id, name, tokens, defaultPrice, description, extra = {}) {
  const price = parseFloat(process.env[`TOKEN_PKG_${id.toUpperCase()}_PRICE`] || String(defaultPrice));
  return {
    id,
    name,
    tokens,
    price,
    pricePerMToken: parseFloat((price / (tokens / 1_000_000)).toFixed(2)),
    description,
    ...extra
  };
}

export const TOKEN_PACKAGES = {
  starter: buildTokenPackage('starter', 'Starter Pack', 1_000_000,  15, 'Perfect for getting started'),
  growth:  buildTokenPackage('growth',  'Growth Pack',  3_000_000,  39, 'Best value for regular users', { popular: true }),
  power:   buildTokenPackage('power',   'Power Pack',   10_000_000, 99, 'For power users'),
};

// 工具额度补充包（按梯队分开售卖）
export const TOOL_QUOTA_PACKAGES = {
  tier_a_50: {
    id: 'tier_a_50',
    tier: 'A',
    calls: 50,
    price: 15.00,
    name: 'Tier A — 50 Calls',
    description: 'VirusTotal & high-cost threat intel tools (50 additional calls)',
  },
  tier_a_200: {
    id: 'tier_a_200',
    tier: 'A',
    calls: 200,
    price: 50.00,
    name: 'Tier A — 200 Calls',
    description: 'VirusTotal & high-cost threat intel tools (200 additional calls)',
    popular: true,
  },
  tier_b_200: {
    id: 'tier_b_200',
    tier: 'B',
    calls: 200,
    price: 8.00,
    name: 'Tier B — 200 Calls',
    description: 'Shodan & network recon tools (200 additional calls)',
  },
  tier_b_1000: {
    id: 'tier_b_1000',
    tier: 'B',
    calls: 1000,
    price: 35.00,
    name: 'Tier B — 1,000 Calls',
    description: 'Shodan & network recon tools (1,000 additional calls)',
    popular: true,
  },
  tier_c_1000: {
    id: 'tier_c_1000',
    tier: 'C',
    calls: 1000,
    price: 5.00,
    name: 'Tier C — 1,000 Calls',
    description: 'AbuseIPDB & reputation tools (1,000 additional calls)',
  },
  tier_c_5000: {
    id: 'tier_c_5000',
    tier: 'C',
    calls: 5000,
    price: 20.00,
    name: 'Tier C — 5,000 Calls',
    description: 'AbuseIPDB & reputation tools (5,000 additional calls)',
    popular: true,
  },
};

// Subscription plan pricing — PRO monthly/yearly price supports env override.
export const SUBSCRIPTION_PLANS = {
  pro: {
    id: 'pro',
    name: 'PRO',
    monthlyPrice: parseFloat(process.env.PRO_MONTHLY_PRICE || '49'),   // $49/month
    yearlyPrice: parseFloat(process.env.PRO_YEARLY_PRICE || '490'),    // $490/year (~2 months free)
    features: {
      monthlyTokens: 5000000,   // 5M gifted product tokens/month
      models: ['medium-agent', 'strong-agent']
    }
  },
};

// Plan hierarchy (higher number = higher tier)
export const PLAN_HIERARCHY = {
  'BASE': 0,
  'PRO': 1,
};

