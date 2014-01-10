/* generate AMD package configurations for installed bower components, auto update the configuration file of specified AMD loader type .*/

var mout = require('mout');
var Logger = require('bower-logger');
var Project = require('../core/Project');
var fs = require('graceful-fs');
var cli = require('../util/cli');
var defaultConfig = require('../config');
var path = require('path');
var requirejs = require('requirejs/bin/r.js');
var slash = require('slash');
var glob = require('glob');
var minimatch = require("minimatch");
var Q = require('q');

// fixup slashes in file paths for windows
function normalize(str) {
    return process.platform === 'win32' ? slash(str) : str;
}

// Process specified wildcard glob patterns or filenames against a
// callback, excluding and uniquing files in the result set.
function processPatterns(patterns, fn) {
    // Filepaths to return.
    var result = [];
    // Iterate over flattened patterns array.
    patterns.forEach(function (pattern) {
        // If the first character is ! it should be omitted
        var exclusion = pattern.indexOf('!') === 0;
        // If the pattern is an exclusion, remove the !
        if (exclusion) {
            pattern = pattern.slice(1);
        }
        // Find all matching files for this pattern.
        var matches = fn(pattern);
        if (exclusion) {
            // If an exclusion, remove matching files.
            result = mout.array.difference(result, matches);
        } else {
            // Otherwise add matching files.
            result = mout.array.union(result, matches);
        }
    });
    return result;
}

function globs(patterns, options) {
    return processPatterns(patterns, function (pattern) {
        // Find all matching files for this pattern.
        return glob.sync(pattern, options);
    });
}

function guessMainFile(pkg, dir) {

    var cwd = path.join(pkg.canonicalDir, dir);
    // Fast fail if directory doesn't exit.
    if (!(fs.existsSync(cwd) && fs.statSync(cwd).isDirectory(cwd)))
        return;

    var name = pkg.pkgMeta.name;
    // put all top level js files into an array
    var candidates = globs(['*.js', '!*.min.js', '!*-min.js', '!grunt.js', '!Gruntfile.js'], { cwd: cwd });

    var guesses = [
        // look for a primary .js file based on the project name
        // ex: backbone.js inside backbone dir
        name + '.js',
        // look for a primary .js file based on the project name minus 'js'
        // ex: require.js inside requirejs dir
        name.replace(/js$/, '') + '.js'
    ];

    var ret = mout.array.find(guesses, function (guess) {
        return mout.array.contains(candidates, guess);
    });

    return ret ? path.join(dir, ret) : null;
}

// List of supported vendor.
var VENDORS = ["rjs"];

function plant(amdVendor, options, config) {

    var project;
    var logger = new Logger();

    // Fast fail if AMD vendor is problematic.
    if (!(amdVendor && mout.array.contains(VENDORS, amdVendor))) {
        Q.delay().then(function () {
            logger.error("wrong argument",
                amdVendor ?
                    "AMD vendor \"" + amdVendor + "\" is not supported." :
                    "Which vendor of AMD you're targeting?"
            );
            logger.emit('end');
        });
        return logger;
    }

    options = options || {};
    config = mout.object.deepFillIn(config || {}, defaultConfig);
    // base path for the components directory.

    var cwd = path.relative(process.cwd(), config.cwd);
    var basePath = path.join(cwd, config.directory);

    project = new Project(config, logger);

    project.getTree()
        .spread(function (tree, flattened) {
            // Relativize paths
            return mout.object.map(flattened, function (pkg, name) {
                if (pkg.missing) {
                    return;
                }
                var main;

                var entry = { name: name, location: normalize(path.join(basePath, name))};

                main = pkg.pkgMeta.main;

                // Normalize main
                if (typeof main === 'string') {
                    main = [main];
                }

                // Ignore all non-js files.
                main = mout.array.filter(main, function (file) {
                    return minimatch(file, "*.js");
                });

                // Main file guessed.
                if (main.length !== 1) {
                    // Looking for main file in both "dist" and package root.
                    var guessed =
                        guessMainFile(pkg, 'dist') ||
                            guessMainFile(pkg, '.');

                    if (guessed) {
                        main = [guessed];
                    }
                }

                // Give up if multiple main files found.
                if (main && main.length === 1) {
                    entry.main = main[0];
                }

                return entry;
            });
        })
        // Output packages.
        .then(function (packages) {
            logger.info('updating', 'Updating ' + amdVendor + ' packages definitions.');

            // Which AMD loader is to be configured?
            switch (amdVendor) {
                case "rjs":
                    var configFilePath = path.resolve(process.cwd(), config.rjsConfig);
                    if (!fs.statSync(configFilePath).isFile()) {
                        logger.error("rjs config file not found in:\n" + configFilePath);
                        break;
                    }
                    requirejs.tools.useLib(function (require) {

                        var rjsConfig = fs.readFileSync(configFilePath).toString();
                        rjsConfig = require('transform').modifyConfig(rjsConfig, function (config) {
                            // Transform into packages list.

                            // Update the original package definitions.
                            if (config.packages) {

                                // Convert to package list back to hash.
                                var dist = mout.array.reduce(config.packages, function (obj, pkg) {
                                    obj[pkg.name] = pkg;
                                    return obj;
                                }, {});

                                // Update package definitions.
                                mout.object.forOwn(packages, function (pkg) {
                                    var name = pkg.name;
                                    var existing = dist[name];
                                    if (existing) {
                                        existing["location"] = pkg.location;
                                        // Update only if main file is not yet specified.
                                        if (!existing["main"] && pkg.main)
                                            existing["main"] = pkg.main;
                                    }
                                    else
                                        dist[name] = pkg;
                                });

                                dist = mout.object.filter(dist, function (pkg, name) {

                                    // Prune packages that are not in bower.
                                    if (options.prune && !(name in packages)) {
                                        logger.info("pruned", "Pruned rjs package: " + name + " that is not found in installed components.");
                                        delete dist[name];
                                    }

                                    // Warn for packages missing "main".
                                    if (!pkg.main) logger.warn("missing", "Missing main file manifest in bower package:" + name);
                                    return pkg;
                                });

                                packages = dist;
                            }

                            config.packages = mout.object.values(packages);
                            return config;
                        });

                        fs.writeFileSync(configFilePath, rjsConfig);
                        logger.log('Updated RequireJS packages with components');
                    });
                    break;
            }

            return packages;
        })
        .done(function (value) {
            logger.emit('end', value);
        }, function (error) {
            logger.emit('error', error);
        });

    return logger;
}

// -------------------

plant.line = function (argv) {
    var options = plant.options(argv);
    return plant(options.argv.remain.slice(1)[0], options);
};

plant.options = function (argv) {
    return cli.readOptions({
        'output': { type: Boolean, shorthand: 'o'},
        'prune': { type: Boolean, shorthand: 'p'}
    }, argv);
};

plant.completion = function () {
    // TODO:
};

module.exports = plant;
