"use strict";

let util = require("util");

class Compiler {
  constructor(config) {
    this.config = config;
  }

  get defaultLanguage() {
    return this.config.default_language;
  }

  get rules() {
    return this.config.filters;
  }

  get sorting() {
    return this.config.sorting || {};
  }

  get sections() {
    return this.config.sections || [];
  }

  compile(params) {
    let request = {type: this.type, body: {}};
    let queries = [];
    let filters = [];
    let not_queries = [];
    let not_filters = [];
    let include = params.with || [];
    let exclude = this.sections.filter(value => include.indexOf(value) == -1);

    if (exclude.length) {
      request._sourceExclude = exclude;
    }

    if ("limit" in params) {
      request.size = parseInt(params.limit);
    }

    if ("skip" in params) {
      request.from = parseInt(params.skip);
    }

    try {
      Object.keys(params).forEach(key => {
        let negate = key.substr(-1) == '-';
        let field = negate ? key.substr(0, key.length - 1) : key;

        if (!(field in this.rules)) {
          return;
        }

        if (params[key] == undefined) {
          console.error("UNDEF", params[key], key);
        }

        let rule = this.rules[field];
        field = rule.field || field;

        let value = rule.use_raw ? params[key] :
          rule.multiple ?
            params[key].split(",").map(val => val.trim().toLowerCase()) :
            params[key].trim().toLowerCase();

        if (rule.multilang) {
          field += "." + (params.lang || this.defaultLanguage);
        }

        if (rule.query || rule.filter) {
          let callback = rule.callback || (rule.query ? Filters[rule.query] : Filters[rule.filter]);
          let query = {};
          query[rule.query || rule.filter] = callback.call(null, field, value, params);

          if (negate) {
            rule.query ? (not_queries.push(query)) : (not_filters.push(query));
          } else {
            rule.query ? (queries.push(query)) : (filters.push(query));
          }
        } else {
          throw new Error("Rule requires 'query' or 'filters'");
        }
      });
    } catch (error) {
      console.error(error);
      throw new Error("Crashed while processing search parameters. Please check for duplicate parameters in query string.");
    }

    if ("sort" in params) {
      let sorting = params.sort.split(",").map(key => {
        let direction = key[0] == "-" ? "desc" : "asc";
        key = key[0] == "-" ? key.substr(1) : key;

        if (key in this.sorting) {
          let mapping = this.sorting[key];
          if (typeof mapping == "function") {
            return mapping(direction, params);
          } else if (typeof mapping == "string") {
            return util.format("%s:%s", mapping, direction);
          } else {
            return util.format("%s:%s", key, direction);
          }
        } else if (key in this.rules) {
          let mapping = this.rules[key];
          let field = mapping.field || key;
          if (mapping.multilang) {
            field += "." + (params.lang || config.api.default_language);
          }
          return util.format("%s:%s", field, direction);
        }
      });

      request.sort = sorting;
    }
    request.body.query = {
      bool: {
        must: queries,
        must_not: not_queries
      }
    };
    request.body.filter = {
      bool: {
        must: filters,
        must_not: not_filters,
      }
    };
    // console.log(JSON.stringify(request.body, null, 2) + "\n");
    return request;

  }
}

let generic = function(field, value) {
  let query = {};
  query[field] = value;
  return query;
};

let Filters = {
  ids: (field, value) => ({
    values: value,
  }),
  term: generic,
  terms: generic,
  prefix: generic,
  match_phrase_prefix: generic,
};

exports.Compiler = Compiler;
