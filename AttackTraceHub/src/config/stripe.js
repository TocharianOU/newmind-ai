import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

// Token 包定价（美元）- 基于 Claude 定价
export const TOKEN_PACKAGES = {
  starter: {
    id: 'starter',
    name: 'Starter Pack',
    tokens: 1000000,      // 1M tokens
    price: 10.00,         // $10
    pricePerMToken: 10,
    description: 'Perfect for getting started'
  },
  professional: {
    id: 'professional',
    name: 'Professional Pack',
    tokens: 6000000,      // 6M tokens
    price: 50.00,         // $50
    pricePerMToken: 8.33,
    description: 'Best value for regular users',
    popular: true
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise Pack',
    tokens: 15000000,     // 15M tokens
    price: 100.00,        // $100
    pricePerMToken: 6.67,
    description: 'For power users'
  }
};

// 订阅套餐定价
export const SUBSCRIPTION_PLANS = {
  pro: {
    id: 'pro',
    name: 'PRO',
    monthlyPrice: 20.00,
    yearlyPrice: 200.00,
    features: {
      dailyTokens: 50000000,
      mcpServers: 20,
      models: ['newmind-medium', 'newmind-small']
    }
  },
};

// Plan hierarchy (higher number = higher tier)
export const PLAN_HIERARCHY = {
  'BASE': 0,
  'PRO': 1,
};

