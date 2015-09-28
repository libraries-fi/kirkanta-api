"use strict";

let config = require("../config")
let database = require("./database");
let util = require("util");

let AbstractStorage = exports.AbstractStorage = function(config) {
  this.config = config;
  this.searcher = null;
};

AbstractStorage.prototype = {
};

Object.defineProperties(AbstractStorage.prototype, {
  type: {
    get: function() {
      return this.config.type;
    }
  },
  compile: {
    value: function(params) {
      throw new Error("AbstractStorage.compile()");
    }
  },
  query: {
    value: function(query) {
      throw new Error("AbstractStorage.query()");
    }
  },
  search: {
    value: function(params) {
      let query = this.compile(params);
      return this.query(query);
    }
  },
});

let ElasticStorage = exports.ElasticStorage = function() {
  AbstractStorage.apply(this, arguments);
};

ElasticStorage.prototype = Object.create(AbstractStorage.prototype, {
  index: {
    get: function() {
      return this.config.index;
    }
  },
  rules: {
    get: function() {
      return this.config.filters;
    }
  },
  sorting: {
    get: function() {
      return this.config.sorting || {};
    }
  },
  sections: {
    get: function() {
      return this.config.sections || [];
    }
  },
  compile: {
    value: function(params) {
      let request = {type: this.type, body: {}};
      let queries = [];
      let filters = [];
      let include = params.with;
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

        if (params[key] == undefined) {
          console.log("UNDEF", params[key], key);
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
        } else {
          throw new Error("Rule requires 'query' or 'filters'");
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
      // console.log(JSON.stringify(request, null, 2));
      return request;
    }
  },
  query: {
    value: function(query) {
      let storage = this;
      return new Promise(function(resolve, reject) {
        query.index = storage.index;
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
    value: function(params, with_select) {
      with_select = arguments.length == 1 || with_select == true;
      let query = database.postgres().builder().from(this.table);
      let schema = this.config.schema;

      if ("limit" in params) {
        query.limit(parseInt(params.limit));
      }
      if ("start" in params) {
        query.offset(parseInt(params.start));
      }

      if (with_select && "sort" in params) {
        try {
          params.sort.split(",").forEach(function(field) {
            let direction = field[0] == "-" ? "desc" : "asc";
            field = field[0] == "-" ? field.substr(1) : field;

            if (field in schema) {
              query.orderBy(field, direction);
            }
          });
        } catch (e) {
          console.error(e.toString());
        }
      }

      Object.keys(schema).forEach(function(key) {
        let defs = schema[key];

        if (with_select) {
          if (this.config.translated) {
            query.select("translations");
          }
          query.select("field" in defs ? util.format("%s AS %s", defs.field, key) : key);
        }

        if (key in params) {
          let field = defs.field || key;
          let op = defs.filter == "prefix" ? "ilike" : "in";
          let value = defs.filter == "prefix" ? params[key] + "%" : params[key].split(",");

          if (defs.multilang && params.lang && params.lang != "fi") {
            let clause = util.format("translations->'%s'->>'%s' %s ?", params.lang, field, op);
            query.andWhere(database.postgres().builder().raw(clause, value));
          } else {
            query.andWhere(field, op, value);
          }
        }
      }, this);
      return query;
    }
  },
  search: {
    value: function(params) {
      let storage = this;
      return new Promise(function(resolve, reject) {
        let query = storage.compile(params);

        // Knex does not yet support clearing select list (requirement of PG),
        // so instead we have to recompile the query to get the count.
        let qcount = storage.compile(params, false).count();

        storage.query(query).then(function(result) {
          database.postgres().search(qcount).then(function(count) {
            resolve({
              type: storage.type,
              total: parseInt(count[0].count),
              items: result,
            });
          });
        });
      });
    }
  },
  query: {
    value: function(query) {
      let storage = this;
      return new Promise(function(resolve, reject) {
        database.postgres().search(query).then(function(result) {
          resolve(result.map(function(row) {
            return storage.mergeTranslations(row);
          }));
        });
      });
    }
  },
  mergeTranslations: {
    value: function(data) {
      if (!("trcache" in this.config)) {
        this.config.trcache = [];
        let schema = this.config.schema;
        for (let key in schema) {
          if (schema[key].multilang) {
            this.config.trcache.push(key);
          }
        }
      }

      let languages = config.api.languages;
      let defaultLang = config.api.default_language;
      let trfields = this.config.trcache;
      let trdata = data.translations || {};

      trfields.forEach(function(field) {
        languages.forEach(function(lang, i) {
          if (i == 0) {
            data[field] = {fi: data[field]};
          }
          let value = lang in trdata ? trdata[lang][field] : null;

          if ((value === null || value === undefined)) {
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

let OrganisationStorage = exports.OrganisationStorage = function() {
  ElasticStorage.apply(this, arguments);
}

OrganisationStorage.prototype = Object.create(ElasticStorage.prototype, {
  search: {
    value: function(params) {
      let storage = this;
      let query = this.compile(params);
      let promise = this.query(query);

      if (params.with.indexOf("schedules") == -1) {
        return promise;
      }

      return new Promise(function(resolve, reject) {
        promise.then(function(organisations) {
          const foo = {
            "period.start": params["period.start"] || "",
            "period.end": params["period.end"] || "",
            organisation: organisations.items.map(o => o.id).join(","),
            sort: "date",
            limit: 9999,
          };
          storage.searcher.search("opening_time", foo).then(function(schedules) {
            storage.mergeSchedules(organisations.items, schedules.items);
            resolve(organisations);
          }, reject);
        });
      });
    }
  },
  mergeSchedules: {
    value: function(organisations, schedules) {
      let cache = {};
      schedules.forEach(function(day) {
        if (!(day.organisation in cache)) {
          cache[day.organisation] = [];
        }
        cache[day.organisation].push(day);
        delete day.organisation;
      });
      organisations.forEach(function(organisation) {
        organisation.schedules = cache[organisation.id] || [];
      });
      // console.log(cache);
    }
  }
});

let LibraryStorage = exports.LibraryStorage = function() {
  OrganisationStorage.apply(this, arguments);
};

LibraryStorage.prototype = Object.create(OrganisationStorage.prototype, {
  search: {
    value: function(params) {
      if ("type" in params) {
        params.type += ",branchlibrary";
      } else {
        params.type = "branchlibrary";
      }
      return OrganisationStorage.prototype.search.call(this, params);
    }
  }
});
