const MODULES = Object.freeze([
  ["exploration","EXPLORATION","Regional screening",["global-satellite-mining","anm-free-areas"]],
  ["geology","GEOLOGY","Lithology · structure",["gem-prospectivity"]],
  ["geochemistry","GEOCHEMISTRY","Pathfinders · anomalies",["gem-prospectivity"]],
  ["spectral","SPECTRAL","EMIT · EnMAP · Sentinel-2",["global-satellite-mining"]],
  ["geophysics","GEOPHYSICS","X/Y/Z · subsurface",["geophysics-subsurface"]],
  ["targets","AI TARGETS","Prospectivity engine",["gem-prospectivity","geophysics-subsurface"]],
  ["resources","RESOURCES","Grade · volume · economics",["mining-economics","global-precious-metals","critical-minerals"]],
  ["planning","MINE PLANNING","Access · scenarios",["mining-economics","anm-free-areas"]],
  ["environment","ENVIRONMENT","Water · land · ESG",["anm-area-intelligence"]],
  ["concessions","CONCESSIONS","ANM · titles · claims",["anm-mining-cadastre","anm-free-areas"]],
]);

function ensureStyles() {
  if (document.getElementById("gem-main-mining-styles")) return;
  const style = document.createElement("style");
  style.id = "gem-main-mining-styles";
  style.textContent = `
    .gem-main-mining-modules{
      position:relative;z-index:20;width:100%;margin:10px 0 10px;padding:9px 9px 10px;box-sizing:border-box;
      border:1px solid rgba(34,219,241,.28);border-radius:8px;
      background:linear-gradient(180deg,rgba(3,18,27,.92),rgba(3,12,19,.96));
      box-shadow:inset 0 0 24px rgba(29,209,234,.035);
      font-family:Inter,system-ui,sans-serif;
    }
    .gem-main-mining-modules-head{
      display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;
    }
    .gem-main-mining-modules-head strong{
      color:#f2c45a;font:800 8px JetBrains Mono,monospace;letter-spacing:.14em;
    }
    .gem-main-mining-modules-head span{
      color:#658890;font:700 6px JetBrains Mono,monospace;letter-spacing:.08em;
    }
    .gem-main-mining-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}
    .gem-main-mining-grid button{
      min-width:0;height:56px;padding:6px 5px;
      display:grid;grid-template-columns:17px 1fr;grid-template-rows:auto auto;
      gap:1px 4px;text-align:left;cursor:pointer;
      border:1px solid rgba(45,207,230,.18);border-radius:6px;
      background:linear-gradient(145deg,rgba(6,34,47,.88),rgba(3,18,28,.92));
      color:#e5f7f9;transition:border-color .15s,background .15s,box-shadow .15s;
    }
    .gem-main-mining-grid button:hover,.gem-main-mining-grid button.is-active{
      border-color:#35ddf2;background:linear-gradient(145deg,rgba(10,80,98,.9),rgba(3,28,39,.96));
      box-shadow:0 0 14px rgba(35,215,241,.12),inset 0 0 18px rgba(35,215,241,.05);
    }
    .gem-main-mining-grid button:disabled{opacity:.6;cursor:wait}
    .gem-main-mining-grid button b{
      grid-row:1 / span 2;color:#35dff4;font:800 7px JetBrains Mono,monospace;
      padding-right:3px;border-right:1px solid rgba(54,205,226,.14);
    }
    .gem-main-mining-grid button strong{
      min-width:0;color:#edfaff;font:800 6.5px Inter,sans-serif;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }
    .gem-main-mining-grid button small{
      min-width:0;color:#71979f;font:600 5.2px JetBrains Mono,monospace;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }
    .gem-module-live{
      margin-top:7px;padding:5px 8px;border:1px solid rgba(47,224,179,.16);border-radius:5px;
      color:#8fe7d2;font:700 6px JetBrains Mono,monospace;letter-spacing:.05em;background:rgba(10,78,66,.10);
    }
    .gcf-right .gem-main-mining-modules{overflow:visible;display:block}
    .gcf-right .gem-main-mining-modules .gem-main-mining-modules-head{position:relative;background:linear-gradient(180deg,rgba(3,18,27,.98),rgba(3,18,27,.82));padding-bottom:6px;z-index:2}
    @media(max-width:900px){
      .gem-main-mining-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    }
  `;
  document.head.appendChild(style);
}

