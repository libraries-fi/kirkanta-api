"use strict";

var config = require("../config");
var database = require("./database");
var events = require("events");
var Promise = require("promise");
var util = require("util");

var Searcher = function(type, filters, sorting, sections) {
  this.compiler = new SearchParams(type, filters, sorting, sections);
};

Searcher.prototype = {
  search: function(params) {
    var searcher = this;
    var compiler = this.compiler;
    return new Promise(function(resolve, reject) {
      var query = compiler.compile(params);

      database.elastic().search(query).then(function(result) {
        result.hits.type = compiler.type;
        resolve(searcher.normalize(result.hits));
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

var SearchParams = function(type, rules, sorting, sections) {
  this.type = type;
  this.rules = rules;
  this.sorting = sorting;
  this.sections = sections || [];
};

SearchParams.prototype = {
  compile: function(params) {
    var request = {type: this.type, body: {}};
    var queries = [];
    var filters = [];
    var include = ("with" in params) ? params.with.split(",") : [];
    var exclude = this.sections.filter(function(value) {
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

      var rule = this.rules[key];
      var field = rule.field || key;
      var value = rule.use_raw ? params[key] :
        rule.multiple ?
          params[key].split(",").map(val => val.trim().toLowerCase()) :
          params[key].trim().toLowerCase();

      if (rule.multilang) {
        field += "." + params.lang;
      }

      if (rule.query || rule.filter) {
        var callback = rule.callback || (rule.query ? Queries[rule.query] : Filters[rule.filter]);
        var query = {};
        query[rule.query || rule.filter] = callback.call(null, field, value, params);
        rule.query ? (queries.push(query)) : (filters.push(query));
      }
    }, this);

    if ("sort" in params) {
      var sorting = params.sort.split(",").map(function(key) {
        var direction = key[0] == "-" ? "desc" : "asc";
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

    console.log(JSON.stringify(request, null, 2));
    return request;
  }
};

var generic = function(field, value) {
  var query = {};
  query[field] = value;
  return query;
};

var Queries = {
  ids: function(field, value) {
    return {
      values: value,
    };
  },
  prefix: generic,
};

var Filters = {
  terms: generic,
};

var PgSearcher = function(type, table, rules) {
  this.type = type;
  this.table = table;
  this.rules = rules;

  this.events = new events.EventEmitter;
};

PgSearcher.prototype = {
  search: function(params) {
    var searcher = this;
    return new Promise(function(resolve, reject) {
      var query = searcher.compile(params);

      query.limit(params.limit || config.api.results_per_page);

      database.postgres().search(query).then(function(result) {
        query.count().then(function(foo) {
          resolve(searcher.normalize(searcher.type, result, foo));
        });
      });
    });
  },
  compile: function(params) {
    var query = database.postgres().builder().select().from(this.table);

    Object.keys(params).forEach(function(key) {
      if (!(key in this.rules)) {
        return;
      }

      var rule = this.rules[key];
      var op = rule.multiple ? "in" : (rule.partial ? "ilike" : "=");
      var value = rule.multiple ? params[key].split(",") : params[key];
      var field = rule.field || key;

      if (op == "ilike") {
        value += "%";
      }

      if (rule.multilang && params.lang && params.lang != "fi") {
        var clause = util.format("translations->'%s'->>'%s' %s ?", params.lang, field, op);
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
    var langs = config.api.languages;
    var trfields = config.trschema[this.type];
    var defaultLang = config.api.default_language;

      Object.keys(trfields).forEach(function(field, i) {
        if (i == 0) {
          data[field] = {fi: data[field]};
        }

        var trdata = data.translations || {};

        langs.forEach(function(lang) {
          var value = trdata[lang] ? trdata[lang][field] : null;
          if (value === null && trfields[field]) {
            value = data[field][defaultLang];
          }
          data[field][lang] = value;
        });
      });


      // trfields.forEach(function(prop, i) {
      //   langs.forEach(function(lang, i) {
      //     var trdata = data.translations[lang] || {};
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
            var distance = util.format("%dkm", params.distance);
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
            var query = {must:[]};

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

    default:
      throw new Error("Invalid type " + type);
  }
};
