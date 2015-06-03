/* global describe,it */
var express = require('express');
var jsxtransform = require('../lib/jsxtransform');

var app = express()
    .use(jsxtransform())
    .use(express['static']('/data'));

var expect = require('unexpected')
    .clone()
    .installPlugin(require('unexpected-fs'))
    .installPlugin(require('unexpected-express'))
    .addAssertion('to yield response', function (expect, subject, value) {
        return expect(app, 'to yield exchange', {
            request: subject,
            response: value
        });
    });

describe('jsxtransform', function () {
    it('should not mess with request for txt file', function () {
        return expect('/something.txt', 'with fs mocked out', {
            '/data': {
                'something.txt': 'foo\n'
            }
        }, 'to yield response', {
            headers: {
                'Content-Type': 'text/plain; charset=UTF-8'
            },
            body: 'foo\n'
        });
    });
    it('should not mess with request for js file that contains no jsx syntax', function () {
        return expect('/something.js', 'with fs mocked out', {
            '/data': {
                'something.js': 'foo();\n'
            }
        }, 'to yield response', {
            headers: {
                'Content-Type': 'text/javascript; charset=UTF-8'
            },
            body: 'foo();\n'
        });
    });
    it('should set a ETag with a suffix of -jsxtransform when requesting a .jsx file', function () {
        return expect('/something.jsx', 'with fs mocked out', {
            '/data': {
                'something.jsx': ''
            }
        }, 'to yield response', {
            headers: {
                'ETag': /-jsxtransform"$/
            }
        });
    });
    it('should set a ETag with a suffix of -jsxtransform when requesting a .js file with a jsx annotation', function () {
        return expect('/something.js', 'with fs mocked out', {
            '/data': {
                'something.js': '/** @jsx React.DOM */\nfoo();\n'
            }
        }, 'to yield response', {
            headers: {
                'ETag': /-jsxtransform"$/
            }
        });
    });
    it('should not set a ETag with a suffix of -jsxtransform when requesting a .js file without a jsx annotation', function () {
        return expect('/something.js', 'with fs mocked out', {
            '/data': {
                'something.js': 'foo();\n'
            }
        }, 'to yield response', {
            headers: {
                'ETag': /-[0-9]+"$/
            }
        });
    });
    it('should return 304 for a request that has a matching ETag in if-none-match', function () {
        var mockFs = {
            '/data': {
                'foobar.jsx': {
                    _isFile: true,
                    mtime: new Date(1),
                    content: 'foo'
                }
            }
        };
        return expect('/foobar.jsx', 'with fs mocked out', mockFs, 'to yield response', {
            statusCode: 200,
            headers: {
                ETag: /^W\/".*-jsxtransform"$/
            },
            body: 'foo'
        }).then(function (context) {
            var etag = context.httpResponse.headers.get('ETag');
            return expect({
                url: '/foobar.jsx',
                headers: {
                    'If-None-Match': etag
                }
            }, 'with fs mocked out', mockFs, 'to yield response', {
                statusCode: 304,
                headers: {
                    ETag: etag
                }
            });
        });
    });
    it('should return 200 for a request that has an invalid ETag in if-none-match', function () {
        return expect('/foobar.jsx', 'with fs mocked out', {
            '/data': {
                'foobar.jsx': {
                    _isFile: true,
                    mtime: new Date(1),
                    content: 'foo'
                }
            }
        }, 'to yield response', {
            statusCode: 200,
            headers: {
                ETag: /^W\/".*-jsxtransform"$/
            },
            body: 'foo'
        }).then(function (context) {
            var etag = context.httpResponse.headers.get('ETag');
            return expect({
                url: '/foobar.jsx',
                headers: {
                    'If-None-Match': etag
                }
            }, 'with fs mocked out', {
                '/data': {
                    'foobar.jsx': {
                        _isFile: true,
                        mtime: new Date(10),
                        content: 'foobar'
                    }
                }
            }, 'to yield response', {
                statusCode: 200,
                body: 'foobar'
            });
        });
    });
    it('should return 200 for a request that has an ETag in if-none-match with no tag from jsxtransformer', function () {
        var mockFs = {
            '/data': {
                'foobar.jsx': {
                    _isFile: true,
                    mtime: new Date(1),
                    content: 'foo'
                }
            }
        };
        return expect('/foobar.jsx', 'with fs mocked out', mockFs, 'to yield response', {
            statusCode: 200,
            body: 'foo'
        }).then(function (context) {
            var etag = context.httpResponse.headers.get('ETag');
            etag = etag.replace(/-jsxtransform"$/, '"');
            return expect({
                url: '/foobar.jsx',
                headers: {
                    'If-None-Match': etag
                }
            }, 'with fs mocked out', mockFs, 'to yield response', {
                statusCode: 200,
                body: 'foo'
            });
        });
    });
    it('should transform a js file with jsx content and jsx annotation', function () {
        return expect('/helloWorldJsx.js', 'with fs mocked out', {
            '/data': {
                'helloWorldJsx.js': [
                    '/** @jsx React.DOM */',
                    'React.renderComponent(',
                    '  <h1>Hello, world!</h1>,',
                    '  document.getElementById(\'example\')',
                    ');'
                ].join('\n')
            }
        }, 'to yield response', [
            '/** @jsx React.DOM */',
            'React.renderComponent(',
            '  React.createElement("h1", null, "Hello, world!"),',
            '  document.getElementById(\'example\')',
            ');'
        ].join('\n'));
    });
    it('should not transform a js file with jsx content and no jsx annotation', function () {
        return expect('/helloWorldJsxNoAnnotation.js', 'with fs mocked out', {
            '/data': {
                'helloWorldJsxNoAnnotation.js': [
                    "React.renderComponent(",
                    "  <h1>Hello, world!</h1>,",
                    "  document.getElementById('example')",
                    ");"
                ].join('\n')
            }
        }, 'to yield response', [
            'React.renderComponent(',
            '  <h1>Hello, world!</h1>,',
            '  document.getElementById(\'example\')',
            ');'
        ].join('\n'));
    });
    it('should transform a jsx file with jsx content and no jsx annotation', function () {
        return expect('/helloWorldJsx.jsx', 'with fs mocked out', {
            '/data': {
                'helloWorldJsx.jsx': [
                    "React.renderComponent(",
                    "  <h1>Hello, world!</h1>,",
                    "  document.getElementById('example')",
                    ");"
                ].join('\n')
            }
        }, 'to yield response', [
            'React.renderComponent(',
            '  React.createElement("h1", null, "Hello, world!"),',
            '  document.getElementById(\'example\')',
            ');'
        ].join('\n'));
    });
    it('should transform a jsx file with jsx content and jsx annotation', function () {
        return expect('/helloWorldJsxWithAnnotation.jsx', 'with fs mocked out', {
            '/data': {
                'helloWorldJsxWithAnnotation.jsx': [
                    "/** @jsx React.DOM */",
                    "React.renderComponent(",
                    "  <h1>Hello, world!</h1>,",
                    "  document.getElementById('example')",
                    ");"
                ].join('\n')
            }
        }, 'to yield response', [
            '/** @jsx React.DOM */',
            'React.renderComponent(',
            '  React.createElement("h1", null, "Hello, world!"),',
            '  document.getElementById(\'example\')',
            ');'
        ].join('\n'));
    });
    it('should behave when it gets an error', function () {
        return expect('/helloWorldJsxSyntaxError.jsx', 'with fs mocked out', {
            '/data': {
                'helloWorldJsxSyntaxError.jsx' : [
                    "React.renderComponent(",
                    "  <h1>Hello, world!</h1,",
                    "  document.getElementById('example')",
                    ");"
                ].join('\n')
            }
        }, 'to yield response', [
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
