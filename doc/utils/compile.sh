#!/bin/sh
gfm --readme ../documentation.md > body.html && cat header.html body.html footer.html > ../../public/documentation.html
