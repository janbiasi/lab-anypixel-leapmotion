(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],3:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

(function () {
    try {
        cachedSetTimeout = setTimeout;
    } catch (e) {
        cachedSetTimeout = function () {
            throw new Error('setTimeout is not defined');
        }
    }
    try {
        cachedClearTimeout = clearTimeout;
    } catch (e) {
        cachedClearTimeout = function () {
            throw new Error('clearTimeout is not defined');
        }
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],4:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],5:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":4,"_process":3,"inherits":2}],6:[function(require,module,exports){
/**
 * Copyright 2016 Google Inc. All Rights Reserved.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/license-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the license.
 */

'use strict';

module.exports = require('./lib/anypixel');

},{"./lib/anypixel":7}],7:[function(require,module,exports){
/**
 * Copyright 2016 Google Inc. All Rights Reserved.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/license-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the license.
 */

'use strict';

module.exports.config = require('./config');
module.exports.canvas = require('./canvas');
module.exports.events = require('./events');
module.exports.events.setStateListenerOn(document);

},{"./canvas":8,"./config":9,"./events":10}],8:[function(require,module,exports){
/**
 * Copyright 2016 Google Inc. All Rights Reserved.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/license-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the license.
 */

'use strict';

var config = require('./config');
var canvas = module.exports = {};

var domCanvas = document.getElementById(config.canvasId);

domCanvas.width = config.width;
domCanvas.height = config.height;

/**
 * Returns the 2D canvas context
 */
canvas.getContext2D = function getContext2D() {
	return domCanvas.getContext('2d');
}

/**
 * Returns the 3D canvas context
 */
canvas.getContext3D = function getContext3D() {
	return domCanvas.getContext('webgl', {preserveDrawingBuffer: true});
}
},{"./config":9}],9:[function(require,module,exports){
/**
 * Copyright 2016 Google Inc. All Rights Reserved.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/license-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the license.
 */

'use strict';

/**
 * Expose some configuration data. The user can overwrite this if their setup is different.
 */
var config = module.exports = {};

config.canvasId = 'button-canvas';
config.width = 140;
config.height = 42;
},{}],10:[function(require,module,exports){
/**
 * Copyright 2016 Google Inc. All Rights Reserved.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/license-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the license.
 */

'use strict';

/**
 * Listen for the 'buttonStates' event from a DOM target and emit onButtonDown / Up events
 * depending on the reported button state
 */
var events = module.exports = {};

events.setStateListenerOn = function setStateListenerOn(target) {
		
	if (target.anypixelListener) {
		return;
	}
	
	target.anypixelListener = true;

	target.addEventListener('buttonStates', function(data) {
		data.detail.forEach(function(button) {
			var x = button.p.x;
			var y = button.p.y;
			var state = button.s;
			var event = state === 1 ? 'onButtonDown' : 'onButtonUp';
			var key = x + ':' + y;

			if (state === 1) {
				events.pushedButtons[key] = {x: x, y: y};
			} else {
				delete events.pushedButtons[key];
			}
			
			target.dispatchEvent(new CustomEvent(event, {detail: {x: x, y: y}}));
		});
	});
}

/**
 * A map of currently-pushed buttons, provided for utility
 */
events.pushedButtons = {};

},{}],11:[function(require,module,exports){
/**
 * @fileoverview gl-matrix - High performance matrix and vector operations
 * @author Brandon Jones
 * @author Colin MacKenzie IV
 * @version 2.2.1
 */

/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */


(function(_global) {
  "use strict";

  var shim = {};
  if (typeof(exports) === 'undefined') {
    if(typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
      shim.exports = {};
      define(function() {
        return shim.exports;
      });
    } else {
      // gl-matrix lives in a browser, define its namespaces in global
      shim.exports = typeof(window) !== 'undefined' ? window : _global;
    }
  }
  else {
    // gl-matrix lives in commonjs, define its namespaces in exports
    shim.exports = exports;
  }

  (function(exports) {
    /* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */


if(!GLMAT_EPSILON) {
    var GLMAT_EPSILON = 0.000001;
}

if(!GLMAT_ARRAY_TYPE) {
    var GLMAT_ARRAY_TYPE = (typeof Float32Array !== 'undefined') ? Float32Array : Array;
}

if(!GLMAT_RANDOM) {
    var GLMAT_RANDOM = Math.random;
}

/**
 * @class Common utilities
 * @name glMatrix
 */
var glMatrix = {};

/**
 * Sets the type of array used when creating new vectors and matricies
 *
 * @param {Type} type Array type, such as Float32Array or Array
 */
glMatrix.setMatrixArrayType = function(type) {
    GLMAT_ARRAY_TYPE = type;
}

if(typeof(exports) !== 'undefined') {
    exports.glMatrix = glMatrix;
}

var degree = Math.PI / 180;

/**
* Convert Degree To Radian
*
* @param {Number} Angle in Degrees
*/
glMatrix.toRadian = function(a){
     return a * degree;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class 2 Dimensional Vector
 * @name vec2
 */

var vec2 = {};

/**
 * Creates a new, empty vec2
 *
 * @returns {vec2} a new 2D vector
 */
vec2.create = function() {
    var out = new GLMAT_ARRAY_TYPE(2);
    out[0] = 0;
    out[1] = 0;
    return out;
};

/**
 * Creates a new vec2 initialized with values from an existing vector
 *
 * @param {vec2} a vector to clone
 * @returns {vec2} a new 2D vector
 */
vec2.clone = function(a) {
    var out = new GLMAT_ARRAY_TYPE(2);
    out[0] = a[0];
    out[1] = a[1];
    return out;
};

/**
 * Creates a new vec2 initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @returns {vec2} a new 2D vector
 */
vec2.fromValues = function(x, y) {
    var out = new GLMAT_ARRAY_TYPE(2);
    out[0] = x;
    out[1] = y;
    return out;
};

/**
 * Copy the values from one vec2 to another
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the source vector
 * @returns {vec2} out
 */
vec2.copy = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    return out;
};

/**
 * Set the components of a vec2 to the given values
 *
 * @param {vec2} out the receiving vector
 * @param {Number} x X component
 * @param {Number} y Y component
 * @returns {vec2} out
 */
vec2.set = function(out, x, y) {
    out[0] = x;
    out[1] = y;
    return out;
};

/**
 * Adds two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */
vec2.add = function(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    return out;
};

/**
 * Subtracts vector b from vector a
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */
vec2.subtract = function(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    return out;
};

/**
 * Alias for {@link vec2.subtract}
 * @function
 */
vec2.sub = vec2.subtract;

/**
 * Multiplies two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */
vec2.multiply = function(out, a, b) {
    out[0] = a[0] * b[0];
    out[1] = a[1] * b[1];
    return out;
};

/**
 * Alias for {@link vec2.multiply}
 * @function
 */
vec2.mul = vec2.multiply;

/**
 * Divides two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */
vec2.divide = function(out, a, b) {
    out[0] = a[0] / b[0];
    out[1] = a[1] / b[1];
    return out;
};

/**
 * Alias for {@link vec2.divide}
 * @function
 */
vec2.div = vec2.divide;

/**
 * Returns the minimum of two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */
vec2.min = function(out, a, b) {
    out[0] = Math.min(a[0], b[0]);
    out[1] = Math.min(a[1], b[1]);
    return out;
};

/**
 * Returns the maximum of two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */
vec2.max = function(out, a, b) {
    out[0] = Math.max(a[0], b[0]);
    out[1] = Math.max(a[1], b[1]);
    return out;
};

/**
 * Scales a vec2 by a scalar number
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {vec2} out
 */
vec2.scale = function(out, a, b) {
    out[0] = a[0] * b;
    out[1] = a[1] * b;
    return out;
};

/**
 * Adds two vec2's after scaling the second operand by a scalar value
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @param {Number} scale the amount to scale b by before adding
 * @returns {vec2} out
 */
vec2.scaleAndAdd = function(out, a, b, scale) {
    out[0] = a[0] + (b[0] * scale);
    out[1] = a[1] + (b[1] * scale);
    return out;
};

/**
 * Calculates the euclidian distance between two vec2's
 *
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {Number} distance between a and b
 */
vec2.distance = function(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1];
    return Math.sqrt(x*x + y*y);
};

/**
 * Alias for {@link vec2.distance}
 * @function
 */
vec2.dist = vec2.distance;

/**
 * Calculates the squared euclidian distance between two vec2's
 *
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {Number} squared distance between a and b
 */
vec2.squaredDistance = function(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1];
    return x*x + y*y;
};

/**
 * Alias for {@link vec2.squaredDistance}
 * @function
 */
vec2.sqrDist = vec2.squaredDistance;

/**
 * Calculates the length of a vec2
 *
 * @param {vec2} a vector to calculate length of
 * @returns {Number} length of a
 */
vec2.length = function (a) {
    var x = a[0],
        y = a[1];
    return Math.sqrt(x*x + y*y);
};

/**
 * Alias for {@link vec2.length}
 * @function
 */
vec2.len = vec2.length;

/**
 * Calculates the squared length of a vec2
 *
 * @param {vec2} a vector to calculate squared length of
 * @returns {Number} squared length of a
 */
vec2.squaredLength = function (a) {
    var x = a[0],
        y = a[1];
    return x*x + y*y;
};

/**
 * Alias for {@link vec2.squaredLength}
 * @function
 */
vec2.sqrLen = vec2.squaredLength;

/**
 * Negates the components of a vec2
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a vector to negate
 * @returns {vec2} out
 */
vec2.negate = function(out, a) {
    out[0] = -a[0];
    out[1] = -a[1];
    return out;
};

/**
 * Normalize a vec2
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a vector to normalize
 * @returns {vec2} out
 */
vec2.normalize = function(out, a) {
    var x = a[0],
        y = a[1];
    var len = x*x + y*y;
    if (len > 0) {
        //TODO: evaluate use of glm_invsqrt here?
        len = 1 / Math.sqrt(len);
        out[0] = a[0] * len;
        out[1] = a[1] * len;
    }
    return out;
};

/**
 * Calculates the dot product of two vec2's
 *
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {Number} dot product of a and b
 */
vec2.dot = function (a, b) {
    return a[0] * b[0] + a[1] * b[1];
};

/**
 * Computes the cross product of two vec2's
 * Note that the cross product must by definition produce a 3D vector
 *
 * @param {vec3} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec3} out
 */
vec2.cross = function(out, a, b) {
    var z = a[0] * b[1] - a[1] * b[0];
    out[0] = out[1] = 0;
    out[2] = z;
    return out;
};

/**
 * Performs a linear interpolation between two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {vec2} out
 */
vec2.lerp = function (out, a, b, t) {
    var ax = a[0],
        ay = a[1];
    out[0] = ax + t * (b[0] - ax);
    out[1] = ay + t * (b[1] - ay);
    return out;
};

/**
 * Generates a random vector with the given scale
 *
 * @param {vec2} out the receiving vector
 * @param {Number} [scale] Length of the resulting vector. If ommitted, a unit vector will be returned
 * @returns {vec2} out
 */
vec2.random = function (out, scale) {
    scale = scale || 1.0;
    var r = GLMAT_RANDOM() * 2.0 * Math.PI;
    out[0] = Math.cos(r) * scale;
    out[1] = Math.sin(r) * scale;
    return out;
};

/**
 * Transforms the vec2 with a mat2
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the vector to transform
 * @param {mat2} m matrix to transform with
 * @returns {vec2} out
 */
vec2.transformMat2 = function(out, a, m) {
    var x = a[0],
        y = a[1];
    out[0] = m[0] * x + m[2] * y;
    out[1] = m[1] * x + m[3] * y;
    return out;
};

/**
 * Transforms the vec2 with a mat2d
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the vector to transform
 * @param {mat2d} m matrix to transform with
 * @returns {vec2} out
 */
vec2.transformMat2d = function(out, a, m) {
    var x = a[0],
        y = a[1];
    out[0] = m[0] * x + m[2] * y + m[4];
    out[1] = m[1] * x + m[3] * y + m[5];
    return out;
};

/**
 * Transforms the vec2 with a mat3
 * 3rd vector component is implicitly '1'
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the vector to transform
 * @param {mat3} m matrix to transform with
 * @returns {vec2} out
 */
vec2.transformMat3 = function(out, a, m) {
    var x = a[0],
        y = a[1];
    out[0] = m[0] * x + m[3] * y + m[6];
    out[1] = m[1] * x + m[4] * y + m[7];
    return out;
};

/**
 * Transforms the vec2 with a mat4
 * 3rd vector component is implicitly '0'
 * 4th vector component is implicitly '1'
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the vector to transform
 * @param {mat4} m matrix to transform with
 * @returns {vec2} out
 */
vec2.transformMat4 = function(out, a, m) {
    var x = a[0], 
        y = a[1];
    out[0] = m[0] * x + m[4] * y + m[12];
    out[1] = m[1] * x + m[5] * y + m[13];
    return out;
};

/**
 * Perform some operation over an array of vec2s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec2. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec2s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */
vec2.forEach = (function() {
    var vec = vec2.create();

    return function(a, stride, offset, count, fn, arg) {
        var i, l;
        if(!stride) {
            stride = 2;
        }

        if(!offset) {
            offset = 0;
        }
        
        if(count) {
            l = Math.min((count * stride) + offset, a.length);
        } else {
            l = a.length;
        }

        for(i = offset; i < l; i += stride) {
            vec[0] = a[i]; vec[1] = a[i+1];
            fn(vec, vec, arg);
            a[i] = vec[0]; a[i+1] = vec[1];
        }
        
        return a;
    };
})();

/**
 * Returns a string representation of a vector
 *
 * @param {vec2} vec vector to represent as a string
 * @returns {String} string representation of the vector
 */
vec2.str = function (a) {
    return 'vec2(' + a[0] + ', ' + a[1] + ')';
};

if(typeof(exports) !== 'undefined') {
    exports.vec2 = vec2;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class 3 Dimensional Vector
 * @name vec3
 */

var vec3 = {};

/**
 * Creates a new, empty vec3
 *
 * @returns {vec3} a new 3D vector
 */
vec3.create = function() {
    var out = new GLMAT_ARRAY_TYPE(3);
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    return out;
};

/**
 * Creates a new vec3 initialized with values from an existing vector
 *
 * @param {vec3} a vector to clone
 * @returns {vec3} a new 3D vector
 */
vec3.clone = function(a) {
    var out = new GLMAT_ARRAY_TYPE(3);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    return out;
};

/**
 * Creates a new vec3 initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @returns {vec3} a new 3D vector
 */
vec3.fromValues = function(x, y, z) {
    var out = new GLMAT_ARRAY_TYPE(3);
    out[0] = x;
    out[1] = y;
    out[2] = z;
    return out;
};

/**
 * Copy the values from one vec3 to another
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the source vector
 * @returns {vec3} out
 */
vec3.copy = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    return out;
};

/**
 * Set the components of a vec3 to the given values
 *
 * @param {vec3} out the receiving vector
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @returns {vec3} out
 */
vec3.set = function(out, x, y, z) {
    out[0] = x;
    out[1] = y;
    out[2] = z;
    return out;
};

/**
 * Adds two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
vec3.add = function(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    out[2] = a[2] + b[2];
    return out;
};

/**
 * Subtracts vector b from vector a
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
vec3.subtract = function(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    return out;
};

/**
 * Alias for {@link vec3.subtract}
 * @function
 */
vec3.sub = vec3.subtract;

/**
 * Multiplies two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
vec3.multiply = function(out, a, b) {
    out[0] = a[0] * b[0];
    out[1] = a[1] * b[1];
    out[2] = a[2] * b[2];
    return out;
};

/**
 * Alias for {@link vec3.multiply}
 * @function
 */
vec3.mul = vec3.multiply;

/**
 * Divides two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
vec3.divide = function(out, a, b) {
    out[0] = a[0] / b[0];
    out[1] = a[1] / b[1];
    out[2] = a[2] / b[2];
    return out;
};

/**
 * Alias for {@link vec3.divide}
 * @function
 */
vec3.div = vec3.divide;

/**
 * Returns the minimum of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
vec3.min = function(out, a, b) {
    out[0] = Math.min(a[0], b[0]);
    out[1] = Math.min(a[1], b[1]);
    out[2] = Math.min(a[2], b[2]);
    return out;
};

/**
 * Returns the maximum of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
vec3.max = function(out, a, b) {
    out[0] = Math.max(a[0], b[0]);
    out[1] = Math.max(a[1], b[1]);
    out[2] = Math.max(a[2], b[2]);
    return out;
};

/**
 * Scales a vec3 by a scalar number
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {vec3} out
 */
vec3.scale = function(out, a, b) {
    out[0] = a[0] * b;
    out[1] = a[1] * b;
    out[2] = a[2] * b;
    return out;
};

/**
 * Adds two vec3's after scaling the second operand by a scalar value
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @param {Number} scale the amount to scale b by before adding
 * @returns {vec3} out
 */
vec3.scaleAndAdd = function(out, a, b, scale) {
    out[0] = a[0] + (b[0] * scale);
    out[1] = a[1] + (b[1] * scale);
    out[2] = a[2] + (b[2] * scale);
    return out;
};

/**
 * Calculates the euclidian distance between two vec3's
 *
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {Number} distance between a and b
 */
vec3.distance = function(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1],
        z = b[2] - a[2];
    return Math.sqrt(x*x + y*y + z*z);
};

/**
 * Alias for {@link vec3.distance}
 * @function
 */
vec3.dist = vec3.distance;

/**
 * Calculates the squared euclidian distance between two vec3's
 *
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {Number} squared distance between a and b
 */
vec3.squaredDistance = function(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1],
        z = b[2] - a[2];
    return x*x + y*y + z*z;
};

/**
 * Alias for {@link vec3.squaredDistance}
 * @function
 */
vec3.sqrDist = vec3.squaredDistance;

/**
 * Calculates the length of a vec3
 *
 * @param {vec3} a vector to calculate length of
 * @returns {Number} length of a
 */
vec3.length = function (a) {
    var x = a[0],
        y = a[1],
        z = a[2];
    return Math.sqrt(x*x + y*y + z*z);
};

/**
 * Alias for {@link vec3.length}
 * @function
 */
vec3.len = vec3.length;

/**
 * Calculates the squared length of a vec3
 *
 * @param {vec3} a vector to calculate squared length of
 * @returns {Number} squared length of a
 */
vec3.squaredLength = function (a) {
    var x = a[0],
        y = a[1],
        z = a[2];
    return x*x + y*y + z*z;
};

/**
 * Alias for {@link vec3.squaredLength}
 * @function
 */
vec3.sqrLen = vec3.squaredLength;

/**
 * Negates the components of a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a vector to negate
 * @returns {vec3} out
 */
vec3.negate = function(out, a) {
    out[0] = -a[0];
    out[1] = -a[1];
    out[2] = -a[2];
    return out;
};

/**
 * Normalize a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a vector to normalize
 * @returns {vec3} out
 */
vec3.normalize = function(out, a) {
    var x = a[0],
        y = a[1],
        z = a[2];
    var len = x*x + y*y + z*z;
    if (len > 0) {
        //TODO: evaluate use of glm_invsqrt here?
        len = 1 / Math.sqrt(len);
        out[0] = a[0] * len;
        out[1] = a[1] * len;
        out[2] = a[2] * len;
    }
    return out;
};

/**
 * Calculates the dot product of two vec3's
 *
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {Number} dot product of a and b
 */
vec3.dot = function (a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
};

/**
 * Computes the cross product of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
vec3.cross = function(out, a, b) {
    var ax = a[0], ay = a[1], az = a[2],
        bx = b[0], by = b[1], bz = b[2];

    out[0] = ay * bz - az * by;
    out[1] = az * bx - ax * bz;
    out[2] = ax * by - ay * bx;
    return out;
};

/**
 * Performs a linear interpolation between two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {vec3} out
 */
vec3.lerp = function (out, a, b, t) {
    var ax = a[0],
        ay = a[1],
        az = a[2];
    out[0] = ax + t * (b[0] - ax);
    out[1] = ay + t * (b[1] - ay);
    out[2] = az + t * (b[2] - az);
    return out;
};

/**
 * Generates a random vector with the given scale
 *
 * @param {vec3} out the receiving vector
 * @param {Number} [scale] Length of the resulting vector. If ommitted, a unit vector will be returned
 * @returns {vec3} out
 */
vec3.random = function (out, scale) {
    scale = scale || 1.0;

    var r = GLMAT_RANDOM() * 2.0 * Math.PI;
    var z = (GLMAT_RANDOM() * 2.0) - 1.0;
    var zScale = Math.sqrt(1.0-z*z) * scale;

    out[0] = Math.cos(r) * zScale;
    out[1] = Math.sin(r) * zScale;
    out[2] = z * scale;
    return out;
};

/**
 * Transforms the vec3 with a mat4.
 * 4th vector component is implicitly '1'
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the vector to transform
 * @param {mat4} m matrix to transform with
 * @returns {vec3} out
 */
vec3.transformMat4 = function(out, a, m) {
    var x = a[0], y = a[1], z = a[2];
    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    return out;
};

/**
 * Transforms the vec3 with a mat3.
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the vector to transform
 * @param {mat4} m the 3x3 matrix to transform with
 * @returns {vec3} out
 */
vec3.transformMat3 = function(out, a, m) {
    var x = a[0], y = a[1], z = a[2];
    out[0] = x * m[0] + y * m[3] + z * m[6];
    out[1] = x * m[1] + y * m[4] + z * m[7];
    out[2] = x * m[2] + y * m[5] + z * m[8];
    return out;
};

/**
 * Transforms the vec3 with a quat
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the vector to transform
 * @param {quat} q quaternion to transform with
 * @returns {vec3} out
 */
vec3.transformQuat = function(out, a, q) {
    // benchmarks: http://jsperf.com/quaternion-transform-vec3-implementations

    var x = a[0], y = a[1], z = a[2],
        qx = q[0], qy = q[1], qz = q[2], qw = q[3],

        // calculate quat * vec
        ix = qw * x + qy * z - qz * y,
        iy = qw * y + qz * x - qx * z,
        iz = qw * z + qx * y - qy * x,
        iw = -qx * x - qy * y - qz * z;

    // calculate result * inverse quat
    out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return out;
};

/*
* Rotate a 3D vector around the x-axis
* @param {vec3} out The receiving vec3
* @param {vec3} a The vec3 point to rotate
* @param {vec3} b The origin of the rotation
* @param {Number} c The angle of rotation
* @returns {vec3} out
*/
vec3.rotateX = function(out, a, b, c){
   var p = [], r=[];
	  //Translate point to the origin
	  p[0] = a[0] - b[0];
	  p[1] = a[1] - b[1];
  	p[2] = a[2] - b[2];

	  //perform rotation
	  r[0] = p[0];
	  r[1] = p[1]*Math.cos(c) - p[2]*Math.sin(c);
	  r[2] = p[1]*Math.sin(c) + p[2]*Math.cos(c);

	  //translate to correct position
	  out[0] = r[0] + b[0];
	  out[1] = r[1] + b[1];
	  out[2] = r[2] + b[2];

  	return out;
};

/*
* Rotate a 3D vector around the y-axis
* @param {vec3} out The receiving vec3
* @param {vec3} a The vec3 point to rotate
* @param {vec3} b The origin of the rotation
* @param {Number} c The angle of rotation
* @returns {vec3} out
*/
vec3.rotateY = function(out, a, b, c){
  	var p = [], r=[];
  	//Translate point to the origin
  	p[0] = a[0] - b[0];
  	p[1] = a[1] - b[1];
  	p[2] = a[2] - b[2];
  
  	//perform rotation
  	r[0] = p[2]*Math.sin(c) + p[0]*Math.cos(c);
  	r[1] = p[1];
  	r[2] = p[2]*Math.cos(c) - p[0]*Math.sin(c);
  
  	//translate to correct position
  	out[0] = r[0] + b[0];
  	out[1] = r[1] + b[1];
  	out[2] = r[2] + b[2];
  
  	return out;
};

/*
* Rotate a 3D vector around the z-axis
* @param {vec3} out The receiving vec3
* @param {vec3} a The vec3 point to rotate
* @param {vec3} b The origin of the rotation
* @param {Number} c The angle of rotation
* @returns {vec3} out
*/
vec3.rotateZ = function(out, a, b, c){
  	var p = [], r=[];
  	//Translate point to the origin
  	p[0] = a[0] - b[0];
  	p[1] = a[1] - b[1];
  	p[2] = a[2] - b[2];
  
  	//perform rotation
  	r[0] = p[0]*Math.cos(c) - p[1]*Math.sin(c);
  	r[1] = p[0]*Math.sin(c) + p[1]*Math.cos(c);
  	r[2] = p[2];
  
  	//translate to correct position
  	out[0] = r[0] + b[0];
  	out[1] = r[1] + b[1];
  	out[2] = r[2] + b[2];
  
  	return out;
};

/**
 * Perform some operation over an array of vec3s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec3. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec3s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */
vec3.forEach = (function() {
    var vec = vec3.create();

    return function(a, stride, offset, count, fn, arg) {
        var i, l;
        if(!stride) {
            stride = 3;
        }

        if(!offset) {
            offset = 0;
        }
        
        if(count) {
            l = Math.min((count * stride) + offset, a.length);
        } else {
            l = a.length;
        }

        for(i = offset; i < l; i += stride) {
            vec[0] = a[i]; vec[1] = a[i+1]; vec[2] = a[i+2];
            fn(vec, vec, arg);
            a[i] = vec[0]; a[i+1] = vec[1]; a[i+2] = vec[2];
        }
        
        return a;
    };
})();

/**
 * Returns a string representation of a vector
 *
 * @param {vec3} vec vector to represent as a string
 * @returns {String} string representation of the vector
 */
vec3.str = function (a) {
    return 'vec3(' + a[0] + ', ' + a[1] + ', ' + a[2] + ')';
};

if(typeof(exports) !== 'undefined') {
    exports.vec3 = vec3;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class 4 Dimensional Vector
 * @name vec4
 */

var vec4 = {};

/**
 * Creates a new, empty vec4
 *
 * @returns {vec4} a new 4D vector
 */
vec4.create = function() {
    var out = new GLMAT_ARRAY_TYPE(4);
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    return out;
};

/**
 * Creates a new vec4 initialized with values from an existing vector
 *
 * @param {vec4} a vector to clone
 * @returns {vec4} a new 4D vector
 */
vec4.clone = function(a) {
    var out = new GLMAT_ARRAY_TYPE(4);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    return out;
};

/**
 * Creates a new vec4 initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {vec4} a new 4D vector
 */
vec4.fromValues = function(x, y, z, w) {
    var out = new GLMAT_ARRAY_TYPE(4);
    out[0] = x;
    out[1] = y;
    out[2] = z;
    out[3] = w;
    return out;
};

/**
 * Copy the values from one vec4 to another
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the source vector
 * @returns {vec4} out
 */
vec4.copy = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    return out;
};

/**
 * Set the components of a vec4 to the given values
 *
 * @param {vec4} out the receiving vector
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {vec4} out
 */
vec4.set = function(out, x, y, z, w) {
    out[0] = x;
    out[1] = y;
    out[2] = z;
    out[3] = w;
    return out;
};

/**
 * Adds two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */
vec4.add = function(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    out[2] = a[2] + b[2];
    out[3] = a[3] + b[3];
    return out;
};

/**
 * Subtracts vector b from vector a
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */
vec4.subtract = function(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    out[3] = a[3] - b[3];
    return out;
};

/**
 * Alias for {@link vec4.subtract}
 * @function
 */
vec4.sub = vec4.subtract;

/**
 * Multiplies two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */
vec4.multiply = function(out, a, b) {
    out[0] = a[0] * b[0];
    out[1] = a[1] * b[1];
    out[2] = a[2] * b[2];
    out[3] = a[3] * b[3];
    return out;
};

/**
 * Alias for {@link vec4.multiply}
 * @function
 */
vec4.mul = vec4.multiply;

/**
 * Divides two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */
vec4.divide = function(out, a, b) {
    out[0] = a[0] / b[0];
    out[1] = a[1] / b[1];
    out[2] = a[2] / b[2];
    out[3] = a[3] / b[3];
    return out;
};

/**
 * Alias for {@link vec4.divide}
 * @function
 */
vec4.div = vec4.divide;

/**
 * Returns the minimum of two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */
vec4.min = function(out, a, b) {
    out[0] = Math.min(a[0], b[0]);
    out[1] = Math.min(a[1], b[1]);
    out[2] = Math.min(a[2], b[2]);
    out[3] = Math.min(a[3], b[3]);
    return out;
};

/**
 * Returns the maximum of two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */
vec4.max = function(out, a, b) {
    out[0] = Math.max(a[0], b[0]);
    out[1] = Math.max(a[1], b[1]);
    out[2] = Math.max(a[2], b[2]);
    out[3] = Math.max(a[3], b[3]);
    return out;
};

/**
 * Scales a vec4 by a scalar number
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {vec4} out
 */
vec4.scale = function(out, a, b) {
    out[0] = a[0] * b;
    out[1] = a[1] * b;
    out[2] = a[2] * b;
    out[3] = a[3] * b;
    return out;
};

/**
 * Adds two vec4's after scaling the second operand by a scalar value
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @param {Number} scale the amount to scale b by before adding
 * @returns {vec4} out
 */
vec4.scaleAndAdd = function(out, a, b, scale) {
    out[0] = a[0] + (b[0] * scale);
    out[1] = a[1] + (b[1] * scale);
    out[2] = a[2] + (b[2] * scale);
    out[3] = a[3] + (b[3] * scale);
    return out;
};

/**
 * Calculates the euclidian distance between two vec4's
 *
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {Number} distance between a and b
 */
vec4.distance = function(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1],
        z = b[2] - a[2],
        w = b[3] - a[3];
    return Math.sqrt(x*x + y*y + z*z + w*w);
};

/**
 * Alias for {@link vec4.distance}
 * @function
 */
vec4.dist = vec4.distance;

/**
 * Calculates the squared euclidian distance between two vec4's
 *
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {Number} squared distance between a and b
 */
vec4.squaredDistance = function(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1],
        z = b[2] - a[2],
        w = b[3] - a[3];
    return x*x + y*y + z*z + w*w;
};

/**
 * Alias for {@link vec4.squaredDistance}
 * @function
 */
vec4.sqrDist = vec4.squaredDistance;

/**
 * Calculates the length of a vec4
 *
 * @param {vec4} a vector to calculate length of
 * @returns {Number} length of a
 */
vec4.length = function (a) {
    var x = a[0],
        y = a[1],
        z = a[2],
        w = a[3];
    return Math.sqrt(x*x + y*y + z*z + w*w);
};

/**
 * Alias for {@link vec4.length}
 * @function
 */
vec4.len = vec4.length;

/**
 * Calculates the squared length of a vec4
 *
 * @param {vec4} a vector to calculate squared length of
 * @returns {Number} squared length of a
 */
vec4.squaredLength = function (a) {
    var x = a[0],
        y = a[1],
        z = a[2],
        w = a[3];
    return x*x + y*y + z*z + w*w;
};

/**
 * Alias for {@link vec4.squaredLength}
 * @function
 */
vec4.sqrLen = vec4.squaredLength;

/**
 * Negates the components of a vec4
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a vector to negate
 * @returns {vec4} out
 */
vec4.negate = function(out, a) {
    out[0] = -a[0];
    out[1] = -a[1];
    out[2] = -a[2];
    out[3] = -a[3];
    return out;
};

/**
 * Normalize a vec4
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a vector to normalize
 * @returns {vec4} out
 */
vec4.normalize = function(out, a) {
    var x = a[0],
        y = a[1],
        z = a[2],
        w = a[3];
    var len = x*x + y*y + z*z + w*w;
    if (len > 0) {
        len = 1 / Math.sqrt(len);
        out[0] = a[0] * len;
        out[1] = a[1] * len;
        out[2] = a[2] * len;
        out[3] = a[3] * len;
    }
    return out;
};

/**
 * Calculates the dot product of two vec4's
 *
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {Number} dot product of a and b
 */
vec4.dot = function (a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
};

/**
 * Performs a linear interpolation between two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {vec4} out
 */
vec4.lerp = function (out, a, b, t) {
    var ax = a[0],
        ay = a[1],
        az = a[2],
        aw = a[3];
    out[0] = ax + t * (b[0] - ax);
    out[1] = ay + t * (b[1] - ay);
    out[2] = az + t * (b[2] - az);
    out[3] = aw + t * (b[3] - aw);
    return out;
};

/**
 * Generates a random vector with the given scale
 *
 * @param {vec4} out the receiving vector
 * @param {Number} [scale] Length of the resulting vector. If ommitted, a unit vector will be returned
 * @returns {vec4} out
 */
vec4.random = function (out, scale) {
    scale = scale || 1.0;

    //TODO: This is a pretty awful way of doing this. Find something better.
    out[0] = GLMAT_RANDOM();
    out[1] = GLMAT_RANDOM();
    out[2] = GLMAT_RANDOM();
    out[3] = GLMAT_RANDOM();
    vec4.normalize(out, out);
    vec4.scale(out, out, scale);
    return out;
};

/**
 * Transforms the vec4 with a mat4.
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the vector to transform
 * @param {mat4} m matrix to transform with
 * @returns {vec4} out
 */
vec4.transformMat4 = function(out, a, m) {
    var x = a[0], y = a[1], z = a[2], w = a[3];
    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
    out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
    return out;
};

/**
 * Transforms the vec4 with a quat
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the vector to transform
 * @param {quat} q quaternion to transform with
 * @returns {vec4} out
 */
vec4.transformQuat = function(out, a, q) {
    var x = a[0], y = a[1], z = a[2],
        qx = q[0], qy = q[1], qz = q[2], qw = q[3],

        // calculate quat * vec
        ix = qw * x + qy * z - qz * y,
        iy = qw * y + qz * x - qx * z,
        iz = qw * z + qx * y - qy * x,
        iw = -qx * x - qy * y - qz * z;

    // calculate result * inverse quat
    out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return out;
};

/**
 * Perform some operation over an array of vec4s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec4. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec2s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */
vec4.forEach = (function() {
    var vec = vec4.create();

    return function(a, stride, offset, count, fn, arg) {
        var i, l;
        if(!stride) {
            stride = 4;
        }

        if(!offset) {
            offset = 0;
        }
        
        if(count) {
            l = Math.min((count * stride) + offset, a.length);
        } else {
            l = a.length;
        }

        for(i = offset; i < l; i += stride) {
            vec[0] = a[i]; vec[1] = a[i+1]; vec[2] = a[i+2]; vec[3] = a[i+3];
            fn(vec, vec, arg);
            a[i] = vec[0]; a[i+1] = vec[1]; a[i+2] = vec[2]; a[i+3] = vec[3];
        }
        
        return a;
    };
})();

/**
 * Returns a string representation of a vector
 *
 * @param {vec4} vec vector to represent as a string
 * @returns {String} string representation of the vector
 */
vec4.str = function (a) {
    return 'vec4(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ')';
};

if(typeof(exports) !== 'undefined') {
    exports.vec4 = vec4;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class 2x2 Matrix
 * @name mat2
 */

var mat2 = {};

/**
 * Creates a new identity mat2
 *
 * @returns {mat2} a new 2x2 matrix
 */
mat2.create = function() {
    var out = new GLMAT_ARRAY_TYPE(4);
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    return out;
};

/**
 * Creates a new mat2 initialized with values from an existing matrix
 *
 * @param {mat2} a matrix to clone
 * @returns {mat2} a new 2x2 matrix
 */
mat2.clone = function(a) {
    var out = new GLMAT_ARRAY_TYPE(4);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    return out;
};

/**
 * Copy the values from one mat2 to another
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the source matrix
 * @returns {mat2} out
 */
mat2.copy = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    return out;
};

/**
 * Set a mat2 to the identity matrix
 *
 * @param {mat2} out the receiving matrix
 * @returns {mat2} out
 */
mat2.identity = function(out) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    return out;
};

/**
 * Transpose the values of a mat2
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the source matrix
 * @returns {mat2} out
 */
mat2.transpose = function(out, a) {
    // If we are transposing ourselves we can skip a few steps but have to cache some values
    if (out === a) {
        var a1 = a[1];
        out[1] = a[2];
        out[2] = a1;
    } else {
        out[0] = a[0];
        out[1] = a[2];
        out[2] = a[1];
        out[3] = a[3];
    }
    
    return out;
};

/**
 * Inverts a mat2
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the source matrix
 * @returns {mat2} out
 */
mat2.invert = function(out, a) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3],

        // Calculate the determinant
        det = a0 * a3 - a2 * a1;

    if (!det) {
        return null;
    }
    det = 1.0 / det;
    
    out[0] =  a3 * det;
    out[1] = -a1 * det;
    out[2] = -a2 * det;
    out[3] =  a0 * det;

    return out;
};

/**
 * Calculates the adjugate of a mat2
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the source matrix
 * @returns {mat2} out
 */
mat2.adjoint = function(out, a) {
    // Caching this value is nessecary if out == a
    var a0 = a[0];
    out[0] =  a[3];
    out[1] = -a[1];
    out[2] = -a[2];
    out[3] =  a0;

    return out;
};

/**
 * Calculates the determinant of a mat2
 *
 * @param {mat2} a the source matrix
 * @returns {Number} determinant of a
 */
mat2.determinant = function (a) {
    return a[0] * a[3] - a[2] * a[1];
};

/**
 * Multiplies two mat2's
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the first operand
 * @param {mat2} b the second operand
 * @returns {mat2} out
 */
mat2.multiply = function (out, a, b) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3];
    var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = a0 * b0 + a2 * b1;
    out[1] = a1 * b0 + a3 * b1;
    out[2] = a0 * b2 + a2 * b3;
    out[3] = a1 * b2 + a3 * b3;
    return out;
};

/**
 * Alias for {@link mat2.multiply}
 * @function
 */
mat2.mul = mat2.multiply;

/**
 * Rotates a mat2 by the given angle
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat2} out
 */
mat2.rotate = function (out, a, rad) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3],
        s = Math.sin(rad),
        c = Math.cos(rad);
    out[0] = a0 *  c + a2 * s;
    out[1] = a1 *  c + a3 * s;
    out[2] = a0 * -s + a2 * c;
    out[3] = a1 * -s + a3 * c;
    return out;
};

/**
 * Scales the mat2 by the dimensions in the given vec2
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the matrix to rotate
 * @param {vec2} v the vec2 to scale the matrix by
 * @returns {mat2} out
 **/
mat2.scale = function(out, a, v) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3],
        v0 = v[0], v1 = v[1];
    out[0] = a0 * v0;
    out[1] = a1 * v0;
    out[2] = a2 * v1;
    out[3] = a3 * v1;
    return out;
};

/**
 * Returns a string representation of a mat2
 *
 * @param {mat2} mat matrix to represent as a string
 * @returns {String} string representation of the matrix
 */
mat2.str = function (a) {
    return 'mat2(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ')';
};

/**
 * Returns Frobenius norm of a mat2
 *
 * @param {mat2} a the matrix to calculate Frobenius norm of
 * @returns {Number} Frobenius norm
 */
mat2.frob = function (a) {
    return(Math.sqrt(Math.pow(a[0], 2) + Math.pow(a[1], 2) + Math.pow(a[2], 2) + Math.pow(a[3], 2)))
};

/**
 * Returns L, D and U matrices (Lower triangular, Diagonal and Upper triangular) by factorizing the input matrix
 * @param {mat2} L the lower triangular matrix 
 * @param {mat2} D the diagonal matrix 
 * @param {mat2} U the upper triangular matrix 
 * @param {mat2} a the input matrix to factorize
 */

mat2.LDU = function (L, D, U, a) { 
    L[2] = a[2]/a[0]; 
    U[0] = a[0]; 
    U[1] = a[1]; 
    U[3] = a[3] - L[2] * U[1]; 
    return [L, D, U];       
}; 

if(typeof(exports) !== 'undefined') {
    exports.mat2 = mat2;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class 2x3 Matrix
 * @name mat2d
 * 
 * @description 
 * A mat2d contains six elements defined as:
 * <pre>
 * [a, c, tx,
 *  b, d, ty]
 * </pre>
 * This is a short form for the 3x3 matrix:
 * <pre>
 * [a, c, tx,
 *  b, d, ty,
 *  0, 0, 1]
 * </pre>
 * The last row is ignored so the array is shorter and operations are faster.
 */

var mat2d = {};

/**
 * Creates a new identity mat2d
 *
 * @returns {mat2d} a new 2x3 matrix
 */
mat2d.create = function() {
    var out = new GLMAT_ARRAY_TYPE(6);
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    out[4] = 0;
    out[5] = 0;
    return out;
};

/**
 * Creates a new mat2d initialized with values from an existing matrix
 *
 * @param {mat2d} a matrix to clone
 * @returns {mat2d} a new 2x3 matrix
 */
mat2d.clone = function(a) {
    var out = new GLMAT_ARRAY_TYPE(6);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    return out;
};

/**
 * Copy the values from one mat2d to another
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the source matrix
 * @returns {mat2d} out
 */
mat2d.copy = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    return out;
};

/**
 * Set a mat2d to the identity matrix
 *
 * @param {mat2d} out the receiving matrix
 * @returns {mat2d} out
 */
mat2d.identity = function(out) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    out[4] = 0;
    out[5] = 0;
    return out;
};

/**
 * Inverts a mat2d
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the source matrix
 * @returns {mat2d} out
 */
mat2d.invert = function(out, a) {
    var aa = a[0], ab = a[1], ac = a[2], ad = a[3],
        atx = a[4], aty = a[5];

    var det = aa * ad - ab * ac;
    if(!det){
        return null;
    }
    det = 1.0 / det;

    out[0] = ad * det;
    out[1] = -ab * det;
    out[2] = -ac * det;
    out[3] = aa * det;
    out[4] = (ac * aty - ad * atx) * det;
    out[5] = (ab * atx - aa * aty) * det;
    return out;
};

/**
 * Calculates the determinant of a mat2d
 *
 * @param {mat2d} a the source matrix
 * @returns {Number} determinant of a
 */
mat2d.determinant = function (a) {
    return a[0] * a[3] - a[1] * a[2];
};

/**
 * Multiplies two mat2d's
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the first operand
 * @param {mat2d} b the second operand
 * @returns {mat2d} out
 */
mat2d.multiply = function (out, a, b) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5],
        b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3], b4 = b[4], b5 = b[5];
    out[0] = a0 * b0 + a2 * b1;
    out[1] = a1 * b0 + a3 * b1;
    out[2] = a0 * b2 + a2 * b3;
    out[3] = a1 * b2 + a3 * b3;
    out[4] = a0 * b4 + a2 * b5 + a4;
    out[5] = a1 * b4 + a3 * b5 + a5;
    return out;
};

/**
 * Alias for {@link mat2d.multiply}
 * @function
 */
mat2d.mul = mat2d.multiply;


/**
 * Rotates a mat2d by the given angle
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat2d} out
 */
mat2d.rotate = function (out, a, rad) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5],
        s = Math.sin(rad),
        c = Math.cos(rad);
    out[0] = a0 *  c + a2 * s;
    out[1] = a1 *  c + a3 * s;
    out[2] = a0 * -s + a2 * c;
    out[3] = a1 * -s + a3 * c;
    out[4] = a4;
    out[5] = a5;
    return out;
};

/**
 * Scales the mat2d by the dimensions in the given vec2
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the matrix to translate
 * @param {vec2} v the vec2 to scale the matrix by
 * @returns {mat2d} out
 **/
mat2d.scale = function(out, a, v) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5],
        v0 = v[0], v1 = v[1];
    out[0] = a0 * v0;
    out[1] = a1 * v0;
    out[2] = a2 * v1;
    out[3] = a3 * v1;
    out[4] = a4;
    out[5] = a5;
    return out;
};

/**
 * Translates the mat2d by the dimensions in the given vec2
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the matrix to translate
 * @param {vec2} v the vec2 to translate the matrix by
 * @returns {mat2d} out
 **/
mat2d.translate = function(out, a, v) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5],
        v0 = v[0], v1 = v[1];
    out[0] = a0;
    out[1] = a1;
    out[2] = a2;
    out[3] = a3;
    out[4] = a0 * v0 + a2 * v1 + a4;
    out[5] = a1 * v0 + a3 * v1 + a5;
    return out;
};

/**
 * Returns a string representation of a mat2d
 *
 * @param {mat2d} a matrix to represent as a string
 * @returns {String} string representation of the matrix
 */
mat2d.str = function (a) {
    return 'mat2d(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + 
                    a[3] + ', ' + a[4] + ', ' + a[5] + ')';
};

/**
 * Returns Frobenius norm of a mat2d
 *
 * @param {mat2d} a the matrix to calculate Frobenius norm of
 * @returns {Number} Frobenius norm
 */
mat2d.frob = function (a) { 
    return(Math.sqrt(Math.pow(a[0], 2) + Math.pow(a[1], 2) + Math.pow(a[2], 2) + Math.pow(a[3], 2) + Math.pow(a[4], 2) + Math.pow(a[5], 2) + 1))
}; 

if(typeof(exports) !== 'undefined') {
    exports.mat2d = mat2d;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class 3x3 Matrix
 * @name mat3
 */

var mat3 = {};

/**
 * Creates a new identity mat3
 *
 * @returns {mat3} a new 3x3 matrix
 */
mat3.create = function() {
    var out = new GLMAT_ARRAY_TYPE(9);
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 1;
    out[5] = 0;
    out[6] = 0;
    out[7] = 0;
    out[8] = 1;
    return out;
};

/**
 * Copies the upper-left 3x3 values into the given mat3.
 *
 * @param {mat3} out the receiving 3x3 matrix
 * @param {mat4} a   the source 4x4 matrix
 * @returns {mat3} out
 */
mat3.fromMat4 = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[4];
    out[4] = a[5];
    out[5] = a[6];
    out[6] = a[8];
    out[7] = a[9];
    out[8] = a[10];
    return out;
};

/**
 * Creates a new mat3 initialized with values from an existing matrix
 *
 * @param {mat3} a matrix to clone
 * @returns {mat3} a new 3x3 matrix
 */
mat3.clone = function(a) {
    var out = new GLMAT_ARRAY_TYPE(9);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    return out;
};

/**
 * Copy the values from one mat3 to another
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the source matrix
 * @returns {mat3} out
 */
mat3.copy = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    return out;
};

/**
 * Set a mat3 to the identity matrix
 *
 * @param {mat3} out the receiving matrix
 * @returns {mat3} out
 */
mat3.identity = function(out) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 1;
    out[5] = 0;
    out[6] = 0;
    out[7] = 0;
    out[8] = 1;
    return out;
};

/**
 * Transpose the values of a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the source matrix
 * @returns {mat3} out
 */
mat3.transpose = function(out, a) {
    // If we are transposing ourselves we can skip a few steps but have to cache some values
    if (out === a) {
        var a01 = a[1], a02 = a[2], a12 = a[5];
        out[1] = a[3];
        out[2] = a[6];
        out[3] = a01;
        out[5] = a[7];
        out[6] = a02;
        out[7] = a12;
    } else {
        out[0] = a[0];
        out[1] = a[3];
        out[2] = a[6];
        out[3] = a[1];
        out[4] = a[4];
        out[5] = a[7];
        out[6] = a[2];
        out[7] = a[5];
        out[8] = a[8];
    }
    
    return out;
};

/**
 * Inverts a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the source matrix
 * @returns {mat3} out
 */
mat3.invert = function(out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8],

        b01 = a22 * a11 - a12 * a21,
        b11 = -a22 * a10 + a12 * a20,
        b21 = a21 * a10 - a11 * a20,

        // Calculate the determinant
        det = a00 * b01 + a01 * b11 + a02 * b21;

    if (!det) { 
        return null; 
    }
    det = 1.0 / det;

    out[0] = b01 * det;
    out[1] = (-a22 * a01 + a02 * a21) * det;
    out[2] = (a12 * a01 - a02 * a11) * det;
    out[3] = b11 * det;
    out[4] = (a22 * a00 - a02 * a20) * det;
    out[5] = (-a12 * a00 + a02 * a10) * det;
    out[6] = b21 * det;
    out[7] = (-a21 * a00 + a01 * a20) * det;
    out[8] = (a11 * a00 - a01 * a10) * det;
    return out;
};

/**
 * Calculates the adjugate of a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the source matrix
 * @returns {mat3} out
 */
mat3.adjoint = function(out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8];

    out[0] = (a11 * a22 - a12 * a21);
    out[1] = (a02 * a21 - a01 * a22);
    out[2] = (a01 * a12 - a02 * a11);
    out[3] = (a12 * a20 - a10 * a22);
    out[4] = (a00 * a22 - a02 * a20);
    out[5] = (a02 * a10 - a00 * a12);
    out[6] = (a10 * a21 - a11 * a20);
    out[7] = (a01 * a20 - a00 * a21);
    out[8] = (a00 * a11 - a01 * a10);
    return out;
};

/**
 * Calculates the determinant of a mat3
 *
 * @param {mat3} a the source matrix
 * @returns {Number} determinant of a
 */
mat3.determinant = function (a) {
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8];

    return a00 * (a22 * a11 - a12 * a21) + a01 * (-a22 * a10 + a12 * a20) + a02 * (a21 * a10 - a11 * a20);
};

/**
 * Multiplies two mat3's
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the first operand
 * @param {mat3} b the second operand
 * @returns {mat3} out
 */
mat3.multiply = function (out, a, b) {
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8],

        b00 = b[0], b01 = b[1], b02 = b[2],
        b10 = b[3], b11 = b[4], b12 = b[5],
        b20 = b[6], b21 = b[7], b22 = b[8];

    out[0] = b00 * a00 + b01 * a10 + b02 * a20;
    out[1] = b00 * a01 + b01 * a11 + b02 * a21;
    out[2] = b00 * a02 + b01 * a12 + b02 * a22;

    out[3] = b10 * a00 + b11 * a10 + b12 * a20;
    out[4] = b10 * a01 + b11 * a11 + b12 * a21;
    out[5] = b10 * a02 + b11 * a12 + b12 * a22;

    out[6] = b20 * a00 + b21 * a10 + b22 * a20;
    out[7] = b20 * a01 + b21 * a11 + b22 * a21;
    out[8] = b20 * a02 + b21 * a12 + b22 * a22;
    return out;
};

/**
 * Alias for {@link mat3.multiply}
 * @function
 */
mat3.mul = mat3.multiply;

/**
 * Translate a mat3 by the given vector
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the matrix to translate
 * @param {vec2} v vector to translate by
 * @returns {mat3} out
 */
mat3.translate = function(out, a, v) {
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8],
        x = v[0], y = v[1];

    out[0] = a00;
    out[1] = a01;
    out[2] = a02;

    out[3] = a10;
    out[4] = a11;
    out[5] = a12;

    out[6] = x * a00 + y * a10 + a20;
    out[7] = x * a01 + y * a11 + a21;
    out[8] = x * a02 + y * a12 + a22;
    return out;
};

/**
 * Rotates a mat3 by the given angle
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat3} out
 */
mat3.rotate = function (out, a, rad) {
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8],

        s = Math.sin(rad),
        c = Math.cos(rad);

    out[0] = c * a00 + s * a10;
    out[1] = c * a01 + s * a11;
    out[2] = c * a02 + s * a12;

    out[3] = c * a10 - s * a00;
    out[4] = c * a11 - s * a01;
    out[5] = c * a12 - s * a02;

    out[6] = a20;
    out[7] = a21;
    out[8] = a22;
    return out;
};

/**
 * Scales the mat3 by the dimensions in the given vec2
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the matrix to rotate
 * @param {vec2} v the vec2 to scale the matrix by
 * @returns {mat3} out
 **/
mat3.scale = function(out, a, v) {
    var x = v[0], y = v[1];

    out[0] = x * a[0];
    out[1] = x * a[1];
    out[2] = x * a[2];

    out[3] = y * a[3];
    out[4] = y * a[4];
    out[5] = y * a[5];

    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    return out;
};

/**
 * Copies the values from a mat2d into a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {mat2d} a the matrix to copy
 * @returns {mat3} out
 **/
mat3.fromMat2d = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = 0;

    out[3] = a[2];
    out[4] = a[3];
    out[5] = 0;

    out[6] = a[4];
    out[7] = a[5];
    out[8] = 1;
    return out;
};

/**
* Calculates a 3x3 matrix from the given quaternion
*
* @param {mat3} out mat3 receiving operation result
* @param {quat} q Quaternion to create matrix from
*
* @returns {mat3} out
*/
mat3.fromQuat = function (out, q) {
    var x = q[0], y = q[1], z = q[2], w = q[3],
        x2 = x + x,
        y2 = y + y,
        z2 = z + z,

        xx = x * x2,
        yx = y * x2,
        yy = y * y2,
        zx = z * x2,
        zy = z * y2,
        zz = z * z2,
        wx = w * x2,
        wy = w * y2,
        wz = w * z2;

    out[0] = 1 - yy - zz;
    out[3] = yx - wz;
    out[6] = zx + wy;

    out[1] = yx + wz;
    out[4] = 1 - xx - zz;
    out[7] = zy - wx;

    out[2] = zx - wy;
    out[5] = zy + wx;
    out[8] = 1 - xx - yy;

    return out;
};

/**
* Calculates a 3x3 normal matrix (transpose inverse) from the 4x4 matrix
*
* @param {mat3} out mat3 receiving operation result
* @param {mat4} a Mat4 to derive the normal matrix from
*
* @returns {mat3} out
*/
mat3.normalFromMat4 = function (out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

        b00 = a00 * a11 - a01 * a10,
        b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10,
        b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11,
        b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30,
        b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30,
        b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31,
        b11 = a22 * a33 - a23 * a32,

        // Calculate the determinant
        det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    if (!det) { 
        return null; 
    }
    det = 1.0 / det;

    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[2] = (a10 * b10 - a11 * b08 + a13 * b06) * det;

    out[3] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[4] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[5] = (a01 * b08 - a00 * b10 - a03 * b06) * det;

    out[6] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[7] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[8] = (a30 * b04 - a31 * b02 + a33 * b00) * det;

    return out;
};

/**
 * Returns a string representation of a mat3
 *
 * @param {mat3} mat matrix to represent as a string
 * @returns {String} string representation of the matrix
 */
mat3.str = function (a) {
    return 'mat3(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + 
                    a[3] + ', ' + a[4] + ', ' + a[5] + ', ' + 
                    a[6] + ', ' + a[7] + ', ' + a[8] + ')';
};

/**
 * Returns Frobenius norm of a mat3
 *
 * @param {mat3} a the matrix to calculate Frobenius norm of
 * @returns {Number} Frobenius norm
 */
mat3.frob = function (a) {
    return(Math.sqrt(Math.pow(a[0], 2) + Math.pow(a[1], 2) + Math.pow(a[2], 2) + Math.pow(a[3], 2) + Math.pow(a[4], 2) + Math.pow(a[5], 2) + Math.pow(a[6], 2) + Math.pow(a[7], 2) + Math.pow(a[8], 2)))
};


if(typeof(exports) !== 'undefined') {
    exports.mat3 = mat3;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class 4x4 Matrix
 * @name mat4
 */

var mat4 = {};

/**
 * Creates a new identity mat4
 *
 * @returns {mat4} a new 4x4 matrix
 */
mat4.create = function() {
    var out = new GLMAT_ARRAY_TYPE(16);
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 1;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
};

/**
 * Creates a new mat4 initialized with values from an existing matrix
 *
 * @param {mat4} a matrix to clone
 * @returns {mat4} a new 4x4 matrix
 */
mat4.clone = function(a) {
    var out = new GLMAT_ARRAY_TYPE(16);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
};

/**
 * Copy the values from one mat4 to another
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */
mat4.copy = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
};

/**
 * Set a mat4 to the identity matrix
 *
 * @param {mat4} out the receiving matrix
 * @returns {mat4} out
 */
mat4.identity = function(out) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 1;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
};

/**
 * Transpose the values of a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */
mat4.transpose = function(out, a) {
    // If we are transposing ourselves we can skip a few steps but have to cache some values
    if (out === a) {
        var a01 = a[1], a02 = a[2], a03 = a[3],
            a12 = a[6], a13 = a[7],
            a23 = a[11];

        out[1] = a[4];
        out[2] = a[8];
        out[3] = a[12];
        out[4] = a01;
        out[6] = a[9];
        out[7] = a[13];
        out[8] = a02;
        out[9] = a12;
        out[11] = a[14];
        out[12] = a03;
        out[13] = a13;
        out[14] = a23;
    } else {
        out[0] = a[0];
        out[1] = a[4];
        out[2] = a[8];
        out[3] = a[12];
        out[4] = a[1];
        out[5] = a[5];
        out[6] = a[9];
        out[7] = a[13];
        out[8] = a[2];
        out[9] = a[6];
        out[10] = a[10];
        out[11] = a[14];
        out[12] = a[3];
        out[13] = a[7];
        out[14] = a[11];
        out[15] = a[15];
    }
    
    return out;
};

/**
 * Inverts a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */
mat4.invert = function(out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

        b00 = a00 * a11 - a01 * a10,
        b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10,
        b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11,
        b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30,
        b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30,
        b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31,
        b11 = a22 * a33 - a23 * a32,

        // Calculate the determinant
        det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    if (!det) { 
        return null; 
    }
    det = 1.0 / det;

    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

    return out;
};

/**
 * Calculates the adjugate of a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */
mat4.adjoint = function(out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    out[0]  =  (a11 * (a22 * a33 - a23 * a32) - a21 * (a12 * a33 - a13 * a32) + a31 * (a12 * a23 - a13 * a22));
    out[1]  = -(a01 * (a22 * a33 - a23 * a32) - a21 * (a02 * a33 - a03 * a32) + a31 * (a02 * a23 - a03 * a22));
    out[2]  =  (a01 * (a12 * a33 - a13 * a32) - a11 * (a02 * a33 - a03 * a32) + a31 * (a02 * a13 - a03 * a12));
    out[3]  = -(a01 * (a12 * a23 - a13 * a22) - a11 * (a02 * a23 - a03 * a22) + a21 * (a02 * a13 - a03 * a12));
    out[4]  = -(a10 * (a22 * a33 - a23 * a32) - a20 * (a12 * a33 - a13 * a32) + a30 * (a12 * a23 - a13 * a22));
    out[5]  =  (a00 * (a22 * a33 - a23 * a32) - a20 * (a02 * a33 - a03 * a32) + a30 * (a02 * a23 - a03 * a22));
    out[6]  = -(a00 * (a12 * a33 - a13 * a32) - a10 * (a02 * a33 - a03 * a32) + a30 * (a02 * a13 - a03 * a12));
    out[7]  =  (a00 * (a12 * a23 - a13 * a22) - a10 * (a02 * a23 - a03 * a22) + a20 * (a02 * a13 - a03 * a12));
    out[8]  =  (a10 * (a21 * a33 - a23 * a31) - a20 * (a11 * a33 - a13 * a31) + a30 * (a11 * a23 - a13 * a21));
    out[9]  = -(a00 * (a21 * a33 - a23 * a31) - a20 * (a01 * a33 - a03 * a31) + a30 * (a01 * a23 - a03 * a21));
    out[10] =  (a00 * (a11 * a33 - a13 * a31) - a10 * (a01 * a33 - a03 * a31) + a30 * (a01 * a13 - a03 * a11));
    out[11] = -(a00 * (a11 * a23 - a13 * a21) - a10 * (a01 * a23 - a03 * a21) + a20 * (a01 * a13 - a03 * a11));
    out[12] = -(a10 * (a21 * a32 - a22 * a31) - a20 * (a11 * a32 - a12 * a31) + a30 * (a11 * a22 - a12 * a21));
    out[13] =  (a00 * (a21 * a32 - a22 * a31) - a20 * (a01 * a32 - a02 * a31) + a30 * (a01 * a22 - a02 * a21));
    out[14] = -(a00 * (a11 * a32 - a12 * a31) - a10 * (a01 * a32 - a02 * a31) + a30 * (a01 * a12 - a02 * a11));
    out[15] =  (a00 * (a11 * a22 - a12 * a21) - a10 * (a01 * a22 - a02 * a21) + a20 * (a01 * a12 - a02 * a11));
    return out;
};

/**
 * Calculates the determinant of a mat4
 *
 * @param {mat4} a the source matrix
 * @returns {Number} determinant of a
 */
mat4.determinant = function (a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

        b00 = a00 * a11 - a01 * a10,
        b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10,
        b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11,
        b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30,
        b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30,
        b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31,
        b11 = a22 * a33 - a23 * a32;

    // Calculate the determinant
    return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
};

/**
 * Multiplies two mat4's
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the first operand
 * @param {mat4} b the second operand
 * @returns {mat4} out
 */
mat4.multiply = function (out, a, b) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    // Cache only the current line of the second matrix
    var b0  = b[0], b1 = b[1], b2 = b[2], b3 = b[3];  
    out[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
    return out;
};

/**
 * Alias for {@link mat4.multiply}
 * @function
 */
mat4.mul = mat4.multiply;

/**
 * Translate a mat4 by the given vector
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to translate
 * @param {vec3} v vector to translate by
 * @returns {mat4} out
 */
mat4.translate = function (out, a, v) {
    var x = v[0], y = v[1], z = v[2],
        a00, a01, a02, a03,
        a10, a11, a12, a13,
        a20, a21, a22, a23;

    if (a === out) {
        out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
        out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
        out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
        out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
    } else {
        a00 = a[0]; a01 = a[1]; a02 = a[2]; a03 = a[3];
        a10 = a[4]; a11 = a[5]; a12 = a[6]; a13 = a[7];
        a20 = a[8]; a21 = a[9]; a22 = a[10]; a23 = a[11];

        out[0] = a00; out[1] = a01; out[2] = a02; out[3] = a03;
        out[4] = a10; out[5] = a11; out[6] = a12; out[7] = a13;
        out[8] = a20; out[9] = a21; out[10] = a22; out[11] = a23;

        out[12] = a00 * x + a10 * y + a20 * z + a[12];
        out[13] = a01 * x + a11 * y + a21 * z + a[13];
        out[14] = a02 * x + a12 * y + a22 * z + a[14];
        out[15] = a03 * x + a13 * y + a23 * z + a[15];
    }

    return out;
};

/**
 * Scales the mat4 by the dimensions in the given vec3
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to scale
 * @param {vec3} v the vec3 to scale the matrix by
 * @returns {mat4} out
 **/
mat4.scale = function(out, a, v) {
    var x = v[0], y = v[1], z = v[2];

    out[0] = a[0] * x;
    out[1] = a[1] * x;
    out[2] = a[2] * x;
    out[3] = a[3] * x;
    out[4] = a[4] * y;
    out[5] = a[5] * y;
    out[6] = a[6] * y;
    out[7] = a[7] * y;
    out[8] = a[8] * z;
    out[9] = a[9] * z;
    out[10] = a[10] * z;
    out[11] = a[11] * z;
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
};

/**
 * Rotates a mat4 by the given angle
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @param {vec3} axis the axis to rotate around
 * @returns {mat4} out
 */
mat4.rotate = function (out, a, rad, axis) {
    var x = axis[0], y = axis[1], z = axis[2],
        len = Math.sqrt(x * x + y * y + z * z),
        s, c, t,
        a00, a01, a02, a03,
        a10, a11, a12, a13,
        a20, a21, a22, a23,
        b00, b01, b02,
        b10, b11, b12,
        b20, b21, b22;

    if (Math.abs(len) < GLMAT_EPSILON) { return null; }
    
    len = 1 / len;
    x *= len;
    y *= len;
    z *= len;

    s = Math.sin(rad);
    c = Math.cos(rad);
    t = 1 - c;

    a00 = a[0]; a01 = a[1]; a02 = a[2]; a03 = a[3];
    a10 = a[4]; a11 = a[5]; a12 = a[6]; a13 = a[7];
    a20 = a[8]; a21 = a[9]; a22 = a[10]; a23 = a[11];

    // Construct the elements of the rotation matrix
    b00 = x * x * t + c; b01 = y * x * t + z * s; b02 = z * x * t - y * s;
    b10 = x * y * t - z * s; b11 = y * y * t + c; b12 = z * y * t + x * s;
    b20 = x * z * t + y * s; b21 = y * z * t - x * s; b22 = z * z * t + c;

    // Perform rotation-specific matrix multiplication
    out[0] = a00 * b00 + a10 * b01 + a20 * b02;
    out[1] = a01 * b00 + a11 * b01 + a21 * b02;
    out[2] = a02 * b00 + a12 * b01 + a22 * b02;
    out[3] = a03 * b00 + a13 * b01 + a23 * b02;
    out[4] = a00 * b10 + a10 * b11 + a20 * b12;
    out[5] = a01 * b10 + a11 * b11 + a21 * b12;
    out[6] = a02 * b10 + a12 * b11 + a22 * b12;
    out[7] = a03 * b10 + a13 * b11 + a23 * b12;
    out[8] = a00 * b20 + a10 * b21 + a20 * b22;
    out[9] = a01 * b20 + a11 * b21 + a21 * b22;
    out[10] = a02 * b20 + a12 * b21 + a22 * b22;
    out[11] = a03 * b20 + a13 * b21 + a23 * b22;

    if (a !== out) { // If the source and destination differ, copy the unchanged last row
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }
    return out;
};

/**
 * Rotates a matrix by the given angle around the X axis
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */
mat4.rotateX = function (out, a, rad) {
    var s = Math.sin(rad),
        c = Math.cos(rad),
        a10 = a[4],
        a11 = a[5],
        a12 = a[6],
        a13 = a[7],
        a20 = a[8],
        a21 = a[9],
        a22 = a[10],
        a23 = a[11];

    if (a !== out) { // If the source and destination differ, copy the unchanged rows
        out[0]  = a[0];
        out[1]  = a[1];
        out[2]  = a[2];
        out[3]  = a[3];
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }

    // Perform axis-specific matrix multiplication
    out[4] = a10 * c + a20 * s;
    out[5] = a11 * c + a21 * s;
    out[6] = a12 * c + a22 * s;
    out[7] = a13 * c + a23 * s;
    out[8] = a20 * c - a10 * s;
    out[9] = a21 * c - a11 * s;
    out[10] = a22 * c - a12 * s;
    out[11] = a23 * c - a13 * s;
    return out;
};

/**
 * Rotates a matrix by the given angle around the Y axis
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */
mat4.rotateY = function (out, a, rad) {
    var s = Math.sin(rad),
        c = Math.cos(rad),
        a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a03 = a[3],
        a20 = a[8],
        a21 = a[9],
        a22 = a[10],
        a23 = a[11];

    if (a !== out) { // If the source and destination differ, copy the unchanged rows
        out[4]  = a[4];
        out[5]  = a[5];
        out[6]  = a[6];
        out[7]  = a[7];
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }

    // Perform axis-specific matrix multiplication
    out[0] = a00 * c - a20 * s;
    out[1] = a01 * c - a21 * s;
    out[2] = a02 * c - a22 * s;
    out[3] = a03 * c - a23 * s;
    out[8] = a00 * s + a20 * c;
    out[9] = a01 * s + a21 * c;
    out[10] = a02 * s + a22 * c;
    out[11] = a03 * s + a23 * c;
    return out;
};

/**
 * Rotates a matrix by the given angle around the Z axis
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */
mat4.rotateZ = function (out, a, rad) {
    var s = Math.sin(rad),
        c = Math.cos(rad),
        a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a03 = a[3],
        a10 = a[4],
        a11 = a[5],
        a12 = a[6],
        a13 = a[7];

    if (a !== out) { // If the source and destination differ, copy the unchanged last row
        out[8]  = a[8];
        out[9]  = a[9];
        out[10] = a[10];
        out[11] = a[11];
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }

    // Perform axis-specific matrix multiplication
    out[0] = a00 * c + a10 * s;
    out[1] = a01 * c + a11 * s;
    out[2] = a02 * c + a12 * s;
    out[3] = a03 * c + a13 * s;
    out[4] = a10 * c - a00 * s;
    out[5] = a11 * c - a01 * s;
    out[6] = a12 * c - a02 * s;
    out[7] = a13 * c - a03 * s;
    return out;
};

/**
 * Creates a matrix from a quaternion rotation and vector translation
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.translate(dest, vec);
 *     var quatMat = mat4.create();
 *     quat4.toMat4(quat, quatMat);
 *     mat4.multiply(dest, quatMat);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {quat4} q Rotation quaternion
 * @param {vec3} v Translation vector
 * @returns {mat4} out
 */
mat4.fromRotationTranslation = function (out, q, v) {
    // Quaternion math
    var x = q[0], y = q[1], z = q[2], w = q[3],
        x2 = x + x,
        y2 = y + y,
        z2 = z + z,

        xx = x * x2,
        xy = x * y2,
        xz = x * z2,
        yy = y * y2,
        yz = y * z2,
        zz = z * z2,
        wx = w * x2,
        wy = w * y2,
        wz = w * z2;

    out[0] = 1 - (yy + zz);
    out[1] = xy + wz;
    out[2] = xz - wy;
    out[3] = 0;
    out[4] = xy - wz;
    out[5] = 1 - (xx + zz);
    out[6] = yz + wx;
    out[7] = 0;
    out[8] = xz + wy;
    out[9] = yz - wx;
    out[10] = 1 - (xx + yy);
    out[11] = 0;
    out[12] = v[0];
    out[13] = v[1];
    out[14] = v[2];
    out[15] = 1;
    
    return out;
};

mat4.fromQuat = function (out, q) {
    var x = q[0], y = q[1], z = q[2], w = q[3],
        x2 = x + x,
        y2 = y + y,
        z2 = z + z,

        xx = x * x2,
        yx = y * x2,
        yy = y * y2,
        zx = z * x2,
        zy = z * y2,
        zz = z * z2,
        wx = w * x2,
        wy = w * y2,
        wz = w * z2;

    out[0] = 1 - yy - zz;
    out[1] = yx + wz;
    out[2] = zx - wy;
    out[3] = 0;

    out[4] = yx - wz;
    out[5] = 1 - xx - zz;
    out[6] = zy + wx;
    out[7] = 0;

    out[8] = zx + wy;
    out[9] = zy - wx;
    out[10] = 1 - xx - yy;
    out[11] = 0;

    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;

    return out;
};

/**
 * Generates a frustum matrix with the given bounds
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {Number} left Left bound of the frustum
 * @param {Number} right Right bound of the frustum
 * @param {Number} bottom Bottom bound of the frustum
 * @param {Number} top Top bound of the frustum
 * @param {Number} near Near bound of the frustum
 * @param {Number} far Far bound of the frustum
 * @returns {mat4} out
 */
mat4.frustum = function (out, left, right, bottom, top, near, far) {
    var rl = 1 / (right - left),
        tb = 1 / (top - bottom),
        nf = 1 / (near - far);
    out[0] = (near * 2) * rl;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = (near * 2) * tb;
    out[6] = 0;
    out[7] = 0;
    out[8] = (right + left) * rl;
    out[9] = (top + bottom) * tb;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = (far * near * 2) * nf;
    out[15] = 0;
    return out;
};

/**
 * Generates a perspective projection matrix with the given bounds
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} fovy Vertical field of view in radians
 * @param {number} aspect Aspect ratio. typically viewport width/height
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum
 * @returns {mat4} out
 */
mat4.perspective = function (out, fovy, aspect, near, far) {
    var f = 1.0 / Math.tan(fovy / 2),
        nf = 1 / (near - far);
    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = (2 * far * near) * nf;
    out[15] = 0;
    return out;
};

/**
 * Generates a orthogonal projection matrix with the given bounds
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} left Left bound of the frustum
 * @param {number} right Right bound of the frustum
 * @param {number} bottom Bottom bound of the frustum
 * @param {number} top Top bound of the frustum
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum
 * @returns {mat4} out
 */
mat4.ortho = function (out, left, right, bottom, top, near, far) {
    var lr = 1 / (left - right),
        bt = 1 / (bottom - top),
        nf = 1 / (near - far);
    out[0] = -2 * lr;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = -2 * bt;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 2 * nf;
    out[11] = 0;
    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = (far + near) * nf;
    out[15] = 1;
    return out;
};

/**
 * Generates a look-at matrix with the given eye position, focal point, and up axis
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {vec3} eye Position of the viewer
 * @param {vec3} center Point the viewer is looking at
 * @param {vec3} up vec3 pointing up
 * @returns {mat4} out
 */
mat4.lookAt = function (out, eye, center, up) {
    var x0, x1, x2, y0, y1, y2, z0, z1, z2, len,
        eyex = eye[0],
        eyey = eye[1],
        eyez = eye[2],
        upx = up[0],
        upy = up[1],
        upz = up[2],
        centerx = center[0],
        centery = center[1],
        centerz = center[2];

    if (Math.abs(eyex - centerx) < GLMAT_EPSILON &&
        Math.abs(eyey - centery) < GLMAT_EPSILON &&
        Math.abs(eyez - centerz) < GLMAT_EPSILON) {
        return mat4.identity(out);
    }

    z0 = eyex - centerx;
    z1 = eyey - centery;
    z2 = eyez - centerz;

    len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
    z0 *= len;
    z1 *= len;
    z2 *= len;

    x0 = upy * z2 - upz * z1;
    x1 = upz * z0 - upx * z2;
    x2 = upx * z1 - upy * z0;
    len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
    if (!len) {
        x0 = 0;
        x1 = 0;
        x2 = 0;
    } else {
        len = 1 / len;
        x0 *= len;
        x1 *= len;
        x2 *= len;
    }

    y0 = z1 * x2 - z2 * x1;
    y1 = z2 * x0 - z0 * x2;
    y2 = z0 * x1 - z1 * x0;

    len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);
    if (!len) {
        y0 = 0;
        y1 = 0;
        y2 = 0;
    } else {
        len = 1 / len;
        y0 *= len;
        y1 *= len;
        y2 *= len;
    }

    out[0] = x0;
    out[1] = y0;
    out[2] = z0;
    out[3] = 0;
    out[4] = x1;
    out[5] = y1;
    out[6] = z1;
    out[7] = 0;
    out[8] = x2;
    out[9] = y2;
    out[10] = z2;
    out[11] = 0;
    out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
    out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
    out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
    out[15] = 1;

    return out;
};

/**
 * Returns a string representation of a mat4
 *
 * @param {mat4} mat matrix to represent as a string
 * @returns {String} string representation of the matrix
 */
mat4.str = function (a) {
    return 'mat4(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ', ' +
                    a[4] + ', ' + a[5] + ', ' + a[6] + ', ' + a[7] + ', ' +
                    a[8] + ', ' + a[9] + ', ' + a[10] + ', ' + a[11] + ', ' + 
                    a[12] + ', ' + a[13] + ', ' + a[14] + ', ' + a[15] + ')';
};

/**
 * Returns Frobenius norm of a mat4
 *
 * @param {mat4} a the matrix to calculate Frobenius norm of
 * @returns {Number} Frobenius norm
 */
mat4.frob = function (a) {
    return(Math.sqrt(Math.pow(a[0], 2) + Math.pow(a[1], 2) + Math.pow(a[2], 2) + Math.pow(a[3], 2) + Math.pow(a[4], 2) + Math.pow(a[5], 2) + Math.pow(a[6], 2) + Math.pow(a[6], 2) + Math.pow(a[7], 2) + Math.pow(a[8], 2) + Math.pow(a[9], 2) + Math.pow(a[10], 2) + Math.pow(a[11], 2) + Math.pow(a[12], 2) + Math.pow(a[13], 2) + Math.pow(a[14], 2) + Math.pow(a[15], 2) ))
};


if(typeof(exports) !== 'undefined') {
    exports.mat4 = mat4;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class Quaternion
 * @name quat
 */

var quat = {};

/**
 * Creates a new identity quat
 *
 * @returns {quat} a new quaternion
 */
quat.create = function() {
    var out = new GLMAT_ARRAY_TYPE(4);
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    return out;
};

/**
 * Sets a quaternion to represent the shortest rotation from one
 * vector to another.
 *
 * Both vectors are assumed to be unit length.
 *
 * @param {quat} out the receiving quaternion.
 * @param {vec3} a the initial vector
 * @param {vec3} b the destination vector
 * @returns {quat} out
 */
quat.rotationTo = (function() {
    var tmpvec3 = vec3.create();
    var xUnitVec3 = vec3.fromValues(1,0,0);
    var yUnitVec3 = vec3.fromValues(0,1,0);

    return function(out, a, b) {
        var dot = vec3.dot(a, b);
        if (dot < -0.999999) {
            vec3.cross(tmpvec3, xUnitVec3, a);
            if (vec3.length(tmpvec3) < 0.000001)
                vec3.cross(tmpvec3, yUnitVec3, a);
            vec3.normalize(tmpvec3, tmpvec3);
            quat.setAxisAngle(out, tmpvec3, Math.PI);
            return out;
        } else if (dot > 0.999999) {
            out[0] = 0;
            out[1] = 0;
            out[2] = 0;
            out[3] = 1;
            return out;
        } else {
            vec3.cross(tmpvec3, a, b);
            out[0] = tmpvec3[0];
            out[1] = tmpvec3[1];
            out[2] = tmpvec3[2];
            out[3] = 1 + dot;
            return quat.normalize(out, out);
        }
    };
})();

/**
 * Sets the specified quaternion with values corresponding to the given
 * axes. Each axis is a vec3 and is expected to be unit length and
 * perpendicular to all other specified axes.
 *
 * @param {vec3} view  the vector representing the viewing direction
 * @param {vec3} right the vector representing the local "right" direction
 * @param {vec3} up    the vector representing the local "up" direction
 * @returns {quat} out
 */
quat.setAxes = (function() {
    var matr = mat3.create();

    return function(out, view, right, up) {
        matr[0] = right[0];
        matr[3] = right[1];
        matr[6] = right[2];

        matr[1] = up[0];
        matr[4] = up[1];
        matr[7] = up[2];

        matr[2] = -view[0];
        matr[5] = -view[1];
        matr[8] = -view[2];

        return quat.normalize(out, quat.fromMat3(out, matr));
    };
})();

/**
 * Creates a new quat initialized with values from an existing quaternion
 *
 * @param {quat} a quaternion to clone
 * @returns {quat} a new quaternion
 * @function
 */
quat.clone = vec4.clone;

/**
 * Creates a new quat initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {quat} a new quaternion
 * @function
 */
quat.fromValues = vec4.fromValues;

/**
 * Copy the values from one quat to another
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the source quaternion
 * @returns {quat} out
 * @function
 */
quat.copy = vec4.copy;

/**
 * Set the components of a quat to the given values
 *
 * @param {quat} out the receiving quaternion
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {quat} out
 * @function
 */
quat.set = vec4.set;

/**
 * Set a quat to the identity quaternion
 *
 * @param {quat} out the receiving quaternion
 * @returns {quat} out
 */
quat.identity = function(out) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    return out;
};

/**
 * Sets a quat from the given angle and rotation axis,
 * then returns it.
 *
 * @param {quat} out the receiving quaternion
 * @param {vec3} axis the axis around which to rotate
 * @param {Number} rad the angle in radians
 * @returns {quat} out
 **/
quat.setAxisAngle = function(out, axis, rad) {
    rad = rad * 0.5;
    var s = Math.sin(rad);
    out[0] = s * axis[0];
    out[1] = s * axis[1];
    out[2] = s * axis[2];
    out[3] = Math.cos(rad);
    return out;
};

/**
 * Adds two quat's
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @returns {quat} out
 * @function
 */
quat.add = vec4.add;

/**
 * Multiplies two quat's
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @returns {quat} out
 */
quat.multiply = function(out, a, b) {
    var ax = a[0], ay = a[1], az = a[2], aw = a[3],
        bx = b[0], by = b[1], bz = b[2], bw = b[3];

    out[0] = ax * bw + aw * bx + ay * bz - az * by;
    out[1] = ay * bw + aw * by + az * bx - ax * bz;
    out[2] = az * bw + aw * bz + ax * by - ay * bx;
    out[3] = aw * bw - ax * bx - ay * by - az * bz;
    return out;
};

/**
 * Alias for {@link quat.multiply}
 * @function
 */
quat.mul = quat.multiply;

/**
 * Scales a quat by a scalar number
 *
 * @param {quat} out the receiving vector
 * @param {quat} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {quat} out
 * @function
 */
quat.scale = vec4.scale;

/**
 * Rotates a quaternion by the given angle about the X axis
 *
 * @param {quat} out quat receiving operation result
 * @param {quat} a quat to rotate
 * @param {number} rad angle (in radians) to rotate
 * @returns {quat} out
 */
quat.rotateX = function (out, a, rad) {
    rad *= 0.5; 

    var ax = a[0], ay = a[1], az = a[2], aw = a[3],
        bx = Math.sin(rad), bw = Math.cos(rad);

    out[0] = ax * bw + aw * bx;
    out[1] = ay * bw + az * bx;
    out[2] = az * bw - ay * bx;
    out[3] = aw * bw - ax * bx;
    return out;
};

/**
 * Rotates a quaternion by the given angle about the Y axis
 *
 * @param {quat} out quat receiving operation result
 * @param {quat} a quat to rotate
 * @param {number} rad angle (in radians) to rotate
 * @returns {quat} out
 */
quat.rotateY = function (out, a, rad) {
    rad *= 0.5; 

    var ax = a[0], ay = a[1], az = a[2], aw = a[3],
        by = Math.sin(rad), bw = Math.cos(rad);

    out[0] = ax * bw - az * by;
    out[1] = ay * bw + aw * by;
    out[2] = az * bw + ax * by;
    out[3] = aw * bw - ay * by;
    return out;
};

/**
 * Rotates a quaternion by the given angle about the Z axis
 *
 * @param {quat} out quat receiving operation result
 * @param {quat} a quat to rotate
 * @param {number} rad angle (in radians) to rotate
 * @returns {quat} out
 */
quat.rotateZ = function (out, a, rad) {
    rad *= 0.5; 

    var ax = a[0], ay = a[1], az = a[2], aw = a[3],
        bz = Math.sin(rad), bw = Math.cos(rad);

    out[0] = ax * bw + ay * bz;
    out[1] = ay * bw - ax * bz;
    out[2] = az * bw + aw * bz;
    out[3] = aw * bw - az * bz;
    return out;
};

/**
 * Calculates the W component of a quat from the X, Y, and Z components.
 * Assumes that quaternion is 1 unit in length.
 * Any existing W component will be ignored.
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a quat to calculate W component of
 * @returns {quat} out
 */
quat.calculateW = function (out, a) {
    var x = a[0], y = a[1], z = a[2];

    out[0] = x;
    out[1] = y;
    out[2] = z;
    out[3] = -Math.sqrt(Math.abs(1.0 - x * x - y * y - z * z));
    return out;
};

/**
 * Calculates the dot product of two quat's
 *
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @returns {Number} dot product of a and b
 * @function
 */
quat.dot = vec4.dot;

/**
 * Performs a linear interpolation between two quat's
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {quat} out
 * @function
 */
quat.lerp = vec4.lerp;

/**
 * Performs a spherical linear interpolation between two quat
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {quat} out
 */
quat.slerp = function (out, a, b, t) {
    // benchmarks:
    //    http://jsperf.com/quaternion-slerp-implementations

    var ax = a[0], ay = a[1], az = a[2], aw = a[3],
        bx = b[0], by = b[1], bz = b[2], bw = b[3];

    var        omega, cosom, sinom, scale0, scale1;

    // calc cosine
    cosom = ax * bx + ay * by + az * bz + aw * bw;
    // adjust signs (if necessary)
    if ( cosom < 0.0 ) {
        cosom = -cosom;
        bx = - bx;
        by = - by;
        bz = - bz;
        bw = - bw;
    }
    // calculate coefficients
    if ( (1.0 - cosom) > 0.000001 ) {
        // standard case (slerp)
        omega  = Math.acos(cosom);
        sinom  = Math.sin(omega);
        scale0 = Math.sin((1.0 - t) * omega) / sinom;
        scale1 = Math.sin(t * omega) / sinom;
    } else {        
        // "from" and "to" quaternions are very close 
        //  ... so we can do a linear interpolation
        scale0 = 1.0 - t;
        scale1 = t;
    }
    // calculate final values
    out[0] = scale0 * ax + scale1 * bx;
    out[1] = scale0 * ay + scale1 * by;
    out[2] = scale0 * az + scale1 * bz;
    out[3] = scale0 * aw + scale1 * bw;
    
    return out;
};

/**
 * Calculates the inverse of a quat
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a quat to calculate inverse of
 * @returns {quat} out
 */
quat.invert = function(out, a) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3],
        dot = a0*a0 + a1*a1 + a2*a2 + a3*a3,
        invDot = dot ? 1.0/dot : 0;
    
    // TODO: Would be faster to return [0,0,0,0] immediately if dot == 0

    out[0] = -a0*invDot;
    out[1] = -a1*invDot;
    out[2] = -a2*invDot;
    out[3] = a3*invDot;
    return out;
};

/**
 * Calculates the conjugate of a quat
 * If the quaternion is normalized, this function is faster than quat.inverse and produces the same result.
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a quat to calculate conjugate of
 * @returns {quat} out
 */
quat.conjugate = function (out, a) {
    out[0] = -a[0];
    out[1] = -a[1];
    out[2] = -a[2];
    out[3] = a[3];
    return out;
};

/**
 * Calculates the length of a quat
 *
 * @param {quat} a vector to calculate length of
 * @returns {Number} length of a
 * @function
 */
quat.length = vec4.length;

/**
 * Alias for {@link quat.length}
 * @function
 */
quat.len = quat.length;

/**
 * Calculates the squared length of a quat
 *
 * @param {quat} a vector to calculate squared length of
 * @returns {Number} squared length of a
 * @function
 */
quat.squaredLength = vec4.squaredLength;

/**
 * Alias for {@link quat.squaredLength}
 * @function
 */
quat.sqrLen = quat.squaredLength;

/**
 * Normalize a quat
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a quaternion to normalize
 * @returns {quat} out
 * @function
 */
quat.normalize = vec4.normalize;

/**
 * Creates a quaternion from the given 3x3 rotation matrix.
 *
 * NOTE: The resultant quaternion is not normalized, so you should be sure
 * to renormalize the quaternion yourself where necessary.
 *
 * @param {quat} out the receiving quaternion
 * @param {mat3} m rotation matrix
 * @returns {quat} out
 * @function
 */
quat.fromMat3 = function(out, m) {
    // Algorithm in Ken Shoemake's article in 1987 SIGGRAPH course notes
    // article "Quaternion Calculus and Fast Animation".
    var fTrace = m[0] + m[4] + m[8];
    var fRoot;

    if ( fTrace > 0.0 ) {
        // |w| > 1/2, may as well choose w > 1/2
        fRoot = Math.sqrt(fTrace + 1.0);  // 2w
        out[3] = 0.5 * fRoot;
        fRoot = 0.5/fRoot;  // 1/(4w)
        out[0] = (m[7]-m[5])*fRoot;
        out[1] = (m[2]-m[6])*fRoot;
        out[2] = (m[3]-m[1])*fRoot;
    } else {
        // |w| <= 1/2
        var i = 0;
        if ( m[4] > m[0] )
          i = 1;
        if ( m[8] > m[i*3+i] )
          i = 2;
        var j = (i+1)%3;
        var k = (i+2)%3;
        
        fRoot = Math.sqrt(m[i*3+i]-m[j*3+j]-m[k*3+k] + 1.0);
        out[i] = 0.5 * fRoot;
        fRoot = 0.5 / fRoot;
        out[3] = (m[k*3+j] - m[j*3+k]) * fRoot;
        out[j] = (m[j*3+i] + m[i*3+j]) * fRoot;
        out[k] = (m[k*3+i] + m[i*3+k]) * fRoot;
    }
    
    return out;
};

/**
 * Returns a string representation of a quatenion
 *
 * @param {quat} vec vector to represent as a string
 * @returns {String} string representation of the vector
 */
quat.str = function (a) {
    return 'quat(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ')';
};

if(typeof(exports) !== 'undefined') {
    exports.quat = quat;
}
;













  })(shim.exports);
})(this);

},{}],12:[function(require,module,exports){
var Pointable = require('./pointable'),
  glMatrix = require("gl-matrix")
  , vec3 = glMatrix.vec3
  , mat3 = glMatrix.mat3
  , mat4 = glMatrix.mat4
  , _ = require('underscore');


var Bone = module.exports = function(finger, data) {
  this.finger = finger;

  this._center = null, this._matrix = null;

  /**
  * An integer code for the name of this bone.
  *
  * * 0 -- metacarpal
  * * 1 -- proximal
  * * 2 -- medial
  * * 3 -- distal
  * * 4 -- arm
  *
  * @member type
  * @type {number}
  * @memberof Leap.Bone.prototype
  */
  this.type = data.type;

  /**
   * The position of the previous, or base joint of the bone closer to the wrist.
   * @type {vector3}
   */
  this.prevJoint = data.prevJoint;

  /**
   * The position of the next joint, or the end of the bone closer to the finger tip.
   * @type {vector3}
   */
  this.nextJoint = data.nextJoint;

  /**
   * The estimated width of the tool in millimeters.
   *
   * The reported width is the average width of the visible portion of the
   * tool from the hand to the tip. If the width isn't known,
   * then a value of 0 is returned.
   *
   * Pointable objects representing fingers do not have a width property.
   *
   * @member width
   * @type {number}
   * @memberof Leap.Pointable.prototype
   */
  this.width = data.width;

  var displacement = new Array(3);
  vec3.sub(displacement, data.nextJoint, data.prevJoint);

  this.length = vec3.length(displacement);


  /**
   *
   * These fully-specify the orientation of the bone.
   * See examples/threejs-bones.html for more info
   * Three vec3s:
   *  x (red): The rotation axis of the finger, pointing outwards.  (In general, away from the thumb )
   *  y (green): The "up" vector, orienting the top of the finger
   *  z (blue): The roll axis of the bone.
   *
   *  Most up vectors will be pointing the same direction, except for the thumb, which is more rightwards.
   *
   *  The thumb has one fewer bones than the fingers, but there are the same number of joints & joint-bases provided
   *  the first two appear in the same position, but only the second (proximal) rotates.
   *
   *  Normalized.
   */
  this.basis = data.basis;
};

Bone.prototype.left = function(){

  if (this._left) return this._left;

  this._left =  mat3.determinant(this.basis[0].concat(this.basis[1]).concat(this.basis[2])) < 0;

  return this._left;

};


/**
 * The Affine transformation matrix describing the orientation of the bone, in global Leap-space.
 * It contains a 3x3 rotation matrix (in the "top left"), and center coordinates in the fourth column.
 *
 * Unlike the basis, the right and left hands have the same coordinate system.
 *
 */
Bone.prototype.matrix = function(){

  if (this._matrix) return this._matrix;

  var b = this.basis,
      t = this._matrix = mat4.create();

  // open transform mat4 from rotation mat3
  t[0] = b[0][0], t[1] = b[0][1], t[2]  = b[0][2];
  t[4] = b[1][0], t[5] = b[1][1], t[6]  = b[1][2];
  t[8] = b[2][0], t[9] = b[2][1], t[10] = b[2][2];

  t[3] = this.center()[0];
  t[7] = this.center()[1];
  t[11] = this.center()[2];

  if ( this.left() ) {
    // flip the basis to be right-handed
    t[0] *= -1;
    t[1] *= -1;
    t[2] *= -1;
  }

  return this._matrix;
};

/**
 * Helper method to linearly interpolate between the two ends of the bone.
 *
 * when t = 0, the position of prevJoint will be returned
 * when t = 1, the position of nextJoint will be returned
 */
Bone.prototype.lerp = function(out, t){

  vec3.lerp(out, this.prevJoint, this.nextJoint, t);

};

/**
 *
 * The center position of the bone
 * Returns a vec3 array.
 *
 */
Bone.prototype.center = function(){

  if (this._center) return this._center;

  var center = vec3.create();
  this.lerp(center, 0.5);
  this._center = center;
  return center;

};

// The negative of the z-basis
Bone.prototype.direction = function(){

 return [
   this.basis[2][0] * -1,
   this.basis[2][1] * -1,
   this.basis[2][2] * -1
 ];

};

},{"./pointable":26,"gl-matrix":11,"underscore":34}],13:[function(require,module,exports){
var CircularBuffer = module.exports = function(size) {
  this.pos = 0;
  this._buf = [];
  this.size = size;
}

CircularBuffer.prototype.get = function(i) {
  if (i == undefined) i = 0;
  if (i >= this.size) return undefined;
  if (i >= this._buf.length) return undefined;
  return this._buf[(this.pos - i - 1) % this.size];
}

CircularBuffer.prototype.push = function(o) {
  this._buf[this.pos % this.size] = o;
  return this.pos++;
}

},{}],14:[function(require,module,exports){
var chooseProtocol = require('../protocol').chooseProtocol
  , EventEmitter = require('events').EventEmitter
  , _ = require('underscore');

var BaseConnection = module.exports = function(opts) {
  this.opts = _.defaults(opts || {}, {
    host : '127.0.0.1',
    enableGestures: false,
    scheme: this.getScheme(),
    port: this.getPort(),
    background: false,
    optimizeHMD: false,
    requestProtocolVersion: BaseConnection.defaultProtocolVersion
  });
  this.host = this.opts.host;
  this.port = this.opts.port;
  this.scheme = this.opts.scheme;
  this.protocolVersionVerified = false;
  this.background = null;
  this.optimizeHMD = null;
  this.on('ready', function() {
    this.enableGestures(this.opts.enableGestures);
    this.setBackground(this.opts.background);
    this.setOptimizeHMD(this.opts.optimizeHMD);

    if (this.opts.optimizeHMD){
      console.log("Optimized for head mounted display usage.");
    }else {
      console.log("Optimized for desktop usage.");
    }

  });
};

// The latest available:
BaseConnection.defaultProtocolVersion = 6;

BaseConnection.prototype.getUrl = function() {
  return this.scheme + "//" + this.host + ":" + this.port + "/v" + this.opts.requestProtocolVersion + ".json";
}


BaseConnection.prototype.getScheme = function(){
  return 'ws:'
}

BaseConnection.prototype.getPort = function(){
  return 6437
}


BaseConnection.prototype.setBackground = function(state) {
  this.opts.background = state;
  if (this.protocol && this.protocol.sendBackground && this.background !== this.opts.background) {
    this.background = this.opts.background;
    this.protocol.sendBackground(this, this.opts.background);
  }
}

BaseConnection.prototype.setOptimizeHMD = function(state) {
  this.opts.optimizeHMD = state;
  if (this.protocol && this.protocol.sendOptimizeHMD && this.optimizeHMD !== this.opts.optimizeHMD) {
    this.optimizeHMD = this.opts.optimizeHMD;
    this.protocol.sendOptimizeHMD(this, this.opts.optimizeHMD);
  }
}

BaseConnection.prototype.handleOpen = function() {
  if (!this.connected) {
    this.connected = true;
    this.emit('connect');
  }
}

BaseConnection.prototype.enableGestures = function(enabled) {
  this.gesturesEnabled = enabled ? true : false;
  this.send(this.protocol.encode({"enableGestures": this.gesturesEnabled}));
}

BaseConnection.prototype.handleClose = function(code, reason) {
  if (!this.connected) return;
  this.disconnect();

  // 1001 - an active connection is closed
  // 1006 - cannot connect
  if (code === 1001 && this.opts.requestProtocolVersion > 1) {
    if (this.protocolVersionVerified) {
      this.protocolVersionVerified = false;
    }else{
      this.opts.requestProtocolVersion--;
    }
  }
  this.startReconnection();
}

BaseConnection.prototype.startReconnection = function() {
  var connection = this;
  if(!this.reconnectionTimer){
    (this.reconnectionTimer = setInterval(function() { connection.reconnect() }, 500));
  }
}

BaseConnection.prototype.stopReconnection = function() {
  this.reconnectionTimer = clearInterval(this.reconnectionTimer);
}

// By default, disconnect will prevent auto-reconnection.
// Pass in true to allow the reconnection loop not be interrupted continue
BaseConnection.prototype.disconnect = function(allowReconnect) {
  if (!allowReconnect) this.stopReconnection();
  if (!this.socket) return;
  this.socket.close();
  delete this.socket;
  delete this.protocol;
  delete this.background; // This is not persisted when reconnecting to the web socket server
  delete this.optimizeHMD;
  delete this.focusedState;
  if (this.connected) {
    this.connected = false;
    this.emit('disconnect');
  }
  return true;
}

BaseConnection.prototype.reconnect = function() {
  if (this.connected) {
    this.stopReconnection();
  } else {
    this.disconnect(true);
    this.connect();
  }
}

BaseConnection.prototype.handleData = function(data) {
  var message = JSON.parse(data);

  var messageEvent;
  if (this.protocol === undefined) {
    messageEvent = this.protocol = chooseProtocol(message);
    this.protocolVersionVerified = true;
    this.emit('ready');
  } else {
    messageEvent = this.protocol(message);
  }
  this.emit(messageEvent.type, messageEvent);
}

BaseConnection.prototype.connect = function() {
  if (this.socket) return;
  this.socket = this.setupSocket();
  return true;
}

BaseConnection.prototype.send = function(data) {
  this.socket.send(data);
}

BaseConnection.prototype.reportFocus = function(state) {
  if (!this.connected || this.focusedState === state) return;
  this.focusedState = state;
  this.emit(this.focusedState ? 'focus' : 'blur');
  if (this.protocol && this.protocol.sendFocused) {
    this.protocol.sendFocused(this, this.focusedState);
  }
}

_.extend(BaseConnection.prototype, EventEmitter.prototype);
},{"../protocol":27,"events":1,"underscore":34}],15:[function(require,module,exports){
var BaseConnection = module.exports = require('./base')
  , _ = require('underscore');


var BrowserConnection = module.exports = function(opts) {
  BaseConnection.call(this, opts);
  var connection = this;
  this.on('ready', function() { connection.startFocusLoop(); })
  this.on('disconnect', function() { connection.stopFocusLoop(); })
}

_.extend(BrowserConnection.prototype, BaseConnection.prototype);

BrowserConnection.__proto__ = BaseConnection;

BrowserConnection.prototype.useSecure = function(){
  return location.protocol === 'https:'
}

BrowserConnection.prototype.getScheme = function(){
  return this.useSecure() ? 'wss:' : 'ws:'
}

BrowserConnection.prototype.getPort = function(){
  return this.useSecure() ? 6436 : 6437
}

BrowserConnection.prototype.setupSocket = function() {
  var connection = this;
  var socket = new WebSocket(this.getUrl());
  socket.onopen = function() { connection.handleOpen(); };
  socket.onclose = function(data) { connection.handleClose(data['code'], data['reason']); };
  socket.onmessage = function(message) { connection.handleData(message.data) };
  socket.onerror = function(error) {

    // attempt to degrade to ws: after one failed attempt for older Leap Service installations.
    if (connection.useSecure() && connection.scheme === 'wss:'){
      connection.scheme = 'ws:';
      connection.port = 6437;
      connection.disconnect();
      connection.connect();
    }

  };
  return socket;
}

BrowserConnection.prototype.startFocusLoop = function() {
  if (this.focusDetectorTimer) return;
  var connection = this;
  var propertyName = null;
  if (typeof document.hidden !== "undefined") {
    propertyName = "hidden";
  } else if (typeof document.mozHidden !== "undefined") {
    propertyName = "mozHidden";
  } else if (typeof document.msHidden !== "undefined") {
    propertyName = "msHidden";
  } else if (typeof document.webkitHidden !== "undefined") {
    propertyName = "webkitHidden";
  } else {
    propertyName = undefined;
  }

  if (connection.windowVisible === undefined) {
    connection.windowVisible = propertyName === undefined ? true : document[propertyName] === false;
  }

  var focusListener = window.addEventListener('focus', function(e) {
    connection.windowVisible = true;
    updateFocusState();
  });

  var blurListener = window.addEventListener('blur', function(e) {
    connection.windowVisible = false;
    updateFocusState();
  });

  this.on('disconnect', function() {
    window.removeEventListener('focus', focusListener);
    window.removeEventListener('blur', blurListener);
  });

  var updateFocusState = function() {
    var isVisible = propertyName === undefined ? true : document[propertyName] === false;
    connection.reportFocus(isVisible && connection.windowVisible);
  }

  // save 100ms when resuming focus
  updateFocusState();

  this.focusDetectorTimer = setInterval(updateFocusState, 100);
}

BrowserConnection.prototype.stopFocusLoop = function() {
  if (!this.focusDetectorTimer) return;
  clearTimeout(this.focusDetectorTimer);
  delete this.focusDetectorTimer;
}

},{"./base":14,"underscore":34}],16:[function(require,module,exports){
var WebSocket = require('ws')
  , BaseConnection = require('./base')
  , _ = require('underscore');

var NodeConnection = module.exports = function(opts) {
  BaseConnection.call(this, opts);
  var connection = this;
  this.on('ready', function() { connection.reportFocus(true); });
}

_.extend(NodeConnection.prototype, BaseConnection.prototype);

NodeConnection.__proto__ = BaseConnection;

NodeConnection.prototype.setupSocket = function() {
  var connection = this;
  var socket = new WebSocket(this.getUrl());
  socket.on('open', function() { connection.handleOpen(); });
  socket.on('message', function(m) { connection.handleData(m); });
  socket.on('close', function(code, reason) { connection.handleClose(code, reason); });
  socket.on('error', function() { connection.startReconnection(); });
  return socket;
}

},{"./base":14,"underscore":34,"ws":35}],17:[function(require,module,exports){
(function (process){
var Frame = require('./frame')
  , Hand = require('./hand')
  , Pointable = require('./pointable')
  , Finger = require('./finger')
  , CircularBuffer = require("./circular_buffer")
  , Pipeline = require("./pipeline")
  , EventEmitter = require('events').EventEmitter
  , gestureListener = require('./gesture').gestureListener
  , Dialog = require('./dialog')
  , _ = require('underscore');

/**
 * Constructs a Controller object.
 *
 * When creating a Controller object, you may optionally pass in options
 * to set the host , set the port, enable gestures, or select the frame event type.
 *
 * ```javascript
 * var controller = new Leap.Controller({
 *   host: '127.0.0.1',
 *   port: 6437,
 *   enableGestures: true,
 *   frameEventName: 'animationFrame'
 * });
 * ```
 *
 * @class Controller
 * @memberof Leap
 * @classdesc
 * The Controller class is your main interface to the Leap Motion Controller.
 *
 * Create an instance of this Controller class to access frames of tracking data
 * and configuration information. Frame data can be polled at any time using the
 * [Controller.frame]{@link Leap.Controller#frame}() function. Call frame() or frame(0) to get the most recent
 * frame. Set the history parameter to a positive integer to access previous frames.
 * A controller stores up to 60 frames in its frame history.
 *
 * Polling is an appropriate strategy for applications which already have an
 * intrinsic update loop, such as a game.
 *
 * loopWhileDisconnected defaults to true, and maintains a 60FPS frame rate even when Leap Motion is not streaming
 * data at that rate (such as no hands in frame).  This is important for VR/WebGL apps which rely on rendering for
 * regular visual updates, including from other input devices.  Flipping this to false should be considered an
 * optimization for very specific use-cases.
 *
 *
 */


var Controller = module.exports = function(opts) {
  var inNode = (typeof(process) !== 'undefined' && process.versions && process.versions.node),
    controller = this;

  opts = _.defaults(opts || {}, {
    inNode: inNode
  });

  this.inNode = opts.inNode;

  opts = _.defaults(opts || {}, {
    frameEventName: this.useAnimationLoop() ? 'animationFrame' : 'deviceFrame',
    suppressAnimationLoop: !this.useAnimationLoop(),
    loopWhileDisconnected: true,
    useAllPlugins: false,
    checkVersion: true
  });

  this.animationFrameRequested = false;
  this.onAnimationFrame = function(timestamp) {
    if (controller.lastConnectionFrame.valid){
      controller.emit('animationFrame', controller.lastConnectionFrame);
    }
    controller.emit('frameEnd', timestamp);
    if (
      controller.loopWhileDisconnected &&
      ( ( controller.connection.focusedState !== false )  // loop while undefined, pre-ready.
        || controller.connection.opts.background) ){
      window.requestAnimationFrame(controller.onAnimationFrame);
    }else{
      controller.animationFrameRequested = false;
    }
  };
  this.suppressAnimationLoop = opts.suppressAnimationLoop;
  this.loopWhileDisconnected = opts.loopWhileDisconnected;
  this.frameEventName = opts.frameEventName;
  this.useAllPlugins = opts.useAllPlugins;
  this.history = new CircularBuffer(200);
  this.lastFrame = Frame.Invalid;
  this.lastValidFrame = Frame.Invalid;
  this.lastConnectionFrame = Frame.Invalid;
  this.accumulatedGestures = [];
  this.checkVersion = opts.checkVersion;
  if (opts.connectionType === undefined) {
    this.connectionType = (this.inBrowser() ? require('./connection/browser') : require('./connection/node'));
  } else {
    this.connectionType = opts.connectionType;
  }
  this.connection = new this.connectionType(opts);
  this.streamingCount = 0;
  this.devices = {};
  this.plugins = {};
  this._pluginPipelineSteps = {};
  this._pluginExtendedMethods = {};
  if (opts.useAllPlugins) this.useRegisteredPlugins();
  this.setupFrameEvents(opts);
  this.setupConnectionEvents();
  
  this.startAnimationLoop(); // immediately when started
}

Controller.prototype.gesture = function(type, cb) {
  var creator = gestureListener(this, type);
  if (cb !== undefined) {
    creator.stop(cb);
  }
  return creator;
}

/*
 * @returns the controller
 */
Controller.prototype.setBackground = function(state) {
  this.connection.setBackground(state);
  return this;
}

Controller.prototype.setOptimizeHMD = function(state) {
  this.connection.setOptimizeHMD(state);
  return this;
}

Controller.prototype.inBrowser = function() {
  return !this.inNode;
}

Controller.prototype.useAnimationLoop = function() {
  return this.inBrowser() && !this.inBackgroundPage();
}

Controller.prototype.inBackgroundPage = function(){
  // http://developer.chrome.com/extensions/extension#method-getBackgroundPage
  return (typeof(chrome) !== "undefined") &&
    chrome.extension &&
    chrome.extension.getBackgroundPage &&
    (chrome.extension.getBackgroundPage() === window)
}

/*
 * @returns the controller
 */
Controller.prototype.connect = function() {
  this.connection.connect();
  return this;
}

Controller.prototype.streaming = function() {
  return this.streamingCount > 0;
}

Controller.prototype.connected = function() {
  return !!this.connection.connected;
}

Controller.prototype.startAnimationLoop = function(){
  if (!this.suppressAnimationLoop && !this.animationFrameRequested) {
    this.animationFrameRequested = true;
    window.requestAnimationFrame(this.onAnimationFrame);
  }
}

/*
 * @returns the controller
 */
Controller.prototype.disconnect = function() {
  this.connection.disconnect();
  return this;
}

/**
 * Returns a frame of tracking data from the Leap.
 *
 * Use the optional history parameter to specify which frame to retrieve.
 * Call frame() or frame(0) to access the most recent frame; call frame(1) to
 * access the previous frame, and so on. If you use a history value greater
 * than the number of stored frames, then the controller returns an invalid frame.
 *
 * @method frame
 * @memberof Leap.Controller.prototype
 * @param {number} history The age of the frame to return, counting backwards from
 * the most recent frame (0) into the past and up to the maximum age (59).
 * @returns {Leap.Frame} The specified frame; or, if no history
 * parameter is specified, the newest frame. If a frame is not available at
 * the specified history position, an invalid Frame is returned.
 **/
Controller.prototype.frame = function(num) {
  return this.history.get(num) || Frame.Invalid;
}

Controller.prototype.loop = function(callback) {
  if (callback) {
    if (typeof callback === 'function'){
      this.on(this.frameEventName, callback);
    }else{
      // callback is actually of the form: {eventName: callback}
      this.setupFrameEvents(callback);
    }
  }

  return this.connect();
}

Controller.prototype.addStep = function(step) {
  if (!this.pipeline) this.pipeline = new Pipeline(this);
  this.pipeline.addStep(step);
}

// this is run on every deviceFrame
Controller.prototype.processFrame = function(frame) {
  if (frame.gestures) {
    this.accumulatedGestures = this.accumulatedGestures.concat(frame.gestures);
  }
  // lastConnectionFrame is used by the animation loop
  this.lastConnectionFrame = frame;
  this.startAnimationLoop(); // Only has effect if loopWhileDisconnected: false
  this.emit('deviceFrame', frame);
}

// on a this.deviceEventName (usually 'animationFrame' in browsers), this emits a 'frame'
Controller.prototype.processFinishedFrame = function(frame) {
  this.lastFrame = frame;
  if (frame.valid) {
    this.lastValidFrame = frame;
  }
  frame.controller = this;
  frame.historyIdx = this.history.push(frame);
  if (frame.gestures) {
    frame.gestures = this.accumulatedGestures;
    this.accumulatedGestures = [];
    for (var gestureIdx = 0; gestureIdx != frame.gestures.length; gestureIdx++) {
      this.emit("gesture", frame.gestures[gestureIdx], frame);
    }
  }
  if (this.pipeline) {
    frame = this.pipeline.run(frame);
    if (!frame) frame = Frame.Invalid;
  }
  this.emit('frame', frame);
  this.emitHandEvents(frame);
}

/**
 * The controller will emit 'hand' events for every hand on each frame.  The hand in question will be passed
 * to the event callback.
 *
 * @param frame
 */
Controller.prototype.emitHandEvents = function(frame){
  for (var i = 0; i < frame.hands.length; i++){
    this.emit('hand', frame.hands[i]);
  }
}

Controller.prototype.setupFrameEvents = function(opts){
  if (opts.frame){
    this.on('frame', opts.frame);
  }
  if (opts.hand){
    this.on('hand', opts.hand);
  }
}

/**
  Controller events.  The old 'deviceConnected' and 'deviceDisconnected' have been depricated -
  use 'deviceStreaming' and 'deviceStopped' instead, except in the case of an unexpected disconnect.

  There are 4 pairs of device events recently added/changed:
  -deviceAttached/deviceRemoved - called when a device's physical connection to the computer changes
  -deviceStreaming/deviceStopped - called when a device is paused or resumed.
  -streamingStarted/streamingStopped - called when there is/is no longer at least 1 streaming device.
									  Always comes after deviceStreaming.
  
  The first of all of the above event pairs is triggered as appropriate upon connection.  All of
  these events receives an argument with the most recent info about the device that triggered it.
  These events will always be fired in the order they are listed here, with reverse ordering for the
  matching shutdown call. (ie, deviceStreaming always comes after deviceAttached, and deviceStopped 
  will come before deviceRemoved).
  
  -deviceConnected/deviceDisconnected - These are considered deprecated and will be removed in
  the next revision.  In contrast to the other events and in keeping with it's original behavior,
  it will only be fired when a device begins streaming AFTER a connection has been established.
  It is not paired, and receives no device info.  Nearly identical functionality to
  streamingStarted/Stopped if you need to port.
*/
Controller.prototype.setupConnectionEvents = function() {
  var controller = this;
  this.connection.on('frame', function(frame) {
    controller.processFrame(frame);
  });
  // either deviceFrame or animationFrame:
  this.on(this.frameEventName, function(frame) {
    controller.processFinishedFrame(frame);
  });


  // here we backfill the 0.5.0 deviceEvents as best possible
  // backfill begin streaming events
  var backfillStreamingStartedEventsHandler = function(){
    if (controller.connection.opts.requestProtocolVersion < 5 && controller.streamingCount == 0){
      controller.streamingCount = 1;
      var info = {
        attached: true,
        streaming: true,
        type: 'unknown',
        id: "Lx00000000000"
      };
      controller.devices[info.id] = info;

      controller.emit('deviceAttached', info);
      controller.emit('deviceStreaming', info);
      controller.emit('streamingStarted', info);
      controller.connection.removeListener('frame', backfillStreamingStartedEventsHandler)
    }
  }

  var backfillStreamingStoppedEvents = function(){
    if (controller.streamingCount > 0) {
      for (var deviceId in controller.devices){
        controller.emit('deviceStopped', controller.devices[deviceId]);
        controller.emit('deviceRemoved', controller.devices[deviceId]);
      }
      // only emit streamingStopped once, with the last device
      controller.emit('streamingStopped', controller.devices[deviceId]);

      controller.streamingCount = 0;

      for (var deviceId in controller.devices){
        delete controller.devices[deviceId];
      }
    }
  }
  // Delegate connection events
  this.connection.on('focus', function() {

    if ( controller.loopWhileDisconnected ){

      controller.startAnimationLoop();

    }

    controller.emit('focus');

  });
  this.connection.on('blur', function() { controller.emit('blur') });
  this.connection.on('protocol', function(protocol) {

    protocol.on('beforeFrameCreated', function(frameData){
      controller.emit('beforeFrameCreated', frameData)
    });

    protocol.on('afterFrameCreated', function(frame, frameData){
      controller.emit('afterFrameCreated', frame, frameData)
    });

    controller.emit('protocol', protocol); 
  });

  this.connection.on('ready', function() {

    if (controller.checkVersion && !controller.inNode){
      // show dialog only to web users
      controller.checkOutOfDate();
    }

    controller.emit('ready');
  });

  this.connection.on('connect', function() {
    controller.emit('connect');
    controller.connection.removeListener('frame', backfillStreamingStartedEventsHandler)
    controller.connection.on('frame', backfillStreamingStartedEventsHandler);
  });

  this.connection.on('disconnect', function() {
    controller.emit('disconnect');
    backfillStreamingStoppedEvents();
  });

  // this does not fire when the controller is manually disconnected
  // or for Leap Service v1.2.0+
  this.connection.on('deviceConnect', function(evt) {
    if (evt.state){
      controller.emit('deviceConnected');
      controller.connection.removeListener('frame', backfillStreamingStartedEventsHandler)
      controller.connection.on('frame', backfillStreamingStartedEventsHandler);
    }else{
      controller.emit('deviceDisconnected');
      backfillStreamingStoppedEvents();
    }
  });

  // Does not fire for Leap Service pre v1.2.0
  this.connection.on('deviceEvent', function(evt) {
    var info = evt.state,
        oldInfo = controller.devices[info.id];

    //Grab a list of changed properties in the device info
    var changed = {};
    for(var property in info) {
      //If a property i doesn't exist the cache, or has changed...
      if( !oldInfo || !oldInfo.hasOwnProperty(property) || oldInfo[property] != info[property] ) {
        changed[property] = true;
      }
    }

    //Update the device list
    controller.devices[info.id] = info;

    //Fire events based on change list
    if(changed.attached) {
      controller.emit(info.attached ? 'deviceAttached' : 'deviceRemoved', info);
    }

    if(!changed.streaming) return;

    if(info.streaming) {
      controller.streamingCount++;
      controller.emit('deviceStreaming', info);
      if( controller.streamingCount == 1 ) {
        controller.emit('streamingStarted', info);
      }
      //if attached & streaming both change to true at the same time, that device was streaming
      //already when we connected.
      if(!changed.attached) {
        controller.emit('deviceConnected');
      }
    }
    //Since when devices are attached all fields have changed, don't send events for streaming being false.
    else if(!(changed.attached && info.attached)) {
      controller.streamingCount--;
      controller.emit('deviceStopped', info);
      if(controller.streamingCount == 0){
        controller.emit('streamingStopped', info);
      }
      controller.emit('deviceDisconnected');
    }

  });


  this.on('newListener', function(event, listener) {
    if( event == 'deviceConnected' || event == 'deviceDisconnected' ) {
      console.warn(event + " events are depricated.  Consider using 'streamingStarted/streamingStopped' or 'deviceStreaming/deviceStopped' instead");
    }
  });

};




// Checks if the protocol version is the latest, if if not, shows the dialog.
Controller.prototype.checkOutOfDate = function(){
  console.assert(this.connection && this.connection.protocol);

  var serviceVersion = this.connection.protocol.serviceVersion;
  var protocolVersion = this.connection.protocol.version;
  var defaultProtocolVersion = this.connectionType.defaultProtocolVersion;

  if (defaultProtocolVersion > protocolVersion){

    console.warn("Your Protocol Version is v" + protocolVersion +
        ", this app was designed for v" + defaultProtocolVersion);

    Dialog.warnOutOfDate({
      sV: serviceVersion,
      pV: protocolVersion
    });
    return true
  }else{
    return false
  }

};



Controller._pluginFactories = {};

/*
 * Registers a plugin, making is accessible to controller.use later on.
 *
 * @member plugin
 * @memberof Leap.Controller.prototype
 * @param {String} name The name of the plugin (usually camelCase).
 * @param {function} factory A factory method which will return an instance of a plugin.
 * The factory receives an optional hash of options, passed in via controller.use.
 *
 * Valid keys for the object include frame, hand, finger, tool, and pointable.  The value
 * of each key can be either a function or an object.  If given a function, that function
 * will be called once for every instance of the object, with that instance injected as an
 * argument.  This allows decoration of objects with additional data:
 *
 * ```javascript
 * Leap.Controller.plugin('testPlugin', function(options){
 *   return {
 *     frame: function(frame){
 *       frame.foo = 'bar';
 *     }
 *   }
 * });
 * ```
 *
 * When hand is used, the callback is called for every hand in `frame.hands`.  Note that
 * hand objects are recreated with every new frame, so that data saved on the hand will not
 * persist.
 *
 * ```javascript
 * Leap.Controller.plugin('testPlugin', function(){
 *   return {
 *     hand: function(hand){
 *       console.log('testPlugin running on hand ' + hand.id);
 *     }
 *   }
 * });
 * ```
 *
 * A factory can return an object to add custom functionality to Frames, Hands, or Pointables.
 * The methods are added directly to the object's prototype.  Finger and Tool cannot be used here, Pointable
 * must be used instead.
 * This is encouraged for calculations which may not be necessary on every frame.
 * Memoization is also encouraged, for cases where the method may be called many times per frame by the application.
 *
 * ```javascript
 * // This plugin allows hand.usefulData() to be called later.
 * Leap.Controller.plugin('testPlugin', function(){
 *   return {
 *     hand: {
 *       usefulData: function(){
 *         console.log('usefulData on hand', this.id);
 *         // memoize the results on to the hand, preventing repeat work:
 *         this.x || this.x = someExpensiveCalculation();
 *         return this.x;
 *       }
 *     }
 *   }
 * });
 *
 * Note that the factory pattern allows encapsulation for every plugin instance.
 *
 * ```javascript
 * Leap.Controller.plugin('testPlugin', function(options){
 *   options || options = {}
 *   options.center || options.center = [0,0,0]
 *
 *   privatePrintingMethod = function(){
 *     console.log('privatePrintingMethod - options', options);
 *   }
 *
 *   return {
 *     pointable: {
 *       publicPrintingMethod: function(){
 *         privatePrintingMethod();
 *       }
 *     }
 *   }
 * });
 *
 */
Controller.plugin = function(pluginName, factory) {
  if (this._pluginFactories[pluginName]) {
    console.warn("Plugin \"" + pluginName + "\" already registered");
  }
  return this._pluginFactories[pluginName] = factory;
};

/*
 * Returns a list of registered plugins.
 * @returns {Array} Plugin Factories.
 */
Controller.plugins = function() {
  return _.keys(this._pluginFactories);
};



var setPluginCallbacks = function(pluginName, type, callback){
  
  if ( ['beforeFrameCreated', 'afterFrameCreated'].indexOf(type) != -1 ){
    
      // todo - not able to "unuse" a plugin currently
      this.on(type, callback);
      
    }else {
      
      if (!this.pipeline) this.pipeline = new Pipeline(this);
    
      if (!this._pluginPipelineSteps[pluginName]) this._pluginPipelineSteps[pluginName] = [];

      this._pluginPipelineSteps[pluginName].push(
        
        this.pipeline.addWrappedStep(type, callback)
        
      );
      
    }
  
};

var setPluginMethods = function(pluginName, type, hash){
  var klass;
  
  if (!this._pluginExtendedMethods[pluginName]) this._pluginExtendedMethods[pluginName] = [];

  switch (type) {
    case 'frame':
      klass = Frame;
      break;
    case 'hand':
      klass = Hand;
      break;
    case 'pointable':
      klass = Pointable;
      _.extend(Finger.prototype, hash);
      _.extend(Finger.Invalid,   hash);
      break;
    case 'finger':
      klass = Finger;
      break;
    default:
      throw pluginName + ' specifies invalid object type "' + type + '" for prototypical extension'
  }

  _.extend(klass.prototype, hash);
  _.extend(klass.Invalid, hash);
  this._pluginExtendedMethods[pluginName].push([klass, hash])
  
}



/*
 * Begin using a registered plugin.  The plugin's functionality will be added to all frames
 * returned by the controller (and/or added to the objects within the frame).
 *  - The order of plugin execution inside the loop will match the order in which use is called by the application.
 *  - The plugin be run for both deviceFrames and animationFrames.
 *
 *  If called a second time, the options will be merged with those of the already instantiated plugin.
 *
 * @method use
 * @memberOf Leap.Controller.prototype
 * @param pluginName
 * @param {Hash} Options to be passed to the plugin's factory.
 * @returns the controller
 */
Controller.prototype.use = function(pluginName, options) {
  var functionOrHash, pluginFactory, key, pluginInstance;

  pluginFactory = (typeof pluginName == 'function') ? pluginName : Controller._pluginFactories[pluginName];

  if (!pluginFactory) {
    throw 'Leap Plugin ' + pluginName + ' not found.';
  }

  options || (options = {});

  if (this.plugins[pluginName]){
    _.extend(this.plugins[pluginName], options);
    return this;
  }

  this.plugins[pluginName] = options;

  pluginInstance = pluginFactory.call(this, options);

  for (key in pluginInstance) {

    functionOrHash = pluginInstance[key];

    if (typeof functionOrHash === 'function') {
      
      setPluginCallbacks.call(this, pluginName, key, functionOrHash);
      
    } else {
      
      setPluginMethods.call(this, pluginName, key, functionOrHash);
      
    }

  }

  return this;
};




/*
 * Stop using a used plugin.  This will remove any of the plugin's pipeline methods (those called on every frame)
 * and remove any methods which extend frame-object prototypes.
 *
 * @method stopUsing
 * @memberOf Leap.Controller.prototype
 * @param pluginName
 * @returns the controller
 */
Controller.prototype.stopUsing = function (pluginName) {
  var steps = this._pluginPipelineSteps[pluginName],
      extMethodHashes = this._pluginExtendedMethods[pluginName],
      i = 0, klass, extMethodHash;

  if (!this.plugins[pluginName]) return;

  if (steps) {
    for (i = 0; i < steps.length; i++) {
      this.pipeline.removeStep(steps[i]);
    }
  }

  if (extMethodHashes){
    for (i = 0; i < extMethodHashes.length; i++){
      klass = extMethodHashes[i][0];
      extMethodHash = extMethodHashes[i][1];
      for (var methodName in extMethodHash) {
        delete klass.prototype[methodName];
        delete klass.Invalid[methodName];
      }
    }
  }

  delete this.plugins[pluginName];

  return this;
}

Controller.prototype.useRegisteredPlugins = function(){
  for (var plugin in Controller._pluginFactories){
    this.use(plugin);
  }
}


_.extend(Controller.prototype, EventEmitter.prototype);

}).call(this,require('_process'))
},{"./circular_buffer":13,"./connection/browser":15,"./connection/node":16,"./dialog":18,"./finger":19,"./frame":20,"./gesture":21,"./hand":22,"./pipeline":25,"./pointable":26,"_process":3,"events":1,"underscore":34}],18:[function(require,module,exports){
(function (process){
var Dialog = module.exports = function(message, options){
  this.options = (options || {});
  this.message = message;

  this.createElement();
};

Dialog.prototype.createElement = function(){
  this.element = document.createElement('div');
  this.element.className = "leapjs-dialog";
  this.element.style.position = "fixed";
  this.element.style.top = '8px';
  this.element.style.left = 0;
  this.element.style.right = 0;
  this.element.style.textAlign = 'center';
  this.element.style.zIndex = 1000;

  var dialog  = document.createElement('div');
  this.element.appendChild(dialog);
  dialog.style.className = "leapjs-dialog";
  dialog.style.display = "inline-block";
  dialog.style.margin = "auto";
  dialog.style.padding = "8px";
  dialog.style.color = "#222";
  dialog.style.background = "#eee";
  dialog.style.borderRadius = "4px";
  dialog.style.border = "1px solid #999";
  dialog.style.textAlign = "left";
  dialog.style.cursor = "pointer";
  dialog.style.whiteSpace = "nowrap";
  dialog.style.transition = "box-shadow 1s linear";
  dialog.innerHTML = this.message;


  if (this.options.onclick){
    dialog.addEventListener('click', this.options.onclick);
  }

  if (this.options.onmouseover){
    dialog.addEventListener('mouseover', this.options.onmouseover);
  }

  if (this.options.onmouseout){
    dialog.addEventListener('mouseout', this.options.onmouseout);
  }

  if (this.options.onmousemove){
    dialog.addEventListener('mousemove', this.options.onmousemove);
  }
};

Dialog.prototype.show = function(){
  document.body.appendChild(this.element);
  return this;
};

Dialog.prototype.hide = function(){
  document.body.removeChild(this.element);
  return this;
};




// Shows a DOM dialog box with links to developer.leapmotion.com to upgrade
// This will work whether or not the Leap is plugged in,
// As long as it is called after a call to .connect() and the 'ready' event has fired.
Dialog.warnOutOfDate = function(params){
  params || (params = {});

  var url = "http://developer.leapmotion.com?";

  params.returnTo = window.location.href;

  for (var key in params){
    url += key + '=' + encodeURIComponent(params[key]) + '&';
  }

  var dialog,
    onclick = function(event){

       if (event.target.id != 'leapjs-decline-upgrade'){

         var popup = window.open(url,
           '_blank',
           'height=800,width=1000,location=1,menubar=1,resizable=1,status=1,toolbar=1,scrollbars=1'
         );

         if (window.focus) {popup.focus()}

       }

       dialog.hide();

       return true;
    },


    message = "This site requires Leap Motion Tracking V2." +
      "<button id='leapjs-accept-upgrade'  style='color: #444; transition: box-shadow 100ms linear; cursor: pointer; vertical-align: baseline; margin-left: 16px;'>Upgrade</button>" +
      "<button id='leapjs-decline-upgrade' style='color: #444; transition: box-shadow 100ms linear; cursor: pointer; vertical-align: baseline; margin-left: 8px; '>Not Now</button>";

  dialog = new Dialog(message, {
      onclick: onclick,
      onmousemove: function(e){
        if (e.target == document.getElementById('leapjs-decline-upgrade')){
          document.getElementById('leapjs-decline-upgrade').style.color = '#000';
          document.getElementById('leapjs-decline-upgrade').style.boxShadow = '0px 0px 2px #5daa00';

          document.getElementById('leapjs-accept-upgrade').style.color = '#444';
          document.getElementById('leapjs-accept-upgrade').style.boxShadow = 'none';
        }else{
          document.getElementById('leapjs-accept-upgrade').style.color = '#000';
          document.getElementById('leapjs-accept-upgrade').style.boxShadow = '0px 0px 2px #5daa00';

          document.getElementById('leapjs-decline-upgrade').style.color = '#444';
          document.getElementById('leapjs-decline-upgrade').style.boxShadow = 'none';
        }
      },
      onmouseout: function(){
        document.getElementById('leapjs-decline-upgrade').style.color = '#444';
        document.getElementById('leapjs-decline-upgrade').style.boxShadow = 'none';
        document.getElementById('leapjs-accept-upgrade').style.color = '#444';
        document.getElementById('leapjs-accept-upgrade').style.boxShadow = 'none';
      }
    }
  );

  return dialog.show();
};


// Tracks whether we've warned for lack of bones API.  This will be shown only for early private-beta members.
Dialog.hasWarnedBones = false;

Dialog.warnBones = function(){
  if (this.hasWarnedBones) return;
  this.hasWarnedBones = true;

  console.warn("Your Leap Service is out of date");

  if ( !(typeof(process) !== 'undefined' && process.versions && process.versions.node) ){
    this.warnOutOfDate({reason: 'bones'});
  }

}
}).call(this,require('_process'))
},{"_process":3}],19:[function(require,module,exports){
var Pointable = require('./pointable'),
  Bone = require('./bone')
  , Dialog = require('./dialog')
  , _ = require('underscore');

/**
* Constructs a Finger object.
*
* An uninitialized finger is considered invalid.
* Get valid Finger objects from a Frame or a Hand object.
*
* @class Finger
* @memberof Leap
* @classdesc
* The Finger class reports the physical characteristics of a finger.
*
* Both fingers and tools are classified as Pointable objects. Use the
* Pointable.tool property to determine whether a Pointable object represents a
* tool or finger. The Leap classifies a detected entity as a tool when it is
* thinner, straighter, and longer than a typical finger.
*
* Note that Finger objects can be invalid, which means that they do not
* contain valid tracking data and do not correspond to a physical entity.
* Invalid Finger objects can be the result of asking for a Finger object
* using an ID from an earlier frame when no Finger objects with that ID
* exist in the current frame. A Finger object created from the Finger
* constructor is also invalid. Test for validity with the Pointable.valid
* property.
*/
var Finger = module.exports = function(data) {
  Pointable.call(this, data); // use pointable as super-constructor
  
  /**
  * The position of the distal interphalangeal joint of the finger.
  * This joint is closest to the tip.
  * 
  * The distal interphalangeal joint is located between the most extreme segment
  * of the finger (the distal phalanx) and the middle segment (the medial
  * phalanx).
  *
  * @member dipPosition
  * @type {number[]}
  * @memberof Leap.Finger.prototype
  */  
  this.dipPosition = data.dipPosition;

  /**
  * The position of the proximal interphalangeal joint of the finger. This joint is the middle
  * joint of a finger.
  *
  * The proximal interphalangeal joint is located between the two finger segments
  * closest to the hand (the proximal and the medial phalanges). On a thumb,
  * which lacks an medial phalanx, this joint index identifies the knuckle joint
  * between the proximal phalanx and the metacarpal bone.
  *
  * @member pipPosition
  * @type {number[]}
  * @memberof Leap.Finger.prototype
  */  
  this.pipPosition = data.pipPosition;

  /**
  * The position of the metacarpopophalangeal joint, or knuckle, of the finger.
  *
  * The metacarpopophalangeal joint is located at the base of a finger between
  * the metacarpal bone and the first phalanx. The common name for this joint is
  * the knuckle.
  *
  * On a thumb, which has one less phalanx than a finger, this joint index
  * identifies the thumb joint near the base of the hand, between the carpal
  * and metacarpal bones.
  *
  * @member mcpPosition
  * @type {number[]}
  * @memberof Leap.Finger.prototype
  */  
  this.mcpPosition = data.mcpPosition;

  /**
   * The position of the Carpometacarpal joint
   *
   * This is at the distal end of the wrist, and has no common name.
   *
   */
  this.carpPosition = data.carpPosition;

  /**
  * Whether or not this finger is in an extended posture.
  *
  * A finger is considered extended if it is extended straight from the hand as if
  * pointing. A finger is not extended when it is bent down and curled towards the 
  * palm.
  * @member extended
  * @type {Boolean}
  * @memberof Leap.Finger.prototype
  */
  this.extended = data.extended;

  /**
  * An integer code for the name of this finger.
  * 
  * * 0 -- thumb
  * * 1 -- index finger
  * * 2 -- middle finger
  * * 3 -- ring finger
  * * 4 -- pinky
  *
  * @member type
  * @type {number}
  * @memberof Leap.Finger.prototype
  */
  this.type = data.type;

  this.finger = true;
  
  /**
  * The joint positions of this finger as an array in the order base to tip.
  *
  * @member positions
  * @type {array[]}
  * @memberof Leap.Finger.prototype
  */
  this.positions = [this.carpPosition, this.mcpPosition, this.pipPosition, this.dipPosition, this.tipPosition];

  if (data.bases){
    this.addBones(data);
  } else {
    Dialog.warnBones();
  }

};

_.extend(Finger.prototype, Pointable.prototype);


Finger.prototype.addBones = function(data){
  /**
  * Four bones per finger, from wrist outwards:
  * metacarpal, proximal, medial, and distal.
  *
  * See http://en.wikipedia.org/wiki/Interphalangeal_articulations_of_hand
  */
  this.metacarpal   = new Bone(this, {
    type: 0,
    width: this.width,
    prevJoint: this.carpPosition,
    nextJoint: this.mcpPosition,
    basis: data.bases[0]
  });

  this.proximal     = new Bone(this, {
    type: 1,
    width: this.width,
    prevJoint: this.mcpPosition,
    nextJoint: this.pipPosition,
    basis: data.bases[1]
  });

  this.medial = new Bone(this, {
    type: 2,
    width: this.width,
    prevJoint: this.pipPosition,
    nextJoint: this.dipPosition,
    basis: data.bases[2]
  });

  /**
   * Note that the `distal.nextJoint` position is slightly different from the `finger.tipPosition`.
   * The former is at the very end of the bone, where the latter is the center of a sphere positioned at
   * the tip of the finger.  The btipPosition "bone tip position" is a few mm closer to the wrist than
   * the tipPosition.
   * @type {Bone}
   */
  this.distal       = new Bone(this, {
    type: 3,
    width: this.width,
    prevJoint: this.dipPosition,
    nextJoint: data.btipPosition,
    basis: data.bases[3]
  });

  this.bones = [this.metacarpal, this.proximal, this.medial, this.distal];
};

Finger.prototype.toString = function() {
    return "Finger [ id:" + this.id + " " + this.length + "mmx | width:" + this.width + "mm | direction:" + this.direction + ' ]';
};

Finger.Invalid = { valid: false };

},{"./bone":12,"./dialog":18,"./pointable":26,"underscore":34}],20:[function(require,module,exports){
var Hand = require("./hand")
  , Pointable = require("./pointable")
  , createGesture = require("./gesture").createGesture
  , glMatrix = require("gl-matrix")
  , mat3 = glMatrix.mat3
  , vec3 = glMatrix.vec3
  , InteractionBox = require("./interaction_box")
  , Finger = require('./finger')
  , _ = require("underscore");

/**
 * Constructs a Frame object.
 *
 * Frame instances created with this constructor are invalid.
 * Get valid Frame objects by calling the
 * [Controller.frame]{@link Leap.Controller#frame}() function.
 *<C-D-Space>
 * @class Frame
 * @memberof Leap
 * @classdesc
 * The Frame class represents a set of hand and finger tracking data detected
 * in a single frame.
 *
 * The Leap detects hands, fingers and tools within the tracking area, reporting
 * their positions, orientations and motions in frames at the Leap frame rate.
 *
 * Access Frame objects using the [Controller.frame]{@link Leap.Controller#frame}() function.
 */
var Frame = module.exports = function(data) {
  /**
   * Reports whether this Frame instance is valid.
   *
   * A valid Frame is one generated by the Controller object that contains
   * tracking data for all detected entities. An invalid Frame contains no
   * actual tracking data, but you can call its functions without risk of a
   * undefined object exception. The invalid Frame mechanism makes it more
   * convenient to track individual data across the frame history. For example,
   * you can invoke:
   *
   * ```javascript
   * var finger = controller.frame(n).finger(fingerID);
   * ```
   *
   * for an arbitrary Frame history value, "n", without first checking whether
   * frame(n) returned a null object. (You should still check that the
   * returned Finger instance is valid.)
   *
   * @member valid
   * @memberof Leap.Frame.prototype
   * @type {Boolean}
   */
  this.valid = true;
  /**
   * A unique ID for this Frame. Consecutive frames processed by the Leap
   * have consecutive increasing values.
   * @member id
   * @memberof Leap.Frame.prototype
   * @type {String}
   */
  this.id = data.id;
  /**
   * The frame capture time in microseconds elapsed since the Leap started.
   * @member timestamp
   * @memberof Leap.Frame.prototype
   * @type {number}
   */
  this.timestamp = data.timestamp;
  /**
   * The list of Hand objects detected in this frame, given in arbitrary order.
   * The list can be empty if no hands are detected.
   *
   * @member hands[]
   * @memberof Leap.Frame.prototype
   * @type {Leap.Hand}
   */
  this.hands = [];
  this.handsMap = {};
  /**
   * The list of Pointable objects (fingers and tools) detected in this frame,
   * given in arbitrary order. The list can be empty if no fingers or tools are
   * detected.
   *
   * @member pointables[]
   * @memberof Leap.Frame.prototype
   * @type {Leap.Pointable}
   */
  this.pointables = [];
  /**
   * The list of Tool objects detected in this frame, given in arbitrary order.
   * The list can be empty if no tools are detected.
   *
   * @member tools[]
   * @memberof Leap.Frame.prototype
   * @type {Leap.Pointable}
   */
  this.tools = [];
  /**
   * The list of Finger objects detected in this frame, given in arbitrary order.
   * The list can be empty if no fingers are detected.
   * @member fingers[]
   * @memberof Leap.Frame.prototype
   * @type {Leap.Pointable}
   */
  this.fingers = [];

  /**
   * The InteractionBox associated with the current frame.
   *
   * @member interactionBox
   * @memberof Leap.Frame.prototype
   * @type {Leap.InteractionBox}
   */
  if (data.interactionBox) {
    this.interactionBox = new InteractionBox(data.interactionBox);
  }
  this.gestures = [];
  this.pointablesMap = {};
  this._translation = data.t;
  this._rotation = _.flatten(data.r);
  this._scaleFactor = data.s;
  this.data = data;
  this.type = 'frame'; // used by event emitting
  this.currentFrameRate = data.currentFrameRate;

  if (data.gestures) {
   /**
    * The list of Gesture objects detected in this frame, given in arbitrary order.
    * The list can be empty if no gestures are detected.
    *
    * Circle and swipe gestures are updated every frame. Tap gestures
    * only appear in the list for a single frame.
    * @member gestures[]
    * @memberof Leap.Frame.prototype
    * @type {Leap.Gesture}
    */
    for (var gestureIdx = 0, gestureCount = data.gestures.length; gestureIdx != gestureCount; gestureIdx++) {
      this.gestures.push(createGesture(data.gestures[gestureIdx]));
    }
  }
  this.postprocessData(data);
};

Frame.prototype.postprocessData = function(data){
  if (!data) {
    data = this.data;
  }

  for (var handIdx = 0, handCount = data.hands.length; handIdx != handCount; handIdx++) {
    var hand = new Hand(data.hands[handIdx]);
    hand.frame = this;
    this.hands.push(hand);
    this.handsMap[hand.id] = hand;
  }

  data.pointables = _.sortBy(data.pointables, function(pointable) { return pointable.id });

  for (var pointableIdx = 0, pointableCount = data.pointables.length; pointableIdx != pointableCount; pointableIdx++) {
    var pointableData = data.pointables[pointableIdx];
    var pointable = pointableData.dipPosition ? new Finger(pointableData) : new Pointable(pointableData);
    pointable.frame = this;
    this.addPointable(pointable);
  }
};

/**
 * Adds data from a pointable element into the pointablesMap; 
 * also adds the pointable to the frame.handsMap hand to which it belongs,
 * and to the hand's tools or hand's fingers map.
 * 
 * @param pointable {Object} a Pointable
 */
Frame.prototype.addPointable = function (pointable) {
  this.pointables.push(pointable);
  this.pointablesMap[pointable.id] = pointable;
  (pointable.tool ? this.tools : this.fingers).push(pointable);
  if (pointable.handId !== undefined && this.handsMap.hasOwnProperty(pointable.handId)) {
    var hand = this.handsMap[pointable.handId];
    hand.pointables.push(pointable);
    (pointable.tool ? hand.tools : hand.fingers).push(pointable);
    switch (pointable.type){
      case 0:
        hand.thumb = pointable;
        break;
      case 1:
        hand.indexFinger = pointable;
        break;
      case 2:
        hand.middleFinger = pointable;
        break;
      case 3:
        hand.ringFinger = pointable;
        break;
      case 4:
        hand.pinky = pointable;
        break;
    }
  }
};

/**
 * The tool with the specified ID in this frame.
 *
 * Use the Frame tool() function to retrieve a tool from
 * this frame using an ID value obtained from a previous frame.
 * This function always returns a Pointable object, but if no tool
 * with the specified ID is present, an invalid Pointable object is returned.
 *
 * Note that ID values persist across frames, but only until tracking of a
 * particular object is lost. If tracking of a tool is lost and subsequently
 * regained, the new Pointable object representing that tool may have a
 * different ID than that representing the tool in an earlier frame.
 *
 * @method tool
 * @memberof Leap.Frame.prototype
 * @param {String} id The ID value of a Tool object from a previous frame.
 * @returns {Leap.Pointable} The tool with the
 * matching ID if one exists in this frame; otherwise, an invalid Pointable object
 * is returned.
 */
Frame.prototype.tool = function(id) {
  var pointable = this.pointable(id);
  return pointable.tool ? pointable : Pointable.Invalid;
};

/**
 * The Pointable object with the specified ID in this frame.
 *
 * Use the Frame pointable() function to retrieve the Pointable object from
 * this frame using an ID value obtained from a previous frame.
 * This function always returns a Pointable object, but if no finger or tool
 * with the specified ID is present, an invalid Pointable object is returned.
 *
 * Note that ID values persist across frames, but only until tracking of a
 * particular object is lost. If tracking of a finger or tool is lost and subsequently
 * regained, the new Pointable object representing that finger or tool may have
 * a different ID than that representing the finger or tool in an earlier frame.
 *
 * @method pointable
 * @memberof Leap.Frame.prototype
 * @param {String} id The ID value of a Pointable object from a previous frame.
 * @returns {Leap.Pointable} The Pointable object with
 * the matching ID if one exists in this frame;
 * otherwise, an invalid Pointable object is returned.
 */
Frame.prototype.pointable = function(id) {
  return this.pointablesMap[id] || Pointable.Invalid;
};

/**
 * The finger with the specified ID in this frame.
 *
 * Use the Frame finger() function to retrieve the finger from
 * this frame using an ID value obtained from a previous frame.
 * This function always returns a Finger object, but if no finger
 * with the specified ID is present, an invalid Pointable object is returned.
 *
 * Note that ID values persist across frames, but only until tracking of a
 * particular object is lost. If tracking of a finger is lost and subsequently
 * regained, the new Pointable object representing that physical finger may have
 * a different ID than that representing the finger in an earlier frame.
 *
 * @method finger
 * @memberof Leap.Frame.prototype
 * @param {String} id The ID value of a finger from a previous frame.
 * @returns {Leap.Pointable} The finger with the
 * matching ID if one exists in this frame; otherwise, an invalid Pointable
 * object is returned.
 */
Frame.prototype.finger = function(id) {
  var pointable = this.pointable(id);
  return !pointable.tool ? pointable : Pointable.Invalid;
};

/**
 * The Hand object with the specified ID in this frame.
 *
 * Use the Frame hand() function to retrieve the Hand object from
 * this frame using an ID value obtained from a previous frame.
 * This function always returns a Hand object, but if no hand
 * with the specified ID is present, an invalid Hand object is returned.
 *
 * Note that ID values persist across frames, but only until tracking of a
 * particular object is lost. If tracking of a hand is lost and subsequently
 * regained, the new Hand object representing that physical hand may have
 * a different ID than that representing the physical hand in an earlier frame.
 *
 * @method hand
 * @memberof Leap.Frame.prototype
 * @param {String} id The ID value of a Hand object from a previous frame.
 * @returns {Leap.Hand} The Hand object with the matching
 * ID if one exists in this frame; otherwise, an invalid Hand object is returned.
 */
Frame.prototype.hand = function(id) {
  return this.handsMap[id] || Hand.Invalid;
};

/**
 * The angle of rotation around the rotation axis derived from the overall
 * rotational motion between the current frame and the specified frame.
 *
 * The returned angle is expressed in radians measured clockwise around
 * the rotation axis (using the right-hand rule) between the start and end frames.
 * The value is always between 0 and pi radians (0 and 180 degrees).
 *
 * The Leap derives frame rotation from the relative change in position and
 * orientation of all objects detected in the field of view.
 *
 * If either this frame or sinceFrame is an invalid Frame object, then the
 * angle of rotation is zero.
 *
 * @method rotationAngle
 * @memberof Leap.Frame.prototype
 * @param {Leap.Frame} sinceFrame The starting frame for computing the relative rotation.
 * @param {number[]} [axis] The axis to measure rotation around.
 * @returns {number} A positive value containing the heuristically determined
 * rotational change between the current frame and that specified in the sinceFrame parameter.
 */
Frame.prototype.rotationAngle = function(sinceFrame, axis) {
  if (!this.valid || !sinceFrame.valid) return 0.0;

  var rot = this.rotationMatrix(sinceFrame);
  var cs = (rot[0] + rot[4] + rot[8] - 1.0)*0.5;
  var angle = Math.acos(cs);
  angle = isNaN(angle) ? 0.0 : angle;

  if (axis !== undefined) {
    var rotAxis = this.rotationAxis(sinceFrame);
    angle *= vec3.dot(rotAxis, vec3.normalize(vec3.create(), axis));
  }

  return angle;
};

/**
 * The axis of rotation derived from the overall rotational motion between
 * the current frame and the specified frame.
 *
 * The returned direction vector is normalized.
 *
 * The Leap derives frame rotation from the relative change in position and
 * orientation of all objects detected in the field of view.
 *
 * If either this frame or sinceFrame is an invalid Frame object, or if no
 * rotation is detected between the two frames, a zero vector is returned.
 *
 * @method rotationAxis
 * @memberof Leap.Frame.prototype
 * @param {Leap.Frame} sinceFrame The starting frame for computing the relative rotation.
 * @returns {number[]} A normalized direction vector representing the axis of the heuristically determined
 * rotational change between the current frame and that specified in the sinceFrame parameter.
 */
Frame.prototype.rotationAxis = function(sinceFrame) {
  if (!this.valid || !sinceFrame.valid) return vec3.create();
  return vec3.normalize(vec3.create(), [
    this._rotation[7] - sinceFrame._rotation[5],
    this._rotation[2] - sinceFrame._rotation[6],
    this._rotation[3] - sinceFrame._rotation[1]
  ]);
}

/**
 * The transform matrix expressing the rotation derived from the overall
 * rotational motion between the current frame and the specified frame.
 *
 * The Leap derives frame rotation from the relative change in position and
 * orientation of all objects detected in the field of view.
 *
 * If either this frame or sinceFrame is an invalid Frame object, then
 * this method returns an identity matrix.
 *
 * @method rotationMatrix
 * @memberof Leap.Frame.prototype
 * @param {Leap.Frame} sinceFrame The starting frame for computing the relative rotation.
 * @returns {number[]} A transformation matrix containing the heuristically determined
 * rotational change between the current frame and that specified in the sinceFrame parameter.
 */
Frame.prototype.rotationMatrix = function(sinceFrame) {
  if (!this.valid || !sinceFrame.valid) return mat3.create();
  var transpose = mat3.transpose(mat3.create(), this._rotation)
  return mat3.multiply(mat3.create(), sinceFrame._rotation, transpose);
}

/**
 * The scale factor derived from the overall motion between the current frame and the specified frame.
 *
 * The scale factor is always positive. A value of 1.0 indicates no scaling took place.
 * Values between 0.0 and 1.0 indicate contraction and values greater than 1.0 indicate expansion.
 *
 * The Leap derives scaling from the relative inward or outward motion of all
 * objects detected in the field of view (independent of translation and rotation).
 *
 * If either this frame or sinceFrame is an invalid Frame object, then this method returns 1.0.
 *
 * @method scaleFactor
 * @memberof Leap.Frame.prototype
 * @param {Leap.Frame} sinceFrame The starting frame for computing the relative scaling.
 * @returns {number} A positive value representing the heuristically determined
 * scaling change ratio between the current frame and that specified in the sinceFrame parameter.
 */
Frame.prototype.scaleFactor = function(sinceFrame) {
  if (!this.valid || !sinceFrame.valid) return 1.0;
  return Math.exp(this._scaleFactor - sinceFrame._scaleFactor);
}

/**
 * The change of position derived from the overall linear motion between the
 * current frame and the specified frame.
 *
 * The returned translation vector provides the magnitude and direction of the
 * movement in millimeters.
 *
 * The Leap derives frame translation from the linear motion of all objects
 * detected in the field of view.
 *
 * If either this frame or sinceFrame is an invalid Frame object, then this
 * method returns a zero vector.
 *
 * @method translation
 * @memberof Leap.Frame.prototype
 * @param {Leap.Frame} sinceFrame The starting frame for computing the relative translation.
 * @returns {number[]} A vector representing the heuristically determined change in
 * position of all objects between the current frame and that specified in the sinceFrame parameter.
 */
Frame.prototype.translation = function(sinceFrame) {
  if (!this.valid || !sinceFrame.valid) return vec3.create();
  return vec3.subtract(vec3.create(), this._translation, sinceFrame._translation);
}

/**
 * A string containing a brief, human readable description of the Frame object.
 *
 * @method toString
 * @memberof Leap.Frame.prototype
 * @returns {String} A brief description of this frame.
 */
Frame.prototype.toString = function() {
  var str = "Frame [ id:"+this.id+" | timestamp:"+this.timestamp+" | Hand count:("+this.hands.length+") | Pointable count:("+this.pointables.length+")";
  if (this.gestures) str += " | Gesture count:("+this.gestures.length+")";
  str += " ]";
  return str;
}

/**
 * Returns a JSON-formatted string containing the hands, pointables and gestures
 * in this frame.
 *
 * @method dump
 * @memberof Leap.Frame.prototype
 * @returns {String} A JSON-formatted string.
 */
Frame.prototype.dump = function() {
  var out = '';
  out += "Frame Info:<br/>";
  out += this.toString();
  out += "<br/><br/>Hands:<br/>"
  for (var handIdx = 0, handCount = this.hands.length; handIdx != handCount; handIdx++) {
    out += "  "+ this.hands[handIdx].toString() + "<br/>";
  }
  out += "<br/><br/>Pointables:<br/>";
  for (var pointableIdx = 0, pointableCount = this.pointables.length; pointableIdx != pointableCount; pointableIdx++) {
      out += "  "+ this.pointables[pointableIdx].toString() + "<br/>";
  }
  if (this.gestures) {
    out += "<br/><br/>Gestures:<br/>";
    for (var gestureIdx = 0, gestureCount = this.gestures.length; gestureIdx != gestureCount; gestureIdx++) {
        out += "  "+ this.gestures[gestureIdx].toString() + "<br/>";
    }
  }
  out += "<br/><br/>Raw JSON:<br/>";
  out += JSON.stringify(this.data);
  return out;
}

/**
 * An invalid Frame object.
 *
 * You can use this invalid Frame in comparisons testing
 * whether a given Frame instance is valid or invalid. (You can also check the
 * [Frame.valid]{@link Leap.Frame#valid} property.)
 *
 * @static
 * @type {Leap.Frame}
 * @name Invalid
 * @memberof Leap.Frame
 */
Frame.Invalid = {
  valid: false,
  hands: [],
  fingers: [],
  tools: [],
  gestures: [],
  pointables: [],
  pointable: function() { return Pointable.Invalid },
  finger: function() { return Pointable.Invalid },
  hand: function() { return Hand.Invalid },
  toString: function() { return "invalid frame" },
  dump: function() { return this.toString() },
  rotationAngle: function() { return 0.0; },
  rotationMatrix: function() { return mat3.create(); },
  rotationAxis: function() { return vec3.create(); },
  scaleFactor: function() { return 1.0; },
  translation: function() { return vec3.create(); }
};

},{"./finger":19,"./gesture":21,"./hand":22,"./interaction_box":24,"./pointable":26,"gl-matrix":11,"underscore":34}],21:[function(require,module,exports){
var glMatrix = require("gl-matrix")
  , vec3 = glMatrix.vec3
  , EventEmitter = require('events').EventEmitter
  , _ = require('underscore');

/**
 * Constructs a new Gesture object.
 *
 * An uninitialized Gesture object is considered invalid. Get valid instances
 * of the Gesture class, which will be one of the Gesture subclasses, from a
 * Frame object.
 *
 * @class Gesture
 * @abstract
 * @memberof Leap
 * @classdesc
 * The Gesture class represents a recognized movement by the user.
 *
 * The Leap watches the activity within its field of view for certain movement
 * patterns typical of a user gesture or command. For example, a movement from side to
 * side with the hand can indicate a swipe gesture, while a finger poking forward
 * can indicate a screen tap gesture.
 *
 * When the Leap recognizes a gesture, it assigns an ID and adds a
 * Gesture object to the frame gesture list. For continuous gestures, which
 * occur over many frames, the Leap updates the gesture by adding
 * a Gesture object having the same ID and updated properties in each
 * subsequent frame.
 *
 * **Important:** Recognition for each type of gesture must be enabled;
 * otherwise **no gestures are recognized or reported**.
 *
 * Subclasses of Gesture define the properties for the specific movement patterns
 * recognized by the Leap.
 *
 * The Gesture subclasses for include:
 *
 * * CircleGesture -- A circular movement by a finger.
 * * SwipeGesture -- A straight line movement by the hand with fingers extended.
 * * ScreenTapGesture -- A forward tapping movement by a finger.
 * * KeyTapGesture -- A downward tapping movement by a finger.
 *
 * Circle and swipe gestures are continuous and these objects can have a
 * state of start, update, and stop.
 *
 * The screen tap gesture is a discrete gesture. The Leap only creates a single
 * ScreenTapGesture object appears for each tap and it always has a stop state.
 *
 * Get valid Gesture instances from a Frame object. You can get a list of gestures
 * from the Frame gestures array. You can also use the Frame gesture() method
 * to find a gesture in the current frame using an ID value obtained in a
 * previous frame.
 *
 * Gesture objects can be invalid. For example, when you get a gesture by ID
 * using Frame.gesture(), and there is no gesture with that ID in the current
 * frame, then gesture() returns an Invalid Gesture object (rather than a null
 * value). Always check object validity in situations where a gesture might be
 * invalid.
 */
var createGesture = exports.createGesture = function(data) {
  var gesture;
  switch (data.type) {
    case 'circle':
      gesture = new CircleGesture(data);
      break;
    case 'swipe':
      gesture = new SwipeGesture(data);
      break;
    case 'screenTap':
      gesture = new ScreenTapGesture(data);
      break;
    case 'keyTap':
      gesture = new KeyTapGesture(data);
      break;
    default:
      throw "unknown gesture type";
  }

 /**
  * The gesture ID.
  *
  * All Gesture objects belonging to the same recognized movement share the
  * same ID value. Use the ID value with the Frame::gesture() method to
  * find updates related to this Gesture object in subsequent frames.
  *
  * @member id
  * @memberof Leap.Gesture.prototype
  * @type {number}
  */
  gesture.id = data.id;
 /**
  * The list of hands associated with this Gesture, if any.
  *
  * If no hands are related to this gesture, the list is empty.
  *
  * @member handIds
  * @memberof Leap.Gesture.prototype
  * @type {Array}
  */
  gesture.handIds = data.handIds.slice();
 /**
  * The list of fingers and tools associated with this Gesture, if any.
  *
  * If no Pointable objects are related to this gesture, the list is empty.
  *
  * @member pointableIds
  * @memberof Leap.Gesture.prototype
  * @type {Array}
  */
  gesture.pointableIds = data.pointableIds.slice();
 /**
  * The elapsed duration of the recognized movement up to the
  * frame containing this Gesture object, in microseconds.
  *
  * The duration reported for the first Gesture in the sequence (with the
  * start state) will typically be a small positive number since
  * the movement must progress far enough for the Leap to recognize it as
  * an intentional gesture.
  *
  * @member duration
  * @memberof Leap.Gesture.prototype
  * @type {number}
  */
  gesture.duration = data.duration;
 /**
  * The gesture ID.
  *
  * Recognized movements occur over time and have a beginning, a middle,
  * and an end. The 'state()' attribute reports where in that sequence this
  * Gesture object falls.
  *
  * Possible values for the state field are:
  *
  * * start
  * * update
  * * stop
  *
  * @member state
  * @memberof Leap.Gesture.prototype
  * @type {String}
  */
  gesture.state = data.state;
 /**
  * The gesture type.
  *
  * Possible values for the type field are:
  *
  * * circle
  * * swipe
  * * screenTap
  * * keyTap
  *
  * @member type
  * @memberof Leap.Gesture.prototype
  * @type {String}
  */
  gesture.type = data.type;
  return gesture;
}

/*
 * Returns a builder object, which uses method chaining for gesture callback binding.
 */
var gestureListener = exports.gestureListener = function(controller, type) {
  var handlers = {};
  var gestureMap = {};

  controller.on('gesture', function(gesture, frame) {
    if (gesture.type == type) {
      if (gesture.state == "start" || gesture.state == "stop") {
        if (gestureMap[gesture.id] === undefined) {
          var gestureTracker = new Gesture(gesture, frame);
          gestureMap[gesture.id] = gestureTracker;
          _.each(handlers, function(cb, name) {
            gestureTracker.on(name, cb);
          });
        }
      }
      gestureMap[gesture.id].update(gesture, frame);
      if (gesture.state == "stop") {
        delete gestureMap[gesture.id];
      }
    }
  });
  var builder = {
    start: function(cb) {
      handlers['start'] = cb;
      return builder;
    },
    stop: function(cb) {
      handlers['stop'] = cb;
      return builder;
    },
    complete: function(cb) {
      handlers['stop'] = cb;
      return builder;
    },
    update: function(cb) {
      handlers['update'] = cb;
      return builder;
    }
  }
  return builder;
}

var Gesture = exports.Gesture = function(gesture, frame) {
  this.gestures = [gesture];
  this.frames = [frame];
}

Gesture.prototype.update = function(gesture, frame) {
  this.lastGesture = gesture;
  this.lastFrame = frame;
  this.gestures.push(gesture);
  this.frames.push(frame);
  this.emit(gesture.state, this);
}

Gesture.prototype.translation = function() {
  return vec3.subtract(vec3.create(), this.lastGesture.startPosition, this.lastGesture.position);
}

_.extend(Gesture.prototype, EventEmitter.prototype);

/**
 * Constructs a new CircleGesture object.
 *
 * An uninitialized CircleGesture object is considered invalid. Get valid instances
 * of the CircleGesture class from a Frame object.
 *
 * @class CircleGesture
 * @memberof Leap
 * @augments Leap.Gesture
 * @classdesc
 * The CircleGesture classes represents a circular finger movement.
 *
 * A circle movement is recognized when the tip of a finger draws a circle
 * within the Leap field of view.
 *
 * ![CircleGesture](images/Leap_Gesture_Circle.png)
 *
 * Circle gestures are continuous. The CircleGesture objects for the gesture have
 * three possible states:
 *
 * * start -- The circle gesture has just started. The movement has
 *  progressed far enough for the recognizer to classify it as a circle.
 * * update -- The circle gesture is continuing.
 * * stop -- The circle gesture is finished.
 */
var CircleGesture = function(data) {
 /**
  * The center point of the circle within the Leap frame of reference.
  *
  * @member center
  * @memberof Leap.CircleGesture.prototype
  * @type {number[]}
  */
  this.center = data.center;
 /**
  * The normal vector for the circle being traced.
  *
  * If you draw the circle clockwise, the normal vector points in the same
  * general direction as the pointable object drawing the circle. If you draw
  * the circle counterclockwise, the normal points back toward the
  * pointable. If the angle between the normal and the pointable object
  * drawing the circle is less than 90 degrees, then the circle is clockwise.
  *
  * ```javascript
  *    var clockwiseness;
  *    if (circle.pointable.direction.angleTo(circle.normal) <= PI/4) {
  *        clockwiseness = "clockwise";
  *    }
  *    else
  *    {
  *        clockwiseness = "counterclockwise";
  *    }
  * ```
  *
  * @member normal
  * @memberof Leap.CircleGesture.prototype
  * @type {number[]}
  */
  this.normal = data.normal;
 /**
  * The number of times the finger tip has traversed the circle.
  *
  * Progress is reported as a positive number of the number. For example,
  * a progress value of .5 indicates that the finger has gone halfway
  * around, while a value of 3 indicates that the finger has gone around
  * the the circle three times.
  *
  * Progress starts where the circle gesture began. Since the circle
  * must be partially formed before the Leap can recognize it, progress
  * will be greater than zero when a circle gesture first appears in the
  * frame.
  *
  * @member progress
  * @memberof Leap.CircleGesture.prototype
  * @type {number}
  */
  this.progress = data.progress;
 /**
  * The radius of the circle in mm.
  *
  * @member radius
  * @memberof Leap.CircleGesture.prototype
  * @type {number}
  */
  this.radius = data.radius;
}

CircleGesture.prototype.toString = function() {
  return "CircleGesture ["+JSON.stringify(this)+"]";
}

/**
 * Constructs a new SwipeGesture object.
 *
 * An uninitialized SwipeGesture object is considered invalid. Get valid instances
 * of the SwipeGesture class from a Frame object.
 *
 * @class SwipeGesture
 * @memberof Leap
 * @augments Leap.Gesture
 * @classdesc
 * The SwipeGesture class represents a swiping motion of a finger or tool.
 *
 * ![SwipeGesture](images/Leap_Gesture_Swipe.png)
 *
 * Swipe gestures are continuous.
 */
var SwipeGesture = function(data) {
 /**
  * The starting position within the Leap frame of
  * reference, in mm.
  *
  * @member startPosition
  * @memberof Leap.SwipeGesture.prototype
  * @type {number[]}
  */
  this.startPosition = data.startPosition;
 /**
  * The current swipe position within the Leap frame of
  * reference, in mm.
  *
  * @member position
  * @memberof Leap.SwipeGesture.prototype
  * @type {number[]}
  */
  this.position = data.position;
 /**
  * The unit direction vector parallel to the swipe motion.
  *
  * You can compare the components of the vector to classify the swipe as
  * appropriate for your application. For example, if you are using swipes
  * for two dimensional scrolling, you can compare the x and y values to
  * determine if the swipe is primarily horizontal or vertical.
  *
  * @member direction
  * @memberof Leap.SwipeGesture.prototype
  * @type {number[]}
  */
  this.direction = data.direction;
 /**
  * The speed of the finger performing the swipe gesture in
  * millimeters per second.
  *
  * @member speed
  * @memberof Leap.SwipeGesture.prototype
  * @type {number}
  */
  this.speed = data.speed;
}

SwipeGesture.prototype.toString = function() {
  return "SwipeGesture ["+JSON.stringify(this)+"]";
}

/**
 * Constructs a new ScreenTapGesture object.
 *
 * An uninitialized ScreenTapGesture object is considered invalid. Get valid instances
 * of the ScreenTapGesture class from a Frame object.
 *
 * @class ScreenTapGesture
 * @memberof Leap
 * @augments Leap.Gesture
 * @classdesc
 * The ScreenTapGesture class represents a tapping gesture by a finger or tool.
 *
 * A screen tap gesture is recognized when the tip of a finger pokes forward
 * and then springs back to approximately the original postion, as if
 * tapping a vertical screen. The tapping finger must pause briefly before beginning the tap.
 *
 * ![ScreenTap](images/Leap_Gesture_Tap2.png)
 *
 * ScreenTap gestures are discrete. The ScreenTapGesture object representing a tap always
 * has the state, STATE_STOP. Only one ScreenTapGesture object is created for each
 * screen tap gesture recognized.
 */
var ScreenTapGesture = function(data) {
 /**
  * The position where the screen tap is registered.
  *
  * @member position
  * @memberof Leap.ScreenTapGesture.prototype
  * @type {number[]}
  */
  this.position = data.position;
 /**
  * The direction of finger tip motion.
  *
  * @member direction
  * @memberof Leap.ScreenTapGesture.prototype
  * @type {number[]}
  */
  this.direction = data.direction;
 /**
  * The progess value is always 1.0 for a screen tap gesture.
  *
  * @member progress
  * @memberof Leap.ScreenTapGesture.prototype
  * @type {number}
  */
  this.progress = data.progress;
}

ScreenTapGesture.prototype.toString = function() {
  return "ScreenTapGesture ["+JSON.stringify(this)+"]";
}

/**
 * Constructs a new KeyTapGesture object.
 *
 * An uninitialized KeyTapGesture object is considered invalid. Get valid instances
 * of the KeyTapGesture class from a Frame object.
 *
 * @class KeyTapGesture
 * @memberof Leap
 * @augments Leap.Gesture
 * @classdesc
 * The KeyTapGesture class represents a tapping gesture by a finger or tool.
 *
 * A key tap gesture is recognized when the tip of a finger rotates down toward the
 * palm and then springs back to approximately the original postion, as if
 * tapping. The tapping finger must pause briefly before beginning the tap.
 *
 * ![KeyTap](images/Leap_Gesture_Tap.png)
 *
 * Key tap gestures are discrete. The KeyTapGesture object representing a tap always
 * has the state, STATE_STOP. Only one KeyTapGesture object is created for each
 * key tap gesture recognized.
 */
var KeyTapGesture = function(data) {
    /**
     * The position where the key tap is registered.
     *
     * @member position
     * @memberof Leap.KeyTapGesture.prototype
     * @type {number[]}
     */
    this.position = data.position;
    /**
     * The direction of finger tip motion.
     *
     * @member direction
     * @memberof Leap.KeyTapGesture.prototype
     * @type {number[]}
     */
    this.direction = data.direction;
    /**
     * The progess value is always 1.0 for a key tap gesture.
     *
     * @member progress
     * @memberof Leap.KeyTapGesture.prototype
     * @type {number}
     */
    this.progress = data.progress;
}

KeyTapGesture.prototype.toString = function() {
  return "KeyTapGesture ["+JSON.stringify(this)+"]";
}

},{"events":1,"gl-matrix":11,"underscore":34}],22:[function(require,module,exports){
var Pointable = require("./pointable")
  , Bone = require('./bone')
  , glMatrix = require("gl-matrix")
  , mat3 = glMatrix.mat3
  , vec3 = glMatrix.vec3
  , _ = require("underscore");

/**
 * Constructs a Hand object.
 *
 * An uninitialized hand is considered invalid.
 * Get valid Hand objects from a Frame object.
 * @class Hand
 * @memberof Leap
 * @classdesc
 * The Hand class reports the physical characteristics of a detected hand.
 *
 * Hand tracking data includes a palm position and velocity; vectors for
 * the palm normal and direction to the fingers; properties of a sphere fit
 * to the hand; and lists of the attached fingers and tools.
 *
 * Note that Hand objects can be invalid, which means that they do not contain
 * valid tracking data and do not correspond to a physical entity. Invalid Hand
 * objects can be the result of asking for a Hand object using an ID from an
 * earlier frame when no Hand objects with that ID exist in the current frame.
 * A Hand object created from the Hand constructor is also invalid.
 * Test for validity with the [Hand.valid]{@link Leap.Hand#valid} property.
 */
var Hand = module.exports = function(data) {
  /**
   * A unique ID assigned to this Hand object, whose value remains the same
   * across consecutive frames while the tracked hand remains visible. If
   * tracking is lost (for example, when a hand is occluded by another hand
   * or when it is withdrawn from or reaches the edge of the Leap field of view),
   * the Leap may assign a new ID when it detects the hand in a future frame.
   *
   * Use the ID value with the {@link Frame.hand}() function to find this
   * Hand object in future frames.
   *
   * @member id
   * @memberof Leap.Hand.prototype
   * @type {String}
   */
  this.id = data.id;
  /**
   * The center position of the palm in millimeters from the Leap origin.
   * @member palmPosition
   * @memberof Leap.Hand.prototype
   * @type {number[]}
   */
  this.palmPosition = data.palmPosition;
  /**
   * The direction from the palm position toward the fingers.
   *
   * The direction is expressed as a unit vector pointing in the same
   * direction as the directed line from the palm position to the fingers.
   *
   * @member direction
   * @memberof Leap.Hand.prototype
   * @type {number[]}
   */
  this.direction = data.direction;
  /**
   * The rate of change of the palm position in millimeters/second.
   *
   * @member palmVeclocity
   * @memberof Leap.Hand.prototype
   * @type {number[]}
   */
  this.palmVelocity = data.palmVelocity;
  /**
   * The normal vector to the palm. If your hand is flat, this vector will
   * point downward, or "out" of the front surface of your palm.
   *
   * ![Palm Vectors](images/Leap_Palm_Vectors.png)
   *
   * The direction is expressed as a unit vector pointing in the same
   * direction as the palm normal (that is, a vector orthogonal to the palm).
   * @member palmNormal
   * @memberof Leap.Hand.prototype
   * @type {number[]}
   */
  this.palmNormal = data.palmNormal;
  /**
   * The center of a sphere fit to the curvature of this hand.
   *
   * This sphere is placed roughly as if the hand were holding a ball.
   *
   * ![Hand Ball](images/Leap_Hand_Ball.png)
   * @member sphereCenter
   * @memberof Leap.Hand.prototype
   * @type {number[]}
   */
  this.sphereCenter = data.sphereCenter;
  /**
   * The radius of a sphere fit to the curvature of this hand, in millimeters.
   *
   * This sphere is placed roughly as if the hand were holding a ball. Thus the
   * size of the sphere decreases as the fingers are curled into a fist.
   *
   * @member sphereRadius
   * @memberof Leap.Hand.prototype
   * @type {number}
   */
  this.sphereRadius = data.sphereRadius;
  /**
   * Reports whether this is a valid Hand object.
   *
   * @member valid
   * @memberof Leap.Hand.prototype
   * @type {boolean}
   */
  this.valid = true;
  /**
   * The list of Pointable objects (fingers and tools) detected in this frame
   * that are associated with this hand, given in arbitrary order. The list
   * can be empty if no fingers or tools associated with this hand are detected.
   *
   * Use the {@link Pointable} tool property to determine
   * whether or not an item in the list represents a tool or finger.
   * You can also get only the tools using the Hand.tools[] list or
   * only the fingers using the Hand.fingers[] list.
   *
   * @member pointables[]
   * @memberof Leap.Hand.prototype
   * @type {Leap.Pointable[]}
   */
  this.pointables = [];
  /**
   * The list of fingers detected in this frame that are attached to
   * this hand, given in arbitrary order.
   *
   * The list can be empty if no fingers attached to this hand are detected.
   *
   * @member fingers[]
   * @memberof Leap.Hand.prototype
   * @type {Leap.Pointable[]}
   */
  this.fingers = [];
  
  if (data.armBasis){
    this.arm = new Bone(this, {
      type: 4,
      width: data.armWidth,
      prevJoint: data.elbow,
      nextJoint: data.wrist,
      basis: data.armBasis
    });
  }else{
    this.arm = null;
  }
  
  /**
   * The list of tools detected in this frame that are held by this
   * hand, given in arbitrary order.
   *
   * The list can be empty if no tools held by this hand are detected.
   *
   * @member tools[]
   * @memberof Leap.Hand.prototype
   * @type {Leap.Pointable[]}
   */
  this.tools = [];
  this._translation = data.t;
  this._rotation = _.flatten(data.r);
  this._scaleFactor = data.s;

  /**
   * Time the hand has been visible in seconds.
   *
   * @member timeVisible
   * @memberof Leap.Hand.prototype
   * @type {number}
   */
   this.timeVisible = data.timeVisible;

  /**
   * The palm position with stabalization
   * @member stabilizedPalmPosition
   * @memberof Leap.Hand.prototype
   * @type {number[]}
   */
   this.stabilizedPalmPosition = data.stabilizedPalmPosition;

   /**
   * Reports whether this is a left or a right hand.
   *
   * @member type
   * @type {String}
   * @memberof Leap.Hand.prototype
   */
   this.type = data.type;
   this.grabStrength = data.grabStrength;
   this.pinchStrength = data.pinchStrength;
   this.confidence = data.confidence;
}

/**
 * The finger with the specified ID attached to this hand.
 *
 * Use this function to retrieve a Pointable object representing a finger
 * attached to this hand using an ID value obtained from a previous frame.
 * This function always returns a Pointable object, but if no finger
 * with the specified ID is present, an invalid Pointable object is returned.
 *
 * Note that the ID values assigned to fingers persist across frames, but only
 * until tracking of a particular finger is lost. If tracking of a finger is
 * lost and subsequently regained, the new Finger object representing that
 * finger may have a different ID than that representing the finger in an
 * earlier frame.
 *
 * @method finger
 * @memberof Leap.Hand.prototype
 * @param {String} id The ID value of a finger from a previous frame.
 * @returns {Leap.Pointable} The Finger object with
 * the matching ID if one exists for this hand in this frame; otherwise, an
 * invalid Finger object is returned.
 */
Hand.prototype.finger = function(id) {
  var finger = this.frame.finger(id);
  return (finger && (finger.handId == this.id)) ? finger : Pointable.Invalid;
}

/**
 * The angle of rotation around the rotation axis derived from the change in
 * orientation of this hand, and any associated fingers and tools, between the
 * current frame and the specified frame.
 *
 * The returned angle is expressed in radians measured clockwise around the
 * rotation axis (using the right-hand rule) between the start and end frames.
 * The value is always between 0 and pi radians (0 and 180 degrees).
 *
 * If a corresponding Hand object is not found in sinceFrame, or if either
 * this frame or sinceFrame are invalid Frame objects, then the angle of rotation is zero.
 *
 * @method rotationAngle
 * @memberof Leap.Hand.prototype
 * @param {Leap.Frame} sinceFrame The starting frame for computing the relative rotation.
 * @param {numnber[]} [axis] The axis to measure rotation around.
 * @returns {number} A positive value representing the heuristically determined
 * rotational change of the hand between the current frame and that specified in
 * the sinceFrame parameter.
 */
Hand.prototype.rotationAngle = function(sinceFrame, axis) {
  if (!this.valid || !sinceFrame.valid) return 0.0;
  var sinceHand = sinceFrame.hand(this.id);
  if(!sinceHand.valid) return 0.0;
  var rot = this.rotationMatrix(sinceFrame);
  var cs = (rot[0] + rot[4] + rot[8] - 1.0)*0.5
  var angle = Math.acos(cs);
  angle = isNaN(angle) ? 0.0 : angle;
  if (axis !== undefined) {
    var rotAxis = this.rotationAxis(sinceFrame);
    angle *= vec3.dot(rotAxis, vec3.normalize(vec3.create(), axis));
  }
  return angle;
}

/**
 * The axis of rotation derived from the change in orientation of this hand, and
 * any associated fingers and tools, between the current frame and the specified frame.
 *
 * The returned direction vector is normalized.
 *
 * If a corresponding Hand object is not found in sinceFrame, or if either
 * this frame or sinceFrame are invalid Frame objects, then this method returns a zero vector.
 *
 * @method rotationAxis
 * @memberof Leap.Hand.prototype
 * @param {Leap.Frame} sinceFrame The starting frame for computing the relative rotation.
 * @returns {number[]} A normalized direction Vector representing the axis of the heuristically determined
 * rotational change of the hand between the current frame and that specified in the sinceFrame parameter.
 */
Hand.prototype.rotationAxis = function(sinceFrame) {
  if (!this.valid || !sinceFrame.valid) return vec3.create();
  var sinceHand = sinceFrame.hand(this.id);
  if (!sinceHand.valid) return vec3.create();
  return vec3.normalize(vec3.create(), [
    this._rotation[7] - sinceHand._rotation[5],
    this._rotation[2] - sinceHand._rotation[6],
    this._rotation[3] - sinceHand._rotation[1]
  ]);
}

/**
 * The transform matrix expressing the rotation derived from the change in
 * orientation of this hand, and any associated fingers and tools, between
 * the current frame and the specified frame.
 *
 * If a corresponding Hand object is not found in sinceFrame, or if either
 * this frame or sinceFrame are invalid Frame objects, then this method returns
 * an identity matrix.
 *
 * @method rotationMatrix
 * @memberof Leap.Hand.prototype
 * @param {Leap.Frame} sinceFrame The starting frame for computing the relative rotation.
 * @returns {number[]} A transformation Matrix containing the heuristically determined
 * rotational change of the hand between the current frame and that specified in the sinceFrame parameter.
 */
Hand.prototype.rotationMatrix = function(sinceFrame) {
  if (!this.valid || !sinceFrame.valid) return mat3.create();
  var sinceHand = sinceFrame.hand(this.id);
  if(!sinceHand.valid) return mat3.create();
  var transpose = mat3.transpose(mat3.create(), this._rotation);
  var m = mat3.multiply(mat3.create(), sinceHand._rotation, transpose);
  return m;
}

/**
 * The scale factor derived from the hand's motion between the current frame and the specified frame.
 *
 * The scale factor is always positive. A value of 1.0 indicates no scaling took place.
 * Values between 0.0 and 1.0 indicate contraction and values greater than 1.0 indicate expansion.
 *
 * The Leap derives scaling from the relative inward or outward motion of a hand
 * and its associated fingers and tools (independent of translation and rotation).
 *
 * If a corresponding Hand object is not found in sinceFrame, or if either this frame or sinceFrame
 * are invalid Frame objects, then this method returns 1.0.
 *
 * @method scaleFactor
 * @memberof Leap.Hand.prototype
 * @param {Leap.Frame} sinceFrame The starting frame for computing the relative scaling.
 * @returns {number} A positive value representing the heuristically determined
 * scaling change ratio of the hand between the current frame and that specified in the sinceFrame parameter.
 */
Hand.prototype.scaleFactor = function(sinceFrame) {
  if (!this.valid || !sinceFrame.valid) return 1.0;
  var sinceHand = sinceFrame.hand(this.id);
  if(!sinceHand.valid) return 1.0;

  return Math.exp(this._scaleFactor - sinceHand._scaleFactor);
}

/**
 * The change of position of this hand between the current frame and the specified frame
 *
 * The returned translation vector provides the magnitude and direction of the
 * movement in millimeters.
 *
 * If a corresponding Hand object is not found in sinceFrame, or if either this frame or
 * sinceFrame are invalid Frame objects, then this method returns a zero vector.
 *
 * @method translation
 * @memberof Leap.Hand.prototype
 * @param {Leap.Frame} sinceFrame The starting frame for computing the relative translation.
 * @returns {number[]} A Vector representing the heuristically determined change in hand
 * position between the current frame and that specified in the sinceFrame parameter.
 */
Hand.prototype.translation = function(sinceFrame) {
  if (!this.valid || !sinceFrame.valid) return vec3.create();
  var sinceHand = sinceFrame.hand(this.id);
  if(!sinceHand.valid) return vec3.create();
  return [
    this._translation[0] - sinceHand._translation[0],
    this._translation[1] - sinceHand._translation[1],
    this._translation[2] - sinceHand._translation[2]
  ];
}

/**
 * A string containing a brief, human readable description of the Hand object.
 * @method toString
 * @memberof Leap.Hand.prototype
 * @returns {String} A description of the Hand as a string.
 */
Hand.prototype.toString = function() {
  return "Hand (" + this.type + ") [ id: "+ this.id + " | palm velocity:"+this.palmVelocity+" | sphere center:"+this.sphereCenter+" ] ";
}

/**
 * The pitch angle in radians.
 *
 * Pitch is the angle between the negative z-axis and the projection of
 * the vector onto the y-z plane. In other words, pitch represents rotation
 * around the x-axis.
 * If the vector points upward, the returned angle is between 0 and pi radians
 * (180 degrees); if it points downward, the angle is between 0 and -pi radians.
 *
 * @method pitch
 * @memberof Leap.Hand.prototype
 * @returns {number} The angle of this vector above or below the horizon (x-z plane).
 *
 */
Hand.prototype.pitch = function() {
  return Math.atan2(this.direction[1], -this.direction[2]);
}

/**
 *  The yaw angle in radians.
 *
 * Yaw is the angle between the negative z-axis and the projection of
 * the vector onto the x-z plane. In other words, yaw represents rotation
 * around the y-axis. If the vector points to the right of the negative z-axis,
 * then the returned angle is between 0 and pi radians (180 degrees);
 * if it points to the left, the angle is between 0 and -pi radians.
 *
 * @method yaw
 * @memberof Leap.Hand.prototype
 * @returns {number} The angle of this vector to the right or left of the y-axis.
 *
 */
Hand.prototype.yaw = function() {
  return Math.atan2(this.direction[0], -this.direction[2]);
}

/**
 *  The roll angle in radians.
 *
 * Roll is the angle between the y-axis and the projection of
 * the vector onto the x-y plane. In other words, roll represents rotation
 * around the z-axis. If the vector points to the left of the y-axis,
 * then the returned angle is between 0 and pi radians (180 degrees);
 * if it points to the right, the angle is between 0 and -pi radians.
 *
 * @method roll
 * @memberof Leap.Hand.prototype
 * @returns {number} The angle of this vector to the right or left of the y-axis.
 *
 */
Hand.prototype.roll = function() {
  return Math.atan2(this.palmNormal[0], -this.palmNormal[1]);
}

/**
 * An invalid Hand object.
 *
 * You can use an invalid Hand object in comparisons testing
 * whether a given Hand instance is valid or invalid. (You can also use the
 * Hand valid property.)
 *
 * @static
 * @type {Leap.Hand}
 * @name Invalid
 * @memberof Leap.Hand
 */
Hand.Invalid = {
  valid: false,
  fingers: [],
  tools: [],
  pointables: [],
  left: false,
  pointable: function() { return Pointable.Invalid },
  finger: function() { return Pointable.Invalid },
  toString: function() { return "invalid frame" },
  dump: function() { return this.toString(); },
  rotationAngle: function() { return 0.0; },
  rotationMatrix: function() { return mat3.create(); },
  rotationAxis: function() { return vec3.create(); },
  scaleFactor: function() { return 1.0; },
  translation: function() { return vec3.create(); }
};

},{"./bone":12,"./pointable":26,"gl-matrix":11,"underscore":34}],23:[function(require,module,exports){
/**
 * Leap is the global namespace of the Leap API.
 * @namespace Leap
 */
module.exports = {
  Controller: require("./controller"),
  Frame: require("./frame"),
  Gesture: require("./gesture"),
  Hand: require("./hand"),
  Pointable: require("./pointable"),
  Finger: require("./finger"),
  InteractionBox: require("./interaction_box"),
  CircularBuffer: require("./circular_buffer"),
  UI: require("./ui"),
  JSONProtocol: require("./protocol").JSONProtocol,
  glMatrix: require("gl-matrix"),
  mat3: require("gl-matrix").mat3,
  vec3: require("gl-matrix").vec3,
  loopController: undefined,
  version: require('./version.js'),

  /**
   * Expose utility libraries for convenience
   * Use carefully - they may be subject to upgrade or removal in different versions of LeapJS.
   *
   */
  _: require('underscore'),
  EventEmitter: require('events').EventEmitter,

  /**
   * The Leap.loop() function passes a frame of Leap data to your
   * callback function and then calls window.requestAnimationFrame() after
   * executing your callback function.
   *
   * Leap.loop() sets up the Leap controller and WebSocket connection for you.
   * You do not need to create your own controller when using this method.
   *
   * Your callback function is called on an interval determined by the client
   * browser. Typically, this is on an interval of 60 frames/second. The most
   * recent frame of Leap data is passed to your callback function. If the Leap
   * is producing frames at a slower rate than the browser frame rate, the same
   * frame of Leap data can be passed to your function in successive animation
   * updates.
   *
   * As an alternative, you can create your own Controller object and use a
   * {@link Controller#onFrame onFrame} callback to process the data at
   * the frame rate of the Leap device. See {@link Controller} for an
   * example.
   *
   * @method Leap.loop
   * @param {function} callback A function called when the browser is ready to
   * draw to the screen. The most recent {@link Frame} object is passed to
   * your callback function.
   *
   * ```javascript
   *    Leap.loop( function( frame ) {
   *        // ... your code here
   *    })
   * ```
   */
  loop: function(opts, callback) {
    if (opts && callback === undefined &&  ( ({}).toString.call(opts) === '[object Function]' ) ) {
      callback = opts;
      opts = {};
    }

    if (this.loopController) {
      if (opts){
        this.loopController.setupFrameEvents(opts);
      }
    }else{
      this.loopController = new this.Controller(opts);
    }

    this.loopController.loop(callback);
    return this.loopController;
  },

  /*
   * Convenience method for Leap.Controller.plugin
   */
  plugin: function(name, options){
    this.Controller.plugin(name, options)
  }
}

},{"./circular_buffer":13,"./controller":17,"./finger":19,"./frame":20,"./gesture":21,"./hand":22,"./interaction_box":24,"./pointable":26,"./protocol":27,"./ui":28,"./version.js":31,"events":1,"gl-matrix":11,"underscore":34}],24:[function(require,module,exports){
var glMatrix = require("gl-matrix")
  , vec3 = glMatrix.vec3;

/**
 * Constructs a InteractionBox object.
 *
 * @class InteractionBox
 * @memberof Leap
 * @classdesc
 * The InteractionBox class represents a box-shaped region completely within
 * the field of view of the Leap Motion controller.
 *
 * The interaction box is an axis-aligned rectangular prism and provides
 * normalized coordinates for hands, fingers, and tools within this box.
 * The InteractionBox class can make it easier to map positions in the
 * Leap Motion coordinate system to 2D or 3D coordinate systems used
 * for application drawing.
 *
 * ![Interaction Box](images/Leap_InteractionBox.png)
 *
 * The InteractionBox region is defined by a center and dimensions along the x, y, and z axes.
 */
var InteractionBox = module.exports = function(data) {
  /**
   * Indicates whether this is a valid InteractionBox object.
   *
   * @member valid
   * @type {Boolean}
   * @memberof Leap.InteractionBox.prototype
   */
  this.valid = true;
  /**
   * The center of the InteractionBox in device coordinates (millimeters).
   * This point is equidistant from all sides of the box.
   *
   * @member center
   * @type {number[]}
   * @memberof Leap.InteractionBox.prototype
   */
  this.center = data.center;

  this.size = data.size;
  /**
   * The width of the InteractionBox in millimeters, measured along the x-axis.
   *
   * @member width
   * @type {number}
   * @memberof Leap.InteractionBox.prototype
   */
  this.width = data.size[0];
  /**
   * The height of the InteractionBox in millimeters, measured along the y-axis.
   *
   * @member height
   * @type {number}
   * @memberof Leap.InteractionBox.prototype
   */
  this.height = data.size[1];
  /**
   * The depth of the InteractionBox in millimeters, measured along the z-axis.
   *
   * @member depth
   * @type {number}
   * @memberof Leap.InteractionBox.prototype
   */
  this.depth = data.size[2];
}

/**
 * Converts a position defined by normalized InteractionBox coordinates
 * into device coordinates in millimeters.
 *
 * This function performs the inverse of normalizePoint().
 *
 * @method denormalizePoint
 * @memberof Leap.InteractionBox.prototype
 * @param {number[]} normalizedPosition The input position in InteractionBox coordinates.
 * @returns {number[]} The corresponding denormalized position in device coordinates.
 */
InteractionBox.prototype.denormalizePoint = function(normalizedPosition) {
  return vec3.fromValues(
    (normalizedPosition[0] - 0.5) * this.size[0] + this.center[0],
    (normalizedPosition[1] - 0.5) * this.size[1] + this.center[1],
    (normalizedPosition[2] - 0.5) * this.size[2] + this.center[2]
  );
}

/**
 * Normalizes the coordinates of a point using the interaction box.
 *
 * Coordinates from the Leap Motion frame of reference (millimeters) are
 * converted to a range of [0..1] such that the minimum value of the
 * InteractionBox maps to 0 and the maximum value of the InteractionBox maps to 1.
 *
 * @method normalizePoint
 * @memberof Leap.InteractionBox.prototype
 * @param {number[]} position The input position in device coordinates.
 * @param {Boolean} clamp Whether or not to limit the output value to the range [0,1]
 * when the input position is outside the InteractionBox. Defaults to true.
 * @returns {number[]} The normalized position.
 */
InteractionBox.prototype.normalizePoint = function(position, clamp) {
  var vec = vec3.fromValues(
    ((position[0] - this.center[0]) / this.size[0]) + 0.5,
    ((position[1] - this.center[1]) / this.size[1]) + 0.5,
    ((position[2] - this.center[2]) / this.size[2]) + 0.5
  );

  if (clamp) {
    vec[0] = Math.min(Math.max(vec[0], 0), 1);
    vec[1] = Math.min(Math.max(vec[1], 0), 1);
    vec[2] = Math.min(Math.max(vec[2], 0), 1);
  }
  return vec;
}

/**
 * Writes a brief, human readable description of the InteractionBox object.
 *
 * @method toString
 * @memberof Leap.InteractionBox.prototype
 * @returns {String} A description of the InteractionBox object as a string.
 */
InteractionBox.prototype.toString = function() {
  return "InteractionBox [ width:" + this.width + " | height:" + this.height + " | depth:" + this.depth + " ]";
}

/**
 * An invalid InteractionBox object.
 *
 * You can use this InteractionBox instance in comparisons testing
 * whether a given InteractionBox instance is valid or invalid. (You can also use the
 * InteractionBox.valid property.)
 *
 * @static
 * @type {Leap.InteractionBox}
 * @name Invalid
 * @memberof Leap.InteractionBox
 */
InteractionBox.Invalid = { valid: false };

},{"gl-matrix":11}],25:[function(require,module,exports){
var Pipeline = module.exports = function (controller) {
  this.steps = [];
  this.controller = controller;
}

Pipeline.prototype.addStep = function (step) {
  this.steps.push(step);
}

Pipeline.prototype.run = function (frame) {
  var stepsLength = this.steps.length;
  for (var i = 0; i != stepsLength; i++) {
    if (!frame) break;
    frame = this.steps[i](frame);
  }
  return frame;
}

Pipeline.prototype.removeStep = function(step){
  var index = this.steps.indexOf(step);
  if (index === -1) throw "Step not found in pipeline";
  this.steps.splice(index, 1);
}

/*
 * Wraps a plugin callback method in method which can be run inside the pipeline.
 * This wrapper method loops the callback over objects within the frame as is appropriate,
 * calling the callback for each in turn.
 *
 * @method createStepFunction
 * @memberOf Leap.Controller.prototype
 * @param {Controller} The controller on which the callback is called.
 * @param {String} type What frame object the callback is run for and receives.
 *       Can be one of 'frame', 'finger', 'hand', 'pointable', 'tool'
 * @param {function} callback The method which will be run inside the pipeline loop.  Receives one argument, such as a hand.
 * @private
 */
Pipeline.prototype.addWrappedStep = function (type, callback) {
  var controller = this.controller,
    step = function (frame) {
      var dependencies, i, len;
      dependencies = (type == 'frame') ? [frame] : (frame[type + 's'] || []);

      for (i = 0, len = dependencies.length; i < len; i++) {
        callback.call(controller, dependencies[i]);
      }

      return frame;
    };

  this.addStep(step);
  return step;
};
},{}],26:[function(require,module,exports){
var glMatrix = require("gl-matrix")
  , vec3 = glMatrix.vec3;

/**
 * Constructs a Pointable object.
 *
 * An uninitialized pointable is considered invalid.
 * Get valid Pointable objects from a Frame or a Hand object.
 *
 * @class Pointable
 * @memberof Leap
 * @classdesc
 * The Pointable class reports the physical characteristics of a detected
 * finger or tool.
 *
 * Both fingers and tools are classified as Pointable objects. Use the
 * Pointable.tool property to determine whether a Pointable object represents a
 * tool or finger. The Leap classifies a detected entity as a tool when it is
 * thinner, straighter, and longer than a typical finger.
 *
 * Note that Pointable objects can be invalid, which means that they do not
 * contain valid tracking data and do not correspond to a physical entity.
 * Invalid Pointable objects can be the result of asking for a Pointable object
 * using an ID from an earlier frame when no Pointable objects with that ID
 * exist in the current frame. A Pointable object created from the Pointable
 * constructor is also invalid. Test for validity with the Pointable.valid
 * property.
 */
var Pointable = module.exports = function(data) {
  /**
   * Indicates whether this is a valid Pointable object.
   *
   * @member valid
   * @type {Boolean}
   * @memberof Leap.Pointable.prototype
   */
  this.valid = true;
  /**
   * A unique ID assigned to this Pointable object, whose value remains the
   * same across consecutive frames while the tracked finger or tool remains
   * visible. If tracking is lost (for example, when a finger is occluded by
   * another finger or when it is withdrawn from the Leap field of view), the
   * Leap may assign a new ID when it detects the entity in a future frame.
   *
   * Use the ID value with the pointable() functions defined for the
   * {@link Frame} and {@link Frame.Hand} classes to find this
   * Pointable object in future frames.
   *
   * @member id
   * @type {String}
   * @memberof Leap.Pointable.prototype
   */
  this.id = data.id;
  this.handId = data.handId;
  /**
   * The estimated length of the finger or tool in millimeters.
   *
   * The reported length is the visible length of the finger or tool from the
   * hand to tip. If the length isn't known, then a value of 0 is returned.
   *
   * @member length
   * @type {number}
   * @memberof Leap.Pointable.prototype
   */
  this.length = data.length;
  /**
   * Whether or not the Pointable is believed to be a tool.
   * Tools are generally longer, thinner, and straighter than fingers.
   *
   * If tool is false, then this Pointable must be a finger.
   *
   * @member tool
   * @type {Boolean}
   * @memberof Leap.Pointable.prototype
   */
  this.tool = data.tool;
  /**
   * The estimated width of the tool in millimeters.
   *
   * The reported width is the average width of the visible portion of the
   * tool from the hand to the tip. If the width isn't known,
   * then a value of 0 is returned.
   *
   * Pointable objects representing fingers do not have a width property.
   *
   * @member width
   * @type {number}
   * @memberof Leap.Pointable.prototype
   */
  this.width = data.width;
  /**
   * The direction in which this finger or tool is pointing.
   *
   * The direction is expressed as a unit vector pointing in the same
   * direction as the tip.
   *
   * ![Finger](images/Leap_Finger_Model.png)
   * @member direction
   * @type {number[]}
   * @memberof Leap.Pointable.prototype
   */
  this.direction = data.direction;
  /**
   * The tip position in millimeters from the Leap origin.
   * Stabilized
   *
   * @member stabilizedTipPosition
   * @type {number[]}
   * @memberof Leap.Pointable.prototype
   */
  this.stabilizedTipPosition = data.stabilizedTipPosition;
  /**
   * The tip position in millimeters from the Leap origin.
   *
   * @member tipPosition
   * @type {number[]}
   * @memberof Leap.Pointable.prototype
   */
  this.tipPosition = data.tipPosition;
  /**
   * The rate of change of the tip position in millimeters/second.
   *
   * @member tipVelocity
   * @type {number[]}
   * @memberof Leap.Pointable.prototype
   */
  this.tipVelocity = data.tipVelocity;
  /**
   * The current touch zone of this Pointable object.
   *
   * The Leap Motion software computes the touch zone based on a floating touch
   * plane that adapts to the user's finger movement and hand posture. The Leap
   * Motion software interprets purposeful movements toward this plane as potential touch
   * points. When a Pointable moves close to the adaptive touch plane, it enters the
   * "hovering" zone. When a Pointable reaches or passes through the plane, it enters
   * the "touching" zone.
   *
   * The possible states include:
   *
   * * "none" -- The Pointable is outside the hovering zone.
   * * "hovering" -- The Pointable is close to, but not touching the touch plane.
   * * "touching" -- The Pointable has penetrated the touch plane.
   *
   * The touchDistance value provides a normalized indication of the distance to
   * the touch plane when the Pointable is in the hovering or touching zones.
   *
   * @member touchZone
   * @type {String}
   * @memberof Leap.Pointable.prototype
   */
  this.touchZone = data.touchZone;
  /**
   * A value proportional to the distance between this Pointable object and the
   * adaptive touch plane.
   *
   * ![Touch Distance](images/Leap_Touch_Plane.png)
   *
   * The touch distance is a value in the range [-1, 1]. The value 1.0 indicates the
   * Pointable is at the far edge of the hovering zone. The value 0 indicates the
   * Pointable is just entering the touching zone. A value of -1.0 indicates the
   * Pointable is firmly within the touching zone. Values in between are
   * proportional to the distance from the plane. Thus, the touchDistance of 0.5
   * indicates that the Pointable is halfway into the hovering zone.
   *
   * You can use the touchDistance value to modulate visual feedback given to the
   * user as their fingers close in on a touch target, such as a button.
   *
   * @member touchDistance
   * @type {number}
   * @memberof Leap.Pointable.prototype
   */
  this.touchDistance = data.touchDistance;

  /**
   * How long the pointable has been visible in seconds.
   *
   * @member timeVisible
   * @type {number}
   * @memberof Leap.Pointable.prototype
   */
  this.timeVisible = data.timeVisible;
}

/**
 * A string containing a brief, human readable description of the Pointable
 * object.
 *
 * @method toString
 * @memberof Leap.Pointable.prototype
 * @returns {String} A description of the Pointable object as a string.
 */
Pointable.prototype.toString = function() {
  return "Pointable [ id:" + this.id + " " + this.length + "mmx | width:" + this.width + "mm | direction:" + this.direction + ' ]';
}

/**
 * Returns the hand which the pointable is attached to.
 */
Pointable.prototype.hand = function(){
  return this.frame.hand(this.handId);
}

/**
 * An invalid Pointable object.
 *
 * You can use this Pointable instance in comparisons testing
 * whether a given Pointable instance is valid or invalid. (You can also use the
 * Pointable.valid property.)

 * @static
 * @type {Leap.Pointable}
 * @name Invalid
 * @memberof Leap.Pointable
 */
Pointable.Invalid = { valid: false };

},{"gl-matrix":11}],27:[function(require,module,exports){
var Frame = require('./frame')
  , Hand = require('./hand')
  , Pointable = require('./pointable')
  , Finger = require('./finger')
  , _ = require('underscore')
  , EventEmitter = require('events').EventEmitter;

var Event = function(data) {
  this.type = data.type;
  this.state = data.state;
};

exports.chooseProtocol = function(header) {
  var protocol;
  switch(header.version) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
      protocol = JSONProtocol(header);
      protocol.sendBackground = function(connection, state) {
        connection.send(protocol.encode({background: state}));
      }
      protocol.sendFocused = function(connection, state) {
        connection.send(protocol.encode({focused: state}));
      }
      protocol.sendOptimizeHMD = function(connection, state) {
        connection.send(protocol.encode({optimizeHMD: state}));
      }
      break;
    default:
      throw "unrecognized version";
  }
  return protocol;
}

var JSONProtocol = exports.JSONProtocol = function(header) {

  var protocol = function(frameData) {

    if (frameData.event) {

      return new Event(frameData.event);

    } else {

      protocol.emit('beforeFrameCreated', frameData);

      var frame = new Frame(frameData);

      protocol.emit('afterFrameCreated', frame, frameData);

      return frame;

    }

  };

  protocol.encode = function(message) {
    return JSON.stringify(message);
  };
  protocol.version = header.version;
  protocol.serviceVersion = header.serviceVersion;
  protocol.versionLong = 'Version ' + header.version;
  protocol.type = 'protocol';

  _.extend(protocol, EventEmitter.prototype);

  return protocol;
};



},{"./finger":19,"./frame":20,"./hand":22,"./pointable":26,"events":1,"underscore":34}],28:[function(require,module,exports){
exports.UI = {
  Region: require("./ui/region"),
  Cursor: require("./ui/cursor")
};
},{"./ui/cursor":29,"./ui/region":30}],29:[function(require,module,exports){
var Cursor = module.exports = function() {
  return function(frame) {
    var pointable = frame.pointables.sort(function(a, b) { return a.z - b.z })[0]
    if (pointable && pointable.valid) {
      frame.cursorPosition = pointable.tipPosition
    }
    return frame
  }
}

},{}],30:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter
  , _ = require('underscore')

var Region = module.exports = function(start, end) {
  this.start = new Vector(start)
  this.end = new Vector(end)
  this.enteredFrame = null
}

Region.prototype.hasPointables = function(frame) {
  for (var i = 0; i != frame.pointables.length; i++) {
    var position = frame.pointables[i].tipPosition
    if (position.x >= this.start.x && position.x <= this.end.x && position.y >= this.start.y && position.y <= this.end.y && position.z >= this.start.z && position.z <= this.end.z) {
      return true
    }
  }
  return false
}

Region.prototype.listener = function(opts) {
  var region = this
  if (opts && opts.nearThreshold) this.setupNearRegion(opts.nearThreshold)
  return function(frame) {
    return region.updatePosition(frame)
  }
}

Region.prototype.clipper = function() {
  var region = this
  return function(frame) {
    region.updatePosition(frame)
    return region.enteredFrame ? frame : null
  }
}

Region.prototype.setupNearRegion = function(distance) {
  var nearRegion = this.nearRegion = new Region(
    [this.start.x - distance, this.start.y - distance, this.start.z - distance],
    [this.end.x + distance, this.end.y + distance, this.end.z + distance]
  )
  var region = this
  nearRegion.on("enter", function(frame) {
    region.emit("near", frame)
  })
  nearRegion.on("exit", function(frame) {
    region.emit("far", frame)
  })
  region.on('exit', function(frame) {
    region.emit("near", frame)
  })
}

Region.prototype.updatePosition = function(frame) {
  if (this.nearRegion) this.nearRegion.updatePosition(frame)
  if (this.hasPointables(frame) && this.enteredFrame == null) {
    this.enteredFrame = frame
    this.emit("enter", this.enteredFrame)
  } else if (!this.hasPointables(frame) && this.enteredFrame != null) {
    this.enteredFrame = null
    this.emit("exit", this.enteredFrame)
  }
  return frame
}

Region.prototype.normalize = function(position) {
  return new Vector([
    (position.x - this.start.x) / (this.end.x - this.start.x),
    (position.y - this.start.y) / (this.end.y - this.start.y),
    (position.z - this.start.z) / (this.end.z - this.start.z)
  ])
}

Region.prototype.mapToXY = function(position, width, height) {
  var normalized = this.normalize(position)
  var x = normalized.x, y = normalized.y
  if (x > 1) x = 1
  else if (x < -1) x = -1
  if (y > 1) y = 1
  else if (y < -1) y = -1
  return [
    (x + 1) / 2 * width,
    (1 - y) / 2 * height,
    normalized.z
  ]
}

_.extend(Region.prototype, EventEmitter.prototype)
},{"events":1,"underscore":34}],31:[function(require,module,exports){
// This file is automatically updated from package.json by grunt.
module.exports = {
  full: '0.6.4',
  major: 0,
  minor: 6,
  dot: 4
}
},{}],32:[function(require,module,exports){
module.exports = require ( './lib/b2.min.js' ).b2

},{"./lib/b2.min.js":33}],33:[function(require,module,exports){
var COMPILED=!0,goog=goog||{};goog.global=this;goog.isDef=function(a){return void 0!==a};goog.exportPath_=function(a,b,c){a=a.split(".");c=c||goog.global;a[0]in c||!c.execScript||c.execScript("var "+a[0]);for(var d;a.length&&(d=a.shift());)!a.length&&goog.isDef(b)?c[d]=b:c=c[d]?c[d]:c[d]={}};
goog.define=function(a,b){var c=b;COMPILED||(goog.global.CLOSURE_UNCOMPILED_DEFINES&&Object.prototype.hasOwnProperty.call(goog.global.CLOSURE_UNCOMPILED_DEFINES,a)?c=goog.global.CLOSURE_UNCOMPILED_DEFINES[a]:goog.global.CLOSURE_DEFINES&&Object.prototype.hasOwnProperty.call(goog.global.CLOSURE_DEFINES,a)&&(c=goog.global.CLOSURE_DEFINES[a]));goog.exportPath_(a,c)};goog.DEBUG=!1;goog.LOCALE="en";goog.TRUSTED_SITE=!0;goog.STRICT_MODE_COMPATIBLE=!1;goog.DISALLOW_TEST_ONLY_CODE=COMPILED&&!goog.DEBUG;
goog.ENABLE_CHROME_APP_SAFE_SCRIPT_LOADING=!1;goog.provide=function(a){if(!COMPILED&&goog.isProvided_(a))throw Error('Namespace "'+a+'" already declared.');goog.constructNamespace_(a)};goog.constructNamespace_=function(a,b){if(!COMPILED){delete goog.implicitNamespaces_[a];for(var c=a;(c=c.substring(0,c.lastIndexOf(".")))&&!goog.getObjectByName(c);)goog.implicitNamespaces_[c]=!0}goog.exportPath_(a,b)};goog.VALID_MODULE_RE_=/^[a-zA-Z_$][a-zA-Z0-9._$]*$/;
goog.module=function(a){if(!goog.isString(a)||!a||-1==a.search(goog.VALID_MODULE_RE_))throw Error("Invalid module identifier");if(!goog.isInModuleLoader_())throw Error("Module "+a+" has been loaded incorrectly.");if(goog.moduleLoaderState_.moduleName)throw Error("goog.module may only be called once per module.");goog.moduleLoaderState_.moduleName=a;if(!COMPILED){if(goog.isProvided_(a))throw Error('Namespace "'+a+'" already declared.');delete goog.implicitNamespaces_[a]}};goog.module.get=function(a){return goog.module.getInternal_(a)};
goog.module.getInternal_=function(a){if(!COMPILED)return goog.isProvided_(a)?a in goog.loadedModules_?goog.loadedModules_[a]:goog.getObjectByName(a):null};goog.moduleLoaderState_=null;goog.isInModuleLoader_=function(){return null!=goog.moduleLoaderState_};
goog.module.declareLegacyNamespace=function(){if(!COMPILED&&!goog.isInModuleLoader_())throw Error("goog.module.declareLegacyNamespace must be called from within a goog.module");if(!COMPILED&&!goog.moduleLoaderState_.moduleName)throw Error("goog.module must be called prior to goog.module.declareLegacyNamespace.");goog.moduleLoaderState_.declareLegacyNamespace=!0};
goog.setTestOnly=function(a){if(goog.DISALLOW_TEST_ONLY_CODE)throw a=a||"",Error("Importing test-only code into non-debug environment"+(a?": "+a:"."));};goog.forwardDeclare=function(a){};COMPILED||(goog.isProvided_=function(a){return a in goog.loadedModules_||!goog.implicitNamespaces_[a]&&goog.isDefAndNotNull(goog.getObjectByName(a))},goog.implicitNamespaces_={"goog.module":!0});
goog.getObjectByName=function(a,b){for(var c=a.split("."),d=b||goog.global,e;e=c.shift();)if(goog.isDefAndNotNull(d[e]))d=d[e];else return null;return d};goog.globalize=function(a,b){var c=b||goog.global,d;for(d in a)c[d]=a[d]};goog.addDependency=function(a,b,c,d){if(goog.DEPENDENCIES_ENABLED){var e;a=a.replace(/\\/g,"/");for(var f=goog.dependencies_,g=0;e=b[g];g++)f.nameToPath[e]=a,f.pathIsModule[a]=!!d;for(d=0;b=c[d];d++)a in f.requires||(f.requires[a]={}),f.requires[a][b]=!0}};
goog.ENABLE_DEBUG_LOADER=!0;goog.logToConsole_=function(a){goog.global.console&&goog.global.console.error(a)};
goog.require=function(a){if(!COMPILED){goog.ENABLE_DEBUG_LOADER&&goog.IS_OLD_IE_&&goog.maybeProcessDeferredDep_(a);if(goog.isProvided_(a))return goog.isInModuleLoader_()?goog.module.getInternal_(a):null;if(goog.ENABLE_DEBUG_LOADER){var b=goog.getPathFromDeps_(a);if(b)return goog.included_[b]=!0,goog.writeScripts_(),null}a="goog.require could not find: "+a;goog.logToConsole_(a);throw Error(a);}};goog.basePath="";goog.nullFunction=function(){};
goog.abstractMethod=function(){throw Error("unimplemented abstract method");};goog.addSingletonGetter=function(a){a.getInstance=function(){if(a.instance_)return a.instance_;goog.DEBUG&&(goog.instantiatedSingletons_[goog.instantiatedSingletons_.length]=a);return a.instance_=new a}};goog.instantiatedSingletons_=[];goog.LOAD_MODULE_USING_EVAL=!0;goog.SEAL_MODULE_EXPORTS=goog.DEBUG;goog.loadedModules_={};goog.DEPENDENCIES_ENABLED=!COMPILED&&goog.ENABLE_DEBUG_LOADER;
goog.DEPENDENCIES_ENABLED&&(goog.included_={},goog.dependencies_={pathIsModule:{},nameToPath:{},requires:{},visited:{},written:{},deferred:{}},goog.inHtmlDocument_=function(){var a=goog.global.document;return"undefined"!=typeof a&&"write"in a},goog.findBasePath_=function(){if(goog.isDef(goog.global.CLOSURE_BASE_PATH))goog.basePath=goog.global.CLOSURE_BASE_PATH;else if(goog.inHtmlDocument_())for(var a=goog.global.document.getElementsByTagName("SCRIPT"),b=a.length-1;0<=b;--b){var c=a[b].src,d=c.lastIndexOf("?"),
d=-1==d?c.length:d;if("base.js"==c.substr(d-7,7)){goog.basePath=c.substr(0,d-7);break}}},goog.importScript_=function(a,b){(goog.global.CLOSURE_IMPORT_SCRIPT||goog.writeScriptTag_)(a,b)&&(goog.dependencies_.written[a]=!0)},goog.IS_OLD_IE_=!(goog.global.atob||!goog.global.document||!goog.global.document.all),goog.importModule_=function(a){goog.importScript_("",'goog.retrieveAndExecModule_("'+a+'");')&&(goog.dependencies_.written[a]=!0)},goog.queuedModules_=[],goog.wrapModule_=function(a,b){return goog.LOAD_MODULE_USING_EVAL&&
goog.isDef(goog.global.JSON)?"goog.loadModule("+goog.global.JSON.stringify(b+"\n//# sourceURL="+a+"\n")+");":'goog.loadModule(function(exports) {"use strict";'+b+"\n;return exports});\n//# sourceURL="+a+"\n"},goog.loadQueuedModules_=function(){var a=goog.queuedModules_.length;if(0<a){var b=goog.queuedModules_;goog.queuedModules_=[];for(var c=0;c<a;c++)goog.maybeProcessDeferredPath_(b[c])}},goog.maybeProcessDeferredDep_=function(a){goog.isDeferredModule_(a)&&goog.allDepsAreAvailable_(a)&&(a=goog.getPathFromDeps_(a),
goog.maybeProcessDeferredPath_(goog.basePath+a))},goog.isDeferredModule_=function(a){return(a=goog.getPathFromDeps_(a))&&goog.dependencies_.pathIsModule[a]?goog.basePath+a in goog.dependencies_.deferred:!1},goog.allDepsAreAvailable_=function(a){if((a=goog.getPathFromDeps_(a))&&a in goog.dependencies_.requires)for(var b in goog.dependencies_.requires[a])if(!goog.isProvided_(b)&&!goog.isDeferredModule_(b))return!1;return!0},goog.maybeProcessDeferredPath_=function(a){if(a in goog.dependencies_.deferred){var b=
goog.dependencies_.deferred[a];delete goog.dependencies_.deferred[a];goog.globalEval(b)}},goog.loadModule=function(a){var b=goog.moduleLoaderState_;try{goog.moduleLoaderState_={moduleName:void 0};var c;if(goog.isFunction(a))c=a.call(goog.global,{});else if(goog.isString(a))c=goog.loadModuleFromSource_.call(goog.global,a);else throw Error("Invalid module definition");var d=goog.moduleLoaderState_.moduleName;if(!goog.isString(d)||!d)throw Error('Invalid module name "'+d+'"');goog.moduleLoaderState_.declareLegacyNamespace?
goog.constructNamespace_(d,c):goog.SEAL_MODULE_EXPORTS&&Object.seal&&Object.seal(c);goog.loadedModules_[d]=c}finally{goog.moduleLoaderState_=b}},goog.loadModuleFromSource_=function(a){eval(a);return{}},goog.writeScriptSrcNode_=function(a){goog.global.document.write('<script type="text/javascript" src="'+a+'">\x3c/script>')},goog.appendScriptSrcNode_=function(a){var b=goog.global.document,c=b.createElement("script");c.type="text/javascript";c.src=a;c.defer=!1;c.async=!1;b.head.appendChild(c)},goog.writeScriptTag_=
function(a,b){if(goog.inHtmlDocument_()){var c=goog.global.document;if(!goog.ENABLE_CHROME_APP_SAFE_SCRIPT_LOADING&&"complete"==c.readyState){if(/\bdeps.js$/.test(a))return!1;throw Error('Cannot write "'+a+'" after document load');}var d=goog.IS_OLD_IE_;void 0===b?d?(d=" onreadystatechange='goog.onScriptLoad_(this, "+ ++goog.lastNonModuleScriptIndex_+")' ",c.write('<script type="text/javascript" src="'+a+'"'+d+">\x3c/script>")):goog.ENABLE_CHROME_APP_SAFE_SCRIPT_LOADING?goog.appendScriptSrcNode_(a):
goog.writeScriptSrcNode_(a):c.write('<script type="text/javascript">'+b+"\x3c/script>");return!0}return!1},goog.lastNonModuleScriptIndex_=0,goog.onScriptLoad_=function(a,b){"complete"==a.readyState&&goog.lastNonModuleScriptIndex_==b&&goog.loadQueuedModules_();return!0},goog.writeScripts_=function(){function a(e){if(!(e in d.written)){if(!(e in d.visited)&&(d.visited[e]=!0,e in d.requires))for(var f in d.requires[e])if(!goog.isProvided_(f))if(f in d.nameToPath)a(d.nameToPath[f]);else throw Error("Undefined nameToPath for "+
f);e in c||(c[e]=!0,b.push(e))}}var b=[],c={},d=goog.dependencies_,e;for(e in goog.included_)d.written[e]||a(e);for(var f=0;f<b.length;f++)e=b[f],goog.dependencies_.written[e]=!0;var g=goog.moduleLoaderState_;goog.moduleLoaderState_=null;for(f=0;f<b.length;f++)if(e=b[f])d.pathIsModule[e]?goog.importModule_(goog.basePath+e):goog.importScript_(goog.basePath+e);else throw goog.moduleLoaderState_=g,Error("Undefined script input");goog.moduleLoaderState_=g},goog.getPathFromDeps_=function(a){return a in
goog.dependencies_.nameToPath?goog.dependencies_.nameToPath[a]:null},goog.findBasePath_(),goog.global.CLOSURE_NO_DEPS||goog.importScript_(goog.basePath+"deps.js"));goog.normalizePath_=function(a){a=a.split("/");for(var b=0;b<a.length;)"."==a[b]?a.splice(b,1):b&&".."==a[b]&&a[b-1]&&".."!=a[b-1]?a.splice(--b,2):b++;return a.join("/")};
goog.loadFileSync_=function(a){if(goog.global.CLOSURE_LOAD_FILE_SYNC)return goog.global.CLOSURE_LOAD_FILE_SYNC(a);var b=new goog.global.XMLHttpRequest;b.open("get",a,!1);b.send();return b.responseText};
goog.retrieveAndExecModule_=function(a){if(!COMPILED){var b=a;a=goog.normalizePath_(a);var c=goog.global.CLOSURE_IMPORT_SCRIPT||goog.writeScriptTag_,d=goog.loadFileSync_(a);if(null!=d)d=goog.wrapModule_(a,d),goog.IS_OLD_IE_?(goog.dependencies_.deferred[b]=d,goog.queuedModules_.push(b)):c(a,d);else throw Error("load of "+a+"failed");}};
goog.typeOf=function(a){var b=typeof a;if("object"==b)if(a){if(a instanceof Array)return"array";if(a instanceof Object)return b;var c=Object.prototype.toString.call(a);if("[object Window]"==c)return"object";if("[object Array]"==c||"number"==typeof a.length&&"undefined"!=typeof a.splice&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("splice"))return"array";if("[object Function]"==c||"undefined"!=typeof a.call&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("call"))return"function"}else return"null";
else if("function"==b&&"undefined"==typeof a.call)return"object";return b};goog.isNull=function(a){return null===a};goog.isDefAndNotNull=function(a){return null!=a};goog.isArray=function(a){return"array"==goog.typeOf(a)};goog.isArrayLike=function(a){var b=goog.typeOf(a);return"array"==b||"object"==b&&"number"==typeof a.length};goog.isDateLike=function(a){return goog.isObject(a)&&"function"==typeof a.getFullYear};goog.isString=function(a){return"string"==typeof a};
goog.isBoolean=function(a){return"boolean"==typeof a};goog.isNumber=function(a){return"number"==typeof a};goog.isFunction=function(a){return"function"==goog.typeOf(a)};goog.isObject=function(a){var b=typeof a;return"object"==b&&null!=a||"function"==b};goog.getUid=function(a){return a[goog.UID_PROPERTY_]||(a[goog.UID_PROPERTY_]=++goog.uidCounter_)};goog.hasUid=function(a){return!!a[goog.UID_PROPERTY_]};goog.removeUid=function(a){"removeAttribute"in a&&a.removeAttribute(goog.UID_PROPERTY_);try{delete a[goog.UID_PROPERTY_]}catch(b){}};
goog.UID_PROPERTY_="closure_uid_"+(1E9*Math.random()>>>0);goog.uidCounter_=0;goog.getHashCode=goog.getUid;goog.removeHashCode=goog.removeUid;goog.cloneObject=function(a){var b=goog.typeOf(a);if("object"==b||"array"==b){if(a.clone)return a.clone();var b="array"==b?[]:{},c;for(c in a)b[c]=goog.cloneObject(a[c]);return b}return a};goog.bindNative_=function(a,b,c){return a.call.apply(a.bind,arguments)};
goog.bindJs_=function(a,b,c){if(!a)throw Error();if(2<arguments.length){var d=Array.prototype.slice.call(arguments,2);return function(){var c=Array.prototype.slice.call(arguments);Array.prototype.unshift.apply(c,d);return a.apply(b,c)}}return function(){return a.apply(b,arguments)}};goog.bind=function(a,b,c){Function.prototype.bind&&-1!=Function.prototype.bind.toString().indexOf("native code")?goog.bind=goog.bindNative_:goog.bind=goog.bindJs_;return goog.bind.apply(null,arguments)};
goog.partial=function(a,b){var c=Array.prototype.slice.call(arguments,1);return function(){var b=c.slice();b.push.apply(b,arguments);return a.apply(this,b)}};goog.mixin=function(a,b){for(var c in b)a[c]=b[c]};goog.now=goog.TRUSTED_SITE&&Date.now||function(){return+new Date};
goog.globalEval=function(a){if(goog.global.execScript)goog.global.execScript(a,"JavaScript");else if(goog.global.eval){if(null==goog.evalWorksForGlobals_)if(goog.global.eval("var _evalTest_ = 1;"),"undefined"!=typeof goog.global._evalTest_){try{delete goog.global._evalTest_}catch(b){}goog.evalWorksForGlobals_=!0}else goog.evalWorksForGlobals_=!1;if(goog.evalWorksForGlobals_)goog.global.eval(a);else{var c=goog.global.document,d=c.createElement("SCRIPT");d.type="text/javascript";d.defer=!1;d.appendChild(c.createTextNode(a));
c.body.appendChild(d);c.body.removeChild(d)}}else throw Error("goog.globalEval not available");};goog.evalWorksForGlobals_=null;goog.getCssName=function(a,b){var c=function(a){return goog.cssNameMapping_[a]||a},d=function(a){a=a.split("-");for(var b=[],d=0;d<a.length;d++)b.push(c(a[d]));return b.join("-")},d=goog.cssNameMapping_?"BY_WHOLE"==goog.cssNameMappingStyle_?c:d:function(a){return a};return b?a+"-"+d(b):d(a)};
goog.setCssNameMapping=function(a,b){goog.cssNameMapping_=a;goog.cssNameMappingStyle_=b};!COMPILED&&goog.global.CLOSURE_CSS_NAME_MAPPING&&(goog.cssNameMapping_=goog.global.CLOSURE_CSS_NAME_MAPPING);goog.getMsg=function(a,b){b&&(a=a.replace(/\{\$([^}]+)}/g,function(a,d){return d in b?b[d]:a}));return a};goog.getMsgWithFallback=function(a,b){return a};goog.exportSymbol=function(a,b,c){goog.exportPath_(a,b,c)};goog.exportProperty=function(a,b,c){a[b]=c};
goog.inherits=function(a,b){function c(){}c.prototype=b.prototype;a.superClass_=b.prototype;a.prototype=new c;a.prototype.constructor=a;a.base=function(a,c,f){for(var g=Array(arguments.length-2),h=2;h<arguments.length;h++)g[h-2]=arguments[h];return b.prototype[c].apply(a,g)}};
goog.base=function(a,b,c){var d=arguments.callee.caller;if(goog.STRICT_MODE_COMPATIBLE||goog.DEBUG&&!d)throw Error("arguments.caller not defined.  goog.base() cannot be used with strict mode code. See http://www.ecma-international.org/ecma-262/5.1/#sec-C");if(d.superClass_){for(var e=Array(arguments.length-1),f=1;f<arguments.length;f++)e[f-1]=arguments[f];return d.superClass_.constructor.apply(a,e)}e=Array(arguments.length-2);for(f=2;f<arguments.length;f++)e[f-2]=arguments[f];for(var f=!1,g=a.constructor;g;g=
g.superClass_&&g.superClass_.constructor)if(g.prototype[b]===d)f=!0;else if(f)return g.prototype[b].apply(a,e);if(a[b]===d)return a.constructor.prototype[b].apply(a,e);throw Error("goog.base called from a method of one name to a method of a different name");};goog.scope=function(a){a.call(goog.global)};COMPILED||(goog.global.COMPILED=COMPILED);
goog.defineClass=function(a,b){var c=b.constructor,d=b.statics;c&&c!=Object.prototype.constructor||(c=function(){throw Error("cannot instantiate an interface (no constructor defined).");});c=goog.defineClass.createSealingConstructor_(c,a);a&&goog.inherits(c,a);delete b.constructor;delete b.statics;goog.defineClass.applyProperties_(c.prototype,b);null!=d&&(d instanceof Function?d(c):goog.defineClass.applyProperties_(c,d));return c};goog.defineClass.SEAL_CLASS_INSTANCES=goog.DEBUG;
goog.defineClass.createSealingConstructor_=function(a,b){if(goog.defineClass.SEAL_CLASS_INSTANCES&&Object.seal instanceof Function){if(b&&b.prototype&&b.prototype[goog.UNSEALABLE_CONSTRUCTOR_PROPERTY_])return a;var c=function(){var b=a.apply(this,arguments)||this;b[goog.UID_PROPERTY_]=b[goog.UID_PROPERTY_];this.constructor===c&&Object.seal(b);return b};return c}return a};goog.defineClass.OBJECT_PROTOTYPE_FIELDS_="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");
goog.defineClass.applyProperties_=function(a,b){for(var c in b)Object.prototype.hasOwnProperty.call(b,c)&&(a[c]=b[c]);for(var d=0;d<goog.defineClass.OBJECT_PROTOTYPE_FIELDS_.length;d++)c=goog.defineClass.OBJECT_PROTOTYPE_FIELDS_[d],Object.prototype.hasOwnProperty.call(b,c)&&(a[c]=b[c])};goog.tagUnsealableClass=function(a){!COMPILED&&goog.defineClass.SEAL_CLASS_INSTANCES&&(a.prototype[goog.UNSEALABLE_CONSTRUCTOR_PROPERTY_]=!0)};goog.UNSEALABLE_CONSTRUCTOR_PROPERTY_="goog_defineClass_legacy_unsealable";var b2={b2Settings:{}};Object.defineProperty||(Object.defineProperty=function(a,b,c){Object.__defineGetter__&&("get"in c?a.__defineGetter__(b,c.get):"value"in c&&a.__defineGetter__(b,c.value));Object.__defineSetter__&&("set"in c?a.__defineSetter__(b,c.set):"value"in c&&a.__defineSetter__(b,c.value))});b2.DEBUG=!0;goog.exportSymbol("b2.DEBUG",b2.DEBUG);b2.ENABLE_ASSERTS=b2.DEBUG;goog.exportSymbol("b2.ENABLE_ASSERTS",b2.ENABLE_ASSERTS);
b2.Assert=function(a,b,c){if(b2.DEBUG&&!a)debugger};goog.exportSymbol("b2.Assert",b2.Assert);b2._maxFloat=1E37;goog.exportSymbol("b2._maxFloat",b2._maxFloat);b2._epsilon=1E-5;goog.exportSymbol("b2._epsilon",b2._epsilon);b2._epsilon_sq=b2._epsilon*b2._epsilon;goog.exportSymbol("b2._epsilon_sq",b2._epsilon_sq);b2._pi=Math.PI;goog.exportSymbol("b2._pi",b2._pi);b2._maxManifoldPoints=2;
goog.exportSymbol("b2._maxManifoldPoints",b2._maxManifoldPoints);b2._maxPolygonVertices=8;goog.exportSymbol("b2._maxPolygonVertices",b2._maxPolygonVertices);b2._aabbExtension=.1;goog.exportSymbol("b2._aabbExtension",b2._aabbExtension);b2._aabbMultiplier=2;goog.exportSymbol("b2._aabbMultiplier",b2._aabbMultiplier);b2._linearSlop=.008;goog.exportSymbol("b2._linearSlop",b2._linearSlop);b2._angularSlop=2/180*b2._pi;
goog.exportSymbol("b2._angularSlop",b2._angularSlop);b2._polygonRadius=2*b2._linearSlop;goog.exportSymbol("b2._polygonRadius",b2._polygonRadius);b2._maxSubSteps=8;goog.exportSymbol("b2._maxSubSteps",b2._maxSubSteps);b2._maxTOIContacts=32;goog.exportSymbol("b2._maxTOIContacts",b2._maxTOIContacts);b2._velocityThreshold=1;goog.exportSymbol("b2._velocityThreshold",b2._velocityThreshold);b2._maxLinearCorrection=.2;
goog.exportSymbol("b2._maxLinearCorrection",b2._maxLinearCorrection);b2._maxAngularCorrection=8/180*b2._pi;goog.exportSymbol("b2._maxAngularCorrection",b2._maxAngularCorrection);b2._maxTranslation=2;goog.exportSymbol("b2._maxTranslation",b2._maxTranslation);b2._maxTranslationSquared=b2._maxTranslation*b2._maxTranslation;goog.exportSymbol("b2._maxTranslationSquared",b2._maxTranslationSquared);b2._maxRotation=.5*b2._pi;
goog.exportSymbol("b2._maxRotation",b2._maxRotation);b2._maxRotationSquared=b2._maxRotation*b2._maxRotation;goog.exportSymbol("b2._maxRotationSquared",b2._maxRotationSquared);b2._baumgarte=.2;goog.exportSymbol("b2._baumgarte",b2._baumgarte);b2._toiBaumgarte=.75;goog.exportSymbol("b2._toiBaumgarte",b2._toiBaumgarte);b2._invalidParticleIndex=-1;goog.exportSymbol("b2._invalidParticleIndex",b2._invalidParticleIndex);
b2._maxParticleIndex=2147483647;goog.exportSymbol("b2._maxParticleIndex",b2._maxParticleIndex);b2._particleStride=.75;goog.exportSymbol("b2._particleStride",b2._particleStride);b2._minParticleWeight=1;goog.exportSymbol("b2._minParticleWeight",b2._minParticleWeight);b2._maxParticlePressure=.25;goog.exportSymbol("b2._maxParticlePressure",b2._maxParticlePressure);b2._maxParticleForce=.5;goog.exportSymbol("b2._maxParticleForce",b2._maxParticleForce);
b2._maxTriadDistance=2;goog.exportSymbol("b2._maxTriadDistance",b2._maxTriadDistance);b2._maxTriadDistanceSquared=b2._maxTriadDistance*b2._maxTriadDistance;goog.exportSymbol("b2._maxTriadDistanceSquared",b2._maxTriadDistanceSquared);b2._minParticleSystemBufferCapacity=256;goog.exportSymbol("b2._minParticleSystemBufferCapacity",b2._minParticleSystemBufferCapacity);b2._barrierCollisionTime=2.5;
goog.exportSymbol("b2._barrierCollisionTime",b2._barrierCollisionTime);b2._timeToSleep=.5;goog.exportSymbol("b2._timeToSleep",b2._timeToSleep);b2._linearSleepTolerance=.01;goog.exportSymbol("b2._linearSleepTolerance",b2._linearSleepTolerance);b2._angularSleepTolerance=2/180*b2._pi;goog.exportSymbol("b2._angularSleepTolerance",b2._angularSleepTolerance);b2.Alloc=function(a){return null};goog.exportSymbol("b2.Alloc",b2.Alloc);
b2.Free=function(a){};goog.exportSymbol("b2.Free",b2.Free);b2.Log=function(a){goog.global.console.log.apply(null,arguments)};goog.exportSymbol("b2.Log",b2.Log);b2.Version=function(a,b,c){this.major=a||0;this.minor=b||0;this.revision=c||0};goog.exportSymbol("b2.Version",b2.Version);b2.Version.prototype.major=0;goog.exportProperty(b2.Version.prototype,"major",b2.Version.prototype.major);b2.Version.prototype.minor=0;
goog.exportProperty(b2.Version.prototype,"minor",b2.Version.prototype.minor);b2.Version.prototype.revision=0;goog.exportProperty(b2.Version.prototype,"revision",b2.Version.prototype.revision);b2.Version.prototype.toString=function(){return this.major+"."+this.minor+"."+this.revision};goog.exportProperty(b2.Version.prototype,"toString",b2.Version.prototype.toString);b2._version=new b2.Version(2,3,2);goog.exportSymbol("b2._version",b2._version);
b2._changelist=313;goog.exportSymbol("b2._changelist",b2._changelist);b2.ParseInt=function(a){return parseInt(a,10)};goog.exportSymbol("b2.ParseInt",b2.ParseInt);b2.ParseUInt=function(a){return b2.Abs(parseInt(a,10))};goog.exportSymbol("b2.ParseUInt",b2.ParseUInt);b2.MakeArray=function(a,b){a="number"===typeof a?a:0;var c=[];if("function"===typeof b)for(var d=0;d<a;++d)c.push(b(d));else for(d=0;d<a;++d)c.push(null);return c};
goog.exportSymbol("b2.MakeArray",b2.MakeArray);b2.MakeNumberArray=function(a){return b2.MakeArray(a,function(a){return 0})};goog.exportSymbol("b2.MakeNumberArray",b2.MakeNumberArray);b2.Color=function(a,b,c,d){this.r=a;this.g=b;this.b=c;this.a="number"===typeof d?d:1};goog.exportSymbol("b2.Color",b2.Color);b2.Color.prototype.r=.5;goog.exportProperty(b2.Color.prototype,"r",b2.Color.prototype.r);b2.Color.prototype.g=.5;goog.exportProperty(b2.Color.prototype,"g",b2.Color.prototype.g);b2.Color.prototype.b=.5;goog.exportProperty(b2.Color.prototype,"b",b2.Color.prototype.b);b2.Color.prototype.a=1;
goog.exportProperty(b2.Color.prototype,"a",b2.Color.prototype.a);b2.Color.prototype.SetRGB=function(a,b,c){this.r=a;this.g=b;this.b=c;return this};goog.exportProperty(b2.Color.prototype,"SetRGB",b2.Color.prototype.SetRGB);
b2.Color.prototype.MakeStyleString=function(a){var b=Math.round(Math.max(0,Math.min(255,255*this.r))),c=Math.round(Math.max(0,Math.min(255,255*this.g))),d=Math.round(Math.max(0,Math.min(255,255*this.b)));a="undefined"===typeof a?this.a:Math.max(0,Math.min(1,a));return b2.Color.MakeStyleString(b,c,d,a)};goog.exportProperty(b2.Color.prototype,"MakeStyleString",b2.Color.prototype.MakeStyleString);
b2.Color.MakeStyleString=function(a,b,c,d){return 1>d?"rgba("+a+","+b+","+c+","+d+")":"rgb("+a+","+b+","+c+")"};goog.exportProperty(b2.Color,"MakeStyleString",b2.Color.MakeStyleString);b2.Color.RED=new b2.Color(1,0,0);goog.exportProperty(b2.Color,"RED",b2.Color.RED);b2.Color.GREEN=new b2.Color(0,1,0);goog.exportProperty(b2.Color,"GREEN",b2.Color.GREEN);b2.Color.BLUE=new b2.Color(0,0,1);goog.exportProperty(b2.Color,"BLUE",b2.Color.BLUE);
b2.DrawFlags={e_none:0,e_shapeBit:1,e_jointBit:2,e_aabbBit:4,e_pairBit:8,e_centerOfMassBit:16,e_controllerBit:32,e_particleBit:64,e_all:65535};goog.exportSymbol("b2.DrawFlags",b2.DrawFlags);goog.exportProperty(b2.DrawFlags,"e_none",b2.DrawFlags.e_none);goog.exportProperty(b2.DrawFlags,"e_shapeBit",b2.DrawFlags.e_shapeBit);goog.exportProperty(b2.DrawFlags,"e_jointBit",b2.DrawFlags.e_jointBit);goog.exportProperty(b2.DrawFlags,"e_aabbBit",b2.DrawFlags.e_aabbBit);
goog.exportProperty(b2.DrawFlags,"e_pairBit",b2.DrawFlags.e_pairBit);goog.exportProperty(b2.DrawFlags,"e_centerOfMassBit",b2.DrawFlags.e_centerOfMassBit);goog.exportProperty(b2.DrawFlags,"e_controllerBit",b2.DrawFlags.e_controllerBit);goog.exportProperty(b2.DrawFlags,"e_particleBit",b2.DrawFlags.e_particleBit);goog.exportProperty(b2.DrawFlags,"e_all",b2.DrawFlags.e_all);b2.Draw=function(){};goog.exportSymbol("b2.Draw",b2.Draw);
b2.Draw.prototype.m_drawFlags=b2.DrawFlags.e_none;goog.exportProperty(b2.Draw.prototype,"m_drawFlags",b2.Draw.prototype.m_drawFlags);b2.Draw.prototype.SetFlags=function(a){this.m_drawFlags=a};goog.exportProperty(b2.Draw.prototype,"SetFlags",b2.Draw.prototype.SetFlags);b2.Draw.prototype.GetFlags=function(){return this.m_drawFlags};goog.exportProperty(b2.Draw.prototype,"GetFlags",b2.Draw.prototype.GetFlags);
b2.Draw.prototype.AppendFlags=function(a){this.m_drawFlags|=a};goog.exportProperty(b2.Draw.prototype,"AppendFlags",b2.Draw.prototype.AppendFlags);b2.Draw.prototype.ClearFlags=function(a){this.m_drawFlags&=~a};goog.exportProperty(b2.Draw.prototype,"ClearFlags",b2.Draw.prototype.ClearFlags);b2.Draw.prototype.PushTransform=function(a){};goog.exportProperty(b2.Draw.prototype,"PushTransform",b2.Draw.prototype.PushTransform);
b2.Draw.prototype.PopTransform=function(a){};goog.exportProperty(b2.Draw.prototype,"PopTransform",b2.Draw.prototype.PopTransform);b2.Draw.prototype.DrawPolygon=function(a,b,c){};goog.exportProperty(b2.Draw.prototype,"DrawPolygon",b2.Draw.prototype.DrawPolygon);b2.Draw.prototype.DrawSolidPolygon=function(a,b,c){};goog.exportProperty(b2.Draw.prototype,"DrawSolidPolygon",b2.Draw.prototype.DrawSolidPolygon);b2.Draw.prototype.DrawCircle=function(a,b,c){};
goog.exportProperty(b2.Draw.prototype,"DrawCircle",b2.Draw.prototype.DrawCircle);b2.Draw.prototype.DrawSolidCircle=function(a,b,c,d){};goog.exportProperty(b2.Draw.prototype,"DrawSolidCircle",b2.Draw.prototype.DrawSolidCircle);b2.Draw.prototype.DrawParticles=function(a,b,c,d){};goog.exportProperty(b2.Draw.prototype,"DrawParticles",b2.Draw.prototype.DrawParticles);b2.Draw.prototype.DrawSegment=function(a,b,c){};
goog.exportProperty(b2.Draw.prototype,"DrawSegment",b2.Draw.prototype.DrawSegment);b2.Draw.prototype.DrawTransform=function(a){};goog.exportProperty(b2.Draw.prototype,"DrawTransform",b2.Draw.prototype.DrawTransform);b2.GrowableStack=function(a){this.m_stack=Array(a)};goog.exportSymbol("b2.GrowableStack",b2.GrowableStack);b2.GrowableStack.prototype.m_stack=null;goog.exportProperty(b2.GrowableStack.prototype,"m_stack",b2.GrowableStack.prototype.m_stack);b2.GrowableStack.prototype.m_count=0;goog.exportProperty(b2.GrowableStack.prototype,"m_count",b2.GrowableStack.prototype.m_count);b2.GrowableStack.prototype.Reset=function(){this.m_count=0;return this};
goog.exportProperty(b2.GrowableStack.prototype,"Reset",b2.GrowableStack.prototype.Reset);b2.GrowableStack.prototype.Push=function(a){this.m_stack[this.m_count]=a;++this.m_count};goog.exportProperty(b2.GrowableStack.prototype,"Push",b2.GrowableStack.prototype.Push);b2.GrowableStack.prototype.Pop=function(){b2.ENABLE_ASSERTS&&b2.Assert(0<this.m_count);--this.m_count;var a=this.m_stack[this.m_count];this.m_stack[this.m_count]=null;return a};
goog.exportProperty(b2.GrowableStack.prototype,"Pop",b2.GrowableStack.prototype.Pop);b2.GrowableStack.prototype.GetCount=function(){return this.m_count};goog.exportProperty(b2.GrowableStack.prototype,"GetCount",b2.GrowableStack.prototype.GetCount);b2.Math={};b2._pi_over_180=b2._pi/180;goog.exportSymbol("b2._pi_over_180",b2._pi_over_180);b2._180_over_pi=180/b2._pi;goog.exportSymbol("b2._180_over_pi",b2._180_over_pi);b2._two_pi=2*b2._pi;goog.exportSymbol("b2._two_pi",b2._two_pi);b2.Abs=Math.abs;goog.exportSymbol("b2.Abs",b2.Abs);b2.Min=Math.min;goog.exportSymbol("b2.Min",b2.Min);b2.Max=Math.max;goog.exportSymbol("b2.Max",b2.Max);
b2.Clamp=function(a,b,c){return Math.min(Math.max(a,b),c)};goog.exportSymbol("b2.Clamp",b2.Clamp);b2.Wrap=function(a,b,c){return b<c?a<b?c-(b-a)%(c-b):b+(a-b)%(c-b):b===c?b:a};goog.exportSymbol("b2.Wrap",b2.Wrap);b2.WrapAngle=function(a){return 0>a?(a-b2._pi)%b2._two_pi+b2._pi:(a+b2._pi)%b2._two_pi-b2._pi};goog.exportSymbol("b2.WrapAngle",b2.WrapAngle);
b2.Swap=function(a,b){b2.ENABLE_ASSERTS&&b2.Assert(!1);var c=a[0];a[0]=b[0];b[0]=c};goog.exportSymbol("b2.Swap",b2.Swap);b2.IsValid=function(a){return isFinite(a)};goog.exportSymbol("b2.IsValid",b2.IsValid);b2.Sq=function(a){return a*a};goog.exportSymbol("b2.Sq",b2.Sq);b2.InvSqrt=function(a){return 1/Math.sqrt(a)};goog.exportSymbol("b2.InvSqrt",b2.InvSqrt);b2.Sqrt=function(a){return Math.sqrt(a)};
goog.exportSymbol("b2.Sqrt",b2.Sqrt);b2.Pow=function(a,b){return Math.pow(a,b)};goog.exportSymbol("b2.Pow",b2.Pow);b2.DegToRad=function(a){return a*b2._pi_over_180};goog.exportSymbol("b2.DegToRad",b2.DegToRad);b2.RadToDeg=function(a){return a*b2._180_over_pi};goog.exportSymbol("b2.RadToDeg",b2.RadToDeg);b2.Cos=function(a){return Math.cos(a)};goog.exportSymbol("b2.Cos",b2.Cos);b2.Sin=function(a){return Math.sin(a)};
goog.exportSymbol("b2.Sin",b2.Sin);b2.Acos=function(a){return Math.acos(a)};goog.exportSymbol("b2.Acos",b2.Acos);b2.Asin=function(a){return Math.asin(a)};goog.exportSymbol("b2.Asin",b2.Asin);b2.Atan2=function(a,b){return Math.atan2(a,b)};goog.exportSymbol("b2.Atan2",b2.Atan2);b2.NextPowerOfTwo=function(a){a|=a>>1&2147483647;a|=a>>2&1073741823;a|=a>>4&268435455;a|=a>>8&16777215;return(a|a>>16&65535)+1};
goog.exportSymbol("b2.NextPowerOfTwo",b2.NextPowerOfTwo);b2.IsPowerOfTwo=function(a){return 0<a&&0===(a&a-1)};goog.exportSymbol("b2.IsPowerOfTwo",b2.IsPowerOfTwo);b2.Random=function(){return 2*Math.random()-1};goog.exportSymbol("b2.Random",b2.Random);b2.RandomRange=function(a,b){return(b-a)*Math.random()+a};goog.exportSymbol("b2.RandomRange",b2.RandomRange);b2.Vec2=function(a,b){this.x=a||0;this.y=b||0};goog.exportSymbol("b2.Vec2",b2.Vec2);
b2.Vec2.prototype.x=0;goog.exportProperty(b2.Vec2.prototype,"x",b2.Vec2.prototype.x);b2.Vec2.prototype.y=0;goog.exportProperty(b2.Vec2.prototype,"y",b2.Vec2.prototype.y);b2.Vec2_zero=new b2.Vec2;goog.exportSymbol("b2.Vec2_zero",b2.Vec2_zero);b2.Vec2.ZERO=new b2.Vec2;goog.exportProperty(b2.Vec2,"ZERO",b2.Vec2.ZERO);b2.Vec2.UNITX=new b2.Vec2(1,0);goog.exportProperty(b2.Vec2,"UNITX",b2.Vec2.UNITX);
b2.Vec2.UNITY=new b2.Vec2(0,1);goog.exportProperty(b2.Vec2,"UNITY",b2.Vec2.UNITY);b2.Vec2.s_t0=new b2.Vec2;goog.exportProperty(b2.Vec2,"s_t0",b2.Vec2.s_t0);b2.Vec2.s_t1=new b2.Vec2;goog.exportProperty(b2.Vec2,"s_t1",b2.Vec2.s_t1);b2.Vec2.s_t2=new b2.Vec2;goog.exportProperty(b2.Vec2,"s_t2",b2.Vec2.s_t2);b2.Vec2.s_t3=new b2.Vec2;goog.exportProperty(b2.Vec2,"s_t3",b2.Vec2.s_t3);
b2.Vec2.MakeArray=function(a){return b2.MakeArray(a,function(a){return new b2.Vec2})};goog.exportProperty(b2.Vec2,"MakeArray",b2.Vec2.MakeArray);b2.Vec2.prototype.Clone=function(){return new b2.Vec2(this.x,this.y)};goog.exportProperty(b2.Vec2.prototype,"Clone",b2.Vec2.prototype.Clone);b2.Vec2.prototype.SetZero=function(){this.y=this.x=0;return this};goog.exportProperty(b2.Vec2.prototype,"SetZero",b2.Vec2.prototype.SetZero);
b2.Vec2.prototype.Set=function(a,b){this.x=a;this.y=b;return this};goog.exportProperty(b2.Vec2.prototype,"Set",b2.Vec2.prototype.Set);b2.Vec2.prototype.Copy=function(a){this.x=a.x;this.y=a.y;return this};goog.exportProperty(b2.Vec2.prototype,"Copy",b2.Vec2.prototype.Copy);b2.Vec2.prototype.SelfAdd=function(a){this.x+=a.x;this.y+=a.y;return this};goog.exportProperty(b2.Vec2.prototype,"SelfAdd",b2.Vec2.prototype.SelfAdd);
b2.Vec2.prototype.SelfAddXY=function(a,b){this.x+=a;this.y+=b;return this};goog.exportProperty(b2.Vec2.prototype,"SelfAddXY",b2.Vec2.prototype.SelfAddXY);b2.Vec2.prototype.SelfSub=function(a){this.x-=a.x;this.y-=a.y;return this};goog.exportProperty(b2.Vec2.prototype,"SelfSub",b2.Vec2.prototype.SelfSub);b2.Vec2.prototype.SelfSubXY=function(a,b){this.x-=a;this.y-=b;return this};goog.exportProperty(b2.Vec2.prototype,"SelfSubXY",b2.Vec2.prototype.SelfSubXY);
b2.Vec2.prototype.SelfMul=function(a){this.x*=a;this.y*=a;return this};goog.exportProperty(b2.Vec2.prototype,"SelfMul",b2.Vec2.prototype.SelfMul);b2.Vec2.prototype.SelfMulAdd=function(a,b){this.x+=a*b.x;this.y+=a*b.y;return this};goog.exportProperty(b2.Vec2.prototype,"SelfMulAdd",b2.Vec2.prototype.SelfMulAdd);b2.Vec2.prototype.SelfMulSub=function(a,b){this.x-=a*b.x;this.y-=a*b.y;return this};goog.exportProperty(b2.Vec2.prototype,"SelfMulSub",b2.Vec2.prototype.SelfMulSub);
b2.Vec2.prototype.Dot=function(a){return this.x*a.x+this.y*a.y};goog.exportProperty(b2.Vec2.prototype,"Dot",b2.Vec2.prototype.Dot);b2.Vec2.prototype.Cross=function(a){return this.x*a.y-this.y*a.x};goog.exportProperty(b2.Vec2.prototype,"Cross",b2.Vec2.prototype.Cross);b2.Vec2.prototype.Length=function(){var a=this.x,b=this.y;return Math.sqrt(a*a+b*b)};goog.exportProperty(b2.Vec2.prototype,"Length",b2.Vec2.prototype.Length);
b2.Vec2.prototype.LengthSquared=function(){var a=this.x,b=this.y;return a*a+b*b};goog.exportProperty(b2.Vec2.prototype,"LengthSquared",b2.Vec2.prototype.LengthSquared);b2.Vec2.prototype.Normalize=function(){var a=this.Length();if(a>=b2._epsilon){var b=1/a;this.x*=b;this.y*=b}return a};goog.exportProperty(b2.Vec2.prototype,"Normalize",b2.Vec2.prototype.Normalize);b2.Vec2.prototype.SelfNormalize=function(){this.Normalize();return this};
goog.exportProperty(b2.Vec2.prototype,"SelfNormalize",b2.Vec2.prototype.SelfNormalize);b2.Vec2.prototype.SelfRotate=function(a,b){var c=this.x,d=this.y;this.x=a*c-b*d;this.y=b*c+a*d;return this};goog.exportProperty(b2.Vec2.prototype,"SelfRotate",b2.Vec2.prototype.SelfRotate);b2.Vec2.prototype.SelfRotateAngle=function(a){return this.SelfRotate(Math.cos(a),Math.sin(a))};goog.exportProperty(b2.Vec2.prototype,"SelfRotateAngle",b2.Vec2.prototype.SelfRotateAngle);
b2.Vec2.prototype.IsValid=function(){return isFinite(this.x)&&isFinite(this.y)};goog.exportProperty(b2.Vec2.prototype,"IsValid",b2.Vec2.prototype.IsValid);b2.Vec2.prototype.SelfMin=function(a){this.x=Math.min(this.x,a.x);this.y=Math.min(this.y,a.y);return this};goog.exportProperty(b2.Vec2.prototype,"SelfMin",b2.Vec2.prototype.SelfMin);b2.Vec2.prototype.SelfMax=function(a){this.x=Math.max(this.x,a.x);this.y=Math.max(this.y,a.y);return this};
goog.exportProperty(b2.Vec2.prototype,"SelfMax",b2.Vec2.prototype.SelfMax);b2.Vec2.prototype.SelfAbs=function(){this.x=Math.abs(this.x);this.y=Math.abs(this.y);return this};goog.exportProperty(b2.Vec2.prototype,"SelfAbs",b2.Vec2.prototype.SelfAbs);b2.Vec2.prototype.SelfNeg=function(){this.x=-this.x;this.y=-this.y;return this};goog.exportProperty(b2.Vec2.prototype,"SelfNeg",b2.Vec2.prototype.SelfNeg);
b2.Vec2.prototype.SelfSkew=function(){var a=this.x;this.x=-this.y;this.y=a;return this};goog.exportProperty(b2.Vec2.prototype,"SelfSkew",b2.Vec2.prototype.SelfSkew);b2.Abs_V2=function(a,b){b.x=Math.abs(a.x);b.y=Math.abs(a.y);return b};goog.exportSymbol("b2.Abs_V2",b2.Abs_V2);b2.Min_V2_V2=function(a,b,c){c.x=Math.min(a.x,b.x);c.y=Math.min(a.y,b.y);return c};goog.exportSymbol("b2.Min_V2_V2",b2.Min_V2_V2);
b2.Max_V2_V2=function(a,b,c){c.x=Math.max(a.x,b.x);c.y=Math.max(a.y,b.y);return c};goog.exportSymbol("b2.Max_V2_V2",b2.Max_V2_V2);b2.Clamp_V2_V2_V2=function(a,b,c,d){d.x=Math.min(Math.max(a.x,b.x),c.x);d.y=Math.min(Math.max(a.y,b.y),c.y);return d};goog.exportSymbol("b2.Clamp_V2_V2_V2",b2.Clamp_V2_V2_V2);b2.Dot_V2_V2=function(a,b){return a.x*b.x+a.y*b.y};goog.exportSymbol("b2.Dot_V2_V2",b2.Dot_V2_V2);
b2.Cross_V2_V2=function(a,b){return a.x*b.y-a.y*b.x};goog.exportSymbol("b2.Cross_V2_V2",b2.Cross_V2_V2);b2.Cross_V2_S=function(a,b,c){var d=a.x;c.x=b*a.y;c.y=-b*d;return c};goog.exportSymbol("b2.Cross_V2_S",b2.Cross_V2_S);b2.Cross_S_V2=function(a,b,c){var d=b.x;c.x=-a*b.y;c.y=a*d;return c};goog.exportSymbol("b2.Cross_S_V2",b2.Cross_S_V2);b2.Add_V2_V2=function(a,b,c){c.x=a.x+b.x;c.y=a.y+b.y;return c};goog.exportSymbol("b2.Add_V2_V2",b2.Add_V2_V2);
b2.Sub_V2_V2=function(a,b,c){c.x=a.x-b.x;c.y=a.y-b.y;return c};goog.exportSymbol("b2.Sub_V2_V2",b2.Sub_V2_V2);b2.Add_V2_S=function(a,b,c){c.x=a.x+b;c.y=a.y+b;return c};goog.exportSymbol("b2.Add_V2_S",b2.Add_V2_S);b2.Sub_V2_S=function(a,b,c){c.x=a.x-b;c.y=a.y-b;return c};goog.exportSymbol("b2.Sub_V2_S",b2.Sub_V2_S);b2.Mul_S_V2=function(a,b,c){c.x=b.x*a;c.y=b.y*a;return c};goog.exportSymbol("b2.Mul_S_V2",b2.Mul_S_V2);
b2.Mul_V2_S=function(a,b,c){c.x=a.x*b;c.y=a.y*b;return c};goog.exportSymbol("b2.Mul_V2_S",b2.Mul_V2_S);b2.Div_V2_S=function(a,b,c){c.x=a.x/b;c.y=a.y/b;return c};goog.exportSymbol("b2.Div_V2_S",b2.Div_V2_S);b2.AddMul_V2_S_V2=function(a,b,c,d){d.x=a.x+b*c.x;d.y=a.y+b*c.y;return d};goog.exportSymbol("b2.AddMul_V2_S_V2",b2.AddMul_V2_S_V2);b2.SubMul_V2_S_V2=function(a,b,c,d){d.x=a.x-b*c.x;d.y=a.y-b*c.y;return d};
goog.exportSymbol("b2.SubMul_V2_S_V2",b2.SubMul_V2_S_V2);b2.AddCross_V2_S_V2=function(a,b,c,d){var e=c.x;d.x=a.x-b*c.y;d.y=a.y+b*e;return d};goog.exportSymbol("b2.AddCross_V2_S_V2",b2.AddCross_V2_S_V2);b2.Mid_V2_V2=function(a,b,c){c.x=.5*(a.x+b.x);c.y=.5*(a.y+b.y);return c};goog.exportSymbol("b2.Mid_V2_V2",b2.Mid_V2_V2);b2.Ext_V2_V2=function(a,b,c){c.x=.5*(b.x-a.x);c.y=.5*(b.y-a.y);return c};goog.exportSymbol("b2.Ext_V2_V2",b2.Ext_V2_V2);
b2.Distance=function(a,b){var c=a.x-b.x,d=a.y-b.y;return Math.sqrt(c*c+d*d)};goog.exportSymbol("b2.Distance",b2.Distance);b2.DistanceSquared=function(a,b){var c=a.x-b.x,d=a.y-b.y;return c*c+d*d};goog.exportSymbol("b2.DistanceSquared",b2.DistanceSquared);b2.Vec3=function(a,b,c){this.x=a||0;this.y=b||0;this.z=c||0};goog.exportSymbol("b2.Vec3",b2.Vec3);b2.Vec3.prototype.x=0;goog.exportProperty(b2.Vec3.prototype,"x",b2.Vec3.prototype.x);
b2.Vec3.prototype.y=0;goog.exportProperty(b2.Vec3.prototype,"y",b2.Vec3.prototype.y);b2.Vec3.prototype.z=0;goog.exportProperty(b2.Vec3.prototype,"z",b2.Vec3.prototype.z);b2.Vec3.ZERO=new b2.Vec3;goog.exportProperty(b2.Vec3,"ZERO",b2.Vec3.ZERO);b2.Vec3.s_t0=new b2.Vec3;goog.exportProperty(b2.Vec3,"s_t0",b2.Vec3.s_t0);b2.Vec3.prototype.Clone=function(){return new b2.Vec3(this.x,this.y,this.z)};
goog.exportProperty(b2.Vec3.prototype,"Clone",b2.Vec3.prototype.Clone);b2.Vec3.prototype.SetZero=function(){this.z=this.y=this.x=0;return this};goog.exportProperty(b2.Vec3.prototype,"SetZero",b2.Vec3.prototype.SetZero);b2.Vec3.prototype.Set=function(a,b,c){this.x=a;this.y=b;this.z=c;return this};goog.exportProperty(b2.Vec3.prototype,"Set",b2.Vec3.prototype.Set);b2.Vec3.prototype.Copy=function(a){this.x=a.x;this.y=a.y;this.z=a.z;return this};
goog.exportProperty(b2.Vec3.prototype,"Copy",b2.Vec3.prototype.Copy);b2.Vec3.prototype.SelfNeg=function(){this.x=-this.x;this.y=-this.y;this.z=-this.z;return this};goog.exportProperty(b2.Vec3.prototype,"SelfNeg",b2.Vec3.prototype.SelfNeg);b2.Vec3.prototype.SelfAdd=function(a){this.x+=a.x;this.y+=a.y;this.z+=a.z;return this};goog.exportProperty(b2.Vec3.prototype,"SelfAdd",b2.Vec3.prototype.SelfAdd);
b2.Vec3.prototype.SelfAddV2=function(a,b){this.x+=a.x;this.y+=a.y;this.z+=b;return this};goog.exportProperty(b2.Vec3.prototype,"SelfAddV2",b2.Vec3.prototype.SelfAddV2);b2.Vec3.prototype.SelfAddXYZ=function(a,b,c){this.x+=a;this.y+=b;this.z+=c;return this};goog.exportProperty(b2.Vec3.prototype,"SelfAddXYZ",b2.Vec3.prototype.SelfAddXYZ);b2.Vec3.prototype.SelfSub=function(a){this.x-=a.x;this.y-=a.y;this.z-=a.z;return this};
goog.exportProperty(b2.Vec3.prototype,"SelfSub",b2.Vec3.prototype.SelfSub);b2.Vec3.prototype.SelfSubV2=function(a,b){this.x-=a.x;this.y-=a.y;this.z-=b;return this};goog.exportProperty(b2.Vec3.prototype,"SelfSubV2",b2.Vec3.prototype.SelfSubV2);b2.Vec3.prototype.SelfSubXYZ=function(a,b,c){this.x-=a;this.y-=b;this.z-=c;return this};goog.exportProperty(b2.Vec3.prototype,"SelfSubXYZ",b2.Vec3.prototype.SelfSubXYZ);
b2.Vec3.prototype.SelfMul=function(a){this.x*=a.x;this.y*=a.y;this.z*=a.z;return this};goog.exportProperty(b2.Vec3.prototype,"SelfMul",b2.Vec3.prototype.SelfMul);b2.Vec3.prototype.SelfMulV2=function(a,b){this.x*=a.x;this.y*=a.y;this.z*=b;return this};goog.exportProperty(b2.Vec3.prototype,"SelfMulV2",b2.Vec3.prototype.SelfMulV2);b2.Vec3.prototype.SelfMulXYZ=function(a,b,c){this.x*=a;this.y*=b;this.z*=c;return this};
goog.exportProperty(b2.Vec3.prototype,"SelfMulXYZ",b2.Vec3.prototype.SelfMulXYZ);b2.Vec3.prototype.SelfMulScalar=function(a){this.x*=a;this.y*=a;this.z*=a;return this};goog.exportProperty(b2.Vec3.prototype,"SelfMulScalar",b2.Vec3.prototype.SelfMulScalar);b2.Vec3.prototype.Length=function(){var a=this.x,b=this.y,c=this.z;return Math.sqrt(a*a+b*b+c*c)};goog.exportProperty(b2.Vec3.prototype,"Length",b2.Vec3.prototype.Length);
b2.Vec3.prototype.LengthSquared=function(){var a=this.x,b=this.y,c=this.z;return a*a+b*b+c*c};goog.exportProperty(b2.Vec3.prototype,"LengthSquared",b2.Vec3.prototype.LengthSquared);b2.Vec3.prototype.Normalize=function(){var a=this.Length();if(a>=b2._epsilon){var b=1/a;this.x*=b;this.y*=b;this.z*=b}return a};goog.exportProperty(b2.Vec3.prototype,"Normalize",b2.Vec3.prototype.Normalize);b2.Vec3.prototype.SelfNormalize=function(){this.Normalize();return this};
goog.exportProperty(b2.Vec3.prototype,"SelfNormalize",b2.Vec3.prototype.SelfNormalize);b2.Add_V3_V3=function(a,b,c){c.x=a.x+b.x;c.y=a.y+b.y;c.z=a.z+b.z;return c};goog.exportSymbol("b2.Add_V3_V3",b2.Add_V3_V3);b2.Sub_V3_V3=function(a,b,c){c.x=a.x+b.x;c.y=a.y+b.y;c.z=a.z+b.z;return c};goog.exportSymbol("b2.Sub_V3_V3",b2.Sub_V3_V3);b2.Dot_V3_V3=function(a,b){return a.x*b.x+a.y*b.y+a.z*b.z};goog.exportSymbol("b2.Dot_V3_V3",b2.Dot_V3_V3);
b2.Cross_V3_V3=function(a,b,c){var d=a.x,e=a.y;a=a.z;var f=b.x,g=b.y;b=b.z;c.x=e*b-a*g;c.y=a*f-d*b;c.z=d*g-e*f;return c};goog.exportSymbol("b2.Cross_V3_V3",b2.Cross_V3_V3);b2.Vec4=function(a,b,c,d){this.x=a||0;this.y=b||0;this.z=c||0;this.w=d||0};goog.exportSymbol("b2.Vec4",b2.Vec4);b2.Vec4.prototype.x=0;goog.exportProperty(b2.Vec4.prototype,"x",b2.Vec4.prototype.x);b2.Vec4.prototype.y=0;goog.exportProperty(b2.Vec4.prototype,"y",b2.Vec4.prototype.y);
b2.Vec4.prototype.z=0;goog.exportProperty(b2.Vec4.prototype,"z",b2.Vec4.prototype.z);b2.Vec4.prototype.w=0;goog.exportProperty(b2.Vec4.prototype,"w",b2.Vec4.prototype.w);b2.Vec4.ZERO=new b2.Vec4(0,0,0,0);goog.exportProperty(b2.Vec4,"ZERO",b2.Vec4.ZERO);b2.Vec4.s_t0=new b2.Vec4;goog.exportProperty(b2.Vec4,"s_t0",b2.Vec4.s_t0);b2.Vec4.prototype.Clone=function(){return new b2.Vec4(this.x,this.y,this.z,this.w)};
goog.exportProperty(b2.Vec4.prototype,"Clone",b2.Vec4.prototype.Clone);b2.Vec4.prototype.SetZero=function(){this.w=this.z=this.y=this.x=0;return this};goog.exportProperty(b2.Vec4.prototype,"SetZero",b2.Vec4.prototype.SetZero);b2.Vec4.prototype.Set=function(a,b,c,d){this.x=a;this.y=b;this.z=c;this.w=d;return this};goog.exportProperty(b2.Vec4.prototype,"Set",b2.Vec4.prototype.Set);
b2.Vec4.prototype.Copy=function(a){this.x=a.x;this.y=a.y;this.z=a.z;this.w=a.w;return this};goog.exportProperty(b2.Vec4.prototype,"Copy",b2.Vec4.prototype.Copy);b2.Mat22=function(){this.ex=new b2.Vec2(1,0);this.ey=new b2.Vec2(0,1)};goog.exportSymbol("b2.Mat22",b2.Mat22);b2.Mat22.prototype.ex=null;goog.exportProperty(b2.Mat22.prototype,"ex",b2.Mat22.prototype.ex);b2.Mat22.prototype.ey=null;
goog.exportProperty(b2.Mat22.prototype,"ey",b2.Mat22.prototype.ey);b2.Mat22.IDENTITY=new b2.Mat22;goog.exportProperty(b2.Mat22,"IDENTITY",b2.Mat22.IDENTITY);b2.Mat22.prototype.Clone=function(){return(new b2.Mat22).Copy(this)};goog.exportProperty(b2.Mat22.prototype,"Clone",b2.Mat22.prototype.Clone);b2.Mat22.prototype.SetAngle=function(a){var b=Math.cos(a);a=Math.sin(a);this.ex.Set(b,a);this.ey.Set(-a,b);return this};
goog.exportProperty(b2.Mat22.prototype,"SetAngle",b2.Mat22.prototype.SetAngle);b2.Mat22.prototype.Copy=function(a){this.ex.Copy(a.ex);this.ey.Copy(a.ey);return this};goog.exportProperty(b2.Mat22.prototype,"Copy",b2.Mat22.prototype.Copy);b2.Mat22.prototype.SetIdentity=function(){this.ex.Set(1,0);this.ey.Set(0,1);return this};goog.exportProperty(b2.Mat22.prototype,"SetIdentity",b2.Mat22.prototype.SetIdentity);
b2.Mat22.prototype.SetZero=function(){this.ex.SetZero();this.ey.SetZero();return this};goog.exportProperty(b2.Mat22.prototype,"SetZero",b2.Mat22.prototype.SetZero);b2.Mat22.prototype.GetAngle=function(){return Math.atan2(this.ex.y,this.ex.x)};goog.exportProperty(b2.Mat22.prototype,"GetAngle",b2.Mat22.prototype.GetAngle);
b2.Mat22.prototype.GetInverse=function(a){var b=this.ex.x,c=this.ey.x,d=this.ex.y,e=this.ey.y,f=b*e-c*d;0!==f&&(f=1/f);a.ex.x=f*e;a.ey.x=-f*c;a.ex.y=-f*d;a.ey.y=f*b;return a};goog.exportProperty(b2.Mat22.prototype,"GetInverse",b2.Mat22.prototype.GetInverse);b2.Mat22.prototype.Solve=function(a,b,c){var d=this.ex.x,e=this.ey.x,f=this.ex.y,g=this.ey.y,h=d*g-e*f;0!==h&&(h=1/h);c.x=h*(g*a-e*b);c.y=h*(d*b-f*a);return c};goog.exportProperty(b2.Mat22.prototype,"Solve",b2.Mat22.prototype.Solve);
b2.Mat22.prototype.SelfAbs=function(){this.ex.SelfAbs();this.ey.SelfAbs();return this};goog.exportProperty(b2.Mat22.prototype,"SelfAbs",b2.Mat22.prototype.SelfAbs);b2.Mat22.prototype.SelfInv=function(){return this.GetInverse(this)};goog.exportProperty(b2.Mat22.prototype,"SelfInv",b2.Mat22.prototype.SelfInv);b2.Mat22.prototype.SelfAdd=function(a){this.ex.SelfAdd(a.ex);this.ey.SelfAdd(a.ey);return this};goog.exportProperty(b2.Mat22.prototype,"SelfAdd",b2.Mat22.prototype.SelfAdd);
b2.Mat22.prototype.SelfSub=function(a){this.ex.SelfSub(a.ex);this.ey.SelfSub(a.ey);return this};goog.exportProperty(b2.Mat22.prototype,"SelfSub",b2.Mat22.prototype.SelfSub);b2.Abs_M22=function(a,b){var c=a.ex,d=a.ey;b.ex.x=b2.Abs(c.x);b.ex.y=b2.Abs(c.y);b.ey.x=b2.Abs(d.x);b.ey.y=b2.Abs(d.y);return b};goog.exportSymbol("b2.Abs_M22",b2.Abs_M22);b2.Mul_M22_V2=function(a,b,c){var d=a.ex;a=a.ey;var e=b.x;b=b.y;c.x=d.x*e+a.x*b;c.y=d.y*e+a.y*b;return c};
goog.exportSymbol("b2.Mul_M22_V2",b2.Mul_M22_V2);b2.MulT_M22_V2=function(a,b,c){var d=a.ex;a=a.ey;var e=b.x;b=b.y;c.x=d.x*e+d.y*b;c.y=a.x*e+a.y*b;return c};goog.exportSymbol("b2.MulT_M22_V2",b2.MulT_M22_V2);b2.Add_M22_M22=function(a,b,c){var d=a.ex;a=a.ey;var e=b.ex;b=b.ey;c.ex.x=d.x+e.x;c.ex.y=d.y+e.y;c.ey.x=a.x+b.x;c.ey.y=a.y+b.y;return c};goog.exportSymbol("b2.Add_M22_M22",b2.Add_M22_M22);
b2.Mul_M22_M22=function(a,b,c){var d=a.ex.x,e=a.ex.y,f=a.ey.x;a=a.ey.y;var g=b.ex.x,h=b.ex.y,k=b.ey.x;b=b.ey.y;c.ex.x=d*g+f*h;c.ex.y=e*g+a*h;c.ey.x=d*k+f*b;c.ey.y=e*k+a*b;return c};goog.exportSymbol("b2.Mul_M22_M22",b2.Mul_M22_M22);b2.MulT_M22_M22=function(a,b,c){var d=a.ex.x,e=a.ex.y,f=a.ey.x;a=a.ey.y;var g=b.ex.x,h=b.ex.y,k=b.ey.x;b=b.ey.y;c.ex.x=d*g+e*h;c.ex.y=f*g+a*h;c.ey.x=d*k+e*b;c.ey.y=f*k+a*b;return c};goog.exportSymbol("b2.MulT_M22_M22",b2.MulT_M22_M22);
b2.Mat33=function(){this.ex=new b2.Vec3(1,0,0);this.ey=new b2.Vec3(0,1,0);this.ez=new b2.Vec3(0,0,1)};goog.exportSymbol("b2.Mat33",b2.Mat33);b2.Mat33.prototype.ex=null;goog.exportProperty(b2.Mat33.prototype,"ex",b2.Mat33.prototype.ex);b2.Mat33.prototype.ey=null;goog.exportProperty(b2.Mat33.prototype,"ey",b2.Mat33.prototype.ey);b2.Mat33.prototype.ez=null;goog.exportProperty(b2.Mat33.prototype,"ez",b2.Mat33.prototype.ez);
b2.Mat33.IDENTITY=new b2.Mat33;goog.exportProperty(b2.Mat33,"IDENTITY",b2.Mat33.IDENTITY);b2.Mat33.prototype.Clone=function(){return(new b2.Mat33).Copy(this)};goog.exportProperty(b2.Mat33.prototype,"Clone",b2.Mat33.prototype.Clone);b2.Mat33.prototype.Copy=function(a){this.ex.Copy(a.ex);this.ey.Copy(a.ey);this.ez.Copy(a.ez);return this};goog.exportProperty(b2.Mat33.prototype,"Copy",b2.Mat33.prototype.Copy);
b2.Mat33.prototype.SetIdentity=function(){this.ex.Set(1,0,0);this.ey.Set(0,1,0);this.ez.Set(0,0,1);return this};goog.exportProperty(b2.Mat33.prototype,"SetIdentity",b2.Mat33.prototype.SetIdentity);b2.Mat33.prototype.SetZero=function(){this.ex.SetZero();this.ey.SetZero();this.ez.SetZero();return this};goog.exportProperty(b2.Mat33.prototype,"SetZero",b2.Mat33.prototype.SetZero);
b2.Mat33.prototype.SelfAdd=function(a){this.ex.SelfAdd(a.ex);this.ey.SelfAdd(a.ey);this.ez.SelfAdd(a.ez);return this};goog.exportProperty(b2.Mat33.prototype,"SelfAdd",b2.Mat33.prototype.SelfAdd);
b2.Mat33.prototype.Solve33=function(a,b,c,d){var e=this.ex.x,f=this.ex.y,g=this.ex.z,h=this.ey.x,k=this.ey.y,l=this.ey.z,m=this.ez.x,n=this.ez.y,p=this.ez.z,q=e*(k*p-l*n)+f*(l*m-h*p)+g*(h*n-k*m);0!==q&&(q=1/q);d.x=q*(a*(k*p-l*n)+b*(l*m-h*p)+c*(h*n-k*m));d.y=q*(e*(b*p-c*n)+f*(c*m-a*p)+g*(a*n-b*m));d.z=q*(e*(k*c-l*b)+f*(l*a-h*c)+g*(h*b-k*a));return d};goog.exportProperty(b2.Mat33.prototype,"Solve33",b2.Mat33.prototype.Solve33);
b2.Mat33.prototype.Solve22=function(a,b,c){var d=this.ex.x,e=this.ey.x,f=this.ex.y,g=this.ey.y,h=d*g-e*f;0!==h&&(h=1/h);c.x=h*(g*a-e*b);c.y=h*(d*b-f*a);return c};goog.exportProperty(b2.Mat33.prototype,"Solve22",b2.Mat33.prototype.Solve22);b2.Mat33.prototype.GetInverse22=function(a){var b=this.ex.x,c=this.ey.x,d=this.ex.y,e=this.ey.y,f=b*e-c*d;0!==f&&(f=1/f);a.ex.x=f*e;a.ey.x=-f*c;a.ex.z=0;a.ex.y=-f*d;a.ey.y=f*b;a.ey.z=0;a.ez.x=0;a.ez.y=0;a.ez.z=0};
goog.exportProperty(b2.Mat33.prototype,"GetInverse22",b2.Mat33.prototype.GetInverse22);b2.Mat33.prototype.GetSymInverse33=function(a){var b=b2.Dot_V3_V3(this.ex,b2.Cross_V3_V3(this.ey,this.ez,b2.Vec3.s_t0));0!==b&&(b=1/b);var c=this.ex.x,d=this.ey.x,e=this.ez.x,f=this.ey.y,g=this.ez.y,h=this.ez.z;a.ex.x=b*(f*h-g*g);a.ex.y=b*(e*g-d*h);a.ex.z=b*(d*g-e*f);a.ey.x=a.ex.y;a.ey.y=b*(c*h-e*e);a.ey.z=b*(e*d-c*g);a.ez.x=a.ex.z;a.ez.y=a.ey.z;a.ez.z=b*(c*f-d*d)};
goog.exportProperty(b2.Mat33.prototype,"GetSymInverse33",b2.Mat33.prototype.GetSymInverse33);b2.Mul_M33_V3=function(a,b,c){var d=b.x,e=b.y;b=b.z;c.x=a.ex.x*d+a.ey.x*e+a.ez.x*b;c.y=a.ex.y*d+a.ey.y*e+a.ez.y*b;c.z=a.ex.z*d+a.ey.z*e+a.ez.z*b;return c};goog.exportSymbol("b2.Mul_M33_V3",b2.Mul_M33_V3);b2.Mul_M33_X_Y_Z=function(a,b,c,d,e){e.x=a.ex.x*b+a.ey.x*c+a.ez.x*d;e.y=a.ex.y*b+a.ey.y*c+a.ez.y*d;e.z=a.ex.z*b+a.ey.z*c+a.ez.z*d;return e};
goog.exportSymbol("b2.Mul_M33_X_Y_Z",b2.Mul_M33_X_Y_Z);b2.Mul22_M33_V2=function(a,b,c){var d=b.x;b=b.y;c.x=a.ex.x*d+a.ey.x*b;c.y=a.ex.y*d+a.ey.y*b;return c};goog.exportSymbol("b2.Mul22_M33_V2",b2.Mul22_M33_V2);b2.Mul_M33_X_Y=function(a,b,c,d){d.x=a.ex.x*b+a.ey.x*c;d.y=a.ex.y*b+a.ey.y*c;return d};goog.exportSymbol("b2.Mul_M33_X_Y",b2.Mul_M33_X_Y);b2.Rot=function(a){a&&(this.angle=a,this.s=Math.sin(a),this.c=Math.cos(a))};
goog.exportSymbol("b2.Rot",b2.Rot);b2.Rot.prototype.angle=0;goog.exportProperty(b2.Rot.prototype,"angle",b2.Rot.prototype.angle);b2.Rot.prototype.s=0;goog.exportProperty(b2.Rot.prototype,"s",b2.Rot.prototype.s);b2.Rot.prototype.c=1;goog.exportProperty(b2.Rot.prototype,"c",b2.Rot.prototype.c);b2.Rot.IDENTITY=new b2.Rot;goog.exportProperty(b2.Rot,"IDENTITY",b2.Rot.IDENTITY);b2.Rot.prototype.Clone=function(){return(new b2.Rot).Copy(this)};
goog.exportProperty(b2.Rot.prototype,"Clone",b2.Rot.prototype.Clone);b2.Rot.prototype.Copy=function(a){this.angle=a.angle;this.s=a.s;this.c=a.c;return this};goog.exportProperty(b2.Rot.prototype,"Copy",b2.Rot.prototype.Copy);b2.Rot.prototype.Set=function(a){Math.abs(this.angle-a)>=b2._epsilon&&(this.angle=a,this.s=Math.sin(a),this.c=Math.cos(a));return this};goog.exportProperty(b2.Rot.prototype,"Set",b2.Rot.prototype.Set);
b2.Rot.prototype.SetAngle=b2.Rot.prototype.Set;goog.exportProperty(b2.Rot.prototype,"SetAngle",b2.Rot.prototype.SetAngle);b2.Rot.prototype.SetIdentity=function(){this.s=this.angle=0;this.c=1;return this};goog.exportProperty(b2.Rot.prototype,"SetIdentity",b2.Rot.prototype.SetIdentity);b2.Rot.prototype.GetAngle=function(){return this.angle};goog.exportProperty(b2.Rot.prototype,"GetAngle",b2.Rot.prototype.GetAngle);
b2.Rot.prototype.GetXAxis=function(a){a.x=this.c;a.y=this.s;return a};goog.exportProperty(b2.Rot.prototype,"GetXAxis",b2.Rot.prototype.GetXAxis);b2.Rot.prototype.GetYAxis=function(a){a.x=-this.s;a.y=this.c;return a};goog.exportProperty(b2.Rot.prototype,"GetYAxis",b2.Rot.prototype.GetYAxis);b2.Mul_R_R=function(a,b,c){var d=a.c,e=a.s,f=b.c,g=b.s;c.s=e*f+d*g;c.c=d*f-e*g;c.angle=b2.WrapAngle(a.angle+b.angle);return c};goog.exportSymbol("b2.Mul_R_R",b2.Mul_R_R);
b2.MulT_R_R=function(a,b,c){var d=a.c,e=a.s,f=b.c,g=b.s;c.s=d*g-e*f;c.c=d*f+e*g;c.angle=b2.WrapAngle(a.angle-b.angle);return c};goog.exportSymbol("b2.MulT_R_R",b2.MulT_R_R);b2.Mul_R_V2=function(a,b,c){var d=a.c;a=a.s;var e=b.x;b=b.y;c.x=d*e-a*b;c.y=a*e+d*b;return c};goog.exportSymbol("b2.Mul_R_V2",b2.Mul_R_V2);b2.MulT_R_V2=function(a,b,c){var d=a.c;a=a.s;var e=b.x;b=b.y;c.x=d*e+a*b;c.y=-a*e+d*b;return c};goog.exportSymbol("b2.MulT_R_V2",b2.MulT_R_V2);
b2.Transform=function(){this.p=new b2.Vec2;this.q=new b2.Rot};goog.exportSymbol("b2.Transform",b2.Transform);b2.Transform.prototype.p=null;goog.exportProperty(b2.Transform.prototype,"p",b2.Transform.prototype.p);b2.Transform.prototype.q=null;goog.exportProperty(b2.Transform.prototype,"q",b2.Transform.prototype.q);b2.Transform.IDENTITY=new b2.Transform;goog.exportProperty(b2.Transform,"IDENTITY",b2.Transform.IDENTITY);
b2.Transform.prototype.Clone=function(){return(new b2.Transform).Copy(this)};goog.exportProperty(b2.Transform.prototype,"Clone",b2.Transform.prototype.Clone);b2.Transform.prototype.Copy=function(a){this.p.Copy(a.p);this.q.Copy(a.q);return this};goog.exportProperty(b2.Transform.prototype,"Copy",b2.Transform.prototype.Copy);b2.Transform.prototype.SetIdentity=function(){this.p.SetZero();this.q.SetIdentity();return this};
goog.exportProperty(b2.Transform.prototype,"SetIdentity",b2.Transform.prototype.SetIdentity);b2.Transform.prototype.Set=function(a,b){return this.SetPositionRotationAngle(a,b)};b2.Transform.prototype.SetPositionRotation=function(a,b){this.p.Copy(a);this.q.Copy(b);return this};goog.exportProperty(b2.Transform.prototype,"SetPositionRotation",b2.Transform.prototype.SetPositionRotation);
b2.Transform.prototype.SetPositionRotationAngle=function(a,b){this.p.Copy(a);this.q.SetAngle(b);return this};goog.exportProperty(b2.Transform.prototype,"SetPositionRotationAngle",b2.Transform.prototype.SetPositionRotationAngle);b2.Transform.prototype.SetPosition=function(a){this.p.Copy(a);return this};goog.exportProperty(b2.Transform.prototype,"SetPosition",b2.Transform.prototype.SetPosition);b2.Transform.prototype.SetPositionXY=function(a,b){this.p.Set(a,b);return this};
goog.exportProperty(b2.Transform.prototype,"SetPositionXY",b2.Transform.prototype.SetPositionXY);b2.Transform.prototype.SetRotation=function(a){this.q.Copy(a);return this};goog.exportProperty(b2.Transform.prototype,"SetRotation",b2.Transform.prototype.SetRotation);b2.Transform.prototype.SetRotationAngle=function(a){this.q.SetAngle(a);return this};goog.exportProperty(b2.Transform.prototype,"SetRotationAngle",b2.Transform.prototype.SetRotationAngle);
b2.Transform.prototype.GetPosition=function(){return this.p};goog.exportProperty(b2.Transform.prototype,"GetPosition",b2.Transform.prototype.GetPosition);b2.Transform.prototype.GetRotation=function(){return this.q};goog.exportProperty(b2.Transform.prototype,"GetRotation",b2.Transform.prototype.GetRotation);b2.Transform.prototype.GetRotationAngle=function(){return this.q.GetAngle()};goog.exportProperty(b2.Transform.prototype,"GetRotationAngle",b2.Transform.prototype.GetRotationAngle);
b2.Transform.prototype.GetAngle=function(){return this.q.GetAngle()};goog.exportProperty(b2.Transform.prototype,"GetAngle",b2.Transform.prototype.GetAngle);b2.Mul_X_V2=function(a,b,c){var d=a.q.c,e=a.q.s,f=b.x;b=b.y;c.x=d*f-e*b+a.p.x;c.y=e*f+d*b+a.p.y;return c};goog.exportSymbol("b2.Mul_X_V2",b2.Mul_X_V2);b2.MulT_X_V2=function(a,b,c){var d=a.q.c,e=a.q.s,f=b.x-a.p.x;a=b.y-a.p.y;c.x=d*f+e*a;c.y=-e*f+d*a;return c};goog.exportSymbol("b2.MulT_X_V2",b2.MulT_X_V2);
b2.Mul_X_X=function(a,b,c){b2.Mul_R_R(a.q,b.q,c.q);b2.Add_V2_V2(b2.Mul_R_V2(a.q,b.p,c.p),a.p,c.p);return c};goog.exportSymbol("b2.Mul_X_X",b2.Mul_X_X);b2.MulT_X_X=function(a,b,c){b2.MulT_R_R(a.q,b.q,c.q);b2.MulT_R_V2(a.q,b2.Sub_V2_V2(b.p,a.p,c.p),c.p);return c};goog.exportSymbol("b2.MulT_X_X",b2.MulT_X_X);b2.Sweep=function(){this.localCenter=new b2.Vec2;this.c0=new b2.Vec2;this.c=new b2.Vec2};
goog.exportSymbol("b2.Sweep",b2.Sweep);b2.Sweep.prototype.localCenter=null;goog.exportProperty(b2.Sweep.prototype,"localCenter",b2.Sweep.prototype.localCenter);b2.Sweep.prototype.c0=null;goog.exportProperty(b2.Sweep.prototype,"c0",b2.Sweep.prototype.c0);b2.Sweep.prototype.c=null;goog.exportProperty(b2.Sweep.prototype,"c",b2.Sweep.prototype.c);b2.Sweep.prototype.a0=0;goog.exportProperty(b2.Sweep.prototype,"a0",b2.Sweep.prototype.a0);
b2.Sweep.prototype.a=0;goog.exportProperty(b2.Sweep.prototype,"a",b2.Sweep.prototype.a);b2.Sweep.prototype.alpha0=0;goog.exportProperty(b2.Sweep.prototype,"alpha0",b2.Sweep.prototype.alpha0);b2.Sweep.prototype.Clone=function(){return(new b2.Sweep).Copy(this)};goog.exportProperty(b2.Sweep.prototype,"Clone",b2.Sweep.prototype.Clone);
b2.Sweep.prototype.Copy=function(a){this.localCenter.Copy(a.localCenter);this.c0.Copy(a.c0);this.c.Copy(a.c);this.a0=a.a0;this.a=a.a;this.alpha0=a.alpha0;return this};goog.exportProperty(b2.Sweep.prototype,"Copy",b2.Sweep.prototype.Copy);b2.Sweep.prototype.GetTransform=function(a,b){var c=1-b;a.p.x=c*this.c0.x+b*this.c.x;a.p.y=c*this.c0.y+b*this.c.y;a.q.SetAngle(c*this.a0+b*this.a);a.p.SelfSub(b2.Mul_R_V2(a.q,this.localCenter,b2.Vec2.s_t0));return a};
goog.exportProperty(b2.Sweep.prototype,"GetTransform",b2.Sweep.prototype.GetTransform);b2.Sweep.prototype.Advance=function(a){b2.ENABLE_ASSERTS&&b2.Assert(1>this.alpha0);var b=(a-this.alpha0)/(1-this.alpha0);this.c0.x+=b*(this.c.x-this.c0.x);this.c0.y+=b*(this.c.y-this.c0.y);this.a0+=b*(this.a-this.a0);this.alpha0=a};goog.exportProperty(b2.Sweep.prototype,"Advance",b2.Sweep.prototype.Advance);
b2.Sweep.prototype.Normalize=function(){this.a0=b2.WrapAngle(this.a0);this.a=b2.WrapAngle(this.a)};goog.exportProperty(b2.Sweep.prototype,"Normalize",b2.Sweep.prototype.Normalize);b2.Dot=function(a,b){if(a instanceof b2.Vec2&&b instanceof b2.Vec2)return b2.Dot_V2_V2(a,b);if(a instanceof b2.Vec3&&b instanceof b2.Vec3)return b2.Dot_V3_V3(a,b);throw Error();};goog.exportSymbol("b2.Dot",b2.Dot);
b2.Cross=function(a,b,c){if(a instanceof b2.Vec2&&b instanceof b2.Vec2)return b2.Cross_V2_V2(a,b);if(a instanceof b2.Vec2&&"number"===typeof b&&c instanceof b2.Vec2)return b2.Cross_V2_S(a,b,c);if("number"===typeof a&&b instanceof b2.Vec2&&c instanceof b2.Vec2)return b2.Cross_S_V2(a,b,c);if(a instanceof b2.Vec3&&b instanceof b2.Vec3&&c instanceof b2.Vec3)return b2.Cross_V3_V3(a,b,c);throw Error();};
goog.exportSymbol("b2.Cross",b2.Cross);b2.Add=function(a,b,c){if(a instanceof b2.Vec2&&b instanceof b2.Vec2&&c instanceof b2.Vec2)return b2.Add_V2_V2(a,b,c);if(a instanceof b2.Vec3&&b instanceof b2.Vec3&&c instanceof b2.Vec3)return b2.Add_V3_V3(a,b,c);throw Error();};goog.exportSymbol("b2.Add",b2.Add);
b2.Sub=function(a,b,c){if(a instanceof b2.Vec2&&b instanceof b2.Vec2&&c instanceof b2.Vec2)return b2.Sub_V2_V2(a,b,c);if(a instanceof b2.Vec3&&b instanceof b2.Vec3&&c instanceof b2.Vec3)return b2.Sub_V3_V3(a,b,c);throw Error();};goog.exportSymbol("b2.Sub",b2.Sub);
b2.Mul=function(a,b,c){if(a instanceof b2.Mat22&&b instanceof b2.Vec2&&c instanceof b2.Vec2)return b2.Mul_M22_V2(a,b,c);if(a instanceof b2.Mat22&&b instanceof b2.Mat22&&c instanceof b2.Mat22)return b2.Mul_M22_M22(a,b,c);if(a instanceof b2.Mat33&&b instanceof b2.Vec3&&c instanceof b2.Vec3)return b2.Mul_M33_V3(a,b,c);if(a instanceof b2.Rot&&b instanceof b2.Rot&&c instanceof b2.Rot)return b2.Mul_R_R(a,b,c);if(a instanceof
b2.Rot&&b instanceof b2.Vec2&&c instanceof b2.Vec2)return b2.Mul_R_V2(a,b,c);if(a instanceof b2.Transform&&b instanceof b2.Vec2&&c instanceof b2.Vec2)return b2.Mul_X_V2(a,b,c);if(a instanceof b2.Transform&&b instanceof b2.Transform&&c instanceof b2.Transform)return b2.Mul_X_X(a,b,c);throw Error();};goog.exportSymbol("b2.Mul",b2.Mul);
b2.Mul22=function(a,b,c){if(a instanceof b2.Mat33&&b instanceof b2.Vec2)return b2.Mul22_M33_V2(a,b,c);throw Error();};goog.exportSymbol("b2.Mul22",b2.Mul22);
b2.MulT=function(a,b,c){if(a instanceof b2.Mat22&&b instanceof b2.Vec2&&c instanceof b2.Vec2)return b2.MulT_M22_V2(a,b,c);if(a instanceof b2.Mat22&&b instanceof b2.Mat22&&c instanceof b2.Mat22)return b2.MulT_M22_M22(a,b,c);if(a instanceof b2.Rot&&b instanceof b2.Rot&&c instanceof b2.Rot)return b2.MulT_R_R(a,b,c);if(a instanceof b2.Rot&&b instanceof b2.Vec2&&c instanceof b2.Vec2)return b2.MulT_R_V2(a,b,c);if(a instanceof
b2.Transform&&b instanceof b2.Vec2&&c instanceof b2.Vec2)return b2.MulT_X_V2(a,b,c);if(a instanceof b2.Transform&&b instanceof b2.Transform&&c instanceof b2.Transform)return b2.MulT_X_X(a,b,c);throw Error();};goog.exportSymbol("b2.MulT",b2.MulT);b2.DistanceProxy=function(){this.m_buffer=b2.Vec2.MakeArray(2)};goog.exportSymbol("b2.DistanceProxy",b2.DistanceProxy);b2.DistanceProxy.prototype.m_buffer=null;goog.exportProperty(b2.DistanceProxy.prototype,"m_buffer",b2.DistanceProxy.prototype.m_buffer);b2.DistanceProxy.prototype.m_vertices=null;goog.exportProperty(b2.DistanceProxy.prototype,"m_vertices",b2.DistanceProxy.prototype.m_vertices);b2.DistanceProxy.prototype.m_count=0;
goog.exportProperty(b2.DistanceProxy.prototype,"m_count",b2.DistanceProxy.prototype.m_count);b2.DistanceProxy.prototype.m_radius=0;goog.exportProperty(b2.DistanceProxy.prototype,"m_radius",b2.DistanceProxy.prototype.m_radius);b2.DistanceProxy.prototype.Reset=function(){this.m_vertices=null;this.m_radius=this.m_count=0;return this};goog.exportProperty(b2.DistanceProxy.prototype,"Reset",b2.DistanceProxy.prototype.Reset);
b2.DistanceProxy.prototype.SetShape=function(a,b){a.SetupDistanceProxy(this,b)};goog.exportProperty(b2.DistanceProxy.prototype,"SetShape",b2.DistanceProxy.prototype.SetShape);b2.DistanceProxy.prototype.GetSupport=function(a){for(var b=0,c=b2.Dot_V2_V2(this.m_vertices[0],a),d=1;d<this.m_count;++d){var e=b2.Dot_V2_V2(this.m_vertices[d],a);e>c&&(b=d,c=e)}return b};goog.exportProperty(b2.DistanceProxy.prototype,"GetSupport",b2.DistanceProxy.prototype.GetSupport);
b2.DistanceProxy.prototype.GetSupportVertex=function(a,b){for(var c=0,d=b2.Dot_V2_V2(this.m_vertices[0],a),e=1;e<this.m_count;++e){var f=b2.Dot_V2_V2(this.m_vertices[e],a);f>d&&(c=e,d=f)}return b.Copy(this.m_vertices[c])};goog.exportProperty(b2.DistanceProxy.prototype,"GetSupportVertex",b2.DistanceProxy.prototype.GetSupportVertex);b2.DistanceProxy.prototype.GetVertexCount=function(){return this.m_count};
goog.exportProperty(b2.DistanceProxy.prototype,"GetVertexCount",b2.DistanceProxy.prototype.GetVertexCount);b2.DistanceProxy.prototype.GetVertex=function(a){b2.ENABLE_ASSERTS&&b2.Assert(0<=a&&a<this.m_count);return this.m_vertices[a]};goog.exportProperty(b2.DistanceProxy.prototype,"GetVertex",b2.DistanceProxy.prototype.GetVertex);b2.SimplexCache=function(){this.indexA=b2.MakeNumberArray(3);this.indexB=b2.MakeNumberArray(3)};
goog.exportSymbol("b2.SimplexCache",b2.SimplexCache);b2.SimplexCache.prototype.metric=0;goog.exportProperty(b2.SimplexCache.prototype,"metric",b2.SimplexCache.prototype.metric);b2.SimplexCache.prototype.count=0;goog.exportProperty(b2.SimplexCache.prototype,"count",b2.SimplexCache.prototype.count);b2.SimplexCache.prototype.indexA=null;goog.exportProperty(b2.SimplexCache.prototype,"indexA",b2.SimplexCache.prototype.indexA);
b2.SimplexCache.prototype.indexB=null;goog.exportProperty(b2.SimplexCache.prototype,"indexB",b2.SimplexCache.prototype.indexB);b2.SimplexCache.prototype.Reset=function(){this.count=this.metric=0;return this};goog.exportProperty(b2.SimplexCache.prototype,"Reset",b2.SimplexCache.prototype.Reset);b2.DistanceInput=function(){this.proxyA=new b2.DistanceProxy;this.proxyB=new b2.DistanceProxy;this.transformA=new b2.Transform;this.transformB=new b2.Transform};
goog.exportSymbol("b2.DistanceInput",b2.DistanceInput);b2.DistanceInput.prototype.proxyA=null;goog.exportProperty(b2.DistanceInput.prototype,"proxyA",b2.DistanceInput.prototype.proxyA);b2.DistanceInput.prototype.proxyB=null;goog.exportProperty(b2.DistanceInput.prototype,"proxyB",b2.DistanceInput.prototype.proxyB);b2.DistanceInput.prototype.transformA=null;goog.exportProperty(b2.DistanceInput.prototype,"transformA",b2.DistanceInput.prototype.transformA);
b2.DistanceInput.prototype.transformB=null;goog.exportProperty(b2.DistanceInput.prototype,"transformB",b2.DistanceInput.prototype.transformB);b2.DistanceInput.prototype.useRadii=!1;goog.exportProperty(b2.DistanceInput.prototype,"useRadii",b2.DistanceInput.prototype.useRadii);b2.DistanceInput.prototype.Reset=function(){this.proxyA.Reset();this.proxyB.Reset();this.transformA.SetIdentity();this.transformB.SetIdentity();this.useRadii=!1;return this};
goog.exportProperty(b2.DistanceInput.prototype,"Reset",b2.DistanceInput.prototype.Reset);b2.DistanceOutput=function(){this.pointA=new b2.Vec2;this.pointB=new b2.Vec2};goog.exportSymbol("b2.DistanceOutput",b2.DistanceOutput);b2.DistanceOutput.prototype.pointA=null;goog.exportProperty(b2.DistanceOutput.prototype,"pointA",b2.DistanceOutput.prototype.pointA);b2.DistanceOutput.prototype.pointB=null;
goog.exportProperty(b2.DistanceOutput.prototype,"pointB",b2.DistanceOutput.prototype.pointB);b2.DistanceOutput.prototype.distance=0;goog.exportProperty(b2.DistanceOutput.prototype,"distance",b2.DistanceOutput.prototype.distance);b2.DistanceOutput.prototype.iterations=0;goog.exportProperty(b2.DistanceOutput.prototype,"iterations",b2.DistanceOutput.prototype.iterations);
b2.DistanceOutput.prototype.Reset=function(){this.pointA.SetZero();this.pointB.SetZero();this.iterations=this.distance=0;return this};goog.exportProperty(b2.DistanceOutput.prototype,"Reset",b2.DistanceOutput.prototype.Reset);b2._gjkCalls=0;goog.exportSymbol("b2._gjkCalls",b2._gjkCalls);b2._gjkIters=0;goog.exportSymbol("b2._gjkIters",b2._gjkIters);b2._gjkMaxIters=0;goog.exportSymbol("b2._gjkMaxIters",b2._gjkMaxIters);
b2.SimplexVertex=function(){this.wA=new b2.Vec2;this.wB=new b2.Vec2;this.w=new b2.Vec2};goog.exportSymbol("b2.SimplexVertex",b2.SimplexVertex);b2.SimplexVertex.prototype.wA=null;goog.exportProperty(b2.SimplexVertex.prototype,"wA",b2.SimplexVertex.prototype.wA);b2.SimplexVertex.prototype.wB=null;goog.exportProperty(b2.SimplexVertex.prototype,"wB",b2.SimplexVertex.prototype.wB);b2.SimplexVertex.prototype.w=null;
goog.exportProperty(b2.SimplexVertex.prototype,"w",b2.SimplexVertex.prototype.w);b2.SimplexVertex.prototype.a=0;goog.exportProperty(b2.SimplexVertex.prototype,"a",b2.SimplexVertex.prototype.a);b2.SimplexVertex.prototype.indexA=0;goog.exportProperty(b2.SimplexVertex.prototype,"indexA",b2.SimplexVertex.prototype.indexA);b2.SimplexVertex.prototype.indexB=0;goog.exportProperty(b2.SimplexVertex.prototype,"indexB",b2.SimplexVertex.prototype.indexB);
b2.SimplexVertex.prototype.Copy=function(a){this.wA.Copy(a.wA);this.wB.Copy(a.wB);this.w.Copy(a.w);this.a=a.a;this.indexA=a.indexA;this.indexB=a.indexB;return this};goog.exportProperty(b2.SimplexVertex.prototype,"Copy",b2.SimplexVertex.prototype.Copy);
b2.Simplex=function(){this.m_v1=new b2.SimplexVertex;this.m_v2=new b2.SimplexVertex;this.m_v3=new b2.SimplexVertex;this.m_vertices=Array(3);this.m_vertices[0]=this.m_v1;this.m_vertices[1]=this.m_v2;this.m_vertices[2]=this.m_v3};goog.exportSymbol("b2.Simplex",b2.Simplex);b2.Simplex.prototype.m_v1=null;goog.exportProperty(b2.Simplex.prototype,"m_v1",b2.Simplex.prototype.m_v1);b2.Simplex.prototype.m_v2=null;
goog.exportProperty(b2.Simplex.prototype,"m_v2",b2.Simplex.prototype.m_v2);b2.Simplex.prototype.m_v3=null;goog.exportProperty(b2.Simplex.prototype,"m_v3",b2.Simplex.prototype.m_v3);b2.Simplex.prototype.m_vertices=null;goog.exportProperty(b2.Simplex.prototype,"m_vertices",b2.Simplex.prototype.m_vertices);b2.Simplex.prototype.m_count=0;goog.exportProperty(b2.Simplex.prototype,"m_count",b2.Simplex.prototype.m_count);
b2.Simplex.prototype.ReadCache=function(a,b,c,d,e){b2.ENABLE_ASSERTS&&b2.Assert(0<=a.count&&3>=a.count);this.m_count=a.count;for(var f=this.m_vertices,g=0;g<this.m_count;++g){var h=f[g];h.indexA=a.indexA[g];h.indexB=a.indexB[g];var k=b.GetVertex(h.indexA),l=d.GetVertex(h.indexB);b2.Mul_X_V2(c,k,h.wA);b2.Mul_X_V2(e,l,h.wB);b2.Sub_V2_V2(h.wB,h.wA,h.w);h.a=0}1<this.m_count&&(a=a.metric,g=this.GetMetric(),g<.5*a||2*a<g||g<b2._epsilon)&&(this.m_count=0);0===this.m_count&&
(h=f[0],h.indexA=0,h.indexB=0,k=b.GetVertex(0),l=d.GetVertex(0),b2.Mul_X_V2(c,k,h.wA),b2.Mul_X_V2(e,l,h.wB),b2.Sub_V2_V2(h.wB,h.wA,h.w),this.m_count=h.a=1)};goog.exportProperty(b2.Simplex.prototype,"ReadCache",b2.Simplex.prototype.ReadCache);b2.Simplex.prototype.WriteCache=function(a){a.metric=this.GetMetric();a.count=this.m_count;for(var b=this.m_vertices,c=0;c<this.m_count;++c)a.indexA[c]=b[c].indexA,a.indexB[c]=b[c].indexB};
goog.exportProperty(b2.Simplex.prototype,"WriteCache",b2.Simplex.prototype.WriteCache);b2.Simplex.prototype.GetSearchDirection=function(a){switch(this.m_count){case 1:return a.Copy(this.m_v1.w).SelfNeg();case 2:var b=b2.Sub_V2_V2(this.m_v2.w,this.m_v1.w,a);return 0<b2.Cross_V2_V2(b,b2.Vec2.s_t0.Copy(this.m_v1.w).SelfNeg())?b2.Cross_S_V2(1,b,a):b2.Cross_V2_S(b,1,a);default:return b2.ENABLE_ASSERTS&&b2.Assert(!1),a.SetZero()}};
goog.exportProperty(b2.Simplex.prototype,"GetSearchDirection",b2.Simplex.prototype.GetSearchDirection);b2.Simplex.prototype.GetClosestPoint=function(a){switch(this.m_count){case 0:return b2.ENABLE_ASSERTS&&b2.Assert(!1),a.SetZero();case 1:return a.Copy(this.m_v1.w);case 2:return a.Set(this.m_v1.a*this.m_v1.w.x+this.m_v2.a*this.m_v2.w.x,this.m_v1.a*this.m_v1.w.y+this.m_v2.a*this.m_v2.w.y);case 3:return a.SetZero();default:return b2.ENABLE_ASSERTS&&b2.Assert(!1),a.SetZero()}};
goog.exportProperty(b2.Simplex.prototype,"GetClosestPoint",b2.Simplex.prototype.GetClosestPoint);
b2.Simplex.prototype.GetWitnessPoints=function(a,b){switch(this.m_count){case 0:b2.ENABLE_ASSERTS&&b2.Assert(!1);break;case 1:a.Copy(this.m_v1.wA);b.Copy(this.m_v1.wB);break;case 2:a.x=this.m_v1.a*this.m_v1.wA.x+this.m_v2.a*this.m_v2.wA.x;a.y=this.m_v1.a*this.m_v1.wA.y+this.m_v2.a*this.m_v2.wA.y;b.x=this.m_v1.a*this.m_v1.wB.x+this.m_v2.a*this.m_v2.wB.x;b.y=this.m_v1.a*this.m_v1.wB.y+this.m_v2.a*this.m_v2.wB.y;break;case 3:b.x=a.x=this.m_v1.a*this.m_v1.wA.x+this.m_v2.a*this.m_v2.wA.x+
this.m_v3.a*this.m_v3.wA.x;b.y=a.y=this.m_v1.a*this.m_v1.wA.y+this.m_v2.a*this.m_v2.wA.y+this.m_v3.a*this.m_v3.wA.y;break;default:b2.ENABLE_ASSERTS&&b2.Assert(!1)}};goog.exportProperty(b2.Simplex.prototype,"GetWitnessPoints",b2.Simplex.prototype.GetWitnessPoints);
b2.Simplex.prototype.GetMetric=function(){switch(this.m_count){case 0:return b2.ENABLE_ASSERTS&&b2.Assert(!1),0;case 1:return 0;case 2:return b2.Distance(this.m_v1.w,this.m_v2.w);case 3:return b2.Cross_V2_V2(b2.Sub_V2_V2(this.m_v2.w,this.m_v1.w,b2.Vec2.s_t0),b2.Sub_V2_V2(this.m_v3.w,this.m_v1.w,b2.Vec2.s_t1));default:return b2.ENABLE_ASSERTS&&b2.Assert(!1),0}};goog.exportProperty(b2.Simplex.prototype,"GetMetric",b2.Simplex.prototype.GetMetric);
b2.Simplex.prototype.Solve2=function(){var a=this.m_v1.w,b=this.m_v2.w,c=b2.Sub_V2_V2(b,a,b2.Simplex.s_e12),a=-b2.Dot_V2_V2(a,c);0>=a?this.m_count=this.m_v1.a=1:(b=b2.Dot_V2_V2(b,c),0>=b?(this.m_count=this.m_v2.a=1,this.m_v1.Copy(this.m_v2)):(c=1/(b+a),this.m_v1.a=b*c,this.m_v2.a=a*c,this.m_count=2))};goog.exportProperty(b2.Simplex.prototype,"Solve2",b2.Simplex.prototype.Solve2);
b2.Simplex.prototype.Solve3=function(){var a=this.m_v1.w,b=this.m_v2.w,c=this.m_v3.w,d=b2.Sub_V2_V2(b,a,b2.Simplex.s_e12),e=b2.Dot_V2_V2(a,d),f=b2.Dot_V2_V2(b,d),e=-e,g=b2.Sub_V2_V2(c,a,b2.Simplex.s_e13),h=b2.Dot_V2_V2(a,g),k=b2.Dot_V2_V2(c,g),h=-h,l=b2.Sub_V2_V2(c,b,b2.Simplex.s_e23),m=b2.Dot_V2_V2(b,l),l=b2.Dot_V2_V2(c,l),m=-m,g=b2.Cross_V2_V2(d,g),d=g*b2.Cross_V2_V2(b,c),c=g*b2.Cross_V2_V2(c,a),a=g*b2.Cross_V2_V2(a,
b);0>=e&&0>=h?this.m_count=this.m_v1.a=1:0<f&&0<e&&0>=a?(k=1/(f+e),this.m_v1.a=f*k,this.m_v2.a=e*k,this.m_count=2):0<k&&0<h&&0>=c?(f=1/(k+h),this.m_v1.a=k*f,this.m_v3.a=h*f,this.m_count=2,this.m_v2.Copy(this.m_v3)):0>=f&&0>=m?(this.m_count=this.m_v2.a=1,this.m_v1.Copy(this.m_v2)):0>=k&&0>=l?(this.m_count=this.m_v3.a=1,this.m_v1.Copy(this.m_v3)):0<l&&0<m&&0>=d?(f=1/(l+m),this.m_v2.a=l*f,this.m_v3.a=m*f,this.m_count=2,this.m_v1.Copy(this.m_v3)):(f=1/(d+c+a),this.m_v1.a=d*f,this.m_v2.a=c*f,this.m_v3.a=
a*f,this.m_count=3)};goog.exportProperty(b2.Simplex.prototype,"Solve3",b2.Simplex.prototype.Solve3);b2.Simplex.s_e12=new b2.Vec2;b2.Simplex.s_e13=new b2.Vec2;b2.Simplex.s_e23=new b2.Vec2;
b2.ShapeDistance=function(a,b,c){++b2._gjkCalls;var d=c.proxyA,e=c.proxyB,f=c.transformA,g=c.transformB,h=b2.Distance.s_simplex;h.ReadCache(b,d,f,e,g);for(var k=h.m_vertices,l=b2.Distance.s_saveA,m=b2.Distance.s_saveB,n=0,p=0;20>p;){for(var n=h.m_count,q=0;q<n;++q)l[q]=k[q].indexA,m[q]=k[q].indexB;switch(h.m_count){case 1:break;case 2:h.Solve2();break;case 3:h.Solve3();break;default:b2.ENABLE_ASSERTS&&b2.Assert(!1)}if(3===h.m_count)break;var r=h.GetClosestPoint(b2.Distance.s_p);
r.LengthSquared();q=h.GetSearchDirection(b2.Distance.s_d);if(q.LengthSquared()<b2._epsilon_sq)break;r=k[h.m_count];r.indexA=d.GetSupport(b2.MulT_R_V2(f.q,b2.Vec2.s_t0.Copy(q).SelfNeg(),b2.Distance.s_supportA));b2.Mul_X_V2(f,d.GetVertex(r.indexA),r.wA);r.indexB=e.GetSupport(b2.MulT_R_V2(g.q,q,b2.Distance.s_supportB));b2.Mul_X_V2(g,e.GetVertex(r.indexB),r.wB);b2.Sub_V2_V2(r.wB,r.wA,r.w);++p;++b2._gjkIters;for(var u=!1,q=0;q<n;++q)if(r.indexA===
l[q]&&r.indexB===m[q]){u=!0;break}if(u)break;++h.m_count}b2._gjkMaxIters=b2.Max(b2._gjkMaxIters,p);h.GetWitnessPoints(a.pointA,a.pointB);a.distance=b2.Distance(a.pointA,a.pointB);a.iterations=p;h.WriteCache(b);c.useRadii&&(b=d.m_radius,e=e.m_radius,a.distance>b+e&&a.distance>b2._epsilon?(a.distance-=b+e,c=b2.Sub_V2_V2(a.pointB,a.pointA,b2.Distance.s_normal),c.Normalize(),a.pointA.SelfMulAdd(b,c),a.pointB.SelfMulSub(e,c)):(r=b2.Mid_V2_V2(a.pointA,a.pointB,b2.Distance.s_p),
a.pointA.Copy(r),a.pointB.Copy(r),a.distance=0))};goog.exportSymbol("b2.ShapeDistance",b2.ShapeDistance);b2.Distance.s_simplex=new b2.Simplex;b2.Distance.s_saveA=b2.MakeNumberArray(3);b2.Distance.s_saveB=b2.MakeNumberArray(3);b2.Distance.s_p=new b2.Vec2;b2.Distance.s_d=new b2.Vec2;b2.Distance.s_normal=new b2.Vec2;b2.Distance.s_supportA=new b2.Vec2;b2.Distance.s_supportB=new b2.Vec2;b2.Collision={};b2.ContactFeatureType={e_vertex:0,e_face:1};goog.exportSymbol("b2.ContactFeatureType",b2.ContactFeatureType);goog.exportProperty(b2.ContactFeatureType,"e_vertex",b2.ContactFeatureType.e_vertex);goog.exportProperty(b2.ContactFeatureType,"e_face",b2.ContactFeatureType.e_face);b2.ContactFeature=function(){};goog.exportSymbol("b2.ContactFeature",b2.ContactFeature);b2.ContactFeature.prototype._key=0;
goog.exportProperty(b2.ContactFeature.prototype,"_key",b2.ContactFeature.prototype._key);b2.ContactFeature.prototype._key_invalid=!1;goog.exportProperty(b2.ContactFeature.prototype,"_key_invalid",b2.ContactFeature.prototype._key_invalid);b2.ContactFeature.prototype._indexA=0;goog.exportProperty(b2.ContactFeature.prototype,"_indexA",b2.ContactFeature.prototype._indexA);b2.ContactFeature.prototype._indexB=0;
goog.exportProperty(b2.ContactFeature.prototype,"_indexB",b2.ContactFeature.prototype._indexB);b2.ContactFeature.prototype._typeA=0;goog.exportProperty(b2.ContactFeature.prototype,"_typeA",b2.ContactFeature.prototype._typeA);b2.ContactFeature.prototype._typeB=0;goog.exportProperty(b2.ContactFeature.prototype,"_typeB",b2.ContactFeature.prototype._typeB);
Object.defineProperty(b2.ContactFeature.prototype,"key",{enumerable:!1,configurable:!0,get:function(){this._key_invalid&&(this._key_invalid=!1,this._key=this._indexA|this._indexB<<8|this._typeA<<16|this._typeB<<24);return this._key},set:function(a){this._key=a;this._indexA=this._key&255;this._indexB=this._key>>8&255;this._typeA=this._key>>16&255;this._typeB=this._key>>24&255}});
Object.defineProperty(b2.ContactFeature.prototype,"indexA",{enumerable:!1,configurable:!0,get:function(){return this._indexA},set:function(a){this._indexA=a;this._key_invalid=!0}});Object.defineProperty(b2.ContactFeature.prototype,"indexB",{enumerable:!1,configurable:!0,get:function(){return this._indexB},set:function(a){this._indexB=a;this._key_invalid=!0}});
Object.defineProperty(b2.ContactFeature.prototype,"typeA",{enumerable:!1,configurable:!0,get:function(){return this._typeA},set:function(a){this._typeA=a;this._key_invalid=!0}});Object.defineProperty(b2.ContactFeature.prototype,"typeB",{enumerable:!1,configurable:!0,get:function(){return this._typeB},set:function(a){this._typeB=a;this._key_invalid=!0}});b2.ContactID=function(){this.cf=new b2.ContactFeature};goog.exportSymbol("b2.ContactID",b2.ContactID);
b2.ContactID.prototype.cf=null;goog.exportProperty(b2.ContactID.prototype,"cf",b2.ContactID.prototype.cf);b2.ContactID.prototype.key=0;goog.exportProperty(b2.ContactID.prototype,"key",b2.ContactID.prototype.key);Object.defineProperty(b2.ContactID.prototype,"key",{enumerable:!1,configurable:!0,get:function(){return this.cf.key},set:function(a){this.cf.key=a}});b2.ContactID.prototype.Copy=function(a){this.key=a.key;return this};
goog.exportProperty(b2.ContactID.prototype,"Copy",b2.ContactID.prototype.Copy);b2.ContactID.prototype.Clone=function(){return(new b2.ContactID).Copy(this)};goog.exportProperty(b2.ContactID.prototype,"Clone",b2.ContactID.prototype.Clone);b2.ManifoldPoint=function(){this.localPoint=new b2.Vec2;this.id=new b2.ContactID};goog.exportSymbol("b2.ManifoldPoint",b2.ManifoldPoint);b2.ManifoldPoint.prototype.localPoint=null;
goog.exportProperty(b2.ManifoldPoint.prototype,"localPoint",b2.ManifoldPoint.prototype.localPoint);b2.ManifoldPoint.prototype.normalImpulse=0;goog.exportProperty(b2.ManifoldPoint.prototype,"normalImpulse",b2.ManifoldPoint.prototype.normalImpulse);b2.ManifoldPoint.prototype.tangentImpulse=0;goog.exportProperty(b2.ManifoldPoint.prototype,"tangentImpulse",b2.ManifoldPoint.prototype.tangentImpulse);b2.ManifoldPoint.prototype.id=null;
goog.exportProperty(b2.ManifoldPoint.prototype,"id",b2.ManifoldPoint.prototype.id);b2.ManifoldPoint.MakeArray=function(a){return b2.MakeArray(a,function(a){return new b2.ManifoldPoint})};goog.exportProperty(b2.ManifoldPoint,"MakeArray",b2.ManifoldPoint.MakeArray);b2.ManifoldPoint.prototype.Reset=function(){this.localPoint.SetZero();this.tangentImpulse=this.normalImpulse=0;this.id.key=0};goog.exportProperty(b2.ManifoldPoint.prototype,"Reset",b2.ManifoldPoint.prototype.Reset);
b2.ManifoldPoint.prototype.Copy=function(a){this.localPoint.Copy(a.localPoint);this.normalImpulse=a.normalImpulse;this.tangentImpulse=a.tangentImpulse;this.id.Copy(a.id);return this};goog.exportProperty(b2.ManifoldPoint.prototype,"Copy",b2.ManifoldPoint.prototype.Copy);b2.ManifoldType={e_unknown:-1,e_circles:0,e_faceA:1,e_faceB:2};goog.exportSymbol("b2.ManifoldType",b2.ManifoldType);goog.exportProperty(b2.ManifoldType,"e_unknown",b2.ManifoldType.e_unknown);
goog.exportProperty(b2.ManifoldType,"e_circles",b2.ManifoldType.e_circles);goog.exportProperty(b2.ManifoldType,"e_faceA",b2.ManifoldType.e_faceA);goog.exportProperty(b2.ManifoldType,"e_faceB",b2.ManifoldType.e_faceB);b2.Manifold=function(){this.points=b2.ManifoldPoint.MakeArray(b2._maxManifoldPoints);this.localNormal=new b2.Vec2;this.localPoint=new b2.Vec2;this.type=b2.ManifoldType.e_unknown;this.pointCount=0};
goog.exportSymbol("b2.Manifold",b2.Manifold);b2.Manifold.prototype.points=null;goog.exportProperty(b2.Manifold.prototype,"points",b2.Manifold.prototype.points);b2.Manifold.prototype.localNormal=null;goog.exportProperty(b2.Manifold.prototype,"localNormal",b2.Manifold.prototype.localNormal);b2.Manifold.prototype.localPoint=null;goog.exportProperty(b2.Manifold.prototype,"localPoint",b2.Manifold.prototype.localPoint);
b2.Manifold.prototype.type=b2.ManifoldType.e_unknown;goog.exportProperty(b2.Manifold.prototype,"type",b2.Manifold.prototype.type);b2.Manifold.prototype.pointCount=0;goog.exportProperty(b2.Manifold.prototype,"pointCount",b2.Manifold.prototype.pointCount);
b2.Manifold.prototype.Reset=function(){for(var a=0,b=b2._maxManifoldPoints;a<b;++a)this.points[a].Reset();this.localNormal.SetZero();this.localPoint.SetZero();this.type=b2.ManifoldType.e_unknown;this.pointCount=0};goog.exportProperty(b2.Manifold.prototype,"Reset",b2.Manifold.prototype.Reset);
b2.Manifold.prototype.Copy=function(a){this.pointCount=a.pointCount;for(var b=0,c=b2._maxManifoldPoints;b<c;++b)this.points[b].Copy(a.points[b]);this.localNormal.Copy(a.localNormal);this.localPoint.Copy(a.localPoint);this.type=a.type;return this};goog.exportProperty(b2.Manifold.prototype,"Copy",b2.Manifold.prototype.Copy);b2.Manifold.prototype.Clone=function(){return(new b2.Manifold).Copy(this)};goog.exportProperty(b2.Manifold.prototype,"Clone",b2.Manifold.prototype.Clone);
b2.WorldManifold=function(){this.normal=new b2.Vec2;this.points=b2.Vec2.MakeArray(b2._maxManifoldPoints);this.separations=b2.MakeNumberArray(b2._maxManifoldPoints)};goog.exportSymbol("b2.WorldManifold",b2.WorldManifold);b2.WorldManifold.prototype.normal=null;goog.exportProperty(b2.WorldManifold.prototype,"normal",b2.WorldManifold.prototype.normal);b2.WorldManifold.prototype.points=null;
goog.exportProperty(b2.WorldManifold.prototype,"points",b2.WorldManifold.prototype.points);b2.WorldManifold.prototype.separations=null;goog.exportProperty(b2.WorldManifold.prototype,"separations",b2.WorldManifold.prototype.separations);
b2.WorldManifold.prototype.Initialize=function(a,b,c,d,e){if(0!==a.pointCount)switch(a.type){case b2.ManifoldType.e_circles:this.normal.Set(1,0);b=b2.Mul_X_V2(b,a.localPoint,b2.WorldManifold.prototype.Initialize.s_pointA);a=b2.Mul_X_V2(d,a.points[0].localPoint,b2.WorldManifold.prototype.Initialize.s_pointB);b2.DistanceSquared(b,a)>b2._epsilon_sq&&b2.Sub_V2_V2(a,b,this.normal).SelfNormalize();var f=b2.AddMul_V2_S_V2(b,c,this.normal,b2.WorldManifold.prototype.Initialize.s_cA),
g=b2.SubMul_V2_S_V2(a,e,this.normal,b2.WorldManifold.prototype.Initialize.s_cB);b2.Mid_V2_V2(f,g,this.points[0]);this.separations[0]=b2.Dot_V2_V2(b2.Sub_V2_V2(g,f,b2.Vec2.s_t0),this.normal);break;case b2.ManifoldType.e_faceA:b2.Mul_R_V2(b.q,a.localNormal,this.normal);for(var h=b2.Mul_X_V2(b,a.localPoint,b2.WorldManifold.prototype.Initialize.s_planePoint),k=0,l=a.pointCount;k<l;++k){var m=b2.Mul_X_V2(d,a.points[k].localPoint,b2.WorldManifold.prototype.Initialize.s_clipPoint),
f=c-b2.Dot_V2_V2(b2.Sub_V2_V2(m,h,b2.Vec2.s_t0),this.normal),f=b2.AddMul_V2_S_V2(m,f,this.normal,b2.WorldManifold.prototype.Initialize.s_cA),g=b2.SubMul_V2_S_V2(m,e,this.normal,b2.WorldManifold.prototype.Initialize.s_cB);b2.Mid_V2_V2(f,g,this.points[k]);this.separations[k]=b2.Dot_V2_V2(b2.Sub_V2_V2(g,f,b2.Vec2.s_t0),this.normal)}break;case b2.ManifoldType.e_faceB:b2.Mul_R_V2(d.q,a.localNormal,this.normal);h=b2.Mul_X_V2(d,a.localPoint,
b2.WorldManifold.prototype.Initialize.s_planePoint);k=0;for(l=a.pointCount;k<l;++k)m=b2.Mul_X_V2(b,a.points[k].localPoint,b2.WorldManifold.prototype.Initialize.s_clipPoint),f=e-b2.Dot_V2_V2(b2.Sub_V2_V2(m,h,b2.Vec2.s_t0),this.normal),g=b2.AddMul_V2_S_V2(m,f,this.normal,b2.WorldManifold.prototype.Initialize.s_cB),f=b2.SubMul_V2_S_V2(m,c,this.normal,b2.WorldManifold.prototype.Initialize.s_cA),b2.Mid_V2_V2(f,g,this.points[k]),this.separations[k]=
b2.Dot_V2_V2(b2.Sub_V2_V2(f,g,b2.Vec2.s_t0),this.normal);this.normal.SelfNeg()}};goog.exportProperty(b2.WorldManifold.prototype,"Initialize",b2.WorldManifold.prototype.Initialize);b2.WorldManifold.prototype.Initialize.s_pointA=new b2.Vec2;b2.WorldManifold.prototype.Initialize.s_pointB=new b2.Vec2;b2.WorldManifold.prototype.Initialize.s_cA=new b2.Vec2;b2.WorldManifold.prototype.Initialize.s_cB=new b2.Vec2;
b2.WorldManifold.prototype.Initialize.s_planePoint=new b2.Vec2;b2.WorldManifold.prototype.Initialize.s_clipPoint=new b2.Vec2;b2.PointState={nullState:0,addState:1,persistState:2,removeState:3};goog.exportSymbol("b2.PointState",b2.PointState);goog.exportProperty(b2.PointState,"nullState   ",b2.PointState.nullState);goog.exportProperty(b2.PointState,"addState    ",b2.PointState.addState);
goog.exportProperty(b2.PointState,"persistState",b2.PointState.persistState);goog.exportProperty(b2.PointState,"removeState ",b2.PointState.removeState);
b2.GetPointStates=function(a,b,c,d){for(var e=0,f=c.pointCount;e<f;++e){var g=c.points[e].id,g=g.key;a[e]=b2.PointState.removeState;for(var h=0,k=d.pointCount;h<k;++h)if(d.points[h].id.key===g){a[e]=b2.PointState.persistState;break}}for(f=b2._maxManifoldPoints;e<f;++e)a[e]=b2.PointState.nullState;e=0;for(f=d.pointCount;e<f;++e)for(g=d.points[e].id,g=g.key,b[e]=b2.PointState.addState,h=0,k=c.pointCount;h<k;++h)if(c.points[h].id.key===g){b[e]=b2.PointState.persistState;
break}for(f=b2._maxManifoldPoints;e<f;++e)b[e]=b2.PointState.nullState};goog.exportSymbol("b2.GetPointStates",b2.GetPointStates);b2.ClipVertex=function(){this.v=new b2.Vec2;this.id=new b2.ContactID};goog.exportSymbol("b2.ClipVertex",b2.ClipVertex);b2.ClipVertex.prototype.v=null;goog.exportProperty(b2.ClipVertex.prototype,"v",b2.ClipVertex.prototype.v);b2.ClipVertex.prototype.id=null;
goog.exportProperty(b2.ClipVertex.prototype,"id",b2.ClipVertex.prototype.id);b2.ClipVertex.MakeArray=function(a){return b2.MakeArray(a,function(a){return new b2.ClipVertex})};goog.exportProperty(b2.ClipVertex,"MakeArray",b2.ClipVertex.MakeArray);b2.ClipVertex.prototype.Copy=function(a){this.v.Copy(a.v);this.id.Copy(a.id);return this};goog.exportProperty(b2.ClipVertex.prototype,"Copy",b2.ClipVertex.prototype.Copy);
b2.RayCastInput=function(){this.p1=new b2.Vec2;this.p2=new b2.Vec2;this.maxFraction=1};goog.exportSymbol("b2.RayCastInput",b2.RayCastInput);b2.RayCastInput.prototype.p1=null;goog.exportProperty(b2.RayCastInput.prototype,"p1",b2.RayCastInput.prototype.p1);b2.RayCastInput.prototype.p2=null;goog.exportProperty(b2.RayCastInput.prototype,"p2",b2.RayCastInput.prototype.p2);b2.RayCastInput.prototype.maxFraction=1;
goog.exportProperty(b2.RayCastInput.prototype,"maxFraction",b2.RayCastInput.prototype.maxFraction);b2.RayCastInput.prototype.Copy=function(a){this.p1.Copy(a.p1);this.p2.Copy(a.p2);this.maxFraction=a.maxFraction;return this};goog.exportProperty(b2.RayCastInput.prototype,"Copy",b2.RayCastInput.prototype.Copy);b2.RayCastOutput=function(){this.normal=new b2.Vec2;this.fraction=0};goog.exportSymbol("b2.RayCastOutput",b2.RayCastOutput);
b2.RayCastOutput.prototype.normal=null;goog.exportProperty(b2.RayCastOutput.prototype,"normal",b2.RayCastOutput.prototype.normal);b2.RayCastOutput.prototype.fraction=0;goog.exportProperty(b2.RayCastOutput.prototype,"fraction",b2.RayCastOutput.prototype.fraction);b2.RayCastOutput.prototype.Copy=function(a){this.normal.Copy(a.normal);this.fraction=a.fraction;return this};goog.exportProperty(b2.RayCastOutput.prototype,"Copy",b2.RayCastOutput.prototype.Copy);
b2.AABB=function(){this.lowerBound=new b2.Vec2;this.upperBound=new b2.Vec2;this.m_out_center=new b2.Vec2;this.m_out_extent=new b2.Vec2};goog.exportSymbol("b2.AABB",b2.AABB);b2.AABB.prototype.lowerBound=null;goog.exportProperty(b2.AABB.prototype,"lowerBound",b2.AABB.prototype.lowerBound);b2.AABB.prototype.upperBound=null;goog.exportProperty(b2.AABB.prototype,"upperBound",b2.AABB.prototype.upperBound);
b2.AABB.prototype.m_out_center=null;goog.exportProperty(b2.AABB.prototype,"m_out_center",b2.AABB.prototype.m_out_center);b2.AABB.prototype.m_out_extent=null;goog.exportProperty(b2.AABB.prototype,"m_out_extent",b2.AABB.prototype.m_out_extent);b2.AABB.prototype.Clone=function(){return(new b2.AABB).Copy(this)};goog.exportProperty(b2.AABB.prototype,"Clone",b2.AABB.prototype.Clone);
b2.AABB.prototype.Copy=function(a){this.lowerBound.Copy(a.lowerBound);this.upperBound.Copy(a.upperBound);return this};goog.exportProperty(b2.AABB.prototype,"Copy",b2.AABB.prototype.Copy);b2.AABB.prototype.IsValid=function(){var a=this.upperBound.y-this.lowerBound.y;return a=(a=0<=this.upperBound.x-this.lowerBound.x&&0<=a)&&this.lowerBound.IsValid()&&this.upperBound.IsValid()};goog.exportProperty(b2.AABB.prototype,"IsValid",b2.AABB.prototype.IsValid);
b2.AABB.prototype.GetCenter=function(){return b2.Mid_V2_V2(this.lowerBound,this.upperBound,this.m_out_center)};goog.exportProperty(b2.AABB.prototype,"GetCenter",b2.AABB.prototype.GetCenter);b2.AABB.prototype.GetExtents=function(){return b2.Ext_V2_V2(this.lowerBound,this.upperBound,this.m_out_extent)};goog.exportProperty(b2.AABB.prototype,"GetExtents",b2.AABB.prototype.GetExtents);
b2.AABB.prototype.GetPerimeter=function(){return 2*(this.upperBound.x-this.lowerBound.x+(this.upperBound.y-this.lowerBound.y))};goog.exportProperty(b2.AABB.prototype,"GetPerimeter",b2.AABB.prototype.GetPerimeter);b2.AABB.prototype.Combine=function(a,b){switch(arguments.length){case 1:return this.Combine1(a);case 2:return this.Combine2(a,b||new b2.AABB);default:throw Error();}};
b2.AABB.prototype.Combine1=function(a){this.lowerBound.x=b2.Min(this.lowerBound.x,a.lowerBound.x);this.lowerBound.y=b2.Min(this.lowerBound.y,a.lowerBound.y);this.upperBound.x=b2.Max(this.upperBound.x,a.upperBound.x);this.upperBound.y=b2.Max(this.upperBound.y,a.upperBound.y);return this};goog.exportProperty(b2.AABB.prototype,"Combine1",b2.AABB.prototype.Combine1);
b2.AABB.prototype.Combine2=function(a,b){this.lowerBound.x=b2.Min(a.lowerBound.x,b.lowerBound.x);this.lowerBound.y=b2.Min(a.lowerBound.y,b.lowerBound.y);this.upperBound.x=b2.Max(a.upperBound.x,b.upperBound.x);this.upperBound.y=b2.Max(a.upperBound.y,b.upperBound.y);return this};goog.exportProperty(b2.AABB.prototype,"Combine2",b2.AABB.prototype.Combine2);b2.AABB.Combine=function(a,b,c){c.Combine2(a,b);return c};goog.exportProperty(b2.AABB,"Combine",b2.AABB.Combine);
b2.AABB.prototype.Contains=function(a){var b;return b=(b=(b=(b=this.lowerBound.x<=a.lowerBound.x)&&this.lowerBound.y<=a.lowerBound.y)&&a.upperBound.x<=this.upperBound.x)&&a.upperBound.y<=this.upperBound.y};goog.exportProperty(b2.AABB.prototype,"Contains",b2.AABB.prototype.Contains);
b2.AABB.prototype.RayCast=function(a,b){var c=-b2._maxFloat,d=b2._maxFloat,e=b.p1.x,f=b.p1.y,g=b.p2.x-b.p1.x,h=b.p2.y-b.p1.y,k=b2.Abs(g),l=b2.Abs(h),m=a.normal;if(k<b2._epsilon){if(e<this.lowerBound.x||this.upperBound.x<e)return!1}else if(k=1/g,g=(this.lowerBound.x-e)*k,e=(this.upperBound.x-e)*k,k=-1,g>e&&(k=g,g=e,e=k,k=1),g>c&&(m.x=k,m.y=0,c=g),d=b2.Min(d,e),c>d)return!1;if(l<b2._epsilon){if(f<this.lowerBound.y||this.upperBound.y<f)return!1}else if(k=1/h,g=
(this.lowerBound.y-f)*k,e=(this.upperBound.y-f)*k,k=-1,g>e&&(k=g,g=e,e=k,k=1),g>c&&(m.x=0,m.y=k,c=g),d=b2.Min(d,e),c>d)return!1;if(0>c||b.maxFraction<c)return!1;a.fraction=c;return!0};goog.exportProperty(b2.AABB.prototype,"RayCast",b2.AABB.prototype.RayCast);b2.AABB.prototype.TestOverlap=function(a){var b=a.lowerBound.y-this.upperBound.y,c=this.lowerBound.y-a.upperBound.y;return 0<a.lowerBound.x-this.upperBound.x||0<b||0<this.lowerBound.x-a.upperBound.x||0<c?!1:!0};
goog.exportProperty(b2.AABB.prototype,"TestOverlap",b2.AABB.prototype.TestOverlap);b2.TestOverlap_AABB=function(a,b){var c=b.lowerBound.y-a.upperBound.y,d=a.lowerBound.y-b.upperBound.y;return 0<b.lowerBound.x-a.upperBound.x||0<c||0<a.lowerBound.x-b.upperBound.x||0<d?!1:!0};goog.exportSymbol("b2.TestOverlap_AABB",b2.TestOverlap_AABB);
b2.ClipSegmentToLine=function(a,b,c,d,e){var f=0,g=b[0];b=b[1];var h=b2.Dot_V2_V2(c,g.v)-d;c=b2.Dot_V2_V2(c,b.v)-d;0>=h&&a[f++].Copy(g);0>=c&&a[f++].Copy(b);0>h*c&&(c=h/(h-c),d=a[f].v,d.x=g.v.x+c*(b.v.x-g.v.x),d.y=g.v.y+c*(b.v.y-g.v.y),a=a[f].id,a.cf.indexA=e,a.cf.indexB=g.id.cf.indexB,a.cf.typeA=b2.ContactFeatureType.e_vertex,a.cf.typeB=b2.ContactFeatureType.e_face,++f);return f};goog.exportSymbol("b2.ClipSegmentToLine",b2.ClipSegmentToLine);
b2.TestOverlap_Shape=function(a,b,c,d,e,f){var g=b2.TestOverlap_Shape.s_input.Reset();g.proxyA.SetShape(a,b);g.proxyB.SetShape(c,d);g.transformA.Copy(e);g.transformB.Copy(f);g.useRadii=!0;a=b2.TestOverlap_Shape.s_simplexCache.Reset();a.count=0;b=b2.TestOverlap_Shape.s_output.Reset();b2.ShapeDistance(b,a,g);return b.distance<10*b2._epsilon};goog.exportSymbol("b2.TestOverlap_Shape",b2.TestOverlap_Shape);b2.TestOverlap_Shape.s_input=new b2.DistanceInput;
b2.TestOverlap_Shape.s_simplexCache=new b2.SimplexCache;b2.TestOverlap_Shape.s_output=new b2.DistanceOutput;b2.TestOverlap=function(a,b,c,d,e,f){if(a instanceof b2.AABB&&b instanceof b2.AABB)return b2.TestOverlap_AABB(a,b);if(a instanceof b2.Shape&&"number"===typeof b&&c instanceof b2.Shape&&"number"===typeof d&&e instanceof b2.Transform&&f instanceof b2.Transform)return b2.TestOverlap_Shape(a,b,c,d,e,f);throw Error();};
goog.exportSymbol("b2.TestOverlap",b2.TestOverlap);b2.CollideCircle={};b2.CollideCircles=function(a,b,c,d,e){a.pointCount=0;c=b2.Mul_X_V2(c,b.m_p,b2.CollideCircles.s_pA);e=b2.Mul_X_V2(e,d.m_p,b2.CollideCircles.s_pB);e=b2.DistanceSquared(c,e);c=b.m_radius+d.m_radius;e>c*c||(a.type=b2.ManifoldType.e_circles,a.localPoint.Copy(b.m_p),a.localNormal.SetZero(),a.pointCount=1,a.points[0].localPoint.Copy(d.m_p),a.points[0].id.key=0)};goog.exportSymbol("b2.CollideCircles",b2.CollideCircles);
b2.CollideCircles.s_pA=new b2.Vec2;b2.CollideCircles.s_pB=new b2.Vec2;
b2.CollidePolygonAndCircle=function(a,b,c,d,e){a.pointCount=0;e=b2.Mul_X_V2(e,d.m_p,b2.CollidePolygonAndCircle.s_c);c=b2.MulT_X_V2(c,e,b2.CollidePolygonAndCircle.s_cLocal);var f=0,g=-b2._maxFloat;e=b.m_radius+d.m_radius;var h=b.m_count,k=b.m_vertices;b=b.m_normals;for(var l=0;l<h;++l){var m=b2.Dot_V2_V2(b[l],b2.Sub_V2_V2(c,k[l],b2.Vec2.s_t0));if(m>e)return;m>g&&(g=m,f=l)}l=f;m=k[l];h=k[(l+1)%h];g<b2._epsilon?(a.pointCount=1,a.type=b2.ManifoldType.e_faceA,
a.localNormal.Copy(b[f]),b2.Mid_V2_V2(m,h,a.localPoint),a.points[0].localPoint.Copy(d.m_p),a.points[0].id.key=0):(g=b2.Dot_V2_V2(b2.Sub_V2_V2(c,m,b2.Vec2.s_t0),b2.Sub_V2_V2(h,m,b2.Vec2.s_t1)),f=b2.Dot_V2_V2(b2.Sub_V2_V2(c,h,b2.Vec2.s_t0),b2.Sub_V2_V2(m,h,b2.Vec2.s_t1)),0>=g?b2.DistanceSquared(c,m)>e*e||(a.pointCount=1,a.type=b2.ManifoldType.e_faceA,b2.Sub_V2_V2(c,m,a.localNormal).SelfNormalize(),a.localPoint.Copy(m),a.points[0].localPoint.Copy(d.m_p),
a.points[0].id.key=0):0>=f?b2.DistanceSquared(c,h)>e*e||(a.pointCount=1,a.type=b2.ManifoldType.e_faceA,b2.Sub_V2_V2(c,h,a.localNormal).SelfNormalize(),a.localPoint.Copy(h),a.points[0].localPoint.Copy(d.m_p),a.points[0].id.key=0):(f=b2.Mid_V2_V2(m,h,b2.CollidePolygonAndCircle.s_faceCenter),g=b2.Dot_V2_V2(b2.Sub_V2_V2(c,f,b2.Vec2.s_t1),b[l]),g>e||(a.pointCount=1,a.type=b2.ManifoldType.e_faceA,a.localNormal.Copy(b[l]).SelfNormalize(),a.localPoint.Copy(f),
a.points[0].localPoint.Copy(d.m_p),a.points[0].id.key=0)))};goog.exportSymbol("b2.CollidePolygonAndCircle",b2.CollidePolygonAndCircle);b2.CollidePolygonAndCircle.s_c=new b2.Vec2;b2.CollidePolygonAndCircle.s_cLocal=new b2.Vec2;b2.CollidePolygonAndCircle.s_faceCenter=new b2.Vec2;b2.CollideEdge={};
b2.CollideEdgeAndCircle=function(a,b,c,d,e){a.pointCount=0;c=b2.MulT_X_V2(c,b2.Mul_X_V2(e,d.m_p,b2.Vec2.s_t0),b2.CollideEdgeAndCircle.s_Q);var f=b.m_vertex1,g=b.m_vertex2,h=b2.Sub_V2_V2(g,f,b2.CollideEdgeAndCircle.s_e),k=b2.Dot_V2_V2(h,b2.Sub_V2_V2(g,c,b2.Vec2.s_t0)),l=b2.Dot_V2_V2(h,b2.Sub_V2_V2(c,f,b2.Vec2.s_t0)),m=b.m_radius+d.m_radius;e=b2.CollideEdgeAndCircle.s_id;e.cf.indexB=0;e.cf.typeB=b2.ContactFeatureType.e_vertex;if(0>=
l){var n=f,k=b2.Sub_V2_V2(c,n,b2.CollideEdgeAndCircle.s_d),k=b2.Dot_V2_V2(k,k);if(!(k>m*m)){if(b.m_hasVertex0&&(b=b2.Sub_V2_V2(f,b.m_vertex0,b2.CollideEdgeAndCircle.s_e1),0<b2.Dot_V2_V2(b,b2.Sub_V2_V2(f,c,b2.Vec2.s_t0))))return;e.cf.indexA=0;e.cf.typeA=b2.ContactFeatureType.e_vertex;a.pointCount=1;a.type=b2.ManifoldType.e_circles;a.localNormal.SetZero();a.localPoint.Copy(n);a.points[0].id.Copy(e);a.points[0].localPoint.Copy(d.m_p)}}else if(0>=k){if(n=
g,k=b2.Sub_V2_V2(c,n,b2.CollideEdgeAndCircle.s_d),k=b2.Dot_V2_V2(k,k),!(k>m*m)){if(b.m_hasVertex3&&(f=b2.Sub_V2_V2(b.m_vertex3,g,b2.CollideEdgeAndCircle.s_e2),0<b2.Dot_V2_V2(f,b2.Sub_V2_V2(c,g,b2.Vec2.s_t0))))return;e.cf.indexA=1;e.cf.typeA=b2.ContactFeatureType.e_vertex;a.pointCount=1;a.type=b2.ManifoldType.e_circles;a.localNormal.SetZero();a.localPoint.Copy(n);a.points[0].id.Copy(e);a.points[0].localPoint.Copy(d.m_p)}}else b=b2.Dot_V2_V2(h,
h),b2.ENABLE_ASSERTS&&b2.Assert(0<b),n=b2.CollideEdgeAndCircle.s_P,n.x=1/b*(k*f.x+l*g.x),n.y=1/b*(k*f.y+l*g.y),k=b2.Sub_V2_V2(c,n,b2.CollideEdgeAndCircle.s_d),k=b2.Dot_V2_V2(k,k),k>m*m||(n=b2.CollideEdgeAndCircle.s_n.Set(-h.y,h.x),0>b2.Dot_V2_V2(n,b2.Sub_V2_V2(c,f,b2.Vec2.s_t0))&&n.Set(-n.x,-n.y),n.Normalize(),e.cf.indexA=0,e.cf.typeA=b2.ContactFeatureType.e_face,a.pointCount=1,a.type=b2.ManifoldType.e_faceA,a.localNormal.Copy(n),a.localPoint.Copy(f),
a.points[0].id.Copy(e),a.points[0].localPoint.Copy(d.m_p))};goog.exportSymbol("b2.CollideEdgeAndCircle",b2.CollideEdgeAndCircle);b2.CollideEdgeAndCircle.s_Q=new b2.Vec2;b2.CollideEdgeAndCircle.s_e=new b2.Vec2;b2.CollideEdgeAndCircle.s_d=new b2.Vec2;b2.CollideEdgeAndCircle.s_e1=new b2.Vec2;b2.CollideEdgeAndCircle.s_e2=new b2.Vec2;b2.CollideEdgeAndCircle.s_P=new b2.Vec2;b2.CollideEdgeAndCircle.s_n=new b2.Vec2;
b2.CollideEdgeAndCircle.s_id=new b2.ContactID;b2.EPAxisType={e_unknown:0,e_edgeA:1,e_edgeB:2};goog.exportSymbol("b2.EPAxisType",b2.EPAxisType);goog.exportProperty(b2.EPAxisType,"e_unknown",b2.EPAxisType.e_unknown);goog.exportProperty(b2.EPAxisType,"e_edgeA",b2.EPAxisType.e_edgeA);goog.exportProperty(b2.EPAxisType,"e_edgeB",b2.EPAxisType.e_edgeB);b2.EPAxis=function(){};goog.exportSymbol("b2.EPAxis",b2.EPAxis);
b2.EPAxis.prototype.type=b2.EPAxisType.e_unknown;goog.exportProperty(b2.EPAxis.prototype,"type",b2.EPAxis.prototype.type);b2.EPAxis.prototype.index=0;goog.exportProperty(b2.EPAxis.prototype,"index",b2.EPAxis.prototype.index);b2.EPAxis.prototype.separation=0;goog.exportProperty(b2.EPAxis.prototype,"separation",b2.EPAxis.prototype.separation);
b2.TempPolygon=function(){this.vertices=b2.Vec2.MakeArray(b2._maxPolygonVertices);this.normals=b2.Vec2.MakeArray(b2._maxPolygonVertices);this.count=0};goog.exportSymbol("b2.TempPolygon",b2.TempPolygon);b2.TempPolygon.prototype.vertices=null;goog.exportProperty(b2.TempPolygon.prototype,"vertices",b2.TempPolygon.prototype.vertices);b2.TempPolygon.prototype.normals=null;goog.exportProperty(b2.TempPolygon.prototype,"normals",b2.TempPolygon.prototype.normals);
b2.TempPolygon.prototype.count=0;goog.exportProperty(b2.TempPolygon.prototype,"count",b2.TempPolygon.prototype.count);b2.ReferenceFace=function(){this.i2=this.i1=0;this.v1=new b2.Vec2;this.v2=new b2.Vec2;this.normal=new b2.Vec2;this.sideNormal1=new b2.Vec2;this.sideOffset1=0;this.sideNormal2=new b2.Vec2;this.sideOffset2=0};goog.exportSymbol("b2.ReferenceFace",b2.ReferenceFace);b2.ReferenceFace.prototype.i1=0;
goog.exportProperty(b2.ReferenceFace.prototype,"i1",b2.ReferenceFace.prototype.i1);b2.ReferenceFace.prototype.i2=0;goog.exportProperty(b2.ReferenceFace.prototype,"i2",b2.ReferenceFace.prototype.i2);b2.ReferenceFace.prototype.v1=null;goog.exportProperty(b2.ReferenceFace.prototype,"v1",b2.ReferenceFace.prototype.v1);b2.ReferenceFace.prototype.v2=null;goog.exportProperty(b2.ReferenceFace.prototype,"v2",b2.ReferenceFace.prototype.v2);
b2.ReferenceFace.prototype.normal=null;goog.exportProperty(b2.ReferenceFace.prototype,"normal",b2.ReferenceFace.prototype.normal);b2.ReferenceFace.prototype.sideNormal1=null;goog.exportProperty(b2.ReferenceFace.prototype,"sideNormal1",b2.ReferenceFace.prototype.sideNormal1);b2.ReferenceFace.prototype.sideOffset1=0;goog.exportProperty(b2.ReferenceFace.prototype,"sideOffset1",b2.ReferenceFace.prototype.sideOffset1);
b2.ReferenceFace.prototype.sideNormal2=null;goog.exportProperty(b2.ReferenceFace.prototype,"sideNormal2",b2.ReferenceFace.prototype.sideNormal2);b2.ReferenceFace.prototype.sideOffset2=0;goog.exportProperty(b2.ReferenceFace.prototype,"sideOffset2",b2.ReferenceFace.prototype.sideOffset2);b2.EPColliderVertexType={e_isolated:0,e_concave:1,e_convex:2};goog.exportSymbol("b2.EPColliderVertexType",b2.EPColliderVertexType);
goog.exportProperty(b2.EPColliderVertexType,"e_isolated",b2.EPColliderVertexType.e_isolated);goog.exportProperty(b2.EPColliderVertexType,"e_concave",b2.EPColliderVertexType.e_concave);goog.exportProperty(b2.EPColliderVertexType,"e_convex",b2.EPColliderVertexType.e_convex);
b2.EPCollider=function(){this.m_polygonB=new b2.TempPolygon;this.m_xf=new b2.Transform;this.m_centroidB=new b2.Vec2;this.m_v0=new b2.Vec2;this.m_v1=new b2.Vec2;this.m_v2=new b2.Vec2;this.m_v3=new b2.Vec2;this.m_normal0=new b2.Vec2;this.m_normal1=new b2.Vec2;this.m_normal2=new b2.Vec2;this.m_normal=new b2.Vec2;this.m_type2=this.m_type1=b2.EPColliderVertexType.e_isolated;this.m_lowerLimit=new b2.Vec2;this.m_upperLimit=new b2.Vec2;
this.m_radius=0;this.m_front=!1};goog.exportSymbol("b2.EPCollider",b2.EPCollider);b2.EPCollider.prototype.m_polygonB=null;goog.exportProperty(b2.EPCollider.prototype,"m_polygonB",b2.EPCollider.prototype.m_polygonB);b2.EPCollider.prototype.m_xf=null;goog.exportProperty(b2.EPCollider.prototype,"m_xf",b2.EPCollider.prototype.m_xf);b2.EPCollider.prototype.m_centroidB=null;goog.exportProperty(b2.EPCollider.prototype,"m_centroidB",b2.EPCollider.prototype.m_centroidB);
b2.EPCollider.prototype.m_v0=null;goog.exportProperty(b2.EPCollider.prototype,"m_v0",b2.EPCollider.prototype.m_v0);b2.EPCollider.prototype.m_v1=null;goog.exportProperty(b2.EPCollider.prototype,"m_v1",b2.EPCollider.prototype.m_v1);b2.EPCollider.prototype.m_v2=null;goog.exportProperty(b2.EPCollider.prototype,"m_v2",b2.EPCollider.prototype.m_v2);b2.EPCollider.prototype.m_v3=null;goog.exportProperty(b2.EPCollider.prototype,"m_v3",b2.EPCollider.prototype.m_v3);
b2.EPCollider.prototype.m_normal0=null;goog.exportProperty(b2.EPCollider.prototype,"m_normal0",b2.EPCollider.prototype.m_normal0);b2.EPCollider.prototype.m_normal1=null;goog.exportProperty(b2.EPCollider.prototype,"m_normal1",b2.EPCollider.prototype.m_normal1);b2.EPCollider.prototype.m_normal2=null;goog.exportProperty(b2.EPCollider.prototype,"m_normal2",b2.EPCollider.prototype.m_normal2);b2.EPCollider.prototype.m_normal=null;
goog.exportProperty(b2.EPCollider.prototype,"m_normal",b2.EPCollider.prototype.m_normal);b2.EPCollider.prototype.m_type1=b2.EPColliderVertexType.e_isolated;goog.exportProperty(b2.EPCollider.prototype,"m_type1",b2.EPCollider.prototype.m_type1);b2.EPCollider.prototype.m_type2=b2.EPColliderVertexType.e_isolated;goog.exportProperty(b2.EPCollider.prototype,"m_type2",b2.EPCollider.prototype.m_type2);b2.EPCollider.prototype.m_lowerLimit=null;
goog.exportProperty(b2.EPCollider.prototype,"m_lowerLimit",b2.EPCollider.prototype.m_lowerLimit);b2.EPCollider.prototype.m_upperLimit=null;goog.exportProperty(b2.EPCollider.prototype,"m_upperLimit",b2.EPCollider.prototype.m_upperLimit);b2.EPCollider.prototype.m_radius=0;goog.exportProperty(b2.EPCollider.prototype,"m_radius",b2.EPCollider.prototype.m_radius);b2.EPCollider.prototype.m_front=!1;goog.exportProperty(b2.EPCollider.prototype,"m_front",b2.EPCollider.prototype.m_front);
b2.EPCollider.prototype.Collide=function(a,b,c,d,e){b2.MulT_X_X(c,e,this.m_xf);b2.Mul_X_V2(this.m_xf,d.m_centroid,this.m_centroidB);this.m_v0.Copy(b.m_vertex0);this.m_v1.Copy(b.m_vertex1);this.m_v2.Copy(b.m_vertex2);this.m_v3.Copy(b.m_vertex3);c=b.m_hasVertex0;b=b.m_hasVertex3;e=b2.Sub_V2_V2(this.m_v2,this.m_v1,b2.EPCollider.s_edge1);e.Normalize();this.m_normal1.Set(e.y,-e.x);var f=b2.Dot_V2_V2(this.m_normal1,b2.Sub_V2_V2(this.m_centroidB,this.m_v1,b2.Vec2.s_t0)),
g=0,h=0,k=!1,l=!1;c&&(g=b2.Sub_V2_V2(this.m_v1,this.m_v0,b2.EPCollider.s_edge0),g.Normalize(),this.m_normal0.Set(g.y,-g.x),k=0<=b2.Cross_V2_V2(g,e),g=b2.Dot_V2_V2(this.m_normal0,b2.Sub_V2_V2(this.m_centroidB,this.m_v0,b2.Vec2.s_t0)));b&&(h=b2.Sub_V2_V2(this.m_v3,this.m_v2,b2.EPCollider.s_edge2),h.Normalize(),this.m_normal2.Set(h.y,-h.x),l=0<b2.Cross_V2_V2(e,h),h=b2.Dot_V2_V2(this.m_normal2,b2.Sub_V2_V2(this.m_centroidB,this.m_v2,b2.Vec2.s_t0)));
c&&b?k&&l?(this.m_front=0<=g||0<=f||0<=h)?(this.m_normal.Copy(this.m_normal1),this.m_lowerLimit.Copy(this.m_normal0),this.m_upperLimit.Copy(this.m_normal2)):(this.m_normal.Copy(this.m_normal1).SelfNeg(),this.m_lowerLimit.Copy(this.m_normal1).SelfNeg(),this.m_upperLimit.Copy(this.m_normal1).SelfNeg()):k?(this.m_front=0<=g||0<=f&&0<=h)?(this.m_normal.Copy(this.m_normal1),this.m_lowerLimit.Copy(this.m_normal0),this.m_upperLimit.Copy(this.m_normal1)):(this.m_normal.Copy(this.m_normal1).SelfNeg(),this.m_lowerLimit.Copy(this.m_normal2).SelfNeg(),
this.m_upperLimit.Copy(this.m_normal1).SelfNeg()):l?(this.m_front=0<=h||0<=g&&0<=f)?(this.m_normal.Copy(this.m_normal1),this.m_lowerLimit.Copy(this.m_normal1),this.m_upperLimit.Copy(this.m_normal2)):(this.m_normal.Copy(this.m_normal1).SelfNeg(),this.m_lowerLimit.Copy(this.m_normal1).SelfNeg(),this.m_upperLimit.Copy(this.m_normal0).SelfNeg()):(this.m_front=0<=g&&0<=f&&0<=h)?(this.m_normal.Copy(this.m_normal1),this.m_lowerLimit.Copy(this.m_normal1),this.m_upperLimit.Copy(this.m_normal1)):(this.m_normal.Copy(this.m_normal1).SelfNeg(),
this.m_lowerLimit.Copy(this.m_normal2).SelfNeg(),this.m_upperLimit.Copy(this.m_normal0).SelfNeg()):c?k?((this.m_front=0<=g||0<=f)?(this.m_normal.Copy(this.m_normal1),this.m_lowerLimit.Copy(this.m_normal0)):(this.m_normal.Copy(this.m_normal1).SelfNeg(),this.m_lowerLimit.Copy(this.m_normal1)),this.m_upperLimit.Copy(this.m_normal1).SelfNeg()):(this.m_front=0<=g&&0<=f)?(this.m_normal.Copy(this.m_normal1),this.m_lowerLimit.Copy(this.m_normal1),this.m_upperLimit.Copy(this.m_normal1).SelfNeg()):(this.m_normal.Copy(this.m_normal1).SelfNeg(),
this.m_lowerLimit.Copy(this.m_normal1),this.m_upperLimit.Copy(this.m_normal0).SelfNeg()):b?l?(this.m_front=0<=f||0<=h)?(this.m_normal.Copy(this.m_normal1),this.m_lowerLimit.Copy(this.m_normal1).SelfNeg(),this.m_upperLimit.Copy(this.m_normal2)):(this.m_normal.Copy(this.m_normal1).SelfNeg(),this.m_lowerLimit.Copy(this.m_normal1).SelfNeg(),this.m_upperLimit.Copy(this.m_normal1)):((this.m_front=0<=f&&0<=h)?(this.m_normal.Copy(this.m_normal1),this.m_lowerLimit.Copy(this.m_normal1).SelfNeg()):(this.m_normal.Copy(this.m_normal1).SelfNeg(),
this.m_lowerLimit.Copy(this.m_normal2).SelfNeg()),this.m_upperLimit.Copy(this.m_normal1)):(this.m_front=0<=f)?(this.m_normal.Copy(this.m_normal1),this.m_lowerLimit.Copy(this.m_normal1).SelfNeg(),this.m_upperLimit.Copy(this.m_normal1).SelfNeg()):(this.m_normal.Copy(this.m_normal1).SelfNeg(),this.m_lowerLimit.Copy(this.m_normal1),this.m_upperLimit.Copy(this.m_normal1));this.m_polygonB.count=d.m_count;f=0;for(g=d.m_count;f<g;++f)b2.Mul_X_V2(this.m_xf,d.m_vertices[f],this.m_polygonB.vertices[f]),
b2.Mul_R_V2(this.m_xf.q,d.m_normals[f],this.m_polygonB.normals[f]);this.m_radius=2*b2._polygonRadius;a.pointCount=0;c=this.ComputeEdgeSeparation(b2.EPCollider.s_edgeAxis);if(!(c.type===b2.EPAxisType.e_unknown||c.separation>this.m_radius||(b=this.ComputePolygonSeparation(b2.EPCollider.s_polygonAxis),b.type!==b2.EPAxisType.e_unknown&&b.separation>this.m_radius))){c=b.type===b2.EPAxisType.e_unknown?c:b.separation>.98*c.separation+.001?b:c;e=b2.EPCollider.s_ie;
b=b2.EPCollider.s_rf;if(c.type===b2.EPAxisType.e_edgeA){a.type=b2.ManifoldType.e_faceA;h=0;k=b2.Dot_V2_V2(this.m_normal,this.m_polygonB.normals[0]);f=1;for(g=this.m_polygonB.count;f<g;++f)l=b2.Dot_V2_V2(this.m_normal,this.m_polygonB.normals[f]),l<k&&(k=l,h=f);g=h;f=(g+1)%this.m_polygonB.count;h=e[0];h.v.Copy(this.m_polygonB.vertices[g]);h.id.cf.indexA=0;h.id.cf.indexB=g;h.id.cf.typeA=b2.ContactFeatureType.e_face;h.id.cf.typeB=b2.ContactFeatureType.e_vertex;g=e[1];
g.v.Copy(this.m_polygonB.vertices[f]);g.id.cf.indexA=0;g.id.cf.indexB=f;g.id.cf.typeA=b2.ContactFeatureType.e_face;g.id.cf.typeB=b2.ContactFeatureType.e_vertex;this.m_front?(b.i1=0,b.i2=1,b.v1.Copy(this.m_v1),b.v2.Copy(this.m_v2),b.normal.Copy(this.m_normal1)):(b.i1=1,b.i2=0,b.v1.Copy(this.m_v2),b.v2.Copy(this.m_v1),b.normal.Copy(this.m_normal1).SelfNeg())}else a.type=b2.ManifoldType.e_faceB,h=e[0],h.v.Copy(this.m_v1),h.id.cf.indexA=0,h.id.cf.indexB=c.index,h.id.cf.typeA=b2.ContactFeatureType.e_vertex,
h.id.cf.typeB=b2.ContactFeatureType.e_face,g=e[1],g.v.Copy(this.m_v2),g.id.cf.indexA=0,g.id.cf.indexB=c.index,g.id.cf.typeA=b2.ContactFeatureType.e_vertex,g.id.cf.typeB=b2.ContactFeatureType.e_face,b.i1=c.index,b.i2=(b.i1+1)%this.m_polygonB.count,b.v1.Copy(this.m_polygonB.vertices[b.i1]),b.v2.Copy(this.m_polygonB.vertices[b.i2]),b.normal.Copy(this.m_polygonB.normals[b.i1]);b.sideNormal1.Set(b.normal.y,-b.normal.x);b.sideNormal2.Copy(b.sideNormal1).SelfNeg();b.sideOffset1=b2.Dot_V2_V2(b.sideNormal1,
b.v1);b.sideOffset2=b2.Dot_V2_V2(b.sideNormal2,b.v2);f=b2.EPCollider.s_clipPoints1;h=b2.EPCollider.s_clipPoints2;g=0;g=b2.ClipSegmentToLine(f,e,b.sideNormal1,b.sideOffset1,b.i1);if(!(g<b2._maxManifoldPoints||(g=b2.ClipSegmentToLine(h,f,b.sideNormal2,b.sideOffset2,b.i2),g<b2._maxManifoldPoints))){c.type===b2.EPAxisType.e_edgeA?(a.localNormal.Copy(b.normal),a.localPoint.Copy(b.v1)):(a.localNormal.Copy(d.m_normals[b.i1]),a.localPoint.Copy(d.m_vertices[b.i1]));
f=d=0;for(g=b2._maxManifoldPoints;f<g;++f)b2.Dot_V2_V2(b.normal,b2.Sub_V2_V2(h[f].v,b.v1,b2.Vec2.s_t0))<=this.m_radius&&(e=a.points[d],c.type===b2.EPAxisType.e_edgeA?(b2.MulT_X_V2(this.m_xf,h[f].v,e.localPoint),e.id=h[f].id):(e.localPoint.Copy(h[f].v),e.id.cf.typeA=h[f].id.cf.typeB,e.id.cf.typeB=h[f].id.cf.typeA,e.id.cf.indexA=h[f].id.cf.indexB,e.id.cf.indexB=h[f].id.cf.indexA),++d);a.pointCount=d}}};goog.exportProperty(b2.EPCollider.prototype,"Collide",b2.EPCollider.prototype.Collide);
b2.EPCollider.s_edge1=new b2.Vec2;b2.EPCollider.s_edge0=new b2.Vec2;b2.EPCollider.s_edge2=new b2.Vec2;b2.EPCollider.s_ie=b2.ClipVertex.MakeArray(2);b2.EPCollider.s_rf=new b2.ReferenceFace;b2.EPCollider.s_clipPoints1=b2.ClipVertex.MakeArray(2);b2.EPCollider.s_clipPoints2=b2.ClipVertex.MakeArray(2);b2.EPCollider.s_edgeAxis=new b2.EPAxis;b2.EPCollider.s_polygonAxis=new b2.EPAxis;
b2.EPCollider.prototype.ComputeEdgeSeparation=function(a){a.type=b2.EPAxisType.e_edgeA;a.index=this.m_front?0:1;a.separation=b2._maxFloat;for(var b=0,c=this.m_polygonB.count;b<c;++b){var d=b2.Dot_V2_V2(this.m_normal,b2.Sub_V2_V2(this.m_polygonB.vertices[b],this.m_v1,b2.Vec2.s_t0));d<a.separation&&(a.separation=d)}return a};goog.exportProperty(b2.EPCollider.prototype,"ComputeEdgeSeparation",b2.EPCollider.prototype.ComputeEdgeSeparation);
b2.EPCollider.prototype.ComputePolygonSeparation=function(a){a.type=b2.EPAxisType.e_unknown;a.index=-1;a.separation=-b2._maxFloat;for(var b=b2.EPCollider.s_perp.Set(-this.m_normal.y,this.m_normal.x),c=0,d=this.m_polygonB.count;c<d;++c){var e=b2.EPCollider.s_n.Copy(this.m_polygonB.normals[c]).SelfNeg(),f=b2.Dot_V2_V2(e,b2.Sub_V2_V2(this.m_polygonB.vertices[c],this.m_v1,b2.Vec2.s_t0)),g=b2.Dot_V2_V2(e,b2.Sub_V2_V2(this.m_polygonB.vertices[c],this.m_v2,
b2.Vec2.s_t0)),f=b2.Min(f,g);if(f>this.m_radius){a.type=b2.EPAxisType.e_edgeB;a.index=c;a.separation=f;break}if(0<=b2.Dot_V2_V2(e,b)){if(b2.Dot_V2_V2(b2.Sub_V2_V2(e,this.m_upperLimit,b2.Vec2.s_t0),this.m_normal)<-b2._angularSlop)continue}else if(b2.Dot_V2_V2(b2.Sub_V2_V2(e,this.m_lowerLimit,b2.Vec2.s_t0),this.m_normal)<-b2._angularSlop)continue;f>a.separation&&(a.type=b2.EPAxisType.e_edgeB,a.index=c,a.separation=f)}return a};
goog.exportProperty(b2.EPCollider.prototype,"ComputePolygonSeparation",b2.EPCollider.prototype.ComputePolygonSeparation);b2.EPCollider.s_n=new b2.Vec2;b2.EPCollider.s_perp=new b2.Vec2;b2.CollideEdgeAndPolygon=function(a,b,c,d,e){b2.CollideEdgeAndPolygon.s_collider.Collide(a,b,c,d,e)};goog.exportSymbol("b2.CollideEdgeAndPolygon",b2.CollideEdgeAndPolygon);b2.CollideEdgeAndPolygon.s_collider=new b2.EPCollider;b2.CollidePolygon={};
b2.FindMaxSeparation=function(a,b,c,d,e){var f=b.m_count,g=d.m_count,h=b.m_normals;b=b.m_vertices;d=d.m_vertices;c=b2.MulT_X_X(e,c,b2.FindMaxSeparation.s_xf);e=0;for(var k=-b2._maxFloat,l=0;l<f;++l){for(var m=b2.Mul_R_V2(c.q,h[l],b2.FindMaxSeparation.s_n),n=b2.Mul_X_V2(c,b[l],b2.FindMaxSeparation.s_v1),p=b2._maxFloat,q=0;q<g;++q){var r=b2.Dot_V2_V2(m,b2.Sub_V2_V2(d[q],n,b2.Vec2.s_t0));r<p&&(p=r)}p>k&&(k=p,e=l)}a[0]=e;return k};
goog.exportSymbol("b2.FindMaxSeparation",b2.FindMaxSeparation);b2.FindMaxSeparation.s_xf=new b2.Transform;b2.FindMaxSeparation.s_n=new b2.Vec2;b2.FindMaxSeparation.s_v1=new b2.Vec2;
b2.FindIncidentEdge=function(a,b,c,d,e,f){var g=b.m_count,h=b.m_normals,k=e.m_count;b=e.m_vertices;e=e.m_normals;b2.ENABLE_ASSERTS&&b2.Assert(0<=d&&d<g);c=b2.MulT_R_V2(f.q,b2.Mul_R_V2(c.q,h[d],b2.Vec2.s_t0),b2.FindIncidentEdge.s_normal1);for(var g=0,h=b2._maxFloat,l=0;l<k;++l){var m=b2.Dot_V2_V2(c,e[l]);m<h&&(h=m,g=l)}e=g;k=(e+1)%k;c=a[0];b2.Mul_X_V2(f,b[e],c.v);c=c.id.cf;c.indexA=d;c.indexB=e;c.typeA=b2.ContactFeatureType.e_face;c.typeB=b2.ContactFeatureType.e_vertex;
a=a[1];b2.Mul_X_V2(f,b[k],a.v);f=a.id.cf;f.indexA=d;f.indexB=k;f.typeA=b2.ContactFeatureType.e_face;f.typeB=b2.ContactFeatureType.e_vertex};goog.exportSymbol("b2.FindIncidentEdge",b2.FindIncidentEdge);b2.FindIncidentEdge.s_normal1=new b2.Vec2;
b2.CollidePolygons=function(a,b,c,d,e){a.pointCount=0;var f=b.m_radius+d.m_radius,g=b2.CollidePolygons.s_edgeA;g[0]=0;var h=b2.FindMaxSeparation(g,b,c,d,e);if(!(h>f)){var k=b2.CollidePolygons.s_edgeB;k[0]=0;var l=b2.FindMaxSeparation(k,d,e,b,c);if(!(l>f)){var m=0,n=0;l>.98*h+.001?(h=d,d=b,b=e,m=k[0],a.type=b2.ManifoldType.e_faceB,n=1):(h=b,b=c,c=e,m=g[0],a.type=b2.ManifoldType.e_faceA,n=0);g=b2.CollidePolygons.s_incidentEdge;b2.FindIncidentEdge(g,h,b,m,
d,c);e=h.m_vertices;var k=m,h=(m+1)%h.m_count,p=e[k],q=e[h],m=b2.Sub_V2_V2(q,p,b2.CollidePolygons.s_localTangent);m.Normalize();e=b2.Cross_V2_S(m,1,b2.CollidePolygons.s_localNormal);d=b2.Mid_V2_V2(p,q,b2.CollidePolygons.s_planePoint);var l=b2.Mul_R_V2(b.q,m,b2.CollidePolygons.s_tangent),m=b2.Cross_V2_S(l,1,b2.CollidePolygons.s_normal),p=b2.Mul_X_V2(b,p,b2.CollidePolygons.s_v11),r=b2.Mul_X_V2(b,q,b2.CollidePolygons.s_v12);b=b2.Dot_V2_V2(m,
p);var q=-b2.Dot_V2_V2(l,p)+f,r=b2.Dot_V2_V2(l,r)+f,u=b2.CollidePolygons.s_clipPoints1,p=b2.CollidePolygons.s_clipPoints2,t=b2.CollidePolygons.s_ntangent.Copy(l).SelfNeg(),g=b2.ClipSegmentToLine(u,g,t,q,k);if(!(2>g||(g=b2.ClipSegmentToLine(p,u,l,r,h),2>g))){a.localNormal.Copy(e);a.localPoint.Copy(d);for(k=g=0;k<b2._maxManifoldPoints;++k)e=p[k],b2.Dot_V2_V2(m,e.v)-b<=f&&(h=a.points[g],b2.MulT_X_V2(c,e.v,h.localPoint),h.id.Copy(e.id),n&&(e=h.id.cf,h.id.cf.indexA=
e.indexB,h.id.cf.indexB=e.indexA,h.id.cf.typeA=e.typeB,h.id.cf.typeB=e.typeA),++g);a.pointCount=g}}}};goog.exportSymbol("b2.CollidePolygons",b2.CollidePolygons);b2.CollidePolygons.s_incidentEdge=b2.ClipVertex.MakeArray(2);b2.CollidePolygons.s_clipPoints1=b2.ClipVertex.MakeArray(2);b2.CollidePolygons.s_clipPoints2=b2.ClipVertex.MakeArray(2);b2.CollidePolygons.s_edgeA=b2.MakeNumberArray(1);b2.CollidePolygons.s_edgeB=b2.MakeNumberArray(1);
b2.CollidePolygons.s_localTangent=new b2.Vec2;b2.CollidePolygons.s_localNormal=new b2.Vec2;b2.CollidePolygons.s_planePoint=new b2.Vec2;b2.CollidePolygons.s_normal=new b2.Vec2;b2.CollidePolygons.s_tangent=new b2.Vec2;b2.CollidePolygons.s_ntangent=new b2.Vec2;b2.CollidePolygons.s_v11=new b2.Vec2;b2.CollidePolygons.s_v12=new b2.Vec2;b2.TreeNode=function(a){this.m_id=a||0;this.aabb=new b2.AABB};goog.exportSymbol("b2.TreeNode",b2.TreeNode);b2.TreeNode.prototype.m_id=0;goog.exportProperty(b2.TreeNode.prototype,"m_id",b2.TreeNode.prototype.m_id);b2.TreeNode.prototype.aabb=null;goog.exportProperty(b2.TreeNode.prototype,"aabb",b2.TreeNode.prototype.aabb);b2.TreeNode.prototype.userData=null;goog.exportProperty(b2.TreeNode.prototype,"userData",b2.TreeNode.prototype.userData);
b2.TreeNode.prototype.parent=null;goog.exportProperty(b2.TreeNode.prototype,"parent",b2.TreeNode.prototype.parent);b2.TreeNode.prototype.child1=null;goog.exportProperty(b2.TreeNode.prototype,"child1",b2.TreeNode.prototype.child1);b2.TreeNode.prototype.child2=null;goog.exportProperty(b2.TreeNode.prototype,"child2",b2.TreeNode.prototype.child2);b2.TreeNode.prototype.height=0;goog.exportProperty(b2.TreeNode.prototype,"height",b2.TreeNode.prototype.height);
b2.TreeNode.prototype.IsLeaf=function(){return null===this.child1};goog.exportProperty(b2.TreeNode.prototype,"IsLeaf",b2.TreeNode.prototype.IsLeaf);b2.DynamicTree=function(){};goog.exportSymbol("b2.DynamicTree",b2.DynamicTree);b2.DynamicTree.prototype.m_root=null;goog.exportProperty(b2.DynamicTree.prototype,"m_root",b2.DynamicTree.prototype.m_root);b2.DynamicTree.prototype.m_freeList=null;
goog.exportProperty(b2.DynamicTree.prototype,"m_freeList",b2.DynamicTree.prototype.m_freeList);b2.DynamicTree.prototype.m_path=0;goog.exportProperty(b2.DynamicTree.prototype,"m_path",b2.DynamicTree.prototype.m_path);b2.DynamicTree.prototype.m_insertionCount=0;goog.exportProperty(b2.DynamicTree.prototype,"m_insertionCount",b2.DynamicTree.prototype.m_insertionCount);b2.DynamicTree.s_stack=new b2.GrowableStack(256);b2.DynamicTree.s_r=new b2.Vec2;
b2.DynamicTree.s_v=new b2.Vec2;b2.DynamicTree.s_abs_v=new b2.Vec2;b2.DynamicTree.s_segmentAABB=new b2.AABB;b2.DynamicTree.s_subInput=new b2.RayCastInput;b2.DynamicTree.s_combinedAABB=new b2.AABB;b2.DynamicTree.s_aabb=new b2.AABB;b2.DynamicTree.prototype.GetUserData=function(a){b2.ENABLE_ASSERTS&&b2.Assert(null!==a);return a.userData};goog.exportProperty(b2.DynamicTree.prototype,"GetUserData",b2.DynamicTree.prototype.GetUserData);
b2.DynamicTree.prototype.GetFatAABB=function(a){b2.ENABLE_ASSERTS&&b2.Assert(null!==a);return a.aabb};goog.exportProperty(b2.DynamicTree.prototype,"GetFatAABB",b2.DynamicTree.prototype.GetFatAABB);b2.DynamicTree.prototype.Query=function(a,b){if(null!==this.m_root){var c=b2.DynamicTree.s_stack.Reset();for(c.Push(this.m_root);0<c.GetCount();){var d=c.Pop();if(null!==d&&d.aabb.TestOverlap(b))if(d.IsLeaf()){if(!a(d))break}else c.Push(d.child1),c.Push(d.child2)}}};
goog.exportProperty(b2.DynamicTree.prototype,"Query",b2.DynamicTree.prototype.Query);
b2.DynamicTree.prototype.RayCast=function(a,b){if(null!==this.m_root){var c=b.p1,d=b.p2,e=b2.Sub_V2_V2(d,c,b2.DynamicTree.s_r);b2.ENABLE_ASSERTS&&b2.Assert(0<e.LengthSquared());e.Normalize();var e=b2.Cross_S_V2(1,e,b2.DynamicTree.s_v),f=b2.Abs_V2(e,b2.DynamicTree.s_abs_v),g=b.maxFraction,h=b2.DynamicTree.s_segmentAABB,k=c.x+g*(d.x-c.x),l=c.y+g*(d.y-c.y);h.lowerBound.x=b2.Min(c.x,k);h.lowerBound.y=b2.Min(c.y,l);h.upperBound.x=b2.Max(c.x,
k);h.upperBound.y=b2.Max(c.y,l);var m=b2.DynamicTree.s_stack.Reset();for(m.Push(this.m_root);0<m.GetCount();)if(k=m.Pop(),null!==k&&b2.TestOverlap_AABB(k.aabb,h)){var l=k.aabb.GetCenter(),n=k.aabb.GetExtents();if(!(0<b2.Abs(b2.Dot_V2_V2(e,b2.Sub_V2_V2(c,l,b2.Vec2.s_t0)))-b2.Dot_V2_V2(f,n)))if(k.IsLeaf()){l=b2.DynamicTree.s_subInput;l.p1.Copy(b.p1);l.p2.Copy(b.p2);l.maxFraction=g;k=a(l,k);if(0===k)break;0<k&&(g=k,k=c.x+g*(d.x-c.x),l=c.y+g*(d.y-c.y),h.lowerBound.x=
b2.Min(c.x,k),h.lowerBound.y=b2.Min(c.y,l),h.upperBound.x=b2.Max(c.x,k),h.upperBound.y=b2.Max(c.y,l))}else m.Push(k.child1),m.Push(k.child2)}}};goog.exportProperty(b2.DynamicTree.prototype,"RayCast",b2.DynamicTree.prototype.RayCast);b2.DynamicTree.prototype.AllocateNode=function(){if(this.m_freeList){var a=this.m_freeList;this.m_freeList=a.parent;a.parent=null;a.child1=null;a.child2=null;a.height=0;a.userData=null;return a}return new b2.TreeNode(b2.DynamicTree.prototype.s_node_id++)};
goog.exportProperty(b2.DynamicTree.prototype,"AllocateNode",b2.DynamicTree.prototype.AllocateNode);b2.DynamicTree.prototype.s_node_id=0;b2.DynamicTree.prototype.FreeNode=function(a){a.parent=this.m_freeList;a.height=-1;this.m_freeList=a};goog.exportProperty(b2.DynamicTree.prototype,"FreeNode",b2.DynamicTree.prototype.FreeNode);
b2.DynamicTree.prototype.CreateProxy=function(a,b){var c=this.AllocateNode(),d=b2._aabbExtension,e=b2._aabbExtension;c.aabb.lowerBound.x=a.lowerBound.x-d;c.aabb.lowerBound.y=a.lowerBound.y-e;c.aabb.upperBound.x=a.upperBound.x+d;c.aabb.upperBound.y=a.upperBound.y+e;c.userData=b;c.height=0;this.InsertLeaf(c);return c};goog.exportProperty(b2.DynamicTree.prototype,"CreateProxy",b2.DynamicTree.prototype.CreateProxy);
b2.DynamicTree.prototype.DestroyProxy=function(a){b2.ENABLE_ASSERTS&&b2.Assert(a.IsLeaf());this.RemoveLeaf(a);this.FreeNode(a)};goog.exportProperty(b2.DynamicTree.prototype,"DestroyProxy",b2.DynamicTree.prototype.DestroyProxy);
b2.DynamicTree.prototype.MoveProxy=function(a,b,c){b2.ENABLE_ASSERTS&&b2.Assert(a.IsLeaf());if(a.aabb.Contains(b))return!1;this.RemoveLeaf(a);var d=b2._aabbExtension+b2._aabbMultiplier*(0<c.x?c.x:-c.x);c=b2._aabbExtension+b2._aabbMultiplier*(0<c.y?c.y:-c.y);a.aabb.lowerBound.x=b.lowerBound.x-d;a.aabb.lowerBound.y=b.lowerBound.y-c;a.aabb.upperBound.x=b.upperBound.x+d;a.aabb.upperBound.y=b.upperBound.y+c;this.InsertLeaf(a);return!0};
goog.exportProperty(b2.DynamicTree.prototype,"MoveProxy",b2.DynamicTree.prototype.MoveProxy);
b2.DynamicTree.prototype.InsertLeaf=function(a){++this.m_insertionCount;if(null===this.m_root)this.m_root=a,this.m_root.parent=null;else{var b=a.aabb;b.GetCenter();for(var c=this.m_root,d,e;!c.IsLeaf();){d=c.child1;e=c.child2;var f=c.aabb.GetPerimeter(),g=b2.DynamicTree.s_combinedAABB;g.Combine2(c.aabb,b);var h=g.GetPerimeter(),g=2*h,h=2*(h-f),k=b2.DynamicTree.s_aabb,l,m;d.IsLeaf()?(k.Combine2(b,d.aabb),f=k.GetPerimeter()+h):(k.Combine2(b,d.aabb),l=d.aabb.GetPerimeter(),m=k.GetPerimeter(),
f=m-l+h);e.IsLeaf()?(k.Combine2(b,e.aabb),h=k.GetPerimeter()+h):(k.Combine2(b,e.aabb),l=e.aabb.GetPerimeter(),m=k.GetPerimeter(),h=m-l+h);if(g<f&&g<h)break;c=f<h?d:e}d=c.parent;e=this.AllocateNode();e.parent=d;e.userData=null;e.aabb.Combine2(b,c.aabb);e.height=c.height+1;d?(d.child1===c?d.child1=e:d.child2=e,e.child1=c,e.child2=a,c.parent=e,a.parent=e):(e.child1=c,e.child2=a,c.parent=e,this.m_root=a.parent=e);for(c=a.parent;null!==c;)c=this.Balance(c),d=c.child1,e=c.child2,b2.ENABLE_ASSERTS&&b2.Assert(null!==
d),b2.ENABLE_ASSERTS&&b2.Assert(null!==e),c.height=1+b2.Max(d.height,e.height),c.aabb.Combine2(d.aabb,e.aabb),c=c.parent}};goog.exportProperty(b2.DynamicTree.prototype,"InsertLeaf",b2.DynamicTree.prototype.InsertLeaf);
b2.DynamicTree.prototype.RemoveLeaf=function(a){if(a===this.m_root)this.m_root=null;else{var b=a.parent,c=b.parent;a=b.child1===a?b.child2:b.child1;if(c)for(c.child1===b?c.child1=a:c.child2=a,a.parent=c,this.FreeNode(b),b=c;b;)b=this.Balance(b),c=b.child1,a=b.child2,b.aabb.Combine2(c.aabb,a.aabb),b.height=1+b2.Max(c.height,a.height),b=b.parent;else this.m_root=a,a.parent=null,this.FreeNode(b)}};goog.exportProperty(b2.DynamicTree.prototype,"RemoveLeaf",b2.DynamicTree.prototype.RemoveLeaf);
b2.DynamicTree.prototype.Balance=function(a){b2.ENABLE_ASSERTS&&b2.Assert(null!==a);if(a.IsLeaf()||2>a.height)return a;var b=a.child1,c=a.child2,d=c.height-b.height;if(1<d){var d=c.child1,e=c.child2;c.child1=a;c.parent=a.parent;a.parent=c;null!==c.parent?c.parent.child1===a?c.parent.child1=c:(b2.ENABLE_ASSERTS&&b2.Assert(c.parent.child2===a),c.parent.child2=c):this.m_root=c;d.height>e.height?(c.child2=d,a.child2=e,e.parent=a,a.aabb.Combine2(b.aabb,e.aabb),c.aabb.Combine2(a.aabb,
d.aabb),a.height=1+b2.Max(b.height,e.height),c.height=1+b2.Max(a.height,d.height)):(c.child2=e,a.child2=d,d.parent=a,a.aabb.Combine2(b.aabb,d.aabb),c.aabb.Combine2(a.aabb,e.aabb),a.height=1+b2.Max(b.height,d.height),c.height=1+b2.Max(a.height,e.height));return c}return-1>d?(d=b.child1,e=b.child2,b.child1=a,b.parent=a.parent,a.parent=b,null!==b.parent?b.parent.child1===a?b.parent.child1=b:(b2.ENABLE_ASSERTS&&b2.Assert(b.parent.child2===a),b.parent.child2=b):this.m_root=
b,d.height>e.height?(b.child2=d,a.child1=e,e.parent=a,a.aabb.Combine2(c.aabb,e.aabb),b.aabb.Combine2(a.aabb,d.aabb),a.height=1+b2.Max(c.height,e.height),b.height=1+b2.Max(a.height,d.height)):(b.child2=e,a.child1=d,d.parent=a,a.aabb.Combine2(c.aabb,d.aabb),b.aabb.Combine2(a.aabb,e.aabb),a.height=1+b2.Max(c.height,d.height),b.height=1+b2.Max(a.height,e.height)),b):a};goog.exportProperty(b2.DynamicTree.prototype,"Balance",b2.DynamicTree.prototype.Balance);
b2.DynamicTree.prototype.GetHeight=function(){return null===this.m_root?0:this.m_root.height};goog.exportProperty(b2.DynamicTree.prototype,"GetHeight",b2.DynamicTree.prototype.GetHeight);b2.DynamicTree.prototype.GetAreaRatio=function(){if(null===this.m_root)return 0;var a=this.m_root.aabb.GetPerimeter(),b=function(a){if(null===a||a.IsLeaf())return 0;var d=a.aabb.GetPerimeter(),d=d+b(a.child1);return d+=b(a.child2)};return b(this.m_root)/a};
goog.exportProperty(b2.DynamicTree.prototype,"GetAreaRatio",b2.DynamicTree.prototype.GetAreaRatio);b2.DynamicTree.prototype.ComputeHeightNode=function(a){if(a.IsLeaf())return 0;var b=this.ComputeHeightNode(a.child1);a=this.ComputeHeightNode(a.child2);return 1+b2.Max(b,a)};goog.exportProperty(b2.DynamicTree.prototype,"ComputeHeightNode",b2.DynamicTree.prototype.ComputeHeightNode);b2.DynamicTree.prototype.ComputeHeight=function(){return this.ComputeHeightNode(this.m_root)};
goog.exportProperty(b2.DynamicTree.prototype,"ComputeHeight",b2.DynamicTree.prototype.ComputeHeight);
b2.DynamicTree.prototype.ValidateStructure=function(a){if(null!==a){a===this.m_root&&b2.ENABLE_ASSERTS&&b2.Assert(null===a.parent);var b=a.child1,c=a.child2;a.IsLeaf()?(b2.ENABLE_ASSERTS&&b2.Assert(null===b),b2.ENABLE_ASSERTS&&b2.Assert(null===c),b2.ENABLE_ASSERTS&&b2.Assert(0===a.height)):(b2.ENABLE_ASSERTS&&b2.Assert(b.parent===a),b2.ENABLE_ASSERTS&&b2.Assert(c.parent===a),this.ValidateStructure(b),this.ValidateStructure(c))}};
goog.exportProperty(b2.DynamicTree.prototype,"ValidateStructure",b2.DynamicTree.prototype.ValidateStructure);
b2.DynamicTree.prototype.ValidateMetrics=function(a){if(null!==a){var b=a.child1,c=a.child2;if(a.IsLeaf())b2.ENABLE_ASSERTS&&b2.Assert(null===b),b2.ENABLE_ASSERTS&&b2.Assert(null===c),b2.ENABLE_ASSERTS&&b2.Assert(0===a.height);else{var d;d=1+b2.Max(b.height,c.height);b2.ENABLE_ASSERTS&&b2.Assert(a.height===d);d=b2.DynamicTree.s_aabb;d.Combine2(b.aabb,c.aabb);b2.ENABLE_ASSERTS&&b2.Assert(d.lowerBound===a.aabb.lowerBound);b2.ENABLE_ASSERTS&&
b2.Assert(d.upperBound===a.aabb.upperBound);this.ValidateMetrics(b);this.ValidateMetrics(c)}}};goog.exportProperty(b2.DynamicTree.prototype,"ValidateMetrics",b2.DynamicTree.prototype.ValidateMetrics);b2.DynamicTree.prototype.Validate=function(){this.ValidateStructure(this.m_root);this.ValidateMetrics(this.m_root);for(var a=0,b=this.m_freeList;null!==b;)b=b.parent,++a;b2.ENABLE_ASSERTS&&b2.Assert(this.GetHeight()===this.ComputeHeight())};
goog.exportProperty(b2.DynamicTree.prototype,"Validate",b2.DynamicTree.prototype.Validate);b2.DynamicTree.prototype.GetMaxBalance=function(){var a;a=this.m_root;null===a?a=0:1>=a.height?a=0:(b2.ENABLE_ASSERTS&&b2.Assert(!a.IsLeaf()),a=b2.Abs(a.child2.height-a.child1.height),a=b2.Max(0,a));return a};goog.exportProperty(b2.DynamicTree.prototype,"GetMaxBalance",b2.DynamicTree.prototype.GetMaxBalance);b2.DynamicTree.prototype.RebuildBottomUp=function(){this.Validate()};
goog.exportProperty(b2.DynamicTree.prototype,"RebuildBottomUp",b2.DynamicTree.prototype.RebuildBottomUp);b2.DynamicTree.prototype.ShiftOrigin=function(a){var b=function(a,d){if(null!==a&&!(1>=a.height)){b2.ENABLE_ASSERTS&&b2.Assert(!a.IsLeaf());var e=a.child2;b(a.child1,d);b(e,d);a.aabb.lowerBound.SelfSub(d);a.aabb.upperBound.SelfSub(d)}};b(this.m_root,a)};goog.exportProperty(b2.DynamicTree.prototype,"ShiftOrigin",b2.DynamicTree.prototype.ShiftOrigin);b2.Pair=function(){};goog.exportSymbol("b2.Pair",b2.Pair);b2.Pair.prototype.proxyA=null;goog.exportProperty(b2.Pair.prototype,"proxyA",b2.Pair.prototype.proxyA);b2.Pair.prototype.proxyB=null;goog.exportProperty(b2.Pair.prototype,"proxyB",b2.Pair.prototype.proxyB);b2.BroadPhase=function(){this.m_tree=new b2.DynamicTree;this.m_moveBuffer=[];this.m_pairBuffer=[]};goog.exportSymbol("b2.BroadPhase",b2.BroadPhase);
b2.BroadPhase.prototype.m_tree=null;goog.exportProperty(b2.BroadPhase.prototype,"m_tree",b2.BroadPhase.prototype.m_tree);b2.BroadPhase.prototype.m_proxyCount=0;goog.exportProperty(b2.BroadPhase.prototype,"m_proxyCount",b2.BroadPhase.prototype.m_proxyCount);b2.BroadPhase.prototype.m_moveCount=0;goog.exportProperty(b2.BroadPhase.prototype,"m_moveCount",b2.BroadPhase.prototype.m_moveCount);b2.BroadPhase.prototype.m_moveBuffer=null;
goog.exportProperty(b2.BroadPhase.prototype,"m_moveBuffer",b2.BroadPhase.prototype.m_moveBuffer);b2.BroadPhase.prototype.m_pairCount=0;goog.exportProperty(b2.BroadPhase.prototype,"m_pairCount",b2.BroadPhase.prototype.m_pairCount);b2.BroadPhase.prototype.m_pairBuffer=null;goog.exportProperty(b2.BroadPhase.prototype,"m_pairBuffer",b2.BroadPhase.prototype.m_pairBuffer);
b2.BroadPhase.prototype.CreateProxy=function(a,b){var c=this.m_tree.CreateProxy(a,b);++this.m_proxyCount;this.BufferMove(c);return c};goog.exportProperty(b2.BroadPhase.prototype,"CreateProxy",b2.BroadPhase.prototype.CreateProxy);b2.BroadPhase.prototype.DestroyProxy=function(a){this.UnBufferMove(a);--this.m_proxyCount;this.m_tree.DestroyProxy(a)};goog.exportProperty(b2.BroadPhase.prototype,"DestroyProxy",b2.BroadPhase.prototype.DestroyProxy);
b2.BroadPhase.prototype.MoveProxy=function(a,b,c){this.m_tree.MoveProxy(a,b,c)&&this.BufferMove(a)};goog.exportProperty(b2.BroadPhase.prototype,"MoveProxy",b2.BroadPhase.prototype.MoveProxy);b2.BroadPhase.prototype.TouchProxy=function(a){this.BufferMove(a)};goog.exportProperty(b2.BroadPhase.prototype,"TouchProxy",b2.BroadPhase.prototype.TouchProxy);b2.BroadPhase.prototype.GetFatAABB=function(a){return this.m_tree.GetFatAABB(a)};
goog.exportProperty(b2.BroadPhase.prototype,"GetFatAABB",b2.BroadPhase.prototype.GetFatAABB);b2.BroadPhase.prototype.GetUserData=function(a){return this.m_tree.GetUserData(a)};goog.exportProperty(b2.BroadPhase.prototype,"GetUserData",b2.BroadPhase.prototype.GetUserData);b2.BroadPhase.prototype.TestOverlap=function(a,b){var c=this.m_tree.GetFatAABB(a),d=this.m_tree.GetFatAABB(b);return b2.TestOverlap_AABB(c,d)};
goog.exportProperty(b2.BroadPhase.prototype,"TestOverlap",b2.BroadPhase.prototype.TestOverlap);b2.BroadPhase.prototype.GetProxyCount=function(){return this.m_proxyCount};goog.exportProperty(b2.BroadPhase.prototype,"GetProxyCount",b2.BroadPhase.prototype.GetProxyCount);b2.BroadPhase.prototype.GetTreeHeight=function(){return this.m_tree.GetHeight()};goog.exportProperty(b2.BroadPhase.prototype,"GetTreeHeight",b2.BroadPhase.prototype.GetTreeHeight);
b2.BroadPhase.prototype.GetTreeBalance=function(){return this.m_tree.GetMaxBalance()};goog.exportProperty(b2.BroadPhase.prototype,"GetTreeBalance",b2.BroadPhase.prototype.GetTreeBalance);b2.BroadPhase.prototype.GetTreeQuality=function(){return this.m_tree.GetAreaRatio()};goog.exportProperty(b2.BroadPhase.prototype,"GetTreeQuality",b2.BroadPhase.prototype.GetTreeQuality);b2.BroadPhase.prototype.ShiftOrigin=function(a){this.m_tree.ShiftOrigin(a)};
goog.exportProperty(b2.BroadPhase.prototype,"ShiftOrigin",b2.BroadPhase.prototype.ShiftOrigin);
b2.BroadPhase.prototype.UpdatePairs=function(a){for(var b=this.m_pairCount=0;b<this.m_moveCount;++b){var c=this.m_moveBuffer[b];if(null!==c){var d=this,e=this.m_tree.GetFatAABB(c);this.m_tree.Query(function(a){if(a.m_id===c.m_id)return!0;d.m_pairCount===d.m_pairBuffer.length&&(d.m_pairBuffer[d.m_pairCount]=new b2.Pair);var b=d.m_pairBuffer[d.m_pairCount];a.m_id<c.m_id?(b.proxyA=a,b.proxyB=c):(b.proxyA=c,b.proxyB=a);++d.m_pairCount;return!0},e)}}this.m_moveCount=0;this.m_pairBuffer.length=
this.m_pairCount;this.m_pairBuffer.sort(b2.PairLessThan);for(b=0;b<this.m_pairCount;){var e=this.m_pairBuffer[b],f=this.m_tree.GetUserData(e.proxyA),g=this.m_tree.GetUserData(e.proxyB);a.AddPair(f,g);for(++b;b<this.m_pairCount;){f=this.m_pairBuffer[b];if(f.proxyA.m_id!==e.proxyA.m_id||f.proxyB.m_id!==e.proxyB.m_id)break;++b}}};goog.exportProperty(b2.BroadPhase.prototype,"UpdatePairs",b2.BroadPhase.prototype.UpdatePairs);
b2.BroadPhase.prototype.Query=function(a,b){this.m_tree.Query(a,b)};goog.exportProperty(b2.BroadPhase.prototype,"Query",b2.BroadPhase.prototype.Query);b2.BroadPhase.prototype.RayCast=function(a,b){this.m_tree.RayCast(a,b)};goog.exportProperty(b2.BroadPhase.prototype,"RayCast",b2.BroadPhase.prototype.RayCast);b2.BroadPhase.prototype.BufferMove=function(a){this.m_moveBuffer[this.m_moveCount]=a;++this.m_moveCount};
goog.exportProperty(b2.BroadPhase.prototype,"BufferMove",b2.BroadPhase.prototype.BufferMove);b2.BroadPhase.prototype.UnBufferMove=function(a){a=this.m_moveBuffer.indexOf(a);this.m_moveBuffer[a]=null};goog.exportProperty(b2.BroadPhase.prototype,"UnBufferMove",b2.BroadPhase.prototype.UnBufferMove);b2.PairLessThan=function(a,b){return a.proxyA.m_id===b.proxyA.m_id?a.proxyB.m_id-b.proxyB.m_id:a.proxyA.m_id-b.proxyA.m_id};b2.MassData=function(){this.center=new b2.Vec2(0,0)};goog.exportSymbol("b2.MassData",b2.MassData);b2.MassData.prototype.mass=0;goog.exportProperty(b2.MassData.prototype,"mass",b2.MassData.prototype.mass);b2.MassData.prototype.center=null;goog.exportProperty(b2.MassData.prototype,"center",b2.MassData.prototype.center);b2.MassData.prototype.I=0;goog.exportProperty(b2.MassData.prototype,"I",b2.MassData.prototype.I);
b2.ShapeType={e_unknown:-1,e_circleShape:0,e_edgeShape:1,e_polygonShape:2,e_chainShape:3,e_shapeTypeCount:4};goog.exportSymbol("b2.ShapeType",b2.ShapeType);goog.exportProperty(b2.ShapeType,"e_unknown",b2.ShapeType.e_unknown);goog.exportProperty(b2.ShapeType,"e_circleShape",b2.ShapeType.e_circleShape);goog.exportProperty(b2.ShapeType,"e_edgeShape",b2.ShapeType.e_edgeShape);goog.exportProperty(b2.ShapeType,"e_polygonShape",b2.ShapeType.e_polygonShape);
goog.exportProperty(b2.ShapeType,"e_chainShape",b2.ShapeType.e_chainShape);goog.exportProperty(b2.ShapeType,"e_shapeTypeCount",b2.ShapeType.e_shapeTypeCount);b2.Shape=function(a,b){this.m_type=a;this.m_radius=b};goog.exportSymbol("b2.Shape",b2.Shape);b2.Shape.prototype.m_type=b2.ShapeType.e_unknown;goog.exportProperty(b2.Shape.prototype,"m_type",b2.Shape.prototype.m_type);b2.Shape.prototype.m_radius=0;
goog.exportProperty(b2.Shape.prototype,"m_radius",b2.Shape.prototype.m_radius);b2.Shape.prototype.Clone=function(){b2.ENABLE_ASSERTS&&b2.Assert(!1);return null};goog.exportProperty(b2.Shape.prototype,"Clone",b2.Shape.prototype.Clone);b2.Shape.prototype.Copy=function(a){b2.ENABLE_ASSERTS&&b2.Assert(this.m_type===a.m_type);this.m_radius=a.m_radius;return this};goog.exportProperty(b2.Shape.prototype,"Copy",b2.Shape.prototype.Copy);
b2.Shape.prototype.GetType=function(){return this.m_type};goog.exportProperty(b2.Shape.prototype,"GetType",b2.Shape.prototype.GetType);b2.Shape.prototype.GetChildCount=function(){b2.ENABLE_ASSERTS&&b2.Assert(!1,"pure virtual");return 0};goog.exportProperty(b2.Shape.prototype,"GetChildCount",b2.Shape.prototype.GetChildCount);b2.Shape.prototype.TestPoint=function(a,b){b2.ENABLE_ASSERTS&&b2.Assert(!1,"pure virtual");return!1};
goog.exportProperty(b2.Shape.prototype,"TestPoint",b2.Shape.prototype.TestPoint);b2.Shape.prototype.ComputeDistance=function(a,b,c,d){b2.ENABLE_ASSERTS&&b2.Assert(!1,"pure virtual");return 0};goog.exportProperty(b2.Shape.prototype,"ComputeDistance",b2.Shape.prototype.ComputeDistance);b2.Shape.prototype.RayCast=function(a,b,c,d){b2.ENABLE_ASSERTS&&b2.Assert(!1,"pure virtual");return!1};goog.exportProperty(b2.Shape.prototype,"RayCast",b2.Shape.prototype.RayCast);
b2.Shape.prototype.ComputeAABB=function(a,b,c){b2.ENABLE_ASSERTS&&b2.Assert(!1,"pure virtual")};goog.exportProperty(b2.Shape.prototype,"ComputeAABB",b2.Shape.prototype.ComputeAABB);b2.Shape.prototype.ComputeMass=function(a,b){b2.ENABLE_ASSERTS&&b2.Assert(!1,"pure virtual")};goog.exportProperty(b2.Shape.prototype,"ComputeMass",b2.Shape.prototype.ComputeMass);
b2.Shape.prototype.SetupDistanceProxy=function(a,b){b2.ENABLE_ASSERTS&&b2.Assert(!1,"pure virtual")};b2.Shape.prototype.ComputeSubmergedArea=function(a,b,c,d){b2.ENABLE_ASSERTS&&b2.Assert(!1,"pure virtual");return 0};goog.exportProperty(b2.Shape.prototype,"ComputeSubmergedArea",b2.Shape.prototype.ComputeSubmergedArea);b2.Shape.prototype.Dump=function(){b2.ENABLE_ASSERTS&&b2.Assert(!1,"pure virtual")};
goog.exportProperty(b2.Shape.prototype,"Dump",b2.Shape.prototype.Dump);b2.CircleShape=function(a){b2.Shape.call(this,b2.ShapeType.e_circleShape,a||0);this.m_p=new b2.Vec2};goog.inherits(b2.CircleShape,b2.Shape);goog.exportSymbol("b2.CircleShape",b2.CircleShape);b2.CircleShape.prototype.m_p=null;goog.exportProperty(b2.CircleShape.prototype,"m_p",b2.CircleShape.prototype.m_p);b2.CircleShape.prototype.Clone=function(){return(new b2.CircleShape).Copy(this)};
goog.exportProperty(b2.CircleShape.prototype,"Clone",b2.CircleShape.prototype.Clone);b2.CircleShape.prototype.Copy=function(a){b2.Shape.prototype.Copy.call(this,a);b2.ENABLE_ASSERTS&&b2.Assert(a instanceof b2.CircleShape);this.m_p.Copy(a.m_p);return this};goog.exportProperty(b2.CircleShape.prototype,"Copy",b2.CircleShape.prototype.Copy);b2.CircleShape.prototype.GetChildCount=function(){return 1};
goog.exportProperty(b2.CircleShape.prototype,"GetChildCount",b2.CircleShape.prototype.GetChildCount);b2.CircleShape.prototype.TestPoint=function(a,b){var c=b2.Mul_X_V2(a,this.m_p,b2.CircleShape.prototype.TestPoint.s_center),c=b2.Sub_V2_V2(b,c,b2.CircleShape.prototype.TestPoint.s_d);return b2.Dot_V2_V2(c,c)<=b2.Sq(this.m_radius)};goog.exportProperty(b2.CircleShape.prototype,"TestPoint",b2.CircleShape.prototype.TestPoint);
b2.CircleShape.prototype.TestPoint.s_center=new b2.Vec2;b2.CircleShape.prototype.TestPoint.s_d=new b2.Vec2;b2.CircleShape.prototype.ComputeDistance=function(a,b,c,d){a=b2.Mul_X_V2(a,this.m_p,b2.CircleShape.prototype.ComputeDistance.s_center);b2.Sub_V2_V2(b,a,c);return c.Normalize()-this.m_radius};goog.exportProperty(b2.CircleShape.prototype,"ComputeDistance",b2.CircleShape.prototype.ComputeDistance);
b2.CircleShape.prototype.ComputeDistance.s_center=new b2.Vec2;
b2.CircleShape.prototype.RayCast=function(a,b,c,d){c=b2.Mul_X_V2(c,this.m_p,b2.CircleShape.prototype.RayCast.s_position);c=b2.Sub_V2_V2(b.p1,c,b2.CircleShape.prototype.RayCast.s_s);var e=b2.Dot_V2_V2(c,c)-b2.Sq(this.m_radius);d=b2.Sub_V2_V2(b.p2,b.p1,b2.CircleShape.prototype.RayCast.s_r);var f=b2.Dot_V2_V2(c,d),g=b2.Dot_V2_V2(d,d),e=f*f-g*e;if(0>e||g<b2._epsilon)return!1;f=-(f+b2.Sqrt(e));return 0<=f&&f<=b.maxFraction*g?(f/=g,a.fraction=
f,b2.AddMul_V2_S_V2(c,f,d,a.normal).SelfNormalize(),!0):!1};goog.exportProperty(b2.CircleShape.prototype,"RayCast",b2.CircleShape.prototype.RayCast);b2.CircleShape.prototype.RayCast.s_position=new b2.Vec2;b2.CircleShape.prototype.RayCast.s_s=new b2.Vec2;b2.CircleShape.prototype.RayCast.s_r=new b2.Vec2;
b2.CircleShape.prototype.ComputeAABB=function(a,b,c){b=b2.Mul_X_V2(b,this.m_p,b2.CircleShape.prototype.ComputeAABB.s_p);a.lowerBound.Set(b.x-this.m_radius,b.y-this.m_radius);a.upperBound.Set(b.x+this.m_radius,b.y+this.m_radius)};goog.exportProperty(b2.CircleShape.prototype,"ComputeAABB",b2.CircleShape.prototype.ComputeAABB);b2.CircleShape.prototype.ComputeAABB.s_p=new b2.Vec2;
b2.CircleShape.prototype.ComputeMass=function(a,b){var c=b2.Sq(this.m_radius);a.mass=b*b2._pi*c;a.center.Copy(this.m_p);a.I=a.mass*(.5*c+b2.Dot_V2_V2(this.m_p,this.m_p))};goog.exportProperty(b2.CircleShape.prototype,"ComputeMass",b2.CircleShape.prototype.ComputeMass);b2.CircleShape.prototype.SetupDistanceProxy=function(a,b){a.m_vertices=a.m_buffer;a.m_vertices[0].Copy(this.m_p);a.m_count=1;a.m_radius=this.m_radius};
b2.CircleShape.prototype.ComputeSubmergedArea=function(a,b,c,d){c=b2.Mul_X_V2(c,this.m_p,new b2.Vec2);var e=-(b2.Dot_V2_V2(a,c)-b);if(e<-this.m_radius+b2._epsilon)return 0;if(e>this.m_radius)return d.Copy(c),b2._pi*this.m_radius*this.m_radius;b=this.m_radius*this.m_radius;var f=e*e,e=b*(b2.Asin(e/this.m_radius)+b2._pi/2)+e*b2.Sqrt(b-f);b=-2/3*b2.Pow(b-f,1.5)/e;d.x=c.x+a.x*b;d.y=c.y+a.y*b;return e};
goog.exportProperty(b2.CircleShape.prototype,"ComputeSubmergedArea",b2.CircleShape.prototype.ComputeSubmergedArea);b2.CircleShape.prototype.Dump=function(){b2.Log("    /*b2.CircleShape*/ var shape = new b2.CircleShape();\n");b2.Log("    shape.m_radius = %.15f;\n",this.m_radius);b2.Log("    shape.m_p.Set(%.15f, %.15f);\n",this.m_p.x,this.m_p.y)};goog.exportProperty(b2.CircleShape.prototype,"Dump",b2.CircleShape.prototype.Dump);b2.EdgeShape=function(){b2.Shape.call(this,b2.ShapeType.e_edgeShape,b2._polygonRadius);this.m_vertex1=new b2.Vec2;this.m_vertex2=new b2.Vec2;this.m_vertex0=new b2.Vec2;this.m_vertex3=new b2.Vec2};goog.inherits(b2.EdgeShape,b2.Shape);goog.exportSymbol("b2.EdgeShape",b2.EdgeShape);b2.EdgeShape.prototype.m_vertex1=null;goog.exportProperty(b2.EdgeShape.prototype,"m_vertex1",b2.EdgeShape.prototype.m_vertex1);
b2.EdgeShape.prototype.m_vertex2=null;goog.exportProperty(b2.EdgeShape.prototype,"m_vertex2",b2.EdgeShape.prototype.m_vertex2);b2.EdgeShape.prototype.m_vertex0=null;goog.exportProperty(b2.EdgeShape.prototype,"m_vertex0",b2.EdgeShape.prototype.m_vertex0);b2.EdgeShape.prototype.m_vertex3=null;goog.exportProperty(b2.EdgeShape.prototype,"m_vertex3",b2.EdgeShape.prototype.m_vertex3);b2.EdgeShape.prototype.m_hasVertex0=!1;
goog.exportProperty(b2.EdgeShape.prototype,"m_hasVertex0",b2.EdgeShape.prototype.m_hasVertex0);b2.EdgeShape.prototype.m_hasVertex3=!1;goog.exportProperty(b2.EdgeShape.prototype,"m_hasVertex3",b2.EdgeShape.prototype.m_hasVertex3);b2.EdgeShape.prototype.Set=function(a,b){this.m_vertex1.Copy(a);this.m_vertex2.Copy(b);this.m_hasVertex3=this.m_hasVertex0=!1;return this};goog.exportProperty(b2.EdgeShape.prototype,"Set",b2.EdgeShape.prototype.Set);
b2.EdgeShape.prototype.SetAsEdge=b2.EdgeShape.prototype.Set;b2.EdgeShape.prototype.Clone=function(){return(new b2.EdgeShape).Copy(this)};goog.exportProperty(b2.EdgeShape.prototype,"Clone",b2.EdgeShape.prototype.Clone);
b2.EdgeShape.prototype.Copy=function(a){b2.Shape.prototype.Copy.call(this,a);b2.ENABLE_ASSERTS&&b2.Assert(a instanceof b2.EdgeShape);this.m_vertex1.Copy(a.m_vertex1);this.m_vertex2.Copy(a.m_vertex2);this.m_vertex0.Copy(a.m_vertex0);this.m_vertex3.Copy(a.m_vertex3);this.m_hasVertex0=a.m_hasVertex0;this.m_hasVertex3=a.m_hasVertex3;return this};goog.exportProperty(b2.EdgeShape.prototype,"Copy",b2.EdgeShape.prototype.Copy);b2.EdgeShape.prototype.GetChildCount=function(){return 1};
goog.exportProperty(b2.EdgeShape.prototype,"GetChildCount",b2.EdgeShape.prototype.GetChildCount);b2.EdgeShape.prototype.TestPoint=function(a,b){return!1};goog.exportProperty(b2.EdgeShape.prototype,"TestPoint",b2.EdgeShape.prototype.TestPoint);
b2.EdgeShape.prototype.ComputeDistance=function(a,b,c,d){var e=b2.Mul_X_V2(a,this.m_vertex1,b2.EdgeShape.prototype.ComputeDistance.s_v1);a=b2.Mul_X_V2(a,this.m_vertex2,b2.EdgeShape.prototype.ComputeDistance.s_v2);d=b2.Sub_V2_V2(b,e,b2.EdgeShape.prototype.ComputeDistance.s_d);var e=b2.Sub_V2_V2(a,e,b2.EdgeShape.prototype.ComputeDistance.s_s),f=b2.Dot_V2_V2(d,e);if(0<f){var g=b2.Dot_V2_V2(e,e);f>g?b2.Sub_V2_V2(b,a,d):d.SelfMulSub(f/g,e)}c.Copy(d);
return c.Normalize()};goog.exportProperty(b2.EdgeShape.prototype,"ComputeDistance",b2.EdgeShape.prototype.ComputeDistance);b2.EdgeShape.prototype.ComputeDistance.s_v1=new b2.Vec2;b2.EdgeShape.prototype.ComputeDistance.s_v2=new b2.Vec2;b2.EdgeShape.prototype.ComputeDistance.s_d=new b2.Vec2;b2.EdgeShape.prototype.ComputeDistance.s_s=new b2.Vec2;
b2.EdgeShape.prototype.RayCast=function(a,b,c,d){var e=b2.MulT_X_V2(c,b.p1,b2.EdgeShape.prototype.RayCast.s_p1);d=b2.MulT_X_V2(c,b.p2,b2.EdgeShape.prototype.RayCast.s_p2);var f=b2.Sub_V2_V2(d,e,b2.EdgeShape.prototype.RayCast.s_d);d=this.m_vertex1;var g=this.m_vertex2,h=b2.Sub_V2_V2(g,d,b2.EdgeShape.prototype.RayCast.s_e),k=a.normal.Set(h.y,-h.x).SelfNormalize(),h=b2.Dot_V2_V2(k,b2.Sub_V2_V2(d,e,b2.Vec2.s_t0)),k=b2.Dot_V2_V2(k,f);if(0===
k)return!1;k=h/k;if(0>k||b.maxFraction<k)return!1;b=b2.AddMul_V2_S_V2(e,k,f,b2.EdgeShape.prototype.RayCast.s_q);e=b2.Sub_V2_V2(g,d,b2.EdgeShape.prototype.RayCast.s_r);g=b2.Dot_V2_V2(e,e);if(0===g)return!1;d=b2.Dot_V2_V2(b2.Sub_V2_V2(b,d,b2.Vec2.s_t0),e)/g;if(0>d||1<d)return!1;a.fraction=k;b2.Mul_R_V2(c.q,a.normal,a.normal);0<h&&a.normal.SelfNeg();return!0};goog.exportProperty(b2.EdgeShape.prototype,"RayCast",b2.EdgeShape.prototype.RayCast);
b2.EdgeShape.prototype.RayCast.s_p1=new b2.Vec2;b2.EdgeShape.prototype.RayCast.s_p2=new b2.Vec2;b2.EdgeShape.prototype.RayCast.s_d=new b2.Vec2;b2.EdgeShape.prototype.RayCast.s_e=new b2.Vec2;b2.EdgeShape.prototype.RayCast.s_q=new b2.Vec2;b2.EdgeShape.prototype.RayCast.s_r=new b2.Vec2;
b2.EdgeShape.prototype.ComputeAABB=function(a,b,c){c=b2.Mul_X_V2(b,this.m_vertex1,b2.EdgeShape.prototype.ComputeAABB.s_v1);b=b2.Mul_X_V2(b,this.m_vertex2,b2.EdgeShape.prototype.ComputeAABB.s_v2);b2.Min_V2_V2(c,b,a.lowerBound);b2.Max_V2_V2(c,b,a.upperBound);b=this.m_radius;a.lowerBound.SelfSubXY(b,b);a.upperBound.SelfAddXY(b,b)};goog.exportProperty(b2.EdgeShape.prototype,"ComputeAABB",b2.EdgeShape.prototype.ComputeAABB);
b2.EdgeShape.prototype.ComputeAABB.s_v1=new b2.Vec2;b2.EdgeShape.prototype.ComputeAABB.s_v2=new b2.Vec2;b2.EdgeShape.prototype.ComputeMass=function(a,b){a.mass=0;b2.Mid_V2_V2(this.m_vertex1,this.m_vertex2,a.center);a.I=0};goog.exportProperty(b2.EdgeShape.prototype,"ComputeMass",b2.EdgeShape.prototype.ComputeMass);
b2.EdgeShape.prototype.SetupDistanceProxy=function(a,b){a.m_vertices=a.m_buffer;a.m_vertices[0].Copy(this.m_vertex1);a.m_vertices[1].Copy(this.m_vertex2);a.m_count=2;a.m_radius=this.m_radius};b2.EdgeShape.prototype.ComputeSubmergedArea=function(a,b,c,d){d.SetZero();return 0};goog.exportProperty(b2.EdgeShape.prototype,"ComputeSubmergedArea",b2.EdgeShape.prototype.ComputeSubmergedArea);
b2.EdgeShape.prototype.Dump=function(){b2.Log("    /*b2.EdgeShape*/ var shape = new b2.EdgeShape();\n");b2.Log("    shape.m_radius = %.15f;\n",this.m_radius);b2.Log("    shape.m_vertex0.Set(%.15f, %.15f);\n",this.m_vertex0.x,this.m_vertex0.y);b2.Log("    shape.m_vertex1.Set(%.15f, %.15f);\n",this.m_vertex1.x,this.m_vertex1.y);b2.Log("    shape.m_vertex2.Set(%.15f, %.15f);\n",this.m_vertex2.x,this.m_vertex2.y);b2.Log("    shape.m_vertex3.Set(%.15f, %.15f);\n",
this.m_vertex3.x,this.m_vertex3.y);b2.Log("    shape.m_hasVertex0 = %s;\n",this.m_hasVertex0);b2.Log("    shape.m_hasVertex3 = %s;\n",this.m_hasVertex3)};goog.exportProperty(b2.EdgeShape.prototype,"Dump",b2.EdgeShape.prototype.Dump);b2.ChainShape=function(){b2.Shape.call(this,b2.ShapeType.e_chainShape,b2._polygonRadius);this.m_prevVertex=new b2.Vec2;this.m_nextVertex=new b2.Vec2};goog.inherits(b2.ChainShape,b2.Shape);goog.exportSymbol("b2.ChainShape",b2.ChainShape);b2.ChainShape.prototype.m_vertices=null;goog.exportProperty(b2.ChainShape.prototype,"m_vertices",b2.ChainShape.prototype.m_vertices);b2.ChainShape.prototype.m_count=0;
goog.exportProperty(b2.ChainShape.prototype,"m_count",b2.ChainShape.prototype.m_count);b2.ChainShape.prototype.m_prevVertex=null;goog.exportProperty(b2.ChainShape.prototype,"m_prevVertex",b2.ChainShape.prototype.m_prevVertex);b2.ChainShape.prototype.m_nextVertex=null;goog.exportProperty(b2.ChainShape.prototype,"m_nextVertex",b2.ChainShape.prototype.m_nextVertex);b2.ChainShape.prototype.m_hasPrevVertex=!1;
goog.exportProperty(b2.ChainShape.prototype,"m_hasPrevVertex",b2.ChainShape.prototype.m_hasPrevVertex);b2.ChainShape.prototype.m_hasNextVertex=!1;goog.exportProperty(b2.ChainShape.prototype,"m_hasNextVertex",b2.ChainShape.prototype.m_hasNextVertex);b2.ChainShape.prototype.Clear=function(){this.m_vertices=null;this.m_count=0};goog.exportProperty(b2.ChainShape.prototype,"Clear",b2.ChainShape.prototype.Clear);
b2.ChainShape.prototype.CreateLoop=function(a,b){b=b||a.length;b2.ENABLE_ASSERTS&&b2.Assert(null===this.m_vertices&&0===this.m_count);b2.ENABLE_ASSERTS&&b2.Assert(3<=b);if(b2.ENABLE_ASSERTS)for(var c=1;c<b;++c)b2.Assert(b2.DistanceSquared(a[c-1],a[c])>b2._linearSlop*b2._linearSlop);this.m_count=b+1;this.m_vertices=b2.Vec2.MakeArray(this.m_count);for(c=0;c<b;++c)this.m_vertices[c].Copy(a[c]);this.m_vertices[b].Copy(this.m_vertices[0]);this.m_prevVertex.Copy(this.m_vertices[this.m_count-
2]);this.m_nextVertex.Copy(this.m_vertices[1]);this.m_hasNextVertex=this.m_hasPrevVertex=!0;return this};goog.exportProperty(b2.ChainShape.prototype,"CreateLoop",b2.ChainShape.prototype.CreateLoop);
b2.ChainShape.prototype.CreateChain=function(a,b){b=b||a.length;b2.ENABLE_ASSERTS&&b2.Assert(null===this.m_vertices&&0===this.m_count);b2.ENABLE_ASSERTS&&b2.Assert(2<=b);if(b2.ENABLE_ASSERTS)for(var c=1;c<b;++c)b2.Assert(b2.DistanceSquared(a[c-1],a[c])>b2._linearSlop*b2._linearSlop);this.m_count=b;this.m_vertices=b2.Vec2.MakeArray(b);for(c=0;c<b;++c)this.m_vertices[c].Copy(a[c]);this.m_hasNextVertex=this.m_hasPrevVertex=!1;this.m_prevVertex.SetZero();
this.m_nextVertex.SetZero();return this};goog.exportProperty(b2.ChainShape.prototype,"CreateChain",b2.ChainShape.prototype.CreateChain);b2.ChainShape.prototype.SetPrevVertex=function(a){this.m_prevVertex.Copy(a);this.m_hasPrevVertex=!0;return this};goog.exportProperty(b2.ChainShape.prototype,"SetPrevVertex",b2.ChainShape.prototype.SetPrevVertex);b2.ChainShape.prototype.SetNextVertex=function(a){this.m_nextVertex.Copy(a);this.m_hasNextVertex=!0;return this};
goog.exportProperty(b2.ChainShape.prototype,"SetNextVertex",b2.ChainShape.prototype.SetNextVertex);b2.ChainShape.prototype.Clone=function(){return(new b2.ChainShape).Copy(this)};goog.exportProperty(b2.ChainShape.prototype,"Clone",b2.ChainShape.prototype.Clone);
b2.ChainShape.prototype.Copy=function(a){b2.Shape.prototype.Copy.call(this,a);b2.ENABLE_ASSERTS&&b2.Assert(a instanceof b2.ChainShape);this.CreateChain(a.m_vertices,a.m_count);this.m_prevVertex.Copy(a.m_prevVertex);this.m_nextVertex.Copy(a.m_nextVertex);this.m_hasPrevVertex=a.m_hasPrevVertex;this.m_hasNextVertex=a.m_hasNextVertex;return this};goog.exportProperty(b2.ChainShape.prototype,"Copy",b2.ChainShape.prototype.Copy);
b2.ChainShape.prototype.GetChildCount=function(){return this.m_count-1};goog.exportProperty(b2.ChainShape.prototype,"GetChildCount",b2.ChainShape.prototype.GetChildCount);
b2.ChainShape.prototype.GetChildEdge=function(a,b){b2.ENABLE_ASSERTS&&b2.Assert(0<=b&&b<this.m_count-1);a.m_type=b2.ShapeType.e_edgeShape;a.m_radius=this.m_radius;a.m_vertex1.Copy(this.m_vertices[b]);a.m_vertex2.Copy(this.m_vertices[b+1]);0<b?(a.m_vertex0.Copy(this.m_vertices[b-1]),a.m_hasVertex0=!0):(a.m_vertex0.Copy(this.m_prevVertex),a.m_hasVertex0=this.m_hasPrevVertex);b<this.m_count-2?(a.m_vertex3.Copy(this.m_vertices[b+2]),a.m_hasVertex3=!0):(a.m_vertex3.Copy(this.m_nextVertex),
a.m_hasVertex3=this.m_hasNextVertex)};goog.exportProperty(b2.ChainShape.prototype,"GetChildEdge",b2.ChainShape.prototype.GetChildEdge);b2.ChainShape.prototype.TestPoint=function(a,b){return!1};goog.exportProperty(b2.ChainShape.prototype,"TestPoint",b2.ChainShape.prototype.TestPoint);b2.ChainShape.prototype.ComputeDistance=function(a,b,c,d){var e=b2.ChainShape.prototype.ComputeDistance.s_edgeShape;this.GetChildEdge(e,d);return e.ComputeDistance(a,b,c,0)};
goog.exportProperty(b2.ChainShape.prototype,"ComputeDistance",b2.ChainShape.prototype.ComputeDistance);b2.ChainShape.prototype.ComputeDistance.s_edgeShape=new b2.EdgeShape;b2.ChainShape.prototype.RayCast=function(a,b,c,d){b2.ENABLE_ASSERTS&&b2.Assert(d<this.m_count);var e=b2.ChainShape.prototype.RayCast.s_edgeShape;e.m_vertex1.Copy(this.m_vertices[d]);e.m_vertex2.Copy(this.m_vertices[(d+1)%this.m_count]);return e.RayCast(a,b,c,0)};
goog.exportProperty(b2.ChainShape.prototype,"RayCast",b2.ChainShape.prototype.RayCast);b2.ChainShape.prototype.RayCast.s_edgeShape=new b2.EdgeShape;
b2.ChainShape.prototype.ComputeAABB=function(a,b,c){b2.ENABLE_ASSERTS&&b2.Assert(c<this.m_count);var d=this.m_vertices[(c+1)%this.m_count];c=b2.Mul_X_V2(b,this.m_vertices[c],b2.ChainShape.prototype.ComputeAABB.s_v1);b=b2.Mul_X_V2(b,d,b2.ChainShape.prototype.ComputeAABB.s_v2);b2.Min_V2_V2(c,b,a.lowerBound);b2.Max_V2_V2(c,b,a.upperBound)};goog.exportProperty(b2.ChainShape.prototype,"ComputeAABB",b2.ChainShape.prototype.ComputeAABB);
b2.ChainShape.prototype.ComputeAABB.s_v1=new b2.Vec2;goog.exportProperty(b2.ChainShape.prototype.ComputeAABB,"s_v1",b2.ChainShape.prototype.ComputeAABB.s_v1);b2.ChainShape.prototype.ComputeAABB.s_v2=new b2.Vec2;goog.exportProperty(b2.ChainShape.prototype.ComputeAABB,"s_v2",b2.ChainShape.prototype.ComputeAABB.s_v2);b2.ChainShape.prototype.ComputeMass=function(a,b){a.mass=0;a.center.SetZero();a.I=0};
goog.exportProperty(b2.ChainShape.prototype,"ComputeMass",b2.ChainShape.prototype.ComputeMass);b2.ChainShape.prototype.SetupDistanceProxy=function(a,b){b2.ENABLE_ASSERTS&&b2.Assert(0<=b&&b<this.m_count);a.m_buffer[0].Copy(this.m_vertices[b]);b+1<this.m_count?a.m_buffer[1].Copy(this.m_vertices[b+1]):a.m_buffer[1].Copy(this.m_vertices[0]);a.m_vertices=a.m_buffer;a.m_count=2;a.m_radius=this.m_radius};
b2.ChainShape.prototype.ComputeSubmergedArea=function(a,b,c,d){d.SetZero();return 0};goog.exportProperty(b2.ChainShape.prototype,"ComputeSubmergedArea",b2.ChainShape.prototype.ComputeSubmergedArea);
b2.ChainShape.prototype.Dump=function(){b2.Log("    /*b2.ChainShape*/ var shape = new b2.ChainShape();\n");b2.Log("    /*b2.Vec2[]*/ var vs = b2.Vec2.MakeArray(%d);\n",b2._maxPolygonVertices);for(var a=0;a<this.m_count;++a)b2.Log("    vs[%d].Set(%.15f, %.15f);\n",a,this.m_vertices[a].x,this.m_vertices[a].y);b2.Log("    shape.CreateChain(vs, %d);\n",this.m_count);b2.Log("    shape.m_prevVertex.Set(%.15f, %.15f);\n",this.m_prevVertex.x,this.m_prevVertex.y);
b2.Log("    shape.m_nextVertex.Set(%.15f, %.15f);\n",this.m_nextVertex.x,this.m_nextVertex.y);b2.Log("    shape.m_hasPrevVertex = %s;\n",this.m_hasPrevVertex?"true":"false");b2.Log("    shape.m_hasNextVertex = %s;\n",this.m_hasNextVertex?"true":"false")};goog.exportProperty(b2.ChainShape.prototype,"Dump",b2.ChainShape.prototype.Dump);b2.PolygonShape=function(){b2.Shape.call(this,b2.ShapeType.e_polygonShape,b2._polygonRadius);this.m_centroid=new b2.Vec2(0,0);this.m_vertices=b2.Vec2.MakeArray(b2._maxPolygonVertices);this.m_normals=b2.Vec2.MakeArray(b2._maxPolygonVertices)};goog.inherits(b2.PolygonShape,b2.Shape);goog.exportSymbol("b2.PolygonShape",b2.PolygonShape);b2.PolygonShape.prototype.m_centroid=null;
goog.exportProperty(b2.PolygonShape.prototype,"m_centroid",b2.PolygonShape.prototype.m_centroid);b2.PolygonShape.prototype.m_vertices=null;goog.exportProperty(b2.PolygonShape.prototype,"m_vertices",b2.PolygonShape.prototype.m_vertices);b2.PolygonShape.prototype.m_normals=null;goog.exportProperty(b2.PolygonShape.prototype,"m_normals",b2.PolygonShape.prototype.m_normals);b2.PolygonShape.prototype.m_count=0;
goog.exportProperty(b2.PolygonShape.prototype,"m_count",b2.PolygonShape.prototype.m_count);b2.PolygonShape.prototype.Clone=function(){return(new b2.PolygonShape).Copy(this)};goog.exportProperty(b2.PolygonShape.prototype,"Clone",b2.PolygonShape.prototype.Clone);
b2.PolygonShape.prototype.Copy=function(a){b2.Shape.prototype.Copy.call(this,a);b2.ENABLE_ASSERTS&&b2.Assert(a instanceof b2.PolygonShape);this.m_centroid.Copy(a.m_centroid);this.m_count=a.m_count;for(var b=0,c=this.m_count;b<c;++b)this.m_vertices[b].Copy(a.m_vertices[b]),this.m_normals[b].Copy(a.m_normals[b]);return this};goog.exportProperty(b2.PolygonShape.prototype,"Copy",b2.PolygonShape.prototype.Copy);
b2.PolygonShape.prototype.SetAsBox=function(a,b,c,d){this.m_count=4;this.m_vertices[0].Set(-a,-b);this.m_vertices[1].Set(a,-b);this.m_vertices[2].Set(a,b);this.m_vertices[3].Set(-a,b);this.m_normals[0].Set(0,-1);this.m_normals[1].Set(1,0);this.m_normals[2].Set(0,1);this.m_normals[3].Set(-1,0);this.m_centroid.SetZero();if(c instanceof b2.Vec2)for(d="number"===typeof d?d:0,this.m_centroid.Copy(c),a=new b2.Transform,a.SetPosition(c),a.SetRotationAngle(d),c=0,d=this.m_count;c<d;++c)b2.Mul_X_V2(a,
this.m_vertices[c],this.m_vertices[c]),b2.Mul_R_V2(a.q,this.m_normals[c],this.m_normals[c]);return this};goog.exportProperty(b2.PolygonShape.prototype,"SetAsBox",b2.PolygonShape.prototype.SetAsBox);
b2.PolygonShape.prototype.Set=function(a,b,c){b="number"===typeof b?b:a.length;c="number"===typeof c?c:0;b2.ENABLE_ASSERTS&&b2.Assert(3<=b&&b<=b2._maxPolygonVertices);if(3>b)return this.SetAsBox(1,1);b=b2.Min(b,b2._maxPolygonVertices);for(var d=b2.PolygonShape.prototype.Set.s_ps,e=0,f=0;f<b;++f){for(var g=a[c+f],h=!0,k=0;k<e;++k)if(b2.DistanceSquared(g,d[k])<.25*b2._linearSlop*b2._linearSlop){h=!1;break}h&&d[e++].Copy(g)}b=e;if(3>b)return b2.ENABLE_ASSERTS&&
b2.Assert(!1),this.SetAsBox(1,1);a=0;g=d[0].x;for(f=1;f<b;++f)if(k=d[f].x,k>g||k===g&&d[f].y<d[a].y)a=f,g=k;e=b2.PolygonShape.prototype.Set.s_hull;c=0;for(f=a;;){e[c]=f;h=0;for(k=1;k<b;++k)if(h===f)h=k;else{var l=b2.Sub_V2_V2(d[h],d[e[c]],b2.PolygonShape.prototype.Set.s_r),g=b2.Sub_V2_V2(d[k],d[e[c]],b2.PolygonShape.prototype.Set.s_v),m=b2.Cross_V2_V2(l,g);0>m&&(h=k);0===m&&g.LengthSquared()>l.LengthSquared()&&(h=k)}++c;f=h;if(h===a)break}if(3>c)return b2.ENABLE_ASSERTS&&
b2.Assert(!1),this.SetAsBox(1,1);this.m_count=c;for(f=0;f<c;++f)this.m_vertices[f].Copy(d[e[f]]);f=0;for(b=c;f<b;++f)d=b2.Sub_V2_V2(this.m_vertices[(f+1)%b],this.m_vertices[f],b2.Vec2.s_t0),b2.ENABLE_ASSERTS&&b2.Assert(d.LengthSquared()>b2._epsilon_sq),b2.Cross_V2_S(d,1,this.m_normals[f]).SelfNormalize();b2.PolygonShape.ComputeCentroid(this.m_vertices,c,this.m_centroid);return this};goog.exportProperty(b2.PolygonShape.prototype,"Set",b2.PolygonShape.prototype.Set);
b2.PolygonShape.prototype.Set.s_ps=b2.Vec2.MakeArray(b2._maxPolygonVertices);b2.PolygonShape.prototype.Set.s_hull=b2.MakeNumberArray(b2._maxPolygonVertices);b2.PolygonShape.prototype.Set.s_r=new b2.Vec2;b2.PolygonShape.prototype.Set.s_v=new b2.Vec2;b2.PolygonShape.prototype.GetChildCount=function(){return 1};goog.exportProperty(b2.PolygonShape.prototype,"GetChildCount",b2.PolygonShape.prototype.GetChildCount);
b2.PolygonShape.prototype.TestPoint=function(a,b){for(var c=b2.MulT_X_V2(a,b,b2.PolygonShape.prototype.TestPoint.s_pLocal),d=0,e=this.m_count;d<e;++d)if(0<b2.Dot_V2_V2(this.m_normals[d],b2.Sub_V2_V2(c,this.m_vertices[d],b2.Vec2.s_t0)))return!1;return!0};goog.exportProperty(b2.PolygonShape.prototype,"TestPoint",b2.PolygonShape.prototype.TestPoint);b2.PolygonShape.prototype.TestPoint.s_pLocal=new b2.Vec2;
b2.PolygonShape.prototype.ComputeDistance=function(a,b,c,d){b=b2.MulT_X_V2(a,b,b2.PolygonShape.prototype.ComputeDistance.s_pLocal);var e=-b2._maxFloat,f=b2.PolygonShape.prototype.ComputeDistance.s_normalForMaxDistance.Copy(b);for(d=0;d<this.m_count;++d){var g=b2.Dot_V2_V2(this.m_normals[d],b2.Sub_V2_V2(b,this.m_vertices[d],b2.Vec2.s_t0));g>e&&(e=g,f.Copy(this.m_normals[d]))}if(0<e){f=b2.PolygonShape.prototype.ComputeDistance.s_minDistance.Copy(f);e*=e;
for(d=0;d<this.m_count;++d){var g=b2.Sub_V2_V2(b,this.m_vertices[d],b2.PolygonShape.prototype.ComputeDistance.s_distance),h=g.LengthSquared();e>h&&(f.Copy(g),e=h)}b2.Mul_R_V2(a.q,f,c);c.Normalize();return Math.sqrt(e)}b2.Mul_R_V2(a.q,f,c);return e};goog.exportProperty(b2.PolygonShape.prototype,"ComputeDistance",b2.PolygonShape.prototype.ComputeDistance);b2.PolygonShape.prototype.ComputeDistance.s_pLocal=new b2.Vec2;
b2.PolygonShape.prototype.ComputeDistance.s_normalForMaxDistance=new b2.Vec2;b2.PolygonShape.prototype.ComputeDistance.s_minDistance=new b2.Vec2;b2.PolygonShape.prototype.ComputeDistance.s_distance=new b2.Vec2;
b2.PolygonShape.prototype.RayCast=function(a,b,c,d){d=b2.MulT_X_V2(c,b.p1,b2.PolygonShape.prototype.RayCast.s_p1);for(var e=b2.MulT_X_V2(c,b.p2,b2.PolygonShape.prototype.RayCast.s_p2),e=b2.Sub_V2_V2(e,d,b2.PolygonShape.prototype.RayCast.s_d),f=0,g=b.maxFraction,h=-1,k=0,l=this.m_count;k<l;++k){var m=b2.Dot_V2_V2(this.m_normals[k],b2.Sub_V2_V2(this.m_vertices[k],d,b2.Vec2.s_t0)),n=b2.Dot_V2_V2(this.m_normals[k],e);if(0===n){if(0>m)return!1}else 0>
n&&m<f*n?(f=m/n,h=k):0<n&&m<g*n&&(g=m/n);if(g<f)return!1}b2.ENABLE_ASSERTS&&b2.Assert(0<=f&&f<=b.maxFraction);return 0<=h?(a.fraction=f,b2.Mul_R_V2(c.q,this.m_normals[h],a.normal),!0):!1};goog.exportProperty(b2.PolygonShape.prototype,"RayCast",b2.PolygonShape.prototype.RayCast);b2.PolygonShape.prototype.RayCast.s_p1=new b2.Vec2;b2.PolygonShape.prototype.RayCast.s_p2=new b2.Vec2;b2.PolygonShape.prototype.RayCast.s_d=new b2.Vec2;
b2.PolygonShape.prototype.ComputeAABB=function(a,b,c){c=b2.Mul_X_V2(b,this.m_vertices[0],a.lowerBound);a=a.upperBound.Copy(c);for(var d=0,e=this.m_count;d<e;++d){var f=b2.Mul_X_V2(b,this.m_vertices[d],b2.PolygonShape.prototype.ComputeAABB.s_v);b2.Min_V2_V2(f,c,c);b2.Max_V2_V2(f,a,a)}b=this.m_radius;c.SelfSubXY(b,b);a.SelfAddXY(b,b)};goog.exportProperty(b2.PolygonShape.prototype,"ComputeAABB",b2.PolygonShape.prototype.ComputeAABB);
b2.PolygonShape.prototype.ComputeAABB.s_v=new b2.Vec2;
b2.PolygonShape.prototype.ComputeMass=function(a,b){b2.ENABLE_ASSERTS&&b2.Assert(3<=this.m_count);for(var c=b2.PolygonShape.prototype.ComputeMass.s_center.SetZero(),d=0,e=0,f=b2.PolygonShape.prototype.ComputeMass.s_s.SetZero(),g=0,h=this.m_count;g<h;++g)f.SelfAdd(this.m_vertices[g]);f.SelfMul(1/this.m_count);for(var k=1/3,g=0,h=this.m_count;g<h;++g){var l=b2.Sub_V2_V2(this.m_vertices[g],f,b2.PolygonShape.prototype.ComputeMass.s_e1),m=b2.Sub_V2_V2(this.m_vertices[(g+
1)%h],f,b2.PolygonShape.prototype.ComputeMass.s_e2),n=b2.Cross_V2_V2(l,m),p=.5*n,d=d+p;c.SelfAdd(b2.Mul_S_V2(p*k,b2.Add_V2_V2(l,m,b2.Vec2.s_t0),b2.Vec2.s_t1));var p=l.x,l=l.y,q=m.x,m=m.y,e=e+.25*k*n*(p*p+q*p+q*q+(l*l+m*l+m*m))}a.mass=b*d;b2.ENABLE_ASSERTS&&b2.Assert(d>b2._epsilon);c.SelfMul(1/d);b2.Add_V2_V2(c,f,a.center);a.I=b*e;a.I+=a.mass*(b2.Dot_V2_V2(a.center,a.center)-b2.Dot_V2_V2(c,c))};
goog.exportProperty(b2.PolygonShape.prototype,"ComputeMass",b2.PolygonShape.prototype.ComputeMass);b2.PolygonShape.prototype.ComputeMass.s_center=new b2.Vec2;b2.PolygonShape.prototype.ComputeMass.s_s=new b2.Vec2;b2.PolygonShape.prototype.ComputeMass.s_e1=new b2.Vec2;b2.PolygonShape.prototype.ComputeMass.s_e2=new b2.Vec2;
b2.PolygonShape.prototype.Validate=function(){for(var a=0;a<this.m_count;++a)for(var b=a,c=(a+1)%this.m_count,d=this.m_vertices[b],e=b2.Sub_V2_V2(this.m_vertices[c],d,b2.PolygonShape.prototype.Validate.s_e),f=0;f<this.m_count;++f)if(f!==b&&f!==c){var g=b2.Sub_V2_V2(this.m_vertices[f],d,b2.PolygonShape.prototype.Validate.s_v);if(0>b2.Cross_V2_V2(e,g))return!1}return!0};goog.exportProperty(b2.PolygonShape.prototype,"Validate",b2.PolygonShape.prototype.Validate);
b2.PolygonShape.prototype.Validate.s_e=new b2.Vec2;b2.PolygonShape.prototype.Validate.s_v=new b2.Vec2;b2.PolygonShape.prototype.SetupDistanceProxy=function(a,b){a.m_vertices=this.m_vertices;a.m_count=this.m_count;a.m_radius=this.m_radius};
b2.PolygonShape.prototype.ComputeSubmergedArea=function(a,b,c,d){var e=b2.MulT_R_V2(c.q,a,b2.PolygonShape.prototype.ComputeSubmergedArea.s_normalL),f=b-b2.Dot_V2_V2(a,c.p),g=b2.PolygonShape.prototype.ComputeSubmergedArea.s_depths,h=0,k=-1;b=-1;var l=!1;a=0;for(var m=this.m_count;a<m;++a){g[a]=b2.Dot_V2_V2(e,this.m_vertices[a])-f;var n=g[a]<-b2._epsilon;0<a&&(n?l||(k=a-1,h++):l&&(b=a-1,h++));l=n}switch(h){case 0:return l?(a=b2.PolygonShape.prototype.ComputeSubmergedArea.s_md,
this.ComputeMass(a,1),b2.Mul_X_V2(c,a.center,d),a.mass):0;case 1:-1===k?k=this.m_count-1:b=this.m_count-1}a=(k+1)%this.m_count;e=(b+1)%this.m_count;f=(0-g[k])/(g[a]-g[k]);g=(0-g[b])/(g[e]-g[b]);k=b2.PolygonShape.prototype.ComputeSubmergedArea.s_intoVec.Set(this.m_vertices[k].x*(1-f)+this.m_vertices[a].x*f,this.m_vertices[k].y*(1-f)+this.m_vertices[a].y*f);b=b2.PolygonShape.prototype.ComputeSubmergedArea.s_outoVec.Set(this.m_vertices[b].x*(1-g)+this.m_vertices[e].x*g,this.m_vertices[b].y*
(1-g)+this.m_vertices[e].y*g);g=0;f=b2.PolygonShape.prototype.ComputeSubmergedArea.s_center.SetZero();h=this.m_vertices[a];for(l=null;a!==e;)a=(a+1)%this.m_count,l=a===e?b:this.m_vertices[a],m=.5*((h.x-k.x)*(l.y-k.y)-(h.y-k.y)*(l.x-k.x)),g+=m,f.x+=m*(k.x+h.x+l.x)/3,f.y+=m*(k.y+h.y+l.y)/3,h=l;f.SelfMul(1/g);b2.Mul_X_V2(c,f,d);return g};goog.exportProperty(b2.PolygonShape.prototype,"ComputeSubmergedArea",b2.PolygonShape.prototype.ComputeSubmergedArea);
b2.PolygonShape.prototype.ComputeSubmergedArea.s_normalL=new b2.Vec2;b2.PolygonShape.prototype.ComputeSubmergedArea.s_depths=b2.MakeNumberArray(b2._maxPolygonVertices);b2.PolygonShape.prototype.ComputeSubmergedArea.s_md=new b2.MassData;b2.PolygonShape.prototype.ComputeSubmergedArea.s_intoVec=new b2.Vec2;b2.PolygonShape.prototype.ComputeSubmergedArea.s_outoVec=new b2.Vec2;b2.PolygonShape.prototype.ComputeSubmergedArea.s_center=new b2.Vec2;
b2.PolygonShape.prototype.Dump=function(){b2.Log("    /*b2.PolygonShape*/ var shape = new b2.PolygonShape();\n");b2.Log("    /*b2.Vec2[]*/ var vs = b2.Vec2.MakeArray(%d);\n",b2._maxPolygonVertices);for(var a=0;a<this.m_count;++a)b2.Log("    vs[%d].Set(%.15f, %.15f);\n",a,this.m_vertices[a].x,this.m_vertices[a].y);b2.Log("    shape.Set(vs, %d);\n",this.m_count)};goog.exportProperty(b2.PolygonShape.prototype,"Dump",b2.PolygonShape.prototype.Dump);
b2.PolygonShape.ComputeCentroid=function(a,b,c){b2.ENABLE_ASSERTS&&b2.Assert(3<=b);c.SetZero();for(var d=0,e=b2.PolygonShape.ComputeCentroid.s_pRef.SetZero(),f=1/3,g=0;g<b;++g){var h=e,k=a[g],l=a[(g+1)%b],m=b2.Sub_V2_V2(k,h,b2.PolygonShape.ComputeCentroid.s_e1),n=b2.Sub_V2_V2(l,h,b2.PolygonShape.ComputeCentroid.s_e2),m=.5*b2.Cross_V2_V2(m,n),d=d+m;c.x+=m*f*(h.x+k.x+l.x);c.y+=m*f*(h.y+k.y+l.y)}b2.ENABLE_ASSERTS&&b2.Assert(d>b2._epsilon);c.SelfMul(1/
d);return c};goog.exportProperty(b2.PolygonShape,"ComputeCentroid",b2.PolygonShape.ComputeCentroid);b2.PolygonShape.ComputeCentroid.s_pRef=new b2.Vec2;b2.PolygonShape.ComputeCentroid.s_e1=new b2.Vec2;b2.PolygonShape.ComputeCentroid.s_e2=new b2.Vec2;b2.Timer=function(){this.m_start=(new Date).getTime()};goog.exportSymbol("b2.Timer",b2.Timer);b2.Timer.prototype.m_start=0;goog.exportProperty(b2.Timer.prototype,"m_start",b2.Timer.prototype.m_start);b2.Timer.prototype.Reset=function(){this.m_start=(new Date).getTime();return this};goog.exportProperty(b2.Timer.prototype,"Reset",b2.Timer.prototype.Reset);b2.Timer.prototype.GetMilliseconds=function(){return(new Date).getTime()-this.m_start};
goog.exportProperty(b2.Timer.prototype,"GetMilliseconds",b2.Timer.prototype.GetMilliseconds);b2.Counter=function(){};goog.exportSymbol("b2.Counter",b2.Counter);b2.Counter.prototype.m_count=0;goog.exportProperty(b2.Counter.prototype,"m_count",b2.Counter.prototype.m_count);b2.Counter.prototype.m_min_count=0;goog.exportProperty(b2.Counter.prototype,"m_min_count",b2.Counter.prototype.m_min_count);b2.Counter.prototype.m_max_count=0;
goog.exportProperty(b2.Counter.prototype,"m_max_count",b2.Counter.prototype.m_max_count);b2.Counter.prototype.GetCount=function(){return this.m_count};goog.exportProperty(b2.Counter.prototype,"GetCount",b2.Counter.prototype.GetCount);b2.Counter.prototype.GetMinCount=function(){return this.m_min_count};goog.exportProperty(b2.Counter.prototype,"GetMinCount",b2.Counter.prototype.GetMinCount);b2.Counter.prototype.GetMaxCount=function(){return this.m_max_count};
goog.exportProperty(b2.Counter.prototype,"GetMaxCount",b2.Counter.prototype.GetMaxCount);b2.Counter.prototype.ResetCount=function(){var a=this.m_count;this.m_count=0;return a};goog.exportProperty(b2.Counter.prototype,"ResetCount",b2.Counter.prototype.ResetCount);b2.Counter.prototype.ResetMinCount=function(){this.m_min_count=0};goog.exportProperty(b2.Counter.prototype,"ResetMinCount",b2.Counter.prototype.ResetMinCount);
b2.Counter.prototype.ResetMaxCount=function(){this.m_max_count=0};goog.exportProperty(b2.Counter.prototype,"ResetMaxCount",b2.Counter.prototype.ResetMaxCount);b2.Counter.prototype.Increment=function(){this.m_count++;this.m_max_count<this.m_count&&(this.m_max_count=this.m_count)};goog.exportProperty(b2.Counter.prototype,"Increment",b2.Counter.prototype.Increment);
b2.Counter.prototype.Decrement=function(){this.m_count--;this.m_min_count>this.m_count&&(this.m_min_count=this.m_count)};goog.exportProperty(b2.Counter.prototype,"Decrement",b2.Counter.prototype.Decrement);b2._toiTime=0;goog.exportSymbol("b2._toiTime",b2._toiTime);b2._toiMaxTime=0;goog.exportSymbol("b2._toiMaxTime",b2._toiMaxTime);b2._toiCalls=0;goog.exportSymbol("b2._toiCalls",b2._toiCalls);b2._toiIters=0;goog.exportSymbol("b2._toiIters",b2._toiIters);b2._toiMaxIters=0;goog.exportSymbol("b2._toiMaxIters",b2._toiMaxIters);b2._toiRootIters=0;goog.exportSymbol("b2._toiRootIters",b2._toiRootIters);
b2._toiMaxRootIters=0;goog.exportSymbol("b2._toiMaxRootIters",b2._toiMaxRootIters);b2.TOIInput=function(){this.proxyA=new b2.DistanceProxy;this.proxyB=new b2.DistanceProxy;this.sweepA=new b2.Sweep;this.sweepB=new b2.Sweep};goog.exportSymbol("b2.TOIInput",b2.TOIInput);b2.TOIInput.prototype.proxyA=null;goog.exportProperty(b2.TOIInput.prototype,"proxyA",b2.TOIInput.prototype.proxyA);b2.TOIInput.prototype.proxyB=null;
goog.exportProperty(b2.TOIInput.prototype,"proxyB",b2.TOIInput.prototype.proxyB);b2.TOIInput.prototype.sweepA=null;goog.exportProperty(b2.TOIInput.prototype,"sweepA",b2.TOIInput.prototype.sweepA);b2.TOIInput.prototype.sweepB=null;goog.exportProperty(b2.TOIInput.prototype,"sweepB",b2.TOIInput.prototype.sweepB);b2.TOIInput.prototype.tMax=0;goog.exportProperty(b2.TOIInput.prototype,"tMax",b2.TOIInput.prototype.tMax);
b2.TOIOutputState={e_unknown:0,e_failed:1,e_overlapped:2,e_touching:3,e_separated:4};goog.exportSymbol("b2.TOIOutputState",b2.TOIOutputState);goog.exportProperty(b2.TOIOutputState,"e_unknown",b2.TOIOutputState.e_unknown);goog.exportProperty(b2.TOIOutputState,"e_failed",b2.TOIOutputState.e_failed);goog.exportProperty(b2.TOIOutputState,"e_overlapped",b2.TOIOutputState.e_overlapped);goog.exportProperty(b2.TOIOutputState,"e_touching",b2.TOIOutputState.e_touching);
goog.exportProperty(b2.TOIOutputState,"e_separated",b2.TOIOutputState.e_separated);b2.TOIOutput=function(){};goog.exportSymbol("b2.TOIOutput",b2.TOIOutput);b2.TOIOutput.prototype.state=b2.TOIOutputState.e_unknown;goog.exportProperty(b2.TOIOutput.prototype,"state",b2.TOIOutput.prototype.state);b2.TOIOutput.prototype.t=0;goog.exportProperty(b2.TOIOutput.prototype,"t",b2.TOIOutput.prototype.t);
b2.SeparationFunctionType={e_unknown:-1,e_points:0,e_faceA:1,e_faceB:2};goog.exportSymbol("b2.SeparationFunctionType",b2.SeparationFunctionType);goog.exportProperty(b2.SeparationFunctionType,"e_unknown",b2.SeparationFunctionType.e_unknown);goog.exportProperty(b2.SeparationFunctionType,"e_points",b2.SeparationFunctionType.e_points);goog.exportProperty(b2.SeparationFunctionType,"e_faceA",b2.SeparationFunctionType.e_faceA);
goog.exportProperty(b2.SeparationFunctionType,"e_faceB",b2.SeparationFunctionType.e_faceB);b2.SeparationFunction=function(){this.m_sweepA=new b2.Sweep;this.m_sweepB=new b2.Sweep;this.m_localPoint=new b2.Vec2;this.m_axis=new b2.Vec2};goog.exportSymbol("b2.SeparationFunction",b2.SeparationFunction);b2.SeparationFunction.prototype.m_proxyA=null;goog.exportProperty(b2.SeparationFunction.prototype,"m_proxyA",b2.SeparationFunction.prototype.m_proxyA);
b2.SeparationFunction.prototype.m_proxyB=null;goog.exportProperty(b2.SeparationFunction.prototype,"m_proxyB",b2.SeparationFunction.prototype.m_proxyB);b2.SeparationFunction.prototype.m_sweepA=null;goog.exportProperty(b2.SeparationFunction.prototype,"m_sweepA",b2.SeparationFunction.prototype.m_sweepA);b2.SeparationFunction.prototype.m_sweepB=null;goog.exportProperty(b2.SeparationFunction.prototype,"m_sweepB",b2.SeparationFunction.prototype.m_sweepB);
b2.SeparationFunction.prototype.m_type=b2.SeparationFunctionType.e_unknown;goog.exportProperty(b2.SeparationFunction.prototype,"m_type",b2.SeparationFunction.prototype.m_type);b2.SeparationFunction.prototype.m_localPoint=null;goog.exportProperty(b2.SeparationFunction.prototype,"m_localPoint",b2.SeparationFunction.prototype.m_localPoint);b2.SeparationFunction.prototype.m_axis=null;goog.exportProperty(b2.SeparationFunction.prototype,"m_axis",b2.SeparationFunction.prototype.m_axis);
b2.SeparationFunction.prototype.Initialize=function(a,b,c,d,e,f){this.m_proxyA=b;this.m_proxyB=d;b=a.count;b2.ENABLE_ASSERTS&&b2.Assert(0<b&&3>b);this.m_sweepA.Copy(c);this.m_sweepB.Copy(e);c=b2.TimeOfImpact.s_xfA;e=b2.TimeOfImpact.s_xfB;this.m_sweepA.GetTransform(c,f);this.m_sweepB.GetTransform(e,f);1===b?(this.m_type=b2.SeparationFunctionType.e_points,b=this.m_proxyA.GetVertex(a.indexA[0]),a=this.m_proxyB.GetVertex(a.indexB[0]),c=b2.Mul_X_V2(c,b,b2.TimeOfImpact.s_pointA),
e=b2.Mul_X_V2(e,a,b2.TimeOfImpact.s_pointB),b2.Sub_V2_V2(e,c,this.m_axis),a=this.m_axis.Normalize(),this.m_localPoint.SetZero()):(a.indexA[0]===a.indexA[1]?(this.m_type=b2.SeparationFunctionType.e_faceB,b=this.m_proxyB.GetVertex(a.indexB[0]),d=this.m_proxyB.GetVertex(a.indexB[1]),b2.Cross_V2_S(b2.Sub_V2_V2(d,b,b2.Vec2.s_t0),1,this.m_axis).SelfNormalize(),f=b2.Mul_R_V2(e.q,this.m_axis,b2.TimeOfImpact.s_normal),b2.Mid_V2_V2(b,d,this.m_localPoint),e=
b2.Mul_X_V2(e,this.m_localPoint,b2.TimeOfImpact.s_pointB),b=this.m_proxyA.GetVertex(a.indexA[0]),c=b2.Mul_X_V2(c,b,b2.TimeOfImpact.s_pointA),a=b2.Dot_V2_V2(b2.Sub_V2_V2(c,e,b2.Vec2.s_t0),f)):(this.m_type=b2.SeparationFunctionType.e_faceA,b=this.m_proxyA.GetVertex(a.indexA[0]),d=this.m_proxyA.GetVertex(a.indexA[1]),b2.Cross_V2_S(b2.Sub_V2_V2(d,b,b2.Vec2.s_t0),1,this.m_axis).SelfNormalize(),f=b2.Mul_R_V2(c.q,this.m_axis,b2.TimeOfImpact.s_normal),
b2.Mid_V2_V2(b,d,this.m_localPoint),c=b2.Mul_X_V2(c,this.m_localPoint,b2.TimeOfImpact.s_pointA),a=this.m_proxyB.GetVertex(a.indexB[0]),e=b2.Mul_X_V2(e,a,b2.TimeOfImpact.s_pointB),a=b2.Dot_V2_V2(b2.Sub_V2_V2(e,c,b2.Vec2.s_t0),f)),0>a&&(this.m_axis.SelfNeg(),a=-a));return a};goog.exportProperty(b2.SeparationFunction.prototype,"Initialize",b2.SeparationFunction.prototype.Initialize);
b2.SeparationFunction.prototype.FindMinSeparation=function(a,b,c){var d=b2.TimeOfImpact.s_xfA,e=b2.TimeOfImpact.s_xfB;this.m_sweepA.GetTransform(d,c);this.m_sweepB.GetTransform(e,c);switch(this.m_type){case b2.SeparationFunctionType.e_points:var f=b2.MulT_R_V2(d.q,this.m_axis,b2.TimeOfImpact.s_axisA),g=b2.MulT_R_V2(e.q,b2.Vec2.s_t0.Copy(this.m_axis).SelfNeg(),b2.TimeOfImpact.s_axisB);a[0]=this.m_proxyA.GetSupport(f);b[0]=this.m_proxyB.GetSupport(g);a=this.m_proxyA.GetVertex(a[0]);
b=this.m_proxyB.GetVertex(b[0]);d=b2.Mul_X_V2(d,a,b2.TimeOfImpact.s_pointA);e=b2.Mul_X_V2(e,b,b2.TimeOfImpact.s_pointB);return b=b2.Dot_V2_V2(b2.Sub_V2_V2(e,d,b2.Vec2.s_t0),this.m_axis);case b2.SeparationFunctionType.e_faceA:return c=b2.Mul_R_V2(d.q,this.m_axis,b2.TimeOfImpact.s_normal),d=b2.Mul_X_V2(d,this.m_localPoint,b2.TimeOfImpact.s_pointA),g=b2.MulT_R_V2(e.q,b2.Vec2.s_t0.Copy(c).SelfNeg(),b2.TimeOfImpact.s_axisB),a[0]=
-1,b[0]=this.m_proxyB.GetSupport(g),b=this.m_proxyB.GetVertex(b[0]),e=b2.Mul_X_V2(e,b,b2.TimeOfImpact.s_pointB),b=b2.Dot_V2_V2(b2.Sub_V2_V2(e,d,b2.Vec2.s_t0),c);case b2.SeparationFunctionType.e_faceB:return c=b2.Mul_R_V2(e.q,this.m_axis,b2.TimeOfImpact.s_normal),e=b2.Mul_X_V2(e,this.m_localPoint,b2.TimeOfImpact.s_pointB),f=b2.MulT_R_V2(d.q,b2.Vec2.s_t0.Copy(c).SelfNeg(),b2.TimeOfImpact.s_axisA),b[0]=-1,a[0]=this.m_proxyA.GetSupport(f),
a=this.m_proxyA.GetVertex(a[0]),d=b2.Mul_X_V2(d,a,b2.TimeOfImpact.s_pointA),b=b2.Dot_V2_V2(b2.Sub_V2_V2(d,e,b2.Vec2.s_t0),c);default:return b2.ENABLE_ASSERTS&&b2.Assert(!1),a[0]=-1,b[0]=-1,0}};goog.exportProperty(b2.SeparationFunction.prototype,"FindMinSeparation",b2.SeparationFunction.prototype.FindMinSeparation);
b2.SeparationFunction.prototype.Evaluate=function(a,b,c){var d=b2.TimeOfImpact.s_xfA,e=b2.TimeOfImpact.s_xfB;this.m_sweepA.GetTransform(d,c);this.m_sweepB.GetTransform(e,c);switch(this.m_type){case b2.SeparationFunctionType.e_points:return a=this.m_proxyA.GetVertex(a),b=this.m_proxyB.GetVertex(b),d=b2.Mul_X_V2(d,a,b2.TimeOfImpact.s_pointA),e=b2.Mul_X_V2(e,b,b2.TimeOfImpact.s_pointB),d=b2.Dot_V2_V2(b2.Sub_V2_V2(e,d,b2.Vec2.s_t0),this.m_axis);case b2.SeparationFunctionType.e_faceA:return c=
b2.Mul_R_V2(d.q,this.m_axis,b2.TimeOfImpact.s_normal),d=b2.Mul_X_V2(d,this.m_localPoint,b2.TimeOfImpact.s_pointA),b=this.m_proxyB.GetVertex(b),e=b2.Mul_X_V2(e,b,b2.TimeOfImpact.s_pointB),d=b2.Dot_V2_V2(b2.Sub_V2_V2(e,d,b2.Vec2.s_t0),c);case b2.SeparationFunctionType.e_faceB:return c=b2.Mul_R_V2(e.q,this.m_axis,b2.TimeOfImpact.s_normal),e=b2.Mul_X_V2(e,this.m_localPoint,b2.TimeOfImpact.s_pointB),a=this.m_proxyA.GetVertex(a),d=b2.Mul_X_V2(d,
a,b2.TimeOfImpact.s_pointA),d=b2.Dot_V2_V2(b2.Sub_V2_V2(d,e,b2.Vec2.s_t0),c);default:return b2.ENABLE_ASSERTS&&b2.Assert(!1),0}};goog.exportProperty(b2.SeparationFunction.prototype,"Evaluate",b2.SeparationFunction.prototype.Evaluate);
b2.TimeOfImpact=function(a,b){var c=b2.TimeOfImpact.s_timer.Reset();++b2._toiCalls;a.state=b2.TOIOutputState.e_unknown;a.t=b.tMax;var d=b.proxyA,e=b.proxyB,f=b2.TimeOfImpact.s_sweepA.Copy(b.sweepA),g=b2.TimeOfImpact.s_sweepB.Copy(b.sweepB);f.Normalize();g.Normalize();var h=b.tMax,k=b2.Max(b2._linearSlop,d.m_radius+e.m_radius-3*b2._linearSlop),l=.25*b2._linearSlop;b2.ENABLE_ASSERTS&&b2.Assert(k>l);var m=0,n=0,p=b2.TimeOfImpact.s_cache;
p.count=0;var q=b2.TimeOfImpact.s_distanceInput;q.proxyA=b.proxyA;q.proxyB=b.proxyB;for(q.useRadii=!1;;){var r=b2.TimeOfImpact.s_xfA,u=b2.TimeOfImpact.s_xfB;f.GetTransform(r,m);g.GetTransform(u,m);q.transformA.Copy(r);q.transformB.Copy(u);r=b2.TimeOfImpact.s_distanceOutput;b2.ShapeDistance(r,p,q);if(0>=r.distance){a.state=b2.TOIOutputState.e_overlapped;a.t=0;break}if(r.distance<k+l){a.state=b2.TOIOutputState.e_touching;a.t=m;break}r=b2.TimeOfImpact.s_fcn;r.Initialize(p,
d,f,e,g,m);for(var u=!1,t=h,w=0;;){var x=b2.TimeOfImpact.s_indexA,v=b2.TimeOfImpact.s_indexB,y=r.FindMinSeparation(x,v,t);if(y>k+l){a.state=b2.TOIOutputState.e_separated;a.t=h;u=!0;break}if(y>k-l){m=t;break}var z=r.Evaluate(x[0],v[0],m);if(z<k-l){a.state=b2.TOIOutputState.e_failed;a.t=m;u=!0;break}if(z<=k+l){a.state=b2.TOIOutputState.e_touching;a.t=m;u=!0;break}for(var B=0,E=m,F=t;;){var G=0,G=B&1?E+(k-z)*(F-E)/(y-z):.5*(E+F);++B;++b2._toiRootIters;var H=r.Evaluate(x[0],
v[0],G);if(b2.Abs(H-k)<l){t=G;break}H>k?(E=G,z=H):(F=G,y=H);if(50===B)break}b2._toiMaxRootIters=b2.Max(b2._toiMaxRootIters,B);++w;if(w===b2._maxPolygonVertices)break}++n;++b2._toiIters;if(u)break;if(20===n){a.state=b2.TOIOutputState.e_failed;a.t=m;break}}b2._toiMaxIters=b2.Max(b2._toiMaxIters,n);c=c.GetMilliseconds();b2._toiMaxTime=b2.Max(b2._toiMaxTime,c);b2._toiTime+=c};goog.exportSymbol("b2.TimeOfImpact",b2.TimeOfImpact);
b2.TimeOfImpact.s_timer=new b2.Timer;b2.TimeOfImpact.s_cache=new b2.SimplexCache;b2.TimeOfImpact.s_distanceInput=new b2.DistanceInput;b2.TimeOfImpact.s_distanceOutput=new b2.DistanceOutput;b2.TimeOfImpact.s_xfA=new b2.Transform;b2.TimeOfImpact.s_xfB=new b2.Transform;b2.TimeOfImpact.s_indexA=b2.MakeNumberArray(1);b2.TimeOfImpact.s_indexB=b2.MakeNumberArray(1);b2.TimeOfImpact.s_fcn=new b2.SeparationFunction;
b2.TimeOfImpact.s_sweepA=new b2.Sweep;b2.TimeOfImpact.s_sweepB=new b2.Sweep;b2.TimeOfImpact.s_pointA=new b2.Vec2;b2.TimeOfImpact.s_pointB=new b2.Vec2;b2.TimeOfImpact.s_normal=new b2.Vec2;b2.TimeOfImpact.s_axisA=new b2.Vec2;b2.TimeOfImpact.s_axisB=new b2.Vec2;b2.Filter=function(){};goog.exportSymbol("b2.Filter",b2.Filter);b2.Filter.prototype.categoryBits=1;goog.exportProperty(b2.Filter.prototype,"categoryBits",b2.Filter.prototype.categoryBits);b2.Filter.prototype.maskBits=65535;goog.exportProperty(b2.Filter.prototype,"maskBits",b2.Filter.prototype.maskBits);b2.Filter.prototype.groupIndex=0;goog.exportProperty(b2.Filter.prototype,"groupIndex",b2.Filter.prototype.groupIndex);
b2.Filter.prototype.Clone=function(){return(new b2.Filter).Copy(this)};goog.exportProperty(b2.Filter.prototype,"Clone",b2.Filter.prototype.Clone);b2.Filter.prototype.Copy=function(a){b2.ENABLE_ASSERTS&&b2.Assert(this!==a);this.categoryBits=a.categoryBits;this.maskBits=a.maskBits;this.groupIndex=a.groupIndex;return this};goog.exportProperty(b2.Filter.prototype,"Copy",b2.Filter.prototype.Copy);b2.FixtureDef=function(){this.filter=new b2.Filter};
goog.exportSymbol("b2.FixtureDef",b2.FixtureDef);b2.FixtureDef.prototype.shape=null;goog.exportProperty(b2.FixtureDef.prototype,"shape",b2.FixtureDef.prototype.shape);b2.FixtureDef.prototype.userData=null;goog.exportProperty(b2.FixtureDef.prototype,"userData",b2.FixtureDef.prototype.userData);b2.FixtureDef.prototype.friction=.2;goog.exportProperty(b2.FixtureDef.prototype,"friction",b2.FixtureDef.prototype.friction);
b2.FixtureDef.prototype.restitution=0;goog.exportProperty(b2.FixtureDef.prototype,"restitution",b2.FixtureDef.prototype.restitution);b2.FixtureDef.prototype.density=0;goog.exportProperty(b2.FixtureDef.prototype,"density",b2.FixtureDef.prototype.density);b2.FixtureDef.prototype.isSensor=!1;goog.exportProperty(b2.FixtureDef.prototype,"isSensor",b2.FixtureDef.prototype.isSensor);b2.FixtureDef.prototype.filter=null;
goog.exportProperty(b2.FixtureDef.prototype,"filter",b2.FixtureDef.prototype.filter);b2.FixtureProxy=function(){this.aabb=new b2.AABB};goog.exportSymbol("b2.FixtureProxy",b2.FixtureProxy);b2.FixtureProxy.prototype.aabb=null;goog.exportProperty(b2.FixtureProxy.prototype,"aabb",b2.FixtureProxy.prototype.aabb);b2.FixtureProxy.prototype.fixture=null;goog.exportProperty(b2.FixtureProxy.prototype,"fixture",b2.FixtureProxy.prototype.fixture);
b2.FixtureProxy.prototype.childIndex=0;goog.exportProperty(b2.FixtureProxy.prototype,"childIndex",b2.FixtureProxy.prototype.childIndex);b2.FixtureProxy.prototype.proxy=null;goog.exportProperty(b2.FixtureProxy.prototype,"proxy",b2.FixtureProxy.prototype.proxy);b2.FixtureProxy.MakeArray=function(a){return b2.MakeArray(a,function(a){return new b2.FixtureProxy})};goog.exportProperty(b2.FixtureProxy,"MakeArray",b2.FixtureProxy.MakeArray);
b2.Fixture=function(){this.m_proxyCount=0;this.m_filter=new b2.Filter};goog.exportSymbol("b2.Fixture",b2.Fixture);b2.Fixture.prototype.m_density=0;goog.exportProperty(b2.Fixture.prototype,"m_density",b2.Fixture.prototype.m_density);b2.Fixture.prototype.m_next=null;goog.exportProperty(b2.Fixture.prototype,"m_next",b2.Fixture.prototype.m_next);b2.Fixture.prototype.m_body=null;goog.exportProperty(b2.Fixture.prototype,"m_body",b2.Fixture.prototype.m_body);
b2.Fixture.prototype.m_shape=null;goog.exportProperty(b2.Fixture.prototype,"m_shape",b2.Fixture.prototype.m_shape);b2.Fixture.prototype.m_friction=0;goog.exportProperty(b2.Fixture.prototype,"m_friction",b2.Fixture.prototype.m_friction);b2.Fixture.prototype.m_restitution=0;goog.exportProperty(b2.Fixture.prototype,"m_restitution",b2.Fixture.prototype.m_restitution);b2.Fixture.prototype.m_proxies=null;
goog.exportProperty(b2.Fixture.prototype,"m_proxies",b2.Fixture.prototype.m_proxies);b2.Fixture.prototype.m_proxyCount=0;goog.exportProperty(b2.Fixture.prototype,"m_proxyCount",b2.Fixture.prototype.m_proxyCount);b2.Fixture.prototype.m_filter=null;goog.exportProperty(b2.Fixture.prototype,"m_filter",b2.Fixture.prototype.m_filter);b2.Fixture.prototype.m_isSensor=!1;goog.exportProperty(b2.Fixture.prototype,"m_isSensor",b2.Fixture.prototype.m_isSensor);
b2.Fixture.prototype.m_userData=null;goog.exportProperty(b2.Fixture.prototype,"m_userData",b2.Fixture.prototype.m_userData);b2.Fixture.prototype.GetType=function(){return this.m_shape.GetType()};goog.exportProperty(b2.Fixture.prototype,"GetType",b2.Fixture.prototype.GetType);b2.Fixture.prototype.GetShape=function(){return this.m_shape};goog.exportProperty(b2.Fixture.prototype,"GetShape",b2.Fixture.prototype.GetShape);
b2.Fixture.prototype.IsSensor=function(){return this.m_isSensor};goog.exportProperty(b2.Fixture.prototype,"IsSensor",b2.Fixture.prototype.IsSensor);b2.Fixture.prototype.GetFilterData=function(a){a=a||new b2.Filter;return a.Copy(this.m_filter)};goog.exportProperty(b2.Fixture.prototype,"GetFilterData",b2.Fixture.prototype.GetFilterData);b2.Fixture.prototype.GetUserData=function(){return this.m_userData};
goog.exportProperty(b2.Fixture.prototype,"GetUserData",b2.Fixture.prototype.GetUserData);b2.Fixture.prototype.SetUserData=function(a){this.m_userData=a};goog.exportProperty(b2.Fixture.prototype,"SetUserData",b2.Fixture.prototype.SetUserData);b2.Fixture.prototype.GetBody=function(){return this.m_body};goog.exportProperty(b2.Fixture.prototype,"GetBody",b2.Fixture.prototype.GetBody);b2.Fixture.prototype.GetNext=function(){return this.m_next};
goog.exportProperty(b2.Fixture.prototype,"GetNext",b2.Fixture.prototype.GetNext);b2.Fixture.prototype.SetDensity=function(a){this.m_density=a};goog.exportProperty(b2.Fixture.prototype,"SetDensity",b2.Fixture.prototype.SetDensity);b2.Fixture.prototype.GetDensity=function(){return this.m_density};goog.exportProperty(b2.Fixture.prototype,"GetDensity",b2.Fixture.prototype.GetDensity);b2.Fixture.prototype.GetFriction=function(){return this.m_friction};
goog.exportProperty(b2.Fixture.prototype,"GetFriction",b2.Fixture.prototype.GetFriction);b2.Fixture.prototype.SetFriction=function(a){this.m_friction=a};goog.exportProperty(b2.Fixture.prototype,"SetFriction",b2.Fixture.prototype.SetFriction);b2.Fixture.prototype.GetRestitution=function(){return this.m_restitution};goog.exportProperty(b2.Fixture.prototype,"GetRestitution",b2.Fixture.prototype.GetRestitution);
b2.Fixture.prototype.SetRestitution=function(a){this.m_restitution=a};goog.exportProperty(b2.Fixture.prototype,"SetRestitution",b2.Fixture.prototype.SetRestitution);b2.Fixture.prototype.TestPoint=function(a){return this.m_shape.TestPoint(this.m_body.GetTransform(),a)};goog.exportProperty(b2.Fixture.prototype,"TestPoint",b2.Fixture.prototype.TestPoint);
b2.Fixture.prototype.ComputeDistance=function(a,b,c){return this.m_shape.ComputeDistance(this.m_body.GetTransform(),a,b,c)};goog.exportProperty(b2.Fixture.prototype,"ComputeDistance",b2.Fixture.prototype.ComputeDistance);b2.Fixture.prototype.RayCast=function(a,b,c){return this.m_shape.RayCast(a,b,this.m_body.GetTransform(),c)};goog.exportProperty(b2.Fixture.prototype,"RayCast",b2.Fixture.prototype.RayCast);
b2.Fixture.prototype.GetMassData=function(a){a=a||new b2.MassData;this.m_shape.ComputeMass(a,this.m_density);return a};goog.exportProperty(b2.Fixture.prototype,"GetMassData",b2.Fixture.prototype.GetMassData);b2.Fixture.prototype.GetAABB=function(a){b2.ENABLE_ASSERTS&&b2.Assert(0<=a&&a<this.m_proxyCount);return this.m_proxies[a].aabb};goog.exportProperty(b2.Fixture.prototype,"GetAABB",b2.Fixture.prototype.GetAABB);
b2.Fixture.prototype.Create=function(a,b){this.m_userData=b.userData;this.m_friction=b.friction;this.m_restitution=b.restitution;this.m_body=a;this.m_next=null;this.m_filter.Copy(b.filter);this.m_isSensor=b.isSensor;this.m_shape=b.shape.Clone();this.m_proxies=b2.FixtureProxy.MakeArray(this.m_shape.GetChildCount());this.m_proxyCount=0;this.m_density=b.density};goog.exportProperty(b2.Fixture.prototype,"Create",b2.Fixture.prototype.Create);
b2.Fixture.prototype.Destroy=function(){b2.ENABLE_ASSERTS&&b2.Assert(0===this.m_proxyCount);this.m_shape=null};goog.exportProperty(b2.Fixture.prototype,"Destroy",b2.Fixture.prototype.Destroy);
b2.Fixture.prototype.CreateProxies=function(a,b){b2.ENABLE_ASSERTS&&b2.Assert(0===this.m_proxyCount);this.m_proxyCount=this.m_shape.GetChildCount();for(var c=0;c<this.m_proxyCount;++c){var d=this.m_proxies[c];this.m_shape.ComputeAABB(d.aabb,b,c);d.proxy=a.CreateProxy(d.aabb,d);d.fixture=this;d.childIndex=c}};goog.exportProperty(b2.Fixture.prototype,"CreateProxies",b2.Fixture.prototype.CreateProxies);
b2.Fixture.prototype.DestroyProxies=function(a){for(var b=0;b<this.m_proxyCount;++b){var c=this.m_proxies[b];a.DestroyProxy(c.proxy);c.proxy=null}this.m_proxyCount=0};goog.exportProperty(b2.Fixture.prototype,"DestroyProxies",b2.Fixture.prototype.DestroyProxies);
b2.Fixture.prototype.Synchronize=function(a,b,c){if(0!==this.m_proxyCount)for(var d=0;d<this.m_proxyCount;++d){var e=this.m_proxies[d],f=b2.Fixture.prototype.Synchronize.s_aabb1,g=b2.Fixture.prototype.Synchronize.s_aabb2;this.m_shape.ComputeAABB(f,b,d);this.m_shape.ComputeAABB(g,c,d);e.aabb.Combine2(f,g);f=b2.Sub_V2_V2(c.p,b.p,b2.Fixture.prototype.Synchronize.s_displacement);a.MoveProxy(e.proxy,e.aabb,f)}};goog.exportProperty(b2.Fixture.prototype,"Synchronize",b2.Fixture.prototype.Synchronize);
b2.Fixture.prototype.Synchronize.s_aabb1=new b2.AABB;b2.Fixture.prototype.Synchronize.s_aabb2=new b2.AABB;b2.Fixture.prototype.Synchronize.s_displacement=new b2.Vec2;b2.Fixture.prototype.SetFilterData=function(a){this.m_filter.Copy(a);this.Refilter()};goog.exportProperty(b2.Fixture.prototype,"SetFilterData",b2.Fixture.prototype.SetFilterData);
b2.Fixture.prototype.Refilter=function(){if(null!==this.m_body){for(var a=this.m_body.GetContactList();a;){var b=a.contact,c=b.GetFixtureA(),d=b.GetFixtureB();c!==this&&d!==this||b.FlagForFiltering();a=a.next}a=this.m_body.GetWorld();if(null!==a)for(a=a.m_contactManager.m_broadPhase,b=0;b<this.m_proxyCount;++b)a.TouchProxy(this.m_proxies[b].proxy)}};goog.exportProperty(b2.Fixture.prototype,"Refilter",b2.Fixture.prototype.Refilter);
b2.Fixture.prototype.SetSensor=function(a){a!==this.m_isSensor&&(this.m_body.SetAwake(!0),this.m_isSensor=a)};goog.exportProperty(b2.Fixture.prototype,"SetSensor",b2.Fixture.prototype.SetSensor);
b2.Fixture.prototype.Dump=function(a){b2.DEBUG&&(b2.Log("    /*b2.FixtureDef*/ var fd = new b2.FixtureDef();\n"),b2.Log("    fd.friction = %.15f;\n",this.m_friction),b2.Log("    fd.restitution = %.15f;\n",this.m_restitution),b2.Log("    fd.density = %.15f;\n",this.m_density),b2.Log("    fd.isSensor = %s;\n",this.m_isSensor?"true":"false"),b2.Log("    fd.filter.categoryBits = %d;\n",this.m_filter.categoryBits),b2.Log("    fd.filter.maskBits = %d;\n",
this.m_filter.maskBits),b2.Log("    fd.filter.groupIndex = %d;\n",this.m_filter.groupIndex),this.m_shape.Dump(),b2.Log("\n"),b2.Log("    fd.shape = shape;\n"),b2.Log("\n"),b2.Log("    bodies[%d].CreateFixture(fd);\n",a))};goog.exportProperty(b2.Fixture.prototype,"Dump",b2.Fixture.prototype.Dump);b2.BodyType={unknown:-1,staticBody:0,kinematicBody:1,dynamicBody:2,bulletBody:3};goog.exportSymbol("b2.BodyType",b2.BodyType);goog.exportProperty(b2.BodyType,"unknown",b2.BodyType.unknown);goog.exportProperty(b2.BodyType,"staticBody",b2.BodyType.staticBody);goog.exportProperty(b2.BodyType,"kinematicBody",b2.BodyType.kinematicBody);goog.exportProperty(b2.BodyType,"dynamicBody",b2.BodyType.dynamicBody);
goog.exportProperty(b2.BodyType,"bulletBody",b2.BodyType.bulletBody);b2.BodyDef=function(){this.position=new b2.Vec2(0,0);this.linearVelocity=new b2.Vec2(0,0)};goog.exportSymbol("b2.BodyDef",b2.BodyDef);b2.BodyDef.prototype.type=b2.BodyType.staticBody;goog.exportProperty(b2.BodyDef.prototype,"type",b2.BodyDef.prototype.type);b2.BodyDef.prototype.position=null;goog.exportProperty(b2.BodyDef.prototype,"position",b2.BodyDef.prototype.position);
b2.BodyDef.prototype.angle=0;goog.exportProperty(b2.BodyDef.prototype,"angle",b2.BodyDef.prototype.angle);b2.BodyDef.prototype.linearVelocity=null;goog.exportProperty(b2.BodyDef.prototype,"linearVelocity",b2.BodyDef.prototype.linearVelocity);b2.BodyDef.prototype.angularVelocity=0;goog.exportProperty(b2.BodyDef.prototype,"angularVelocity",b2.BodyDef.prototype.angularVelocity);b2.BodyDef.prototype.linearDamping=0;
goog.exportProperty(b2.BodyDef.prototype,"linearDamping",b2.BodyDef.prototype.linearDamping);b2.BodyDef.prototype.angularDamping=0;goog.exportProperty(b2.BodyDef.prototype,"angularDamping",b2.BodyDef.prototype.angularDamping);b2.BodyDef.prototype.allowSleep=!0;goog.exportProperty(b2.BodyDef.prototype,"allowSleep",b2.BodyDef.prototype.allowSleep);b2.BodyDef.prototype.awake=!0;goog.exportProperty(b2.BodyDef.prototype,"awake",b2.BodyDef.prototype.awake);
b2.BodyDef.prototype.fixedRotation=!1;goog.exportProperty(b2.BodyDef.prototype,"fixedRotation",b2.BodyDef.prototype.fixedRotation);b2.BodyDef.prototype.bullet=!1;goog.exportProperty(b2.BodyDef.prototype,"bullet",b2.BodyDef.prototype.bullet);b2.BodyDef.prototype.active=!0;goog.exportProperty(b2.BodyDef.prototype,"active",b2.BodyDef.prototype.active);b2.BodyDef.prototype.userData=null;goog.exportProperty(b2.BodyDef.prototype,"userData",b2.BodyDef.prototype.userData);
b2.BodyDef.prototype.gravityScale=1;goog.exportProperty(b2.BodyDef.prototype,"gravityScale",b2.BodyDef.prototype.gravityScale);
b2.Body=function(a,b){this.m_xf=new b2.Transform;this.m_out_xf=new b2.Transform;this.m_xf0=new b2.Transform;this.m_sweep=new b2.Sweep;this.m_out_sweep=new b2.Sweep;this.m_linearVelocity=new b2.Vec2;this.m_out_linearVelocity=new b2.Vec2;this.m_force=new b2.Vec2;b2.ENABLE_ASSERTS&&b2.Assert(a.position.IsValid());b2.ENABLE_ASSERTS&&b2.Assert(a.linearVelocity.IsValid());b2.ENABLE_ASSERTS&&b2.Assert(b2.IsValid(a.angle));b2.ENABLE_ASSERTS&&
b2.Assert(b2.IsValid(a.angularVelocity));b2.ENABLE_ASSERTS&&b2.Assert(b2.IsValid(a.gravityScale)&&0<=a.gravityScale);b2.ENABLE_ASSERTS&&b2.Assert(b2.IsValid(a.angularDamping)&&0<=a.angularDamping);b2.ENABLE_ASSERTS&&b2.Assert(b2.IsValid(a.linearDamping)&&0<=a.linearDamping);a.bullet&&(this.m_flag_bulletFlag=!0);a.fixedRotation&&(this.m_flag_fixedRotationFlag=!0);a.allowSleep&&(this.m_flag_autoSleepFlag=!0);a.awake&&(this.m_flag_awakeFlag=!0);a.active&&
(this.m_flag_activeFlag=!0);this.m_world=b;this.m_xf.p.Copy(a.position);this.m_xf.q.SetAngle(a.angle);this.m_xf0.Copy(this.m_xf);this.m_sweep.localCenter.SetZero();this.m_sweep.c0.Copy(this.m_xf.p);this.m_sweep.c.Copy(this.m_xf.p);this.m_sweep.a0=a.angle;this.m_sweep.a=a.angle;this.m_sweep.alpha0=0;this.m_linearVelocity.Copy(a.linearVelocity);this.m_angularVelocity=a.angularVelocity;this.m_linearDamping=a.linearDamping;this.m_angularDamping=a.angularDamping;this.m_gravityScale=a.gravityScale;this.m_force.SetZero();
this.m_sleepTime=this.m_torque=0;this.m_type=a.type;this.m_invMass=a.type===b2.BodyType.dynamicBody?this.m_mass=1:this.m_mass=0;this.m_invI=this.m_I=0;this.m_userData=a.userData;this.m_fixtureList=null;this.m_fixtureCount=0;this.m_controllerList=null;this.m_controllerCount=0};goog.exportSymbol("b2.Body",b2.Body);b2.Body.prototype.m_flag_islandFlag=!1;goog.exportProperty(b2.Body.prototype,"m_flag_islandFlag",b2.Body.prototype.m_flag_islandFlag);
b2.Body.prototype.m_flag_awakeFlag=!1;goog.exportProperty(b2.Body.prototype,"m_flag_awakeFlag",b2.Body.prototype.m_flag_awakeFlag);b2.Body.prototype.m_flag_autoSleepFlag=!1;goog.exportProperty(b2.Body.prototype,"m_flag_autoSleepFlag",b2.Body.prototype.m_flag_autoSleepFlag);b2.Body.prototype.m_flag_bulletFlag=!1;goog.exportProperty(b2.Body.prototype,"m_flag_bulletFlag",b2.Body.prototype.m_flag_bulletFlag);
b2.Body.prototype.m_flag_fixedRotationFlag=!1;goog.exportProperty(b2.Body.prototype,"m_flag_fixedRotationFlag",b2.Body.prototype.m_flag_fixedRotationFlag);b2.Body.prototype.m_flag_activeFlag=!1;goog.exportProperty(b2.Body.prototype,"m_flag_activeFlag",b2.Body.prototype.m_flag_activeFlag);b2.Body.prototype.m_flag_toiFlag=!1;goog.exportProperty(b2.Body.prototype,"m_flag_toiFlag",b2.Body.prototype.m_flag_toiFlag);b2.Body.prototype.m_islandIndex=0;
goog.exportProperty(b2.Body.prototype,"m_islandIndex",b2.Body.prototype.m_islandIndex);b2.Body.prototype.m_world=null;goog.exportProperty(b2.Body.prototype,"m_world",b2.Body.prototype.m_world);b2.Body.prototype.m_xf=null;goog.exportProperty(b2.Body.prototype,"m_xf",b2.Body.prototype.m_xf);b2.Body.prototype.m_out_xf=null;goog.exportProperty(b2.Body.prototype,"m_out_xf",b2.Body.prototype.m_out_xf);b2.Body.prototype.m_xf0=null;
goog.exportProperty(b2.Body.prototype,"m_xf0",b2.Body.prototype.m_xf0);b2.Body.prototype.m_sweep=null;goog.exportProperty(b2.Body.prototype,"m_sweep",b2.Body.prototype.m_sweep);b2.Body.prototype.m_out_sweep=null;goog.exportProperty(b2.Body.prototype,"m_out_sweep",b2.Body.prototype.m_out_sweep);b2.Body.prototype.m_jointList=null;goog.exportProperty(b2.Body.prototype,"m_jointList",b2.Body.prototype.m_jointList);
b2.Body.prototype.m_contactList=null;goog.exportProperty(b2.Body.prototype,"m_contactList",b2.Body.prototype.m_contactList);b2.Body.prototype.m_prev=null;goog.exportProperty(b2.Body.prototype,"m_prev",b2.Body.prototype.m_prev);b2.Body.prototype.m_next=null;goog.exportProperty(b2.Body.prototype,"m_next",b2.Body.prototype.m_next);b2.Body.prototype.m_linearVelocity=null;goog.exportProperty(b2.Body.prototype,"m_linearVelocity",b2.Body.prototype.m_linearVelocity);
b2.Body.prototype.m_out_linearVelocity=null;goog.exportProperty(b2.Body.prototype,"m_out_linearVelocity",b2.Body.prototype.m_out_linearVelocity);b2.Body.prototype.m_angularVelocity=0;goog.exportProperty(b2.Body.prototype,"m_angularVelocity",b2.Body.prototype.m_angularVelocity);b2.Body.prototype.m_linearDamping=0;goog.exportProperty(b2.Body.prototype,"m_linearDamping",b2.Body.prototype.m_linearDamping);b2.Body.prototype.m_angularDamping=0;
goog.exportProperty(b2.Body.prototype,"m_angularDamping",b2.Body.prototype.m_angularDamping);b2.Body.prototype.m_gravityScale=1;goog.exportProperty(b2.Body.prototype,"m_gravityScale",b2.Body.prototype.m_gravityScale);b2.Body.prototype.m_force=null;goog.exportProperty(b2.Body.prototype,"m_force",b2.Body.prototype.m_force);b2.Body.prototype.m_torque=0;goog.exportProperty(b2.Body.prototype,"m_torque",b2.Body.prototype.m_torque);
b2.Body.prototype.m_sleepTime=0;goog.exportProperty(b2.Body.prototype,"m_sleepTime",b2.Body.prototype.m_sleepTime);b2.Body.prototype.m_type=b2.BodyType.staticBody;goog.exportProperty(b2.Body.prototype,"m_type",b2.Body.prototype.m_type);b2.Body.prototype.m_mass=1;goog.exportProperty(b2.Body.prototype,"m_mass",b2.Body.prototype.m_mass);b2.Body.prototype.m_invMass=1;goog.exportProperty(b2.Body.prototype,"m_invMass",b2.Body.prototype.m_invMass);
b2.Body.prototype.m_I=0;goog.exportProperty(b2.Body.prototype,"m_I",b2.Body.prototype.m_I);b2.Body.prototype.m_invI=0;goog.exportProperty(b2.Body.prototype,"m_invI",b2.Body.prototype.m_invI);b2.Body.prototype.m_userData=null;goog.exportProperty(b2.Body.prototype,"m_userData",b2.Body.prototype.m_userData);b2.Body.prototype.m_fixtureList=null;goog.exportProperty(b2.Body.prototype,"m_fixtureList",b2.Body.prototype.m_fixtureList);
b2.Body.prototype.m_fixtureCount=0;goog.exportProperty(b2.Body.prototype,"m_fixtureCount",b2.Body.prototype.m_fixtureCount);b2.Body.prototype.m_controllerList=null;goog.exportProperty(b2.Body.prototype,"m_controllerList",b2.Body.prototype.m_controllerList);b2.Body.prototype.m_controllerCount=0;goog.exportProperty(b2.Body.prototype,"m_controllerCount",b2.Body.prototype.m_controllerCount);
b2.Body.prototype.CreateFixture=function(a,b){if(a instanceof b2.FixtureDef)return this.CreateFixture_Def(a);if(a instanceof b2.Shape&&"number"===typeof b)return this.CreateFixture_Shape_Density(a,b);throw Error();};goog.exportProperty(b2.Body.prototype,"CreateFixture",b2.Body.prototype.CreateFixture);
b2.Body.prototype.CreateFixture_Def=function(a){b2.ENABLE_ASSERTS&&b2.Assert(!this.m_world.IsLocked());if(this.m_world.IsLocked())return null;var b=new b2.Fixture;b.Create(this,a);this.m_flag_activeFlag&&b.CreateProxies(this.m_world.m_contactManager.m_broadPhase,this.m_xf);b.m_next=this.m_fixtureList;this.m_fixtureList=b;++this.m_fixtureCount;b.m_body=this;0<b.m_density&&this.ResetMassData();this.m_world.m_flag_newFixture=!0;return b};
goog.exportProperty(b2.Body.prototype,"CreateFixture_Def",b2.Body.prototype.CreateFixture_Def);b2.Body.prototype.CreateFixture_Shape_Density=function(a,b){var c=b2.Body.prototype.CreateFixture_Shape_Density.s_def;c.shape=a;c.density="number"===typeof b?b:0;return this.CreateFixture_Def(c)};goog.exportProperty(b2.Body.prototype,"CreateFixture_Shape_Density",b2.Body.prototype.CreateFixture_Shape_Density);b2.Body.prototype.CreateFixture_Shape_Density.s_def=new b2.FixtureDef;
b2.Body.prototype.DestroyFixture=function(a){b2.ENABLE_ASSERTS&&b2.Assert(!this.m_world.IsLocked());if(!this.m_world.IsLocked()){b2.ENABLE_ASSERTS&&b2.Assert(a.m_body===this);b2.ENABLE_ASSERTS&&b2.Assert(0<this.m_fixtureCount);for(var b=this.m_fixtureList,c=null,d=!1;null!==b;){if(b===a){c?c.m_next=a.m_next:this.m_fixtureList=a.m_next;d=!0;break}c=b;b=b.m_next}b2.ENABLE_ASSERTS&&b2.Assert(d);for(b=this.m_contactList;b;){var c=b.contact,b=b.next,d=c.GetFixtureA(),
e=c.GetFixtureB();a!==d&&a!==e||this.m_world.m_contactManager.Destroy(c)}this.m_flag_activeFlag&&a.DestroyProxies(this.m_world.m_contactManager.m_broadPhase);a.Destroy();a.m_body=null;a.m_next=null;--this.m_fixtureCount;this.ResetMassData()}};goog.exportProperty(b2.Body.prototype,"DestroyFixture",b2.Body.prototype.DestroyFixture);
b2.Body.prototype.SetTransform=function(a,b,c){if(a instanceof b2.Vec2&&"number"===typeof b)this.SetTransform_X_Y_A(a.x,a.y,b);else if(a instanceof b2.Transform)this.SetTransform_X_Y_A(a.p.x,a.p.y,a.GetAngle());else if("number"===typeof a&&"number"===typeof b&&"number"===typeof c)this.SetTransform_X_Y_A(a,b,c);else throw Error();};goog.exportProperty(b2.Body.prototype,"SetTransform",b2.Body.prototype.SetTransform);
b2.Body.prototype.SetTransform_V2_A=function(a,b){this.SetTransform_X_Y_A(a.x,a.y,b)};goog.exportProperty(b2.Body.prototype,"SetTransform_V2_A",b2.Body.prototype.SetTransform_V2_A);
b2.Body.prototype.SetTransform_X_Y_A=function(a,b,c){b2.ENABLE_ASSERTS&&b2.Assert(!this.m_world.IsLocked());if(!this.m_world.IsLocked()&&(this.m_xf.p.x!==a||this.m_xf.p.y!==b||this.m_xf.q.GetAngle()!==c))for(this.m_xf.q.SetAngle(c),this.m_xf.p.Set(a,b),this.m_xf0.Copy(this.m_xf),b2.Mul_X_V2(this.m_xf,this.m_sweep.localCenter,this.m_sweep.c),this.m_sweep.a=c,this.m_sweep.c0.Copy(this.m_sweep.c),this.m_sweep.a0=c,a=this.m_world.m_contactManager.m_broadPhase,b=this.m_fixtureList;b;b=
b.m_next)b.Synchronize(a,this.m_xf,this.m_xf)};goog.exportProperty(b2.Body.prototype,"SetTransform_X_Y_A",b2.Body.prototype.SetTransform_X_Y_A);b2.Body.prototype.SetTransform_X=function(a){this.SetTransform_X_Y_A(a.p.x,a.p.y,a.GetAngle())};goog.exportProperty(b2.Body.prototype,"SetTransform_X",b2.Body.prototype.SetTransform_X);b2.Body.prototype.GetTransform=function(a){a=a||this.m_out_xf;return a.Copy(this.m_xf)};
goog.exportProperty(b2.Body.prototype,"GetTransform",b2.Body.prototype.GetTransform);b2.Body.prototype.GetPosition=function(a){a=a||this.m_out_xf.p;return a.Copy(this.m_xf.p)};goog.exportProperty(b2.Body.prototype,"GetPosition",b2.Body.prototype.GetPosition);b2.Body.prototype.SetPosition=function(a){this.SetTransform_V2_A(a,this.GetAngle())};goog.exportProperty(b2.Body.prototype,"SetPosition",b2.Body.prototype.SetPosition);
b2.Body.prototype.SetPositionXY=function(a,b){this.SetTransform_X_Y_A(a,b,this.GetAngle())};goog.exportProperty(b2.Body.prototype,"SetPositionXY",b2.Body.prototype.SetPositionXY);b2.Body.prototype.GetRotation=function(a){a=a||this.m_out_xf.q;return a.Copy(this.m_xf.q)};goog.exportProperty(b2.Body.prototype,"GetRotation",b2.Body.prototype.GetRotation);b2.Body.prototype.SetRotation=function(a){this.SetTransform_V2_A(this.GetPosition(),a.GetAngle())};
goog.exportProperty(b2.Body.prototype,"SetRotation",b2.Body.prototype.SetRotation);b2.Body.prototype.GetAngle=function(){return this.m_sweep.a};goog.exportProperty(b2.Body.prototype,"GetAngle",b2.Body.prototype.GetAngle);b2.Body.prototype.SetAngle=function(a){this.SetTransform_V2_A(this.GetPosition(),a)};goog.exportProperty(b2.Body.prototype,"SetAngle",b2.Body.prototype.SetAngle);b2.Body.prototype.GetWorldCenter=function(a){a=a||this.m_out_sweep.c;return a.Copy(this.m_sweep.c)};
goog.exportProperty(b2.Body.prototype,"GetWorldCenter",b2.Body.prototype.GetWorldCenter);b2.Body.prototype.GetLocalCenter=function(a){a=a||this.m_out_sweep.localCenter;return a.Copy(this.m_sweep.localCenter)};goog.exportProperty(b2.Body.prototype,"GetLocalCenter",b2.Body.prototype.GetLocalCenter);b2.Body.prototype.SetLinearVelocity=function(a){this.m_type!==b2.BodyType.staticBody&&(0<b2.Dot_V2_V2(a,a)&&this.SetAwake(!0),this.m_linearVelocity.Copy(a))};
goog.exportProperty(b2.Body.prototype,"SetLinearVelocity",b2.Body.prototype.SetLinearVelocity);b2.Body.prototype.GetLinearVelocity=function(a){a=a||this.m_out_linearVelocity;return a.Copy(this.m_linearVelocity)};goog.exportProperty(b2.Body.prototype,"GetLinearVelocity",b2.Body.prototype.GetLinearVelocity);b2.Body.prototype.SetAngularVelocity=function(a){this.m_type!==b2.BodyType.staticBody&&(0<a*a&&this.SetAwake(!0),this.m_angularVelocity=a)};
goog.exportProperty(b2.Body.prototype,"SetAngularVelocity",b2.Body.prototype.SetAngularVelocity);b2.Body.prototype.GetAngularVelocity=function(){return this.m_angularVelocity};goog.exportProperty(b2.Body.prototype,"GetAngularVelocity",b2.Body.prototype.GetAngularVelocity);
b2.Body.prototype.GetDefinition=function(a){a.type=this.GetType();a.allowSleep=this.m_flag_autoSleepFlag;a.angle=this.GetAngle();a.angularDamping=this.m_angularDamping;a.gravityScale=this.m_gravityScale;a.angularVelocity=this.m_angularVelocity;a.fixedRotation=this.m_flag_fixedRotationFlag;a.bullet=this.m_flag_bulletFlag;a.awake=this.m_flag_awakeFlag;a.linearDamping=this.m_linearDamping;a.linearVelocity.Copy(this.GetLinearVelocity());a.position.Copy(this.GetPosition());a.userData=this.GetUserData();
return a};goog.exportProperty(b2.Body.prototype,"GetDefinition",b2.Body.prototype.GetDefinition);b2.Body.prototype.ApplyForce=function(a,b,c){this.m_type===b2.BodyType.dynamicBody&&(!this.m_flag_awakeFlag&&this.SetAwake(!0),this.m_flag_awakeFlag&&(this.m_force.x+=a.x,this.m_force.y+=a.y,this.m_torque+=(b.x-this.m_sweep.c.x)*a.y-(b.y-this.m_sweep.c.y)*a.x))};goog.exportProperty(b2.Body.prototype,"ApplyForce",b2.Body.prototype.ApplyForce);
b2.Body.prototype.ApplyForceToCenter=function(a,b){this.m_type===b2.BodyType.dynamicBody&&(("boolean"===typeof b?b:1)&&!this.m_flag_awakeFlag&&this.SetAwake(!0),this.m_flag_awakeFlag&&(this.m_force.x+=a.x,this.m_force.y+=a.y))};goog.exportProperty(b2.Body.prototype,"ApplyForceToCenter",b2.Body.prototype.ApplyForceToCenter);
b2.Body.prototype.ApplyTorque=function(a,b){this.m_type===b2.BodyType.dynamicBody&&(("boolean"===typeof b?b:1)&&!this.m_flag_awakeFlag&&this.SetAwake(!0),this.m_flag_awakeFlag&&(this.m_torque+=a))};goog.exportProperty(b2.Body.prototype,"ApplyTorque",b2.Body.prototype.ApplyTorque);
b2.Body.prototype.ApplyLinearImpulse=function(a,b,c){this.m_type===b2.BodyType.dynamicBody&&(("boolean"===typeof c?c:1)&&!this.m_flag_awakeFlag&&this.SetAwake(!0),this.m_flag_awakeFlag&&(this.m_linearVelocity.x+=this.m_invMass*a.x,this.m_linearVelocity.y+=this.m_invMass*a.y,this.m_angularVelocity+=this.m_invI*((b.x-this.m_sweep.c.x)*a.y-(b.y-this.m_sweep.c.y)*a.x)))};goog.exportProperty(b2.Body.prototype,"ApplyLinearImpulse",b2.Body.prototype.ApplyLinearImpulse);
b2.Body.prototype.ApplyLinearImpulseToCenter=function(a,b){this.m_type===b2.BodyType.dynamicBody&&(("boolean"===typeof b?b:1)&&!this.m_flag_awakeFlag&&this.SetAwake(!0),this.m_flag_awakeFlag&&(this.m_linearVelocity.x+=this.m_invMass*a.x,this.m_linearVelocity.y+=this.m_invMass*a.y))};goog.exportProperty(b2.Body.prototype,"ApplyLinearImpulseToCenter",b2.Body.prototype.ApplyLinearImpulseToCenter);
b2.Body.prototype.ApplyAngularImpulse=function(a,b){this.m_type===b2.BodyType.dynamicBody&&(("boolean"===typeof b?b:1)&&!this.m_flag_awakeFlag&&this.SetAwake(!0),this.m_flag_awakeFlag&&(this.m_angularVelocity+=this.m_invI*a))};goog.exportProperty(b2.Body.prototype,"ApplyAngularImpulse",b2.Body.prototype.ApplyAngularImpulse);b2.Body.prototype.GetMass=function(){return this.m_mass};goog.exportProperty(b2.Body.prototype,"GetMass",b2.Body.prototype.GetMass);
b2.Body.prototype.GetInertia=function(){return this.m_I+this.m_mass*b2.Dot_V2_V2(this.m_sweep.localCenter,this.m_sweep.localCenter)};goog.exportProperty(b2.Body.prototype,"GetInertia",b2.Body.prototype.GetInertia);b2.Body.prototype.GetMassData=function(a){a.mass=this.m_mass;a.I=this.m_I+this.m_mass*b2.Dot_V2_V2(this.m_sweep.localCenter,this.m_sweep.localCenter);a.center.Copy(this.m_sweep.localCenter);return a};
goog.exportProperty(b2.Body.prototype,"GetMassData",b2.Body.prototype.GetMassData);
b2.Body.prototype.SetMassData=function(a){b2.ENABLE_ASSERTS&&b2.Assert(!this.m_world.IsLocked());if(!this.m_world.IsLocked()&&this.m_type===b2.BodyType.dynamicBody){this.m_invI=this.m_I=this.m_invMass=0;this.m_mass=a.mass;0>=this.m_mass&&(this.m_mass=1);this.m_invMass=1/this.m_mass;0<a.I&&!this.m_flag_fixedRotationFlag&&(this.m_I=a.I-this.m_mass*b2.Dot_V2_V2(a.center,a.center),b2.ENABLE_ASSERTS&&b2.Assert(0<this.m_I),this.m_invI=1/this.m_I);var b=b2.Body.prototype.SetMassData.s_oldCenter.Copy(this.m_sweep.c);
this.m_sweep.localCenter.Copy(a.center);b2.Mul_X_V2(this.m_xf,this.m_sweep.localCenter,this.m_sweep.c);this.m_sweep.c0.Copy(this.m_sweep.c);b2.AddCross_V2_S_V2(this.m_linearVelocity,this.m_angularVelocity,b2.Sub_V2_V2(this.m_sweep.c,b,b2.Vec2.s_t0),this.m_linearVelocity)}};goog.exportProperty(b2.Body.prototype,"SetMassData",b2.Body.prototype.SetMassData);b2.Body.prototype.SetMassData.s_oldCenter=new b2.Vec2;
b2.Body.prototype.ResetMassData=function(){this.m_invI=this.m_I=this.m_invMass=this.m_mass=0;this.m_sweep.localCenter.SetZero();if(this.m_type===b2.BodyType.staticBody||this.m_type===b2.BodyType.kinematicBody)this.m_sweep.c0.Copy(this.m_xf.p),this.m_sweep.c.Copy(this.m_xf.p),this.m_sweep.a0=this.m_sweep.a;else{b2.ENABLE_ASSERTS&&b2.Assert(this.m_type===b2.BodyType.dynamicBody);for(var a=b2.Body.prototype.ResetMassData.s_localCenter.SetZero(),b=this.m_fixtureList;b;b=
b.m_next)if(0!==b.m_density){var c=b.GetMassData(b2.Body.prototype.ResetMassData.s_massData);this.m_mass+=c.mass;a.x+=c.center.x*c.mass;a.y+=c.center.y*c.mass;this.m_I+=c.I}0<this.m_mass?(this.m_invMass=1/this.m_mass,a.x*=this.m_invMass,a.y*=this.m_invMass):this.m_invMass=this.m_mass=1;0<this.m_I&&!this.m_flag_fixedRotationFlag?(this.m_I-=this.m_mass*b2.Dot_V2_V2(a,a),b2.ENABLE_ASSERTS&&b2.Assert(0<this.m_I),this.m_invI=1/this.m_I):this.m_invI=this.m_I=0;b=b2.Body.prototype.ResetMassData.s_oldCenter.Copy(this.m_sweep.c);
this.m_sweep.localCenter.Copy(a);b2.Mul_X_V2(this.m_xf,this.m_sweep.localCenter,this.m_sweep.c);this.m_sweep.c0.Copy(this.m_sweep.c);b2.AddCross_V2_S_V2(this.m_linearVelocity,this.m_angularVelocity,b2.Sub_V2_V2(this.m_sweep.c,b,b2.Vec2.s_t0),this.m_linearVelocity)}};goog.exportProperty(b2.Body.prototype,"ResetMassData",b2.Body.prototype.ResetMassData);b2.Body.prototype.ResetMassData.s_localCenter=new b2.Vec2;
b2.Body.prototype.ResetMassData.s_oldCenter=new b2.Vec2;b2.Body.prototype.ResetMassData.s_massData=new b2.MassData;b2.Body.prototype.GetWorldPoint=function(a,b){return b2.Mul_X_V2(this.m_xf,a,b)};goog.exportProperty(b2.Body.prototype,"GetWorldPoint",b2.Body.prototype.GetWorldPoint);b2.Body.prototype.GetWorldVector=function(a,b){return b2.Mul_R_V2(this.m_xf.q,a,b)};goog.exportProperty(b2.Body.prototype,"GetWorldVector",b2.Body.prototype.GetWorldVector);
b2.Body.prototype.GetLocalPoint=function(a,b){return b2.MulT_X_V2(this.m_xf,a,b)};goog.exportProperty(b2.Body.prototype,"GetLocalPoint",b2.Body.prototype.GetLocalPoint);b2.Body.prototype.GetLocalVector=function(a,b){return b2.MulT_R_V2(this.m_xf.q,a,b)};goog.exportProperty(b2.Body.prototype,"GetLocalVector",b2.Body.prototype.GetLocalVector);
b2.Body.prototype.GetLinearVelocityFromWorldPoint=function(a,b){return b2.AddCross_V2_S_V2(this.m_linearVelocity,this.m_angularVelocity,b2.Sub_V2_V2(a,this.m_sweep.c,b2.Vec2.s_t0),b)};goog.exportProperty(b2.Body.prototype,"GetLinearVelocityFromWorldPoint",b2.Body.prototype.GetLinearVelocityFromWorldPoint);b2.Body.prototype.GetLinearVelocityFromLocalPoint=function(a,b){return this.GetLinearVelocityFromWorldPoint(this.GetWorldPoint(a,b),b)};
goog.exportProperty(b2.Body.prototype,"GetLinearVelocityFromLocalPoint",b2.Body.prototype.GetLinearVelocityFromLocalPoint);b2.Body.prototype.GetLinearDamping=function(){return this.m_linearDamping};goog.exportProperty(b2.Body.prototype,"GetLinearDamping",b2.Body.prototype.GetLinearDamping);b2.Body.prototype.SetLinearDamping=function(a){this.m_linearDamping=a};goog.exportProperty(b2.Body.prototype,"SetLinearDamping",b2.Body.prototype.SetLinearDamping);
b2.Body.prototype.GetAngularDamping=function(){return this.m_angularDamping};goog.exportProperty(b2.Body.prototype,"GetAngularDamping",b2.Body.prototype.GetAngularDamping);b2.Body.prototype.SetAngularDamping=function(a){this.m_angularDamping=a};goog.exportProperty(b2.Body.prototype,"SetAngularDamping",b2.Body.prototype.SetAngularDamping);b2.Body.prototype.GetGravityScale=function(){return this.m_gravityScale};
goog.exportProperty(b2.Body.prototype,"GetGravityScale",b2.Body.prototype.GetGravityScale);b2.Body.prototype.SetGravityScale=function(a){this.m_gravityScale=a};goog.exportProperty(b2.Body.prototype,"SetGravityScale",b2.Body.prototype.SetGravityScale);
b2.Body.prototype.SetType=function(a){b2.ENABLE_ASSERTS&&b2.Assert(!this.m_world.IsLocked());if(!this.m_world.IsLocked()&&this.m_type!==a){this.m_type=a;this.ResetMassData();this.m_type===b2.BodyType.staticBody&&(this.m_linearVelocity.SetZero(),this.m_angularVelocity=0,this.m_sweep.a0=this.m_sweep.a,this.m_sweep.c0.Copy(this.m_sweep.c),this.SynchronizeFixtures());this.SetAwake(!0);this.m_force.SetZero();this.m_torque=0;for(a=this.m_contactList;a;){var b=a;a=a.next;this.m_world.m_contactManager.Destroy(b.contact)}this.m_contactList=
null;a=this.m_world.m_contactManager.m_broadPhase;for(b=this.m_fixtureList;b;b=b.m_next)for(var c=b.m_proxyCount,d=0;d<c;++d)a.TouchProxy(b.m_proxies[d].proxy)}};goog.exportProperty(b2.Body.prototype,"SetType",b2.Body.prototype.SetType);b2.Body.prototype.GetType=function(){return this.m_type};goog.exportProperty(b2.Body.prototype,"GetType",b2.Body.prototype.GetType);b2.Body.prototype.SetBullet=function(a){this.m_flag_bulletFlag=a};
goog.exportProperty(b2.Body.prototype,"SetBullet",b2.Body.prototype.SetBullet);b2.Body.prototype.IsBullet=function(){return this.m_flag_bulletFlag};goog.exportProperty(b2.Body.prototype,"IsBullet",b2.Body.prototype.IsBullet);b2.Body.prototype.SetSleepingAllowed=function(a){a?this.m_flag_autoSleepFlag=!0:(this.m_flag_autoSleepFlag=!1,this.SetAwake(!0))};goog.exportProperty(b2.Body.prototype,"SetSleepingAllowed",b2.Body.prototype.SetSleepingAllowed);
b2.Body.prototype.IsSleepingAllowed=function(){return this.m_flag_autoSleepFlag};goog.exportProperty(b2.Body.prototype,"IsSleepingAllowed",b2.Body.prototype.IsSleepingAllowed);b2.Body.prototype.SetAwake=function(a){a?this.m_flag_awakeFlag||(this.m_flag_awakeFlag=!0,this.m_sleepTime=0):(this.m_flag_awakeFlag=!1,this.m_sleepTime=0,this.m_linearVelocity.SetZero(),this.m_angularVelocity=0,this.m_force.SetZero(),this.m_torque=0)};
goog.exportProperty(b2.Body.prototype,"SetAwake",b2.Body.prototype.SetAwake);b2.Body.prototype.IsAwake=function(){return this.m_flag_awakeFlag};goog.exportProperty(b2.Body.prototype,"IsAwake",b2.Body.prototype.IsAwake);
b2.Body.prototype.SetActive=function(a){b2.ENABLE_ASSERTS&&b2.Assert(!this.m_world.IsLocked());if(a!==this.IsActive())if(a){this.m_flag_activeFlag=!0;a=this.m_world.m_contactManager.m_broadPhase;for(var b=this.m_fixtureList;b;b=b.m_next)b.CreateProxies(a,this.m_xf)}else{this.m_flag_activeFlag=!1;a=this.m_world.m_contactManager.m_broadPhase;for(b=this.m_fixtureList;b;b=b.m_next)b.DestroyProxies(a);for(a=this.m_contactList;a;)b=a,a=a.next,this.m_world.m_contactManager.Destroy(b.contact);
this.m_contactList=null}};goog.exportProperty(b2.Body.prototype,"SetActive",b2.Body.prototype.SetActive);b2.Body.prototype.IsActive=function(){return this.m_flag_activeFlag};goog.exportProperty(b2.Body.prototype,"IsActive",b2.Body.prototype.IsActive);b2.Body.prototype.SetFixedRotation=function(a){this.m_flag_fixedRotationFlag!==a&&(this.m_flag_fixedRotationFlag=a,this.m_angularVelocity=0,this.ResetMassData())};
goog.exportProperty(b2.Body.prototype,"SetFixedRotation",b2.Body.prototype.SetFixedRotation);b2.Body.prototype.IsFixedRotation=function(){return this.m_flag_fixedRotationFlag};goog.exportProperty(b2.Body.prototype,"IsFixedRotation",b2.Body.prototype.IsFixedRotation);b2.Body.prototype.GetFixtureList=function(){return this.m_fixtureList};goog.exportProperty(b2.Body.prototype,"GetFixtureList",b2.Body.prototype.GetFixtureList);
b2.Body.prototype.GetJointList=function(){return this.m_jointList};goog.exportProperty(b2.Body.prototype,"GetJointList",b2.Body.prototype.GetJointList);b2.Body.prototype.GetContactList=function(){return this.m_contactList};goog.exportProperty(b2.Body.prototype,"GetContactList",b2.Body.prototype.GetContactList);b2.Body.prototype.GetNext=function(){return this.m_next};goog.exportProperty(b2.Body.prototype,"GetNext",b2.Body.prototype.GetNext);
b2.Body.prototype.GetUserData=function(){return this.m_userData};goog.exportProperty(b2.Body.prototype,"GetUserData",b2.Body.prototype.GetUserData);b2.Body.prototype.SetUserData=function(a){this.m_userData=a};goog.exportProperty(b2.Body.prototype,"SetUserData",b2.Body.prototype.SetUserData);b2.Body.prototype.GetWorld=function(){return this.m_world};goog.exportProperty(b2.Body.prototype,"GetWorld",b2.Body.prototype.GetWorld);
b2.Body.prototype.SynchronizeFixtures=function(){var a=b2.Body.prototype.SynchronizeFixtures.s_xf1;a.q.SetAngle(this.m_sweep.a0);b2.Mul_R_V2(a.q,this.m_sweep.localCenter,a.p);b2.Sub_V2_V2(this.m_sweep.c0,a.p,a.p);for(var b=this.m_world.m_contactManager.m_broadPhase,c=this.m_fixtureList;c;c=c.m_next)c.Synchronize(b,a,this.m_xf)};goog.exportProperty(b2.Body.prototype,"SynchronizeFixtures",b2.Body.prototype.SynchronizeFixtures);
b2.Body.prototype.SynchronizeFixtures.s_xf1=new b2.Transform;b2.Body.prototype.SynchronizeTransform=function(){this.m_xf.q.SetAngle(this.m_sweep.a);b2.Mul_R_V2(this.m_xf.q,this.m_sweep.localCenter,this.m_xf.p);b2.Sub_V2_V2(this.m_sweep.c,this.m_xf.p,this.m_xf.p)};goog.exportProperty(b2.Body.prototype,"SynchronizeTransform",b2.Body.prototype.SynchronizeTransform);
b2.Body.prototype.ShouldCollide=function(a){return this.m_type===b2.BodyType.staticBody&&a.m_type===b2.BodyType.staticBody?!1:this.ShouldCollideConnected(a)};goog.exportProperty(b2.Body.prototype,"ShouldCollide",b2.Body.prototype.ShouldCollide);b2.Body.prototype.ShouldCollideConnected=function(a){for(var b=this.m_jointList;b;b=b.next)if(b.other===a&&!b.joint.m_collideConnected)return!1;return!0};
goog.exportProperty(b2.Body.prototype,"ShouldCollideConnected",b2.Body.prototype.ShouldCollideConnected);b2.Body.prototype.Advance=function(a){this.m_sweep.Advance(a);this.m_sweep.c.Copy(this.m_sweep.c0);this.m_sweep.a=this.m_sweep.a0;this.m_xf.q.SetAngle(this.m_sweep.a);b2.Mul_R_V2(this.m_xf.q,this.m_sweep.localCenter,this.m_xf.p);b2.Sub_V2_V2(this.m_sweep.c,this.m_xf.p,this.m_xf.p)};goog.exportProperty(b2.Body.prototype,"Advance",b2.Body.prototype.Advance);
b2.Body.prototype.Dump=function(){if(b2.DEBUG){var a=this.m_islandIndex;b2.Log("{\n");b2.Log("  /*b2.BodyDef*/ var bd = new b2.BodyDef();\n");var b="";switch(this.m_type){case b2.BodyType.staticBody:b="b2.BodyType.staticBody";break;case b2.BodyType.kinematicBody:b="b2.BodyType.kinematicBody";break;case b2.BodyType.dynamicBody:b="b2.BodyType.dynamicBody";break;default:b2.ENABLE_ASSERTS&&b2.Assert(!1)}b2.Log("  bd.type = %s;\n",
b);b2.Log("  bd.position.Set(%.15f, %.15f);\n",this.m_xf.p.x,this.m_xf.p.y);b2.Log("  bd.angle = %.15f;\n",this.m_sweep.a);b2.Log("  bd.linearVelocity.Set(%.15f, %.15f);\n",this.m_linearVelocity.x,this.m_linearVelocity.y);b2.Log("  bd.angularVelocity = %.15f;\n",this.m_angularVelocity);b2.Log("  bd.linearDamping = %.15f;\n",this.m_linearDamping);b2.Log("  bd.angularDamping = %.15f;\n",this.m_angularDamping);b2.Log("  bd.allowSleep = %s;\n",this.m_flag_autoSleepFlag?
"true":"false");b2.Log("  bd.awake = %s;\n",this.m_flag_awakeFlag?"true":"false");b2.Log("  bd.fixedRotation = %s;\n",this.m_flag_fixedRotationFlag?"true":"false");b2.Log("  bd.bullet = %s;\n",this.m_flag_bulletFlag?"true":"false");b2.Log("  bd.active = %s;\n",this.m_flag_activeFlag?"true":"false");b2.Log("  bd.gravityScale = %.15f;\n",this.m_gravityScale);b2.Log("\n");b2.Log("  bodies[%d] = this.m_world.CreateBody(bd);\n",this.m_islandIndex);b2.Log("\n");for(b=
this.m_fixtureList;b;b=b.m_next)b2.Log("  {\n"),b.Dump(a),b2.Log("  }\n");b2.Log("}\n")}};goog.exportProperty(b2.Body.prototype,"Dump",b2.Body.prototype.Dump);b2.Body.prototype.GetControllerList=function(){return this.m_controllerList};goog.exportProperty(b2.Body.prototype,"GetControllerList",b2.Body.prototype.GetControllerList);b2.Body.prototype.GetControllerCount=function(){return this.m_controllerCount};
goog.exportProperty(b2.Body.prototype,"GetControllerCount",b2.Body.prototype.GetControllerCount);b2.Profile=function(){};goog.exportSymbol("b2.Profile",b2.Profile);b2.Profile.prototype.step=0;goog.exportProperty(b2.Profile.prototype,"step",b2.Profile.prototype.step);b2.Profile.prototype.collide=0;goog.exportProperty(b2.Profile.prototype,"collide",b2.Profile.prototype.collide);b2.Profile.prototype.solve=0;goog.exportProperty(b2.Profile.prototype,"solve",b2.Profile.prototype.solve);b2.Profile.prototype.solveInit=0;
goog.exportProperty(b2.Profile.prototype,"solveInit",b2.Profile.prototype.solveInit);b2.Profile.prototype.solveVelocity=0;goog.exportProperty(b2.Profile.prototype,"solveVelocity",b2.Profile.prototype.solveVelocity);b2.Profile.prototype.solvePosition=0;goog.exportProperty(b2.Profile.prototype,"solvePosition",b2.Profile.prototype.solvePosition);b2.Profile.prototype.broadphase=0;goog.exportProperty(b2.Profile.prototype,"broadphase",b2.Profile.prototype.broadphase);
b2.Profile.prototype.solveTOI=0;goog.exportProperty(b2.Profile.prototype,"solveTOI",b2.Profile.prototype.solveTOI);b2.Profile.prototype.Reset=function(){this.solveTOI=this.broadphase=this.solvePosition=this.solveVelocity=this.solveInit=this.solve=this.collide=this.step=0;return this};goog.exportProperty(b2.Profile.prototype,"Reset",b2.Profile.prototype.Reset);b2.TimeStep=function(){};goog.exportSymbol("b2.TimeStep",b2.TimeStep);
b2.TimeStep.prototype.dt=0;goog.exportProperty(b2.TimeStep.prototype,"dt",b2.TimeStep.prototype.dt);b2.TimeStep.prototype.inv_dt=0;goog.exportProperty(b2.TimeStep.prototype,"inv_dt",b2.TimeStep.prototype.inv_dt);b2.TimeStep.prototype.dtRatio=0;goog.exportProperty(b2.TimeStep.prototype,"dtRatio",b2.TimeStep.prototype.dtRatio);b2.TimeStep.prototype.velocityIterations=0;goog.exportProperty(b2.TimeStep.prototype,"velocityIterations",b2.TimeStep.prototype.velocityIterations);
b2.TimeStep.prototype.positionIterations=0;goog.exportProperty(b2.TimeStep.prototype,"positionIterations",b2.TimeStep.prototype.positionIterations);b2.TimeStep.prototype.particleIterations=0;goog.exportProperty(b2.TimeStep.prototype,"particleIterations",b2.TimeStep.prototype.particleIterations);b2.TimeStep.prototype.warmStarting=!1;goog.exportProperty(b2.TimeStep.prototype,"warmStarting",b2.TimeStep.prototype.warmStarting);
b2.TimeStep.prototype.Copy=function(a){this.dt=a.dt;this.inv_dt=a.inv_dt;this.dtRatio=a.dtRatio;this.positionIterations=a.positionIterations;this.velocityIterations=a.velocityIterations;this.particleIterations=a.particleIterations;this.warmStarting=a.warmStarting;return this};goog.exportProperty(b2.TimeStep.prototype,"Copy",b2.TimeStep.prototype.Copy);b2.Position=function(){this.c=new b2.Vec2};goog.exportSymbol("b2.Position",b2.Position);
b2.Position.prototype.c=null;goog.exportProperty(b2.Position.prototype,"c",b2.Position.prototype.c);b2.Position.prototype.a=0;goog.exportProperty(b2.Position.prototype,"a",b2.Position.prototype.a);b2.Position.MakeArray=function(a){return b2.MakeArray(a,function(a){return new b2.Position})};goog.exportProperty(b2.Position,"MakeArray",b2.Position.MakeArray);b2.Velocity=function(){this.v=new b2.Vec2};
goog.exportSymbol("b2.Velocity",b2.Velocity);b2.Velocity.prototype.v=null;goog.exportProperty(b2.Velocity.prototype,"v",b2.Velocity.prototype.v);b2.Velocity.prototype.w=0;goog.exportProperty(b2.Velocity.prototype,"w",b2.Velocity.prototype.w);b2.Velocity.MakeArray=function(a){return b2.MakeArray(a,function(a){return new b2.Velocity})};goog.exportProperty(b2.Velocity,"MakeArray",b2.Velocity.MakeArray);
b2.SolverData=function(){this.step=new b2.TimeStep};goog.exportSymbol("b2.SolverData",b2.SolverData);b2.SolverData.prototype.step=null;goog.exportProperty(b2.SolverData.prototype,"step",b2.SolverData.prototype.step);b2.SolverData.prototype.positions=null;goog.exportProperty(b2.SolverData.prototype,"positions",b2.SolverData.prototype.positions);b2.SolverData.prototype.velocities=null;
goog.exportProperty(b2.SolverData.prototype,"velocities",b2.SolverData.prototype.velocities);b2.WorldCallbacks={};b2.DestructionListener=function(){};goog.exportSymbol("b2.DestructionListener",b2.DestructionListener);b2.DestructionListener.prototype.SayGoodbyeJoint=function(a){};goog.exportProperty(b2.DestructionListener.prototype,"SayGoodbyeJoint",b2.DestructionListener.prototype.SayGoodbyeJoint);b2.DestructionListener.prototype.SayGoodbyeFixture=function(a){};goog.exportProperty(b2.DestructionListener.prototype,"SayGoodbyeFixture",b2.DestructionListener.prototype.SayGoodbyeFixture);
b2.DestructionListener.prototype.SayGoodbyeParticleGroup=function(a){};b2.DestructionListener.prototype.SayGoodbyeParticle=function(a,b){};b2.ContactFilter=function(){};goog.exportSymbol("b2.ContactFilter",b2.ContactFilter);
b2.ContactFilter.prototype.ShouldCollide=function(a,b){var c=a.GetBody(),d=b.GetBody();if(d.GetType()===b2.BodyType.staticBody&&c.GetType()===b2.BodyType.staticBody||!1===d.ShouldCollideConnected(c))return!1;c=a.GetFilterData();d=b.GetFilterData();return c.groupIndex===d.groupIndex&&0!==c.groupIndex?0<c.groupIndex:0!==(c.maskBits&d.categoryBits)&&0!==(c.categoryBits&d.maskBits)};goog.exportProperty(b2.ContactFilter.prototype,"ShouldCollide",b2.ContactFilter.prototype.ShouldCollide);
b2.ContactFilter.prototype.ShouldCollideFixtureParticle=function(a,b,c){return!0};goog.exportProperty(b2.ContactFilter.prototype,"ShouldCollideFixtureParticle",b2.ContactFilter.prototype.ShouldCollideFixtureParticle);b2.ContactFilter.prototype.ShouldCollideParticleParticle=function(a,b,c){return!0};goog.exportProperty(b2.ContactFilter.prototype,"ShouldCollideParticleParticle",b2.ContactFilter.prototype.ShouldCollideParticleParticle);
b2.ContactFilter.defaultFilter=new b2.ContactFilter;b2.ContactImpulse=function(){this.normalImpulses=b2.MakeNumberArray(b2._maxManifoldPoints);this.tangentImpulses=b2.MakeNumberArray(b2._maxManifoldPoints)};goog.exportSymbol("b2.ContactImpulse",b2.ContactImpulse);b2.ContactImpulse.prototype.normalImpulses=null;goog.exportProperty(b2.ContactImpulse.prototype,"normalImpulses",b2.ContactImpulse.prototype.normalImpulses);
b2.ContactImpulse.prototype.tangentImpulses=null;goog.exportProperty(b2.ContactImpulse.prototype,"tangentImpulses",b2.ContactImpulse.prototype.tangentImpulses);b2.ContactImpulse.prototype.count=0;goog.exportProperty(b2.ContactImpulse.prototype,"count",b2.ContactImpulse.prototype.count);b2.ContactListener=function(){};goog.exportSymbol("b2.ContactListener",b2.ContactListener);b2.ContactListener.prototype.BeginContact=function(a){};
goog.exportProperty(b2.ContactListener.prototype,"BeginContact",b2.ContactListener.prototype.BeginContact);b2.ContactListener.prototype.EndContact=function(a){};goog.exportProperty(b2.ContactListener.prototype,"EndContact",b2.ContactListener.prototype.EndContact);b2.ContactListener.prototype.BeginContactFixtureParticle=function(a,b){};goog.exportProperty(b2.ContactListener.prototype,"BeginContactFixtureParticle",b2.ContactListener.prototype.BeginContactFixtureParticle);
b2.ContactListener.prototype.EndContactFixtureParticle=function(a,b,c){};goog.exportProperty(b2.ContactListener.prototype,"EndContactFixtureParticle",b2.ContactListener.prototype.EndContactFixtureParticle);b2.ContactListener.prototype.BeginContactParticleParticle=function(a,b){};goog.exportProperty(b2.ContactListener.prototype,"BeginContactParticleParticle",b2.ContactListener.prototype.BeginContactParticleParticle);
b2.ContactListener.prototype.EndContactParticleParticle=function(a,b,c){};goog.exportProperty(b2.ContactListener.prototype,"EndContactParticleParticle",b2.ContactListener.prototype.EndContactParticleParticle);b2.ContactListener.prototype.PreSolve=function(a,b){};goog.exportProperty(b2.ContactListener.prototype,"PreSolve",b2.ContactListener.prototype.PreSolve);b2.ContactListener.prototype.PostSolve=function(a,b){};
goog.exportProperty(b2.ContactListener.prototype,"PostSolve",b2.ContactListener.prototype.PostSolve);b2.ContactListener.defaultListener=new b2.ContactListener;goog.exportProperty(b2.ContactListener,"defaultListener",b2.ContactListener.defaultListener);b2.QueryCallback=function(){};goog.exportSymbol("b2.QueryCallback",b2.QueryCallback);b2.QueryCallback.prototype.ReportFixture=function(a){return!0};
goog.exportProperty(b2.QueryCallback.prototype,"ReportFixture",b2.QueryCallback.prototype.ReportFixture);b2.QueryCallback.prototype.ReportParticle=function(a,b){return!1};goog.exportProperty(b2.QueryCallback.prototype,"ReportParticle",b2.QueryCallback.prototype.ReportParticle);b2.QueryCallback.prototype.ShouldQueryParticleSystem=function(a){return!0};goog.exportProperty(b2.QueryCallback.prototype,"ShouldQueryParticleSystem",b2.QueryCallback.prototype.ShouldQueryParticleSystem);
b2.RayCastCallback=function(){};goog.exportSymbol("b2.RayCastCallback",b2.RayCastCallback);b2.RayCastCallback.prototype.ReportFixture=function(a,b,c,d){return d};goog.exportProperty(b2.RayCastCallback.prototype,"ReportFixture",b2.RayCastCallback.prototype.ReportFixture);b2.RayCastCallback.prototype.ReportParticle=function(a,b,c,d,e){return 0};goog.exportProperty(b2.RayCastCallback.prototype,"ReportParticle",b2.RayCastCallback.prototype.ReportParticle);
b2.RayCastCallback.prototype.ShouldQueryParticleSystem=function(a){return!0};goog.exportProperty(b2.RayCastCallback.prototype,"ShouldQueryParticleSystem",b2.RayCastCallback.prototype.ShouldQueryParticleSystem);b2.MixFriction=function(a,b){return b2.Sqrt(a*b)};goog.exportSymbol("b2.MixFriction",b2.MixFriction);b2.MixRestitution=function(a,b){return a>b?a:b};goog.exportSymbol("b2.MixRestitution",b2.MixRestitution);b2.ContactEdge=function(){};goog.exportSymbol("b2.ContactEdge",b2.ContactEdge);b2.ContactEdge.prototype.other=null;goog.exportProperty(b2.ContactEdge.prototype,"other",b2.ContactEdge.prototype.other);
b2.ContactEdge.prototype.contact=null;goog.exportProperty(b2.ContactEdge.prototype,"contact",b2.ContactEdge.prototype.contact);b2.ContactEdge.prototype.prev=null;goog.exportProperty(b2.ContactEdge.prototype,"prev",b2.ContactEdge.prototype.prev);b2.ContactEdge.prototype.next=null;goog.exportProperty(b2.ContactEdge.prototype,"next",b2.ContactEdge.prototype.next);
b2.Contact=function(){this.m_nodeA=new b2.ContactEdge;this.m_nodeB=new b2.ContactEdge;this.m_manifold=new b2.Manifold;this.m_oldManifold=new b2.Manifold};goog.exportSymbol("b2.Contact",b2.Contact);b2.Contact.prototype.m_flag_islandFlag=!1;goog.exportProperty(b2.Contact.prototype,"m_flag_islandFlag",b2.Contact.prototype.m_flag_islandFlag);b2.Contact.prototype.m_flag_touchingFlag=!1;
goog.exportProperty(b2.Contact.prototype,"m_flag_touchingFlag",b2.Contact.prototype.m_flag_touchingFlag);b2.Contact.prototype.m_flag_enabledFlag=!1;goog.exportProperty(b2.Contact.prototype,"m_flag_enabledFlag",b2.Contact.prototype.m_flag_enabledFlag);b2.Contact.prototype.m_flag_filterFlag=!1;goog.exportProperty(b2.Contact.prototype,"m_flag_filterFlag",b2.Contact.prototype.m_flag_filterFlag);b2.Contact.prototype.m_flag_bulletHitFlag=!1;
goog.exportProperty(b2.Contact.prototype,"m_flag_bulletHitFlag",b2.Contact.prototype.m_flag_bulletHitFlag);b2.Contact.prototype.m_flag_toiFlag=!1;goog.exportProperty(b2.Contact.prototype,"m_flag_toiFlag",b2.Contact.prototype.m_flag_toiFlag);b2.Contact.prototype.m_prev=null;goog.exportProperty(b2.Contact.prototype,"m_prev",b2.Contact.prototype.m_prev);b2.Contact.prototype.m_next=null;goog.exportProperty(b2.Contact.prototype,"m_next",b2.Contact.prototype.m_next);
b2.Contact.prototype.m_nodeA=null;goog.exportProperty(b2.Contact.prototype,"m_nodeA",b2.Contact.prototype.m_nodeA);b2.Contact.prototype.m_nodeB=null;goog.exportProperty(b2.Contact.prototype,"m_nodeB",b2.Contact.prototype.m_nodeB);b2.Contact.prototype.m_fixtureA=null;goog.exportProperty(b2.Contact.prototype,"m_fixtureA",b2.Contact.prototype.m_fixtureA);b2.Contact.prototype.m_fixtureB=null;goog.exportProperty(b2.Contact.prototype,"m_fixtureB",b2.Contact.prototype.m_fixtureB);
b2.Contact.prototype.m_indexA=0;goog.exportProperty(b2.Contact.prototype,"m_indexA",b2.Contact.prototype.m_indexA);b2.Contact.prototype.m_indexB=0;goog.exportProperty(b2.Contact.prototype,"m_indexB",b2.Contact.prototype.m_indexB);b2.Contact.prototype.m_manifold=null;goog.exportProperty(b2.Contact.prototype,"m_manifold",b2.Contact.prototype.m_manifold);b2.Contact.prototype.m_toiCount=0;goog.exportProperty(b2.Contact.prototype,"m_toiCount",b2.Contact.prototype.m_toiCount);
b2.Contact.prototype.m_toi=0;goog.exportProperty(b2.Contact.prototype,"m_toi",b2.Contact.prototype.m_toi);b2.Contact.prototype.m_friction=0;goog.exportProperty(b2.Contact.prototype,"m_friction",b2.Contact.prototype.m_friction);b2.Contact.prototype.m_restitution=0;goog.exportProperty(b2.Contact.prototype,"m_restitution",b2.Contact.prototype.m_restitution);b2.Contact.prototype.m_tangentSpeed=0;
goog.exportProperty(b2.Contact.prototype,"m_tangentSpeed",b2.Contact.prototype.m_tangentSpeed);b2.Contact.prototype.m_oldManifold=null;goog.exportProperty(b2.Contact.prototype,"m_oldManifold",b2.Contact.prototype.m_oldManifold);b2.Contact.prototype.GetManifold=function(){return this.m_manifold};goog.exportProperty(b2.Contact.prototype,"GetManifold",b2.Contact.prototype.GetManifold);
b2.Contact.prototype.GetWorldManifold=function(a){var b=this.m_fixtureA.GetBody(),c=this.m_fixtureB.GetBody(),d=this.m_fixtureA.GetShape(),e=this.m_fixtureB.GetShape();a.Initialize(this.m_manifold,b.GetTransform(),d.m_radius,c.GetTransform(),e.m_radius)};goog.exportProperty(b2.Contact.prototype,"GetWorldManifold",b2.Contact.prototype.GetWorldManifold);b2.Contact.prototype.IsTouching=function(){return this.m_flag_touchingFlag};
goog.exportProperty(b2.Contact.prototype,"IsTouching",b2.Contact.prototype.IsTouching);b2.Contact.prototype.SetEnabled=function(a){this.m_flag_enabledFlag=a};goog.exportProperty(b2.Contact.prototype,"SetEnabled",b2.Contact.prototype.SetEnabled);b2.Contact.prototype.IsEnabled=function(){return this.m_flag_enabledFlag};goog.exportProperty(b2.Contact.prototype,"IsEnabled",b2.Contact.prototype.IsEnabled);b2.Contact.prototype.GetNext=function(){return this.m_next};
goog.exportProperty(b2.Contact.prototype,"GetNext",b2.Contact.prototype.GetNext);b2.Contact.prototype.GetFixtureA=function(){return this.m_fixtureA};goog.exportProperty(b2.Contact.prototype,"GetFixtureA",b2.Contact.prototype.GetFixtureA);b2.Contact.prototype.GetChildIndexA=function(){return this.m_indexA};goog.exportProperty(b2.Contact.prototype,"GetChildIndexA",b2.Contact.prototype.GetChildIndexA);b2.Contact.prototype.GetFixtureB=function(){return this.m_fixtureB};
goog.exportProperty(b2.Contact.prototype,"GetFixtureB",b2.Contact.prototype.GetFixtureB);b2.Contact.prototype.GetChildIndexB=function(){return this.m_indexB};goog.exportProperty(b2.Contact.prototype,"GetChildIndexB",b2.Contact.prototype.GetChildIndexB);b2.Contact.prototype.Evaluate=function(a,b,c){};goog.exportProperty(b2.Contact.prototype,"Evaluate",b2.Contact.prototype.Evaluate);
b2.Contact.prototype.FlagForFiltering=function(){this.m_flag_filterFlag=!0};goog.exportProperty(b2.Contact.prototype,"FlagForFiltering",b2.Contact.prototype.FlagForFiltering);b2.Contact.prototype.SetFriction=function(a){this.m_friction=a};goog.exportProperty(b2.Contact.prototype,"SetFriction",b2.Contact.prototype.SetFriction);b2.Contact.prototype.GetFriction=function(){return this.m_friction};goog.exportProperty(b2.Contact.prototype,"GetFriction",b2.Contact.prototype.GetFriction);
b2.Contact.prototype.ResetFriction=function(){this.m_friction=b2.MixFriction(this.m_fixtureA.m_friction,this.m_fixtureB.m_friction)};goog.exportProperty(b2.Contact.prototype,"ResetFriction",b2.Contact.prototype.ResetFriction);b2.Contact.prototype.SetRestitution=function(a){this.m_restitution=a};goog.exportProperty(b2.Contact.prototype,"SetRestitution",b2.Contact.prototype.SetRestitution);b2.Contact.prototype.GetRestitution=function(){return this.m_restitution};
goog.exportProperty(b2.Contact.prototype,"GetRestitution",b2.Contact.prototype.GetRestitution);b2.Contact.prototype.ResetRestitution=function(){this.m_restitution=b2.MixRestitution(this.m_fixtureA.m_restitution,this.m_fixtureB.m_restitution)};goog.exportProperty(b2.Contact.prototype,"ResetRestitution",b2.Contact.prototype.ResetRestitution);b2.Contact.prototype.SetTangentSpeed=function(a){this.m_tangentSpeed=a};
goog.exportProperty(b2.Contact.prototype,"SetTangentSpeed",b2.Contact.prototype.SetTangentSpeed);b2.Contact.prototype.GetTangentSpeed=function(){return this.m_tangentSpeed};goog.exportProperty(b2.Contact.prototype,"GetTangentSpeed",b2.Contact.prototype.GetTangentSpeed);
b2.Contact.prototype.Reset=function(a,b,c,d){this.m_flag_touchingFlag=this.m_flag_islandFlag=!1;this.m_flag_enabledFlag=!0;this.m_flag_toiFlag=this.m_flag_bulletHitFlag=this.m_flag_filterFlag=!1;this.m_fixtureA=a;this.m_fixtureB=c;this.m_indexA=b;this.m_indexB=d;this.m_manifold.pointCount=0;this.m_next=this.m_prev=null;this.m_nodeA.contact=null;this.m_nodeA.prev=null;this.m_nodeA.next=null;this.m_nodeA.other=null;this.m_nodeB.contact=null;this.m_nodeB.prev=null;this.m_nodeB.next=null;this.m_nodeB.other=
null;this.m_toiCount=0;this.m_friction=b2.MixFriction(this.m_fixtureA.m_friction,this.m_fixtureB.m_friction);this.m_restitution=b2.MixRestitution(this.m_fixtureA.m_restitution,this.m_fixtureB.m_restitution)};goog.exportProperty(b2.Contact.prototype,"Reset",b2.Contact.prototype.Reset);
b2.Contact.prototype.Update=function(a){var b=this.m_oldManifold;this.m_oldManifold=this.m_manifold;this.m_manifold=b;this.m_flag_enabledFlag=!0;var c=!1,b=this.m_flag_touchingFlag,d=this.m_fixtureA.IsSensor(),e=this.m_fixtureB.IsSensor(),d=d||e,e=this.m_fixtureA.GetBody(),f=this.m_fixtureB.GetBody(),c=e.GetTransform(),g=f.GetTransform();if(d)e=this.m_fixtureA.GetShape(),f=this.m_fixtureB.GetShape(),c=b2.TestOverlap_Shape(e,this.m_indexA,f,this.m_indexB,c,g),this.m_manifold.pointCount=0;
else{this.Evaluate(this.m_manifold,c,g);c=0<this.m_manifold.pointCount;for(g=0;g<this.m_manifold.pointCount;++g){var h=this.m_manifold.points[g];h.normalImpulse=0;h.tangentImpulse=0;for(var k=h.id,l=0;l<this.m_oldManifold.pointCount;++l){var m=this.m_oldManifold.points[l];if(m.id.key===k.key){h.normalImpulse=m.normalImpulse;h.tangentImpulse=m.tangentImpulse;break}}}c!==b&&(e.SetAwake(!0),f.SetAwake(!0))}this.m_flag_touchingFlag=c;!b&&c&&a&&a.BeginContact(this);b&&!c&&a&&a.EndContact(this);!d&&c&&
a&&a.PreSolve(this,this.m_oldManifold)};goog.exportProperty(b2.Contact.prototype,"Update",b2.Contact.prototype.Update);b2.Contact.prototype.ComputeTOI=function(a,b){var c=b2.Contact.prototype.ComputeTOI.s_input;c.proxyA.SetShape(this.m_fixtureA.GetShape(),this.m_indexA);c.proxyB.SetShape(this.m_fixtureB.GetShape(),this.m_indexB);c.sweepA.Copy(a);c.sweepB.Copy(b);c.tMax=b2._linearSlop;var d=b2.Contact.prototype.ComputeTOI.s_output;b2.TimeOfImpact(d,c);return d.t};
goog.exportProperty(b2.Contact.prototype,"ComputeTOI",b2.Contact.prototype.ComputeTOI);b2.Contact.prototype.ComputeTOI.s_input=new b2.TOIInput;b2.Contact.prototype.ComputeTOI.s_output=new b2.TOIOutput;b2.ChainAndCircleContact=function(){b2.Contact.call(this)};goog.inherits(b2.ChainAndCircleContact,b2.Contact);goog.exportSymbol("b2.ChainAndCircleContact",b2.ChainAndCircleContact);b2.ChainAndCircleContact.Create=function(a){return new b2.ChainAndCircleContact};goog.exportProperty(b2.ChainAndCircleContact,"Create",b2.ChainAndCircleContact.Create);b2.ChainAndCircleContact.Destroy=function(a,b){};
goog.exportProperty(b2.ChainAndCircleContact,"Destroy",b2.ChainAndCircleContact.Destroy);
b2.ChainAndCircleContact.prototype.Evaluate=function(a,b,c){var d=this.m_fixtureA.GetShape(),e=this.m_fixtureB.GetShape();b2.ENABLE_ASSERTS&&b2.Assert(d instanceof b2.ChainShape);b2.ENABLE_ASSERTS&&b2.Assert(e instanceof b2.CircleShape);var f=b2.ChainAndCircleContact.prototype.Evaluate.s_edge;(d instanceof b2.ChainShape?d:null).GetChildEdge(f,this.m_indexA);b2.CollideEdgeAndCircle(a,f,b,e instanceof b2.CircleShape?e:null,c)};
goog.exportProperty(b2.ChainAndCircleContact.prototype,"Evaluate",b2.ChainAndCircleContact.prototype.Evaluate);b2.ChainAndCircleContact.prototype.Evaluate.s_edge=new b2.EdgeShape;b2.ChainAndPolygonContact=function(){b2.Contact.call(this)};goog.inherits(b2.ChainAndPolygonContact,b2.Contact);goog.exportSymbol("b2.ChainAndPolygonContact",b2.ChainAndPolygonContact);b2.ChainAndPolygonContact.Create=function(a){return new b2.ChainAndPolygonContact};goog.exportProperty(b2.ChainAndPolygonContact,"Create",b2.ChainAndPolygonContact.Create);b2.ChainAndPolygonContact.Destroy=function(a,b){};
goog.exportProperty(b2.ChainAndPolygonContact,"Destroy",b2.ChainAndPolygonContact.Destroy);
b2.ChainAndPolygonContact.prototype.Evaluate=function(a,b,c){var d=this.m_fixtureA.GetShape(),e=this.m_fixtureB.GetShape();b2.ENABLE_ASSERTS&&b2.Assert(d instanceof b2.ChainShape);b2.ENABLE_ASSERTS&&b2.Assert(e instanceof b2.PolygonShape);var f=b2.ChainAndPolygonContact.prototype.Evaluate.s_edge;(d instanceof b2.ChainShape?d:null).GetChildEdge(f,this.m_indexA);b2.CollideEdgeAndPolygon(a,f,b,e instanceof b2.PolygonShape?e:null,c)};
goog.exportProperty(b2.ChainAndPolygonContact.prototype,"Evaluate",b2.ChainAndPolygonContact.prototype.Evaluate);b2.ChainAndPolygonContact.prototype.Evaluate.s_edge=new b2.EdgeShape;b2.CircleContact=function(){b2.Contact.call(this)};goog.inherits(b2.CircleContact,b2.Contact);goog.exportSymbol("b2.CircleContact",b2.CircleContact);b2.CircleContact.Create=function(a){return new b2.CircleContact};goog.exportProperty(b2.CircleContact,"Create",b2.CircleContact.Create);b2.CircleContact.Destroy=function(a,b){};goog.exportProperty(b2.CircleContact,"Destroy",b2.CircleContact.Destroy);
b2.CircleContact.prototype.Evaluate=function(a,b,c){var d=this.m_fixtureA.GetShape(),e=this.m_fixtureB.GetShape();b2.ENABLE_ASSERTS&&b2.Assert(d instanceof b2.CircleShape);b2.ENABLE_ASSERTS&&b2.Assert(e instanceof b2.CircleShape);b2.CollideCircles(a,d instanceof b2.CircleShape?d:null,b,e instanceof b2.CircleShape?e:null,c)};goog.exportProperty(b2.CircleContact.prototype,"Evaluate",b2.CircleContact.prototype.Evaluate);b2.ContactRegister=function(){};goog.exportSymbol("b2.ContactRegister",b2.ContactRegister);b2.ContactRegister.prototype.createFcn=null;b2.ContactRegister.prototype.destroyFcn=null;b2.ContactRegister.prototype.primary=!1;b2.ContactFactory=function(a){this.m_allocator=a;this.InitializeRegisters()};goog.exportSymbol("b2.ContactFactory",b2.ContactFactory);b2.ContactFactory.prototype.m_allocator=null;
b2.ContactFactory.prototype.AddType=function(a,b,c,d){var e=b2.MakeArray(256,function(b){return a()});b=function(b){return 0<e.length?e.pop():a(b)};var f=function(a,b){e.push(a)};this.m_registers[c][d].pool=e;this.m_registers[c][d].createFcn=b;this.m_registers[c][d].destroyFcn=f;this.m_registers[c][d].primary=!0;c!==d&&(this.m_registers[d][c].pool=e,this.m_registers[d][c].createFcn=b,this.m_registers[d][c].destroyFcn=f,this.m_registers[d][c].primary=!1)};
goog.exportProperty(b2.ContactFactory.prototype,"AddType",b2.ContactFactory.prototype.AddType);
b2.ContactFactory.prototype.InitializeRegisters=function(){this.m_registers=Array(b2.ShapeType.e_shapeTypeCount);for(var a=0;a<b2.ShapeType.e_shapeTypeCount;a++){this.m_registers[a]=Array(b2.ShapeType.e_shapeTypeCount);for(var b=0;b<b2.ShapeType.e_shapeTypeCount;b++)this.m_registers[a][b]=new b2.ContactRegister}this.AddType(b2.CircleContact.Create,b2.CircleContact.Destroy,b2.ShapeType.e_circleShape,b2.ShapeType.e_circleShape);this.AddType(b2.PolygonAndCircleContact.Create,
b2.PolygonAndCircleContact.Destroy,b2.ShapeType.e_polygonShape,b2.ShapeType.e_circleShape);this.AddType(b2.PolygonContact.Create,b2.PolygonContact.Destroy,b2.ShapeType.e_polygonShape,b2.ShapeType.e_polygonShape);this.AddType(b2.EdgeAndCircleContact.Create,b2.EdgeAndCircleContact.Destroy,b2.ShapeType.e_edgeShape,b2.ShapeType.e_circleShape);this.AddType(b2.EdgeAndPolygonContact.Create,b2.EdgeAndPolygonContact.Destroy,b2.ShapeType.e_edgeShape,
b2.ShapeType.e_polygonShape);this.AddType(b2.ChainAndCircleContact.Create,b2.ChainAndCircleContact.Destroy,b2.ShapeType.e_chainShape,b2.ShapeType.e_circleShape);this.AddType(b2.ChainAndPolygonContact.Create,b2.ChainAndPolygonContact.Destroy,b2.ShapeType.e_chainShape,b2.ShapeType.e_polygonShape)};goog.exportProperty(b2.ContactFactory.prototype,"InitializeRegisters",b2.ContactFactory.prototype.InitializeRegisters);
b2.ContactFactory.prototype.Create=function(a,b,c,d){var e=a.GetType(),f=c.GetType();b2.ENABLE_ASSERTS&&b2.Assert(0<=e&&e<b2.ShapeType.e_shapeTypeCount);b2.ENABLE_ASSERTS&&b2.Assert(0<=f&&f<b2.ShapeType.e_shapeTypeCount);e=this.m_registers[e][f];f=e.createFcn;return null!==f?(e.primary?(e=f(this.m_allocator),e.Reset(a,b,c,d)):(e=f(this.m_allocator),e.Reset(c,d,a,b)),e):null};goog.exportProperty(b2.ContactFactory.prototype,"Create",b2.ContactFactory.prototype.Create);
b2.ContactFactory.prototype.Destroy=function(a){var b=a.m_fixtureA,c=a.m_fixtureB;0<a.m_manifold.pointCount&&!b.IsSensor()&&!c.IsSensor()&&(b.GetBody().SetAwake(!0),c.GetBody().SetAwake(!0));b=b.GetType();c=c.GetType();b2.ENABLE_ASSERTS&&b2.Assert(0<=b&&c<b2.ShapeType.e_shapeTypeCount);b2.ENABLE_ASSERTS&&b2.Assert(0<=b&&c<b2.ShapeType.e_shapeTypeCount);c=this.m_registers[b][c].destroyFcn;c(a,this.m_allocator)};
goog.exportProperty(b2.ContactFactory.prototype,"Destroy",b2.ContactFactory.prototype.Destroy);b2.ContactManager=function(){this.m_broadPhase=new b2.BroadPhase;this.m_contactFactory=new b2.ContactFactory(this.m_allocator)};b2.ContactManager.prototype.m_broadPhase=null;goog.exportProperty(b2.ContactManager.prototype,"m_broadPhase",b2.ContactManager.prototype.m_broadPhase);b2.ContactManager.prototype.m_contactList=null;goog.exportProperty(b2.ContactManager.prototype,"m_contactList",b2.ContactManager.prototype.m_contactList);
b2.ContactManager.prototype.m_contactCount=0;goog.exportProperty(b2.ContactManager.prototype,"m_contactCount",b2.ContactManager.prototype.m_contactCount);b2.ContactManager.prototype.m_contactFilter=b2.ContactFilter.defaultFilter;goog.exportProperty(b2.ContactManager.prototype,"m_contactFilter",b2.ContactManager.prototype.m_contactFilter);b2.ContactManager.prototype.m_contactListener=b2.ContactListener.defaultListener;
goog.exportProperty(b2.ContactManager.prototype,"m_contactListener",b2.ContactManager.prototype.m_contactListener);b2.ContactManager.prototype.m_allocator=null;goog.exportProperty(b2.ContactManager.prototype,"m_allocator",b2.ContactManager.prototype.m_allocator);b2.ContactManager.prototype.m_contactFactory=null;goog.exportProperty(b2.ContactManager.prototype,"m_contactFactory",b2.ContactManager.prototype.m_contactFactory);
b2.ContactManager.prototype.Destroy=function(a){var b=a.GetFixtureA(),c=a.GetFixtureB(),b=b.GetBody(),c=c.GetBody();this.m_contactListener&&a.IsTouching()&&this.m_contactListener.EndContact(a);a.m_prev&&(a.m_prev.m_next=a.m_next);a.m_next&&(a.m_next.m_prev=a.m_prev);a===this.m_contactList&&(this.m_contactList=a.m_next);a.m_nodeA.prev&&(a.m_nodeA.prev.next=a.m_nodeA.next);a.m_nodeA.next&&(a.m_nodeA.next.prev=a.m_nodeA.prev);a.m_nodeA===b.m_contactList&&(b.m_contactList=a.m_nodeA.next);a.m_nodeB.prev&&
(a.m_nodeB.prev.next=a.m_nodeB.next);a.m_nodeB.next&&(a.m_nodeB.next.prev=a.m_nodeB.prev);a.m_nodeB===c.m_contactList&&(c.m_contactList=a.m_nodeB.next);this.m_contactFactory.Destroy(a);--this.m_contactCount};goog.exportProperty(b2.ContactManager.prototype,"Destroy",b2.ContactManager.prototype.Destroy);
b2.ContactManager.prototype.Collide=function(){for(var a=this.m_contactList;a;){var b=a.GetFixtureA(),c=a.GetFixtureB(),d=a.GetChildIndexA(),e=a.GetChildIndexB(),f=b.GetBody(),g=c.GetBody();if(a.m_flag_filterFlag){if(!g.ShouldCollide(f)){b=a;a=b.m_next;this.Destroy(b);continue}if(this.m_contactFilter&&!this.m_contactFilter.ShouldCollide(b,c)){b=a;a=b.m_next;this.Destroy(b);continue}a.m_flag_filterFlag=!1}f=f.IsAwake()&&f.m_type!==b2.BodyType.staticBody;g=g.IsAwake()&&g.m_type!==b2.BodyType.staticBody;
f||g?this.m_broadPhase.TestOverlap(b.m_proxies[d].proxy,c.m_proxies[e].proxy)?(a.Update(this.m_contactListener),a=a.m_next):(b=a,a=b.m_next,this.Destroy(b)):a=a.m_next}};goog.exportProperty(b2.ContactManager.prototype,"Collide",b2.ContactManager.prototype.Collide);b2.ContactManager.prototype.FindNewContacts=function(){this.m_broadPhase.UpdatePairs(this)};goog.exportProperty(b2.ContactManager.prototype,"FindNewContacts",b2.ContactManager.prototype.FindNewContacts);
b2.ContactManager.prototype.AddPair=function(a,b){b2.ENABLE_ASSERTS&&b2.Assert(a instanceof b2.FixtureProxy);b2.ENABLE_ASSERTS&&b2.Assert(b instanceof b2.FixtureProxy);var c=a.fixture,d=b.fixture,e=a.childIndex,f=b.childIndex,g=c.GetBody(),h=d.GetBody();if(g!==h){for(var k=h.GetContactList();k;){if(k.other===g){var l=k.contact.GetFixtureA(),m=k.contact.GetFixtureB(),n=k.contact.GetChildIndexA(),p=k.contact.GetChildIndexB();if(l===c&&m===d&&n===e&&p===f||l===d&&m===c&&
n===f&&p===e)return}k=k.next}!h.ShouldCollide(g)||this.m_contactFilter&&!this.m_contactFilter.ShouldCollide(c,d)||(e=this.m_contactFactory.Create(c,e,d,f),null!==e&&(c=e.GetFixtureA(),d=e.GetFixtureB(),g=c.m_body,h=d.m_body,e.m_prev=null,e.m_next=this.m_contactList,null!==this.m_contactList&&(this.m_contactList.m_prev=e),this.m_contactList=e,e.m_nodeA.contact=e,e.m_nodeA.other=h,e.m_nodeA.prev=null,e.m_nodeA.next=g.m_contactList,null!==g.m_contactList&&(g.m_contactList.prev=e.m_nodeA),g.m_contactList=
e.m_nodeA,e.m_nodeB.contact=e,e.m_nodeB.other=g,e.m_nodeB.prev=null,e.m_nodeB.next=h.m_contactList,null!==h.m_contactList&&(h.m_contactList.prev=e.m_nodeB),h.m_contactList=e.m_nodeB,c.IsSensor()||d.IsSensor()||(g.SetAwake(!0),h.SetAwake(!0)),++this.m_contactCount))}};goog.exportProperty(b2.ContactManager.prototype,"AddPair",b2.ContactManager.prototype.AddPair);b2.EdgeAndCircleContact=function(){b2.Contact.call(this)};goog.inherits(b2.EdgeAndCircleContact,b2.Contact);goog.exportSymbol("b2.EdgeAndCircleContact",b2.EdgeAndCircleContact);b2.EdgeAndCircleContact.Create=function(a){return new b2.EdgeAndCircleContact};goog.exportProperty(b2.EdgeAndCircleContact,"Create",b2.EdgeAndCircleContact.Create);b2.EdgeAndCircleContact.Destroy=function(a,b){};
goog.exportProperty(b2.EdgeAndCircleContact,"Destroy",b2.EdgeAndCircleContact.Destroy);b2.EdgeAndCircleContact.prototype.Evaluate=function(a,b,c){var d=this.m_fixtureA.GetShape(),e=this.m_fixtureB.GetShape();b2.ENABLE_ASSERTS&&b2.Assert(d instanceof b2.EdgeShape);b2.ENABLE_ASSERTS&&b2.Assert(e instanceof b2.CircleShape);b2.CollideEdgeAndCircle(a,d instanceof b2.EdgeShape?d:null,b,e instanceof b2.CircleShape?e:null,c)};
goog.exportProperty(b2.EdgeAndCircleContact.prototype,"Evaluate",b2.EdgeAndCircleContact.prototype.Evaluate);b2.EdgeAndPolygonContact=function(){b2.Contact.call(this)};goog.inherits(b2.EdgeAndPolygonContact,b2.Contact);goog.exportSymbol("b2.EdgeAndPolygonContact",b2.EdgeAndPolygonContact);b2.EdgeAndPolygonContact.Create=function(a){return new b2.EdgeAndPolygonContact};goog.exportProperty(b2.EdgeAndPolygonContact,"Create",b2.EdgeAndPolygonContact.Create);b2.EdgeAndPolygonContact.Destroy=function(a,b){};
goog.exportProperty(b2.EdgeAndPolygonContact,"Destroy",b2.EdgeAndPolygonContact.Destroy);b2.EdgeAndPolygonContact.prototype.Evaluate=function(a,b,c){var d=this.m_fixtureA.GetShape(),e=this.m_fixtureB.GetShape();b2.ENABLE_ASSERTS&&b2.Assert(d instanceof b2.EdgeShape);b2.ENABLE_ASSERTS&&b2.Assert(e instanceof b2.PolygonShape);b2.CollideEdgeAndPolygon(a,d instanceof b2.EdgeShape?d:null,b,e instanceof b2.PolygonShape?e:null,c)};
goog.exportProperty(b2.EdgeAndPolygonContact.prototype,"Evaluate",b2.EdgeAndPolygonContact.prototype.Evaluate);b2.PolygonAndCircleContact=function(){b2.Contact.call(this)};goog.inherits(b2.PolygonAndCircleContact,b2.Contact);goog.exportSymbol("b2.PolygonAndCircleContact",b2.PolygonAndCircleContact);b2.PolygonAndCircleContact.Create=function(a){return new b2.PolygonAndCircleContact};goog.exportProperty(b2.PolygonAndCircleContact,"Create",b2.PolygonAndCircleContact.Create);b2.PolygonAndCircleContact.Destroy=function(a,b){};
goog.exportProperty(b2.PolygonAndCircleContact,"Destroy",b2.PolygonAndCircleContact.Destroy);b2.PolygonAndCircleContact.prototype.Evaluate=function(a,b,c){var d=this.m_fixtureA.GetShape(),e=this.m_fixtureB.GetShape();b2.ENABLE_ASSERTS&&b2.Assert(d instanceof b2.PolygonShape);b2.ENABLE_ASSERTS&&b2.Assert(e instanceof b2.CircleShape);b2.CollidePolygonAndCircle(a,d instanceof b2.PolygonShape?d:null,b,e instanceof b2.CircleShape?e:null,c)};
goog.exportProperty(b2.PolygonAndCircleContact.prototype,"Evaluate",b2.PolygonAndCircleContact.prototype.Evaluate);b2.PolygonContact=function(){b2.Contact.call(this)};goog.inherits(b2.PolygonContact,b2.Contact);goog.exportSymbol("b2.PolygonContact",b2.PolygonContact);b2.PolygonContact.Create=function(a){return new b2.PolygonContact};goog.exportProperty(b2.PolygonContact,"Create",b2.PolygonContact.Create);b2.PolygonContact.Destroy=function(a,b){};goog.exportProperty(b2.PolygonContact,"Destroy",b2.PolygonContact.Destroy);
b2.PolygonContact.prototype.Evaluate=function(a,b,c){var d=this.m_fixtureA.GetShape(),e=this.m_fixtureB.GetShape();b2.ENABLE_ASSERTS&&b2.Assert(d instanceof b2.PolygonShape);b2.ENABLE_ASSERTS&&b2.Assert(e instanceof b2.PolygonShape);b2.CollidePolygons(a,d instanceof b2.PolygonShape?d:null,b,e instanceof b2.PolygonShape?e:null,c)};goog.exportProperty(b2.PolygonContact.prototype,"Evaluate",b2.PolygonContact.prototype.Evaluate);b2.g_blockSolve=!0;b2.VelocityConstraintPoint=function(){this.rA=new b2.Vec2;this.rB=new b2.Vec2};goog.exportSymbol("b2.VelocityConstraintPoint",b2.VelocityConstraintPoint);b2.VelocityConstraintPoint.prototype.rA=null;goog.exportProperty(b2.VelocityConstraintPoint.prototype,"rA",b2.VelocityConstraintPoint.prototype.rA);b2.VelocityConstraintPoint.prototype.rB=null;goog.exportProperty(b2.VelocityConstraintPoint.prototype,"rB",b2.VelocityConstraintPoint.prototype.rB);
b2.VelocityConstraintPoint.prototype.normalImpulse=0;goog.exportProperty(b2.VelocityConstraintPoint.prototype,"normalImpulse",b2.VelocityConstraintPoint.prototype.normalImpulse);b2.VelocityConstraintPoint.prototype.tangentImpulse=0;goog.exportProperty(b2.VelocityConstraintPoint.prototype,"tangentImpulse",b2.VelocityConstraintPoint.prototype.tangentImpulse);b2.VelocityConstraintPoint.prototype.normalMass=0;
goog.exportProperty(b2.VelocityConstraintPoint.prototype,"normalMass",b2.VelocityConstraintPoint.prototype.normalMass);b2.VelocityConstraintPoint.prototype.tangentMass=0;goog.exportProperty(b2.VelocityConstraintPoint.prototype,"tangentMass",b2.VelocityConstraintPoint.prototype.tangentMass);b2.VelocityConstraintPoint.prototype.velocityBias=0;goog.exportProperty(b2.VelocityConstraintPoint.prototype,"velocityBias",b2.VelocityConstraintPoint.prototype.velocityBias);
b2.VelocityConstraintPoint.MakeArray=function(a){return b2.MakeArray(a,function(a){return new b2.VelocityConstraintPoint})};goog.exportProperty(b2.VelocityConstraintPoint,"MakeArray",b2.VelocityConstraintPoint.MakeArray);b2.ContactVelocityConstraint=function(){this.points=b2.VelocityConstraintPoint.MakeArray(b2._maxManifoldPoints);this.normal=new b2.Vec2;this.tangent=new b2.Vec2;this.normalMass=new b2.Mat22;this.K=new b2.Mat22};
goog.exportSymbol("b2.ContactVelocityConstraint",b2.ContactVelocityConstraint);b2.ContactVelocityConstraint.prototype.points=null;goog.exportProperty(b2.ContactVelocityConstraint.prototype,"points",b2.ContactVelocityConstraint.prototype.points);b2.ContactVelocityConstraint.prototype.normal=null;goog.exportProperty(b2.ContactVelocityConstraint.prototype,"normal",b2.ContactVelocityConstraint.prototype.normal);
b2.ContactVelocityConstraint.prototype.tangent=null;goog.exportProperty(b2.ContactVelocityConstraint.prototype,"tangent",b2.ContactVelocityConstraint.prototype.tangent);b2.ContactVelocityConstraint.prototype.normalMass=null;goog.exportProperty(b2.ContactVelocityConstraint.prototype,"normalMass",b2.ContactVelocityConstraint.prototype.normalMass);b2.ContactVelocityConstraint.prototype.K=null;goog.exportProperty(b2.ContactVelocityConstraint.prototype,"K",b2.ContactVelocityConstraint.prototype.K);
b2.ContactVelocityConstraint.prototype.indexA=0;goog.exportProperty(b2.ContactVelocityConstraint.prototype,"indexA",b2.ContactVelocityConstraint.prototype.indexA);b2.ContactVelocityConstraint.prototype.indexB=0;goog.exportProperty(b2.ContactVelocityConstraint.prototype,"indexB",b2.ContactVelocityConstraint.prototype.indexB);b2.ContactVelocityConstraint.prototype.invMassA=0;goog.exportProperty(b2.ContactVelocityConstraint.prototype,"invMassA",b2.ContactVelocityConstraint.prototype.invMassA);
b2.ContactVelocityConstraint.prototype.invMassB=0;goog.exportProperty(b2.ContactVelocityConstraint.prototype,"invMassB",b2.ContactVelocityConstraint.prototype.invMassB);b2.ContactVelocityConstraint.prototype.invIA=0;goog.exportProperty(b2.ContactVelocityConstraint.prototype,"invIA",b2.ContactVelocityConstraint.prototype.invIA);b2.ContactVelocityConstraint.prototype.invIB=0;goog.exportProperty(b2.ContactVelocityConstraint.prototype,"invIB",b2.ContactVelocityConstraint.prototype.invIB);
b2.ContactVelocityConstraint.prototype.friction=0;goog.exportProperty(b2.ContactVelocityConstraint.prototype,"friction",b2.ContactVelocityConstraint.prototype.friction);b2.ContactVelocityConstraint.prototype.restitution=0;goog.exportProperty(b2.ContactVelocityConstraint.prototype,"restitution",b2.ContactVelocityConstraint.prototype.restitution);b2.ContactVelocityConstraint.prototype.tangentSpeed=0;
goog.exportProperty(b2.ContactVelocityConstraint.prototype,"tangentSpeed",b2.ContactVelocityConstraint.prototype.tangentSpeed);b2.ContactVelocityConstraint.prototype.pointCount=0;goog.exportProperty(b2.ContactVelocityConstraint.prototype,"pointCount",b2.ContactVelocityConstraint.prototype.pointCount);b2.ContactVelocityConstraint.prototype.contactIndex=0;goog.exportProperty(b2.ContactVelocityConstraint.prototype,"contactIndex",b2.ContactVelocityConstraint.prototype.contactIndex);
b2.ContactVelocityConstraint.MakeArray=function(a){return b2.MakeArray(a,function(a){return new b2.ContactVelocityConstraint})};goog.exportProperty(b2.ContactVelocityConstraint,"MakeArray",b2.ContactVelocityConstraint.MakeArray);b2.ContactPositionConstraint=function(){this.localPoints=b2.Vec2.MakeArray(b2._maxManifoldPoints);this.localNormal=new b2.Vec2;this.localPoint=new b2.Vec2;this.localCenterA=new b2.Vec2;this.localCenterB=new b2.Vec2};
goog.exportSymbol("b2.ContactPositionConstraint",b2.ContactPositionConstraint);b2.ContactPositionConstraint.prototype.localPoints=null;goog.exportProperty(b2.ContactPositionConstraint.prototype,"localPoints",b2.ContactPositionConstraint.prototype.localPoints);b2.ContactPositionConstraint.prototype.localNormal=null;goog.exportProperty(b2.ContactPositionConstraint.prototype,"localNormal",b2.ContactPositionConstraint.prototype.localNormal);
b2.ContactPositionConstraint.prototype.localPoint=null;goog.exportProperty(b2.ContactPositionConstraint.prototype,"localPoint",b2.ContactPositionConstraint.prototype.localPoint);b2.ContactPositionConstraint.prototype.indexA=0;goog.exportProperty(b2.ContactPositionConstraint.prototype,"indexA",b2.ContactPositionConstraint.prototype.indexA);b2.ContactPositionConstraint.prototype.indexB=0;goog.exportProperty(b2.ContactPositionConstraint.prototype,"indexB",b2.ContactPositionConstraint.prototype.indexB);
b2.ContactPositionConstraint.prototype.invMassA=0;goog.exportProperty(b2.ContactPositionConstraint.prototype,"invMassA",b2.ContactPositionConstraint.prototype.invMassA);b2.ContactPositionConstraint.prototype.invMassB=0;goog.exportProperty(b2.ContactPositionConstraint.prototype,"invMassB",b2.ContactPositionConstraint.prototype.invMassB);b2.ContactPositionConstraint.prototype.localCenterA=null;
goog.exportProperty(b2.ContactPositionConstraint.prototype,"localCenterA",b2.ContactPositionConstraint.prototype.localCenterA);b2.ContactPositionConstraint.prototype.localCenterB=null;goog.exportProperty(b2.ContactPositionConstraint.prototype,"localCenterB",b2.ContactPositionConstraint.prototype.localCenterB);b2.ContactPositionConstraint.prototype.invIA=0;goog.exportProperty(b2.ContactPositionConstraint.prototype,"invIA",b2.ContactPositionConstraint.prototype.invIA);
b2.ContactPositionConstraint.prototype.invIB=0;goog.exportProperty(b2.ContactPositionConstraint.prototype,"invIB",b2.ContactPositionConstraint.prototype.invIB);b2.ContactPositionConstraint.prototype.type=b2.ManifoldType.e_unknown;goog.exportProperty(b2.ContactPositionConstraint.prototype,"type",b2.ContactPositionConstraint.prototype.type);b2.ContactPositionConstraint.prototype.radiusA=0;
goog.exportProperty(b2.ContactPositionConstraint.prototype,"radiusA",b2.ContactPositionConstraint.prototype.radiusA);b2.ContactPositionConstraint.prototype.radiusB=0;goog.exportProperty(b2.ContactPositionConstraint.prototype,"radiusB",b2.ContactPositionConstraint.prototype.radiusB);b2.ContactPositionConstraint.prototype.pointCount=0;goog.exportProperty(b2.ContactPositionConstraint.prototype,"pointCount",b2.ContactPositionConstraint.prototype.pointCount);
b2.ContactPositionConstraint.MakeArray=function(a){return b2.MakeArray(a,function(a){return new b2.ContactPositionConstraint})};goog.exportProperty(b2.ContactPositionConstraint,"MakeArray",b2.ContactPositionConstraint.MakeArray);b2.ContactSolverDef=function(){this.step=new b2.TimeStep};goog.exportSymbol("b2.ContactSolverDef",b2.ContactSolverDef);b2.ContactSolverDef.prototype.step=null;goog.exportProperty(b2.ContactSolverDef.prototype,"step",b2.ContactSolverDef.prototype.step);
b2.ContactSolverDef.prototype.contacts=null;goog.exportProperty(b2.ContactSolverDef.prototype,"contacts",b2.ContactSolverDef.prototype.contacts);b2.ContactSolverDef.prototype.count=0;goog.exportProperty(b2.ContactSolverDef.prototype,"count",b2.ContactSolverDef.prototype.count);b2.ContactSolverDef.prototype.positions=null;goog.exportProperty(b2.ContactSolverDef.prototype,"positions",b2.ContactSolverDef.prototype.positions);
b2.ContactSolverDef.prototype.velocities=null;goog.exportProperty(b2.ContactSolverDef.prototype,"velocities",b2.ContactSolverDef.prototype.velocities);b2.ContactSolverDef.prototype.allocator=null;goog.exportProperty(b2.ContactSolverDef.prototype,"allocator",b2.ContactSolverDef.prototype.allocator);b2.ContactSolver=function(){this.m_step=new b2.TimeStep;this.m_positionConstraints=b2.ContactPositionConstraint.MakeArray(1024);this.m_velocityConstraints=b2.ContactVelocityConstraint.MakeArray(1024)};
goog.exportSymbol("b2.ContactSolver",b2.ContactSolver);b2.ContactSolver.prototype.m_step=null;goog.exportProperty(b2.ContactSolver.prototype,"m_step",b2.ContactSolver.prototype.m_step);b2.ContactSolver.prototype.m_positions=null;goog.exportProperty(b2.ContactSolver.prototype,"m_positions",b2.ContactSolver.prototype.m_positions);b2.ContactSolver.prototype.m_velocities=null;goog.exportProperty(b2.ContactSolver.prototype,"m_velocities",b2.ContactSolver.prototype.m_velocities);
b2.ContactSolver.prototype.m_allocator=null;goog.exportProperty(b2.ContactSolver.prototype,"m_allocator",b2.ContactSolver.prototype.m_allocator);b2.ContactSolver.prototype.m_positionConstraints=null;goog.exportProperty(b2.ContactSolver.prototype,"m_positionConstraints",b2.ContactSolver.prototype.m_positionConstraints);b2.ContactSolver.prototype.m_velocityConstraints=null;goog.exportProperty(b2.ContactSolver.prototype,"m_velocityConstraints",b2.ContactSolver.prototype.m_velocityConstraints);
b2.ContactSolver.prototype.m_contacts=null;goog.exportProperty(b2.ContactSolver.prototype,"m_contacts",b2.ContactSolver.prototype.m_contacts);b2.ContactSolver.prototype.m_count=0;goog.exportProperty(b2.ContactSolver.prototype,"m_count",b2.ContactSolver.prototype.m_count);
b2.ContactSolver.prototype.Initialize=function(a){this.m_step.Copy(a.step);this.m_allocator=a.allocator;this.m_count=a.count;if(this.m_positionConstraints.length<this.m_count){var b=b2.Max(2*this.m_positionConstraints.length,this.m_count);for(b2.DEBUG&&window.console.log("b2.ContactSolver.m_positionConstraints: "+b);this.m_positionConstraints.length<b;)this.m_positionConstraints[this.m_positionConstraints.length]=new b2.ContactPositionConstraint}if(this.m_velocityConstraints.length<
this.m_count)for(b=b2.Max(2*this.m_velocityConstraints.length,this.m_count),b2.DEBUG&&window.console.log("b2.ContactSolver.m_velocityConstraints: "+b);this.m_velocityConstraints.length<b;)this.m_velocityConstraints[this.m_velocityConstraints.length]=new b2.ContactVelocityConstraint;this.m_positions=a.positions;this.m_velocities=a.velocities;this.m_contacts=a.contacts;var c,d,e,f,g,h,k,l;a=0;for(b=this.m_count;a<b;++a)for(e=this.m_contacts[a],f=e.m_fixtureA,g=e.m_fixtureB,c=f.GetShape(),
d=g.GetShape(),c=c.m_radius,d=d.m_radius,h=f.GetBody(),k=g.GetBody(),g=e.GetManifold(),l=g.pointCount,b2.ENABLE_ASSERTS&&b2.Assert(0<l),f=this.m_velocityConstraints[a],f.friction=e.m_friction,f.restitution=e.m_restitution,f.tangentSpeed=e.m_tangentSpeed,f.indexA=h.m_islandIndex,f.indexB=k.m_islandIndex,f.invMassA=h.m_invMass,f.invMassB=k.m_invMass,f.invIA=h.m_invI,f.invIB=k.m_invI,f.contactIndex=a,f.pointCount=l,f.K.SetZero(),f.normalMass.SetZero(),e=this.m_positionConstraints[a],e.indexA=
h.m_islandIndex,e.indexB=k.m_islandIndex,e.invMassA=h.m_invMass,e.invMassB=k.m_invMass,e.localCenterA.Copy(h.m_sweep.localCenter),e.localCenterB.Copy(k.m_sweep.localCenter),e.invIA=h.m_invI,e.invIB=k.m_invI,e.localNormal.Copy(g.localNormal),e.localPoint.Copy(g.localPoint),e.pointCount=l,e.radiusA=c,e.radiusB=d,e.type=g.type,c=0,d=l;c<d;++c)h=g.points[c],l=f.points[c],this.m_step.warmStarting?(l.normalImpulse=this.m_step.dtRatio*h.normalImpulse,l.tangentImpulse=this.m_step.dtRatio*h.tangentImpulse):
(l.normalImpulse=0,l.tangentImpulse=0),l.rA.SetZero(),l.rB.SetZero(),l.normalMass=0,l.tangentMass=0,l.velocityBias=0,e.localPoints[c].Copy(h.localPoint);return this};goog.exportProperty(b2.ContactSolver.prototype,"Initialize",b2.ContactSolver.prototype.Initialize);
b2.ContactSolver.prototype.InitializeVelocityConstraints=function(){var a,b,c,d,e,f,g,h,k,l,m,n,p,q,r,u,t,w,x,v,y=b2.ContactSolver.prototype.InitializeVelocityConstraints.s_xfA,z=b2.ContactSolver.prototype.InitializeVelocityConstraints.s_xfB,B=b2.ContactSolver.prototype.InitializeVelocityConstraints.s_worldManifold;a=0;for(b=this.m_count;a<b;++a){e=this.m_velocityConstraints[a];f=this.m_positionConstraints[a];c=f.radiusA;d=f.radiusB;g=this.m_contacts[e.contactIndex].GetManifold();
h=e.indexA;k=e.indexB;l=e.invMassA;m=e.invMassB;n=e.invIA;p=e.invIB;q=f.localCenterA;r=f.localCenterB;f=this.m_positions[h].c;u=this.m_positions[h].a;t=this.m_velocities[h].v;h=this.m_velocities[h].w;w=this.m_positions[k].c;x=this.m_positions[k].a;v=this.m_velocities[k].v;k=this.m_velocities[k].w;b2.ENABLE_ASSERTS&&b2.Assert(0<g.pointCount);y.q.SetAngle(u);z.q.SetAngle(x);b2.Sub_V2_V2(f,b2.Mul_R_V2(y.q,q,b2.Vec2.s_t0),y.p);b2.Sub_V2_V2(w,b2.Mul_R_V2(z.q,r,b2.Vec2.s_t0),
z.p);B.Initialize(g,y,c,z,d);e.normal.Copy(B.normal);b2.Cross_V2_S(e.normal,1,e.tangent);d=e.pointCount;for(c=0;c<d;++c)g=e.points[c],b2.Sub_V2_V2(B.points[c],f,g.rA),b2.Sub_V2_V2(B.points[c],w,g.rB),q=b2.Cross_V2_V2(g.rA,e.normal),r=b2.Cross_V2_V2(g.rB,e.normal),q=l+m+n*q*q+p*r*r,g.normalMass=0<q?1/q:0,r=e.tangent,q=b2.Cross_V2_V2(g.rA,r),r=b2.Cross_V2_V2(g.rB,r),q=l+m+n*q*q+p*r*r,g.tangentMass=0<q?1/q:0,g.velocityBias=0,q=b2.Dot_V2_V2(e.normal,b2.Sub_V2_V2(b2.AddCross_V2_S_V2(v,
k,g.rB,b2.Vec2.s_t0),b2.AddCross_V2_S_V2(t,h,g.rA,b2.Vec2.s_t1),b2.Vec2.s_t0)),q<-b2._velocityThreshold&&(g.velocityBias+=-e.restitution*q);2===e.pointCount&&b2.g_blockSolve&&(t=e.points[0],w=e.points[1],f=b2.Cross_V2_V2(t.rA,e.normal),t=b2.Cross_V2_V2(t.rB,e.normal),h=b2.Cross_V2_V2(w.rA,e.normal),k=b2.Cross_V2_V2(w.rB,e.normal),w=l+m+n*f*f+p*t*t,v=l+m+n*h*h+p*k*k,l=l+m+n*f*h+p*t*k,w*w<1E3*(w*v-l*l)?(e.K.ex.Set(w,l),e.K.ey.Set(l,v),e.K.GetInverse(e.normalMass)):
e.pointCount=1)}};goog.exportProperty(b2.ContactSolver.prototype,"InitializeVelocityConstraints",b2.ContactSolver.prototype.InitializeVelocityConstraints);b2.ContactSolver.prototype.InitializeVelocityConstraints.s_xfA=new b2.Transform;b2.ContactSolver.prototype.InitializeVelocityConstraints.s_xfB=new b2.Transform;b2.ContactSolver.prototype.InitializeVelocityConstraints.s_worldManifold=new b2.WorldManifold;
b2.ContactSolver.prototype.WarmStart=function(){var a,b,c,d,e,f,g,h,k,l,m,n,p,q,r,u,t,w,x=b2.ContactSolver.prototype.WarmStart.s_P;a=0;for(b=this.m_count;a<b;++a){e=this.m_velocityConstraints[a];f=e.indexA;g=e.indexB;h=e.invMassA;k=e.invIA;l=e.invMassB;m=e.invIB;d=e.pointCount;n=this.m_velocities[f].v;p=this.m_velocities[f].w;q=this.m_velocities[g].v;r=this.m_velocities[g].w;u=e.normal;t=e.tangent;for(c=0;c<d;++c)w=e.points[c],b2.Add_V2_V2(b2.Mul_S_V2(w.normalImpulse,u,b2.Vec2.s_t0),
b2.Mul_S_V2(w.tangentImpulse,t,b2.Vec2.s_t1),x),p-=k*b2.Cross_V2_V2(w.rA,x),n.SelfMulSub(h,x),r+=m*b2.Cross_V2_V2(w.rB,x),q.SelfMulAdd(l,x);this.m_velocities[f].w=p;this.m_velocities[g].w=r}};goog.exportProperty(b2.ContactSolver.prototype,"WarmStart",b2.ContactSolver.prototype.WarmStart);b2.ContactSolver.prototype.WarmStart.s_P=new b2.Vec2;
b2.ContactSolver.prototype.SolveVelocityConstraints=function(){var a,b,c,d,e,f,g,h,k,l,m,n,p,q,r,u,t,w,x,v,y=b2.ContactSolver.prototype.SolveVelocityConstraints.s_dv,z=b2.ContactSolver.prototype.SolveVelocityConstraints.s_dv1,B=b2.ContactSolver.prototype.SolveVelocityConstraints.s_dv2,E,F,G=b2.ContactSolver.prototype.SolveVelocityConstraints.s_P,H=b2.ContactSolver.prototype.SolveVelocityConstraints.s_a,I=b2.ContactSolver.prototype.SolveVelocityConstraints.s_b,C=
b2.ContactSolver.prototype.SolveVelocityConstraints.s_x,A=b2.ContactSolver.prototype.SolveVelocityConstraints.s_d,K=b2.ContactSolver.prototype.SolveVelocityConstraints.s_P1,J=b2.ContactSolver.prototype.SolveVelocityConstraints.s_P2,D=b2.ContactSolver.prototype.SolveVelocityConstraints.s_P1P2;a=0;for(b=this.m_count;a<b;++a){e=this.m_velocityConstraints[a];f=e.indexA;g=e.indexB;h=e.invMassA;k=e.invIA;l=e.invMassB;m=e.invIB;n=e.pointCount;p=this.m_velocities[f].v;q=this.m_velocities[f].w;
r=this.m_velocities[g].v;u=this.m_velocities[g].w;t=e.normal;w=e.tangent;x=e.friction;b2.ENABLE_ASSERTS&&b2.Assert(1===n||2===n);c=0;for(d=n;c<d;++c)v=e.points[c],b2.Sub_V2_V2(b2.AddCross_V2_S_V2(r,u,v.rB,b2.Vec2.s_t0),b2.AddCross_V2_S_V2(p,q,v.rA,b2.Vec2.s_t1),y),E=b2.Dot_V2_V2(y,w)-e.tangentSpeed,E=v.tangentMass*-E,F=x*v.normalImpulse,F=b2.Clamp(v.tangentImpulse+E,-F,F),E=F-v.tangentImpulse,v.tangentImpulse=F,b2.Mul_S_V2(E,w,G),p.SelfMulSub(h,G),q-=
k*b2.Cross_V2_V2(v.rA,G),r.SelfMulAdd(l,G),u+=m*b2.Cross_V2_V2(v.rB,G);if(1!==e.pointCount&&b2.g_blockSolve)for(n=e.points[0],v=e.points[1],H.Set(n.normalImpulse,v.normalImpulse),b2.ENABLE_ASSERTS&&b2.Assert(0<=H.x&&0<=H.y),b2.Sub_V2_V2(b2.AddCross_V2_S_V2(r,u,n.rB,b2.Vec2.s_t0),b2.AddCross_V2_S_V2(p,q,n.rA,b2.Vec2.s_t1),z),b2.Sub_V2_V2(b2.AddCross_V2_S_V2(r,u,v.rB,b2.Vec2.s_t0),b2.AddCross_V2_S_V2(p,q,v.rA,b2.Vec2.s_t1),B),c=
b2.Dot_V2_V2(z,t),d=b2.Dot_V2_V2(B,t),I.x=c-n.velocityBias,I.y=d-v.velocityBias,I.SelfSub(b2.Mul_M22_V2(e.K,H,b2.Vec2.s_t0));;){b2.Mul_M22_V2(e.normalMass,I,C).SelfNeg();if(0<=C.x&&0<=C.y){b2.Sub_V2_V2(C,H,A);b2.Mul_S_V2(A.x,t,K);b2.Mul_S_V2(A.y,t,J);b2.Add_V2_V2(K,J,D);p.SelfMulSub(h,D);q-=k*(b2.Cross_V2_V2(n.rA,K)+b2.Cross_V2_V2(v.rA,J));r.SelfMulAdd(l,D);u+=m*(b2.Cross_V2_V2(n.rB,K)+b2.Cross_V2_V2(v.rB,J));n.normalImpulse=C.x;v.normalImpulse=
C.y;break}C.x=-n.normalMass*I.x;C.y=0;d=e.K.ex.y*C.x+I.y;if(0<=C.x&&0<=d){b2.Sub_V2_V2(C,H,A);b2.Mul_S_V2(A.x,t,K);b2.Mul_S_V2(A.y,t,J);b2.Add_V2_V2(K,J,D);p.SelfMulSub(h,D);q-=k*(b2.Cross_V2_V2(n.rA,K)+b2.Cross_V2_V2(v.rA,J));r.SelfMulAdd(l,D);u+=m*(b2.Cross_V2_V2(n.rB,K)+b2.Cross_V2_V2(v.rB,J));n.normalImpulse=C.x;v.normalImpulse=C.y;break}C.x=0;C.y=-v.normalMass*I.y;c=e.K.ey.x*C.y+I.x;if(0<=C.y&&0<=c){b2.Sub_V2_V2(C,H,A);b2.Mul_S_V2(A.x,t,K);b2.Mul_S_V2(A.y,
t,J);b2.Add_V2_V2(K,J,D);p.SelfMulSub(h,D);q-=k*(b2.Cross_V2_V2(n.rA,K)+b2.Cross_V2_V2(v.rA,J));r.SelfMulAdd(l,D);u+=m*(b2.Cross_V2_V2(n.rB,K)+b2.Cross_V2_V2(v.rB,J));n.normalImpulse=C.x;v.normalImpulse=C.y;break}C.x=0;C.y=0;c=I.x;d=I.y;if(0<=c&&0<=d){b2.Sub_V2_V2(C,H,A);b2.Mul_S_V2(A.x,t,K);b2.Mul_S_V2(A.y,t,J);b2.Add_V2_V2(K,J,D);p.SelfMulSub(h,D);q-=k*(b2.Cross_V2_V2(n.rA,K)+b2.Cross_V2_V2(v.rA,J));r.SelfMulAdd(l,D);u+=m*(b2.Cross_V2_V2(n.rB,
K)+b2.Cross_V2_V2(v.rB,J));n.normalImpulse=C.x;v.normalImpulse=C.y;break}break}else for(c=0;c<n;++c)v=e.points[c],b2.Sub_V2_V2(b2.AddCross_V2_S_V2(r,u,v.rB,b2.Vec2.s_t0),b2.AddCross_V2_S_V2(p,q,v.rA,b2.Vec2.s_t1),y),d=b2.Dot_V2_V2(y,t),E=-v.normalMass*(d-v.velocityBias),F=b2.Max(v.normalImpulse+E,0),E=F-v.normalImpulse,v.normalImpulse=F,b2.Mul_S_V2(E,t,G),p.SelfMulSub(h,G),q-=k*b2.Cross_V2_V2(v.rA,G),r.SelfMulAdd(l,G),u+=m*b2.Cross_V2_V2(v.rB,
G);this.m_velocities[f].w=q;this.m_velocities[g].w=u}};goog.exportProperty(b2.ContactSolver.prototype,"SolveVelocityConstraints",b2.ContactSolver.prototype.SolveVelocityConstraints);b2.ContactSolver.prototype.SolveVelocityConstraints.s_dv=new b2.Vec2;b2.ContactSolver.prototype.SolveVelocityConstraints.s_dv1=new b2.Vec2;b2.ContactSolver.prototype.SolveVelocityConstraints.s_dv2=new b2.Vec2;b2.ContactSolver.prototype.SolveVelocityConstraints.s_P=new b2.Vec2;
b2.ContactSolver.prototype.SolveVelocityConstraints.s_a=new b2.Vec2;b2.ContactSolver.prototype.SolveVelocityConstraints.s_b=new b2.Vec2;b2.ContactSolver.prototype.SolveVelocityConstraints.s_x=new b2.Vec2;b2.ContactSolver.prototype.SolveVelocityConstraints.s_d=new b2.Vec2;b2.ContactSolver.prototype.SolveVelocityConstraints.s_P1=new b2.Vec2;b2.ContactSolver.prototype.SolveVelocityConstraints.s_P2=new b2.Vec2;
b2.ContactSolver.prototype.SolveVelocityConstraints.s_P1P2=new b2.Vec2;b2.ContactSolver.prototype.StoreImpulses=function(){var a,b,c,d,e,f;a=0;for(b=this.m_count;a<b;++a)for(e=this.m_velocityConstraints[a],f=this.m_contacts[e.contactIndex].GetManifold(),c=0,d=e.pointCount;c<d;++c)f.points[c].normalImpulse=e.points[c].normalImpulse,f.points[c].tangentImpulse=e.points[c].tangentImpulse};goog.exportProperty(b2.ContactSolver.prototype,"StoreImpulses",b2.ContactSolver.prototype.StoreImpulses);
b2.PositionSolverManifold=function(){this.normal=new b2.Vec2;this.point=new b2.Vec2};goog.exportSymbol("b2.PositionSolverManifold",b2.PositionSolverManifold);b2.PositionSolverManifold.prototype.normal=null;goog.exportProperty(b2.PositionSolverManifold.prototype,"normal",b2.PositionSolverManifold.prototype.normal);b2.PositionSolverManifold.prototype.point=null;goog.exportProperty(b2.PositionSolverManifold.prototype,"point",b2.PositionSolverManifold.prototype.point);
b2.PositionSolverManifold.prototype.separation=0;goog.exportProperty(b2.PositionSolverManifold.prototype,"separation",b2.PositionSolverManifold.prototype.separation);
b2.PositionSolverManifold.prototype.Initialize=function(a,b,c,d){var e=b2.PositionSolverManifold.prototype.Initialize.s_pointA,f=b2.PositionSolverManifold.prototype.Initialize.s_pointB,g=b2.PositionSolverManifold.prototype.Initialize.s_planePoint,h=b2.PositionSolverManifold.prototype.Initialize.s_clipPoint;b2.ENABLE_ASSERTS&&b2.Assert(0<a.pointCount);switch(a.type){case b2.ManifoldType.e_circles:b2.Mul_X_V2(b,a.localPoint,e);b2.Mul_X_V2(c,a.localPoints[0],
f);b2.Sub_V2_V2(f,e,this.normal).SelfNormalize();b2.Mid_V2_V2(e,f,this.point);this.separation=b2.Dot_V2_V2(b2.Sub_V2_V2(f,e,b2.Vec2.s_t0),this.normal)-a.radiusA-a.radiusB;break;case b2.ManifoldType.e_faceA:b2.Mul_R_V2(b.q,a.localNormal,this.normal);b2.Mul_X_V2(b,a.localPoint,g);b2.Mul_X_V2(c,a.localPoints[d],h);this.separation=b2.Dot_V2_V2(b2.Sub_V2_V2(h,g,b2.Vec2.s_t0),this.normal)-a.radiusA-a.radiusB;this.point.Copy(h);break;case b2.ManifoldType.e_faceB:b2.Mul_R_V2(c.q,
a.localNormal,this.normal),b2.Mul_X_V2(c,a.localPoint,g),b2.Mul_X_V2(b,a.localPoints[d],h),this.separation=b2.Dot_V2_V2(b2.Sub_V2_V2(h,g,b2.Vec2.s_t0),this.normal)-a.radiusA-a.radiusB,this.point.Copy(h),this.normal.SelfNeg()}};goog.exportProperty(b2.PositionSolverManifold.prototype,"Initialize",b2.PositionSolverManifold.prototype.Initialize);b2.PositionSolverManifold.prototype.Initialize.s_pointA=new b2.Vec2;
b2.PositionSolverManifold.prototype.Initialize.s_pointB=new b2.Vec2;b2.PositionSolverManifold.prototype.Initialize.s_planePoint=new b2.Vec2;b2.PositionSolverManifold.prototype.Initialize.s_clipPoint=new b2.Vec2;
b2.ContactSolver.prototype.SolvePositionConstraints=function(){var a,b,c,d,e,f,g,h,k,l,m,n,p,q,r,u,t,w=b2.ContactSolver.prototype.SolvePositionConstraints.s_xfA,x=b2.ContactSolver.prototype.SolvePositionConstraints.s_xfB,v=b2.ContactSolver.prototype.SolvePositionConstraints.s_psm,y,z,B,E=b2.ContactSolver.prototype.SolvePositionConstraints.s_rA,F=b2.ContactSolver.prototype.SolvePositionConstraints.s_rB,G,H=b2.ContactSolver.prototype.SolvePositionConstraints.s_P,I=
0;a=0;for(b=this.m_count;a<b;++a){e=this.m_positionConstraints[a];f=e.indexA;g=e.indexB;h=e.localCenterA;k=e.invMassA;l=e.invIA;m=e.localCenterB;n=e.invMassB;p=e.invIB;d=e.pointCount;q=this.m_positions[f].c;r=this.m_positions[f].a;u=this.m_positions[g].c;t=this.m_positions[g].a;for(c=0;c<d;++c)w.q.SetAngle(r),x.q.SetAngle(t),b2.Sub_V2_V2(q,b2.Mul_R_V2(w.q,h,b2.Vec2.s_t0),w.p),b2.Sub_V2_V2(u,b2.Mul_R_V2(x.q,m,b2.Vec2.s_t0),x.p),v.Initialize(e,w,x,c),y=v.normal,z=v.point,
B=v.separation,b2.Sub_V2_V2(z,q,E),b2.Sub_V2_V2(z,u,F),I=b2.Min(I,B),z=b2.Clamp(b2._baumgarte*(B+b2._linearSlop),-b2._maxLinearCorrection,0),B=b2.Cross_V2_V2(E,y),G=b2.Cross_V2_V2(F,y),B=k+n+l*B*B+p*G*G,z=0<B?-z/B:0,b2.Mul_S_V2(z,y,H),q.SelfMulSub(k,H),r-=l*b2.Cross_V2_V2(E,H),u.SelfMulAdd(n,H),t+=p*b2.Cross_V2_V2(F,H);this.m_positions[f].a=r;this.m_positions[g].a=t}return I>-3*b2._linearSlop};
goog.exportProperty(b2.ContactSolver.prototype,"SolvePositionConstraints",b2.ContactSolver.prototype.SolvePositionConstraints);b2.ContactSolver.prototype.SolvePositionConstraints.s_xfA=new b2.Transform;b2.ContactSolver.prototype.SolvePositionConstraints.s_xfB=new b2.Transform;b2.ContactSolver.prototype.SolvePositionConstraints.s_psm=new b2.PositionSolverManifold;b2.ContactSolver.prototype.SolvePositionConstraints.s_rA=new b2.Vec2;
b2.ContactSolver.prototype.SolvePositionConstraints.s_rB=new b2.Vec2;b2.ContactSolver.prototype.SolvePositionConstraints.s_P=new b2.Vec2;
b2.ContactSolver.prototype.SolveTOIPositionConstraints=function(a,b){var c,d,e,f,g,h,k,l,m,n,p,q,r,u,t,w,x,v=b2.ContactSolver.prototype.SolveTOIPositionConstraints.s_xfA,y=b2.ContactSolver.prototype.SolveTOIPositionConstraints.s_xfB,z=b2.ContactSolver.prototype.SolveTOIPositionConstraints.s_psm,B,E,F,G=b2.ContactSolver.prototype.SolveTOIPositionConstraints.s_rA,H=b2.ContactSolver.prototype.SolveTOIPositionConstraints.s_rB,I,C=b2.ContactSolver.prototype.SolveTOIPositionConstraints.s_P,
A=0;c=0;for(d=this.m_count;c<d;++c){g=this.m_positionConstraints[c];h=g.indexA;k=g.indexB;l=g.localCenterA;m=g.localCenterB;f=g.pointCount;p=n=0;if(h===a||h===b)n=g.invMassA,p=g.invIA;r=q=0;if(k===a||k===b)q=g.invMassB,r=g.invIB;u=this.m_positions[h].c;t=this.m_positions[h].a;w=this.m_positions[k].c;x=this.m_positions[k].a;for(e=0;e<f;++e)v.q.SetAngle(t),y.q.SetAngle(x),b2.Sub_V2_V2(u,b2.Mul_R_V2(v.q,l,b2.Vec2.s_t0),v.p),b2.Sub_V2_V2(w,b2.Mul_R_V2(y.q,m,b2.Vec2.s_t0),
y.p),z.Initialize(g,v,y,e),B=z.normal,E=z.point,F=z.separation,b2.Sub_V2_V2(E,u,G),b2.Sub_V2_V2(E,w,H),A=b2.Min(A,F),E=b2.Clamp(b2._toiBaumgarte*(F+b2._linearSlop),-b2._maxLinearCorrection,0),F=b2.Cross_V2_V2(G,B),I=b2.Cross_V2_V2(H,B),F=n+q+p*F*F+r*I*I,E=0<F?-E/F:0,b2.Mul_S_V2(E,B,C),u.SelfMulSub(n,C),t-=p*b2.Cross_V2_V2(G,C),w.SelfMulAdd(q,C),x+=r*b2.Cross_V2_V2(H,C);this.m_positions[h].a=t;this.m_positions[k].a=x}return A>=-1.5*b2._linearSlop};
goog.exportProperty(b2.ContactSolver.prototype,"SolveTOIPositionConstraints",b2.ContactSolver.prototype.SolveTOIPositionConstraints);b2.ContactSolver.prototype.SolveTOIPositionConstraints.s_xfA=new b2.Transform;b2.ContactSolver.prototype.SolveTOIPositionConstraints.s_xfB=new b2.Transform;b2.ContactSolver.prototype.SolveTOIPositionConstraints.s_psm=new b2.PositionSolverManifold;b2.ContactSolver.prototype.SolveTOIPositionConstraints.s_rA=new b2.Vec2;
b2.ContactSolver.prototype.SolveTOIPositionConstraints.s_rB=new b2.Vec2;b2.ContactSolver.prototype.SolveTOIPositionConstraints.s_P=new b2.Vec2;b2.Island=function(){this.m_bodies=Array(1024);this.m_contacts=Array(1024);this.m_joints=Array(1024);this.m_positions=b2.Position.MakeArray(1024);this.m_velocities=b2.Velocity.MakeArray(1024)};goog.exportSymbol("b2.Island",b2.Island);b2.Island.prototype.m_allocator=null;goog.exportProperty(b2.Island.prototype,"m_allocator",b2.Island.prototype.m_allocator);b2.Island.prototype.m_listener=null;goog.exportProperty(b2.Island.prototype,"m_listener",b2.Island.prototype.m_listener);
b2.Island.prototype.m_bodies=null;goog.exportProperty(b2.Island.prototype,"m_bodies",b2.Island.prototype.m_bodies);b2.Island.prototype.m_contacts=null;goog.exportProperty(b2.Island.prototype,"m_contacts",b2.Island.prototype.m_contacts);b2.Island.prototype.m_joints=null;goog.exportProperty(b2.Island.prototype,"m_joints",b2.Island.prototype.m_joints);b2.Island.prototype.m_positions=null;goog.exportProperty(b2.Island.prototype,"m_positions",b2.Island.prototype.m_positions);
b2.Island.prototype.m_velocities=null;goog.exportProperty(b2.Island.prototype,"m_velocities",b2.Island.prototype.m_velocities);b2.Island.prototype.m_bodyCount=0;goog.exportProperty(b2.Island.prototype,"m_bodyCount",b2.Island.prototype.m_bodyCount);b2.Island.prototype.m_jointCount=0;goog.exportProperty(b2.Island.prototype,"m_jointCount",b2.Island.prototype.m_jointCount);b2.Island.prototype.m_contactCount=0;
goog.exportProperty(b2.Island.prototype,"m_contactCount",b2.Island.prototype.m_contactCount);b2.Island.prototype.m_bodyCapacity=0;goog.exportProperty(b2.Island.prototype,"m_bodyCapacity",b2.Island.prototype.m_bodyCapacity);b2.Island.prototype.m_contactCapacity=0;goog.exportProperty(b2.Island.prototype,"m_contactCapacity",b2.Island.prototype.m_contactCapacity);b2.Island.prototype.m_jointCapacity=0;
goog.exportProperty(b2.Island.prototype,"m_jointCapacity",b2.Island.prototype.m_jointCapacity);
b2.Island.prototype.Initialize=function(a,b,c,d,e){this.m_bodyCapacity=a;this.m_contactCapacity=b;this.m_jointCapacity=c;this.m_jointCount=this.m_contactCount=this.m_bodyCount=0;this.m_allocator=d;for(this.m_listener=e;this.m_bodies.length<a;)this.m_bodies[this.m_bodies.length]=null;for(;this.m_contacts.length<b;)this.m_contacts[this.m_contacts.length]=null;for(;this.m_joints.length<c;)this.m_joints[this.m_joints.length]=null;if(this.m_positions.length<a)for(b=b2.Max(2*this.m_positions.length,
a),b2.DEBUG&&window.console.log("b2.Island.m_positions: "+b);this.m_positions.length<b;)this.m_positions[this.m_positions.length]=new b2.Position;if(this.m_velocities.length<a)for(b=b2.Max(2*this.m_velocities.length,a),b2.DEBUG&&window.console.log("b2.Island.m_velocities: "+b);this.m_velocities.length<b;)this.m_velocities[this.m_velocities.length]=new b2.Velocity};goog.exportProperty(b2.Island.prototype,"Initialize",b2.Island.prototype.Initialize);
b2.Island.prototype.Clear=function(){this.m_jointCount=this.m_contactCount=this.m_bodyCount=0};goog.exportProperty(b2.Island.prototype,"Clear",b2.Island.prototype.Clear);b2.Island.prototype.AddBody=function(a){b2.ENABLE_ASSERTS&&b2.Assert(this.m_bodyCount<this.m_bodyCapacity);a.m_islandIndex=this.m_bodyCount;this.m_bodies[this.m_bodyCount++]=a};goog.exportProperty(b2.Island.prototype,"AddBody",b2.Island.prototype.AddBody);
b2.Island.prototype.AddContact=function(a){b2.ENABLE_ASSERTS&&b2.Assert(this.m_contactCount<this.m_contactCapacity);this.m_contacts[this.m_contactCount++]=a};goog.exportProperty(b2.Island.prototype,"AddContact",b2.Island.prototype.AddContact);b2.Island.prototype.AddJoint=function(a){b2.ENABLE_ASSERTS&&b2.Assert(this.m_jointCount<this.m_jointCapacity);this.m_joints[this.m_jointCount++]=a};goog.exportProperty(b2.Island.prototype,"AddJoint",b2.Island.prototype.AddJoint);
b2.Island.prototype.Solve=function(a,b,c,d){for(var e=b2.Island.s_timer.Reset(),f=b.dt,g=0;g<this.m_bodyCount;++g){var h=this.m_bodies[g],k=this.m_positions[g].c.Copy(h.m_sweep.c),l=h.m_sweep.a,m=this.m_velocities[g].v.Copy(h.m_linearVelocity),n=h.m_angularVelocity;h.m_sweep.c0.Copy(h.m_sweep.c);h.m_sweep.a0=h.m_sweep.a;h.m_type===b2.BodyType.dynamicBody&&(m.x+=f*(h.m_gravityScale*c.x+h.m_invMass*h.m_force.x),m.y+=f*(h.m_gravityScale*c.y+h.m_invMass*h.m_force.y),n+=f*h.m_invI*h.m_torque,
m.SelfMul(1/(1+f*h.m_linearDamping)),n*=1/(1+f*h.m_angularDamping));this.m_positions[g].a=l;this.m_velocities[g].w=n}e.Reset();h=b2.Island.s_solverData;h.step.Copy(b);h.positions=this.m_positions;h.velocities=this.m_velocities;g=b2.Island.s_contactSolverDef;g.step.Copy(b);g.contacts=this.m_contacts;g.count=this.m_contactCount;g.positions=this.m_positions;g.velocities=this.m_velocities;g.allocator=this.m_allocator;c=b2.Island.s_contactSolver.Initialize(g);c.InitializeVelocityConstraints();
b.warmStarting&&c.WarmStart();for(g=0;g<this.m_jointCount;++g)this.m_joints[g].InitVelocityConstraints(h);a.solveInit=e.GetMilliseconds();e.Reset();for(g=0;g<b.velocityIterations;++g){for(l=0;l<this.m_jointCount;++l)this.m_joints[l].SolveVelocityConstraints(h);c.SolveVelocityConstraints()}c.StoreImpulses();a.solveVelocity=e.GetMilliseconds();for(g=0;g<this.m_bodyCount;++g){var k=this.m_positions[g].c,l=this.m_positions[g].a,m=this.m_velocities[g].v,n=this.m_velocities[g].w,p=b2.Mul_S_V2(f,m,
b2.Island.s_translation);b2.Dot_V2_V2(p,p)>b2._maxTranslationSquared&&(p=b2._maxTranslation/p.Length(),m.SelfMul(p));p=f*n;p*p>b2._maxRotationSquared&&(p=b2._maxRotation/b2.Abs(p),n*=p);k.x+=f*m.x;k.y+=f*m.y;l+=f*n;this.m_positions[g].a=l;this.m_velocities[g].w=n}e.Reset();k=!1;for(g=0;g<b.positionIterations;++g){m=c.SolvePositionConstraints();n=!0;for(l=0;l<this.m_jointCount;++l)p=this.m_joints[l].SolvePositionConstraints(h),n=n&&p;if(m&&n){k=!0;break}}for(g=0;g<
this.m_bodyCount;++g)b=this.m_bodies[g],b.m_sweep.c.Copy(this.m_positions[g].c),b.m_sweep.a=this.m_positions[g].a,b.m_linearVelocity.Copy(this.m_velocities[g].v),b.m_angularVelocity=this.m_velocities[g].w,b.SynchronizeTransform();a.solvePosition=e.GetMilliseconds();this.Report(c.m_velocityConstraints);if(d){a=b2._maxFloat;d=b2._linearSleepTolerance*b2._linearSleepTolerance;e=b2._angularSleepTolerance*b2._angularSleepTolerance;for(g=0;g<this.m_bodyCount;++g)h=this.m_bodies[g],
h.GetType()!==b2.BodyType.staticBody&&(!h.m_flag_autoSleepFlag||h.m_angularVelocity*h.m_angularVelocity>e||b2.Dot_V2_V2(h.m_linearVelocity,h.m_linearVelocity)>d?a=h.m_sleepTime=0:(h.m_sleepTime+=f,a=b2.Min(a,h.m_sleepTime)));if(a>=b2._timeToSleep&&k)for(g=0;g<this.m_bodyCount;++g)h=this.m_bodies[g],h.SetAwake(!1)}};goog.exportProperty(b2.Island.prototype,"Solve",b2.Island.prototype.Solve);
b2.Island.prototype.SolveTOI=function(a,b,c){b2.ENABLE_ASSERTS&&b2.Assert(b<this.m_bodyCount);b2.ENABLE_ASSERTS&&b2.Assert(c<this.m_bodyCount);for(var d=0;d<this.m_bodyCount;++d){var e=this.m_bodies[d];this.m_positions[d].c.Copy(e.m_sweep.c);this.m_positions[d].a=e.m_sweep.a;this.m_velocities[d].v.Copy(e.m_linearVelocity);this.m_velocities[d].w=e.m_angularVelocity}d=b2.Island.s_contactSolverDef;d.contacts=this.m_contacts;d.count=this.m_contactCount;d.allocator=this.m_allocator;
d.step.Copy(a);d.positions=this.m_positions;d.velocities=this.m_velocities;e=b2.Island.s_contactSolver.Initialize(d);for(d=0;d<a.positionIterations&&!e.SolveTOIPositionConstraints(b,c);++d);this.m_bodies[b].m_sweep.c0.Copy(this.m_positions[b].c);this.m_bodies[b].m_sweep.a0=this.m_positions[b].a;this.m_bodies[c].m_sweep.c0.Copy(this.m_positions[c].c);this.m_bodies[c].m_sweep.a0=this.m_positions[c].a;e.InitializeVelocityConstraints();for(d=0;d<a.velocityIterations;++d)e.SolveVelocityConstraints();
a=a.dt;for(d=0;d<this.m_bodyCount;++d){b=this.m_positions[d].c;c=this.m_positions[d].a;var f=this.m_velocities[d].v,g=this.m_velocities[d].w,h=b2.Mul_S_V2(a,f,b2.Island.s_translation);b2.Dot_V2_V2(h,h)>b2._maxTranslationSquared&&(h=b2._maxTranslation/h.Length(),f.SelfMul(h));h=a*g;h*h>b2._maxRotationSquared&&(h=b2._maxRotation/b2.Abs(h),g*=h);b.SelfMulAdd(a,f);c+=a*g;this.m_positions[d].a=c;this.m_velocities[d].w=g;h=this.m_bodies[d];h.m_sweep.c.Copy(b);h.m_sweep.a=
c;h.m_linearVelocity.Copy(f);h.m_angularVelocity=g;h.SynchronizeTransform()}this.Report(e.m_velocityConstraints)};goog.exportProperty(b2.Island.prototype,"SolveTOI",b2.Island.prototype.SolveTOI);
b2.Island.prototype.Report=function(a){if(null!==this.m_listener)for(var b=0;b<this.m_contactCount;++b){var c=this.m_contacts[b];if(c){var d=a[b],e=b2.Island.s_impulse;e.count=d.pointCount;for(var f=0;f<d.pointCount;++f)e.normalImpulses[f]=d.points[f].normalImpulse,e.tangentImpulses[f]=d.points[f].tangentImpulse;this.m_listener.PostSolve(c,e)}}};goog.exportProperty(b2.Island.prototype,"Report",b2.Island.prototype.Report);b2.Island.s_timer=new b2.Timer;
b2.Island.s_solverData=new b2.SolverData;b2.Island.s_contactSolverDef=new b2.ContactSolverDef;b2.Island.s_contactSolver=new b2.ContactSolver;b2.Island.s_translation=new b2.Vec2;b2.Island.s_impulse=new b2.ContactImpulse;b2.JointType={e_unknownJoint:0,e_revoluteJoint:1,e_prismaticJoint:2,e_distanceJoint:3,e_pulleyJoint:4,e_mouseJoint:5,e_gearJoint:6,e_wheelJoint:7,e_weldJoint:8,e_frictionJoint:9,e_ropeJoint:10,e_motorJoint:11,e_areaJoint:12};goog.exportSymbol("b2.JointType",b2.JointType);goog.exportProperty(b2.JointType,"e_unknownJoint",b2.JointType.e_unknownJoint);goog.exportProperty(b2.JointType,"e_revoluteJoint",b2.JointType.e_revoluteJoint);
goog.exportProperty(b2.JointType,"e_prismaticJoint",b2.JointType.e_prismaticJoint);goog.exportProperty(b2.JointType,"e_distanceJoint",b2.JointType.e_distanceJoint);goog.exportProperty(b2.JointType,"e_pulleyJoint",b2.JointType.e_pulleyJoint);goog.exportProperty(b2.JointType,"e_mouseJoint",b2.JointType.e_mouseJoint);goog.exportProperty(b2.JointType,"e_gearJoint",b2.JointType.e_gearJoint);goog.exportProperty(b2.JointType,"e_wheelJoint",b2.JointType.e_wheelJoint);
goog.exportProperty(b2.JointType,"e_weldJoint",b2.JointType.e_weldJoint);goog.exportProperty(b2.JointType,"e_frictionJoint",b2.JointType.e_frictionJoint);goog.exportProperty(b2.JointType,"e_ropeJoint",b2.JointType.e_ropeJoint);goog.exportProperty(b2.JointType,"e_motorJoint",b2.JointType.e_motorJoint);goog.exportProperty(b2.JointType,"e_areaJoint",b2.JointType.e_areaJoint);b2.LimitState={e_inactiveLimit:0,e_atLowerLimit:1,e_atUpperLimit:2,e_equalLimits:3};
goog.exportSymbol("b2.LimitState",b2.LimitState);goog.exportProperty(b2.LimitState,"e_inactiveLimit",b2.LimitState.e_inactiveLimit);goog.exportProperty(b2.LimitState,"e_atLowerLimit",b2.LimitState.e_atLowerLimit);goog.exportProperty(b2.LimitState,"e_atUpperLimit",b2.LimitState.e_atUpperLimit);goog.exportProperty(b2.LimitState,"e_equalLimits",b2.LimitState.e_equalLimits);b2.Jacobian=function(){this.linear=new b2.Vec2};
goog.exportSymbol("b2.Jacobian",b2.Jacobian);b2.Jacobian.prototype.linear=null;goog.exportProperty(b2.Jacobian.prototype,"linear",b2.Jacobian.prototype.linear);b2.Jacobian.prototype.angularA=0;goog.exportProperty(b2.Jacobian.prototype,"angularA",b2.Jacobian.prototype.angularA);b2.Jacobian.prototype.angularB=0;goog.exportProperty(b2.Jacobian.prototype,"angularB",b2.Jacobian.prototype.angularB);
b2.Jacobian.prototype.SetZero=function(){this.linear.SetZero();this.angularB=this.angularA=0;return this};goog.exportProperty(b2.Jacobian.prototype,"SetZero",b2.Jacobian.prototype.SetZero);b2.Jacobian.prototype.Set=function(a,b,c){this.linear.Copy(a);this.angularA=b;this.angularB=c;return this};goog.exportProperty(b2.Jacobian.prototype,"Set",b2.Jacobian.prototype.Set);b2.JointEdge=function(){};goog.exportSymbol("b2.JointEdge",b2.JointEdge);
b2.JointEdge.prototype.other=null;goog.exportProperty(b2.JointEdge.prototype,"other",b2.JointEdge.prototype.other);b2.JointEdge.prototype.joint=null;goog.exportProperty(b2.JointEdge.prototype,"joint",b2.JointEdge.prototype.joint);b2.JointEdge.prototype.prev=null;goog.exportProperty(b2.JointEdge.prototype,"prev",b2.JointEdge.prototype.prev);b2.JointEdge.prototype.next=null;goog.exportProperty(b2.JointEdge.prototype,"next",b2.JointEdge.prototype.next);
b2.JointDef=function(a){this.type=a};goog.exportSymbol("b2.JointDef",b2.JointDef);b2.JointDef.prototype.type=b2.JointType.e_unknownJoint;goog.exportProperty(b2.JointDef.prototype,"type",b2.JointDef.prototype.type);b2.JointDef.prototype.userData=null;goog.exportProperty(b2.JointDef.prototype,"userData",b2.JointDef.prototype.userData);b2.JointDef.prototype.bodyA=null;goog.exportProperty(b2.JointDef.prototype,"bodyA",b2.JointDef.prototype.bodyA);
b2.JointDef.prototype.bodyB=null;goog.exportProperty(b2.JointDef.prototype,"bodyB",b2.JointDef.prototype.bodyB);b2.JointDef.prototype.collideConnected=!1;goog.exportProperty(b2.JointDef.prototype,"collideConnected",b2.JointDef.prototype.collideConnected);
b2.Joint=function(a){b2.ENABLE_ASSERTS&&b2.Assert(a.bodyA!==a.bodyB);this.m_type=a.type;this.m_edgeA=new b2.JointEdge;this.m_edgeB=new b2.JointEdge;this.m_bodyA=a.bodyA;this.m_bodyB=a.bodyB;this.m_collideConnected=a.collideConnected;this.m_userData=a.userData};goog.exportSymbol("b2.Joint",b2.Joint);b2.Joint.prototype.m_type=b2.JointType.e_unknownJoint;goog.exportProperty(b2.Joint.prototype,"m_type",b2.Joint.prototype.m_type);
b2.Joint.prototype.m_prev=null;goog.exportProperty(b2.Joint.prototype,"m_prev",b2.Joint.prototype.m_prev);b2.Joint.prototype.m_next=null;goog.exportProperty(b2.Joint.prototype,"m_next",b2.Joint.prototype.m_next);b2.Joint.prototype.m_edgeA=null;goog.exportProperty(b2.Joint.prototype,"m_edgeA",b2.Joint.prototype.m_edgeA);b2.Joint.prototype.m_edgeB=null;goog.exportProperty(b2.Joint.prototype,"m_edgeB",b2.Joint.prototype.m_edgeB);
b2.Joint.prototype.m_bodyA=null;goog.exportProperty(b2.Joint.prototype,"m_bodyA",b2.Joint.prototype.m_bodyA);b2.Joint.prototype.m_bodyB=null;goog.exportProperty(b2.Joint.prototype,"m_bodyB",b2.Joint.prototype.m_bodyB);b2.Joint.prototype.m_index=0;goog.exportProperty(b2.Joint.prototype,"m_index",b2.Joint.prototype.m_index);b2.Joint.prototype.m_islandFlag=!1;goog.exportProperty(b2.Joint.prototype,"m_islandFlag",b2.Joint.prototype.m_islandFlag);
b2.Joint.prototype.m_collideConnected=!1;goog.exportProperty(b2.Joint.prototype,"m_collideConnected",b2.Joint.prototype.m_collideConnected);b2.Joint.prototype.m_userData=null;goog.exportProperty(b2.Joint.prototype,"m_userData",b2.Joint.prototype.m_userData);b2.Joint.prototype.GetAnchorA=function(a){return a.SetZero()};goog.exportProperty(b2.Joint.prototype,"GetAnchorA",b2.Joint.prototype.GetAnchorA);b2.Joint.prototype.GetAnchorB=function(a){return a.SetZero()};
goog.exportProperty(b2.Joint.prototype,"GetAnchorB",b2.Joint.prototype.GetAnchorB);b2.Joint.prototype.GetReactionForce=function(a,b){return b.SetZero()};goog.exportProperty(b2.Joint.prototype,"GetReactionForce",b2.Joint.prototype.GetReactionForce);b2.Joint.prototype.GetReactionTorque=function(a){return 0};goog.exportProperty(b2.Joint.prototype,"GetReactionTorque",b2.Joint.prototype.GetReactionTorque);b2.Joint.prototype.InitVelocityConstraints=function(a){};
goog.exportProperty(b2.Joint.prototype,"InitVelocityConstraints",b2.Joint.prototype.InitVelocityConstraints);b2.Joint.prototype.SolveVelocityConstraints=function(a){};goog.exportProperty(b2.Joint.prototype,"SolveVelocityConstraints",b2.Joint.prototype.SolveVelocityConstraints);b2.Joint.prototype.SolvePositionConstraints=function(a){return!1};goog.exportProperty(b2.Joint.prototype,"SolvePositionConstraints",b2.Joint.prototype.SolvePositionConstraints);
b2.Joint.prototype.GetType=function(){return this.m_type};goog.exportProperty(b2.Joint.prototype,"GetType",b2.Joint.prototype.GetType);b2.Joint.prototype.GetBodyA=function(){return this.m_bodyA};goog.exportProperty(b2.Joint.prototype,"GetBodyA",b2.Joint.prototype.GetBodyA);b2.Joint.prototype.GetBodyB=function(){return this.m_bodyB};goog.exportProperty(b2.Joint.prototype,"GetBodyB",b2.Joint.prototype.GetBodyB);b2.Joint.prototype.GetNext=function(){return this.m_next};
goog.exportProperty(b2.Joint.prototype,"GetNext",b2.Joint.prototype.GetNext);b2.Joint.prototype.GetUserData=function(){return this.m_userData};goog.exportProperty(b2.Joint.prototype,"GetUserData",b2.Joint.prototype.GetUserData);b2.Joint.prototype.SetUserData=function(a){this.m_userData=a};goog.exportProperty(b2.Joint.prototype,"SetUserData",b2.Joint.prototype.SetUserData);b2.Joint.prototype.GetCollideConnected=function(){return this.m_collideConnected};
goog.exportProperty(b2.Joint.prototype,"GetCollideConnected",b2.Joint.prototype.GetCollideConnected);b2.Joint.prototype.Dump=function(){b2.DEBUG&&b2.Log("// Dump is not supported for this joint type.\n")};goog.exportProperty(b2.Joint.prototype,"Dump",b2.Joint.prototype.Dump);b2.Joint.prototype.IsActive=function(){return this.m_bodyA.IsActive()&&this.m_bodyB.IsActive()};goog.exportProperty(b2.Joint.prototype,"IsActive",b2.Joint.prototype.IsActive);
b2.Joint.prototype.ShiftOrigin=function(a){};goog.exportProperty(b2.Joint.prototype,"ShiftOrigin",b2.Joint.prototype.ShiftOrigin);b2.AreaJointDef=function(){b2.JointDef.call(this,b2.JointType.e_areaJoint);this.bodies=[]};goog.inherits(b2.AreaJointDef,b2.JointDef);goog.exportSymbol("b2.AreaJointDef",b2.AreaJointDef);b2.AreaJointDef.prototype.world=null;goog.exportProperty(b2.AreaJointDef.prototype,"world",b2.AreaJointDef.prototype.world);b2.AreaJointDef.prototype.bodies=null;goog.exportProperty(b2.AreaJointDef.prototype,"bodies",b2.AreaJointDef.prototype.bodies);
b2.AreaJointDef.prototype.frequencyHz=0;goog.exportProperty(b2.AreaJointDef.prototype,"frequencyHz",b2.AreaJointDef.prototype.frequencyHz);b2.AreaJointDef.prototype.dampingRatio=0;goog.exportProperty(b2.AreaJointDef.prototype,"dampingRatio",b2.AreaJointDef.prototype.dampingRatio);b2.AreaJointDef.prototype.AddBody=function(a){this.bodies.push(a);1===this.bodies.length?this.bodyA=a:2===this.bodies.length&&(this.bodyB=a)};
goog.exportProperty(b2.AreaJointDef.prototype,"AddBody",b2.AreaJointDef.prototype.AddBody);
b2.AreaJoint=function(a){b2.Joint.call(this,a);b2.ENABLE_ASSERTS&&b2.Assert(3<=a.bodies.length,"You cannot create an area joint with less than three bodies.");this.m_bodies=a.bodies;this.m_frequencyHz=a.frequencyHz;this.m_dampingRatio=a.dampingRatio;this.m_targetLengths=b2.MakeNumberArray(a.bodies.length);this.m_normals=b2.Vec2.MakeArray(a.bodies.length);this.m_joints=Array(a.bodies.length);this.m_deltas=b2.Vec2.MakeArray(a.bodies.length);this.m_delta=new b2.Vec2;
var b=new b2.DistanceJointDef;b.frequencyHz=a.frequencyHz;b.dampingRatio=a.dampingRatio;for(var c=this.m_targetArea=0,d=this.m_bodies.length;c<d;++c){var e=this.m_bodies[c],f=this.m_bodies[(c+1)%d],g=e.GetWorldCenter(),h=f.GetWorldCenter();this.m_targetLengths[c]=b2.Distance(g,h);this.m_targetArea+=b2.Cross_V2_V2(g,h);b.Initialize(e,f,g,h);this.m_joints[c]=a.world.CreateJoint(b)}this.m_targetArea*=.5};goog.inherits(b2.AreaJoint,b2.Joint);
goog.exportSymbol("b2.AreaJoint",b2.AreaJoint);b2.AreaJoint.prototype.m_bodies=null;goog.exportProperty(b2.AreaJoint.prototype,"m_bodies",b2.AreaJoint.prototype.m_bodies);b2.AreaJoint.prototype.m_frequencyHz=0;goog.exportProperty(b2.AreaJoint.prototype,"m_frequencyHz",b2.AreaJoint.prototype.m_frequencyHz);b2.AreaJoint.prototype.m_dampingRatio=0;goog.exportProperty(b2.AreaJoint.prototype,"m_dampingRatio",b2.AreaJoint.prototype.m_dampingRatio);
b2.AreaJoint.prototype.m_impulse=0;goog.exportProperty(b2.AreaJoint.prototype,"m_impulse",b2.AreaJoint.prototype.m_impulse);b2.AreaJoint.prototype.m_targetLengths=null;b2.AreaJoint.prototype.m_targetArea=0;b2.AreaJoint.prototype.m_normals=null;b2.AreaJoint.prototype.m_joints=null;b2.AreaJoint.prototype.m_deltas=null;b2.AreaJoint.prototype.m_delta=null;b2.AreaJoint.prototype.GetAnchorA=function(a){return a.SetZero()};
goog.exportProperty(b2.AreaJoint.prototype,"GetAnchorA",b2.AreaJoint.prototype.GetAnchorA);b2.AreaJoint.prototype.GetAnchorB=function(a){return a.SetZero()};goog.exportProperty(b2.AreaJoint.prototype,"GetAnchorB",b2.AreaJoint.prototype.GetAnchorB);b2.AreaJoint.prototype.GetReactionForce=function(a,b){return b.SetZero()};goog.exportProperty(b2.AreaJoint.prototype,"GetReactionForce",b2.AreaJoint.prototype.GetReactionForce);
b2.AreaJoint.prototype.GetReactionTorque=function(a){return 0};goog.exportProperty(b2.AreaJoint.prototype,"GetReactionTorque",b2.AreaJoint.prototype.GetReactionTorque);b2.AreaJoint.prototype.SetFrequency=function(a){this.m_frequencyHz=a;for(var b=0,c=this.m_joints.length;b<c;++b)this.m_joints[b].SetFrequency(a)};goog.exportProperty(b2.AreaJoint.prototype,"SetFrequency",b2.AreaJoint.prototype.SetFrequency);b2.AreaJoint.prototype.GetFrequency=function(){return this.m_frequencyHz};
goog.exportProperty(b2.AreaJoint.prototype,"GetFrequency",b2.AreaJoint.prototype.GetFrequency);b2.AreaJoint.prototype.SetDampingRatio=function(a){this.m_dampingRatio=a;for(var b=0,c=this.m_joints.length;b<c;++b)this.m_joints[b].SetDampingRatio(a)};goog.exportProperty(b2.AreaJoint.prototype,"SetDampingRatio",b2.AreaJoint.prototype.SetDampingRatio);b2.AreaJoint.prototype.GetDampingRatio=function(){return this.m_dampingRatio};
goog.exportProperty(b2.AreaJoint.prototype,"GetDampingRatio",b2.AreaJoint.prototype.GetDampingRatio);b2.AreaJoint.prototype.Dump=function(){b2.DEBUG&&b2.Log("Area joint dumping is not supported.\n")};goog.exportProperty(b2.AreaJoint.prototype,"Dump",b2.AreaJoint.prototype.Dump);
b2.AreaJoint.prototype.InitVelocityConstraints=function(a){for(var b=0,c=this.m_bodies.length;b<c;++b){var d=this.m_deltas[b];b2.Sub_V2_V2(a.positions[this.m_bodies[(b+1)%c].m_islandIndex].c,a.positions[this.m_bodies[(b+c-1)%c].m_islandIndex].c,d)}if(a.step.warmStarting)for(this.m_impulse*=a.step.dtRatio,b=0,c=this.m_bodies.length;b<c;++b){var e=this.m_bodies[b],f=a.velocities[e.m_islandIndex].v,d=this.m_deltas[b];f.x+=e.m_invMass*d.y*.5*this.m_impulse;f.y+=e.m_invMass*-d.x*.5*this.m_impulse}else this.m_impulse=
0};goog.exportProperty(b2.AreaJoint.prototype,"InitVelocityConstraints",b2.AreaJoint.prototype.InitVelocityConstraints);
b2.AreaJoint.prototype.SolveVelocityConstraints=function(a){for(var b=0,c=0,d=0,e=this.m_bodies.length;d<e;++d)var f=this.m_bodies[d],g=a.velocities[f.m_islandIndex].v,h=this.m_deltas[d],b=b+h.LengthSquared()/f.GetMass(),c=c+b2.Cross_V2_V2(g,h);b=-2*c/b;this.m_impulse+=b;d=0;for(e=this.m_bodies.length;d<e;++d)f=this.m_bodies[d],g=a.velocities[f.m_islandIndex].v,h=this.m_deltas[d],g.x+=f.m_invMass*h.y*.5*b,g.y+=f.m_invMass*-h.x*.5*b};
goog.exportProperty(b2.AreaJoint.prototype,"SolveVelocityConstraints",b2.AreaJoint.prototype.SolveVelocityConstraints);
b2.AreaJoint.prototype.SolvePositionConstraints=function(a){for(var b=0,c=0,d=0,e=this.m_bodies.length;d<e;++d){var f=this.m_bodies[d],f=a.positions[f.m_islandIndex].c,g=a.positions[this.m_bodies[(d+1)%e].m_islandIndex].c,h=b2.Sub_V2_V2(g,f,this.m_delta),k=h.Length();k<b2._epsilon&&(k=1);this.m_normals[d].x=h.y/k;this.m_normals[d].y=-h.x/k;b+=k;c+=b2.Cross_V2_V2(f,g)}b=.5*(this.m_targetArea-.5*c)/b;c=!0;d=0;for(e=this.m_bodies.length;d<e;++d)f=this.m_bodies[d],f=a.positions[f.m_islandIndex].c,
h=b2.Add_V2_V2(this.m_normals[d],this.m_normals[(d+1)%e],this.m_delta),h.SelfMul(b),g=h.LengthSquared(),g>b2.Sq(b2._maxLinearCorrection)&&h.SelfMul(b2._maxLinearCorrection/b2.Sqrt(g)),g>b2.Sq(b2._linearSlop)&&(c=!1),f.x+=h.x,f.y+=h.y;return c};goog.exportProperty(b2.AreaJoint.prototype,"SolvePositionConstraints",b2.AreaJoint.prototype.SolvePositionConstraints);b2.DistanceJointDef=function(){b2.JointDef.call(this,b2.JointType.e_distanceJoint);this.localAnchorA=new b2.Vec2;this.localAnchorB=new b2.Vec2};goog.inherits(b2.DistanceJointDef,b2.JointDef);goog.exportSymbol("b2.DistanceJointDef",b2.DistanceJointDef);b2.DistanceJointDef.prototype.localAnchorA=null;goog.exportProperty(b2.DistanceJointDef.prototype,"localAnchorA",b2.DistanceJointDef.prototype.localAnchorA);
b2.DistanceJointDef.prototype.localAnchorB=null;goog.exportProperty(b2.DistanceJointDef.prototype,"localAnchorB",b2.DistanceJointDef.prototype.localAnchorB);b2.DistanceJointDef.prototype.length=1;goog.exportProperty(b2.DistanceJointDef.prototype,"length",b2.DistanceJointDef.prototype.length);b2.DistanceJointDef.prototype.frequencyHz=0;goog.exportProperty(b2.DistanceJointDef.prototype,"frequencyHz",b2.DistanceJointDef.prototype.frequencyHz);
b2.DistanceJointDef.prototype.dampingRatio=0;goog.exportProperty(b2.DistanceJointDef.prototype,"dampingRatio",b2.DistanceJointDef.prototype.dampingRatio);b2.DistanceJointDef.prototype.Initialize=function(a,b,c,d){this.bodyA=a;this.bodyB=b;this.bodyA.GetLocalPoint(c,this.localAnchorA);this.bodyB.GetLocalPoint(d,this.localAnchorB);this.length=b2.Distance(c,d);this.dampingRatio=this.frequencyHz=0};goog.exportProperty(b2.DistanceJointDef.prototype,"Initialize",b2.DistanceJointDef.prototype.Initialize);
b2.DistanceJoint=function(a){b2.Joint.call(this,a);this.m_u=new b2.Vec2;this.m_rA=new b2.Vec2;this.m_rB=new b2.Vec2;this.m_localCenterA=new b2.Vec2;this.m_localCenterB=new b2.Vec2;this.m_qA=new b2.Rot;this.m_qB=new b2.Rot;this.m_lalcA=new b2.Vec2;this.m_lalcB=new b2.Vec2;this.m_frequencyHz=a.frequencyHz;this.m_dampingRatio=a.dampingRatio;this.m_localAnchorA=a.localAnchorA.Clone();this.m_localAnchorB=a.localAnchorB.Clone();this.m_length=a.length};
goog.inherits(b2.DistanceJoint,b2.Joint);goog.exportSymbol("b2.DistanceJoint",b2.DistanceJoint);b2.DistanceJoint.prototype.m_frequencyHz=0;goog.exportProperty(b2.DistanceJoint.prototype,"m_frequencyHz",b2.DistanceJoint.prototype.m_frequencyHz);b2.DistanceJoint.prototype.m_dampingRatio=0;goog.exportProperty(b2.DistanceJoint.prototype,"m_dampingRatio",b2.DistanceJoint.prototype.m_dampingRatio);b2.DistanceJoint.prototype.m_bias=0;
goog.exportProperty(b2.DistanceJoint.prototype,"m_bias",b2.DistanceJoint.prototype.m_bias);b2.DistanceJoint.prototype.m_localAnchorA=null;goog.exportProperty(b2.DistanceJoint.prototype,"m_localAnchorA",b2.DistanceJoint.prototype.m_localAnchorA);b2.DistanceJoint.prototype.m_localAnchorB=null;goog.exportProperty(b2.DistanceJoint.prototype,"m_localAnchorB",b2.DistanceJoint.prototype.m_localAnchorB);b2.DistanceJoint.prototype.m_gamma=0;
goog.exportProperty(b2.DistanceJoint.prototype,"m_gamma",b2.DistanceJoint.prototype.m_gamma);b2.DistanceJoint.prototype.m_impulse=0;goog.exportProperty(b2.DistanceJoint.prototype,"m_impulse",b2.DistanceJoint.prototype.m_impulse);b2.DistanceJoint.prototype.m_length=0;goog.exportProperty(b2.DistanceJoint.prototype,"m_length",b2.DistanceJoint.prototype.m_length);b2.DistanceJoint.prototype.m_indexA=0;
goog.exportProperty(b2.DistanceJoint.prototype,"m_indexA",b2.DistanceJoint.prototype.m_indexA);b2.DistanceJoint.prototype.m_indexB=0;goog.exportProperty(b2.DistanceJoint.prototype,"m_indexB",b2.DistanceJoint.prototype.m_indexB);b2.DistanceJoint.prototype.m_u=null;goog.exportProperty(b2.DistanceJoint.prototype,"m_u",b2.DistanceJoint.prototype.m_u);b2.DistanceJoint.prototype.m_rA=null;goog.exportProperty(b2.DistanceJoint.prototype,"m_rA",b2.DistanceJoint.prototype.m_rA);
b2.DistanceJoint.prototype.m_rB=null;goog.exportProperty(b2.DistanceJoint.prototype,"m_rB",b2.DistanceJoint.prototype.m_rB);b2.DistanceJoint.prototype.m_localCenterA=null;goog.exportProperty(b2.DistanceJoint.prototype,"m_localCenterA",b2.DistanceJoint.prototype.m_localCenterA);b2.DistanceJoint.prototype.m_localCenterB=null;goog.exportProperty(b2.DistanceJoint.prototype,"m_localCenterB",b2.DistanceJoint.prototype.m_localCenterB);
b2.DistanceJoint.prototype.m_invMassA=0;goog.exportProperty(b2.DistanceJoint.prototype,"m_invMassA",b2.DistanceJoint.prototype.m_invMassA);b2.DistanceJoint.prototype.m_invMassB=0;goog.exportProperty(b2.DistanceJoint.prototype,"m_invMassB",b2.DistanceJoint.prototype.m_invMassB);b2.DistanceJoint.prototype.m_invIA=0;goog.exportProperty(b2.DistanceJoint.prototype,"m_invIA",b2.DistanceJoint.prototype.m_invIA);b2.DistanceJoint.prototype.m_invIB=0;
goog.exportProperty(b2.DistanceJoint.prototype,"m_invIB",b2.DistanceJoint.prototype.m_invIB);b2.DistanceJoint.prototype.m_mass=0;goog.exportProperty(b2.DistanceJoint.prototype,"m_mass",b2.DistanceJoint.prototype.m_mass);b2.DistanceJoint.prototype.m_qA=null;goog.exportProperty(b2.DistanceJoint.prototype,"m_qA",b2.DistanceJoint.prototype.m_qA);b2.DistanceJoint.prototype.m_qB=null;goog.exportProperty(b2.DistanceJoint.prototype,"m_qB",b2.DistanceJoint.prototype.m_qB);
b2.DistanceJoint.prototype.m_lalcA=null;goog.exportProperty(b2.DistanceJoint.prototype,"m_lalcA",b2.DistanceJoint.prototype.m_lalcA);b2.DistanceJoint.prototype.m_lalcB=null;goog.exportProperty(b2.DistanceJoint.prototype,"m_lalcB",b2.DistanceJoint.prototype.m_lalcB);b2.DistanceJoint.prototype.GetAnchorA=function(a){return this.m_bodyA.GetWorldPoint(this.m_localAnchorA,a)};goog.exportProperty(b2.DistanceJoint.prototype,"GetAnchorA",b2.DistanceJoint.prototype.GetAnchorA);
b2.DistanceJoint.prototype.GetAnchorB=function(a){return this.m_bodyB.GetWorldPoint(this.m_localAnchorB,a)};goog.exportProperty(b2.DistanceJoint.prototype,"GetAnchorB",b2.DistanceJoint.prototype.GetAnchorB);b2.DistanceJoint.prototype.GetReactionForce=function(a,b){return b.Set(a*this.m_impulse*this.m_u.x,a*this.m_impulse*this.m_u.y)};goog.exportProperty(b2.DistanceJoint.prototype,"GetReactionForce",b2.DistanceJoint.prototype.GetReactionForce);
b2.DistanceJoint.prototype.GetReactionTorque=function(a){return 0};goog.exportProperty(b2.DistanceJoint.prototype,"GetReactionTorque",b2.DistanceJoint.prototype.GetReactionTorque);b2.DistanceJoint.prototype.GetLocalAnchorA=function(a){return a.Copy(this.m_localAnchorA)};goog.exportProperty(b2.DistanceJoint.prototype,"GetLocalAnchorA",b2.DistanceJoint.prototype.GetLocalAnchorA);b2.DistanceJoint.prototype.GetLocalAnchorB=function(a){return a.Copy(this.m_localAnchorB)};
goog.exportProperty(b2.DistanceJoint.prototype,"GetLocalAnchorB",b2.DistanceJoint.prototype.GetLocalAnchorB);b2.DistanceJoint.prototype.SetLength=function(a){this.m_length=a};goog.exportProperty(b2.DistanceJoint.prototype,"SetLength",b2.DistanceJoint.prototype.SetLength);b2.DistanceJoint.prototype.GetLength=function(){return this.m_length};goog.exportProperty(b2.DistanceJoint.prototype,"GetLength",b2.DistanceJoint.prototype.GetLength);
b2.DistanceJoint.prototype.SetFrequency=function(a){this.m_frequencyHz=a};goog.exportProperty(b2.DistanceJoint.prototype,"SetFrequency",b2.DistanceJoint.prototype.SetFrequency);b2.DistanceJoint.prototype.GetFrequency=function(){return this.m_frequencyHz};goog.exportProperty(b2.DistanceJoint.prototype,"GetFrequency",b2.DistanceJoint.prototype.GetFrequency);b2.DistanceJoint.prototype.SetDampingRatio=function(a){this.m_dampingRatio=a};
goog.exportProperty(b2.DistanceJoint.prototype,"SetDampingRatio",b2.DistanceJoint.prototype.SetDampingRatio);b2.DistanceJoint.prototype.GetDampingRatio=function(){return this.m_dampingRatio};goog.exportProperty(b2.DistanceJoint.prototype,"GetDampingRatio",b2.DistanceJoint.prototype.GetDampingRatio);
b2.DistanceJoint.prototype.Dump=function(){if(b2.DEBUG){var a=this.m_bodyA.m_islandIndex,b=this.m_bodyB.m_islandIndex;b2.Log("  /*b2.DistanceJointDef*/ var jd = new b2.DistanceJointDef();\n");b2.Log("  jd.bodyA = bodies[%d];\n",a);b2.Log("  jd.bodyB = bodies[%d];\n",b);b2.Log("  jd.collideConnected = %s;\n",this.m_collideConnected?"true":"false");b2.Log("  jd.localAnchorA.Set(%.15f, %.15f);\n",this.m_localAnchorA.x,this.m_localAnchorA.y);b2.Log("  jd.localAnchorB.Set(%.15f, %.15f);\n",
this.m_localAnchorB.x,this.m_localAnchorB.y);b2.Log("  jd.length = %.15f;\n",this.m_length);b2.Log("  jd.frequencyHz = %.15f;\n",this.m_frequencyHz);b2.Log("  jd.dampingRatio = %.15f;\n",this.m_dampingRatio);b2.Log("  joints[%d] = this.m_world.CreateJoint(jd);\n",this.m_index)}};goog.exportProperty(b2.DistanceJoint.prototype,"Dump",b2.DistanceJoint.prototype.Dump);
b2.DistanceJoint.prototype.InitVelocityConstraints=function(a){this.m_indexA=this.m_bodyA.m_islandIndex;this.m_indexB=this.m_bodyB.m_islandIndex;this.m_localCenterA.Copy(this.m_bodyA.m_sweep.localCenter);this.m_localCenterB.Copy(this.m_bodyB.m_sweep.localCenter);this.m_invMassA=this.m_bodyA.m_invMass;this.m_invMassB=this.m_bodyB.m_invMass;this.m_invIA=this.m_bodyA.m_invI;this.m_invIB=this.m_bodyB.m_invI;var b=a.positions[this.m_indexA].c,c=a.velocities[this.m_indexA].v,d=a.velocities[this.m_indexA].w,
e=a.positions[this.m_indexB].c,f=a.positions[this.m_indexB].a,g=a.velocities[this.m_indexB].v,h=a.velocities[this.m_indexB].w,k=this.m_qA.SetAngle(a.positions[this.m_indexA].a),f=this.m_qB.SetAngle(f);b2.Sub_V2_V2(this.m_localAnchorA,this.m_localCenterA,this.m_lalcA);b2.Mul_R_V2(k,this.m_lalcA,this.m_rA);b2.Sub_V2_V2(this.m_localAnchorB,this.m_localCenterB,this.m_lalcB);b2.Mul_R_V2(f,this.m_lalcB,this.m_rB);this.m_u.x=e.x+this.m_rB.x-b.x-this.m_rA.x;this.m_u.y=e.y+this.m_rB.y-
b.y-this.m_rA.y;e=this.m_u.Length();e>b2._linearSlop?this.m_u.SelfMul(1/e):this.m_u.SetZero();b=b2.Cross_V2_V2(this.m_rA,this.m_u);k=b2.Cross_V2_V2(this.m_rB,this.m_u);b=this.m_invMassA+this.m_invIA*b*b+this.m_invMassB+this.m_invIB*k*k;this.m_mass=0!==b?1/b:0;if(0<this.m_frequencyHz){var e=e-this.m_length,k=2*b2._pi*this.m_frequencyHz,f=this.m_mass*k*k,l=a.step.dt;this.m_gamma=l*(2*this.m_mass*this.m_dampingRatio*k+l*f);this.m_gamma=0!==this.m_gamma?1/this.m_gamma:0;this.m_bias=
e*l*f*this.m_gamma;b+=this.m_gamma;this.m_mass=0!==b?1/b:0}else this.m_bias=this.m_gamma=0;a.step.warmStarting?(this.m_impulse*=a.step.dtRatio,b=b2.Mul_S_V2(this.m_impulse,this.m_u,b2.DistanceJoint.prototype.InitVelocityConstraints.s_P),c.SelfMulSub(this.m_invMassA,b),d-=this.m_invIA*b2.Cross_V2_V2(this.m_rA,b),g.SelfMulAdd(this.m_invMassB,b),h+=this.m_invIB*b2.Cross_V2_V2(this.m_rB,b)):this.m_impulse=0;a.velocities[this.m_indexA].w=d;a.velocities[this.m_indexB].w=h};
goog.exportProperty(b2.DistanceJoint.prototype,"InitVelocityConstraints",b2.DistanceJoint.prototype.InitVelocityConstraints);b2.DistanceJoint.prototype.InitVelocityConstraints.s_P=new b2.Vec2;
b2.DistanceJoint.prototype.SolveVelocityConstraints=function(a){var b=a.velocities[this.m_indexA].v,c=a.velocities[this.m_indexA].w,d=a.velocities[this.m_indexB].v,e=a.velocities[this.m_indexB].w,f=b2.AddCross_V2_S_V2(b,c,this.m_rA,b2.DistanceJoint.prototype.SolveVelocityConstraints.s_vpA),g=b2.AddCross_V2_S_V2(d,e,this.m_rB,b2.DistanceJoint.prototype.SolveVelocityConstraints.s_vpB),f=b2.Dot_V2_V2(this.m_u,b2.Sub_V2_V2(g,f,b2.Vec2.s_t0)),f=-this.m_mass*(f+this.m_bias+
this.m_gamma*this.m_impulse);this.m_impulse+=f;f=b2.Mul_S_V2(f,this.m_u,b2.DistanceJoint.prototype.SolveVelocityConstraints.s_P);b.SelfMulSub(this.m_invMassA,f);c-=this.m_invIA*b2.Cross_V2_V2(this.m_rA,f);d.SelfMulAdd(this.m_invMassB,f);e+=this.m_invIB*b2.Cross_V2_V2(this.m_rB,f);a.velocities[this.m_indexA].w=c;a.velocities[this.m_indexB].w=e};goog.exportProperty(b2.DistanceJoint.prototype,"SolveVelocityConstraints",b2.DistanceJoint.prototype.SolveVelocityConstraints);
b2.DistanceJoint.prototype.SolveVelocityConstraints.s_vpA=new b2.Vec2;b2.DistanceJoint.prototype.SolveVelocityConstraints.s_vpB=new b2.Vec2;b2.DistanceJoint.prototype.SolveVelocityConstraints.s_P=new b2.Vec2;
b2.DistanceJoint.prototype.SolvePositionConstraints=function(a){if(0<this.m_frequencyHz)return!0;var b=a.positions[this.m_indexA].c,c=a.positions[this.m_indexA].a,d=a.positions[this.m_indexB].c,e=a.positions[this.m_indexB].a;this.m_qA.SetAngle(c);this.m_qB.SetAngle(e);var f=b2.Mul_R_V2(this.m_qA,this.m_lalcA,this.m_rA),g=b2.Mul_R_V2(this.m_qB,this.m_lalcB,this.m_rB),h=this.m_u;h.x=d.x+g.x-b.x-f.x;h.y=d.y+g.y-b.y-f.y;var k=this.m_u.Normalize()-this.m_length,k=b2.Clamp(k,-b2._maxLinearCorrection,
b2._maxLinearCorrection),h=b2.Mul_S_V2(-this.m_mass*k,h,b2.DistanceJoint.prototype.SolvePositionConstraints.s_P);b.SelfMulSub(this.m_invMassA,h);c-=this.m_invIA*b2.Cross_V2_V2(f,h);d.SelfMulAdd(this.m_invMassB,h);e+=this.m_invIB*b2.Cross_V2_V2(g,h);a.positions[this.m_indexA].a=c;a.positions[this.m_indexB].a=e;return b2.Abs(k)<b2._linearSlop};goog.exportProperty(b2.DistanceJoint.prototype,"SolvePositionConstraints",b2.DistanceJoint.prototype.SolvePositionConstraints);
b2.DistanceJoint.prototype.SolvePositionConstraints.s_P=new b2.Vec2;b2.FrictionJointDef=function(){b2.JointDef.call(this,b2.JointType.e_frictionJoint);this.localAnchorA=new b2.Vec2;this.localAnchorB=new b2.Vec2};goog.inherits(b2.FrictionJointDef,b2.JointDef);goog.exportSymbol("b2.FrictionJointDef",b2.FrictionJointDef);b2.FrictionJointDef.prototype.localAnchorA=null;goog.exportProperty(b2.FrictionJointDef.prototype,"localAnchorA",b2.FrictionJointDef.prototype.localAnchorA);
b2.FrictionJointDef.prototype.localAnchorB=null;goog.exportProperty(b2.FrictionJointDef.prototype,"localAnchorB",b2.FrictionJointDef.prototype.localAnchorB);b2.FrictionJointDef.prototype.maxForce=0;goog.exportProperty(b2.FrictionJointDef.prototype,"maxForce",b2.FrictionJointDef.prototype.maxForce);b2.FrictionJointDef.prototype.maxTorque=0;goog.exportProperty(b2.FrictionJointDef.prototype,"maxTorque",b2.FrictionJointDef.prototype.maxTorque);
b2.FrictionJointDef.prototype.Initialize=function(a,b,c){this.bodyA=a;this.bodyB=b;this.bodyA.GetLocalPoint(c,this.localAnchorA);this.bodyB.GetLocalPoint(c,this.localAnchorB)};goog.exportProperty(b2.FrictionJointDef.prototype,"Initialize",b2.FrictionJointDef.prototype.Initialize);
b2.FrictionJoint=function(a){b2.Joint.call(this,a);this.m_localAnchorA=a.localAnchorA.Clone();this.m_localAnchorB=a.localAnchorB.Clone();this.m_linearImpulse=(new b2.Vec2).SetZero();this.m_maxForce=a.maxForce;this.m_maxTorque=a.maxTorque;this.m_rA=new b2.Vec2;this.m_rB=new b2.Vec2;this.m_localCenterA=new b2.Vec2;this.m_localCenterB=new b2.Vec2;this.m_linearMass=(new b2.Mat22).SetZero();this.m_qA=new b2.Rot;this.m_qB=new b2.Rot;this.m_lalcA=new b2.Vec2;
this.m_lalcB=new b2.Vec2;this.m_K=new b2.Mat22};goog.inherits(b2.FrictionJoint,b2.Joint);goog.exportSymbol("b2.FrictionJoint",b2.FrictionJoint);b2.FrictionJoint.prototype.m_localAnchorA=null;goog.exportProperty(b2.FrictionJoint.prototype,"m_localAnchorA",b2.FrictionJoint.prototype.m_localAnchorA);b2.FrictionJoint.prototype.m_localAnchorB=null;goog.exportProperty(b2.FrictionJoint.prototype,"m_localAnchorB",b2.FrictionJoint.prototype.m_localAnchorB);
b2.FrictionJoint.prototype.m_linearImpulse=null;goog.exportProperty(b2.FrictionJoint.prototype,"m_linearImpulse",b2.FrictionJoint.prototype.m_linearImpulse);b2.FrictionJoint.prototype.m_angularImpulse=0;goog.exportProperty(b2.FrictionJoint.prototype,"m_angularImpulse",b2.FrictionJoint.prototype.m_angularImpulse);b2.FrictionJoint.prototype.m_maxForce=0;goog.exportProperty(b2.FrictionJoint.prototype,"m_maxForce",b2.FrictionJoint.prototype.m_maxForce);
b2.FrictionJoint.prototype.m_maxTorque=0;goog.exportProperty(b2.FrictionJoint.prototype,"m_maxTorque",b2.FrictionJoint.prototype.m_maxTorque);b2.FrictionJoint.prototype.m_indexA=0;goog.exportProperty(b2.FrictionJoint.prototype,"m_indexA",b2.FrictionJoint.prototype.m_indexA);b2.FrictionJoint.prototype.m_indexB=0;goog.exportProperty(b2.FrictionJoint.prototype,"m_indexB",b2.FrictionJoint.prototype.m_indexB);b2.FrictionJoint.prototype.m_rA=null;
goog.exportProperty(b2.FrictionJoint.prototype,"m_rA",b2.FrictionJoint.prototype.m_rA);b2.FrictionJoint.prototype.m_rB=null;goog.exportProperty(b2.FrictionJoint.prototype,"m_rB",b2.FrictionJoint.prototype.m_rB);b2.FrictionJoint.prototype.m_localCenterA=null;goog.exportProperty(b2.FrictionJoint.prototype,"m_localCenterA",b2.FrictionJoint.prototype.m_localCenterA);b2.FrictionJoint.prototype.m_localCenterB=null;
goog.exportProperty(b2.FrictionJoint.prototype,"m_localCenterB",b2.FrictionJoint.prototype.m_localCenterB);b2.FrictionJoint.prototype.m_invMassA=0;goog.exportProperty(b2.FrictionJoint.prototype,"m_invMassA",b2.FrictionJoint.prototype.m_invMassA);b2.FrictionJoint.prototype.m_invMassB=0;goog.exportProperty(b2.FrictionJoint.prototype,"m_invMassB",b2.FrictionJoint.prototype.m_invMassB);b2.FrictionJoint.prototype.m_invIA=0;
goog.exportProperty(b2.FrictionJoint.prototype,"m_invIA",b2.FrictionJoint.prototype.m_invIA);b2.FrictionJoint.prototype.m_invIB=0;goog.exportProperty(b2.FrictionJoint.prototype,"m_invIB",b2.FrictionJoint.prototype.m_invIB);b2.FrictionJoint.prototype.m_linearMass=null;goog.exportProperty(b2.FrictionJoint.prototype,"m_linearMass",b2.FrictionJoint.prototype.m_linearMass);b2.FrictionJoint.prototype.m_angularMass=0;
goog.exportProperty(b2.FrictionJoint.prototype,"m_angularMass",b2.FrictionJoint.prototype.m_angularMass);b2.FrictionJoint.prototype.m_qA=null;goog.exportProperty(b2.FrictionJoint.prototype,"m_qA",b2.FrictionJoint.prototype.m_qA);b2.FrictionJoint.prototype.m_qB=null;goog.exportProperty(b2.FrictionJoint.prototype,"m_qB",b2.FrictionJoint.prototype.m_qB);b2.FrictionJoint.prototype.m_lalcA=null;goog.exportProperty(b2.FrictionJoint.prototype,"m_lalcA",b2.FrictionJoint.prototype.m_lalcA);
b2.FrictionJoint.prototype.m_lalcB=null;goog.exportProperty(b2.FrictionJoint.prototype,"m_lalcB",b2.FrictionJoint.prototype.m_lalcB);b2.FrictionJoint.prototype.m_K=null;goog.exportProperty(b2.FrictionJoint.prototype,"m_K",b2.FrictionJoint.prototype.m_K);
b2.FrictionJoint.prototype.InitVelocityConstraints=function(a){this.m_indexA=this.m_bodyA.m_islandIndex;this.m_indexB=this.m_bodyB.m_islandIndex;this.m_localCenterA.Copy(this.m_bodyA.m_sweep.localCenter);this.m_localCenterB.Copy(this.m_bodyB.m_sweep.localCenter);this.m_invMassA=this.m_bodyA.m_invMass;this.m_invMassB=this.m_bodyB.m_invMass;this.m_invIA=this.m_bodyA.m_invI;this.m_invIB=this.m_bodyB.m_invI;var b=a.velocities[this.m_indexA].v,c=a.velocities[this.m_indexA].w,d=a.positions[this.m_indexB].a,
e=a.velocities[this.m_indexB].v,f=a.velocities[this.m_indexB].w,g=this.m_qA.SetAngle(a.positions[this.m_indexA].a),d=this.m_qB.SetAngle(d);b2.Sub_V2_V2(this.m_localAnchorA,this.m_localCenterA,this.m_lalcA);g=b2.Mul_R_V2(g,this.m_lalcA,this.m_rA);b2.Sub_V2_V2(this.m_localAnchorB,this.m_localCenterB,this.m_lalcB);var h=b2.Mul_R_V2(d,this.m_lalcB,this.m_rB),d=this.m_invMassA,k=this.m_invMassB,l=this.m_invIA,m=this.m_invIB,n=this.m_K;n.ex.x=d+k+l*g.y*g.y+m*h.y*h.y;n.ex.y=-l*g.x*g.y-
m*h.x*h.y;n.ey.x=n.ex.y;n.ey.y=d+k+l*g.x*g.x+m*h.x*h.x;n.GetInverse(this.m_linearMass);this.m_angularMass=l+m;0<this.m_angularMass&&(this.m_angularMass=1/this.m_angularMass);a.step.warmStarting?(this.m_linearImpulse.SelfMul(a.step.dtRatio),this.m_angularImpulse*=a.step.dtRatio,g=this.m_linearImpulse,b.SelfMulSub(d,g),c-=l*(b2.Cross_V2_V2(this.m_rA,g)+this.m_angularImpulse),e.SelfMulAdd(k,g),f+=m*(b2.Cross_V2_V2(this.m_rB,g)+this.m_angularImpulse)):(this.m_linearImpulse.SetZero(),this.m_angularImpulse=
0);a.velocities[this.m_indexA].w=c;a.velocities[this.m_indexB].w=f};goog.exportProperty(b2.FrictionJoint.prototype,"InitVelocityConstraints",b2.FrictionJoint.prototype.InitVelocityConstraints);
b2.FrictionJoint.prototype.SolveVelocityConstraints=function(a){var b=a.velocities[this.m_indexA].v,c=a.velocities[this.m_indexA].w,d=a.velocities[this.m_indexB].v,e=a.velocities[this.m_indexB].w,f=this.m_invMassA,g=this.m_invMassB,h=this.m_invIA,k=this.m_invIB,l=a.step.dt,m,n=-this.m_angularMass*(e-c),p=this.m_angularImpulse;m=l*this.m_maxTorque;this.m_angularImpulse=b2.Clamp(this.m_angularImpulse+n,-m,m);n=this.m_angularImpulse-p;c-=h*n;e+=k*n;m=b2.Sub_V2_V2(b2.AddCross_V2_S_V2(d,
e,this.m_rB,b2.Vec2.s_t0),b2.AddCross_V2_S_V2(b,c,this.m_rA,b2.Vec2.s_t1),b2.FrictionJoint.prototype.SolveVelocityConstraints.s_Cdot);n=b2.Mul_M22_V2(this.m_linearMass,m,b2.FrictionJoint.prototype.SolveVelocityConstraints.s_impulseV).SelfNeg();p=b2.FrictionJoint.prototype.SolveVelocityConstraints.s_oldImpulseV.Copy(this.m_linearImpulse);this.m_linearImpulse.SelfAdd(n);m=l*this.m_maxForce;this.m_linearImpulse.LengthSquared()>m*m&&(this.m_linearImpulse.Normalize(),
this.m_linearImpulse.SelfMul(m));b2.Sub_V2_V2(this.m_linearImpulse,p,n);b.SelfMulSub(f,n);c-=h*b2.Cross_V2_V2(this.m_rA,n);d.SelfMulAdd(g,n);e+=k*b2.Cross_V2_V2(this.m_rB,n);a.velocities[this.m_indexA].w=c;a.velocities[this.m_indexB].w=e};goog.exportProperty(b2.FrictionJoint.prototype,"SolveVelocityConstraints",b2.FrictionJoint.prototype.SolveVelocityConstraints);b2.FrictionJoint.prototype.SolveVelocityConstraints.s_Cdot=new b2.Vec2;
b2.FrictionJoint.prototype.SolveVelocityConstraints.s_impulseV=new b2.Vec2;b2.FrictionJoint.prototype.SolveVelocityConstraints.s_oldImpulseV=new b2.Vec2;b2.FrictionJoint.prototype.SolvePositionConstraints=function(a){return!0};goog.exportProperty(b2.FrictionJoint.prototype,"SolvePositionConstraints",b2.FrictionJoint.prototype.SolvePositionConstraints);b2.FrictionJoint.prototype.GetAnchorA=function(a){return this.m_bodyA.GetWorldPoint(this.m_localAnchorA,a)};
goog.exportProperty(b2.FrictionJoint.prototype,"GetAnchorA",b2.FrictionJoint.prototype.GetAnchorA);b2.FrictionJoint.prototype.GetAnchorB=function(a){return this.m_bodyB.GetWorldPoint(this.m_localAnchorB,a)};goog.exportProperty(b2.FrictionJoint.prototype,"GetAnchorB",b2.FrictionJoint.prototype.GetAnchorB);b2.FrictionJoint.prototype.GetReactionForce=function(a,b){return b.Set(a*this.m_linearImpulse.x,a*this.m_linearImpulse.y)};
goog.exportProperty(b2.FrictionJoint.prototype,"GetReactionForce",b2.FrictionJoint.prototype.GetReactionForce);b2.FrictionJoint.prototype.GetReactionTorque=function(a){return a*this.m_angularImpulse};goog.exportProperty(b2.FrictionJoint.prototype,"GetReactionTorque",b2.FrictionJoint.prototype.GetReactionTorque);b2.FrictionJoint.prototype.GetLocalAnchorA=function(a){return a.Copy(this.m_localAnchorA)};
goog.exportProperty(b2.FrictionJoint.prototype,"GetLocalAnchorA",b2.FrictionJoint.prototype.GetLocalAnchorA);b2.FrictionJoint.prototype.GetLocalAnchorB=function(a){return a.Copy(this.m_localAnchorB)};goog.exportProperty(b2.FrictionJoint.prototype,"GetLocalAnchorB",b2.FrictionJoint.prototype.GetLocalAnchorB);b2.FrictionJoint.prototype.SetMaxForce=function(a){this.m_maxForce=a};goog.exportProperty(b2.FrictionJoint.prototype,"SetMaxForce",b2.FrictionJoint.prototype.SetMaxForce);
b2.FrictionJoint.prototype.GetMaxForce=function(){return this.m_maxForce};goog.exportProperty(b2.FrictionJoint.prototype,"GetMaxForce",b2.FrictionJoint.prototype.GetMaxForce);b2.FrictionJoint.prototype.SetMaxTorque=function(a){this.m_maxTorque=a};goog.exportProperty(b2.FrictionJoint.prototype,"SetMaxTorque",b2.FrictionJoint.prototype.SetMaxTorque);b2.FrictionJoint.prototype.GetMaxTorque=function(){return this.m_maxTorque};
goog.exportProperty(b2.FrictionJoint.prototype,"GetMaxTorque",b2.FrictionJoint.prototype.GetMaxTorque);
b2.FrictionJoint.prototype.Dump=function(){if(b2.DEBUG){var a=this.m_bodyA.m_islandIndex,b=this.m_bodyB.m_islandIndex;b2.Log("  /*b2.FrictionJointDef*/ var jd = new b2.FrictionJointDef();\n");b2.Log("  jd.bodyA = bodies[%d];\n",a);b2.Log("  jd.bodyB = bodies[%d];\n",b);b2.Log("  jd.collideConnected = %s;\n",this.m_collideConnected?"true":"false");b2.Log("  jd.localAnchorA.Set(%.15f, %.15f);\n",this.m_localAnchorA.x,this.m_localAnchorA.y);b2.Log("  jd.localAnchorB.Set(%.15f, %.15f);\n",
this.m_localAnchorB.x,this.m_localAnchorB.y);b2.Log("  jd.maxForce = %.15f;\n",this.m_maxForce);b2.Log("  jd.maxTorque = %.15f;\n",this.m_maxTorque);b2.Log("  joints[%d] = this.m_world.CreateJoint(jd);\n",this.m_index)}};goog.exportProperty(b2.FrictionJoint.prototype,"Dump",b2.FrictionJoint.prototype.Dump);b2.JointFactory={};
b2.JointFactory.Create=function(a,b){var c=null;switch(a.type){case b2.JointType.e_distanceJoint:c=new b2.DistanceJoint(a instanceof b2.DistanceJointDef?a:null);break;case b2.JointType.e_mouseJoint:c=new b2.MouseJoint(a instanceof b2.MouseJointDef?a:null);break;case b2.JointType.e_prismaticJoint:c=new b2.PrismaticJoint(a instanceof b2.PrismaticJointDef?a:null);break;case b2.JointType.e_revoluteJoint:c=new b2.RevoluteJoint(a instanceof b2.RevoluteJointDef?
a:null);break;case b2.JointType.e_pulleyJoint:c=new b2.PulleyJoint(a instanceof b2.PulleyJointDef?a:null);break;case b2.JointType.e_gearJoint:c=new b2.GearJoint(a instanceof b2.GearJointDef?a:null);break;case b2.JointType.e_wheelJoint:c=new b2.WheelJoint(a instanceof b2.WheelJointDef?a:null);break;case b2.JointType.e_weldJoint:c=new b2.WeldJoint(a instanceof b2.WeldJointDef?a:null);break;case b2.JointType.e_frictionJoint:c=new b2.FrictionJoint(a instanceof
b2.FrictionJointDef?a:null);break;case b2.JointType.e_ropeJoint:c=new b2.RopeJoint(a instanceof b2.RopeJointDef?a:null);break;case b2.JointType.e_motorJoint:c=new b2.MotorJoint(a instanceof b2.MotorJointDef?a:null);break;case b2.JointType.e_areaJoint:c=new b2.AreaJoint(a instanceof b2.AreaJointDef?a:null);break;default:b2.ENABLE_ASSERTS&&b2.Assert(!1)}return c};goog.exportSymbol("b2.JointFactory.Create",b2.JointFactory.Create);
b2.JointFactory.Destroy=function(a,b){};goog.exportSymbol("b2.JointFactory.Destroy",b2.JointFactory.Destroy);b2.World=function(a){this.m_flag_clearForces=!0;this.m_contactManager=new b2.ContactManager;this.m_gravity=a.Clone();this.m_out_gravity=new b2.Vec2;this.m_allowSleep=!0;this.m_debugDraw=this.m_destructionListener=null;this.m_continuousPhysics=this.m_warmStarting=!0;this.m_subStepping=!1;this.m_stepComplete=!0;this.m_profile=new b2.Profile;this.m_island=new b2.Island;this.s_stack=[]};goog.exportSymbol("b2.World",b2.World);
b2.World.prototype.m_flag_newFixture=!1;goog.exportProperty(b2.World.prototype,"m_flag_newFixture",b2.World.prototype.m_flag_newFixture);b2.World.prototype.m_flag_locked=!1;goog.exportProperty(b2.World.prototype,"m_flag_locked",b2.World.prototype.m_flag_locked);b2.World.prototype.m_flag_clearForces=!1;goog.exportProperty(b2.World.prototype,"m_flag_clearForces",b2.World.prototype.m_flag_clearForces);b2.World.prototype.m_contactManager=null;
goog.exportProperty(b2.World.prototype,"m_contactManager",b2.World.prototype.m_contactManager);b2.World.prototype.m_bodyList=null;goog.exportProperty(b2.World.prototype,"m_bodyList",b2.World.prototype.m_bodyList);b2.World.prototype.m_jointList=null;goog.exportProperty(b2.World.prototype,"m_jointList",b2.World.prototype.m_jointList);b2.World.prototype.m_particleSystemList=null;goog.exportProperty(b2.World.prototype,"m_particleSystemList",b2.World.prototype.m_particleSystemList);
b2.World.prototype.m_bodyCount=0;goog.exportProperty(b2.World.prototype,"m_bodyCount",b2.World.prototype.m_bodyCount);b2.World.prototype.m_jointCount=0;goog.exportProperty(b2.World.prototype,"m_jointCount",b2.World.prototype.m_jointCount);b2.World.prototype.m_gravity=null;goog.exportProperty(b2.World.prototype,"m_gravity",b2.World.prototype.m_gravity);b2.World.prototype.m_out_gravity=null;
goog.exportProperty(b2.World.prototype,"m_out_gravity",b2.World.prototype.m_out_gravity);b2.World.prototype.m_allowSleep=!0;goog.exportProperty(b2.World.prototype,"m_allowSleep",b2.World.prototype.m_allowSleep);b2.World.prototype.m_destructionListener=null;goog.exportProperty(b2.World.prototype,"m_destructionListener",b2.World.prototype.m_destructionListener);b2.World.prototype.m_debugDraw=null;
goog.exportProperty(b2.World.prototype,"m_debugDraw",b2.World.prototype.m_debugDraw);b2.World.prototype.m_inv_dt0=0;goog.exportProperty(b2.World.prototype,"m_inv_dt0",b2.World.prototype.m_inv_dt0);b2.World.prototype.m_warmStarting=!0;goog.exportProperty(b2.World.prototype,"m_warmStarting",b2.World.prototype.m_warmStarting);b2.World.prototype.m_continuousPhysics=!0;goog.exportProperty(b2.World.prototype,"m_continuousPhysics",b2.World.prototype.m_continuousPhysics);
b2.World.prototype.m_subStepping=!1;goog.exportProperty(b2.World.prototype,"m_subStepping",b2.World.prototype.m_subStepping);b2.World.prototype.m_stepComplete=!0;goog.exportProperty(b2.World.prototype,"m_stepComplete",b2.World.prototype.m_stepComplete);b2.World.prototype.m_profile=null;goog.exportProperty(b2.World.prototype,"m_profile",b2.World.prototype.m_profile);b2.World.prototype.m_island=null;
goog.exportProperty(b2.World.prototype,"m_island",b2.World.prototype.m_island);b2.World.prototype.s_stack=null;goog.exportProperty(b2.World.prototype,"s_stack",b2.World.prototype.s_stack);b2.World.prototype.m_controllerList=null;goog.exportProperty(b2.World.prototype,"m_controllerList",b2.World.prototype.m_controllerList);b2.World.prototype.m_controllerCount=0;goog.exportProperty(b2.World.prototype,"m_controllerCount",b2.World.prototype.m_controllerCount);
b2.World.prototype.SetAllowSleeping=function(a){if(a!==this.m_allowSleep&&(this.m_allowSleep=a,!this.m_allowSleep))for(a=this.m_bodyList;a;a=a.m_next)a.SetAwake(!0)};goog.exportProperty(b2.World.prototype,"SetAllowSleeping",b2.World.prototype.SetAllowSleeping);b2.World.prototype.GetAllowSleeping=function(){return this.m_allowSleep};goog.exportProperty(b2.World.prototype,"GetAllowSleeping",b2.World.prototype.GetAllowSleeping);
b2.World.prototype.SetWarmStarting=function(a){this.m_warmStarting=a};goog.exportProperty(b2.World.prototype,"SetWarmStarting",b2.World.prototype.SetWarmStarting);b2.World.prototype.GetWarmStarting=function(){return this.m_warmStarting};goog.exportProperty(b2.World.prototype,"GetWarmStarting",b2.World.prototype.GetWarmStarting);b2.World.prototype.SetContinuousPhysics=function(a){this.m_continuousPhysics=a};
goog.exportProperty(b2.World.prototype,"SetContinuousPhysics",b2.World.prototype.SetContinuousPhysics);b2.World.prototype.GetContinuousPhysics=function(){return this.m_continuousPhysics};goog.exportProperty(b2.World.prototype,"GetContinuousPhysics",b2.World.prototype.GetContinuousPhysics);b2.World.prototype.SetSubStepping=function(a){this.m_subStepping=a};goog.exportProperty(b2.World.prototype,"SetSubStepping",b2.World.prototype.SetSubStepping);
b2.World.prototype.GetSubStepping=function(){return this.m_subStepping};goog.exportProperty(b2.World.prototype,"GetSubStepping",b2.World.prototype.GetSubStepping);b2.World.prototype.GetBodyList=function(){return this.m_bodyList};goog.exportProperty(b2.World.prototype,"GetBodyList",b2.World.prototype.GetBodyList);b2.World.prototype.GetJointList=function(){return this.m_jointList};goog.exportProperty(b2.World.prototype,"GetJointList",b2.World.prototype.GetJointList);
b2.World.prototype.GetParticleSystemList=function(){return this.m_particleSystemList};goog.exportProperty(b2.World.prototype,"GetParticleSystemList",b2.World.prototype.GetParticleSystemList);b2.World.prototype.GetContactList=function(){return this.m_contactManager.m_contactList};goog.exportProperty(b2.World.prototype,"GetContactList",b2.World.prototype.GetContactList);b2.World.prototype.GetBodyCount=function(){return this.m_bodyCount};
goog.exportProperty(b2.World.prototype,"GetBodyCount",b2.World.prototype.GetBodyCount);b2.World.prototype.GetJointCount=function(){return this.m_jointCount};goog.exportProperty(b2.World.prototype,"GetJointCount",b2.World.prototype.GetJointCount);b2.World.prototype.GetContactCount=function(){return this.m_contactManager.m_contactCount};goog.exportProperty(b2.World.prototype,"GetContactCount",b2.World.prototype.GetContactCount);
b2.World.prototype.SetGravity=function(a,b){b=b||!0;if(this.m_gravity.x!==a.x||this.m_gravity.y!==a.y)if(this.m_gravity.Copy(a),b)for(var c=this.m_bodyList;c;c=c.m_next)c.SetAwake(!0)};goog.exportProperty(b2.World.prototype,"SetGravity",b2.World.prototype.SetGravity);b2.World.prototype.GetGravity=function(a){a=a||this.m_out_gravity;return a.Copy(this.m_gravity)};goog.exportProperty(b2.World.prototype,"GetGravity",b2.World.prototype.GetGravity);
b2.World.prototype.IsLocked=function(){return this.m_flag_locked};goog.exportProperty(b2.World.prototype,"IsLocked",b2.World.prototype.IsLocked);b2.World.prototype.SetAutoClearForces=function(a){this.m_flag_clearForces=a};goog.exportProperty(b2.World.prototype,"SetAutoClearForces",b2.World.prototype.SetAutoClearForces);b2.World.prototype.GetAutoClearForces=function(){return this.m_flag_clearForces};
goog.exportProperty(b2.World.prototype,"GetAutoClearForces",b2.World.prototype.GetAutoClearForces);b2.World.prototype.GetContactManager=function(){return this.m_contactManager};goog.exportProperty(b2.World.prototype,"GetContactManager",b2.World.prototype.GetContactManager);b2.World.prototype.GetProfile=function(){return this.m_profile};goog.exportProperty(b2.World.prototype,"GetProfile",b2.World.prototype.GetProfile);
b2.World.prototype.SetDestructionListener=function(a){this.m_destructionListener=a};goog.exportProperty(b2.World.prototype,"SetDestructionListener",b2.World.prototype.SetDestructionListener);b2.World.prototype.SetContactFilter=function(a){this.m_contactManager.m_contactFilter=a};goog.exportProperty(b2.World.prototype,"SetContactFilter",b2.World.prototype.SetContactFilter);b2.World.prototype.SetContactListener=function(a){this.m_contactManager.m_contactListener=a};
goog.exportProperty(b2.World.prototype,"SetContactListener",b2.World.prototype.SetContactListener);b2.World.prototype.SetDebugDraw=function(a){this.m_debugDraw=a};goog.exportProperty(b2.World.prototype,"SetDebugDraw",b2.World.prototype.SetDebugDraw);
b2.World.prototype.CreateBody=function(a){b2.ENABLE_ASSERTS&&b2.Assert(!this.IsLocked());if(this.IsLocked())return null;a=new b2.Body(a,this);a.m_prev=null;if(a.m_next=this.m_bodyList)this.m_bodyList.m_prev=a;this.m_bodyList=a;++this.m_bodyCount;return a};goog.exportProperty(b2.World.prototype,"CreateBody",b2.World.prototype.CreateBody);
b2.World.prototype.DestroyBody=function(a){b2.ENABLE_ASSERTS&&b2.Assert(0<this.m_bodyCount);b2.ENABLE_ASSERTS&&b2.Assert(!this.IsLocked());if(!this.IsLocked()){for(var b=a.m_jointList;b;){var c=b,b=b.next;this.m_destructionListener&&this.m_destructionListener.SayGoodbyeJoint(c.joint);this.DestroyJoint(c.joint);a.m_jointList=b}a.m_jointList=null;for(b=a.m_controllerList;b;)c=b,b=b.nextController,c.controller.RemoveBody(a);for(b=a.m_contactList;b;)c=b,b=b.next,this.m_contactManager.Destroy(c.contact);
a.m_contactList=null;for(b=a.m_fixtureList;b;)c=b,b=b.m_next,this.m_destructionListener&&this.m_destructionListener.SayGoodbyeFixture(c),c.DestroyProxies(this.m_contactManager.m_broadPhase),c.Destroy(),a.m_fixtureList=b,--a.m_fixtureCount;a.m_fixtureList=null;a.m_fixtureCount=0;a.m_prev&&(a.m_prev.m_next=a.m_next);a.m_next&&(a.m_next.m_prev=a.m_prev);a===this.m_bodyList&&(this.m_bodyList=a.m_next);--this.m_bodyCount}};goog.exportProperty(b2.World.prototype,"DestroyBody",b2.World.prototype.DestroyBody);
b2.World.prototype.CreateJoint=function(a){b2.ENABLE_ASSERTS&&b2.Assert(!this.IsLocked());if(this.IsLocked())return null;var b=b2.JointFactory.Create(a,null);b.m_prev=null;if(b.m_next=this.m_jointList)this.m_jointList.m_prev=b;this.m_jointList=b;++this.m_jointCount;b.m_edgeA.joint=b;b.m_edgeA.other=b.m_bodyB;b.m_edgeA.prev=null;if(b.m_edgeA.next=b.m_bodyA.m_jointList)b.m_bodyA.m_jointList.prev=b.m_edgeA;b.m_bodyA.m_jointList=b.m_edgeA;b.m_edgeB.joint=b;b.m_edgeB.other=b.m_bodyA;
b.m_edgeB.prev=null;if(b.m_edgeB.next=b.m_bodyB.m_jointList)b.m_bodyB.m_jointList.prev=b.m_edgeB;b.m_bodyB.m_jointList=b.m_edgeB;var c=a.bodyA,d=a.bodyB;if(!a.collideConnected)for(a=d.GetContactList();a;)a.other===c&&a.contact.FlagForFiltering(),a=a.next;return b};goog.exportProperty(b2.World.prototype,"CreateJoint",b2.World.prototype.CreateJoint);
b2.World.prototype.DestroyJoint=function(a){b2.ENABLE_ASSERTS&&b2.Assert(!this.IsLocked());if(!this.IsLocked()){var b=a.m_collideConnected;a.m_prev&&(a.m_prev.m_next=a.m_next);a.m_next&&(a.m_next.m_prev=a.m_prev);a===this.m_jointList&&(this.m_jointList=a.m_next);var c=a.m_bodyA,d=a.m_bodyB;c.SetAwake(!0);d.SetAwake(!0);a.m_edgeA.prev&&(a.m_edgeA.prev.next=a.m_edgeA.next);a.m_edgeA.next&&(a.m_edgeA.next.prev=a.m_edgeA.prev);a.m_edgeA===c.m_jointList&&(c.m_jointList=a.m_edgeA.next);a.m_edgeA.prev=
null;a.m_edgeA.next=null;a.m_edgeB.prev&&(a.m_edgeB.prev.next=a.m_edgeB.next);a.m_edgeB.next&&(a.m_edgeB.next.prev=a.m_edgeB.prev);a.m_edgeB===d.m_jointList&&(d.m_jointList=a.m_edgeB.next);a.m_edgeB.prev=null;a.m_edgeB.next=null;b2.JointFactory.Destroy(a,null);b2.ENABLE_ASSERTS&&b2.Assert(0<this.m_jointCount);--this.m_jointCount;if(!b)for(a=d.GetContactList();a;)a.other===c&&a.contact.FlagForFiltering(),a=a.next}};goog.exportProperty(b2.World.prototype,"DestroyJoint",b2.World.prototype.DestroyJoint);
b2.World.prototype.CreateParticleSystem=function(a){b2.ENABLE_ASSERTS&&b2.Assert(!this.IsLocked());if(this.IsLocked())return null;a=new b2.ParticleSystem(a,this);a.m_prev=null;if(a.m_next=this.m_particleSystemList)this.m_particleSystemList.m_prev=a;return this.m_particleSystemList=a};goog.exportProperty(b2.World.prototype,"CreateParticleSystem",b2.World.prototype.CreateParticleSystem);
b2.World.prototype.DestroyParticleSystem=function(a){b2.ENABLE_ASSERTS&&b2.Assert(!this.IsLocked());this.IsLocked()||(a.m_prev&&(a.m_prev.m_next=a.m_next),a.m_next&&(a.m_next.m_prev=a.m_prev),a===this.m_particleSystemList&&(this.m_particleSystemList=a.m_next))};goog.exportProperty(b2.World.prototype,"DestroyParticleSystem",b2.World.prototype.DestroyParticleSystem);
b2.World.prototype.Solve=function(a){for(var b=this.m_bodyList;b;b=b.m_next)b.m_xf0.Copy(b.m_xf);for(var c=this.m_controllerList;c;c=c.m_next)c.Step(a);this.m_profile.solveInit=0;this.m_profile.solveVelocity=0;this.m_profile.solvePosition=0;c=this.m_island;c.Initialize(this.m_bodyCount,this.m_contactManager.m_contactCount,this.m_jointCount,null,this.m_contactManager.m_contactListener);for(b=this.m_bodyList;b;b=b.m_next)b.m_flag_islandFlag=!1;for(var d=this.m_contactManager.m_contactList;d;d=
d.m_next)d.m_flag_islandFlag=!1;for(d=this.m_jointList;d;d=d.m_next)d.m_islandFlag=!1;for(var d=this.m_bodyCount,e=this.s_stack,f=this.m_bodyList;f;f=f.m_next)if(!f.m_flag_islandFlag&&f.IsAwake()&&f.IsActive()&&f.GetType()!==b2.BodyType.staticBody){c.Clear();var g=0;e[g++]=f;for(f.m_flag_islandFlag=!0;0<g;)if(b=e[--g],b2.ENABLE_ASSERTS&&b2.Assert(b.IsActive()),c.AddBody(b),b.SetAwake(!0),b.GetType()!==b2.BodyType.staticBody){for(var h=b.m_contactList;h;h=h.next){var k=h.contact;
if(!k.m_flag_islandFlag&&k.IsEnabled()&&k.IsTouching()){var l=k.m_fixtureB.m_isSensor;k.m_fixtureA.m_isSensor||l||(c.AddContact(k),k.m_flag_islandFlag=!0,k=h.other,k.m_flag_islandFlag||(b2.ENABLE_ASSERTS&&b2.Assert(g<d),e[g++]=k,k.m_flag_islandFlag=!0))}}for(b=b.m_jointList;b;b=b.next)b.joint.m_islandFlag||(k=b.other,k.IsActive()&&(c.AddJoint(b.joint),b.joint.m_islandFlag=!0,k.m_flag_islandFlag||(b2.ENABLE_ASSERTS&&b2.Assert(g<d),e[g++]=k,k.m_flag_islandFlag=!0)))}b=new b2.Profile;
c.Solve(b,a,this.m_gravity,this.m_allowSleep);this.m_profile.solveInit+=b.solveInit;this.m_profile.solveVelocity+=b.solveVelocity;this.m_profile.solvePosition+=b.solvePosition;for(g=0;g<c.m_bodyCount;++g)b=c.m_bodies[g],b.GetType()===b2.BodyType.staticBody&&(b.m_flag_islandFlag=!1)}for(g=0;g<e.length&&e[g];++g)e[g]=null;a=new b2.Timer;for(b=this.m_bodyList;b;b=b.m_next)b.m_flag_islandFlag&&b.GetType()!==b2.BodyType.staticBody&&b.SynchronizeFixtures();this.m_contactManager.FindNewContacts();
this.m_profile.broadphase=a.GetMilliseconds()};goog.exportProperty(b2.World.prototype,"Solve",b2.World.prototype.Solve);
b2.World.prototype.SolveTOI=function(a){var b=this.m_island;b.Initialize(2*b2._maxTOIContacts,b2._maxTOIContacts,0,null,this.m_contactManager.m_contactListener);if(this.m_stepComplete){for(var c=this.m_bodyList;c;c=c.m_next)c.m_flag_islandFlag=!1,c.m_sweep.alpha0=0;for(var d=this.m_contactManager.m_contactList;d;d=d.m_next)d.m_flag_toiFlag=d.m_flag_islandFlag=!1,d.m_toiCount=0,d.m_toi=1}for(;;){for(var e=null,c=1,d=this.m_contactManager.m_contactList;d;d=d.m_next)if(d.IsEnabled()&&
!(d.m_toiCount>b2._maxSubSteps)){var f=1;if(d.m_flag_toiFlag)f=d.m_toi;else{var g=d.GetFixtureA(),h=d.GetFixtureB();if(g.IsSensor()||h.IsSensor())continue;var f=g.GetBody(),k=h.GetBody(),l=f.m_type,m=k.m_type;b2.ENABLE_ASSERTS&&b2.Assert(l!==b2.BodyType.staticBody||m!==b2.BodyType.staticBody);var n=f.IsAwake()&&l!==b2.BodyType.staticBody,p=k.IsAwake()&&m!==b2.BodyType.staticBody;if(!n&&!p)continue;l=f.IsBullet()||l!==b2.BodyType.dynamicBody;m=k.IsBullet()||
m!==b2.BodyType.dynamicBody;if(!l&&!m)continue;m=f.m_sweep.alpha0;f.m_sweep.alpha0<k.m_sweep.alpha0?(m=k.m_sweep.alpha0,f.m_sweep.Advance(m)):k.m_sweep.alpha0<f.m_sweep.alpha0&&(m=f.m_sweep.alpha0,k.m_sweep.Advance(m));b2.ENABLE_ASSERTS&&b2.Assert(1>m);n=d.GetChildIndexA();p=d.GetChildIndexB();l=b2.World.prototype.SolveTOI.s_toi_input;l.proxyA.SetShape(g.GetShape(),n);l.proxyB.SetShape(h.GetShape(),p);l.sweepA.Copy(f.m_sweep);l.sweepB.Copy(k.m_sweep);l.tMax=1;f=b2.World.prototype.SolveTOI.s_toi_output;
b2.TimeOfImpact(f,l);k=f.t;f=f.state===b2.TOIOutputState.e_touching?b2.Min(m+(1-m)*k,1):1;d.m_toi=f;d.m_flag_toiFlag=!0}f<c&&(e=d,c=f)}if(null===e||1-10*b2._epsilon<c){this.m_stepComplete=!0;break}g=e.GetFixtureA();h=e.GetFixtureB();f=g.GetBody();k=h.GetBody();d=b2.World.prototype.SolveTOI.s_backup1.Copy(f.m_sweep);g=b2.World.prototype.SolveTOI.s_backup2.Copy(k.m_sweep);f.Advance(c);k.Advance(c);e.Update(this.m_contactManager.m_contactListener);e.m_flag_toiFlag=!1;++e.m_toiCount;
if(e.IsEnabled()&&e.IsTouching()){f.SetAwake(!0);k.SetAwake(!0);b.Clear();b.AddBody(f);b.AddBody(k);b.AddContact(e);f.m_flag_islandFlag=!0;k.m_flag_islandFlag=!0;e.m_flag_islandFlag=!0;for(e=0;2>e;++e)if(d=0===e?f:k,d.m_type===b2.BodyType.dynamicBody)for(g=d.m_contactList;g&&b.m_bodyCount!==b.m_bodyCapacity&&b.m_contactCount!==b.m_contactCapacity;g=g.next)h=g.contact,!h.m_flag_islandFlag&&(m=g.other,m.m_type!==b2.BodyType.dynamicBody||d.IsBullet()||m.IsBullet())&&(l=h.m_fixtureB.m_isSensor,
h.m_fixtureA.m_isSensor||l||(l=b2.World.prototype.SolveTOI.s_backup.Copy(m.m_sweep),m.m_flag_islandFlag||m.Advance(c),h.Update(this.m_contactManager.m_contactListener),h.IsEnabled()?h.IsTouching()?(h.m_flag_islandFlag=!0,b.AddContact(h),m.m_flag_islandFlag||(m.m_flag_islandFlag=!0,m.m_type!==b2.BodyType.staticBody&&m.SetAwake(!0),b.AddBody(m))):(m.m_sweep.Copy(l),m.SynchronizeTransform()):(m.m_sweep.Copy(l),m.SynchronizeTransform())));e=b2.World.prototype.SolveTOI.s_subStep;e.dt=
(1-c)*a.dt;e.inv_dt=1/e.dt;e.dtRatio=1;e.positionIterations=20;e.velocityIterations=a.velocityIterations;e.particleIterations=a.particleIterations;e.warmStarting=!1;b.SolveTOI(e,f.m_islandIndex,k.m_islandIndex);for(e=0;e<b.m_bodyCount;++e)if(d=b.m_bodies[e],d.m_flag_islandFlag=!1,d.m_type===b2.BodyType.dynamicBody)for(d.SynchronizeFixtures(),g=d.m_contactList;g;g=g.next)g.contact.m_flag_toiFlag=g.contact.m_flag_islandFlag=!1;this.m_contactManager.FindNewContacts();if(this.m_subStepping){this.m_stepComplete=
!1;break}}else e.SetEnabled(!1),f.m_sweep.Copy(d),k.m_sweep.Copy(g),f.SynchronizeTransform(),k.SynchronizeTransform()}};goog.exportProperty(b2.World.prototype,"SolveTOI",b2.World.prototype.SolveTOI);b2.World.prototype.SolveTOI.s_subStep=new b2.TimeStep;b2.World.prototype.SolveTOI.s_backup=new b2.Sweep;b2.World.prototype.SolveTOI.s_backup1=new b2.Sweep;b2.World.prototype.SolveTOI.s_backup2=new b2.Sweep;b2.World.prototype.SolveTOI.s_toi_input=new b2.TOIInput;
b2.World.prototype.SolveTOI.s_toi_output=new b2.TOIOutput;
b2.World.prototype.Step=function(a,b,c,d){d=d||this.CalculateReasonableParticleIterations(a);var e=new b2.Timer;this.m_flag_newFixture&&(this.m_contactManager.FindNewContacts(),this.m_flag_newFixture=!1);this.m_flag_locked=!0;var f=b2.World.prototype.Step.s_step;f.dt=a;f.velocityIterations=b;f.positionIterations=c;f.particleIterations=d;f.inv_dt=0<a?1/a:0;f.dtRatio=this.m_inv_dt0*a;f.warmStarting=this.m_warmStarting;a=new b2.Timer;this.m_contactManager.Collide();this.m_profile.collide=
a.GetMilliseconds();if(this.m_stepComplete&&0<f.dt){a=new b2.Timer;for(b=this.m_particleSystemList;b;b=b.m_next)b.Solve(f);this.Solve(f);this.m_profile.solve=a.GetMilliseconds()}this.m_continuousPhysics&&0<f.dt&&(a=new b2.Timer,this.SolveTOI(f),this.m_profile.solveTOI=a.GetMilliseconds());0<f.dt&&(this.m_inv_dt0=f.inv_dt);this.m_flag_clearForces&&this.ClearForces();this.m_flag_locked=!1;this.m_profile.step=e.GetMilliseconds()};goog.exportProperty(b2.World.prototype,"Step",b2.World.prototype.Step);
b2.World.prototype.Step.s_step=new b2.TimeStep;b2.World.prototype.ClearForces=function(){for(var a=this.m_bodyList;a;a=a.m_next)a.m_force.SetZero(),a.m_torque=0};goog.exportProperty(b2.World.prototype,"ClearForces",b2.World.prototype.ClearForces);
b2.World.prototype.QueryAABB=function(a,b){var c=this.m_contactManager.m_broadPhase;c.Query(function(b){b=c.GetUserData(b);b2.ENABLE_ASSERTS&&b2.Assert(b instanceof b2.FixtureProxy);b=b.fixture;return a instanceof b2.QueryCallback?a.ReportFixture(b):a(b)},b);if(a instanceof b2.QueryCallback)for(var d=this.m_particleSystemList;d;d=d.m_next)a.ShouldQueryParticleSystem(d)&&d.QueryAABB(a,b)};goog.exportProperty(b2.World.prototype,"QueryAABB",b2.World.prototype.QueryAABB);
b2.World.prototype.QueryShape=function(a,b,c,d){var e=this.m_contactManager.m_broadPhase,f=b2.World.prototype.QueryShape.s_aabb;b.ComputeAABB(f,c,d||0);e.Query(function(d){d=e.GetUserData(d);b2.ENABLE_ASSERTS&&b2.Assert(d instanceof b2.FixtureProxy);d=d.fixture;return b2.TestOverlap_Shape(b,0,d.GetShape(),0,c,d.GetBody().GetTransform())?a instanceof b2.QueryCallback?a.ReportFixture(d):a(d):!0},f);if(a instanceof b2.QueryCallback)for(d=this.m_particleSystemList;d;d=
d.m_next)a.ShouldQueryParticleSystem(d)&&d.QueryAABB(a,f)};goog.exportProperty(b2.World.prototype,"QueryShape",b2.World.prototype.QueryShape);b2.World.prototype.QueryShape.s_aabb=new b2.AABB;
b2.World.prototype.QueryPoint=function(a,b,c){var d=this.m_contactManager.m_broadPhase;c="number"===typeof c?c:b2._linearSlop;var e=b2.World.prototype.QueryPoint.s_aabb;e.lowerBound.Set(b.x-c,b.y-c);e.upperBound.Set(b.x+c,b.y+c);d.Query(function(c){c=d.GetUserData(c);b2.ENABLE_ASSERTS&&b2.Assert(c instanceof b2.FixtureProxy);c=c.fixture;return c.TestPoint(b)?a instanceof b2.QueryCallback?a.ReportFixture(c):a(c):!0},e);if(a instanceof b2.QueryCallback)for(c=this.m_particleSystemList;c;c=
c.m_next)a.ShouldQueryParticleSystem(c)&&c.QueryAABB(a,e)};goog.exportProperty(b2.World.prototype,"QueryPoint",b2.World.prototype.QueryPoint);b2.World.prototype.QueryPoint.s_aabb=new b2.AABB;
b2.World.prototype.RayCast=function(a,b,c){var d=this.m_contactManager.m_broadPhase,e=b2.World.prototype.RayCast.s_input;e.maxFraction=1;e.p1.Copy(b);e.p2.Copy(c);d.RayCast(function(e,g){var h=d.GetUserData(g);b2.ENABLE_ASSERTS&&b2.Assert(h instanceof b2.FixtureProxy);var k=h.fixture,l=b2.World.prototype.RayCast.s_output;if(k.RayCast(l,e,h.childIndex)){var h=l.fraction,m=b2.World.prototype.RayCast.s_point;m.Set((1-h)*b.x+h*c.x,(1-h)*b.y+h*c.y);return a instanceof b2.RayCastCallback?
a.ReportFixture(k,m,l.normal,h):a(k,m,l.normal,h)}return e.maxFraction},e);if(a instanceof b2.RayCastCallback)for(e=this.m_particleSystemList;e;e=e.m_next)a.ShouldQueryParticleSystem(e)&&e.RayCast(a,b,c)};goog.exportProperty(b2.World.prototype,"RayCast",b2.World.prototype.RayCast);b2.World.prototype.RayCast.s_input=new b2.RayCastInput;b2.World.prototype.RayCast.s_output=new b2.RayCastOutput;b2.World.prototype.RayCast.s_point=new b2.Vec2;
b2.World.prototype.RayCastOne=function(a,b){var c=null,d=1;this.RayCast(function(a,b,g,h){h<d&&(d=h,c=a);return d},a,b);return c};goog.exportProperty(b2.World.prototype,"RayCastOne",b2.World.prototype.RayCastOne);b2.World.prototype.RayCastAll=function(a,b,c){c.length=0;this.RayCast(function(a,b,f,g){c.push(a);return 1},a,b);return c};goog.exportProperty(b2.World.prototype,"RayCastAll",b2.World.prototype.RayCastAll);
b2.World.prototype.DrawShape=function(a,b){var c=a.GetShape();switch(c.m_type){case b2.ShapeType.e_circleShape:c=c instanceof b2.CircleShape?c:null;this.m_debugDraw.DrawSolidCircle(c.m_p,c.m_radius,b2.Vec2.UNITX,b);break;case b2.ShapeType.e_edgeShape:var d=c instanceof b2.EdgeShape?c:null,c=d.m_vertex1,e=d.m_vertex2;this.m_debugDraw.DrawSegment(c,e,b);break;case b2.ShapeType.e_chainShape:var c=c instanceof b2.ChainShape?c:null,d=c.m_count,f=c.m_vertices,c=f[0];
this.m_debugDraw.DrawCircle(c,.05,b);for(var g=1;g<d;++g)e=f[g],this.m_debugDraw.DrawSegment(c,e,b),this.m_debugDraw.DrawCircle(e,.05,b),c=e;break;case b2.ShapeType.e_polygonShape:d=c instanceof b2.PolygonShape?c:null,c=d.m_count,f=d.m_vertices,this.m_debugDraw.DrawSolidPolygon(f,c,b)}};goog.exportProperty(b2.World.prototype,"DrawShape",b2.World.prototype.DrawShape);
b2.World.prototype.DrawJoint=function(a){var b=a.GetBodyA(),c=a.GetBodyB(),d=b.m_xf.p,e=c.m_xf.p,c=a.GetAnchorA(b2.World.prototype.DrawJoint.s_p1),b=a.GetAnchorB(b2.World.prototype.DrawJoint.s_p2),f=b2.World.prototype.DrawJoint.s_color.SetRGB(.5,.8,.8);switch(a.m_type){case b2.JointType.e_distanceJoint:this.m_debugDraw.DrawSegment(c,b,f);break;case b2.JointType.e_pulleyJoint:d=a instanceof b2.PulleyJoint?a:null;a=d.GetGroundAnchorA(b2.World.prototype.DrawJoint.s_s1);
d=d.GetGroundAnchorB(b2.World.prototype.DrawJoint.s_s2);this.m_debugDraw.DrawSegment(a,c,f);this.m_debugDraw.DrawSegment(d,b,f);this.m_debugDraw.DrawSegment(a,d,f);break;case b2.JointType.e_mouseJoint:this.m_debugDraw.DrawSegment(c,b,f);break;default:this.m_debugDraw.DrawSegment(d,c,f),this.m_debugDraw.DrawSegment(c,b,f),this.m_debugDraw.DrawSegment(e,b,f)}};goog.exportProperty(b2.World.prototype,"DrawJoint",b2.World.prototype.DrawJoint);
b2.World.prototype.DrawJoint.s_p1=new b2.Vec2;b2.World.prototype.DrawJoint.s_p2=new b2.Vec2;b2.World.prototype.DrawJoint.s_color=new b2.Color(.5,.8,.8);b2.World.prototype.DrawJoint.s_s1=new b2.Vec2;b2.World.prototype.DrawJoint.s_s2=new b2.Vec2;
b2.World.prototype.DrawParticleSystem=function(a){var b=a.GetParticleCount();if(b){var c=a.GetRadius(),d=a.GetPositionBuffer();a.m_colorBuffer.data?(a=a.GetColorBuffer(),this.m_debugDraw.DrawParticles(d,c,a,b)):this.m_debugDraw.DrawParticles(d,c,null,b)}};goog.exportProperty(b2.World.prototype,"DrawParticleSystem",b2.World.prototype.DrawParticleSystem);
b2.World.prototype.DrawDebugData=function(){if(null!==this.m_debugDraw){var a=this.m_debugDraw.GetFlags(),b=b2.World.prototype.DrawDebugData.s_color.SetRGB(0,0,0);if(a&b2.DrawFlags.e_shapeBit)for(var c=this.m_bodyList;c;c=c.m_next){var d=c.m_xf;this.m_debugDraw.PushTransform(d);for(var e=c.GetFixtureList();e;e=e.m_next)c.IsActive()?c.GetType()===b2.BodyType.staticBody?b.SetRGB(.5,.9,.5):c.GetType()===b2.BodyType.kinematicBody?b.SetRGB(.5,.5,.9):c.IsAwake()?b.SetRGB(.9,
.7,.7):b.SetRGB(.6,.6,.6):b.SetRGB(.5,.5,.3),this.DrawShape(e,b);this.m_debugDraw.PopTransform(d)}if(a&b2.DrawFlags.e_particleBit)for(c=this.m_particleSystemList;c;c=c.m_next)this.DrawParticleSystem(c);if(a&b2.DrawFlags.e_jointBit)for(c=this.m_jointList;c;c=c.m_next)this.DrawJoint(c);if(a&b2.DrawFlags.e_aabbBit){b.SetRGB(.9,.3,.9);for(var d=this.m_contactManager.m_broadPhase,f=b2.World.prototype.DrawDebugData.s_vs,c=this.m_bodyList;c;c=c.m_next)if(c.IsActive())for(e=c.GetFixtureList();e;e=
e.m_next)for(var g=0;g<e.m_proxyCount;++g){var h=d.GetFatAABB(e.m_proxies[g].proxy);f[0].Set(h.lowerBound.x,h.lowerBound.y);f[1].Set(h.upperBound.x,h.lowerBound.y);f[2].Set(h.upperBound.x,h.upperBound.y);f[3].Set(h.lowerBound.x,h.upperBound.y);this.m_debugDraw.DrawPolygon(f,4,b)}}if(a&b2.DrawFlags.e_centerOfMassBit)for(c=this.m_bodyList;c;c=c.m_next)d=b2.World.prototype.DrawDebugData.s_xf,d.q.Copy(c.m_xf.q),d.p.Copy(c.GetWorldCenter()),this.m_debugDraw.DrawTransform(d);if(a&b2.DrawFlags.e_controllerBit)for(a=
this.m_controllerList;a;a=a.m_next)a.Draw(this.m_debugDraw)}};goog.exportProperty(b2.World.prototype,"DrawDebugData",b2.World.prototype.DrawDebugData);b2.World.prototype.DrawDebugData.s_color=new b2.Color(0,0,0);b2.World.prototype.DrawDebugData.s_vs=b2.Vec2.MakeArray(4);b2.World.prototype.DrawDebugData.s_xf=new b2.Transform;
b2.World.prototype.SetBroadPhase=function(a){var b=this.m_contactManager.m_broadPhase;this.m_contactManager.m_broadPhase=a;for(var c=this.m_bodyList;c;c=c.m_next)for(var d=c.m_fixtureList;d;d=d.m_next)d.m_proxy=a.CreateProxy(b.GetFatAABB(d.m_proxy),d)};goog.exportProperty(b2.World.prototype,"SetBroadPhase",b2.World.prototype.SetBroadPhase);
b2.World.prototype.CalculateReasonableParticleIterations=function(a){return null===this.m_particleSystemList?1:b2.CalculateParticleIterations(this.m_gravity.Length(),function(a){var c=b2._maxFloat;for(a=a.GetParticleSystemList();null!==a;a=a.m_next)c=b2.Min(c,a.GetRadius());return c}(this),a)};goog.exportProperty(b2.World.prototype,"CalculateReasonableParticleIterations",b2.World.prototype.CalculateReasonableParticleIterations);b2.World.prototype.GetProxyCount=function(){return this.m_contactManager.m_broadPhase.GetProxyCount()};
goog.exportProperty(b2.World.prototype,"GetProxyCount",b2.World.prototype.GetProxyCount);b2.World.prototype.GetTreeHeight=function(){return this.m_contactManager.m_broadPhase.GetTreeHeight()};goog.exportProperty(b2.World.prototype,"GetTreeHeight",b2.World.prototype.GetTreeHeight);b2.World.prototype.GetTreeBalance=function(){return this.m_contactManager.m_broadPhase.GetTreeBalance()};goog.exportProperty(b2.World.prototype,"GetTreeBalance",b2.World.prototype.GetTreeBalance);
b2.World.prototype.GetTreeQuality=function(){return this.m_contactManager.m_broadPhase.GetTreeQuality()};goog.exportProperty(b2.World.prototype,"GetTreeQuality",b2.World.prototype.GetTreeQuality);b2.World.prototype.ShiftOrigin=function(a){b2.ENABLE_ASSERTS&&b2.Assert(!this.IsLocked());if(!this.IsLocked()){for(var b=this.m_bodyList;b;b=b.m_next)b.m_xf.p.SelfSub(a),b.m_sweep.c0.SelfSub(a),b.m_sweep.c.SelfSub(a);for(b=this.m_jointList;b;b=b.m_next)b.ShiftOrigin(a);this.m_contactManager.m_broadPhase.ShiftOrigin(a)}};
goog.exportProperty(b2.World.prototype,"ShiftOrigin",b2.World.prototype.ShiftOrigin);
b2.World.prototype.Dump=function(){if(b2.DEBUG&&!this.m_flag_locked){b2.Log("/** @type {b2.Vec2} */ var g = new b2.Vec2(%.15f, %.15f);\n",this.m_gravity.x,this.m_gravity.y);b2.Log("this.m_world.SetGravity(g);\n");b2.Log("/** @type {Array.<b2.Body>} */ var bodies = new Array(%d);\n",this.m_bodyCount);b2.Log("/** @type {Array.<b2.Joint>} */ var joints = new Array(%d);\n",this.m_jointCount);for(var a=0,b=this.m_bodyList;b;b=b.m_next)b.m_islandIndex=a,b.Dump(),
++a;a=0;for(b=this.m_jointList;b;b=b.m_next)b.m_index=a,++a;for(b=this.m_jointList;b;b=b.m_next)b.m_type!==b2.JointType.e_gearJoint&&(b2.Log("{\n"),b.Dump(),b2.Log("}\n"));for(b=this.m_jointList;b;b=b.m_next)b.m_type===b2.JointType.e_gearJoint&&(b2.Log("{\n"),b.Dump(),b2.Log("}\n"))}};goog.exportProperty(b2.World.prototype,"Dump",b2.World.prototype.Dump);
b2.World.prototype.AddController=function(a){b2.ENABLE_ASSERTS&&b2.Assert(null===a.m_world,"Controller can only be a member of one world");a.m_world=this;a.m_next=this.m_controllerList;a.m_prev=null;this.m_controllerList&&(this.m_controllerList.m_prev=a);this.m_controllerList=a;++this.m_controllerCount;return a};goog.exportProperty(b2.World.prototype,"AddController",b2.World.prototype.AddController);
b2.World.prototype.RemoveController=function(a){b2.ENABLE_ASSERTS&&b2.Assert(a.m_world===this,"Controller is not a member of this world");a.m_prev&&(a.m_prev.m_next=a.m_next);a.m_next&&(a.m_next.m_prev=a.m_prev);this.m_controllerList===a&&(this.m_controllerList=a.m_next);--this.m_controllerCount;a.m_prev=null;a.m_next=null;a.m_world=null};goog.exportProperty(b2.World.prototype,"RemoveController",b2.World.prototype.RemoveController);b2.MotorJointDef=function(){b2.JointDef.call(this,b2.JointType.e_motorJoint);this.linearOffset=new b2.Vec2(0,0)};goog.inherits(b2.MotorJointDef,b2.JointDef);goog.exportSymbol("b2.MotorJointDef",b2.MotorJointDef);b2.MotorJointDef.prototype.linearOffset=null;goog.exportProperty(b2.MotorJointDef.prototype,"linearOffset",b2.MotorJointDef.prototype.linearOffset);b2.MotorJointDef.prototype.angularOffset=0;
goog.exportProperty(b2.MotorJointDef.prototype,"angularOffset",b2.MotorJointDef.prototype.angularOffset);b2.MotorJointDef.prototype.maxForce=1;goog.exportProperty(b2.MotorJointDef.prototype,"maxForce",b2.MotorJointDef.prototype.maxForce);b2.MotorJointDef.prototype.maxTorque=1;goog.exportProperty(b2.MotorJointDef.prototype,"maxTorque",b2.MotorJointDef.prototype.maxTorque);b2.MotorJointDef.prototype.correctionFactor=.3;
goog.exportProperty(b2.MotorJointDef.prototype,"correctionFactor",b2.MotorJointDef.prototype.correctionFactor);b2.MotorJointDef.prototype.Initialize=function(a,b){this.bodyA=a;this.bodyB=b;this.bodyA.GetLocalPoint(this.bodyB.GetPosition(),this.linearOffset);var c=this.bodyA.GetAngle();this.angularOffset=this.bodyB.GetAngle()-c};goog.exportProperty(b2.MotorJointDef.prototype,"Initialize",b2.MotorJointDef.prototype.Initialize);
b2.MotorJoint=function(a){b2.Joint.call(this,a);this.m_linearOffset=a.linearOffset.Clone();this.m_linearImpulse=new b2.Vec2(0,0);this.m_maxForce=a.maxForce;this.m_maxTorque=a.maxTorque;this.m_correctionFactor=a.correctionFactor;this.m_rA=new b2.Vec2(0,0);this.m_rB=new b2.Vec2(0,0);this.m_localCenterA=new b2.Vec2(0,0);this.m_localCenterB=new b2.Vec2(0,0);this.m_linearError=new b2.Vec2(0,0);this.m_linearMass=new b2.Mat22;this.m_qA=new b2.Rot;this.m_qB=
new b2.Rot;this.m_K=new b2.Mat22};goog.inherits(b2.MotorJoint,b2.Joint);goog.exportSymbol("b2.MotorJoint",b2.MotorJoint);b2.MotorJoint.prototype.m_linearOffset=null;goog.exportProperty(b2.MotorJoint.prototype,"m_linearOffset",b2.MotorJoint.prototype.m_linearOffset);b2.MotorJoint.prototype.m_angularOffset=0;goog.exportProperty(b2.MotorJoint.prototype,"m_angularOffset",b2.MotorJoint.prototype.m_angularOffset);
b2.MotorJoint.prototype.m_linearImpulse=null;goog.exportProperty(b2.MotorJoint.prototype,"m_linearImpulse",b2.MotorJoint.prototype.m_linearImpulse);b2.MotorJoint.prototype.m_angularImpulse=0;goog.exportProperty(b2.MotorJoint.prototype,"m_angularImpulse",b2.MotorJoint.prototype.m_angularImpulse);b2.MotorJoint.prototype.m_maxForce=0;goog.exportProperty(b2.MotorJoint.prototype,"m_maxForce",b2.MotorJoint.prototype.m_maxForce);
b2.MotorJoint.prototype.m_maxTorque=0;goog.exportProperty(b2.MotorJoint.prototype,"m_maxTorque",b2.MotorJoint.prototype.m_maxTorque);b2.MotorJoint.prototype.m_correctionFactor=.3;goog.exportProperty(b2.MotorJoint.prototype,"m_correctionFactor",b2.MotorJoint.prototype.m_correctionFactor);b2.MotorJoint.prototype.m_indexA=0;goog.exportProperty(b2.MotorJoint.prototype,"m_indexA",b2.MotorJoint.prototype.m_indexA);b2.MotorJoint.prototype.m_indexB=0;
goog.exportProperty(b2.MotorJoint.prototype,"m_indexB",b2.MotorJoint.prototype.m_indexB);b2.MotorJoint.prototype.m_rA=null;goog.exportProperty(b2.MotorJoint.prototype,"m_rA",b2.MotorJoint.prototype.m_rA);b2.MotorJoint.prototype.m_rB=null;goog.exportProperty(b2.MotorJoint.prototype,"m_rB",b2.MotorJoint.prototype.m_rB);b2.MotorJoint.prototype.m_localCenterA=null;goog.exportProperty(b2.MotorJoint.prototype,"m_localCenterA",b2.MotorJoint.prototype.m_localCenterA);
b2.MotorJoint.prototype.m_localCenterB=null;goog.exportProperty(b2.MotorJoint.prototype,"m_localCenterB",b2.MotorJoint.prototype.m_localCenterB);b2.MotorJoint.prototype.m_linearError=null;goog.exportProperty(b2.MotorJoint.prototype,"m_linearError",b2.MotorJoint.prototype.m_linearError);b2.MotorJoint.prototype.m_angularError=0;goog.exportProperty(b2.MotorJoint.prototype,"m_angularError",b2.MotorJoint.prototype.m_angularError);
b2.MotorJoint.prototype.m_invMassA=0;goog.exportProperty(b2.MotorJoint.prototype,"m_invMassA",b2.MotorJoint.prototype.m_invMassA);b2.MotorJoint.prototype.m_invMassB=0;goog.exportProperty(b2.MotorJoint.prototype,"m_invMassB",b2.MotorJoint.prototype.m_invMassB);b2.MotorJoint.prototype.m_invIA=0;goog.exportProperty(b2.MotorJoint.prototype,"m_invIA",b2.MotorJoint.prototype.m_invIA);b2.MotorJoint.prototype.m_invIB=0;
goog.exportProperty(b2.MotorJoint.prototype,"m_invIB",b2.MotorJoint.prototype.m_invIB);b2.MotorJoint.prototype.m_linearMass=null;goog.exportProperty(b2.MotorJoint.prototype,"m_linearMass",b2.MotorJoint.prototype.m_linearMass);b2.MotorJoint.prototype.m_angularMass=0;goog.exportProperty(b2.MotorJoint.prototype,"m_angularMass",b2.MotorJoint.prototype.m_angularMass);b2.MotorJoint.prototype.m_qA=null;goog.exportProperty(b2.MotorJoint.prototype,"m_qA",b2.MotorJoint.prototype.m_qA);
b2.MotorJoint.prototype.m_qB=null;goog.exportProperty(b2.MotorJoint.prototype,"m_qB",b2.MotorJoint.prototype.m_qB);b2.MotorJoint.prototype.m_K=null;goog.exportProperty(b2.MotorJoint.prototype,"m_K",b2.MotorJoint.prototype.m_K);b2.MotorJoint.prototype.GetAnchorA=function(a){return this.m_bodyA.GetPosition(a)};goog.exportProperty(b2.MotorJoint.prototype,"GetAnchorA",b2.MotorJoint.prototype.GetAnchorA);b2.MotorJoint.prototype.GetAnchorB=function(a){return this.m_bodyB.GetPosition(a)};
goog.exportProperty(b2.MotorJoint.prototype,"GetAnchorB",b2.MotorJoint.prototype.GetAnchorB);b2.MotorJoint.prototype.GetReactionForce=function(a,b){return b2.Mul_S_V2(a,this.m_linearImpulse,b)};goog.exportProperty(b2.MotorJoint.prototype,"GetReactionForce",b2.MotorJoint.prototype.GetReactionForce);b2.MotorJoint.prototype.GetReactionTorque=function(a){return a*this.m_angularImpulse};goog.exportProperty(b2.MotorJoint.prototype,"GetReactionTorque",b2.MotorJoint.prototype.GetReactionTorque);
b2.MotorJoint.prototype.SetCorrectionFactor=function(a){b2.ENABLE_ASSERTS&&b2.Assert(b2.IsValid(a)&&0<=a&&1>=a);this._correctionFactor=a};b2.MotorJoint.prototype.GetCorrectionFactor=function(){return this.m_correctionFactor};b2.MotorJoint.prototype.SetLinearOffset=function(a){if(a.x!=this.m_linearOffset.x||a.y!=this.m_linearOffset.y)this.m_bodyA.SetAwake(!0),this.m_bodyB.SetAwake(!0),this.m_linearOffset.Copy(a)};
goog.exportProperty(b2.MotorJoint.prototype,"SetLinearOffset",b2.MotorJoint.prototype.SetLinearOffset);b2.MotorJoint.prototype.GetLinearOffset=function(a){return a.Copy(this.m_linearOffset)};goog.exportProperty(b2.MotorJoint.prototype,"GetLinearOffset",b2.MotorJoint.prototype.GetLinearOffset);b2.MotorJoint.prototype.SetAngularOffset=function(a){a!==this.m_angularOffset&&(this.m_bodyA.SetAwake(!0),this.m_bodyB.SetAwake(!0),this.m_angularOffset=a)};
goog.exportProperty(b2.MotorJoint.prototype,"SetAngularOffset",b2.MotorJoint.prototype.SetAngularOffset);b2.MotorJoint.prototype.GetAngularOffset=function(){return this.m_angularOffset};goog.exportProperty(b2.MotorJoint.prototype,"GetAngularOffset",b2.MotorJoint.prototype.GetAngularOffset);b2.MotorJoint.prototype.SetMaxForce=function(a){b2.ENABLE_ASSERTS&&b2.Assert(b2.IsValid(a)&&0<=a);this.m_maxForce=a};
goog.exportProperty(b2.MotorJoint.prototype,"SetMaxForce",b2.MotorJoint.prototype.SetMaxForce);b2.MotorJoint.prototype.GetMaxForce=function(){return this.m_maxForce};goog.exportProperty(b2.MotorJoint.prototype,"GetMaxForce",b2.MotorJoint.prototype.GetMaxForce);b2.MotorJoint.prototype.SetMaxTorque=function(a){b2.ENABLE_ASSERTS&&b2.Assert(b2.IsValid(a)&&0<=a);this.m_maxTorque=a};goog.exportProperty(b2.MotorJoint.prototype,"SetMaxTorque",b2.MotorJoint.prototype.SetMaxTorque);
b2.MotorJoint.prototype.GetMaxTorque=function(){return this.m_maxTorque};goog.exportProperty(b2.MotorJoint.prototype,"GetMaxTorque",b2.MotorJoint.prototype.GetMaxTorque);
b2.MotorJoint.prototype.InitVelocityConstraints=function(a){this.m_indexA=this.m_bodyA.m_islandIndex;this.m_indexB=this.m_bodyB.m_islandIndex;this.m_localCenterA.Copy(this.m_bodyA.m_sweep.localCenter);this.m_localCenterB.Copy(this.m_bodyB.m_sweep.localCenter);this.m_invMassA=this.m_bodyA.m_invMass;this.m_invMassB=this.m_bodyB.m_invMass;this.m_invIA=this.m_bodyA.m_invI;this.m_invIB=this.m_bodyB.m_invI;var b=a.positions[this.m_indexA].c,c=a.positions[this.m_indexA].a,d=a.velocities[this.m_indexA].v,
e=a.velocities[this.m_indexA].w,f=a.positions[this.m_indexB].c,g=a.positions[this.m_indexB].a,h=a.velocities[this.m_indexB].v,k=a.velocities[this.m_indexB].w,l=this.m_qA.SetAngle(c),m=this.m_qB.SetAngle(g),n=b2.Mul_R_V2(l,b2.Vec2.s_t0.Copy(this.m_localCenterA).SelfNeg(),this.m_rA),m=b2.Mul_R_V2(m,b2.Vec2.s_t0.Copy(this.m_localCenterB).SelfNeg(),this.m_rB),p=this.m_invMassA,q=this.m_invMassB,r=this.m_invIA,u=this.m_invIB,t=this.m_K;t.ex.x=p+q+r*n.y*n.y+u*m.y*m.y;t.ex.y=-r*n.x*n.y-
u*m.x*m.y;t.ey.x=t.ex.y;t.ey.y=p+q+r*n.x*n.x+u*m.x*m.x;t.GetInverse(this.m_linearMass);this.m_angularMass=r+u;0<this.m_angularMass&&(this.m_angularMass=1/this.m_angularMass);b2.Sub_V2_V2(b2.Sub_V2_V2(b2.Add_V2_V2(f,m,b2.Vec2.s_t0),b2.Add_V2_V2(b,n,b2.Vec2.s_t1),b2.Vec2.s_t2),b2.Mul_R_V2(l,this.m_linearOffset,b2.Vec2.s_t3),this.m_linearError);this.m_angularError=g-c-this.m_angularOffset;a.step.warmStarting?(this.m_linearImpulse.SelfMul(a.step.dtRatio),this.m_angularImpulse*=
a.step.dtRatio,b=this.m_linearImpulse,d.SelfMulSub(p,b),e-=r*(b2.Cross_V2_V2(n,b)+this.m_angularImpulse),h.SelfMulAdd(q,b),k+=u*(b2.Cross_V2_V2(m,b)+this.m_angularImpulse)):(this.m_linearImpulse.SetZero(),this.m_angularImpulse=0);a.velocities[this.m_indexA].w=e;a.velocities[this.m_indexB].w=k};goog.exportProperty(b2.MotorJoint.prototype,"InitVelocityConstraints",b2.MotorJoint.prototype.InitVelocityConstraints);
b2.MotorJoint.prototype.SolveVelocityConstraints=function(a){var b=a.velocities[this.m_indexA].v,c=a.velocities[this.m_indexA].w,d=a.velocities[this.m_indexB].v,e=a.velocities[this.m_indexB].w,f=this.m_invMassA,g=this.m_invMassB,h=this.m_invIA,k=this.m_invIB,l=a.step.dt,m=a.step.inv_dt,n=e-c+m*this.m_correctionFactor*this.m_angularError,n=-this.m_angularMass*n,p=this.m_angularImpulse,q=l*this.m_maxTorque;this.m_angularImpulse=b2.Clamp(this.m_angularImpulse+n,-q,q);var n=this.m_angularImpulse-
p,c=c-h*n,e=e+k*n,r=this.m_rA,u=this.m_rB,n=b2.Add_V2_V2(b2.Sub_V2_V2(b2.Add_V2_V2(d,b2.Cross_S_V2(e,u,b2.Vec2.s_t0),b2.Vec2.s_t0),b2.Add_V2_V2(b,b2.Cross_S_V2(c,r,b2.Vec2.s_t1),b2.Vec2.s_t1),b2.Vec2.s_t2),b2.Mul_S_V2(m*this.m_correctionFactor,this.m_linearError,b2.Vec2.s_t3),b2.MotorJoint.prototype.SolveVelocityConstraints.s_Cdot),n=b2.Mul_M22_V2(this.m_linearMass,n,b2.MotorJoint.prototype.SolveVelocityConstraints.s_impulse).SelfNeg(),
p=b2.MotorJoint.prototype.SolveVelocityConstraints.s_oldImpulse.Copy(this.m_linearImpulse);this.m_linearImpulse.SelfAdd(n);q=l*this.m_maxForce;this.m_linearImpulse.LengthSquared()>q*q&&(this.m_linearImpulse.Normalize(),this.m_linearImpulse.SelfMul(q));b2.Sub_V2_V2(this.m_linearImpulse,p,n);b.SelfMulSub(f,n);c-=h*b2.Cross_V2_V2(r,n);d.SelfMulAdd(g,n);e+=k*b2.Cross_V2_V2(u,n);a.velocities[this.m_indexA].w=c;a.velocities[this.m_indexB].w=e};
goog.exportProperty(b2.MotorJoint.prototype,"SolveVelocityConstraints",b2.MotorJoint.prototype.SolveVelocityConstraints);b2.MotorJoint.prototype.SolveVelocityConstraints.s_Cdot=new b2.Vec2;b2.MotorJoint.prototype.SolveVelocityConstraints.s_impulse=new b2.Vec2;b2.MotorJoint.prototype.SolveVelocityConstraints.s_oldImpulse=new b2.Vec2;b2.MotorJoint.prototype.SolvePositionConstraints=function(a){return!0};
goog.exportProperty(b2.MotorJoint.prototype,"SolvePositionConstraints",b2.MotorJoint.prototype.SolvePositionConstraints);
b2.MotorJoint.prototype.Dump=function(){if(b2.DEBUG){var a=this.m_bodyA.m_islandIndex,b=this.m_bodyB.m_islandIndex;b2.Log("  /*b2.MotorJointDef*/ var jd = new b2.MotorJointDef();\n");b2.Log("  jd.bodyA = bodies[%d];\n",a);b2.Log("  jd.bodyB = bodies[%d];\n",b);b2.Log("  jd.collideConnected = %s;\n",this.m_collideConnected?"true":"false");b2.Log("  jd.linearOffset.Set(%.15f, %.15f);\n",this.m_linearOffset.x,this.m_linearOffset.y);b2.Log("  jd.angularOffset = %.15f;\n",
this.m_angularOffset);b2.Log("  jd.maxForce = %.15f;\n",this.m_maxForce);b2.Log("  jd.maxTorque = %.15f;\n",this.m_maxTorque);b2.Log("  jd.correctionFactor = %.15f;\n",this.m_correctionFactor);b2.Log("  joints[%d] = this.m_world.CreateJoint(jd);\n",this.m_index)}};goog.exportProperty(b2.MotorJoint.prototype,"Dump",b2.MotorJoint.prototype.Dump);b2.MouseJointDef=function(){b2.JointDef.call(this,b2.JointType.e_mouseJoint);this.target=new b2.Vec2};goog.inherits(b2.MouseJointDef,b2.JointDef);goog.exportSymbol("b2.MouseJointDef",b2.MouseJointDef);b2.MouseJointDef.prototype.target=null;goog.exportProperty(b2.MouseJointDef.prototype,"target",b2.MouseJointDef.prototype.target);b2.MouseJointDef.prototype.maxForce=0;goog.exportProperty(b2.MouseJointDef.prototype,"maxForce",b2.MouseJointDef.prototype.maxForce);
b2.MouseJointDef.prototype.frequencyHz=5;goog.exportProperty(b2.MouseJointDef.prototype,"frequencyHz",b2.MouseJointDef.prototype.frequencyHz);b2.MouseJointDef.prototype.dampingRatio=.7;goog.exportProperty(b2.MouseJointDef.prototype,"dampingRatio",b2.MouseJointDef.prototype.dampingRatio);
b2.MouseJoint=function(a){b2.Joint.call(this,a);this.m_localAnchorB=new b2.Vec2;this.m_targetA=new b2.Vec2;this.m_impulse=new b2.Vec2;this.m_rB=new b2.Vec2;this.m_localCenterB=new b2.Vec2;this.m_mass=new b2.Mat22;this.m_C=new b2.Vec2;this.m_qB=new b2.Rot;this.m_lalcB=new b2.Vec2;this.m_K=new b2.Mat22;b2.ENABLE_ASSERTS&&b2.Assert(a.target.IsValid());b2.ENABLE_ASSERTS&&b2.Assert(b2.IsValid(a.maxForce)&&0<=a.maxForce);b2.ENABLE_ASSERTS&&
b2.Assert(b2.IsValid(a.frequencyHz)&&0<=a.frequencyHz);b2.ENABLE_ASSERTS&&b2.Assert(b2.IsValid(a.dampingRatio)&&0<=a.dampingRatio);this.m_targetA.Copy(a.target);b2.MulT_X_V2(this.m_bodyB.GetTransform(),this.m_targetA,this.m_localAnchorB);this.m_maxForce=a.maxForce;this.m_impulse.SetZero();this.m_frequencyHz=a.frequencyHz;this.m_dampingRatio=a.dampingRatio;this.m_gamma=this.m_beta=0};goog.inherits(b2.MouseJoint,b2.Joint);
goog.exportSymbol("b2.MouseJoint",b2.MouseJoint);b2.MouseJoint.prototype.m_localAnchorB=null;goog.exportProperty(b2.MouseJoint.prototype,"m_localAnchorB",b2.MouseJoint.prototype.m_localAnchorB);b2.MouseJoint.prototype.m_targetA=null;goog.exportProperty(b2.MouseJoint.prototype,"m_targetA",b2.MouseJoint.prototype.m_targetA);b2.MouseJoint.prototype.m_frequencyHz=0;goog.exportProperty(b2.MouseJoint.prototype,"m_frequencyHz",b2.MouseJoint.prototype.m_frequencyHz);
b2.MouseJoint.prototype.m_dampingRatio=0;goog.exportProperty(b2.MouseJoint.prototype,"m_dampingRatio",b2.MouseJoint.prototype.m_dampingRatio);b2.MouseJoint.prototype.m_beta=0;goog.exportProperty(b2.MouseJoint.prototype,"m_beta",b2.MouseJoint.prototype.m_beta);b2.MouseJoint.prototype.m_impulse=null;goog.exportProperty(b2.MouseJoint.prototype,"m_impulse",b2.MouseJoint.prototype.m_impulse);b2.MouseJoint.prototype.m_maxForce=0;
goog.exportProperty(b2.MouseJoint.prototype,"m_maxForce",b2.MouseJoint.prototype.m_maxForce);b2.MouseJoint.prototype.m_gamma=0;goog.exportProperty(b2.MouseJoint.prototype,"m_gamma",b2.MouseJoint.prototype.m_gamma);b2.MouseJoint.prototype.m_indexA=0;goog.exportProperty(b2.MouseJoint.prototype,"m_indexA",b2.MouseJoint.prototype.m_indexA);b2.MouseJoint.prototype.m_indexB=0;goog.exportProperty(b2.MouseJoint.prototype,"m_indexB",b2.MouseJoint.prototype.m_indexB);
b2.MouseJoint.prototype.m_rB=null;goog.exportProperty(b2.MouseJoint.prototype,"m_rB",b2.MouseJoint.prototype.m_rB);b2.MouseJoint.prototype.m_localCenterB=null;goog.exportProperty(b2.MouseJoint.prototype,"m_localCenterB",b2.MouseJoint.prototype.m_localCenterB);b2.MouseJoint.prototype.m_invMassB=0;goog.exportProperty(b2.MouseJoint.prototype,"m_invMassB",b2.MouseJoint.prototype.m_invMassB);b2.MouseJoint.prototype.m_invIB=0;
goog.exportProperty(b2.MouseJoint.prototype,"m_invIB",b2.MouseJoint.prototype.m_invIB);b2.MouseJoint.prototype.m_mass=null;goog.exportProperty(b2.MouseJoint.prototype,"m_mass",b2.MouseJoint.prototype.m_mass);b2.MouseJoint.prototype.m_C=null;goog.exportProperty(b2.MouseJoint.prototype,"m_C",b2.MouseJoint.prototype.m_C);b2.MouseJoint.prototype.m_qB=null;goog.exportProperty(b2.MouseJoint.prototype,"m_qB",b2.MouseJoint.prototype.m_qB);
b2.MouseJoint.prototype.m_lalcB=null;goog.exportProperty(b2.MouseJoint.prototype,"m_lalcB",b2.MouseJoint.prototype.m_lalcB);b2.MouseJoint.prototype.m_K=null;goog.exportProperty(b2.MouseJoint.prototype,"m_K",b2.MouseJoint.prototype.m_K);b2.MouseJoint.prototype.SetTarget=function(a){this.m_bodyB.IsAwake()||this.m_bodyB.SetAwake(!0);this.m_targetA.Copy(a)};goog.exportProperty(b2.MouseJoint.prototype,"SetTarget",b2.MouseJoint.prototype.SetTarget);
b2.MouseJoint.prototype.GetTarget=function(a){return a.Copy(this.m_targetA)};goog.exportProperty(b2.MouseJoint.prototype,"GetTarget",b2.MouseJoint.prototype.GetTarget);b2.MouseJoint.prototype.SetMaxForce=function(a){this.m_maxForce=a};goog.exportProperty(b2.MouseJoint.prototype,"SetMaxForce",b2.MouseJoint.prototype.SetMaxForce);b2.MouseJoint.prototype.GetMaxForce=function(){return this.m_maxForce};goog.exportProperty(b2.MouseJoint.prototype,"GetMaxForce",b2.MouseJoint.prototype.GetMaxForce);
b2.MouseJoint.prototype.SetFrequency=function(a){this.m_frequencyHz=a};goog.exportProperty(b2.MouseJoint.prototype,"SetFrequency",b2.MouseJoint.prototype.SetFrequency);b2.MouseJoint.prototype.GetFrequency=function(){return this.m_frequencyHz};goog.exportProperty(b2.MouseJoint.prototype,"GetFrequency",b2.MouseJoint.prototype.GetFrequency);b2.MouseJoint.prototype.SetDampingRatio=function(a){this.m_dampingRatio=a};
goog.exportProperty(b2.MouseJoint.prototype,"SetDampingRatio",b2.MouseJoint.prototype.SetDampingRatio);b2.MouseJoint.prototype.GetDampingRatio=function(){return this.m_dampingRatio};goog.exportProperty(b2.MouseJoint.prototype,"GetDampingRatio",b2.MouseJoint.prototype.GetDampingRatio);
b2.MouseJoint.prototype.InitVelocityConstraints=function(a){this.m_indexB=this.m_bodyB.m_islandIndex;this.m_localCenterB.Copy(this.m_bodyB.m_sweep.localCenter);this.m_invMassB=this.m_bodyB.m_invMass;this.m_invIB=this.m_bodyB.m_invI;var b=a.positions[this.m_indexB].c,c=a.velocities[this.m_indexB].v,d=a.velocities[this.m_indexB].w,e=this.m_qB.SetAngle(a.positions[this.m_indexB].a),f=this.m_bodyB.GetMass(),g=2*b2._pi*this.m_frequencyHz,h=2*f*this.m_dampingRatio*g,f=f*g*g,g=a.step.dt;b2.ENABLE_ASSERTS&&
b2.Assert(h+g*f>b2._epsilon);this.m_gamma=g*(h+g*f);0!==this.m_gamma&&(this.m_gamma=1/this.m_gamma);this.m_beta=g*f*this.m_gamma;b2.Sub_V2_V2(this.m_localAnchorB,this.m_localCenterB,this.m_lalcB);b2.Mul_R_V2(e,this.m_lalcB,this.m_rB);e=this.m_K;e.ex.x=this.m_invMassB+this.m_invIB*this.m_rB.y*this.m_rB.y+this.m_gamma;e.ex.y=-this.m_invIB*this.m_rB.x*this.m_rB.y;e.ey.x=e.ex.y;e.ey.y=this.m_invMassB+this.m_invIB*this.m_rB.x*this.m_rB.x+this.m_gamma;e.GetInverse(this.m_mass);this.m_C.x=
b.x+this.m_rB.x-this.m_targetA.x;this.m_C.y=b.y+this.m_rB.y-this.m_targetA.y;this.m_C.SelfMul(this.m_beta);d*=.98;a.step.warmStarting?(this.m_impulse.SelfMul(a.step.dtRatio),c.x+=this.m_invMassB*this.m_impulse.x,c.y+=this.m_invMassB*this.m_impulse.y,d+=this.m_invIB*b2.Cross_V2_V2(this.m_rB,this.m_impulse)):this.m_impulse.SetZero();a.velocities[this.m_indexB].w=d};goog.exportProperty(b2.MouseJoint.prototype,"InitVelocityConstraints",b2.MouseJoint.prototype.InitVelocityConstraints);
b2.MouseJoint.prototype.SolveVelocityConstraints=function(a){var b=a.velocities[this.m_indexB].v,c=a.velocities[this.m_indexB].w,d=b2.AddCross_V2_S_V2(b,c,this.m_rB,b2.MouseJoint.prototype.SolveVelocityConstraints.s_Cdot),d=b2.Mul_M22_V2(this.m_mass,b2.Add_V2_V2(d,b2.Add_V2_V2(this.m_C,b2.Mul_S_V2(this.m_gamma,this.m_impulse,b2.Vec2.s_t0),b2.Vec2.s_t0),b2.Vec2.s_t0).SelfNeg(),b2.MouseJoint.prototype.SolveVelocityConstraints.s_impulse),e=b2.MouseJoint.prototype.SolveVelocityConstraints.s_oldImpulse.Copy(this.m_impulse);
this.m_impulse.SelfAdd(d);var f=a.step.dt*this.m_maxForce;this.m_impulse.LengthSquared()>f*f&&this.m_impulse.SelfMul(f/this.m_impulse.Length());b2.Sub_V2_V2(this.m_impulse,e,d);b.SelfMulAdd(this.m_invMassB,d);c+=this.m_invIB*b2.Cross_V2_V2(this.m_rB,d);a.velocities[this.m_indexB].w=c};goog.exportProperty(b2.MouseJoint.prototype,"SolveVelocityConstraints",b2.MouseJoint.prototype.SolveVelocityConstraints);b2.MouseJoint.prototype.SolveVelocityConstraints.s_Cdot=new b2.Vec2;
b2.MouseJoint.prototype.SolveVelocityConstraints.s_impulse=new b2.Vec2;b2.MouseJoint.prototype.SolveVelocityConstraints.s_oldImpulse=new b2.Vec2;b2.MouseJoint.prototype.SolvePositionConstraints=function(a){return!0};goog.exportProperty(b2.MouseJoint.prototype,"SolvePositionConstraints",b2.MouseJoint.prototype.SolvePositionConstraints);b2.MouseJoint.prototype.GetAnchorA=function(a){return a.Copy(this.m_targetA)};
goog.exportProperty(b2.MouseJoint.prototype,"GetAnchorA",b2.MouseJoint.prototype.GetAnchorA);b2.MouseJoint.prototype.GetAnchorB=function(a){return this.m_bodyB.GetWorldPoint(this.m_localAnchorB,a)};goog.exportProperty(b2.MouseJoint.prototype,"GetAnchorB",b2.MouseJoint.prototype.GetAnchorB);b2.MouseJoint.prototype.GetReactionForce=function(a,b){return b2.Mul_S_V2(a,this.m_impulse,b)};goog.exportProperty(b2.MouseJoint.prototype,"GetReactionForce",b2.MouseJoint.prototype.GetReactionForce);
b2.MouseJoint.prototype.GetReactionTorque=function(a){return 0};goog.exportProperty(b2.MouseJoint.prototype,"GetReactionTorque",b2.MouseJoint.prototype.GetReactionTorque);b2.MouseJoint.prototype.Dump=function(){b2.DEBUG&&b2.Log("Mouse joint dumping is not supported.\n")};goog.exportProperty(b2.MouseJoint.prototype,"Dump",b2.MouseJoint.prototype.Dump);b2.MouseJoint.prototype.ShiftOrigin=function(a){this.m_targetA.SelfSub(a)};
goog.exportProperty(b2.MouseJoint.prototype,"ShiftOrigin",b2.MouseJoint.prototype.ShiftOrigin);b2.PrismaticJointDef=function(){b2.JointDef.call(this,b2.JointType.e_prismaticJoint);this.localAnchorA=new b2.Vec2;this.localAnchorB=new b2.Vec2;this.localAxisA=new b2.Vec2(1,0)};goog.inherits(b2.PrismaticJointDef,b2.JointDef);goog.exportSymbol("b2.PrismaticJointDef",b2.PrismaticJointDef);b2.PrismaticJointDef.prototype.localAnchorA=null;goog.exportProperty(b2.PrismaticJointDef.prototype,"localAnchorA",b2.PrismaticJointDef.prototype.localAnchorA);
b2.PrismaticJointDef.prototype.localAnchorB=null;goog.exportProperty(b2.PrismaticJointDef.prototype,"localAnchorB",b2.PrismaticJointDef.prototype.localAnchorB);b2.PrismaticJointDef.prototype.localAxisA=null;goog.exportProperty(b2.PrismaticJointDef.prototype,"localAxisA",b2.PrismaticJointDef.prototype.localAxisA);b2.PrismaticJointDef.prototype.referenceAngle=0;goog.exportProperty(b2.PrismaticJointDef.prototype,"referenceAngle",b2.PrismaticJointDef.prototype.referenceAngle);
b2.PrismaticJointDef.prototype.enableLimit=!1;goog.exportProperty(b2.PrismaticJointDef.prototype,"enableLimit",b2.PrismaticJointDef.prototype.enableLimit);b2.PrismaticJointDef.prototype.lowerTranslation=0;goog.exportProperty(b2.PrismaticJointDef.prototype,"lowerTranslation",b2.PrismaticJointDef.prototype.lowerTranslation);b2.PrismaticJointDef.prototype.upperTranslation=0;goog.exportProperty(b2.PrismaticJointDef.prototype,"upperTranslation",b2.PrismaticJointDef.prototype.upperTranslation);
b2.PrismaticJointDef.prototype.enableMotor=!1;goog.exportProperty(b2.PrismaticJointDef.prototype,"enableMotor",b2.PrismaticJointDef.prototype.enableMotor);b2.PrismaticJointDef.prototype.maxMotorForce=0;goog.exportProperty(b2.PrismaticJointDef.prototype,"maxMotorForce",b2.PrismaticJointDef.prototype.maxMotorForce);b2.PrismaticJointDef.prototype.motorSpeed=0;goog.exportProperty(b2.PrismaticJointDef.prototype,"motorSpeed",b2.PrismaticJointDef.prototype.motorSpeed);
b2.PrismaticJointDef.prototype.Initialize=function(a,b,c,d){this.bodyA=a;this.bodyB=b;this.bodyA.GetLocalPoint(c,this.localAnchorA);this.bodyB.GetLocalPoint(c,this.localAnchorB);this.bodyA.GetLocalVector(d,this.localAxisA);this.referenceAngle=this.bodyB.GetAngle()-this.bodyA.GetAngle()};goog.exportProperty(b2.PrismaticJointDef.prototype,"Initialize",b2.PrismaticJointDef.prototype.Initialize);
b2.PrismaticJoint=function(a){b2.Joint.call(this,a);this.m_localAnchorA=a.localAnchorA.Clone();this.m_localAnchorB=a.localAnchorB.Clone();this.m_localXAxisA=a.localAxisA.Clone().SelfNormalize();this.m_localYAxisA=b2.Cross_S_V2(1,this.m_localXAxisA,new b2.Vec2);this.m_referenceAngle=a.referenceAngle;this.m_impulse=new b2.Vec3(0,0,0);this.m_lowerTranslation=a.lowerTranslation;this.m_upperTranslation=a.upperTranslation;this.m_maxMotorForce=a.maxMotorForce;this.m_motorSpeed=a.motorSpeed;
this.m_enableLimit=a.enableLimit;this.m_enableMotor=a.enableMotor;this.m_localCenterA=new b2.Vec2;this.m_localCenterB=new b2.Vec2;this.m_axis=new b2.Vec2(0,0);this.m_perp=new b2.Vec2(0,0);this.m_K=new b2.Mat33;this.m_K3=new b2.Mat33;this.m_K2=new b2.Mat22;this.m_qA=new b2.Rot;this.m_qB=new b2.Rot;this.m_lalcA=new b2.Vec2;this.m_lalcB=new b2.Vec2;this.m_rA=new b2.Vec2;this.m_rB=new b2.Vec2};goog.inherits(b2.PrismaticJoint,b2.Joint);
goog.exportSymbol("b2.PrismaticJoint",b2.PrismaticJoint);b2.PrismaticJoint.prototype.m_localAnchorA=null;goog.exportProperty(b2.PrismaticJoint.prototype,"m_localAnchorA",b2.PrismaticJoint.prototype.m_localAnchorA);b2.PrismaticJoint.prototype.m_localAnchorB=null;goog.exportProperty(b2.PrismaticJoint.prototype,"m_localAnchorB",b2.PrismaticJoint.prototype.m_localAnchorB);b2.PrismaticJoint.prototype.m_localXAxisA=null;
goog.exportProperty(b2.PrismaticJoint.prototype,"m_localXAxisA",b2.PrismaticJoint.prototype.m_localXAxisA);b2.PrismaticJoint.prototype.m_localYAxisA=null;goog.exportProperty(b2.PrismaticJoint.prototype,"m_localYAxisA",b2.PrismaticJoint.prototype.m_localYAxisA);b2.PrismaticJoint.prototype.m_referenceAngle=0;goog.exportProperty(b2.PrismaticJoint.prototype,"m_referenceAngle",b2.PrismaticJoint.prototype.m_referenceAngle);
b2.PrismaticJoint.prototype.m_impulse=null;goog.exportProperty(b2.PrismaticJoint.prototype,"m_impulse",b2.PrismaticJoint.prototype.m_impulse);b2.PrismaticJoint.prototype.m_motorImpulse=0;goog.exportProperty(b2.PrismaticJoint.prototype,"m_motorImpulse",b2.PrismaticJoint.prototype.m_motorImpulse);b2.PrismaticJoint.prototype.m_lowerTranslation=0;goog.exportProperty(b2.PrismaticJoint.prototype,"m_lowerTranslation",b2.PrismaticJoint.prototype.m_lowerTranslation);
b2.PrismaticJoint.prototype.m_upperTranslation=0;goog.exportProperty(b2.PrismaticJoint.prototype,"m_upperTranslation",b2.PrismaticJoint.prototype.m_upperTranslation);b2.PrismaticJoint.prototype.m_maxMotorForce=0;goog.exportProperty(b2.PrismaticJoint.prototype,"m_maxMotorForce",b2.PrismaticJoint.prototype.m_maxMotorForce);b2.PrismaticJoint.prototype.m_motorSpeed=0;goog.exportProperty(b2.PrismaticJoint.prototype,"m_motorSpeed",b2.PrismaticJoint.prototype.m_motorSpeed);
b2.PrismaticJoint.prototype.m_enableLimit=!1;goog.exportProperty(b2.PrismaticJoint.prototype,"m_enableLimit",b2.PrismaticJoint.prototype.m_enableLimit);b2.PrismaticJoint.prototype.m_enableMotor=!1;goog.exportProperty(b2.PrismaticJoint.prototype,"m_enableMotor",b2.PrismaticJoint.prototype.m_enableMotor);b2.PrismaticJoint.prototype.m_limitState=b2.LimitState.e_inactiveLimit;goog.exportProperty(b2.PrismaticJoint.prototype,"m_limitState",b2.PrismaticJoint.prototype.m_limitState);
b2.PrismaticJoint.prototype.m_indexA=0;goog.exportProperty(b2.PrismaticJoint.prototype,"m_indexA",b2.PrismaticJoint.prototype.m_indexA);b2.PrismaticJoint.prototype.m_indexB=0;goog.exportProperty(b2.PrismaticJoint.prototype,"m_indexB",b2.PrismaticJoint.prototype.m_indexB);b2.PrismaticJoint.prototype.m_localCenterA=null;goog.exportProperty(b2.PrismaticJoint.prototype,"m_localCenterA",b2.PrismaticJoint.prototype.m_localCenterA);
b2.PrismaticJoint.prototype.m_localCenterB=null;goog.exportProperty(b2.PrismaticJoint.prototype,"m_localCenterB",b2.PrismaticJoint.prototype.m_localCenterB);b2.PrismaticJoint.prototype.m_invMassA=0;goog.exportProperty(b2.PrismaticJoint.prototype,"m_invMassA",b2.PrismaticJoint.prototype.m_invMassA);b2.PrismaticJoint.prototype.m_invMassB=0;goog.exportProperty(b2.PrismaticJoint.prototype,"m_invMassB",b2.PrismaticJoint.prototype.m_invMassB);
b2.PrismaticJoint.prototype.m_invIA=0;goog.exportProperty(b2.PrismaticJoint.prototype,"m_invIA",b2.PrismaticJoint.prototype.m_invIA);b2.PrismaticJoint.prototype.m_invIB=0;goog.exportProperty(b2.PrismaticJoint.prototype,"m_invIB",b2.PrismaticJoint.prototype.m_invIB);b2.PrismaticJoint.prototype.m_axis=null;goog.exportProperty(b2.PrismaticJoint.prototype,"m_axis",b2.PrismaticJoint.prototype.m_axis);b2.PrismaticJoint.prototype.m_perp=null;
goog.exportProperty(b2.PrismaticJoint.prototype,"m_perp",b2.PrismaticJoint.prototype.m_perp);b2.PrismaticJoint.prototype.m_s1=0;goog.exportProperty(b2.PrismaticJoint.prototype,"m_s1",b2.PrismaticJoint.prototype.m_s1);b2.PrismaticJoint.prototype.m_s2=0;goog.exportProperty(b2.PrismaticJoint.prototype,"m_s2",b2.PrismaticJoint.prototype.m_s2);b2.PrismaticJoint.prototype.m_a1=0;goog.exportProperty(b2.PrismaticJoint.prototype,"m_a1",b2.PrismaticJoint.prototype.m_a1);
b2.PrismaticJoint.prototype.m_a2=0;goog.exportProperty(b2.PrismaticJoint.prototype,"m_a2",b2.PrismaticJoint.prototype.m_a2);b2.PrismaticJoint.prototype.m_K=null;goog.exportProperty(b2.PrismaticJoint.prototype,"m_K",b2.PrismaticJoint.prototype.m_K);b2.PrismaticJoint.prototype.m_K3=null;goog.exportProperty(b2.PrismaticJoint.prototype,"m_K3",b2.PrismaticJoint.prototype.m_K3);b2.PrismaticJoint.prototype.m_K2=null;
goog.exportProperty(b2.PrismaticJoint.prototype,"m_K2",b2.PrismaticJoint.prototype.m_K2);b2.PrismaticJoint.prototype.m_motorMass=0;goog.exportProperty(b2.PrismaticJoint.prototype,"m_motorMass",b2.PrismaticJoint.prototype.m_motorMass);b2.PrismaticJoint.prototype.m_qA=null;goog.exportProperty(b2.PrismaticJoint.prototype,"m_qA",b2.PrismaticJoint.prototype.m_qA);b2.PrismaticJoint.prototype.m_qB=null;
goog.exportProperty(b2.PrismaticJoint.prototype,"m_qB",b2.PrismaticJoint.prototype.m_qB);b2.PrismaticJoint.prototype.m_lalcA=null;goog.exportProperty(b2.PrismaticJoint.prototype,"m_lalcA",b2.PrismaticJoint.prototype.m_lalcA);b2.PrismaticJoint.prototype.m_lalcB=null;goog.exportProperty(b2.PrismaticJoint.prototype,"m_lalcB",b2.PrismaticJoint.prototype.m_lalcB);b2.PrismaticJoint.prototype.m_rA=null;
goog.exportProperty(b2.PrismaticJoint.prototype,"m_rA",b2.PrismaticJoint.prototype.m_rA);b2.PrismaticJoint.prototype.m_rB=null;goog.exportProperty(b2.PrismaticJoint.prototype,"m_rB",b2.PrismaticJoint.prototype.m_rB);
b2.PrismaticJoint.prototype.InitVelocityConstraints=function(a){this.m_indexA=this.m_bodyA.m_islandIndex;this.m_indexB=this.m_bodyB.m_islandIndex;this.m_localCenterA.Copy(this.m_bodyA.m_sweep.localCenter);this.m_localCenterB.Copy(this.m_bodyB.m_sweep.localCenter);this.m_invMassA=this.m_bodyA.m_invMass;this.m_invMassB=this.m_bodyB.m_invMass;this.m_invIA=this.m_bodyA.m_invI;this.m_invIB=this.m_bodyB.m_invI;var b=a.positions[this.m_indexA].c,c=a.velocities[this.m_indexA].v,d=a.velocities[this.m_indexA].w,
e=a.positions[this.m_indexB].c,f=a.positions[this.m_indexB].a,g=a.velocities[this.m_indexB].v,h=a.velocities[this.m_indexB].w,k=this.m_qA.SetAngle(a.positions[this.m_indexA].a),f=this.m_qB.SetAngle(f);b2.Sub_V2_V2(this.m_localAnchorA,this.m_localCenterA,this.m_lalcA);var l=b2.Mul_R_V2(k,this.m_lalcA,this.m_rA);b2.Sub_V2_V2(this.m_localAnchorB,this.m_localCenterB,this.m_lalcB);var m=b2.Mul_R_V2(f,this.m_lalcB,this.m_rB),n=b2.Add_V2_V2(b2.Sub_V2_V2(e,b,b2.Vec2.s_t0),
b2.Sub_V2_V2(m,l,b2.Vec2.s_t1),b2.PrismaticJoint.prototype.InitVelocityConstraints.s_d),b=this.m_invMassA,e=this.m_invMassB,f=this.m_invIA,p=this.m_invIB;b2.Mul_R_V2(k,this.m_localXAxisA,this.m_axis);this.m_a1=b2.Cross_V2_V2(b2.Add_V2_V2(n,l,b2.Vec2.s_t0),this.m_axis);this.m_a2=b2.Cross_V2_V2(m,this.m_axis);this.m_motorMass=b+e+f*this.m_a1*this.m_a1+p*this.m_a2*this.m_a2;0<this.m_motorMass&&(this.m_motorMass=1/this.m_motorMass);b2.Mul_R_V2(k,this.m_localYAxisA,
this.m_perp);this.m_s1=b2.Cross_V2_V2(b2.Add_V2_V2(n,l,b2.Vec2.s_t0),this.m_perp);this.m_s2=b2.Cross_V2_V2(m,this.m_perp);this.m_K.ex.x=b+e+f*this.m_s1*this.m_s1+p*this.m_s2*this.m_s2;this.m_K.ex.y=f*this.m_s1+p*this.m_s2;this.m_K.ex.z=f*this.m_s1*this.m_a1+p*this.m_s2*this.m_a2;this.m_K.ey.x=this.m_K.ex.y;this.m_K.ey.y=f+p;0===this.m_K.ey.y&&(this.m_K.ey.y=1);this.m_K.ey.z=f*this.m_a1+p*this.m_a2;this.m_K.ez.x=this.m_K.ex.z;this.m_K.ez.y=this.m_K.ey.z;this.m_K.ez.z=b+e+f*this.m_a1*
this.m_a1+p*this.m_a2*this.m_a2;this.m_enableLimit?(k=b2.Dot_V2_V2(this.m_axis,n),b2.Abs(this.m_upperTranslation-this.m_lowerTranslation)<2*b2._linearSlop?this.m_limitState=b2.LimitState.e_equalLimits:k<=this.m_lowerTranslation?this.m_limitState!==b2.LimitState.e_atLowerLimit&&(this.m_limitState=b2.LimitState.e_atLowerLimit,this.m_impulse.z=0):k>=this.m_upperTranslation?this.m_limitState!==b2.LimitState.e_atUpperLimit&&(this.m_limitState=b2.LimitState.e_atUpperLimit,
this.m_impulse.z=0):(this.m_limitState=b2.LimitState.e_inactiveLimit,this.m_impulse.z=0)):(this.m_limitState=b2.LimitState.e_inactiveLimit,this.m_impulse.z=0);this.m_enableMotor||(this.m_motorImpulse=0);a.step.warmStarting?(this.m_impulse.SelfMulScalar(a.step.dtRatio),this.m_motorImpulse*=a.step.dtRatio,k=b2.Add_V2_V2(b2.Mul_S_V2(this.m_impulse.x,this.m_perp,b2.Vec2.s_t0),b2.Mul_S_V2(this.m_motorImpulse+this.m_impulse.z,this.m_axis,b2.Vec2.s_t1),b2.PrismaticJoint.prototype.InitVelocityConstraints.s_P),
l=this.m_impulse.x*this.m_s1+this.m_impulse.y+(this.m_motorImpulse+this.m_impulse.z)*this.m_a1,m=this.m_impulse.x*this.m_s2+this.m_impulse.y+(this.m_motorImpulse+this.m_impulse.z)*this.m_a2,c.SelfMulSub(b,k),d-=f*l,g.SelfMulAdd(e,k),h+=p*m):(this.m_impulse.SetZero(),this.m_motorImpulse=0);a.velocities[this.m_indexA].w=d;a.velocities[this.m_indexB].w=h};goog.exportProperty(b2.PrismaticJoint.prototype,"InitVelocityConstraints",b2.PrismaticJoint.prototype.InitVelocityConstraints);
b2.PrismaticJoint.prototype.InitVelocityConstraints.s_d=new b2.Vec2;b2.PrismaticJoint.prototype.InitVelocityConstraints.s_P=new b2.Vec2;
b2.PrismaticJoint.prototype.SolveVelocityConstraints=function(a){var b=a.velocities[this.m_indexA].v,c=a.velocities[this.m_indexA].w,d=a.velocities[this.m_indexB].v,e=a.velocities[this.m_indexB].w,f=this.m_invMassA,g=this.m_invMassB,h=this.m_invIA,k=this.m_invIB;if(this.m_enableMotor&&this.m_limitState!==b2.LimitState.e_equalLimits){var l=b2.Dot_V2_V2(this.m_axis,b2.Sub_V2_V2(d,b,b2.Vec2.s_t0))+this.m_a2*e-this.m_a1*c,l=this.m_motorMass*(this.m_motorSpeed-l),m=this.m_motorImpulse,
n=a.step.dt*this.m_maxMotorForce;this.m_motorImpulse=b2.Clamp(this.m_motorImpulse+l,-n,n);l=this.m_motorImpulse-m;m=b2.Mul_S_V2(l,this.m_axis,b2.PrismaticJoint.prototype.SolveVelocityConstraints.s_P);n=l*this.m_a1;l*=this.m_a2;b.SelfMulSub(f,m);c-=h*n;d.SelfMulAdd(g,m);e+=k*l}var n=b2.Dot_V2_V2(this.m_perp,b2.Sub_V2_V2(d,b,b2.Vec2.s_t0))+this.m_s2*e-this.m_s1*c,p=e-c;this.m_enableLimit&&this.m_limitState!==b2.LimitState.e_inactiveLimit?(l=b2.Dot_V2_V2(this.m_axis,
b2.Sub_V2_V2(d,b,b2.Vec2.s_t0))+this.m_a2*e-this.m_a1*c,m=b2.PrismaticJoint.prototype.SolveVelocityConstraints.s_f1.Copy(this.m_impulse),l=this.m_K.Solve33(-n,-p,-l,b2.PrismaticJoint.prototype.SolveVelocityConstraints.s_df3),this.m_impulse.SelfAdd(l),this.m_limitState===b2.LimitState.e_atLowerLimit?this.m_impulse.z=b2.Max(this.m_impulse.z,0):this.m_limitState===b2.LimitState.e_atUpperLimit&&(this.m_impulse.z=b2.Min(this.m_impulse.z,0)),n=this.m_K.Solve22(-n-
(this.m_impulse.z-m.z)*this.m_K.ez.x,-p-(this.m_impulse.z-m.z)*this.m_K.ez.y,b2.PrismaticJoint.prototype.SolveVelocityConstraints.s_f2r),n.x+=m.x,n.y+=m.y,this.m_impulse.x=n.x,this.m_impulse.y=n.y,l.x=this.m_impulse.x-m.x,l.y=this.m_impulse.y-m.y,l.z=this.m_impulse.z-m.z,m=b2.Add_V2_V2(b2.Mul_S_V2(l.x,this.m_perp,b2.Vec2.s_t0),b2.Mul_S_V2(l.z,this.m_axis,b2.Vec2.s_t1),b2.PrismaticJoint.prototype.SolveVelocityConstraints.s_P),n=l.x*this.m_s1+l.y+l.z*this.m_a1,l=l.x*
this.m_s2+l.y+l.z*this.m_a2):(l=this.m_K.Solve22(-n,-p,b2.PrismaticJoint.prototype.SolveVelocityConstraints.s_df2),this.m_impulse.x+=l.x,this.m_impulse.y+=l.y,m=b2.Mul_S_V2(l.x,this.m_perp,b2.PrismaticJoint.prototype.SolveVelocityConstraints.s_P),n=l.x*this.m_s1+l.y,l=l.x*this.m_s2+l.y);b.SelfMulSub(f,m);c-=h*n;d.SelfMulAdd(g,m);a.velocities[this.m_indexA].w=c;a.velocities[this.m_indexB].w=e+k*l};goog.exportProperty(b2.PrismaticJoint.prototype,"SolveVelocityConstraints",b2.PrismaticJoint.prototype.SolveVelocityConstraints);
b2.PrismaticJoint.prototype.SolveVelocityConstraints.s_P=new b2.Vec2;b2.PrismaticJoint.prototype.SolveVelocityConstraints.s_f2r=new b2.Vec2;b2.PrismaticJoint.prototype.SolveVelocityConstraints.s_f1=new b2.Vec3;b2.PrismaticJoint.prototype.SolveVelocityConstraints.s_df3=new b2.Vec3;b2.PrismaticJoint.prototype.SolveVelocityConstraints.s_df2=new b2.Vec2;
b2.PrismaticJoint.prototype.SolvePositionConstraints=function(a){var b=a.positions[this.m_indexA].c,c=a.positions[this.m_indexA].a,d=a.positions[this.m_indexB].c,e=a.positions[this.m_indexB].a,f=this.m_qA.SetAngle(c),g=this.m_qB.SetAngle(e),h=this.m_invMassA,k=this.m_invMassB,l=this.m_invIA,m=this.m_invIB,n=b2.Mul_R_V2(f,this.m_lalcA,this.m_rA),p=b2.Mul_R_V2(g,this.m_lalcB,this.m_rB),q=b2.Sub_V2_V2(b2.Add_V2_V2(d,p,b2.Vec2.s_t0),b2.Add_V2_V2(b,n,b2.Vec2.s_t1),
b2.PrismaticJoint.prototype.SolvePositionConstraints.s_d),r=b2.Mul_R_V2(f,this.m_localXAxisA,this.m_axis),u=b2.Cross_V2_V2(b2.Add_V2_V2(q,n,b2.Vec2.s_t0),r),g=b2.Cross_V2_V2(p,r),f=b2.Mul_R_V2(f,this.m_localYAxisA,this.m_perp),t=b2.Cross_V2_V2(b2.Add_V2_V2(q,n,b2.Vec2.s_t0),f),w=b2.Cross_V2_V2(p,f),x=b2.PrismaticJoint.prototype.SolvePositionConstraints.s_impulse,v=b2.Dot_V2_V2(f,q),y=e-c-this.m_referenceAngle,n=b2.Abs(v),p=b2.Abs(y),
z=!1,B=0;this.m_enableLimit&&(q=b2.Dot_V2_V2(r,q),b2.Abs(this.m_upperTranslation-this.m_lowerTranslation)<2*b2._linearSlop?(B=b2.Clamp(q,-b2._maxLinearCorrection,b2._maxLinearCorrection),n=b2.Max(n,b2.Abs(q)),z=!0):q<=this.m_lowerTranslation?(B=b2.Clamp(q-this.m_lowerTranslation+b2._linearSlop,-b2._maxLinearCorrection,0),n=b2.Max(n,this.m_lowerTranslation-q),z=!0):q>=this.m_upperTranslation&&(B=b2.Clamp(q-this.m_upperTranslation-b2._linearSlop,
0,b2._maxLinearCorrection),n=b2.Max(n,q-this.m_upperTranslation),z=!0));if(z){var q=l*t+m*w,E=l*t*u+m*w*g,z=l+m;0===z&&(z=1);var F=l*u+m*g,G=h+k+l*u*u+m*g*g,H=this.m_K3;H.ex.Set(h+k+l*t*t+m*w*w,q,E);H.ey.Set(q,z,F);H.ez.Set(E,F,G);x=H.Solve33(-v,-y,-B,x)}else q=l*t+m*w,z=l+m,0===z&&(z=1),B=this.m_K2,B.ex.Set(h+k+l*t*t+m*w*w,q),B.ey.Set(q,z),v=B.Solve(-v,-y,b2.PrismaticJoint.prototype.SolvePositionConstraints.s_impulse1),x.x=v.x,x.y=v.y,x.z=0;r=b2.Add_V2_V2(b2.Mul_S_V2(x.x,
f,b2.Vec2.s_t0),b2.Mul_S_V2(x.z,r,b2.Vec2.s_t1),b2.PrismaticJoint.prototype.SolvePositionConstraints.s_P);u=x.x*t+x.y+x.z*u;g=x.x*w+x.y+x.z*g;b.SelfMulSub(h,r);c-=l*u;d.SelfMulAdd(k,r);a.positions[this.m_indexA].a=c;a.positions[this.m_indexB].a=e+m*g;return n<=b2._linearSlop&&p<=b2._angularSlop};goog.exportProperty(b2.PrismaticJoint.prototype,"SolvePositionConstraints",b2.PrismaticJoint.prototype.SolvePositionConstraints);
b2.PrismaticJoint.prototype.SolvePositionConstraints.s_d=new b2.Vec2;b2.PrismaticJoint.prototype.SolvePositionConstraints.s_impulse=new b2.Vec3;b2.PrismaticJoint.prototype.SolvePositionConstraints.s_impulse1=new b2.Vec2;b2.PrismaticJoint.prototype.SolvePositionConstraints.s_P=new b2.Vec2;b2.PrismaticJoint.prototype.GetAnchorA=function(a){return this.m_bodyA.GetWorldPoint(this.m_localAnchorA,a)};
goog.exportProperty(b2.PrismaticJoint.prototype,"GetAnchorA",b2.PrismaticJoint.prototype.GetAnchorA);b2.PrismaticJoint.prototype.GetAnchorB=function(a){return this.m_bodyB.GetWorldPoint(this.m_localAnchorB,a)};goog.exportProperty(b2.PrismaticJoint.prototype,"GetAnchorB",b2.PrismaticJoint.prototype.GetAnchorB);
b2.PrismaticJoint.prototype.GetReactionForce=function(a,b){return b.Set(a*(this.m_impulse.x*this.m_perp.x+(this.m_motorImpulse+this.m_impulse.z)*this.m_axis.x),a*(this.m_impulse.x*this.m_perp.y+(this.m_motorImpulse+this.m_impulse.z)*this.m_axis.y))};goog.exportProperty(b2.PrismaticJoint.prototype,"GetReactionForce",b2.PrismaticJoint.prototype.GetReactionForce);b2.PrismaticJoint.prototype.GetReactionTorque=function(a){return a*this.m_impulse.y};
goog.exportProperty(b2.PrismaticJoint.prototype,"GetReactionTorque",b2.PrismaticJoint.prototype.GetReactionTorque);b2.PrismaticJoint.prototype.GetLocalAnchorA=function(a){return a.Copy(this.m_localAnchorA)};goog.exportProperty(b2.PrismaticJoint.prototype,"GetLocalAnchorA",b2.PrismaticJoint.prototype.GetLocalAnchorA);b2.PrismaticJoint.prototype.GetLocalAnchorB=function(a){return a.Copy(this.m_localAnchorB)};
goog.exportProperty(b2.PrismaticJoint.prototype,"GetLocalAnchorB",b2.PrismaticJoint.prototype.GetLocalAnchorB);b2.PrismaticJoint.prototype.GetLocalAxisA=function(a){return a.Copy(this.m_localXAxisA)};goog.exportProperty(b2.PrismaticJoint.prototype,"GetLocalAxisA",b2.PrismaticJoint.prototype.GetLocalAxisA);b2.PrismaticJoint.prototype.GetReferenceAngle=function(){return this.m_referenceAngle};goog.exportProperty(b2.PrismaticJoint.prototype,"GetReferenceAngle",b2.PrismaticJoint.prototype.GetReferenceAngle);
b2.PrismaticJoint.prototype.GetJointTranslation=function(){var a=this.m_bodyA.GetWorldPoint(this.m_localAnchorA,b2.PrismaticJoint.prototype.GetJointTranslation.s_pA),b=this.m_bodyB.GetWorldPoint(this.m_localAnchorB,b2.PrismaticJoint.prototype.GetJointTranslation.s_pB),a=b2.Sub_V2_V2(b,a,b2.PrismaticJoint.prototype.GetJointTranslation.s_d),b=this.m_bodyA.GetWorldVector(this.m_localXAxisA,b2.PrismaticJoint.prototype.GetJointTranslation.s_axis);return b2.Dot_V2_V2(a,
b)};goog.exportProperty(b2.PrismaticJoint.prototype,"GetJointTranslation",b2.PrismaticJoint.prototype.GetJointTranslation);b2.PrismaticJoint.prototype.GetJointTranslation.s_pA=new b2.Vec2;b2.PrismaticJoint.prototype.GetJointTranslation.s_pB=new b2.Vec2;b2.PrismaticJoint.prototype.GetJointTranslation.s_d=new b2.Vec2;b2.PrismaticJoint.prototype.GetJointTranslation.s_axis=new b2.Vec2;
b2.PrismaticJoint.prototype.GetJointSpeed=function(){var a=this.m_bodyA,b=this.m_bodyB;b2.Sub_V2_V2(this.m_localAnchorA,a.m_sweep.localCenter,this.m_lalcA);var c=b2.Mul_R_V2(a.m_xf.q,this.m_lalcA,this.m_rA);b2.Sub_V2_V2(this.m_localAnchorB,b.m_sweep.localCenter,this.m_lalcB);var d=b2.Mul_R_V2(b.m_xf.q,this.m_lalcB,this.m_rB),e=b2.Add_V2_V2(a.m_sweep.c,c,b2.Vec2.s_t0),f=b2.Add_V2_V2(b.m_sweep.c,d,b2.Vec2.s_t1),e=b2.Sub_V2_V2(f,e,b2.Vec2.s_t2),
f=a.GetWorldVector(this.m_localXAxisA,this.m_axis),g=a.m_linearVelocity,h=b.m_linearVelocity,a=a.m_angularVelocity,b=b.m_angularVelocity;return b2.Dot_V2_V2(e,b2.Cross_S_V2(a,f,b2.Vec2.s_t0))+b2.Dot_V2_V2(f,b2.Sub_V2_V2(b2.AddCross_V2_S_V2(h,b,d,b2.Vec2.s_t0),b2.AddCross_V2_S_V2(g,a,c,b2.Vec2.s_t1),b2.Vec2.s_t0))};goog.exportProperty(b2.PrismaticJoint.prototype,"GetJointSpeed",b2.PrismaticJoint.prototype.GetJointSpeed);
b2.PrismaticJoint.prototype.IsLimitEnabled=function(){return this.m_enableLimit};goog.exportProperty(b2.PrismaticJoint.prototype,"IsLimitEnabled",b2.PrismaticJoint.prototype.IsLimitEnabled);b2.PrismaticJoint.prototype.EnableLimit=function(a){a!==this.m_enableLimit&&(this.m_bodyA.SetAwake(!0),this.m_bodyB.SetAwake(!0),this.m_enableLimit=a,this.m_impulse.z=0)};goog.exportProperty(b2.PrismaticJoint.prototype,"EnableLimit",b2.PrismaticJoint.prototype.EnableLimit);
b2.PrismaticJoint.prototype.GetLowerLimit=function(){return this.m_lowerTranslation};goog.exportProperty(b2.PrismaticJoint.prototype,"GetLowerLimit",b2.PrismaticJoint.prototype.GetLowerLimit);b2.PrismaticJoint.prototype.GetUpperLimit=function(){return this.m_upperTranslation};goog.exportProperty(b2.PrismaticJoint.prototype,"GetUpperLimit",b2.PrismaticJoint.prototype.GetUpperLimit);
b2.PrismaticJoint.prototype.SetLimits=function(a,b){if(a!==this.m_lowerTranslation||b!==this.m_upperTranslation)this.m_bodyA.SetAwake(!0),this.m_bodyB.SetAwake(!0),this.m_lowerTranslation=a,this.m_upperTranslation=b,this.m_impulse.z=0};goog.exportProperty(b2.PrismaticJoint.prototype,"SetLimits",b2.PrismaticJoint.prototype.SetLimits);b2.PrismaticJoint.prototype.IsMotorEnabled=function(){return this.m_enableMotor};
goog.exportProperty(b2.PrismaticJoint.prototype,"IsMotorEnabled",b2.PrismaticJoint.prototype.IsMotorEnabled);b2.PrismaticJoint.prototype.EnableMotor=function(a){this.m_bodyA.SetAwake(!0);this.m_bodyB.SetAwake(!0);this.m_enableMotor=a};goog.exportProperty(b2.PrismaticJoint.prototype,"EnableMotor",b2.PrismaticJoint.prototype.EnableMotor);b2.PrismaticJoint.prototype.SetMotorSpeed=function(a){this.m_bodyA.SetAwake(!0);this.m_bodyB.SetAwake(!0);this.m_motorSpeed=a};
goog.exportProperty(b2.PrismaticJoint.prototype,"SetMotorSpeed",b2.PrismaticJoint.prototype.SetMotorSpeed);b2.PrismaticJoint.prototype.GetMotorSpeed=function(){return this.m_motorSpeed};goog.exportProperty(b2.PrismaticJoint.prototype,"GetMotorSpeed",b2.PrismaticJoint.prototype.GetMotorSpeed);b2.PrismaticJoint.prototype.SetMaxMotorForce=function(a){this.m_bodyA.SetAwake(!0);this.m_bodyB.SetAwake(!0);this.m_maxMotorForce=a};
goog.exportProperty(b2.PrismaticJoint.prototype,"SetMaxMotorForce",b2.PrismaticJoint.prototype.SetMaxMotorForce);b2.PrismaticJoint.prototype.GetMaxMotorForce=function(){return this.m_maxMotorForce};goog.exportProperty(b2.PrismaticJoint.prototype,"GetMaxMotorForce",b2.PrismaticJoint.prototype.GetMaxMotorForce);b2.PrismaticJoint.prototype.GetMotorForce=function(a){return a*this.m_motorImpulse};goog.exportProperty(b2.PrismaticJoint.prototype,"GetMotorForce",b2.PrismaticJoint.prototype.GetMotorForce);
b2.PrismaticJoint.prototype.Dump=function(){if(b2.DEBUG){var a=this.m_bodyA.m_islandIndex,b=this.m_bodyB.m_islandIndex;b2.Log("  /*b2.PrismaticJointDef*/ var jd = new b2.PrismaticJointDef();\n");b2.Log("  jd.bodyA = bodies[%d];\n",a);b2.Log("  jd.bodyB = bodies[%d];\n",b);b2.Log("  jd.collideConnected = %s;\n",this.m_collideConnected?"true":"false");b2.Log("  jd.localAnchorA.Set(%.15f, %.15f);\n",this.m_localAnchorA.x,this.m_localAnchorA.y);b2.Log("  jd.localAnchorB.Set(%.15f, %.15f);\n",
this.m_localAnchorB.x,this.m_localAnchorB.y);b2.Log("  jd.localAxisA.Set(%.15f, %.15f);\n",this.m_localXAxisA.x,this.m_localXAxisA.y);b2.Log("  jd.referenceAngle = %.15f;\n",this.m_referenceAngle);b2.Log("  jd.enableLimit = %s;\n",this.m_enableLimit?"true":"false");b2.Log("  jd.lowerTranslation = %.15f;\n",this.m_lowerTranslation);b2.Log("  jd.upperTranslation = %.15f;\n",this.m_upperTranslation);b2.Log("  jd.enableMotor = %s;\n",this.m_enableMotor?"true":"false");b2.Log("  jd.motorSpeed = %.15f;\n",
this.m_motorSpeed);b2.Log("  jd.maxMotorForce = %.15f;\n",this.m_maxMotorForce);b2.Log("  joints[%d] = this.m_world.CreateJoint(jd);\n",this.m_index)}};goog.exportProperty(b2.PrismaticJoint.prototype,"Dump",b2.PrismaticJoint.prototype.Dump);b2._minPulleyLength=2;goog.exportSymbol("b2._minPulleyLength",b2._minPulleyLength);b2.PulleyJointDef=function(){b2.JointDef.call(this,b2.JointType.e_pulleyJoint);this.collideConnected=!0;this.groundAnchorA=new b2.Vec2(-1,1);this.groundAnchorB=new b2.Vec2(1,1);this.localAnchorA=new b2.Vec2(-1,0);this.localAnchorB=new b2.Vec2(1,0)};goog.inherits(b2.PulleyJointDef,b2.JointDef);goog.exportSymbol("b2.PulleyJointDef",b2.PulleyJointDef);
b2.PulleyJointDef.prototype.groundAnchorA=null;goog.exportProperty(b2.PulleyJointDef.prototype,"groundAnchorA",b2.PulleyJointDef.prototype.groundAnchorA);b2.PulleyJointDef.prototype.groundAnchorB=null;goog.exportProperty(b2.PulleyJointDef.prototype,"groundAnchorB",b2.PulleyJointDef.prototype.groundAnchorB);b2.PulleyJointDef.prototype.localAnchorA=null;goog.exportProperty(b2.PulleyJointDef.prototype,"localAnchorA",b2.PulleyJointDef.prototype.localAnchorA);
b2.PulleyJointDef.prototype.localAnchorB=null;goog.exportProperty(b2.PulleyJointDef.prototype,"localAnchorB",b2.PulleyJointDef.prototype.localAnchorB);b2.PulleyJointDef.prototype.lengthA=0;goog.exportProperty(b2.PulleyJointDef.prototype,"lengthA",b2.PulleyJointDef.prototype.lengthA);b2.PulleyJointDef.prototype.lengthB=0;goog.exportProperty(b2.PulleyJointDef.prototype,"lengthB",b2.PulleyJointDef.prototype.lengthB);
b2.PulleyJointDef.prototype.ratio=1;goog.exportProperty(b2.PulleyJointDef.prototype,"ratio",b2.PulleyJointDef.prototype.ratio);
b2.PulleyJointDef.prototype.Initialize=function(a,b,c,d,e,f,g){this.bodyA=a;this.bodyB=b;this.groundAnchorA.Copy(c);this.groundAnchorB.Copy(d);this.bodyA.GetLocalPoint(e,this.localAnchorA);this.bodyB.GetLocalPoint(f,this.localAnchorB);this.lengthA=b2.Distance(e,c);this.lengthB=b2.Distance(f,d);this.ratio=g;b2.ENABLE_ASSERTS&&b2.Assert(this.ratio>b2._epsilon)};goog.exportProperty(b2.PulleyJointDef.prototype,"Initialize",b2.PulleyJointDef.prototype.Initialize);
b2.PulleyJoint=function(a){b2.Joint.call(this,a);this.m_groundAnchorA=new b2.Vec2;this.m_groundAnchorB=new b2.Vec2;this.m_localAnchorA=new b2.Vec2;this.m_localAnchorB=new b2.Vec2;this.m_uA=new b2.Vec2;this.m_uB=new b2.Vec2;this.m_rA=new b2.Vec2;this.m_rB=new b2.Vec2;this.m_localCenterA=new b2.Vec2;this.m_localCenterB=new b2.Vec2;this.m_qA=new b2.Rot;this.m_qB=new b2.Rot;this.m_lalcA=new b2.Vec2;this.m_lalcB=new b2.Vec2;
this.m_groundAnchorA.Copy(a.groundAnchorA);this.m_groundAnchorB.Copy(a.groundAnchorB);this.m_localAnchorA.Copy(a.localAnchorA);this.m_localAnchorB.Copy(a.localAnchorB);this.m_lengthA=a.lengthA;this.m_lengthB=a.lengthB;b2.ENABLE_ASSERTS&&b2.Assert(0!==a.ratio);this.m_ratio=a.ratio;this.m_constant=a.lengthA+this.m_ratio*a.lengthB;this.m_impulse=0};goog.inherits(b2.PulleyJoint,b2.Joint);goog.exportSymbol("b2.PulleyJoint",b2.PulleyJoint);
b2.PulleyJoint.prototype.m_groundAnchorA=null;goog.exportProperty(b2.PulleyJoint.prototype,"m_groundAnchorA",b2.PulleyJoint.prototype.m_groundAnchorA);b2.PulleyJoint.prototype.m_groundAnchorB=null;goog.exportProperty(b2.PulleyJoint.prototype,"m_groundAnchorB",b2.PulleyJoint.prototype.m_groundAnchorB);b2.PulleyJoint.prototype.m_lengthA=0;goog.exportProperty(b2.PulleyJoint.prototype,"m_lengthA",b2.PulleyJoint.prototype.m_lengthA);
b2.PulleyJoint.prototype.m_lengthB=0;goog.exportProperty(b2.PulleyJoint.prototype,"m_lengthB",b2.PulleyJoint.prototype.m_lengthB);b2.PulleyJoint.prototype.m_localAnchorA=null;goog.exportProperty(b2.PulleyJoint.prototype,"m_localAnchorA",b2.PulleyJoint.prototype.m_localAnchorA);b2.PulleyJoint.prototype.m_localAnchorB=null;goog.exportProperty(b2.PulleyJoint.prototype,"m_localAnchorB",b2.PulleyJoint.prototype.m_localAnchorB);
b2.PulleyJoint.prototype.m_constant=0;goog.exportProperty(b2.PulleyJoint.prototype,"m_constant",b2.PulleyJoint.prototype.m_constant);b2.PulleyJoint.prototype.m_ratio=0;goog.exportProperty(b2.PulleyJoint.prototype,"m_ratio",b2.PulleyJoint.prototype.m_ratio);b2.PulleyJoint.prototype.m_impulse=0;goog.exportProperty(b2.PulleyJoint.prototype,"m_impulse",b2.PulleyJoint.prototype.m_impulse);b2.PulleyJoint.prototype.m_indexA=0;
goog.exportProperty(b2.PulleyJoint.prototype,"m_indexA",b2.PulleyJoint.prototype.m_indexA);b2.PulleyJoint.prototype.m_indexB=0;goog.exportProperty(b2.PulleyJoint.prototype,"m_indexB",b2.PulleyJoint.prototype.m_indexB);b2.PulleyJoint.prototype.m_uA=null;goog.exportProperty(b2.PulleyJoint.prototype,"m_uA",b2.PulleyJoint.prototype.m_uA);b2.PulleyJoint.prototype.m_uB=null;goog.exportProperty(b2.PulleyJoint.prototype,"m_uB",b2.PulleyJoint.prototype.m_uB);
b2.PulleyJoint.prototype.m_rA=null;goog.exportProperty(b2.PulleyJoint.prototype,"m_rA",b2.PulleyJoint.prototype.m_rA);b2.PulleyJoint.prototype.m_rB=null;goog.exportProperty(b2.PulleyJoint.prototype,"m_rB",b2.PulleyJoint.prototype.m_rB);b2.PulleyJoint.prototype.m_localCenterA=null;goog.exportProperty(b2.PulleyJoint.prototype,"m_localCenterA",b2.PulleyJoint.prototype.m_localCenterA);b2.PulleyJoint.prototype.m_localCenterB=null;
goog.exportProperty(b2.PulleyJoint.prototype,"m_localCenterB",b2.PulleyJoint.prototype.m_localCenterB);b2.PulleyJoint.prototype.m_invMassA=0;goog.exportProperty(b2.PulleyJoint.prototype,"m_invMassA",b2.PulleyJoint.prototype.m_invMassA);b2.PulleyJoint.prototype.m_invMassB=0;goog.exportProperty(b2.PulleyJoint.prototype,"m_invMassB",b2.PulleyJoint.prototype.m_invMassB);b2.PulleyJoint.prototype.m_invIA=0;
goog.exportProperty(b2.PulleyJoint.prototype,"m_invIA",b2.PulleyJoint.prototype.m_invIA);b2.PulleyJoint.prototype.m_invIB=0;goog.exportProperty(b2.PulleyJoint.prototype,"m_invIB",b2.PulleyJoint.prototype.m_invIB);b2.PulleyJoint.prototype.m_mass=0;goog.exportProperty(b2.PulleyJoint.prototype,"m_mass",b2.PulleyJoint.prototype.m_mass);b2.PulleyJoint.prototype.m_qA=null;goog.exportProperty(b2.PulleyJoint.prototype,"m_qA",b2.PulleyJoint.prototype.m_qA);
b2.PulleyJoint.prototype.m_qB=null;goog.exportProperty(b2.PulleyJoint.prototype,"m_qB",b2.PulleyJoint.prototype.m_qB);b2.PulleyJoint.prototype.m_lalcA=null;goog.exportProperty(b2.PulleyJoint.prototype,"m_lalcA",b2.PulleyJoint.prototype.m_lalcA);b2.PulleyJoint.prototype.m_lalcB=null;goog.exportProperty(b2.PulleyJoint.prototype,"m_lalcB",b2.PulleyJoint.prototype.m_lalcB);
b2.PulleyJoint.prototype.InitVelocityConstraints=function(a){this.m_indexA=this.m_bodyA.m_islandIndex;this.m_indexB=this.m_bodyB.m_islandIndex;this.m_localCenterA.Copy(this.m_bodyA.m_sweep.localCenter);this.m_localCenterB.Copy(this.m_bodyB.m_sweep.localCenter);this.m_invMassA=this.m_bodyA.m_invMass;this.m_invMassB=this.m_bodyB.m_invMass;this.m_invIA=this.m_bodyA.m_invI;this.m_invIB=this.m_bodyB.m_invI;var b=a.positions[this.m_indexA].c,c=a.velocities[this.m_indexA].v,d=a.velocities[this.m_indexA].w,
e=a.positions[this.m_indexB].c,f=a.positions[this.m_indexB].a,g=a.velocities[this.m_indexB].v,h=a.velocities[this.m_indexB].w,k=this.m_qA.SetAngle(a.positions[this.m_indexA].a),f=this.m_qB.SetAngle(f);b2.Sub_V2_V2(this.m_localAnchorA,this.m_localCenterA,this.m_lalcA);b2.Mul_R_V2(k,this.m_lalcA,this.m_rA);b2.Sub_V2_V2(this.m_localAnchorB,this.m_localCenterB,this.m_lalcB);b2.Mul_R_V2(f,this.m_lalcB,this.m_rB);this.m_uA.Copy(b).SelfAdd(this.m_rA).SelfSub(this.m_groundAnchorA);this.m_uB.Copy(e).SelfAdd(this.m_rB).SelfSub(this.m_groundAnchorB);
b=this.m_uA.Length();e=this.m_uB.Length();b>10*b2._linearSlop?this.m_uA.SelfMul(1/b):this.m_uA.SetZero();e>10*b2._linearSlop?this.m_uB.SelfMul(1/e):this.m_uB.SetZero();b=b2.Cross_V2_V2(this.m_rA,this.m_uA);e=b2.Cross_V2_V2(this.m_rB,this.m_uB);this.m_mass=this.m_invMassA+this.m_invIA*b*b+this.m_ratio*this.m_ratio*(this.m_invMassB+this.m_invIB*e*e);0<this.m_mass&&(this.m_mass=1/this.m_mass);a.step.warmStarting?(this.m_impulse*=a.step.dtRatio,b=b2.Mul_S_V2(-this.m_impulse,this.m_uA,
b2.PulleyJoint.prototype.InitVelocityConstraints.s_PA),e=b2.Mul_S_V2(-this.m_ratio*this.m_impulse,this.m_uB,b2.PulleyJoint.prototype.InitVelocityConstraints.s_PB),c.SelfMulAdd(this.m_invMassA,b),d+=this.m_invIA*b2.Cross_V2_V2(this.m_rA,b),g.SelfMulAdd(this.m_invMassB,e),h+=this.m_invIB*b2.Cross_V2_V2(this.m_rB,e)):this.m_impulse=0;a.velocities[this.m_indexA].w=d;a.velocities[this.m_indexB].w=h};goog.exportProperty(b2.PulleyJoint.prototype,"InitVelocityConstraints",b2.PulleyJoint.prototype.InitVelocityConstraints);
b2.PulleyJoint.prototype.InitVelocityConstraints.s_PA=new b2.Vec2;b2.PulleyJoint.prototype.InitVelocityConstraints.s_PB=new b2.Vec2;
b2.PulleyJoint.prototype.SolveVelocityConstraints=function(a){var b=a.velocities[this.m_indexA].v,c=a.velocities[this.m_indexA].w,d=a.velocities[this.m_indexB].v,e=a.velocities[this.m_indexB].w,f=b2.AddCross_V2_S_V2(b,c,this.m_rA,b2.PulleyJoint.prototype.SolveVelocityConstraints.s_vpA),g=b2.AddCross_V2_S_V2(d,e,this.m_rB,b2.PulleyJoint.prototype.SolveVelocityConstraints.s_vpB),f=-b2.Dot_V2_V2(this.m_uA,f)-this.m_ratio*b2.Dot_V2_V2(this.m_uB,g),g=-this.m_mass*f;this.m_impulse+=
g;f=b2.Mul_S_V2(-g,this.m_uA,b2.PulleyJoint.prototype.SolveVelocityConstraints.s_PA);g=b2.Mul_S_V2(-this.m_ratio*g,this.m_uB,b2.PulleyJoint.prototype.SolveVelocityConstraints.s_PB);b.SelfMulAdd(this.m_invMassA,f);c+=this.m_invIA*b2.Cross_V2_V2(this.m_rA,f);d.SelfMulAdd(this.m_invMassB,g);e+=this.m_invIB*b2.Cross_V2_V2(this.m_rB,g);a.velocities[this.m_indexA].w=c;a.velocities[this.m_indexB].w=e};
goog.exportProperty(b2.PulleyJoint.prototype,"SolveVelocityConstraints",b2.PulleyJoint.prototype.SolveVelocityConstraints);b2.PulleyJoint.prototype.SolveVelocityConstraints.s_vpA=new b2.Vec2;b2.PulleyJoint.prototype.SolveVelocityConstraints.s_vpB=new b2.Vec2;b2.PulleyJoint.prototype.SolveVelocityConstraints.s_PA=new b2.Vec2;b2.PulleyJoint.prototype.SolveVelocityConstraints.s_PB=new b2.Vec2;
b2.PulleyJoint.prototype.SolvePositionConstraints=function(a){var b=a.positions[this.m_indexA].c,c=a.positions[this.m_indexA].a,d=a.positions[this.m_indexB].c,e=a.positions[this.m_indexB].a,f=this.m_qA.SetAngle(c),g=this.m_qB.SetAngle(e);b2.Sub_V2_V2(this.m_localAnchorA,this.m_localCenterA,this.m_lalcA);f=b2.Mul_R_V2(f,this.m_lalcA,this.m_rA);b2.Sub_V2_V2(this.m_localAnchorB,this.m_localCenterB,this.m_lalcB);var g=b2.Mul_R_V2(g,this.m_lalcB,this.m_rB),h=this.m_uA.Copy(b).SelfAdd(f).SelfSub(this.m_groundAnchorA),
k=this.m_uB.Copy(d).SelfAdd(g).SelfSub(this.m_groundAnchorB),l=h.Length(),m=k.Length();l>10*b2._linearSlop?h.SelfMul(1/l):h.SetZero();m>10*b2._linearSlop?k.SelfMul(1/m):k.SetZero();var n=b2.Cross_V2_V2(f,h),p=b2.Cross_V2_V2(g,k),n=this.m_invMassA+this.m_invIA*n*n+this.m_ratio*this.m_ratio*(this.m_invMassB+this.m_invIB*p*p);0<n&&(n=1/n);m=this.m_constant-l-this.m_ratio*m;l=b2.Abs(m);m*=-n;h=b2.Mul_S_V2(-m,h,b2.PulleyJoint.prototype.SolvePositionConstraints.s_PA);
k=b2.Mul_S_V2(-this.m_ratio*m,k,b2.PulleyJoint.prototype.SolvePositionConstraints.s_PB);b.SelfMulAdd(this.m_invMassA,h);c+=this.m_invIA*b2.Cross_V2_V2(f,h);d.SelfMulAdd(this.m_invMassB,k);e+=this.m_invIB*b2.Cross_V2_V2(g,k);a.positions[this.m_indexA].a=c;a.positions[this.m_indexB].a=e;return l<b2._linearSlop};goog.exportProperty(b2.PulleyJoint.prototype,"SolvePositionConstraints",b2.PulleyJoint.prototype.SolvePositionConstraints);
b2.PulleyJoint.prototype.SolvePositionConstraints.s_PA=new b2.Vec2;b2.PulleyJoint.prototype.SolvePositionConstraints.s_PB=new b2.Vec2;b2.PulleyJoint.prototype.GetAnchorA=function(a){return this.m_bodyA.GetWorldPoint(this.m_localAnchorA,a)};goog.exportProperty(b2.PulleyJoint.prototype,"GetAnchorA",b2.PulleyJoint.prototype.GetAnchorA);b2.PulleyJoint.prototype.GetAnchorB=function(a){return this.m_bodyB.GetWorldPoint(this.m_localAnchorB,a)};
goog.exportProperty(b2.PulleyJoint.prototype,"GetAnchorB",b2.PulleyJoint.prototype.GetAnchorB);b2.PulleyJoint.prototype.GetReactionForce=function(a,b){return b.Set(a*this.m_impulse*this.m_uB.x,a*this.m_impulse*this.m_uB.y)};goog.exportProperty(b2.PulleyJoint.prototype,"GetReactionForce",b2.PulleyJoint.prototype.GetReactionForce);b2.PulleyJoint.prototype.GetReactionTorque=function(a){return 0};goog.exportProperty(b2.PulleyJoint.prototype,"GetReactionTorque",b2.PulleyJoint.prototype.GetReactionTorque);
b2.PulleyJoint.prototype.GetGroundAnchorA=function(a){return a.Copy(this.m_groundAnchorA)};goog.exportProperty(b2.PulleyJoint.prototype,"GetGroundAnchorA",b2.PulleyJoint.prototype.GetGroundAnchorA);b2.PulleyJoint.prototype.GetGroundAnchorB=function(a){return a.Copy(this.m_groundAnchorB)};goog.exportProperty(b2.PulleyJoint.prototype,"GetGroundAnchorB",b2.PulleyJoint.prototype.GetGroundAnchorB);b2.PulleyJoint.prototype.GetLengthA=function(){return this.m_lengthA};
goog.exportProperty(b2.PulleyJoint.prototype,"GetLengthA",b2.PulleyJoint.prototype.GetLengthA);b2.PulleyJoint.prototype.GetLengthB=function(){return this.m_lengthB};goog.exportProperty(b2.PulleyJoint.prototype,"GetLengthB",b2.PulleyJoint.prototype.GetLengthB);b2.PulleyJoint.prototype.GetRatio=function(){return this.m_ratio};goog.exportProperty(b2.PulleyJoint.prototype,"GetRatio",b2.PulleyJoint.prototype.GetRatio);
b2.PulleyJoint.prototype.GetCurrentLengthA=function(){var a=this.m_bodyA.GetWorldPoint(this.m_localAnchorA,b2.PulleyJoint.prototype.GetCurrentLengthA.s_p);return b2.Distance(a,this.m_groundAnchorA)};goog.exportProperty(b2.PulleyJoint.prototype,"GetCurrentLengthA",b2.PulleyJoint.prototype.GetCurrentLengthA);b2.PulleyJoint.prototype.GetCurrentLengthA.s_p=new b2.Vec2;
b2.PulleyJoint.prototype.GetCurrentLengthB=function(){var a=this.m_bodyB.GetWorldPoint(this.m_localAnchorB,b2.PulleyJoint.prototype.GetCurrentLengthB.s_p);return b2.Distance(a,this.m_groundAnchorB)};goog.exportProperty(b2.PulleyJoint.prototype,"GetCurrentLengthB",b2.PulleyJoint.prototype.GetCurrentLengthB);b2.PulleyJoint.prototype.GetCurrentLengthB.s_p=new b2.Vec2;
b2.PulleyJoint.prototype.Dump=function(){if(b2.DEBUG){var a=this.m_bodyA.m_islandIndex,b=this.m_bodyB.m_islandIndex;b2.Log("  /*b2.PulleyJointDef*/ var jd = new b2.PulleyJointDef();\n");b2.Log("  jd.bodyA = bodies[%d];\n",a);b2.Log("  jd.bodyB = bodies[%d];\n",b);b2.Log("  jd.collideConnected = %s;\n",this.m_collideConnected?"true":"false");b2.Log("  jd.groundAnchorA.Set(%.15f, %.15f);\n",this.m_groundAnchorA.x,this.m_groundAnchorA.y);b2.Log("  jd.groundAnchorB.Set(%.15f, %.15f);\n",
this.m_groundAnchorB.x,this.m_groundAnchorB.y);b2.Log("  jd.localAnchorA.Set(%.15f, %.15f);\n",this.m_localAnchorA.x,this.m_localAnchorA.y);b2.Log("  jd.localAnchorB.Set(%.15f, %.15f);\n",this.m_localAnchorB.x,this.m_localAnchorB.y);b2.Log("  jd.lengthA = %.15f;\n",this.m_lengthA);b2.Log("  jd.lengthB = %.15f;\n",this.m_lengthB);b2.Log("  jd.ratio = %.15f;\n",this.m_ratio);b2.Log("  joints[%d] = this.m_world.CreateJoint(jd);\n",this.m_index)}};
goog.exportProperty(b2.PulleyJoint.prototype,"Dump",b2.PulleyJoint.prototype.Dump);b2.PulleyJoint.prototype.ShiftOrigin=function(a){this.m_groundAnchorA.SelfSub(a);this.m_groundAnchorB.SelfSub(a)};goog.exportProperty(b2.PulleyJoint.prototype,"ShiftOrigin",b2.PulleyJoint.prototype.ShiftOrigin);b2.RevoluteJointDef=function(){b2.JointDef.call(this,b2.JointType.e_revoluteJoint);this.localAnchorA=new b2.Vec2(0,0);this.localAnchorB=new b2.Vec2(0,0)};goog.inherits(b2.RevoluteJointDef,b2.JointDef);goog.exportSymbol("b2.RevoluteJointDef",b2.RevoluteJointDef);b2.RevoluteJointDef.prototype.localAnchorA=null;goog.exportProperty(b2.RevoluteJointDef.prototype,"localAnchorA",b2.RevoluteJointDef.prototype.localAnchorA);
b2.RevoluteJointDef.prototype.localAnchorB=null;goog.exportProperty(b2.RevoluteJointDef.prototype,"localAnchorB",b2.RevoluteJointDef.prototype.localAnchorB);b2.RevoluteJointDef.prototype.referenceAngle=0;goog.exportProperty(b2.RevoluteJointDef.prototype,"referenceAngle",b2.RevoluteJointDef.prototype.referenceAngle);b2.RevoluteJointDef.prototype.enableLimit=!1;goog.exportProperty(b2.RevoluteJointDef.prototype,"enableLimit",b2.RevoluteJointDef.prototype.enableLimit);
b2.RevoluteJointDef.prototype.lowerAngle=0;goog.exportProperty(b2.RevoluteJointDef.prototype,"lowerAngle",b2.RevoluteJointDef.prototype.lowerAngle);b2.RevoluteJointDef.prototype.upperAngle=0;goog.exportProperty(b2.RevoluteJointDef.prototype,"upperAngle",b2.RevoluteJointDef.prototype.upperAngle);b2.RevoluteJointDef.prototype.enableMotor=!1;goog.exportProperty(b2.RevoluteJointDef.prototype,"enableMotor",b2.RevoluteJointDef.prototype.enableMotor);
b2.RevoluteJointDef.prototype.motorSpeed=0;goog.exportProperty(b2.RevoluteJointDef.prototype,"motorSpeed",b2.RevoluteJointDef.prototype.motorSpeed);b2.RevoluteJointDef.prototype.maxMotorTorque=0;goog.exportProperty(b2.RevoluteJointDef.prototype,"maxMotorTorque",b2.RevoluteJointDef.prototype.maxMotorTorque);
b2.RevoluteJointDef.prototype.Initialize=function(a,b,c){this.bodyA=a;this.bodyB=b;this.bodyA.GetLocalPoint(c,this.localAnchorA);this.bodyB.GetLocalPoint(c,this.localAnchorB);this.referenceAngle=this.bodyB.GetAngle()-this.bodyA.GetAngle()};goog.exportProperty(b2.RevoluteJointDef.prototype,"Initialize",b2.RevoluteJointDef.prototype.Initialize);
b2.RevoluteJoint=function(a){b2.Joint.call(this,a);this.m_localAnchorA=new b2.Vec2;this.m_localAnchorB=new b2.Vec2;this.m_impulse=new b2.Vec3;this.m_rA=new b2.Vec2;this.m_rB=new b2.Vec2;this.m_localCenterA=new b2.Vec2;this.m_localCenterB=new b2.Vec2;this.m_mass=new b2.Mat33;this.m_qA=new b2.Rot;this.m_qB=new b2.Rot;this.m_lalcA=new b2.Vec2;this.m_lalcB=new b2.Vec2;this.m_K=new b2.Mat22;this.m_localAnchorA.Copy(a.localAnchorA);
this.m_localAnchorB.Copy(a.localAnchorB);this.m_referenceAngle=a.referenceAngle;this.m_impulse.SetZero();this.m_motorImpulse=0;this.m_lowerAngle=a.lowerAngle;this.m_upperAngle=a.upperAngle;this.m_maxMotorTorque=a.maxMotorTorque;this.m_motorSpeed=a.motorSpeed;this.m_enableLimit=a.enableLimit;this.m_enableMotor=a.enableMotor;this.m_limitState=b2.LimitState.e_inactiveLimit};goog.inherits(b2.RevoluteJoint,b2.Joint);goog.exportSymbol("b2.RevoluteJoint",b2.RevoluteJoint);
b2.RevoluteJoint.prototype.m_localAnchorA=null;goog.exportProperty(b2.RevoluteJoint.prototype,"m_localAnchorA",b2.RevoluteJoint.prototype.m_localAnchorA);b2.RevoluteJoint.prototype.m_localAnchorB=null;goog.exportProperty(b2.RevoluteJoint.prototype,"m_localAnchorB",b2.RevoluteJoint.prototype.m_localAnchorB);b2.RevoluteJoint.prototype.m_impulse=null;goog.exportProperty(b2.RevoluteJoint.prototype,"m_impulse",b2.RevoluteJoint.prototype.m_impulse);
b2.RevoluteJoint.prototype.m_motorImpulse=0;goog.exportProperty(b2.RevoluteJoint.prototype,"m_motorImpulse",b2.RevoluteJoint.prototype.m_motorImpulse);b2.RevoluteJoint.prototype.m_enableMotor=!1;goog.exportProperty(b2.RevoluteJoint.prototype,"m_enableMotor",b2.RevoluteJoint.prototype.m_enableMotor);b2.RevoluteJoint.prototype.m_maxMotorTorque=0;goog.exportProperty(b2.RevoluteJoint.prototype,"m_maxMotorTorque",b2.RevoluteJoint.prototype.m_maxMotorTorque);
b2.RevoluteJoint.prototype.m_motorSpeed=0;goog.exportProperty(b2.RevoluteJoint.prototype,"m_motorSpeed",b2.RevoluteJoint.prototype.m_motorSpeed);b2.RevoluteJoint.prototype.m_enableLimit=!1;goog.exportProperty(b2.RevoluteJoint.prototype,"m_enableLimit",b2.RevoluteJoint.prototype.m_enableLimit);b2.RevoluteJoint.prototype.m_referenceAngle=0;goog.exportProperty(b2.RevoluteJoint.prototype,"m_referenceAngle",b2.RevoluteJoint.prototype.m_referenceAngle);
b2.RevoluteJoint.prototype.m_lowerAngle=0;goog.exportProperty(b2.RevoluteJoint.prototype,"m_lowerAngle",b2.RevoluteJoint.prototype.m_lowerAngle);b2.RevoluteJoint.prototype.m_upperAngle=0;goog.exportProperty(b2.RevoluteJoint.prototype,"m_upperAngle",b2.RevoluteJoint.prototype.m_upperAngle);b2.RevoluteJoint.prototype.m_indexA=0;goog.exportProperty(b2.RevoluteJoint.prototype,"m_indexA",b2.RevoluteJoint.prototype.m_indexA);
b2.RevoluteJoint.prototype.m_indexB=0;goog.exportProperty(b2.RevoluteJoint.prototype,"m_indexB",b2.RevoluteJoint.prototype.m_indexB);b2.RevoluteJoint.prototype.m_rA=null;goog.exportProperty(b2.RevoluteJoint.prototype,"m_rA",b2.RevoluteJoint.prototype.m_rA);b2.RevoluteJoint.prototype.m_rB=null;goog.exportProperty(b2.RevoluteJoint.prototype,"m_rB",b2.RevoluteJoint.prototype.m_rB);b2.RevoluteJoint.prototype.m_localCenterA=null;
goog.exportProperty(b2.RevoluteJoint.prototype,"m_localCenterA",b2.RevoluteJoint.prototype.m_localCenterA);b2.RevoluteJoint.prototype.m_localCenterB=null;goog.exportProperty(b2.RevoluteJoint.prototype,"m_localCenterB",b2.RevoluteJoint.prototype.m_localCenterB);b2.RevoluteJoint.prototype.m_invMassA=0;goog.exportProperty(b2.RevoluteJoint.prototype,"m_invMassA",b2.RevoluteJoint.prototype.m_invMassA);b2.RevoluteJoint.prototype.m_invMassB=0;
goog.exportProperty(b2.RevoluteJoint.prototype,"m_invMassB",b2.RevoluteJoint.prototype.m_invMassB);b2.RevoluteJoint.prototype.m_invIA=0;goog.exportProperty(b2.RevoluteJoint.prototype,"m_invIA",b2.RevoluteJoint.prototype.m_invIA);b2.RevoluteJoint.prototype.m_invIB=0;goog.exportProperty(b2.RevoluteJoint.prototype,"m_invIB",b2.RevoluteJoint.prototype.m_invIB);b2.RevoluteJoint.prototype.m_mass=null;
goog.exportProperty(b2.RevoluteJoint.prototype,"m_mass",b2.RevoluteJoint.prototype.m_mass);b2.RevoluteJoint.prototype.m_motorMass=0;goog.exportProperty(b2.RevoluteJoint.prototype,"m_motorMass",b2.RevoluteJoint.prototype.m_motorMass);b2.RevoluteJoint.prototype.m_limitState=b2.LimitState.e_inactiveLimit;goog.exportProperty(b2.RevoluteJoint.prototype,"m_limitState",b2.RevoluteJoint.prototype.m_limitState);b2.RevoluteJoint.prototype.m_qA=null;
goog.exportProperty(b2.RevoluteJoint.prototype,"m_qA",b2.RevoluteJoint.prototype.m_qA);b2.RevoluteJoint.prototype.m_qB=null;goog.exportProperty(b2.RevoluteJoint.prototype,"m_qB",b2.RevoluteJoint.prototype.m_qB);b2.RevoluteJoint.prototype.m_lalcA=null;goog.exportProperty(b2.RevoluteJoint.prototype,"m_lalcA",b2.RevoluteJoint.prototype.m_lalcA);b2.RevoluteJoint.prototype.m_lalcB=null;goog.exportProperty(b2.RevoluteJoint.prototype,"m_lalcB",b2.RevoluteJoint.prototype.m_lalcB);
b2.RevoluteJoint.prototype.m_K=null;goog.exportProperty(b2.RevoluteJoint.prototype,"m_K",b2.RevoluteJoint.prototype.m_K);
b2.RevoluteJoint.prototype.InitVelocityConstraints=function(a){this.m_indexA=this.m_bodyA.m_islandIndex;this.m_indexB=this.m_bodyB.m_islandIndex;this.m_localCenterA.Copy(this.m_bodyA.m_sweep.localCenter);this.m_localCenterB.Copy(this.m_bodyB.m_sweep.localCenter);this.m_invMassA=this.m_bodyA.m_invMass;this.m_invMassB=this.m_bodyB.m_invMass;this.m_invIA=this.m_bodyA.m_invI;this.m_invIB=this.m_bodyB.m_invI;var b=a.positions[this.m_indexA].a,c=a.velocities[this.m_indexA].v,d=a.velocities[this.m_indexA].w,
e=a.positions[this.m_indexB].a,f=a.velocities[this.m_indexB].v,g=a.velocities[this.m_indexB].w,h=this.m_qA.SetAngle(b),k=this.m_qB.SetAngle(e);b2.Sub_V2_V2(this.m_localAnchorA,this.m_localCenterA,this.m_lalcA);b2.Mul_R_V2(h,this.m_lalcA,this.m_rA);b2.Sub_V2_V2(this.m_localAnchorB,this.m_localCenterB,this.m_lalcB);b2.Mul_R_V2(k,this.m_lalcB,this.m_rB);var h=this.m_invMassA,k=this.m_invMassB,l=this.m_invIA,m=this.m_invIB,n=0===l+m;this.m_mass.ex.x=h+k+this.m_rA.y*this.m_rA.y*l+this.m_rB.y*
this.m_rB.y*m;this.m_mass.ey.x=-this.m_rA.y*this.m_rA.x*l-this.m_rB.y*this.m_rB.x*m;this.m_mass.ez.x=-this.m_rA.y*l-this.m_rB.y*m;this.m_mass.ex.y=this.m_mass.ey.x;this.m_mass.ey.y=h+k+this.m_rA.x*this.m_rA.x*l+this.m_rB.x*this.m_rB.x*m;this.m_mass.ez.y=this.m_rA.x*l+this.m_rB.x*m;this.m_mass.ex.z=this.m_mass.ez.x;this.m_mass.ey.z=this.m_mass.ez.y;this.m_mass.ez.z=l+m;this.m_motorMass=l+m;0<this.m_motorMass&&(this.m_motorMass=1/this.m_motorMass);if(!this.m_enableMotor||n)this.m_motorImpulse=0;this.m_enableLimit&&
!n?(b=e-b-this.m_referenceAngle,b2.Abs(this.m_upperAngle-this.m_lowerAngle)<2*b2._angularSlop?this.m_limitState=b2.LimitState.e_equalLimits:b<=this.m_lowerAngle?(this.m_limitState!==b2.LimitState.e_atLowerLimit&&(this.m_impulse.z=0),this.m_limitState=b2.LimitState.e_atLowerLimit):b>=this.m_upperAngle?(this.m_limitState!==b2.LimitState.e_atUpperLimit&&(this.m_impulse.z=0),this.m_limitState=b2.LimitState.e_atUpperLimit):(this.m_limitState=b2.LimitState.e_inactiveLimit,
this.m_impulse.z=0)):this.m_limitState=b2.LimitState.e_inactiveLimit;a.step.warmStarting?(this.m_impulse.SelfMulScalar(a.step.dtRatio),this.m_motorImpulse*=a.step.dtRatio,b=b2.RevoluteJoint.prototype.InitVelocityConstraints.s_P.Set(this.m_impulse.x,this.m_impulse.y),c.SelfMulSub(h,b),d-=l*(b2.Cross_V2_V2(this.m_rA,b)+this.m_motorImpulse+this.m_impulse.z),f.SelfMulAdd(k,b),g+=m*(b2.Cross_V2_V2(this.m_rB,b)+this.m_motorImpulse+this.m_impulse.z)):(this.m_impulse.SetZero(),this.m_motorImpulse=
0);a.velocities[this.m_indexA].w=d;a.velocities[this.m_indexB].w=g};goog.exportProperty(b2.RevoluteJoint.prototype,"InitVelocityConstraints",b2.RevoluteJoint.prototype.InitVelocityConstraints);b2.RevoluteJoint.prototype.InitVelocityConstraints.s_P=new b2.Vec2;
b2.RevoluteJoint.prototype.SolveVelocityConstraints=function(a){var b=a.velocities[this.m_indexA].v,c=a.velocities[this.m_indexA].w,d=a.velocities[this.m_indexB].v,e=a.velocities[this.m_indexB].w,f=this.m_invMassA,g=this.m_invMassB,h=this.m_invIA,k=this.m_invIB,l=0===h+k;if(this.m_enableMotor&&this.m_limitState!==b2.LimitState.e_equalLimits&&!l){var m=e-c-this.m_motorSpeed,m=-this.m_motorMass*m,n=this.m_motorImpulse,p=a.step.dt*this.m_maxMotorTorque;this.m_motorImpulse=b2.Clamp(this.m_motorImpulse+
m,-p,p);m=this.m_motorImpulse-n;c-=h*m;e+=k*m}this.m_enableLimit&&this.m_limitState!==b2.LimitState.e_inactiveLimit&&!l?(l=b2.Sub_V2_V2(b2.AddCross_V2_S_V2(d,e,this.m_rB,b2.Vec2.s_t0),b2.AddCross_V2_S_V2(b,c,this.m_rA,b2.Vec2.s_t1),b2.RevoluteJoint.prototype.SolveVelocityConstraints.s_Cdot1),m=this.m_mass.Solve33(l.x,l.y,e-c,b2.RevoluteJoint.prototype.SolveVelocityConstraints.s_impulse3).SelfNeg(),this.m_limitState===b2.LimitState.e_equalLimits?this.m_impulse.SelfAdd(m):
this.m_limitState===b2.LimitState.e_atLowerLimit?(n=this.m_impulse.z+m.z,0>n?(n=-l.x+this.m_impulse.z*this.m_mass.ez.x,l=-l.y+this.m_impulse.z*this.m_mass.ez.y,l=this.m_mass.Solve22(n,l,b2.RevoluteJoint.prototype.SolveVelocityConstraints.s_reduced),m.x=l.x,m.y=l.y,m.z=-this.m_impulse.z,this.m_impulse.x+=l.x,this.m_impulse.y+=l.y,this.m_impulse.z=0):this.m_impulse.SelfAdd(m)):this.m_limitState===b2.LimitState.e_atUpperLimit&&(n=this.m_impulse.z+m.z,0<n?(n=-l.x+this.m_impulse.z*this.m_mass.ez.x,
l=-l.y+this.m_impulse.z*this.m_mass.ez.y,l=this.m_mass.Solve22(n,l,b2.RevoluteJoint.prototype.SolveVelocityConstraints.s_reduced),m.x=l.x,m.y=l.y,m.z=-this.m_impulse.z,this.m_impulse.x+=l.x,this.m_impulse.y+=l.y,this.m_impulse.z=0):this.m_impulse.SelfAdd(m)),l=b2.RevoluteJoint.prototype.SolveVelocityConstraints.s_P.Set(m.x,m.y),b.SelfMulSub(f,l),c-=h*(b2.Cross_V2_V2(this.m_rA,l)+m.z),d.SelfMulAdd(g,l),e+=k*(b2.Cross_V2_V2(this.m_rB,l)+m.z)):(m=b2.Sub_V2_V2(b2.AddCross_V2_S_V2(d,
e,this.m_rB,b2.Vec2.s_t0),b2.AddCross_V2_S_V2(b,c,this.m_rA,b2.Vec2.s_t1),b2.RevoluteJoint.prototype.SolveVelocityConstraints.s_Cdot),m=this.m_mass.Solve22(-m.x,-m.y,b2.RevoluteJoint.prototype.SolveVelocityConstraints.s_impulse2),this.m_impulse.x+=m.x,this.m_impulse.y+=m.y,b.SelfMulSub(f,m),c-=h*b2.Cross_V2_V2(this.m_rA,m),d.SelfMulAdd(g,m),e+=k*b2.Cross_V2_V2(this.m_rB,m));a.velocities[this.m_indexA].w=c;a.velocities[this.m_indexB].w=e};
goog.exportProperty(b2.RevoluteJoint.prototype,"SolveVelocityConstraints",b2.RevoluteJoint.prototype.SolveVelocityConstraints);b2.RevoluteJoint.prototype.SolveVelocityConstraints.s_P=new b2.Vec2;b2.RevoluteJoint.prototype.SolveVelocityConstraints.s_Cdot=new b2.Vec2;b2.RevoluteJoint.prototype.SolveVelocityConstraints.s_Cdot1=new b2.Vec2;b2.RevoluteJoint.prototype.SolveVelocityConstraints.s_impulse3=new b2.Vec3;
b2.RevoluteJoint.prototype.SolveVelocityConstraints.s_reduced=new b2.Vec2;b2.RevoluteJoint.prototype.SolveVelocityConstraints.s_impulse2=new b2.Vec2;
b2.RevoluteJoint.prototype.SolvePositionConstraints=function(a){var b=a.positions[this.m_indexA].c,c=a.positions[this.m_indexA].a,d=a.positions[this.m_indexB].c,e=a.positions[this.m_indexB].a,f=this.m_qA.SetAngle(c),g=this.m_qB.SetAngle(e),h=0,k=0,k=0===this.m_invIA+this.m_invIB;if(this.m_enableLimit&&this.m_limitState!==b2.LimitState.e_inactiveLimit&&!k){var l=e-c-this.m_referenceAngle,k=0;this.m_limitState===b2.LimitState.e_equalLimits?(l=b2.Clamp(l-this.m_lowerAngle,-b2._maxAngularCorrection,
b2._maxAngularCorrection),k=-this.m_motorMass*l,h=b2.Abs(l)):this.m_limitState===b2.LimitState.e_atLowerLimit?(l-=this.m_lowerAngle,h=-l,l=b2.Clamp(l+b2._angularSlop,-b2._maxAngularCorrection,0),k=-this.m_motorMass*l):this.m_limitState===b2.LimitState.e_atUpperLimit&&(h=l-=this.m_upperAngle,l=b2.Clamp(l-b2._angularSlop,0,b2._maxAngularCorrection),k=-this.m_motorMass*l);c-=this.m_invIA*k;e+=this.m_invIB*k}f.SetAngle(c);g.SetAngle(e);b2.Sub_V2_V2(this.m_localAnchorA,
this.m_localCenterA,this.m_lalcA);f=b2.Mul_R_V2(f,this.m_lalcA,this.m_rA);b2.Sub_V2_V2(this.m_localAnchorB,this.m_localCenterB,this.m_lalcB);var g=b2.Mul_R_V2(g,this.m_lalcB,this.m_rB),l=b2.Sub_V2_V2(b2.Add_V2_V2(d,g,b2.Vec2.s_t0),b2.Add_V2_V2(b,f,b2.Vec2.s_t1),b2.RevoluteJoint.prototype.SolvePositionConstraints.s_C),k=l.Length(),m=this.m_invMassA,n=this.m_invMassB,p=this.m_invIA,q=this.m_invIB,r=this.m_K;r.ex.x=m+n+p*f.y*f.y+q*g.y*g.y;r.ex.y=-p*f.x*f.y-
q*g.x*g.y;r.ey.x=r.ex.y;r.ey.y=m+n+p*f.x*f.x+q*g.x*g.x;l=r.Solve(l.x,l.y,b2.RevoluteJoint.prototype.SolvePositionConstraints.s_impulse).SelfNeg();b.SelfMulSub(m,l);c-=p*b2.Cross_V2_V2(f,l);d.SelfMulAdd(n,l);e+=q*b2.Cross_V2_V2(g,l);a.positions[this.m_indexA].a=c;a.positions[this.m_indexB].a=e;return k<=b2._linearSlop&&h<=b2._angularSlop};goog.exportProperty(b2.RevoluteJoint.prototype,"SolvePositionConstraints",b2.RevoluteJoint.prototype.SolvePositionConstraints);
b2.RevoluteJoint.prototype.SolvePositionConstraints.s_C=new b2.Vec2;b2.RevoluteJoint.prototype.SolvePositionConstraints.s_impulse=new b2.Vec2;b2.RevoluteJoint.prototype.GetAnchorA=function(a){return this.m_bodyA.GetWorldPoint(this.m_localAnchorA,a)};goog.exportProperty(b2.RevoluteJoint.prototype,"GetAnchorA",b2.RevoluteJoint.prototype.GetAnchorA);b2.RevoluteJoint.prototype.GetAnchorB=function(a){return this.m_bodyB.GetWorldPoint(this.m_localAnchorB,a)};
goog.exportProperty(b2.RevoluteJoint.prototype,"GetAnchorB",b2.RevoluteJoint.prototype.GetAnchorB);b2.RevoluteJoint.prototype.GetReactionForce=function(a,b){return b.Set(a*this.m_impulse.x,a*this.m_impulse.y)};goog.exportProperty(b2.RevoluteJoint.prototype,"GetReactionForce",b2.RevoluteJoint.prototype.GetReactionForce);b2.RevoluteJoint.prototype.GetReactionTorque=function(a){return a*this.m_impulse.z};
goog.exportProperty(b2.RevoluteJoint.prototype,"GetReactionTorque",b2.RevoluteJoint.prototype.GetReactionTorque);b2.RevoluteJoint.prototype.GetLocalAnchorA=function(a){return a.Copy(this.m_localAnchorA)};goog.exportProperty(b2.RevoluteJoint.prototype,"GetLocalAnchorA",b2.RevoluteJoint.prototype.GetLocalAnchorA);b2.RevoluteJoint.prototype.GetLocalAnchorB=function(a){return a.Copy(this.m_localAnchorB)};
goog.exportProperty(b2.RevoluteJoint.prototype,"GetLocalAnchorB",b2.RevoluteJoint.prototype.GetLocalAnchorB);b2.RevoluteJoint.prototype.GetReferenceAngle=function(){return this.m_referenceAngle};goog.exportProperty(b2.RevoluteJoint.prototype,"GetReferenceAngle",b2.RevoluteJoint.prototype.GetReferenceAngle);b2.RevoluteJoint.prototype.GetJointAngle=function(){return this.m_bodyB.m_sweep.a-this.m_bodyA.m_sweep.a-this.m_referenceAngle};
goog.exportProperty(b2.RevoluteJoint.prototype,"GetJointAngle",b2.RevoluteJoint.prototype.GetJointAngle);b2.RevoluteJoint.prototype.GetJointSpeed=function(){return this.m_bodyB.m_angularVelocity-this.m_bodyA.m_angularVelocity};goog.exportProperty(b2.RevoluteJoint.prototype,"GetJointSpeed",b2.RevoluteJoint.prototype.GetJointSpeed);b2.RevoluteJoint.prototype.IsMotorEnabled=function(){return this.m_enableMotor};
goog.exportProperty(b2.RevoluteJoint.prototype,"IsMotorEnabled",b2.RevoluteJoint.prototype.IsMotorEnabled);b2.RevoluteJoint.prototype.EnableMotor=function(a){this.m_enableMotor!==a&&(this.m_bodyA.SetAwake(!0),this.m_bodyB.SetAwake(!0),this.m_enableMotor=a)};goog.exportProperty(b2.RevoluteJoint.prototype,"EnableMotor",b2.RevoluteJoint.prototype.EnableMotor);b2.RevoluteJoint.prototype.GetMotorTorque=function(a){return a*this.m_motorImpulse};
goog.exportProperty(b2.RevoluteJoint.prototype,"GetMotorTorque",b2.RevoluteJoint.prototype.GetMotorTorque);b2.RevoluteJoint.prototype.GetMotorSpeed=function(){return this.m_motorSpeed};goog.exportProperty(b2.RevoluteJoint.prototype,"GetMotorSpeed",b2.RevoluteJoint.prototype.GetMotorSpeed);b2.RevoluteJoint.prototype.SetMaxMotorTorque=function(a){this.m_maxMotorTorque=a};goog.exportProperty(b2.RevoluteJoint.prototype,"SetMaxMotorTorque",b2.RevoluteJoint.prototype.SetMaxMotorTorque);
b2.RevoluteJoint.prototype.GetMaxMotorTorque=function(){return this.m_maxMotorTorque};goog.exportProperty(b2.RevoluteJoint.prototype,"GetMaxMotorTorque",b2.RevoluteJoint.prototype.GetMaxMotorTorque);b2.RevoluteJoint.prototype.IsLimitEnabled=function(){return this.m_enableLimit};goog.exportProperty(b2.RevoluteJoint.prototype,"IsLimitEnabled",b2.RevoluteJoint.prototype.IsLimitEnabled);
b2.RevoluteJoint.prototype.EnableLimit=function(a){a!==this.m_enableLimit&&(this.m_bodyA.SetAwake(!0),this.m_bodyB.SetAwake(!0),this.m_enableLimit=a,this.m_impulse.z=0)};goog.exportProperty(b2.RevoluteJoint.prototype,"EnableLimit",b2.RevoluteJoint.prototype.EnableLimit);b2.RevoluteJoint.prototype.GetLowerLimit=function(){return this.m_lowerAngle};goog.exportProperty(b2.RevoluteJoint.prototype,"GetLowerLimit",b2.RevoluteJoint.prototype.GetLowerLimit);
b2.RevoluteJoint.prototype.GetUpperLimit=function(){return this.m_upperAngle};goog.exportProperty(b2.RevoluteJoint.prototype,"GetUpperLimit",b2.RevoluteJoint.prototype.GetUpperLimit);b2.RevoluteJoint.prototype.SetLimits=function(a,b){if(a!==this.m_lowerAngle||b!==this.m_upperAngle)this.m_bodyA.SetAwake(!0),this.m_bodyB.SetAwake(!0),this.m_impulse.z=0,this.m_lowerAngle=a,this.m_upperAngle=b};goog.exportProperty(b2.RevoluteJoint.prototype,"SetLimits",b2.RevoluteJoint.prototype.SetLimits);
b2.RevoluteJoint.prototype.SetMotorSpeed=function(a){this.m_motorSpeed!==a&&(this.m_bodyA.SetAwake(!0),this.m_bodyB.SetAwake(!0),this.m_motorSpeed=a)};goog.exportProperty(b2.RevoluteJoint.prototype,"SetMotorSpeed",b2.RevoluteJoint.prototype.SetMotorSpeed);
b2.RevoluteJoint.prototype.Dump=function(){if(b2.DEBUG){var a=this.m_bodyA.m_islandIndex,b=this.m_bodyB.m_islandIndex;b2.Log("  /*b2.RevoluteJointDef*/ var jd = new b2.RevoluteJointDef();\n");b2.Log("  jd.bodyA = bodies[%d];\n",a);b2.Log("  jd.bodyB = bodies[%d];\n",b);b2.Log("  jd.collideConnected = %s;\n",this.m_collideConnected?"true":"false");b2.Log("  jd.localAnchorA.Set(%.15f, %.15f);\n",this.m_localAnchorA.x,this.m_localAnchorA.y);b2.Log("  jd.localAnchorB.Set(%.15f, %.15f);\n",
this.m_localAnchorB.x,this.m_localAnchorB.y);b2.Log("  jd.referenceAngle = %.15f;\n",this.m_referenceAngle);b2.Log("  jd.enableLimit = %s;\n",this.m_enableLimit?"true":"false");b2.Log("  jd.lowerAngle = %.15f;\n",this.m_lowerAngle);b2.Log("  jd.upperAngle = %.15f;\n",this.m_upperAngle);b2.Log("  jd.enableMotor = %s;\n",this.m_enableMotor?"true":"false");b2.Log("  jd.motorSpeed = %.15f;\n",this.m_motorSpeed);b2.Log("  jd.maxMotorTorque = %.15f;\n",this.m_maxMotorTorque);
b2.Log("  joints[%d] = this.m_world.CreateJoint(jd);\n",this.m_index)}};goog.exportProperty(b2.RevoluteJoint.prototype,"Dump",b2.RevoluteJoint.prototype.Dump);b2.GearJointDef=function(){b2.JointDef.call(this,b2.JointType.e_gearJoint)};goog.inherits(b2.GearJointDef,b2.JointDef);goog.exportSymbol("b2.GearJointDef",b2.GearJointDef);b2.GearJointDef.prototype.joint1=null;goog.exportProperty(b2.GearJointDef.prototype,"joint1",b2.GearJointDef.prototype.joint1);b2.GearJointDef.prototype.joint2=null;goog.exportProperty(b2.GearJointDef.prototype,"joint2",b2.GearJointDef.prototype.joint2);
b2.GearJointDef.prototype.ratio=1;goog.exportProperty(b2.GearJointDef.prototype,"ratio",b2.GearJointDef.prototype.ratio);
b2.GearJoint=function(a){b2.Joint.call(this,a);this.m_joint1=a.joint1;this.m_joint2=a.joint2;this.m_localAnchorA=new b2.Vec2;this.m_localAnchorB=new b2.Vec2;this.m_localAnchorC=new b2.Vec2;this.m_localAnchorD=new b2.Vec2;this.m_localAxisC=new b2.Vec2;this.m_localAxisD=new b2.Vec2;this.m_lcA=new b2.Vec2;this.m_lcB=new b2.Vec2;this.m_lcC=new b2.Vec2;this.m_lcD=new b2.Vec2;this.m_JvAC=new b2.Vec2;this.m_JvBD=new b2.Vec2;this.m_qA=
new b2.Rot;this.m_qB=new b2.Rot;this.m_qC=new b2.Rot;this.m_qD=new b2.Rot;this.m_lalcA=new b2.Vec2;this.m_lalcB=new b2.Vec2;this.m_lalcC=new b2.Vec2;this.m_lalcD=new b2.Vec2;this.m_typeA=this.m_joint1.GetType();this.m_typeB=this.m_joint2.GetType();b2.ENABLE_ASSERTS&&b2.Assert(this.m_typeA===b2.JointType.e_revoluteJoint||this.m_typeA===b2.JointType.e_prismaticJoint);b2.ENABLE_ASSERTS&&b2.Assert(this.m_typeB===b2.JointType.e_revoluteJoint||
this.m_typeB===b2.JointType.e_prismaticJoint);var b,c;this.m_bodyC=this.m_joint1.GetBodyA();this.m_bodyA=this.m_joint1.GetBodyB();b=this.m_bodyA.m_xf;var d=this.m_bodyA.m_sweep.a;c=this.m_bodyC.m_xf;var e=this.m_bodyC.m_sweep.a;this.m_typeA===b2.JointType.e_revoluteJoint?(c=a.joint1,this.m_localAnchorC.Copy(c.m_localAnchorA),this.m_localAnchorA.Copy(c.m_localAnchorB),this.m_referenceAngleA=c.m_referenceAngle,this.m_localAxisC.SetZero(),b=d-e-this.m_referenceAngleA):(e=a.joint1,this.m_localAnchorC.Copy(e.m_localAnchorA),
this.m_localAnchorA.Copy(e.m_localAnchorB),this.m_referenceAngleA=e.m_referenceAngle,this.m_localAxisC.Copy(e.m_localXAxisA),d=this.m_localAnchorC,b=b2.MulT_R_V2(c.q,b2.Add_V2_V2(b2.Mul_R_V2(b.q,this.m_localAnchorA,b2.Vec2.s_t0),b2.Sub_V2_V2(b.p,c.p,b2.Vec2.s_t1),b2.Vec2.s_t0),b2.Vec2.s_t0),b=b2.Dot_V2_V2(b2.Sub_V2_V2(b,d,b2.Vec2.s_t0),this.m_localAxisC));this.m_bodyD=this.m_joint2.GetBodyA();this.m_bodyB=this.m_joint2.GetBodyB();c=this.m_bodyB.m_xf;
var e=this.m_bodyB.m_sweep.a,d=this.m_bodyD.m_xf,f=this.m_bodyD.m_sweep.a;this.m_typeB===b2.JointType.e_revoluteJoint?(c=a.joint2,this.m_localAnchorD.Copy(c.m_localAnchorA),this.m_localAnchorB.Copy(c.m_localAnchorB),this.m_referenceAngleB=c.m_referenceAngle,this.m_localAxisD.SetZero(),c=e-f-this.m_referenceAngleB):(e=a.joint2,this.m_localAnchorD.Copy(e.m_localAnchorA),this.m_localAnchorB.Copy(e.m_localAnchorB),this.m_referenceAngleB=e.m_referenceAngle,this.m_localAxisD.Copy(e.m_localXAxisA),
e=this.m_localAnchorD,c=b2.MulT_R_V2(d.q,b2.Add_V2_V2(b2.Mul_R_V2(c.q,this.m_localAnchorB,b2.Vec2.s_t0),b2.Sub_V2_V2(c.p,d.p,b2.Vec2.s_t1),b2.Vec2.s_t0),b2.Vec2.s_t0),c=b2.Dot_V2_V2(b2.Sub_V2_V2(c,e,b2.Vec2.s_t0),this.m_localAxisD));this.m_ratio=a.ratio;this.m_constant=b+this.m_ratio*c;this.m_impulse=0};goog.inherits(b2.GearJoint,b2.Joint);goog.exportSymbol("b2.GearJoint",b2.GearJoint);
b2.GearJoint.prototype.m_joint1=null;goog.exportProperty(b2.GearJoint.prototype,"m_joint1",b2.GearJoint.prototype.m_joint1);b2.GearJoint.prototype.m_joint2=null;goog.exportProperty(b2.GearJoint.prototype,"m_joint2",b2.GearJoint.prototype.m_joint2);b2.GearJoint.prototype.m_typeA=b2.JointType.e_unknownJoint;goog.exportProperty(b2.GearJoint.prototype,"m_typeA",b2.GearJoint.prototype.m_typeA);b2.GearJoint.prototype.m_typeB=b2.JointType.e_unknownJoint;
goog.exportProperty(b2.GearJoint.prototype,"m_typeB",b2.GearJoint.prototype.m_typeB);b2.GearJoint.prototype.m_bodyC=null;goog.exportProperty(b2.GearJoint.prototype,"m_bodyC",b2.GearJoint.prototype.m_bodyC);b2.GearJoint.prototype.m_bodyD=null;goog.exportProperty(b2.GearJoint.prototype,"m_bodyD",b2.GearJoint.prototype.m_bodyD);b2.GearJoint.prototype.m_localAnchorA=null;goog.exportProperty(b2.GearJoint.prototype,"m_localAnchorA",b2.GearJoint.prototype.m_localAnchorA);
b2.GearJoint.prototype.m_localAnchorB=null;goog.exportProperty(b2.GearJoint.prototype,"m_localAnchorB",b2.GearJoint.prototype.m_localAnchorB);b2.GearJoint.prototype.m_localAnchorC=null;goog.exportProperty(b2.GearJoint.prototype,"m_localAnchorC",b2.GearJoint.prototype.m_localAnchorC);b2.GearJoint.prototype.m_localAnchorD=null;goog.exportProperty(b2.GearJoint.prototype,"m_localAnchorD",b2.GearJoint.prototype.m_localAnchorD);
b2.GearJoint.prototype.m_localAxisC=null;goog.exportProperty(b2.GearJoint.prototype,"m_localAxisC",b2.GearJoint.prototype.m_localAxisC);b2.GearJoint.prototype.m_localAxisD=null;goog.exportProperty(b2.GearJoint.prototype,"m_localAxisD",b2.GearJoint.prototype.m_localAxisD);b2.GearJoint.prototype.m_referenceAngleA=0;goog.exportProperty(b2.GearJoint.prototype,"m_referenceAngleA",b2.GearJoint.prototype.m_referenceAngleA);
b2.GearJoint.prototype.m_referenceAngleB=0;goog.exportProperty(b2.GearJoint.prototype,"m_referenceAngleB",b2.GearJoint.prototype.m_referenceAngleB);b2.GearJoint.prototype.m_constant=0;goog.exportProperty(b2.GearJoint.prototype,"m_constant",b2.GearJoint.prototype.m_constant);b2.GearJoint.prototype.m_ratio=0;goog.exportProperty(b2.GearJoint.prototype,"m_ratio",b2.GearJoint.prototype.m_ratio);b2.GearJoint.prototype.m_impulse=0;
goog.exportProperty(b2.GearJoint.prototype,"m_impulse",b2.GearJoint.prototype.m_impulse);b2.GearJoint.prototype.m_indexA=0;goog.exportProperty(b2.GearJoint.prototype,"m_indexA",b2.GearJoint.prototype.m_indexA);b2.GearJoint.prototype.m_indexB=0;goog.exportProperty(b2.GearJoint.prototype,"m_indexB",b2.GearJoint.prototype.m_indexB);b2.GearJoint.prototype.m_indexC=0;goog.exportProperty(b2.GearJoint.prototype,"m_indexC",b2.GearJoint.prototype.m_indexC);
b2.GearJoint.prototype.m_indexD=0;goog.exportProperty(b2.GearJoint.prototype,"m_indexD",b2.GearJoint.prototype.m_indexD);b2.GearJoint.prototype.m_lcA=null;goog.exportProperty(b2.GearJoint.prototype,"m_lcA",b2.GearJoint.prototype.m_lcA);b2.GearJoint.prototype.m_lcB=null;goog.exportProperty(b2.GearJoint.prototype,"m_lcB",b2.GearJoint.prototype.m_lcB);b2.GearJoint.prototype.m_lcC=null;goog.exportProperty(b2.GearJoint.prototype,"m_lcC",b2.GearJoint.prototype.m_lcC);
b2.GearJoint.prototype.m_lcD=null;goog.exportProperty(b2.GearJoint.prototype,"m_lcD",b2.GearJoint.prototype.m_lcD);b2.GearJoint.prototype.m_mA=0;goog.exportProperty(b2.GearJoint.prototype,"m_mA",b2.GearJoint.prototype.m_mA);b2.GearJoint.prototype.m_mB=0;goog.exportProperty(b2.GearJoint.prototype,"m_mB",b2.GearJoint.prototype.m_mB);b2.GearJoint.prototype.m_mC=0;goog.exportProperty(b2.GearJoint.prototype,"m_mC",b2.GearJoint.prototype.m_mC);
b2.GearJoint.prototype.m_mD=0;goog.exportProperty(b2.GearJoint.prototype,"m_mD",b2.GearJoint.prototype.m_mD);b2.GearJoint.prototype.m_iA=0;goog.exportProperty(b2.GearJoint.prototype,"m_iA",b2.GearJoint.prototype.m_iA);b2.GearJoint.prototype.m_iB=0;goog.exportProperty(b2.GearJoint.prototype,"m_iB",b2.GearJoint.prototype.m_iB);b2.GearJoint.prototype.m_iC=0;goog.exportProperty(b2.GearJoint.prototype,"m_iC",b2.GearJoint.prototype.m_iC);
b2.GearJoint.prototype.m_iD=0;goog.exportProperty(b2.GearJoint.prototype,"m_iD",b2.GearJoint.prototype.m_iD);b2.GearJoint.prototype.m_JvAC=null;goog.exportProperty(b2.GearJoint.prototype,"m_JvAC",b2.GearJoint.prototype.m_JvAC);b2.GearJoint.prototype.m_JvBD=null;goog.exportProperty(b2.GearJoint.prototype,"m_JvBD",b2.GearJoint.prototype.m_JvBD);b2.GearJoint.prototype.m_JwA=0;goog.exportProperty(b2.GearJoint.prototype,"m_JwA",b2.GearJoint.prototype.m_JwA);
b2.GearJoint.prototype.m_JwB=0;goog.exportProperty(b2.GearJoint.prototype,"m_JwB",b2.GearJoint.prototype.m_JwB);b2.GearJoint.prototype.m_JwC=0;goog.exportProperty(b2.GearJoint.prototype,"m_JwC",b2.GearJoint.prototype.m_JwC);b2.GearJoint.prototype.m_JwD=0;goog.exportProperty(b2.GearJoint.prototype,"m_JwD",b2.GearJoint.prototype.m_JwD);b2.GearJoint.prototype.m_mass=0;goog.exportProperty(b2.GearJoint.prototype,"m_mass",b2.GearJoint.prototype.m_mass);
b2.GearJoint.prototype.m_qA=null;goog.exportProperty(b2.GearJoint.prototype,"m_qA",b2.GearJoint.prototype.m_qA);b2.GearJoint.prototype.m_qB=null;goog.exportProperty(b2.GearJoint.prototype,"m_qB",b2.GearJoint.prototype.m_qB);b2.GearJoint.prototype.m_qC=null;goog.exportProperty(b2.GearJoint.prototype,"m_qC",b2.GearJoint.prototype.m_qC);b2.GearJoint.prototype.m_qD=null;goog.exportProperty(b2.GearJoint.prototype,"m_qD",b2.GearJoint.prototype.m_qD);
b2.GearJoint.prototype.m_lalcA=null;goog.exportProperty(b2.GearJoint.prototype,"m_lalcA",b2.GearJoint.prototype.m_lalcA);b2.GearJoint.prototype.m_lalcB=null;goog.exportProperty(b2.GearJoint.prototype,"m_lalcB",b2.GearJoint.prototype.m_lalcB);b2.GearJoint.prototype.m_lalcC=null;goog.exportProperty(b2.GearJoint.prototype,"m_lalcC",b2.GearJoint.prototype.m_lalcC);b2.GearJoint.prototype.m_lalcD=null;
goog.exportProperty(b2.GearJoint.prototype,"m_lalcD",b2.GearJoint.prototype.m_lalcD);
b2.GearJoint.prototype.InitVelocityConstraints=function(a){this.m_indexA=this.m_bodyA.m_islandIndex;this.m_indexB=this.m_bodyB.m_islandIndex;this.m_indexC=this.m_bodyC.m_islandIndex;this.m_indexD=this.m_bodyD.m_islandIndex;this.m_lcA.Copy(this.m_bodyA.m_sweep.localCenter);this.m_lcB.Copy(this.m_bodyB.m_sweep.localCenter);this.m_lcC.Copy(this.m_bodyC.m_sweep.localCenter);this.m_lcD.Copy(this.m_bodyD.m_sweep.localCenter);this.m_mA=this.m_bodyA.m_invMass;this.m_mB=this.m_bodyB.m_invMass;this.m_mC=
this.m_bodyC.m_invMass;this.m_mD=this.m_bodyD.m_invMass;this.m_iA=this.m_bodyA.m_invI;this.m_iB=this.m_bodyB.m_invI;this.m_iC=this.m_bodyC.m_invI;this.m_iD=this.m_bodyD.m_invI;var b=a.velocities[this.m_indexA].v,c=a.velocities[this.m_indexA].w,d=a.positions[this.m_indexB].a,e=a.velocities[this.m_indexB].v,f=a.velocities[this.m_indexB].w,g=a.positions[this.m_indexC].a,h=a.velocities[this.m_indexC].v,k=a.velocities[this.m_indexC].w,l=a.positions[this.m_indexD].a,m=a.velocities[this.m_indexD].v,n=a.velocities[this.m_indexD].w,
p=this.m_qA.SetAngle(a.positions[this.m_indexA].a),d=this.m_qB.SetAngle(d),q=this.m_qC.SetAngle(g),g=this.m_qD.SetAngle(l);this.m_mass=0;this.m_typeA===b2.JointType.e_revoluteJoint?(this.m_JvAC.SetZero(),this.m_JwC=this.m_JwA=1,this.m_mass+=this.m_iA+this.m_iC):(l=b2.Mul_R_V2(q,this.m_localAxisC,b2.GearJoint.prototype.InitVelocityConstraints.s_u),b2.Sub_V2_V2(this.m_localAnchorC,this.m_lcC,this.m_lalcC),q=b2.Mul_R_V2(q,this.m_lalcC,b2.GearJoint.prototype.InitVelocityConstraints.s_rC),
b2.Sub_V2_V2(this.m_localAnchorA,this.m_lcA,this.m_lalcA),p=b2.Mul_R_V2(p,this.m_lalcA,b2.GearJoint.prototype.InitVelocityConstraints.s_rA),this.m_JvAC.Copy(l),this.m_JwC=b2.Cross_V2_V2(q,l),this.m_JwA=b2.Cross_V2_V2(p,l),this.m_mass+=this.m_mC+this.m_mA+this.m_iC*this.m_JwC*this.m_JwC+this.m_iA*this.m_JwA*this.m_JwA);this.m_typeB===b2.JointType.e_revoluteJoint?(this.m_JvBD.SetZero(),this.m_JwD=this.m_JwB=this.m_ratio,this.m_mass+=this.m_ratio*this.m_ratio*(this.m_iB+
this.m_iD)):(l=b2.Mul_R_V2(g,this.m_localAxisD,b2.GearJoint.prototype.InitVelocityConstraints.s_u),b2.Sub_V2_V2(this.m_localAnchorD,this.m_lcD,this.m_lalcD),p=b2.Mul_R_V2(g,this.m_lalcD,b2.GearJoint.prototype.InitVelocityConstraints.s_rD),b2.Sub_V2_V2(this.m_localAnchorB,this.m_lcB,this.m_lalcB),d=b2.Mul_R_V2(d,this.m_lalcB,b2.GearJoint.prototype.InitVelocityConstraints.s_rB),b2.Mul_S_V2(this.m_ratio,l,this.m_JvBD),this.m_JwD=this.m_ratio*b2.Cross_V2_V2(p,
l),this.m_JwB=this.m_ratio*b2.Cross_V2_V2(d,l),this.m_mass+=this.m_ratio*this.m_ratio*(this.m_mD+this.m_mB)+this.m_iD*this.m_JwD*this.m_JwD+this.m_iB*this.m_JwB*this.m_JwB);this.m_mass=0<this.m_mass?1/this.m_mass:0;a.step.warmStarting?(b.SelfMulAdd(this.m_mA*this.m_impulse,this.m_JvAC),c+=this.m_iA*this.m_impulse*this.m_JwA,e.SelfMulAdd(this.m_mB*this.m_impulse,this.m_JvBD),f+=this.m_iB*this.m_impulse*this.m_JwB,h.SelfMulSub(this.m_mC*this.m_impulse,this.m_JvAC),k-=this.m_iC*this.m_impulse*this.m_JwC,
m.SelfMulSub(this.m_mD*this.m_impulse,this.m_JvBD),n-=this.m_iD*this.m_impulse*this.m_JwD):this.m_impulse=0;a.velocities[this.m_indexA].w=c;a.velocities[this.m_indexB].w=f;a.velocities[this.m_indexC].w=k;a.velocities[this.m_indexD].w=n};b2.GearJoint.prototype.InitVelocityConstraints.s_u=new b2.Vec2;b2.GearJoint.prototype.InitVelocityConstraints.s_rA=new b2.Vec2;b2.GearJoint.prototype.InitVelocityConstraints.s_rB=new b2.Vec2;
b2.GearJoint.prototype.InitVelocityConstraints.s_rC=new b2.Vec2;b2.GearJoint.prototype.InitVelocityConstraints.s_rD=new b2.Vec2;
b2.GearJoint.prototype.SolveVelocityConstraints=function(a){var b=a.velocities[this.m_indexA].v,c=a.velocities[this.m_indexA].w,d=a.velocities[this.m_indexB].v,e=a.velocities[this.m_indexB].w,f=a.velocities[this.m_indexC].v,g=a.velocities[this.m_indexC].w,h=a.velocities[this.m_indexD].v,k=a.velocities[this.m_indexD].w,l=b2.Dot_V2_V2(this.m_JvAC,b2.Sub_V2_V2(b,f,b2.Vec2.s_t0))+b2.Dot_V2_V2(this.m_JvBD,b2.Sub_V2_V2(d,h,b2.Vec2.s_t0)),l=l+(this.m_JwA*c-this.m_JwC*g+
(this.m_JwB*e-this.m_JwD*k)),l=-this.m_mass*l;this.m_impulse+=l;b.SelfMulAdd(this.m_mA*l,this.m_JvAC);c+=this.m_iA*l*this.m_JwA;d.SelfMulAdd(this.m_mB*l,this.m_JvBD);e+=this.m_iB*l*this.m_JwB;f.SelfMulSub(this.m_mC*l,this.m_JvAC);g-=this.m_iC*l*this.m_JwC;h.SelfMulSub(this.m_mD*l,this.m_JvBD);k-=this.m_iD*l*this.m_JwD;a.velocities[this.m_indexA].w=c;a.velocities[this.m_indexB].w=e;a.velocities[this.m_indexC].w=g;a.velocities[this.m_indexD].w=k};
b2.GearJoint.prototype.SolvePositionConstraints=function(a){var b=a.positions[this.m_indexA].c,c=a.positions[this.m_indexA].a,d=a.positions[this.m_indexB].c,e=a.positions[this.m_indexB].a,f=a.positions[this.m_indexC].c,g=a.positions[this.m_indexC].a,h=a.positions[this.m_indexD].c,k=a.positions[this.m_indexD].a,l=this.m_qA.SetAngle(c),m=this.m_qB.SetAngle(e),n=this.m_qC.SetAngle(g),p=this.m_qD.SetAngle(k),q=this.m_JvAC,r=this.m_JvBD,u,t,w=0;if(this.m_typeA===b2.JointType.e_revoluteJoint)q.SetZero(),
l=u=1,w+=this.m_iA+this.m_iC,n=c-g-this.m_referenceAngleA;else{t=b2.Mul_R_V2(n,this.m_localAxisC,b2.GearJoint.prototype.SolvePositionConstraints.s_u);u=b2.Mul_R_V2(n,this.m_lalcC,b2.GearJoint.prototype.SolvePositionConstraints.s_rC);var x=b2.Mul_R_V2(l,this.m_lalcA,b2.GearJoint.prototype.SolvePositionConstraints.s_rA);q.Copy(t);l=b2.Cross_V2_V2(u,t);u=b2.Cross_V2_V2(x,t);w+=this.m_mC+this.m_mA+this.m_iC*l*l+this.m_iA*u*u;t=this.m_lalcC;n=b2.MulT_R_V2(n,
b2.Add_V2_V2(x,b2.Sub_V2_V2(b,f,b2.Vec2.s_t0),b2.Vec2.s_t0),b2.Vec2.s_t0);n=b2.Dot_V2_V2(b2.Sub_V2_V2(n,t,b2.Vec2.s_t0),this.m_localAxisC)}if(this.m_typeB===b2.JointType.e_revoluteJoint)r.SetZero(),m=t=this.m_ratio,w+=this.m_ratio*this.m_ratio*(this.m_iB+this.m_iD),p=e-k-this.m_referenceAngleB;else{t=b2.Mul_R_V2(p,this.m_localAxisD,b2.GearJoint.prototype.SolvePositionConstraints.s_u);var v=b2.Mul_R_V2(p,this.m_lalcD,b2.GearJoint.prototype.SolvePositionConstraints.s_rD),
x=b2.Mul_R_V2(m,this.m_lalcB,b2.GearJoint.prototype.SolvePositionConstraints.s_rB);b2.Mul_S_V2(this.m_ratio,t,r);m=this.m_ratio*b2.Cross_V2_V2(v,t);t=this.m_ratio*b2.Cross_V2_V2(x,t);w+=this.m_ratio*this.m_ratio*(this.m_mD+this.m_mB)+this.m_iD*m*m+this.m_iB*t*t;v=this.m_lalcD;p=b2.MulT_R_V2(p,b2.Add_V2_V2(x,b2.Sub_V2_V2(d,h,b2.Vec2.s_t0),b2.Vec2.s_t0),b2.Vec2.s_t0);p=b2.Dot_V2_V2(b2.Sub_V2_V2(p,v,b2.Vec2.s_t0),this.m_localAxisD)}p=
n+this.m_ratio*p-this.m_constant;n=0;0<w&&(n=-p/w);b.SelfMulAdd(this.m_mA*n,q);c+=this.m_iA*n*u;d.SelfMulAdd(this.m_mB*n,r);e+=this.m_iB*n*t;f.SelfMulSub(this.m_mC*n,q);g-=this.m_iC*n*l;h.SelfMulSub(this.m_mD*n,r);k-=this.m_iD*n*m;a.positions[this.m_indexA].a=c;a.positions[this.m_indexB].a=e;a.positions[this.m_indexC].a=g;a.positions[this.m_indexD].a=k;return 0<b2._linearSlop};goog.exportProperty(b2.GearJoint.prototype,"SolvePositionConstraints",b2.GearJoint.prototype.SolvePositionConstraints);
b2.GearJoint.prototype.SolvePositionConstraints.s_u=new b2.Vec2;b2.GearJoint.prototype.SolvePositionConstraints.s_rA=new b2.Vec2;b2.GearJoint.prototype.SolvePositionConstraints.s_rB=new b2.Vec2;b2.GearJoint.prototype.SolvePositionConstraints.s_rC=new b2.Vec2;b2.GearJoint.prototype.SolvePositionConstraints.s_rD=new b2.Vec2;b2.GearJoint.prototype.GetAnchorA=function(a){return this.m_bodyA.GetWorldPoint(this.m_localAnchorA,a)};
goog.exportProperty(b2.GearJoint.prototype,"GetAnchorA",b2.GearJoint.prototype.GetAnchorA);b2.GearJoint.prototype.GetAnchorB=function(a){return this.m_bodyB.GetWorldPoint(this.m_localAnchorB,a)};goog.exportProperty(b2.GearJoint.prototype,"GetAnchorB",b2.GearJoint.prototype.GetAnchorB);b2.GearJoint.prototype.GetReactionForce=function(a,b){return b2.Mul_S_V2(a*this.m_impulse,this.m_JvAC,b)};goog.exportProperty(b2.GearJoint.prototype,"GetReactionForce",b2.GearJoint.prototype.GetReactionForce);
b2.GearJoint.prototype.GetReactionTorque=function(a){return a*this.m_impulse*this.m_JwA};goog.exportProperty(b2.GearJoint.prototype,"GetReactionTorque",b2.GearJoint.prototype.GetReactionTorque);b2.GearJoint.prototype.GetJoint1=function(){return this.m_joint1};goog.exportProperty(b2.GearJoint.prototype,"GetJoint1",b2.GearJoint.prototype.GetJoint1);b2.GearJoint.prototype.GetJoint2=function(){return this.m_joint2};
goog.exportProperty(b2.GearJoint.prototype,"GetJoint2",b2.GearJoint.prototype.GetJoint2);b2.GearJoint.prototype.GetRatio=function(){return this.m_ratio};goog.exportProperty(b2.GearJoint.prototype,"GetRatio",b2.GearJoint.prototype.GetRatio);b2.GearJoint.prototype.SetRatio=function(a){b2.ENABLE_ASSERTS&&b2.Assert(b2.IsValid(a));this.m_ratio=a};goog.exportProperty(b2.GearJoint.prototype,"SetRatio",b2.GearJoint.prototype.SetRatio);
b2.GearJoint.prototype.Dump=function(){if(b2.DEBUG){var a=this.m_bodyA.m_islandIndex,b=this.m_bodyB.m_islandIndex,c=this.m_joint1.m_index,d=this.m_joint2.m_index;b2.Log("  /*b2.GearJointDef*/ var jd = new b2.GearJointDef();\n");b2.Log("  jd.bodyA = bodies[%d];\n",a);b2.Log("  jd.bodyB = bodies[%d];\n",b);b2.Log("  jd.collideConnected = %s;\n",this.m_collideConnected?"true":"false");b2.Log("  jd.joint1 = joints[%d];\n",c);b2.Log("  jd.joint2 = joints[%d];\n",
d);b2.Log("  jd.ratio = %.15f;\n",this.m_ratio);b2.Log("  joints[%d] = this.m_world.CreateJoint(jd);\n",this.m_index)}};goog.exportProperty(b2.GearJoint.prototype,"Dump",b2.GearJoint.prototype.Dump);b2.RopeJointDef=function(){b2.JointDef.call(this,b2.JointType.e_ropeJoint);this.localAnchorA=new b2.Vec2(-1,0);this.localAnchorB=new b2.Vec2(1,0)};goog.inherits(b2.RopeJointDef,b2.JointDef);goog.exportSymbol("b2.RopeJointDef",b2.RopeJointDef);b2.RopeJointDef.prototype.localAnchorA=null;goog.exportProperty(b2.RopeJointDef.prototype,"localAnchorA",b2.RopeJointDef.prototype.localAnchorA);b2.RopeJointDef.prototype.localAnchorB=null;
goog.exportProperty(b2.RopeJointDef.prototype,"localAnchorB",b2.RopeJointDef.prototype.localAnchorB);b2.RopeJointDef.prototype.maxLength=0;goog.exportProperty(b2.RopeJointDef.prototype,"maxLength",b2.RopeJointDef.prototype.maxLength);
b2.RopeJoint=function(a){b2.Joint.call(this,a);this.m_localAnchorA=a.localAnchorA.Clone();this.m_localAnchorB=a.localAnchorB.Clone();this.m_maxLength=a.maxLength;this.m_u=new b2.Vec2;this.m_rA=new b2.Vec2;this.m_rB=new b2.Vec2;this.m_localCenterA=new b2.Vec2;this.m_localCenterB=new b2.Vec2;this.m_qA=new b2.Rot;this.m_qB=new b2.Rot;this.m_lalcA=new b2.Vec2;this.m_lalcB=new b2.Vec2};goog.inherits(b2.RopeJoint,b2.Joint);
goog.exportSymbol("b2.RopeJoint",b2.RopeJoint);b2.RopeJoint.prototype.m_localAnchorA=null;goog.exportProperty(b2.RopeJoint.prototype,"m_localAnchorA",b2.RopeJoint.prototype.m_localAnchorA);b2.RopeJoint.prototype.m_localAnchorB=null;goog.exportProperty(b2.RopeJoint.prototype,"m_localAnchorB",b2.RopeJoint.prototype.m_localAnchorB);b2.RopeJoint.prototype.m_maxLength=0;goog.exportProperty(b2.RopeJoint.prototype,"m_maxLength",b2.RopeJoint.prototype.m_maxLength);
b2.RopeJoint.prototype.m_length=0;goog.exportProperty(b2.RopeJoint.prototype,"m_length",b2.RopeJoint.prototype.m_length);b2.RopeJoint.prototype.m_impulse=0;goog.exportProperty(b2.RopeJoint.prototype,"m_impulse",b2.RopeJoint.prototype.m_impulse);b2.RopeJoint.prototype.m_indexA=0;goog.exportProperty(b2.RopeJoint.prototype,"m_indexA",b2.RopeJoint.prototype.m_indexA);b2.RopeJoint.prototype.m_indexB=0;
goog.exportProperty(b2.RopeJoint.prototype,"m_indexB",b2.RopeJoint.prototype.m_indexB);b2.RopeJoint.prototype.m_u=null;goog.exportProperty(b2.RopeJoint.prototype,"m_u",b2.RopeJoint.prototype.m_u);b2.RopeJoint.prototype.m_rA=null;goog.exportProperty(b2.RopeJoint.prototype,"m_rA",b2.RopeJoint.prototype.m_rA);b2.RopeJoint.prototype.m_rB=null;goog.exportProperty(b2.RopeJoint.prototype,"m_rB",b2.RopeJoint.prototype.m_rB);
b2.RopeJoint.prototype.m_localCenterA=null;goog.exportProperty(b2.RopeJoint.prototype,"m_localCenterA",b2.RopeJoint.prototype.m_localCenterA);b2.RopeJoint.prototype.m_localCenterB=null;goog.exportProperty(b2.RopeJoint.prototype,"m_localCenterB",b2.RopeJoint.prototype.m_localCenterB);b2.RopeJoint.prototype.m_invMassA=0;goog.exportProperty(b2.RopeJoint.prototype,"m_invMassA",b2.RopeJoint.prototype.m_invMassA);b2.RopeJoint.prototype.m_invMassB=0;
goog.exportProperty(b2.RopeJoint.prototype,"m_invMassB",b2.RopeJoint.prototype.m_invMassB);b2.RopeJoint.prototype.m_invIA=0;goog.exportProperty(b2.RopeJoint.prototype,"m_invIA",b2.RopeJoint.prototype.m_invIA);b2.RopeJoint.prototype.m_invIB=0;goog.exportProperty(b2.RopeJoint.prototype,"m_invIB",b2.RopeJoint.prototype.m_invIB);b2.RopeJoint.prototype.m_mass=0;goog.exportProperty(b2.RopeJoint.prototype,"m_mass",b2.RopeJoint.prototype.m_mass);
b2.RopeJoint.prototype.m_state=b2.LimitState.e_inactiveLimit;goog.exportProperty(b2.RopeJoint.prototype,"m_state",b2.RopeJoint.prototype.m_state);b2.RopeJoint.prototype.m_qA=null;goog.exportProperty(b2.RopeJoint.prototype,"m_qA",b2.RopeJoint.prototype.m_qA);b2.RopeJoint.prototype.m_qB=null;goog.exportProperty(b2.RopeJoint.prototype,"m_qB",b2.RopeJoint.prototype.m_qB);b2.RopeJoint.prototype.m_lalcA=null;
goog.exportProperty(b2.RopeJoint.prototype,"m_lalcA",b2.RopeJoint.prototype.m_lalcA);b2.RopeJoint.prototype.m_lalcB=null;goog.exportProperty(b2.RopeJoint.prototype,"m_lalcB",b2.RopeJoint.prototype.m_lalcB);
b2.RopeJoint.prototype.InitVelocityConstraints=function(a){this.m_indexA=this.m_bodyA.m_islandIndex;this.m_indexB=this.m_bodyB.m_islandIndex;this.m_localCenterA.Copy(this.m_bodyA.m_sweep.localCenter);this.m_localCenterB.Copy(this.m_bodyB.m_sweep.localCenter);this.m_invMassA=this.m_bodyA.m_invMass;this.m_invMassB=this.m_bodyB.m_invMass;this.m_invIA=this.m_bodyA.m_invI;this.m_invIB=this.m_bodyB.m_invI;var b=a.positions[this.m_indexA].c,c=a.velocities[this.m_indexA].v,d=a.velocities[this.m_indexA].w,
e=a.positions[this.m_indexB].c,f=a.positions[this.m_indexB].a,g=a.velocities[this.m_indexB].v,h=a.velocities[this.m_indexB].w,k=this.m_qA.SetAngle(a.positions[this.m_indexA].a),f=this.m_qB.SetAngle(f);b2.Sub_V2_V2(this.m_localAnchorA,this.m_localCenterA,this.m_lalcA);b2.Mul_R_V2(k,this.m_lalcA,this.m_rA);b2.Sub_V2_V2(this.m_localAnchorB,this.m_localCenterB,this.m_lalcB);b2.Mul_R_V2(f,this.m_lalcB,this.m_rB);this.m_u.Copy(e).SelfAdd(this.m_rB).SelfSub(b).SelfSub(this.m_rA);this.m_length=
this.m_u.Length();this.m_state=0<this.m_length-this.m_maxLength?b2.LimitState.e_atUpperLimit:b2.LimitState.e_inactiveLimit;this.m_length>b2._linearSlop?(this.m_u.SelfMul(1/this.m_length),b=b2.Cross_V2_V2(this.m_rA,this.m_u),e=b2.Cross_V2_V2(this.m_rB,this.m_u),b=this.m_invMassA+this.m_invIA*b*b+this.m_invMassB+this.m_invIB*e*e,this.m_mass=0!==b?1/b:0,a.step.warmStarting?(this.m_impulse*=a.step.dtRatio,b=b2.Mul_S_V2(this.m_impulse,this.m_u,b2.RopeJoint.prototype.InitVelocityConstraints.s_P),
c.SelfMulSub(this.m_invMassA,b),d-=this.m_invIA*b2.Cross_V2_V2(this.m_rA,b),g.SelfMulAdd(this.m_invMassB,b),h+=this.m_invIB*b2.Cross_V2_V2(this.m_rB,b)):this.m_impulse=0,a.velocities[this.m_indexA].w=d,a.velocities[this.m_indexB].w=h):(this.m_u.SetZero(),this.m_impulse=this.m_mass=0)};goog.exportProperty(b2.RopeJoint.prototype,"InitVelocityConstraints",b2.RopeJoint.prototype.InitVelocityConstraints);b2.RopeJoint.prototype.InitVelocityConstraints.s_P=new b2.Vec2;
b2.RopeJoint.prototype.SolveVelocityConstraints=function(a){var b=a.velocities[this.m_indexA].v,c=a.velocities[this.m_indexA].w,d=a.velocities[this.m_indexB].v,e=a.velocities[this.m_indexB].w,f=b2.AddCross_V2_S_V2(b,c,this.m_rA,b2.RopeJoint.prototype.SolveVelocityConstraints.s_vpA),g=b2.AddCross_V2_S_V2(d,e,this.m_rB,b2.RopeJoint.prototype.SolveVelocityConstraints.s_vpB),h=this.m_length-this.m_maxLength,f=b2.Dot_V2_V2(this.m_u,b2.Sub_V2_V2(g,f,b2.Vec2.s_t0));
0>h&&(f+=a.step.inv_dt*h);h=-this.m_mass*f;f=this.m_impulse;this.m_impulse=b2.Min(0,this.m_impulse+h);h=this.m_impulse-f;h=b2.Mul_S_V2(h,this.m_u,b2.RopeJoint.prototype.SolveVelocityConstraints.s_P);b.SelfMulSub(this.m_invMassA,h);c-=this.m_invIA*b2.Cross_V2_V2(this.m_rA,h);d.SelfMulAdd(this.m_invMassB,h);e+=this.m_invIB*b2.Cross_V2_V2(this.m_rB,h);a.velocities[this.m_indexA].w=c;a.velocities[this.m_indexB].w=e};
goog.exportProperty(b2.RopeJoint.prototype,"SolveVelocityConstraints",b2.RopeJoint.prototype.SolveVelocityConstraints);b2.RopeJoint.prototype.SolveVelocityConstraints.s_vpA=new b2.Vec2;b2.RopeJoint.prototype.SolveVelocityConstraints.s_vpB=new b2.Vec2;b2.RopeJoint.prototype.SolveVelocityConstraints.s_P=new b2.Vec2;
b2.RopeJoint.prototype.SolvePositionConstraints=function(a){var b=a.positions[this.m_indexA].c,c=a.positions[this.m_indexA].a,d=a.positions[this.m_indexB].c,e=a.positions[this.m_indexB].a,f=this.m_qA.SetAngle(c),g=this.m_qB.SetAngle(e);b2.Sub_V2_V2(this.m_localAnchorA,this.m_localCenterA,this.m_lalcA);f=b2.Mul_R_V2(f,this.m_lalcA,this.m_rA);b2.Sub_V2_V2(this.m_localAnchorB,this.m_localCenterB,this.m_lalcB);var g=b2.Mul_R_V2(g,this.m_lalcB,this.m_rB),h=this.m_u.Copy(d).SelfAdd(g).SelfSub(b).SelfSub(f),
k=h.Normalize(),l=k-this.m_maxLength,l=b2.Clamp(l,0,b2._maxLinearCorrection),h=b2.Mul_S_V2(-this.m_mass*l,h,b2.RopeJoint.prototype.SolvePositionConstraints.s_P);b.SelfMulSub(this.m_invMassA,h);c-=this.m_invIA*b2.Cross_V2_V2(f,h);d.SelfMulAdd(this.m_invMassB,h);e+=this.m_invIB*b2.Cross_V2_V2(g,h);a.positions[this.m_indexA].a=c;a.positions[this.m_indexB].a=e;return k-this.m_maxLength<b2._linearSlop};
goog.exportProperty(b2.RopeJoint.prototype,"SolvePositionConstraints",b2.RopeJoint.prototype.SolvePositionConstraints);b2.RopeJoint.prototype.SolvePositionConstraints.s_P=new b2.Vec2;b2.RopeJoint.prototype.GetAnchorA=function(a){return this.m_bodyA.GetWorldPoint(this.m_localAnchorA,a)};goog.exportProperty(b2.RopeJoint.prototype,"GetAnchorA",b2.RopeJoint.prototype.GetAnchorA);
b2.RopeJoint.prototype.GetAnchorB=function(a){return this.m_bodyB.GetWorldPoint(this.m_localAnchorB,a)};goog.exportProperty(b2.RopeJoint.prototype,"GetAnchorB",b2.RopeJoint.prototype.GetAnchorB);b2.RopeJoint.prototype.GetReactionForce=function(a,b){return b2.Mul_S_V2(a*this.m_impulse,this.m_u,b)};goog.exportProperty(b2.RopeJoint.prototype,"GetReactionForce",b2.RopeJoint.prototype.GetReactionForce);b2.RopeJoint.prototype.GetReactionTorque=function(a){return 0};
goog.exportProperty(b2.RopeJoint.prototype,"GetReactionTorque",b2.RopeJoint.prototype.GetReactionTorque);b2.RopeJoint.prototype.GetLocalAnchorA=function(a){return a.Copy(this.m_localAnchorA)};goog.exportProperty(b2.RopeJoint.prototype,"GetLocalAnchorA",b2.RopeJoint.prototype.GetLocalAnchorA);b2.RopeJoint.prototype.GetLocalAnchorB=function(a){return a.Copy(this.m_localAnchorB)};goog.exportProperty(b2.RopeJoint.prototype,"GetLocalAnchorB",b2.RopeJoint.prototype.GetLocalAnchorB);
b2.RopeJoint.prototype.SetMaxLength=function(a){this.m_maxLength=a};goog.exportProperty(b2.RopeJoint.prototype,"SetMaxLength",b2.RopeJoint.prototype.SetMaxLength);b2.RopeJoint.prototype.GetMaxLength=function(){return this.m_maxLength};goog.exportProperty(b2.RopeJoint.prototype,"GetMaxLength",b2.RopeJoint.prototype.GetMaxLength);b2.RopeJoint.prototype.GetLimitState=function(){return this.m_state};goog.exportProperty(b2.RopeJoint.prototype,"GetLimitState",b2.RopeJoint.prototype.GetLimitState);
b2.RopeJoint.prototype.Dump=function(){if(b2.DEBUG){var a=this.m_bodyA.m_islandIndex,b=this.m_bodyB.m_islandIndex;b2.Log("  /*b2.RopeJointDef*/ var jd = new b2.RopeJointDef();\n");b2.Log("  jd.bodyA = bodies[%d];\n",a);b2.Log("  jd.bodyB = bodies[%d];\n",b);b2.Log("  jd.collideConnected = %s;\n",this.m_collideConnected?"true":"false");b2.Log("  jd.localAnchorA.Set(%.15f, %.15f);\n",this.m_localAnchorA.x,this.m_localAnchorA.y);b2.Log("  jd.localAnchorB.Set(%.15f, %.15f);\n",
this.m_localAnchorB.x,this.m_localAnchorB.y);b2.Log("  jd.maxLength = %.15f;\n",this.m_maxLength);b2.Log("  joints[%d] = this.m_world.CreateJoint(jd);\n",this.m_index)}};goog.exportProperty(b2.RopeJoint.prototype,"Dump",b2.RopeJoint.prototype.Dump);b2.WeldJointDef=function(){b2.JointDef.call(this,b2.JointType.e_weldJoint);this.localAnchorA=new b2.Vec2;this.localAnchorB=new b2.Vec2};goog.inherits(b2.WeldJointDef,b2.JointDef);goog.exportSymbol("b2.WeldJointDef",b2.WeldJointDef);b2.WeldJointDef.prototype.localAnchorA=null;goog.exportProperty(b2.WeldJointDef.prototype,"localAnchorA",b2.WeldJointDef.prototype.localAnchorA);b2.WeldJointDef.prototype.localAnchorB=null;
goog.exportProperty(b2.WeldJointDef.prototype,"localAnchorB",b2.WeldJointDef.prototype.localAnchorB);b2.WeldJointDef.prototype.referenceAngle=0;goog.exportProperty(b2.WeldJointDef.prototype,"referenceAngle",b2.WeldJointDef.prototype.referenceAngle);b2.WeldJointDef.prototype.frequencyHz=0;goog.exportProperty(b2.WeldJointDef.prototype,"frequencyHz",b2.WeldJointDef.prototype.frequencyHz);b2.WeldJointDef.prototype.dampingRatio=0;
goog.exportProperty(b2.WeldJointDef.prototype,"dampingRatio",b2.WeldJointDef.prototype.dampingRatio);b2.WeldJointDef.prototype.Initialize=function(a,b,c){this.bodyA=a;this.bodyB=b;this.bodyA.GetLocalPoint(c,this.localAnchorA);this.bodyB.GetLocalPoint(c,this.localAnchorB);this.referenceAngle=this.bodyB.GetAngle()-this.bodyA.GetAngle()};goog.exportProperty(b2.WeldJointDef.prototype,"Initialize",b2.WeldJointDef.prototype.Initialize);
b2.WeldJoint=function(a){b2.Joint.call(this,a);this.m_frequencyHz=a.frequencyHz;this.m_dampingRatio=a.dampingRatio;this.m_localAnchorA=a.localAnchorA.Clone();this.m_localAnchorB=a.localAnchorB.Clone();this.m_referenceAngle=a.referenceAngle;this.m_impulse=new b2.Vec3(0,0,0);this.m_rA=new b2.Vec2;this.m_rB=new b2.Vec2;this.m_localCenterA=new b2.Vec2;this.m_localCenterB=new b2.Vec2;this.m_mass=new b2.Mat33;this.m_qA=new b2.Rot;this.m_qB=new b2.Rot;this.m_lalcA=
new b2.Vec2;this.m_lalcB=new b2.Vec2;this.m_K=new b2.Mat33};goog.inherits(b2.WeldJoint,b2.Joint);goog.exportSymbol("b2.WeldJoint",b2.WeldJoint);b2.WeldJoint.prototype.m_frequencyHz=0;goog.exportProperty(b2.WeldJoint.prototype,"m_frequencyHz",b2.WeldJoint.prototype.m_frequencyHz);b2.WeldJoint.prototype.m_dampingRatio=0;goog.exportProperty(b2.WeldJoint.prototype,"m_dampingRatio",b2.WeldJoint.prototype.m_dampingRatio);
b2.WeldJoint.prototype.m_bias=0;goog.exportProperty(b2.WeldJoint.prototype,"m_bias",b2.WeldJoint.prototype.m_bias);b2.WeldJoint.prototype.m_localAnchorA=null;goog.exportProperty(b2.WeldJoint.prototype,"m_localAnchorA",b2.WeldJoint.prototype.m_localAnchorA);b2.WeldJoint.prototype.m_localAnchorB=null;goog.exportProperty(b2.WeldJoint.prototype,"m_localAnchorB",b2.WeldJoint.prototype.m_localAnchorB);b2.WeldJoint.prototype.m_referenceAngle=0;
goog.exportProperty(b2.WeldJoint.prototype,"m_referenceAngle",b2.WeldJoint.prototype.m_referenceAngle);b2.WeldJoint.prototype.m_gamma=0;goog.exportProperty(b2.WeldJoint.prototype,"m_gamma",b2.WeldJoint.prototype.m_gamma);b2.WeldJoint.prototype.m_impulse=null;goog.exportProperty(b2.WeldJoint.prototype,"m_impulse",b2.WeldJoint.prototype.m_impulse);b2.WeldJoint.prototype.m_indexA=0;goog.exportProperty(b2.WeldJoint.prototype,"m_indexA",b2.WeldJoint.prototype.m_indexA);
b2.WeldJoint.prototype.m_indexB=0;goog.exportProperty(b2.WeldJoint.prototype,"m_indexB",b2.WeldJoint.prototype.m_indexB);b2.WeldJoint.prototype.m_rA=null;goog.exportProperty(b2.WeldJoint.prototype,"m_rA",b2.WeldJoint.prototype.m_rA);b2.WeldJoint.prototype.m_rB=null;goog.exportProperty(b2.WeldJoint.prototype,"m_rB",b2.WeldJoint.prototype.m_rB);b2.WeldJoint.prototype.m_localCenterA=null;
goog.exportProperty(b2.WeldJoint.prototype,"m_localCenterA",b2.WeldJoint.prototype.m_localCenterA);b2.WeldJoint.prototype.m_localCenterB=null;goog.exportProperty(b2.WeldJoint.prototype,"m_localCenterB",b2.WeldJoint.prototype.m_localCenterB);b2.WeldJoint.prototype.m_invMassA=0;goog.exportProperty(b2.WeldJoint.prototype,"m_invMassA",b2.WeldJoint.prototype.m_invMassA);b2.WeldJoint.prototype.m_invMassB=0;
goog.exportProperty(b2.WeldJoint.prototype,"m_invMassB",b2.WeldJoint.prototype.m_invMassB);b2.WeldJoint.prototype.m_invIA=0;goog.exportProperty(b2.WeldJoint.prototype,"m_invIA",b2.WeldJoint.prototype.m_invIA);b2.WeldJoint.prototype.m_invIB=0;goog.exportProperty(b2.WeldJoint.prototype,"m_invIB",b2.WeldJoint.prototype.m_invIB);b2.WeldJoint.prototype.m_mass=null;goog.exportProperty(b2.WeldJoint.prototype,"m_mass",b2.WeldJoint.prototype.m_mass);
b2.WeldJoint.prototype.m_qA=null;goog.exportProperty(b2.WeldJoint.prototype,"m_qA",b2.WeldJoint.prototype.m_qA);b2.WeldJoint.prototype.m_qB=null;goog.exportProperty(b2.WeldJoint.prototype,"m_qB",b2.WeldJoint.prototype.m_qB);b2.WeldJoint.prototype.m_lalcA=null;goog.exportProperty(b2.WeldJoint.prototype,"m_lalcA",b2.WeldJoint.prototype.m_lalcA);b2.WeldJoint.prototype.m_lalcB=null;goog.exportProperty(b2.WeldJoint.prototype,"m_lalcB",b2.WeldJoint.prototype.m_lalcB);
b2.WeldJoint.prototype.m_K=null;goog.exportProperty(b2.WeldJoint.prototype,"m_K",b2.WeldJoint.prototype.m_K);
b2.WeldJoint.prototype.InitVelocityConstraints=function(a){this.m_indexA=this.m_bodyA.m_islandIndex;this.m_indexB=this.m_bodyB.m_islandIndex;this.m_localCenterA.Copy(this.m_bodyA.m_sweep.localCenter);this.m_localCenterB.Copy(this.m_bodyB.m_sweep.localCenter);this.m_invMassA=this.m_bodyA.m_invMass;this.m_invMassB=this.m_bodyB.m_invMass;this.m_invIA=this.m_bodyA.m_invI;this.m_invIB=this.m_bodyB.m_invI;var b=a.positions[this.m_indexA].a,c=a.velocities[this.m_indexA].v,d=a.velocities[this.m_indexA].w,
e=a.positions[this.m_indexB].a,f=a.velocities[this.m_indexB].v,g=a.velocities[this.m_indexB].w,h=this.m_qA.SetAngle(b),k=this.m_qB.SetAngle(e);b2.Sub_V2_V2(this.m_localAnchorA,this.m_localCenterA,this.m_lalcA);b2.Mul_R_V2(h,this.m_lalcA,this.m_rA);b2.Sub_V2_V2(this.m_localAnchorB,this.m_localCenterB,this.m_lalcB);b2.Mul_R_V2(k,this.m_lalcB,this.m_rB);var h=this.m_invMassA,k=this.m_invMassB,l=this.m_invIA,m=this.m_invIB,n=this.m_K;n.ex.x=h+k+this.m_rA.y*this.m_rA.y*l+this.m_rB.y*
this.m_rB.y*m;n.ey.x=-this.m_rA.y*this.m_rA.x*l-this.m_rB.y*this.m_rB.x*m;n.ez.x=-this.m_rA.y*l-this.m_rB.y*m;n.ex.y=n.ey.x;n.ey.y=h+k+this.m_rA.x*this.m_rA.x*l+this.m_rB.x*this.m_rB.x*m;n.ez.y=this.m_rA.x*l+this.m_rB.x*m;n.ex.z=n.ez.x;n.ey.z=n.ez.y;n.ez.z=l+m;if(0<this.m_frequencyHz){n.GetInverse22(this.m_mass);var n=l+m,p=0<n?1/n:0,b=e-b-this.m_referenceAngle,e=2*b2._pi*this.m_frequencyHz,q=p*e*e,r=a.step.dt;this.m_gamma=r*(2*p*this.m_dampingRatio*e+r*q);this.m_gamma=0!==this.m_gamma?1/this.m_gamma:
0;this.m_bias=b*r*q*this.m_gamma;n+=this.m_gamma;this.m_mass.ez.z=0!==n?1/n:0}else 0===n.ez.z?n.GetInverse22(this.m_mass):n.GetSymInverse33(this.m_mass),this.m_bias=this.m_gamma=0;a.step.warmStarting?(this.m_impulse.SelfMulScalar(a.step.dtRatio),n=b2.WeldJoint.prototype.InitVelocityConstraints.s_P.Set(this.m_impulse.x,this.m_impulse.y),c.SelfMulSub(h,n),d-=l*(b2.Cross_V2_V2(this.m_rA,n)+this.m_impulse.z),f.SelfMulAdd(k,n),g+=m*(b2.Cross_V2_V2(this.m_rB,n)+this.m_impulse.z)):this.m_impulse.SetZero();
a.velocities[this.m_indexA].w=d;a.velocities[this.m_indexB].w=g};b2.WeldJoint.prototype.InitVelocityConstraints.s_P=new b2.Vec2;
b2.WeldJoint.prototype.SolveVelocityConstraints=function(a){var b=a.velocities[this.m_indexA].v,c=a.velocities[this.m_indexA].w,d=a.velocities[this.m_indexB].v,e=a.velocities[this.m_indexB].w,f=this.m_invMassA,g=this.m_invMassB,h=this.m_invIA,k=this.m_invIB;if(0<this.m_frequencyHz){var l=-this.m_mass.ez.z*(e-c+this.m_bias+this.m_gamma*this.m_impulse.z);this.m_impulse.z+=l;c-=h*l;e+=k*l;l=b2.Sub_V2_V2(b2.AddCross_V2_S_V2(d,e,this.m_rB,b2.Vec2.s_t0),b2.AddCross_V2_S_V2(b,c,
this.m_rA,b2.Vec2.s_t1),b2.WeldJoint.prototype.SolveVelocityConstraints.s_Cdot1);l=b2.Mul_M33_X_Y(this.m_mass,l.x,l.y,b2.WeldJoint.prototype.SolveVelocityConstraints.s_impulse1).SelfNeg();this.m_impulse.x+=l.x;this.m_impulse.y+=l.y;b.SelfMulSub(f,l);c-=h*b2.Cross_V2_V2(this.m_rA,l);d.SelfMulAdd(g,l);e+=k*b2.Cross_V2_V2(this.m_rB,l)}else{var l=b2.Sub_V2_V2(b2.AddCross_V2_S_V2(d,e,this.m_rB,b2.Vec2.s_t0),b2.AddCross_V2_S_V2(b,c,this.m_rA,b2.Vec2.s_t1),
b2.WeldJoint.prototype.SolveVelocityConstraints.s_Cdot1),m=b2.Mul_M33_X_Y_Z(this.m_mass,l.x,l.y,e-c,b2.WeldJoint.prototype.SolveVelocityConstraints.s_impulse).SelfNeg();this.m_impulse.SelfAdd(m);l=b2.WeldJoint.prototype.SolveVelocityConstraints.s_P.Set(m.x,m.y);b.SelfMulSub(f,l);c-=h*(b2.Cross_V2_V2(this.m_rA,l)+m.z);d.SelfMulAdd(g,l);e+=k*(b2.Cross_V2_V2(this.m_rB,l)+m.z)}a.velocities[this.m_indexA].w=c;a.velocities[this.m_indexB].w=e};
goog.exportProperty(b2.WeldJoint.prototype,"SolveVelocityConstraints",b2.WeldJoint.prototype.SolveVelocityConstraints);b2.WeldJoint.prototype.SolveVelocityConstraints.s_Cdot1=new b2.Vec2;b2.WeldJoint.prototype.SolveVelocityConstraints.s_impulse1=new b2.Vec2;b2.WeldJoint.prototype.SolveVelocityConstraints.s_impulse=new b2.Vec3;b2.WeldJoint.prototype.SolveVelocityConstraints.s_P=new b2.Vec2;
b2.WeldJoint.prototype.SolvePositionConstraints=function(a){var b=a.positions[this.m_indexA].c,c=a.positions[this.m_indexA].a,d=a.positions[this.m_indexB].c,e=a.positions[this.m_indexB].a,f=this.m_qA.SetAngle(c),g=this.m_qB.SetAngle(e),h=this.m_invMassA,k=this.m_invMassB,l=this.m_invIA,m=this.m_invIB;b2.Sub_V2_V2(this.m_localAnchorA,this.m_localCenterA,this.m_lalcA);var n=b2.Mul_R_V2(f,this.m_lalcA,this.m_rA);b2.Sub_V2_V2(this.m_localAnchorB,this.m_localCenterB,this.m_lalcB);var p=
b2.Mul_R_V2(g,this.m_lalcB,this.m_rB),q=this.m_K;q.ex.x=h+k+n.y*n.y*l+p.y*p.y*m;q.ey.x=-n.y*n.x*l-p.y*p.x*m;q.ez.x=-n.y*l-p.y*m;q.ex.y=q.ey.x;q.ey.y=h+k+n.x*n.x*l+p.x*p.x*m;q.ez.y=n.x*l+p.x*m;q.ex.z=q.ez.x;q.ey.z=q.ez.y;q.ez.z=l+m;if(0<this.m_frequencyHz){var r=b2.Sub_V2_V2(b2.Add_V2_V2(d,p,b2.Vec2.s_t0),b2.Add_V2_V2(b,n,b2.Vec2.s_t1),b2.WeldJoint.prototype.SolvePositionConstraints.s_C1),g=r.Length(),f=0,q=q.Solve22(r.x,r.y,b2.WeldJoint.prototype.SolvePositionConstraints.s_P).SelfNeg();
b.SelfMulSub(h,q);c-=l*b2.Cross_V2_V2(n,q);d.SelfMulAdd(k,q);e+=m*b2.Cross_V2_V2(p,q)}else r=b2.Sub_V2_V2(b2.Add_V2_V2(d,p,b2.Vec2.s_t0),b2.Add_V2_V2(b,n,b2.Vec2.s_t1),b2.WeldJoint.prototype.SolvePositionConstraints.s_C1),p=e-c-this.m_referenceAngle,g=r.Length(),f=b2.Abs(p),n=b2.WeldJoint.prototype.SolvePositionConstraints.s_impulse,0<q.ez.z?q.Solve33(r.x,r.y,p,n).SelfNeg():(q=q.Solve22(r.x,r.y,b2.WeldJoint.prototype.SolvePositionConstraints.s_impulse2).SelfNeg(),
n.x=q.x,n.y=q.y,n.z=0),q=b2.WeldJoint.prototype.SolvePositionConstraints.s_P.Set(n.x,n.y),b.SelfMulSub(h,q),c-=l*(b2.Cross_V2_V2(this.m_rA,q)+n.z),d.SelfMulAdd(k,q),e+=m*(b2.Cross_V2_V2(this.m_rB,q)+n.z);a.positions[this.m_indexA].a=c;a.positions[this.m_indexB].a=e;return g<=b2._linearSlop&&f<=b2._angularSlop};goog.exportProperty(b2.WeldJoint.prototype,"SolvePositionConstraints",b2.WeldJoint.prototype.SolvePositionConstraints);
b2.WeldJoint.prototype.SolvePositionConstraints.s_C1=new b2.Vec2;b2.WeldJoint.prototype.SolvePositionConstraints.s_P=new b2.Vec2;b2.WeldJoint.prototype.SolvePositionConstraints.s_impulse=new b2.Vec3;b2.WeldJoint.prototype.SolvePositionConstraints.s_impulse2=new b2.Vec2;b2.WeldJoint.prototype.GetAnchorA=function(a){return this.m_bodyA.GetWorldPoint(this.m_localAnchorA,a)};goog.exportProperty(b2.WeldJoint.prototype,"GetAnchorA",b2.WeldJoint.prototype.GetAnchorA);
b2.WeldJoint.prototype.GetAnchorB=function(a){return this.m_bodyB.GetWorldPoint(this.m_localAnchorB,a)};goog.exportProperty(b2.WeldJoint.prototype,"GetAnchorB",b2.WeldJoint.prototype.GetAnchorB);b2.WeldJoint.prototype.GetReactionForce=function(a,b){return b.Set(a*this.m_impulse.x,a*this.m_impulse.y)};goog.exportProperty(b2.WeldJoint.prototype,"GetReactionForce",b2.WeldJoint.prototype.GetReactionForce);
b2.WeldJoint.prototype.GetReactionTorque=function(a){return a*this.m_impulse.z};goog.exportProperty(b2.WeldJoint.prototype,"GetReactionTorque",b2.WeldJoint.prototype.GetReactionTorque);b2.WeldJoint.prototype.GetLocalAnchorA=function(a){return a.Copy(this.m_localAnchorA)};goog.exportProperty(b2.WeldJoint.prototype,"GetLocalAnchorA",b2.WeldJoint.prototype.GetLocalAnchorA);b2.WeldJoint.prototype.GetLocalAnchorB=function(a){return a.Copy(this.m_localAnchorB)};
goog.exportProperty(b2.WeldJoint.prototype,"GetLocalAnchorB",b2.WeldJoint.prototype.GetLocalAnchorB);b2.WeldJoint.prototype.GetReferenceAngle=function(){return this.m_referenceAngle};goog.exportProperty(b2.WeldJoint.prototype,"GetReferenceAngle",b2.WeldJoint.prototype.GetReferenceAngle);b2.WeldJoint.prototype.SetFrequency=function(a){this.m_frequencyHz=a};b2.WeldJoint.prototype.GetFrequency=function(){return this.m_frequencyHz};
goog.exportProperty(b2.WeldJoint.prototype,"GetFrequency",b2.WeldJoint.prototype.GetFrequency);b2.WeldJoint.prototype.SetDampingRatio=function(a){this.m_dampingRatio=a};b2.WeldJoint.prototype.GetDampingRatio=function(){return this.m_dampingRatio};goog.exportProperty(b2.WeldJoint.prototype,"GetDampingRatio",b2.WeldJoint.prototype.GetDampingRatio);
b2.WeldJoint.prototype.Dump=function(){if(b2.DEBUG){var a=this.m_bodyA.m_islandIndex,b=this.m_bodyB.m_islandIndex;b2.Log("  /*b2.WeldJointDef*/ var jd = new b2.WeldJointDef();\n");b2.Log("  jd.bodyA = bodies[%d];\n",a);b2.Log("  jd.bodyB = bodies[%d];\n",b);b2.Log("  jd.collideConnected = %s;\n",this.m_collideConnected?"true":"false");b2.Log("  jd.localAnchorA.Set(%.15f, %.15f);\n",this.m_localAnchorA.x,this.m_localAnchorA.y);b2.Log("  jd.localAnchorB.Set(%.15f, %.15f);\n",
this.m_localAnchorB.x,this.m_localAnchorB.y);b2.Log("  jd.referenceAngle = %.15f;\n",this.m_referenceAngle);b2.Log("  jd.frequencyHz = %.15f;\n",this.m_frequencyHz);b2.Log("  jd.dampingRatio = %.15f;\n",this.m_dampingRatio);b2.Log("  joints[%d] = this.m_world.CreateJoint(jd);\n",this.m_index)}};goog.exportProperty(b2.WeldJoint.prototype,"Dump",b2.WeldJoint.prototype.Dump);b2.WheelJointDef=function(){b2.JointDef.call(this,b2.JointType.e_wheelJoint);this.localAnchorA=new b2.Vec2(0,0);this.localAnchorB=new b2.Vec2(0,0);this.localAxisA=new b2.Vec2(1,0)};goog.inherits(b2.WheelJointDef,b2.JointDef);goog.exportSymbol("b2.WheelJointDef",b2.WheelJointDef);b2.WheelJointDef.prototype.localAnchorA=null;goog.exportProperty(b2.WheelJointDef.prototype,"localAnchorA",b2.WheelJointDef.prototype.localAnchorA);
b2.WheelJointDef.prototype.localAnchorB=null;goog.exportProperty(b2.WheelJointDef.prototype,"localAnchorB",b2.WheelJointDef.prototype.localAnchorB);b2.WheelJointDef.prototype.localAxisA=null;goog.exportProperty(b2.WheelJointDef.prototype,"localAxisA",b2.WheelJointDef.prototype.localAxisA);b2.WheelJointDef.prototype.enableMotor=!1;goog.exportProperty(b2.WheelJointDef.prototype,"enableMotor",b2.WheelJointDef.prototype.enableMotor);
b2.WheelJointDef.prototype.maxMotorTorque=0;goog.exportProperty(b2.WheelJointDef.prototype,"maxMotorTorque",b2.WheelJointDef.prototype.maxMotorTorque);b2.WheelJointDef.prototype.motorSpeed=0;goog.exportProperty(b2.WheelJointDef.prototype,"motorSpeed",b2.WheelJointDef.prototype.motorSpeed);b2.WheelJointDef.prototype.frequencyHz=2;goog.exportProperty(b2.WheelJointDef.prototype,"frequencyHz",b2.WheelJointDef.prototype.frequencyHz);
b2.WheelJointDef.prototype.dampingRatio=.7;goog.exportProperty(b2.WheelJointDef.prototype,"dampingRatio",b2.WheelJointDef.prototype.dampingRatio);b2.WheelJointDef.prototype.Initialize=function(a,b,c,d){this.bodyA=a;this.bodyB=b;this.bodyA.GetLocalPoint(c,this.localAnchorA);this.bodyB.GetLocalPoint(c,this.localAnchorB);this.bodyA.GetLocalVector(d,this.localAxisA)};goog.exportProperty(b2.WheelJointDef.prototype,"Initialize",b2.WheelJointDef.prototype.Initialize);
b2.WheelJoint=function(a){b2.Joint.call(this,a);this.m_frequencyHz=a.frequencyHz;this.m_dampingRatio=a.dampingRatio;this.m_localAnchorA=a.localAnchorA.Clone();this.m_localAnchorB=a.localAnchorB.Clone();this.m_localXAxisA=a.localAxisA.Clone();this.m_localYAxisA=b2.Cross_S_V2(1,this.m_localXAxisA,new b2.Vec2);this.m_maxMotorTorque=a.maxMotorTorque;this.m_motorSpeed=a.motorSpeed;this.m_enableMotor=a.enableMotor;this.m_localCenterA=new b2.Vec2;this.m_localCenterB=new b2.Vec2;
this.m_ax=new b2.Vec2;this.m_ay=new b2.Vec2;this.m_qA=new b2.Rot;this.m_qB=new b2.Rot;this.m_lalcA=new b2.Vec2;this.m_lalcB=new b2.Vec2;this.m_rA=new b2.Vec2;this.m_rB=new b2.Vec2;this.m_ax.SetZero();this.m_ay.SetZero()};goog.inherits(b2.WheelJoint,b2.Joint);goog.exportSymbol("b2.WheelJoint",b2.WheelJoint);b2.WheelJoint.prototype.m_frequencyHz=0;goog.exportProperty(b2.WheelJoint.prototype,"m_frequencyHz",b2.WheelJoint.prototype.m_frequencyHz);
b2.WheelJoint.prototype.m_dampingRatio=0;goog.exportProperty(b2.WheelJoint.prototype,"m_dampingRatio",b2.WheelJoint.prototype.m_dampingRatio);b2.WheelJoint.prototype.m_localAnchorA=null;goog.exportProperty(b2.WheelJoint.prototype,"m_localAnchorA",b2.WheelJoint.prototype.m_localAnchorA);b2.WheelJoint.prototype.m_localAnchorB=null;goog.exportProperty(b2.WheelJoint.prototype,"m_localAnchorB",b2.WheelJoint.prototype.m_localAnchorB);
b2.WheelJoint.prototype.m_localXAxisA=null;goog.exportProperty(b2.WheelJoint.prototype,"m_localXAxisA",b2.WheelJoint.prototype.m_localXAxisA);b2.WheelJoint.prototype.m_localYAxisA=null;goog.exportProperty(b2.WheelJoint.prototype,"m_localYAxisA",b2.WheelJoint.prototype.m_localYAxisA);b2.WheelJoint.prototype.m_impulse=0;goog.exportProperty(b2.WheelJoint.prototype,"m_impulse",b2.WheelJoint.prototype.m_impulse);b2.WheelJoint.prototype.m_motorImpulse=0;
goog.exportProperty(b2.WheelJoint.prototype,"m_motorImpulse",b2.WheelJoint.prototype.m_motorImpulse);b2.WheelJoint.prototype.m_springImpulse=0;goog.exportProperty(b2.WheelJoint.prototype,"m_springImpulse",b2.WheelJoint.prototype.m_springImpulse);b2.WheelJoint.prototype.m_maxMotorTorque=0;goog.exportProperty(b2.WheelJoint.prototype,"m_maxMotorTorque",b2.WheelJoint.prototype.m_maxMotorTorque);b2.WheelJoint.prototype.m_motorSpeed=0;
goog.exportProperty(b2.WheelJoint.prototype,"m_motorSpeed",b2.WheelJoint.prototype.m_motorSpeed);b2.WheelJoint.prototype.m_enableMotor=!1;goog.exportProperty(b2.WheelJoint.prototype,"m_enableMotor",b2.WheelJoint.prototype.m_enableMotor);b2.WheelJoint.prototype.m_indexA=0;goog.exportProperty(b2.WheelJoint.prototype,"m_indexA",b2.WheelJoint.prototype.m_indexA);b2.WheelJoint.prototype.m_indexB=0;
goog.exportProperty(b2.WheelJoint.prototype,"m_indexB",b2.WheelJoint.prototype.m_indexB);b2.WheelJoint.prototype.m_localCenterA=null;goog.exportProperty(b2.WheelJoint.prototype,"m_localCenterA",b2.WheelJoint.prototype.m_localCenterA);b2.WheelJoint.prototype.m_localCenterB=null;goog.exportProperty(b2.WheelJoint.prototype,"m_localCenterB",b2.WheelJoint.prototype.m_localCenterB);b2.WheelJoint.prototype.m_invMassA=0;
goog.exportProperty(b2.WheelJoint.prototype,"m_invMassA",b2.WheelJoint.prototype.m_invMassA);b2.WheelJoint.prototype.m_invMassB=0;goog.exportProperty(b2.WheelJoint.prototype,"m_invMassB",b2.WheelJoint.prototype.m_invMassB);b2.WheelJoint.prototype.m_invIA=0;goog.exportProperty(b2.WheelJoint.prototype,"m_invIA",b2.WheelJoint.prototype.m_invIA);b2.WheelJoint.prototype.m_invIB=0;goog.exportProperty(b2.WheelJoint.prototype,"m_invIB",b2.WheelJoint.prototype.m_invIB);
b2.WheelJoint.prototype.m_ax=null;goog.exportProperty(b2.WheelJoint.prototype,"m_ax",b2.WheelJoint.prototype.m_ax);b2.WheelJoint.prototype.m_ay=null;goog.exportProperty(b2.WheelJoint.prototype,"m_ay",b2.WheelJoint.prototype.m_ay);b2.WheelJoint.prototype.m_sAx=0;goog.exportProperty(b2.WheelJoint.prototype,"m_sAx",b2.WheelJoint.prototype.m_sAx);b2.WheelJoint.prototype.m_sBx=0;goog.exportProperty(b2.WheelJoint.prototype,"m_sBx",b2.WheelJoint.prototype.m_sBx);
b2.WheelJoint.prototype.m_sAy=0;goog.exportProperty(b2.WheelJoint.prototype,"m_sAy",b2.WheelJoint.prototype.m_sAy);b2.WheelJoint.prototype.m_sBy=0;goog.exportProperty(b2.WheelJoint.prototype,"m_sBy",b2.WheelJoint.prototype.m_sBy);b2.WheelJoint.prototype.m_mass=0;goog.exportProperty(b2.WheelJoint.prototype,"m_mass",b2.WheelJoint.prototype.m_mass);b2.WheelJoint.prototype.m_motorMass=0;goog.exportProperty(b2.WheelJoint.prototype,"m_motorMass",b2.WheelJoint.prototype.m_motorMass);
b2.WheelJoint.prototype.m_springMass=0;goog.exportProperty(b2.WheelJoint.prototype,"m_springMass",b2.WheelJoint.prototype.m_springMass);b2.WheelJoint.prototype.m_bias=0;goog.exportProperty(b2.WheelJoint.prototype,"m_bias",b2.WheelJoint.prototype.m_bias);b2.WheelJoint.prototype.m_gamma=0;goog.exportProperty(b2.WheelJoint.prototype,"m_gamma",b2.WheelJoint.prototype.m_gamma);b2.WheelJoint.prototype.m_qA=null;
goog.exportProperty(b2.WheelJoint.prototype,"m_qA",b2.WheelJoint.prototype.m_qA);b2.WheelJoint.prototype.m_qB=null;goog.exportProperty(b2.WheelJoint.prototype,"m_qB",b2.WheelJoint.prototype.m_qB);b2.WheelJoint.prototype.m_lalcA=null;goog.exportProperty(b2.WheelJoint.prototype,"m_lalcA",b2.WheelJoint.prototype.m_lalcA);b2.WheelJoint.prototype.m_lalcB=null;goog.exportProperty(b2.WheelJoint.prototype,"m_lalcB",b2.WheelJoint.prototype.m_lalcB);
b2.WheelJoint.prototype.m_rA=null;goog.exportProperty(b2.WheelJoint.prototype,"m_rA",b2.WheelJoint.prototype.m_rA);b2.WheelJoint.prototype.m_rB=null;goog.exportProperty(b2.WheelJoint.prototype,"m_rB",b2.WheelJoint.prototype.m_rB);b2.WheelJoint.prototype.GetMotorSpeed=function(){return this.m_motorSpeed};goog.exportProperty(b2.WheelJoint.prototype,"GetMotorSpeed",b2.WheelJoint.prototype.GetMotorSpeed);b2.WheelJoint.prototype.GetMaxMotorTorque=function(){return this.m_maxMotorTorque};
goog.exportProperty(b2.WheelJoint.prototype,"GetMaxMotorTorque",b2.WheelJoint.prototype.GetMaxMotorTorque);b2.WheelJoint.prototype.SetSpringFrequencyHz=function(a){this.m_frequencyHz=a};goog.exportProperty(b2.WheelJoint.prototype,"SetSpringFrequencyHz",b2.WheelJoint.prototype.SetSpringFrequencyHz);b2.WheelJoint.prototype.GetSpringFrequencyHz=function(){return this.m_frequencyHz};goog.exportProperty(b2.WheelJoint.prototype,"GetSpringFrequencyHz",b2.WheelJoint.prototype.GetSpringFrequencyHz);
b2.WheelJoint.prototype.SetSpringDampingRatio=function(a){this.m_dampingRatio=a};goog.exportProperty(b2.WheelJoint.prototype,"SetSpringDampingRatio",b2.WheelJoint.prototype.SetSpringDampingRatio);b2.WheelJoint.prototype.GetSpringDampingRatio=function(){return this.m_dampingRatio};goog.exportProperty(b2.WheelJoint.prototype,"GetSpringDampingRatio",b2.WheelJoint.prototype.GetSpringDampingRatio);
b2.WheelJoint.prototype.InitVelocityConstraints=function(a){this.m_indexA=this.m_bodyA.m_islandIndex;this.m_indexB=this.m_bodyB.m_islandIndex;this.m_localCenterA.Copy(this.m_bodyA.m_sweep.localCenter);this.m_localCenterB.Copy(this.m_bodyB.m_sweep.localCenter);this.m_invMassA=this.m_bodyA.m_invMass;this.m_invMassB=this.m_bodyB.m_invMass;this.m_invIA=this.m_bodyA.m_invI;this.m_invIB=this.m_bodyB.m_invI;var b=this.m_invMassA,c=this.m_invMassB,d=this.m_invIA,e=this.m_invIB,f=a.positions[this.m_indexA].c,
g=a.velocities[this.m_indexA].v,h=a.velocities[this.m_indexA].w,k=a.positions[this.m_indexB].c,l=a.positions[this.m_indexB].a,m=a.velocities[this.m_indexB].v,n=a.velocities[this.m_indexB].w,p=this.m_qA.SetAngle(a.positions[this.m_indexA].a),q=this.m_qB.SetAngle(l);b2.Sub_V2_V2(this.m_localAnchorA,this.m_localCenterA,this.m_lalcA);l=b2.Mul_R_V2(p,this.m_lalcA,this.m_rA);b2.Sub_V2_V2(this.m_localAnchorB,this.m_localCenterB,this.m_lalcB);q=b2.Mul_R_V2(q,this.m_lalcB,this.m_rB);f=
b2.Sub_V2_V2(b2.Add_V2_V2(k,q,b2.Vec2.s_t0),b2.Add_V2_V2(f,l,b2.Vec2.s_t1),b2.WheelJoint.prototype.InitVelocityConstraints.s_d);b2.Mul_R_V2(p,this.m_localYAxisA,this.m_ay);this.m_sAy=b2.Cross_V2_V2(b2.Add_V2_V2(f,l,b2.Vec2.s_t0),this.m_ay);this.m_sBy=b2.Cross_V2_V2(q,this.m_ay);this.m_mass=b+c+d*this.m_sAy*this.m_sAy+e*this.m_sBy*this.m_sBy;0<this.m_mass&&(this.m_mass=1/this.m_mass);this.m_gamma=this.m_bias=this.m_springMass=0;0<this.m_frequencyHz?
(b2.Mul_R_V2(p,this.m_localXAxisA,this.m_ax),this.m_sAx=b2.Cross_V2_V2(b2.Add_V2_V2(f,l,b2.Vec2.s_t0),this.m_ax),this.m_sBx=b2.Cross_V2_V2(q,this.m_ax),b=b+c+d*this.m_sAx*this.m_sAx+e*this.m_sBx*this.m_sBx,0<b&&(this.m_springMass=1/b,c=b2.Dot_V2_V2(f,this.m_ax),p=2*b2._pi*this.m_frequencyHz,f=this.m_springMass*p*p,k=a.step.dt,this.m_gamma=k*(2*this.m_springMass*this.m_dampingRatio*p+k*f),0<this.m_gamma&&(this.m_gamma=1/this.m_gamma),this.m_bias=c*k*f*this.m_gamma,
this.m_springMass=b+this.m_gamma,0<this.m_springMass&&(this.m_springMass=1/this.m_springMass))):this.m_springImpulse=0;this.m_enableMotor?(this.m_motorMass=d+e,0<this.m_motorMass&&(this.m_motorMass=1/this.m_motorMass)):this.m_motorImpulse=this.m_motorMass=0;a.step.warmStarting?(this.m_impulse*=a.step.dtRatio,this.m_springImpulse*=a.step.dtRatio,this.m_motorImpulse*=a.step.dtRatio,d=b2.Add_V2_V2(b2.Mul_S_V2(this.m_impulse,this.m_ay,b2.Vec2.s_t0),b2.Mul_S_V2(this.m_springImpulse,
this.m_ax,b2.Vec2.s_t1),b2.WheelJoint.prototype.InitVelocityConstraints.s_P),e=this.m_impulse*this.m_sAy+this.m_springImpulse*this.m_sAx+this.m_motorImpulse,b=this.m_impulse*this.m_sBy+this.m_springImpulse*this.m_sBx+this.m_motorImpulse,g.SelfMulSub(this.m_invMassA,d),h-=this.m_invIA*e,m.SelfMulAdd(this.m_invMassB,d),n+=this.m_invIB*b):this.m_motorImpulse=this.m_springImpulse=this.m_impulse=0;a.velocities[this.m_indexA].w=h;a.velocities[this.m_indexB].w=n};
goog.exportProperty(b2.WheelJoint.prototype,"InitVelocityConstraints",b2.WheelJoint.prototype.InitVelocityConstraints);b2.WheelJoint.prototype.InitVelocityConstraints.s_d=new b2.Vec2;b2.WheelJoint.prototype.InitVelocityConstraints.s_P=new b2.Vec2;
b2.WheelJoint.prototype.SolveVelocityConstraints=function(a){var b=this.m_invMassA,c=this.m_invMassB,d=this.m_invIA,e=this.m_invIB,f=a.velocities[this.m_indexA].v,g=a.velocities[this.m_indexA].w,h=a.velocities[this.m_indexB].v,k=a.velocities[this.m_indexB].w,l=b2.Dot_V2_V2(this.m_ax,b2.Sub_V2_V2(h,f,b2.Vec2.s_t0))+this.m_sBx*k-this.m_sAx*g,l=-this.m_springMass*(l+this.m_bias+this.m_gamma*this.m_springImpulse);this.m_springImpulse+=l;var m=b2.Mul_S_V2(l,this.m_ax,b2.WheelJoint.prototype.SolveVelocityConstraints.s_P),
n=l*this.m_sAx,l=l*this.m_sBx;f.SelfMulSub(b,m);g-=d*n;h.SelfMulAdd(c,m);k+=e*l;l=k-g-this.m_motorSpeed;l*=-this.m_motorMass;m=this.m_motorImpulse;n=a.step.dt*this.m_maxMotorTorque;this.m_motorImpulse=b2.Clamp(this.m_motorImpulse+l,-n,n);l=this.m_motorImpulse-m;g-=d*l;k+=e*l;l=b2.Dot_V2_V2(this.m_ay,b2.Sub_V2_V2(h,f,b2.Vec2.s_t0))+this.m_sBy*k-this.m_sAy*g;l*=-this.m_mass;this.m_impulse+=l;m=b2.Mul_S_V2(l,this.m_ay,b2.WheelJoint.prototype.SolveVelocityConstraints.s_P);
n=l*this.m_sAy;l*=this.m_sBy;f.SelfMulSub(b,m);g-=d*n;h.SelfMulAdd(c,m);a.velocities[this.m_indexA].w=g;a.velocities[this.m_indexB].w=k+e*l};goog.exportProperty(b2.WheelJoint.prototype,"SolveVelocityConstraints",b2.WheelJoint.prototype.SolveVelocityConstraints);b2.WheelJoint.prototype.SolveVelocityConstraints.s_P=new b2.Vec2;
b2.WheelJoint.prototype.SolvePositionConstraints=function(a){var b=a.positions[this.m_indexA].c,c=a.positions[this.m_indexA].a,d=a.positions[this.m_indexB].c,e=a.positions[this.m_indexB].a,f=this.m_qA.SetAngle(c),g=this.m_qB.SetAngle(e);b2.Sub_V2_V2(this.m_localAnchorA,this.m_localCenterA,this.m_lalcA);var h=b2.Mul_R_V2(f,this.m_lalcA,this.m_rA);b2.Sub_V2_V2(this.m_localAnchorB,this.m_localCenterB,this.m_lalcB);var g=b2.Mul_R_V2(g,this.m_lalcB,this.m_rB),k=b2.Add_V2_V2(b2.Sub_V2_V2(d,
b,b2.Vec2.s_t0),b2.Sub_V2_V2(g,h,b2.Vec2.s_t1),b2.WheelJoint.prototype.SolvePositionConstraints.s_d),f=b2.Mul_R_V2(f,this.m_localYAxisA,this.m_ay),h=b2.Cross_V2_V2(b2.Add_V2_V2(k,h,b2.Vec2.s_t0),f),g=b2.Cross_V2_V2(g,f),k=b2.Dot_V2_V2(k,this.m_ay),l=this.m_invMassA+this.m_invMassB+this.m_invIA*this.m_sAy*this.m_sAy+this.m_invIB*this.m_sBy*this.m_sBy,l=0!==l?-k/l:0,f=b2.Mul_S_V2(l,f,b2.WheelJoint.prototype.SolvePositionConstraints.s_P),h=
l*h,g=l*g;b.SelfMulSub(this.m_invMassA,f);c-=this.m_invIA*h;d.SelfMulAdd(this.m_invMassB,f);e+=this.m_invIB*g;a.positions[this.m_indexA].a=c;a.positions[this.m_indexB].a=e;return b2.Abs(k)<=b2._linearSlop};goog.exportProperty(b2.WheelJoint.prototype,"SolvePositionConstraints",b2.WheelJoint.prototype.SolvePositionConstraints);b2.WheelJoint.prototype.SolvePositionConstraints.s_d=new b2.Vec2;b2.WheelJoint.prototype.SolvePositionConstraints.s_P=new b2.Vec2;
b2.WheelJoint.prototype.GetDefinition=function(a){b2.ENABLE_ASSERTS&&b2.Assert(!1);return a};goog.exportProperty(b2.WheelJoint.prototype,"GetDefinition",b2.WheelJoint.prototype.GetDefinition);b2.WheelJoint.prototype.GetAnchorA=function(a){return this.m_bodyA.GetWorldPoint(this.m_localAnchorA,a)};goog.exportProperty(b2.WheelJoint.prototype,"GetAnchorA",b2.WheelJoint.prototype.GetAnchorA);
b2.WheelJoint.prototype.GetAnchorB=function(a){return this.m_bodyB.GetWorldPoint(this.m_localAnchorB,a)};goog.exportProperty(b2.WheelJoint.prototype,"GetAnchorB",b2.WheelJoint.prototype.GetAnchorB);b2.WheelJoint.prototype.GetReactionForce=function(a,b){b.x=a*(this.m_impulse*this.m_ay.x+this.m_springImpulse*this.m_ax.x);b.y=a*(this.m_impulse*this.m_ay.y+this.m_springImpulse*this.m_ax.y);return b};goog.exportProperty(b2.WheelJoint.prototype,"GetReactionForce",b2.WheelJoint.prototype.GetReactionForce);
b2.WheelJoint.prototype.GetReactionTorque=function(a){return a*this.m_motorImpulse};goog.exportProperty(b2.WheelJoint.prototype,"GetReactionTorque",b2.WheelJoint.prototype.GetReactionTorque);b2.WheelJoint.prototype.GetLocalAnchorA=function(a){return a.Copy(this.m_localAnchorA)};goog.exportProperty(b2.WheelJoint.prototype,"GetLocalAnchorA",b2.WheelJoint.prototype.GetLocalAnchorA);b2.WheelJoint.prototype.GetLocalAnchorB=function(a){return a.Copy(this.m_localAnchorB)};
goog.exportProperty(b2.WheelJoint.prototype,"GetLocalAnchorB",b2.WheelJoint.prototype.GetLocalAnchorB);b2.WheelJoint.prototype.GetLocalAxisA=function(a){return a.Copy(this.m_localXAxisA)};goog.exportProperty(b2.WheelJoint.prototype,"GetLocalAxisA",b2.WheelJoint.prototype.GetLocalAxisA);b2.WheelJoint.prototype.GetJointTranslation=function(){return this.GetPrismaticJointTranslation()};goog.exportProperty(b2.WheelJoint.prototype,"GetJointTranslation",b2.WheelJoint.prototype.GetJointTranslation);
b2.WheelJoint.prototype.GetJointSpeed=function(){return this.GetRevoluteJointSpeed()};goog.exportProperty(b2.WheelJoint.prototype,"GetJointSpeed",b2.WheelJoint.prototype.GetJointSpeed);
b2.WheelJoint.prototype.GetPrismaticJointTranslation=function(){var a=this.m_bodyA,b=this.m_bodyB,c=a.GetWorldPoint(this.m_localAnchorA,new b2.Vec2),b=b.GetWorldPoint(this.m_localAnchorB,new b2.Vec2),c=b2.Sub_V2_V2(b,c,new b2.Vec2),a=a.GetWorldVector(this.m_localXAxisA,new b2.Vec2);return b2.Dot_V2_V2(c,a)};goog.exportProperty(b2.WheelJoint.prototype,"GetPrismaticJointTranslation",b2.WheelJoint.prototype.GetPrismaticJointTranslation);
b2.WheelJoint.prototype.GetPrismaticJointSpeed=function(){var a=this.m_bodyA,b=this.m_bodyB;b2.Sub_V2_V2(this.m_localAnchorA,a.m_sweep.localCenter,this.m_lalcA);var c=b2.Mul_R_V2(a.m_xf.q,this.m_lalcA,this.m_rA);b2.Sub_V2_V2(this.m_localAnchorB,b.m_sweep.localCenter,this.m_lalcB);var d=b2.Mul_R_V2(b.m_xf.q,this.m_lalcB,this.m_rB),e=b2.Add_V2_V2(a.m_sweep.c,c,b2.Vec2.s_t0),f=b2.Add_V2_V2(b.m_sweep.c,d,b2.Vec2.s_t1),e=b2.Sub_V2_V2(f,e,b2.Vec2.s_t2),
f=a.GetWorldVector(this.m_localXAxisA,new b2.Vec2),g=a.m_linearVelocity,h=b.m_linearVelocity,a=a.m_angularVelocity,b=b.m_angularVelocity;return b2.Dot_V2_V2(e,b2.Cross_S_V2(a,f,b2.Vec2.s_t0))+b2.Dot_V2_V2(f,b2.Sub_V2_V2(b2.AddCross_V2_S_V2(h,b,d,b2.Vec2.s_t0),b2.AddCross_V2_S_V2(g,a,c,b2.Vec2.s_t1),b2.Vec2.s_t0))};goog.exportProperty(b2.WheelJoint.prototype,"GetPrismaticJointSpeed",b2.WheelJoint.prototype.GetPrismaticJointSpeed);
b2.WheelJoint.prototype.GetRevoluteJointAngle=function(){return this.m_bodyB.m_sweep.a-this.m_bodyA.m_sweep.a};goog.exportProperty(b2.WheelJoint.prototype,"GetRevoluteJointAngle",b2.WheelJoint.prototype.GetRevoluteJointAngle);b2.WheelJoint.prototype.GetRevoluteJointSpeed=function(){return this.m_bodyB.m_angularVelocity-this.m_bodyA.m_angularVelocity};goog.exportProperty(b2.WheelJoint.prototype,"GetRevoluteJointSpeed",b2.WheelJoint.prototype.GetRevoluteJointSpeed);
b2.WheelJoint.prototype.IsMotorEnabled=function(){return this.m_enableMotor};goog.exportProperty(b2.WheelJoint.prototype,"IsMotorEnabled",b2.WheelJoint.prototype.IsMotorEnabled);b2.WheelJoint.prototype.EnableMotor=function(a){this.m_bodyA.SetAwake(!0);this.m_bodyB.SetAwake(!0);this.m_enableMotor=a};goog.exportProperty(b2.WheelJoint.prototype,"EnableMotor",b2.WheelJoint.prototype.EnableMotor);
b2.WheelJoint.prototype.SetMotorSpeed=function(a){this.m_bodyA.SetAwake(!0);this.m_bodyB.SetAwake(!0);this.m_motorSpeed=a};goog.exportProperty(b2.WheelJoint.prototype,"SetMotorSpeed",b2.WheelJoint.prototype.SetMotorSpeed);b2.WheelJoint.prototype.SetMaxMotorTorque=function(a){this.m_bodyA.SetAwake(!0);this.m_bodyB.SetAwake(!0);this.m_maxMotorTorque=a};goog.exportProperty(b2.WheelJoint.prototype,"SetMaxMotorTorque",b2.WheelJoint.prototype.SetMaxMotorTorque);
b2.WheelJoint.prototype.GetMotorTorque=function(a){return a*this.m_motorImpulse};goog.exportProperty(b2.WheelJoint.prototype,"GetMotorTorque",b2.WheelJoint.prototype.GetMotorTorque);
b2.WheelJoint.prototype.Dump=function(){if(b2.DEBUG){var a=this.m_bodyA.m_islandIndex,b=this.m_bodyB.m_islandIndex;b2.Log("  /*b2.WheelJointDef*/ var jd = new b2.WheelJointDef();\n");b2.Log("  jd.bodyA = bodies[%d];\n",a);b2.Log("  jd.bodyB = bodies[%d];\n",b);b2.Log("  jd.collideConnected = %s;\n",this.m_collideConnected?"true":"false");b2.Log("  jd.localAnchorA.Set(%.15f, %.15f);\n",this.m_localAnchorA.x,this.m_localAnchorA.y);b2.Log("  jd.localAnchorB.Set(%.15f, %.15f);\n",
this.m_localAnchorB.x,this.m_localAnchorB.y);b2.Log("  jd.localAxisA.Set(%.15f, %.15f);\n",this.m_localXAxisA.x,this.m_localXAxisA.y);b2.Log("  jd.enableMotor = %s;\n",this.m_enableMotor?"true":"false");b2.Log("  jd.motorSpeed = %.15f;\n",this.m_motorSpeed);b2.Log("  jd.maxMotorTorque = %.15f;\n",this.m_maxMotorTorque);b2.Log("  jd.frequencyHz = %.15f;\n",this.m_frequencyHz);b2.Log("  jd.dampingRatio = %.15f;\n",this.m_dampingRatio);b2.Log("  joints[%d] = this.m_world.CreateJoint(jd);\n",
this.m_index)}};goog.exportProperty(b2.WheelJoint.prototype,"Dump",b2.WheelJoint.prototype.Dump);b2.Particle={};b2.ParticleFlag={waterParticle:0,zombieParticle:2,wallParticle:4,springParticle:8,elasticParticle:16,viscousParticle:32,powderParticle:64,tensileParticle:128,colorMixingParticle:256,destructionListenerParticle:512,barrierParticle:1024,staticPressureParticle:2048,reactiveParticle:4096,repulsiveParticle:8192,fixtureContactListenerParticle:16384,particleContactListenerParticle:32768,fixtureContactFilterParticle:65536,particleContactFilterParticle:131072};
goog.exportSymbol("b2.ParticleFlag",b2.ParticleFlag);goog.exportProperty(b2.ParticleFlag,"waterParticle",b2.ParticleFlag.waterParticle);goog.exportProperty(b2.ParticleFlag,"zombieParticle",b2.ParticleFlag.zombieParticle);goog.exportProperty(b2.ParticleFlag,"wallParticle",b2.ParticleFlag.wallParticle);goog.exportProperty(b2.ParticleFlag,"springParticle",b2.ParticleFlag.springParticle);
goog.exportProperty(b2.ParticleFlag,"elasticParticle",b2.ParticleFlag.elasticParticle);goog.exportProperty(b2.ParticleFlag,"viscousParticle",b2.ParticleFlag.viscousParticle);goog.exportProperty(b2.ParticleFlag,"powderParticle",b2.ParticleFlag.powderParticle);goog.exportProperty(b2.ParticleFlag,"tensileParticle",b2.ParticleFlag.tensileParticle);goog.exportProperty(b2.ParticleFlag,"colorMixingParticle",b2.ParticleFlag.colorMixingParticle);
goog.exportProperty(b2.ParticleFlag,"destructionListenerParticle",b2.ParticleFlag.destructionListenerParticle);goog.exportProperty(b2.ParticleFlag,"barrierParticle",b2.ParticleFlag.barrierParticle);goog.exportProperty(b2.ParticleFlag,"staticPressureParticle",b2.ParticleFlag.staticPressureParticle);goog.exportProperty(b2.ParticleFlag,"reactiveParticle",b2.ParticleFlag.reactiveParticle);
goog.exportProperty(b2.ParticleFlag,"repulsiveParticle",b2.ParticleFlag.repulsiveParticle);goog.exportProperty(b2.ParticleFlag,"fixtureContactListenerParticle",b2.ParticleFlag.fixtureContactListenerParticle);goog.exportProperty(b2.ParticleFlag,"particleContactListenerParticle",b2.ParticleFlag.particleContactListenerParticle);goog.exportProperty(b2.ParticleFlag,"fixtureContactFilterParticle",b2.ParticleFlag.fixtureContactFilterParticle);
goog.exportProperty(b2.ParticleFlag,"particleContactFilterParticle",b2.ParticleFlag.particleContactFilterParticle);b2.ParticleColor=function(a,b,c,d){if(0!==arguments.length)if(a instanceof b2.Color)this.r=0|255*a.r,this.g=0|255*a.g,this.b=0|255*a.b,this.a=0|255*a.a;else if(3<=arguments.length)this.r=0|a||0,this.g=0|b||0,this.b=0|c||0,this.a=0|d||0;else throw Error();};goog.exportSymbol("b2.ParticleColor",b2.ParticleColor);b2.ParticleColor.prototype.r=0;
goog.exportProperty(b2.ParticleColor.prototype,"r",b2.ParticleColor.prototype.r);b2.ParticleColor.prototype.g=0;goog.exportProperty(b2.ParticleColor.prototype,"g",b2.ParticleColor.prototype.g);b2.ParticleColor.prototype.b=0;goog.exportProperty(b2.ParticleColor.prototype,"b",b2.ParticleColor.prototype.b);b2.ParticleColor.prototype.a=0;goog.exportProperty(b2.ParticleColor.prototype,"a",b2.ParticleColor.prototype.a);
b2.ParticleColor.prototype.IsZero=function(){return 0===this.r&&0===this.g&&0===this.b&&0===this.a};goog.exportProperty(b2.ParticleColor.prototype,"IsZero",b2.ParticleColor.prototype.IsZero);b2.ParticleColor.prototype.GetColor=function(a){a.r=this.r/255;a.g=this.g/255;a.b=this.b/255;a.a=this.a/255;return a};goog.exportProperty(b2.ParticleColor.prototype,"GetColor",b2.ParticleColor.prototype.GetColor);
b2.ParticleColor.prototype.Set=function(a,b,c,d){if(a instanceof b2.Color)this.SetColor(a);else if(3<=arguments.length)this.SetRGBA(a||0,b||0,c||0,d);else throw Error();};goog.exportProperty(b2.ParticleColor.prototype,"Set",b2.ParticleColor.prototype.Set);b2.ParticleColor.prototype.SetRGBA=function(a,b,c,d){this.r=a;this.g=b;this.b=c;this.a="number"===typeof d?d:255};goog.exportProperty(b2.ParticleColor.prototype,"SetRGBA",b2.ParticleColor.prototype.SetRGBA);
b2.ParticleColor.prototype.SetColor=function(a){this.r=255*a.r;this.g=255*a.g;this.b=255*a.b;this.a=255*a.a};goog.exportProperty(b2.ParticleColor.prototype,"SetColor",b2.ParticleColor.prototype.SetColor);b2.ParticleColor.prototype.Copy=function(a){this.r=a.r;this.g=a.g;this.b=a.b;this.a=a.a;return this};goog.exportProperty(b2.ParticleColor.prototype,"Copy",b2.ParticleColor.prototype.Copy);
b2.ParticleColor.prototype.Clone=function(){return new b2.ParticleColor(this.r,this.g,this.b,this.a)};b2.ParticleColor.prototype.SelfMul_0_1=function(a){this.r*=a;this.g*=a;this.b*=a;this.a*=a;return this};goog.exportProperty(b2.ParticleColor.prototype,"SelfMul_0_1",b2.ParticleColor.prototype.SelfMul_0_1);
b2.ParticleColor.prototype.SelfMul_0_255=function(a){a+=1;this.r=this.r*a>>b2.ParticleColor.k_bitsPerComponent;this.g=this.g*a>>b2.ParticleColor.k_bitsPerComponent;this.b=this.b*a>>b2.ParticleColor.k_bitsPerComponent;this.a=this.a*a>>b2.ParticleColor.k_bitsPerComponent;return this};goog.exportProperty(b2.ParticleColor.prototype,"SelfMul_0_255",b2.ParticleColor.prototype.SelfMul_0_255);b2.ParticleColor.prototype.Mul_0_1=function(a,b){return b.Copy(this).SelfMul_0_1(a)};
goog.exportProperty(b2.ParticleColor.prototype,"Mul_0_1",b2.ParticleColor.prototype.Mul_0_1);b2.ParticleColor.prototype.Mul_0_255=function(a,b){return b.Copy(this).SelfMul_0_255(a)};goog.exportProperty(b2.ParticleColor.prototype,"Mul_0_255",b2.ParticleColor.prototype.Mul_0_255);b2.ParticleColor.prototype.SelfAdd=function(a){this.r+=a.r;this.g+=a.g;this.b+=a.b;this.a+=a.a;return this};goog.exportProperty(b2.ParticleColor.prototype,"SelfAdd",b2.ParticleColor.prototype.SelfAdd);
b2.ParticleColor.prototype.Add=function(a,b){b.r=this.r+a.r;b.g=this.g+a.g;b.b=this.b+a.b;b.a=this.a+a.a;return b};goog.exportProperty(b2.ParticleColor.prototype,"Add",b2.ParticleColor.prototype.Add);b2.ParticleColor.prototype.SelfSub=function(a){this.r-=a.r;this.g-=a.g;this.b-=a.b;this.a-=a.a;return this};goog.exportProperty(b2.ParticleColor.prototype,"SelfSub",b2.ParticleColor.prototype.SelfSub);
b2.ParticleColor.prototype.Sub=function(a,b){b.r=this.r-a.r;b.g=this.g-a.g;b.b=this.b-a.b;b.a=this.a-a.a;return b};goog.exportProperty(b2.ParticleColor.prototype,"Sub",b2.ParticleColor.prototype.Sub);b2.ParticleColor.prototype.IsEqual=function(a){return this.r===a.r&&this.g===a.g&&this.b===a.b&&this.a===a.a};goog.exportProperty(b2.ParticleColor.prototype,"IsEqual",b2.ParticleColor.prototype.IsEqual);
b2.ParticleColor.prototype.Mix=function(a,b){b2.ParticleColor.MixColors(this,a,b)};goog.exportProperty(b2.ParticleColor.prototype,"Mix",b2.ParticleColor.prototype.Mix);
b2.ParticleColor.MixColors=function(a,b,c){var d=c*(b.r-a.r)>>b2.ParticleColor.k_bitsPerComponent,e=c*(b.g-a.g)>>b2.ParticleColor.k_bitsPerComponent,f=c*(b.b-a.b)>>b2.ParticleColor.k_bitsPerComponent;c=c*(b.a-a.a)>>b2.ParticleColor.k_bitsPerComponent;a.r+=d;a.g+=e;a.b+=f;a.a+=c;b.r-=d;b.g-=e;b.b-=f;b.a-=c};goog.exportProperty(b2.ParticleColor,"MixColors",b2.ParticleColor.MixColors);b2.B2PARTICLECOLOR_BITS_PER_COMPONENT=8;
b2.B2PARTICLECOLOR_MAX_VALUE=(1<<b2.B2PARTICLECOLOR_BITS_PER_COMPONENT)-1;b2.ParticleColor.k_maxValue=+b2.B2PARTICLECOLOR_MAX_VALUE;goog.exportProperty(b2.ParticleColor,"k_maxValue",b2.ParticleColor.k_maxValue);b2.ParticleColor.k_inverseMaxValue=1/+b2.B2PARTICLECOLOR_MAX_VALUE;goog.exportProperty(b2.ParticleColor,"k_inverseMaxValue",b2.ParticleColor.k_inverseMaxValue);b2.ParticleColor.k_bitsPerComponent=b2.B2PARTICLECOLOR_BITS_PER_COMPONENT;
goog.exportProperty(b2.ParticleColor,"k_bitsPerComponent",b2.ParticleColor.k_bitsPerComponent);b2.ParticleColor_zero=new b2.ParticleColor;b2.ParticleDef=function(){this.position=b2.Vec2_zero.Clone();this.velocity=b2.Vec2_zero.Clone();this.color=b2.ParticleColor_zero.Clone()};goog.exportSymbol("b2.ParticleDef",b2.ParticleDef);b2.ParticleDef.prototype.flags=0;goog.exportProperty(b2.ParticleDef.prototype,"flags",b2.ParticleDef.prototype.flags);
b2.ParticleDef.prototype.position=null;goog.exportProperty(b2.ParticleDef.prototype,"position",b2.ParticleDef.prototype.position);b2.ParticleDef.prototype.velocity=null;goog.exportProperty(b2.ParticleDef.prototype,"velocity",b2.ParticleDef.prototype.velocity);b2.ParticleDef.prototype.color=null;goog.exportProperty(b2.ParticleDef.prototype,"color",b2.ParticleDef.prototype.color);b2.ParticleDef.prototype.lifetime=0;
goog.exportProperty(b2.ParticleDef.prototype,"lifetime",b2.ParticleDef.prototype.lifetime);b2.ParticleDef.prototype.userData=null;goog.exportProperty(b2.ParticleDef.prototype,"userData",b2.ParticleDef.prototype.userData);b2.ParticleDef.prototype.group=null;goog.exportProperty(b2.ParticleDef.prototype,"group",b2.ParticleDef.prototype.group);b2.CalculateParticleIterations=function(a,b,c){a=Math.ceil(Math.sqrt(a/(.01*b))*c);return b2.Clamp(a,1,8)};
goog.exportSymbol("b2.CalculateParticleIterations",b2.CalculateParticleIterations);b2.ParticleHandle=function(){};goog.exportSymbol("b2.ParticleHandle",b2.ParticleHandle);b2.ParticleHandle.prototype.m_index=b2._invalidParticleIndex;b2.ParticleHandle.prototype.GetIndex=function(){return this.m_index};goog.exportProperty(b2.ParticleHandle.prototype,"GetIndex",b2.ParticleHandle.prototype.GetIndex);
b2.ParticleHandle.prototype.SetIndex=function(a){this.m_index=a};b2.ParticleGroupFlag={solidParticleGroup:1,rigidParticleGroup:2,particleGroupCanBeEmpty:4,particleGroupWillBeDestroyed:8,particleGroupNeedsUpdateDepth:16};goog.exportSymbol("b2.ParticleGroupFlag",b2.ParticleGroupFlag);goog.exportProperty(b2.ParticleGroupFlag,"solidParticleGroup",b2.ParticleGroupFlag.solidParticleGroup);goog.exportProperty(b2.ParticleGroupFlag,"rigidParticleGroup",b2.ParticleGroupFlag.rigidParticleGroup);
goog.exportProperty(b2.ParticleGroupFlag,"particleGroupCanBeEmpty",b2.ParticleGroupFlag.particleGroupCanBeEmpty);goog.exportProperty(b2.ParticleGroupFlag,"particleGroupWillBeDestroyed",b2.ParticleGroupFlag.particleGroupWillBeDestroyed);goog.exportProperty(b2.ParticleGroupFlag,"particleGroupNeedsUpdateDepth",b2.ParticleGroupFlag.particleGroupNeedsUpdateDepth);
b2.ParticleGroupFlag.particleGroupInternalMask=b2.ParticleGroupFlag.particleGroupWillBeDestroyed|b2.ParticleGroupFlag.particleGroupNeedsUpdateDepth;b2.ParticleGroupDef=function(){this.position=b2.Vec2_zero.Clone();this.linearVelocity=b2.Vec2_zero.Clone();this.color=b2.ParticleColor_zero.Clone()};goog.exportSymbol("b2.ParticleGroupDef",b2.ParticleGroupDef);b2.ParticleGroupDef.prototype.flags=0;
goog.exportProperty(b2.ParticleGroupDef.prototype,"flags",b2.ParticleGroupDef.prototype.flags);b2.ParticleGroupDef.prototype.groupFlags=0;goog.exportProperty(b2.ParticleGroupDef.prototype,"groupFlags",b2.ParticleGroupDef.prototype.groupFlags);b2.ParticleGroupDef.prototype.position=null;goog.exportProperty(b2.ParticleGroupDef.prototype,"position",b2.ParticleGroupDef.prototype.position);b2.ParticleGroupDef.prototype.angle=0;
goog.exportProperty(b2.ParticleGroupDef.prototype,"angle",b2.ParticleGroupDef.prototype.angle);b2.ParticleGroupDef.prototype.linearVelocity=null;goog.exportProperty(b2.ParticleGroupDef.prototype,"linearVelocity",b2.ParticleGroupDef.prototype.linearVelocity);b2.ParticleGroupDef.prototype.angularVelocity=0;goog.exportProperty(b2.ParticleGroupDef.prototype,"angularVelocity",b2.ParticleGroupDef.prototype.angularVelocity);
b2.ParticleGroupDef.prototype.color=null;goog.exportProperty(b2.ParticleGroupDef.prototype,"color",b2.ParticleGroupDef.prototype.color);b2.ParticleGroupDef.prototype.strength=1;goog.exportProperty(b2.ParticleGroupDef.prototype,"strength",b2.ParticleGroupDef.prototype.strength);b2.ParticleGroupDef.prototype.shape=null;goog.exportProperty(b2.ParticleGroupDef.prototype,"shape",b2.ParticleGroupDef.prototype.shape);
b2.ParticleGroupDef.prototype.shapes=null;goog.exportProperty(b2.ParticleGroupDef.prototype,"shapes",b2.ParticleGroupDef.prototype.shapes);b2.ParticleGroupDef.prototype.shapeCount=0;goog.exportProperty(b2.ParticleGroupDef.prototype,"shapeCount",b2.ParticleGroupDef.prototype.shapeCount);b2.ParticleGroupDef.prototype.stride=0;goog.exportProperty(b2.ParticleGroupDef.prototype,"stride",b2.ParticleGroupDef.prototype.stride);
b2.ParticleGroupDef.prototype.particleCount=0;goog.exportProperty(b2.ParticleGroupDef.prototype,"particleCount",b2.ParticleGroupDef.prototype.particleCount);b2.ParticleGroupDef.prototype.positionData=null;goog.exportProperty(b2.ParticleGroupDef.prototype,"positionData",b2.ParticleGroupDef.prototype.positionData);b2.ParticleGroupDef.prototype.lifetime=0;goog.exportProperty(b2.ParticleGroupDef.prototype,"lifetime",b2.ParticleGroupDef.prototype.lifetime);
b2.ParticleGroupDef.prototype.userData=null;goog.exportProperty(b2.ParticleGroupDef.prototype,"userData",b2.ParticleGroupDef.prototype.userData);b2.ParticleGroupDef.prototype.group=null;goog.exportProperty(b2.ParticleGroupDef.prototype,"group",b2.ParticleGroupDef.prototype.group);b2.ParticleGroup=function(){this.m_center=new b2.Vec2;this.m_linearVelocity=new b2.Vec2;this.m_transform=new b2.Transform;this.m_transform.SetIdentity()};
goog.exportSymbol("b2.ParticleGroup",b2.ParticleGroup);b2.ParticleGroup.prototype.m_system=null;b2.ParticleGroup.prototype.m_firstIndex=0;b2.ParticleGroup.prototype.m_lastIndex=0;b2.ParticleGroup.prototype.m_groupFlags=0;b2.ParticleGroup.prototype.m_strength=1;b2.ParticleGroup.prototype.m_prev=null;b2.ParticleGroup.prototype.m_next=null;b2.ParticleGroup.prototype.m_timestamp=-1;b2.ParticleGroup.prototype.m_mass=0;
b2.ParticleGroup.prototype.m_inertia=0;b2.ParticleGroup.prototype.m_center=null;b2.ParticleGroup.prototype.m_linearVelocity=null;b2.ParticleGroup.prototype.m_angularVelocity=0;b2.ParticleGroup.prototype.m_transform=null;b2.ParticleGroup.prototype.m_userData=null;b2.ParticleGroup.prototype.GetNext=function(){return this.m_next};goog.exportProperty(b2.ParticleGroup.prototype,"GetNext",b2.ParticleGroup.prototype.GetNext);
b2.ParticleGroup.prototype.GetParticleSystem=function(){return this.m_system};goog.exportProperty(b2.ParticleGroup.prototype,"GetParticleSystem",b2.ParticleGroup.prototype.GetParticleSystem);b2.ParticleGroup.prototype.GetParticleCount=function(){return this.m_lastIndex-this.m_firstIndex};goog.exportProperty(b2.ParticleGroup.prototype,"GetParticleCount",b2.ParticleGroup.prototype.GetParticleCount);b2.ParticleGroup.prototype.GetBufferIndex=function(){return this.m_firstIndex};
goog.exportProperty(b2.ParticleGroup.prototype,"GetBufferIndex",b2.ParticleGroup.prototype.GetBufferIndex);b2.ParticleGroup.prototype.ContainsParticle=function(a){return this.m_firstIndex<=a&&a<this.m_lastIndex};b2.ParticleGroup.prototype.GetAllParticleFlags=function(){for(var a=0,b=this.m_firstIndex;b<this.m_lastIndex;b++)a|=this.m_system.m_flagsBuffer.data[b];return a};goog.exportProperty(b2.ParticleGroup.prototype,"GetAllParticleFlags",b2.ParticleGroup.prototype.GetAllParticleFlags);
b2.ParticleGroup.prototype.GetGroupFlags=function(){return this.m_groupFlags};goog.exportProperty(b2.ParticleGroup.prototype,"GetGroupFlags",b2.ParticleGroup.prototype.GetGroupFlags);b2.ParticleGroup.prototype.SetGroupFlags=function(a){b2.Assert(0===(a&b2.ParticleGroupFlag.particleGroupInternalMask));a|=this.m_groupFlags&b2.ParticleGroupFlag.particleGroupInternalMask;this.m_system.SetGroupFlags(this,a)};
goog.exportProperty(b2.ParticleGroup.prototype,"SetGroupFlags",b2.ParticleGroup.prototype.SetGroupFlags);b2.ParticleGroup.prototype.GetMass=function(){this.UpdateStatistics();return this.m_mass};goog.exportProperty(b2.ParticleGroup.prototype,"GetMass",b2.ParticleGroup.prototype.GetMass);b2.ParticleGroup.prototype.GetInertia=function(){this.UpdateStatistics();return this.m_inertia};goog.exportProperty(b2.ParticleGroup.prototype,"GetInertia",b2.ParticleGroup.prototype.GetInertia);
b2.ParticleGroup.prototype.GetCenter=function(){this.UpdateStatistics();return this.m_center};goog.exportProperty(b2.ParticleGroup.prototype,"GetCenter",b2.ParticleGroup.prototype.GetCenter);b2.ParticleGroup.prototype.GetLinearVelocity=function(){this.UpdateStatistics();return this.m_linearVelocity};goog.exportProperty(b2.ParticleGroup.prototype,"GetLinearVelocity",b2.ParticleGroup.prototype.GetLinearVelocity);
b2.ParticleGroup.prototype.GetAngularVelocity=function(){this.UpdateStatistics();return this.m_angularVelocity};goog.exportProperty(b2.ParticleGroup.prototype,"GetAngularVelocity",b2.ParticleGroup.prototype.GetAngularVelocity);b2.ParticleGroup.prototype.GetTransform=function(){return this.m_transform};goog.exportProperty(b2.ParticleGroup.prototype,"GetTransform",b2.ParticleGroup.prototype.GetTransform);b2.ParticleGroup.prototype.GetPosition=function(){return this.m_transform.p};
goog.exportProperty(b2.ParticleGroup.prototype,"GetPosition",b2.ParticleGroup.prototype.GetPosition);b2.ParticleGroup.prototype.GetAngle=function(){return this.m_transform.q.GetAngle()};goog.exportProperty(b2.ParticleGroup.prototype,"GetAngle",b2.ParticleGroup.prototype.GetAngle);
b2.ParticleGroup.prototype.GetLinearVelocityFromWorldPoint=function(a,b){var c=b2.ParticleGroup.prototype.GetLinearVelocityFromWorldPoint.s_t0;this.UpdateStatistics();return b2.AddCross_V2_S_V2(this.m_linearVelocity,this.m_angularVelocity,b2.Sub_V2_V2(a,this.m_center,c),b)};goog.exportProperty(b2.ParticleGroup.prototype,"GetLinearVelocityFromWorldPoint",b2.ParticleGroup.prototype.GetLinearVelocityFromWorldPoint);
b2.ParticleGroup.prototype.GetLinearVelocityFromWorldPoint.s_t0=new b2.Vec2;b2.ParticleGroup.prototype.GetUserData=function(){return this.m_userData};goog.exportProperty(b2.ParticleGroup.prototype,"GetUserData",b2.ParticleGroup.prototype.GetUserData);b2.ParticleGroup.prototype.SetUserData=function(a){this.m_userData=a};goog.exportProperty(b2.ParticleGroup.prototype,"SetUserData",b2.ParticleGroup.prototype.SetUserData);
b2.ParticleGroup.prototype.ApplyForce=function(a){this.m_system.ApplyForce(this.m_firstIndex,this.m_lastIndex,a)};goog.exportProperty(b2.ParticleGroup.prototype,"ApplyForce",b2.ParticleGroup.prototype.ApplyForce);b2.ParticleGroup.prototype.ApplyLinearImpulse=function(a){this.m_system.ApplyLinearImpulse(this.m_firstIndex,this.m_lastIndex,a)};goog.exportProperty(b2.ParticleGroup.prototype,"ApplyLinearImpulse",b2.ParticleGroup.prototype.ApplyLinearImpulse);
b2.ParticleGroup.prototype.DestroyParticles=function(a){b2.Assert(!1===this.m_system.m_world.IsLocked());if(!this.m_system.m_world.IsLocked())for(var b=this.m_firstIndex;b<this.m_lastIndex;b++)this.m_system.DestroyParticle(b,a)};goog.exportProperty(b2.ParticleGroup.prototype,"DestroyParticles",b2.ParticleGroup.prototype.DestroyParticles);
b2.ParticleGroup.prototype.UpdateStatistics=function(){var a=new b2.Vec2,b=new b2.Vec2;if(this.m_timestamp!=this.m_system.m_timestamp){var c=this.m_system.GetParticleMass();this.m_mass=c*(this.m_lastIndex-this.m_firstIndex);this.m_center.SetZero();this.m_linearVelocity.SetZero();for(var d=this.m_firstIndex;d<this.m_lastIndex;d++)this.m_center.SelfMulAdd(c,this.m_system.m_positionBuffer.data[d]),this.m_linearVelocity.SelfMulAdd(c,this.m_system.m_velocityBuffer.data[d]);0<this.m_mass&&
(d=1/this.m_mass,this.m_center.SelfMul(d),this.m_linearVelocity.SelfMul(d));this.m_angularVelocity=this.m_inertia=0;for(d=this.m_firstIndex;d<this.m_lastIndex;d++)b2.Sub_V2_V2(this.m_system.m_positionBuffer.data[d],this.m_center,a),b2.Sub_V2_V2(this.m_system.m_velocityBuffer.data[d],this.m_linearVelocity,b),this.m_inertia+=c*b2.Dot_V2_V2(a,a),this.m_angularVelocity+=c*b2.Cross_V2_V2(a,b);0<this.m_inertia&&(this.m_angularVelocity*=1/this.m_inertia);this.m_timestamp=this.m_system.m_timestamp}};
goog.exportProperty(b2.ParticleGroup.prototype,"UpdateStatistics",b2.ParticleGroup.prototype.UpdateStatistics);b2.std_iter_swap=function(a,b,c){var d=a[b];a[b]=a[c];a[c]=d};b2.std_sort=function(a,b,c,d){"number"!==typeof b&&(b=0);"number"!==typeof c&&(c=a.length-b);"function"!==typeof d&&(d=function(a,b){return a<b});for(var e=[],f=0;;){for(;b+1<c;c++){var g=a[b+Math.floor(Math.random()*(c-b))];e[f++]=c;for(var h=b-1;;){for(;d(a[++h],g););for(;d(g,a[--c]););if(h>=c)break;b2.std_iter_swap(a,h,c)}}if(0===f)break;b=c;c=e[--f]}return a};
b2.std_stable_sort=function(a,b,c,d){return b2.std_sort(a,b,c,d)};b2.std_remove_if=function(a,b,c){"number"!==typeof c&&(c=a.length);for(var d=0,e=0;e<c;++e)b(a[e])||(e===d?++d:b2.std_iter_swap(a,d++,e));return d};b2.std_lower_bound=function(a,b,c,d,e){"function"!==typeof e&&(e=function(a,b){return a<b});for(c-=b;0<c;){var f=Math.floor(c/2),g=b+f;e(a[g],d)?(b=++g,c-=f+1):c=f}return b};
b2.std_upper_bound=function(a,b,c,d,e){"function"!==typeof e&&(e=function(a,b){return a<b});for(c-=b;0<c;){var f=Math.floor(c/2),g=b+f;e(d,a[g])?c=f:(b=++g,c-=f+1)}return b};b2.std_rotate=function(a,b,c,d){for(var e=c;b!==e;)b2.std_iter_swap(a,b++,e++),e===d?e=c:b===c&&(c=e)};b2.std_unique=function(a,b,c,d){if(b===c)return c;for(var e=b;++b!==c;)d(a[e],a[b])||b2.std_iter_swap(a,++e,b);return++e};
b2.GrowableBuffer=function(a){this.data=[];this.capacity=this.count=0;this.allocator=a};b2.GrowableBuffer.prototype.data=null;b2.GrowableBuffer.prototype.count=0;b2.GrowableBuffer.prototype.capacity=0;b2.GrowableBuffer.prototype.allocator=function(){return null};b2.GrowableBuffer.prototype.Append=function(){this.count>=this.capacity&&this.Grow();return this.count++};
b2.GrowableBuffer.prototype.Reserve=function(a){if(!(this.capacity>=a)){b2.Assert(this.capacity===this.data.length);for(var b=this.capacity;b<a;++b)this.data[b]=this.allocator();this.capacity=a}};b2.GrowableBuffer.prototype.Grow=function(){var a=this.capacity?2*this.capacity:b2._minParticleSystemBufferCapacity;b2.Assert(a>this.capacity);this.Reserve(a)};b2.GrowableBuffer.prototype.Free=function(){0!==this.data.length&&(this.data=[],this.count=this.capacity=0)};
b2.GrowableBuffer.prototype.Shorten=function(a){b2.Assert(!1)};b2.GrowableBuffer.prototype.Data=function(){return this.data};b2.GrowableBuffer.prototype.GetCount=function(){return this.count};b2.GrowableBuffer.prototype.SetCount=function(a){b2.Assert(0<=a&&a<=this.capacity);this.count=a};b2.GrowableBuffer.prototype.GetCapacity=function(){return this.capacity};
b2.GrowableBuffer.prototype.RemoveIf=function(a){for(var b=0,c=0;c<this.count;++c)a(this.data[c])||b++;this.count=b2.std_remove_if(this.data,a,this.count);b2.Assert(b===this.count)};b2.GrowableBuffer.prototype.Unique=function(a){this.count=b2.std_unique(this.data,0,this.count,a)};b2.FixtureParticleQueryCallback=function(a){this.m_system=a};goog.inherits(b2.FixtureParticleQueryCallback,b2.QueryCallback);b2.FixtureParticleQueryCallback.prototype.m_system=null;
b2.FixtureParticleQueryCallback.prototype.ShouldQueryParticleSystem=function(a){return!1};b2.FixtureParticleQueryCallback.prototype.ReportFixture=function(a){if(a.IsSensor())return!0;for(var b=a.GetShape().GetChildCount(),c=0;c<b;c++)for(var d=a.GetAABB(c),d=this.m_system.GetInsideBoundsEnumerator(d),e;0<=(e=d.GetNext());)this.ReportFixtureAndParticle(a,c,e);return!0};goog.exportProperty(b2.FixtureParticleQueryCallback.prototype,"ReportFixture",b2.FixtureParticleQueryCallback.prototype.ReportFixture);
b2.FixtureParticleQueryCallback.prototype.ReportParticle=function(a,b){return!1};goog.exportProperty(b2.FixtureParticleQueryCallback.prototype,"ReportParticle",b2.FixtureParticleQueryCallback.prototype.ReportParticle);b2.FixtureParticleQueryCallback.prototype.ReportFixtureAndParticle=function(a,b,c){b2.Assert(!1)};goog.exportProperty(b2.FixtureParticleQueryCallback.prototype,"ReportFixtureAndParticle",b2.FixtureParticleQueryCallback.prototype.ReportFixtureAndParticle);
b2.ParticleContact=function(){this.normal=new b2.Vec2};goog.exportSymbol("b2.ParticleContact",b2.ParticleContact);b2.ParticleContact.prototype.indexA=0;goog.exportProperty(b2.ParticleContact.prototype,"indexA",b2.ParticleContact.prototype.indexA);b2.ParticleContact.prototype.indexB=0;goog.exportProperty(b2.ParticleContact.prototype,"indexB",b2.ParticleContact.prototype.indexB);b2.ParticleContact.prototype.weight=0;
goog.exportProperty(b2.ParticleContact.prototype,"weight",b2.ParticleContact.prototype.weight);b2.ParticleContact.prototype.normal=null;goog.exportProperty(b2.ParticleContact.prototype,"normal",b2.ParticleContact.prototype.normal);b2.ParticleContact.prototype.flags=0;goog.exportProperty(b2.ParticleContact.prototype,"flags",b2.ParticleContact.prototype.flags);
b2.ParticleContact.prototype.SetIndices=function(a,b){b2.Assert(a<=b2._maxParticleIndex&&b<=b2._maxParticleIndex);this.indexA=a;this.indexB=b};goog.exportProperty(b2.ParticleContact.prototype,"SetIndices",b2.ParticleContact.prototype.SetIndices);b2.ParticleContact.prototype.SetWeight=function(a){this.weight=a};goog.exportProperty(b2.ParticleContact.prototype,"SetWeight",b2.ParticleContact.prototype.SetWeight);
b2.ParticleContact.prototype.SetNormal=function(a){this.normal.Copy(a)};goog.exportProperty(b2.ParticleContact.prototype,"SetNormal",b2.ParticleContact.prototype.SetNormal);b2.ParticleContact.prototype.SetFlags=function(a){this.flags=a};goog.exportProperty(b2.ParticleContact.prototype,"SetFlags",b2.ParticleContact.prototype.SetFlags);b2.ParticleContact.prototype.GetIndexA=function(){return this.indexA};
goog.exportProperty(b2.ParticleContact.prototype,"GetIndexA",b2.ParticleContact.prototype.GetIndexA);b2.ParticleContact.prototype.GetIndexB=function(){return this.indexB};goog.exportProperty(b2.ParticleContact.prototype,"GetIndexB",b2.ParticleContact.prototype.GetIndexB);b2.ParticleContact.prototype.GetWeight=function(){return this.weight};goog.exportProperty(b2.ParticleContact.prototype,"GetWeight",b2.ParticleContact.prototype.GetWeight);
b2.ParticleContact.prototype.GetNormal=function(){return this.normal};goog.exportProperty(b2.ParticleContact.prototype,"GetNormal",b2.ParticleContact.prototype.GetNormal);b2.ParticleContact.prototype.GetFlags=function(){return this.flags};goog.exportProperty(b2.ParticleContact.prototype,"GetFlags",b2.ParticleContact.prototype.GetFlags);
b2.ParticleContact.prototype.IsEqual=function(a){return this.indexA===a.indexA&&this.indexB===a.indexB&&this.flags===a.flags&&this.weight===a.weight&&this.normal.x===a.normal.x&&this.normal.y===a.normal.y};goog.exportProperty(b2.ParticleContact.prototype,"IsEqual",b2.ParticleContact.prototype.IsEqual);b2.ParticleContact.prototype.IsNotEqual=function(a){return!this.IsEqual(a)};goog.exportProperty(b2.ParticleContact.prototype,"IsNotEqual",b2.ParticleContact.prototype.IsNotEqual);
b2.ParticleContact.prototype.ApproximatelyEqual=function(a){return this.indexA===a.indexA&&this.indexB===a.indexB&&this.flags===a.flags&&.01>b2.Abs(this.weight-a.weight)&&1E-4>b2.DistanceSquared(this.normal,a.normal)};goog.exportProperty(b2.ParticleContact.prototype,"ApproximatelyEqual",b2.ParticleContact.prototype.ApproximatelyEqual);b2.ParticleBodyContact=function(){this.normal=new b2.Vec2};goog.exportSymbol("b2.ParticleBodyContact",b2.ParticleBodyContact);
b2.ParticleBodyContact.prototype.index=0;goog.exportProperty(b2.ParticleBodyContact.prototype,"index",b2.ParticleBodyContact.prototype.index);b2.ParticleBodyContact.prototype.body=null;goog.exportProperty(b2.ParticleBodyContact.prototype,"body",b2.ParticleBodyContact.prototype.body);b2.ParticleBodyContact.prototype.fixture=null;goog.exportProperty(b2.ParticleBodyContact.prototype,"fixture",b2.ParticleBodyContact.prototype.fixture);
b2.ParticleBodyContact.prototype.weight=0;goog.exportProperty(b2.ParticleBodyContact.prototype,"weight",b2.ParticleBodyContact.prototype.weight);b2.ParticleBodyContact.prototype.normal=null;goog.exportProperty(b2.ParticleBodyContact.prototype,"normal",b2.ParticleBodyContact.prototype.normal);b2.ParticleBodyContact.prototype.mass=0;goog.exportProperty(b2.ParticleBodyContact.prototype,"mass",b2.ParticleBodyContact.prototype.mass);b2.ParticlePair=function(){};
goog.exportSymbol("b2.ParticlePair",b2.ParticlePair);b2.ParticlePair.prototype.indexA=0;goog.exportProperty(b2.ParticlePair.prototype,"indexA",b2.ParticlePair.prototype.indexA);b2.ParticlePair.prototype.indexB=0;goog.exportProperty(b2.ParticlePair.prototype,"indexB",b2.ParticlePair.prototype.indexB);b2.ParticlePair.prototype.flags=0;goog.exportProperty(b2.ParticlePair.prototype,"flags",b2.ParticlePair.prototype.flags);
b2.ParticlePair.prototype.strength=0;goog.exportProperty(b2.ParticlePair.prototype,"strength",b2.ParticlePair.prototype.strength);b2.ParticlePair.prototype.distance=0;goog.exportProperty(b2.ParticlePair.prototype,"distance",b2.ParticlePair.prototype.distance);b2.ParticleTriad=function(){this.pa=new b2.Vec2(0,0);this.pb=new b2.Vec2(0,0);this.pc=new b2.Vec2(0,0)};goog.exportSymbol("b2.ParticleTriad",b2.ParticleTriad);
b2.ParticleTriad.prototype.indexA=0;goog.exportProperty(b2.ParticleTriad.prototype,"indexA",b2.ParticleTriad.prototype.indexA);b2.ParticleTriad.prototype.indexB=0;goog.exportProperty(b2.ParticleTriad.prototype,"indexB",b2.ParticleTriad.prototype.indexB);b2.ParticleTriad.prototype.indexC=0;goog.exportProperty(b2.ParticleTriad.prototype,"indexC",b2.ParticleTriad.prototype.indexC);b2.ParticleTriad.prototype.flags=0;
goog.exportProperty(b2.ParticleTriad.prototype,"flags",b2.ParticleTriad.prototype.flags);b2.ParticleTriad.prototype.strength=0;goog.exportProperty(b2.ParticleTriad.prototype,"strength",b2.ParticleTriad.prototype.strength);b2.ParticleTriad.prototype.pa=null;goog.exportProperty(b2.ParticleTriad.prototype,"pa",b2.ParticleTriad.prototype.pa);b2.ParticleTriad.prototype.pb=null;goog.exportProperty(b2.ParticleTriad.prototype,"pb",b2.ParticleTriad.prototype.pb);
b2.ParticleTriad.prototype.pc=null;goog.exportProperty(b2.ParticleTriad.prototype,"pc",b2.ParticleTriad.prototype.pc);b2.ParticleTriad.prototype.ka=0;goog.exportProperty(b2.ParticleTriad.prototype,"ka",b2.ParticleTriad.prototype.ka);b2.ParticleTriad.prototype.kb=0;goog.exportProperty(b2.ParticleTriad.prototype,"kb",b2.ParticleTriad.prototype.kb);b2.ParticleTriad.prototype.kc=0;goog.exportProperty(b2.ParticleTriad.prototype,"kc",b2.ParticleTriad.prototype.kc);
b2.ParticleTriad.prototype.s=0;goog.exportProperty(b2.ParticleTriad.prototype,"s",b2.ParticleTriad.prototype.s);b2.ParticleSystemDef=function(){};goog.exportSymbol("b2.ParticleSystemDef",b2.ParticleSystemDef);b2.ParticleSystemDef.prototype.strictContactCheck=!1;goog.exportProperty(b2.ParticleSystemDef.prototype,"strictContactCheck",b2.ParticleSystemDef.prototype.strictContactCheck);b2.ParticleSystemDef.prototype.density=1;
goog.exportProperty(b2.ParticleSystemDef.prototype,"density",b2.ParticleSystemDef.prototype.density);b2.ParticleSystemDef.prototype.gravityScale=1;goog.exportProperty(b2.ParticleSystemDef.prototype,"gravityScale",b2.ParticleSystemDef.prototype.gravityScale);b2.ParticleSystemDef.prototype.radius=1;goog.exportProperty(b2.ParticleSystemDef.prototype,"radius",b2.ParticleSystemDef.prototype.radius);b2.ParticleSystemDef.prototype.maxCount=0;
goog.exportProperty(b2.ParticleSystemDef.prototype,"maxCount",b2.ParticleSystemDef.prototype.maxCount);b2.ParticleSystemDef.prototype.pressureStrength=.005;goog.exportProperty(b2.ParticleSystemDef.prototype,"pressureStrength",b2.ParticleSystemDef.prototype.pressureStrength);b2.ParticleSystemDef.prototype.dampingStrength=1;goog.exportProperty(b2.ParticleSystemDef.prototype,"dampingStrength",b2.ParticleSystemDef.prototype.dampingStrength);
b2.ParticleSystemDef.prototype.elasticStrength=.25;goog.exportProperty(b2.ParticleSystemDef.prototype,"elasticStrength",b2.ParticleSystemDef.prototype.elasticStrength);b2.ParticleSystemDef.prototype.springStrength=.25;goog.exportProperty(b2.ParticleSystemDef.prototype,"springStrength",b2.ParticleSystemDef.prototype.springStrength);b2.ParticleSystemDef.prototype.viscousStrength=.25;goog.exportProperty(b2.ParticleSystemDef.prototype,"viscousStrength",b2.ParticleSystemDef.prototype.viscousStrength);
b2.ParticleSystemDef.prototype.surfaceTensionPressureStrength=.2;goog.exportProperty(b2.ParticleSystemDef.prototype,"surfaceTensionPressureStrength",b2.ParticleSystemDef.prototype.surfaceTensionPressureStrength);b2.ParticleSystemDef.prototype.surfaceTensionNormalStrength=.2;goog.exportProperty(b2.ParticleSystemDef.prototype,"surfaceTensionNormalStrength",b2.ParticleSystemDef.prototype.surfaceTensionNormalStrength);
b2.ParticleSystemDef.prototype.repulsiveStrength=1;goog.exportProperty(b2.ParticleSystemDef.prototype,"repulsiveStrength",b2.ParticleSystemDef.prototype.repulsiveStrength);b2.ParticleSystemDef.prototype.powderStrength=.5;goog.exportProperty(b2.ParticleSystemDef.prototype,"powderStrength",b2.ParticleSystemDef.prototype.powderStrength);b2.ParticleSystemDef.prototype.ejectionStrength=.5;goog.exportProperty(b2.ParticleSystemDef.prototype,"ejectionStrength",b2.ParticleSystemDef.prototype.ejectionStrength);
b2.ParticleSystemDef.prototype.staticPressureStrength=.2;goog.exportProperty(b2.ParticleSystemDef.prototype,"staticPressureStrength",b2.ParticleSystemDef.prototype.staticPressureStrength);b2.ParticleSystemDef.prototype.staticPressureRelaxation=.2;goog.exportProperty(b2.ParticleSystemDef.prototype,"staticPressureRelaxation",b2.ParticleSystemDef.prototype.staticPressureRelaxation);b2.ParticleSystemDef.prototype.staticPressureIterations=8;
goog.exportProperty(b2.ParticleSystemDef.prototype,"staticPressureIterations",b2.ParticleSystemDef.prototype.staticPressureIterations);b2.ParticleSystemDef.prototype.colorMixingStrength=.5;goog.exportProperty(b2.ParticleSystemDef.prototype,"colorMixingStrength",b2.ParticleSystemDef.prototype.colorMixingStrength);b2.ParticleSystemDef.prototype.destroyByAge=!0;goog.exportProperty(b2.ParticleSystemDef.prototype,"destroyByAge",b2.ParticleSystemDef.prototype.destroyByAge);
b2.ParticleSystemDef.prototype.lifetimeGranularity=1/60;goog.exportProperty(b2.ParticleSystemDef.prototype,"lifetimeGranularity",b2.ParticleSystemDef.prototype.lifetimeGranularity);
b2.ParticleSystemDef.prototype.Copy=function(a){this.strictContactCheck=a.strictContactCheck;this.density=a.density;this.gravityScale=a.gravityScale;this.radius=a.radius;this.maxCount=a.maxCount;this.pressureStrength=a.pressureStrength;this.dampingStrength=a.dampingStrength;this.elasticStrength=a.elasticStrength;this.springStrength=a.springStrength;this.viscousStrength=a.viscousStrength;this.surfaceTensionPressureStrength=a.surfaceTensionPressureStrength;this.surfaceTensionNormalStrength=a.surfaceTensionNormalStrength;
this.repulsiveStrength=a.repulsiveStrength;this.powderStrength=a.powderStrength;this.ejectionStrength=a.ejectionStrength;this.staticPressureStrength=a.staticPressureStrength;this.staticPressureRelaxation=a.staticPressureRelaxation;this.staticPressureIterations=a.staticPressureIterations;this.colorMixingStrength=a.colorMixingStrength;this.destroyByAge=a.destroyByAge;this.lifetimeGranularity=a.lifetimeGranularity;return this};b2.ParticleSystemDef.prototype.Clone=function(){return(new b2.ParticleSystemDef).Copy(this)};
b2.ParticleSystem=function(a,b){this._ctor_(a,b)};goog.exportSymbol("b2.ParticleSystem",b2.ParticleSystem);b2.ParticleSystem.prototype.m_paused=!1;b2.ParticleSystem.prototype.m_timestamp=0;b2.ParticleSystem.prototype.m_allParticleFlags=0;b2.ParticleSystem.prototype.m_needsUpdateAllParticleFlags=!1;b2.ParticleSystem.prototype.m_allGroupFlags=0;b2.ParticleSystem.prototype.m_needsUpdateAllGroupFlags=!1;b2.ParticleSystem.prototype.m_hasForce=!1;
b2.ParticleSystem.prototype.m_iterationIndex=0;b2.ParticleSystem.prototype.m_inverseDensity=0;b2.ParticleSystem.prototype.m_particleDiameter=0;b2.ParticleSystem.prototype.m_inverseDiameter=0;b2.ParticleSystem.prototype.m_squaredDiameter=0;b2.ParticleSystem.prototype.m_count=0;b2.ParticleSystem.prototype.m_internalAllocatedCapacity=0;b2.ParticleSystem.prototype.m_handleAllocator=null;b2.ParticleSystem.prototype.m_handleIndexBuffer=null;
b2.ParticleSystem.prototype.m_flagsBuffer=null;b2.ParticleSystem.prototype.m_positionBuffer=null;b2.ParticleSystem.prototype.m_velocityBuffer=null;b2.ParticleSystem.prototype.m_forceBuffer=null;b2.ParticleSystem.prototype.m_weightBuffer=null;b2.ParticleSystem.prototype.m_staticPressureBuffer=null;b2.ParticleSystem.prototype.m_accumulationBuffer=null;b2.ParticleSystem.prototype.m_accumulation2Buffer=null;b2.ParticleSystem.prototype.m_depthBuffer=null;
b2.ParticleSystem.prototype.m_colorBuffer=null;b2.ParticleSystem.prototype.m_groupBuffer=null;b2.ParticleSystem.prototype.m_userDataBuffer=null;b2.ParticleSystem.prototype.m_stuckThreshold=0;b2.ParticleSystem.prototype.m_lastBodyContactStepBuffer=null;b2.ParticleSystem.prototype.m_bodyContactCountBuffer=null;b2.ParticleSystem.prototype.m_consecutiveContactStepsBuffer=null;b2.ParticleSystem.prototype.m_stuckParticleBuffer=null;
b2.ParticleSystem.prototype.m_proxyBuffer=null;b2.ParticleSystem.prototype.m_contactBuffer=null;b2.ParticleSystem.prototype.m_bodyContactBuffer=null;b2.ParticleSystem.prototype.m_pairBuffer=null;b2.ParticleSystem.prototype.m_triadBuffer=null;b2.ParticleSystem.prototype.m_expirationTimeBuffer=null;b2.ParticleSystem.prototype.m_indexByExpirationTimeBuffer=null;b2.ParticleSystem.prototype.m_timeElapsed=0;
b2.ParticleSystem.prototype.m_expirationTimeBufferRequiresSorting=!1;b2.ParticleSystem.prototype.m_groupCount=0;b2.ParticleSystem.prototype.m_groupList=null;b2.ParticleSystem.prototype.m_def=null;b2.ParticleSystem.prototype.m_world=null;b2.ParticleSystem.prototype.m_prev=null;b2.ParticleSystem.prototype.m_next=null;b2.ParticleSystem.xTruncBits=12;b2.ParticleSystem.yTruncBits=12;b2.ParticleSystem.tagBits=32;
b2.ParticleSystem.yOffset=1<<b2.ParticleSystem.yTruncBits-1;b2.ParticleSystem.yShift=b2.ParticleSystem.tagBits-b2.ParticleSystem.yTruncBits;b2.ParticleSystem.xShift=b2.ParticleSystem.tagBits-b2.ParticleSystem.yTruncBits-b2.ParticleSystem.xTruncBits;b2.ParticleSystem.xScale=1<<b2.ParticleSystem.xShift;b2.ParticleSystem.xOffset=b2.ParticleSystem.xScale*(1<<b2.ParticleSystem.xTruncBits-1);
b2.ParticleSystem.yMask=(1<<b2.ParticleSystem.yTruncBits)-1<<b2.ParticleSystem.yShift;b2.ParticleSystem.xMask=~b2.ParticleSystem.yMask;b2.ParticleSystem.computeTag=function(a,b){return(b+b2.ParticleSystem.yOffset>>>0<<b2.ParticleSystem.yShift)+(b2.ParticleSystem.xScale*a+b2.ParticleSystem.xOffset>>>0)>>>0};b2.ParticleSystem.computeRelativeTag=function(a,b,c){return a+(c<<b2.ParticleSystem.yShift)+(b<<b2.ParticleSystem.xShift)>>>0};
b2.ParticleSystem.FixedSetAllocator=function(){};b2.ParticleSystem.FixedSetAllocator.prototype.Invalidate=function(a){};b2.ParticleSystem.FixtureParticle=function(a,b){this.first=a;this.second=b};b2.ParticleSystem.FixtureParticle.prototype.first=null;b2.ParticleSystem.FixtureParticle.prototype.second=b2._invalidParticleIndex;b2.ParticleSystem.FixtureParticleSet=function(){};goog.inherits(b2.ParticleSystem.FixtureParticleSet,b2.ParticleSystem.FixedSetAllocator);
b2.ParticleSystem.FixtureParticleSet.prototype.Initialize=function(a,b){};b2.ParticleSystem.FixtureParticleSet.prototype.Find=function(a){};b2.ParticleSystem.ParticlePair=function(a,b){};b2.ParticleSystem.ParticlePair.prototype.first=b2._invalidParticleIndex;b2.ParticleSystem.ParticlePair.prototype.second=b2._invalidParticleIndex;b2.ParticleSystem.b2ParticlePairSet=function(){};goog.inherits(b2.ParticleSystem.b2ParticlePairSet,b2.ParticleSystem.FixedSetAllocator);
b2.ParticleSystem.b2ParticlePairSet.prototype.Initialize=function(a,b){};b2.ParticleSystem.b2ParticlePairSet.prototype.Find=function(a){};b2.ParticleSystem.ConnectionFilter=function(){};b2.ParticleSystem.ConnectionFilter.prototype.IsNecessary=function(a){return!0};b2.ParticleSystem.ConnectionFilter.prototype.ShouldCreatePair=function(a,b){return!0};b2.ParticleSystem.ConnectionFilter.prototype.ShouldCreateTriad=function(a,b,c){return!0};
b2.ParticleSystem.prototype._ctor_=function(a,b){this.m_handleIndexBuffer=new b2.ParticleSystem.UserOverridableBuffer;this.m_flagsBuffer=new b2.ParticleSystem.UserOverridableBuffer;this.m_positionBuffer=new b2.ParticleSystem.UserOverridableBuffer;this.m_velocityBuffer=new b2.ParticleSystem.UserOverridableBuffer;this.m_forceBuffer=[];this.m_weightBuffer=[];this.m_staticPressureBuffer=[];this.m_accumulationBuffer=[];this.m_accumulation2Buffer=[];this.m_depthBuffer=[];this.m_colorBuffer=
new b2.ParticleSystem.UserOverridableBuffer;this.m_groupBuffer=[];this.m_userDataBuffer=new b2.ParticleSystem.UserOverridableBuffer;this.m_lastBodyContactStepBuffer=new b2.ParticleSystem.UserOverridableBuffer;this.m_bodyContactCountBuffer=new b2.ParticleSystem.UserOverridableBuffer;this.m_consecutiveContactStepsBuffer=new b2.ParticleSystem.UserOverridableBuffer;this.m_stuckParticleBuffer=new b2.GrowableBuffer(function(){return 0});this.m_proxyBuffer=new b2.GrowableBuffer(function(){return new b2.ParticleSystem.Proxy});
this.m_contactBuffer=new b2.GrowableBuffer(function(){return new b2.ParticleContact});this.m_bodyContactBuffer=new b2.GrowableBuffer(function(){return new b2.ParticleBodyContact});this.m_pairBuffer=new b2.GrowableBuffer(function(){return new b2.ParticlePair});this.m_triadBuffer=new b2.GrowableBuffer(function(){return new b2.ParticleTriad});this.m_expirationTimeBuffer=new b2.ParticleSystem.UserOverridableBuffer;this.m_indexByExpirationTimeBuffer=new b2.ParticleSystem.UserOverridableBuffer;
this.m_def=new b2.ParticleSystemDef;b2.Assert(null!==a);this.SetStrictContactCheck(a.strictContactCheck);this.SetDensity(a.density);this.SetGravityScale(a.gravityScale);this.SetRadius(a.radius);this.SetMaxParticleCount(a.maxCount);b2.Assert(0<a.lifetimeGranularity);this.m_def=a.Clone();this.m_world=b;this.SetDestructionByAge(this.m_def.destroyByAge)};
b2.ParticleSystem.prototype._dtor_=function(){for(;this.m_groupList;)this.DestroyParticleGroup(this.m_groupList);this.FreeUserOverridableBuffer(this.m_handleIndexBuffer);this.FreeUserOverridableBuffer(this.m_flagsBuffer);this.FreeUserOverridableBuffer(this.m_lastBodyContactStepBuffer);this.FreeUserOverridableBuffer(this.m_bodyContactCountBuffer);this.FreeUserOverridableBuffer(this.m_consecutiveContactStepsBuffer);this.FreeUserOverridableBuffer(this.m_positionBuffer);this.FreeUserOverridableBuffer(this.m_velocityBuffer);
this.FreeUserOverridableBuffer(this.m_colorBuffer);this.FreeUserOverridableBuffer(this.m_userDataBuffer);this.FreeUserOverridableBuffer(this.m_expirationTimeBuffer);this.FreeUserOverridableBuffer(this.m_indexByExpirationTimeBuffer);this.FreeBuffer(this.m_forceBuffer,this.m_internalAllocatedCapacity);this.FreeBuffer(this.m_weightBuffer,this.m_internalAllocatedCapacity);this.FreeBuffer(this.m_staticPressureBuffer,this.m_internalAllocatedCapacity);this.FreeBuffer(this.m_accumulationBuffer,this.m_internalAllocatedCapacity);
this.FreeBuffer(this.m_accumulation2Buffer,this.m_internalAllocatedCapacity);this.FreeBuffer(this.m_depthBuffer,this.m_internalAllocatedCapacity);this.FreeBuffer(this.m_groupBuffer,this.m_internalAllocatedCapacity)};b2.ParticleSystem.prototype.Drop=function(){this._dtor_()};
b2.ParticleSystem.prototype.CreateParticle=function(a){b2.Assert(!1===this.m_world.IsLocked());if(this.m_world.IsLocked())return 0;this.m_count>=this.m_internalAllocatedCapacity&&this.ReallocateInternalAllocatedBuffers(this.m_count?2*this.m_count:b2._minParticleSystemBufferCapacity);if(this.m_count>=this.m_internalAllocatedCapacity)if(this.m_def.destroyByAge)this.DestroyOldestParticle(0,!1),this.SolveZombie();else return b2._invalidParticleIndex;var b=this.m_count++;this.m_flagsBuffer.data[b]=
0;this.m_lastBodyContactStepBuffer.data&&(this.m_lastBodyContactStepBuffer.data[b]=0);this.m_bodyContactCountBuffer.data&&(this.m_bodyContactCountBuffer.data[b]=0);this.m_consecutiveContactStepsBuffer.data&&(this.m_consecutiveContactStepsBuffer.data[b]=0);this.m_positionBuffer.data[b]=a.position.Clone();this.m_velocityBuffer.data[b]=a.velocity.Clone();this.m_weightBuffer[b]=0;this.m_forceBuffer[b]=b2.Vec2_zero.Clone();this.m_staticPressureBuffer&&(this.m_staticPressureBuffer[b]=0);this.m_depthBuffer&&
(this.m_depthBuffer[b]=0);if(this.m_colorBuffer.data||!a.color.IsZero())this.m_colorBuffer.data=this.RequestBuffer(this.m_colorBuffer.data),this.m_colorBuffer.data[b]=a.color.Clone();if(this.m_userDataBuffer.data||a.userData)this.m_userDataBuffer.data=this.RequestBuffer(this.m_userDataBuffer.data),this.m_userDataBuffer.data[b]=a.userData;this.m_handleIndexBuffer.data&&(this.m_handleIndexBuffer.data[b]=null);var c=this.m_proxyBuffer.data[this.m_proxyBuffer.Append()],d=0<a.lifetime;if(this.m_expirationTimeBuffer.data||
d)this.SetParticleLifetime(b,d?a.lifetime:this.ExpirationTimeToLifetime(-this.GetQuantizedTimeElapsed())),this.m_indexByExpirationTimeBuffer.data[b]=b;c.index=b;c=a.group;if(this.m_groupBuffer[b]=c)c.m_firstIndex<c.m_lastIndex?(this.RotateBuffer(c.m_firstIndex,c.m_lastIndex,b),b2.Assert(c.m_lastIndex===b)):c.m_firstIndex=b,c.m_lastIndex=b+1;this.SetParticleFlags(b,a.flags);return b};goog.exportProperty(b2.ParticleSystem.prototype,"CreateParticle",b2.ParticleSystem.prototype.CreateParticle);
b2.ParticleSystem.prototype.GetParticleHandleFromIndex=function(a){b2.Assert(0<=a&&a<this.GetParticleCount()&&a!==b2._invalidParticleIndex);this.m_handleIndexBuffer.data=this.RequestBuffer(this.m_handleIndexBuffer.data);var b=this.m_handleIndexBuffer.data[a];if(b)return b;b=new b2.ParticleHandle;b2.Assert(null!==b);b.SetIndex(a);return this.m_handleIndexBuffer.data[a]=b};goog.exportProperty(b2.ParticleSystem.prototype,"GetParticleHandleFromIndex",b2.ParticleSystem.prototype.GetParticleHandleFromIndex);
b2.ParticleSystem.prototype.DestroyParticle=function(a,b){var c=b2.ParticleFlag.zombieParticle;b&&(c|=b2.ParticleFlag.destructionListenerParticle);this.SetParticleFlags(a,this.m_flagsBuffer.data[a]|c)};goog.exportProperty(b2.ParticleSystem.prototype,"DestroyParticle",b2.ParticleSystem.prototype.DestroyParticle);
b2.ParticleSystem.prototype.DestroyOldestParticle=function(a,b){var c=this.GetParticleCount();b2.Assert(0<=a&&a<c);b2.Assert(null!==this.m_indexByExpirationTimeBuffer.data);var c=this.m_indexByExpirationTimeBuffer.data[c-(a+1)],d=this.m_indexByExpirationTimeBuffer.data[a];this.DestroyParticle(0<this.m_expirationTimeBuffer.data[c]?c:d,b)};
b2.ParticleSystem.DestroyParticlesInShapeCallback=function(a,b,c,d){this.m_system=a;this.m_shape=b;this.m_xf=c;this.m_callDestructionListener=d;this.m_destroyed=0};goog.inherits(b2.ParticleSystem.DestroyParticlesInShapeCallback,b2.QueryCallback);b2.ParticleSystem.DestroyParticlesInShapeCallback.prototype.m_system=null;b2.ParticleSystem.DestroyParticlesInShapeCallback.prototype.m_shape=null;b2.ParticleSystem.DestroyParticlesInShapeCallback.prototype.m_xf=null;
b2.ParticleSystem.DestroyParticlesInShapeCallback.prototype.m_callDestructionListener=!1;b2.ParticleSystem.DestroyParticlesInShapeCallback.prototype.m_destroyed=0;b2.ParticleSystem.DestroyParticlesInShapeCallback.prototype.ReportFixture=function(a){return!1};
b2.ParticleSystem.DestroyParticlesInShapeCallback.prototype.ReportParticle=function(a,b){if(a!==this.m_system)return!1;b2.Assert(0<=b&&b<this.m_system.m_count);this.m_shape.TestPoint(this.m_xf,this.m_system.m_positionBuffer.data[b])&&(this.m_system.DestroyParticle(b,this.m_callDestructionListener),this.m_destroyed++);return!0};b2.ParticleSystem.DestroyParticlesInShapeCallback.prototype.Destroyed=function(){return this.m_destroyed};
b2.ParticleSystem.prototype.DestroyParticlesInShape=function(a,b,c){var d=b2.ParticleSystem.prototype.DestroyParticlesInShape.s_aabb;b2.Assert(!1===this.m_world.IsLocked());if(this.m_world.IsLocked())return 0;c=new b2.ParticleSystem.DestroyParticlesInShapeCallback(this,a,b,c);a.ComputeAABB(d,b,0);this.m_world.QueryAABB(c,d);return c.Destroyed()};goog.exportProperty(b2.ParticleSystem.prototype,"DestroyParticlesInShape",b2.ParticleSystem.prototype.DestroyParticlesInShape);
b2.ParticleSystem.prototype.DestroyParticlesInShape.s_aabb=new b2.AABB;
b2.ParticleSystem.prototype.CreateParticleGroup=function(a){var b=b2.ParticleSystem.prototype.CreateParticleGroup.s_transform;b2.Assert(!1===this.m_world.IsLocked());if(this.m_world.IsLocked())return null;b.Set(a.position,a.angle);var c=this.m_count;a.shape&&this.CreateParticlesWithShapeForGroup(a.shape,a,b);a.shapes&&this.CreateParticlesWithShapesForGroup(a.shapes,a.shapeCount,a,b);if(a.particleCount){b2.Assert(null!==a.positionData);for(var d=0;d<a.particleCount;d++)this.CreateParticleForGroup(a,
b,a.positionData[d])}var e=this.m_count,f=new b2.ParticleGroup;f.m_system=this;f.m_firstIndex=c;f.m_lastIndex=e;f.m_strength=a.strength;f.m_userData=a.userData;f.m_transform.Copy(b);f.m_prev=null;if(f.m_next=this.m_groupList)this.m_groupList.m_prev=f;this.m_groupList=f;++this.m_groupCount;for(d=c;d<e;d++)this.m_groupBuffer[d]=f;this.SetGroupFlags(f,a.groupFlags);b=new b2.ParticleSystem.ConnectionFilter;this.UpdateContacts(!0);this.UpdatePairsAndTriads(c,e,b);a.group&&(this.JoinParticleGroups(a.group,
f),f=a.group);return f};goog.exportProperty(b2.ParticleSystem.prototype,"CreateParticleGroup",b2.ParticleSystem.prototype.CreateParticleGroup);b2.ParticleSystem.prototype.CreateParticleGroup.s_transform=new b2.Transform;b2.ParticleSystem.JoinParticleGroupsFilter=function(a){this.m_threshold=a};goog.inherits(b2.ParticleSystem.JoinParticleGroupsFilter,b2.ParticleSystem.ConnectionFilter);b2.ParticleSystem.JoinParticleGroupsFilter.prototype.m_threshold=0;
b2.ParticleSystem.JoinParticleGroupsFilter.prototype.ShouldCreatePair=function(a,b){return a<this.m_threshold&&this.m_threshold<=b||b<this.m_threshold&&this.m_threshold<=a};b2.ParticleSystem.JoinParticleGroupsFilter.prototype.ShouldCreateTriad=function(a,b,c){return(a<this.m_threshold||b<this.m_threshold||c<this.m_threshold)&&(this.m_threshold<=a||this.m_threshold<=b||this.m_threshold<=c)};
b2.ParticleSystem.prototype.JoinParticleGroups=function(a,b){b2.Assert(!1===this.m_world.IsLocked());if(!this.m_world.IsLocked()){b2.Assert(a!==b);this.RotateBuffer(b.m_firstIndex,b.m_lastIndex,this.m_count);b2.Assert(b.m_lastIndex===this.m_count);this.RotateBuffer(a.m_firstIndex,a.m_lastIndex,b.m_firstIndex);b2.Assert(a.m_lastIndex===b.m_firstIndex);var c=new b2.ParticleSystem.JoinParticleGroupsFilter(b.m_firstIndex);this.UpdateContacts(!0);this.UpdatePairsAndTriads(a.m_firstIndex,
b.m_lastIndex,c);for(c=b.m_firstIndex;c<b.m_lastIndex;c++)this.m_groupBuffer[c]=a;this.SetGroupFlags(a,a.m_groupFlags|b.m_groupFlags);a.m_lastIndex=b.m_lastIndex;b.m_firstIndex=b.m_lastIndex;this.DestroyParticleGroup(b)}};goog.exportProperty(b2.ParticleSystem.prototype,"JoinParticleGroups",b2.ParticleSystem.prototype.JoinParticleGroups);
b2.ParticleSystem.prototype.SplitParticleGroup=function(a){this.UpdateContacts(!0);var b=a.GetParticleCount(),b=b2.MakeArray(b,function(a){return new b2.ParticleSystem.ParticleListNode});b2.ParticleSystem.InitializeParticleLists(a,b);this.MergeParticleListsInContact(a,b);var c=b2.ParticleSystem.FindLongestParticleList(a,b);this.MergeZombieParticleListNodes(a,b,c);this.CreateParticleGroupsFromParticleList(a,b,c);this.UpdatePairsAndTriadsWithParticleList(a,b)};
goog.exportProperty(b2.ParticleSystem.prototype,"SplitParticleGroup",b2.ParticleSystem.prototype.SplitParticleGroup);b2.ParticleSystem.prototype.GetParticleGroupList=function(){return this.m_groupList};goog.exportProperty(b2.ParticleSystem.prototype,"GetParticleGroupList",b2.ParticleSystem.prototype.GetParticleGroupList);b2.ParticleSystem.prototype.GetParticleGroupCount=function(){return this.m_groupCount};
goog.exportProperty(b2.ParticleSystem.prototype,"GetParticleGroupCount",b2.ParticleSystem.prototype.GetParticleGroupCount);b2.ParticleSystem.prototype.GetParticleCount=function(){return this.m_count};goog.exportProperty(b2.ParticleSystem.prototype,"GetParticleCount",b2.ParticleSystem.prototype.GetParticleCount);b2.ParticleSystem.prototype.GetMaxParticleCount=function(){return this.m_def.maxCount};
goog.exportProperty(b2.ParticleSystem.prototype,"GetMaxParticleCount",b2.ParticleSystem.prototype.GetMaxParticleCount);b2.ParticleSystem.prototype.SetMaxParticleCount=function(a){b2.Assert(this.m_count<=a);this.m_def.maxCount=a};goog.exportProperty(b2.ParticleSystem.prototype,"SetMaxParticleCount",b2.ParticleSystem.prototype.SetMaxParticleCount);b2.ParticleSystem.prototype.GetAllParticleFlags=function(){return this.m_allParticleFlags};
goog.exportProperty(b2.ParticleSystem.prototype,"GetAllParticleFlags",b2.ParticleSystem.prototype.GetAllParticleFlags);b2.ParticleSystem.prototype.GetAllGroupFlags=function(){return this.m_allGroupFlags};goog.exportProperty(b2.ParticleSystem.prototype,"GetAllGroupFlags",b2.ParticleSystem.prototype.GetAllGroupFlags);b2.ParticleSystem.prototype.SetPaused=function(a){this.m_paused=a};goog.exportProperty(b2.ParticleSystem.prototype,"SetPaused",b2.ParticleSystem.prototype.SetPaused);
b2.ParticleSystem.prototype.GetPaused=function(){return this.m_paused};goog.exportProperty(b2.ParticleSystem.prototype,"GetPaused",b2.ParticleSystem.prototype.GetPaused);b2.ParticleSystem.prototype.SetDensity=function(a){this.m_def.density=a;this.m_inverseDensity=1/this.m_def.density};goog.exportProperty(b2.ParticleSystem.prototype,"SetDensity",b2.ParticleSystem.prototype.SetDensity);b2.ParticleSystem.prototype.GetDensity=function(){return this.m_def.density};
goog.exportProperty(b2.ParticleSystem.prototype,"GetDensity",b2.ParticleSystem.prototype.GetDensity);b2.ParticleSystem.prototype.SetGravityScale=function(a){this.m_def.gravityScale=a};goog.exportProperty(b2.ParticleSystem.prototype,"SetGravityScale",b2.ParticleSystem.prototype.SetGravityScale);b2.ParticleSystem.prototype.GetGravityScale=function(){return this.m_def.gravityScale};goog.exportProperty(b2.ParticleSystem.prototype,"GetGravityScale",b2.ParticleSystem.prototype.GetGravityScale);
b2.ParticleSystem.prototype.SetDamping=function(a){this.m_def.dampingStrength=a};goog.exportProperty(b2.ParticleSystem.prototype,"SetDamping",b2.ParticleSystem.prototype.SetDamping);b2.ParticleSystem.prototype.GetDamping=function(){return this.m_def.dampingStrength};goog.exportProperty(b2.ParticleSystem.prototype,"GetDamping",b2.ParticleSystem.prototype.GetDamping);
b2.ParticleSystem.prototype.SetStaticPressureIterations=function(a){this.m_def.staticPressureIterations=a};goog.exportProperty(b2.ParticleSystem.prototype,"SetStaticPressureIterations",b2.ParticleSystem.prototype.SetStaticPressureIterations);b2.ParticleSystem.prototype.GetStaticPressureIterations=function(){return this.m_def.staticPressureIterations};goog.exportProperty(b2.ParticleSystem.prototype,"GetStaticPressureIterations",b2.ParticleSystem.prototype.GetStaticPressureIterations);
b2.ParticleSystem.prototype.SetRadius=function(a){this.m_particleDiameter=2*a;this.m_squaredDiameter=this.m_particleDiameter*this.m_particleDiameter;this.m_inverseDiameter=1/this.m_particleDiameter};goog.exportProperty(b2.ParticleSystem.prototype,"SetRadius",b2.ParticleSystem.prototype.SetRadius);b2.ParticleSystem.prototype.GetRadius=function(){return this.m_particleDiameter/2};goog.exportProperty(b2.ParticleSystem.prototype,"GetRadius",b2.ParticleSystem.prototype.GetRadius);
b2.ParticleSystem.prototype.GetPositionBuffer=function(){return this.m_positionBuffer.data};goog.exportProperty(b2.ParticleSystem.prototype,"GetPositionBuffer",b2.ParticleSystem.prototype.GetPositionBuffer);b2.ParticleSystem.prototype.GetVelocityBuffer=function(){return this.m_velocityBuffer.data};goog.exportProperty(b2.ParticleSystem.prototype,"GetVelocityBuffer",b2.ParticleSystem.prototype.GetVelocityBuffer);
b2.ParticleSystem.prototype.GetColorBuffer=function(){this.m_colorBuffer.data=this.RequestBuffer(this.m_colorBuffer.data);return this.m_colorBuffer.data};goog.exportProperty(b2.ParticleSystem.prototype,"GetColorBuffer",b2.ParticleSystem.prototype.GetColorBuffer);b2.ParticleSystem.prototype.GetGroupBuffer=function(){return this.m_groupBuffer};goog.exportProperty(b2.ParticleSystem.prototype,"GetGroupBuffer",b2.ParticleSystem.prototype.GetGroupBuffer);
b2.ParticleSystem.prototype.GetWeightBuffer=function(){return this.m_weightBuffer};goog.exportProperty(b2.ParticleSystem.prototype,"GetWeightBuffer",b2.ParticleSystem.prototype.GetWeightBuffer);b2.ParticleSystem.prototype.GetUserDataBuffer=function(){this.m_userDataBuffer.data=this.RequestBuffer(this.m_userDataBuffer.data);return this.m_userDataBuffer.data};goog.exportProperty(b2.ParticleSystem.prototype,"GetUserDataBuffer",b2.ParticleSystem.prototype.GetUserDataBuffer);
b2.ParticleSystem.prototype.GetFlagsBuffer=function(){return this.m_flagsBuffer.data};goog.exportProperty(b2.ParticleSystem.prototype,"GetFlagsBuffer",b2.ParticleSystem.prototype.GetFlagsBuffer);
b2.ParticleSystem.prototype.SetParticleFlags=function(a,b){this.m_flagsBuffer.data[a]&~b&&(this.m_needsUpdateAllParticleFlags=!0);~this.m_allParticleFlags&b&&(b&b2.ParticleFlag.tensileParticle&&(this.m_accumulation2Buffer=this.RequestBuffer(this.m_accumulation2Buffer)),b&b2.ParticleFlag.colorMixingParticle&&(this.m_colorBuffer.data=this.RequestBuffer(this.m_colorBuffer.data)),this.m_allParticleFlags|=b);this.m_flagsBuffer.data[a]=b};
goog.exportProperty(b2.ParticleSystem.prototype,"SetParticleFlags",b2.ParticleSystem.prototype.SetParticleFlags);b2.ParticleSystem.prototype.GetParticleFlags=function(a){return this.m_flagsBuffer.data[a]};goog.exportProperty(b2.ParticleSystem.prototype,"GetParticleFlags",b2.ParticleSystem.prototype.GetParticleFlags);b2.ParticleSystem.prototype.SetFlagsBuffer=function(a,b){this.SetUserOverridableBuffer(this.m_flagsBuffer,a,b)};
goog.exportProperty(b2.ParticleSystem.prototype,"SetFlagsBuffer",b2.ParticleSystem.prototype.SetFlagsBuffer);b2.ParticleSystem.prototype.SetPositionBuffer=function(a,b){this.SetUserOverridableBuffer(this.m_positionBuffer,a,b)};goog.exportProperty(b2.ParticleSystem.prototype,"SetPositionBuffer",b2.ParticleSystem.prototype.SetPositionBuffer);b2.ParticleSystem.prototype.SetVelocityBuffer=function(a,b){this.SetUserOverridableBuffer(this.m_velocityBuffer,a,b)};
goog.exportProperty(b2.ParticleSystem.prototype,"SetVelocityBuffer",b2.ParticleSystem.prototype.SetVelocityBuffer);b2.ParticleSystem.prototype.SetColorBuffer=function(a,b){this.SetUserOverridableBuffer(this.m_colorBuffer,a,b)};goog.exportProperty(b2.ParticleSystem.prototype,"SetColorBuffer",b2.ParticleSystem.prototype.SetColorBuffer);b2.ParticleSystem.prototype.SetUserDataBuffer=function(a,b){this.SetUserOverridableBuffer(this.m_userDataBuffer,a,b)};
goog.exportProperty(b2.ParticleSystem.prototype,"SetUserDataBuffer",b2.ParticleSystem.prototype.SetUserDataBuffer);b2.ParticleSystem.prototype.GetContacts=function(){return this.m_contactBuffer.data};goog.exportProperty(b2.ParticleSystem.prototype,"GetContacts",b2.ParticleSystem.prototype.GetContacts);b2.ParticleSystem.prototype.GetContactCount=function(){return this.m_contactBuffer.count};goog.exportProperty(b2.ParticleSystem.prototype,"GetContactCount",b2.ParticleSystem.prototype.GetContactCount);
b2.ParticleSystem.prototype.GetBodyContacts=function(){return this.m_bodyContactBuffer.data};goog.exportProperty(b2.ParticleSystem.prototype,"GetBodyContacts",b2.ParticleSystem.prototype.GetBodyContacts);b2.ParticleSystem.prototype.GetBodyContactCount=function(){return this.m_bodyContactBuffer.count};goog.exportProperty(b2.ParticleSystem.prototype,"GetBodyContactCount",b2.ParticleSystem.prototype.GetBodyContactCount);b2.ParticleSystem.prototype.GetPairs=function(){return this.m_pairBuffer.data};
goog.exportProperty(b2.ParticleSystem.prototype,"GetPairs",b2.ParticleSystem.prototype.GetPairs);b2.ParticleSystem.prototype.GetPairCount=function(){return this.m_pairBuffer.count};goog.exportProperty(b2.ParticleSystem.prototype,"GetPairCount",b2.ParticleSystem.prototype.GetPairCount);b2.ParticleSystem.prototype.GetTriads=function(){return this.m_triadBuffer.data};goog.exportProperty(b2.ParticleSystem.prototype,"GetTriads",b2.ParticleSystem.prototype.GetTriads);
b2.ParticleSystem.prototype.GetTriadCount=function(){return this.m_triadBuffer.count};goog.exportProperty(b2.ParticleSystem.prototype,"GetTriadCount",b2.ParticleSystem.prototype.GetTriadCount);
b2.ParticleSystem.prototype.SetStuckThreshold=function(a){this.m_stuckThreshold=a;0<a&&(this.m_lastBodyContactStepBuffer.data=this.RequestBuffer(this.m_lastBodyContactStepBuffer.data),this.m_bodyContactCountBuffer.data=this.RequestBuffer(this.m_bodyContactCountBuffer.data),this.m_consecutiveContactStepsBuffer.data=this.RequestBuffer(this.m_consecutiveContactStepsBuffer.data))};b2.ParticleSystem.prototype.GetStuckCandidates=function(){return this.m_stuckParticleBuffer.Data()};
goog.exportProperty(b2.ParticleSystem.prototype,"GetStuckCandidates",b2.ParticleSystem.prototype.GetStuckCandidates);b2.ParticleSystem.prototype.GetStuckCandidateCount=function(){return this.m_stuckParticleBuffer.GetCount()};goog.exportProperty(b2.ParticleSystem.prototype,"GetStuckCandidateCount",b2.ParticleSystem.prototype.GetStuckCandidateCount);
b2.ParticleSystem.prototype.ComputeCollisionEnergy=function(){for(var a=b2.ParticleSystem.prototype.ComputeCollisionEnergy.s_v,b=this.m_velocityBuffer.data,c=0,d=0;d<this.m_contactBuffer.count;d++){var e=this.m_contactBuffer.data[d],f=e.normal,e=b2.Sub_V2_V2(b[e.indexB],b[e.indexA],a),f=b2.Dot_V2_V2(e,f);0>f&&(c+=f*f)}return.5*this.GetParticleMass()*c};goog.exportProperty(b2.ParticleSystem.prototype,"ComputeCollisionEnergy",b2.ParticleSystem.prototype.ComputeCollisionEnergy);
b2.ParticleSystem.prototype.ComputeCollisionEnergy.s_v=new b2.Vec2;b2.ParticleSystem.prototype.SetStrictContactCheck=function(a){this.m_def.strictContactCheck=a};goog.exportProperty(b2.ParticleSystem.prototype,"SetStrictContactCheck",b2.ParticleSystem.prototype.SetStrictContactCheck);b2.ParticleSystem.prototype.GetStrictContactCheck=function(){return this.m_def.strictContactCheck};goog.exportProperty(b2.ParticleSystem.prototype,"GetStrictContactCheck",b2.ParticleSystem.prototype.GetStrictContactCheck);
b2.ParticleSystem.prototype.SetParticleLifetime=function(a,b){b2.Assert(this.ValidateParticleIndex(a));var c=null===this.m_indexByExpirationTimeBuffer.data;this.m_expirationTimeBuffer.data=this.RequestBuffer(this.m_expirationTimeBuffer.data);this.m_indexByExpirationTimeBuffer.data=this.RequestBuffer(this.m_indexByExpirationTimeBuffer.data);if(c)for(var c=this.GetParticleCount(),d=0;d<c;++d)this.m_indexByExpirationTimeBuffer.data[d]=d;c=b/this.m_def.lifetimeGranularity;c=0<c?this.GetQuantizedTimeElapsed()+
c:c;c!==this.m_expirationTimeBuffer.data[a]&&(this.m_expirationTimeBuffer.data[a]=c,this.m_expirationTimeBufferRequiresSorting=!0)};goog.exportProperty(b2.ParticleSystem.prototype,"SetParticleLifetime",b2.ParticleSystem.prototype.SetParticleLifetime);b2.ParticleSystem.prototype.GetParticleLifetime=function(a){b2.Assert(this.ValidateParticleIndex(a));return this.ExpirationTimeToLifetime(this.GetExpirationTimeBuffer()[a])};
goog.exportProperty(b2.ParticleSystem.prototype,"GetParticleLifetime",b2.ParticleSystem.prototype.GetParticleLifetime);b2.ParticleSystem.prototype.SetDestructionByAge=function(a){a&&this.GetExpirationTimeBuffer();this.m_def.destroyByAge=a};goog.exportProperty(b2.ParticleSystem.prototype,"SetDestructionByAge",b2.ParticleSystem.prototype.SetDestructionByAge);b2.ParticleSystem.prototype.GetDestructionByAge=function(){return this.m_def.destroyByAge};
goog.exportProperty(b2.ParticleSystem.prototype,"GetDestructionByAge",b2.ParticleSystem.prototype.GetDestructionByAge);b2.ParticleSystem.prototype.GetExpirationTimeBuffer=function(){this.m_expirationTimeBuffer.data=this.RequestBuffer(this.m_expirationTimeBuffer.data);return this.m_expirationTimeBuffer.data};goog.exportProperty(b2.ParticleSystem.prototype,"GetExpirationTimeBuffer",b2.ParticleSystem.prototype.GetExpirationTimeBuffer);
b2.ParticleSystem.prototype.ExpirationTimeToLifetime=function(a){return(0<a?a-this.GetQuantizedTimeElapsed():a)*this.m_def.lifetimeGranularity};goog.exportProperty(b2.ParticleSystem.prototype,"ExpirationTimeToLifetime",b2.ParticleSystem.prototype.ExpirationTimeToLifetime);
b2.ParticleSystem.prototype.GetIndexByExpirationTimeBuffer=function(){this.GetParticleCount()?this.SetParticleLifetime(0,this.GetParticleLifetime(0)):this.m_indexByExpirationTimeBuffer.data=this.RequestBuffer(this.m_indexByExpirationTimeBuffer.data);return this.m_indexByExpirationTimeBuffer.data};goog.exportProperty(b2.ParticleSystem.prototype,"GetIndexByExpirationTimeBuffer",b2.ParticleSystem.prototype.GetIndexByExpirationTimeBuffer);
b2.ParticleSystem.prototype.ParticleApplyLinearImpulse=function(a,b){this.ApplyLinearImpulse(a,a+1,b)};goog.exportProperty(b2.ParticleSystem.prototype,"ParticleApplyLinearImpulse",b2.ParticleSystem.prototype.ParticleApplyLinearImpulse);b2.ParticleSystem.prototype.ApplyLinearImpulse=function(a,b,c){var d=this.m_velocityBuffer.data,e=(b-a)*this.GetParticleMass();for(c=c.Clone().SelfMul(1/e);a<b;a++)d[a].SelfAdd(c)};
goog.exportProperty(b2.ParticleSystem.prototype,"ApplyLinearImpulse",b2.ParticleSystem.prototype.ApplyLinearImpulse);b2.ParticleSystem.IsSignificantForce=function(a){return 0!==a.x||0!==a.y};b2.ParticleSystem.prototype.ParticleApplyForce=function(a,b){b2.ParticleSystem.IsSignificantForce(b)&&this.ForceCanBeApplied(this.m_flagsBuffer.data[a])&&(this.PrepareForceBuffer(),this.m_forceBuffer[a].SelfAdd(b))};
goog.exportProperty(b2.ParticleSystem.prototype,"ParticleApplyForce",b2.ParticleSystem.prototype.ParticleApplyForce);b2.ParticleSystem.prototype.ApplyForce=function(a,b,c){for(var d=0,e=a;e<b;e++)d|=this.m_flagsBuffer.data[e];b2.Assert(this.ForceCanBeApplied(d));c=c.Clone().SelfMul(1/(b-a));if(b2.ParticleSystem.IsSignificantForce(c))for(this.PrepareForceBuffer(),e=a;e<b;e++)this.m_forceBuffer[e].SelfAdd(c)};
goog.exportProperty(b2.ParticleSystem.prototype,"ApplyForce",b2.ParticleSystem.prototype.ApplyForce);b2.ParticleSystem.prototype.GetNext=function(){return this.m_next};goog.exportProperty(b2.ParticleSystem.prototype,"GetNext",b2.ParticleSystem.prototype.GetNext);
b2.ParticleSystem.prototype.QueryAABB=function(a,b){if(0!==this.m_proxyBuffer.count)for(var c=this.m_proxyBuffer.count,d=b2.std_lower_bound(this.m_proxyBuffer.data,0,c,b2.ParticleSystem.computeTag(this.m_inverseDiameter*b.lowerBound.x,this.m_inverseDiameter*b.lowerBound.y),b2.ParticleSystem.Proxy.CompareProxyTag),c=b2.std_upper_bound(this.m_proxyBuffer.data,d,c,b2.ParticleSystem.computeTag(this.m_inverseDiameter*b.upperBound.x,this.m_inverseDiameter*b.upperBound.y),b2.ParticleSystem.Proxy.CompareTagProxy),
e=this.m_positionBuffer.data;d<c;++d){var f=this.m_proxyBuffer.data[d].index,g=e[f];if(b.lowerBound.x<g.x&&g.x<b.upperBound.x&&b.lowerBound.y<g.y&&g.y<b.upperBound.y&&!a.ReportParticle(this,f))break}};goog.exportProperty(b2.ParticleSystem.prototype,"QueryAABB",b2.ParticleSystem.prototype.QueryAABB);b2.ParticleSystem.prototype.QueryShapeAABB=function(a,b,c,d){var e=b2.ParticleSystem.prototype.QueryShapeAABB.s_aabb;b.ComputeAABB(e,c,d||0);this.QueryAABB(a,e)};
goog.exportProperty(b2.ParticleSystem.prototype,"QueryShapeAABB",b2.ParticleSystem.prototype.QueryShapeAABB);b2.ParticleSystem.prototype.QueryShapeAABB.s_aabb=new b2.AABB;b2.ParticleSystem.prototype.QueryPointAABB=function(a,b,c){var d=b2.ParticleSystem.prototype.QueryPointAABB.s_aabb;c="number"===typeof c?c:b2._linearSlop;d.lowerBound.Set(b.x-c,b.y-c);d.upperBound.Set(b.x+c,b.y+c);this.QueryAABB(a,d)};
goog.exportProperty(b2.ParticleSystem.prototype,"QueryPointAABB",b2.ParticleSystem.prototype.QueryPointAABB);b2.ParticleSystem.prototype.QueryPointAABB.s_aabb=new b2.AABB;
b2.ParticleSystem.prototype.RayCast=function(a,b,c){var d=b2.ParticleSystem.prototype.RayCast.s_aabb,e=b2.ParticleSystem.prototype.RayCast.s_p,f=b2.ParticleSystem.prototype.RayCast.s_v,g=b2.ParticleSystem.prototype.RayCast.s_n,h=b2.ParticleSystem.prototype.RayCast.s_point;if(0!==this.m_proxyBuffer.count){var k=this.m_positionBuffer.data;b2.Min_V2_V2(b,c,d.lowerBound);b2.Max_V2_V2(b,c,d.upperBound);var l=1;c=b2.Sub_V2_V2(c,b,f);for(var f=b2.Dot_V2_V2(c,
c),d=this.GetInsideBoundsEnumerator(d),m;0<=(m=d.GetNext());){var n=b2.Sub_V2_V2(b,k[m],e),p=b2.Dot_V2_V2(n,c),q=b2.Dot_V2_V2(n,n),q=p*p-f*(q-this.m_squaredDiameter);if(0<=q){var r=b2.Sqrt(q),q=(-p-r)/f;if(!(q>l)){if(0>q&&(q=(-p+r)/f,0>q||q>l))continue;n=b2.AddMul_V2_S_V2(n,q,c,g);n.Normalize();m=a.ReportParticle(this,m,b2.AddMul_V2_S_V2(b,q,c,h),n,q);l=b2.Min(l,m);if(0>=l)break}}}}};goog.exportProperty(b2.ParticleSystem.prototype,"RayCast",b2.ParticleSystem.prototype.RayCast);
b2.ParticleSystem.prototype.RayCast.s_aabb=new b2.AABB;b2.ParticleSystem.prototype.RayCast.s_p=new b2.Vec2;b2.ParticleSystem.prototype.RayCast.s_v=new b2.Vec2;b2.ParticleSystem.prototype.RayCast.s_n=new b2.Vec2;b2.ParticleSystem.prototype.RayCast.s_point=new b2.Vec2;
b2.ParticleSystem.prototype.ComputeAABB=function(a){var b=this.GetParticleCount();b2.Assert(null!==a);a.lowerBound.x=+b2._maxFloat;a.lowerBound.y=+b2._maxFloat;a.upperBound.x=-b2._maxFloat;a.upperBound.y=-b2._maxFloat;for(var c=this.m_positionBuffer.data,d=0;d<b;d++){var e=c[d];b2.Min_V2_V2(a.lowerBound,e,a.lowerBound);b2.Max_V2_V2(a.upperBound,e,a.upperBound)}a.lowerBound.x-=this.m_particleDiameter;a.lowerBound.y-=this.m_particleDiameter;a.upperBound.x+=this.m_particleDiameter;
a.upperBound.y+=this.m_particleDiameter};goog.exportProperty(b2.ParticleSystem.prototype,"ComputeAABB",b2.ParticleSystem.prototype.ComputeAABB);b2.ParticleSystem.UserOverridableBuffer=function(){};b2.ParticleSystem.UserOverridableBuffer.prototype.data=null;b2.ParticleSystem.UserOverridableBuffer.prototype.userSuppliedCapacity=0;b2.ParticleSystem.Proxy=function(){};b2.ParticleSystem.Proxy.prototype.index=b2._invalidParticleIndex;
b2.ParticleSystem.Proxy.prototype.tag=0;b2.ParticleSystem.Proxy.CompareProxyProxy=function(a,b){return a.tag<b.tag};b2.ParticleSystem.Proxy.CompareTagProxy=function(a,b){return a<b.tag};b2.ParticleSystem.Proxy.CompareProxyTag=function(a,b){return a.tag<b};
b2.ParticleSystem.InsideBoundsEnumerator=function(a,b,c,d,e){this.m_system=a;this.m_xLower=(b&b2.ParticleSystem.xMask)>>>0;this.m_xUpper=(c&b2.ParticleSystem.xMask)>>>0;this.m_yLower=(b&b2.ParticleSystem.yMask)>>>0;this.m_yUpper=(c&b2.ParticleSystem.yMask)>>>0;this.m_first=d;this.m_last=e;b2.Assert(this.m_first<=this.m_last)};
b2.ParticleSystem.InsideBoundsEnumerator.prototype.GetNext=function(){for(;this.m_first<this.m_last;){var a=(this.m_system.m_proxyBuffer.data[this.m_first].tag&b2.ParticleSystem.xMask)>>>0,b=(this.m_system.m_proxyBuffer.data[this.m_first].tag&b2.ParticleSystem.yMask)>>>0;b2.Assert(b>=this.m_yLower);b2.Assert(b<=this.m_yUpper);if(a>=this.m_xLower&&a<=this.m_xUpper)return this.m_system.m_proxyBuffer.data[this.m_first++].index;this.m_first++}return b2._invalidParticleIndex};
b2.ParticleSystem.ParticleListNode=function(){};b2.ParticleSystem.ParticleListNode.prototype.list=null;b2.ParticleSystem.ParticleListNode.prototype.next=null;b2.ParticleSystem.ParticleListNode.prototype.count=0;b2.ParticleSystem.ParticleListNode.prototype.index=0;b2.ParticleSystem.k_pairFlags=b2.ParticleFlag.springParticle;b2.ParticleSystem.k_triadFlags=b2.ParticleFlag.elasticParticle;
b2.ParticleSystem.k_noPressureFlags=b2.ParticleFlag.powderParticle|b2.ParticleFlag.tensileParticle;b2.ParticleSystem.k_extraDampingFlags=b2.ParticleFlag.staticPressureParticle;b2.ParticleSystem.k_barrierWallFlags=b2.ParticleFlag.barrierParticle|b2.ParticleFlag.wallParticle;b2.ParticleSystem.prototype.FreeBuffer=function(a,b){null!==a&&(a.length=0)};
b2.ParticleSystem.prototype.FreeUserOverridableBuffer=function(a){0==a.userSuppliedCapacity&&this.FreeBuffer(a.data,this.m_internalAllocatedCapacity)};b2.ParticleSystem.prototype.ReallocateBuffer3=function(a,b,c){b2.Assert(c>b);a=a?a.slice():[];a.length=c;return a};b2.ParticleSystem.prototype.ReallocateBuffer5=function(a,b,c,d,e){b2.Assert(d>c);b2.Assert(!b||d<=b);e&&!a||b||(a=this.ReallocateBuffer3(a,c,d));return a};
b2.ParticleSystem.prototype.ReallocateBuffer4=function(a,b,c,d){b2.Assert(c>b);return this.ReallocateBuffer5(a.data,a.userSuppliedCapacity,b,c,d)};b2.ParticleSystem.prototype.RequestBuffer=function(a){a||(0===this.m_internalAllocatedCapacity&&this.ReallocateInternalAllocatedBuffers(b2._minParticleSystemBufferCapacity),a=[],a.length=this.m_internalAllocatedCapacity);return a};
b2.ParticleSystem.prototype.ReallocateHandleBuffers=function(a){b2.Assert(a>this.m_internalAllocatedCapacity);this.m_handleIndexBuffer.data=this.ReallocateBuffer4(this.m_handleIndexBuffer,this.m_internalAllocatedCapacity,a,!0)};
b2.ParticleSystem.prototype.ReallocateInternalAllocatedBuffers=function(a){function b(a,b){return b&&a>b?b:a}a=b(a,this.m_def.maxCount);a=b(a,this.m_flagsBuffer.userSuppliedCapacity);a=b(a,this.m_positionBuffer.userSuppliedCapacity);a=b(a,this.m_velocityBuffer.userSuppliedCapacity);a=b(a,this.m_colorBuffer.userSuppliedCapacity);a=b(a,this.m_userDataBuffer.userSuppliedCapacity);if(this.m_internalAllocatedCapacity<a){this.ReallocateHandleBuffers(a);this.m_flagsBuffer.data=this.ReallocateBuffer4(this.m_flagsBuffer,
this.m_internalAllocatedCapacity,a,!1);var c=0<this.m_stuckThreshold;this.m_lastBodyContactStepBuffer.data=this.ReallocateBuffer4(this.m_lastBodyContactStepBuffer,this.m_internalAllocatedCapacity,a,c);this.m_bodyContactCountBuffer.data=this.ReallocateBuffer4(this.m_bodyContactCountBuffer,this.m_internalAllocatedCapacity,a,c);this.m_consecutiveContactStepsBuffer.data=this.ReallocateBuffer4(this.m_consecutiveContactStepsBuffer,this.m_internalAllocatedCapacity,a,c);this.m_positionBuffer.data=this.ReallocateBuffer4(this.m_positionBuffer,
this.m_internalAllocatedCapacity,a,!1);this.m_velocityBuffer.data=this.ReallocateBuffer4(this.m_velocityBuffer,this.m_internalAllocatedCapacity,a,!1);this.m_forceBuffer=this.ReallocateBuffer5(this.m_forceBuffer,0,this.m_internalAllocatedCapacity,a,!1);this.m_weightBuffer=this.ReallocateBuffer5(this.m_weightBuffer,0,this.m_internalAllocatedCapacity,a,!1);this.m_staticPressureBuffer=this.ReallocateBuffer5(this.m_staticPressureBuffer,0,this.m_internalAllocatedCapacity,a,!0);this.m_accumulationBuffer=
this.ReallocateBuffer5(this.m_accumulationBuffer,0,this.m_internalAllocatedCapacity,a,!1);this.m_accumulation2Buffer=this.ReallocateBuffer5(this.m_accumulation2Buffer,0,this.m_internalAllocatedCapacity,a,!0);this.m_depthBuffer=this.ReallocateBuffer5(this.m_depthBuffer,0,this.m_internalAllocatedCapacity,a,!0);this.m_colorBuffer.data=this.ReallocateBuffer4(this.m_colorBuffer,this.m_internalAllocatedCapacity,a,!0);this.m_groupBuffer=this.ReallocateBuffer5(this.m_groupBuffer,0,this.m_internalAllocatedCapacity,
a,!1);this.m_userDataBuffer.data=this.ReallocateBuffer4(this.m_userDataBuffer,this.m_internalAllocatedCapacity,a,!0);this.m_expirationTimeBuffer.data=this.ReallocateBuffer4(this.m_expirationTimeBuffer,this.m_internalAllocatedCapacity,a,!0);this.m_indexByExpirationTimeBuffer.data=this.ReallocateBuffer4(this.m_indexByExpirationTimeBuffer,this.m_internalAllocatedCapacity,a,!1);this.m_internalAllocatedCapacity=a}};
b2.ParticleSystem.prototype.CreateParticleForGroup=function(a,b,c){var d=new b2.ParticleDef;d.flags=a.flags;b2.Mul_X_V2(b,c,d.position);b2.Add_V2_V2(a.linearVelocity,b2.Cross_S_V2(a.angularVelocity,b2.Sub_V2_V2(d.position,a.position,b2.Vec2.s_t0),b2.Vec2.s_t0),d.velocity);d.color.Copy(a.color);d.lifetime=a.lifetime;d.userData=a.userData;this.CreateParticle(d)};goog.exportProperty(b2.ParticleSystem.prototype,"CreateParticleForGroup",b2.ParticleSystem.prototype.CreateParticleForGroup);
b2.ParticleSystem.prototype.CreateParticlesStrokeShapeForGroup=function(a,b,c){var d=b2.ParticleSystem.prototype.CreateParticlesStrokeShapeForGroup.s_edge,e=b2.ParticleSystem.prototype.CreateParticlesStrokeShapeForGroup.s_d,f=b2.ParticleSystem.prototype.CreateParticlesStrokeShapeForGroup.s_p,g=b.stride;0===g&&(g=this.GetParticleStride());for(var h=0,k=a.GetChildCount(),l=0;l<k;l++){var m=null;a.GetType()===b2.ShapeType.e_edgeShape?m=a:(b2.Assert(a.GetType()===b2.ShapeType.e_chainShape),
m=d,a.GetChildEdge(m,l));for(var n=b2.Sub_V2_V2(m.m_vertex2,m.m_vertex1,e),p=n.Length();h<p;){var q=b2.AddMul_V2_S_V2(m.m_vertex1,h/p,n,f);this.CreateParticleForGroup(b,c,q);h+=g}h-=p}};goog.exportProperty(b2.ParticleSystem.prototype,"CreateParticlesStrokeShapeForGroup",b2.ParticleSystem.prototype.CreateParticlesStrokeShapeForGroup);b2.ParticleSystem.prototype.CreateParticlesStrokeShapeForGroup.s_edge=new b2.EdgeShape;
b2.ParticleSystem.prototype.CreateParticlesStrokeShapeForGroup.s_d=new b2.Vec2;b2.ParticleSystem.prototype.CreateParticlesStrokeShapeForGroup.s_p=new b2.Vec2;
b2.ParticleSystem.prototype.CreateParticlesFillShapeForGroup=function(a,b,c){var d=b2.ParticleSystem.prototype.CreateParticlesFillShapeForGroup.s_aabb,e=b2.ParticleSystem.prototype.CreateParticlesFillShapeForGroup.s_p,f=b.stride;0===f&&(f=this.GetParticleStride());var g=b2.Transform.IDENTITY;b2.Assert(1===a.GetChildCount());a.ComputeAABB(d,g,0);for(var h=Math.floor(d.lowerBound.y/f)*f;h<d.upperBound.y;h+=f)for(var k=Math.floor(d.lowerBound.x/f)*f;k<d.upperBound.x;k+=f){var l=
e.Set(k,h);a.TestPoint(g,l)&&this.CreateParticleForGroup(b,c,l)}};goog.exportProperty(b2.ParticleSystem.prototype,"CreateParticlesFillShapeForGroup",b2.ParticleSystem.prototype.CreateParticlesFillShapeForGroup);b2.ParticleSystem.prototype.CreateParticlesFillShapeForGroup.s_aabb=new b2.AABB;b2.ParticleSystem.prototype.CreateParticlesFillShapeForGroup.s_p=new b2.Vec2;
b2.ParticleSystem.prototype.CreateParticlesWithShapeForGroup=function(a,b,c){switch(a.GetType()){case b2.ShapeType.e_edgeShape:case b2.ShapeType.e_chainShape:this.CreateParticlesStrokeShapeForGroup(a,b,c);break;case b2.ShapeType.e_polygonShape:case b2.ShapeType.e_circleShape:this.CreateParticlesFillShapeForGroup(a,b,c);break;default:b2.Assert(!1)}};goog.exportProperty(b2.ParticleSystem.prototype,"CreateParticlesWithShapeForGroup",b2.ParticleSystem.prototype.CreateParticlesWithShapeForGroup);
b2.ParticleSystem.CompositeShape=function(a,b){this.m_shapes=a;this.m_shapeCount=b};goog.inherits(b2.ParticleSystem.CompositeShape,b2.Shape);b2.ParticleSystem.CompositeShape.prototype.m_shapes=null;b2.ParticleSystem.CompositeShape.prototype.m_shapeCount=0;b2.ParticleSystem.CompositeShape.prototype.Clone=function(){b2.Assert(!1);return null};b2.ParticleSystem.CompositeShape.prototype.GetChildCount=function(){return 1};
b2.ParticleSystem.CompositeShape.prototype.TestPoint=function(a,b){for(var c=0;c<this.m_shapeCount;c++)if(this.m_shapes[c].TestPoint(a,b))return!0;return!1};goog.exportProperty(b2.ParticleSystem.CompositeShape.prototype,"TestPoint",b2.ParticleSystem.CompositeShape.prototype.TestPoint);b2.ParticleSystem.CompositeShape.prototype.ComputeDistance=function(a,b,c,d){b2.Assert(!1)};goog.exportProperty(b2.ParticleSystem.CompositeShape.prototype,"ComputeDistance",b2.ParticleSystem.CompositeShape.prototype.ComputeDistance);
b2.ParticleSystem.CompositeShape.prototype.RayCast=function(a,b,c,d){b2.Assert(!1);return!1};goog.exportProperty(b2.ParticleSystem.CompositeShape.prototype,"RayCast",b2.ParticleSystem.CompositeShape.prototype.RayCast);
b2.ParticleSystem.CompositeShape.prototype.ComputeAABB=function(a,b,c){var d=new b2.AABB;a.lowerBound.x=+b2._maxFloat;a.lowerBound.y=+b2._maxFloat;a.upperBound.x=-b2._maxFloat;a.upperBound.y=-b2._maxFloat;b2.Assert(0===c);for(c=0;c<this.m_shapeCount;c++)for(var e=this.m_shapes[c].GetChildCount(),f=0;f<e;f++){var g=d;this.m_shapes[c].ComputeAABB(g,b,f);a.Combine1(g)}};goog.exportProperty(b2.ParticleSystem.CompositeShape.prototype,"ComputeAABB",b2.ParticleSystem.CompositeShape.prototype.ComputeAABB);
b2.ParticleSystem.CompositeShape.prototype.ComputeMass=function(a,b){b2.Assert(!1)};goog.exportProperty(b2.ParticleSystem.CompositeShape.prototype,"ComputeMass",b2.ParticleSystem.CompositeShape.prototype.ComputeMass);b2.ParticleSystem.prototype.CreateParticlesWithShapesForGroup=function(a,b,c,d){a=new b2.ParticleSystem.CompositeShape(a,b);this.CreateParticlesFillShapeForGroup(a,c,d)};
goog.exportProperty(b2.ParticleSystem.prototype,"CreateParticlesWithShapesForGroup",b2.ParticleSystem.prototype.CreateParticlesWithShapesForGroup);
b2.ParticleSystem.prototype.CloneParticle=function(a,b){var c=new b2.ParticleDef;c.flags=this.m_flagsBuffer.data[a];c.position.Copy(this.m_positionBuffer.data[a]);c.velocity.Copy(this.m_velocityBuffer.data[a]);this.m_colorBuffer.data&&c.color.Copy(this.m_colorBuffer.data[a]);this.m_userDataBuffer.data&&(c.userData=this.m_userDataBuffer.data[a]);c.group=b;c=this.CreateParticle(c);if(this.m_handleIndexBuffer.data){var d=this.m_handleIndexBuffer.data[a];d&&d.SetIndex(c);this.m_handleIndexBuffer.data[c]=
d;this.m_handleIndexBuffer.data[a]=null}this.m_lastBodyContactStepBuffer.data&&(this.m_lastBodyContactStepBuffer.data[c]=this.m_lastBodyContactStepBuffer.data[a]);this.m_bodyContactCountBuffer.data&&(this.m_bodyContactCountBuffer.data[c]=this.m_bodyContactCountBuffer.data[a]);this.m_consecutiveContactStepsBuffer.data&&(this.m_consecutiveContactStepsBuffer.data[c]=this.m_consecutiveContactStepsBuffer.data[a]);this.m_hasForce&&this.m_forceBuffer[c].Copy(this.m_forceBuffer[a]);this.m_staticPressureBuffer&&
(this.m_staticPressureBuffer[c]=this.m_staticPressureBuffer[a]);this.m_depthBuffer&&(this.m_depthBuffer[c]=this.m_depthBuffer[a]);this.m_expirationTimeBuffer.data&&(this.m_expirationTimeBuffer.data[c]=this.m_expirationTimeBuffer.data[a]);return c};goog.exportProperty(b2.ParticleSystem.prototype,"CloneParticle",b2.ParticleSystem.prototype.CloneParticle);
b2.ParticleSystem.prototype.DestroyParticlesInGroup=function(a,b){for(var c=a.m_firstIndex;c<a.m_lastIndex;c++)this.DestroyParticle(c,b)};goog.exportProperty(b2.ParticleSystem.prototype,"DestroyParticlesInGroup",b2.ParticleSystem.prototype.DestroyParticlesInGroup);
b2.ParticleSystem.prototype.DestroyParticleGroup=function(a){b2.Assert(0<this.m_groupCount);b2.Assert(null!==a);this.m_world.m_destructionListener&&this.m_world.m_destructionListener.SayGoodbyeParticleGroup(a);this.SetGroupFlags(a,0);for(var b=a.m_firstIndex;b<a.m_lastIndex;b++)this.m_groupBuffer[b]=null;a.m_prev&&(a.m_prev.m_next=a.m_next);a.m_next&&(a.m_next.m_prev=a.m_prev);a===this.m_groupList&&(this.m_groupList=a.m_next);--this.m_groupCount};
goog.exportProperty(b2.ParticleSystem.prototype,"DestroyParticleGroup",b2.ParticleSystem.prototype.DestroyParticleGroup);b2.ParticleSystem.ParticleCanBeConnected=function(a,b){return 0!==(a&(b2.ParticleFlag.wallParticle|b2.ParticleFlag.springParticle|b2.ParticleFlag.elasticParticle))||null!==b&&0!==(b.GetGroupFlags()&b2.ParticleGroupFlag.rigidParticleGroup)};
b2.ParticleSystem.prototype.UpdatePairsAndTriads=function(a,b,c){var d=b2.ParticleSystem.prototype.UpdatePairsAndTriads.s_dab,e=b2.ParticleSystem.prototype.UpdatePairsAndTriads.s_dbc,f=b2.ParticleSystem.prototype.UpdatePairsAndTriads.s_dca,g=this.m_positionBuffer.data;b2.Assert(a<=b);for(var h=0,k=a;k<b;k++)h|=this.m_flagsBuffer.data[k];if(h&b2.ParticleSystem.k_pairFlags)for(k=0;k<this.m_contactBuffer.count;k++){var l=this.m_contactBuffer.data[k],m=l.indexA,n=l.indexB,
p=this.m_flagsBuffer.data[m],q=this.m_flagsBuffer.data[n],r=this.m_groupBuffer[m],u=this.m_groupBuffer[n];m>=a&&m<b&&n>=a&&n<b&&!((p|q)&b2.ParticleFlag.zombieParticle)&&(p|q)&b2.ParticleSystem.k_pairFlags&&(c.IsNecessary(m)||c.IsNecessary(n))&&b2.ParticleSystem.ParticleCanBeConnected(p,r)&&b2.ParticleSystem.ParticleCanBeConnected(q,u)&&c.ShouldCreatePair(m,n)&&(p=this.m_pairBuffer.data[this.m_pairBuffer.Append()],p.indexA=m,p.indexB=n,p.flags=l.flags,p.strength=b2.Min(r?
r.m_strength:1,u?u.m_strength:1),p.distance=b2.Distance(g[m],g[n]));b2.std_stable_sort(this.m_pairBuffer.data,0,this.m_pairBuffer.count,b2.ParticleSystem.ComparePairIndices);this.m_pairBuffer.Unique(b2.ParticleSystem.MatchPairIndices)}if(h&b2.ParticleSystem.k_triadFlags){h=new b2.VoronoiDiagram(b-a);l=0;for(k=a;k<b;k++)m=this.m_flagsBuffer.data[k],n=this.m_groupBuffer[k],m&b2.ParticleFlag.zombieParticle||!b2.ParticleSystem.ParticleCanBeConnected(m,n)||(c.IsNecessary(k)&&
++l,h.AddGenerator(g[k],k,c.IsNecessary(k)));if(0===l)for(k=a;k<b;k++)c.IsNecessary(k);a=this.GetParticleStride();h.Generate(a/2,2*a);var t=this;h.GetNodes(function(a,b,h){var k=t.m_flagsBuffer.data[a],l=t.m_flagsBuffer.data[b],m=t.m_flagsBuffer.data[h];if((k|l|m)&b2.ParticleSystem.k_triadFlags&&c.ShouldCreateTriad(a,b,h)){var n=g[a],p=g[b],q=g[h],r=b2.Sub_V2_V2(n,p,d),u=b2.Sub_V2_V2(p,q,e),C=b2.Sub_V2_V2(q,n,f),A=b2._maxTriadDistanceSquared*t.m_squaredDiameter;if(!(b2.Dot_V2_V2(r,
r)>A||b2.Dot_V2_V2(u,u)>A||b2.Dot_V2_V2(C,C)>A)){var K=t.m_groupBuffer[a],J=t.m_groupBuffer[b],D=t.m_groupBuffer[h],A=t.m_triadBuffer.data[t.m_triadBuffer.Append()];A.indexA=a;A.indexB=b;A.indexC=h;A.flags=k|l|m;A.strength=b2.Min(b2.Min(K?K.m_strength:1,J?J.m_strength:1),D?D.m_strength:1);a=(n.x+p.x+q.x)/3;b=(n.y+p.y+q.y)/3;A.pa.x=n.x-a;A.pa.y=n.y-b;A.pb.x=p.x-a;A.pb.y=p.y-b;A.pc.x=q.x-a;A.pc.y=q.y-b;A.ka=-b2.Dot_V2_V2(C,r);A.kb=-b2.Dot_V2_V2(r,u);A.kc=-b2.Dot_V2_V2(u,
C);A.s=b2.Cross_V2_V2(n,p)+b2.Cross_V2_V2(p,q)+b2.Cross_V2_V2(q,n)}}});b2.std_stable_sort(this.m_triadBuffer.data,0,this.m_triadBuffer.count,b2.ParticleSystem.CompareTriadIndices);this.m_triadBuffer.Unique(b2.ParticleSystem.MatchTriadIndices)}};b2.ParticleSystem.prototype.UpdatePairsAndTriads.s_dab=new b2.Vec2;b2.ParticleSystem.prototype.UpdatePairsAndTriads.s_dbc=new b2.Vec2;b2.ParticleSystem.prototype.UpdatePairsAndTriads.s_dca=new b2.Vec2;
b2.ParticleSystem.ReactiveFilter=function(a){this.m_flagsBuffer=a};goog.inherits(b2.ParticleSystem.ReactiveFilter,b2.ParticleSystem.ConnectionFilter);b2.ParticleSystem.ReactiveFilter.prototype.m_flagsBuffer=null;b2.ParticleSystem.ReactiveFilter.prototype.IsNecessary=function(a){return 0!==(this.m_flagsBuffer[a]&b2.ParticleFlag.reactiveParticle)};
b2.ParticleSystem.prototype.UpdatePairsAndTriadsWithReactiveParticles=function(){var a=new b2.ParticleSystem.ReactiveFilter(this.m_flagsBuffer);this.UpdatePairsAndTriads(0,this.m_count,a);for(a=0;a<this.m_count;a++)this.m_flagsBuffer.data[a]&=~b2.ParticleFlag.reactiveParticle;this.m_allParticleFlags&=~b2.ParticleFlag.reactiveParticle};b2.ParticleSystem.ComparePairIndices=function(a,b){var c=a.indexA-b.indexA;return 0!==c?0>c:a.indexB<b.indexB};
b2.ParticleSystem.MatchPairIndices=function(a,b){return a.indexA===b.indexA&&a.indexB===b.indexB};b2.ParticleSystem.CompareTriadIndices=function(a,b){var c=a.indexA-b.indexA;if(0!==c)return 0>c;c=a.indexB-b.indexB;return 0!==c?0>c:a.indexC<b.indexC};b2.ParticleSystem.MatchTriadIndices=function(a,b){return a.indexA===b.indexA&&a.indexB===b.indexB&&a.indexC===b.indexC};
b2.ParticleSystem.InitializeParticleLists=function(a,b){for(var c=a.GetBufferIndex(),d=a.GetParticleCount(),e=0;e<d;e++){var f=b[e];f.list=f;f.next=null;f.count=1;f.index=e+c}};
b2.ParticleSystem.prototype.MergeParticleListsInContact=function(a,b){for(var c=a.GetBufferIndex(),d=0;d<this.m_contactBuffer.count;d++){var e=this.m_contactBuffer.data[d],f=e.indexA,e=e.indexB;if(a.ContainsParticle(f)&&a.ContainsParticle(e)&&(f=b[f-c].list,e=b[e-c].list,f!==e)){if(f.count<e.count)var g=f,f=e,e=g;b2.Assert(f.count>=e.count);b2.ParticleSystem.MergeParticleLists(f,e)}}};
b2.ParticleSystem.MergeParticleLists=function(a,b){b2.Assert(a!==b);for(var c=b;;){c.list=a;var d=c.next;if(d)c=d;else{c.next=a.next;break}}a.next=b;a.count+=b.count;b.count=0};b2.ParticleSystem.FindLongestParticleList=function(a,b){for(var c=a.GetParticleCount(),d=b[0],e=0;e<c;e++){var f=b[e];d.count<f.count&&(d=f)}return d};
b2.ParticleSystem.prototype.MergeZombieParticleListNodes=function(a,b,c){a=a.GetParticleCount();for(var d=0;d<a;d++){var e=b[d];e!==c&&this.m_flagsBuffer.data[e.index]&b2.ParticleFlag.zombieParticle&&b2.ParticleSystem.MergeParticleListAndNode(c,e)}};b2.ParticleSystem.MergeParticleListAndNode=function(a,b){b2.Assert(b!==a);b2.Assert(b.list===b);b2.Assert(1===b.count);b.list=a;b.next=a.next;a.next=b;a.count++;b.count=0};
b2.ParticleSystem.prototype.CreateParticleGroupsFromParticleList=function(a,b,c){var d=a.GetParticleCount(),e=new b2.ParticleGroupDef;e.groupFlags=a.GetGroupFlags();e.userData=a.GetUserData();for(a=0;a<d;a++){var f=b[a];if(f.count&&f!==c){b2.Assert(f.list===f);for(var g=this.CreateParticleGroup(e);f;f=f.next){var h=f.index;b2.Assert(!(this.m_flagsBuffer.data[h]&b2.ParticleFlag.zombieParticle));var k=this.CloneParticle(h,g);this.m_flagsBuffer.data[h]|=b2.ParticleFlag.zombieParticle;
f.index=k}}}};
b2.ParticleSystem.prototype.UpdatePairsAndTriadsWithParticleList=function(a,b){for(var c=a.GetBufferIndex(),d=0;d<this.m_pairBuffer.count;d++){var e=this.m_pairBuffer.data[d],f=e.indexA,g=e.indexB;a.ContainsParticle(f)&&(e.indexA=b[f-c].index);a.ContainsParticle(g)&&(e.indexB=b[g-c].index)}for(d=0;d<this.m_triadBuffer.count;d++){var e=this.m_triadBuffer.data[d],f=e.indexA,g=e.indexB,h=e.indexC;a.ContainsParticle(f)&&(e.indexA=b[f-c].index);a.ContainsParticle(g)&&(e.indexB=b[g-c].index);a.ContainsParticle(h)&&
(e.indexC=b[h-c].index)}};
b2.ParticleSystem.prototype.ComputeDepth=function(){for(var a=[],b=0,c=0;c<this.m_contactBuffer.count;c++){var d=this.m_contactBuffer.data[c],e=d.indexA,f=d.indexB,g=this.m_groupBuffer[e],h=this.m_groupBuffer[f];g&&g===h&&g.m_groupFlags&b2.ParticleGroupFlag.particleGroupNeedsUpdateDepth&&(a[b++]=d)}g=[];h=0;for(c=this.m_groupList;c;c=c.GetNext())if(c.m_groupFlags&b2.ParticleGroupFlag.particleGroupNeedsUpdateDepth)for(g[h++]=c,this.SetGroupFlags(c,c.m_groupFlags&~b2.ParticleGroupFlag.particleGroupNeedsUpdateDepth),
f=c.m_firstIndex;f<c.m_lastIndex;f++)this.m_accumulationBuffer[f]=0;for(c=0;c<b;c++){var d=a[c],e=d.indexA,f=d.indexB,k=d.weight;this.m_accumulationBuffer[e]+=k;this.m_accumulationBuffer[f]+=k}b2.Assert(null!==this.m_depthBuffer);for(f=0;f<h;f++)for(c=g[f],f=c.m_firstIndex;f<c.m_lastIndex;f++)k=this.m_accumulationBuffer[f],this.m_depthBuffer[f]=.8>k?0:b2._maxFloat;for(var k=b2.Sqrt(this.m_count)>>0,l=0;l<k;l++){for(var m=!1,c=0;c<b;c++){var d=a[c],e=d.indexA,f=d.indexB,n=1-d.weight,
d=this.m_depthBuffer[e],p=this.m_depthBuffer[f],q=p+n,n=d+n;d>q&&(this.m_depthBuffer[e]=q,m=!0);p>n&&(this.m_depthBuffer[f]=n,m=!0)}if(!m)break}for(f=0;f<h;f++)for(c=g[f],f=c.m_firstIndex;f<c.m_lastIndex;f++)this.m_depthBuffer[f]=this.m_depthBuffer[f]<b2._maxFloat?this.m_depthBuffer[f]*this.m_particleDiameter:0};
b2.ParticleSystem.prototype.GetInsideBoundsEnumerator=function(a){var b=b2.ParticleSystem.computeTag(this.m_inverseDiameter*a.lowerBound.x-1,this.m_inverseDiameter*a.lowerBound.y-1);a=b2.ParticleSystem.computeTag(this.m_inverseDiameter*a.upperBound.x+1,this.m_inverseDiameter*a.upperBound.y+1);var c=this.m_proxyBuffer.count,d=b2.std_lower_bound(this.m_proxyBuffer.data,0,c,b,b2.ParticleSystem.Proxy.CompareProxyTag),e=b2.std_upper_bound(this.m_proxyBuffer.data,0,c,a,b2.ParticleSystem.Proxy.CompareTagProxy);
b2.Assert(0<=d);b2.Assert(d<=e);b2.Assert(e<=c);return new b2.ParticleSystem.InsideBoundsEnumerator(this,b,a,d,e)};b2.ParticleSystem.prototype.UpdateAllParticleFlags=function(){for(var a=this.m_allParticleFlags=0;a<this.m_count;a++)this.m_allParticleFlags|=this.m_flagsBuffer.data[a];this.m_needsUpdateAllParticleFlags=!1};
b2.ParticleSystem.prototype.UpdateAllGroupFlags=function(){this.m_allGroupFlags=0;for(var a=this.m_groupList;a;a=a.GetNext())this.m_allGroupFlags|=a.m_groupFlags;this.m_needsUpdateAllGroupFlags=!1};
b2.ParticleSystem.prototype.AddContact=function(a,b,c){var d=b2.ParticleSystem.prototype.AddContact.s_d,e=this.m_positionBuffer.data;b2.Assert(c===this.m_contactBuffer);c=b2.Sub_V2_V2(e[b],e[a],d);d=b2.Dot_V2_V2(c,c);if(d<this.m_squaredDiameter){e=b2.InvSqrt(d);isFinite(e)||(e=1.9817753699999998E19);var f=this.m_contactBuffer.data[this.m_contactBuffer.Append()];f.indexA=a;f.indexB=b;f.flags=this.m_flagsBuffer.data[a]|this.m_flagsBuffer.data[b];f.weight=1-d*e*this.m_inverseDiameter;
b2.Mul_S_V2(e,c,f.normal)}};b2.ParticleSystem.prototype.AddContact.s_d=new b2.Vec2;
b2.ParticleSystem.prototype.FindContacts_Reference=function(a){b2.Assert(a===this.m_contactBuffer);a=this.m_proxyBuffer.count;for(var b=this.m_contactBuffer.count=0,c=0;b<a;b++){for(var d=b2.ParticleSystem.computeRelativeTag(this.m_proxyBuffer.data[b].tag,1,0),e=b+1;e<a&&!(d<this.m_proxyBuffer.data[e].tag);e++)this.AddContact(this.m_proxyBuffer.data[b].index,this.m_proxyBuffer.data[e].index,this.m_contactBuffer);for(e=b2.ParticleSystem.computeRelativeTag(this.m_proxyBuffer.data[b].tag,
-1,1);c<a&&!(e<=this.m_proxyBuffer.data[c].tag);c++);d=b2.ParticleSystem.computeRelativeTag(this.m_proxyBuffer.data[b].tag,1,1);for(e=c;e<a&&!(d<this.m_proxyBuffer.data[e].tag);e++)this.AddContact(this.m_proxyBuffer.data[b].index,this.m_proxyBuffer.data[e].index,this.m_contactBuffer)}};b2.ParticleSystem.prototype.FindContacts=function(a){this.FindContacts_Reference(a)};
b2.ParticleSystem.prototype.UpdateProxies_Reference=function(a){b2.Assert(a===this.m_proxyBuffer);a=this.m_positionBuffer.data;for(var b=this.m_inverseDiameter,c=0;c<this.m_proxyBuffer.count;++c){var d=this.m_proxyBuffer.data[c],e=a[d.index];d.tag=b2.ParticleSystem.computeTag(b*e.x,b*e.y)}};b2.ParticleSystem.prototype.UpdateProxies=function(a){this.UpdateProxies_Reference(a)};
b2.ParticleSystem.prototype.SortProxies=function(a){b2.Assert(a===this.m_proxyBuffer);b2.std_sort(this.m_proxyBuffer.data,0,this.m_proxyBuffer.count,b2.ParticleSystem.Proxy.CompareProxyProxy)};
b2.ParticleSystem.prototype.FilterContacts=function(a){var b=this.GetParticleContactFilter();if(null!==b){b2.Assert(a===this.m_contactBuffer);var c=this;this.m_contactBuffer.RemoveIf(function(a){return a.flags&b2.ParticleFlag.particleContactFilterParticle&&!b.ShouldCollideParticleParticle(c,a.indexA,a.indexB)})}};b2.ParticleSystem.prototype.NotifyContactListenerPreContact=function(a){if(null!==this.GetParticleContactListener()){debugger;a.Initialize(this.m_contactBuffer,this.m_flagsBuffer)}};
b2.ParticleSystem.prototype.NotifyContactListenerPostContact=function(a){a=this.GetParticleContactListener();if(null!==a){debugger;for(var b=0;b<this.m_contactBuffer.count;++b)a.BeginContactParticleParticle(this,this.m_contactBuffer.data[b])}};b2.ParticleSystem.b2ParticleContactIsZombie=function(a){return(a.flags&b2.ParticleFlag.zombieParticle)===b2.ParticleFlag.zombieParticle};
b2.ParticleSystem.prototype.UpdateContacts=function(a){this.UpdateProxies(this.m_proxyBuffer);this.SortProxies(this.m_proxyBuffer);var b=new b2.ParticleSystem.b2ParticlePairSet;this.NotifyContactListenerPreContact(b);this.FindContacts(this.m_contactBuffer);this.FilterContacts(this.m_contactBuffer);this.NotifyContactListenerPostContact(b);a&&this.m_contactBuffer.RemoveIf(b2.ParticleSystem.b2ParticleContactIsZombie)};
b2.ParticleSystem.prototype.NotifyBodyContactListenerPreContact=function(a){if(null!==this.GetFixtureContactListener()){debugger;a.Initialize(this.m_bodyContactBuffer,this.m_flagsBuffer)}};b2.ParticleSystem.prototype.NotifyBodyContactListenerPostContact=function(a){a=this.GetFixtureContactListener();if(null!==a){debugger;for(var b=0;b<this.m_bodyContactBuffer.count;b++){var c=this.m_bodyContactBuffer.data[b];b2.Assert(null!==c);a.BeginContactFixtureParticle(this,c)}}};
b2.ParticleSystem.UpdateBodyContactsCallback=function(a,b){b2.FixtureParticleQueryCallback.call(this,a);this.m_contactFilter=b};goog.inherits(b2.ParticleSystem.UpdateBodyContactsCallback,b2.FixtureParticleQueryCallback);
b2.ParticleSystem.UpdateBodyContactsCallback.prototype.ShouldCollideFixtureParticle=function(a,b,c){return this.m_contactFilter&&this.m_system.GetFlagsBuffer()[c]&b2.ParticleFlag.fixtureContactFilterParticle?this.m_contactFilter.ShouldCollideFixtureParticle(a,this.m_system,c):!0};goog.exportProperty(b2.ParticleSystem.UpdateBodyContactsCallback.prototype,"ShouldCollideFixtureParticle",b2.ParticleSystem.UpdateBodyContactsCallback.prototype.ShouldCollideFixtureParticle);
b2.ParticleSystem.UpdateBodyContactsCallback.prototype.ReportFixtureAndParticle=function(a,b,c){var d=b2.ParticleSystem.UpdateBodyContactsCallback.prototype.ReportFixtureAndParticle.s_rp,e=this.m_system.m_positionBuffer.data[c],f=b2.ParticleSystem.UpdateBodyContactsCallback.prototype.ReportFixtureAndParticle.s_n;b=a.ComputeDistance(e,f,b);if(b<this.m_system.m_particleDiameter&&this.ShouldCollideFixtureParticle(a,this.m_system,c)){var g=a.GetBody(),h=g.GetWorldCenter(),k=g.GetMass(),
l=g.GetInertia()-k*g.GetLocalCenter().LengthSquared(),k=0<k?1/k:0,l=0<l?1/l:0,m=this.m_system.m_flagsBuffer.data[c]&b2.ParticleFlag.wallParticle?0:this.m_system.GetParticleInvMass(),d=b2.Sub_V2_V2(e,h,d),d=b2.Cross_V2_V2(d,f),d=m+k+l*d*d,e=this.m_system.m_bodyContactBuffer.data[this.m_system.m_bodyContactBuffer.Append()];e.index=c;e.body=g;e.fixture=a;e.weight=1-b*this.m_system.m_inverseDiameter;e.normal.Copy(f.SelfNeg());e.mass=0<d?1/d:0;this.m_system.DetectStuckParticle(c)}};
goog.exportProperty(b2.ParticleSystem.UpdateBodyContactsCallback.prototype,"ReportFixtureAndParticle",b2.ParticleSystem.UpdateBodyContactsCallback.prototype.ReportFixtureAndParticle);b2.ParticleSystem.UpdateBodyContactsCallback.prototype.ReportFixtureAndParticle.s_n=new b2.Vec2;b2.ParticleSystem.UpdateBodyContactsCallback.prototype.ReportFixtureAndParticle.s_rp=new b2.Vec2;
b2.ParticleSystem.prototype.UpdateBodyContacts=function(){var a=b2.ParticleSystem.prototype.UpdateBodyContacts.s_aabb,b=new b2.ParticleSystem.FixtureParticleSet;this.NotifyBodyContactListenerPreContact(b);if(0<this.m_stuckThreshold)for(var c=this.GetParticleCount(),d=0;d<c;d++)this.m_bodyContactCountBuffer.data[d]=0,this.m_timestamp>this.m_lastBodyContactStepBuffer.data[d]+1&&(this.m_consecutiveContactStepsBuffer.data[d]=0);this.m_bodyContactBuffer.SetCount(0);this.m_stuckParticleBuffer.SetCount(0);
this.ComputeAABB(a);c=new b2.ParticleSystem.UpdateBodyContactsCallback(this,this.GetFixtureContactFilter());this.m_world.QueryAABB(c,a);this.m_def.strictContactCheck&&this.RemoveSpuriousBodyContacts();this.NotifyBodyContactListenerPostContact(b)};b2.ParticleSystem.prototype.UpdateBodyContacts.s_aabb=new b2.AABB;
b2.ParticleSystem.prototype.Solve=function(a){var b=b2.ParticleSystem.prototype.Solve.s_subStep;if(0!==this.m_count&&(this.m_expirationTimeBuffer.data&&this.SolveLifetimes(a),this.m_allParticleFlags&b2.ParticleFlag.zombieParticle&&this.SolveZombie(),this.m_needsUpdateAllParticleFlags&&this.UpdateAllParticleFlags(),this.m_needsUpdateAllGroupFlags&&this.UpdateAllGroupFlags(),!this.m_paused))for(this.m_iterationIndex=0;this.m_iterationIndex<a.particleIterations;this.m_iterationIndex++){++this.m_timestamp;
var c=b.Copy(a);c.dt/=a.particleIterations;c.inv_dt*=a.particleIterations;this.UpdateContacts(!1);this.UpdateBodyContacts();this.ComputeWeight();this.m_allGroupFlags&b2.ParticleGroupFlag.particleGroupNeedsUpdateDepth&&this.ComputeDepth();this.m_allParticleFlags&b2.ParticleFlag.reactiveParticle&&this.UpdatePairsAndTriadsWithReactiveParticles();this.m_hasForce&&this.SolveForce(c);this.m_allParticleFlags&b2.ParticleFlag.viscousParticle&&this.SolveViscous();this.m_allParticleFlags&
b2.ParticleFlag.repulsiveParticle&&this.SolveRepulsive(c);this.m_allParticleFlags&b2.ParticleFlag.powderParticle&&this.SolvePowder(c);this.m_allParticleFlags&b2.ParticleFlag.tensileParticle&&this.SolveTensile(c);this.m_allGroupFlags&b2.ParticleGroupFlag.solidParticleGroup&&this.SolveSolid(c);this.m_allParticleFlags&b2.ParticleFlag.colorMixingParticle&&this.SolveColorMixing();this.SolveGravity(c);this.m_allParticleFlags&b2.ParticleFlag.staticPressureParticle&&
this.SolveStaticPressure(c);this.SolvePressure(c);this.SolveDamping(c);this.m_allParticleFlags&b2.ParticleSystem.k_extraDampingFlags&&this.SolveExtraDamping();this.m_allParticleFlags&b2.ParticleFlag.elasticParticle&&this.SolveElastic(c);this.m_allParticleFlags&b2.ParticleFlag.springParticle&&this.SolveSpring(c);this.LimitVelocity(c);this.m_allGroupFlags&b2.ParticleGroupFlag.rigidParticleGroup&&this.SolveRigidDamping();this.m_allParticleFlags&b2.ParticleFlag.barrierParticle&&
this.SolveBarrier(c);this.SolveCollision(c);this.m_allGroupFlags&b2.ParticleGroupFlag.rigidParticleGroup&&this.SolveRigid(c);this.m_allParticleFlags&b2.ParticleFlag.wallParticle&&this.SolveWall();for(var d=0;d<this.m_count;d++)this.m_positionBuffer.data[d].SelfMulAdd(c.dt,this.m_velocityBuffer.data[d])}};goog.exportProperty(b2.ParticleSystem.prototype,"Solve",b2.ParticleSystem.prototype.Solve);b2.ParticleSystem.prototype.Solve.s_subStep=new b2.TimeStep;
b2.ParticleSystem.SolveCollisionCallback=function(a,b){b2.FixtureParticleQueryCallback.call(this,a);this.m_step=b};goog.inherits(b2.ParticleSystem.SolveCollisionCallback,b2.FixtureParticleQueryCallback);
b2.ParticleSystem.SolveCollisionCallback.prototype.ReportFixtureAndParticle=function(a,b,c){var d=b2.ParticleSystem.SolveCollisionCallback.prototype.ReportFixtureAndParticle.s_p1,e=b2.ParticleSystem.SolveCollisionCallback.prototype.ReportFixtureAndParticle.s_output,f=b2.ParticleSystem.SolveCollisionCallback.prototype.ReportFixtureAndParticle.s_input,g=b2.ParticleSystem.SolveCollisionCallback.prototype.ReportFixtureAndParticle.s_p,h=b2.ParticleSystem.SolveCollisionCallback.prototype.ReportFixtureAndParticle.s_v,
k=b2.ParticleSystem.SolveCollisionCallback.prototype.ReportFixtureAndParticle.s_f,l=a.GetBody(),m=this.m_system.m_positionBuffer.data[c],n=this.m_system.m_velocityBuffer.data[c];0===this.m_system.m_iterationIndex?(d=b2.MulT_X_V2(l.m_xf0,m,d),a.GetShape().GetType()===b2.ShapeType.e_circleShape&&(d.SelfSub(l.GetLocalCenter()),b2.Mul_R_V2(l.m_xf0.q,d,d),b2.MulT_R_V2(l.m_xf.q,d,d),d.SelfAdd(l.GetLocalCenter())),b2.Mul_X_V2(l.m_xf,d,f.p1)):f.p1.Copy(m);b2.AddMul_V2_S_V2(m,
this.m_step.dt,n,f.p2);f.maxFraction=1;a.RayCast(e,f,b)&&(a=e.normal,g.x=(1-e.fraction)*f.p1.x+e.fraction*f.p2.x+b2._linearSlop*a.x,g.y=(1-e.fraction)*f.p1.y+e.fraction*f.p2.y+b2._linearSlop*a.y,h.x=this.m_step.inv_dt*(g.x-m.x),h.y=this.m_step.inv_dt*(g.y-m.y),this.m_system.m_velocityBuffer.data[c].Copy(h),k.x=this.m_step.inv_dt*this.m_system.GetParticleMass()*(n.x-h.x),k.y=this.m_step.inv_dt*this.m_system.GetParticleMass()*(n.y-h.y),this.m_system.ParticleApplyForce(c,k))};
goog.exportProperty(b2.ParticleSystem.SolveCollisionCallback.prototype,"ReportFixtureAndParticle",b2.ParticleSystem.SolveCollisionCallback.prototype.ReportFixtureAndParticle);b2.ParticleSystem.SolveCollisionCallback.prototype.ReportFixtureAndParticle.s_p1=new b2.Vec2;b2.ParticleSystem.SolveCollisionCallback.prototype.ReportFixtureAndParticle.s_output=new b2.RayCastOutput;b2.ParticleSystem.SolveCollisionCallback.prototype.ReportFixtureAndParticle.s_input=new b2.RayCastInput;
b2.ParticleSystem.SolveCollisionCallback.prototype.ReportFixtureAndParticle.s_p=new b2.Vec2;b2.ParticleSystem.SolveCollisionCallback.prototype.ReportFixtureAndParticle.s_v=new b2.Vec2;b2.ParticleSystem.SolveCollisionCallback.prototype.ReportFixtureAndParticle.s_f=new b2.Vec2;b2.ParticleSystem.SolveCollisionCallback.prototype.ReportParticle=function(a,b){return!1};goog.exportProperty(b2.ParticleSystem.SolveCollisionCallback.prototype,"ReportParticle",b2.ParticleSystem.SolveCollisionCallback.prototype.ReportParticle);
b2.ParticleSystem.prototype.SolveCollision=function(a){var b=this.m_positionBuffer.data,c=this.m_velocityBuffer.data,d=b2.ParticleSystem.prototype.SolveCollision.s_aabb;d.lowerBound.x=+b2._maxFloat;d.lowerBound.y=+b2._maxFloat;d.upperBound.x=-b2._maxFloat;d.upperBound.y=-b2._maxFloat;for(var e=0;e<this.m_count;e++){var f=c[e],g=b[e],h=g.x+a.dt*f.x,f=g.y+a.dt*f.y;d.lowerBound.x=b2.Min(d.lowerBound.x,b2.Min(g.x,h));d.lowerBound.y=b2.Min(d.lowerBound.y,b2.Min(g.y,
f));d.upperBound.x=b2.Max(d.upperBound.x,b2.Max(g.x,h));d.upperBound.y=b2.Max(d.upperBound.y,b2.Max(g.y,f))}a=new b2.ParticleSystem.SolveCollisionCallback(this,a);this.m_world.QueryAABB(a,d)};b2.ParticleSystem.prototype.SolveCollision.s_aabb=new b2.AABB;
b2.ParticleSystem.prototype.LimitVelocity=function(a){var b=this.m_velocityBuffer.data;a=this.GetCriticalVelocitySquared(a);for(var c=0;c<this.m_count;c++){var d=b[c],e=b2.Dot_V2_V2(d,d);e>a&&d.SelfMul(b2.Sqrt(a/e))}};b2.ParticleSystem.prototype.SolveGravity=function(a){var b=b2.ParticleSystem.prototype.SolveGravity.s_gravity,c=this.m_velocityBuffer.data;a=b2.Mul_S_V2(a.dt*this.m_def.gravityScale,this.m_world.GetGravity(),b);for(b=0;b<this.m_count;b++)c[b].SelfAdd(a)};
b2.ParticleSystem.prototype.SolveGravity.s_gravity=new b2.Vec2;
b2.ParticleSystem.prototype.SolveBarrier=function(a){for(var b=b2.ParticleSystem.prototype.SolveBarrier.s_aabb,c=b2.ParticleSystem.prototype.SolveBarrier.s_va,d=b2.ParticleSystem.prototype.SolveBarrier.s_vb,e=b2.ParticleSystem.prototype.SolveBarrier.s_pba,f=b2.ParticleSystem.prototype.SolveBarrier.s_vba,g=b2.ParticleSystem.prototype.SolveBarrier.s_vc,h=b2.ParticleSystem.prototype.SolveBarrier.s_pca,k=b2.ParticleSystem.prototype.SolveBarrier.s_vca,l=b2.ParticleSystem.prototype.SolveBarrier.s_qba,
m=b2.ParticleSystem.prototype.SolveBarrier.s_qca,n=b2.ParticleSystem.prototype.SolveBarrier.s_dv,p=b2.ParticleSystem.prototype.SolveBarrier.s_f,q=this.m_positionBuffer.data,r=this.m_velocityBuffer.data,u=0;u<this.m_count;u++)0!==(this.m_flagsBuffer.data[u]&b2.ParticleSystem.k_barrierWallFlags)&&r[u].SetZero();for(var u=b2._barrierCollisionTime*a.dt,t=this.GetParticleMass(),w=0;w<this.m_pairBuffer.count;w++){var x=this.m_pairBuffer.data[w];if(x.flags&b2.ParticleFlag.barrierParticle){var v=
x.indexA,y=x.indexB,x=q[v],z=q[y],B=b;b2.Min_V2_V2(x,z,B.lowerBound);b2.Max_V2_V2(x,z,B.upperBound);for(var E=this.m_groupBuffer[v],F=this.m_groupBuffer[y],v=this.GetLinearVelocity(E,v,x,c),y=this.GetLinearVelocity(F,y,z,d),z=b2.Sub_V2_V2(z,x,e),y=b2.Sub_V2_V2(y,v,f),B=this.GetInsideBoundsEnumerator(B),G;0<=(G=B.GetNext());){var H=q[G],I=this.m_groupBuffer[G];if(E!==I&&F!==I){var C=this.GetLinearVelocity(I,G,H,g),A=b2.Sub_V2_V2(H,x,h),K=b2.Sub_V2_V2(C,v,k),J=b2.Cross_V2_V2(y,
K),D=b2.Cross_V2_V2(z,K)-b2.Cross_V2_V2(A,y),L=b2.Cross_V2_V2(z,A),M=l,N=m;if(0===J){if(0===D)continue;L=-L/D;if(!(0<=L&&L<u))continue;b2.AddMul_V2_S_V2(z,L,y,M);b2.AddMul_V2_S_V2(A,L,K,N);D=b2.Dot_V2_V2(M,N)/b2.Dot_V2_V2(M,M);if(!(0<=D&&1>=D))continue}else{L=D*D-4*L*J;if(0>L)continue;var O=b2.Sqrt(L),L=(-D-O)/(2*J),J=(-D+O)/(2*J);L>J&&(D=L,L=J,J=D);b2.AddMul_V2_S_V2(z,L,y,M);b2.AddMul_V2_S_V2(A,L,K,N);D=b2.Dot_V2_V2(M,N)/b2.Dot_V2_V2(M,
M);if(!(0<=L&&L<u&&0<=D&&1>=D)){L=J;if(!(0<=L&&L<u))continue;b2.AddMul_V2_S_V2(z,L,y,M);b2.AddMul_V2_S_V2(A,L,K,N);D=b2.Dot_V2_V2(M,N)/b2.Dot_V2_V2(M,M);if(!(0<=D&&1>=D))continue}}A=n;A.x=v.x+D*y.x-C.x;A.y=v.y+D*y.y-C.y;C=b2.Mul_S_V2(t,A,p);this.IsRigidGroup(I)?(t=I.GetMass(),A=I.GetInertia(),0<t&&I.m_linearVelocity.SelfMulAdd(1/t,C),0<A&&(I.m_angularVelocity+=b2.Cross_V2_V2(b2.Sub_V2_V2(H,I.GetCenter(),b2.Vec2.s_t0),C)/A)):r[G].SelfAdd(A);this.ParticleApplyForce(G,
C.SelfMul(-a.inv_dt))}}}}};b2.ParticleSystem.prototype.SolveBarrier.s_aabb=new b2.AABB;b2.ParticleSystem.prototype.SolveBarrier.s_va=new b2.Vec2;b2.ParticleSystem.prototype.SolveBarrier.s_vb=new b2.Vec2;b2.ParticleSystem.prototype.SolveBarrier.s_pba=new b2.Vec2;b2.ParticleSystem.prototype.SolveBarrier.s_vba=new b2.Vec2;b2.ParticleSystem.prototype.SolveBarrier.s_vc=new b2.Vec2;b2.ParticleSystem.prototype.SolveBarrier.s_pca=new b2.Vec2;
b2.ParticleSystem.prototype.SolveBarrier.s_vca=new b2.Vec2;b2.ParticleSystem.prototype.SolveBarrier.s_qba=new b2.Vec2;b2.ParticleSystem.prototype.SolveBarrier.s_qca=new b2.Vec2;b2.ParticleSystem.prototype.SolveBarrier.s_dv=new b2.Vec2;b2.ParticleSystem.prototype.SolveBarrier.s_f=new b2.Vec2;
b2.ParticleSystem.prototype.SolveStaticPressure=function(a){this.m_staticPressureBuffer=this.RequestBuffer(this.m_staticPressureBuffer);var b=this.GetCriticalPressure(a);a=this.m_def.staticPressureStrength*b;for(var b=b2._maxParticlePressure*b,c=this.m_def.staticPressureRelaxation,d=0;d<this.m_def.staticPressureIterations;d++){for(var e=0;e<this.m_count;e++)this.m_accumulationBuffer[e]=0;for(e=0;e<this.m_contactBuffer.count;e++){var f=this.m_contactBuffer.data[e];if(f.flags&b2.ParticleFlag.staticPressureParticle){var g=
f.indexA,h=f.indexB,f=f.weight;this.m_accumulationBuffer[g]+=f*this.m_staticPressureBuffer[h];this.m_accumulationBuffer[h]+=f*this.m_staticPressureBuffer[g]}}for(e=0;e<this.m_count;e++)f=this.m_weightBuffer[e],this.m_staticPressureBuffer[e]=this.m_flagsBuffer.data[e]&b2.ParticleFlag.staticPressureParticle?b2.Clamp((this.m_accumulationBuffer[e]+a*(f-b2._minParticleWeight))/(f+c),0,b):0}};
b2.ParticleSystem.prototype.ComputeWeight=function(){for(var a=0;a<this.m_count;a++)this.m_weightBuffer[a]=0;for(a=0;a<this.m_bodyContactBuffer.count;a++){var b=this.m_bodyContactBuffer.data[a],c=b.index,b=b.weight;this.m_weightBuffer[c]+=b}for(a=0;a<this.m_contactBuffer.count;a++){var b=this.m_contactBuffer.data[a],c=b.indexA,d=b.indexB,b=b.weight;this.m_weightBuffer[c]+=b;this.m_weightBuffer[d]+=b}};
b2.ParticleSystem.prototype.SolvePressure=function(a){for(var b=b2.ParticleSystem.prototype.SolvePressure.s_f,c=this.m_positionBuffer.data,d=this.m_velocityBuffer.data,e=this.GetCriticalPressure(a),f=this.m_def.pressureStrength*e,g=b2._maxParticlePressure*e,h=0;h<this.m_count;h++){var e=this.m_weightBuffer[h],k=f*b2.Max(0,e-b2._minParticleWeight);this.m_accumulationBuffer[h]=b2.Min(k,g)}if(this.m_allParticleFlags&b2.ParticleSystem.k_noPressureFlags)for(h=0;h<this.m_count;h++)this.m_flagsBuffer.data[h]&
b2.ParticleSystem.k_noPressureFlags&&(this.m_accumulationBuffer[h]=0);if(this.m_allParticleFlags&b2.ParticleFlag.staticPressureParticle)for(b2.Assert(null!==this.m_staticPressureBuffer),h=0;h<this.m_count;h++)this.m_flagsBuffer.data[h]&b2.ParticleFlag.staticPressureParticle&&(this.m_accumulationBuffer[h]+=this.m_staticPressureBuffer[h]);a=a.dt/(this.m_def.density*this.m_particleDiameter);g=this.GetParticleInvMass();for(h=0;h<this.m_bodyContactBuffer.count;h++){var k=this.m_bodyContactBuffer.data[h],
l=k.index,m=k.body,e=k.weight,n=k.mass,p=k.normal,q=c[l],k=this.m_accumulationBuffer[l]+f*e,e=b2.Mul_S_V2(a*e*n*k,p,b);d[l].SelfMulSub(g,e);m.ApplyLinearImpulse(e,q,!0)}for(h=0;h<this.m_contactBuffer.count;h++)k=this.m_contactBuffer.data[h],l=k.indexA,m=k.indexB,e=k.weight,p=k.normal,k=this.m_accumulationBuffer[l]+this.m_accumulationBuffer[m],e=b2.Mul_S_V2(a*e*k,p,b),d[l].SelfSub(e),d[m].SelfAdd(e)};b2.ParticleSystem.prototype.SolvePressure.s_f=new b2.Vec2;
b2.ParticleSystem.prototype.SolveDamping=function(a){var b=b2.ParticleSystem.prototype.SolveDamping.s_v,c=b2.ParticleSystem.prototype.SolveDamping.s_f,d=this.m_positionBuffer.data,e=this.m_velocityBuffer.data,f=this.m_def.dampingStrength;a=1/this.GetCriticalVelocity(a);for(var g=this.GetParticleInvMass(),h=0;h<this.m_bodyContactBuffer.count;h++){var k=this.m_bodyContactBuffer.data[h],l=k.index,m=k.body,n=k.weight,p=k.mass,q=k.normal,k=d[l],r=b2.Sub_V2_V2(m.GetLinearVelocityFromWorldPoint(k,
b2.Vec2.s_t0),e[l],b),r=b2.Dot_V2_V2(r,q);0>r&&(n=b2.Max(f*n,b2.Min(-a*r,.5)),p=b2.Mul_S_V2(n*p*r,q,c),e[l].SelfMulAdd(g,p),m.ApplyLinearImpulse(p.SelfNeg(),k,!0))}for(h=0;h<this.m_contactBuffer.count;h++)k=this.m_contactBuffer.data[h],l=k.indexA,m=k.indexB,n=k.weight,q=k.normal,r=b2.Sub_V2_V2(e[m],e[l],b),r=b2.Dot_V2_V2(r,q),0>r&&(n=b2.Max(f*n,b2.Min(-a*r,.5)),p=b2.Mul_S_V2(n*r,q,c),e[l].SelfAdd(p),e[m].SelfSub(p))};
b2.ParticleSystem.prototype.SolveDamping.s_v=new b2.Vec2;b2.ParticleSystem.prototype.SolveDamping.s_f=new b2.Vec2;
b2.ParticleSystem.prototype.SolveRigidDamping=function(){for(var a=b2.ParticleSystem.prototype.SolveRigidDamping.s_t0,b=b2.ParticleSystem.prototype.SolveRigidDamping.s_t1,c=b2.ParticleSystem.prototype.SolveRigidDamping.s_p,d=b2.ParticleSystem.prototype.SolveRigidDamping.s_v,e=[0],f=[0],g=[0],h=[0],k=[0],l=[0],m=this.m_positionBuffer.data,n=this.m_def.dampingStrength,p=0;p<this.m_bodyContactBuffer.count;p++){var q=this.m_bodyContactBuffer.data[p],r=q.index,u=this.m_groupBuffer[r];
if(this.IsRigidGroup(u)){var t=q.body,w=q.normal,x=q.weight,q=m[r],v=b2.Sub_V2_V2(t.GetLinearVelocityFromWorldPoint(q,a),u.GetLinearVelocityFromWorldPoint(q,b),d),v=b2.Dot_V2_V2(v,w);0>v&&(this.InitDampingParameterWithRigidGroupOrParticle(e,f,g,!0,u,r,q,w),this.InitDampingParameter(h,k,l,t.GetMass(),t.GetInertia()-t.GetMass()*t.GetLocalCenter().LengthSquared(),t.GetWorldCenter(),q,w),x=n*b2.Min(x,1)*this.ComputeDampingImpulse(e[0],f[0],g[0],h[0],k[0],l[0],v),this.ApplyDamping(e[0],
f[0],g[0],!0,u,r,x,w),t.ApplyLinearImpulse(b2.Mul_S_V2(-x,w,b2.Vec2.s_t0),q,!0))}}for(p=0;p<this.m_contactBuffer.count;p++){var q=this.m_contactBuffer.data[p],r=q.indexA,t=q.indexB,w=q.normal,x=q.weight,u=this.m_groupBuffer[r],y=this.m_groupBuffer[t],z=this.IsRigidGroup(u),B=this.IsRigidGroup(y);u!==y&&(z||B)&&(q=b2.Mid_V2_V2(m[r],m[t],c),v=b2.Sub_V2_V2(this.GetLinearVelocity(y,t,q,a),this.GetLinearVelocity(u,r,q,b),d),v=b2.Dot_V2_V2(v,w),0>v&&(this.InitDampingParameterWithRigidGroupOrParticle(e,
f,g,z,u,r,q,w),this.InitDampingParameterWithRigidGroupOrParticle(h,k,l,B,y,t,q,w),x=n*x*this.ComputeDampingImpulse(e[0],f[0],g[0],h[0],k[0],l[0],v),this.ApplyDamping(e[0],f[0],g[0],z,u,r,x,w),this.ApplyDamping(h[0],k[0],l[0],B,y,t,-x,w)))}};b2.ParticleSystem.prototype.SolveRigidDamping.s_t0=new b2.Vec2;b2.ParticleSystem.prototype.SolveRigidDamping.s_t1=new b2.Vec2;b2.ParticleSystem.prototype.SolveRigidDamping.s_p=new b2.Vec2;
b2.ParticleSystem.prototype.SolveRigidDamping.s_v=new b2.Vec2;
b2.ParticleSystem.prototype.SolveExtraDamping=function(){for(var a=b2.ParticleSystem.prototype.SolveExtraDamping.s_v,b=b2.ParticleSystem.prototype.SolveExtraDamping.s_f,c=this.m_velocityBuffer.data,d=this.m_positionBuffer.data,e=this.GetParticleInvMass(),f=0;f<this.m_bodyContactBuffer.count;f++){var g=this.m_bodyContactBuffer.data[f],h=g.index;if(this.m_flagsBuffer.data[h]&b2.ParticleSystem.k_extraDampingFlags){var k=g.body,l=g.mass,m=g.normal,g=d[h],n=b2.Sub_V2_V2(k.GetLinearVelocityFromWorldPoint(g,
b2.Vec2.s_t0),c[h],a),n=b2.Dot_V2_V2(n,m);0>n&&(l=b2.Mul_S_V2(.5*l*n,m,b),c[h].SelfMulAdd(e,l),k.ApplyLinearImpulse(l.SelfNeg(),g,!0))}}};b2.ParticleSystem.prototype.SolveExtraDamping.s_v=new b2.Vec2;b2.ParticleSystem.prototype.SolveExtraDamping.s_f=new b2.Vec2;b2.ParticleSystem.prototype.SolveWall=function(){for(var a=this.m_velocityBuffer.data,b=0;b<this.m_count;b++)this.m_flagsBuffer.data[b]&b2.ParticleFlag.wallParticle&&a[b].SetZero()};
b2.ParticleSystem.prototype.SolveRigid=function(a){for(var b=b2.ParticleSystem.prototype.SolveRigid.s_position,c=b2.ParticleSystem.prototype.SolveRigid.s_rotation,d=b2.ParticleSystem.prototype.SolveRigid.s_transform,e=b2.ParticleSystem.prototype.SolveRigid.s_velocityTransform,f=this.m_positionBuffer.data,g=this.m_velocityBuffer.data,h=this.m_groupList;h;h=h.GetNext())if(h.m_groupFlags&b2.ParticleGroupFlag.rigidParticleGroup){h.UpdateStatistics();var k=c;k.SetAngle(a.dt*
h.m_angularVelocity);var l=b2.Add_V2_V2(h.m_center,b2.Sub_V2_V2(b2.Mul_S_V2(a.dt,h.m_linearVelocity,b2.Vec2.s_t0),b2.Mul_R_V2(k,h.m_center,b2.Vec2.s_t1),b2.Vec2.s_t0),b),m=d;m.SetPositionRotation(l,k);b2.Mul_X_X(m,h.m_transform,h.m_transform);k=e;k.p.x=a.inv_dt*m.p.x;k.p.y=a.inv_dt*m.p.y;k.q.s=a.inv_dt*m.q.s;k.q.c=a.inv_dt*(m.q.c-1);for(m=h.m_firstIndex;m<h.m_lastIndex;m++)b2.Mul_X_V2(k,f[m],g[m])}};
b2.ParticleSystem.prototype.SolveRigid.s_position=new b2.Vec2;b2.ParticleSystem.prototype.SolveRigid.s_rotation=new b2.Rot;b2.ParticleSystem.prototype.SolveRigid.s_transform=new b2.Transform;b2.ParticleSystem.prototype.SolveRigid.s_velocityTransform=new b2.Transform;
b2.ParticleSystem.prototype.SolveElastic=function(a){for(var b=b2.ParticleSystem.prototype.SolveElastic.s_pa,c=b2.ParticleSystem.prototype.SolveElastic.s_pb,d=b2.ParticleSystem.prototype.SolveElastic.s_pc,e=b2.ParticleSystem.prototype.SolveElastic.s_r,f=b2.ParticleSystem.prototype.SolveElastic.s_t0,g=this.m_positionBuffer.data,h=this.m_velocityBuffer.data,k=a.inv_dt*this.m_def.elasticStrength,l=0;l<this.m_triadBuffer.count;l++){var m=this.m_triadBuffer.data[l];if(m.flags&
b2.ParticleFlag.elasticParticle){var n=m.indexA,p=m.indexB,q=m.indexC,r=m.pa,u=m.pb,t=m.pc,w=b.Copy(g[n]),x=c.Copy(g[p]),v=d.Copy(g[q]),n=h[n],p=h[p],q=h[q];w.SelfMulAdd(a.dt,n);x.SelfMulAdd(a.dt,p);v.SelfMulAdd(a.dt,q);var y=(w.x+x.x+v.x)/3,z=(w.y+x.y+v.y)/3;w.x-=y;w.y-=z;x.x-=y;x.y-=z;v.x-=y;v.y-=z;y=e;y.s=b2.Cross_V2_V2(r,w)+b2.Cross_V2_V2(u,x)+b2.Cross_V2_V2(t,v);y.c=b2.Dot_V2_V2(r,w)+b2.Dot_V2_V2(u,x)+b2.Dot_V2_V2(t,v);z=b2.InvSqrt(y.s*y.s+y.c*y.c);
isFinite(z)||(z=1.9817753699999998E19);y.s*=z;y.c*=z;y.angle=Math.atan2(y.s,y.c);m=k*m.strength;b2.Mul_R_V2(y,r,f);b2.Sub_V2_V2(f,w,f);b2.Mul_S_V2(m,f,f);n.SelfAdd(f);b2.Mul_R_V2(y,u,f);b2.Sub_V2_V2(f,x,f);b2.Mul_S_V2(m,f,f);p.SelfAdd(f);b2.Mul_R_V2(y,t,f);b2.Sub_V2_V2(f,v,f);b2.Mul_S_V2(m,f,f);q.SelfAdd(f)}}};b2.ParticleSystem.prototype.SolveElastic.s_pa=new b2.Vec2;b2.ParticleSystem.prototype.SolveElastic.s_pb=new b2.Vec2;
b2.ParticleSystem.prototype.SolveElastic.s_pc=new b2.Vec2;b2.ParticleSystem.prototype.SolveElastic.s_r=new b2.Rot;b2.ParticleSystem.prototype.SolveElastic.s_t0=new b2.Vec2;
b2.ParticleSystem.prototype.SolveSpring=function(a){for(var b=b2.ParticleSystem.prototype.SolveSpring.s_pa,c=b2.ParticleSystem.prototype.SolveSpring.s_pb,d=b2.ParticleSystem.prototype.SolveSpring.s_d,e=b2.ParticleSystem.prototype.SolveSpring.s_f,f=this.m_positionBuffer.data,g=this.m_velocityBuffer.data,h=a.inv_dt*this.m_def.springStrength,k=0;k<this.m_pairBuffer.count;k++){var l=this.m_pairBuffer.data[k];if(l.flags&b2.ParticleFlag.springParticle){var m=l.indexA,n=
l.indexB,p=b.Copy(f[m]),q=c.Copy(f[n]),m=g[m],n=g[n];p.SelfMulAdd(a.dt,m);q.SelfMulAdd(a.dt,n);var p=b2.Sub_V2_V2(q,p,d),q=l.distance,r=p.Length(),l=b2.Mul_S_V2(h*l.strength*(q-r)/r,p,e);m.SelfSub(l);n.SelfAdd(l)}}};b2.ParticleSystem.prototype.SolveSpring.s_pa=new b2.Vec2;b2.ParticleSystem.prototype.SolveSpring.s_pb=new b2.Vec2;b2.ParticleSystem.prototype.SolveSpring.s_d=new b2.Vec2;b2.ParticleSystem.prototype.SolveSpring.s_f=new b2.Vec2;
b2.ParticleSystem.prototype.SolveTensile=function(a){var b=b2.ParticleSystem.prototype.SolveTensile.s_weightedNormal,c=b2.ParticleSystem.prototype.SolveTensile.s_s,d=b2.ParticleSystem.prototype.SolveTensile.s_f,e=this.m_velocityBuffer.data;b2.Assert(null!==this.m_accumulation2Buffer);for(var f=0;f<this.m_count;f++)this.m_accumulation2Buffer[f]=b2.Vec2_zero.Clone(),this.m_accumulation2Buffer[f].SetZero();for(f=0;f<this.m_contactBuffer.count;f++){var g=this.m_contactBuffer.data[f];
if(g.flags&b2.ParticleFlag.tensileParticle){var h=g.indexA,k=g.indexB,l=g.weight,g=g.normal,l=b2.Mul_S_V2((1-l)*l,g,b);this.m_accumulation2Buffer[h].SelfSub(l);this.m_accumulation2Buffer[k].SelfAdd(l)}}f=this.GetCriticalVelocity(a);a=this.m_def.surfaceTensionPressureStrength*f;for(var b=this.m_def.surfaceTensionNormalStrength*f,m=b2._maxParticleForce*f,f=0;f<this.m_contactBuffer.count;f++)if(g=this.m_contactBuffer.data[f],g.flags&b2.ParticleFlag.tensileParticle){var h=g.indexA,
k=g.indexB,l=g.weight,g=g.normal,n=this.m_weightBuffer[h]+this.m_weightBuffer[k],p=b2.Sub_V2_V2(this.m_accumulation2Buffer[k],this.m_accumulation2Buffer[h],c),l=b2.Min(a*(n-2)+b*b2.Dot_V2_V2(p,g),m)*l,l=b2.Mul_S_V2(l,g,d);e[h].SelfSub(l);e[k].SelfAdd(l)}};b2.ParticleSystem.prototype.SolveTensile.s_weightedNormal=new b2.Vec2;b2.ParticleSystem.prototype.SolveTensile.s_s=new b2.Vec2;b2.ParticleSystem.prototype.SolveTensile.s_f=new b2.Vec2;
b2.ParticleSystem.prototype.SolveViscous=function(){for(var a=b2.ParticleSystem.prototype.SolveViscous.s_v,b=b2.ParticleSystem.prototype.SolveViscous.s_f,c=this.m_positionBuffer.data,d=this.m_velocityBuffer.data,e=this.m_def.viscousStrength,f=this.GetParticleInvMass(),g=0;g<this.m_bodyContactBuffer.count;g++){var h=this.m_bodyContactBuffer.data[g],k=h.index;if(this.m_flagsBuffer.data[k]&b2.ParticleFlag.viscousParticle){var l=h.body,m=h.weight,n=h.mass,h=c[k],p=b2.Sub_V2_V2(l.GetLinearVelocityFromWorldPoint(h,
b2.Vec2.s_t0),d[k],a),m=b2.Mul_S_V2(e*n*m,p,b);d[k].SelfMulAdd(f,m);l.ApplyLinearImpulse(m.SelfNeg(),h,!0)}}for(g=0;g<this.m_contactBuffer.count;g++)h=this.m_contactBuffer.data[g],h.flags&b2.ParticleFlag.viscousParticle&&(k=h.indexA,l=h.indexB,m=h.weight,p=b2.Sub_V2_V2(d[l],d[k],a),m=b2.Mul_S_V2(e*m,p,b),d[k].SelfAdd(m),d[l].SelfSub(m))};b2.ParticleSystem.prototype.SolveViscous.s_v=new b2.Vec2;b2.ParticleSystem.prototype.SolveViscous.s_f=new b2.Vec2;
b2.ParticleSystem.prototype.SolveRepulsive=function(a){var b=b2.ParticleSystem.prototype.SolveRepulsive.s_f,c=this.m_velocityBuffer.data;a=this.m_def.repulsiveStrength*this.GetCriticalVelocity(a);for(var d=0;d<this.m_contactBuffer.count;d++){var e=this.m_contactBuffer.data[d];if(e.flags&b2.ParticleFlag.repulsiveParticle){var f=e.indexA,g=e.indexB;this.m_groupBuffer[f]!==this.m_groupBuffer[g]&&(e=b2.Mul_S_V2(a*e.weight,e.normal,b),c[f].SelfSub(e),c[g].SelfAdd(e))}}};
b2.ParticleSystem.prototype.SolveRepulsive.s_f=new b2.Vec2;
b2.ParticleSystem.prototype.SolvePowder=function(a){var b=b2.ParticleSystem.prototype.SolvePowder.s_f,c=this.m_positionBuffer.data,d=this.m_velocityBuffer.data;a=this.m_def.powderStrength*this.GetCriticalVelocity(a);for(var e=1-b2._particleStride,f=this.GetParticleInvMass(),g=0;g<this.m_bodyContactBuffer.count;g++){var h=this.m_bodyContactBuffer.data[g],k=h.index;if(this.m_flagsBuffer.data[k]&b2.ParticleFlag.powderParticle){var l=h.weight;if(l>e){var m=h.body,n=c[k],p=h.normal,
h=b2.Mul_S_V2(a*h.mass*(l-e),p,b);d[k].SelfMulSub(f,h);m.ApplyLinearImpulse(h,n,!0)}}}for(g=0;g<this.m_contactBuffer.count;g++)h=this.m_contactBuffer.data[g],h.flags&b2.ParticleFlag.powderParticle&&(l=h.weight,l>e&&(k=h.indexA,m=h.indexB,p=h.normal,h=b2.Mul_S_V2(a*(l-e),p,b),d[k].SelfSub(h),d[m].SelfAdd(h)))};b2.ParticleSystem.prototype.SolvePowder.s_f=new b2.Vec2;
b2.ParticleSystem.prototype.SolveSolid=function(a){var b=b2.ParticleSystem.prototype.SolveSolid.s_f,c=this.m_velocityBuffer.data;this.m_depthBuffer=this.RequestBuffer(this.m_depthBuffer);a=a.inv_dt*this.m_def.ejectionStrength;for(var d=0;d<this.m_contactBuffer.count;d++){var e=this.m_contactBuffer.data[d],f=e.indexA,g=e.indexB;this.m_groupBuffer[f]!==this.m_groupBuffer[g]&&(e=b2.Mul_S_V2(a*(this.m_depthBuffer[f]+this.m_depthBuffer[g])*e.weight,e.normal,b),c[f].SelfSub(e),c[g].SelfAdd(e))}};
b2.ParticleSystem.prototype.SolveSolid.s_f=new b2.Vec2;b2.ParticleSystem.prototype.SolveForce=function(a){var b=this.m_velocityBuffer.data;a=a.dt*this.GetParticleInvMass();for(var c=0;c<this.m_count;c++)b[c].SelfMulAdd(a,this.m_forceBuffer[c]);this.m_hasForce=!1};
b2.ParticleSystem.prototype.SolveColorMixing=function(){b2.Assert(null!==this.m_colorBuffer.data);var a=Math.floor(128*this.m_def.colorMixingStrength);if(a)for(var b=0;b<this.m_contactBuffer.count;b++){var c=this.m_contactBuffer.data[b],d=c.indexA,c=c.indexB;this.m_flagsBuffer.data[d]&this.m_flagsBuffer.data[c]&b2.ParticleFlag.colorMixingParticle&&b2.ParticleColor.MixColors(this.m_colorBuffer.data[d],this.m_colorBuffer.data[c],a)}};
b2.ParticleSystem.prototype.SolveZombie=function(){for(var a=0,b=[],c=0;c<this.m_count;c++)b[c]=b2._invalidParticleIndex;b2.Assert(b.length===this.m_count);for(var d=0,c=0;c<this.m_count;c++){var e=this.m_flagsBuffer.data[c];if(e&b2.ParticleFlag.zombieParticle){var f=this.m_world.m_destructionListener;e&b2.ParticleFlag.destructionListenerParticle&&f&&f.SayGoodbyeParticle(this,c);this.m_handleIndexBuffer.data&&(f=this.m_handleIndexBuffer.data[c])&&(f.SetIndex(b2._invalidParticleIndex),
this.m_handleIndexBuffer.data[c]=null);b[c]=b2._invalidParticleIndex}else b[c]=a,c!==a&&(this.m_handleIndexBuffer.data&&((f=this.m_handleIndexBuffer.data[c])&&f.SetIndex(a),this.m_handleIndexBuffer.data[a]=f),this.m_flagsBuffer.data[a]=this.m_flagsBuffer.data[c],this.m_lastBodyContactStepBuffer.data&&(this.m_lastBodyContactStepBuffer.data[a]=this.m_lastBodyContactStepBuffer.data[c]),this.m_bodyContactCountBuffer.data&&(this.m_bodyContactCountBuffer.data[a]=this.m_bodyContactCountBuffer.data[c]),
this.m_consecutiveContactStepsBuffer.data&&(this.m_consecutiveContactStepsBuffer.data[a]=this.m_consecutiveContactStepsBuffer.data[c]),this.m_positionBuffer.data[a].Copy(this.m_positionBuffer.data[c]),this.m_velocityBuffer.data[a].Copy(this.m_velocityBuffer.data[c]),this.m_groupBuffer[a]=this.m_groupBuffer[c],this.m_hasForce&&this.m_forceBuffer[a].Copy(this.m_forceBuffer[c]),this.m_staticPressureBuffer&&(this.m_staticPressureBuffer[a]=this.m_staticPressureBuffer[c]),this.m_depthBuffer&&(this.m_depthBuffer[a]=
this.m_depthBuffer[c]),this.m_colorBuffer.data&&this.m_colorBuffer.data[a].Copy(this.m_colorBuffer.data[c]),this.m_userDataBuffer.data&&(this.m_userDataBuffer.data[a]=this.m_userDataBuffer.data[c]),this.m_expirationTimeBuffer.data&&(this.m_expirationTimeBuffer.data[a]=this.m_expirationTimeBuffer.data[c])),a++,d|=e}for(c=0;c<this.m_proxyBuffer.count;c++)e=this.m_proxyBuffer.data[c],e.index=b[e.index];this.m_proxyBuffer.RemoveIf(function(a){return 0>a.index});for(c=0;c<this.m_contactBuffer.count;c++)e=
this.m_contactBuffer.data[c],e.indexA=b[e.indexA],e.indexB=b[e.indexB];this.m_contactBuffer.RemoveIf(function(a){return 0>a.indexA||0>a.indexB});for(c=0;c<this.m_bodyContactBuffer.count;c++)e=this.m_bodyContactBuffer.data[c],e.index=b[e.index];this.m_bodyContactBuffer.RemoveIf(function(a){return 0>a.index});for(c=0;c<this.m_pairBuffer.count;c++)e=this.m_pairBuffer.data[c],e.indexA=b[e.indexA],e.indexB=b[e.indexB];this.m_pairBuffer.RemoveIf(function(a){return 0>a.indexA||0>a.indexB});for(c=0;c<this.m_triadBuffer.count;c++)e=
this.m_triadBuffer.data[c],e.indexA=b[e.indexA],e.indexB=b[e.indexB],e.indexC=b[e.indexC];this.m_triadBuffer.RemoveIf(function(a){return 0>a.indexA||0>a.indexB||0>a.indexC});if(this.m_indexByExpirationTimeBuffer.data)for(e=c=0;e<this.m_count;e++)f=b[this.m_indexByExpirationTimeBuffer.data[e]],f!==b2._invalidParticleIndex&&(this.m_indexByExpirationTimeBuffer.data[c++]=f);for(e=this.m_groupList;e;e=e.GetNext()){for(var f=a,g=0,h=!1,c=e.m_firstIndex;c<e.m_lastIndex;c++){var k=b[c];0<=k?(f=b2.Min(f,
k),g=b2.Max(g,k+1)):h=!0}f<g?(e.m_firstIndex=f,e.m_lastIndex=g,h&&e.m_groupFlags&b2.ParticleGroupFlag.solidParticleGroup&&this.SetGroupFlags(e,e.m_groupFlags|b2.ParticleGroupFlag.particleGroupNeedsUpdateDepth)):(e.m_firstIndex=0,e.m_lastIndex=0,e.m_groupFlags&b2.ParticleGroupFlag.particleGroupCanBeEmpty||this.SetGroupFlags(e,e.m_groupFlags|b2.ParticleGroupFlag.particleGroupWillBeDestroyed))}this.m_count=a;this.m_allParticleFlags=d;this.m_needsUpdateAllParticleFlags=
!1;for(e=this.m_groupList;e;)a=e.GetNext(),e.m_groupFlags&b2.ParticleGroupFlag.particleGroupWillBeDestroyed&&this.DestroyParticleGroup(e),e=a};
b2.ParticleSystem.prototype.SolveLifetimes=function(a){b2.Assert(null!==this.m_expirationTimeBuffer.data);b2.Assert(null!==this.m_indexByExpirationTimeBuffer.data);this.m_timeElapsed=this.LifetimeToExpirationTime(a.dt);a=this.GetQuantizedTimeElapsed();var b=this.m_expirationTimeBuffer.data,c=this.m_indexByExpirationTimeBuffer.data,d=this.GetParticleCount();this.m_expirationTimeBufferRequiresSorting&&(b2.std_sort(c,0,d,function(a,c){var d=b[a],e=b[c],f=0>=d;return f===0>=e?d>e:f}),
this.m_expirationTimeBufferRequiresSorting=!1);for(--d;0<=d;--d){var e=c[d],f=b[e];if(a<f||0>=f)break;this.DestroyParticle(e)}};
b2.ParticleSystem.prototype.RotateBuffer=function(a,b,c){function d(d){return d<a?d:d<b?d+c-b:d<c?d+a-b:d}if(a!==b&&b!==c){b2.Assert(b>=a&&b<=c);b2.std_rotate(this.m_flagsBuffer.data,a,b,c);this.m_lastBodyContactStepBuffer.data&&b2.std_rotate(this.m_lastBodyContactStepBuffer.data,a,b,c);this.m_bodyContactCountBuffer.data&&b2.std_rotate(this.m_bodyContactCountBuffer.data,a,b,c);this.m_consecutiveContactStepsBuffer.data&&b2.std_rotate(this.m_consecutiveContactStepsBuffer.data,
a,b,c);b2.std_rotate(this.m_positionBuffer.data,a,b,c);b2.std_rotate(this.m_velocityBuffer.data,a,b,c);b2.std_rotate(this.m_groupBuffer,a,b,c);this.m_hasForce&&b2.std_rotate(this.m_forceBuffer,a,b,c);this.m_staticPressureBuffer&&b2.std_rotate(this.m_staticPressureBuffer,a,b,c);this.m_depthBuffer&&b2.std_rotate(this.m_depthBuffer,a,b,c);this.m_colorBuffer.data&&b2.std_rotate(this.m_colorBuffer.data,a,b,c);this.m_userDataBuffer.data&&b2.std_rotate(this.m_userDataBuffer.data,
a,b,c);if(this.m_handleIndexBuffer.data){b2.std_rotate(this.m_handleIndexBuffer.data,a,b,c);for(var e=a;e<c;++e){var f=this.m_handleIndexBuffer.data[e];f&&f.SetIndex(d(f.GetIndex()))}}if(this.m_expirationTimeBuffer.data){b2.std_rotate(this.m_expirationTimeBuffer.data,a,b,c);for(var f=this.GetParticleCount(),g=this.m_indexByExpirationTimeBuffer.data,e=0;e<f;++e)g[e]=d(g[e])}for(e=0;e<this.m_proxyBuffer.count;e++)f=this.m_proxyBuffer.data[e],f.index=d(f.index);for(e=0;e<this.m_contactBuffer.count;e++)f=
this.m_contactBuffer.data[e],f.indexA=d(f.indexA),f.indexB=d(f.indexB);for(e=0;e<this.m_bodyContactBuffer.count;e++)f=this.m_bodyContactBuffer.data[e],f.index=d(f.index);for(e=0;e<this.m_pairBuffer.count;e++)f=this.m_pairBuffer.data[e],f.indexA=d(f.indexA),f.indexB=d(f.indexB);for(e=0;e<this.m_triadBuffer.count;e++)f=this.m_triadBuffer.data[e],f.indexA=d(f.indexA),f.indexB=d(f.indexB),f.indexC=d(f.indexC);for(e=this.m_groupList;e;e=e.GetNext())e.m_firstIndex=d(e.m_firstIndex),e.m_lastIndex=d(e.m_lastIndex-
1)+1}};b2.ParticleSystem.prototype.GetCriticalVelocity=function(a){return this.m_particleDiameter*a.inv_dt};b2.ParticleSystem.prototype.GetCriticalVelocitySquared=function(a){a=this.GetCriticalVelocity(a);return a*a};b2.ParticleSystem.prototype.GetCriticalPressure=function(a){return this.m_def.density*this.GetCriticalVelocitySquared(a)};b2.ParticleSystem.prototype.GetParticleStride=function(){return b2._particleStride*this.m_particleDiameter};
b2.ParticleSystem.prototype.GetParticleMass=function(){var a=this.GetParticleStride();return this.m_def.density*a*a};b2.ParticleSystem.prototype.GetParticleInvMass=function(){var a=1/b2._particleStride*this.m_inverseDiameter;return this.m_inverseDensity*a*a};b2.ParticleSystem.prototype.GetFixtureContactFilter=function(){return this.m_allParticleFlags&b2.ParticleFlag.fixtureContactFilterParticle?this.m_world.m_contactManager.m_contactFilter:null};
b2.ParticleSystem.prototype.GetParticleContactFilter=function(){return this.m_allParticleFlags&b2.ParticleFlag.particleContactFilterParticle?this.m_world.m_contactManager.m_contactFilter:null};b2.ParticleSystem.prototype.GetFixtureContactListener=function(){return this.m_allParticleFlags&b2.ParticleFlag.fixtureContactListenerParticle?this.m_world.m_contactManager.m_contactListener:null};
b2.ParticleSystem.prototype.GetParticleContactListener=function(){return this.m_allParticleFlags&b2.ParticleFlag.particleContactListenerParticle?this.m_world.m_contactManager.m_contactListener:null};b2.ParticleSystem.prototype.SetUserOverridableBuffer=function(a,b,c){b2.Assert(null!==b&&0<c||null===b&&0===c);a.data=b;a.userSuppliedCapacity=c};
b2.ParticleSystem.prototype.SetGroupFlags=function(a,b){var c=a.m_groupFlags;(c^b)&b2.ParticleGroupFlag.solidParticleGroup&&(b|=b2.ParticleGroupFlag.particleGroupNeedsUpdateDepth);c&~b&&(this.m_needsUpdateAllGroupFlags=!0);~this.m_allGroupFlags&b&&(b&b2.ParticleGroupFlag.solidParticleGroup&&(this.m_depthBuffer=this.RequestBuffer(this.m_depthBuffer)),this.m_allGroupFlags|=b);a.m_groupFlags=b};
b2.ParticleSystem.prototype.RemoveSpuriousBodyContacts=function(){b2.std_sort(this.m_bodyContactBuffer.data,0,this.m_bodyContactBuffer.count,b2.ParticleSystem.BodyContactCompare);var a=b2.ParticleSystem.prototype.RemoveSpuriousBodyContacts.s_n,b=b2.ParticleSystem.prototype.RemoveSpuriousBodyContacts.s_pos,c=b2.ParticleSystem.prototype.RemoveSpuriousBodyContacts.s_normal,d=this,e=-1,f=0,g=0;this.m_bodyContactBuffer.count=b2.std_remove_if(this.m_bodyContactBuffer.data,
function(h){h.index!==e&&(f=0,e=h.index);if(3<f++)return++g,!0;var k=a.Copy(h.normal);k.SelfMul(d.m_particleDiameter*(1-h.weight));k=b2.Add_V2_V2(d.m_positionBuffer.data[h.index],k,b);if(!h.fixture.TestPoint(k)){for(var l=h.fixture.GetShape().GetChildCount(),m=0;m<l;m++)if(h.fixture.ComputeDistance(k,c,m)<b2._linearSlop)return!1;++g;return!0}return!1},this.m_bodyContactBuffer.count)};b2.ParticleSystem.prototype.RemoveSpuriousBodyContacts.s_n=new b2.Vec2;
b2.ParticleSystem.prototype.RemoveSpuriousBodyContacts.s_pos=new b2.Vec2;b2.ParticleSystem.prototype.RemoveSpuriousBodyContacts.s_normal=new b2.Vec2;b2.ParticleSystem.BodyContactCompare=function(a,b){return a.index===b.index?a.weight>b.weight:a.index<b.index};
b2.ParticleSystem.prototype.DetectStuckParticle=function(a){0>=this.m_stuckThreshold||(++this.m_bodyContactCountBuffer.data[a],2===this.m_bodyContactCountBuffer.data[a]&&(++this.m_consecutiveContactStepsBuffer.data[a],this.m_consecutiveContactStepsBuffer.data[a]>this.m_stuckThreshold&&(this.m_stuckParticleBuffer.data[this.m_stuckParticleBuffer.Append()]=a)),this.m_lastBodyContactStepBuffer.data[a]=this.m_timestamp)};
b2.ParticleSystem.prototype.ValidateParticleIndex=function(a){return 0<=a&&a<this.GetParticleCount()&&a!==b2._invalidParticleIndex};b2.ParticleSystem.prototype.GetQuantizedTimeElapsed=function(){return Math.floor(this.m_timeElapsed/4294967296)};b2.ParticleSystem.prototype.LifetimeToExpirationTime=function(a){return this.m_timeElapsed+Math.floor(a/this.m_def.lifetimeGranularity*4294967296)};b2.ParticleSystem.prototype.ForceCanBeApplied=function(a){return!(a&b2.ParticleFlag.wallParticle)};
b2.ParticleSystem.prototype.PrepareForceBuffer=function(){if(!this.m_hasForce){for(var a=0;a<this.m_count;a++)this.m_forceBuffer[a].SetZero();this.m_hasForce=!0}};b2.ParticleSystem.prototype.IsRigidGroup=function(a){return null!==a&&0!==(a.m_groupFlags&b2.ParticleGroupFlag.rigidParticleGroup)};b2.ParticleSystem.prototype.GetLinearVelocity=function(a,b,c,d){return this.IsRigidGroup(a)?a.GetLinearVelocityFromWorldPoint(c,d):d.Copy(this.m_velocityBuffer.data[b])};
b2.ParticleSystem.prototype.InitDampingParameter=function(a,b,c,d,e,f,g,h){a[0]=0<d?1/d:0;b[0]=0<e?1/e:0;c[0]=b2.Cross_V2_V2(b2.Sub_V2_V2(g,f,b2.Vec2.s_t0),h)};b2.ParticleSystem.prototype.InitDampingParameterWithRigidGroupOrParticle=function(a,b,c,d,e,f,g,h){d?this.InitDampingParameter(a,b,c,e.GetMass(),e.GetInertia(),e.GetCenter(),g,h):this.InitDampingParameter(a,b,c,this.m_flagsBuffer.data[f]&b2.ParticleFlag.wallParticle?0:this.GetParticleMass(),0,g,g,h)};
b2.ParticleSystem.prototype.ComputeDampingImpulse=function(a,b,c,d,e,f,g){a=a+b*c*c+d+e*f*f;return 0<a?g/a:0};b2.ParticleSystem.prototype.ApplyDamping=function(a,b,c,d,e,f,g,h){d?(e.m_linearVelocity.SelfMulAdd(g*a,h),e.m_angularVelocity+=g*c*b):this.m_velocityBuffer.data[f].SelfMulAdd(g*a,h)};b2.StackQueue=function(a){this.m_buffer=b2.MakeArray(a);this.m_end=a};b2.StackQueue.prototype.m_buffer=null;b2.StackQueue.prototype.m_front=0;b2.StackQueue.prototype.m_back=0;b2.StackQueue.prototype.m_capacity=0;
b2.StackQueue.prototype.Push=function(a){if(this.m_back>=this.m_capacity){for(var b=this.m_front;b<this.m_back;b++)this.m_buffer[b-this.m_front]=this.m_buffer[b];this.m_back-=this.m_front;this.m_front=0;this.m_back>=this.m_capacity&&(0<this.m_capacity?(this.m_buffer.concat(b2.MakeArray(this.m_capacity)),this.m_capacity*=2):(this.m_buffer.concat(b2.MakeArray(1)),this.m_capacity=1))}this.m_buffer[this.m_back]=a;this.m_back++};
b2.StackQueue.prototype.Pop=function(){b2.Assert(this.m_front<this.m_back);this.m_buffer[this.m_front]=null;this.m_front++};b2.StackQueue.prototype.Empty=function(){b2.Assert(this.m_front<=this.m_back);return this.m_front===this.m_back};b2.StackQueue.prototype.Front=function(){return this.m_buffer[this.m_front]};b2.VoronoiDiagram=function(a){this.m_generatorBuffer=b2.MakeArray(a,function(a){return new b2.VoronoiDiagram.Generator});this.m_generatorCapacity=a};goog.exportSymbol("b2.VoronoiDiagram",b2.VoronoiDiagram);b2.VoronoiDiagram.prototype.m_generatorBuffer=null;goog.exportProperty(b2.VoronoiDiagram.prototype,"m_generatorBuffer",b2.VoronoiDiagram.prototype.m_generatorBuffer);b2.VoronoiDiagram.prototype.m_generatorCapacity=0;
b2.VoronoiDiagram.prototype.m_generatorCount=0;b2.VoronoiDiagram.prototype.m_countX=0;b2.VoronoiDiagram.prototype.m_countY=0;b2.VoronoiDiagram.prototype.m_diagram=null;b2.VoronoiDiagram.Generator=function(){this.center=new b2.Vec2};b2.VoronoiDiagram.Generator.prototype.center=null;b2.VoronoiDiagram.Generator.prototype.tag=0;b2.VoronoiDiagram.b2VoronoiDiagramTask=function(a,b,c,d){this.m_x=a;this.m_y=b;this.m_i=c;this.m_generator=d};
b2.VoronoiDiagram.b2VoronoiDiagramTask.prototype.m_x=0;b2.VoronoiDiagram.b2VoronoiDiagramTask.prototype.m_y=0;b2.VoronoiDiagram.b2VoronoiDiagramTask.prototype.m_i=0;b2.VoronoiDiagram.b2VoronoiDiagramTask.prototype.m_generator=null;b2.VoronoiDiagram.prototype.AddGenerator=function(a,b,c){b2.Assert(this.m_generatorCount<this.m_generatorCapacity);var d=this.m_generatorBuffer[this.m_generatorCount++];d.center.Copy(a);d.tag=b;d.necessary=c};
goog.exportProperty(b2.VoronoiDiagram.prototype,"AddGenerator",b2.VoronoiDiagram.prototype.AddGenerator);
b2.VoronoiDiagram.prototype.Generate=function(a,b){b2.Assert(null===this.m_diagram);for(var c=1/a,d=new b2.Vec2(+b2._maxFloat,+b2._maxFloat),e=new b2.Vec2(-b2._maxFloat,-b2._maxFloat),f=0,g=0;g<this.m_generatorCount;g++){var h=this.m_generatorBuffer[g];h.necessary&&(b2.Min_V2_V2(d,h.center,d),b2.Max_V2_V2(e,h.center,e),++f)}if(0===f)this.m_countY=this.m_countX=0;else{d.x-=b;d.y-=b;e.x+=b;e.y+=b;this.m_countX=1+Math.floor(c*(e.x-d.x));this.m_countY=
1+Math.floor(c*(e.y-d.y));this.m_diagram=b2.MakeArray(this.m_countX*this.m_countY);e=new b2.StackQueue(4*this.m_countX*this.m_countY);for(g=0;g<this.m_generatorCount;g++){h=this.m_generatorBuffer[g];h.center.SelfSub(d).SelfMul(c);var f=Math.floor(h.center.x),k=Math.floor(h.center.y);0<=f&&0<=k&&f<this.m_countX&&k<this.m_countY&&e.Push(new b2.VoronoiDiagram.b2VoronoiDiagramTask(f,k,f+k*this.m_countX,h))}for(;!e.Empty();)g=e.Front(),f=g.m_x,k=g.m_y,c=g.m_i,h=g.m_generator,e.Pop(),this.m_diagram[c]||
(this.m_diagram[c]=h,0<f&&e.Push(new b2.VoronoiDiagram.b2VoronoiDiagramTask(f-1,k,c-1,h)),0<k&&e.Push(new b2.VoronoiDiagram.b2VoronoiDiagramTask(f,k-1,c-this.m_countX,h)),f<this.m_countX-1&&e.Push(new b2.VoronoiDiagram.b2VoronoiDiagramTask(f+1,k,c+1,h)),k<this.m_countY-1&&e.Push(new b2.VoronoiDiagram.b2VoronoiDiagramTask(f,k+1,c+this.m_countX,h)));for(k=0;k<this.m_countY;k++)for(f=0;f<this.m_countX-1;f++)c=f+k*this.m_countX,d=this.m_diagram[c],g=this.m_diagram[c+1],d!==g&&(e.Push(new b2.VoronoiDiagram.b2VoronoiDiagramTask(f,
k,c,g)),e.Push(new b2.VoronoiDiagram.b2VoronoiDiagramTask(f+1,k,c+1,d)));for(k=0;k<this.m_countY-1;k++)for(f=0;f<this.m_countX;f++)c=f+k*this.m_countX,d=this.m_diagram[c],g=this.m_diagram[c+this.m_countX],d!==g&&(e.Push(new b2.VoronoiDiagram.b2VoronoiDiagramTask(f,k,c,g)),e.Push(new b2.VoronoiDiagram.b2VoronoiDiagramTask(f,k+1,c+this.m_countX,d)));for(;!e.Empty();)if(g=e.Front(),f=g.m_x,k=g.m_y,c=g.m_i,g=g.m_generator,e.Pop(),d=this.m_diagram[c],d!==g){var h=d.center.x-f,d=d.center.y-
k,l=g.center.x-f,m=g.center.y-k;h*h+d*d>l*l+m*m&&(this.m_diagram[c]=g,0<f&&e.Push(new b2.VoronoiDiagram.b2VoronoiDiagramTask(f-1,k,c-1,g)),0<k&&e.Push(new b2.VoronoiDiagram.b2VoronoiDiagramTask(f,k-1,c-this.m_countX,g)),f<this.m_countX-1&&e.Push(new b2.VoronoiDiagram.b2VoronoiDiagramTask(f+1,k,c+1,g)),k<this.m_countY-1&&e.Push(new b2.VoronoiDiagram.b2VoronoiDiagramTask(f,k+1,c+this.m_countX,g)))}}};goog.exportProperty(b2.VoronoiDiagram.prototype,"Generate",b2.VoronoiDiagram.prototype.Generate);
b2.VoronoiDiagram.prototype.GetNodes=function(a){for(var b=0;b<this.m_countY-1;b++)for(var c=0;c<this.m_countX-1;c++){var d=c+b*this.m_countX,e=this.m_diagram[d],f=this.m_diagram[d+1],g=this.m_diagram[d+this.m_countX],d=this.m_diagram[d+1+this.m_countX];f!==g&&(e!==f&&e!==g&&(e.necessary||f.necessary||g.necessary)&&a(e.tag,f.tag,g.tag),d!==f&&d!==g&&(e.necessary||f.necessary||g.necessary)&&a(f.tag,d.tag,g.tag))}};goog.exportProperty(b2.VoronoiDiagram.prototype,"GetNodes",b2.VoronoiDiagram.prototype.GetNodes);b2.RopeDef=function(){this.vertices=[];this.masses=[];this.gravity=new b2.Vec2};goog.exportSymbol("b2.RopeDef",b2.RopeDef);b2.RopeDef.prototype.vertices=null;b2.RopeDef.prototype.count=0;b2.RopeDef.prototype.masses=null;b2.RopeDef.prototype.gravity=null;b2.RopeDef.prototype.damping=.1;b2.RopeDef.prototype.k2=.9;b2.RopeDef.prototype.k3=.1;b2.Rope=function(){this.m_gravity=new b2.Vec2};goog.exportSymbol("b2.Rope",b2.Rope);
b2.Rope.prototype.m_count=0;b2.Rope.prototype.m_ps=null;b2.Rope.prototype.m_p0s=null;b2.Rope.prototype.m_vs=null;b2.Rope.prototype.m_ims=null;b2.Rope.prototype.m_Ls=null;b2.Rope.prototype.m_as=null;b2.Rope.prototype.m_gravity=null;b2.Rope.prototype.m_damping=0;b2.Rope.prototype.m_k2=1;b2.Rope.prototype.m_k3=.1;b2.Rope.prototype.GetVertexCount=function(){return this.m_count};goog.exportProperty(b2.Rope.prototype,"GetVertexCount",b2.Rope.prototype.GetVertexCount);
b2.Rope.prototype.GetVertices=function(){return this.m_ps};goog.exportProperty(b2.Rope.prototype,"GetVertices",b2.Rope.prototype.GetVertices);
b2.Rope.prototype.Initialize=function(a){b2.ENABLE_ASSERTS&&b2.Assert(3<=a.count);this.m_count=a.count;this.m_ps=b2.Vec2.MakeArray(this.m_count);this.m_p0s=b2.Vec2.MakeArray(this.m_count);this.m_vs=b2.Vec2.MakeArray(this.m_count);this.m_ims=b2.MakeNumberArray(this.m_count);for(var b=0;b<this.m_count;++b){this.m_ps[b].Copy(a.vertices[b]);this.m_p0s[b].Copy(a.vertices[b]);this.m_vs[b].SetZero();var c=a.masses[b];this.m_ims[b]=0<c?1/c:0}var d=this.m_count-1,c=this.m_count-
2;this.m_Ls=b2.MakeNumberArray(d);this.m_as=b2.MakeNumberArray(c);for(b=0;b<d;++b){var e=this.m_ps[b],f=this.m_ps[b+1];this.m_Ls[b]=b2.Distance(e,f)}for(b=0;b<c;++b)e=this.m_ps[b],f=this.m_ps[b+1],d=this.m_ps[b+2],e=b2.Sub_V2_V2(f,e,b2.Vec2.s_t0),d=b2.Sub_V2_V2(d,f,b2.Vec2.s_t1),f=b2.Cross_V2_V2(e,d),e=b2.Dot_V2_V2(e,d),this.m_as[b]=b2.Atan2(f,e);this.m_gravity.Copy(a.gravity);this.m_damping=a.damping;this.m_k2=a.k2;this.m_k3=a.k3};
goog.exportProperty(b2.Rope.prototype,"Initialize",b2.Rope.prototype.Initialize);
b2.Rope.prototype.Step=function(a,b){if(0!==a){for(var c=Math.exp(-a*this.m_damping),d=0;d<this.m_count;++d)this.m_p0s[d].Copy(this.m_ps[d]),0<this.m_ims[d]&&this.m_vs[d].SelfMulAdd(a,this.m_gravity),this.m_vs[d].SelfMul(c),this.m_ps[d].SelfMulAdd(a,this.m_vs[d]);for(d=0;d<b;++d)this.SolveC2(),this.SolveC3(),this.SolveC2();c=1/a;for(d=0;d<this.m_count;++d)b2.Mul_S_V2(c,b2.Sub_V2_V2(this.m_ps[d],this.m_p0s[d],b2.Vec2.s_t0),this.m_vs[d])}};
goog.exportProperty(b2.Rope.prototype,"Step",b2.Rope.prototype.Step);b2.Rope.prototype.SolveC2=function(){for(var a=this.m_count-1,b=0;b<a;++b){var c=this.m_ps[b],d=this.m_ps[b+1],e=b2.Sub_V2_V2(d,c,b2.Rope.s_d),f=e.Normalize(),g=this.m_ims[b],h=this.m_ims[b+1];if(0!==g+h){var k=h/(g+h);c.SelfMulSub(g/(g+h)*this.m_k2*(this.m_Ls[b]-f),e);d.SelfMulAdd(this.m_k2*k*(this.m_Ls[b]-f),e)}}};goog.exportProperty(b2.Rope.prototype,"SolveC2",b2.Rope.prototype.SolveC2);
b2.Rope.s_d=new b2.Vec2;b2.Rope.prototype.SetAngle=function(a){for(var b=this.m_count-2,c=0;c<b;++c)this.m_as[c]=a};goog.exportProperty(b2.Rope.prototype,"SetAngle",b2.Rope.prototype.SetAngle);
b2.Rope.prototype.SolveC3=function(){for(var a=this.m_count-2,b=0;b<a;++b){var c=this.m_ps[b],d=this.m_ps[b+1],e=this.m_ps[b+2],f=this.m_ims[b],g=this.m_ims[b+1],h=this.m_ims[b+2],k=b2.Sub_V2_V2(d,c,b2.Rope.s_d1),l=b2.Sub_V2_V2(e,d,b2.Rope.s_d2),m=k.LengthSquared(),n=l.LengthSquared();if(0!==m*n){var p=b2.Cross_V2_V2(k,l),q=b2.Dot_V2_V2(k,l),p=b2.Atan2(p,q),k=b2.Mul_S_V2(-1/m,k.SelfSkew(),b2.Rope.s_Jd1),m=b2.Mul_S_V2(1/n,l.SelfSkew(),b2.Rope.s_Jd2),
l=b2.Rope.s_J1.Copy(k).SelfNeg(),n=b2.Sub_V2_V2(k,m,b2.Rope.s_J2),k=m,m=f*b2.Dot_V2_V2(l,l)+g*b2.Dot_V2_V2(n,n)+h*b2.Dot_V2_V2(k,k);if(0!==m){m=1/m;for(q=p-this.m_as[b];q>b2._pi;)p-=2*b2._pi,q=p-this.m_as[b];for(;q<-b2._pi;)p+=2*b2._pi,q=p-this.m_as[b];p=-this.m_k3*m*q;c.SelfMulAdd(f*p,l);d.SelfMulAdd(g*p,n);e.SelfMulAdd(h*p,k)}}}};goog.exportProperty(b2.Rope.prototype,"SolveC3",b2.Rope.prototype.SolveC3);b2.Rope.s_d1=new b2.Vec2;
b2.Rope.s_d2=new b2.Vec2;b2.Rope.s_Jd1=new b2.Vec2;b2.Rope.s_Jd2=new b2.Vec2;b2.Rope.s_J1=new b2.Vec2;b2.Rope.s_J2=new b2.Vec2;b2.Rope.prototype.Draw=function(a){for(var b=new b2.Color(.4,.5,.7),c=0;c<this.m_count-1;++c)a.DrawSegment(this.m_ps[c],this.m_ps[c+1],b)};goog.exportProperty(b2.Rope.prototype,"Draw",b2.Rope.prototype.Draw);b2.ControllerEdge=function(){};goog.exportSymbol("b2.ControllerEdge",b2.ControllerEdge);b2.ControllerEdge.prototype.controller=null;goog.exportProperty(b2.ControllerEdge.prototype,"controller",b2.ControllerEdge.prototype.controller);b2.ControllerEdge.prototype.body=null;goog.exportProperty(b2.ControllerEdge.prototype,"body",b2.ControllerEdge.prototype.body);b2.ControllerEdge.prototype.prevBody=null;
goog.exportProperty(b2.ControllerEdge.prototype,"prevBody",b2.ControllerEdge.prototype.prevBody);b2.ControllerEdge.prototype.nextBody=null;goog.exportProperty(b2.ControllerEdge.prototype,"nextBody",b2.ControllerEdge.prototype.nextBody);b2.ControllerEdge.prototype.prevController=null;goog.exportProperty(b2.ControllerEdge.prototype,"prevController",b2.ControllerEdge.prototype.prevController);b2.ControllerEdge.prototype.nextController=null;
goog.exportProperty(b2.ControllerEdge.prototype,"nextController",b2.ControllerEdge.prototype.nextController);b2.Controller=function(){};goog.exportSymbol("b2.Controller",b2.Controller);b2.Controller.prototype.m_world=null;goog.exportProperty(b2.Controller.prototype,"m_world",b2.Controller.prototype.m_world);b2.Controller.prototype.m_bodyList=null;goog.exportProperty(b2.Controller.prototype,"m_bodyList",b2.Controller.prototype.m_bodyList);
b2.Controller.prototype.m_bodyCount=0;goog.exportProperty(b2.Controller.prototype,"m_bodyCount",b2.Controller.prototype.m_bodyCount);b2.Controller.prototype.m_prev=null;goog.exportProperty(b2.Controller.prototype,"m_prev",b2.Controller.prototype.m_prev);b2.Controller.prototype.m_next=null;goog.exportProperty(b2.Controller.prototype,"m_next",b2.Controller.prototype.m_next);b2.Controller.prototype.Step=function(a){};
goog.exportProperty(b2.Controller.prototype,"Step",b2.Controller.prototype.Step);b2.Controller.prototype.Draw=function(a){};goog.exportProperty(b2.Controller.prototype,"Draw",b2.Controller.prototype.Draw);b2.Controller.prototype.GetNext=function(){return this.m_next};goog.exportProperty(b2.Controller.prototype,"GetNext",b2.Controller.prototype.GetNext);b2.Controller.prototype.GetPrev=function(){return this.m_prev};
goog.exportProperty(b2.Controller.prototype,"GetPrev",b2.Controller.prototype.GetPrev);b2.Controller.prototype.GetWorld=function(){return this.m_world};goog.exportProperty(b2.Controller.prototype,"GetWorld",b2.Controller.prototype.GetWorld);b2.Controller.prototype.GetBodyList=function(){return this.m_bodyList};goog.exportProperty(b2.Controller.prototype,"GetBodyList",b2.Controller.prototype.GetBodyList);
b2.Controller.prototype.AddBody=function(a){var b=new b2.ControllerEdge;b.body=a;b.controller=this;b.nextBody=this.m_bodyList;b.prevBody=null;this.m_bodyList&&(this.m_bodyList.prevBody=b);this.m_bodyList=b;++this.m_bodyCount;b.nextController=a.m_controllerList;b.prevController=null;a.m_controllerList&&(a.m_controllerList.prevController=b);a.m_controllerList=b;++a.m_controllerCount};goog.exportProperty(b2.Controller.prototype,"AddBody",b2.Controller.prototype.AddBody);
b2.Controller.prototype.RemoveBody=function(a){b2.ENABLE_ASSERTS&&b2.Assert(0<this.m_bodyCount);for(var b=this.m_bodyList;b&&b.body!==a;)b=b.nextBody;b2.ENABLE_ASSERTS&&b2.Assert(null!==b);b.prevBody&&(b.prevBody.nextBody=b.nextBody);b.nextBody&&(b.nextBody.prevBody=b.prevBody);this.m_bodyList===b&&(this.m_bodyList=b.nextBody);--this.m_bodyCount;b.nextController&&(b.nextController.prevController=b.prevController);b.prevController&&(b.prevController.nextController=b.nextController);
a.m_controllerList===b&&(a.m_controllerList=b.nextController);--a.m_controllerCount};goog.exportProperty(b2.Controller.prototype,"RemoveBody",b2.Controller.prototype.RemoveBody);b2.Controller.prototype.Clear=function(){for(;this.m_bodyList;)this.RemoveBody(this.m_bodyList.body);this.m_bodyCount=0};goog.exportProperty(b2.Controller.prototype,"Clear",b2.Controller.prototype.Clear);b2.BuoyancyController=function(){b2.Controller.call(this);this.normal=new b2.Vec2(0,1);this.velocity=new b2.Vec2(0,0);this.gravity=new b2.Vec2(0,0)};goog.inherits(b2.BuoyancyController,b2.Controller);goog.exportSymbol("b2.BuoyancyController",b2.BuoyancyController);b2.BuoyancyController.prototype.normal=null;goog.exportProperty(b2.BuoyancyController.prototype,"normal",b2.BuoyancyController.prototype.normal);
b2.BuoyancyController.prototype.offset=0;goog.exportProperty(b2.BuoyancyController.prototype,"offset",b2.BuoyancyController.prototype.offset);b2.BuoyancyController.prototype.density=0;goog.exportProperty(b2.BuoyancyController.prototype,"density",b2.BuoyancyController.prototype.density);b2.BuoyancyController.prototype.velocity=null;goog.exportProperty(b2.BuoyancyController.prototype,"velocity",b2.BuoyancyController.prototype.velocity);
b2.BuoyancyController.prototype.linearDrag=0;goog.exportProperty(b2.BuoyancyController.prototype,"linearDrag",b2.BuoyancyController.prototype.linearDrag);b2.BuoyancyController.prototype.angularDrag=0;goog.exportProperty(b2.BuoyancyController.prototype,"angularDrag",b2.BuoyancyController.prototype.angularDrag);b2.BuoyancyController.prototype.useDensity=!1;goog.exportProperty(b2.BuoyancyController.prototype,"useDensity",b2.BuoyancyController.prototype.useDensity);
b2.BuoyancyController.prototype.useWorldGravity=!0;goog.exportProperty(b2.BuoyancyController.prototype,"useWorldGravity",b2.BuoyancyController.prototype.useWorldGravity);b2.BuoyancyController.prototype.gravity=null;goog.exportProperty(b2.BuoyancyController.prototype,"gravity",b2.BuoyancyController.prototype.gravity);
b2.BuoyancyController.prototype.Step=function(a){if(this.m_bodyList)for(this.useWorldGravity&&this.gravity.Copy(this.GetWorld().GetGravity()),a=this.m_bodyList;a;a=a.nextBody){var b=a.body;if(b.IsAwake()){for(var c=new b2.Vec2,d=new b2.Vec2,e=0,f=0,g=b.GetFixtureList();g;g=g.m_next){var h=new b2.Vec2,k=g.GetShape().ComputeSubmergedArea(this.normal,this.offset,b.GetTransform(),h),e=e+k;c.x+=k*h.x;c.y+=k*h.y;var l=0,l=this.useDensity?g.GetDensity():1,f=f+k*l;d.x+=k*h.x*l;d.y+=k*
h.y*l}c.x/=e;c.y/=e;d.x/=f;d.y/=f;e<b2._epsilon||(f=this.gravity.Clone().SelfNeg(),f.SelfMul(this.density*e),b.ApplyForce(f,d),d=b.GetLinearVelocityFromWorldPoint(c,new b2.Vec2),d.SelfSub(this.velocity),d.SelfMul(-this.linearDrag*e),b.ApplyForce(d,c),b.ApplyTorque(-b.GetInertia()/b.GetMass()*e*b.GetAngularVelocity()*this.angularDrag))}}};goog.exportProperty(b2.BuoyancyController.prototype,"Step",b2.BuoyancyController.prototype.Step);
b2.BuoyancyController.prototype.Draw=function(a){var b=new b2.Vec2,c=new b2.Vec2;b.x=this.normal.x*this.offset+100*this.normal.y;b.y=this.normal.y*this.offset-100*this.normal.x;c.x=this.normal.x*this.offset-100*this.normal.y;c.y=this.normal.y*this.offset+100*this.normal.x;var d=new b2.Color(0,0,.8);a.DrawSegment(b,c,d)};goog.exportProperty(b2.BuoyancyController.prototype,"Draw",b2.BuoyancyController.prototype.Draw);b2.ConstantAccelController=function(){b2.Controller.call(this);this.A=new b2.Vec2(0,0)};goog.inherits(b2.ConstantAccelController,b2.Controller);goog.exportSymbol("b2.ConstantAccelController",b2.ConstantAccelController);b2.ConstantAccelController.prototype.A=null;goog.exportProperty(b2.ConstantAccelController.prototype,"A",b2.ConstantAccelController.prototype.A);
b2.ConstantAccelController.prototype.Step=function(a){a=b2.Mul_S_V2(a.dt,this.A,b2.ConstantAccelController.prototype.Step.s_dtA);for(var b=this.m_bodyList;b;b=b.nextBody){var c=b.body;c.IsAwake()&&c.SetLinearVelocity(b2.Add_V2_V2(c.GetLinearVelocity(),a,b2.Vec2.s_t0))}};goog.exportProperty(b2.ConstantAccelController.prototype,"Step",b2.ConstantAccelController.prototype.Step);b2.ConstantAccelController.prototype.Step.s_dtA=new b2.Vec2;b2.ConstantForceController=function(){b2.Controller.call(this);this.F=new b2.Vec2(0,0)};goog.inherits(b2.ConstantForceController,b2.Controller);goog.exportSymbol("b2.ConstantForceController",b2.ConstantForceController);b2.ConstantAccelController.prototype.F=null;goog.exportProperty(b2.ConstantAccelController.prototype,"F",b2.ConstantAccelController.prototype.F);
b2.ConstantForceController.prototype.Step=function(a){for(a=this.m_bodyList;a;a=a.nextBody){var b=a.body;b.IsAwake()&&b.ApplyForce(this.F,b.GetWorldCenter())}};goog.exportProperty(b2.ConstantForceController.prototype,"Step",b2.ConstantForceController.prototype.Step);b2.GravityController=function(){b2.Controller.call(this)};goog.inherits(b2.GravityController,b2.Controller);goog.exportSymbol("b2.GravityController",b2.GravityController);b2.GravityController.prototype.G=1;goog.exportProperty(b2.GravityController.prototype,"G",b2.GravityController.prototype.G);b2.GravityController.prototype.invSqr=!0;goog.exportProperty(b2.GravityController.prototype,"invSqr",b2.GravityController.prototype.invSqr);
b2.GravityController.prototype.Step=function(a){if(this.invSqr)for(a=this.m_bodyList;a;a=a.nextBody)for(var b=a.body,c=b.GetWorldCenter(),d=b.GetMass(),e=this.m_bodyList;e!==a;e=e.nextBody){var f=e.body,g=f.GetWorldCenter(),h=f.GetMass(),k=g.x-c.x,l=g.y-c.y,m=k*k+l*l;m<b2._epsilon||(k=b2.GravityController.prototype.Step.s_f.Set(k,l),k.SelfMul(this.G/m/b2.Sqrt(m)*d*h),b.IsAwake()&&b.ApplyForce(k,c),f.IsAwake()&&f.ApplyForce(k.SelfMul(-1),g))}else for(a=this.m_bodyList;a;a=a.nextBody)for(b=
a.body,c=b.GetWorldCenter(),d=b.GetMass(),e=this.m_bodyList;e!==a;e=e.nextBody)f=e.body,g=f.GetWorldCenter(),h=f.GetMass(),k=g.x-c.x,l=g.y-c.y,m=k*k+l*l,m<b2._epsilon||(k=b2.GravityController.prototype.Step.s_f.Set(k,l),k.SelfMul(this.G/m*d*h),b.IsAwake()&&b.ApplyForce(k,c),f.IsAwake()&&f.ApplyForce(k.SelfMul(-1),g))};goog.exportProperty(b2.GravityController.prototype,"Step",b2.GravityController.prototype.Step);b2.GravityController.prototype.Step.s_f=new b2.Vec2;b2.TensorDampingController=function(){b2.Controller.call(this);this.T=new b2.Mat22;this.maxTimestep=0};goog.inherits(b2.TensorDampingController,b2.Controller);goog.exportSymbol("b2.TensorDampingController",b2.TensorDampingController);b2.TensorDampingController.prototype.T=new b2.Mat22;goog.exportProperty(b2.TensorDampingController.prototype,"T",b2.TensorDampingController.prototype.T);b2.TensorDampingController.prototype.maxTimestep=0;
goog.exportProperty(b2.TensorDampingController.prototype,"maxTimestep",b2.TensorDampingController.prototype.maxTimestep);
b2.TensorDampingController.prototype.Step=function(a){a=a.dt;if(!(a<=b2._epsilon)){a>this.maxTimestep&&0<this.maxTimestep&&(a=this.maxTimestep);for(var b=this.m_bodyList;b;b=b.nextBody){var c=b.body;if(c.IsAwake()){var d=c.GetWorldVector(b2.Mul_M22_V2(this.T,c.GetLocalVector(c.GetLinearVelocity(),b2.Vec2.s_t0),b2.Vec2.s_t1),b2.TensorDampingController.prototype.Step.s_damping);c.SetLinearVelocity(b2.Add_V2_V2(c.GetLinearVelocity(),b2.Mul_S_V2(a,d,b2.Vec2.s_t0),
b2.Vec2.s_t1))}}}};b2.TensorDampingController.prototype.Step.s_damping=new b2.Vec2;b2.TensorDampingController.prototype.SetAxisAligned=function(a,b){this.T.ex.x=-a;this.T.ex.y=0;this.T.ey.x=0;this.T.ey.y=-b;this.maxTimestep=0<a||0<b?1/b2.Max(a,b):0};





},{}],34:[function(require,module,exports){
//     Underscore.js 1.4.4
//     http://underscorejs.org
//     (c) 2009-2013 Jeremy Ashkenas, DocumentCloud Inc.
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `global` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Establish the object that gets returned to break out of a loop iteration.
  var breaker = {};

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var push             = ArrayProto.push,
      slice            = ArrayProto.slice,
      concat           = ArrayProto.concat,
      toString         = ObjProto.toString,
      hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
    nativeReduce       = ArrayProto.reduce,
    nativeReduceRight  = ArrayProto.reduceRight,
    nativeFilter       = ArrayProto.filter,
    nativeEvery        = ArrayProto.every,
    nativeSome         = ArrayProto.some,
    nativeIndexOf      = ArrayProto.indexOf,
    nativeLastIndexOf  = ArrayProto.lastIndexOf,
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object via a string identifier,
  // for Closure Compiler "advanced" mode.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.4.4';

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles objects with the built-in `forEach`, arrays, and raw objects.
  // Delegates to **ECMAScript 5**'s native `forEach` if available.
  var each = _.each = _.forEach = function(obj, iterator, context) {
    if (obj == null) return;
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, l = obj.length; i < l; i++) {
        if (iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      for (var key in obj) {
        if (_.has(obj, key)) {
          if (iterator.call(context, obj[key], key, obj) === breaker) return;
        }
      }
    }
  };

  // Return the results of applying the iterator to each element.
  // Delegates to **ECMAScript 5**'s native `map` if available.
  _.map = _.collect = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    each(obj, function(value, index, list) {
      results[results.length] = iterator.call(context, value, index, list);
    });
    return results;
  };

  var reduceError = 'Reduce of empty array with no initial value';

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
  _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduce && obj.reduce === nativeReduce) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
    }
    each(obj, function(value, index, list) {
      if (!initial) {
        memo = value;
        initial = true;
      } else {
        memo = iterator.call(context, memo, value, index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
  _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
    }
    var length = obj.length;
    if (length !== +length) {
      var keys = _.keys(obj);
      length = keys.length;
    }
    each(obj, function(value, index, list) {
      index = keys ? keys[--length] : --length;
      if (!initial) {
        memo = obj[index];
        initial = true;
      } else {
        memo = iterator.call(context, memo, obj[index], index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, iterator, context) {
    var result;
    any(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to **ECMAScript 5**'s native `filter` if available.
  // Aliased as `select`.
  _.filter = _.select = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);
    each(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) results[results.length] = value;
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, iterator, context) {
    return _.filter(obj, function(value, index, list) {
      return !iterator.call(context, value, index, list);
    }, context);
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to **ECMAScript 5**'s native `every` if available.
  // Aliased as `all`.
  _.every = _.all = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = true;
    if (obj == null) return result;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(iterator, context);
    each(obj, function(value, index, list) {
      if (!(result = result && iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to **ECMAScript 5**'s native `some` if available.
  // Aliased as `any`.
  var any = _.some = _.any = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = false;
    if (obj == null) return result;
    if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);
    each(obj, function(value, index, list) {
      if (result || (result = iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `include`.
  _.contains = _.include = function(obj, target) {
    if (obj == null) return false;
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    return any(obj, function(value) {
      return value === target;
    });
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      return (isFunc ? method : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, function(value){ return value[key]; });
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs, first) {
    if (_.isEmpty(attrs)) return first ? null : [];
    return _[first ? 'find' : 'filter'](obj, function(value) {
      for (var key in attrs) {
        if (attrs[key] !== value[key]) return false;
      }
      return true;
    });
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.where(obj, attrs, true);
  };

  // Return the maximum element or (element-based computation).
  // Can't optimize arrays of integers longer than 65,535 elements.
  // See: https://bugs.webkit.org/show_bug.cgi?id=80797
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.max.apply(Math, obj);
    }
    if (!iterator && _.isEmpty(obj)) return -Infinity;
    var result = {computed : -Infinity, value: -Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed >= result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.min.apply(Math, obj);
    }
    if (!iterator && _.isEmpty(obj)) return Infinity;
    var result = {computed : Infinity, value: Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed < result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Shuffle an array.
  _.shuffle = function(obj) {
    var rand;
    var index = 0;
    var shuffled = [];
    each(obj, function(value) {
      rand = _.random(index++);
      shuffled[index - 1] = shuffled[rand];
      shuffled[rand] = value;
    });
    return shuffled;
  };

  // An internal function to generate lookup iterators.
  var lookupIterator = function(value) {
    return _.isFunction(value) ? value : function(obj){ return obj[value]; };
  };

  // Sort the object's values by a criterion produced by an iterator.
  _.sortBy = function(obj, value, context) {
    var iterator = lookupIterator(value);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value : value,
        index : index,
        criteria : iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index < right.index ? -1 : 1;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(obj, value, context, behavior) {
    var result = {};
    var iterator = lookupIterator(value || _.identity);
    each(obj, function(value, index) {
      var key = iterator.call(context, value, index, obj);
      behavior(result, key, value);
    });
    return result;
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = function(obj, value, context) {
    return group(obj, value, context, function(result, key, value) {
      (_.has(result, key) ? result[key] : (result[key] = [])).push(value);
    });
  };

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = function(obj, value, context) {
    return group(obj, value, context, function(result, key) {
      if (!_.has(result, key)) result[key] = 0;
      result[key]++;
    });
  };

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iterator, context) {
    iterator = iterator == null ? _.identity : lookupIterator(iterator);
    var value = iterator.call(context, obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = (low + high) >>> 1;
      iterator.call(context, array[mid]) < value ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Safely convert anything iterable into a real, live array.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (obj.length === +obj.length) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return (obj.length === +obj.length) ? obj.length : _.keys(obj).length;
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    return (n != null) && !guard ? slice.call(array, 0, n) : array[0];
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if ((n != null) && !guard) {
      return slice.call(array, Math.max(array.length - n, 0));
    } else {
      return array[array.length - 1];
    }
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, (n == null) || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, output) {
    each(input, function(value) {
      if (_.isArray(value)) {
        shallow ? push.apply(output, value) : flatten(value, shallow, output);
      } else {
        output.push(value);
      }
    });
    return output;
  };

  // Return a completely flattened version of an array.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iterator, context) {
    if (_.isFunction(isSorted)) {
      context = iterator;
      iterator = isSorted;
      isSorted = false;
    }
    var initial = iterator ? _.map(array, iterator, context) : array;
    var results = [];
    var seen = [];
    each(initial, function(value, index) {
      if (isSorted ? (!index || seen[seen.length - 1] !== value) : !_.contains(seen, value)) {
        seen.push(value);
        results.push(array[index]);
      }
    });
    return results;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(concat.apply(ArrayProto, arguments));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var rest = slice.call(arguments, 1);
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.indexOf(other, item) >= 0;
      });
    });
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = concat.apply(ArrayProto, slice.call(arguments, 1));
    return _.filter(array, function(value){ return !_.contains(rest, value); });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    var args = slice.call(arguments);
    var length = _.max(_.pluck(args, 'length'));
    var results = new Array(length);
    for (var i = 0; i < length; i++) {
      results[i] = _.pluck(args, "" + i);
    }
    return results;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    if (list == null) return {};
    var result = {};
    for (var i = 0, l = list.length; i < l; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
  // we need this function. Return the position of the first occurrence of an
  // item in an array, or -1 if the item is not included in the array.
  // Delegates to **ECMAScript 5**'s native `indexOf` if available.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i = 0, l = array.length;
    if (isSorted) {
      if (typeof isSorted == 'number') {
        i = (isSorted < 0 ? Math.max(0, l + isSorted) : isSorted);
      } else {
        i = _.sortedIndex(array, item);
        return array[i] === item ? i : -1;
      }
    }
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item, isSorted);
    for (; i < l; i++) if (array[i] === item) return i;
    return -1;
  };

  // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
  _.lastIndexOf = function(array, item, from) {
    if (array == null) return -1;
    var hasIndex = from != null;
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) {
      return hasIndex ? array.lastIndexOf(item, from) : array.lastIndexOf(item);
    }
    var i = (hasIndex ? from : array.length);
    while (i--) if (array[i] === item) return i;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = arguments[2] || 1;

    var len = Math.max(Math.ceil((stop - start) / step), 0);
    var idx = 0;
    var range = new Array(len);

    while(idx < len) {
      range[idx++] = start;
      start += step;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (func.bind === nativeBind && nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    var args = slice.call(arguments, 2);
    return function() {
      return func.apply(context, args.concat(slice.call(arguments)));
    };
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context.
  _.partial = function(func) {
    var args = slice.call(arguments, 1);
    return function() {
      return func.apply(this, args.concat(slice.call(arguments)));
    };
  };

  // Bind all of an object's methods to that object. Useful for ensuring that
  // all callbacks defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = slice.call(arguments, 1);
    if (funcs.length === 0) funcs = _.functions(obj);
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memo = {};
    hasher || (hasher = _.identity);
    return function() {
      var key = hasher.apply(this, arguments);
      return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
    };
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){ return func.apply(null, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time.
  _.throttle = function(func, wait) {
    var context, args, timeout, result;
    var previous = 0;
    var later = function() {
      previous = new Date;
      timeout = null;
      result = func.apply(context, args);
    };
    return function() {
      var now = new Date;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
      } else if (!timeout) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, result;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) result = func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) result = func.apply(context, args);
      return result;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = function(func) {
    var ran = false, memo;
    return function() {
      if (ran) return memo;
      ran = true;
      memo = func.apply(this, arguments);
      func = null;
      return memo;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return function() {
      var args = [func];
      push.apply(args, arguments);
      return wrapper.apply(this, args);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var funcs = arguments;
    return function() {
      var args = arguments;
      for (var i = funcs.length - 1; i >= 0; i--) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    if (times <= 0) return func();
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = nativeKeys || function(obj) {
    if (obj !== Object(obj)) throw new TypeError('Invalid object');
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys[keys.length] = key;
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var values = [];
    for (var key in obj) if (_.has(obj, key)) values.push(obj[key]);
    return values;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var pairs = [];
    for (var key in obj) if (_.has(obj, key)) pairs.push([key, obj[key]]);
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    for (var key in obj) if (_.has(obj, key)) result[obj[key]] = key;
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    each(keys, function(key) {
      if (key in obj) copy[key] = obj[key];
    });
    return copy;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    for (var key in obj) {
      if (!_.contains(keys, key)) copy[key] = obj[key];
    }
    return copy;
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          if (obj[prop] == null) obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the Harmony `egal` proposal: http://wiki.ecmascript.org/doku.php?id=harmony:egal.
    if (a === b) return a !== 0 || 1 / a == 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className != toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, dates, and booleans are compared by value.
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return a == String(b);
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
        // other numeric values.
        return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a == +b;
      // RegExps are compared by their source patterns and flags.
      case '[object RegExp]':
        return a.source == b.source &&
               a.global == b.global &&
               a.multiline == b.multiline &&
               a.ignoreCase == b.ignoreCase;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] == a) return bStack[length] == b;
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size = 0, result = true;
    // Recursively compare objects and arrays.
    if (className == '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size == b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
        }
      }
    } else {
      // Objects with different constructors are not equivalent, but `Object`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && (aCtor instanceof aCtor) &&
                               _.isFunction(bCtor) && (bCtor instanceof bCtor))) {
        return false;
      }
      // Deep compare objects.
      for (var key in a) {
        if (_.has(a, key)) {
          // Count the expected number of properties.
          size++;
          // Deep compare each member.
          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
        }
      }
      // Ensure that both objects contain the same number of properties.
      if (result) {
        for (key in b) {
          if (_.has(b, key) && !(size--)) break;
        }
        result = !size;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, [], []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) == '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    return obj === Object(obj);
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) == '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return !!(obj && _.has(obj, 'callee'));
    };
  }

  // Optimize `isFunction` if appropriate.
  if (typeof (/./) !== 'function') {
    _.isFunction = function(obj) {
      return typeof obj === 'function';
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj != +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  _.identity = function(value) {
    return value;
  };

  // Run a function **n** times.
  _.times = function(n, iterator, context) {
    var accum = Array(n);
    for (var i = 0; i < n; i++) accum[i] = iterator.call(context, i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // List of HTML entities for escaping.
  var entityMap = {
    escape: {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    }
  };
  entityMap.unescape = _.invert(entityMap.escape);

  // Regexes containing the keys and values listed immediately above.
  var entityRegexes = {
    escape:   new RegExp('[' + _.keys(entityMap.escape).join('') + ']', 'g'),
    unescape: new RegExp('(' + _.keys(entityMap.unescape).join('|') + ')', 'g')
  };

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  _.each(['escape', 'unescape'], function(method) {
    _[method] = function(string) {
      if (string == null) return '';
      return ('' + string).replace(entityRegexes[method], function(match) {
        return entityMap[method][match];
      });
    };
  });

  // If the value of the named property is a function then invoke it;
  // otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return null;
    var value = object[property];
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    each(_.functions(obj), function(name){
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result.call(this, func.apply(_, args));
      };
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\t':     't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  _.template = function(text, data, settings) {
    var render;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = new RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset)
        .replace(escaper, function(match) { return '\\' + escapes[match]; });

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      }
      if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      }
      if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }
      index = offset + match.length;
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + "return __p;\n";

    try {
      render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    if (data) return render(data, _);
    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled function source as a convenience for precompilation.
    template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function, which will delegate to the wrapper.
  _.chain = function(obj) {
    return _(obj).chain();
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(obj) {
    return this._chain ? _(obj).chain() : obj;
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name == 'shift' || name == 'splice') && obj.length === 0) delete obj[0];
      return result.call(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result.call(this, method.apply(this._wrapped, arguments));
    };
  });

  _.extend(_.prototype, {

    // Start chaining a wrapped Underscore object.
    chain: function() {
      this._chain = true;
      return this;
    },

    // Extracts the result from a wrapped and chained object.
    value: function() {
      return this._wrapped;
    }

  });

}).call(this);

},{}],35:[function(require,module,exports){
(function (global){
/// shim for browser packaging

module.exports = function() {
  return global.WebSocket || global.MozWebSocket;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],36:[function(require,module,exports){

/*
Copyright 2016 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

"use strict";
//---------------------------------------------------------------------------------
const LeapMotion        = require('./motion/leap');
const Swish             = require('./motion/swish');
const scaleGraph        = require('./motion/scale-graph');
const vec               = require('./motion/vec');
//---------------------------------------------------------------------------------
const Anypixel          = require('anypixel');
const b2                = require ('lucy-b2');
const ease              = require('./util/easing');
const CTXRenderer       = require('./rendering/CTXRenderer');
const SquishyLetters    = require('./display/SquishyLetters');


//---------------------------------------------------------------------------------
const ctx               = Anypixel.canvas.getContext2D();
const DRAW_FIXTURES     = false;
const DRAW_PARTICLES    = true;
const UPDATE_PHYSICS    = true;
const DRAW_LOOP         = true;
const PARTICLE_SIZE     = 1;
const THROW_MULTIPLIER  = 10;
const RESET_TIME        = 60 * 1000;
const BUTTON_EXEC       = 500;
const GRAVITY           = new b2.Vec2(0,0);

//---------------------------------------------------------------------------------

var app = new (function(){
    var isLiquid = false;

    console.log(LeapMotion);

	var _self = this,
        _windowWidth    = Anypixel.config.width,
        _windowHeight   =  Anypixel.config.height;

    LeapMotion.addConfig({
        width: _windowWidth,
        height: _windowHeight
    });

	var modifier   = 1;
	var world      = new b2.World ( GRAVITY );
    this.mouseVec  = undefined;
    this.seekHome  = true;
    this.buttonPresses = 0;
    this.renderOffset = {x:0,y:-42};
    this.easeTime = 0;
    ctx.canvas.style = "image-rendering: pixelated;";

	var squishyLetters = new SquishyLetters(b2,world);

	var debugDraw = new CTXRenderer(b2,ctx,10 * modifier);

    this.returnParticleCollisionGroup = function(group){
        if(group != undefined){
            this.clickGroup = group;
            return true;
        }
        return false;
    }

    this.getBodyAtMouse = function(mousePos){
        let _aabb = new b2.AABB();
            _aabb.lowerBound.Set(mousePos.x - 0.1, mousePos.y - 0.1);
            _aabb.upperBound.Set(mousePos.x + 0.1, mousePos.y + 0.1);
        this.clickGroup = undefined;
        squishyLetters.particleSystem.QueryAABB(new _self.getBodyCB(),_aabb);
    }

    this.getBodyCB = function(){
        this.ReportParticle = function(a,b,c){
            _self.returnParticleCollisionGroup( a.m_groupBuffer[b]);
            return true;
        }
    }

	this.draw = function(){
        if(UPDATE_PHYSICS){
    		world.Step ( 1/30, 1, 1 ); // normal speed
    		world.ClearForces();
        }

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = "black";
    	ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);

		// Draw Fixtures ––––––––––––––––––––––––––––––––––––––––––––––––––––––-
		if(DRAW_FIXTURES){
			for(let b = world.GetBodyList(); b != undefined; b = b.GetNext()){
				let transform = b.GetTransform();
				let pos = b.GetPosition();
				for(let f = b.GetFixtureList(); f != undefined; f = f.GetNext()){
					let s = f.GetShape();
					debugDraw.DrawPolygonWithTransform(
                        _graphics,transform,
                        s.m_vertices,
                        s.m_count,
                        0xffffff,
                        0xffffff
                    );
				}
			}
		}

		// Draw Particles ––––––––––––––––––––––––––––––––––––––––––––––––––––––
		if(DRAW_PARTICLES){
			for(let p = world.GetParticleSystemList(); p != undefined; p = p.GetNext()){
				for(let pg = 0; pg < p.m_count; pg++){
					let pgg = p.m_groupBuffer[pg];
					let pgTransform = pgg.GetTransform();
					let particle =	p.m_positionBuffer.data[pg];
					let color = pgg.GetUserData().color;
					debugDraw.DrawParticle(
                        pgTransform,
                        particle,
                        _self.renderOffset,
                        PARTICLE_SIZE * modifier,
                        true,
                        color
                    );
				}
			}
		}

        if(_self.renderOffset.y < 0){
            _self.renderOffset.y = -42 + (42 * ease('easeOutQuart',_self.easeTime));
            _self.easeTime += .08;
            if(_self.easeTime > 1) _self.easeTime = 1;
        }
	}

    this.checkIdlePos = function(){
        // if(_self.dragging !== true){
            for(let i=0; i < squishyLetters.letterBuffer.length; ++i){

                let _letter  = squishyLetters.letterBuffer[i];
                let _center  = _letter.GetCenter();
                let _sCenter = _letter.GetUserData().startCenter;
                if(_center.x != _sCenter.x || _center.y != _sCenter.y ){
                    let _xDif = (_sCenter.x - _center.x );
                    let _yDif = (_sCenter.y - _center.y);
                    _letter.ApplyLinearImpulse( new b2.Vec2(_xDif,_yDif));

                }
            }
        // }
    }

    this.startDrag = function(){
        _self.getBodyAtMouse(_self.mouseVec);
        _self.startMouse = _self.mouseVec;
        _self.dragging = true;
    }
    this.doDrag = function(){}
    this.stopDrag = function(){
        _self.dragging = false;
        if(this.clickGroup != undefined){
            var multiplier = THROW_MULTIPLIER
            if(isLiquid) multiplier = multiplier * 5;
            let _xDif = (_self.mouseVec.x - _self.startMouse.x) * multiplier;
            let _yDif = (_self.mouseVec.y - _self.startMouse.y) * multiplier;
            let _totalForce = Math.abs(_xDif) + Math.abs(_yDif);
            // console.log('_totalForce',_totalForce);
            console.log('isLiquid',isLiquid);
            if(_totalForce > 10){}
            if(_totalForce < 1){
                if(isLiquid){
                    this.clickGroup.ApplyLinearImpulse(
                        new b2.Vec2(1 - (Math.random() * 20),1 - (Math.random() * 40))
                    );
                }else{
                    this.clickGroup.ApplyLinearImpulse(
                        new b2.Vec2(1 - (Math.random() * 2),1 - (Math.random() * 2))
                    );
                }

            }else{
                this.clickGroup.ApplyLinearImpulse(
                    new b2.Vec2(_xDif,_yDif)
                );
            }
        }
    }
    this.clearScreen = function(){
        this.drawClear = true;
        this.clearCirc1 = 0;
        this.clearCirc2 = 0;
        this.clearCirc3 = 0;
        this.speed = 1;
        this.lettersNeedReset = true;
    }
    this.resetLetters = function(){
        isLiquid = false;
        world.SetGravity(new b2.Vec2(0,0));
        squishyLetters.destroy();
        squishyLetters = new SquishyLetters(b2,world);
        this.seekHome = true;
        this.lettersNeedReset = false;
        _self.buttonPresses = 0;
    }
    this.resetGraphics = function(){
        _clearGraphics.clear();
        this.drawClear = false;
    }

    this.makeItRain = function(){
        isLiquid = true;
        _self.buttonPresses = 0;
        squishyLetters.particleSystem.m_allParticleFlags = b2.ParticleFlag.waterParticle;
        world.SetGravity(new b2.Vec2(0,10));
        this.seekHome = false;
        for(let i=0; i < squishyLetters.letterBuffer.length; ++i) squishyLetters.letterBuffer[i].SetUserData({color:"#ffffff"});
    }

    this.dropLetters = function(){
        world.SetGravity(new b2.Vec2(0,10));
        world.DestroyBody(squishyLetters.wallsBody);
        this.seekHome = false;
        window.setTimeout(function(){
            _self.renderOffset.y = -42;
            _self.easeTime = 0;
            _self.resetLetters();
        },700);
    }

    LeapMotion.on('noaction', function(frame) {
        window.upTimer = window.setTimeout(function() {
            _self.stopDrag();
            window.clearTimeout(window.resetWatchTimer);
            window.resetWatchTimer = window.setTimeout(function(){
                _self.dropLetters();
            }, RESET_TIME);
        }, 100);
    });

    LeapMotion.on('action', function(hand, frame) {
        var grabStrength = hand.grabStrength * 100;
        var pos = hand.palmPosition;

        var canvasPosition = scaleGraph({
            width: _windowWidth,
            height: _windowHeight
        }, frame.interactionBox, pos[0], pos[2]);

        var cvec = vec.vec2i(canvasPosition);
        console.log('P(%s, %s)', cvec.x, cvec.z);

        _self.mouseVec = new b2.Vec2(cvec.x * 0.1, cvec.z * 0.1);
        _self.buttonPresses += 1;
        if(_self.dragging) _self.doDrag();
        else _self.startDrag();

        window.clearTimeout(window.upTimer);
        window.clearTimeout(window.resetWatchTimer);

        if(_self.buttonPresses > BUTTON_EXEC) _self.makeItRain();
    });

    document.addEventListener("keydown", function(e){
        // Reset on R
        if(e.keyCode === 82) _self.clearScreen();
        // Make it rain on M
        if(e.keyCode === 77) _self.makeItRain();
        // Drop letters on G
        if(e.keyCode === 71) _self.dropLetters();
        // console.log('e.keyCode',e.keyCode);
    });

// Update Loop
// ---------------------------------------------------------------------------------------
    this.checkCount = 0;
    this.updateLoop = function() {
		if(DRAW_LOOP) requestAnimationFrame(function(){ _self.updateLoop(); });
        _self.checkCount += 1
        if(_self.checkCount > 10 && _self.seekHome){
            _self.checkIdlePos();
            _self.checkCount = 0;
        }
        this.draw();
	}

    LeapMotion.listen();
	return this;
})();

app.updateLoop();

},{"./display/SquishyLetters":37,"./motion/leap":38,"./motion/scale-graph":39,"./motion/swish":40,"./motion/vec":41,"./rendering/CTXRenderer":42,"./util/easing":43,"anypixel":6,"lucy-b2":32}],37:[function(require,module,exports){

/*
Copyright 2016 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

"use strict";
//---------------------------------------------------------------------------------
var SquishyLetters = function(b2,world) {

    const CENTER_VEC2       = new b2.Vec2(7,2.2);
    const FLOOR_OFFSET_Y    = 2.1;
    const COLOR_BUFFER      = [ "#3761ff", "#e83a23", "#fdce00", "#3761ff", "#4dce22", "#e83a23" ];
    const LETTER_RADIUS     = 1;
    // const PARTIICLE_RADIUS = 0.09;
    const PARTIICLE_RADIUS = 0.08;
    // Create Empty letterBuffer

    this.letterBuffer = [];

    // Create Wall Body
    let _wallBodyDef = new b2.BodyDef();
    this.wallsBody = world.CreateBody(_wallBodyDef);
    this.wallsBody.SetPosition(CENTER_VEC2);

    //Create Wall Body Shapes
    let _floorShape = new b2.PolygonShape();
        _floorShape.SetAsBox(10,0.2, new b2.Vec2( 0,FLOOR_OFFSET_Y),0);
    this.wallsBody.CreateFixture(_floorShape, 0.0);

    let _leftWall = new b2.PolygonShape();
        _leftWall.SetAsBox(0.2,5, new b2.Vec2( -7.2,0),0);
    this.wallsBody.CreateFixture(_leftWall, 0.0);

    let _rightWall = new b2.PolygonShape();
        _leftWall.SetAsBox(0.2,5, new b2.Vec2( 7.2,0),0);
    this.wallsBody.CreateFixture(_leftWall, 0.0);

    let _roof = new b2.PolygonShape();
        _roof.SetAsBox(10,0.1, new b2.Vec2( 0,-FLOOR_OFFSET_Y),0);
    this.wallsBody.CreateFixture(_roof, 0.0);

    //Create Liquid Particle System
    let _particleSystemDef = new b2.ParticleSystemDef();
        _particleSystemDef.radius = PARTIICLE_RADIUS;
    this.particleSystem = world.CreateParticleSystem(_particleSystemDef);




    //Create Letters
    // -------------------------------------------------------------------------
    // G
    let _gScale = 0.5;
    let _gXOffset = 1.35;
    let _gYOffset = 2.2;

    let _gVerts1 = [
        new b2.Vec2((0  * _gScale) + _gXOffset,(0   * _gScale) + _gYOffset),
        new b2.Vec2((0  * _gScale) + _gXOffset,(-2  * _gScale) + _gYOffset),
        new b2.Vec2((-1 * _gScale) + _gXOffset ,(-2 * _gScale) + _gYOffset),
        new b2.Vec2((-2 * _gScale) + _gXOffset,(-1  * _gScale) + _gYOffset),
        new b2.Vec2((-2 * _gScale) + _gXOffset,(0   * _gScale) + _gYOffset)
    ];
    let _gOneShape1 = new b2.PolygonShape();
        _gOneShape1.Set(_gVerts1,_gVerts1.length);

    let _gVerts2 = [
        new b2.Vec2((2  * _gScale) + _gXOffset,(0 * _gScale) + _gYOffset),
        new b2.Vec2((-2 * _gScale) + _gXOffset,(0 * _gScale) + _gYOffset),
        new b2.Vec2((-2 * _gScale) + _gXOffset,(1 * _gScale) + _gYOffset),
        new b2.Vec2((-1 * _gScale) + _gXOffset,(2 * _gScale) + _gYOffset),
        new b2.Vec2((1  * _gScale) + _gXOffset,(2 * _gScale) + _gYOffset),
        new b2.Vec2((2  * _gScale) + _gXOffset,(1 * _gScale) + _gYOffset),
        new b2.Vec2((2  * _gScale) + _gXOffset,(0 * _gScale) + _gYOffset)
    ];
    let _gOneShape2 = new b2.PolygonShape();
        _gOneShape2.Set(_gVerts2,_gVerts2.length);


    let _gOneParticleDef = new b2.ParticleGroupDef();
        _gOneParticleDef.flags = b2.ParticleFlag.elasticParticle;
        _gOneParticleDef.groupFlags = b2.ParticleGroupFlag.solidParticleGroup;
        _gOneParticleDef.shapes = [_gOneShape1,_gOneShape2];
        _gOneParticleDef.shapeCount = _gOneParticleDef.shapes.length;
    this.gOneParticleGroup = this.particleSystem.CreateParticleGroup(_gOneParticleDef);
    this.gOneParticleGroup.SetUserData({
        color:COLOR_BUFFER[0],
        letter:'g1',
        startCenter: new b2.Vec2(this.gOneParticleGroup.GetCenter().x,this.gOneParticleGroup.GetCenter().y)
    });
    this.letterBuffer.push(this.gOneParticleGroup);

    // O
    let _oOneShape = new b2.CircleShape();
        _oOneShape.m_p.Set(3.6,1.9);
        _oOneShape.m_radius = LETTER_RADIUS;
    let _oOneParticleDef = new b2.ParticleGroupDef();
        _oOneParticleDef.flags = b2.ParticleFlag.elasticParticle;
        _oOneParticleDef.groupFlags = b2.ParticleGroupFlag.solidParticleGroup;
        _oOneParticleDef.shape = _oOneShape;
    this.oOneParticleGroup = this.particleSystem.CreateParticleGroup(_oOneParticleDef);
    this.oOneParticleGroup.SetUserData({
        color:COLOR_BUFFER[1],
        letter:'o1',
        startCenter: new b2.Vec2(this.oOneParticleGroup.GetCenter().x,this.oOneParticleGroup.GetCenter().y)
    });
    this.letterBuffer.push(this.oOneParticleGroup);

    // O
    let _oTwoShape = new b2.CircleShape();
        _oTwoShape.m_p.Set(5.9,2.2);
        _oTwoShape.m_radius = LETTER_RADIUS;
    let _oTwoParticleDef = new b2.ParticleGroupDef();
        _oTwoParticleDef.flags = b2.ParticleFlag.elasticParticle;
        _oTwoParticleDef.groupFlags = b2.ParticleGroupFlag.solidParticleGroup;
        _oTwoParticleDef.shape = _oTwoShape;
    this.oTwoParticleGroup = this.particleSystem.CreateParticleGroup(_oTwoParticleDef);
    this.oTwoParticleGroup.SetUserData({
        color:COLOR_BUFFER[2],
        letter:'o2',
        startCenter: new b2.Vec2(this.oTwoParticleGroup.GetCenter().x,this.oTwoParticleGroup.GetCenter().y)
    });
    this.letterBuffer.push(this.oTwoParticleGroup);

    // G

    let _g2Scale = 0.5;
    let _g2XOffset = 8.31;
    let _g2YOffset = 1.9;

    let _g2Verts1 = [
        new b2.Vec2((0  * _g2Scale) + _g2XOffset,(0   * _g2Scale) + _g2YOffset),
        new b2.Vec2((0  * _g2Scale) + _g2XOffset,(-2  * _g2Scale) + _g2YOffset),
        new b2.Vec2((-1 * _g2Scale) + _g2XOffset ,(-2 * _g2Scale) + _g2YOffset),
        new b2.Vec2((-2 * _g2Scale) + _g2XOffset,(-1  * _g2Scale) + _g2YOffset),
        new b2.Vec2((-2 * _g2Scale) + _g2XOffset,(0   * _g2Scale) + _g2YOffset)
    ];
    let _gTwoShape1 = new b2.PolygonShape();
        _gTwoShape1.Set(_g2Verts1,_gVerts1.length);

    let _g2Verts2 = [
        new b2.Vec2((2  * _g2Scale) + _g2XOffset,(0 * _g2Scale) + _g2YOffset),
        new b2.Vec2((-2 * _g2Scale) + _g2XOffset,(0 * _g2Scale) + _g2YOffset),
        new b2.Vec2((-2 * _g2Scale) + _g2XOffset,(1 * _g2Scale) + _g2YOffset),
        new b2.Vec2((-1 * _g2Scale) + _g2XOffset,(2 * _g2Scale) + _g2YOffset),
        new b2.Vec2((1  * _g2Scale) + _g2XOffset,(2 * _g2Scale) + _g2YOffset),
        new b2.Vec2((2  * _g2Scale) + _g2XOffset,(1 * _g2Scale) + _g2YOffset),
        new b2.Vec2((2  * _g2Scale) + _g2XOffset,(0 * _g2Scale) + _g2YOffset)
    ];
    let _gTwoShape2 = new b2.PolygonShape();
        _gTwoShape2.Set(_g2Verts2,_gVerts2.length);

    let _gTwoParticleDef = new b2.ParticleGroupDef();
        _gTwoParticleDef.flags = b2.ParticleFlag.elasticParticle;
        _gTwoParticleDef.groupFlags = b2.ParticleGroupFlag.solidParticleGroup;
        _gTwoParticleDef.shapes = [_gTwoShape1,_gTwoShape2];
        _gTwoParticleDef.shapeCount = _gOneParticleDef.shapes.length;
    this.gTwoParticleGroup = this.particleSystem.CreateParticleGroup(_gTwoParticleDef);
    this.gTwoParticleGroup.SetUserData({
        color:COLOR_BUFFER[3],
        letter:'g2',
        startCenter: new b2.Vec2(this.gTwoParticleGroup.GetCenter().x,this.gTwoParticleGroup.GetCenter().y)
    });
    this.letterBuffer.push(this.gTwoParticleGroup);

    // L
    let _lShape1 = new b2.PolygonShape();
        _lShape1.SetAsBox(0.3,1, new b2.Vec2( 10,2.2),0);
    let _lShape2 = new b2.PolygonShape();
        _lShape2.SetAsBox(0.5,0.3, new b2.Vec2( 10.6,2.9),0);

    let _lParticleDef = new b2.ParticleGroupDef();
        _lParticleDef.flags = b2.ParticleFlag.elasticParticle;
        _lParticleDef.groupFlags = b2.ParticleGroupFlag.solidParticleGroup;
        _lParticleDef.shapes = [_lShape1,_lShape2];
        _lParticleDef.shapeCount = _lParticleDef.shapes.length;
    this.lParticleGroup = this.particleSystem.CreateParticleGroup(_lParticleDef);
    this.lParticleGroup.SetUserData({
        color:COLOR_BUFFER[4],
        letter:'l',
        startCenter: new b2.Vec2(this.lParticleGroup.GetCenter().x,this.lParticleGroup.GetCenter().y)
    });
    this.letterBuffer.push(this.lParticleGroup);


    // E
    let _eShape1 = new b2.PolygonShape();
        _eShape1.SetAsBox(0.3,0.4, new b2.Vec2( 11.8,1.1),0);
    let _eShape2 = new b2.PolygonShape();
        _eShape2.SetAsBox(0.6,0.4, new b2.Vec2( 12.1,1.7),0);
    let _eShape3 = new b2.PolygonShape();
        _eShape3.SetAsBox(0.9,0.4, new b2.Vec2( 12.4,2.4),0);

    let _eParticleDef = new b2.ParticleGroupDef();
        _eParticleDef.flags = b2.ParticleFlag.elasticParticle;
        _eParticleDef.groupFlags = b2.ParticleGroupFlag.solidParticleGroup;
        _eParticleDef.shapes = [_eShape1,_eShape2,_eShape3];
        _eParticleDef.shapeCount = _eParticleDef.shapes.length;
    this.eParticleGroup = this.particleSystem.CreateParticleGroup(_eParticleDef);
    this.eParticleGroup.SetUserData({
        color:COLOR_BUFFER[5],
        letter:'e',
        startCenter: new b2.Vec2(this.eParticleGroup.GetCenter().x,this.eParticleGroup.GetCenter().y)
    });
    this.letterBuffer.push(this.eParticleGroup);


    this.gOneParticleGroup.ApplyLinearImpulse(new b2.Vec2(0,-.7));
    this.oOneParticleGroup.ApplyLinearImpulse(new b2.Vec2(0,.7));
    this.oTwoParticleGroup.ApplyLinearImpulse(new b2.Vec2(0,-.7));
    this.gTwoParticleGroup.ApplyLinearImpulse(new b2.Vec2(0,.7));
    this.lParticleGroup.ApplyLinearImpulse(new b2.Vec2(0,-.7));
    this.eParticleGroup.ApplyLinearImpulse(new b2.Vec2(0,.7));

    this.destroy = function(){
        for(let i=0; i < this.letterBuffer.length; ++i){
            this.particleSystem.DestroyParticleGroup(this.letterBuffer[i]);
        }
        world.DestroyParticleSystem(this.particleSystem);
        world.DestroyBody(this.wallsBody);
    }


    // let _waterShape = new b2.PsolygonShape();
    //     _waterShape.SetAsBox(14,0.8, new b2.Vec2(0,4),0);
    // let _waterParticleDef = new b2.ParticleGroupDef();
    //     _waterParticleDef.flags = b2.ParticleFlag.repusliveParticle;
    //     _waterParticleDef.groupFlags = b2.ParticleGroupFlag.solidParticleGroup;
    //     _waterParticleDef.shape = _waterShape;
    // this.waterParticleGroup = this.particleSystem.CreateParticleGroup(_waterParticleDef);
    // this.waterParticleGroup.SetUserData({color:0xffffff});

}

module.exports = SquishyLetters;

},{}],38:[function(require,module,exports){
let Instance = null;
let Leap = require('leapjs');
const utils = require('util');
const Emitter = require('events').EventEmitter;


function LeapMotion() {
    if(!Instance) {
        this.master = Leap;
        Instance = this;
    }

    return Instance;
}

utils.inherits(LeapMotion, Emitter);

LeapMotion.prototype.addConfig = function(config) {
    this.config = config;
};

LeapMotion.prototype.listen = function() {
    var self = this;

    self.master.loop(function(frame) {
        if(frame.hands[0]) {
            self.emit('action', frame.hands[0], frame);
        } else {
            self.emit('noaction', frame);
        }
    });

    self.master.loopController.setBackground(true);
};

exports = module.exports = new LeapMotion();

},{"events":1,"leapjs":23,"util":5}],39:[function(require,module,exports){
let scaleToPositive = (box, x, z) => {
    let result = {};

    result.x = box.size[0] + x;
    result.z = box.size[2] + z;

    result.x = result.x < 0 ? 0 : result.x;
    result.z = result.z < 0 ? 0 : result.z;

    return result;
};

let scaleRelative = (point, max, target) => {
    return point / max * target;
};

exports = module.exports = (canvas, box, x, z) => {
    let pos = scaleToPositive(box, x, z);

    let rel = {
        x: scaleRelative(pos.x, box.size[0] * 2, canvas.width),
        z: scaleRelative(pos.z, box.size[2] * 2, canvas.height)
    }

    return rel;
};

},{}],40:[function(require,module,exports){
function Swish() {
    var swish = this;
    this.lastPos = {
        x: null,
        y: null
    };

    swish.throwAround = function(position) {
        swish.lastPos.x = position[0];
        swish.lastPos.y = position[1];
    }
}

exports = module.exports = Swish;

},{}],41:[function(require,module,exports){
exports.vec2f = list => {
    if(Array.isArray(list)) {
        return {
            x: list[0],
            y: list[1],
            z: list[2]
        }
    }
};

exports.vec2i = list => {
    if(Array.isArray(list)) {

    } else {
        return {
            x: parseInt(list.x),
            y: parseInt(list.y) || null,
            z: parseInt(list.z)
        };
    }
}

},{}],42:[function(require,module,exports){

/*
Copyright 2016 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

"use strict";

function CTXRenderer(b2,ctx,scale) {

  var debugDraw = new b2.Draw();
  debugDraw.DrawPolygonWithTransform = function(graphics, transform, vertices, vertexCount, fill, color) {
    graphics.lineStyle(1, color, 1);
    if(fill) graphics.beginFill(color, 1);
    for(let tmpI =0;tmpI < vertexCount;tmpI++) {
      let vert = vertices[tmpI];
      let x = (vert.x + transform.p.x) * scale;
      let y = (vert.y + transform.p.y) * scale;
      if ( tmpI === 0 ){
        graphics.moveTo(x, y);
      }else{
        graphics.lineTo(x, y);
      }
    }
    if(fill) graphics.endFill();
  }



  debugDraw.DrawParticle = function( parentTransform, transform, renderOffset, radius, fill, color){

    ctx.fillStyle = color;
	ctx.fillRect(
        Math.round((parentTransform.p.x + transform.x) * scale - (radius * 0.5 ) + renderOffset.x),
        Math.round((parentTransform.p.y + transform.y) * scale - (radius * 0.5 ) + renderOffset.y),
        Math.round(radius * 2),
        Math.round(radius * 2)
     );
  }

  return debugDraw;
}

module.exports = CTXRenderer;

},{}],43:[function(require,module,exports){

/*
Copyright 2016 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

var Ease = function(type, time) {
    switch(type) {
    	case 'easeInQuad':      return time * time; // accelerating from zero velocity
    	case 'easeOutQuad':     return time * (2 - time); // decelerating to zero velocity
    	case 'easeInOutQuad':   return time < 0.5 ? 2 * time * time : -1 + (4 - 2 * time) * time; // acceleration until halfway, then deceleration
    	case 'easeInCubic':     return time * time * time; // accelerating from zero velocity
    	case 'easeOutCubic':    return (--time) * time * time + 1; // decelerating to zero velocity
    	case 'easeInOutCubic':  return time < 0.5 ? 4 * time * time * time : (time - 1) * (2 * time - 2) * (2 * time - 2) + 1; // acceleration until halfway, then deceleration
    	case 'easeInQuart':     return time * time * time * time; // accelerating from zero velocity
    	case 'easeOutQuart':    return 1 - (--time) * time * time * time; // decelerating to zero velocity
    	case 'easeInOutQuart':  return time < 0.5 ? 8 * time * time * time * time : 1 - 8 * (--time) * time * time * time; // acceleration until halfway, then deceleration
    	case 'easeInQuint':     return time * time * time * time * time; // accelerating from zero velocity
    	case 'easeOutQuint':    return 1 + (--time) * time * time * time * time; // decelerating to zero velocity
    	case 'easeInOutQuint':  return time < 0.5 ? 16 * time * time * time * time * time : 1 + 16 * (--time) * time * time * time * time; // acceleration until halfway, then deceleration
    	default:                return time;
    }
};

module.exports = Ease;

},{}]},{},[36]);
