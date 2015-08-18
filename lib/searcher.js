"use strict";

let config = require("../config");
let database = require("./database");
let events = require("events");
let Promise = require("promise");
let util = require("util");

let Result = function(type, data) {
  this.type = type;
  this.data = data;
};

Object.defineProperties(Result.prototype, {
  collection: {
    get: function() {
      return "total" in this.data && "items" in this.data;
    }
  },
  items: {
    get: function() {
      return this.data.items || null;
    }
  },
});

let Searcher = function() {
  this.events = new events.EventEmitter;
  this.storages = {};
};

Searcher.prototype = {
  searchOne: function(type, params) {
    let searcher = this;
    return new Promise(function(resolve, reject) {
      searcher.search(type, params).then(function(result) {
        resolve(new Result(result.type, result.items[0]));
      }, reject);
    });
  },
  search: function(type, params) {
    let searcher = this;
    return new Promise(function(resolve, reject) {
      let storage = searcher.storage(type);
      let query = storage.compile(params);

      storage.search(query).then(function(result) {
        searcher.events.emit("searcher.search", {
          type: type,
          params: params,
          result: result,
        });
        resolve(new Result(result.type, result));
      }, reject)
    });
  },
  addStorage: function(type, config) {
    switch (type) {
      case "elastic":
        this.storages[config.type] = new ElasticStorage(config);
        break;

      case "postgres":
        this.storages[config.type] = new PostgresStorage(config);
        break;
    }
  },
  addStorage2: function(storage) {
    this.storages[storage.type] = storage;
    return this;
  },
  storage: function(type) {
    if (!(type in this.storages)) {
      throw new Error("No storage for " + type);
    }
    return this.storages[type];
  }
};

let AbstractStorage = function(config) {
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

let ElasticStorage = function() {
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

let PostgresStorage = function() {
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

let searcher = exports.searcher = new Searcher;

searcher.addStorage("elastic", {
  type: "organisation",
  index: "library_directory",
  sections: ["services", "accessibility", "phone_numbers", "pictures", "links", "persons", "extra", "mail_address"],
  filters: {
    id: {
      query: "ids",
      field: "_id",
      multiple: true,
    },
    name: {
      query: "prefix",
      multilang: true,
    },
    city: {
      field: "address.city.id",
      filter: "terms",
      multiple: true,
    },
    "city.name": {
      filter: "terms",
      multilang: true,
      multiple: true,
      field: "address.city.name",
    },
    region: {
      field: "address.city.region.id",
      filter: "terms",
      multiple: true,
    },
    "region.name": {
      filter: "terms",
      multilang: true,
      multiple: true,
      field: "address.city.region.name",
    },
    consortium: {
      filter: "terms",
      multiple: true,
      field: "address.city.consortium.id"
    },
    service: {
      field: "services.id",
      filter: "terms",
      multiple: true,
    },
    "service.name": {
      field: "services.name",
      query: "prefix",
      multilang: true,
    },
    modified: {
      query: "range"
    },
    geo: {
      query: "function_score",
      callback: function(field, value, params) {
        let distance = util.format("%dkm", params.distance);
        return {
          filter: {
            geo_distance: {
              "address.coordinates": value,
              distance: distance,
            }
          },
          linear: {
            "address.coordinates": {
              origin: value,
              offset: "100m",
              scale: distance
            }
          }
        };

        return {
          distance: util.format("%dkm", params.distance || 10),
          "address.coordinates": params.geo,
        };
      }
    }
  },
  sorting: {
    distance: function(direction, params) {
      return "_score:desc";
    },
    name: function(direction, params) {
      return util.format("name.%s:%s", params.lang || "fi", direction);
    }
  },
});

searcher.addStorage("elastic", {
  type: "service",
  index: "library_directory",
  filters: {
    id: {
      query: "ids",
      field: "_id",
      multiple: true,
    },
  },
  sorting: {
    name: function(direction, params) {
      return util.format("name.%s:%s", params.lang || "fi", direction);
    }
  }
});

searcher.addStorage("elastic", {
  type: "person",
  index: "library_directory",
  filters: {
    id: {
      query: "ids",
      field: "_id",
      multiple: true,
    },
    first_name: {
      query: "prefix",
    },
    last_name: {
      query: "prefix",
    },
    name: {
      query: "bool",
      callback: function(field, value, params) {
        let query = {must:[]};

        value.trim().split(/\s+/).forEach(function(name) {
          query.must.push({
            bool: {
              should: [
                {
                  prefix: {
                    first_name: name
                  }
                },
                {
                  prefix: {
                    last_name: name
                  }
                }
              ]
            }
          });
        });
        return query;
      }
    },
  }
});

searcher.addStorage("postgres", {
  type: "consortium",
  table: "consortiums",
  filters: {
    id: {
      multiple: true
    },
    name: {
      translated: true,
      partial: true,
    },
  }
});

searcher.addStorage("postgres", {
  type: "region",
  table: "regions",
  filters: {
    id: {
      multiple: true
    },
    name: {
      translated: true,
      partial: true,
    },
  }
});

searcher.addStorage("postgres", {
  type: "city",
  table: "cities",
  filters: {
    id: {
      multiple: true
    },
    name: {
      multilang: true,
      partial: true,
    },
    consortium: {
      multiple: true,
      field: "consortium_id",
    },
    region: {
      multiple: true,
      field: "region_id",
    },
    provincial_library: {
      multiple: true,
      field: "provincial_library_id",
    },
  }
});

exports.search = function(type, params) {
  return searcher.search(type, params);
};

exports.searchOne = function(type, params) {
  return searcher.searchOne(type, params);
};
