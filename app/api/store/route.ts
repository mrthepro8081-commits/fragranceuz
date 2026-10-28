import {catalog,runtime,error,adminRole,storeSettings} from '../../../lib/server';
import {demoEnabled} from '../../../lib/demo';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const e=runtime();return Response.json({demoAvailable:demoEnabled(request),settings:await storeSettings(),products:await catalog(),viewerRole:await adminRole(request),checkoutReady:Boolean(e.TELEGRAM_BOT_TOKEN&&e.TELEGRAM_ORDER_CHAT_ID&&e.DB),botUsername:e.TELEGRAM_BOT_USERNAME||null,importedAt:'2026-10-28'},{headers:{'Cache-Control':'no-store'}});}catch{return error('The catalog is temporarily unavailable. Please try again.',503);}}
