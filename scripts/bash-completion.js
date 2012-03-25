//
// Installs the bash completion script
//

// Load the needed modules
var fs = require('fs');
var path = require('path');

// File name constants
var BASH_COMPLETION = '/etc/bash_completion.d';
var COMPLETION = path.join(__dirname, '..', 'completion.sh');

// Make sure the bash completion directory exists
path.exists(BASH_COMPLETION, function(exists) {
	if (exists) {
		fs.stat(BASH_COMPLETION, function(err, stats) {
			if (err) {fail();}
			if (stats.isDirectory()) {
				
				fs.symlink(COMPLETION, path.join(BASH_COMPLETION, 'crux'), function(err) {
					if (err) {fail();}
				});
				
			}
		});
	}
});

// --------------------------------------------------------

// Fail with a standard error message
function fail() {
	console.error([
		'Could not install bash completion. If your system supports this feature, it may',
		'be a permissions error (are you using sudo?). You can try installing the bash',
		'completion scripts later using `[sudo] npm run-script crux install -g`.'
	].join('\n'));
	process.exit(0);
}

/* End of file bash-completion.js */
