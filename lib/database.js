"use strict";

let es = require("elasticsearch");
let knex = require("knex");
let util = require("util");
let config = require("../config");

exports.elastic = function() {
  // return new es.Client({
  //   host: util.format("%s:%s", config.elastic.address, config.elastic.port),
  // });

  return {
    search: function(query) {
      return new Promise(function(resolve, reject) {
        let client = new es.Client({
          host: util.format("%s:%s", config.elastic.address, config.elastic.port),
        });
        
        if (!("index" in query)) {
          query.index = config.elastic.index;
        }

        if (!("size" in query)) {
          query.size = config.api.results_per_page;
        }

        client.search(query).then(function(response) {
          resolve(response);
        }, reject);
      });
    }
  }
};

exports.postgres = function() {
  return Object.create({
    search: function(query) {
      var pg = this;
      return new Promise(function(resolve, reject) {
        query.then(function(response) {
          return resolve(response);

          query.count().then(function(count) {
            resolve({
              total: count[0].count,
              items: response.map(function(row) {
                return pg.mergeTranslations(row);
              }),
            })

          });
        });
      });
      return query;
    },
    builder: function() {
      return this.knex;
    },
    mergeTranslations: {
      value: function(data) {
        let langs = config.api.languages;
        let trfields = config.trschema[this.type];
        let defaultLang = config.api.default_language;

        Object.keys(trfields).forEach(function(field, i) {
          if (i == 0) {
            data[field] = {fi: data[field]};
          }

          let trdata = data.translations || {};

          langs.forEach(function(lang) {
            let value = trdata[lang] ? trdata[lang][field] : null;
            if (value === null && trfields[field]) {
              value = data[field][defaultLang];
            }
            data[field][lang] = value;
          });
        });
        delete data.translations;
        return data;
      }
    }
  }, {
    knex: {
      get: function() {
        if (!this._knex) {
          let conf = config.postgres;
          this._knex = knex({
            client: "pg",
            connection: {
              host: conf.address,
              user: conf.user,
              password: conf.password,
              database: conf.database,
            }
          });
        }
        return this._knex;
      }
    }
  });
};
