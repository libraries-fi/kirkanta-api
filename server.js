"use strict";

let express = require("express");
let app = express();
let config = require("./config");
let authentication = require("./lib/authentication");
let controller = require("./lib/controller");
let encoders = require("./lib/encoders");
let searcher = require("./lib/searcher");
let util = require("util");

let server = app.listen(config.server.port, config.server.address, function() {
  console.log(util.format("Listening at %s:%d", server.address().address, server.address().port));
});

if (config.api.require_authentication) {
  app.use("/v3", authentication.apikey);
}

app.use("/v3", function(req, res, next) {
  req.query.format = req.query.format || "json";
  res.set('Access-Control-Allow-Origin', '*');
  next();
});

app.use("/v3", function(req, res, next) {
  req.query.with = "with" in req.query ? req.query.with.split(",") : [];
  next();
});

app.use("/v3", function(req, res, next) {
  if (!("limit" in req.query)) {
    req.query.limit = config.api.results_per_page;
  }
  next();
});

app.get("/", function(req, res) {
  // Index, documentation
  res.send("API INDEX");
});

app.get("/v3/help", controller.helpIndex);
app.get("/v3/help/:type", controller.helpType);

app.get("/v3/:type", function(req, res, next) {
  let types = searcher.searcher.types;
  if (types.indexOf(req.params.type) >= 0) {
    controller.list.apply(controller, arguments);
  } else {
    next();
  }
});

app.get("/v3/:type/:id", function(req, res, next) {
  let types = searcher.searcher.types;
  if (types.indexOf(req.params.type) >= 0) {
    controller.fetch.apply(controller, arguments);
  } else {
    next();
  }
});

app.get("/v3/library", function(req, res, next) {
  req.params.type = "organisation";
  req.query.type = (req.query.type + "," || "") + "library";
  controller.list.apply(controller, arguments);
});

app.get("/v3/library/:id", function(req, res, next) {
  req.params.type = "organisation";
  controller.fetch.apply(controller, arguments);
});

// app.get("/v3/:type", controller.list);
// app.get("/v3/:type/:id", controller.fetch);

app.get("*", function(req, res, next) {
  if ("result" in res.locals) {
    return next();
  }
  res.status(404).send("404 Not Found");
});

app.use(encoders.selectEncoder);
app.use(encoders.encodeResponse);

/**
 * Final handler for successful requests. Will write the response to the client.
 * If no data is present, will pass to the next middleware which prints and error.
 */
app.use(function(req, res, next) {
  if ("data" in res.locals) {
    res.status(res.locals.status).send(res.locals.data);
  } else {
    next();
  }
});

process.on("uncaughtException", function(err) {
  console.log("Exception", err);
});
