import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {createHmac} from 'node:crypto';import fs from 'node:fs';
const sql=new DatabaseSync(':memory:');for(const f of ['0000_curved_maginty','0001_jittery_ricochet','0003_product_images_and_removals'])sql.exec(fs.readFileSync(new URL(`../drizzle/${f}.sql`,import.meta.url),'utf8'));
const stmt=(query,args=[])=>({bind(...v){return stmt(query,v)},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){return {meta:{changes:sql.prepare(query).run(...args).changes}}}});
const DB={prepare:q=>stmt(q),async batch(list){for(const s of list)await s.run()}};
const token='000000:test-only-never-a-real-bot';
globalThis.__TEST_ENV={DB,TELEGRAM_BOT_TOKEN:token,OWNER_TELEGRAM_ID:'123456789'};
const {POST:ADMIN}=await import('../.sites-runtime/tests/admin.mjs');const {GET:STORE}=await import('../.sites-runtime/tests/store.mjs');const {GET:IMAGE}=await import('../.sites-runtime/tests/images-[id].mjs');
function init(id=123456789){const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Owner'})});const secret=createHmac('sha256','WebAppData').update(token).digest();p.set('hash',createHmac('sha256',secret).update([...p].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('\n')).digest('hex'));return p.toString()}
const admin=(body,id)=>ADMIN(new Request('http://localhost/api/admin',{method:'POST',headers:{'Content-Type':'application/json','x-telegram-init-data':init(id)},body:JSON.stringify(body)}));
const shop=async()=>(await (await STORE(new Request('http://localhost/api/store'))).json()).products;
const seed=JSON.parse(fs.readFileSync(new URL('../data/products.json',import.meta.url),'utf8'));const valaya=seed.find(p=>p.id==='11078');
const JPEG=Uint8Array.from([0xff,0xd8,0xff,0xe0,1,2,3,4,0xff,0xd9]);

test('Delete needs confirmation and an authorized owner, hides the product everywhere and a re-import restores it',async()=>{
 assert.equal((await admin({action:'delete',id:'11078'})).status,400);
 assert.equal((await admin({action:'delete',id:'11078',confirmed:true},555)).status,401);
 assert.equal((await admin({action:'delete',id:'99999',confirmed:true})).status,404);
 assert.equal((await admin({action:'delete',id:'11078',confirmed:true})).status,200);
 assert.ok(!(await shop()).some(p=>p.id==='11078'));
 assert.equal((await admin({action:'save',confirmed:true,product:valaya})).status,200);
 assert.ok((await shop()).some(p=>p.id==='11078'));
});
test('Confirmed price changes reach the storefront',async()=>{
 const product={...valaya,variants:[{...valaya.variants[0],price:2990000}]};
 assert.equal((await admin({action:'save',confirmed:true,product})).status,200);
 assert.equal((await shop()).find(p=>p.id==='11078').variants[0].price,2990000);
});
test('Channel photos are kept on our side and uploaded photos replace them',async()=>{
 const realFetch=globalThis.fetch;
 globalThis.fetch=async url=>/telesco\.pe/.test(String(url))?new Response(JPEG,{headers:{'content-type':'image/jpeg'}}):realFetch(url);
 try{
  const imported={...valaya,id:'11200',sourceUrl:'https://t.me/fragranceuz/11200',image:'https://cdn4.telesco.pe/file/test.jpg',photoSource:'https://cdn4.telesco.pe/file/test.jpg'};
  const saved=await (await admin({action:'save',confirmed:true,product:imported})).json();
  assert.match(saved.product.image,/^\/api\/images\/11200\?v=\d+$/);
  const served=await IMAGE(new Request('http://localhost'+saved.product.image));
  assert.equal(served.status,200);assert.equal(served.headers.get('content-type'),'image/jpeg');assert.deepEqual(new Uint8Array(await served.arrayBuffer()),JPEG);
  const upload='data:image/png;base64,'+Buffer.from('PNGDATA').toString('base64');
  const replaced=await (await admin({action:'save',confirmed:true,product:saved.product,imageUpload:upload})).json();
  assert.equal((await IMAGE(new Request('http://localhost'+replaced.product.image))).headers.get('content-type'),'image/png');
  assert.equal((await admin({action:'save',confirmed:true,product:{...saved.product,image:'javascript:alert(1)'}})).status,400);
 }finally{globalThis.fetch=realFetch}
});
test('Photo URLs only resolve to stored product photos',async()=>{
 assert.equal((await IMAGE(new Request('http://localhost/api/images/../../etc'))).status,404);
 assert.equal((await IMAGE(new Request('http://localhost/api/images/424242'))).status,404);
});
