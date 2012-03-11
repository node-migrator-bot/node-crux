#!/usr/bin/env node

var fs      = require('fs');
var path    = require('path');
var git     = require('gitjs');
var wrench  = require('wrench');

var BASE_PATH      = path.join(__dirname, '..');
var TEMPLATE_PATH  = path.join(BASE_PATH, 'template');
var PID_FILE       = '.server-pid';
var PATCH_REMOTE   = '__crux_patch';
var GITHUB_REPO    = 'git@github.com:kbjr/node-crux';

var args = process.argv.slice(2);

switch (args.shift()) {
	
	// crux init [directory]
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
	
	// crux start [--quiet]
	case 'start':
		var projectPath = findUpTree(process.cwd(), 'core/init.js');
		process.chdir(projectPath);
		var quiet = (args[0] && args[0] === '--quiet');
		var init = path.join(projectPath, 'core/init.js');
		var logFile = path.join(projectPath, 'logs/access.log');
		runProcess('/usr/bin/env', ['node', init], quiet, logFile, function() {
			console.log('Stopping Server');
		});
	break;
	
	// crux migrate [up|down|create]
	case 'migrate':
		var migratePath = path.join(BASE_PATH, 'node_modules/migrate/bin/migrate');
		var projectPath = findUpTree(process.cwd(), 'migrations', function(file) {
			return fs.statSync(file).isDirectory();
		});
		process.chdir(projectPath);
		require('./migrate').run(args, projectPath);
	break;
	
	// crux npm [...]
	case 'npm':
		changeDirectoryToProjectPath();
		var quiet =!! (args[0] && args[0] === '--quiet' && args.shift());
		args.unshift('npm');
		runProcess('/usr/bin/env', args, quiet);
	break;
	
	// crux patch <commit-ish>
	case 'patch':
		changeDirectoryToProjectPath();
		var quiet =!! (args[0] && args[0] === '--quiet' && args.shift());
		
		if (! quiet) {
			console.log('> Preparing to patch...');
		}

		// Open the git repo
		git.open('.', true, throws(function(repo, autoCreated) {
			
			// If the repo did not already exist, make sure we commit all the files
			if (autoCreated) {
				repo.add('*', throws(function() {
					repo.commit('foo', throws(function() {
						afterOpen();
					}));
				}));
			} else {
				afterOpen();
			}
			
			// After init-ing and possibily commiting, make sure we have a remote
			function afterOpen() {
				repo.remoteExists(PATCH_REMOTE, throws(function(exists) {
					if (exists) {
						return doCherrypick();
					}
					repo.run('remote add ? ?', [PATCH_REMOTE, GITHUB_REPO], throws(doCherrypick));
				}));
			}
			
			// Once we are sure the remote exists, fetch and cherry-pick
			function doCherrypick() {
				if (! quiet) {
					console.log('> Fetching patch data from repository...');
				}
				repo.run('fetch ?', [PATCH_REMOTE], throws(function() {
					repo.run('cherry-pick ?', [args.join(' ')], throws(function() {
						
						// If we created the repo, we can now destroy it
						if (autoCreated) {
							var _git = path.join(process.cwd(), '.git';
							wrench.rmdirRecursive(_git, throws(done));
						} else {
							done();
						}
						
						function done() {
							console.log('> Patching complete');
						}
						
					}));
				}));
			}
			
		});
	break;
	
	// crux [...]
	default:
		console.log('Invalid use');
	break;
	
}

// ------------------------------------------------------------------
//  Internals

// If a first parameter is given, throw it
function throws(callback) {
	return function(err) {
		if (err) {throw err;}
		if (typeof callback === 'function') {
			var args = Array.prototype.slice.call(arguments, 1);
			return callback.apply(this, args);
		}
	}
}

// Change to the directory at the project root
function changeDirectoryToProjectPath() {
	process.chdir(
		findUpTree(process.cwd(), 'core/init.js')
	);
}

// Run a child process
function runProcess(cmd, args, quiet, logFile, onkill) {
	var proc = require('child_process').spawn(cmd, args);
	var toLogFile;
	if (logFile) {
		logFile = fs.createWriteStream(logFile, {
			flags: 'a',
			mode: 0666,
			encoding: 'utf8'
		});
		toLogFile = function(toLog) {
			logFile.write(toLog);
		};
	} else {
		toLogFile = function() { };
	}
	var logger = (
		quiet ? function(toLog) {
			toLogFile(toLog);
		} : function(toLog) {
			toLogFile(toLog);
			console.log(String(toLog).trimRight());
		}
	);
	proc.stdout.on('data', logger);
	proc.stderr.on('data', logger);
	proc.on('exit', function() {
		if (logFile) {
			logFile.end();
			logFile.destroySoon();
		}
		process.exit();
	});
	process.on('SIGINT', function() {
		if (typeof onkill === 'function') {
			onkill();
		}
		proc.kill();
	});
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

/* End of file crux.js */
