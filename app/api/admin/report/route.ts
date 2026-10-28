import {isAdmin,runtime,error} from '../../../../lib/server';
import {customerRecords,storeStats} from '../../../../lib/insights';
import {customerPdf} from '../../../../lib/customer-pdf';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!await isAdmin(request))return error('Not authorized',401);
 const db=runtime().DB;if(!db)return error('Database is not connected',503);
 try{
  const lang=new URL(request.url).searchParams.get('lang')==='uz'?'uz':'ru';
  const [customers,statistics]=await Promise.all([customerRecords(db),storeStats(db)]);
  const bytes=await customerPdf(customers,statistics,lang);
  return new Response(bytes.slice().buffer as ArrayBuffer,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="fragranceuz-customers-${new Date().toISOString().slice(0,10)}-${lang}.pdf"`,'Cache-Control':'private, no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"frame-ancestors 'none'"}});
 }catch{return error('Could not export customers. Please try again.',500)}
}
