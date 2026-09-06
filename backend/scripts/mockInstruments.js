// Shared mock-instrument data. This module intentionally has no startup
// side effects so it can be imported by both the seeder and tick generator.
export const MOCK_INSTRUMENTS = [
  { symbol: "ARIA", name: "Aria Technologies", startPrice: 2450.5, baselineVolatility: 12.5 },
  { symbol: "BOLT", name: "Bolt Logistics", startPrice: 890.2, baselineVolatility: 6.0 },
  { symbol: "CIRRUS", name: "Cirrus Cloud Systems", startPrice: 3120.0, baselineVolatility: 22.0 },
  { symbol: "DYNA", name: "Dyna Energy", startPrice: 540.75, baselineVolatility: 4.5 },
  { symbol: "ECHO", name: "Echo Media Group", startPrice: 178.4, baselineVolatility: 3.2 },
  { symbol: "FIN", name: "Finlyte Financial", startPrice: 1650.0, baselineVolatility: 9.0 },
  { symbol: "GROVE", name: "Grove Retail", startPrice: 720.3, baselineVolatility: 5.5 },
  { symbol: "HALO", name: "Halo Semiconductors", startPrice: 4200.0, baselineVolatility: 35.0 },
  { symbol: "IONIQ", name: "Ioniq Auto", startPrice: 980.6, baselineVolatility: 11.0 },
  { symbol: "JADE", name: "Jade Pharmaceuticals", startPrice: 1340.2, baselineVolatility: 14.0 },
  { symbol: "KRON", name: "Kron Steel & Metals", startPrice: 410.9, baselineVolatility: 3.8 },
  { symbol: "LUME", name: "Lumen Optics", startPrice: 260.5, baselineVolatility: 4.0 },
  { symbol: "MERI", name: "Meridian Bank", startPrice: 1120.0, baselineVolatility: 7.5 },
  { symbol: "NOVA", name: "Nova Aerospace", startPrice: 3800.0, baselineVolatility: 28.0 },
  { symbol: "ORCA", name: "Orca Shipping", startPrice: 610.4, baselineVolatility: 5.0 },
  { symbol: "PIXEL", name: "Pixel Gaming", startPrice: 890.0, baselineVolatility: 9.5 },
  { symbol: "QUARTZ", name: "Quartz Minerals", startPrice: 350.2, baselineVolatility: 3.0 },
  { symbol: "RIVET", name: "Rivet Manufacturing", startPrice: 480.6, baselineVolatility: 4.2 },
];
