#!/bin/bash

# Create list of used files
echo "=== USED FILES ==="
grep -o "'/[^']*\.\(wav\|mp3\)'" /Users/Programming/launchpad-player/src/App.tsx | sed "s/'//g" | sort | uniq > /tmp/used_files.txt

# Show used files
cat /tmp/used_files.txt

echo ""
echo "=== ALL FILES IN PUBLIC ==="
# Create list of all files in public
find "/Users/Programming/launchpad-player/public" -name "*.wav" -o -name "*.mp3" | sed 's|/Users/Programming/launchpad-player/public||' | sort > /tmp/all_files.txt

# Show all files
cat /tmp/all_files.txt

echo ""
echo "=== UNUSED FILES (to delete) ==="
# Find files that are in public but not used
comm -23 /tmp/all_files.txt /tmp/used_files.txt