
var searcher = require("./searcher");

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
  var query = req.query;
  query.id = req.params.id;
  searcher.create(req.params.type).search(query).then(function(result) {
    res.locals.result = result.items[0];
    next();
  }, function(error) {
    res.send("error");
    console.error("ERROR", error);
  });
};
