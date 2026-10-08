/**
 * GEM Asset Intelligence Center.
 * Connects Asset Passports/Digital Twins to the visual command surface.
 */
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function row(k,v){return '<div class="gem-asset-row"><span>'+esc(k)+'</span><b>'+esc(v??'—')+'</b></div>';}

function render(panel,twin){
 if(!twin){panel.innerHTML='<div class="gem-asset-kicker">GEM ASSET INTELLIGENCE</div><strong>Select a physical asset</strong>';return;}
 const links=twin.links||{};
 panel.innerHTML=
  '<div class="gem-asset-head"><div><span class="gem-asset-kicker">GEM ASSET DIGITAL TWIN</span><strong>'+esc(twin.assetId)+'</strong></div><button data-close>×</button></div>'+
  '<div class="gem-asset-state">'+esc(twin.state||'IDENTIFIED')+'</div>'+
  '<div class="gem-asset-grid">'+
   row('Commodity',twin.commodity)+row('Asset type',twin.assetType)+
   row('Weight',twin.weight!=null?String(twin.weight)+' '+(twin.weightUnit||'kg'):'—')+
   row('Fine weight',twin.fineWeight??'—')+row('Purity',twin.purity!=null?String(twin.purity)+' %':'—')+
   row('Owner',twin.ownerId)+row('Facility',twin.facilityId)+row('Location',twin.location?.label||twin.location||'—')+
  '</div>'+
  '<section><h4>LINKED SYSTEMS</h4>'+
   row('Passport',twin.passportId)+row('Custody lot',links.custodyLotId)+row('Shipment',links.shipmentId)+
   row('Trade',links.tradeId)+row('Finance',links.financeId)+row('Payment',links.paymentId)+row('Settlement',links.settlementId)+
  '</section>'+
  '<section><h4>TRUST / EVIDENCE</h4>'+
   row('Evidence items',(twin.evidenceHashes||[]).length)+row('Lifecycle events',(twin.events||[]).length)+
   row('Last event',twin.events?.length?twin.events[twin.events.length-1].type:'—')+
  '</section>';
 panel.querySelector('[data-close]')?.addEventListener('click',()=>panel.classList.remove('is-open'));
}

export function installGemAssetIntelligenceCenter(){
 const install=()=>{
  if(document.querySelector('.gem-asset-intelligence'))return;
  const panel=document.createElement('aside');panel.className='gem-asset-intelligence';
  const style=document.createElement('style');style.textContent=[
   '.gem-asset-intelligence{position:fixed;right:18px;top:90px;width:370px;max-height:70vh;overflow:auto;z-index:11900;display:none;padding:16px;background:rgba(6,12,17,.97);border:1px solid rgba(88,213,232,.42);box-shadow:0 18px 60px rgba(0,0,0,.45);backdrop-filter:blur(14px);color:#dcecf0;font:12px/1.45 Inter,system-ui,sans-serif}',
   '.gem-asset-intelligence.is-open{display:block}.gem-asset-head{display:flex;justify-content:space-between}.gem-asset-head strong{display:block;font:700 19px/1.1 ui-monospace,monospace;margin-top:4px}.gem-asset-head button{background:none;border:0;color:#9eb6bd;font-size:22px;cursor:pointer}.gem-asset-kicker{font-size:10px;letter-spacing:.16em;color:#58d5e8}.gem-asset-state{margin:12px 0;padding:6px 8px;border:1px solid #31505a;color:#7fe4ef;font:10px ui-monospace,monospace}.gem-asset-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}.gem-asset-intelligence section{border-top:1px solid rgba(130,170,180,.18);margin-top:10px;padding-top:10px}.gem-asset-intelligence h4{margin:0 0 7px;font-size:9px;letter-spacing:.14em;color:#7f969d}.gem-asset-row{display:flex;justify-content:space-between;gap:8px;padding:4px 0}.gem-asset-row span{color:#849ba2}.gem-asset-row b{font-family:ui-monospace,monospace;text-align:right;overflow-wrap:anywhere}'
  ].join('');document.head.append(style);document.body.append(panel);
  document.addEventListener('gem:asset-twin-selected',e=>{render(panel,e.detail);panel.classList.add('is-open');});
  document.addEventListener('gem:target-selected',e=>{
   const twin=e.detail?.assetTwin||e.detail?.digitalTwin;
   if(twin){render(panel,twin);panel.classList.add('is-open');}
  });
 };
 if(document.body)install();else document.addEventListener('DOMContentLoaded',install,{once:true});
}
