#!/usr/bin/env node

var fs      = require('fs');
var path    = require('path');
var git     = require('gitjs');
var wrench  = require('wrench');

var BASE_PATH         = path.join(__dirname, '..');
var TEMPLATE_PATH     = path.join(BASE_PATH, 'template');
var TEMPLATES_DIR     = path.join(BASE_PATH, 'templates');
var PID_FILE          = '.server-pid';
var PATCH_REMOTE      = '__crux_patch';
var TEMPLATE_BRANCH   = '__crux_template';
var GITHUB_REPO       = 'git@github.com:kbjr/node-crux-template';
var CONFLIT_ERROR     = 'after resolving the conflicts, mark the corrected paths';

var args = process.argv.slice(2);

switch (args.shift()) {
	
	// crux --version
	case '--version':
		console.log(require('../package.json').version);
		process.exit(0);
	break;
	
	// crux basepath
	case 'basepath':
		console.log(BASE_PATH);
	break;
	
	// crux init [--template <template>] [directory]
	case 'init':
		initProject('--template', args);
	break;
	
	// crux start [--quiet]
	case 'start':
		var projectPath = findUpTree(process.cwd(), 'core/init.js');
		process.chdir(projectPath);
		var opts = parseStartArgs(args);
		var init = path.join(projectPath, 'core/init.js');
		var logFile = path.join(projectPath, 'logs/access.log');
		runProcess('/usr/bin/env', ['node', init, opts.environment], opts.quiet, logFile, function() {
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
	
	// crux patch [--quiet] <commit-ish>
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
				repo.run('add * -f', throws(function() {
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
					repo.run('cherry-pick ?', [args.join(' ')], function(err, stdout, stderr) {
						
						// Check if there were conflits
						if (err && err.code === 1 && String(stderr).indexOf(CONFLIT_ERROR) >= 0) {
							console.log('! There were conflicts when merging the patch(es).');
							console.log('! You can use `git status` to see what files have unresolved conflicts.');
						}
						
						console.log('> Patching complete');
						
					});
				}));
			}
			
		}));
	break;

	// crux template [...]
	case 'template':
		switch (args.shift()) {
	
			// crux template create [--from <from>] <directory>
			case 'create':
				initProject('--from', args, function(projectPath) {
					// Create and checkout a new branch for building the template
					git.open(projectPath, throws(function(repo) {
						repo.createBranch(TEMPLATE_BRANCH, throws(function() {
							repo.checkout(TEMPLATE_BRANCH, throws());
						}));
					}));
				});
			break;
	
			// crux template build
			case 'build':
				changeDirectoryToProjectPath();
				var templateName = path.basename(process.cwd());
				// Prepare the repository
				git.open('.', throws(function(repo) {
					repo.add('.', throws(function() {
						repo.commit('crux-template: ' + templateName, throws(function() {
							// Create the patch file
							repo.run('format-patch master --stdout', throws(function(stdout) {
								fs.writeFile(templateName, stdout, throws());
							}));
						}));
					}));
				}));
			break;
	
			// crux template install [--name <name>] <source>
			case 'install':
				var name, source;
				if (args[0] === '--name') {
					name = (args.shift(), args.shift());
				}
				source = args.shift();
				if (! source) {
					console.error('Invalid usage.');
					process.exit(1);
				}
				name = name || path.basename(source);
				// Make sure the source file exists
				path.exists(source, function(exists) {
					if (! exists) {
						console.error('Source file does not exist.');
						process.exit(1);
					}
					// Make sure the source file is a regular file
					fs.stat(source, throws(function(stats) {
						if (! stats.isFile()) {
							console.error('Source file is not a regular file');
							process.exit(1);
						}
						// Copy the template patch file into the templates directory
						copyFile(source, path.join(TEMPLATES_DIR, name), throws());
					}));
				});
			break;
	
			// crux template uninstall <name>
			case 'uninstall':
				var name = args[0];
				if (! name) {
					console.error('Invalid usage.');
					process.exit(1);
				}
				var templateFile = path.join(TEMPLATES_DIR, name);
				path.exists(templateFile, function(exists) {
					if (! exists) {
						console.error('Template does not exist.');
						process.exit(1);
					}
					fs.unlink(templateFile, throws());
				});
			break;
			
			default:
				console.error('Invalid usage.\nSee `crux help template` for help.');
			break;
	
		}
	break;
	
	// crux update [--check-only]
	case 'update':
		if (args.shift() === '--check-only') {
			upToDate(function(isUpToDate, update) {
				if (! isUpToDate) {
					console.log(update.recent + '>' + update.current);
				}
			});
		} else {
			doUpdate(function() {
				// pass
			});
		}
	break;

