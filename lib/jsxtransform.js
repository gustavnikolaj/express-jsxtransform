require('express-hijackresponse');

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

    return function (req, res, next) {
        var fileType = (req.originalUrl.match(/\.(js|jsx)$/) || []).shift();

        if (!fileType) {
            return next();
        } else {
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
            res.hijack(function (err, res) {
                var annotationInserted = false;
                if (res.statusCode === 200 && fileType) {
                    var chunks = [];
                    res.on('error', function () {
                        res.unhijack();
                        next();
                    }).on('data', function (chunk) {
                        chunks.push(chunk);
                    }).on('end', function () {
                        if (!chunks.length) {
                            return res.send(res.statusCode);
                        }
                        var jsText = Buffer.concat(chunks).toString('utf-8');

                        var firstLine = jsText.split('\n')[0];

                        if (fileType === '.jsx') {
                            if (!/^\/\*\*(\s)@jsx/.test(firstLine)) {
                                jsText = '/** @jsx React.DOM */\n' + jsText;
                                annotationInserted = true;
                            }
                        }

                        if (fileType === '.jsx' || /^\/\*\*(\s)@jsx/.test(firstLine)) {
                            try {
                                jsText = React.transform(jsText, {});

                                if (annotationInserted) {
                                    jsText = jsText.split('\n').splice(1).join('\n');
                                }
                            } catch (e) {
                                // If parsing the file throws an error, build a
                                // meaningful error response.
                                var errorMessage = e.message + '\nIn file: ' + req.originalUrl;
                                jsText = getErrorScript(errorMessage);
                            }
                        }

                        res.setHeader('Content-Type', 'text/javascript');
                        res.setHeader('Content-Length', Buffer.byteLength(jsText));
                        res.end(jsText);
                    });
                } else {
                    res.unhijack(true);
                }
            });
            next();
        }
    };
};
