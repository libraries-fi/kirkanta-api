var express = require("express");
var app = express();
var config = require("./config");
var encoders = require("./lib/encoders");
var controller = require("./lib/controller");

app.listen(config.server.port, config.server.address, function() {
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

app.get("/v3/:type", controller.list);
app.get("/v3/:type/:id", controller.fetch);

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

app.get("*", function(req, res) {
  res.status(404);
  res.send("404 Not Found");
});
