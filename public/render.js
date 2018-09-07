import axios from 'axios';
import showdown from 'showdown';

axios.get("dist/documentation.md").then((response) => {
  let compiler = new showdown.Converter({
    tables: true,
    ghCodeBlocks: true,
    omitExtraWLInCodeBlocks: true,
    simpleLineBreaks: false,
  });

  let html = compiler.makeHtml(response.data);
  // document.querySelector('[data-markdown-here]').appendChild(buildArticle(html));
  document.querySelector('[data-markdown-here]').innerHTML = html;
});

function buildArticle(html) {
  let article = document.createElement("article");
  article.innerHTML = html;

  buildLevel(article, "section", "h1:not(:first-of-type)");
  buildLevel(article, "div", "h2");

  return article;
}

function buildLevel(article, tag_name, selector) {
  let levels = [...article.querySelectorAll(selector), article.lastChild];

  for (let i = 1; i < levels.length; i++) {
    let node = levels[i];
    let container = document.createElement(tag_name);
    node.parentNode.insertBefore(container, node);

    while (node.nextElementSibling != levels[i+1]) {
      if (node.nextElementSibling) {
        container.appendChild(node.nextElementSibling);
      } else {
        break;
      }
    }

    container.insertBefore(node, container.childNodes[0]);

    // container.insertBefore(node, container.childNodes[0]);
  }
}
