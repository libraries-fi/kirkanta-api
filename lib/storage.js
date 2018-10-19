
const config = require('../config');
const { PromiseEvents } = require('./events');
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
  query.whereRaw(`${field} ILIKE ?`, [`%${value}%`]);
}

function queryStringFilter(query, fields, search_string) {
  throw new Error('queryString not supported yet');
}

const addDays = require('date-fns/add_days');
const addWeeks = require('date-fns/add_weeks');
const addMonths = require('date-fns/add_months');
const setISODay = require('date-fns/set_iso_day');
const formatDate = require('date-fns/format');
const startOfMonth = require('date-fns/start_of_month');
const endOfMonth = require('date-fns/end_of_month');

function scheduleFromFilter(query, value) {
  if (new Date(value)) {
    query.whereRaw('schedules.opens::date >= ?', value);
  } else {
    let match = /^(\d+)([dwm])$/.exec(value);

    if (match) {
      let [_, amount, unit] = match;

      if (/^(\d+)[dwm]$/.test(value)) {
        let now = new Date;
        let value = null;

        switch (unit) {
          case 'd':
            value = addDays(now, amount);
            break;

          case 'w':
            value = setISODay(addWeeks(now, amount), 1);
            break;

          case 'm':
            value = startOfMonth(addMonths(now, amount));
            break;
        }

        query.where('schedules.opens::date >= ?', format('YYYY-MM-DD', value));
      }
    } else {
      query.where('schedules.opens::date = CURRENT_DATE');
    }
  }
}

function schedulesUntilFilter(query, value) {
  if (new Date(value)) {
    query.whereRaw('schedules.opens::date <= ?', value);
  } else {
    let match = /^(\d+)([dwm])$/.exec(value);

    if (match) {
      let [_, amount, unit] = match;

      if (/^(\d+)[dwm]$/.test(value)) {
        let now = new Date;
        let value = null;

        switch (unit) {
          case 'd':
            value = addDays(now, amount);
            break;

          case 'w':
            value = setISODay(addWeeks(now, amount), 7);
            break;

          case 'm':
            value = endOfMonth(addMonths(now, amount));
            break;
        }

        query.where('schedules.opens::date >= ?', format('YYYY-MM-DD', value));
      }
    } else {
      query.where('schedules.opens::date = CURRENT_DATE');
    }
  }
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

          nested[`${name}.${nested_field}`] = nested_rule;

          filters.set(`${name}.${nested_field}`, nested_rule);

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

        // NOTE: Don't delete this property because it will break re-used schemas.
        // delete rule.nested;
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

    this.__events = new PromiseEvents;
  }

  get events() {
    return this.__events;
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

  /**
   * Construct a query and return it.
   */
  query(db, user_input = {}, options = {}) {
    const langcode = options.langcode;
    const query = this.queryBuilder(db, options);

    let values = { ...this.__options.defaultFilters, ...user_input };

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
          if (typeof value == 'string' && !value.length) {
            break;
          }
          prefixFilter(query, rule.field, value);
          break;

        case 'terms':
          if (typeof value == 'string' && !value.length) {
            break;
          }
          termsFilter(query, rule.field, stringToTerms(value));
          break;

        case 'callback':
          rule.callback(query, value, values, options);
          break;

        default:
          console.log('FAIL', rule)
          throw new Error(`Invalid filter specification for '${name}'`);
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

    const sorting = (options.sort && options.sort.length) ? options.sort : this.__options.defaultSorting;

    if (sorting) {
      this.sort(query, sorting, langcode);
    }

    let filters = new FilterChain;

    console.log(user_input, query.toSQL().toNative());

    const context = {
      query: query,
      transform: (callback, ...args) => {
        filters.transform(callback, ...args);
        return context;
      },
      clone: () => query.clone(),
      then: async (callback) => {
        const result = filters.context(await query);
        await this.events.emit('result', {db, result, values, options});
        return callback(result);
      }
    };

    return context;
  }

  /**
   * Executes a query and returns the result of it.
   */
  load(db, values, options) {
    return this.query(db, values, options);
  }

  /**
   * Generates a COUNT query based on a given SELECT statement.
   */
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
}

class Storage extends BasicStorage {
  constructor(options) {
    super(options);
    this.events.on('result', (event) => event.result.transform((row) => row.doc));
  }

  queryBuilder(db, options = {}) {
    const filtered_sections = options.with
      ? this.sections.filter((s) => options.with.indexOf(s) == -1)
      : this.sections;

    const query = super.queryBuilder(db, options)
      .distinct()
      .select(`${this.table}.id`)
      .select(db.raw(`${this.table}.api_document - '{${filtered_sections.join(", ")}}' AS doc`))
      ;

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
        let sql = `${this.table}.api_document #> '{"${trace}"}'`;

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
      .first()
      .then((row) => row ? row.count : 0);
  }
}

module.exports = { BasicStorage, Storage, processFilters };
