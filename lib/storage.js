"use strict";

let database = require("./database");

let AbstractStorage = exports.AbstractStorage = function(config) {
  this.config = config;
};

AbstractStorage.prototype = {
  compile: function(params) {
    throw new Error("AbstractStorage.compile()");
  },
  search: function(query) {
    throw new Error("AbstractStorage.search()");
  },
};

let ElasticStorage = exports.ElasticStorage = function() {
  AbstractStorage.apply(this, arguments);
};

ElasticStorage.prototype = Object.create(AbstractStorage.prototype, {
  type: {
    get: function() {
      return this.config.type;
    }
  },
  rules: {
    get: function() {
      return this.config.filters;
    }
  },
  sorting: {
    get: function() {
      return this.config.sorting;
    }
  },
  sections: {
    get: function() {
      return this.config.sections;
    }
  },
  compile: {
    value: function(params) {
      let request = {type: this.type, body: {}};
      let queries = [];
      let filters = [];
      let include = ("with" in params) ? params.with.split(",") : [];
      let exclude = this.sections.filter(function(value) {
        return include.indexOf(value) == -1;
      });

      if (exclude.length) {
        request._sourceExclude = exclude;
      }

      if ("limit" in params) {
        request.size = parseInt(params.limit);
      }

      if ("start" in params) {
        request.from = parseInt(params.start);
      }

      Object.keys(params).forEach(function(key) {
        if (!(key in this.rules)) {
          return;
        }

        let rule = this.rules[key];
        let field = rule.field || key;
        let value = rule.use_raw ? params[key] :
          rule.multiple ?
            params[key].split(",").map(val => val.trim().toLowerCase()) :
            params[key].trim().toLowerCase();

        if (rule.multilang) {
          field += "." + params.lang;
        }

        if (rule.query || rule.filter) {
          let callback = rule.callback || (rule.query ? ElasticStorage.Filters[rule.query] : ElasticStorage.Filters[rule.filter]);
          let query = {};
          query[rule.query || rule.filter] = callback.call(null, field, value, params);
          rule.query ? (queries.push(query)) : (filters.push(query));
        }
      }, this);

      if ("sort" in params) {
        let sorting = params.sort.split(",").map(function(key) {
          let direction = key[0] == "-" ? "desc" : "asc";
          key = key.replace(/^-/, "");

          if (key in this.sorting) {
            sorting.push(this.sorting[key](direction, params));
          }
        }, this);
        request.sort = sorting;
      }

      if (queries.length) {
        request.body.query = {
          bool: {
            must: queries
          }
        };
      }
      if (filters.length) {
        request.body.filter = {
          bool: {
            must: filters
          }
        };
      }
      return request;
    }
  },
  search: {
    value: function(query) {
      let storage = this;
      return new Promise(function(resolve, reject) {
        database.elastic().search(query).then(function(response) {
          resolve({
            total: response.hits.total,
            type: storage.type,
            items: response.hits.hits.map(function(item) {
              return item._source;
            })
          });
        }, function(error) {
          console.error("QUERY FAILED", error);
          reject(error);
        })
      });
    }
  },
});

let generic = function(field, value) {
  let query = {};
  query[field] = value;
  return query;
};

ElasticStorage.Filters = {
  ids: function(field, value) {
    return {
      values: value,
    };
  },
  terms: generic,
  prefix: generic,
};

let PostgresStorage = exports.PostgresStorage = function() {
  AbstractStorage.apply(this, arguments);
};

PostgresStorage.prototype = Object.create(AbstractStorage.prototype, {
  table: {
    get: function() {
      return this.config.table;
    }
  },
  rules: {
    get: function() {
      return this.config.filters;
    }
  },
  compile: {
    value: function(params) {
      let query = database.postgres().builder().select().from(this.table);
      Object.keys(params).forEach(function(key) {
        if (!(key in this.rules)) {
          return;
        }

        let rule = this.rules[key];
        let op = rule.multiple ? "in" : (rule.partial ? "ilike" : "=");
        let value = rule.multiple ? params[key].split(",") : params[key];
        let field = rule.field || key;

        if (op == "ilike") {
          value += "%";
        }
        if (rule.multilang && params.lang && params.lang != "fi") {
          let clause = util.format("translations->'%s'->>'%s' %s ?", params.lang, field, op);
          query.andWhere(database.postgres().builder().raw(clause, value));
        } else {
          query.andWhere(field, op, value);
        }
      }, this);
      return query;
    }
  },
  search: {
    value: function(query) {
      let storage = this;
      return new Promise(function(resolve, reject) {
        database.postgres().search(query).then(function(result) {
          query.count().then(function(count) {
            resolve({
              type: storage.type,
              total: count[0].count,
              items: result.map(function(row) {
                return storage.mergeTranslations(row);
              })
            });
          });
        });
      });
    }
  },
  mergeTranslations: {
    value: function(data) {
      return data;

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
});
