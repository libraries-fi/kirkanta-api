"use strict";

let CONFIG = require("../config")
let database = require("./database");
let events = require("./events");
let util = require("util");

class AbstractStorage extends events.EventsAwareObject {
  constructor(config) {
    super(new events.AsyncEventManager);
    this.config = config;
    this.config.default_language = CONFIG.api.default_language;
    this.searcher = null;

    this.manipulators = [];
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

exports.AbstractStorage = AbstractStorage;

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

    let languages = CONFIG.api.languages;
    let defaultLang = CONFIG.api.default_language;
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
