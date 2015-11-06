"use strict";

let Promise = require("promise");
let util = require("util");
let xmlescape = require("xml-escape");
let config = require("../config");

class ResultEncoder {
  constructor(lang, options) {
    this.lang = lang;
    this.options = options;
  }

  compactLanguage(data, lang) {
    Object.keys(data).forEach(key => {
      if (typeof data[key] == "object" && !Array.isArray(data[key]) && data[key] != null) {
        if (lang in data[key]) {
          data[key] = data[key][lang];
        } else {
          this.compactLanguage(data[key], lang);
        }
      }
    });
    return data;
  }

  encode() {
    throw new Error("Function encode() is not implemented");
  }

  isMultilang(data) {
    let default_lang = config.api.default_language;
    return data instanceof Object && data && default_lang in data;
  }

  filterReferences(refs) {
    for (let type in refs) {
      if (this.options.refs.indexOf(type) == -1) {
        delete refs[type];
      }
    }
    return refs;
  }
}

class JsonEncoder extends ResultEncoder {
  encode(result, callback) {
    return new Promise((resolve, reject) => {
      let refs = this.options.refs || [];
      if (refs.length) {
        this.filterReferences(result.references);
      } else {
        delete result.data.references;
      }
      if (this.lang) {
        if (result.collection) {
          result.items.forEach((item, i) => {
            this.compactLanguage(item, this.lang);
          });
        } else {
          this.compactLanguage(result, this.lang);
        }
      }
      let text = JSON.stringify(result.data, null, 2);

      if (callback) {
        text = util.format("%s(%s)", callback, text);
      }
      resolve(text);
    });
  }
}

class XmlEncoder extends ResultEncoder {
  encode(result) {
    return new Promise((resolve, reject) => {
      let refs = this.options.refs || [];
      if (result.collection) {
        let items = result.items.map(item => this.encodeField(result.type, item));
        let data = [
          util.format("<result count=\"%d\" total=\"%d\">", result.items.length, result.data.total),
          "<items>" + items.join("") + "</items>",
          "</result>"
        ];

        if (refs.length) {
          this.filterReferences(result.references);
          let references = this.encodeReferences(result.references);
          data.splice(1, 0, "<references>" + references + "</references>");
        }

        resolve(data.join(""));
      } else {
        let data = this.encodeField(result.type, result.data);
        resolve(data);
      }
    });
  }

  encodeMultilang(data) {
    if (this.lang) {
      let value = data[this.lang];
      return value === null ? "" : xmlescape(value);
    }

    return Object.keys(data).map(lang => {
      let value = data[lang] === null ? "" : xmlescape(data[lang]);
      return util.format("<value lang=\"%s\">%s</value>", lang, value);
    }).join("");
  }

  encodeField(field, value, options) {
    options = options || {};
    let data = [util.format("<%s>", field), null, util.format("</%s>", field)];

    if (options.idAttr) {
      data[0] = util.format("<%s %s=\"%s\">", field, options.idAttr, value[options.idAttr]);
    }

    if (Array.isArray(value)) {
      data[1] = value.map(item => this.encodeField("item", item)).join("\n");
    } else if (value === null) {
      data[1] = "";
    } else if (value instanceof Object) {
      if (this.isMultilang(value)) {
        data[0] = this.lang ? util.format("<%s>", field) : util.format("<%s multilang=\"true\">", field);
        data[1] = this.encodeMultilang(value);
      } else {
        data[1] = Object.keys(value).map(key => this.encodeField(key, value[key])).join("");
      }
    } else {
      data[1] = xmlescape(value.toString());
    }

    return data.join("");
  }

  encodeReferences(source) {
    let references = [];
    for (let type in source) {
      let data = [];
      for (let id in source[type]) {
        let row = this.encodeField(type, source[type][id], {idAttr: "id"});
        data.push(row);
      }
      references.push(util.format("<items type=\"%s\">%s</items>", type, data.join("")));
    }
    return references.join("");
  }
}

exports.selectEncoder = function(req, res, next) {
  let type = req.accepts(["json", "xml"]);
  let lang = req.query.lang;

  if (req.query.format) {
    type = req.query.format;
  }

  let options = {
    refs: "refs" in req.query ? req.query.refs.split(",") : [],
  };

  switch (type) {
    case "jsonp":
      res.locals.callback = req.query.callback;
      type = "application/javascript";
      // NOTE: do NOT break

    case "json":
      res.locals.encoder = new JsonEncoder(lang, options);
      break;

    case "xml":
      res.locals.encoder = new XmlEncoder(lang, options);
      break;

    default:
      throw new Error("Only JSON and XML supported");
  }

  res.type(type);
  next();
};

exports.encodeResponse = function(req, res, next) {
  if ("result" in res.locals) {
    res.locals.encoder.encode(res.locals.result, res.locals.callback).then(data => {
      res.locals.data = data;
      res.locals.status = res.locals.result.status;
      next();
    }, error => {
      console.error("encoder:", error.stack);
      res.type("text").status(500).send(error.toString());
      throw error;
    });
  } else {
    next();
  }
};
