import {catalog,isAdmin,adminRole,runtime,error,sameOrigin,body,storeSettings} from '../../../lib/server';
import {settingsInput} from '../../../lib/settings';
import {productInput} from '../../../lib/validation';
import {sendNotification} from '../../../lib/telegram';
import {storeStats,customerRecords} from '../../../lib/insights';
import {formatOrder} from '../orders/route';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const role=await adminRole(request);if(!role)return error('Admin access is not connected or your account is not authorized.',401);
 const e=runtime();if(!e.DB)return error('Database is not connected',503);
 const orders=await e.DB.prepare('SELECT id,data,total,status,notification,created_at FROM orders ORDER BY created_at DESC LIMIT 100').all();
 const [statistics,customers]=await Promise.all([storeStats(e.DB),customerRecords(e.DB)]);
 return Response.json({settings:await storeSettings(),statistics,customers,role,products:await catalog(true),orders:orders.results.map(r=>({...r,data:JSON.parse(String(r.data))})),telegramReady:!!(e.TELEGRAM_BOT_TOKEN&&e.TELEGRAM_ORDER_CHAT_ID)},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return error('Invalid origin',403);if(!await isAdmin(request))return error('Not authorized',401);const e=runtime();if(!e.DB)return error('Database is not connected',503);
 try{
  const input=await body(request);if(input.confirmed!==true)return error('Please confirm your changes before saving.',400);
  if(input.action==='settings'){const parsed=settingsInput.safeParse(input.settings);if(!parsed.success)return error('Use a full international phone number and valid Telegram or Instagram profile links.');const settings=parsed.data;await e.DB.prepare('INSERT INTO store_settings (id,data,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind('public',JSON.stringify(settings),new Date().toISOString()).run();return Response.json({ok:true});}
  if(input.action==='save'){
   const p=productInput.parse(input.product);const postId=p.sourceUrl.split('/').pop();if(postId!==p.id)return error('Product ID must match the source post.');
   await e.DB.prepare('INSERT INTO product_overrides (id,data,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind(p.id,JSON.stringify(p),new Date().toISOString()).run();return Response.json({ok:true});
  }
  if(input.action==='order-status'){
   if(!['new','confirmed','completed','cancelled'].includes(input.status)||typeof input.id!=='string')return error('Invalid status');
   await e.DB.prepare('UPDATE orders SET status=? WHERE id=?').bind(input.status,input.id).run();return Response.json({ok:true});
  }
  if(input.action==='retry-notification'){
   if(!e.TELEGRAM_BOT_TOKEN||!e.TELEGRAM_ORDER_CHAT_ID)return error('Telegram is not connected',503);
   const claimed=await e.DB.prepare("UPDATE orders SET notification='sending' WHERE id=? AND notification='failed' RETURNING id,data").bind(input.id).first<{id:string;data:string}>();
   if(!claimed)return error('Only failed notifications can be retried',409);
   try{await sendNotification(e.TELEGRAM_BOT_TOKEN,e.TELEGRAM_ORDER_CHAT_ID,formatOrder(claimed.id,JSON.parse(claimed.data)));await e.DB.prepare("UPDATE orders SET notification='sent' WHERE id=?").bind(claimed.id).run();}catch{await e.DB.prepare("UPDATE orders SET notification='failed' WHERE id=?").bind(claimed.id).run();return error('Telegram delivery failed; the order is saved.',502);}return Response.json({ok:true});
  }
  return error('Unknown action');
 }catch(err){if(err&&typeof err==='object'&&'issues' in err)return error('Product details are invalid. Check the source, Fragrantica link, price, and volume.');return error('Could not save. Please try again.',500);}
}
