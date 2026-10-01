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
async function streamUri(media, profileToken, credentials) {
  const body='<trt:StreamSetup><tt:Stream>RTP-Unicast</tt:Stream><tt:Transport><tt:Protocol>RTSP</tt:Protocol></tt:Transport></trt:StreamSetup><trt:ProfileToken>'+esc(profileToken)+'</trt:ProfileToken>';
  const xml=await callOnvif(media,'trt:GetStreamUri',body,credentials);
  return text(xml,'Uri') || text(xml,'URI');
}

async function discover(timeoutMs=DISCOVERY_TIMEOUT_MS) {
  const socket=dgram.createSocket({type:'udp4',reuseAddr:true});
  const message=`<?xml version="1.0" encoding="UTF-8"?><e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"><e:Header><w:MessageID>urn:uuid:${crypto.randomUUID()}</w:MessageID><w:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To><w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action></e:Header><e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body></e:Envelope>`;
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
        if(url.pathname==='/probe' && req.method==='POST'){
          const chunks=[];for await(const chunk of req)chunks.push(chunk);
          const input=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
          const endpoint=normalizeEndpoint(input.endpoint);
          const credentials={username:String(input.username||''),password:String(input.password||'')};
          const device=await deviceService(endpoint,credentials);
          const media=await callOnvif(device,'tds:GetCapabilities','<tds:Category>Media</tds:Category>',credentials).then((xml)=>text(xml,'XAddr')||text(xml,'MediaXAddr'));
          if(!media) throw new Error('ONVIF media service was not advertised by the camera');
          const profiles=await mediaProfiles(media,credentials);
          const selected=profiles[0];
          if(!selected) throw new Error('ONVIF camera returned no media profiles');
          const stream=await streamUri(media,selected.token,credentials);
          if(!stream) throw new Error('ONVIF camera returned no RTSP stream URI');
          return reply(200,{endpoint,media,device,profiles:profiles.map(({raw,...p})=>p),streamUri:stream});
        }
        return reply(404,{error:'Not found'});
      }catch(error){return reply(400,{error:error?.message||String(error)});}
    });
  };
  return {name:'onvif',configureServer:install,configurePreviewServer:install};
}
