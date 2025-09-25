import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all language files
function getLocaleFiles() {
  const localesPath = path.join(path.dirname(__dirname), 'src', 'locales');
  return fs.readdirSync(localesPath)
    .filter(file => fs.statSync(path.join(localesPath, file)).isDirectory())
    .map(dir => ({
      lang: dir,
      path: path.join(localesPath, dir, 'translation.json')
    }));
}

// Recursively get all keys
function getAllKeys(obj, prefix = '') {
  return Object.keys(obj).reduce((keys, key) => {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      return [...keys, ...getAllKeys(obj[key], newKey)];
    }
    return [...keys, newKey];
  }, []);
}

// Main check function
function checkLocales() {
  const localeFiles = getLocaleFiles();
  const translations = {};
  const allKeys = new Set();

  // Read all translation files
  localeFiles.forEach(({ lang, path }) => {
    try {
      const content = JSON.parse(fs.readFileSync(path, 'utf8'));
      translations[lang] = content;
      getAllKeys(content).forEach(key => allKeys.add(key));
    } catch (error) {
      console.error(`Error reading ${lang} translation file:`, error);
    }
  });

  // Check keys for each language
  let hasErrors = false;
  for (const lang of Object.keys(translations)) {
    const langKeys = getAllKeys(translations[lang]);
    const missingKeys = [...allKeys].filter(key => !langKeys.includes(key));
    const extraKeys = langKeys.filter(key => !allKeys.has(key));

    if (missingKeys.length > 0 || extraKeys.length > 0) {
      hasErrors = true;
      console.log(`\n=== Check Results for ${lang} ===`);
      if (missingKeys.length > 0) {
        console.log('Missing keys:');
        missingKeys.forEach(key => console.log(`  - ${key}`));
      }
      if (extraKeys.length > 0) {
        console.log('Extra keys:');
        extraKeys.forEach(key => console.log(`  + ${key}`));
      }
    }
  }

  if (!hasErrors) {
    console.log('✅ All locale files have matching keys!');
  } else {
    process.exit(1); // Exit with non-zero status code if there are errors
  }
}

// Execute check
checkLocales();