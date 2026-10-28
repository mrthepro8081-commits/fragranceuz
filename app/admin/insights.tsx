'use client';
import {Download,Loader2} from 'lucide-react';
import {useState} from 'react';
import {translate,formatMoney,formatDate,type Language} from '../../lib/i18n';
import type {StoreStats,CustomerRecord} from '../../lib/types';
export function Statistics({statistics,lang}:{statistics:StoreStats|null;lang:Language}){
 const t=(key:string)=>translate(key,lang);if(!statistics)return null;
 const cards=[['All submitted requests',statistics.totalOrders],['New requests',statistics.newOrders],['Customers',statistics.customers],['Completed orders',statistics.completedOrders],['Requested product value',formatMoney(statistics.requestValue,lang)],['Completed order value',formatMoney(statistics.completedValue,lang)]] as const;
 return <section><div className="statistics-grid">{cards.map(([label,value],i)=><article className={'stat-card '+(i>3?'money-stat':'')} key={label}><span>{t(label)}</span><strong>{value}</strong></article>)}</div><h2 style={{fontSize:23}}>{t('Order status overview')}</h2><div className="status-summary">{(['new','confirmed','completed','cancelled'] as const).map(status=><div key={status}><span>{t('status.'+status)}</span><strong>{statistics[`${status}Orders`]}</strong></div>)}</div><p className="analytics-note">{t('Requests are not confirmed payments. Completed order value follows the status set by the store.')}</p></section>;
}
export function Customers({customers,lang,download,exporting}:{customers:CustomerRecord[];lang:Language;download:()=>void;exporting:boolean}){
 const [search,setSearch]=useState('');const t=(key:string)=>translate(key,lang);
 const query=search.trim().toLocaleLowerCase();const list=customers.filter(c=>`${c.name} ${c.phone} ${c.address} ${c.key}`.toLocaleLowerCase().includes(query));
 return <section><div className="customer-toolbar"><h2>{t('Customer database')} ({customers.length})</h2><button className="primary" onClick={download} disabled={exporting}>{exporting?<Loader2 className="spin" size={17}/>:<Download size={17}/>} {t(exporting?'Preparing PDF…':'Download customer PDF')}</button></div><p className="customer-note">{t('Customers appear after an order request is submitted. The PDF includes names, phones, addresses and order history totals.')}</p><input className="customer-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('Find a customer')} aria-label={t('Find a customer')}/>{list.length?<div className="customer-list">{list.map(c=><article key={c.key} className="customer-card"><h3>{c.name}</h3><a href={'tel:'+c.phone}>{c.phone}</a><p>{c.address}</p><div className="customer-totals"><span>{t('Order requests')}: <strong>{c.orders}</strong></span><span>{t('Requested product value')}: <strong>{formatMoney(c.requestValue,lang)}</strong></span><span>{t('Last request')}: <strong>{formatDate(c.lastOrderAt,lang)}</strong></span></div></article>)}</div>:<div className="empty"><p>{t(customers.length?'No matching customers.':'No customers yet.')}</p></div>}</section>;
}
