const VISOR_BASE = 'https://annamineria.anm.gov.co/annageo/rest/services/SIGM/VisorGeneral/MapServer';
const GENERAL_BASE = 'https://annamineria.anm.gov.co/annageo/rest/services/SIGM/General_Base/MapServer';
const REQUEST_TIMEOUT_MS = 18000;
const MAX_SAMPLE_FEATURES = 5;
const MAX_ATTRIBUTE_LENGTH = 180;
const MAX_BBOX_SPAN = 12;

const CATEGORIES = Object.freeze([
  Object.freeze({ id:'tenure', label:'Tenencia minera', service:'visor', layers:Object.freeze([[10,'Subcontrato'],[11,'Título Vigente'],[12,'Solicitud Vigente']]), severity:'high' }),
  Object.freeze({ id:'environmental-excluded', label:'Áreas ambientales excluibles', service:'visor', layers:Object.freeze([[52,'Sistema de Áreas Protegidas Excluibles'],[53,'Protección y Desarrollo de Recursos Naturales'],[54,'Sitio RAMSAR'],[55,'Páramo en Proceso de Delimitación'],[56,'Páramo de Referencia 1:100.000'],[57,'Páramo Delimitado 1:25.000'],[58,'Área no apta para minería · Sabana de Bogotá'],[59,'Zonificación de Exclusión de la Actividad Minera']]), severity:'critical' }),
  Object.freeze({ id:'environmental-restricted', label:'Otras áreas ambientales / mineras restringidas', service:'visor', layers:Object.freeze([[80,'Zonificación de Restricción Minera'],[81,'Zona de Restricción Agrícola y Ganadera'],[89,'Reserva Natural Biosfera'],[90,'Reservas Forestales de Ley Segunda'],[91,'Bosques de Paz'],[92,'Zonas de Compensación']]), severity:'high' }),
  Object.freeze({ id:'communities', label:'Comunidades y figuras colectivas', service:'visor', layers:Object.freeze([[96,'Rutas Colectivas'],[97,'Resguardos Indígenas'],[98,'Consejos Comunitarios Afrocolombianos'],[99,'Zonas de Reserva Campesina']]), severity:'medium' }),
  Object.freeze({ id:'land-restitution', label:'Restitución de tierras', service:'visor', layers:Object.freeze([[101,'Predio de Restitución'],[102,'Zona Microfocalizada'],[103,'Zona Macrofocalizada']]), severity:'medium' }),
  Object.freeze({ id:'licenses', label:'Licencias ambientales', service:'visor', layers:Object.freeze([[61,'Proyecto Licenciado Punto'],[62,'Proyecto Licenciado Línea'],[63,'Proyecto Licenciado Polígono']]), severity:'context' }),
  Object.freeze({ id:'opportunities', label:'Oportunidad minera ANM', service:'visor', layers:Object.freeze([[43,'AEM · Selección Objetiva'],[44,'Áreas Estratégicas Mineras'],[45,'Áreas de Inversión del Estado'],[46,'Área de Reserva Especial Declarada'],[47,'Área de Reserva Especial en Trámite'],[48,'Áreas Susceptibles de la Minería'],[49,'Zona Reservada con Potencial'],[50,'Banco de Área']]), severity:'opportunity' }),
  Object.freeze({ id:'hydrography', label:'Hidrografía', service:'visor', layers:Object.freeze([[65,'Manantial'],[66,'Morichal'],[67,'Ciénaga'],[68,'Humedal'],[70,'Laguna'],[72,'Madrevieja'],[73,'Manglar'],[74,'Pantano'],[75,'Drenaje Sencillo'],[76,'Drenaje Doble'],[78,'Otros Cuerpos Agua']]), severity:'context' }),
  Object.freeze({ id:'infrastructure', label:'Infraestructura estratégica', service:'general', layers:Object.freeze([[2,'Vía'],[3,'Vía Férrea'],[5,'Puerto · Punto'],[6,'Puerto · Polígono'],[8,'Aeropuerto · Punto'],[9,'Aeropuerto · Polígono'],[14,'Hidroeléctrica'],[15,'Embalse'],[16,'Gasoducto'],[17,'Oleoducto'],[18,'Poliducto'],[19,'Red de Alta Tensión']]), severity:'context' }),
  Object.freeze({ id:'cadastre', label:'Catastro predial', service:'general', layers:Object.freeze([[106,'Construcción Rural'],[107,'Predio Rural'],[108,'Predio Urbano']]), severity:'context' }),
]);

