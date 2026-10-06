function jsonResponse(response){if(!response.ok)throw new Error('Global satellite-mining API HTTP '+response.status);return response.json();}
export function createGlobalSatelliteMiningSource({fetchImpl=fetch}={}){
  async function sources(){return jsonResponse(await fetchImpl('/api/global-satellite-mining/sources',{headers:{Accept:'application/json'}}));}
  async function scenes({bbox,collection='sentinel-2-l2a',start='2025-01-01',end=new Date().toISOString().slice(0,10),maxCloud=20,limit=12}={}){
    const params=new URLSearchParams({west:bbox.west,south:bbox.south,east:bbox.east,north:bbox.north,collection,start,end,maxCloud:String(maxCloud),limit:String(limit)});
    return jsonResponse(await fetchImpl('/api/global-satellite-mining/scenes?'+params.toString(),{headers:{Accept:'application/json'}}));
  }
  return Object.freeze({sources,scenes});
}
