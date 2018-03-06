"use strict";

let config = require("../config")
let database = require("./database");
let events = require("./events");
let util = require("util");

class AbstractStorage extends events.EventsAwareObject {
  constructor(config) {
    super(new events.AsyncEventManager);
    this.config = config;
    this.searcher = null;
  }

  compile(values) {
    throw new Error("AbstractStorage.compile()");
  }

  query(query) {
    throw new Error("AbstractStorage.query()");
  }

  search(params) {
    return this.query(this.compile(params)).then(result => {
      return this.emit("result", {params: params, result: result}).then(() => result);
    });
  }

  get type() {
    return this.config.type;
  }

  get transformableFields() {
    let schema = this.config.schema;
    let fields = Object.keys(schema).filter(name => "transform" in schema[name]);
    return fields;
  }
}

class ElasticStorage extends AbstractStorage {
  compile(params) {
    let request = {type: this.type, body: {}};
    let queries = [];
    let filters = [];
    let scripts = {};
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
          field += "." + (params.lang || config.api.default_language);
        }

        if (rule.query || rule.filter) {
          let callback = rule.callback || (rule.query ? ElasticStorage.Filters[rule.query] : ElasticStorage.Filters[rule.filter]);
          let query = {};
          query[rule.query || rule.filter] = callback.call(null, field, value, params);

          if (negate) {
            rule.query ? (not_queries.push(query)) : (not_filters.push(query));
          } else {
            rule.query ? (queries.push(query)) : (filters.push(query));
          }
        } else {
          throw new Error("Rule requires 'query' or 'filter'");
        }

        if (rule.script) {
          let script = rule.script.call(null, field, value, params);

          for (let key of Object.keys(script)) {
            scripts[key] = script[key];
          }
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

    if (Object.keys(scripts).length > 0) {
      request.body.script_fields = scripts;
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

  query(query) {
    query.index = this.index;

    return database.elastic().search(query)
      .then(response => {
        // Custom fields are provided by e.g. scripts.

        if (item.fields) {
          response.hits.hits.forEach(item => {
            for (let field of Object.keys(item.fields)) {
              item._source[field] = item.fields[field][0];
            }
          });
        }

        return response;
      })
      .then(response => ({
        total: response.hits.total,
        type: this.type,
        items: response.hits.hits.map(item => item._source),
        references: this.extractReferences(response.hits.hits),
      }));
  }

  extractReferences(result) {
    let references = {};
    let config = this.config.references || [];

    config.forEach(options => {
      let key = options.name;
      references[key] = {}

      result.forEach(row => {
        try {
          let data = row._source;
          let path = options.field.split(".");
          let last = path.pop();

          while (path.length) {
            data = data[path.shift()];
          }

          let id = data[last][options.key || "id"];
          references[key][id] = data[last];
          data[last] = id;
          row._source[key] = id;
        } catch (err) {
          // pass
        }
      });
    });
    return references;
  }

  get index() {
    return this.config.index;
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
}

exports.ElasticStorage = ElasticStorage;

let generic = function(field, value) {
  let query = {};
  query[field] = value;
  return query;
};

ElasticStorage.Filters = {
  ids: (field, value) => ({
    values: value,
  }),
  term: generic,
  terms: generic,
  prefix: generic,
  match_phrase_prefix: generic,
};

class PostgresStorage extends AbstractStorage {
  constructor(config) {
    super(config);
    this.on("load", entity => this.mergeTranslations(entity));
  }

  compile(params, with_select) {
    with_select = arguments.length == 1 || with_select == true;
    let query = database.postgres().builder().from(this.table);
    let schema = this.config.schema;

    if ("join" in this.config) {
      this.config.join.forEach(join => {
        switch (join.type) {
          case "left_join":
            query.leftJoin(join.to, join.left, join.right);
            break;
        }
      });
    }

    if ("limit" in params) {
      query.limit(parseInt(params.limit));
    }
    if ("skip" in params) {
      query.offset(parseInt(params.skip));
    }

    if (with_select) {
      if ("sort" in params) {
        try {
          params.sort.split(",").forEach(field => {
            let direction = field[0] == "-" ? "desc" : "asc";
            field = field[0] == "-" ? field.substr(1) : field;

            if (field in schema) {
              query.orderBy(field, direction);
            }
          });
        } catch (e) {
          console.error(e.toString(), e.stack);
        }
      }
      if (this.config.translated) {
        query.select(this.table + ".translations");
      }
    }

    Object.keys(schema).forEach(key => {
      let defs = schema[key];

      if (!defs.virtual && with_select) {
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
    });

    let event = {query: query};
    this.emit("query", event);
    return event.query;
  }

  search(params) {
    let query = this.compile(params);

    // Knex does not yet support clearing select list (requirement of PG),
    // so instead we have to recompile the query to get the count.
    let qcount = this.compile(params, false).count();

    return Promise.all([this.query(query), database.postgres().search(qcount)]).then(results => ({
      type: this.type,
      total: parseInt(results[1][0].count),
      items: results[0],
    }));
  }

  query(query) {
    let index = 0;

    let apply_transforms = result => {
      if (index < result.length) {
        return this.emit("load", result[index++]).then(() => apply_transforms(result));
      }
      return result;
    };

    return database.postgres().search(query).then(result => apply_transforms(result));
  }

  mergeTranslations(data) {
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

    trfields.forEach(field => {
      languages.forEach((lang, i) => {
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

  get table() {
    return this.config.table;
  }

  get rules() {
    return this.config.filters;
  }
}

exports.PostgresStorage = PostgresStorage;
