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
  specifications:Object.freeze({
    maximumAnalysisDepthM:5000,spatialResolutionM:5,meanVerticalResolutionM:5,
    antennaDimensionsM:Object.freeze([0.8,0.8,1.0]),antennaWeightKg:90,
    declaredFrequencyRangeHz:Object.freeze([1e6,1e12]),
  }),
  mineralsMentioned:Object.freeze(['gold','copper','zinc','rare-earth-elements','coltan','tantalite','lithium']),
  caseStudies:Object.freeze([
    Object.freeze({country:'Colombia',region:'Arauca',signal:'alta conductividad anómala',interpretation:'formación mineral',status:'company-published-reference'}),
  ]),
  notes:Object.freeze([
    'No public raw M2 observation dataset, API, GeoTIFF, XYZ grid or proprietary processing parameters were located in the reviewed public materials.',
    'Historical company materials may state different operational depths; GEM keeps current claims separate from measured observations.',
  ]),
});
