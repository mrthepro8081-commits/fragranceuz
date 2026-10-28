import {translate,formatProductName,formatMoney,formatBottle,type Language} from './i18n';
export type CustomerDetails={name:string;phone:string;address:string;note:string};
export type DraftLine={name:string;brand:string;label:string;price:number;quantity:number};
export function composeOrderDraft(customer:CustomerDetails,items:DraftLine[],lang:Language){
 const t=(key:string)=>translate(key,lang);const total=items.reduce((sum,line)=>sum+line.price*line.quantity,0);
 return [t('Hello, Fragrance UZ! I would like to order:'),`${t('Your name')}: ${customer.name.trim()}`,`${t('Phone number')}: ${customer.phone.trim()}`,`${t('Delivery address')}: ${customer.address.trim()}`,...items.map(line=>`${line.brand} ${formatProductName(line.name,lang)} · ${formatBottle(line.label,lang)} × ${line.quantity} · ${formatMoney(line.price*line.quantity,lang)}`),`${t('Product subtotal')}: ${formatMoney(total,lang)}`,customer.note.trim()?`${t('Note')}: ${customer.note.trim()}`:'',t('Please confirm availability, final price, and delivery.')].filter(Boolean).join('\n\n');
}
