"use strict";

let searcher = require("./searcher");
let util = require("util");

exports.list = function(req, res, next) {
  searcher.search(req.params.type, req.query).then(result => {
    res.locals.result = result;
    next();
  }, error => {
    res.status(500).send(error.toString());
    console.error("controller.list:", error.stack);
  });
};

exports.fetch = function(req, res, next) {
  let query = req.query;
  query.id = req.params.id;
  searcher.searchOne(req.params.type, query).then(result => {
    if (result.data) {
      res.locals.result = result;
    } else {
      res.locals.result = new searcher.Result("error", {
        error: util.format("Object with ID %s could not found.", req.params.id)
      }, 404);
    }
    next();
  }, error => {
    res.status(500).send(error.toString());
    console.error("controller.fetch", error.stack);
  });
};

exports.helpIndex = function(req, res, next) {
  let types = searcher.searcher.types.sort();

  res.locals.result = new searcher.Result("help", {
    types: types,
    paths: Array.prototype.concat.apply([], types.map(type => [
      util.format("/v3/%s", type),
      util.format("/v3/%s/:id", type)
    ]))
  });
  next();
};

exports.helpType = function(req, res, next) {
  let config = searcher.storageFor(req.params.type).config;
  res.locals.result = new searcher.Result("help", {
    type: req.params.type,
    sections: config.sections.sort(),
    filter: Object.keys(config.filters).sort(),
    sorting: Object.keys(config.sorting).sort(),
  });
  next();
};
