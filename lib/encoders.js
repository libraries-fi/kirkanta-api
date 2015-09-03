"use strict";

let Promise = require("promise");
let util = require("util");
let xmlescape = require("xml-escape");
let config = require("../config");

let ResultEncoder = function(lang) {
  this.lang = lang;
};

ResultEncoder.prototype = {
  compactLanguage: function(data, lang) {
    Object.keys(data).forEach(function(key) {
      if (typeof data[key] == "object" && !Array.isArray(data[key]) && data[key] != null) {
        if (lang in data[key]) {
          data[key] = data[key][lang];
        } else {
          this.compactLanguage(data[key], lang);
        }
      }
    }, this);
    return data;
  },
  encode: function() {
    throw new Error("Function encode() is not implemented");
  },
  isCollection: function(data) {
    return "total" in data && "items" in data;
  },
  isMultilang: function(data) {
    var default_lang = config.api.default_language;
    return data instanceof Object && data && default_lang in data;
  }
};

let JsonEncoder = function() {
  ResultEncoder.apply(this, arguments);
};

JsonEncoder.prototype = Object.create(ResultEncoder.prototype);
JsonEncoder.prototype.encode = function(result, callback) {
  let encoder = this;
  let lang = this.lang;

  return new Promise(function(resolve, reject) {
    process.nextTick(function() {
      if (lang) {
        if (encoder.isCollection(result)) {
          result.items.forEach(function(item, i) {
            encoder.compactLanguage(item, lang);
          });
        } else {
          encoder.compactLanguage(result, lang);
        }
      }
      let text = JSON.stringify(result.data, null, 2);

      if (callback) {
        text = util.format("%s(%s)", callback, text);
      }
      resolve(text);
    });
  });
};

let XmlEncoder = function() {
  ResultEncoder.apply(this, arguments);
};

XmlEncoder.prototype = Object.create(ResultEncoder.prototype);

XmlEncoder.prototype.encodeMultilang = function(data) {
  if (this.lang) {
    let value = data[this.lang];
    return value === null ? "" : xmlescape(value);
  }

  return Object.keys(data).map(function(lang) {
    let value = data[lang] === null ? "" : xmlescape(data[lang]);
    return util.format("<value lang=\"%s\">%s</value>", lang, value);
  }).join("");
};

XmlEncoder.prototype.encodeField = function(field, value) {
  let data = [util.format("<%s>", field), null, util.format("</%s>", field)];

  if (Array.isArray(value)) {
    data[1] = value.map(function(item) {
      return this.encodeField("item", item);
    }, this).join("\n");
  } else if (value === null) {
    data[1] = "";
  } else if (value instanceof Object) {
    if (this.isMultilang(value)) {
      data[0] = this.lang ? util.format("<%s>", field) : util.format("<%s multilang=\"true\">", field);
      data[1] = this.encodeMultilang(value);
    } else {
      data[1] = Object.keys(value).map(function(key) {
        return this.encodeField(key, value[key]);
      }, this).join("");
    }
  } else {
    data[1] = xmlescape(value.toString());
  }

  return data.join("");
};

XmlEncoder.prototype.encode = function(result) {
  let encoder = this;

  return new Promise(function(resolve, reject) {
    process.nextTick(function() {
      if (result.collection) {
        let items = result.items.map(function(item) {
          return encoder.encodeField(result.type, item);
        });
        let data = [
          util.format("<collection count=\"%d\" total=\"%d\">", result.items.length, result.data.total),
          items.join(""),
          "</collection>"
        ];

        resolve(data.join(""));
      } else {
        let data = encoder.encodeField(result.type, result.data);
        resolve(data);
      }
    });
  });
};

exports.selectEncoder = function(req, res, next) {
  let type = req.accepts(["json", "xml"]);
  let lang = req.query.lang;

  if (req.query.format) {
    type = req.query.format;
  }

  switch (type) {
    case "jsonp":
      res.locals.callback = req.query.callback;
      type = "application/javascript";
      // NOTE: do NOT break

    case "json":
      res.locals.encoder = new JsonEncoder(lang);
      break;

    case "xml":
      res.locals.encoder = new XmlEncoder(lang);
      break;

    default:
      throw new Error("Only JSON and XML supported");
  }

  res.type(type);
  next();
};

exports.encodeResponse = function(req, res, next) {
  if ("result" in res.locals) {
    res.locals.encoder.encode(res.locals.result, res.locals.callback).then(function(data) {
      res.locals.data = data;
      next();
    }, function(err) {
      console.error("ERROR", err);
      res.type("text").status(500).send(err.toString());

      throw err;
    });
  } else {
    next();
  }
};
