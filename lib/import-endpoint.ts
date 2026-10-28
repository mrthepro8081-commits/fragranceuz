import {isAdmin,runtime,error,sameOrigin,body} from './server';
import {demoEnabled} from './demo';
import {importChannelPost,ChannelImportError} from './channel-import';
import {productInput} from './validation';
export async function importEndpoint(request:Request,demo=false){
 if(demo?!demoEnabled(request):!await isAdmin(request))return error(demo?'The demo is not available.':'Not authorized',demo?404:401);
 if(!sameOrigin(request))return error('Invalid origin',403);
 if(!runtime().DB)return error('Database is not connected',503);
 let input;try{input=await body(request)}catch{return error('INVALID_POST_URL')}
 if(typeof input.url!=='string'||input.url.length>500)return error('INVALID_POST_URL');
 try{const result=await importChannelPost(input.url);const checked=productInput.safeParse(result.product);if(!checked.success)return error('NO_PRODUCT_OFFER');return Response.json({product:checked.data,warnings:result.warnings},{headers:{'Cache-Control':'no-store'}})}catch(err){return error(err instanceof ChannelImportError?err.code:'CHANNEL_UNAVAILABLE',err instanceof ChannelImportError&&err.code==='CHANNEL_UNAVAILABLE'?502:400)}
}
