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
      let client = new es.Client({
        host: util.format("%s:%s", config.elastic.address, config.elastic.port),
      });

      if (!("index" in query)) {
        query.index = config.elastic.index;
      }

      if (!("size" in query)) {
        query.size = config.api.results_per_page;
      }

      return client.search(query);
    }
  }
};

exports.postgres = function() {
  return Object.create({
    search: function(query) {
      return query;
    },
    builder: function() {
      return this.knex;
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
