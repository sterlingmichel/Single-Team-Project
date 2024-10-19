#!/bin/bash

date=`date '+%s'`;
perl -p -i -e "s/src=\"(\S+.\S+.js)\"/src=\"\$1\?${date}\"/g" dist/providerWorkspace/index.html


# This section of the code creates the
# robots.txt file to prevent search engine
# lookups for non-prod systems
./create_robots.pl
