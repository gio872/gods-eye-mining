import dgram from 'node:dgram';
import crypto from 'node:crypto';
import net from 'node:net';

const DISCOVERY_ADDRESS = '239.255.255.250';
const DISCOVERY_PORT = 3702;
const DISCOVERY_TIMEOUT_MS = 3500;
const REQUEST_TIMEOUT_MS = 5000;

function text(xml, tag) {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, 'i');
  return re.exec(xml)?.[1]?.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim() || '';
}
function all(xml, tag) {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, 'gi');
  return [...xml.matchAll(re)].map((m) => m[1].trim());
}
function esc(value) {
  return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function privateHost(host) {
  const ip = net.isIP(host);
  if (ip === 4) {
    const p = host.split('.').map(Number);
    return p[0] === 10 || p[0] === 127 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || p[0] === 169 && p[1] === 254;
  }
  if (ip === 6) return host === '::1' || host.toLowerCase().startsWith('fe80:') || host.toLowerCase().startsWith('fc') || host.toLowerCase().startsWith('fd');
  return false;
}
function normalizeEndpoint(value) {
  const url = new URL(String(value || '').trim());
  if (!['http:','https:'].includes(url.protocol)) throw new Error('ONVIF endpoint must use HTTP or HTTPS');
  if (!privateHost(url.hostname)) throw new Error('ONVIF discovery is restricted to private/local network addresses');
  return url;
}
function nonce() { return crypto.randomBytes(16).toString('base64'); }
function created() { return new Date().toISOString(); }
function sha1(value) { return crypto.createHash('sha1').update(value).digest('base64'); }

function usernameToken(username, password) {
  const createdAt = created();
  const n = nonce();
  const digest = sha1(Buffer.concat([
    Buffer.from(n, 'base64'),
    Buffer.from(createdAt, 'utf8'),
    Buffer.from(password, 'utf8'),
  ]));
  return `<wsse:Security SOAP-ENV:mustUnderstand="1"><wsse:UsernameToken><wsse:Username>${esc(username)}</wsse:Username><wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.1#PasswordDigest">${digest}</wsse:Password><wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${n}</wsse:Nonce><wsu:Created>${createdAt}</wsu:Created></wsse:UsernameToken></wsse:Security>`;
}
function soap(action, body, security='') {
  return `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tds="http://www.onvif.org/ver10/device/wsdl" xmlns:trt="http://www.onvif.org/ver10/media/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"><s:Header>${security}</s:Header><s:Body><${action}>${body}</${action}></s:Body></s:Envelope>`;
}
async function post(url, body, {username='',password='',timeoutMs=REQUEST_TIMEOUT_MS}={}) {
  const controller = new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const headers={'Content-Type':'application/soap+xml; charset=utf-8',Accept:'application/soap+xml, text/xml'};
    let response=await fetch(url,{method:'POST',headers,body,signal:controller.signal});
    if (response.status===401 && username) {
      const challenge=response.headers.get('www-authenticate')||'';
      const match=/realm="([^"]+)"[^,]*,?\\s*nonce="([^"]+)"/i.exec(challenge);
      if (match) {
        const realm=match[1], nonceValue=match[2];
        const uri=new URL(url).pathname || '/';
        const ha1=crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
        const ha2=crypto.createHash('md5').update(`POST:${uri}`).digest('hex');
        const responseDigest=crypto.createHash('md5').update(`${ha1}:${nonceValue}:${ha2}`).digest('hex');
        headers.Authorization=`Digest username="${username}", realm="${realm}", nonce="${nonceValue}", uri="${uri}", response="${responseDigest}"`;
        response=await fetch(url,{method:'POST',headers,body,signal:controller.signal});
      }
    }
    const xml=await response.text();
    if(!response.ok) throw new Error(`ONVIF HTTP ${response.status}: ${text(xml,'Reason') || response.statusText}`);
    return xml;
  } finally { clearTimeout(timer); }
}

async function callOnvif(endpoint, action, body, credentials) {
  const security=credentials?.username ? usernameToken(credentials.username,credentials.password||'') : '';
  try { return await post(endpoint,soap(action,body,security),credentials); }
  catch (first) {
    if (credentials?.username) return await post(endpoint,soap(action,body,''),credentials);
    throw first;
  }
}

