const { PromiseEvents } = require('./events');
const { collapseTranslations, collectReferences, transform, postTransform, stringToTerms, FilterChain } = require('./filters');

const FALLBACK_LIMIT = 10;
const STATE_PUBLISHED = 1;

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
const startOfWeek = require('date-fns/start_of_week');
const endOfWeek = require('date-fns/end_of_week');
const startOfMonth = require('date-fns/start_of_month');
const endOfMonth = require('date-fns/end_of_month');

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
              //console.error(nested_rule);
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
          console.error('FAIL', rule)
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

    const sorting = (options.sort && options.sort.length)
      ? options.sort
      : this.__options.defaultSorting
      ;

    if (sorting) {
      this.sort(query, sorting, langcode);
    }

    let filters = new FilterChain;

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
      .then((result) => result.length > 0 ? parseInt(result[0].count) : null)
      ;
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
      .select(db.raw(`${this.table}.api_document - '{${filtered_sections.join(", ")}}'::text[] AS doc`))
      .whereNotNull(`${this.table}.api_document`)
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
          path.push(langcode);
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
      .then((row) => row ? parseInt(row.count) : 0)
      ;
  }
}

class ServicePointStorage extends Storage {
  constructor(schedules) {
    super({
      table: 'organisations',
      sections: ['customData', 'departments', 'emailAddresses', 'links', 'mailAddress', 'persons', 'phoneNumbers', 'pictures', 'primaryContactInfo', 'services', 'transitInfo'],
      refs: {
        city: 'city',
        consortium: 'consortium',
        period: (library) => {
          if ('schedules' in library) {
            return new Set(library.schedules.map(d => d.period));
          }
        }
      },
      baseFilters: {
        state: STATE_PUBLISHED,
        role: ['library', 'foreign']
      },
      defaultSorting: ['name'],
      filters: {
        id: {
          filter: 'terms',
        },
        type: {
          filter: 'terms',
        },
        name: {
          filter: 'prefix',
          multilang: true,
        },
        slug: {
          filter: 'terms',
          multilang: true,
        },
        consortium: {
          filter: 'terms',
          field: 'consortium_id',
          nested: {
            fields: {name: 'prefix', slug: 'terms'},
            table: 'consortiums_data',
            multilang: true,
          }
        },
        city: {
          filter: 'terms',
          field: 'city_id',
          nested: {
            fields: {name: 'prefix', slug: 'terms'},
            table: 'cities_data',
            multilang: true,
          }
        },
        service: {
          filter: 'terms',
          field: 'services.id',
          join: [
            {
              table: 'service_instances',
              with: ['id', 'parent_id'],
            },
            {
              table: 'services',
              with: ['service_instances.template_id', 'id']
            },
          ],
          nested: {
            fields: {name: 'prefix', slug: 'terms'},
            table: 'services_data',
            multilang: true,
            join: [
              {
                table: 'service_instances',
                with: ['organisations.id', 'parent_id'],
              },
              {
                table: 'service_instances_data',
                with: ['service_instances.id', 'entity_id']
              },
              {
                table: 'services',
                with: ['service_instances.template_id', 'id']
              },
              {
                table: 'services_data',
                with: ['services.id', 'entity_id']
              }
            ],
          }
        },
        status: (query, value) => {
          query.select(query.client.raw('MAX(live_status) AS "liveStatus"'));
          query.groupBy('organisations.id');

          if (value) {
            let op = value == 'closed' ? '=' : '>';
            query.joinRaw(`INNER JOIN schedules ON organisations.id = schedules.library AND schedules.live_status ${op} 0`);
          } else {
            query.joinRaw(`LEFT JOIN schedules ON organisations.id = schedules.library AND schedules.live_status IS NOT NULL`);
          }
        },
        'geo.pos': (query, value, params, options) => {
          let [lat, lon] = value.trim().split(/,/).map(f => parseFloat(f).toFixed(6));

          query.select(query.client.raw(`ROUND((ST_Distance(addresses.coordinates, ST_Point(${lon}, ${lat})) / 1000)::numeric, 2)::float  AS distance`));
          query.innerJoin('addresses', 'organisations.address_id', 'addresses.id');

          if (params['geo.dist']) {
            let distance = (parseInt(params['geo.dist']) || 10) * 1000;
            query.andWhereRaw(`ST_Distance(addresses.coordinates, ST_Point(${lon}, ${lat})) < ?`, distance);
          }

          if (!options.sort.length) {
            query.orderBy('distance');
          }

          if ('status' in params) {
            // FIXME: MUST group by when status IS PRESENT and other times MUST NOT.
            query.groupBy('addresses.coordinates');
          }
        },
        'geo.dist': () => {
          // Implemented in 'geo.pos'.
        },
        q: (query, value, params, options) => {
          if (!value.length) {
            return;
          }

          // NOTE: to_tsquery has strict requirements regarding syntax.
          const search = value
            .replace(/[^\u00C0-\u017FA-Za-z0-9]+/, ' ')
            .trim()
            .split(/\s+/)
            .map((word) => `${word}:*`)
            .join(' & ');

          const languages = new Map([
            ['fi', 'Finnish'],
            ['en', 'English'],
            ['sv', 'Swedish'],
            ['ru', 'Russian'],
          ]);

          const mode = languages.get(options.langcode) || 'simple';
          const clause = `ts_rank(organisations.api_keywords, to_tsquery('${mode}', ?))`;

          query.select(query.client.raw(clause, search));
          query.andWhereRaw(`${clause} > 0.001`, search);

          if (!options.sort.length) {
            query.orderBy('ts_rank', 'DESC');
          }
        }
      },
      sorting: {
        id: 'id',
        name: {
          path: ['name'],
          multilang: true,
        },
        city: {
          path: ['address', 'city'],
          multilang: true,
        }
      },
    });

    this.schedules = schedules;

    this.events.on('result', (event) => this.onResultMergeSchedules(event));
    this.events.on('result', (event) => this.onResultMergeGeoDistance(event));
  }

