import type {Metadata} from 'next';
import './globals.css';
import {LanguageProvider} from './language';
export const metadata:Metadata={title:'Fragrance UZ — Ваш особенный аромат',description:'Коллекция ароматов @fragranceuz. Подробности на Fragrantica, выбор аромата и заявка на заказ в Telegram.',icons:{icon:'/brand/fragranceuz-gold.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ru" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:`try{var t=localStorage.getItem('fragranceuz-theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch{}`}}/><script src="https://telegram.org/js/telegram-web-app.js?64" /></head><body><LanguageProvider>{children}</LanguageProvider></body></html>}
