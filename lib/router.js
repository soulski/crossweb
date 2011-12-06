var fs = require('fs'),
    log4js = require('log4js')
    path = require('path');

var FileHandler = require('./modules/FileHandler.js').FileHandler;

var logger = log4js.getLogger('framework');

/**
 * Router constructor
 *
 * @param {String} configPath, path from path.resolve which will automatically 
                   parse by Router.parse
 */
var Router = function (configPath) {
  // Parse config
  this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  var output = Router.parse(configPath);
  this.methods = output.methods;
  this.modules = output.modules;
  
  FileHandler.setup(configPath);
}

/**
 * Find action from HTTP method and request resource
 *
 * @param {String} method, HTTP method name which will lower case
 * @param {String} resource, HTTP request e.g. http://sample.com/resource
 *
 * @return {Function(request, response, config)} method for current resource
 */
Router.prototype.request = function (method, resource) {
  var action = null;
  
  var methodObject = this.methods[method.toLowerCase()];
  if (methodObject) {
    action = methodObject[resource];
  } 
  
  if (!action) {
    action = FileHandler.request;
  }
  
  return action;
}

/**
 * Parse config file for url map.
 *
 * @param {String} configPath, path from path.resolve(config file name)
 *
 * @return {Object} output contains 2 object, methods which contain path and
                    list of modules.
 */
Router.parse = function (configPath) {
  var output = {
    methods: {},
    modules: {}
  }
  
  var configObject = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  var route = configObject.route;

  var defaultMethods = [ 'get', 'post' ];
  var pattern = /^([a-z]+|\*)\:\/\w+$/;
  for (var url in route) {
    if (pattern.test(url)) {
      var fragments = url.split(':');
      var method = fragments[0];
      var resource = fragments[1];
      
      var action = route[url];
      var handler = action.handler;
      var parts = handler.split('.');
      
      var modulePath = path.join(path.dirname(configPath), 'modules', parts[0]);
      
      try {
        
        var module = require(modulePath);
        if (!output.modules[parts[0]]) {
          output.modules[parts[0]] = module;

          // Init method life cycle.
          if (module.setup) {
            module.setup(configPath);
          }
        }
        
        if (module[parts[1]]) {
          if (method === '*') {
            for (var index = 0; index < defaultMethods.length; index++ ) {
              var defaultMethod = defaultMethods[index];
              if (!output.methods[defaultMethod]) {
                output.methods[defaultMethod] = {};
              }
              
              output.methods[defaultMethod][resource] = module[parts[1]];
            }
          } else {
            if (!output.methods[method]) {
              output.methods[method] = {};
            }
            
            output.methods[method][resource] = module[parts[1]];
            
          }
        } else {
          logger.error ('Module ' + parts[0] + ' has no method ' + parts[1]);
        }
        
      } catch (e) {
        logger.error ('No module ' + parts[0] + ' live in modules directory');
      }
      
    } else {
      logger.error ('Invalid path ' + url);
    }
    
    logger.trace (output.methods);
    
  }
  
  return output;
}

exports.Router = Router;