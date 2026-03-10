import { createI18n } from 'vue-i18n'
import de from '../locales/de.json'
import en from '../locales/en.json'
import fr from '../locales/fr.json'

const i18n = createI18n({
  legacy: false,
  locale: 'de',
  fallbackLocale: 'de',
  messages: { de, en, fr },
})

export default i18n
