import messages from '../data/translations.json';
export type Language='ru'|'uz';
const dictionary=messages as Record<string,string[]>;
export function translate(key:string,lang:Language){return dictionary[key]?.[lang==='ru'?0:1]??key;}
export function errorText(key:string,lang:Language){return translate(dictionary[key]?key:'genericError',lang)}
export function formatMoney(n:number,lang:Language='ru'){return new Intl.NumberFormat('ru-RU').format(n)+(lang==='ru'?' сум':' so‘m')}
export function formatBottle(label:string,lang:Language){return label.replace(/мл|\bml\b/g,lang==='ru'?'мл':'ml').replace(/Tester/gi,translate('Tester',lang)).replace(/Gift Set/g,translate('Gift set',lang)).replace(/\bSet\b/g,translate('Set',lang)).replace(/Остаток/gi,translate('Partial bottle',lang))}
export function fragranceCount(n:number,lang:Language){if(lang==='uz')return `${n} ta atir`;const last=n%10,lastTwo=n%100;return `${n} ${last===1&&lastTwo!==11?'аромат':last>=2&&last<=4&&(lastTwo<12||lastTwo>14)?'аромата':'ароматов'}`}
const countries:Record<string,string>={'Англия':'Angliya','Испания':'Ispaniya','Италия':'Italiya','ОАЭ':'BAA','Оман':'Ummon','США':'AQSH','Франция':'Fransiya','Швейцария':'Shveytsariya','Южная Корея':'Janubiy Koreya'};
export function formatCountry(s:string,lang:Language){return lang==='ru'?s:(countries[s]||s)}
const concentrations:Record<string,string>={'eau de parfum':'Eau de Parfum (EDP)','eau de toilette':'Eau de Toilette (EDT)','parfum':'Parfum','extrait de parfum':'Extrait de Parfum','elixir de parfum':'Elixir de Parfum','extrait extreme':'Extrait Extreme','parfum intense':'Parfum Intense'};
export function formatConcentration(s:string|null,_lang:Language){const key=(s||'').replace(/\s*\([^)]*\)/,'').trim().toLowerCase();return concentrations[key]||s||''}
export function formatDate(value:string,lang:Language,includeTime=false){
 const date=new Date(value);if(Number.isNaN(date.getTime()))return '—';
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 const ru=['янв.','февр.','мар.','апр.','мая','июн.','июл.','авг.','сент.','окт.','нояб.','дек.'];
 const uz=['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentabr','oktabr','noyabr','dekabr'];
 const result=lang==='ru'?`${Number(p.day)} ${ru[Number(p.month)-1]} ${p.year}`:`${p.year}-yil ${Number(p.day)}-${uz[Number(p.month)-1]}`;
 return result+(includeTime?` · ${p.hour}:${p.minute}`:'');
}

export function formatProductName(name:string,lang:Language){return name.replace(/ · Set(?= · |$)/g," · "+translate("Set",lang))}
