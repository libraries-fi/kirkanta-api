"use strict";

let searcher = require("../searcher");

class NestedReferences {
  constructor(config) {
    this.config = config;
  }

  extract(result, references) {
    return new Promise((resolve, reject) => {
      let config = this.config.references || [];

      config.forEach(options => {
        if ("type" in options && options.type != "nested") {
          return;
        }

        let key = options.name;
        references[key] = {}

        result.forEach(data => {
          try {
            // let data = row._source;
            let path = options.field.split(".");
            let last = path.pop();

            while (path.length) {
              data = data[path.shift()];
            }

            let id = data[last][options.key || "id"];
            references[key][id] = data[last];
            data[last] = id;
            // row._source[key] = id;
            data[key] = id;
          } catch (err) {
            // pass
          }
        });
      });

      resolve(references);
    });
  }
}

class RelationReferences {
  constructor(config) {
    this.config = config;
    this.searcher = searcher;
  }

  extract(result, references) {
    let config = this.config.references || [];

    config.forEach(options => {
      if (options.type != "relation") {
        return;
      }
    });
  }
}

exports.NestedReferences = NestedReferences;
