/**
 * GEM Capital Matching Engine.
 * Ranks financing candidates by explicit compatibility only.
 */
export const GEM_CAPITAL_MATCHING_VERSION='1.0.0';

export function matchProjectToCapital(project={},providers=[]){
 const commodity=project.commodity;
 const geography=project.country;
 const stage=project.stage;
 const instrument=project.instrument;
 return providers.map(p=>{
  let score=0;
  const reasons=[];
  if(commodity&&p.commodities?.includes(commodity)){score+=30;reasons.push('COMMODITY_MATCH');}
  if(geography&&p.geographies?.includes(geography)){score+=25;reasons.push('GEOGRAPHY_MATCH');}
  if(instrument&&p.instruments?.includes(instrument)){score+=25;reasons.push('INSTRUMENT_MATCH');}
  if(stage&&p.stage&&p.stage===stage){score+=10;reasons.push('STAGE_MATCH');}
  if(project.currency&&p.currency&&project.currency===p.currency){score+=5;reasons.push('CURRENCY_MATCH');}
  if(p.verificationStatus==='VERIFIED'){score+=5;reasons.push('VERIFIED_PROVIDER');}
  return {...p,matchScore:score,matchReasons:reasons};
 }).filter(x=>x.matchScore>0).sort((a,b)=>b.matchScore-a.matchScore);
}
