import {runtime,error} from '../../../../lib/server';
import {imageKeyFromPath} from '../../../../lib/product-store';
export const dynamic='force-dynamic';
/** Serves product photos saved by the admin. URLs carry ?v=<timestamp>, so a new photo gets a new URL. */
export async function GET(request:Request){
 const key=imageKeyFromPath(new URL(request.url).pathname.split('/').pop()||'');
 const db=runtime().DB;if(!key||!db)return error('Not found',404);
 const row=await db.prepare('SELECT content_type,data FROM product_images WHERE key=?').bind(key).first<{content_type:string;data:ArrayBuffer|number[]}>();
 if(!row)return error('Not found',404);
 const bytes=row.data instanceof ArrayBuffer?new Uint8Array(row.data):Uint8Array.from(row.data);
 return new Response(bytes,{headers:{'Content-Type':row.content_type,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
}
