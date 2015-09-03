#!/bin/sh
/usr/lib/ruby/gems/2.0.0/gems/github-markdown-0.5.3/bin/gfm --readme ../documentation.md > body.html && cat header.html body.html footer.html > ../../../public/documentation.html

