/** Uzbekistan is the default; explicitly entered international numbers remain supported. */
export function phoneEntry(value:string){
 const clean=value.replace(/[^\d+\s()\-]/g,'');
 const digits=clean.replace(/\D/g,'');
 if(!digits)return '+998 ';
 if(digits.startsWith('998998')&&digits.length>12)return '+998 '+digits.slice(6);
 if(digits.startsWith('998'))return '+998 '+digits.slice(3);
 if(!clean.trim().startsWith('+')&&digits.length===9)return '+998 '+digits;
 return clean;
}
export function canonicalPhone(value:string){
 const digits=value.replace(/\D/g,'');
 if(!value.trim().startsWith('+')&&digits.length===9)return '+998'+digits;
 return '+'+digits;
}
export function validPhone(value:string){
 if(!/^[+\d\s()\-]+$/.test(value.trim())||/\+.*\+/.test(value)||/\d\s*\+/.test(value))return false;
 const phone=canonicalPhone(value);
 return phone.startsWith('+998')?/^\+998\d{9}$/.test(phone):/^\+[1-9]\d{6,14}$/.test(phone);
}
