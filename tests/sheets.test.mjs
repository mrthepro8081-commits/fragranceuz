import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {createHmac} from 'node:crypto';import {createRequire} from 'node:module';import fs from 'node:fs';
/* ---------- the Apps Script logic, against a small in-memory spreadsheet ---------- */
const require=createRequire(import.meta.url);
const tmp=new URL('../.sites-runtime/tests/Code.cjs',import.meta.url);fs.copyFileSync(new URL('../google-sheets/Code.gs',import.meta.url),tmp);
const {handle}=require(tmp.pathname);
function book(){const sheets={};const b={getSheetByName:n=>sheets[n]||null,insertSheet:n=>(sheets[n]=sheet(n,b)),sheets};return b}
function sheet(name,parent){const cells=[];const s={cells,getName:()=>name,getParent:()=>parent,setFrozenRows(){},
 getLastRow(){for(let i=cells.length-1;i>=0;i--)if(cells[i]&&cells[i].some(v=>v!==''&&v!==undefined))return i+1;return 0},
 getRange(r,c,nr,nc){const range={setValues(v){for(let i=0;i<nr;i++){cells[r-1+i]=cells[r-1+i]||[];for(let j=0;j<nc;j++)cells[r-1+i][c-1+j]=v[i][j]}return range},
  getValues(){return Array.from({length:nr},(_,i)=>Array.from({length:nc},(_,j)=>cells[r-1+i]?.[c-1+j]??''))},
  clearContent(){for(let i=0;i<nr;i++)if(cells[r-1+i])for(let j=0;j<nc;j++)cells[r-1+i][c-1+j]='';return range},
  setFontWeight:()=>range,setBackground:()=>range,setFontColor:()=>range,setNumberFormat:()=>range};return range}};return s}
