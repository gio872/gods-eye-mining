/** Public Movin’Marine reference metadata. Company-stated claims are never treated as GEM measurements. */

export const MOVIN_MARINE_M2_REFERENCE = Object.freeze({
  provider:'Movin’Marine',technology:'Radar M2',status:'company-stated-reference',
  sourceUrls:Object.freeze([
    'https://www.movinmarine.com/servicios/exploracion-minera/',
    'https://www.movinmarine.com/radar-aereo-m2/',
    'https://www.movinmarine.com/pdf/MOVINMARINE-DOSIER-TECNICO-ES.pdf',
  ]),
  representation:Object.freeze({
    dimensions:'X/Y geographic position + Z geophysical response',
    responseExamples:Object.freeze(['conductivity','anomaly intensity']),
    products:Object.freeze(['2D contours','2D vectors','3D surfaces / depth estimates']),
  }),
  methodology:Object.freeze({
    system:'passive airborne electromagnetic recording',
    spectralFilter:'company-described presence/absence filtering of frequencies',
    declaredUses:Object.freeze(['mineral anomalies','water','hydrocarbons','subsurface voids','stratigraphy']),
    declaredScanWidthM:5000,
  }),
  specifications:Object.freeze({
    maximumAnalysisDepthM:5000,spatialResolutionM:5,meanVerticalResolutionM:5,
    antennaDimensionsM:Object.freeze([0.8,0.8,1.0]),antennaWeightKg:90,
    declaredFrequencyRangeHz:Object.freeze([1e6,1e12]),
  }),
  mineralsMentioned:Object.freeze(['gold','copper','zinc','rare-earth-elements','coltan','tantalite','lithium']),
  caseStudies:Object.freeze([
    Object.freeze({country:'Colombia',region:'Arauca',signal:'alta conductividad anómala',interpretation:'formación mineral',status:'company-published-reference'}),
    Object.freeze({country:'Paraguay',region:'Guairá y Caaguazú',target:'oro (Au)',objective:'identificar zonas auríferas con mayor densidad mineral',period:'2013–2017',status:'company-reported-project'}),
    Object.freeze({country:'Perú',region:'varias regiones',target:'oro (Au) y cobre (Cu)',partners:'Inca Minerales, TITAN, ANCONER',period:'2012–2017',status:'company-reported-project'}),
    Object.freeze({country:'Angola',region:'no especificada en la página',target:'oro',project:'GENIUS',period:'2013',status:'company-reported-project'}),
    Object.freeze({country:'Venezuela',region:'no especificada en la página',target:'columbita y tantalita',partner:'Business Development at Tepuy Telecom, C.A.',period:'2016–2017',status:'company-reported-project'}),
  ]),
  notes:Object.freeze([
    'No public raw M2 observation dataset, API, GeoTIFF, XYZ grid or proprietary processing parameters were located in the reviewed public materials.',
    'Historical company materials may state different operational depths; GEM keeps current claims separate from measured observations.',
  ]),
});
