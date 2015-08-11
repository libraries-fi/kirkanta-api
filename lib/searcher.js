"use strict";

let config = require("../config");
let database = require("./database");
let events = require("events");
let Promise = require("promise");
let util = require("util");

let Searcher = function(type, filters, sorting, sections) {
  this.compiler = new SearchParams(type, filters, sorting, sections);
};

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

Searcher.prototype = {
  search: function(params) {
    let searcher = this;
    let compiler = this.compiler;
    return new Promise(function(resolve, reject) {
      let query = compiler.compile(params);

      database.elastic().search(query).then(function(result) {
        result.hits.type = compiler.type;
        resolve(new Result(compiler.type, searcher.normalize(result.hits)));
      }, function(error) {
        console.error("QUERY FAILED", error);
        reject(error);
      })
    });
  },
  normalize: function(result) {
    return {
      total: result.total,
      type: result.type,
      items: result.hits.map(function(item) {
        return item._source;
      })
    };
  }
};

let SearchParams = function(type, rules, sorting, sections) {
  this.type = type;
  this.rules = rules;
  this.sorting = sorting;
  this.sections = sections || [];
};

SearchParams.prototype = {
  compile: function(params) {
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
        let callback = rule.callback || (rule.query ? Queries[rule.query] : Filters[rule.filter]);
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
};

let generic = function(field, value) {
  let query = {};
  query[field] = value;
  return query;
};

let Queries = {
  ids: function(field, value) {
    return {
      values: value,
    };
  },
  prefix: generic,
};

let Filters = {
  terms: generic,
};

let PgSearcher = function(type, table, rules) {
  this.type = type;
  this.table = table;
  this.rules = rules;

  this.events = new events.EventEmitter;
};

PgSearcher.prototype = {
  search: function(params) {
    let searcher = this;
    return new Promise(function(resolve, reject) {
      let query = searcher.compile(params);

      query.limit(params.limit || config.api.results_per_page);

      database.postgres().search(query).then(function(result) {
        query.count().then(function(foo) {
          resolve(new Result(searcher.type, searcher.normalize(searcher.type, result, foo)));
        });
      });
    });
  },
  compile: function(params) {
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
  },
  normalize: function(type, result, count) {
    return {
      total: count[0].count,
      type: type,
      items: result.map(function(row) {
        return this.mergeTranslations(row);
      }, this),
    }
  },
  mergeTranslations: function(data) {
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


      // trfields.forEach(function(prop, i) {
      //   langs.forEach(function(lang, i) {
      //     let trdata = data.translations[lang] || {};
      //     if (i == 0) {
      //       console.log(">", data[prop]);
      //       data[prop] = {fi: data[prop]};
      //     }
      //     data[prop][lang] = trdata[prop];
      //   });
      // });
    delete data.translations;
    return data;
  }
};

exports.create = function(type) {
  switch (type) {
    case "organisation":
      return new Searcher("organisation", {
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
      }, {
        distance: function(direction, params) {
          return "_score:desc";
        },
        name: function(direction, params) {
          return util.format("name.%s:%s", params.lang || "fi", direction);
        }
      },
      ["services", "accessibility", "phone_numbers", "pictures", "links", "persons", "extra"]);

    case "person":
      return new Searcher("person", {
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
      });

    case "service":
      return new Searcher("service", {
        id: {
          query: "ids",
          field: "_id",
          multiple: true,
        },
      });

    case "city":
      return new PgSearcher("city", "cities", {
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
      });

    case "region":
      return new PgSearcher("region", "regions", {
        id: {
          multiple: true
        },
        name: {
          translated: true,
          partial: true,
        },
      });

    case "consortium":
      return new PgSearcher("consortium", "consortiums", {
        id: {
          multiple: true
        },
        name: {
          translated: true,
          partial: true,
        },
      });

    default:
      throw new Error("Invalid type " + type);
  }
};
