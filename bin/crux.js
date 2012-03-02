#!/usr/bin/env node

var fs      = require('fs');
var path    = require('path');
var wrench  = require('wrench');

var BASE_PATH      = path.join(__dirname, '..');
var TEMPLATE_PATH  = path.join(BASE_PATH, 'template');
var PID_FILE       = '.server-pid';

var args = process.argv.slice(2);

switch (args.shift()) {
	
	// builder init [directory]
	case 'init':
		var creationPath = path.join(process.cwd(), (args[0] || '.'));
		// Make sure the template exists
		path.exists(TEMPLATE_PATH, function(exists) {
			if (! exists) {
				throw 'Template path not found';
			}
			// Copy the template to the new location
			wrench.copyDirSyncRecursive(TEMPLATE_PATH, creationPath, function(err) {
				if (err) {
					throw err;
				}
			});
		});
	break;
	
	// builder start [--quiet]
	case 'start':
		var projectPath = findUpTree(process.cwd(), 'core/init.js');
		process.chdir(projectPath);
		var quiet = (args[0] && args[0] === '--quiet');
		var init = path.join(projectPath, 'core/init.js');
		var proc = require('child_process').spawn('/usr/bin/env', ['node', init]);
		var logFile = path.join(projectPath, 'logs/access.log');
		logFile = fs.createWriteStream(logFile, {
			flags: 'a',
			mode: 0666,
			encoding: 'utf8'
		});
		var logger = (
			quiet ? function(toLog) {
				logFile.write(toLog);
			} : function(toLog) {
				logFile.write(toLog);
				console.log(String(toLog).trimRight());
			}
		);
		proc.stdout.on('data', logger);
		proc.stderr.on('data', logger);
		proc.on('exit', function() {
			logFile.end();
			logFile.destroySoon();
			process.exit();
		});
		process.on('SIGINT', function() {
			console.log('Stopping Server');
			proc.kill();
		});
	break;
	
	// builder migrate [up|down|create]
	case 'migrate':
		var migratePath = path.join(BASE_PATH, 'node_modules/migrate/bin/migrate');
		var projectPath = findUpTree(process.cwd(), 'migrations', function(file) {
			return fs.statSync(file).isDirectory();
		});
		process.chdir(projectPath);
		require('./migrate').run(args, projectPath);
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
	var file = path.join(findIn, find);
	if (path.existsSync(file) && otherTest(file)) {
		return findIn;
	} else {
		var next = path.join(findIn, '..');
		if (next === findIn) {
			console.log('Not in a crux project tree');
			process.exit(1);
		}
		return findUpTree(next, find, otherTest);
	}
}

/* End of file builder.js */