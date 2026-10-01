import { createOnvifSource } from './onvifSource.js';

export function createOnvifDiscovery({source=createOnvifSource(),onAdd}={}) {
  let panel=null;
  let results=[];
  const render=()=>{
    if(!panel)return;
    const list=panel.querySelector('.gem-onvif-list');
    list.replaceChildren();
    for(const camera of results){
      const row=document.createElement('div');row.className='gem-onvif-row';
      row.innerHTML=`<strong>${String(camera.address||camera.endpoint).replace(/[&<>"]/g,'')}</strong><span>${String(camera.endpoint).replace(/[&<>"]/g,'')}</span><button type="button">CONFIGURAR</button>`;
      row.querySelector('button').onclick=()=>openProbe(camera);
      list.appendChild(row);
    }
  };
  const openProbe=(camera)=>{
    panel.querySelector('.gem-onvif-form').hidden=false;
    panel.querySelector('[name=endpoint]').value=camera.endpoint;
    panel.querySelector('[name=username]').focus();
  };
  const style=document.createElement('style');
  style.textContent='.gem-onvif{padding:9px 0;border-bottom:1px solid rgba(255,255,255,.08)}.gem-onvif-list{display:grid;gap:6px}.gem-onvif-row{display:grid;grid-template-columns:120px 1fr auto;gap:7px;align-items:center;font:9px monospace}.gem-onvif-row span{color:#78979c;overflow:hidden;text-overflow:ellipsis}.gem-onvif-form{display:grid;grid-template-columns:1fr 1fr 2fr auto;gap:6px;margin-top:7px}.gem-onvif input{min-width:0}.gem-onvif button{cursor:pointer}';
  return {
    mount(host){
      panel=document.createElement('section');panel.className='gem-onvif';panel.innerHTML='<div><button type="button" class="gem-onvif-scan">BUSCAR ONVIF</button></div><div class="gem-onvif-list"></div><form class="gem-onvif-form" hidden><input name="username" required placeholder="Usuario ONVIF"><input name="password" type="password" required placeholder="Contraseña"><input name="endpoint" required placeholder="http://192.168.1.50/onvif/device_service"><button type="submit">CONECTAR</button></form><div class="gem-onvif-message"></div>';host.append(style,panel);
      panel.querySelector('.gem-onvif-scan').onclick=async()=>{try{panel.querySelector('.gem-onvif-message').textContent='Buscando cámaras...';results=(await source.discover()).cameras||[];panel.querySelector('.gem-onvif-message').textContent=`${results.length} dispositivo(s) encontrado(s)`;render();}catch(e){panel.querySelector('.gem-onvif-message').textContent=e.message;}};
      panel.querySelector('.gem-onvif-form').onsubmit=async(e)=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));try{const result=await source.probe(data);await onAdd?.({id:`onvif-${data.endpoint.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').slice(-50)}`,...data,url:result.streamUri,protocol:'RTSP',name:`ONVIF ${data.endpoint}`}, result);panel.querySelector('.gem-onvif-message').textContent='Cámara ONVIF conectada';}catch(error){panel.querySelector('.gem-onvif-message').textContent=error.message;}};
    },
    destroy(){panel?.remove();panel=null;style.remove();},
  };
}
