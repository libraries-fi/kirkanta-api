
var ResultEncoder = function() {

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
  encode: function(result, lang) {
    // if (lang) {
    //   if ("total" in result && "items" in result) {
    //     result.items.map(function(item) {
    //       this.compactLanguage(item, lang);
    //     }, this);
    //   } else {
    //     this.compactLanguage(result, lang);
    //   }
    // }
    return result;
  }
};

var JsonEncoder = function() {
  ResultEncoder.apply(this);
};

JsonEncoder.prototype = Object.create(ResultEncoder.prototype);
JsonEncoder.prototype.encode = function(result, lang) {
  var result = ResultEncoder.prototype.encode.apply(this, arguments);
  return JSON.stringify(result, null, 2);
};

var XmlEncoder = function() {
  ResultEncoder.apply(this);
};

XmlEncoder.prototype = Object.create(ResultEncoder.prototype);
XmlEncoder.prototype.encodeItem = function(item) {
  return "<item>foobar</item>";
};

exports.selectEncoder = function(req, res, next) {
  var type = req.accepts(["json", "xml"]);

  if (req.query.format) {
    type = req.query.format;
  }

  switch (type) {
    case "jsonp":
      res.locals.callback = req.query.callback;

    case "json":
      res.locals.encoder = new JsonEncoder;
      break;

    case "xml":
      res.locals.encoder = new XmlEncoder;
      break;

    default:
      throw new Error("Only JSON and XML supported");
  }

  res.type(type);
  next();
};

exports.encodeResponse = function(req, res, next) {
  res.locals.data = res.locals.encoder.encode(res.locals.result, req.query.lang);
  next();
};