// ------------------------------------------------------------------
//  Help
	
	// crux help [command]
	case 'help':
		var msg;
		switch (args.shift()) {
			case 'init':
				msg = [
					'',
					'usage: crux init [--template <template>] [--skip-update-check] [directory]',
					'',
					'Creates a new Crux project. If a directory is given, the project will be',
					'created there. If not, the project will be created in the current directory.',
					'If a template value is given, that is the project template that will be used',
					'to create the new project. The default project template is called "default".',
					''
				];
			break;
			case 'start':
				msg = [
					'',
					'usage: crux start [--quiet]',
					'',
					'Starts the application server. If the --quiet flag is given, no output will',
					'be sent to stdout or stderr.',
					''
				];
			break;
			case 'migrate':
				msg = [
					'',
					'usage:',
					'  crux migrate create [name]',
					'  crux migrate [up|down] [to]',
					'',
					'Manages migrations. Using `migrate create` will create a new migration (optionally',
					'with a given name). The `migrate up` and `migrate down` commands run migrations. If',
					'a [to] value is given, migrations will be run up to and including the given migration',
					'file. Otherwise, all migrations (except those already run) will be run. If no',
					'[up|down] value is given, it will migrate all the way up.',
					''
				];
			break;
			case 'npm':
				msg = [
					'',
					'usage: crux npm [args]',
					'',
					'Runs a npm command on the current project. See `npm help` for more',
					'information on npm commands available.',
					''
				];
			break;
			case 'template':
				msg = [
					'',
					'usage:',
					'  crux template create [--from <from>] [--skip-update-check] [<directory>]',
					'  crux template build',
					'  crux template install [--name <name>] <source>',
					'  crux template uninstall <name>',
					'',
					'Manages project templates.',
					'',
					'  create      initializes a new template directory',
					'  build       builds a new project template file',
					'  install     installs the given template file (optionally under a given name)',
					'  uninstall   uninstalls the given template',
					'',
					''
				];
			break;
			case 'patch':
				msg = [
					'',
					'usage: crux patch [--quiet] <commit-ish>',
					'',
					'Patch the current project with commits from the Crux source code repository. Most commonly',
					'used for patching fixed bugs.',
					''
				];
			break;
			case 'update':
				msg = [
					'',
					'usage: crux update [--check-only]',
					'',
					'Update your version of Crux to the latest version. If the --check-only flag is given, the',
					'command will only check to see if there is an updated version, not actaully do an update.',
					''
				];
			break;
			case undefined:
				msg = [
					'',
					'usage: crux <command> [args]',
					'',
					'Commands:',
					'  init       Create a new Crux project',
					'  start      Start the application server',
					'  migrate    Manage migrations',
					'  npm        Run npm commands',
					'  template   Manage project templates',
					'  patch      Patch your project',
					'  update     Update/check for update to Crux',
					'',
					'Use `crux help <command>` for help on a specific command',
					''
				];
			break;
			default:
				msg = [ 'No such command. See `crux help` for a list of commands.' ];
			break;
		}
		console.log(msg.join('\n'));
	break;
	
	// crux [...]
	default:
		console.log('Invalid use. See `crux help` for usage.');
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

// Checks that Crux is up to date
//
// This is not necessary, so in the event of an error, just continue on quietly
//
function upToDate(callback) {
	var opts = {
		cwd: path.join(BASE_PATH, '../..')
	};
	require('child_process').exec('npm outdated crux', opts, function(err, stdout, stderr) {
		if (err) {return callback(true);}
		var info = null;
		var list = String(stdout).split('\n').forEach(function(item) {
			item = item.split(' ');
			if (item[1] === './node_modules/crux') {
				info = {
					recent: item[0].split('@')[1],
					current: item[2].split('=')[1]
				};
			}
		});
		callback(! info, info);
	});
}

// Ask a question and take an answer on stdin
function ask(question, format, callback) {
	var stdin = process.stdin;
	var stdout = process.stdout;

	stdin.resume();
	stdout.write(question + ": ");

	stdin.once('data', function(data) {
		data = data.toString().trim();

		if (format.test(data)) {
			callback(data);
		} else {
			stdout.write('I could not understand your response\n');
			process.exit(1);
		}
	});
}

