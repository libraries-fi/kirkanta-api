"use strict";

define("navigation", ["samufw/view"], function(View) {
  return View.extend({
    initialize: function(items) {
      this.vars.items = items;
    },
  });
});

define("scroll", ["samufw/dom"], function(dom) {
  var ScrollListener = function(body, navi) {
    this.body = body;
    this.navi = navi;
    this.lastPos = 0;
    this.updateDelta = 20;
    this.active = null;

    var listener = this;
    this.navi.find("a").on("click", function(event) {
      setTimeout(function() {
        listener.focusItem(listener.findByHref(event.target.getAttribute("href")));
      }, 10);
    });
  };

  ScrollListener.prototype = Object.create(null, {
    onScroll: {
      value: function(event) {
        if (this.shouldUpdate) {
          this.update();
        }
      }
    },
    findByPos: {
      value: function(pos) {
        var items = this.targets;
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          if (item.top >= pos + 40) {
            return items[Math.max(i - 1, 0)];
          }
        }
      }
    },
    findByHref: {
      value: function(href) {
        var items = this.targets;
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          if (item.link.attr("href") == href) {
            return item;
          }
        }
      }
    },
    focusItem: {
      value: function(item) {
        var cur_target = this.active ? this.active.link.attr("href") : null;
        var new_target = item ? item.link.attr("href") : null;

        if (this.active && cur_target != new_target) {
          this.active.link.removeClass("active");
        }

        if (item) {
          item.link.addClass("active");
        }

        this.active = item;
        this.lastPos = this.position;
      }
    },
    update: {
      value: function(item) {
        var item = this.findByPos(this.position);
        this.focusItem(item);
      }
    },
    position: {
      get: function() {
        return Math.floor(this.body.get("scrollTop") - this.body.get("offsetTop"));
      }
    },
    shouldUpdate: {
      get: function() {
        return Math.abs(this.position - this.lastPos) > this.updateDelta;
      }
    },
    targets: {
      get: function() {
        if (!this._targets) {
          this._targets = this.navi.find("a").map(function(link) {
            var id = link.getAttribute("href");
            var elem = dom(id);
            return {
              element: elem,
              link: dom(link),
              top: elem.first.offsetTop,
            };
          });
        }
        return this._targets;
      }
    }
  });
  return ScrollListener;
});

require(["samufw/dom", "samufw/view", "handlebars"], function(dom, View, Handlebars) {
  View.configure({
    engine: {
      render: function(template, data) {
        return Handlebars.compile(template)(data);
      }
    }
  });

  var template = Handlebars.compile(dom("script#tpl-nav-links").first.innerHTML);

  Handlebars.registerHelper("nav", function(items) {
    return new Handlebars.SafeString(template(items));
  });
});

require(["samufw/dom", "navigation", "scroll"],
function(dom, Navigation, ScrollListener) {
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

    var listener = new ScrollListener(dom("body"), navi.root);
    listener.update();

    dom(document).on("scroll", function(event) {
      listener.onScroll(event);
    });
  });
});
