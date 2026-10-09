# GEM — National Mineral Security Intelligence

GEM is designed as a policy-neutral mineral intelligence infrastructure for governments, geological surveys, mining ministries, strategic-investment agencies and public development institutions.

## Government operating view
For every country × mineral, GEM can maintain a reproducible profile containing:
- geological potential and published mineral endowment;
- mine, refinery and processing footprint;
- production, reserves and resources where authoritative data exists;
- bilateral trade and import dependence;
- supply and processing concentration;
- demand and technology scenarios;
- commodity prices;
- policies, export measures and regulatory context;
- projects and development pipeline;
- infrastructure, water and energy constraints;
- environmental and land-use constraints;
- recycling and secondary supply;
- evidence gaps and confidence.

## Decision questions
1. Which minerals are strategically relevant to this country?
2. Where is domestic geological potential highest?
3. Which minerals are import-dependent?
4. Where is processing or refining dependence concentrated?
5. Which supply-chain nodes are exposed to disruption?
6. Which projects could reduce a documented supply gap?
7. Where could exploration add new domestic supply?
8. What infrastructure or processing capacity is missing?
9. Which data is authoritative, stale, contradictory or absent?
10. What should be investigated next?

## Source hierarchy
Official facts → government / multilateral datasets.
Derived indicators → deterministic calculations from cited facts.
GEM inference → prospectivity, risk signals or scenario analysis.
Private evidence → authenticated customer datasets.
No inferred score may be presented as an official reserve, resource, production figure or policy fact.

## Global source families
The initial architecture is aligned with public datasets from USGS, IEA, UNCTAD, World Bank, Geoscience Australia and national geological/statistical agencies.
USGS Mineral Commodity Summaries provide world production, reserves/resources and country/commodity context.
IEA provides critical-mineral demand scenarios and policy tracking.
UNCTAD provides critical-mineral bilateral trade analysis.
World Bank provides commodity price and market datasets.
These sources are complementary rather than interchangeable; GEM retains source, publication date, methodology and provenance for each fact.

## Product principle
The government product is not a political recommendation engine.
It is a mineral security evidence system that makes the evidence chain visible:
source → fact → indicator → inference → uncertainty → decision question.

## Long-term architecture
PLANET → GEOLOGY → SUPPLY → TRADE → PROCESSING → INFRASTRUCTURE → RISK → POLICY CONTEXT → INVESTMENT → EXPLORATION → FEEDBACK
The same planetary intelligence fabric powers mining companies, governments and investors while tenant-specific private data remains isolated.

## Live official-data ingestion

The ingestion layer registers USGS MCS 2026, USGS Minerals Yearbook, IEA critical-minerals datasets, UNCTAD critical-minerals trade and World Bank commodity-market data. Each normalized record carries source ID, publisher, dataset, year, value, unit and ingestion timestamp. Records without source provenance or a mineral value fail validation.
