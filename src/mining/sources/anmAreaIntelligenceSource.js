export function createAnmAreaIntelligenceSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  async function analyze(area) {
    if (!area?.cells?.length) throw new Error('No hay un área ANM marcada');
    const boxes=area.cells.map((cell)=>cell.bounds).filter((bounds)=>Number.isFinite(Number(bounds?.west))&&Number.isFinite(Number(bounds?.south))&&Number.isFinite(Number(bounds?.east))&&Number.isFinite(Number(bounds?.north)));
    if (!boxes.length) throw new Error('El área ANM marcada no tiene geometría utilizable');
    const bbox={west:Math.min(...boxes.map((box)=>Number(box.west))),south:Math.min(...boxes.map((box)=>Number(box.south))),east:Math.max(...boxes.map((box)=>Number(box.east))),north:Math.max(...boxes.map((box)=>Number(box.north)))};
    const params=new URLSearchParams({
      west:String(bbox.west),south:String(bbox.south),east:String(bbox.east),north:String(bbox.north),
      areaId:String(area.id||''),departmentCode:String(area.department?.code||''),departmentName:String(area.department?.name||''),
      municipalityCode:String(area.municipality?.code||''),municipalityName:String(area.municipality?.name||''),
      cellCount:String(area.cellCount||area.cells.length),totalHa:String(area.totalHa||0),retrievedAt:String(area.retrievedAt||''),
    });
    const response=await fetchImpl('/api/anm-area-intelligence?'+params.toString(),{cache:'no-store',headers:{Accept:'application/json'}});
    const body=await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(body?.detail||body?.error||'ANM area-intelligence request failed');
    return body;
  }
  return Object.freeze({analyze});
}
