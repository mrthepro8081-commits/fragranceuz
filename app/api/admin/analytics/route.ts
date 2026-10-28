import {adminRole,runtime,error} from '../../../../lib/server';
import {analytics,PERIODS} from '../../../../lib/analytics';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!await adminRole(request))return error('Not authorized',401);
 const db=runtime().DB;if(!db)return error('Database is not connected',503);
 const days=Number(new URL(request.url).searchParams.get('days'));
 return Response.json(await analytics(db,(PERIODS as readonly number[]).includes(days)?days:30),{headers:{'Cache-Control':'no-store'}});
}
