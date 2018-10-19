const knex = require('knex');
const config = require('../config');

const { BasicStorage, Storage } = require('./storage');
const { collapseTranslations, collectReferences, transform, postTransform } = require('./filters');
const { FilterChain } = require('./filters');

const STATE_PUBLISHED = 1;

class Searcher {
  constructor(database) {
    this.__storages = new Map;
    this.__db = database;
  }

  get db() {
    return this.__db;
  }

  get supportedTypes() {
    return [...this.__storages.keys()];
  }

  addStorage(type, callback) {
    this.__storages.set(type, callback);
  }

  storage(type) {
    const storage = this.__storages.get(type);

    if (!storage) {
      throw new Error(`Storage for '${type}' does not exist`);
    }

    return storage;
  }

  async search(type, values, options = {}) {
    const storage = this.storage(type);
    const statement = storage.load(this.db, values, options);
    const count = storage.count(statement.query);

    let [result, total] = await Promise.all([statement, count]);

    if (options.refs && options.refs.length > 0) {
      return new Promise((resolve, reject) => {
        let refs_map = [...storage.refs].filter(([key]) => options.refs.indexOf(key) != -1);
        let collected = new Map([...refs_map].map(([key]) => [key, []]));

        result.transform((doc) => {
          for (let [type, id] of collectReferences(doc, refs_map)) {
            collected.get(type).push(id);
          }
          return doc;
        });

        result.after(async (items) => {
          let refs = {};
          for (let [type, ids] of collected) {
            refs[type] = {};

            for (let doc of await this.load(type, {id: ids}, {limit: 5000})) {
              if (doc) {
                refs[type][doc.id] = doc;
              } else {
                console.warn(`Fetched a null doc of type '${type}'`)
              }
            }
          }

          resolve({ type, total, items, refs });
        });

        // Trigger generator and filters.
        [...result];
      });
    }

    return ({ type, total, items: [...result] });
  }

  load(type, values, options = {}) {
    return this.storage(type).load(this.db, values, options);
  }

  fetch(type, id, options = {}) {
    return this.load(type, {id: [id]}, options).then((result) => {
      for (let item of result) {
        return item;
      }
    });
  }
}

const services = new Storage({
  table: 'services',
  filters: {
    id: {
      filter: 'terms',
    },
    name: {
      filter: 'prefix',
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

const finna_organisations = new Storage({
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

const consortiums = new Storage({
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

const service_points = new Storage({
  table: 'organisations',
  sections: ['departments', 'emailAddresses', 'links', 'mailAddress', 'persons', 'phoneNumbers', 'pictures', 'services'],
  refs: {
    city: 'city',
    consortium: 'consortium',
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
    'geo.pos': (query, value, params) => {
      let distance = (parseInt(params['geo.dist']) || 10) * 1000;
      let [lat, lon] = value.trim().split(/,/).map(f => parseFloat(f).toFixed(6));
      let point = `POINT(${lat}, ${lon})`;

      query.select(query.client.raw(`ST_DISTANCE(addresses.coordinates, ST_POINT(${lat}, ${lon})) AS distance`));
      query.innerJoin('addresses', 'organisations.address_id', 'addresses.id');
      query.andWhereRaw(`ST_DISTANCE(addresses.coordinates, ST_POINT(${lat}, ${lon})) < ?`, distance);
      query.orderBy('distance');

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
      query.orderBy('ts_rank', 'DESC');
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

const libraries = new Storage(Object.assign({}, service_points.__options, {
  baseFilters: {
    state: STATE_PUBLISHED,
    role: 'library'
  }
}));

libraries.events.on('result', async (event) => {
  if (event.options.with.indexOf('schedules') != -1) {
    let cache = new Map;

    for (let library of event.result) {
      cache.set(library.id, library);
      library.schedules = [];
    }

    let times = await schedules.load(event.db, {
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
});

libraries.events.on('result', (event) => {
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
});

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

const cities = new CityStorage;

const addDays = require('date-fns/add_days');
const addWeeks = require('date-fns/add_weeks');
const addMonths = require('date-fns/add_months');
const setISODay = require('date-fns/set_iso_day');
const formatDate = require('date-fns/format');
const startOfMonth = require('date-fns/start_of_month');
const endOfMonth = require('date-fns/end_of_month');
const startOfWeek = require('date-fns/start_of_week');
const endOfWeek = require('date-fns/end_of_week');
const parseDate = require('date-fns/parse');

function parseDateValue(value, upperBound = false) {
  let match = /^(\d+)([dwm])$/.exec(value);

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

class SchedulesStorage extends BasicStorage {
  constructor() {
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
          query.whereRaw('schedules.opens::date >= ?', parseDateValue(value));
        },
        'period.end': (query, value, foo) => {
          query.whereRaw('schedules.opens::date <= ?', parseDateValue(value, true));
        },
        live: (query, value) => {
          let having = new Map([
            ['open', 'max(live_status) > 0'],
            ['closed', 'max(live_status) = 0'],
            ['', 'max(live_status) IS NOT NULL'],
          ]).get(value || '');

          // Using HAVING and not WHERE to include every time entry in the aggregate.
          query.select(db.raw('max(live_status) AS "liveStatus"')).havingRaw(having);
        }
      },
      sorting: {}
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
        db.raw('MAX(period) period'),
        db.raw('date(opens)::text AS date'),
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
          null
        ELSE
          array_agg(jsonb_build_object(
            'from', to_char(opens, 'HH24:MI'),
            'to', to_char(closes, 'HH24:MI'),
            'staff', staff
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
}

const schedules = new SchedulesStorage;

const db = knex({
  client: 'pg',
  connection: {
    host: config.database.host,
    port: config.database.port || 5432,
    user: config.database.username,
    password: config.database.password,
    database: config.database.dbname,
  },
});

const searcher = new Searcher(db);
searcher.addStorage('service_point', service_points);
searcher.addStorage('library', libraries);
searcher.addStorage('consortium', consortiums);
searcher.addStorage('finna_organisation', finna_organisations);
searcher.addStorage('service', services);
searcher.addStorage('schedules', schedules);
searcher.addStorage('city', cities);

module.exports = { Searcher, searcher };
