
const config = require('../config');
const { collapseTranslations, collectReferences, transform, postTransform, stringToTerms, FilterChain } = require('./filters');

const FALLBACK_LIMIT = 10;
const FALLBACK_LANGUAGE = config.fallbackLanguage;

function required() {
  throw new Error('Missing required parameter');
}

function termsFilter(query, field, terms) {
  query.whereIn(field, terms);
}

function prefixFilter(query, field, value) {
  query.whereRaw(`${field} ILIKE ?`, [`${value}%`]);
}

function queryStringFilter(query, fields, search_string) {
  throw new Error('queryString not supported yet');
}

function processFilters(table, definitions) {
  let filters = new Map;
  let table_multilang = `${table}_data`;

  for (let [name, rule] of definitions) {
    if (typeof rule == 'function') {
      rule = {
        filter: 'callback',
        callback: rule
      };
    }

    if (typeof rule == 'object') {
      if (!rule.table) {
        rule.table = rule.multilang ? table_multilang : table;
      }

      if (!rule.field) {
        rule.field = `${rule.table}.${name}`;
      }

      if (!rule.join && rule.multilang) {
        rule.join = {
          table: table_multilang,
          with: [`${table}.id`, `${table_multilang}.entity_id`]
        };
      }

      if (rule.join) {
        if (!Array.isArray(rule.join)) {
          rule.join = [rule.join];
        }

        for (let join of rule.join) {
          let [left, right] = join.with;

          if (left.indexOf('.') == -1) {
            join.with [0] = `${table}.${left}`;
          }

          if (right.indexOf('.') == -1) {
            join.with[1] = `${join.table}.${right}`;
          }
        }
      }

      if (rule.field.indexOf('.') == -1) {
        rule.field = `${rule.table}.${rule.field}`;
      }

      if ('nested' in rule) {
        let nested = {};

        for (let [nested_field, nested_filter] of Object.entries(rule.nested.fields)) {
          let nested_rule = {
            filter: nested_filter,
            field: nested_field,
          };

          // filters.set([name, nested_field].join('.'), nested_rule);
          nested[`${name}.${nested_field}`] = nested_rule;

          if (rule.nested.table) {
            if (rule.nested.join) {
              nested_rule.join = rule.nested.join;
            } else if (rule.nested.multilang) {
              nested_rule.join = {
                table: rule.nested.table,
                with: [rule.field, `${rule.nested.table}.entity_id`]
              };
            } else {
              console.error(nested_rule);
              throw new Error('Automatic joins to non-multilang fields not supported yet');
            }
          }
        }

        for (let [nested_key, nested_rule] of processFilters(rule.nested.table, Object.entries(nested))) {
          filters.set(nested_key, nested_rule);
        }

        delete rule.nested;
      }
    }

    Object.freeze(rule);
    filters.set(name, rule);
  }

  return filters;
}

function processSorting(entries) {
  let rules = new Map;

  for (let [key, rule] of entries) {
    if (typeof rule == 'string') {
      rules.set(key, {
        path: [rule],
        multilang: false,
      });
    } else {
      rules.set(key, {
        path: Array.isArray(rule.path) ? rule.path : [rule.path],
        multilang: rule.multilang || false,
      });
    }
  }

  return rules;
}

class BasicStorage {
  constructor(options) {
    this.__options = options;
    this.__refs = new Map(Object.entries(options.refs || {}));
    this.__baseFilters = new Map(Object.entries(options.baseFilters || {}));
    this.__filters = processFilters(options.table, Object.entries(options.filters));
    this.__sorting = processSorting(Object.entries(options.sorting));
    this.__sections = options.sections || [];
  }

  get table() {
    return this.__options.table;
  }

  get baseFilters() {
    return this.__baseFilters;
  }

  get filters() {
    return this.__filters;
  }

  get sections() {
    return this.__sections;
  }

  get sorting() {
    return this.__sorting;
  }

  get refs() {
    return this.__refs;
  }

  queryBuilder(db, options = {}) {
    return db.table(this.table);
  }

  query(db, values = {}, options = {}) {
    const langcode = options.langcode;
    const query = this.queryBuilder(db, options);

    console.log(query);

    if (options.limit > 0) {
      query.limit(options.limit);
    } else {
      query.limit(FALLBACK_LIMIT);
    }

    if (options.skip > 0) {
      query.offset(options.skip);
    }

    for (let [field, value] of this.baseFilters) {
      if (Array.isArray(value)) {
        query.whereIn(field, value);
      } else {
        query.where(field, value);
      }
    }

    for (let name in values) {
      if (!this.filters.has(name)) {
        continue;
      }

      const rule = this.filters.get(name);
      const value = values[name];

      switch (rule.filter) {
        case 'prefix':
          prefixFilter(query, rule.field, value);
          break;

        case 'terms':
          termsFilter(query, rule.field, stringToTerms(value));
          break;

        case 'callback':
          rule.callback(query, value, values);
          break;
      }

      if (rule.join) {
        for (let join of rule.join) {
          query.innerJoin(join.table, ...join.with);
        }
      }

      if (rule.multilang && langcode) {
        query.andWhere(`${rule.table}.langcode`, langcode);
      }
    }

    if (options.sort) {
      this.sort(query, options.sort, langcode);
    }

    return query;
  }

  load(db, values, options) {
    const query = this.query(db, values, options);

    return {
      query: query,
      then: (callback) => query.then(result => new FilterChain(result)).then(callback)
    };
  }

  count(query) {
    return query.clone()
      .clearSelect()
      .clearOrder()
      .count()
      .then((result) => result[0].count);
  }

  sort(query, sorting, langcode = null) {
    for (let key of sorting) {
      let direction = key[0] == '-' ? 'desc' : 'asc';
      key = key.replace(/^-/, '');

      if (this.sorting.has(key)) {
        const rule = this.sorting.get(key);
        query.orderBy(rule.path[0], direction);
      }
    }
  }

  search(db, values, options) {
    const query = this.query(db, values, options);
    const count = this.count(query);

    return Promise.all([query, count]).then(([result, total]) => ({
      total: total,
      items: [...result],
    }));
  }

  execute(query, options) {
    return query;
  }
}

class Storage extends BasicStorage {
  queryBuilder(db, options = {}) {
    const filtered_sections = options.with
      ? this.sections.filter((s) => options.with.indexOf(s) == -1)
      : this.sections;

    const query = super.queryBuilder(db, options)
      .distinct()
      .select(`${this.table}.id`)
      .select(db.raw(`${this.table}.cached_document - '${filtered_sections.join("' - '")}' AS doc`));

    return query;
  }

  sort(query, sorting, langcode = null) {
    const db = query.client;

    for (let key of sorting) {
      let direction = key[0] == '-' ? 'desc' : 'asc';
      key = key.replace(/^-/, '');

      if (this.sorting.has(key)) {
        let rule = this.sorting.get(key);
        let path = rule.path.slice();

        if (rule.multilang) {
          path.push(langcode || config.fallbackLanguage);
        }

        let trace = path.join('", "');
        let sql = `${this.table}.cached_document #> '{"${trace}"}'`;

        query.select(db.raw(sql));
        query.orderBy(db.raw(sql), direction);
      }
    }
  }

  count(query) {
    return query.clone()
      .clearSelect()
      .clearOrder()
      .countDistinct(`${this.table}.id`)
      .then((result) => result[0].count);
  }

  load(db, values, options) {
    const query = this.query(db, values, options);

    return {
      query: query,
      then: (callback) => query.then((result) => transform(result, (row) => row.doc)).then(callback)
    };
  }
}

module.exports = { BasicStorage, Storage, processFilters };
