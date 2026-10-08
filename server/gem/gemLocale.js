/**
 * Server-side country resolver for GEM.
 * Prefer trusted reverse-proxy/edge headers. Never expose client IP to the browser.
 */
export const GEM_LOCALE_SERVER_VERSION='1.0.0';

const COUNTRY_HEADERS=['cf-ipcountry','x-vercel-ip-country','x-country-code','x-geo-country','x-country'];
const COUNTRY_LANGUAGE={
 CO:'es-CO',MX:'es-MX',ES:'es-ES',AR:'es-AR',CL:'es-CL',PE:'es-PE',BR:'pt-BR',
 PT:'pt-PT',FR:'fr-FR',DE:'de-DE',IT:'it-IT',NL:'nl-NL',GB:'en-GB',US:'en-US',
 CA:'en-CA',AU:'en-AU',IN:'hi-IN',CN:'zh-CN',JP:'ja-JP',KR:'ko-KR',AE:'ar-AE',
 SA:'ar-SA',EG:'ar-EG',TR:'tr-TR',RU:'ru-RU',UA:'uk-UA',PL:'pl-PL',IL:'he-IL',
 ID:'id-ID',TH:'th-TH',VN:'vi-VN',ZA:'en-ZA'
};
function header(req,name){return req?.headers?.get?.(name)||req?.headers?.[name]||req?.headers?.[name.toLowerCase()]||null;}
export function resolveGemCountryFromRequest(req){
 for(const name of COUNTRY_HEADERS){const value=header(req,name);if(value)return String(value).split(',')[0].trim().toUpperCase();}
 return null;
}
export function resolveGemLocaleResponse(req){
 const country=resolveGemCountryFromRequest(req);
 const language=COUNTRY_LANGUAGE[country]||String(header(req,'accept-language')||'en-US').split(',')[0].trim();
 return {version:GEM_LOCALE_SERVER_VERSION,country,language,source:country?'edge-header':'accept-language'};
}
export function createGemLocaleHandler(){
 return (req,res)=>{
  const payload=resolveGemLocaleResponse(req);
  if(typeof res?.setHeader==='function'){res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','private, no-store');}
  if(typeof res?.statusCode==='number')res.statusCode=200;
  if(typeof res?.end==='function')res.end(JSON.stringify(payload));
  return payload;
 };
}
