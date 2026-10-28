import test from 'node:test';import assert from 'node:assert/strict';
import {composeOrderDraft} from '../.sites-runtime/tests/checkout.mjs';
const customer={name:'Test Customer',phone:'+998901234567',address:'Test city, test street, 10',note:'Test note'};
const lines=[{name:'Valaya',brand:'Parfums de Marly',label:'75 мл',price:3120000,quantity:2}];
test('Manual Telegram checkout includes name, phone, address and complete pricing in both languages',()=>{for(const lang of ['ru','uz']){const draft=composeOrderDraft(customer,lines,lang);for(const text of [customer.name,customer.phone,customer.address,customer.note,'Valaya','6\u00a0240\u00a0000'])assert.ok(draft.includes(text),text);assert.match(draft,lang==='ru'?/Адрес доставки/:/Yetkazib berish manzili/);assert.match(draft,lang==='ru'?/Номер телефона/:/Telefon raqami/)}});
const {phoneEntry,canonicalPhone,validPhone}=await import('../.sites-runtime/tests/phone.mjs');
const {customerInput}=await import('../.sites-runtime/tests/validation.mjs');
test('Phone defaults and pasted Uzbek numbers normalize without duplicate country codes',()=>{
 assert.equal(phoneEntry(''),'+998 ');assert.equal(phoneEntry('901234567'),'+998 901234567');assert.equal(phoneEntry('998901234567'),'+998 901234567');assert.equal(phoneEntry('+998 998901234567'),'+998 901234567');
 for(const input of ['901234567','998901234567','+998 (90) 123-45-67']){assert.ok(validPhone(input));assert.equal(canonicalPhone(input),'+998901234567');assert.equal(customerInput.parse({...customer,phone:input}).phone,'+998901234567')}
 for(const input of ['+998','+998 90123','+998 9012345678','abc','++998901234567','998+901234567'])assert.equal(validPhone(input),false,input);
 assert.ok(validPhone('+44 7700 900123'));assert.equal(canonicalPhone('+44 7700 900123'),'+447700900123');
});