  async onResultMergeSchedules(event) {
    if (event.options.with.indexOf('schedules') != -1) {
      let cache = new Map;

      for (let library of event.result) {
        cache.set(library.id, library);
        library.schedules = [];
      }

      let times = await this.schedules.load(event.db, {
        library: [...cache.keys()],
        'period.start': event.values['period.start'],
        'period.end': event.values['period.end'],
      }, {
        limit: 5000,
      });

      for (let day of times) {
        cache.get(day.library).schedules.push(day);
        delete day.library;
      }
    }
  }

  onResultMergeGeoDistance(event) {
    if (event.values['geo.pos']) {
      event.result.first((row) => {
        row.doc.distance = row.distance;
        return row;
      });
    }

    if ('status' in event.values) {
      event.result.first((row) => {
        row.doc.liveStatus = row.liveStatus;
        return row;
      });
    }
  }
}

class LibraryStorage extends ServicePointStorage {
  constructor(schedules) {
    super(schedules);
    this.__baseFilters.set('role', ['library']);
  }
}

class CityStorage extends BasicStorage {
  constructor() {
    super({
      table: 'cities',
      refs: {
        consortium: 'consortium'
      },
      defaultSorting: ['name'],
      filters: {
        id: {
          filter: 'terms',
        },
        name: {
          filter: 'prefix',
          field: 'cities_data.name',
          // multilang: true,
        },
        slug: {
          filter: 'terms',
          field: 'cities_data.slug',
          // multilang: true,
        },
        consortium: {
          filter: 'terms',
          field: 'consortium_id',
          nested: {
            fields: {name: 'prefix', slug: 'terms'},
            table: 'consortiums_data',
            multilang: true,
          }
        },
      },
      sorting: {
        id: 'id',
        name: {
          path: ['name'],
          multilang: true,
        },
      }
    });
  }

