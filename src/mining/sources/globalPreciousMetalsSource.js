function jsonResponse(response){
  if(!response.ok)throw new Error('Global precious-metals API HTTP '+response.status);
  return response.json();
}
export function createGlobalPreciousMetalsSource({fetchImpl=fetch}={}){
  async function occurrences({bbox,commodity='gold',limit=1000}={}){
    const params=new URLSearchParams({west:bbox.west,south:bbox.south,east:bbox.east,north:bbox.north,commodity,limit:String(limit)});
    return jsonResponse(await fetchImpl('/api/global-precious-metals/occurrences?'+params.toString(),{headers:{Accept:'application/json'}}));
  }
  async function analyzePoint({latitude,longitude,commodity='gold'}={}){
    const params=new URLSearchParams({lat:String(latitude),lon:String(longitude),commodity});
    return jsonResponse(await fetchImpl('/api/global-precious-metals/analyze?'+params.toString(),{headers:{Accept:'application/json'}}));
  }
  async function sources(){
    return jsonResponse(await fetchImpl('/api/global-precious-metals/sources',{headers:{Accept:'application/json'}}));
  }
  return Object.freeze({occurrences,analyzePoint,sources});
}
