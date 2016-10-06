"use strict";

let AbstractStorage = require("../storage").AbstractStorage;
let Compiler = require("./compiler").Compiler;
let database = require("../database");

let NestedReferences = require("./references").NestedReferences;

class ElasticStorage extends AbstractStorage {
  constructor(config) {
    super(config);

    this.on("result", event => new Promise((resolve, reject) => {
      (new NestedReferences(this.config)).extract(event.result.items, {}).then((references) => {
        event.result.references = references;
        resolve(event);
      }, reject);
    }));

  }

  compile(params) {
    return (new Compiler(this.config)).compile(params);
  }

  query(query) {
    query.index = this.index;
    return database.elastic().search(query).then(response => {
      return {
        total: response.hits.total,
        type: this.type,
        items: response.hits.hits.map(item => item._source),
        // references: this.extractReferences(response.hits.hits, {}),
      };
    });
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

exports.Storage = ElasticStorage;
