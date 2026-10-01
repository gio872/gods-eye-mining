export function createOnvifSource({fetchImpl=(...args)=>fetch(...args)}={}) {
  async function request(path,options={}) {
    const response=await fetchImpl(path,{cache:'no-store',...options,headers:{Accept:'application/json',...(options.headers||{})}});
    const body=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(body?.error||`ONVIF request failed (HTTP ${response.status})`);
    return body;
  }
  return Object.freeze({
    discover:()=>request('/api/onvif/discover'),
    probe:(camera)=>request('/api/onvif/probe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(camera)}),
  });
}
