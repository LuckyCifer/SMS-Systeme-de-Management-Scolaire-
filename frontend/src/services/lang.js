let _lang = localStorage.getItem('sms_lang') || 'fr';

export const setLang = (l) => { _lang = l; };
export const getLang = () => _lang;
