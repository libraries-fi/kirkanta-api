"use strict";

let searcher = require("./searcher");

exports.list = function(req, res, next) {
  searcher.create(req.params.type).search(req.query).then(function(result) {
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
  searcher.create(req.params.type).searchOne(query).then(function(result) {
    res.locals.result = result;
    next();
  }, function(error) {
    res.send("error");
    console.error("ERROR", error);
  });
};
