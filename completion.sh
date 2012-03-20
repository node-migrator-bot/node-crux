_crux()
{
	local cur prev sub opts project
	cur="${COMP_WORDS[$COMP_CWORD]}"
	prev="${COMP_WORDS[$COMP_CWORD - 1]}"
	sub="${COMP_WORDS[1]}"

	# Complete sub-commands
	if [ "$COMP_CWORD" == "1" -o "$sub" == "help" ]
	then
		subcommands="init start migrate npm patch help"
		COMPREPLY=( $(compgen -W "$subcommands" -- ${cur}) )
		return 0
	# Complete migration subcommands
	elif [ "$sub" == "migrate" ]
	then
		# Complete the sub-sub commands
		if [ "$COMP_CWORD" == "2" ]
		then
			subcommands="up down create"
			COMPREPLY=( $(compgen -W "$subcommands" -- ${cur}) )
			return 0
		# Complete migration files for migrate [up|down]
		elif [ "$COMP_CWORD" == "3" ] && [ "$prev" == "up" -o "$prev" == "down" ]
		then
			project=$(_crux_find_project_directory)
			if [ "$project" == "" ]
			then
				COMPREPLY=( $(compgen -W "$(for x in "$project/migrations/*.js"; do echo $(basename $x); done)" -- ${cur}) )
				return 0
			else
				return 1
			fi
		fi
	# Complete files for init
	elif [ "$sub" == "init" ]
	then
		COMPREPLY=( $(compgen -f ${cur}) )
		return 0
	# Complete npm subcommands
	elif [ "$sub" == "npm" ]
	then
		subcommands="adduser bin bugs build bundle cache changelog coding-style completion config deprecate developers disputes docs\
		             edit explore faq folders help-search help init install json link list npm outdated owner pack prefix prune publish\
					 rebuild registry removing-npm restart root run-script scripts search semver shrinkwrap star start stop submodule\
					 tag test uninstall unpublish update version view whoami bin bugs commands config deprecate docs edit explore\
					 help-search init install link load ls npm outdated owner pack prefix prune publish rebuild restart root run-script\
					 search shrinkwrap start stop submodule tag test uninstall unpublish update version view whoami"
		COMPREPLY=( $(compgen -W "$subcommands" -- ${cur}) )
		return 0
	fi
}

# Finds the path for a crux project in the current tree
_crux_find_project_directory()
{
	local cur
	local next
	
	# If a parameter was given, that is the current directory,
	# otherwise we start at pwd (this allows recursion)
	if [ $# -eq 1 ]
	then
		cur="$1"
	else
		cur=$(pwd)
	fi
	
	# Look for core/init.js
	if [ -f "$cur/core/init.js" ]
	then
		echo "$cur"
		return 0
	# Make sure we are not at the root already
	elif [ "$cur" == "/" ]
	then
		return 1
	fi
	
	# Find the next directory up the tree
	next=$(dirname "$cur")
	
	# Recurse..
	echo $(_crux_find_project_directory "$next")
	return $?
}

complete -F _crux crux