const rows=(b,n)=>{const s=b.getSheetByName(n);return s.cells.slice(1,s.getLastRow())};
const order=(id,phone,total,status='new',at='2026-10-20T10:00:00Z',name='Aziz Karimov')=>({id,createdAt:at,status,data:{language:'uz',total,customer:{name,phone,address:'Toshkent, Yunusobod',note:''},telegram:{id:5,username:'aziz'},items:[{id:'11078',name:'VALAYA',brand:'Parfums de Marly',label:'75 мл',price:total,quantity:1}]}});
test('Sheet keeps one row per request and one row per client by phone',()=>{
 const b=book();
 handle(b,{event:'order',order:order('aaaaaaaa-0000-4000-8000-000000000001','+998901234567',3120000)});
 handle(b,{event:'order',order:order('aaaaaaaa-0000-4000-8000-000000000001','+998901234567',3120000,'completed')});
 handle(b,{event:'order',order:order('bbbbbbbb-0000-4000-8000-000000000002','+998 90 123 45 67',1500000,'new','2026-10-25T10:00:00Z')});
 handle(b,{event:'order',order:order('cccccccc-0000-4000-8000-000000000003','+998 90 123 45 67',900000,'cancelled','2026-10-26T10:00:00Z')});
 handle(b,{event:'order',order:order('dddddddd-0000-4000-8000-000000000004','+998935550000',660000,'new','2026-10-27T10:00:00Z','Dilnoza')});
 const o=rows(b,'Заявки');assert.equal(o.length,4);assert.equal(o[0][2],'Выполнена');assert.equal(o[0][12],'aaaaaaaa-0000-4000-8000-000000000001');
 const c=rows(b,'Клиенты');assert.equal(c.length,2);
 const aziz=c.find(r=>r[0]==='Aziz Karimov');assert.equal(aziz[4],3);assert.equal(aziz[5],3120000+1500000);assert.equal(aziz[6],3120000);assert.equal(aziz[9],'Отменена');
 assert.equal(c[0][0],'Dilnoza');
 assert.equal(rows(b,'Заявки')[0].length,13);
 const again=handle(b,{event:'bulk',orders:[order('dddddddd-0000-4000-8000-000000000004','+998935550000',660000,'confirmed','2026-10-27T10:00:00Z','Dilnoza')]});
 assert.equal(again.orders,4);assert.equal(rows(b,'Клиенты').length,2);
 assert.deepEqual(handle(b,{event:'test'}),{ok:true,orders:4});
});
/* ---------- the shop side ---------- */
const sql=new DatabaseSync(':memory:');for(const f of ['0000_curved_maginty','0001_jittery_ricochet','0003_product_images_and_removals','0004_product_events'])sql.exec(fs.readFileSync(new URL(`../drizzle/${f}.sql`,import.meta.url),'utf8'));
const stmt=(query,args=[])=>({bind(...v){return stmt(query,v)},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){return {meta:{changes:sql.prepare(query).run(...args).changes}}}});
const DB={prepare:q=>stmt(q),async batch(list){for(const s of list)await s.run()}};
const token='000000:test-only-never-a-real-bot';const OWNER='740597322';
globalThis.__TEST_ENV={DB,TELEGRAM_BOT_TOKEN:token,TELEGRAM_ORDER_CHAT_ID:OWNER,OWNER_TELEGRAM_ID:OWNER};
const LINK='https://script.google.com/macros/s/AKfycbx_test_deployment_id_123456/exec?key='+'a1'.repeat(32);
const sheetCalls=[];let sheetUp=true;
globalThis.fetch=async(url,init)=>{if(String(url).startsWith('https://script.google.com/')){if(!sheetUp)throw new Error('down');const body=JSON.parse(init.body);sheetCalls.push(body);return Response.json({ok:true,orders:body.orders?.length??1})}return Response.json({ok:true,result:{}})};
const {POST:ORDER}=await import('../.sites-runtime/tests/orders.mjs');const {POST:ADMIN,GET:ADMIN_GET}=await import('../.sites-runtime/tests/admin.mjs');const {GET:STORE}=await import('../.sites-runtime/tests/store.mjs');
function init(id){const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'T'})});const secret=createHmac('sha256','WebAppData').update(token).digest();p.set('hash',createHmac('sha256',secret).update([...p].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('\n')).digest('hex'));return p.toString()}
const admin=body=>ADMIN(new Request('https://shop.example/api/admin',{method:'POST',headers:{'Content-Type':'application/json','x-telegram-init-data':init(Number(OWNER))},body:JSON.stringify({confirmed:true,...body})}));
let customer=6000;const place=()=>ORDER(new Request('https://shop.example/api/orders',{method:'POST',headers:{'Content-Type':'application/json','x-telegram-init-data':init(++customer)},body:JSON.stringify({requestKey:crypto.randomUUID(),language:'ru',quotedTotal:3120000,customer:{name:'Aziz Karimov',phone:'+998901234567',address:'Ташкент, Юнусабад 4',note:''},items:[{id:'11078',variant:0,quantity:1}]})}));
test('Orders placed before the sheet is connected are uploaded later with "Upload all clients"',async()=>{
 assert.equal((await place()).status,201);assert.equal(sheetCalls.length,0);
 assert.equal((await admin({action:'sheets-sync'})).status,400);
 assert.equal((await admin({action:'sheets-save',link:'https://example.com/x'})).status,400);
 assert.equal((await admin({action:'sheets-save',link:LINK})).status,200);assert.equal(sheetCalls.at(-1).event,'test');
 const g=await (await ADMIN_GET(new Request('https://shop.example/api/admin',{headers:{'x-telegram-init-data':init(Number(OWNER))}}))).json();
 assert.equal(g.sheets.connected,true);assert.ok(!JSON.stringify(g).includes('key='));
 assert.ok(!JSON.stringify(await (await STORE(new Request('https://shop.example/api/store'))).json()).includes('script.google'));
 const sync=await (await admin({action:'sheets-sync'})).json();assert.equal(sync.sent,1);assert.equal(sheetCalls.at(-1).event,'bulk');assert.equal(sheetCalls.at(-1).orders[0].data.customer.phone,'+998901234567');
});
test('Every new request and status change is written to the sheet; a sheet outage never blocks an order',async()=>{
 sheetCalls.length=0;const r=await place();assert.equal(r.status,201);const {orderId}=await r.json();
 assert.equal(sheetCalls[0].event,'order');assert.equal(sheetCalls[0].order.id,orderId);assert.equal(sheetCalls[0].order.status,'new');assert.equal(sheetCalls[0].order.data.customer.address,'Ташкент, Юнусабад 4');
 assert.equal((await admin({action:'order-status',id:orderId,status:'confirmed'})).status,200);assert.equal(sheetCalls.at(-1).order.status,'confirmed');
 sheetUp=false;assert.equal((await place()).status,201);sheetUp=true;
 assert.equal((await admin({action:'sheets-save',link:null})).status,200);sheetCalls.length=0;assert.equal((await place()).status,201);assert.equal(sheetCalls.length,0);
});
