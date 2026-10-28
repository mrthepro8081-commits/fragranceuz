import {PDFDocument,rgb,type PDFPage} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fontBase64 from '../data/report-font.json';
import {translate,formatMoney,formatDate,type Language} from './i18n';
import type {CustomerRecord,StoreStats} from './types';
export async function customerPdf(customers:CustomerRecord[],stats:StoreStats,lang:Language,created=new Date()){
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(Uint8Array.from(atob(fontBase64),c=>c.charCodeAt(0)),{subset:true});
 const glyphs=new Set(font.getCharacterSet());
 const clean=(value:unknown)=>Array.from(String(value??'').replace(/[\x00-\x1f\x7f]/g,' ').normalize('NFC')).map(c=>glyphs.has(c.codePointAt(0)!)?c:'?').join('');
 const t=(key:string)=>translate(key,lang),money=(value:number)=>formatMoney(value,lang);
 const ink=rgb(.18,.16,.13),muted=rgb(.46,.42,.35),gold=rgb(.63,.51,.29),line=rgb(.87,.83,.75);
 const width=507,left=44;let page!:PDFPage;let y=0;
 function text(value:string,x:number,at:number,size=11,color=ink){page.drawText(clean(value),{x,y:at,size,font,color})}
 function wrap(value:string,size:number,max=width){const rows:string[]=[];let current='';for(const word of clean(value).split(/\s+/)){if(!word)continue;const candidate=current?current+' '+word:word;if(font.widthOfTextAtSize(candidate,size)<=max){current=candidate;continue}if(current)rows.push(current);current='';for(const char of Array.from(word)){if(current&&font.widthOfTextAtSize(current+char,size)>max){rows.push(current);current=''}current+=char}}if(current)rows.push(current);return rows.length?rows:['-']}
 function addPage(){page=pdf.addPage([595.28,841.89]);page.drawRectangle({x:0,y:0,width:595.28,height:841.89,color:rgb(.98,.96,.92)});text('FRAGRANCE UZ',left,795,12,gold);text(t('Customer database'),left,762,23);text(t('Generated')+': '+formatDate(created.toISOString(),lang,true),left,741,9,muted);page.drawLine({start:{x:left,y:725},end:{x:551,y:725},color:gold,thickness:1});text(t('Private store report'),left,708,9,muted);text(`${t('Customers')}: ${stats.customers}    |    ${t('All submitted requests')}: ${stats.totalOrders}`,left,685,11);text(t('Requested product value')+': '+money(stats.requestValue),left,667,10,muted);text(t('Completed order value')+': '+money(stats.completedValue),left,650,10,muted);y=619}
 addPage();
 if(!customers.length)text(t('No customers yet.'),left,y,12,muted);
 for(const customer of customers){
  const name=wrap(customer.name,14),address=wrap(customer.address,10.5);
  const totals=wrap(`${t('Order requests')}: ${customer.orders}    |    ${t('Requested product value')}: ${money(customer.requestValue)}`,10);
  const dates=wrap(`${t('First request')}: ${formatDate(customer.firstOrderAt,lang)}    |    ${t('Last request')}: ${formatDate(customer.lastOrderAt,lang)}`,9);
  const height=name.length*19+20+address.length*15+totals.length*15+dates.length*14+24;
  if(y-height<57)addPage();
  for(const row of name){text(row,left,y,14);y-=19}
  text(customer.phone,left,y,11,gold);y-=20;
  for(const row of address){text(row,left,y,10.5,muted);y-=15}
  y-=3;for(const row of totals){text(row,left,y,10);y-=15}
  for(const row of dates){text(row,left,y,9,muted);y-=14}
  y-=7;page.drawLine({start:{x:left,y},end:{x:551,y},color:line,thickness:.6});y-=21;
 }
 const pages=pdf.getPages();pages.forEach((p,i)=>{p.drawText(clean('FRAGRANCE UZ - '+t('Private store report')),{x:left,y:29,size:8,font,color:muted});const label=clean(`${t('Page')} ${i+1} / ${pages.length}`);p.drawText(label,{x:551-font.widthOfTextAtSize(label,8),y:29,size:8,font,color:muted})});
 pdf.setTitle('FRAGRANCE UZ - '+t('Customer database'));pdf.setAuthor('FRAGRANCE UZ');pdf.setCreationDate(created);return pdf.save();
}
