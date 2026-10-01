import { calculateGrossMetalValue } from '../mining/core/economicValue.js';

const CRITICAL_MINERALS_2025 = Object.freeze([
  ['aluminum','Aluminio','base'],['antimony','Antimonio','technology'],['arsenic','Arsénico','technology'],
  ['barite','Barita','industrial'],['beryllium','Berilio','technology'],['bismuth','Bismuto','technology'],
  ['boron','Boro','industrial'],['cerium','Cerio','rare-earth'],['cesium','Cesio','technology'],
  ['chromium','Cromo','industrial'],['cobalt','Cobalto','battery'],['copper','Cobre','base'],
  ['dysprosium','Disprosio','rare-earth'],['erbium','Erbio','rare-earth'],['europium','Europio','rare-earth'],
  ['fluorspar','Fluorita','industrial'],['gadolinium','Gadolinio','rare-earth'],['gallium','Galio','technology'],
  ['germanium','Germanio','technology'],['graphite','Grafito','battery'],['hafnium','Hafnio','technology'],
  ['holmium','Holmio','rare-earth'],['indium','Indio','technology'],['iridium','Iridio','pgm'],
  ['lanthanum','Lantano','rare-earth'],['lead','Plomo','base'],['lithium','Litio','battery'],
  ['lutetium','Lutecio','rare-earth'],['magnesium','Magnesio','industrial'],['manganese','Manganeso','battery'],
  ['metallurgical-coal','Carbón metalúrgico','industrial'],['neodymium','Neodimio','rare-earth'],
  ['nickel','Níquel','battery'],['niobium','Niobio','industrial'],['palladium','Paladio','pgm'],
  ['phosphate','Fosfato','fertilizer'],['platinum','Platino','pgm'],['potash','Potasa','fertilizer'],
  ['praseodymium','Praseodimio','rare-earth'],['rhenium','Renio','technology'],['rhodium','Rodio','pgm'],
  ['rubidium','Rubidio','technology'],['ruthenium','Rutenio','pgm'],['samarium','Samario','rare-earth'],
  ['scandium','Escandio','technology'],['silicon','Silicio','technology'],['silver','Plata','precious'],
  ['tantalum','Tantalio','technology'],['tellurium','Telurio','technology'],['terbium','Terbio','rare-earth'],
  ['thulium','Tulio','rare-earth'],['tin','Estaño','technology'],['titanium','Titanio','industrial'],
  ['tungsten','Tungsteno','industrial'],['uranium','Uranio','energy'],['vanadium','Vanadio','battery'],
  ['ytterbium','Iterbio','rare-earth'],['yttrium','Itrio','rare-earth'],['zinc','Zinc','base'],
  ['zirconium','Circonio','industrial'],
]);

const TRADE_CORRIDORS = Object.freeze([
  { id:'andes-pacific', name:'Andes → Pacífico', origin:'Andes', destination:'Asia-Pacífico', mode:'marítimo', status:'MODELO' },
  { id:'andes-atlantic', name:'Andes → Atlántico', origin:'Andes', destination:'Europa / Oriente Medio', mode:'marítimo', status:'MODELO' },
  { id:'latam-gulf', name:'LatAm → Golfo', origin:'Latinoamérica', destination:'Golfo', mode:'marítimo / aéreo', status:'MODELO' },
]);

const OFAC_SOURCES = Object.freeze([
  { name:'OFAC SDN', status:'provider-ready', description:'Lista de Specially Designated Nationals' },
  { name:'OFAC Consolidated', status:'provider-ready', description:'Listas no-SDN consolidadas' },
  { name:'PEP', status:'provider-required', description:'Fuente PEP externa pendiente' },
  { name:'Adverse Media', status:'provider-required', description:'Proveedor de noticias/OSINT pendiente' },
  { name:'UBO / Ownership', status:'provider-required', description:'Registro corporativo pendiente' },
]);

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  })[c]);
}

