"use strict";

var elastic = require("./elastic");
var Promise = require("promise");
var util = require("util");

var Searcher = function(compiler) {
  this.compiler = compiler;
};

Searcher.prototype = {
  search: function(params) {
    var compiler = this.compiler;
    return new Promise(function(resolve, reject) {
      var query = compiler.compile(params);

      elastic.client().search(query).then(function(result) {
        resolve(result.hits);
      }, function(error) {
        console.error("QUERY FAILED", error);
        reject(error);
      })
    });
  }
};

exports.create = function(type) {
  switch (type) {
    case "organisation":
      return new Searcher(new OrganisationSearchParams);

    case "person":
      return new Searcher(new PersonSearchParams);

      default:
        throw new Error("Invalid type " + type);
  }
};

var SearchParams = function(type, rules) {
  this.type = type;
  this.rules = rules;
};

SearchParams.prototype = {
  compile: function(params) {
    var request = {type: this.type, body: {
      // query: {
      //   term: {
      //     _id: "8gjGehpnQyyuM0XE9guWXw"
      //   }
      // }
    }};

    var queries = [];
    var filters = [];

    Object.keys(params).forEach(function(key) {
      if (!(key in this.rules)) {
        return;
      }

      var rule = this.rules[key];
      var value = rule.use_raw ? params[key] :
        rule.multiple ?
          params[key].split(",").map(val => val.trim().toLowerCase()) :
          params[key].trim().toLowerCase();
      // var value = params[key];
      var field = rule.field || key;

      if (rule.multilang) {
        field += "." + params.lang;
      }

      if (rule.query || rule.filter) {
        var callback = rule.callback || (rule.query ? Queries[rule.query] : Filters[rule.filter]);
        var query = {};
        query[rule.query || rule.filter] = callback.call(null, field, value, params);
        rule.query ? (queries.push(query)) : (filters.push(query));
      }

      // if (rule.query) {
      //   var q = {};
      //   q[rule.query] = Queries[rule.query].call(null, field, value);
      //   queries.push(q);
      // }
      //
      // if (rule.filter) {
      //   var f = {};
      //   f[rule.filter] = Filters[rule.filter].call(null, field, value);
      //   filters.push(f);
      // }


    }, this);

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

    console.log("REQUEST", JSON.stringify(request));

    // request.fields = ["name.fi"];
    return request;
  }
};

var generic = function(field, value) {
  var query = {};
  // query[field] = value.trim().toLowerCase();
  query[field] = value;
  return query;
};

// var multiValue = function(field, value) {
//   var query = {};
//   query[field] = value.split(",").map(v => v.trim().toLowerCase());
//   return query;
// };

var Queries = {
  ids: function(field, value) {
    return {
      values: value.split(",").map(v => v.trim()),
    }
  },
  prefix: generic,
};

var Filters = {
  terms: generic,
};

var OrganisationSearchParams = function() {
  SearchParams.call(this, "organisation", {
    id: {
      query: "ids",
      field: "_id",
      multiple: true,
      use_raw: true,
    },
    name: {
      query: "prefix",
      multilang: true,
    },
    city: {
      filter: "terms",
      multiple: true,
      multilang: true,
    },
    consortium: {
      filter: "terms",
      multiple: true,
    },
    service: {
      filter: "terms",
      multiple: true,
    },
    "service.name": {
      filter: "terms",
      multiple: true,
    },
    modified: {
      query: "range"
    },
    "geo": {
      filter: "geo_distance",
      field: "address.coordinates",
      callback: function(field, value, params) {
        var parts = value.split(",");

        return {
          distance: util.format("%dkm", params.distance || 10),
          "address.coordinates": params.geo,
        };
      }
    }
  });
};

OrganisationSearchParams.prototype = Object.create(SearchParams.prototype);

var PersonSearchParams = function() {
  SearchParams.call(this, "person", {

  });
};

PersonSearchParams.prototype = Object.create(SearchParams.prototype);
