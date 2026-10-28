import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {createHmac,createHash} from 'node:crypto';import fs from 'node:fs';
const sql=new DatabaseSync(':memory:');for(const f of ['0000_curved_maginty','0001_jittery_ricochet','0003_product_images_and_removals','0004_product_events'])sql.exec(fs.readFileSync(new URL(`../drizzle/${f}.sql`,import.meta.url),'utf8'));
const stmt=(query,args=[])=>({bind(...v){return stmt(query,v)},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){return {meta:{changes:sql.prepare(query).run(...args).changes}}}});
const DB={prepare:q=>stmt(q),async batch(list){for(const s of list)await s.run()}};
const token='000000:test-only-never-a-real-bot';const OWNER='740597322';
globalThis.__TEST_ENV={DB,TELEGRAM_BOT_TOKEN:token,TELEGRAM_ORDER_CHAT_ID:OWNER,OWNER_TELEGRAM_ID:OWNER};
const calls=[];globalThis.fetch=async(url,init)=>{calls.push({method:String(url).split('/').pop(),body:JSON.parse(init.body)});return Response.json({ok:true,result:{}})};
const {POST:ORDER}=await import('../.sites-runtime/tests/orders.mjs');const {POST:ADMIN}=await import('../.sites-runtime/tests/admin.mjs');
const {POST:HOOK}=await import('../.sites-runtime/tests/telegram.mjs');const {GET:STATS}=await import('../.sites-runtime/tests/admin-analytics.mjs');const {POST:EVENT}=await import('../.sites-runtime/tests/events.mjs');
function init(id,username){const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'T',username})});const secret=createHmac('sha256','WebAppData').update(token).digest();p.set('hash',createHmac('sha256',secret).update([...p].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('\n')).digest('hex'));return p.toString()}
const secret=createHash('sha256').update('fragranceuz-webhook:'+token).digest('hex').slice(0,48);
const hook=(update,s=secret)=>HOOK(new Request('https://shop.example/api/telegram',{method:'POST',headers:{'x-telegram-bot-api-secret-token':s},body:JSON.stringify(update)}));
let orderId;
test('A new order alerts the owner with contacts and approve/cancel buttons',async()=>{
 calls.length=0;
 const r=await ORDER(new Request('https://shop.example/api/orders',{method:'POST',headers:{'Content-Type':'application/json','x-telegram-init-data':init(5551,'aziz')},body:JSON.stringify({requestKey:crypto.randomUUID(),language:'uz',quotedTotal:3120000,customer:{name:'Aziz Karimov',phone:'+998901234567',address:'Toshkent, Yunusobod 4',note:''},items:[{id:'11078',variant:0,quantity:1}]})}));
 assert.equal(r.status,201);orderId=(await r.json()).orderId;
 const alert=calls.find(c=>c.method==='sendMessage');
 assert.equal(alert.body.chat_id,OWNER);assert.equal(alert.body.parse_mode,'HTML');
 assert.match(alert.body.text,/Новая заявка/);assert.match(alert.body.text,/\+998901234567/);assert.match(alert.body.text,/@aziz/);assert.match(alert.body.text,/Yunusobod/);
 const buttons=alert.body.reply_markup.inline_keyboard.flat();
 assert.ok(buttons.some(b=>b.callback_data===`s:confirmed:${orderId}`));assert.ok(buttons.some(b=>b.url==='https://t.me/aziz'));
});
test('Webhook rejects calls without Telegram\'s secret and buttons from strangers',async()=>{
 assert.equal((await hook({},'wrong')).status,403);
 calls.length=0;
 await hook({callback_query:{id:'q1',from:{id:999},data:`s:confirmed:${orderId}`,message:{chat:{id:999},message_id:1}}});
 assert.equal(sql.prepare('SELECT status FROM orders WHERE id=?').get(orderId).status,'new');
 assert.equal(calls[0].body.show_alert,true);
});
test('Approving from Telegram saves the status, sends the owner the contact card and tells the customer',async()=>{
 calls.length=0;
 await hook({callback_query:{id:'q2',from:{id:Number(OWNER)},data:`s:confirmed:${orderId}`,message:{chat:{id:Number(OWNER)},message_id:7}}});
 assert.equal(sql.prepare('SELECT status FROM orders WHERE id=?').get(orderId).status,'confirmed');
 const owner=calls.find(c=>c.method==='sendMessage'&&c.body.chat_id===OWNER);
 assert.match(owner.body.text,/подтверждён/);assert.match(owner.body.text,/Aziz Karimov/);assert.match(owner.body.text,/\+998901234567/);assert.match(owner.body.text,/Yunusobod/);
 const customer=calls.find(c=>c.method==='sendMessage'&&c.body.chat_id===5551);
 assert.match(customer.body.text,/tasdiqlandi/);
 assert.ok(calls.some(c=>c.method==='editMessageText'&&c.body.message_id===7));
 assert.ok(calls.some(c=>c.method==='answerCallbackQuery'&&/обновлён/.test(c.body.text)));
});
test('Approving in the admin panel sends the same messages',async()=>{
 sql.prepare("UPDATE orders SET status='new' WHERE id=?").run(orderId);calls.length=0;
 const r=await ADMIN(new Request('https://shop.example/api/admin',{method:'POST',headers:{'Content-Type':'application/json','x-telegram-init-data':init(Number(OWNER))},body:JSON.stringify({action:'order-status',id:orderId,status:'confirmed',confirmed:true})}));
 assert.equal(r.status,200);const d=await r.json();assert.deepEqual(d.notified,{owner:true,customer:true});
});
test('/start offers the shop to everyone and management to the owner only',async()=>{
 calls.length=0;await hook({message:{chat:{id:42,type:'private'},from:{id:42,language_code:'ru'},text:'/start'}});
 assert.equal(calls[0].body.reply_markup.inline_keyboard.length,1);assert.equal(calls[0].body.reply_markup.inline_keyboard[0][0].web_app.url,'https://shop.example/');
 calls.length=0;await hook({message:{chat:{id:Number(OWNER),type:'private'},from:{id:Number(OWNER)},text:'/start 11078'}});
 const rows=calls[0].body.reply_markup.inline_keyboard;assert.equal(rows[0][0].web_app.url,'https://shop.example/?product=11078');assert.equal(rows[1][0].web_app.url,'https://shop.example/admin');
});
test('Statistics count real orders and anonymous views, and only for staff',async()=>{
 for(const type of ['view','view','add'])await EVENT(new Request('https://shop.example/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,id:'11078'})}));
 await EVENT(new Request('https://shop.example/api/events',{method:'POST',body:JSON.stringify({type:'view',id:'999999999'})}));
 assert.equal((await STATS(new Request('https://shop.example/api/admin/analytics?days=30'))).status,401);
 const s=await (await STATS(new Request('https://shop.example/api/admin/analytics?days=30',{headers:{'x-telegram-init-data':init(Number(OWNER))}}))).json();
 assert.equal(s.current.requests,1);assert.equal(s.current.value,3120000);assert.equal(s.statuses.confirmed,1);
 assert.equal(s.topProducts[0].id,'11078');assert.deepEqual(s.funnel,{views:2,adds:1,ordered:1});assert.equal(s.topViewed.length,1);
 assert.equal(s.daily.reduce((n,d)=>n+d.requests,0),1);
});
