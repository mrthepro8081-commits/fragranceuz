import {catalog,isAdmin,adminRole,runtime,error,sameOrigin,body,storeSettings,ADMIN_BODY_LIMIT} from '../../../lib/server';
import {saveProduct,deleteProduct} from '../../../lib/product-store';
import {setOrderStatus} from '../../../lib/order-status';
import {sheetsLink,saveSheetsLink,testSheet,pushAllOrders,SHEETS_LINK} from '../../../lib/sheets';
import {sendOrderAlert} from '../../../lib/order-notify';
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
 return Response.json({settings:await storeSettings(),statistics,customers,role,products:await catalog(true),orders:orders.results.map(r=>({...r,data:JSON.parse(String(r.data))})),telegramReady:!!(e.TELEGRAM_BOT_TOKEN&&e.TELEGRAM_ORDER_CHAT_ID),sheets:await sheetsLink(e.DB).then(link=>({connected:!!link,hint:link?link.replace(/^https:\/\/script\.google\.com\/macros\/s\/([\w-]{6})[\w-]*\/exec\?key=.*$/,'script.google.com/…/$1…'):null,doc:/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+/.test(e.GOOGLE_SHEET_URL||'')?e.GOOGLE_SHEET_URL!.replace(/[?#].*$/,''):null}))},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return error('Invalid origin',403);if(!await isAdmin(request))return error('Not authorized',401);const e=runtime();if(!e.DB)return error('Database is not connected',503);
 try{
  const input=await body(request,ADMIN_BODY_LIMIT);if(input.confirmed!==true)return error('Please confirm your changes before saving.',400);
  if(input.action==='settings'){const parsed=settingsInput.safeParse(input.settings);if(!parsed.success)return error('Use a full international phone number and valid Telegram or Instagram profile links.');const settings=parsed.data;await e.DB.prepare('INSERT INTO store_settings (id,data,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind('public',JSON.stringify(settings),new Date().toISOString()).run();return Response.json({ok:true});}
  if(input.action==='save'){
   const p=productInput.parse(input.product);const postId=p.sourceUrl.split('/').pop();if(postId!==p.id)return error('Product ID must match the source post.');
   const saved=await saveProduct(e.DB,'live',p,input.imageUpload);return Response.json({ok:true,product:saved});
  }
  if(input.action==='delete'){
   if(typeof input.id!=='string'||!/^\d{1,16}$/.test(input.id))return error('Invalid product');
   if(!await deleteProduct(e.DB,'live',input.id))return error('Product not found',404);return Response.json({ok:true});
  }
  if(input.action==='sheets-save'){
   const link=input.link===null?null:String(input.link||'').trim();
   if(link!==null&&!SHEETS_LINK.test(link))return error('Paste the link shown by the sheet menu Fragrance UZ → Show the link for the shop.');
   if(link)try{await testSheet(link)}catch{return error('Google Sheets did not answer. Check that the script is deployed as a web app with access for anyone.',502)}
   await saveSheetsLink(e.DB,link);return Response.json({ok:true});
  }
  if(input.action==='sheets-sync'){
   const link=await sheetsLink(e.DB);if(!link)return error('Connect the Google Sheet first.');
   try{return Response.json({ok:true,...await pushAllOrders(e.DB,link)})}catch{return error('Google Sheets did not answer. Check that the script is deployed as a web app with access for anyone.',502)}
  }
  if(input.action==='order-status'){
   const result=await setOrderStatus(e,input.id,input.status,new URL(request.url).origin);
   if(!result.ok)return error(result.error,result.code);return Response.json({ok:true,notified:result.changed?result.notified:null});
  }
  if(input.action==='retry-notification'){
   if(!e.TELEGRAM_BOT_TOKEN||!e.TELEGRAM_ORDER_CHAT_ID)return error('Telegram is not connected',503);
   const claimed=await e.DB.prepare("UPDATE orders SET notification='sending' WHERE id=? AND notification='failed' RETURNING id,data").bind(input.id).first<{id:string;data:string}>();
   if(!claimed)return error('Only failed notifications can be retried',409);
   try{await sendOrderAlert(e,claimed.id,JSON.parse(claimed.data),new URL(request.url).origin);await e.DB.prepare("UPDATE orders SET notification='sent' WHERE id=?").bind(claimed.id).run();}catch{await e.DB.prepare("UPDATE orders SET notification='failed' WHERE id=?").bind(claimed.id).run();return error('Telegram delivery failed; the order is saved.',502);}return Response.json({ok:true});
  }
  return error('Unknown action');
 }catch(err){if(err&&typeof err==='object'&&'issues' in err)return error('Product details are invalid. Check the source, Fragrantica link, price, and volume.');return error('Could not save. Please try again.',500);}
}
