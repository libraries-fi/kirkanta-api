"use strict";

let express = require("express");
let app = express();
let config = require("./config");
let authentication = require("./lib/authentication");
let controller = require("./lib/controller");
let encoders = require("./lib/encoders");
let util = require("util");

let server = app.listen(config.server.port, config.server.address, function() {
  console.log(util.format("Listening at %s:%d", server.address().address, server.address().port));
});

if (config.api.require_authentication) {
  app.use("/v3", authentication.apikey);
}

app.use("/v3", function(req, res, next) {
  req.query.lang = req.query.lang || "fi";
  req.query.format = req.query.format || "json";
  next();
});

app.get("/", function(req, res) {
  // Index, documentation
  res.send("API INDEX");
});

app.get("/v3/:type", controller.list);
app.get("/v3/:type/:id", controller.fetch);

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
    res.send(res.locals.data);
  } else {
    next();
  }
});

process.on("uncaughtException", function(err) {
  console.log("Exception", err);
});
