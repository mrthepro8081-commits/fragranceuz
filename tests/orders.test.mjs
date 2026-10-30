import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {createHmac} from 'node:crypto';import fs from 'node:fs';
const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync(new URL('../drizzle/0000_curved_maginty.sql',import.meta.url),'utf8'));sql.exec(fs.readFileSync(new URL('../drizzle/0001_jittery_ricochet.sql',import.meta.url),'utf8'));sql.exec(fs.readFileSync(new URL('../drizzle/0003_product_images_and_removals.sql',import.meta.url),'utf8'));
const DB={prepare(query){let args=[];return {bind(...v){args=v;return this},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:r.changes}}}}}};
const token='000000:test-only-never-a-real-bot';
globalThis.__TEST_ENV={DB,TELEGRAM_BOT_TOKEN:token,TELEGRAM_ORDER_CHAT_ID:'test-recipient',OWNER_TELEGRAM_ID:'123456789',ADMIN_TELEGRAM_IDS:'987654321'};
const {POST,formatOrder}=await import('../.sites-runtime/tests/orders.mjs');const {POST:ADMIN,GET:ADMIN_GET}=await import('../.sites-runtime/tests/admin.mjs');
function init(id=123456789){const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Test',username:'test_user'})});const secret=createHmac('sha256','WebAppData').update(token).digest();p.set('hash',createHmac('sha256',secret).update([...p].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('\n')).digest('hex'));return p.toString()}
const base={quotedTotal:3120000,customer:{name:'Test User',phone:'+998900000000',address:'Local test address',note:''},items:[{id:'11078',variant:0,quantity:1,price:1}]};
const req=(data,signed=init())=>new Request('http://localhost/api/orders',{method:'POST',headers:{'Content-Type':'application/json','x-telegram-init-data':signed},body:JSON.stringify(data)});
let sent=0;globalThis.fetch=async()=>{sent++;return Response.json({ok:true})};
test('Server computes true price, saves request and sends only one alert for repeated submissions',async()=>{const data={...base,requestKey:crypto.randomUUID()};const r=await POST(req(data));assert.equal(r.status,201);const result=await r.json();assert.equal(result.notification,'sent');const afterFirst=sent;assert.equal(afterFirst,3,'one alert per staff recipient (order chat + listed admin) and one message to the customer');const row=sql.prepare('SELECT * FROM orders WHERE id=?').get(result.orderId);assert.equal(row.total,3120000);assert.equal(JSON.parse(row.data).items[0].price,3120000);const again=await POST(req(data));assert.equal((await again.json()).orderId,result.orderId);assert.equal(sent,afterFirst,'a repeated submission sends nothing again');assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM orders').get().n,1)});
test('Changed prices and invalid Telegram sessions cannot create an order',async()=>{const n=sql.prepare('SELECT COUNT(*) AS n FROM orders').get().n;assert.equal((await POST(req({...base,quotedTotal:1,requestKey:crypto.randomUUID()}))).status,409);assert.equal((await POST(req({...base,requestKey:crypto.randomUUID()},'invalid'))).status,401);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM orders').get().n,n)});
test('Notification failure preserves the order and admin can retry it',async()=>{globalThis.fetch=async()=>{throw new Error('Simulated delivery failure')};const r=await POST(req({...base,requestKey:crypto.randomUUID()}));assert.equal(r.status,201);const d=await r.json();assert.equal(d.notification,'failed');assert.equal(sql.prepare('SELECT notification FROM orders WHERE id=?').get(d.orderId).notification,'failed');globalThis.fetch=async()=>Response.json({ok:true});const retry=await ADMIN(new Request('http://localhost/api/admin',{method:'POST',headers:{'Content-Type':'application/json','x-telegram-init-data':init()},body:JSON.stringify({action:'retry-notification',id:d.orderId,confirmed:true})}));assert.equal(retry.status,200);assert.equal(sql.prepare('SELECT notification FROM orders WHERE id=?').get(d.orderId).notification,'sent')});

test('Order alerts follow Russian or Uzbek selection without English checkout labels',()=>{const d={...base,total:3120000,telegram:{id:123456789},items:[{name:'Valaya',brand:'Parfums de Marly',label:'75 мл',quantity:1,price:3120000}]};const ru=formatOrder('test-order',{...d,language:'ru'});const uz=formatOrder('test-order',{...d,language:'uz'});assert.match(ru,/Заявка на заказ/);assert.match(uz,/Buyurtma so‘rovi/);assert.match(uz,/75 ml/);assert.doesNotMatch(ru+' '+uz,/Order request|Product total|Availability/)});

const adminRequest=(identity,body)=>new Request('http://localhost/api/admin',{method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-telegram-init-data':identity},...(body?{body:JSON.stringify({...body,confirmed:true})}:{})});
test('Only verified owner and listed admins can access management',async()=>{
 const owner=await ADMIN_GET(adminRequest(init()));assert.equal(owner.status,200);assert.equal((await owner.json()).role,'owner');
 const admin=await ADMIN_GET(adminRequest(init(987654321)));assert.equal(admin.status,200);assert.equal((await admin.json()).role,'admin');
 for(const identity of ['',init(555555555),init().replace('Test','Forged')])assert.equal((await ADMIN_GET(adminRequest(identity))).status,401);
 assert.equal((await ADMIN_GET(new Request('http://localhost/api/admin',{headers:{'x-admin-key':'test-admin-key-for-isolated-tests-only','x-telegram-user-id':'123456789'}}))).status,401);
});
test('Admin product changes persist while visitors cannot write',async()=>{
 const initial=await (await ADMIN_GET(adminRequest(init()))).json();const p=initial.products.find(x=>x.id==='11078');
 assert.equal((await ADMIN(adminRequest(init(555555555),{action:'save',product:{...p,active:false}}))).status,401);
 assert.equal((await ADMIN(adminRequest(init(987654321),{action:'save',product:{...p,active:false}}))).status,200);
 assert.equal((await (await ADMIN_GET(adminRequest(init()))).json()).products.find(x=>x.id===p.id).active,false);
 assert.equal((await ADMIN(adminRequest(init(),{action:'save',product:p}))).status,200);
});
test('Orders cannot omit name, phone, or delivery address',async()=>{
 for(const field of ['name','phone','address']){const r=await POST(req({...base,requestKey:crypto.randomUUID(),customer:{...base.customer,[field]:''}}));assert.equal(r.status,400,field)}
 assert.equal((await POST(req({...base,requestKey:crypto.randomUUID(),customer:{...base.customer,phone:'--------'}}))).status,400);
});
test('A changed bottle label is rejected even if its price is unchanged',async()=>{const r=await POST(req({...base,requestKey:crypto.randomUUID(),items:[{id:'11078',variant:0,quantity:1,expectedLabel:'Different bottle'}]}));assert.equal(r.status,409)});
test('Store settings persist for verified staff, reject unsafe links and stay free of credentials',async()=>{const before=(await (await ADMIN_GET(adminRequest(init()))).json()).settings;const updated={...before,phone:'+998901234567'};
 assert.equal((await ADMIN(adminRequest(init(555555555),{action:'settings',settings:updated}))).status,401);
 assert.equal((await ADMIN(adminRequest(init(),{action:'settings',settings:{...updated,managerUrl:'https://example.com/steal'}}))).status,400);
 assert.equal((await ADMIN(adminRequest(init(987654321),{action:'settings',settings:updated}))).status,200);
 assert.equal((await (await ADMIN_GET(adminRequest(init()))).json()).settings.phone,updated.phone);
 assert.equal((await ADMIN(adminRequest(init(),{action:'settings',settings:before}))).status,200);
});
