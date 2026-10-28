'use client';
import {useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
import {translate,type Language} from '../lib/i18n';
export function ThemeToggle({lang}:{lang:Language}){
 const [theme,setTheme]=useState<'light'|'dark'>('light');
 useEffect(()=>{
  const apply=()=>{const dark=document.documentElement.dataset.theme==='dark';setTheme(dark?'dark':'light');const color=dark?'#1e1b17':'#f3eadc';try{window.Telegram?.WebApp?.setHeaderColor?.(color);window.Telegram?.WebApp?.setBackgroundColor?.(color)}catch{}};
  apply();const observer=new MutationObserver(apply);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  const media=matchMedia('(prefers-color-scheme: dark)');const system=()=>{try{if(!localStorage.getItem('fragranceuz-theme'))document.documentElement.dataset.theme=media.matches?'dark':'light'}catch{}};media.addEventListener('change',system);
  return()=>{observer.disconnect();media.removeEventListener('change',system)};
 },[]);
 function toggle(){const next=theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;setTheme(next);try{localStorage.setItem('fragranceuz-theme',next)}catch{}}
 return <button className="theme-toggle" type="button" onClick={toggle} aria-label={translate(theme==='dark'?'Use light mode':'Use dark mode',lang)} title={translate(theme==='dark'?'Use light mode':'Use dark mode',lang)}>{theme==='dark'?<Sun size={20}/>:<Moon size={20}/>}</button>;
}

export function ThemePreference({lang}:{lang:Language}){
 const [preference,setPreference]=useState('system');
 useEffect(()=>{try{setPreference(localStorage.getItem('fragranceuz-theme')||'system')}catch{}},[]);
 function choose(value:string){setPreference(value);try{if(value==='system')localStorage.removeItem('fragranceuz-theme');else localStorage.setItem('fragranceuz-theme',value)}catch{}document.documentElement.dataset.theme=value==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):value}
 return <fieldset className="theme-preference"><legend>{translate('Appearance',lang)}</legend>{[['light','Light'],['dark','Dark'],['system','System']].map(([value,label])=><button type="button" key={value} aria-pressed={preference===value} className={preference===value?'selected':''} onClick={()=>choose(value)}>{translate(label,lang)}</button>)}</fieldset>;
}