function getLayerEntry(dataManager,id){return dataManager?.layers?.get?.(id)||null;}

async function activateModule(dataManager,moduleId,button,status){
  const config=MODULES.find(([id])=>id===moduleId);
  if(!config)return;
  const [,label,,layerIds]=config;
  if(!dataManager){status.textContent="GEM CORE · DATA MANAGER NOT READY";return;}
  button.disabled=true;status.textContent=label+" · ACTIVATING…";
  const results=[];
  try{
    for(const layerId of layerIds){
      try{
        const ok=await dataManager.setEnabled(layerId,true,{origin:"user"});
        results.push({layerId,ok:ok!==false});
      }catch(error){
        results.push({layerId,ok:false,error:String(error?.message||error)});
      }
    }
    const failed=results.filter((x)=>!x.ok);
    status.textContent=failed.length?label+" · DEGRADED · "+failed.length+" ERROR(S)":label+" · ONLINE";
    document.dispatchEvent(new CustomEvent("gem:mining-module",{detail:{module:moduleId,label,layerIds,results}}));
    console.info("[GEM Mining Module]",label,results.map((x)=>x.layerId+":"+x.ok).join(" · "));
  }finally{button.disabled=false;}
}

export function installGemMiningModules(dataManager){
  if(!dataManager||typeof document==="undefined")return()=>{};
  window.__gemDataManager=dataManager;
  let disposed=false;

  const render=()=>{
    if(disposed||document.getElementById("gem-main-mining-modules"))return true;
    const header=document.querySelector(".gem-command-header");
    const mapHud=document.querySelector(".gem-map-hud");
    const right=document.querySelector(".gcf-right");
    if(!header||!mapHud||!right)return false;

    ensureStyles();
    const section=document.createElement("section");
    section.id="gem-main-mining-modules";
    section.className="gem-main-mining-modules";
    section.setAttribute("aria-label","TerraQueen Mining Intelligence modules");
    section.innerHTML=`
      <div class="gem-main-mining-modules-head">
        <strong>MINING MODULES</strong>
        <span>LIVE GEM ENGINE</span>
      </div>
      <div class="gem-main-mining-grid">
        ${MODULES.map(([id,label,sub],i)=>`
          <button type="button" data-gem-mining-module="${id}" title="${label} · ${sub}">
            <b>${String(i+1).padStart(2,"0")}</b>
            <strong>${label}</strong>
            <small>${sub}</small>
          </button>
        `).join("")}
      </div>
      <div class="gem-module-live">SELECT MODULE · ACTIVATE REAL LAYERS</div>
    `;
    const controls = right.querySelector(".gcf-views");
    if (controls) right.insertBefore(section, controls);
    else right.prepend(section);
    const status=section.querySelector(".gem-module-live");
    section.querySelectorAll("[data-gem-mining-module]").forEach((button)=>{
      button.addEventListener("click",()=>{
        section.querySelectorAll("button").forEach((node)=>node.classList.remove("is-active"));
        button.classList.add("is-active");
        void activateModule(dataManager,button.dataset.gemMiningModule,button,status);
      });
    });
    return true;
  };

  if(!render()){
    const observer=new MutationObserver(()=>{
      if(render())observer.disconnect();
    });
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>{disposed=true;observer.disconnect();};
  }
  return()=>{disposed=true;document.getElementById("gem-main-mining-modules")?.remove();};
}
