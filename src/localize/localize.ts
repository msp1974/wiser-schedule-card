import * as en from './languages/en.json';
import * as fr from './languages/fr.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const languages: any = {
  en: en,
  fr: fr,
};

export function localize(string: string, search = '', replace = ''): string {
  const lang = (localStorage.getItem('selectedLanguage') || 'en').replace(/['"]+/g, '').replace('-', '_');

  let translated: string;

  try {
    translated = string.split('.').reduce((o, i) => o[i], languages[lang]);
    if (!translated) translated = string.split('.').reduce((o, i) => o[i], languages['en']);
  } catch (e) {
    try {
      translated = string.split('.').reduce((o, i) => o[i], languages['en']);
    } catch (e) {
      translated = '';
    }
  }

  if (translated === undefined) translated = string.split('.').reduce((o, i) => o[i], languages['en']);

  if (search !== '' && replace !== '') {
    translated = translated.replace(search, replace);
  }
  return translated;
}