// Initialize a new project
function initProject(templateFlag, args, callback) {
	args = parseInitArgs(templateFlag, args);
	if (args.skipUpdate) {
		return done();
	}
	// Check that Crux is up to date
	upToDate(function(isUpToDate, update) {
		if (isUpToDate) {
			return done();
		}
		var question =
			'Your current version of Crux is not up to date (current: ' +
			 update.current + ', update: ' + update.recent + ').\n' +
			'Would you like to update your version of Crux before continuing? [y/n/A(bort)]';
		ask(question, /^[yna]/i, function(response) {
			switch (response[0].toLowerCase()) {
				case 'y':
					doUpdate(function() {
						console.log('> Update complete. Continuing...');
						done();
					});
				break;
				case 'n':
					done();
				break;
				case 'a':
					console.log('Aborted.');
					process.exit(0);
				break;
			}
		});
	});
	function done() {
		doInit(args, callback);
	}
}

// Parse the arguments for an init command (init/template create)
function parseInitArgs(templateFlag, args) {
	var result = {
		template: null,
		creationPath: '.',
		skipUpdate: false
	};
	var current;
	while (args.length) {
		switch (current = args.shift()) {
			case templateFlag:
				result.template = args.shift();
			break;
			case '--skip-update-check':
				result.skipUpdate = true;
			break;
			default:
				result.creationPath = current;
			break;
		}
	}
	result.creationPath = path.resolve(result.creationPath);
	return result;
}

// Parse options for `crux start`
function parseStartArgs(args) {
	var result = {
		quiet: false,
		environment: 'production'
	};
	while (args.length) {
		switch (args.shift()) {
			case '--quiet':
				result.quiet = true;
			break;
			case '--environment':
				result.environment = args.shift();
			break;
		}
	}
	return result;
}

// Do the actual project init
function doInit(args, callback) {
	callback = callback || function() { };
	// Make sure the base template exists
	path.exists(TEMPLATE_PATH, function(exists) {
		if (! exists) {
			throw 'Template path not found';
		}
		// Copy the template to the new location
		copyIntoRecursive(TEMPLATE_PATH, args.creationPath, throws(function() {
			// Apply any template patch needed
			if (args.template) {
				var templatePatch = path.join(TEMPLATES_DIR, args.template);
				path.exists(templatePatch, function(exists) {
					if (! exists) {
						throw 'Could not apply template "' + args.template + '"; Template not found.';
					}
					git.open(args.creationPath, throws(function(repo) {
						repo.checkout('master', throws(function() {
							repo.run('apply ?', [templatePatch], throws(function() {
								callback(args.creationPath);
							}));
						}));
					}));
				});
			} else {
				callback(args.creationPath);
			}
		}));
	});
}

// Update Crux
function doUpdate(callback) {
	console.log('> Updating Crux...');
	runProcess('npm', ['update', 'crux', '-g'], false, null, null, callback);
}

// Copy a simple file
function copyFile(from, to, callback) {
	fs.readFile(from, function(err, data) {
		if (err) {return callback(err);}
		fs.writeFile(to, data, callback);
	});
}

// Check if a file is a directory
function isDir(file, callback) {
	fs.stat(file, function(err, stats) {
		callback(! err && stats.isDirectory());
	});
}

// Copy files recursively from one directory into another without
// clobbering the original directory (conflicting sub-directories
// will still be clobbered).
function copyIntoRecursive(from, to, callback) {
	path.exists(to, function(exists) {
		if (! exists) {
			return wrench.copyDirRecursive(from, to, callback);
		}
		fs.readdir(from, throws(function(files) {
			var completed = [ ];
			function done() {
				completed.push(null);
				if (completed.length === files.length) {
					callback();
				}
			}
			files.forEach(function(file) {
				var fromFile = path.join(from, file);
				isDir(fromFile, function(isDir) {
					if (isDir) {
						wrench.copyDirRecursive(fromFile, path.join(to, file), throws(done));
					} else {
						copyFile(fromFile, path.join(to, file), throws(done));
					}
				});
			});
		}));
	});
}

// Change to the directory at the project root
function changeDirectoryToProjectPath() {
	process.chdir(
		findUpTree(process.cwd(), 'core/init.js')
	);
}

// Run a child process
function runProcess(cmd, args, quiet, logFile, onkill, callback) {
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
		if (typeof callback === 'function') {
			callback();
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
