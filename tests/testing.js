
var path = require('path');
var childProcess = require('child_process');

// The crux executable
var CRUX = path.join(__dirname, '../bin/crux.js');

// Runs a crux command
exports.run = function(args, opts, callback) {
	opts = opts || { };
	childProcess.execFile(CRUX, args, opts, callback);
};

// ------------------------------------------------------------------
//  Testing stuff

var queue     = [ ];
var errors    = [ ];
var finished  = false;
var current   = null;

// Defines a new test
exports.define = function(test) {
	queue.push(test);
	process.nextTick(next);
};

// Tells us that there are no more tests
exports.finished = function(cleanup) {
	finished = true;
	exports.define(cleanup);
};

// Runs the next test if any
function next() {
	if (! current) {
		if (queue.length) {
			var done = current = function() {
				done = function() { };
				current = null;
				next();
			};
			(queue.shift())(function() {
				done();
			});
		} else if (finished) {
			errors.forEach(function(err) {
				console.log(err);
			});
			console.log('Tests finished. ' + errors.length + ' assertions failed.');
		}
	}
}

// Catch errors
process.on('uncaughtException', function(err) {
	errors.push(err);
	if (current) {current();}
});

