var es = require("elasticsearch");
var util = require("util");
var config = require("../config");

exports.client = function() {
  // return new es.Client({
  //   host: util.format("%s:%s", config.elastic.address, config.elastic.port),
  // });

  return {
    search: function(query) {
      var client = new es.Client({
        host: util.format("%s:%s", config.elastic.address, config.elastic.port),
      });

      if (!("index" in query)) {
        query.index = config.elastic.index;
      }

      if (!("size" in query)) {
        query.size = config.elastic.size;
      }

      return client.search(query);
    }
  }
};
