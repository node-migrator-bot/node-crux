#!/usr/bin/env node

var fs      = require('fs');
var path    = require('path');
var wrench  = require('wrench');

var BASE_PATH      = path.join(__dirname, '..');
var TEMPLATE_PATH  = path.join(BASE_PATH, 'template');

var args = process.argv.slice(2);

switch (args.shift()) {
	
	// builder init [directory]
	case 'init':
		var CREATION_PATH = path.join(process.cwd(), (args[0] || '.'));
		// Make sure the template exists
		path.exists(TEMPLATE_PATH, function(exists) {
			if (! exists) {
				throw 'Template path not found';
			}
			// Copy the template to the new location
			wrench.copyDirSyncRecursive(TEMPLATE_PATH, CREATION_PATH, function(err) {
				if (err) {
					throw err;
				}
			});
		});
	break;
	
	// builder migrate [up|down|create]
	case 'migrate':
		var MIGRATE_PATH = path.join(BASE_PATH, 'node_modules/migrate/bin/migrate');
		var PROJECT_PATH = findUpTree(process.cwd(), 'migrations', function(file) {
			return fs.statSync(file).isDirectory();
		});
		process.chdir(PROJECT_PATH);
		require('./migrate').run(args);
	break;
	
	// builder [...]
	default:
		console.log('Invalid use');
	break;
	
}

// Find the first directory up the tree which contains a matching file
function findUpTree(findIn, find, otherTest) {
	otherTest = (typeof otherTest === 'function')
		? otherTest
		: function() { return true; };
	function test(file) {
		return (file === find && otherTest(path.join(findIn, file)));
	}
	var found =!! fs.readdirSync(findIn).filter(test).length;
	if (found) {
		return findIn;
	} else {
		var next = path.join(findIn, '..');
		if (next === findIn) {
			return null;
		}
		return findUpTree(next, find, otherTest);
	}
}

/* End of file builder.js */
