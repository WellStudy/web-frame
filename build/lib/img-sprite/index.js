const path = require('path');
const fs = require('fs');

const through = require('through2');

const css = require('css');
const spritesmith = require('spritesmith');
const extend = require('extend');
const imagemin = require('imagemin');
const imageminOptipng = require('imagemin-optipng');
const mkdirp = require('mkdirp');

const crypto = require('crypto');

const getMD5 = function (data) {
    return crypto.createHash('md5').update(data).digest('hex').slice(0, 10);
};

const spriter = function (options) {
    var defaults = {
        'outPut': '',//输出目录
        'unit': 'rem',// rem||px
        'relativePath': '',
        'outputIndent': '\t',
        'proportion': 100
    };

    var settings = extend({}, defaults, options);
    var newImage = [];
    var filePath;

    var stream = through.obj(function (chunk, enc, cb) {
        var self = this;
        var contents = String(chunk.contents);

        try {

            var styles = css.parse(contents, {
                'silent': true,
                'source': chunk.path
            });

            filePath = chunk.path;

            var imageList = [];
            var newImageList = [];
            var rules = styles.stylesheet.rules;
            for (var i in rules) {
                var ruls = rules[i];

                var declarations = ruls.declarations;
                for (var j in declarations) {
                    var declaration = declarations[j];
                    if (declaration.property === "background-image") {
                        var imagePath = matchBackgroundImages(declaration.value);

                        var newImagePath = path.join(path.dirname(chunk.path), imagePath);
                        var index = newImagePath.split(path.sep).indexOf("sprite");

                        if (index > -1) {
                            imageList[newImagePath] = {
                                rule: i,
                                declaration: j,
                                path: imagePath
                            };
                            newImageList.push(newImagePath);
                        }
                    }
                }
            }
            if (newImageList.length === 0) {
                cb(null, chunk);
                return;
            }

            var spritesmithOptions = extend({}, settings.spritesmithOptions, { src: newImageList });

            spritesmith.run(spritesmithOptions, function (err, result) {

                if (err) throw err;

                if (Object.keys(result.coordinates).length == 0) {
                    cb(null, chunk);
                    return;
                }

                var basePath = path.join(settings.outPut, settings.relativePath);
                mkdirp.sync(basePath, 0777);

                var imagePath = path.join(basePath, path.basename(chunk.path, ".css") + ".png");

                newImage.push(imagePath);
                fs.writeFile(imagePath, result.image, (err) => {
                    if (err) throw err;

                    const cssPath = path.join(settings.outPut, path.relative(settings.src, chunk.path));
                    imagePath = path.relative(cssPath, imagePath).replace(/\\/g, "/");

                    var coordinates = result.coordinates;

                    if (settings.unit === "rem") {
                        result.properties.height = result.properties.height / settings.proportion;
                        result.properties.width = result.properties.width / settings.proportion;
                    }

                    const verStr = encodeURIComponent(getMD5(result.image.toString()));

                    for (var i in coordinates) {
                        var oldImage = imageList[i];
                        var coordinate = coordinates[i];
                        var declarations = rules[oldImage.rule].declarations;

                        declarations[oldImage.declaration].value = "url('" + imagePath + "?v=" + verStr + "')";

                        if (settings.unit === "rem") {

                            coordinate.x = coordinate.x / settings.proportion;
                            coordinate.y = coordinate.y / settings.proportion;
                            coordinate.height = coordinate.height / settings.proportion;
                            coordinate.width = coordinate.width / settings.proportion;

                            declarations.push({
                                type: "declaration",
                                value: result.properties.width + settings.unit + " " + result.properties.height + settings.unit,
                                property: "background-size"
                            });
                        }

                        declarations.push({
                            type: "declaration",
                            value: coordinate.height + settings.unit,
                            property: "height"
                        });
                        declarations.push({
                            type: "declaration",
                            value: coordinate.width + settings.unit,
                            property: "width"
                        });
                        declarations.push({
                            type: "declaration",
                            value: "-" + coordinate.x + settings.unit + " -" + coordinate.y + settings.unit,
                            property: "background-position"
                        });
                    }
                    var resultantContents = css.stringify(styles, {
                        indent: settings.outputIndent
                    });
                    chunk.contents = new Buffer(resultantContents);

                    cb(null, chunk);
                });
            });
        } catch (err) {
            err.message = 'Something went wrong when parsing the CSS: ' + err.message;
            self.emit('log', err.message);

            if (!settings.silent) {
                self.emit('error', err);
            }
        }

    }, function (cb) {
        var self = this;
        var relativePath = path.join(path.dirname(filePath), settings.relativePath);
        imagemin(newImage, relativePath, {
            plugins: [
                imageminOptipng({
                    optimizationLevel: 3
                })
            ]
        }).then(files => {
            cb();
        });
    });

    return stream;
};


var backgroundURLRegex = (/(.*?url\(["\']?)(.*?\.(?:png|jpg|gif))(["\']?\).*?;?)/i);

function matchBackgroundImages(declarationValue) {
    var backgroundURLMatchAllRegex = new RegExp(backgroundURLRegex.source, "gi");

    return declarationValue.replace(backgroundURLMatchAllRegex, function (match, p1, p2, p3, offset, string) {
        return p2;
    });
}

module.exports = spriter;
