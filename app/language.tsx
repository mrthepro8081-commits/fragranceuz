'use client';
import {createContext,useContext,useEffect,useState} from 'react';
import {translate,type Language} from '../lib/i18n';
type LanguageState={lang:Language;setLang:(next:Language)=>void;t:(key:string)=>string};
const LanguageContext=createContext<LanguageState|null>(null);
export function LanguageProvider({children}:{children:React.ReactNode}){
 const [lang,setLanguage]=useState<Language>('ru');
 useEffect(()=>{let saved:string|null=null;try{saved=localStorage.getItem('fragranceuz-language')}catch{};const tgLang=(window.Telegram?.WebApp as unknown as {initDataUnsafe?:{user?:{language_code?:string}}})?.initDataUnsafe?.user?.language_code;const selected=saved==='uz'||saved==='ru'?saved:tgLang?.startsWith('uz')?'uz':'ru';setLanguage(selected);document.documentElement.lang=selected;},[]);
 useEffect(()=>{document.title=lang==='ru'?'Fragrance UZ — Ваш особенный аромат':'Fragrance UZ — Sizga xos ifor';},[lang]);
 function setLang(next:Language){setLanguage(next);document.documentElement.lang=next;try{localStorage.setItem('fragranceuz-language',next)}catch{}}
 return <LanguageContext.Provider value={{lang,setLang,t:(key:string)=>translate(key,lang)}}>{children}</LanguageContext.Provider>;
}
export function useLanguage(){const context=useContext(LanguageContext);if(!context)throw new Error('LanguageProvider is required');return context}
export function LanguageSwitch({lang,setLang}:{lang:Language;setLang:(next:Language)=>void}){return <div className="language-switch" role="group" aria-label={translate('Language',lang)}><button type="button" lang="ru" aria-pressed={lang==='ru'} className={lang==='ru'?'active':''} onClick={()=>setLang('ru')}>RU</button><span>/</span><button type="button" lang="uz" aria-pressed={lang==='uz'} className={lang==='uz'?'active':''} onClick={()=>setLang('uz')}>O‘Z</button></div>}