  queryBuilder(db, options = {}) {
    return super.queryBuilder(db, options)
      .select('id', 'consortium_id AS consortium')
      .select(db.raw(`jsonb_object_agg(cities_data.langcode, cities_data.name) AS name`))
      .select(db.raw(`jsonb_object_agg(cities_data.langcode, cities_data.slug) AS slug`))
      .innerJoin('cities_data', 'cities.id', 'cities_data.entity_id')
      .groupBy('id')
      ;
  }
}

class SchedulesStorage extends BasicStorage {
  constructor() {
    const statusMap = new Map([
      ['open', 'max(live_status) > 0'],
      ['closed', 'max(live_status) = 0'],
      ['', 'max(live_status) IS NOT NULL'],
    ]);

    super({
      table: 'schedules',
      defaultFilters: {
        'period.start': '0d',
        'period.end': '0d'
      },
      filters: {
        library: {
          filter: 'terms'
        },
        'period.start': (query, value) => {
          query.whereRaw('schedules.opens::date >= ?', this.parseDateValue(value));
        },
        'period.end': (query, value, foo) => {
          query.whereRaw('schedules.opens::date <= ?', this.parseDateValue(value, true));
        },
        live: (query, value) => {
          let having = statusMap.get(value || '');
          let db = query.client;

          // Using HAVING and not WHERE to include every time entry in the aggregate.
          query.select(db.raw('max(live_status) AS "liveStatus"')).havingRaw(having);
        }
      },
      refs: {
        period: 'period'
      },
      sorting: {},
    })
  }

  queryBuilder(db, options = {}) {
    /*
     * NOTE: Using MAX(period) due to SQL restrictions. It is safe because each day can only contain
     * specifications from a single period.
     */

    return super.queryBuilder(db, options)
      .select(
        'library',
        db.raw('MAX(period) AS period'),
        db.raw('date(opens)::text AS date'),
        db.raw('jsonb_agg(info ORDER BY opens)->0 AS info'),
      )
      .select(db.raw(`
        CASE
        WHEN COUNT(*) = 1 AND MAX(closes) IS NULL THEN
          true
        ELSE
          false
        END AS closed
      `))
      .select(db.raw(`
        CASE
        WHEN COUNT(*) = 1 AND MAX(closes) IS NULL THEN
          '{}'
        ELSE
          array_agg(jsonb_build_object(
            'from', to_char(opens, 'HH24:MI'),
            'to', to_char(closes, 'HH24:MI'),
            'staff', (status = 1),
            'status', status
          ) ORDER BY opens)
        END
        AS times
      `))
      .where(db.raw('department IS NULL'))
      .groupBy('library')
      .groupByRaw('date(opens)')
      .orderBy('library')
      .orderBy('date')
      ;
  }

  count() {
    return Promise.resolve(null);
  }

  parseDateValue(value, upperBound = false) {
    let match = /^(-?\d+)([dwm])$/.exec(value);

    if (match) {
      let [_, amount, unit] = match;
      let now = new Date;

      switch (unit) {
        case 'd':
          return addDays(now, amount);

        case 'w': {
          let date = addWeeks(now, amount);
          return upperBound ? endOfWeek(date, { weekStartsOn: 1 }) : startOfWeek(date, { weekStartsOn: 1 });
        }

        case 'm': {
          let date = addMonths(now, amount);
          return upperBound ? endOfMonth(date) : startOfMonth(date);
        }
      }
    }

    let date = new Date(value);
    return date.getTime() ? date : new Date;
  }
}

class PeriodStorage extends BasicStorage {
  constructor() {
    super({
      table: 'periods',
      filters: {
        id: {
          filter: 'terms',
        },
      },
      sorting: {},
    })
  }

  queryBuilder(db, options = {}) {
    /**
     * NOTE: Using MAX(period) due to SQL restrictions. It is safe because each
     * day can only contain specifications from a single period.
     */
    return super.queryBuilder(db, options)
      .innerJoin('periods_data', 'periods.id', 'periods_data.entity_id')
      .select(
        'id',
        db.raw('parent_id AS library'),
        db.raw('valid_from::text AS "validFrom"'),
        db.raw('valid_until::text AS "validUntil"'),
        db.raw('valid_until IS NOT NULL AS "isException"'),
        db.raw(`jsonb_object_agg(periods_data.langcode, periods_data.name) AS name`),
        db.raw(`jsonb_object_agg(periods_data.langcode, periods_data.description) AS description`)
      )
      .whereNotNull('parent_id')
      .groupBy('id')
      ;
  }
}

