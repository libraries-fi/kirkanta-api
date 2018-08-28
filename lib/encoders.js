const config = require('../config');
const FALLBACK_LANGUAGE = config.fallbackLanguage;

const availableLanguagesCache = new Map([
  ['fi', true],
  ['sv', true],
  ['en', true],
  ['ru', true],
  ['se', true],
]);

exports.json = (result, langcode, options = {}) => {
  // NOTE: Optimize further by using a streaming version of JSON.stringify...

  function collapse_langcode(key, data) {
    if (data !== null && typeof data == 'object') {
      for (let key in data) {
        if (availableLanguagesCache.has(key)) {
          return data[langcode] || data[FALLBACK_LANGUAGE];
        }
      }
    }
    return data;
  }

  const spaces = options.pretty ? 4 : undefined;

  if (langcode) {
    return JSON.stringify(result, collapse_langcode, spaces);
  } else {
    return JSON.stringify(result, null, spaces);
  }
}
