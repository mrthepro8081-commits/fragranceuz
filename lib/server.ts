import {env} from 'cloudflare:workers';
import seed from '../data/products.json';
import type {Product} from './types';
import {verifyTelegram} from './telegram';
import {defaultSettings,settingsInput,type StoreSettings} from './settings';
import {removedIds} from './product-store';
export type RuntimeEnv={DB?:D1Database;TELEGRAM_BOT_TOKEN?:string;TELEGRAM_ORDER_CHAT_ID?:string;TELEGRAM_BOT_USERNAME?:string;ADMIN_TELEGRAM_IDS?:string;OWNER_TELEGRAM_ID?:string};
export function runtime(){return env as RuntimeEnv;}
export async function catalog(includeHidden=false):Promise<Product[]>{
 const db=runtime().DB;if(!db)throw new Error('Product database is not connected');
 const rows=await db.prepare('SELECT id,data FROM product_overrides').all<{id:string;data:string}>();
 const map=new Map((seed as Product[]).map(p=>[p.id,p]));for(const row of rows.results)map.set(row.id,JSON.parse(row.data));
 const removed=await removedIds(db,'live');
 return [...map.values()].filter(p=>!removed.has(p.id)&&(includeHidden||p.active)).sort((a,b)=>Number(b.id)-Number(a.id));
}
export type AdminRole='owner'|'admin';
export async function adminRole(request:Request):Promise<AdminRole|null>{
 const e=runtime();const user=await verifyTelegram(request.headers.get('x-telegram-init-data')||'',e.TELEGRAM_BOT_TOKEN||'');
 if(!user)return null;
 if(String(user.id)===e.OWNER_TELEGRAM_ID)return 'owner';
 return (e.ADMIN_TELEGRAM_IDS||'').split(',').map(s=>s.trim()).includes(String(user.id))?'admin':null;
}
export async function isAdmin(request:Request){return Boolean(await adminRole(request));}
export function error(message:string,status=400){return Response.json({error:message},{status,headers:{'Cache-Control':'no-store'}});}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin;}
export async function body(request:Request,limit=64000){if(Number(request.headers.get('content-length'))>limit)throw new Error('Request too large');const text=await request.text();if(text.length>limit)throw new Error('Request too large');return JSON.parse(text);}
/** Admin saves may carry an uploaded product photo. */
export const ADMIN_BODY_LIMIT=2_500_000;

export async function storeSettings():Promise<StoreSettings>{const db=runtime().DB;if(!db)return defaultSettings;const row=await db.prepare("SELECT data FROM store_settings WHERE id=?").bind("public").first<{data:string}>();if(!row)return defaultSettings;const parsed=settingsInput.safeParse(JSON.parse(row.data));return parsed.success?parsed.data:defaultSettings;}
