const config = require('../config');

const FALLBACK_LANGUAGE = config.fallbackLanguage;

const availableLanguagesCache = new Map([
  ['fi', true],
  ['sv', true],
  ['en', true],
  ['ru', true],
  ['se', true],
]);

exports.json = (result, langcode) => {
  // NOTE: Optimize further by using a streaming version of JSON.stringify...

  const spaces = config.debug ? 4 : undefined;

  function collapse_langcode(key, data) {
    /*
     * NOTE: This method seems a bit slower because it tests for every key.
     */
    // if (availableLanguagesCache.has(key) && key != langcode) {
    //   return undefined;
    // }
    // return data;

    if (data !== null && typeof data == 'object') {
      for (let key in data) {
        if (availableLanguagesCache.has(key)) {
          return data[langcode] || data[FALLBACK_LANGUAGE];
        }
      }
    }
    return data;
  }

  if (langcode) {
    return JSON.stringify(result, collapse_langcode, spaces);
  } else {
    return JSON.stringify(result, null, spaces);
  }
}