const SERVICE_BASES = Object.freeze({ visor:VISOR_BASE, general:GENERAL_BASE });

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function cleanText(value) {
  return String(value ?? '').trim();
}
function normalizedBbox(input) {
  const west=finite(input?.west), south=finite(input?.south), east=finite(input?.east), north=finite(input?.north);
  if ([west,south,east,north].some((v)=>v===null)) throw new Error('Se requieren west, south, east y north');
  if (west>=east || south>=north) throw new Error('El bounding box ANM no es válido');
  if (east-west>MAX_BBOX_SPAN || north-south>MAX_BBOX_SPAN) throw new Error('El área marcada es demasiado extensa para un análisis ANM de screening');
  return {west,south,east,north};
}
function queryParams(bbox) {
  return {
    geometry:JSON.stringify({xmin:bbox.west,ymin:bbox.south,xmax:bbox.east,ymax:bbox.north,spatialReference:{wkid:4686}}),
    geometryType:'esriGeometryEnvelope',
    inSR:4686,
    spatialRel:'esriSpatialRelIntersects',
  };
}
function urlWithParams(url, params) {
  const search=new URLSearchParams();
  for (const [key,value] of Object.entries(params)) if (value!==undefined && value!==null) search.set(key,String(value));
  return url+'/query?'+search.toString();
}
async function requestJson(url) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
  try {
    const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'GodsEyeView/ANM-Area-Intelligence'},signal:controller.signal});
    const payload=await response.json().catch(()=>({}));
    if (!response.ok) throw new Error('ANM HTTP '+response.status);
    if (payload?.error) throw new Error(payload.error.message || payload.error.details?.join('; ') || 'ANM query error');
    return payload;
  } catch (error) {
    if (error?.name==='AbortError') throw new Error('ANM query timed out after '+(REQUEST_TIMEOUT_MS/1000)+'s');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
function compactAttributes(attributes) {
  if (!attributes || typeof attributes!=='object') return {};
  const preferred=['NOMBRE','NAME','CODIGO_EXPEDIENTE','TENURE_ID','MODALIDAD','TITULO_ESTADO','AREA_HA','MINERALES','MINERAL','SOLICITANTES_O_TITULARES','NOMBRE_DE_TITULAR','NOMBRE_SOLICITANTE','ETAPA','ACTO_ADMINISTRATIVO','FECHA','FECHA_DE_SOLICITUD','FECHA_DE_EXPIRACION','SCHEMA_NAME','OBSERVACIONES','FUENTE','CODIGO_OBJETO','ID'];
  const output={};
  for (const key of preferred) {
    const value=attributes[key];
    if (value!==undefined && value!==null && String(value)!=='') output[key]=String(value).slice(0,MAX_ATTRIBUTE_LENGTH);
  }
  if (Object.keys(output).length) return output;
  for (const [key,value] of Object.entries(attributes)) {
    if (key==='OBJECTID' || key==='Shape' || key==='SHAPE' || value===undefined || value===null || String(value)==='') continue;
    output[key]=String(value).slice(0,MAX_ATTRIBUTE_LENGTH);
    if (Object.keys(output).length>=8) break;
  }
  return output;
}
function geometryCenter(geometry) {
  if (finite(geometry?.x)!==null && finite(geometry?.y)!==null) return {lon:Number(geometry.x),lat:Number(geometry.y)};
  const groups=[...(Array.isArray(geometry?.rings)?geometry.rings:[]),...(Array.isArray(geometry?.paths)?geometry.paths:[])];
  const points=groups.flat().filter((pair)=>Array.isArray(pair) && finite(pair[0])!==null && finite(pair[1])!==null);
  if (!points.length) return null;
  let lon=0,lat=0;
  for (const pair of points) { lon+=Number(pair[0]); lat+=Number(pair[1]); }
  return {lon:lon/points.length,lat:lat/points.length};
}
async function queryLayer(service,layerId,bbox,includeSamples) {
  const endpoint=SERVICE_BASES[service]+'/'+layerId;
  const countPayload=await requestJson(urlWithParams(endpoint,{f:'json',...queryParams(bbox),where:'1=1',returnCountOnly:'true'}));
  const count=Math.max(0,Number(countPayload.count)||0);
  let samples=[];
  if (includeSamples && count>0) {
    const samplePayload=await requestJson(urlWithParams(endpoint,{f:'json',...queryParams(bbox),where:'1=1',outFields:'*',returnGeometry:'true',outSR:4326,resultRecordCount:MAX_SAMPLE_FEATURES}));
    samples=(samplePayload.features||[]).map((feature)=>({layerId,attributes:compactAttributes(feature?.attributes),center:geometryCenter(feature?.geometry)})).slice(0,MAX_SAMPLE_FEATURES);
  }
  return {layerId,count,samples};
}
async function mapLimit(items,limit,worker) {
  const results=new Array(items.length);
  let cursor=0;
  async function runner() {
    for (;;) {
      const index=cursor++;
      if (index>=items.length) return;
      results[index]=await worker(items[index],index);
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},()=>runner()));
  return results;
}
function summarizeCategory(category,layerResults) {
  const valid=layerResults.filter((result)=>result.count!==null);
  const count=valid.reduce((sum,result)=>sum+result.count,0);
  return {
    id:category.id,label:category.label,severity:category.severity,count:valid.length===layerResults.length?count:null,
    layers:layerResults.map((result)=>({layerId:result.layerId,layerName:result.layerName,count:result.count,error:result.error||null,samples:result.samples||[]})),
    samples:layerResults.flatMap((result)=>result.samples||[]).slice(0,8),
  };
}
function scoreReport(categories) {
  const byId=new Map(categories.map((category)=>[category.id,category]));
  const count=(id)=>Number(byId.get(id)?.count)||0;
  const critical=count('environmental-excluded'),restricted=count('environmental-restricted'),tenure=count('tenure'),communities=count('communities'),restitution=count('land-restitution'),opportunity=count('opportunities'),water=count('hydrography'),infrastructure=count('infrastructure');
  let score=100;
  const components=[];
  function apply(label,delta,reason) { score+=delta; components.push({label,delta,reason}); }
  if (critical>0) apply('Exclusión ambiental',-45,critical+' objeto(s) intersectan la envolvente analizada');
  if (restricted>0) apply('Restricción territorial/minera',-20,restricted+' objeto(s) intersectan la envolvente analizada');
  if (tenure>0) apply('Tenencia minera',-30,tenure+' objeto(s) de títulos/solicitudes/subcontratos');
  if (communities>0) apply('Comunidades',-10,communities+' objeto(s) de figuras colectivas');
  if (restitution>0) apply('Restitución de tierras',-8,restitution+' objeto(s)');
  if (water>0) apply('Hidrografía',-4,water+' elemento(s) hidrográficos');
  if (opportunity>0) apply('Oportunidad ANM',Math.min(10,opportunity),opportunity+' objeto(s) de oportunidad minera');
  if (infrastructure>0) apply('Infraestructura',5,infrastructure+' objeto(s) de infraestructura');
  score=Math.max(0,Math.min(100,score));
  let label='REQUIERE REVISIÓN';
  if (critical>0) label='ALTO RIESGO / EXCLUSIÓN A VERIFICAR';
  else if (score>=80) label='FAVORABLE PARA SCREENING';
  else if (score>=60) label='VIABLE CON RESTRICCIONES';
  return {value:score,label,confidence:'screening',components};
}
async function analyze(bbox,area) {
  const flattened=CATEGORIES.flatMap((category)=>category.layers.map(([layerId,layerName])=>({category,layerId,layerName})));
  const layerResults=await mapLimit(flattened,6,async(item)=>{
    try {
      const result=await queryLayer(item.category.service,item.layerId,bbox,true);
      return {...result,layerName:item.layerName,categoryId:item.category.id};
    } catch (error) {
      return {layerId:item.layerId,layerName:item.layerName,categoryId:item.category.id,count:null,samples:[],error:String(error?.message||error)};
    }
  });
  const categories=CATEGORIES.map((category)=>summarizeCategory(category,layerResults.filter((result)=>result.categoryId===category.id)));
  const errors=layerResults.filter((result)=>result.error);
  return {
    generatedAt:new Date().toISOString(),
    area:{id:area?.id||null,department:area?.department||null,municipality:area?.municipality||null,cellCount:Number(area?.cellCount)||0,totalHa:Number(area?.totalHa)||0,retrievedAt:area?.retrievedAt||null},
    analysisGeometry:bbox,
    score:scoreReport(categories),
    categories:categories.map((category)=>({...category,status:category.count===null?'ERROR':category.count>0?'FOUND':'CLEAR'})),
    diagnostics:{queryCount:flattened.length,failedLayers:errors.map((error)=>({layerId:error.layerId,layerName:error.layerName,categoryId:error.categoryId,error:error.error})),partial:errors.length>0},
    sources:{visorGeneral:VISOR_BASE,generalBase:GENERAL_BASE,note:'Cartografía pública ANM/SIGM consultada por GEM. Verifique la vigencia directamente en ANM/AnnA Minería antes de decidir o radicar.'},
    caveat:'Screening espacial por envolvente rectangular de las celdas marcadas. Los conteos sirven para pre-due-diligence y no constituyen certificación jurídica, ambiental, de título ni de Área Libre.',
  };
}
export function anmAreaIntelligenceProxy() {
  const install=(server)=>{
    server.middlewares.use('/api/anm-area-intelligence',async(req,res)=>{
      const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
      try {
        if (req.method!=='GET') return reply(405,{error:'GET required'});
        const url=new URL(req.url||'/','http://localhost');
        const bbox=normalizedBbox({west:url.searchParams.get('west'),south:url.searchParams.get('south'),east:url.searchParams.get('east'),north:url.searchParams.get('north')});
        const area={id:cleanText(url.searchParams.get('areaId')),department:{code:cleanText(url.searchParams.get('departmentCode')),name:cleanText(url.searchParams.get('departmentName'))},municipality:{code:cleanText(url.searchParams.get('municipalityCode')),name:cleanText(url.searchParams.get('municipalityName'))},cellCount:finite(url.searchParams.get('cellCount')),totalHa:finite(url.searchParams.get('totalHa')),retrievedAt:cleanText(url.searchParams.get('retrievedAt'))};
        return reply(200,await analyze(bbox,area));
      } catch (error) {
        console.error('[ANM Area Intelligence]',error?.message||String(error));
        return reply(502,{error:'ANM area-intelligence query failed',detail:String(error?.message||error).slice(0,500)});
      }
    });
  };
  return {name:'anm-area-intelligence',configureServer:install,configurePreviewServer:install};
}
