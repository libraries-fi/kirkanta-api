const knex = require('knex');
const config = require('../config');

const { CityStorage, ConsortiumStorage, FinnaOrganisationStorage, LibraryStorage, PeriodStorage, SchedulesStorage, ServiceStorage, ServicePointStorage } = require('./storage');
const { collapseTranslations, collectReferences, transform, postTransform } = require('./filters');

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
            collected.get(type).push(...id);
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
}

const cities = new CityStorage;
const consortiums = new ConsortiumStorage;
const finna_organisations = new FinnaOrganisationStorage;
const schedules = new SchedulesStorage;
const periods = new PeriodStorage;
const services = new ServiceStorage;
const service_points = new ServicePointStorage(schedules);
const libraries = new LibraryStorage(schedules);

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
searcher.addStorage('period', periods);

module.exports = { Searcher, searcher };
