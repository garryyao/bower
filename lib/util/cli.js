var mout = require('mout');
var nopt = require('nopt');
var renderers = require('../renderers');

function readOptions(options, argv) {
    var types;
    var noptOptions;
    var parsedOptions = {};
    var shorthands = {};

    if (Array.isArray(options)) {
        argv = options;
        options = {};
    } else {
        options = options || {};
    }

    types = mout.object.map(options, function (option) {
        return option.type;
    });
    mout.object.forOwn(options, function (option, name) {
        shorthands[option.shorthand] = '--' + name;
    });

    noptOptions = nopt(types, shorthands, argv);

    // Filter only the specified options because nopt parses every --
    // and make them camel case
    mout.object.forOwn(noptOptions, function (value, key) {
        if (options[key]) {
            parsedOptions[mout.string.camelCase(key)] = value;
        }
    });

    parsedOptions.argv = noptOptions.argv;

    return parsedOptions;
}

function getRenderer(command, commandOptions, config) {
    if (config.json) {
        return new renderers.Json(command, config);
    }

    // list --paths output JSON
    if (command === 'list' && commandOptions.paths) {
        return new renderers.Json(command, config);
    }

    return new renderers.Standard(command, config);
}

module.exports.readOptions = readOptions;
module.exports.getRenderer = getRenderer;