"use strict";

let database = require("./database");

exports.apikey = function(req, res, next) {
  var key = req.query.apikey;
  if (!key) {
    throw new Error("Authentication required (?apikey=foobar)");
  }
  let db = database.postgres();
  db.builder().select("id").from("api_auth").where("key", key).then(function(result) {
    if (result.length != 1) {
      throw new Error("Authentication required");
    }
  });

  console.log("KEY", req.query.apikey);
  next();
};