class ServiceStorage extends Storage {
  constructor() {
    super({
      table: 'services',
      defaultSorting: ['name'],
      filters: {
        id: {
          filter: 'terms',
        },
        name: {
          filter: 'prefix',
          multilang: true,
        },
        slug: {
          filter: 'terms',
          multilang: true,
        },
        city: {
          filter: 'terms',
          field: 'organisations.city_id',
          join: [
            {
              table: 'service_instances',
              with: ['id', 'template_id']
            },
            {
              table: 'organisations',
              with: ['service_instances.parent_id', 'id']
            }
          ],
          nested: {
            fields: { name: 'prefix', slug: 'terms' },
            table: 'cities_data',
            multilang: true,
            join: [
              {
                table: 'service_instances',
                with: ['services.id', 'template_id']
              },
              {
                table: 'organisations',
                with: ['service_instances.parent_id', 'id']
              },
              {
                table: 'cities_data',
                with: ['organisations.city_id', 'cities_data.entity_id']
              }
            ],
          }
        },
        consortium: {
          filter: 'terms',
          field: 'organisations.consortium_id',
          join: [
            {
              table: 'service_instances',
              with: ['id', 'template_id']
            },
            {
              table: 'organisations',
              with: ['service_instances.parent_id', 'id']
            }
          ],
          nested: {
            fields: { name: 'prefix', slug: 'terms' },
            table: 'consortiums_data',
            multilang: true,
            join: [
              {
                table: 'service_instances',
                with: ['services.id', 'template_id']
              },
              {
                table: 'organisations',
                with: ['service_instances.parent_id', 'id']
              },
              {
                table: 'consortiums_data',
                with: ['organisations.consortium_id', 'consortiums_data.entity_id']
              }
            ],
          }
        }
      },
      sorting: {
        id: 'id',
        name: {
          path: 'name',
          multilang: true,
        },
      }
    });
  }
}

class FinnaOrganisationStorage extends Storage {
  constructor() {
    super({
      table: 'finna_additions',
      sections: ['links'],
      baseFilters: {

      },
      filters: {
        id: {
          filter: 'terms',
        },
        name: {
          filter: 'prefix',
          multilang: true,
        },
        'finna:id': {
          filter: 'terms',
          field: 'finna_id',
        }
      },
      sorting: {
        id: 'id',
        name: {
          path: ['name'],
          multilang: true,
        },
      }
    });
  }
}

class ConsortiumStorage extends Storage {
  constructor() {
    super({
      table: 'consortiums',
      baseFilters: {
        state: STATE_PUBLISHED
      },
      filters: {
        id: {
          filter: 'terms',
        },
        name: {
          filter: 'prefix',
          multilang: true,
        },
        slug: {
          filter: 'terms',
          multilang: true,
        },
        city: {
          filter: 'terms',
          field: 'cities.consortium_id',
          join: {
            table: 'cities',
            with: ['id', 'consortium_id']
          },
          nested: {
            fields: {name: 'prefix', slug: 'terms'},
            table: 'cities_data',
            multilang: true,
            join: [
              {
                table: 'cities',
                with: ['consortiums.id', 'consortium_id']
              },
              {
                table: 'cities_data',
                with: ['cities.id', 'entity_id']
              }
            ]
          }
        }
      },
      sorting: {
        id: 'id',
        name: {
          path: ['name'],
          multilang: true,
        },
      }
    });
  }
}

module.exports = {
  CityStorage,
  ConsortiumStorage,
  FinnaOrganisationStorage,
  LibraryStorage,
  PeriodStorage,
  SchedulesStorage,
  ServiceStorage,
  ServicePointStorage,
};