function panelShell(id, title, subtitle, source) {
  const panel = document.createElement('section');
  panel.id = id;
  panel.style.cssText = [
    'position:absolute','top:92px','right:calc(var(--right-rail-x, 52px) + 350px)',
    'width:min(560px,calc(100vw - 430px))','max-height:calc(100vh - 150px)',
    'overflow:auto','box-sizing:border-box','padding:15px 16px 12px',
    'color:#eef8fa','background:linear-gradient(150deg,rgba(4,17,23,.97),rgba(7,24,30,.95))',
    'border:1px solid rgba(32,206,216,.28)','border-radius:11px',
    'box-shadow:0 18px 50px rgba(0,0,0,.55)','backdrop-filter:blur(11px)',
    'z-index:158','font-family:monospace',
  ].join(';');
  panel.innerHTML =
    '<div style="display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:10px">' +
    '<div><div style="font-size:8px;letter-spacing:.16em;color:#f2c55d;font-weight:700">TERRAQUEEN · INTELLIGENCE</div>' +
    '<div style="font:700 18px system-ui,sans-serif;letter-spacing:.06em;margin-top:3px">'+esc(title)+'</div>' +
    '<div style="font-size:8px;letter-spacing:.1em;color:#67dfe6;margin-top:3px">'+esc(subtitle)+'</div></div>' +
    '<div style="font-size:8px;color:#6f9298;text-align:right;max-width:150px">'+esc(source)+'</div></div>';
  return panel;
}

function field(label, value, step='0.01') {
  const wrap=document.createElement('label');
  wrap.style.cssText='display:grid;gap:4px';
  wrap.innerHTML='<span style="font-size:8px;letter-spacing:.08em;color:#79a5aa">'+esc(label)+'</span>';
  const input=document.createElement('input');
  input.type='number'; input.step=step; input.min='0'; input.value=String(value);
  input.style.cssText='box-sizing:border-box;width:100%;padding:7px;border:1px solid rgba(32,206,216,.2);border-radius:5px;background:rgba(2,12,17,.9);color:#eef8fa;font:10px monospace';
  wrap.appendChild(input);
  return {wrap,input};
}

function button(label) {
  const b=document.createElement('button');
  b.type='button'; b.textContent=label;
  b.style.cssText='border:1px solid rgba(32,206,216,.28);background:rgba(32,206,216,.06);color:#9fe9ed;border-radius:5px;padding:6px 9px;font:700 9px monospace;cursor:pointer';
  return b;
}

function createPanelLayer({ id, name, icon, source, buildPanel, stats }) {
  let viewer=null, panel=null, enabled=false, destroyed=false;
  return {
    id,name,icon,source,updateInterval:0,
    init(nextViewer){ viewer=nextViewer||null; return Boolean(viewer); },
    enable(nextViewer){
      if(destroyed) return false;
      viewer=nextViewer||viewer;
      if(!viewer?.container) return false;
      enabled=true;
      if(!panel) {
        panel=buildPanel();
        viewer.container.appendChild(panel);
      }
      panel.hidden=false;
      return true;
    },
    disable(){
      enabled=false;
      if(panel) panel.hidden=true;
      return true;
    },
    update(){ return enabled; },
    destroy(){
      enabled=false; panel?.remove?.(); panel=null; viewer=null; destroyed=true;
    },
    getStats(){ return stats(enabled); },
  };
}

