/**
 * AI Model Pricing Constants
 *
 * Pricing as of December 2024 from https://ai.google.dev/pricing
 * All prices are in USD per million tokens
 *
 * NOTE: These prices should be reviewed and updated periodically
 * as Google may change their pricing.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING LOOKUP
// ═══════════════════════════════════════════════════════════════════════════════

interface ModelPricing {
  inputPricePerMillion: number;
  outputPricePerMillion: number;
}
