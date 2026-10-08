/**
 * GEM World-Class Mining Intelligence manifest.
 *
 * This is intentionally configuration-only: the existing Cesium experience
 * remains the presentation layer while these capabilities are implemented
 * progressively behind stable contracts.
 */
export const GEM_SYSTEM_MANIFEST = Object.freeze({
  id: "GEM",
  name: "Global Exploration & Mineral Intelligence",
  version: "0.1.0",
  positioning: "The Operating System for Mineral Discovery",
  planes: {
    experience: ["cesium-globe", "target-mining", "ai-geologist", "reports"],
    decision: [
      "target-engine",
      "mineral-systems",
      "active-exploration-optimizer",
      "drill-intelligence",
      "asset-intelligence",
      "economic-engine",
    ],
    evidence: [
      "spectral",
      "geology",
      "geochemistry",
      "geophysics",
      "structure",
      "terrain",
      "infrastructure",
      "mining-activity",
    ],
    data: [
      "google-earth-engine",
      "nasa-earthdata",
      "usgs",
      "esa",
      "national-geological-surveys",
      "private-project-data",
    ],
    governance: [
      "provenance",
      "licensing",
      "snapshots",
      "qa",
      "model-registry",
      "audit",
      "tenant-isolation",
    ],
  },
  northStar:
    "planetary-data -> mineral-system hypothesis -> target -> next-best-action -> drill -> feedback -> asset intelligence",
  modelPolicy: {
    discoveryScoreIsProbability: false,
    missingEvidenceIsZero: false,
    measuredDerivedAndInferredAreDistinct: true,
    provenanceRequired: true,
  },
  stages: [
    "planetary-screen",
    "regional-refinement",
    "district-ranking",
    "project-ranking",
    "target-ranking",
    "drill-ranking",
  ],
});
