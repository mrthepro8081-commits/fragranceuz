import {z} from 'zod';
const telegram=z.string().url().refine(value=>/^https:\/\/t\.me\/[a-zA-Z0-9_]{5,32}$/.test(value));
export const settingsInput=z.object({phone:z.string().regex(/^\+[1-9]\d{6,14}$/),managerUrl:telegram,channelUrl:telegram,decantsUrl:telegram,instagramUrl:z.string().url().refine(value=>/^https:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?$/.test(value)),reviewsUrl:telegram,freeTashkentDelivery:z.boolean()});
export type StoreSettings=z.infer<typeof settingsInput>;
export const defaultSettings:StoreSettings={phone:'+998977819444',managerUrl:'https://t.me/fragranceuz1',channelUrl:'https://t.me/fragranceuz',decantsUrl:'https://t.me/parfbarfragranceuz',instagramUrl:'https://www.instagram.com/fragrance_uz_/',reviewsUrl:'https://t.me/otzivifragranceuz',freeTashkentDelivery:true};
export function socialHandle(url:string){return '@'+new URL(url).pathname.split('/').filter(Boolean)[0]}
