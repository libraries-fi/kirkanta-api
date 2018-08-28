const knex = require('knex');
const config = require('../config');

const { BasicStorage, Storage } = require('./storage');
const { collapseTranslations, collectReferences, transform, postTransform } = require('./filters');

const STATE_PUBLISHED = 1;

function createRenderCachedQuery(db) {

}

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

  search(type, values, options = {}) {
    const storage = this.storage(type);
    const statement = storage.load(this.db, values, options);
    const count = storage.count(statement.query);

    return Promise.all([statement, count]).then(([result, total]) => {
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

          result.after(async (result) => {
            let refs = {};
            for (let [type, ids] of collected) {
              refs[type] = {};

              for (let doc of await this.load(type, {id: ids})) {
                refs[type][doc.id] = doc;
              }
            }

            resolve({ type, total, result, refs });
          });

          // Trigger generator and filters.
          [...result];
        });
      }

      return ({ type, total, result: [...result] });
    });
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
          with: ['service_instances.library_id', 'id']
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
            with: ['service_instances.library_id', 'id']
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
          with: ['service_instances.library_id', 'id']
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
            with: ['service_instances.library_id', 'id']
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
  sections: ['departments', 'mail_address', 'persons', 'phone_numbers', 'pictures', 'services'],
  refs: {
    city: 'city',
    consortium: 'consortium',
  },
  baseFilters: {
    state: STATE_PUBLISHED,
    role: ['library', 'foreign']
  },
  filters: {
    id: {
      filter: 'terms',
    },
    type: {
      filters: 'terms',
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
          with: ['id', 'library_id'],
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
            with: ['organisations.id', 'library_id'],
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
    'geo.pos': (query, value, params) => {
      let distance = (parseInt(params['geo.dist']) || 10) * 1000;
      let [lat, lon] = value.trim().split(/,/).map(f => parseFloat(f).toFixed(6));
      let point = `POINT(${lat}, ${lon})`;

      query.innerJoin('addresses', 'organisations.address_id', 'addresses.id');
      query.andWhereRaw(`ST_DISTANCE(addresses.coordinates, ST_GeomFromText(?)) < ?`, [`POINT(${lat} ${lon})`, distance]);
    },
    'geo.dist': () => {}
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
  }
});

const libraries = new Storage(Object.assign({}, service_points.__options, {
  baseFilters: {
    state: STATE_PUBLISHED,
    role: 'library'
  }
}));


class CityStorage extends BasicStorage {
  constructor() {
    super({
      table: 'cities',
      refs: {
        consortium: 'consortium'
      },
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

class SchedulesStorage extends BasicStorage {
  constructor() {
    super({
      table: 'schedules',
      filters: {
        library: {
          filter: 'terms'
        }
      },
      sorting: {}
    })
  }

  queryBuilder(db, options = {}) {
    /*
     * NOTE: Using MAX(period) due to SQL requirements. It is safe because each day can only contain
     * specifications from a single period.
     */

    return super.queryBuilder(db, options)
      .select('library', db.raw('MAX(period) period'), db.raw('date(opens)::text'))
      .select(db.raw(`array_agg(jsonb_build_object(
        'from', to_char(opens, 'HH24:MI'),
        'to', to_char(closes, 'HH24:MI'),
        'staff', staff))
        AS times
      `))
      .where(db.raw('department IS NULL'))
      .groupBy('library')
      .groupByRaw('date(opens)')
      .orderByRaw('library')
      .orderByRaw('date(opens)');
  }

  count() {
    return Promise.resolve(null);
  }
}

const schedules = new SchedulesStorage;

// select library, date(opens), array_agg((opens::time, closes::time, staff)) times from schedules where library = 84924 and date(opens) between '2018-09-01' and '2018-09-30' and department is null group by library, date(opens);

const db = knex({
  client: 'pg',
  version: '9.6',
  connection: {
    host: config.database.host,
    user: config.database.username,
    password: config.database.password,
    database: config.database.dbname,
  }
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
