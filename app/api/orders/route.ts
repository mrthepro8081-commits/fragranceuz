import {catalog,runtime,error,sameOrigin,body} from '../../../lib/server';
import {verifyTelegram} from '../../../lib/telegram';
import {sendOrderAlert,messageCustomer} from '../../../lib/order-notify';
import {pushOrder} from '../../../lib/sheets';
import {orderInput} from '../../../lib/validation';
import {translate,formatProductName,formatMoney,formatBottle} from '../../../lib/i18n';
import type {OrderData} from '../../../lib/types';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!sameOrigin(request))return error('Invalid request origin',403);
 const e=runtime();if(!e.DB||!e.TELEGRAM_BOT_TOKEN||!e.TELEGRAM_ORDER_CHAT_ID)return error('Automatic checkout is not connected yet. You can send your request to @fragranceuz1.',503);
 const user=await verifyTelegram(request.headers.get('x-telegram-init-data')||'',e.TELEGRAM_BOT_TOKEN);if(!user)return error('Please reopen the storefront from the Telegram bot to place your order.',401);
 let input;try{input=orderInput.parse(await body(request));}catch{return error('Please check your contact details and cart.');}
 const previous=await e.DB.prepare('SELECT id,notification FROM orders WHERE user_id=? AND request_key=?').bind(String(user.id),input.requestKey).first<{id:string;notification:string}>();
 if(previous)return Response.json({orderId:previous.id,notification:previous.notification});
 const recent=await e.DB.prepare('SELECT COUNT(*) AS count FROM orders WHERE user_id=? AND created_at>?').bind(String(user.id),new Date(Date.now()-60000).toISOString()).first<{count:number}>();if((recent?.count||0)>=3)return error('Please wait a minute before sending another request.',429);
 const products=await catalog();const seen=new Set();const items=[];
 for(const row of input.items){const key=`${row.id}:${row.variant}`;if(seen.has(key))return error('Duplicate cart item');seen.add(key);const p=products.find(x=>x.id===row.id);const v=p?.variants[row.variant];if(!p||!v||(row.expectedLabel!==undefined&&row.expectedLabel!==v.label))return error('A fragrance in your cart has changed. Please refresh the catalog.',409);items.push({id:p.id,name:p.name,brand:p.brand,label:v.label,price:v.price,quantity:row.quantity,sourceUrl:p.sourceUrl});}
 const total=items.reduce((s,p)=>s+p.price*p.quantity,0);if(total!==input.quotedTotal)return error('Prices have changed. Please review your updated bag and send the request again.',409);const id=crypto.randomUUID();const data:OrderData={language:input.language,customer:input.customer,items,telegram:{id:user.id,username:user.username},total};
 const createdAt=new Date().toISOString();
 const result=await e.DB.prepare('INSERT OR IGNORE INTO orders (id,user_id,request_key,data,total,status,notification,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,String(user.id),input.requestKey,JSON.stringify(data),total,'new','pending',createdAt).run();
 if(!result.meta.changes){const duplicate=await e.DB.prepare('SELECT id,notification FROM orders WHERE user_id=? AND request_key=?').bind(String(user.id),input.requestKey).first();return Response.json({orderId:duplicate?.id,notification:duplicate?.notification});}
 let notification='sent';
 try{await sendOrderAlert(e,id,data,new URL(request.url).origin);}catch{notification='failed';}
 await pushOrder(e.DB,{id,createdAt,status:'new',data});
 await messageCustomer(e,id,data,'new');
 await e.DB.prepare('UPDATE orders SET notification=? WHERE id=?').bind(notification,id).run();
 return Response.json({orderId:id,notification},{status:201});
}
export function formatOrder(id:string,d:OrderData){
 const lang=d.language||'ru';const t=(s:string)=>translate(s,lang);
 return [`FRAGRANCE UZ · ${t('Order request')} #${id.slice(0,8)}`,`${t('Customer')}: ${d.customer.name} · ${d.customer.phone}`,`Telegram: ${d.telegram.username?'@'+d.telegram.username:d.telegram.id}`,`${t('Address')}: ${d.customer.address}`,...d.items.map(p=>`${p.brand} — ${formatProductName(p.name,lang)}\n${formatBottle(p.label,lang)} × ${p.quantity} · ${formatMoney(p.price*p.quantity,lang)}`),`${t('Product subtotal')}: ${formatMoney(d.total,lang)}`,t('This is an order request. Availability, final price, delivery, and payment are arranged with the store.'),d.customer.note?`${t('Note')}: ${d.customer.note}`:''].filter(Boolean).join('\n\n').slice(0,4000);
}
