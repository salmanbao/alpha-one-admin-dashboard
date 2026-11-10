#!/bin/bash
# Remove malicious files from git history

echo "Removing malicious postcss.config.mjs files from history..."

# Remove the postcss.config.mjs files
git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch apps/platform-admin/postcss.config.mjs apps/trader/postcss.config.mjs apps/prop-admin/postcss.config.mjs' --prune-empty --tag-name-filter cat -- --all

echo "Removing malicious init files from history..."
# Remove init files
git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch apps/platform-admin/init apps/trader/init apps/prop-admin/init init' --prune-empty --tag-name-filter cat -- --all

echo "Cleaning up git history..."
git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch' --prune-empty --tag-name-filter cat -- --all

echo "Done removing malicious files from history."