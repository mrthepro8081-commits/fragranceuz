import type {CustomerRecord,StoreStats} from './types';
// Contacts are derived from submitted, durable orders. Merely typing a form
// never creates a customer record. Phone formatting does not duplicate clients.
export const phoneKey=["' '","'+'","'-'","'('","')'","char(9)","char(10)","char(13)","char(160)","char(8239)"].reduce((sql,char)=>`replace(${sql},${char},'')`,"json_extract(data,'$.customer.phone')");
export async function customerRecords(db:D1Database):Promise<CustomerRecord[]>{
 const rows=await db.prepare(`WITH contacts AS (
 SELECT ${phoneKey} AS key,
 json_extract(data,'$.customer.name') AS name,
 json_extract(data,'$.customer.phone') AS phone,
 json_extract(data,'$.customer.address') AS address,
 COUNT(*) OVER(PARTITION BY ${phoneKey}) AS orders,
 SUM(CASE WHEN status!='cancelled' THEN total ELSE 0 END) OVER(PARTITION BY ${phoneKey}) AS requestValue,
 SUM(CASE WHEN status='completed' THEN total ELSE 0 END) OVER(PARTITION BY ${phoneKey}) AS completedValue,
 MIN(created_at) OVER(PARTITION BY ${phoneKey}) AS firstOrderAt,
 MAX(created_at) OVER(PARTITION BY ${phoneKey}) AS lastOrderAt,
 ROW_NUMBER() OVER(PARTITION BY ${phoneKey} ORDER BY created_at DESC,id DESC) AS position
 FROM orders)
 SELECT key,name,phone,address,orders,requestValue,completedValue,firstOrderAt,lastOrderAt
 FROM contacts WHERE position=1 ORDER BY lastOrderAt DESC,key`).all<CustomerRecord>();
 return rows.results;
}
export async function storeStats(db:D1Database):Promise<StoreStats>{
 const row=await db.prepare(`SELECT COUNT(*) AS totalOrders,
 COALESCE(SUM(status='new'),0) AS newOrders,
 COALESCE(SUM(status='confirmed'),0) AS confirmedOrders,
 COALESCE(SUM(status='completed'),0) AS completedOrders,
 COALESCE(SUM(status='cancelled'),0) AS cancelledOrders,
 COALESCE(SUM(CASE WHEN status!='cancelled' THEN total ELSE 0 END),0) AS requestValue,
 COALESCE(SUM(CASE WHEN status='completed' THEN total ELSE 0 END),0) AS completedValue,
 COUNT(DISTINCT ${phoneKey}) AS customers FROM orders`).first<StoreStats>();
 return row!;
}
