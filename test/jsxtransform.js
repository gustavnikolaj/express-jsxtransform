/*global describe,it,before,after*/
var express = require('express');
var Path = require('path');
var request = require('request');
var passError = require('passerror');
var jsxtransform = require('../lib/jsxtransform');
var root = Path.resolve(__dirname, 'root');
var expect = require('unexpected')
    .installPlugin(require('unexpected-express'))
    .addAssertion('to yield response', function (expect, subject, value) {
        var app = express()
            .use(jsxtransform())
            .use(express['static'](root));
        return expect(app, 'to yield exchange', {
            request: subject,
            response: value
        });
    });

describe('jsxtransform', function () {
    it('should not mess with request for txt file', function () {
        return expect('/something.txt', 'to yield response', 'foo\n');
    });
    it('should not mess with request for js file that contains no jsx syntax', function () {
        return expect('/something.js', 'to yield response', 'foo();\n');
    });
    it('should transform a js file with jsx content and jsx annotation', function () {
        return expect('/helloWorldJsx.js', 'to yield response', [
            '/** @jsx React.DOM */',
            'React.renderComponent(',
            '  React.createElement("h1", null, "Hello, world!"),',
            '  document.getElementById(\'example\')',
            ');',
            ''
        ].join('\n'));
    });
    it('should not transform a js file with jsx content and no jsx annotation', function () {
        return expect('/helloWorldJsxNoAnnotation.js', 'to yield response', [
            'React.renderComponent(',
            '  <h1>Hello, world!</h1>,',
            '  document.getElementById(\'example\')',
            ');',
            ''
        ].join('\n'));
    });
    it('should transform a jsx file with jsx content and no jsx annotation', function () {
        return expect('/helloWorldJsx.jsx', 'to yield response', [
            'React.renderComponent(',
            '  React.createElement("h1", null, "Hello, world!"),',
            '  document.getElementById(\'example\')',
            ');',
            '',
        ].join('\n'));
    });
    it('should transform a jsx file with jsx content and jsx annotation', function () {
        return expect('/helloWorldJsxWithAnnotation.jsx', 'to yield response', [
            '/** @jsx React.DOM */',
            'React.renderComponent(',
            '  React.createElement("h1", null, "Hello, world!"),',
            '  document.getElementById(\'example\')',
            ');',
            ''
        ].join('\n'));
    });
    it('should behave when it gets an error', function () {
        return expect('/helloWorldJsxSyntaxError.jsx', 'to yield response', [
            '/**********************************************************',
            ' * Parse Error: Line 3: Unexpected token ,',
            ' * In file: /helloWorldJsxSyntaxError.jsx',
            ' *********************************************************/',
            ';(function () {',
            '    var element = document.createElement("DIV");',
            '    element.style.position = "absolute";',
            '    element.style.top = 0;',
            '    element.style.left = 0;',
            '    element.style.right = 0;',
            '    element.style.bottom = 0;',
            '    element.style.backgroundColor = "white";',
            '    element.style.zIndex = 999999;',
            '    element.style.fontSize = "24px";',
            '    element.style.color = "red";',
            '    element.style.padding = "20px";',
            '    element.style.textAlign = "left";',
            '    element.style.whiteSpace = "pre";',
            '    element.style.fontFamily = "monospace";',
            '    element.innerText = "Parse Error: Line 3: Unexpected token ,\\nIn file: /helloWorldJsxSyntaxError.jsx";',
            '    document.body.appendChild(element);',
            '}());',
            ''
        ].join('\n'));
    });
});
