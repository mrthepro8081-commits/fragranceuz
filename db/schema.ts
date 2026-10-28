import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const productOverrides = sqliteTable('product_overrides', {
 id:text('id').primaryKey(), data:text('data').notNull(), updatedAt:text('updated_at').notNull()
});
export const orders = sqliteTable('orders', {
 id:text('id').primaryKey(), userId:text('user_id').notNull(), requestKey:text('request_key').notNull(),
 data:text('data').notNull(), total:integer('total').notNull(), status:text('status').notNull().default('new'),
 notification:text('notification').notNull().default('pending'), createdAt:text('created_at').notNull()
},table=>[uniqueIndex('orders_idempotency').on(table.userId,table.requestKey)]);
export const storeSettings = sqliteTable('store_settings', {
 id:text('id').primaryKey(), data:text('data').notNull(), updatedAt:text('updated_at').notNull()
});
export const demoProductOverrides = sqliteTable('demo_product_overrides', {
 id:text('id').primaryKey(),data:text('data').notNull(),updatedAt:text('updated_at').notNull()
});
export const demoStoreSettings = sqliteTable('demo_store_settings', {
 id:text('id').primaryKey(),data:text('data').notNull(),updatedAt:text('updated_at').notNull()
});
