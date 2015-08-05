var express = require("express");
var app = express();
var config = require("./config");
var elastic = require("./lib/elastic");
var encoders = require("./lib/encoders");

var searcher = require("./lib/searcher");

app.listen(config.port, config.address, function() {
  console.log("Listening");
});

app.use(function(req, res, next) {
  req.query.lang = "fi";
  req.query.format = "json";
  next();
});

app.get("/", function(req, res) {
  // Index, documentation
  res.send("API INDEX");
});

app.get("/v3/:type", function(req, res, next) {
  console.log("SEARCH TYPE", req.params.type);

  searcher.create(req.params.type).search(req.query).then(function(result) {
    res.result = result;
    next();
  }, function(error) {
    res.send("error");
    console.error("ERROR", error);
  });
});

app.get("/v3/:type/:id", function(req, res, next) {
  searcher.create(req.params.type).search({id: req.params.id}).then(function(result) {
    res.result = result.hits[0];
    next();
  }, function(error) {
    res.send("error");
    console.error("ERROR", error);
  });
});

app.use(function(req, res, next) {
  if (res.result) {
    if (req.accepts("json")) {
      res.data = res.result;
      res.type("json");
    } else if (req.accepts("xml")) {
      res.data = "<data><list><row>First</row><row>Second</row></list></data>";
      res.type("xml");
    }
  }
  next();
});

app.use(function(req, res, next) {
  if (res.data) {
    res.send(res.data);
  } else {
    next();
  }
});

app.get("*", function(req, res) {
  res.status(404);
  res.send("404 Not Found");
});
