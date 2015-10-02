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

let dateRange = function(op, field, value, params) {
  console.log("TEST", arguments);
  let filter = {};
  filter[field] = {};
  filter[field][op] = value;
  return filter;
};

// let modifiedAfter = function(field, value, params) {
//   let filter = [];
//   filter[field] = {
//     gte: value,
//   }
//   return filter;
// };
//
// let modifiedBefore = function(op, field, value, params) {
//   let filter = [];
//   filter[field] = {
//     lte: value,
//   }
//   return filter;
// };

let dateAfter = dateRange.bind(null, "gte");
let dateBefore = dateRange.bind(null, "lte");

searcher.addStorage(new storage.OrganisationStorage({
  type: "organisation",
  index: "library_directory",
  sections: ["services", "accessibility", "phone_numbers", "pictures", "links", "persons", "extra", "mail_address", "meta"],
  references: {

  },
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
    branch_type: {
      filter: "terms",
      multiple: true,
    },
    type: {
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
    "consortium.slug": {
      filter: "terms",
      multiple: true,
      multilang: true,
      field: "address.city.consortium.slug",
    },
    "consortium.name": {
      filter: "terms",
      multiple: true,
      multilang: true,
      field: "address.city.consortium.name",
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
    "modified.after": {
      field: "meta.modified",
      filter: "range",
      callback: dateAfter,
    },
    "modified.before": {
      field: "meta.modified",
      filter: "range",
      callback: dateBefore,
    },
    "created.after": {
      field: "meta.modified",
      filter: "range",
      callback: dateAfter,
    },
    "created.before": {
      field: "meta.modified",
      filter: "range",
      callback: dateBefore,
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
      }
    }
  },
  sorting: {
    id: true,
    parent: true,
    type: true,
    branch_type: true,
    "consortium.id": true,
    modified: "meta.modified",
    created: "meta.created",
    "city.id": function(direction, params) {
      return util.format("address.city.id:%s", direction);
    },
    distance: function(direction, params) {
      return "_score:desc";
    },
    name: function(direction, params) {
      return util.format("name.%s.raw:%s", params.lang || "fi", direction);
    },
    short_name: function(direction, params) {
      return util.format("short_name.%s.raw:%s", params.lang || "fi", direction);
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
    name: {
      query: "prefix",
      multilang: true,
    },
    type: {
      query: "terms",
      multiple: true,
    },
    slug: {
      query: "terms",
      multilang: true,
      multiple: true,
    },
    "modified.after": {
      field: "meta.modified",
      filter: "range",
      callback: dateAfter,
    },
    "modified.before": {
      field: "meta.modified",
      filter: "range",
      callback: dateBefore,
    },
    "created.after": {
      field: "meta.modified",
      filter: "range",
      callback: dateAfter,
    },
    "created.before": {
      field: "meta.modified",
      filter: "range",
      callback: dateBefore,
    },
    "helmet:type_priority": {
      field: "helmet_type_priority",
      filter: "terms",
      multiple: true,
    }
  },
  sorting: {
    id: true,
    type: true,
    modified: "meta.modified",
    created: "meta.created",
    name: function(direction, params) {
      return util.format("name.%s.raw:%s", params.lang || "fi", direction);
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
    organisation: {
      query: "terms",
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
  },
  sorting: {
    id: true,
    first_name: true,
    last_name: true,
    organisation: true,
    name: function(direction, params) {
      return util.format("name.%s:%s", params.lang || "fi", direction);
    }
  }
}));

searcher.addStorage(new storage.ElasticStorage({
  type: "opening_time",
  index: "libdir_schedules",
  filters: {
    "period.start": {
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
    "period.end": {
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
  },
  sorting: {
    organisation: true,
    date: true,
  }
}));

searcher.addStorage(new storage.PostgresStorage({
  type: "city",
  table: "cities",
  translated: true,
  schema: {
    id: {
      filter: "terms",
    },
    name: {
      filter: "prefix",
      multilang: true,
    },
    slug: {
      filter: "terms",
      multilang: true,
    },
    consortium: {
      field: "consortium_id",
      filter: "terms",
    },
    region: {
      field: "region_id",
      filter: "terms"
    },
    provincial_library: {
      field: "provincial_library_id",
      filter: "terms",
    },
  },
}));

searcher.addStorage(new storage.PostgresStorage({
  type: "consortium",
  table: "consortiums",
  translated: true,
  schema: {
    id: {
      filter: "terms",
    },
    name: {
      filter: "prefix",
      multilang: true,
    },
    slug: {
      filter: "terms",
      multilang: true,
    },
  }
}));

searcher.addStorage(new storage.PostgresStorage({
  type: "region",
  table: "regions",
  translated: true,
  schema: {
    id: {
      filter: "terms",
    },
    name: {
      filter: "prefix",
      multilang: true,
    },
    slug: {
      filter: "terms",
      multilang: true,
    },
  }
}));

searcher.addStorage(new storage.PostgresStorage({
  type: "provincial_library",
  table: "provincial_libraries",
  translated: true,
  schema: {
    id: {
      filter: "terms",
    },
    name: {
      filter: "prefix",
      multilang: true,
    },
    slug: {
      filter: "terms",
      multilang: true,
    },
    province: {
      multilang: true,
    }
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
