import type {Product,Variant} from './types';

export type ChannelAudit={post:string;reason:string;title?:string};
export type ChannelPage={products:Product[];skipped:ChannelAudit[];postIds:string[];oldestDate:string|null};
export class ChannelImportError extends Error{constructor(public code:'INVALID_POST_URL'|'CHANNEL_UNAVAILABLE'|'POST_NOT_FOUND'|'NO_PRODUCT_OFFER'|'POST_TOO_LARGE'){super(code);this.name='ChannelImportError';}}
const MAX_HTML=2_000_000;
const decode=(value:string)=>value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,(_,entity:string)=>{const names:Record<string,string>={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '};if(entity[0]==='#'){const code=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);return code>0&&code<=0x10ffff?String.fromCodePoint(code):'';}return names[entity.toLowerCase()]??'';});
const text=(html:string)=>decode(html.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'')).replace(/[\u00a0\u202f]/g,' ').trim();
const key=(value:string)=>value.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const knownBrands=['Geparlys','Franck Olivier','Lacoste Fragrances','Les Soeurs De Noe','Parfums de Marly','Yves Saint Laurent','Monotheme Venezia','Dolce&Gabbana','Dolce & Gabbana','Giorgio Armani','Jean Paul Gaultier','Maison Francis Kurkdjian','Maison Martin Margiela','Maison Crivelli','Louis Vuitton','Lattafa Perfumes','Clive Christian','John Varvatos','Ex Nihilo','Nasomatto','Montblanc','Moschino','Givenchy','Guerlain','Chanel','Dior','Tom Ford','Versace','Prada','Valentino','Amouage','Xerjoff','Byredo','Creed','Gucci','Hermes','Hermès','Lanvin','Lalique','Bvlgari','Burberry','Chloe','Chloé','Nishane','Mancera','Montale','Initio Parfums Prives','Initio Parfums Privés','Orto Parisi','Tiziana Terenzi','Kilian','By Kilian','Marc Antoine Barrois','Essential Parfums','Juliette Has A Gun','Dolce Gabbana','Trussardi','Armaf','Afnan','Ajmal','Attar Collection','Memo Paris','Zadig & Voltaire','Hugo Boss','Carolina Herrera','Paco Rabanne','Rabanne','Issey Miyake','Narciso Rodriguez','Calvin Klein','Ralph Lauren','Kenzo','Cacharel','Elie Saab','Roberto Cavalli','Salvatore Ferragamo','DSQUARED²','Dsquared2','Diesel','Bentley','Jaguar','Mercedes Benz','Mercedes-Benz','Azzaro','Davidoff','Jo Malone London','Jo Malone','Serge Lutens','Lorenzo Pazzaglia','Gritti','Sospiro Perfumes','Sospiro','Stephane Humbert Lucas 777','Stephane Humbert Lucas','Zarkoperfume','Vilhelm Parfumerie','Bois 1920','Boadicea the Victorious','Penhaligon\'s','The House of Oud','Fragrance Du Bois','Maison Alhambra','Al Haramain Perfumes','Rasasi','Al Haramain','Paris Corner','Kajal','Dunhill','Ferrari','Lacoste','Ferragamo','Michael Kors','Dolce and Gabbana'].sort((a,b)=>b.length-a.length);
function splitTitle(title:string,link:string|null){
 title=title.replace(/\s*\(новый дизайн\)\s*$/i,'').trim();
 let candidates=[...knownBrands];
 if(link){try{const slug=decode(new URL(link).pathname.split('/perfume/')[1]?.split('/')[0]??'').replace(/-/g,' ');if(slug)candidates.unshift(slug);}catch{}}
 for(const candidate of candidates){for(let i=1;i<title.length;i++){if(title[i-1]!==' ')continue;const suffix=title.slice(i).trim();if(key(suffix)===key(candidate))return{name:title.slice(0,i).trim(),brand:suffix};}}
 return{name:title,brand:''};
}
function field(raw:string,label:string){const value=raw.match(new RegExp(label+'[ \t]*[:：][ \t]*([^\\n]+)','i'))?.[1]?.trim();return value&&value!=='-'?value:null;}
function scentLink(markup:string,name:string,brand:string,warnings:string[]):string|null{
 const candidates=[...markup.matchAll(/href=["']([^"']+)["']/gi)].map(m=>decode(m[1])).filter(u=>{try{const x=new URL(u);return x.protocol==='https:'&&/^(www\.)?fragrantica\.(com|ru|es|fr|de|it|pl|nl)$/i.test(x.hostname)&&/^\/perfume\/[^/]+\/[^/]+\.html$/.test(x.pathname);}catch{return false;}});
 if(!candidates.length){warnings.push('SCENT_LINK_MISSING');return null;}
 if(new Set(candidates).size>1){warnings.push('SCENT_LINK_MULTIPLE');return null;}
 const url=candidates[0];const slug=decode(new URL(url).pathname.split('/').pop()??'').replace(/-\d+\.html$/,'').replace(/-/g,' ');
 // A source link to the original fragrance must not be presented as the flanker\'s matching scent page.
 const titleTokens=key(name);const targetTokens=key(slug);
 const distinct=['exclusif','extrait','elixir','intense','absolu','absolue','rouge','paradise','crush','vanilla','sunny','sport','extreme','floral','oud','eau fraiche'];
 if(distinct.some(token=>titleTokens.includes(key(token))&&!targetTokens.includes(key(token)))){warnings.push('SCENT_LINK_MISMATCH');return null;}
 if(brand&&targetTokens===key(brand)){warnings.push('SCENT_LINK_MISMATCH');return null;}
 return url;
}
function variantsFrom(raw:string):Variant[]{
 const variants:Variant[]=[];
 const offer=/((?:tester|тестер)\s*)?(\d+(?:[.,]\d+)?)\s*(?:мл|ml)\.?\s*(?:[-–—:=]|по)\s*([\d\s]+)\s*(?:сум|so[‘'’]?m|сўм)/gi;
 for(const m of raw.matchAll(offer)){const volume=Number(m[2].replace(',','.'));const price=Number(m[3].replace(/\s/g,''));const lineStart=raw.lastIndexOf('\n',m.index)+1;const lineEnd=raw.indexOf('\n',m.index);const line=raw.slice(lineStart,lineEnd<0?undefined:lineEnd);const tester=!!m[1]||/\btester\b|тестер/i.test(line);if(volume>0&&volume<=2000&&price>0&&price<=100_000_000)variants.push({label:`${volume} мл${tester?' · Tester':''}`,volume,price});}
 if(!variants.length){const remainder=raw.match(/Остаток\s+во\s+флаконе\s*(\d+(?:[.,]\d+)?)\s*(?:мл|ml)\s*от\s*(\d+(?:[.,]\d+)?)\s*(?:мл|ml)/i);const price=raw.match(/Цена\s*[:：]\s*([\d\s]+)\s*(?:сум|сўм)/i);if(remainder&&price){const volume=Number(remainder[1].replace(',','.'));const full=Number(remainder[2].replace(',','.'));const amount=Number(price[1].replace(/\s/g,''));if(volume>0&&volume<=full&&full<=2000&&amount>0&&amount<=100_000_000)variants.push({label:`${volume} мл / ${full} мл · Остаток`,volume,price:amount});}}
 if(!variants.length&&/^(?:ПОДАРОЧНЫЙ|ПАРФЮМЕРНЫЙ) НАБОР/m.test(raw)){
 const price=raw.match(/Цена\s*[:：]\s*([\d\s]+)\s*(?:сум|сўм)/i);const amount=price?Number(price[1].replace(/\s/g,'')):0;
 const set=raw.match(/(\d+)\s*[×xх]\s*(\d+(?:[.,]\d+)?)\s*(?:мл|ml)/i);
 const lines=raw.split('\n').map(l=>l.trim()).filter(l=>/^[-–—]\s*(?:EAU DE|PARFUM|SHOWER GEL|BODY|AFTER)/i.test(l));
 if(amount>0&&amount<=100_000_000&&set&&!lines.length){const count=Number(set[1]);const size=Number(set[2].replace(',','.'));if(count*size<=2000)variants.push({label:`${count} × ${size} мл · Set`,volume:count*size,price:amount});}
 else if(amount>0&&amount<=100_000_000&&lines.length){const perfume=lines.find(l=>/EAU DE|PARFUM/i.test(l));const size=perfume?.match(/(?:[:：]\s*)(\d+(?:[.,]\d+)?)\s*мл/i)?.[1];if(size)variants.push({label:`${size} мл · Gift Set`,volume:Number(size.replace(',','.')),price:amount});}
 }
 return variants.filter((v,i,list)=>list.findIndex(x=>x.label===v.label&&x.price===v.price)===i);
}
export function parseChannelPage(html:string,options:{importedAt?:string}={}):ChannelPage{
 const result:ChannelPage={products:[],skipped:[],postIds:[],oldestDate:null};
 for(const block of html.split(/data-post=["']/).slice(1)){
  const post=block.split(/["']/)[0];if(!/^fragranceuz\/\d+$/.test(post))continue;const id=post.split('/')[1];result.postIds.push(id);
  const sourceDate=block.match(/<time[^>]*datetime=["']([^"']+)/)?.[1]??null;if(sourceDate&&(!result.oldestDate||sourceDate<result.oldestDate))result.oldestDate=sourceDate;
  const markup=block.match(/class=["'][^"']*\bjs-message_text\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/)?.[1];
  if(!markup){result.skipped.push({post,reason:'NO_TEXT'});continue;}
  const raw=text(markup);const lines=raw.split('\n').map(l=>l.trim()).filter(Boolean);let title=lines[0]??'';const isSet=/^(?:ПОДАРОЧНЫЙ|ПАРФЮМЕРНЫЙ) НАБОР/.test(title);
 if(isSet&&lines[1])title=lines[1].replace(/\s+\d+\s*[×xх]\s*\d+(?:[.,]\d+)?\s*мл\.?$/i,'').trim();
 if(/^ТЕСТЕР ТОЖЕ В НАЛИЧИИ/i.test(title)&&lines[1])title=lines[1];
 const variants=variantsFrom(raw);if(/ТЕСТЕР ТОЖЕ В НАЛИЧИИ/i.test(raw))variants.forEach(v=>v.label+=' · Tester');
  if(!title||!variants.length){result.skipped.push({post,title,reason:'NO_UNAMBIGUOUS_VOLUME_PRICE'});continue;}
  const possible=decode(markup.match(/href=["'](https:\/\/(?:www\.)?fragrantica\.[^"']+)["']/i)?.[1]??'')||null;let {name,brand}=splitTitle(title,possible);const warnings:string[]=[];
 if(isSet){if(!brand&&/^EX NIHILO\s/i.test(title)){brand=title.slice(0,9);name=title.slice(10);}
 if(!brand&&knownBrands.some(b=>key(b)===key(title))){brand=title;name=title;}name+=' · Set';const contents=lines.filter(l=>/^\d+\.\s/.test(l)).map(l=>l.replace(/^\d+\.\s*/,''));if(contents.length)name+=' · '+contents.map(c=>c.replace(/\s+(?:EAU DE PARFUM|EXTRAIT DE PARFUM|PARFUM)?\s*\d+(?:[.,]\d+)?мл\.?$/i,'').replace(/\s+(?:EAU DE PARFUM|EXTRAIT DE PARFUM|PARFUM)$/i,'')).join(' / ');}
 if(!brand)warnings.push('BRAND_NOT_EXPLICITLY_SEPARATED');
  const fragranceLink=scentLink(markup,name,brand,warnings);const genderText=field(raw,'Пол')??'';const gender=/мужчин\s+и\s+женщин|женщин\s+и\s+мужчин|унисекс|unisex/i.test(genderText)?'unisex':/женщин/i.test(genderText)?'women':/мужчин/i.test(genderText)?'men':'unspecified';
  const yearValue=field(raw,'Год выпуска аромата');const year=yearValue?.match(/\b(18\d{2}|19\d{2}|20\d{2})\b/)?.[1]??null;
  const photo=decode(block.match(/tgme_widget_message_photo_wrap[^>]*background-image:\s*url\(['"]?([^'"\)]+)['"]?\)/)?.[1]??'')||null;
  const safePhoto=photo&&/^https:\/\/[a-z0-9.-]+\.telesco\.pe\//i.test(photo)?photo:null;
  let concentration=field(raw,'Тип');if(isSet&&/EXTRAITS SET/i.test(raw)&&/\d+\.\s[^\n]+EAU DE PARFUM/i.test(raw)){concentration=null;warnings.push('SET_CONCENTRATION_CONFLICT');}
  const product:Product={id,title,name,brand,variants,gender,concentration,country:field(raw,'Страна'),year,fragranticaUrl:fragranceLink,sourceUrl:`https://t.me/${post}`,sourceDate,importedAt:options.importedAt??new Date().toISOString().slice(0,10),photoSource:safePhoto,image:safePhoto,active:true,sourceText:raw.split(/✈/)[0].replace(/✔️?Аромат[^\n]*/g,'').replace(/💲Купить/g,'').trim()};
  result.products.push(product);for(const reason of warnings)result.skipped.push({post,title,reason});
 }
 return result;
}
export function canonicalChannelPost(input:string){let url:URL;try{url=new URL(input.trim());}catch{throw new ChannelImportError('INVALID_POST_URL');}if(url.protocol!=='https:'||url.hostname!=='t.me'||url.username||url.password||url.port||url.hash||!/^\/(?:s\/)?fragranceuz\/\d+$/.test(url.pathname)||[...url.searchParams].some(([name,value])=>name!=='single'||value!==''))throw new ChannelImportError('INVALID_POST_URL');const id=url.pathname.split('/').pop()!;return{id,url:`https://t.me/s/fragranceuz/${id}?single`};}
export async function fetchChannelHtml(url:string):Promise<string>{
 const timeout=AbortSignal.timeout(15_000);let response:Response;try{response=await fetch(url,{signal:timeout,redirect:'manual',headers:{'User-Agent':'FragranceUZ-Catalog/1.0','Accept':'text/html'}});}catch{throw new ChannelImportError('CHANNEL_UNAVAILABLE');}
 if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw new ChannelImportError('CHANNEL_UNAVAILABLE');if(Number(response.headers.get('content-length')??0)>MAX_HTML)throw new ChannelImportError('POST_TOO_LARGE');const reader=response.body?.getReader();if(!reader)throw new ChannelImportError('CHANNEL_UNAVAILABLE');let size=0;const decoder=new TextDecoder();let html='';try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>MAX_HTML){await reader.cancel();throw new ChannelImportError('POST_TOO_LARGE');}html+=decoder.decode(value,{stream:true});}html+=decoder.decode();}catch(error){if(error instanceof ChannelImportError)throw error;throw new ChannelImportError('CHANNEL_UNAVAILABLE');}return html;
}
export async function importChannelPost(input:string):Promise<{product:Product;warnings:string[]}>{const {id,url}=canonicalChannelPost(input);const page=parseChannelPage(await fetchChannelHtml(url));if(!page.postIds.includes(id))throw new ChannelImportError('POST_NOT_FOUND');const product=page.products.find(p=>p.id===id);if(!product)throw new ChannelImportError('NO_PRODUCT_OFFER');return{product,warnings:page.skipped.filter(x=>x.post===`fragranceuz/${id}`).map(x=>x.reason)};}

/** Same explicit offer only: do not merge differing sizes, testers, partial bottles, sets or concentrations. */
export function fragranceIdentity(product:Product):string{
 const concentration=key(product.concentration??'').replace(/\(.*?\)/g,'').replace(/eaudeparfumedp/,'eaudeparfum').replace(/eaudetoiletteedt/,'eaudetoilette');
 return JSON.stringify([key(product.brand),key(product.name),concentration,/ · Set/.test(product.name)?key(product.sourceText.split(/Тип/i)[0]):'',product.variants.map(v=>[v.volume,/tester/i.test(v.label)?'tester':/остаток/i.test(v.label)?key(v.label):'full']).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
}
