import en from './en'
import ro from './ro'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

export type Lang = 'en' | 'ro'

const stored = localStorage.getItem('guestspot.lang')

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ro: { translation: ro },
  },
  lng: stored === 'ro' ? 'ro' : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export function setLang(lang: Lang) {
  localStorage.setItem('guestspot.lang', lang)
  void i18n.changeLanguage(lang)
}

export default i18n
