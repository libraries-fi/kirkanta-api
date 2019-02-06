
const config = require('../config');
const FALLBACK_LANGCODE = config.fallbackLanguage;

class FallbackValue {
  constructor(langcode, value) {
    this.__langcode = langcode;
    this.__value = value;
  }

  toString() {
    return this.__value;
  }

  [Symbol.toString]() {
    return 'foobar';
  }
}

/*
 * Allows faster checking of a valid langcode
 */
const availableLanguagesCache = new Map(config.languages.map(langcode => [langcode, true]));

class FilterChain {
  constructor(data) {
    this.data = data;
    this.filters = [];
    this.postFilters = [];
  }

  * [Symbol.iterator]() {
    const mapped = [];

    for (let row of this.data) {
      this.filters.forEach(([callback, args]) => {
        row = callback(row, ...args);
      });

      mapped.push(row);
      yield row;
    }

    for (let [callback, args] of this.postFilters) {
      callback(mapped, ...args);
    }
  }

  [Symbol.toStringTag]() {
    return 'RESULT';
  }

  [Symbol.toPrimitive](hint) {
    console.log('CONVERT', hint);
  }

  first(callback, ...args) {
    this.filters.unshift([callback, args]);
    return this;
  }

  after(callback, ...args) {
    this.postFilters.push([callback, args]);
  }

  transform(callback, ...args) {
    this.filters.push([callback, args]);
    return this;
  }

  context(iterable) {
    this.data = iterable;
    return this;
  }
}

function collapseTranslations(document, langcode) {
  for (let key in document) {
    const nested = document[key];

    if (nested !== null && typeof nested == 'object') {
      for (let nested_key in nested) {
        if (availableLanguagesCache.has(nested_key)) {
          document[key] = nested[langcode] || new FallbackValue(FALLBACK_LANGCODE, nested[FALLBACK_LANGCODE]);
          break;
        } else {
          collapseTranslations(nested, langcode);
        }
      }
    }
  }
  return document;
}

function isIterable(value) {
  return value !== null && typeof value == 'object' && typeof value[Symbol.iterator] == 'function';
}

function collectReferences(document, refs_map) {
  // This method for iterating is compatible with Map-like array structure...
  const refs = new Map([...refs_map].map(([key]) => [key, null]));

  for (let [key, path] of refs_map) {
    let value = extractPath(document, path);
    if (value === undefined || value === null) {
      refs.delete(key);
    } else if (isIterable(value)) {
      refs.set(key, value);
    } else {
      refs.set(key, [value]);
    }
  }
  return refs;
}

function extractPath(document, path, default_value) {
  if (typeof path == 'function') {
    return path(document);
  }

  if (path.indexOf('.') == -1) {
    return document.hasOwnProperty(path) ? document[path] : default_value;
  }

  let data = document;

  for (let key of path.split('.')) {
    if (key in data) {
      data = data[key];
    } else {
      return default_value;
    }
  }

  return data;
}

function transform(result, callback, ...args) {
  if (!(result instanceof FilterChain)) {
    result = new FilterChain(result);
  }

  return result.transform(callback, ...args);
}

function * postTransform(result, callback) {
  for (let row of result) {
    yield row;
  }

  callback(result);
}

function stringToTerms(string) {
  if (Array.isArray(string)) {
    return string;
  }

  if (string) {
    return string.split(/[\s,]+/);
  } else {
    return [];
  }
}

module.exports = { collapseTranslations, collectReferences, transform, postTransform, stringToTerms, FilterChain };
