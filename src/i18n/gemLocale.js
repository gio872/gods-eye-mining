/**
 * GEM automatic country / language resolution.
 * Server-first: /api/gem/locale may provide country from trusted edge headers.
 * Client fallback uses navigator.language/timeZone without requesting precise location.
 */
export const GEM_LOCALE_VERSION='1.0.0';

const COUNTRY_LOCALE=Object.freeze({
 US:'en-US',CA:'en-CA',GB:'en-GB',IE:'en-IE',AU:'en-AU',NZ:'en-NZ',ZA:'en-ZA',
 CO:'es-CO',MX:'es-MX',ES:'es-ES',AR:'es-AR',CL:'es-CL',PE:'es-PE',EC:'es-EC',
 BO:'es-BO',VE:'es-VE',UY:'es-UY',PY:'es-PY',CR:'es-CR',PA:'es-PA',DO:'es-DO',
 GT:'es-GT',HN:'es-HN',SV:'es-SV',NI:'es-NI',CU:'es-CU',
 BR:'pt-BR',PT:'pt-PT',FR:'fr-FR',BE:'fr-BE',CH:'fr-CH',LU:'fr-LU',
 DE:'de-DE',AT:'de-AT',IT:'it-IT',NL:'nl-NL',SE:'sv-SE',NO:'nb-NO',
 DK:'da-DK',FI:'fi-FI',IS:'is-IS',PL:'pl-PL',CZ:'cs-CZ',SK:'sk-SK',
 HU:'hu-HU',RO:'ro-RO',BG:'bg-BG',GR:'el-GR',TR:'tr-TR',UA:'uk-UA',
 RU:'ru-RU',IL:'he-IL',SA:'ar-SA',AE:'ar-AE',EG:'ar-EG',MA:'ar-MA',
 IN:'hi-IN',PK:'ur-PK',BD:'bn-BD',NP:'ne-NP',LK:'si-LK',
 CN:'zh-CN',TW:'zh-TW',HK:'zh-HK',JP:'ja-JP',KR:'ko-KR',
 TH:'th-TH',VN:'vi-VN',ID:'id-ID',MY:'ms-MY',PH:'en-PH',SG:'en-SG'
});

const LANGUAGE_NAMES=Object.freeze({
 en:'English',es:'Español',fr:'Français',de:'Deutsch',it:'Italiano',pt:'Português',
 nl:'Nederlands',sv:'Svenska',no:'Norsk',nb:'Norsk',da:'Dansk',fi:'Suomi',
 is:'Íslenska',pl:'Polski',cs:'Čeština',sk:'Slovenčina',hu:'Magyar',
 ro:'Română',bg:'Български',el:'Ελληνικά',tr:'Türkçe',uk:'Українська',
 ru:'Русский',he:'עברית',ar:'العربية',fa:'فارسی',ur:'اردو',hi:'हिन्दी',
 bn:'বাংলা',ne:'नेपाली',si:'සිංහල',zh:'中文',ja:'日本語',ko:'한국어',
 th:'ไทย',vi:'Tiếng Việt',id:'Bahasa Indonesia',ms:'Bahasa Melayu',
 sw:'Kiswahili',am:'አማርኛ',yo:'Yorùbá',ig:'Igbo',ha:'Hausa',
 zu:'isiZulu',xh:'isiXhosa',af:'Afrikaans',fil:'Filipino',ta:'தமிழ்',
 te:'తెలుగు',mr:'मराठी',gu:'ગુજરાતી',kn:'ಕನ್ನಡ',ml:'മലയാളം',
 pa:'ਪੰਜਾਬੀ',km:'ខ្មែរ',lo:'ລາວ',my:'မြန်မာ',mn:'Монгол',
 kk:'Қазақша',uz:'Oʻzbekcha',az:'Azərbaycan dili',ka:'ქართული',
 hy:'Հայերեն',sw:'Kiswahili'
});

function normalizeCountry(v){return String(v||'').trim().toUpperCase().slice(0,2);}
function normalizeLanguage(v){
 const raw=String(v||'').replace('_','-').trim();
 const lang=raw.split('-')[0].toLowerCase();
 return {language:lang,locale:raw||null};
}

export function resolveGemLocale({country,language,timezone}={}){
 const c=normalizeCountry(country);
 const browser=normalizeLanguage(language);
 const mapped=COUNTRY_LOCALE[c]||null;
 const locale=mapped||browser.locale||'en-US';
 const lang=locale.split('-')[0].toLowerCase();
 return Object.freeze({
  version:GEM_LOCALE_VERSION,country:c||null,locale,language:lang,
  languageName:LANGUAGE_NAMES[lang]||lang.toUpperCase(),
  timezone:timezone||null,
  source:mapped?'country':'browser',
  direction:lang==='ar'||lang==='he'||lang==='fa'||lang==='ur'?'rtl':'ltr'
 });
}

export async function detectGemLocale(){
 let server=null;
 try{
  const response=await fetch('/api/gem/locale',{headers:{Accept:'application/json'},credentials:'same-origin'});
  if(response.ok) server=await response.json();
 }catch{}
 const browser=navigator.language||navigator.userLanguage||'en-US';
 return resolveGemLocale({
  country:server?.country,
  language:server?.language||browser,
  timezone:Intl.DateTimeFormat().resolvedOptions().timeZone
 });
}

export function getGemSupportedLanguages(){
 return Object.freeze({...LANGUAGE_NAMES});
}

export function applyGemLocale(locale){
 if(!locale)return;
 document.documentElement.lang=locale.locale;
 document.documentElement.dir=locale.direction;
 document.documentElement.dataset.gemCountry=locale.country||'';
 document.documentElement.dataset.gemLanguage=locale.language;
 document.documentElement.dataset.gemLocale=locale.locale;
 globalThis.GEM_LOCALE=locale;
 document.dispatchEvent(new CustomEvent('gem:locale-ready',{detail:locale}));
 return locale;
}
