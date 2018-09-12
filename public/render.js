import showdown from 'showdown';
import documentation from "../doc/documentation.md";

const compiler = new showdown.Converter({
  ghCodeBlocks: true,
  omitExtraWLInCodeBlocks: true,
  simpleLineBreaks: false,
  tables: true,
});

let html = compiler.makeHtml(documentation);
let article = document.createElement("article");

article.innerHTML = html;
document.body.appendChild(article);

let nav = buildNavigation(article, "nav");
document.body.insertBefore(nav, article);

function e(tag) {
  return document.createElement(tag);
}

function buildNavigation(container, id) {
  let headings = container.querySelectorAll("h1:not(:first-child),h2");
  let root = e("ul");

  for (let h of headings) {
    let link = e("a");
    link.href = `#${h.id}`;
    link.innerHTML = h.innerHTML;

    let node = e("li");
    node.appendChild(link);

    switch (h.tagName) {
      case "H1":
        root.appendChild(node);
        break;

      case "H2":
        if (root.lastElementChild.lastElementChild.tagName != "UL") {
          root.lastElementChild.appendChild(e("ul"));
        }
        root.lastElementChild.lastElementChild.appendChild(node);
        break;
    }
  }

  let nav = e("nav");
  nav.appendChild(root);
  nav.id = id;

  return nav;
}
