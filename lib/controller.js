"use strict";

let searcher = require("./searcher");
let util = require("util");

exports.list = function(req, res, next) {
  searcher.search(req.params.type, req.query).then(function(result) {
    res.locals.result = result;
    next();
  }, function(error) {
    res.send(error.toString());
    console.error("ERROR", error, error.stack);
  });
};

exports.fetch = function(req, res, next) {
  let query = req.query;
  query.id = req.params.id;
  searcher.searchOne(req.params.type, query).then(function(result) {
    res.locals.result = result;
    next();
  }, function(error) {
    res.send(error.toString());
    console.error("ERROR", error, error.stack);
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
