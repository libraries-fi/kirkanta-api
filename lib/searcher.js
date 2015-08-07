"use strict";

var elastic = require("./elastic");
var Promise = require("promise");
var util = require("util");

var Searcher = function(compiler) {
  this.compiler = compiler;
};

Searcher.prototype = {
  search: function(params) {
    var searcher = this;
    var compiler = this.compiler;
    return new Promise(function(resolve, reject) {
      var query = compiler.compile(params);

      elastic.client().search(query).then(function(result) {
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

var organisationSearchParams = new SearchParams("organisation", {
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
    filter: "terms",
    multiple: true,
    multilang: true,
    field: "address.city",
  },
  consortium: {
    filter: "terms",
    multiple: true,
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
},
{
  distance: function(direction, params) {
    return "_geo_distance:" + direction;
    return {
      _geo_distance: {
        unit: "km",
        order: direction,
        "address.coordinates": params.geo,
      }
    }
  },
  name: function(direction, params) {
    return util.format("name.%s:%s", params.lang || "fi", direction);
  }
},
[
  "services", "accessibility", "phone_numbers", "pictures", "links", "persons", "extra"
]);

var serviceSearchParams = new SearchParams("service", {
  id: {
    query: "ids",
    field: "_id",
    multiple: true,
  },
}, {

});

var personSearchParams = new SearchParams("person", {
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
},
{

});

exports.create = function(type) {
  switch (type) {
    case "organisation":
      return new Searcher(organisationSearchParams);

    case "person":
      return new Searcher(personSearchParams);

    case "service":
      return new Searcher(serviceSearchParams);

    default:
      throw new Error("Invalid type " + type);
  }
};
