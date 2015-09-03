#!/bin/sh
gfm ../documentation.md > body.html && cat header.html body.html footer.html > ../../public/documentation.html
