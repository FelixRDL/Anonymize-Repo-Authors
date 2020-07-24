const gitP = require("simple-git").gitP;
const gen = require('unique-names-generator')
const config = {
    dictionaries: [
        gen.adjectives,
        gen.colors,
        gen.animals]
}
const util = require('util');
const exec = require('child_process').exec;
const child_process = require('child_process')
const execP = util.promisify(require('child_process').exec);
const fs = require('fs');
const repoNames = fs.readFileSync('./repos.txt', 'utf-8').split("\n")
const rimraf = require('rimraf').sync
const repoFolder = './repos'
const authorFile = './authors.json'
const dupeFile = './dupes.json'
const authorsIddFile = './authors.idd.json'
const aliasedFile = './authors.aliased.json'
const glob = require('glob')

const find = require('find-in-files').findSync

const numItems = 50

async function main() {
    switch(process.env.npm_lifecycle_event) {
        case 'lsauthors':
            await cleanup();
            for (let name of repoNames) {
                const path = await cloneRepo(name)
                const authors = await getAuthors(path)
                logAuthors(authors)
            }
            fs.createReadStream(authorFile).pipe(fs.createWriteStream(authorsIddFile));
            break;
        case 'aliasize':
            await createAliasDirectory()
            break;
        case 'anonymize':
            await cleanup()
            for (let name of repoNames) {
                await cloneRepo(name)
            }
            await cleanRepos()
            break;
        case 'clean':
            await cleanup();
            break;
    }
}

/**
 * After each rewrite, the original refs have to be deleted
 */
module.exports.createAuthorsFile = async function() {
    for (let name of repoNames) {
        const path = await cloneRepo(name)
        const authors = await getAuthors(path)
        logAuthors(authors)
    }
}

module.exports.clean = async function() {
    return cleanup();
}

async function cloneRepos() {

}

async function clearRefs(folder) {
    console.log("DELETE refs")
    return exec(`
        cd ./repos/${folder} && 
        rm -rf ./.git/refs/original
        `)
}

async function cleanRepos() {
    const mappings = JSON.parse(fs.readFileSync(aliasedFile))
    const folders = fs.readdirSync(repoFolder)
    console.log("Folders", folders)
    console.log("Mappings", mappings)
    for (folder of folders) {
        console.log("REMOVING textfiles from History")
        var files = await glob.glob.sync(`./repos/${folder}/**/*.md`)
        files = files.concat(await glob.glob.sync(`./repos/${folder}/**/*.txt`))
        files = files.concat(await glob.glob.sync(`./repos/${folder}/**/*.pdf`))

        for(file of files) {
            var relPath = file.split('/').slice(3).join('/')
            console.log("DEL", relPath)
            await clearRefs(folder)
            await execP(`
            cd ./repos/${folder} &&
            git filter-branch --force --index-filter \\
  "git rm --cached --ignore-unmatch ${relPath}" \\
  --prune-empty --tag-name-filter cat -- --all`)
        }


        console.log("REMOVED textfiles")

        const authors = Object.keys(await getAuthors(`./repos/${folder}`))
        for (key of authors) {
            const name = key
            const alias = mappings[key]
            await clearRefs(folder)
            const command = `
        cd ./repos/${folder} && 
        git filter-branch --env-filter '
        SEARCH_NAME="${name}"
        NEW_NAME="${alias}"
        NEW_EMAIL="${alias}.samplemail.com"
        
        if [ "$GIT_COMMITTER_NAME" = "$SEARCH_NAME" ]
        then
            export GIT_COMMITTER_NAME="$NEW_NAME"
            export GIT_COMMITTER_EMAIL="$NEW_EMAIL"
        fi
        if [ "$GIT_AUTHOR_NAME" = "$SEARCH_NAME" ]
        then
            export GIT_AUTHOR_NAME="$NEW_NAME"
            export GIT_AUTHOR_EMAIL="$NEW_EMAIL"
        fi
        ' --tag-name-filter cat -- --branches --tags`
            await execP(command)
            console.log("UNIFIED", folder, alias)

            console.log("SEARCHING author name")
            var found = []
            if (name.split(' ').length > 1) {
                const prename = name.split(' ')[0]
                const surname = name.split(' ')[1]
                const prenameMatches = await find({'term': prename, 'flags': 'ig'}, `./repos/${folder}/`)
                console.log(typeof prenameMatches)
                const surnameMatches = await find({'term': surname, 'flags': 'ig'}, `./repos/${folder}/`)
                console.log(prenameMatches, surnameMatches)
            }
            const fullMatches = await find({'term': name, 'flags': 'ig'}, `./repos/${folder}`)
            console.log(fullMatches)
            console.log("SEARCHED author name")
        }
    }
}

async function createAliasDirectory() {
    const mappings = []
    const iddAuthors = JSON.parse(fs.readFileSync(authorsIddFile, 'utf-8'))
    for (var i = 0; i < numItems; i++) {
        mappings.push(gen.uniqueNamesGenerator(config))
    }
    const aliasedAuthors = {}
    Object.keys(iddAuthors).map(authorName => aliasedAuthors[authorName] = mappings[iddAuthors[authorName] - 1])
    fs.writeFileSync(aliasedFile, JSON.stringify(aliasedAuthors, null, 2))
}

async function logAuthors(newAuthors) {
    const newAuthorsList = Object.keys(newAuthors)
    const dupes = new Set()
    let knownAuthors = JSON.parse(fs.readFileSync(authorFile, 'utf-8'))
    let knownDupes = JSON.parse(fs.readFileSync(dupeFile, 'utf-8'))
    Object.keys(knownAuthors).map((a) => {
            if (newAuthorsList.includes(a)) {
                dupes.add(a)
            }
        }
    )
    knownAuthors = Object.assign({}, knownAuthors, newAuthors)
    fs.writeFileSync(authorFile, JSON.stringify(knownAuthors, null, 2))
    Array.from(dupes).map(d => knownDupes[d] = '')
    fs.writeFileSync(dupeFile, JSON.stringify(knownDupes, null, 2))
}

async function cleanup() {
    rimraf(repoFolder)
    fs.mkdirSync('./repos')
}

async function cloneRepo(repoName) {
    console.log("CLONING...", repoName)
    await execP(`cd repos && git clone https://github.com/${repoName} && git fetch --all`)
    console.log("CLONED", repoName)
    return `./repos/${repoName.split('/')[1]}`
}

async function getAuthors(path) {
    const git = gitP(path)
    const log = (await git.log()).all
    const authors = log.reduce((acc, log) => {
        acc[log.author_name] = log.author_email
        return acc
    }, {})
    return authors
}

main();