export type TelegramUser={id:number;first_name:string;username?:string};
const enc=new TextEncoder();
async function hmac(key:BufferSource,data:string){const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);return crypto.subtle.sign('HMAC',k,enc.encode(data));}
export async function verifyTelegram(raw:string,token:string,now=Date.now()):Promise<TelegramUser|null>{
 try{
  if(!raw||raw.length>16000||!token)return null;
  const p=new URLSearchParams(raw); const hash=p.get('hash');
  if(!hash||!/^[a-f0-9]{64}$/i.test(hash)||[...new Set(p.keys())].length!==[...p.keys()].length)return null;
  const date=Number(p.get('auth_date')); const age=now/1000-date;
  if(!Number.isFinite(date)||age< -30||age>3600)return null;
  p.delete('hash');const check=[...p.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('\n');
  const secret=await hmac(enc.encode('WebAppData'),token); const result=new Uint8Array(await hmac(secret,check));
  const expected=Uint8Array.from(hash.match(/../g)!,x=>parseInt(x,16));let mismatch=0;for(let i=0;i<32;i++)mismatch|=result[i]^expected[i];if(mismatch)return null;
  const u=JSON.parse(p.get('user')||'null');return u&&Number.isSafeInteger(u.id)&&u.id>0&&typeof u.first_name==='string'?u:null;
 }catch{return null;}
}
export async function sendNotification(token:string,chatId:string,text:string){
 const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text,link_preview_options:{is_disabled:true}}),signal:AbortSignal.timeout(12000)});
 const data=await response.json() as {ok?:boolean};if(!response.ok||!data.ok)throw new Error('Telegram delivery failed');
}
