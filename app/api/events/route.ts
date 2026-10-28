import seed from '../../../data/products.json';
import {runtime,sameOrigin,body} from '../../../lib/server';
import {recordEvent} from '../../../lib/analytics';
import type {Product} from '../../../lib/types';
export const dynamic='force-dynamic';
const seedIds=new Set((seed as Product[]).map(p=>p.id));
/** Anonymous product view / add-to-bag counter used by the admin statistics. */
export async function POST(request:Request){
 const db=runtime().DB;
 if(!db||!sameOrigin(request))return new Response(null,{status:204});
 try{
  const input=await body(request,500);
  if((input.type!=='view'&&input.type!=='add')||typeof input.id!=='string'||!/^\d{1,16}$/.test(input.id))return new Response(null,{status:204});
  if(!seedIds.has(input.id)&&!await db.prepare('SELECT id FROM product_overrides WHERE id=?').bind(input.id).first())return new Response(null,{status:204});
  await recordEvent(db,input.type,input.id);
 }catch{}
 return new Response(null,{status:204});
}