async function deviceService(endpoint, credentials) {
  const xml=await callOnvif(endpoint,'tds:GetCapabilities','<tds:Category>All</tds:Category>',credentials);
  return text(xml,'XAddr') || text(xml,'MediaXAddr') || endpoint;
}
async function mediaProfiles(media, credentials) {
  const xml=await callOnvif(media,'trt:GetProfiles','',credentials);
  return all(xml,'Profiles').map((raw,index)=>({
    token:(/<(?:[\\w-]+:)?Profiles[^>]*token="([^"]+)"/i.exec(raw)?.[1]) || `profile-${index+1}`,
    name:text(raw,'Name') || `Profile ${index+1}`,
    raw,
  }));
}
function capabilityXAddr(xml, serviceTag) {
  const block = new RegExp(`<(?:[\\w-]+:)?${serviceTag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${serviceTag}>`, 'i').exec(xml)?.[1] || '';
  return text(block, 'XAddr');
}
async function streamUri(media, profileToken, credentials) {
  const body='<trt:StreamSetup><tt:Stream>RTP-Unicast</tt:Stream><tt:Transport><tt:Protocol>RTSP</tt:Protocol></tt:Transport></trt:StreamSetup><trt:ProfileToken>'+esc(profileToken)+'</trt:ProfileToken>';
  const xml=await callOnvif(media,'trt:GetStreamUri',body,credentials);
  return text(xml,'Uri') || text(xml,'URI');
}
function velocityBody({profileToken, pan=0, tilt=0, zoom=0, timeoutMs=900}) {
  const timeout = `PT${Math.max(100, Math.min(10000, Number(timeoutMs) || 900))}MS`;
  const movement = (pan || tilt)
    ? `<tt:PanTilt x="${Math.max(-1,Math.min(1,Number(pan)||0))}" y="${Math.max(-1,Math.min(1,Number(tilt)||0)}"/>`
    : '';
  const zoomNode = zoom
    ? `<tt:Zoom x="${Math.max(-1,Math.min(1,Number(zoom)||0))}"/>`
    : '';
  return `<tptz:ProfileToken>${esc(profileToken)}</tptz:ProfileToken><tptz:Velocity><tt:PanTilt x="${movement ? Math.max(-1,Math.min(1,Number(pan)||0)) : 0}" y="${movement ? Math.max(-1,Math.min(1,Number(tilt)||0)) : 0}"/>${zoomNode ? zoomNode : ''}</tptz:Velocity><tptz:Timeout>${timeout}</tptz:Timeout>`;
}
function ptzSoap(action, body, security='') {
  return `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"><s:Header>${security}</s:Header><s:Body><${action}>${body}</${action}></s:Body></s:Envelope>`;
}
async function callPtz(endpoint, action, body, credentials) {
  const security=credentials?.username ? usernameToken(credentials.username,credentials.password||'') : '';
  try { return await post(endpoint,ptzSoap(action,body,security),credentials); }
  catch (first) {
    if (credentials?.username) return await post(endpoint,ptzSoap(action,body,''),credentials);
    throw first;
  }
}
function eventSoap(action, body, security='') {
  return `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tev="http://www.onvif.org/ver10/events/wsdl" xmlns:wsnt="http://docs.oasis-open.org/wsn/b-2" xmlns:wsa="http://www.w3.org/2005/08/addressing" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"><s:Header>${security}</s:Header><s:Body><${action}>${body}</${action}></s:Body></s:Envelope>`;
}
async function callEvents(endpoint, action, body, credentials) {
  const security=credentials?.username ? usernameToken(credentials.username,credentials.password||'') : '';
  try { return await post(endpoint,eventSoap(action,body,security),credentials,{timeoutMs:6500}); }
  catch (first) {
    if (credentials?.username) return await post(endpoint,eventSoap(action,body,''),credentials,{timeoutMs:6500});
    throw first;
  }
}
function parseEventMessages(xml) {
  return all(xml,'NotificationMessage').map((raw) => {
    const topic = text(raw,'Topic');
    const message = text(raw,'Message');
    const source = text(message,'SimpleItem');
    const timestamp = text(raw,'UtcTime') || new Date().toISOString();
    const lower = `${topic} ${raw}`.toLowerCase();
    return {
      topic,
      source,
      timestamp,
      type: /tamper|tampering/i.test(lower) ? 'tamper' : /motion|cellmotion/i.test(lower) ? 'motion' : 'event',
    };
  });
}
async function getCapabilities(endpoint, credentials) {
  return callOnvif(endpoint,'tds:GetCapabilities','<tds:Category>All</tds:Category>',credentials);
}
async function ptzStatus(ptz, profileToken, credentials) {
  const xml=await callPtz(ptz,'tptz:GetStatus',`<tptz:ProfileToken>${esc(profileToken)}</tptz:ProfileToken>`,credentials);
  return {
    pan: Number(/<[^>]*PanTilt[^>]*x="([^"]+)"/i.exec(xml)?.[1]),
    tilt: Number(/<[^>]*PanTilt[^>]*y="([^"]+)"/i.exec(xml)?.[1]),
    zoom: Number(/<[^>]*Zoom[^>]*x="([^"]+)"/i.exec(xml)?.[1]),
    panTiltStatus: text(xml,'PanTiltStatus') || 'UNKNOWN',
    zoomStatus: text(xml,'ZoomStatus') || 'UNKNOWN',
  };
}
async function ptzPresets(ptz, profileToken, credentials) {
  const xml=await callPtz(ptz,'tptz:GetPresets',`<tptz:ProfileToken>${esc(profileToken)}</tptz:ProfileToken>`,credentials);
  return all(xml,'Preset').map((raw,index)=>({
    token:(/<(?:[\\w-]+:)?Preset[^>]*token="([^"]+)"/i.exec(raw)?.[1]) || `preset-${index+1}`,
    name:text(raw,'Name') || `Preset ${index+1}`,
  }));
}
async function ptzMove(ptz, input, credentials) {
  const body=velocityBody(input);
  await callPtz(ptz,'tptz:ContinuousMove',body,credentials);
  return {ok:true};
}
async function ptzStop(ptz, profileToken, credentials) {
  await callPtz(ptz,'tptz:Stop',`<tptz:ProfileToken>${esc(profileToken)}</tptz:ProfileToken><tptz:PanTilt>true</tptz:PanTilt><tptz:Zoom>true</tptz:Zoom>`,credentials);
  return {ok:true};
}
async function ptzGotoPreset(ptz, profileToken, presetToken, credentials) {
  await callPtz(ptz,'tptz:GotoPreset',`<tptz:ProfileToken>${esc(profileToken)}</tptz:ProfileToken><tptz:PresetToken>${esc(presetToken)}</tptz:PresetToken>`,credentials);
  return {ok:true};
}


