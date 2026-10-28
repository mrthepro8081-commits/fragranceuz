'use client';
import {useEffect,useState} from 'react';
import {Save,Loader2} from 'lucide-react';
import {settingsInput,type StoreSettings} from '../../lib/settings';
import {useLanguage} from '../language';
export function ShopSettings({settings,save,busy,onDirtyChange}:{settings:StoreSettings;save:(settings:StoreSettings)=>Promise<boolean>;busy:boolean;onDirtyChange:(value:boolean)=>void}){
 const {t}=useLanguage();const [draft,setDraft]=useState(settings);const [error,setError]=useState('');const dirty=JSON.stringify(settings)!==JSON.stringify(draft);
 useEffect(()=>setDraft(settings),[settings]);
 useEffect(()=>onDirtyChange(dirty),[dirty,onDirtyChange]);
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault()};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty]);
 const fields=[['phone','Store phone'],['managerUrl','Manager Telegram link'],['channelUrl','Telegram channel link'],['decantsUrl','Decants channel link'],['instagramUrl','Instagram profile link'],['reviewsUrl','Customer reviews link']] as const;
 return <form className="shop-settings" onSubmit={async e=>{e.preventDefault();setError('');const parsed=settingsInput.safeParse(draft);if(!parsed.success){setError('Use a full international phone number and valid Telegram or Instagram profile links.');return}await save(parsed.data)}}><h2>{t('Store settings')}</h2><p>{t('These public contacts appear in the storefront and order drafts.')}</p><fieldset disabled={busy}>{fields.map(([key,label])=><label key={key}>{t(label)}<input required type={key==='phone'?'tel':'url'} autoComplete="off" value={draft[key]} onChange={e=>setDraft(s=>({...s,[key]:e.target.value.trim()}))}/></label>)}<label className="check-label"><input type="checkbox" checked={draft.freeTashkentDelivery} onChange={e=>setDraft(s=>({...s,freeTashkentDelivery:e.target.checked}))}/>{t('Free and quick delivery in Tashkent')}</label></fieldset>{error&&<p className="error-message" role="alert">{t(error)}</p>}<div className="editor-actions"><button type="button" className="secondary" disabled={busy||!dirty} onClick={()=>setDraft(settings)}>{t('Cancel')}</button><button className="primary" disabled={busy||!dirty}>{busy?<Loader2 size={18} className="spin"/>:<Save size={18}/>} {t('Save settings')}</button></div></form>
}
