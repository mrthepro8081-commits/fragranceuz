import { sqliteTable, text, integer, blob, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';
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
// Photos saved from channel posts or uploaded in the admin, so catalog images never depend on Telegram's CDN links.
export const productImages = sqliteTable('product_images', {
 key:text('key').primaryKey(), contentType:text('content_type').notNull(), data:blob('data').notNull(), updatedAt:text('updated_at').notNull()
});
// Products deleted in the admin. Seed products cannot be removed from data/products.json, so deletion is recorded here.
export const productRemovals = sqliteTable('product_removals', {
 key:text('key').primaryKey(), removedAt:text('removed_at').notNull()
});
// Anonymous daily counters per product (no personal data): how often it was opened and added to the bag.
export const productEvents = sqliteTable('product_events', {
 day:text('day').notNull(), productId:text('product_id').notNull(), views:integer('views').notNull().default(0), adds:integer('adds').notNull().default(0)
},table=>[primaryKey({columns:[table.day,table.productId]})]);
