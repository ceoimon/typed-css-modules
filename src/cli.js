#!/usr/bin/env node

import path from 'path';
import chokidar from 'chokidar';
import glob from 'glob';
import yargs from 'yargs';
import chalk from 'chalk';
import {DtsCreator} from './dtsCreator';

let yarg = yargs.usage('Create .css.d.ts from CSS modules *.css files.\nUsage: $0 [options] <input directory>')
  .example('$0 src/styles')
  .example('$0 src -o dist')
  .example('$0 -p styles/**/*.icss -w')
  .detectLocale(false)
  .demand(['_'])
  .alias('c', 'camelCase').describe('c', 'Convert CSS class tokens to camelcase')
  .alias('o', 'outDir').describe('o', 'Output directory')
  .alias('p', 'pattern').describe('p', 'Glob pattern with css files')
  .alias('w', 'watch').describe('w', 'Watch input directory\'s css files or pattern').boolean('w')
  .alias('d', 'dropExtension').describe('d', 'Drop the input files extension').boolean('d')
  .alias('f', 'force').describe('f', 'Force rewrite for any css content changes').boolean('f')
  .alias('q', 'quiet').describe('q', 'No logs').boolean('q')
  .alias('s', 'save-delay').describe('s', 'Set a file saving delay in order to make files monitor more accurate.').number('s')
  .alias('h', 'help').help('h')
  .version(() => require('../package.json').version)
let argv = yarg.argv;
let creator;

// In some cases, saving a file will clear the file content and write in again.
// We allow user to set a bit delay for that process.
const hasSaveDelay = !Number.isNaN(Number(argv.s))
const saveDelay = hasSaveDelay ? Number(argv.s) : (!!argv.w ? 100 : 0)
const shouldLog = !!!argv.q

function logWrote(content) {
  if (shouldLog) {
    console.log('Wrote ' + chalk.green(content.outputFilePath));
  }
}

function logWarn(content) {
  if (shouldLog) {
    content.messageList.forEach(message => {
      console.warn(chalk.yellow('[Warn] ' + message));
    });
  }
}

function processError(reason) {
  if (shouldLog) {
    console.error(chalk.red('[Error] ' + reason));
  }
  if (!!!argv.w) {
    process.exit(1);
  }
}

function writeFile(content) {
  return content.writeFile()
  .then(logWrote)
  .then(() => content);
}

function processFile(f) {
  creator.create(f, null, !!argv.w)
  .then(content => {
    if (!!argv.f) {
      return writeFile(content);
    } else {
      return content.checkDirty(saveDelay)
      .then(isDirty => isDirty ? writeFile(content) : content);
    }
  })
  .then(logWarn)
  .catch(processError);
};

let main = () => {
  let rootDir, searchDir;
  if(argv.h) {
    yarg.showHelp();
    return;
  }

  if(argv._ && argv._[0]) {
    searchDir = argv._[0];
  }else if(argv.p) {
    searchDir = './';
  }else{
    yarg.showHelp();
    return;
  }
  let filesPattern = path.join(searchDir, argv.p || '**/*.css');
  rootDir = process.cwd();
  creator = new DtsCreator({
    rootDir,
    searchDir,
    outDir: argv.o,
    camelCase: argv.c,
    dropExtension: argv.d
  });

  if(!argv.w) {
    glob(filesPattern, null, (err, files) => {
      if(err) {
        return processError(err)
      }
      if(!files || !files.length) return;
      files.forEach(processFile);
    });
  } else {
    if (!!!argv.q) {
      console.log('Watching ' + filesPattern + '...');
    }

    var watcher = chokidar.watch([filesPattern.replace(/\\/g, "/")]);
    watcher.on('add', processFile);
    watcher.on('change', processFile);
  }
};

main();
