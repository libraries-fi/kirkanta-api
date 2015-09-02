"use strict";

let config = require("../config");
let moment = require("moment");
let Promise = require("promise");
let storage = require("./storage");
let util = require("util");

let Result = exports.Result = function(type, data) {
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
      searcher.storage(type).search(params).then(function(result) {
        resolve(new Result(result.type, result));
      }, reject)
    });
  },
  addStorage: function(storage) {
    storage.searcher = this;
    this.storages[storage.type] = storage;
    return storage;
  },
  storage: function(type) {
    if (!(type in this.storages)) {

      console.log(Object.keys(this.storages));

      throw new Error("No storage for " + type);
    }
    return this.storages[type];
  }
};

Object.defineProperties(Searcher.prototype, {
  types: {
    get: function() {
      return Object.keys(this.storages);
    }
  }
});

let searcher = exports.searcher = new Searcher;

searcher.addStorage(new storage.OrganisationStorage({
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
}));

searcher.addStorage(new storage.ElasticStorage({
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
}));

searcher.addStorage(new storage.ElasticStorage({
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
}));

searcher.addStorage(new storage.ElasticStorage({
  type: "opening_time",
  index: "libdir_schedules",
  filters: {
    "schedules.start": {
      filter: "range",
      field: "date",
      callback: function(field, value, params) {
        let range = {};
        range[field] = {
          "gte": value || moment().startOf("isoWeek").format("YYYY-MM-DD")
        };
        return range;
      }
    },
    "schedules.end": {
      filter: "range",
      field: "date",
      callback: function(field, value, params) {
        let range = {};
        range[field] = {
          "lte": value || moment().endOf("isoWeek").format("YYYY-MM-DD")
        };
        return range;
      }
    },
    organisation: {
      filter: "terms",
      field: "organisation",
      multiple: true,
    }
  }
}));

searcher.addStorage(new storage.PostgresStorage({
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
}));

searcher.addStorage(new storage.PostgresStorage({
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
}));

searcher.addStorage(new storage.PostgresStorage({
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
}));

exports.storageFor = function(type) {
  return searcher.storage(type);
};

exports.search = function(type, params) {
  return searcher.search(type, params);
};

exports.searchOne = function(type, params) {
  return searcher.searchOne(type, params);
};
