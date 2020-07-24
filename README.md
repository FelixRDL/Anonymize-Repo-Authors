# Anonymize Repo Authors
This little tool was created for my Master's Thesis in order to clear out any 
personal information from git log history and replacing them with funky animal
names!

## Prerequisites
- git installation
- npm/node installation

## How to use
- Create a repos.txt, in which you collect repository names (such as $REPOOWNER/$REPONAME)
- Execute `npm run lsauthors`
- Open the file `authors.idd.json` and manualy unify associated author aliases 
by replacing the E-Mail Address with a number
    - Look out for duplicate entries in `dupes.json`
- Run `npm run aliasize` to create `authors.aliased.json`
- 
    