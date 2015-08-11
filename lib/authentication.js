"use strict";

let database = require("./database");

exports.apikey = function(req, res, next) {
  var key = req.query.apikey;
  if (!key) {
    return res.status(403).send("Access to the API requires a valid apikey.");
  }
  let db = database.postgres();
  db.builder().select("id").from("api_auth").where("key", key).then(function(result) {
    if (result.length != 1) {
      return res.status(403).send("Invalid apikey provided.");
    }
    next();
  });
};
