"use strict";

let config = require("../config");
let EventEmitter = require("events");
let moment = require("moment");
let storage = require("./storage");
let util = require("util");

class Result {
  constructor(type, data, status) {
    this.type = type;
    this.data = data;
    this.status = status || 200;
  }

  get collection() {
    return "total" in this.data && "items" in this.data;
  }

  get items() {
    return this.data.items || {};
  }

  get references() {
    return this.data.references || {};
  }
}

exports.Result = Result;

class Searcher {
  constructor() {
    this.storages = new Map;
  }

  searchOne(type, params) {
    return this.search(type, params).then(result => {
      return new Result(result.type, result.items[0]);
    });
  }

  search(type, params) {
    return this.storage(type).search(params).then(result => {
      return new Result(result.type, result);
    });
  }

  addStorage(storage) {
    storage.searcher = this;
    this.storages.set(storage.type, storage);
    return storage;
  }

  storage(type) {
    if (!this.storages.has(type)) {
      throw new Error("No storage for " + type);
    }
    return this.storages.get(type);
  }

  get types() {
    return [...this.storages.keys()];
  }
}

let searcher = exports.searcher = new Searcher;

let dateRange = function(operator, field, value) {
  return {
    [field]: {
      [operator]: value
    }
  };
};

let dateAfter = dateRange.bind(null, "gte");
let dateBefore = dateRange.bind(null, "lte");

