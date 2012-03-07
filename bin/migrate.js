// A modified version of the migrate command for progmatic use
exports.run = function(args, projectPath) {

	/**
	 * Module dependencies.
	 */

	var migrate = require('../node_modules/migrate')
	  , join = require('path').join
	  , fs = require('fs');
	
	/**
	 * File with the template.
	 */
	
	var TEMPLATE_FILE = '.template';

	/**
	 * Option defaults.
	 */

	var options = { args: [], verbose: false };

	/**
	 * Current working directory.
	 */

	var cwd;

	/**
	 * Usage information.
	 */

	var usage = [
		''
	  , '  Usage: migrate [options] [command]'
	  , ''
	  , '  Options:'
	  , ''
	  , '     -c, --chdir <path>   change the working directory'
	  , ''
	  , '  Commands:'
	  , ''
	  , '     down   [name]    migrate down till given migration'
	  , '     up     [name]    migrate up till given migration (the default command)'
	  , '     create [title]   create a new migration file with optional [title]'
	  , ''
	].join('\n');

	/**
	 * Migration template.
	 */
	
	var _template = fs.readFileSync(join('migrations', TEMPLATE_FILE)).toString();
	var template = [
		'',
		'// Load the database library',
		'var db = $.libs.require(\'db\');',
		'',
		'// ------------------------------------------------------------------',
		'',
		'exports.up = function(next) {',
		'	' + _template.split('\n').join('\n\t'),
		'};',
		'',
		'// ------------------------------------------------------------------',
		'',
		'exports.down = function(next) {',
		'	' + _template.split('\n').join('\n\t'),
		'};',
		''
	].join('\n');

	// require an argument

	function required() {
	  if (args.length) return args.shift();
	  abort(arg + ' requires an argument');
	}

	// abort with a message

	function abort(msg) {
	  console.error('  %s', msg);
	  process.exit(1);
	}

	// parse arguments

	var arg;
	while (args.length) {
	  arg = args.shift();
	  switch (arg) {
		case '-h':
		case '--help':
		case 'help':
		  console.log(usage);
		  process.exit();
		  break;
		case '-c':
		case '--chdir':
		  process.chdir(cwd = required());
		  break;
		case '-v':
		case '--verbose':
		  options.verbose = true;
		break;
		default:
		  if (options.command) {
		    options.args.push(arg);
		  } else {
		    options.command = arg;
		  }
	  }
	}

	/**
	 * Load migrations.
	 */

	function migrations() {
	  return fs.readdirSync('migrations').filter(function(file){
		return file.match(/^\d+.*\.js$/);
	  }).sort().map(function(file){
		return 'migrations/' + file;
	  });
	}

	/**
	 * Log a keyed message.
	 */

	function log(key, msg) {
	  console.log('  \033[90m%s :\033[0m \033[36m%s\033[0m', key, msg);
	}

	/**
	 * Slugify the given `str`.
	 */

	function slugify(str) {
	  return str.replace(/\s+/g, '-');
	}

	// create ./migrations

	try {
	  fs.mkdirSync('migrations', 0774);
	} catch (err) {
	  // ignore
	}

	// commands

	var commands = {

	  /**
	   * up [name]
	   */

	  up: function(migrationName){
		performMigration('up', migrationName);
	  },

	  /**
	   * down [name]
	   */

	  down: function(migrationName){
		performMigration('down', migrationName);
	  },

	  /**
	   * create [title]
	   */

	  create: function(){
		var migrations = fs.readdirSync('migrations').filter(function(file){
		  return file.match(/^\d+/);
		}).map(function(file){
		  return parseInt(file.match(/^(\d+)/)[1], 10);
		}).sort(function(a, b){
		  return a - b;
		});

		var curr = pad((migrations.pop() || 0) + 1)
		  , title = slugify([].slice.call(arguments).join(' '));
		title = title ? curr + '-' + title : curr; 
		create(title);
	  },
	  
	  /**
	   * edit-template [editor]
	   */
	  
	  "edit-template": function(editor) {
		editor = editor || 'vi';
		var file = join('migrations', TEMPLATE_FILE);
		spawnEditor(editor, file);
	  }
	  
	};
	
	function spawnEditor(editor, file) {
	  var tty = require('tty');
	  var proc = require('child_process').spawn('/usr/bin/env', [editor, file]);

	  function indata(c) {
		proc.stdin.write(c);
	  }
	  function outdata(c) {
		process.stdout.write(c);
	  }

	  process.stdin.resume();
	  process.stdin.on('data', indata);
	  proc.stdout.on('data', outdata);
	  tty.setRawMode(true);

	  proc.on('exit', function(code) {
		tty.setRawMode(false);
		process.stdin.pause();
		process.stdin.removeListener('data', indata);
		proc.stdout.removeListener('data', outdata);
		process.exit(0);
	  });
	}

	/**
	 * Pad the given number.
	 *
	 * @param {Number} n
	 * @return {String}
	 */

	function pad(n) {
	  return Array(4 - n.toString().length).join('0') + n;
	}

	/**
	 * Create a migration with the given `name`.
	 *
	 * @param {String} name
	 */

	function create(name) {
	  var path = 'migrations/' + name + '.js';
	  log('create', join(cwd, path));
	  fs.writeFileSync(path, template);
	}

	/**
	 * Perform a migration in the given `direction`.
	 *
	 * @param {Number} direction
	 */

	function performMigration(direction, migrationName) {
	  migrate('migrations/.migrate');
	  migrations().forEach(function(path){
		var mod = require(process.cwd() + '/' + path);
		migrate(path, mod.up, mod.down);
	  });

	  var set = migrate();

	  set.on('migration', function(migration, direction){
		log(direction, migration.title);
	  });

	  set.on('save', function(){
		log('migration', 'complete');
		process.exit();
	  });

	  var migrationPath = migrationName
		? join('migrations', migrationName)
		: migrationName;
	 
	  set[direction](null, migrationPath);
	}

	// Load the core
	global._coreOnly_ = true;
	global._forceVerbose_ = options.verbose;
	require(join(projectPath, 'core/init'));

	// invoke command

	var command = options.command || 'up';
	if (!(command in commands)) abort('unknown command "' + command + '"');
	command = commands[command];
	command.apply(this, options.args);
};
