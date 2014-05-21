/*global describe,it,before,after*/
var express = require('express'),
    Path = require('path'),
    request = require('request'),
    passError = require('passerror'),
    expect = require('unexpected'),
    jsxtransform = require('../lib/jsxtransform');

var root = Path.resolve(__dirname, 'root'),
    // Pick a random TCP port above 10000 (.listen(0) doesn't work anymore?)
    portNumber = 10000 + Math.floor(55536 * Math.random()),
    baseUrl = 'http://127.0.0.1:' + portNumber,
    server;

expect.addAssertion('to respond', function (expect, subject) {
    var args = Array.prototype.slice.call(arguments, 2);
    var lines = args.slice(0, -1);
    var done = args[args.length - 1];

    request(baseUrl + '/' + subject, passError(done, function (response, body) {
        expect(body, 'to equal', lines.join('\n') + '\n');
        done();
    }));
});

describe('test server with jsxtransform', function () {
    before(function (done) {
        server = express.createServer()
            .use(function (req, res, next) {
                next();
            })
            .use(jsxtransform())
            .use(express['static'](root))
            .listen(portNumber, done);
    });

    after(function () {
        server.close();
    });

    it('should not mess with request for txt file', function (done) {
        expect('/something.txt',
               'to respond',
               'foo',
               done);
    });
    it('should not mess with request for js file that contains no jsx syntax', function (done) {
        expect('/something.js',
               'to respond',
               'foo();',
               done);
    });
    it('should transform a js file with jsx content and jsx annotation', function (done) {
        expect('/helloWorldJsx.js',
               'to respond',
               '/** @jsx React.DOM */',
               'React.renderComponent(',
               '  React.DOM.h1(null, "Hello, world!"),',
               '  document.getElementById(\'example\')',
               ');',
               done);
    });
    it('should not transform a js file with jsx content and no jsx annotation', function (done) {
        expect('/helloWorldJsxNoAnnotation.js',
               'to respond',
               'React.renderComponent(',
               '  <h1>Hello, world!</h1>,',
               '  document.getElementById(\'example\')',
               ');',
               done);
    });
    it('should transform a jsx file with jsx content and no jsx annotation', function (done) {
        expect('/helloWorldJsx.jsx',
               'to respond',
               'React.renderComponent(',
               '  React.DOM.h1(null, "Hello, world!"),',
               '  document.getElementById(\'example\')',
               ');',
               done);
    });
    it('should transform a jsx file with jsx content and jsx annotation', function (done) {
        expect('/helloWorldJsxWithAnnotation.jsx',
               'to respond',
               '/** @jsx React.DOM */',
               'React.renderComponent(',
               '  React.DOM.h1(null, "Hello, world!"),',
               '  document.getElementById(\'example\')',
               ');',
               done);
    });
    it('should behave when it gets an error', function (done) {
        expect('helloWorldJsxSyntaxError.jsx',
               'to respond',
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
               done);
    });
});
