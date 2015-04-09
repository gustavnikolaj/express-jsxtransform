var interceptor = require('express-interceptor');

var React = require('react-tools');

function getErrorScript(errorMessage) {
    var cleanErrorMessage = errorMessage.replace('\n', '\\n').replace('"', '\\"');
    return [
        '/**********************************************************',
        errorMessage.split('\n').map(function (str) {
            return ' * ' + str;
        }).join('\n'),
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
        '    element.innerText = "' + cleanErrorMessage + '";',
        '    document.body.appendChild(element);',
        '}());',
        ''
    ].join('\n');
}

module.exports = function (options) {
    return interceptor(function (req, res) {
        var fileType = (req.originalUrl.match(/\.(js|jsx)$/) || []).shift();
        // Prevent If-None-Match revalidation with the downstream middleware with ETags that aren't suffixed with "-jsxtransform":
        var ifNoneMatch = req.headers['if-none-match'];

        if (ifNoneMatch) {
            var validIfNoneMatchTokens = ifNoneMatch.split(' ').filter(function (etag) {
                return /-jsxtransform\"$/.test(etag);
            });

            if (validIfNoneMatchTokens.length > 0) {
                req.headers['if-none-match'] = validIfNoneMatchTokens.join(' ');
            } else {
                delete req.headers['if-none-match'];
            }
        }

        delete req.headers['if-modified-since']; // Prevent false positive conditional GETs after enabling jsxtransform

        return {
            isInterceptable: function() {
                return true;
            },
            intercept: function(body, send) {
                var annotationInserted = false;

                if (res.statusCode === 200) {
                    var firstLine = body.split('\n')[0];

                    if (fileType === '.jsx') {
                        if (!/^\/\*\*(\s)@jsx/.test(firstLine)) {
                            body = '/** @jsx React.DOM */\n' + body;
                            annotationInserted = true;
                        }
                    }

                    if (fileType === '.jsx' || /^\/\*\*(\s)@jsx/.test(firstLine)) {
                        try {
                            body = React.transform(body, {});

                            if (annotationInserted) {
                                body = body.split('\n').splice(1).join('\n');
                            }
                        } catch (e) {
                            // If parsing the file throws an error, build a
                            // meaningful error response.
                            var errorMessage = e.message + '\nIn file: ' + req.originalUrl;
                            body = getErrorScript(errorMessage);
                        }
                    }

                    res.setHeader('Content-Type', 'text/javascript');
                    res.setHeader('Content-Length', Buffer.byteLength(body));
                    send(body);
                }
            }
        };
    });
};
