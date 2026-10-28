export type Variant = {label:string;volume:number;price:number};
export type Product = {
 id:string;title:string;name:string;brand:string;variants:Variant[];gender:string;concentration:string|null;
 country:string|null;year:string|null;fragranticaUrl:string|null;sourceUrl:string;sourceDate:string|null;
 importedAt:string;photoSource:string|null;image:string|null;active:boolean;sourceText:string;
};
export type CartItem = {id:string;variant:number;quantity:number;expectedLabel?:string};
export type OrderData = {language?:'ru'|'uz';customer:{name:string;phone:string;address:string;note:string};items:{id:string;name:string;brand:string;label:string;price:number;quantity:number;sourceUrl:string}[];telegram:{id:number;username?:string};total:number};
export type StoreStats={totalOrders:number;newOrders:number;confirmedOrders:number;completedOrders:number;cancelledOrders:number;requestValue:number;completedValue:number;customers:number};
export type CustomerRecord={key:string;name:string;phone:string;address:string;orders:number;requestValue:number;completedValue:number;firstOrderAt:string;lastOrderAt:string};