function calculateEconomics(input) {
  const tonnes=finite(input.tonnes), grade=finite(input.grade), recovery=finite(input.recovery,90);
  const price=finite(input.price,0), opexPerTonne=finite(input.opex), sustaining=finite(input.sustaining);
  const capex=finite(input.capex), years=Math.max(1,Math.round(finite(input.years,5)));
  const value=calculateGrossMetalValue({ commodity:input.commodity, tonnes, grade, recoveryPercent:recovery, priceUsd:price });
  const revenue=value.grossValueUsd ?? 0;
  const opex=tonnes*opexPerTonne;
  const sustainingCost=tonnes*sustaining;
  const ebitda=revenue-opex;
  const freeCash=ebitda-sustainingCost;
  const precious=value.priceUnit==='USD/toz';
  const denominator=precious ? value.recoveredTroyOz : value.recoveredMetalTonnes;
  const aisc=denominator>0 ? (opex+sustainingCost)/denominator : null;
  const breakEvenPrice=denominator>0 ? (opex+sustainingCost)/denominator : null;
  const annual=[...Array(years)].map((_,i)=>i===0?-capex:freeCash);
  const discount=Math.max(-0.99,finite(input.discount,10)/100);
  const npv=annual.reduce((sum,cash,i)=>sum+cash/Math.pow(1+discount,i),0);
  const npvAt=(rate)=>annual.reduce((sum,cash,i)=>sum+cash/Math.pow(1+rate,i),0);
  let irr=null;
  let lo=-0.99, hi=10, flo=npvAt(lo), fhi=npvAt(hi);
  if(Number.isFinite(flo)&&Number.isFinite(fhi)&&flo*fhi<0){
    for(let i=0;i<80;i++){
      const mid=(lo+hi)/2, fm=npvAt(mid);
      if(Math.abs(fm)<1e-6){ irr=mid*100; break; }
      if(flo*fm<=0){hi=mid;fhi=fm;} else {lo=mid;flo=fm;}
    }
    if(irr===null) irr=((lo+hi)/2)*100;
  }
  return { ...value, revenue, opex, sustainingCost, ebitda, freeCash, aisc, breakEvenPrice, npv, irr };
}

export function createProjectEconomicsLayer() {
  let latest=null;
  return createPanelLayer({
    id:'mining-economics', name:'Economía Minera', icon:'$', source:'GEM · PROJECT ECONOMICS',
    buildPanel(){
      const panel=panelShell('terraqueen-mining-economics','ECONOMÍA MINERA','RESOURCE → REVENUE → OPEX → CAPEX → NPV / IRR','Modelo paramétrico · no reserva certificada');
      const grid=document.createElement('div');
      grid.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px';
      const f={};
      [['TONELADAS',10000,'1'],['LEY',2,'0.01'],['RECUPERACIÓN %',90,'0.1'],['PRECIO USD',2500,'0.01'],['OPEX USD/t',45,'0.01'],['SUSTAINING USD/t',10,'0.01'],['CAPEX USD',5000000,'1000'],['AÑOS',5,'1'],['DESCUENTO %',10,'0.1']].forEach(([l,v,s])=>{f[l]=field(l,v,s);grid.appendChild(f[l].wrap);});
      const commodity=document.createElement('select');
      commodity.innerHTML='<option value="gold">Oro</option><option value="silver">Plata</option><option value="platinum">Platino</option><option value="palladium">Paladio</option><option value="copper">Cobre</option><option value="tungsten">Tungsteno</option>';
      commodity.style.cssText='grid-column:1/-1;padding:7px;background:#071820;color:#eef8fa;border:1px solid rgba(32,206,216,.2);border-radius:5px;font:10px monospace';
      grid.appendChild(commodity); panel.appendChild(grid);
      const output=document.createElement('div'); output.style.cssText='margin-top:10px;padding:10px;border:1px solid rgba(242,197,93,.2);border-radius:6px';
      const render=()=>{
        latest=calculateEconomics({commodity:commodity.value,tonnes:f['TONELADAS'].input.value,grade:f['LEY'].input.value,recovery:f['RECUPERACIÓN %'].input.value,price:f['PRECIO USD'].input.value,opex:f['OPEX USD/t'].input.value,sustaining:f['SUSTAINING USD/t'].input.value,capex:f['CAPEX USD'].input.value,years:f['AÑOS'].input.value,discount:f['DESCUENTO %'].input.value});
        output.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:9px">'+
          [['VALOR BRUTO',latest.revenue],['EBITDA',latest.ebitda],['FREE CASH FLOW',latest.freeCash],['AISC / unidad',latest.aisc],['BREAK-EVEN',latest.breakEvenPrice],['NPV',latest.npv],['IRR',latest.irr]].map(([k,v])=>'<div><span style="color:#78989e">'+k+'</span><br><strong style="color:#f2c55d">'+(v==null?'—':Number(v).toLocaleString('en-US',{maximumFractionDigits:2}))+(k==='IRR'?' %':' USD')+'</strong></div>').join('')+'</div>'+
          '<div style="margin-top:9px;color:#78989e;font-size:8px;line-height:1.4">Escenario paramétrico. No representa recurso, reserva, ley de corte, costos auditados ni valoración financiera certificada.</div>';
      };
      Object.values(f).forEach(x=>x.input.addEventListener('input',render)); commodity.addEventListener('change',render); render(); panel.appendChild(output);
      return panel;
    },
    stats:enabled=>({enabled,scenario:latest?{npv:latest.npv,irr:latest.irr,ebitda:latest.ebitda}:null}),
  });
}

