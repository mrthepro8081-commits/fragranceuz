import seed from '../data/products.json';
import {runtime,storeSettings} from './server';
import type {Product,StoreStats} from './types';
import {defaultSettings,settingsInput} from './settings';
import {removedIds} from './product-store';
export function demoEnabled(request:Request){const env=runtime() as ReturnType<typeof runtime>&{DEMO_ENABLED?:string};return env.DEMO_ENABLED==='true'||['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname)}
export const emptyDemoStats:StoreStats={totalOrders:0,newOrders:0,confirmedOrders:0,completedOrders:0,cancelledOrders:0,requestValue:0,completedValue:0,customers:0};
export async function demoCatalog(includeHidden=false){const db=runtime().DB;if(!db)throw new Error('Database is not connected');const rows=await db.prepare('SELECT id,data FROM demo_product_overrides').all<{id:string;data:string}>();const map=new Map((seed as Product[]).map(p=>[p.id,p]));for(const row of rows.results)map.set(row.id,JSON.parse(row.data));const removed=await removedIds(db,'demo');return [...map.values()].filter(p=>!removed.has(p.id)&&(includeHidden||p.active)).sort((a,b)=>Number(b.id)-Number(a.id));}
export async function demoSettings(){const row=await runtime().DB?.prepare('SELECT data FROM demo_store_settings WHERE id=?').bind('public').first<{data:string}>();if(!row)return await storeSettings();try{const parsed=settingsInput.safeParse(JSON.parse(row.data));return parsed.success?parsed.data:defaultSettings}catch{return defaultSettings}}
