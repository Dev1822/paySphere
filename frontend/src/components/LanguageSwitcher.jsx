import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'EN', flag: '🇺🇸', name: 'English' },
  { code: 'es', label: 'ES', flag: '🇪🇸', name: 'Español' },
  { code: 'fr', label: 'FR', flag: '🇫🇷', name: 'Français' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const rawLang = (i18n.language || 'en').split('-')[0];
  const currentLang = LANGUAGES.some((l) => l.code === rawLang) ? rawLang : 'en';

  const handleChange = (e) => {
    i18n.changeLanguage(e.target.value);
  };

  const activeLangObj = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];

  return (
    <div className="relative flex items-center">
      <label htmlFor="language-select" className="sr-only">
        Select Language
      </label>
      <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors shadow-sm focus-within:ring-2 focus-within:ring-blue-500">
        <span className="text-sm leading-none" role="img" aria-hidden="true">
          {activeLangObj.flag}
        </span>
        <select
          id="language-select"
          value={currentLang}
          onChange={handleChange}
          aria-label="Select Language"
          className="bg-transparent font-bold uppercase tracking-wider text-xs focus:outline-none cursor-pointer text-gray-700 dark:text-slate-300 pr-1"
        >
          {LANGUAGES.map((lang) => (
            <option
              key={lang.code}
              value={lang.code}
              className="bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200"
            >
              {lang.flag} {lang.label} ({lang.name})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
