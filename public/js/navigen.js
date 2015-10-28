"use strict";

define("navigation", ["samufw/view"], function(View) {
  return View.extend({
    initialize: function(items) {
      this.vars.items = items;
    }
  });
});

require(["samufw/dom", "samufw/view", "handlebars"], function(dom, View, Handlebars) {
  View.configure({
    engine: {
      render: function(template, data) {
        return Handlebars.compile(template)(data);
      }
    },
  });

  var template = Handlebars.compile(dom("script#tpl-nav-links").first.innerHTML);

  Handlebars.registerHelper("nav", function(items) {
    return new Handlebars.SafeString(template(items));
  });
});

require(["samufw/dom", "navigation"],
function(dom, Navigation) {
  var links = dom("h1,h2,h3,h4").slice(1).map(function(h) {
    return {
      label: h.innerHTML,
      href: "#" + h.id,
      level: parseInt(h.tagName[1]),
      children: [],
    };
  });

  var insertNested = function(tree, item) {
    if (tree.level < item.level - 1) {
      insertNested(tree.children[tree.children.length - 1], item);
    } else {
      tree.children.push(item);
    }
  }

  for (var i = 1; i < links.length; i++) {
    var item = links[i];
    if (item.level > links[i-1].level) {
      // links[i-1].children.concat(links.splice(i, 1));
      insertNested(links[i-1], links.splice(i, 1)[0]);
      i--;
    }
  }

  var navi = new Navigation(links);
  navi.template = dom("script#tpl-nav").first.innerHTML;
  navi.render().then(function(nodes) {
    dom("body").prepend(nodes);
  })
});
