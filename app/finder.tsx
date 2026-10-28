'use client';
import {useState} from 'react';
import {ArrowLeft,ArrowRight,Check,X} from 'lucide-react';
import type {Product} from '../lib/types';
import {concentrationGroup,withinBudget} from '../lib/catalog';
import {useLanguage} from './language';
export type FinderChoice={gender:string;budget:string;concentration:string};
export function FragranceFinder({products,apply,close}:{products:Product[];apply:(choice:FinderChoice)=>void;close:()=>void}){
 const {t}=useLanguage();const [step,setStep]=useState(0);const [choice,setChoice]=useState<FinderChoice>({gender:'all',budget:'',concentration:'all'});
 const fields=['gender','budget','concentration'] as const;
 const options=[[['all','Any audience'],['women','Women'],['men','Men'],['unisex','Unisex']],[['1000000','Up to 1 million'],['2500000','Up to 2.5 million'],['','No budget limit']],[['all','Any concentration'],['edt','Eau de Toilette (EDT)'],['edp','Eau de Parfum (EDP)'],['parfum','Parfum'],['extrait','Extrait de Parfum']]];
 const matches=products.filter(p=>(choice.gender==='all'||p.gender===choice.gender)&&withinBudget(p,choice.budget)&&(choice.concentration==='all'||concentrationGroup(p.concentration)===choice.concentration));
 return <div className="finder-content"><button className="close-button" onClick={close} aria-label={t('Close')}><X size={22}/></button><span className="eyebrow">{t('Find your fragrance')}</span><div className="finder-progress" aria-label={`${step+1} / 3`}>{[0,1,2].map(i=><span key={i} className={i<=step?'done':''}/>)}</div><h2>{t(['Who is it for?','Your preferred budget','Choose a concentration'][step])}</h2><p>{t(step===2?'Concentration describes the formula; longevity varies by fragrance.':'Choose what suits you. You can change these filters later.')}</p><div className="finder-options">{options[step].map(([value,label])=><button key={value} aria-pressed={choice[fields[step]]===value} className={choice[fields[step]]===value?'selected':''} onClick={()=>setChoice(c=>({...c,[fields[step]]:value}))}>{t(label)}{choice[fields[step]]===value&&<Check size={18}/>}</button>)}</div><div className="finder-actions">{step>0&&<button className="secondary" onClick={()=>setStep(s=>s-1)}><ArrowLeft size={17}/>{t('Back')}</button>}<button className="primary" onClick={()=>step<2?setStep(s=>s+1):apply(choice)}>{t(step<2?'Continue':'Show matching fragrances')}{step===2&&<span>({matches.length})</span>}<ArrowRight size={17}/></button></div>{step===2&&matches.length===0&&<p role="status">{t('No exact matches. Try a higher budget or any concentration.')}</p>}</div>
}
