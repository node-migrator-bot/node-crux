_crux () 
{ 
	local cur prev sub opts project templates;
	cur="${COMP_WORDS[$COMP_CWORD]}";
	prev="${COMP_WORDS[$COMP_CWORD - 1]}";
	sub="${COMP_WORDS[1]}";
	if [ "$COMP_CWORD" == "1" ] || [ "$COMP_CWORD" == "2" -a "$sub" == "help" ]; then
		subcommands="init start migrate npm patch template help";
		COMPREPLY=($(compgen -W "$subcommands" -- ${cur}));
		return 0;
	else
		if [ "$sub" == "migrate" ]; then
			if [ "$COMP_CWORD" == "2" ]; then
				subcommands="up down create";
				COMPREPLY=($(compgen -W "$subcommands" -- ${cur}));
				return 0;
			else
				if [ "$COMP_CWORD" == "3" ] && [ "$prev" == "up" -o "$prev" == "down" ]; then
					project=$(_crux_find_project_directory);
					if [ "$project" == "" ]; then
						return 1;
					else
						COMPREPLY=($(compgen -W "$(for x in "$project/migrations/*.js"; do echo $(basename $x); done)" -- ${cur}));
						return 0;
					fi;
				fi;
			fi;
		else
			if [ "$sub" == "init" ]; then
				COMPREPLY=($(compgen -f ${cur}));
				return 0;
			else
				if [ "$sub" == "npm" ]; then
					subcommands="adduser bin bugs build bundle cache changelog coding-style completion config\
		                deprecate developers disputes docs edit explore faq folders help-search help init install\
		                json link list npm outdated owner pack prefix prune publish rebuild registr y removing-npm\
		                restart root run-script scripts search semver shrinkwrap star start stop submodule tag\
		                test uninstall unpublish up date version view whoami bin bugs commands config deprecate\
		                docs edit explore help-search init install link load ls npm outdated owne r pack prefix\
		                prune publish rebuild restart root run-script search shrinkwrap start stop submodule tag\
		                test uninstall unpublish upd ate version view whoami";
					COMPREPLY=($(compgen -W "$subcommands" -- ${cur}));
					return 0;
				else
					if [ "$sub" == "template" ]; then
						if [ "$COMP_CWORD" == "2" ]; then
							subcommands="create build install uninstall";
							COMPREPLY=($(compgen -W "$subcommands" -- ${cur}));
							return 0;
						else
							if [ "$COMP_CWORD" == "3" ]; then
								if [ "$prev" == "uninstall" ]; then
									templates="$(_crux_find_module_directory)/templates";
									COMPREPLY=($(compgen -W "$(for x in "$templates/*"; do echo $(basename $x); done)" -- ${cur}));
								fi;
							fi;
						fi;
					fi;
				fi;
			fi;
		fi;
	fi
}

_crux_find_module_directory () 
{ 
	local SOURCE="${BASH_SOURCE[0]}";
	while [ -h "$SOURCE" ]; do
		SOURCE="$(readlink "$SOURCE")";
	done;
	echo "$( cd -P "$( dirname "$SOURCE" )" && pwd )"
}

_crux_find_project_directory () 
{ 
	local cur next;
	if [ $# -eq 1 ]; then
		cur="$1";
	else
		cur=$(pwd);
	fi;
	if [ -f "$cur/core/init.js" ]; then
		echo "$cur";
		return 0;
	else
		if [ "$cur" == "/" ]; then
			return 1;
		fi;
	fi;
	next=$(dirname "$cur");
	echo $(_crux_find_project_directory "$next");
	return $?
}

complete -F _crux crux
