#!/bin/bash

# Create sub-directories
mkdir -p src
mkdir -p tests

# Initialize empty files
touch src/core.aut
touch src/manifest.aut
touch tests/test_suite.aut

echo "Project skeleton initialized in $(pwd)"