export function createCriticalMineralsLayer() {
  let selected='tungsten';
  return createPanelLayer({
    id:'critical-minerals', name:'Minerales Críticos', icon:'◆', source:'USGS · 2025 LIST',
    buildPanel(){
      const panel=panelShell('terraqueen-critical-minerals','MINERALES CRÍTICOS','SUPPLY CHAIN · TECHNOLOGY · STRATEGIC MATERIALS','USGS Final 2025 · 60 commodities');
      const filter=document.createElement('input'); filter.placeholder='Filtrar mineral…'; filter.style.cssText='margin-top:11px;width:100%;box-sizing:border-box;padding:7px;background:rgba(2,12,17,.9);border:1px solid rgba(32,206,216,.2);color:#eef8fa;border-radius:5px;font:10px monospace'; panel.appendChild(filter);
      const body=document.createElement('div'); body.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:10px'; panel.appendChild(body);
      const render=()=>{
        body.replaceChildren();
        const q=filter.value.trim().toLowerCase();
        CRITICAL_MINERALS_2025.filter(([id,name])=>!q||id.includes(q)||name.toLowerCase().includes(q)).forEach(([id,name,group])=>{
          const b=button(name); b.style.textAlign='left'; b.title=group;
          b.addEventListener('click',()=>{selected=id; [...body.children].forEach(x=>x.style.borderColor='rgba(32,206,216,.28)'); b.style.borderColor='#f2c55d';});
          if(id===selected) b.style.borderColor='#f2c55d';
          body.appendChild(b);
        });
      };
      filter.addEventListener('input',render); render();
      const note=document.createElement('div'); note.style.cssText='margin-top:11px;padding:9px;border-top:1px solid rgba(255,255,255,.08);font-size:8px;line-height:1.45;color:#86a4a9'; note.textContent='La lista se usa como clasificación de inteligencia, no como pronóstico de precio ni como recomendación de inversión. Los datos de producción/comercio deben entrar desde fuentes específicas antes de calcular dependencia o concentración.'; panel.appendChild(note);
      return panel;
    },
    stats:enabled=>({enabled,count:CRITICAL_MINERALS_2025.length,selected,source:'USGS 2025'}),
  });
}

