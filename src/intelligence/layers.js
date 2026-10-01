import { calculateGrossMetalValue } from '../mining/core/economicValue.js';
import { createEntityIntelligenceSource } from './entityIntelligenceSource.js';
import {
  getCriticalMineralCatalog,
  getCriticalMineralRecord,
  getTaxonomyStats,
  calculateCriticalityCoverage,
  getCriticalMineralSources,
} from './criticalMinerals/index.js';

const TRADE_CORRIDORS = Object.freeze([
  { id:'andes-pacific', name:'Andes → Pacífico', origin:'Andes', destination:'Asia-Pacífico', mode:'marítimo', status:'MODELO' },
  { id:'andes-atlantic', name:'Andes → Atlántico', origin:'Andes', destination:'Europa / Oriente Medio', mode:'marítimo', status:'MODELO' },
  { id:'latam-gulf', name:'LatAm → Golfo', origin:'Latinoamérica', destination:'Golfo', mode:'marítimo / aéreo', status:'MODELO' },
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
  const catalog=getCriticalMineralCatalog();
  return createPanelLayer({
    id:'critical-minerals', name:'Minerales Críticos', icon:'◆',
    source:'GEM · GLOBAL CRITICAL MINERALS INTELLIGENCE',
    buildPanel(){
      const panel=panelShell(
        'terraqueen-critical-minerals',
        'GLOBAL CRITICAL MINERALS INTELLIGENCE',
        'TAXONOMY · SUPPLY CHAIN · CRITICALITY · OPPORTUNITY',
        'USGS 2025 · EU CRMA 2024 · IEA 2026'
      );
      const toolbar=document.createElement('div');
      toolbar.style.cssText='display:grid;grid-template-columns:1fr auto;gap:6px;margin-top:11px';
      const filter=document.createElement('input');
      filter.placeholder='Buscar mineral…';
      filter.style.cssText='width:100%;box-sizing:border-box;padding:7px;background:rgba(2,12,17,.9);border:1px solid rgba(32,206,216,.2);color:#eef8fa;border-radius:5px;font:10px monospace';
      const status=button('USGS 60');
      status.disabled=true; status.style.opacity='.8';
      toolbar.append(filter,status); panel.appendChild(toolbar);
      const meta=document.createElement('div');
      meta.style.cssText='margin-top:8px;color:#78989e;font-size:8px;line-height:1.4';
      panel.appendChild(meta);
      const body=document.createElement('div');
      body.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:10px';
      panel.appendChild(body);
      const detail=document.createElement('div');
      detail.style.cssText='margin-top:10px;padding:10px;border:1px solid rgba(242,197,93,.2);border-radius:6px;font-size:8px;line-height:1.5';
      panel.appendChild(detail);

      const renderDetail=(record)=>{
        const classes=record.classifications;
        const coverage=calculateCriticalityCoverage();
        detail.innerHTML='<strong style="color:#f2c55d">'+esc(record.name)+'</strong>'+
          '<br>ID: '+esc(record.id)+
          '<br>Grupo GEM: '+esc(record.group)+
          '<br>USGS: 2025 · '+esc(classes.usgs)+
          '<br>EU CRM: '+esc(classes.eu||'—')+
          '<br>EU Strategic: '+esc(classes.euStrategic||'—')+
          '<br>IEA: '+esc(classes.iea||'—')+
          '<br>Criticality coverage: '+coverage.coveragePercent+'% · '+coverage.status+
          '<br><span style="color:#78989e">Producción, reservas, refinación, demanda, comercio, precios y restricciones no se inventan: requieren una fuente fechada y trazable.</span>';
      };

      const render=()=>{
        body.replaceChildren();
        const q=filter.value.trim().toLowerCase();
        const rows=catalog.filter(r=>!q||r.id.includes(q)||r.name.toLowerCase().includes(q));
        for(const record of rows){
          const b=button(record.name);
          b.style.textAlign='left';
          b.title=record.group;
          if(record.id===selected) b.style.borderColor='#f2c55d';
          b.addEventListener('click',()=>{
            selected=record.id;
            [...body.children].forEach(x=>x.style.borderColor='rgba(32,206,216,.28)');
            b.style.borderColor='#f2c55d';
            renderDetail(record);
          });
          body.appendChild(b);
        }
        meta.textContent=rows.length+' minerales visibles · '+catalog.length+' USGS · '+getTaxonomyStats().euCrma2024+' EU CRM · '+getTaxonomyStats().euStrategic2024+' EU strategic · métricas dinámicas: provider-required';
        renderDetail(getCriticalMineralRecord(selected)||catalog[0]);
      };
      filter.addEventListener('input',render);
      render();
      return panel;
    },
    stats:enabled=>({
      enabled,
      count:catalog.length,
      selected,
      source:'USGS 2025',
      taxonomies:getTaxonomyStats(),
      metricStatus:'NOT_CONNECTED',
      temporalVersion:'2026.10',
      authoritativeSources:getCriticalMineralSources().map(source=>({id:source.id,provider:source.provider,year:source.year})),
    }),
  });
}

export function createEntityIntelligenceLayer({ source = createEntityIntelligenceSource() } = {}) {
  let query = '';
  let lastStatus = 'NOT_SCREENED';
  let lastResult = null;

  const sourceLabels = Object.freeze([
    ['ofacSdn', 'OFAC SDN'],
    ['ofacConsolidated', 'OFAC Consolidated'],
    ['pep', 'PEP'],
    ['adverseMedia', 'Adverse Media'],
    ['ubo', 'UBO / Ownership'],
  ]);

  return createPanelLayer({
    id: 'entity-intelligence',
    name: 'Entity / AML Intelligence',
    icon: '◎',
    source: 'AML · KYC · SANCTIONS · PEP · UBO',
    buildPanel() {
      const panel = panelShell(
        'terraqueen-entity-intelligence',
        'ENTITY / AML INTELLIGENCE',
        'KYC · SANCTIONS · PEP · UBO · ADVERSE MEDIA',
        'Live provider screening'
      );

      const controls = document.createElement('div');
      controls.style.cssText = 'display:grid;grid-template-columns:1fr auto auto;gap:7px;margin-top:12px';
      const input = document.createElement('input');
      input.placeholder = 'Nombre de persona o empresa…';
      input.style.cssText = 'width:100%;box-sizing:border-box;padding:8px;background:rgba(2,12,17,.9);border:1px solid rgba(32,206,216,.2);color:#eef8fa;border-radius:5px;font:10px monospace';
      const kind = document.createElement('select');
      kind.innerHTML = '<option value="person">PERSONA</option><option value="company">EMPRESA</option>';
      kind.style.cssText = input.style.cssText;
      const run = button('EJECUTAR SCREENING');
      controls.append(input, kind, run);
      panel.appendChild(controls);

      const statusLine = document.createElement('div');
      statusLine.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin-top:8px';
      panel.appendChild(statusLine);

      const result = document.createElement('div');
      result.style.cssText = 'margin-top:10px;display:grid;gap:8px';
      panel.appendChild(result);

      const renderSources = (statuses) => {
        statusLine.replaceChildren();
        for (const [id, label] of sourceLabels) {
          const item = document.createElement('span');
          const row = (statuses || []).find((s) => s.id === id);
          const ready = row?.status === 'provider-ready';
          item.textContent = `${label} · ${ready ? 'READY' : String(row?.status || 'UNAVAILABLE').toUpperCase()}`;
          item.style.cssText = `padding:4px 6px;border:1px solid ${ready ? 'rgba(112,240,197,.24)' : 'rgba(242,197,93,.24)'};border-radius:4px;color:${ready ? '#70f0c5' : '#f2c55d'};font-size:7px`;
          item.title = row?.description || '';
          statusLine.appendChild(item);
        }
      };

      const makeBox = (title, body, tone = '#86a4a9') => {
        const box = document.createElement('div');
        box.style.cssText = 'padding:9px;border:1px solid rgba(255,255,255,.07);border-radius:6px;background:rgba(2,12,17,.5);font-size:8px;line-height:1.45';
        box.innerHTML = `<strong style="color:#f2c55d">${esc(title)}</strong><div style="margin-top:5px;color:${tone}">${body}</div>`;
        return box;
      };

      const renderResults = (payload) => {
        result.replaceChildren();
        const sources = payload?.sources || {};
        const counts = [
          ['OFAC SDN', sources.ofacSdn?.matches?.length || 0],
          ['OFAC Consolidated', sources.ofacConsolidated?.matches?.length || 0],
          ['PEP', sources.pep?.matches?.length || 0],
          ['Adverse Media', sources.adverseMedia?.matches?.length || 0],
          ['UBO', sources.ubo?.matches?.length || 0],
        ];
        result.appendChild(makeBox(
          `SCREENING · ${payload.query}`,
          `${counts.map(([name, count]) => `${name}: <b>${count}</b>`).join(' · ')}<br>Consultado: ${esc(payload.retrievedAt || '')}`
        ));

        for (const [title, key] of [
          ['OFAC SDN', 'ofacSdn'],
          ['OFAC CONSOLIDATED', 'ofacConsolidated'],
          ['PEP / RCA', 'pep'],
          ['ADVERSE MEDIA', 'adverseMedia'],
          ['UBO / OWNERSHIP', 'ubo'],
        ]) {
          const item = sources[key];
          if (!item) continue;
          if (item.status === 'not-configured') {
            result.appendChild(makeBox(title, 'Proveedor no configurado. Configure OPENSANCTIONS_API_KEY para activar PEP.', '#f2c55d'));
            continue;
          }
          if (item.status === 'error') {
            result.appendChild(makeBox(title, `Error del proveedor: ${esc(item.error || 'desconocido')}`, '#ff9c8f'));
            continue;
          }
          const rows = Array.isArray(item.matches) ? item.matches : [];
          if (!rows.length) {
            result.appendChild(makeBox(title, 'Sin candidatos devueltos por la fuente.', '#70f0c5'));
            continue;
          }
          const body = rows.slice(0, 6).map((row) => {
            if (row.url) {
              return `<div style="margin-bottom:5px"><a href="${esc(row.url)}" target="_blank" rel="noreferrer" style="color:#67dfe6">${esc(row.title || row.url)}</a><br><span>${esc(row.domain || '')} · ${esc(row.publishedAt || '')}</span></div>`;
            }
            if (row.legalName) {
              const parents = row.parent ? ` · parent: ${esc(JSON.stringify(row.parent))}` : '';
              return `<div style="margin-bottom:5px"><b>${esc(row.legalName)}</b> · LEI ${esc(row.lei || '—')} · ${esc(row.country || '')}${parents}</div>`;
            }
            return `<div style="margin-bottom:5px"><b>${esc(row.name || 'candidate')}</b> · score ${Number(row.score || 0).toFixed(3)} ${row.match ? '· MATCH' : ''}<br><span>${esc((row.topics || row.programs || row.datasets || []).join(' · '))}</span></div>`;
          }).join('');
          result.appendChild(makeBox(title, body));
        }

        result.appendChild(makeBox(
          'METHODOLOGY',
          `${esc(payload.methodology || '')}<br><span style="color:#748f95">Fuente, fecha y evidencia se conservan en la respuesta de cada proveedor; un candidato no es una determinación legal.</span>`,
          '#9eb9bd'
        ));
      };

      input.addEventListener('input', () => {
        query = input.value.trim();
        lastStatus = 'NOT_SCREENED';
      });
      run.addEventListener('click', async () => {
        query = input.value.trim();
        if (query.length < 2) {
          lastStatus = 'INVALID_QUERY';
          result.replaceChildren(makeBox('SCREENING', 'Introduce al menos 2 caracteres.', '#ff9c8f'));
          return;
        }
        lastStatus = 'SCREENING';
        run.disabled = true;
        result.replaceChildren(makeBox('SCREENING', 'Consultando fuentes AML…', '#67dfe6'));
        try {
          const payload = await source.screen({ query, entityType: kind.value });
          lastResult = payload;
          lastStatus = 'COMPLETE';
          renderResults(payload);
        } catch (error) {
          lastStatus = 'ERROR';
          result.replaceChildren(makeBox('SCREENING ERROR', error?.message || String(error), '#ff9c8f'));
        } finally {
          run.disabled = false;
        }
      });

      source.status().then((payload) => renderSources(payload.sources)).catch(() => renderSources([]));

      return panel;
    },
    stats: enabled => ({
      enabled,
      status: lastStatus,
      query: query || null,
      sources: sourceLabels.length,
      lastRetrievedAt: lastResult?.retrievedAt || null,
    }),
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
