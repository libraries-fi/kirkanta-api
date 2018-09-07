/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ({

/***/ "./doc/documentation.md":
/*!******************************!*\
  !*** ./doc/documentation.md ***!
  \******************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

eval("module.exports = __webpack_require__.p + \"documentation.md\";\n\n//# sourceURL=webpack:///./doc/documentation.md?");

/***/ }),

/***/ "./public/init.webpack.js":
/*!********************************!*\
  !*** ./public/init.webpack.js ***!
  \********************************/
/*! no exports provided */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _doc_documentation_md__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../doc/documentation.md */ \"./doc/documentation.md\");\n/* harmony import */ var _doc_documentation_md__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_doc_documentation_md__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _render_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./render.js */ \"./public/render.js\");\n/* harmony import */ var _render_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_render_js__WEBPACK_IMPORTED_MODULE_1__);\n\n\n\n\n//# sourceURL=webpack:///./public/init.webpack.js?");

/***/ }),

/***/ "./public/render.js":
/*!**************************!*\
  !*** ./public/render.js ***!
  \**************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("axios.get(\"/doc/documentation.md\").then((response) => {\n  let compiler = new showdown.Converter({\n    tables: true,\n    ghCodeBlocks: true,\n    omitExtraWLInCodeBlocks: true,\n    simpleLineBreaks: false,\n  });\n\n  let html = compiler.makeHtml(response.data);\n  // document.querySelector('[data-markdown-here]').appendChild(buildArticle(html));\n  document.querySelector('[data-markdown-here]').innerHTML = html;\n});\n\nfunction buildArticle(html) {\n  let article = document.createElement(\"article\");\n  article.innerHTML = html;\n\n  buildLevel(article, \"section\", \"h1:not(:first-of-type)\");\n  buildLevel(article, \"div\", \"h2\");\n\n  return article;\n}\n\nfunction buildLevel(article, tag_name, selector) {\n  let levels = [...article.querySelectorAll(selector), article.lastChild];\n\n  for (let i = 1; i < levels.length; i++) {\n    let node = levels[i];\n    let container = document.createElement(tag_name);\n    node.parentNode.insertBefore(container, node);\n\n    while (node.nextElementSibling != levels[i+1]) {\n      if (node.nextElementSibling) {\n        container.appendChild(node.nextElementSibling);\n      } else {\n        break;\n      }\n    }\n\n    container.insertBefore(node, container.childNodes[0]);\n\n    // container.insertBefore(node, container.childNodes[0]);\n  }\n}\n\n\n//# sourceURL=webpack:///./public/render.js?");

/***/ }),

/***/ 0:
/*!**************************************!*\
  !*** multi ./public/init.webpack.js ***!
  \**************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

eval("module.exports = __webpack_require__(/*! ./public/init.webpack.js */\"./public/init.webpack.js\");\n\n\n//# sourceURL=webpack:///multi_./public/init.webpack.js?");

/***/ })

/******/ });