export function createEntityIntelligenceLayer() {
  let query='', lastStatus='NOT_SCREENED';
  return createPanelLayer({
    id:'entity-intelligence', name:'Entity / AML Intelligence', icon:'◎', source:'AML · KYC · SANCTIONS · UBO',
    buildPanel(){
      const panel=panelShell('terraqueen-entity-intelligence','ENTITY / AML INTELLIGENCE','KYC · SANCTIONS · PEP · UBO · ADVERSE MEDIA','Provider-neutral screening framework');
      const input=document.createElement('input'); input.placeholder='Nombre de persona o empresa…'; input.style.cssText='margin-top:12px;width:100%;box-sizing:border-box;padding:8px;background:rgba(2,12,17,.9);border:1px solid rgba(32,206,216,.2);color:#eef8fa;border-radius:5px;font:10px monospace';
      const run=button('PREPARAR SCREENING'); run.style.marginTop='7px'; panel.append(input,run);
      const result=document.createElement('div'); result.style.cssText='margin-top:10px;padding:10px;border:1px solid rgba(242,197,93,.2);border-radius:6px;font-size:9px;line-height:1.45'; panel.appendChild(result);
      const render=()=>{
        query=input.value.trim();
        lastStatus=query?'READY_FOR_PROVIDER':'NOT_SCREENED';
        result.innerHTML='<strong style="color:#f2c55d">'+(query?esc(query):'Sin entidad seleccionada')+'</strong><br><span style="color:#86a4a9">'+(query?'No se ejecuta un match remoto en esta versión. Conecta un proveedor y conserva evidencia de fuente/fecha antes de emitir un resultado.':'Introduce una entidad para preparar la consulta.')+'</span>';
      };
      run.addEventListener('click',render); input.addEventListener('input',()=>{lastStatus='NOT_SCREENED';});
      const list=document.createElement('div'); list.style.cssText='margin-top:10px;display:grid;gap:5px';
      OFAC_SOURCES.forEach(s=>{const row=document.createElement('div'); row.style.cssText='display:flex;justify-content:space-between;gap:10px;padding:7px;border:1px solid rgba(255,255,255,.06);border-radius:4px;font-size:8px'; row.innerHTML='<span>'+esc(s.name)+'</span><span style="color:'+(s.status==='provider-ready'?'#70f0c5':'#f2c55d')+'">'+esc(s.status.toUpperCase())+'</span>'; list.appendChild(row);});
      panel.appendChild(list);
      const disclaimer=document.createElement('div'); disclaimer.style.cssText='margin-top:9px;color:#748f95;font-size:8px;line-height:1.4'; disclaimer.textContent='AML/KYC no produce una conclusión automática sobre culpabilidad o ilegalidad. Un posible match requiere resolución de identidad, evidencia, fecha de consulta y revisión humana.'; panel.appendChild(disclaimer);
      return panel;
    },
    stats:enabled=>({enabled,status:lastStatus,query:query||null,sources:OFAC_SOURCES.length}),
  });
}

export function createTradeIntelligenceLayer() {
  let selected=TRADE_CORRIDORS[0].id;
  return createPanelLayer({
    id:'mineral-trade-intelligence', name:'Mineral Trade Intelligence', icon:'⇄', source:'TRADE · FLOWS · CORRIDORS · CONCENTRATION',
    buildPanel(){
      const panel=panelShell('terraqueen-mineral-trade','MINERAL TRADE INTELLIGENCE','ORIGIN → PROCESSING → REFINERY → BUYER → PORT','Model layer · provider-ready');
      const list=document.createElement('div'); list.style.cssText='display:grid;gap:7px;margin-top:12px';
      TRADE_CORRIDORS.forEach(c=>{const b=button(c.name); b.style.textAlign='left'; b.innerHTML='<strong>'+esc(c.name)+'</strong><br><span style="font-weight:400;color:#78989e">'+esc(c.origin)+' → '+esc(c.destination)+' · '+esc(c.mode)+'</span>'; b.addEventListener('click',()=>{selected=c.id;renderDetail(c)}); list.appendChild(b);});
      panel.appendChild(list);
      const detail=document.createElement('div'); detail.style.cssText='margin-top:10px;padding:10px;border:1px solid rgba(32,206,216,.2);border-radius:6px;font-size:9px;line-height:1.5'; panel.appendChild(detail);
      const renderDetail=c=>{detail.innerHTML='<strong style="color:#f2c55d">'+esc(c.name)+'</strong><br>Estado: '+esc(c.status)+'<br>Modelo de flujo listo para conectar a aduanas, comercio exterior, embarques, puertos, refinerías y compradores.<br><span style="color:#78989e">No se muestran volúmenes reales hasta recibir una fuente de datos con fecha, unidad y cobertura geográfica.</span>';}; renderDetail(TRADE_CORRIDORS[0]);
      return panel;
    },
    stats:enabled=>({enabled,corridors:TRADE_CORRIDORS.length,selected}),
  });
}
