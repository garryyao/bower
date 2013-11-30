var mout = require('mout');
var Logger = require('bower-logger');
var endpointParser = require('bower-endpoint-parser');
var Project = require('../core/Project');
var cli = require('../util/cli');
var defaultConfig = require('../config');
var plant = require('./plant');
var Q = require('q');

function install(endpoints, options, config) {
    var project;
    var decEndpoints;
    var logger = new Logger();

    options = options || {};
    config = mout.object.deepFillIn(config || {}, defaultConfig);
    project = new Project(config, logger);

    // Convert endpoints to decomposed endpoints
    endpoints = endpoints || [];
    decEndpoints = endpoints.map(function (endpoint) {
        return endpointParser.decompose(endpoint);
    });

    project.install(decEndpoints, options)
    .then(function(installed) {
        // Hook in the plant command if option "save-rjs" presents.
        if (options.saveRjs) {
            var plantLogger = plant('rjs');
            var df = Q.defer();
            plantLogger.on('end',function (val) {
                df.resolve(val);
            }).on('log',function (log) {
                // Pipe the log.
                logger.log(log.level, log.id, log.message, log.data);
            }).on('error', function (error) {
                df.reject(error);
            });
            return df.promise.thenResolve(installed);
        }
        return installed;
    })
    .done(function (installed) {
        logger.emit('end', installed);
    }, function (error) {
        logger.emit('error', error);
    });

    return logger;
}

// -------------------

install.line = function (argv) {
    var options = install.options(argv);
    var logger = install(options.argv.remain.slice(1), options);
    return logger;
};

install.options = function (argv) {
    return cli.readOptions({
        'force-latest': { type: Boolean, shorthand: 'F'},
        'production': { type: Boolean, shorthand: 'p' },
        'save': { type: Boolean, shorthand: 'S' },
        'save-dev': { type: Boolean, shorthand: 'D' },
        'save-rjs': { type: Boolean, shorthand: 'R' }
    }, argv);
};

install.completion = function () {
    // TODO:
};

module.exports = install;