async function discover(timeoutMs=DISCOVERY_TIMEOUT_MS) {
  const socket=dgram.createSocket({type:'udp4',reuseAddr:true});
  const message=`<?xml version="1.0" encoding="UTF-8"?><e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl"><e:Header><w:MessageID>urn:uuid:${crypto.randomUUID()}</w:MessageID><w:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To><w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action></e:Header><e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body></e:Envelope>`;
  const found=new Map();
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(resolve,timeoutMs);
    socket.on('error',(error)=>{clearTimeout(timer);reject(error);});
    socket.on('message',(msg,rinfo)=>{
      const xml=msg.toString('utf8');
      const xaddrs=all(xml,'XAddrs').flatMap((value)=>value.split(/\\s+/)).filter(Boolean);
      const endpoint=xaddrs.find((x)=>/^https?:/i.test(x));
      if(endpoint) found.set(endpoint,{endpoint,address:rinfo.address,types:all(xml,'Types')});
    });
    socket.bind(0,()=>{
      try {
        socket.addMembership(DISCOVERY_ADDRESS);
        socket.send(Buffer.from(message),DISCOVERY_PORT,DISCOVERY_ADDRESS);
      } catch (error) { clearTimeout(timer); reject(error); }
    });
  }).finally(()=>socket.close());
  return [...found.values()];
}

