import {error} from '../../../../lib/server';
import {demoEnabled,demoCatalog} from '../../../../lib/demo';
import {sampleAnalytics,PERIODS} from '../../../../lib/analytics';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!demoEnabled(request))return error('The demo is not available.',404);
 const days=Number(new URL(request.url).searchParams.get('days'));
 return Response.json(sampleAnalytics(await demoCatalog(),(PERIODS as readonly number[]).includes(days)?days:30),{headers:{'Cache-Control':'no-store'}});
}
