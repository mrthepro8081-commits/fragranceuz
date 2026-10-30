'use client';
import { useState } from 'react';
import { Check, Copy, ExternalLink, FileSpreadsheet, Link2, RefreshCw, Unplug } from 'lucide-react';
import scriptSource from '../../google-sheets/Code.gs?raw';
import { useLanguage } from '../language';
import type { AdminChange } from './confirm';

/** Settings card that links the shop to the owner's Google Sheet (google-sheets/Code.gs). */
export function SheetsCard({ demo, busy, sheets, ask, orders }: {
  demo: boolean;
  busy: boolean;
  sheets: { connected: boolean; hint: string | null; doc?: string | null };
  ask: (change: AdminChange) => void;
  orders: number;
}) {
  const { t } = useLanguage();
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  async function copyScript() {
    try {
      await navigator.clipboard.writeText(scriptSource);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setManual(true);
    }
  }
  return (
    <section className="ba-panel">
      <article className="ba-sheets">
        <header>
          <span className="ba-sheets-icon"><FileSpreadsheet size={22} /></span>
          <div>
            <h3>{t('Google Sheet of clients')}</h3>
            <span className={'ba-chip ' + (sheets.connected ? 'status-completed' : '')}>{t(sheets.connected ? 'Connected' : 'Not connected')}</span>
          </div>
        </header>
        <p className="b-fine">{t('Every client and order request is written to your own Google Sheet: a «Клиенты» tab with contacts and totals and a «Заявки» tab with every request.')}</p>

        {demo ? (
          <p className="ba-note">{t('Available after launch: the demo does not send real client data anywhere.')}</p>
        ) : sheets.connected ? (
          <>
            <p className="ba-sheets-link"><Link2 size={15} />{sheets.hint}</p>
            <div className="ba-form-actions">
              <button className="b-buy" disabled={busy} onClick={() => ask({ action: 'sheets-sync', orders })}>
                <RefreshCw size={17} />
                <span>{t('Upload all clients')}</span>
              </button>
              <button className="b-buy ghost" disabled={busy} onClick={() => ask({ action: 'sheets-save', link: null })} aria-label={t('Disconnect')}>
                <Unplug size={17} />
              </button>
            </div>
          </>
        ) : (
          <>
            <ol className="ba-steps">
              {sheets.doc ? (
                <li>
                  {t('Open your client sheet on a computer or in the browser (desktop version).')}
                  <a className="b-text-btn" href={sheets.doc} target="_blank" rel="noreferrer"><ExternalLink size={14} />{t('Open the sheet')}</a>
                </li>
              ) : (
                <li>
                  {t('Open a new Google Sheet on your account and name it, e.g. «Fragrance UZ — клиенты».')}
                  <a className="b-text-btn" href="https://sheets.new" target="_blank" rel="noreferrer"><ExternalLink size={14} />sheets.new</a>
                </li>
              )}
              <li>
                {t('In the sheet: Extensions → Apps Script. Delete what is there and paste the script.')}
                <button className="b-text-btn" onClick={copyScript}>{copied ? <Check size={14} /> : <Copy size={14} />}{t(copied ? 'Script copied' : 'Copy the script')}</button>
                {manual && <textarea className="ba-script" readOnly value={scriptSource} onFocus={(e) => e.currentTarget.select()} aria-label={t('Copy the script')} />}
              </li>
              <li>{t('Save, reload the sheet, then menu Fragrance UZ → «1. Подготовить таблицу» and allow access.')}</li>
              <li>{t('Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone. Deploy.')}</li>
              <li>{t('Menu Fragrance UZ → «2. Показать ссылку для магазина», copy the link and paste it below.')}</li>
            </ol>
            <label className="b-field">
              <span>{t('Link for the shop')}</span>
              <input id="sheets-link" value={link} onChange={(e) => setLink(e.target.value.trim())} placeholder="https://script.google.com/macros/s/…/exec?key=…" autoComplete="off" />
            </label>
            <button className="b-buy" disabled={busy || !link} onClick={() => ask({ action: 'sheets-save', link })}>
              <span>{t('Connect')}</span>
            </button>
          </>
        )}
      </article>
    </section>
  );
}
