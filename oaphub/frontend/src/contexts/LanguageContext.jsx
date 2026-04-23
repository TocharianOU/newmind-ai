import { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext(null);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem('language');
    // Only support 'en' and 'zh', default to 'en'
    return savedLanguage === 'zh' ? 'zh' : 'en';
  });

  const [translations, setTranslations] = useState({});

  // Load translations based on language
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        let translationPromise;
        
        // Load appropriate translation file
        if (language === 'zh') {
          translationPromise = import('../locales/zh.json');
        } else {
          translationPromise = import('../locales/en.json');
        }
        
        const module = await translationPromise;
        setTranslations(module.default || module);
      } catch (error) {
        console.warn(`Failed to load translations for ${language}:`, error);
        // Fallback to English on error
        try {
          const fallbackModule = await import('../locales/en.json');
          setTranslations(fallbackModule.default || fallbackModule);
        } catch (fallbackError) {
          console.error('Failed to load fallback translations:', fallbackError);
          setTranslations({});
        }
      }
    };

    loadTranslations();
  }, [language]);

  const changeLanguage = (newLanguage) => {
    // Only allow 'en' or 'zh'
    const validLanguage = newLanguage === 'zh' ? 'zh' : 'en';
    setLanguage(validLanguage);
    localStorage.setItem('language', validLanguage);
  };

  // Translation function that supports nested keys (e.g., 'settings.title')
  const t = (key, fallback = key) => {
    if (!key) return fallback;
    
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return fallback;
      }
    }
    
    return value !== undefined && value !== null ? value : fallback;
  };

  const value = {
    language,
    changeLanguage,
    t,
    translations
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
