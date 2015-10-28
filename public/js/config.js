requirejs.config({
  baseUrl: "js",
  paths: {
    handlebars: "handlebars/handlebars-v4.0.2",
  },
  shim: {
    "samufw/view": ["handlebars"],
  },
  packages: [
    {
      "name": "samufw",
      "location": "samufw/src"
    }
  ]
});

less = {
  end: "development",
};
