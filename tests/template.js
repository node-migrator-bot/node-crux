
var fs       = require('fs');
var path     = require('path');
var wrench   = require('wrench');
var assert   = require('assert');
var testing  = require('./testing');

// The temporary test directory
var TEMP = path.join(__dirname, 'temp');

// Make sure temp doesn't already exist
path.exists(TEMP, function(exists) {
	if (exists) {
		destroyTemp(run);
	} else {
		run();
	}
});

// ------------------------------------------------------------------
//  Define the tests

function run() {

	// ------------------------------------------------------------------
	//  crux template create
	
	testing.define(function(done) {
		// Create the directory for the new template
		fs.mkdir(TEMP, function(err) {
			assert.ifError(err);
			assert.ok(false, 'HI');
			done();
		});
	});
	
	// ------------------------------------------------------------------
	//  Cleanup
	
	testing.finished(function(done) {
		destroyTemp(done);
	});
	
}

// ------------------------------------------------------------------
//  Helpers

function destroyTemp(callback) {
	wrench.rmdirRecursive(TEMP, function(err) {
		if (err) {throw err;}
		callback();
	});
}