let organisations = searcher.addStorage(new storage.ElasticStorage({
  type: "organisation",
  index: config.elastic.index,
  sections: ["services", "accessibility", "phone_numbers", "pictures", "links", "persons", "extra", "mail_address", "meta", "_internal"],
  references: [
    {
      name: "region",
      field: "city.region",
    },
    {
      name: "consortium",
      field: "city.consortium",
    },
    {
      name: "provincial_library",
      field: "city.provincial_library",
    },
    {
      name: "city",
      field: "city",
    }
  ],
  filters: {
    id: {
      query: "ids",
      field: "_id",
      multiple: true,
    },
    parent: {
      query: "terms",
      multiple: true,
    },
    name: {
      query: "match_phrase_prefix",
      multilang: true,
    },
    short_name: {
      query: "match_phrase_prefix",
      multilang: true,
    },
    slug: {
      filter: "terms",
      multilang: true,
      multiple: true,
      field: "slug",
    },
    city: {
      field: "city.id",
      filter: "terms",
      multiple: true,
    },
    "city.name": {
      filter: "terms",
      multilang: true,
      multiple: true,
      field: "city.name",
    },
    "city.slug": {
      filter: "terms",
      multilang: true,
      multiple: true,
      field: "city.slug",
    },
    branch_type: {
      filter: "terms",
      multiple: true,
    },
    type: {
      filter: "terms",
      multiple: true,
    },
    region: {
      field: "city.region.id",
      filter: "terms",
      multiple: true,
    },
    "region.name": {
      filter: "terms",
      multilang: true,
      multiple: true,
      field: "city.region.name",
    },
    "region.slug": {
      filter: "terms",
      multilang: true,
      multiple: true,
      field: "city.region.slug",
    },
    consortium: {
      filter: "terms",
      multiple: true,
      field: "_internal.consortium.id"
    },
    "consortium.name": {
      filter: "terms",
      multiple: true,
      multilang: true,
      field: "_internal.consortium.name",
    },
    "consortium.slug": {
      filter: "terms",
      multiple: true,
      multilang: true,
      field: "_internal.consortium.slug",
    },
    service: {
      field: "services.id",
      filter: "terms",
      multiple: true,
    },
    "service.name": {
      field: "services.name",
      query: "match_phrase_prefix",
      multilang: true,
    },
    "service.slug": {
      field: "services.slug",
      query: "terms",
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
      callback: (field, value, params) => {
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
    modified: "meta.modified",
    created: "meta.created",
    distance: (direction, params) => {
      return "_score:desc";
    },
    name: (direction, params) => {
      return util.format("name.%s.raw:%s", params.lang || "fi", direction);
    },
    short_name: (direction, params) => {
      return util.format("short_name.%s.raw:%s", params.lang || "fi", direction);
    }
  },
}));

organisations.on("result", event => {
  if (event.params.with.indexOf("schedules") != -1) {
    let params = {
      "period.start": event.params["period.start"] || "",
      "period.end": event.params["period.end"] || "",
      sort: "date",
      limit: 9999,
      organisation: event.result.items.map(o => o.id).join(","),
      refs: event.params.refs
    };

    return searcher.search("opening_time", params).then(result => {
      let organisations = event.result.items;
      let schedules = result.items;
      let cache = new Map;
      schedules.forEach(day => {
        if (!cache.has(day.organisation)) {
          cache.set(day.organisation, []);
        }
        cache.get(day.organisation).push(day);
        delete day.organisation;
      });
      organisations.forEach(organisation => {
        organisation.schedules = cache.get(organisation.id) || [];
      });
      Object.keys(result.references).forEach(key => {
        event.result.references[key] = result.references[key];
      })
    });
  }
});

organisations.on("result", event => {
  if (event.params.refs.indexOf("consortium") != -1) {
    let refs = event.result.references.consortium = {};
    let cids = event.result.items
      .map(organisation => organisation.consortium)
      .filter(id => id)
      .join(", ");

    if (cids) {
      return searcher.search("consortium", {id: cids, limit: 9999})
        .then(result => result.items.map(consortium => {
          refs[consortium.id] = consortium;
        }));
    }
  }
});

searcher.addStorage(new storage.ElasticStorage({
  type: "service",
  index: config.elastic.index,
  filters: {
    id: {
      query: "ids",
      field: "_id",
      multiple: true,
    },
    name: {
      query: "match_phrase_prefix",
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
    name: (direction, params) => {
      return util.format("name.%s.raw:%s", params.lang || "fi", direction);
    }
  }
}));

searcher.addStorage(new storage.ElasticStorage({
  type: "person",
  index: config.elastic.index,
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
      callback: (field, value, params) => {
        let query = {must:[]};

        value.trim().split(/\s+/).forEach(name => {
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
    name: (direction, params) => {
      return util.format("name.%s:%s", params.lang || "fi", direction);
    }
  }
}));

let isRelativeDate = function(value) {
  if (!value) {
    return false;
  } else if (value == "today") {
    return true;
  } else {
    return value.search(/^-?\d+[dwm]$/) != -1;
  }
};

let compileRelativeDate = function(value, filter) {
  if (value == "today") {
    return moment();
  }
  let units = new Map([["d", "days"], ["w", "weeks"], ["m", "months"]]);
  let num = parseInt(value, 10);
  let unit = units.get(value.substr(-1));
  let date = moment().add(num, unit);
  return filter ? filter(date, num, unit) : date;
}

let periodDateRange = function(operator, field, value) {
  if (isRelativeDate(value)) {
    let date = compileRelativeDate(value, (date, num, unit) => {
      if (unit == "weeks") {
        operator == "gte" ? date.startOf("isoweek") : date.endOf("isoweek");
      } else if (unit == "months") {
        operator == "gte" ? date.startOf("month") : date.endOf("month");
      }
      return date;
    });

    value = date.format("YYYY-MM-DD");
  }
  return dateRange(operator, field, value);
};

let schedules = searcher.addStorage(new storage.ElasticStorage({
  type: "opening_time",
  index: "libdir_schedules",
  sections: ["meta"],
  filters: {
    "period.start": {
      filter: "range",
      field: "date",
      callback: function(field, value) {
        return periodDateRange("gte", field, value || moment().startOf("isoWeek").format("YYYY-MM-DD"));
      }
    },
    "period.end": {
      filter: "range",
      field: "date",
      callback: function(field, value) {
        return periodDateRange("lte", field, value || moment().endOf("isoWeek").format("YYYY-MM-DD"));
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

schedules.on("result", event => {
  if (event.params.refs.indexOf("period") != -1) {
    let cache = new Set;

    event.result.items.map(day => {
      // Mobile libraries have no "sections".
      if ("sections" in day) {
        Object.keys(day.sections).map(section => cache.add(day.sections[section].period));
      }
      cache.add(day.period);
    });


    if (cache.size > 0) {
      let pids = [...cache.values()].join(",");

      return searcher.search("period", {id: pids, limit: 9999}).then(result => {
        let periods = {};

        result.items.forEach(period => {
          periods[period.id] = period;
        });

        event.result.references = {period: periods};
      });
    } else {
      event.result.references = {period: []};
    }
  }
});

searcher.addStorage(new storage.PostgresStorage({
  type: "city",
  table: "cities",
  translated: true,
  schema: {
    id: {
      filter: "terms",
    },
    name: {
      query: "prefix",
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

let consortiums = searcher.addStorage(new storage.PostgresStorage({
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
    description: {
      multilang: true
    },
    logo: { }
  }
}));

let periods = searcher.addStorage(new storage.PostgresStorage({
  type: "period",
  table: "periods",
  translated: true,
  schema: {
    id: {
      filter: "terms",
    },
    name: {
      filter: "prefix",
      multilang: true,
    },
    description: {
      multilang: true
    },
    valid_from: {},
    valid_until: {},
    organisation: {
      field: "organisation_id"
    },
  }
}));

periods.on("query", event => {
  event.query.andWhere("organisation_id", "IS NOT", null);
});

periods.on("load", period => {
  if (period.valid_from) {
    period.valid_from = moment(period.valid_from).format("YYYY-MM-DD");
  }
  if (period.valid_until) {
    period.valid_until = moment(period.valid_until).format("YYYY-MM-DD");
  }
});

consortiums.on("load", consortium => {
  let filename = consortium.logo;

  if (filename) {
    let urls = {};
    ["small", "medium"].forEach(size => {
      urls[size] = util.format("%s/%s/%s", config.api.resource_url, size, filename);
    });
    consortium.logo = urls;
  } else {
    consortium.logo = null;
  }
});

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