export function onvifProxy({maxDiscoveryResults=64}={}) {
  const install=(server)=>{
    server.middlewares.use('/api/onvif',async(req,res)=>{
      const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
      try {
        const url=new URL(req.url||'/', 'http://localhost');
        if(url.pathname==='/discover' && req.method==='GET'){
          const cameras=(await discover()).slice(0,maxDiscoveryResults);
          return reply(200,{cameras});
        }
        if(url.pathname==='/events' && req.method==='POST'){
          const chunks=[];for await(const chunk of req)chunks.push(chunk);
          const input=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
          const endpoint=normalizeEndpoint(input.events);
          const credentials={username:String(input.username||''),password:String(input.password||'')};
          const subscriptionBody='<wsnt:InitialTerminationTime>PT30M</wsnt:InitialTerminationTime>';
          let subUrl=String(input.pullPoint||'');
          if(!subUrl){
            const xml=await callEvents(endpoint.href,'tev:CreatePullPointSubscription',subscriptionBody,credentials);
            subUrl=text(xml,'Address') || text(xml,'XAddr');
            if(!subUrl) throw new Error('ONVIF event subscription did not return a PullPoint address');
          }
          const xml=await callEvents(subUrl,'wsnt:PullMessages','<wsnt:Timeout>PT1S</wsnt:Timeout><wsnt:MessageLimit>20</wsnt:MessageLimit>',credentials);
          return reply(200,{pullPoint:subUrl,events:parseEventMessages(xml)});
        }
        if(url.pathname==='/ptz' && req.method==='POST'){
          const chunks=[];for await(const chunk of req)chunks.push(chunk);
          const input=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
          const ptz=normalizeEndpoint(input.ptz);
          const credentials={username:String(input.username||''),password:String(input.password||'')};
          const action=String(input.action||'status');
          if(!input.profileToken) throw new Error('PTZ profileToken is required');
          if(action==='status') return reply(200,await ptzStatus(ptz.href,input.profileToken,credentials));
          if(action==='move') return reply(200,await ptzMove(ptz.href,input,credentials));
          if(action==='stop') return reply(200,await ptzStop(ptz.href,input.profileToken,credentials));
          if(action==='presets') return reply(200,{presets:await ptzPresets(ptz.href,input.profileToken,credentials)});
          if(action==='gotoPreset') return reply(200,await ptzGotoPreset(ptz.href,input.profileToken,input.presetToken,credentials));
          throw new Error('Unsupported PTZ action');
        }
        if(url.pathname==='/probe' && req.method==='POST'){
          const chunks=[];for await(const chunk of req)chunks.push(chunk);
          const input=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
          const endpoint=normalizeEndpoint(input.endpoint);
          const credentials={username:String(input.username||''),password:String(input.password||'')};
          const device=await deviceService(endpoint,credentials);
          const capabilities=await getCapabilities(device,credentials);
          const media=capabilityXAddr(capabilities,'Media') || capabilityXAddr(capabilities,'Media2');
          const ptz=capabilityXAddr(capabilities,'PTZ');
          const events=capabilityXAddr(capabilities,'Events');
          if(!media) throw new Error('ONVIF media service was not advertised by the camera');
          const profiles=await mediaProfiles(media,credentials);
          const selected=profiles.find((profile)=>profile.raw.includes('PTZConfiguration')) || profiles[0];
          if(!selected) throw new Error('ONVIF camera returned no media profiles');
          const stream=await streamUri(media,selected.token,credentials);
          if(!stream) throw new Error('ONVIF camera returned no RTSP stream URI');
          let presetList=[];
          let ptzStatusValue=null;
          if(ptz && selected.raw.includes('PTZConfiguration')){
            try{ presetList=await ptzPresets(ptz,selected.token,credentials); }catch{}
            try{ ptzStatusValue=await ptzStatus(ptz,selected.token,credentials); }catch{}
          }
          return reply(200,{endpoint,media,ptz,events,device,profiles:profiles.map(({raw,...p})=>p),selectedProfile:selected.token,streamUri:stream,ptzAvailable:Boolean(ptz && selected.raw.includes('PTZConfiguration')),presets:presetList,ptzStatus:ptzStatusValue});
        }
        return reply(404,{error:'Not found'});
      }catch(error){return reply(400,{error:error?.message||String(error)});}
    });
  };
  return {name:'onvif',configureServer:install,configurePreviewServer:install};
}
