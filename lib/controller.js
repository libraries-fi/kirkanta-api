"use strict";

let searcher = require("./searcher2");

exports.list = function(req, res, next) {
  searcher.search(req.params.type, req.query).then(function(result) {
    res.locals.result = result;
    next();
  }, function(error) {
    res.send("error");
    console.error("ERROR", error);
  });
};

exports.fetch = function(req, res, next) {
  let query = req.query;
  query.id = req.params.id;
  searcher.searchOne(req.params.type, query).then(function(result) {
    res.locals.result = result;
    next();
  }, function(error) {
    res.send("error");
    console.error("ERROR", error);
  });
};
