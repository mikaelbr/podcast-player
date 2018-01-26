#!/usr/bin/env node

const FeedParser = require('feedparser');
const inquirer = require('inquirer');
const request = require('request');
const Speaker = require('speaker');
const lame = require('lame');
const chalk = require('chalk');
const ora = require('ora');

const package = require('./package.json');
const version = chalk.yellow(package.version);
const binName = chalk.blue(Object.keys(package.bin)[0]);
const input = process.argv[2];

function printVersion() {
  console.log(`${binName} – version: ${version}`);
}

function printHelp() {
  return console.log(`
$ ${binName} <RSS feed>

Example
${binName} https://rss.simplecast.com/podcasts/4239/rss
`);
}

if (input === '-v' || input === '--version') {
  printVersion();
  printHelp();
  process.exit(0);
}

if (input === '-h' || input === '--help' || input === '?') {
  printHelp();
  process.exit(0);
}

if (!input) {
  console.error(chalk.red('Please provide an RSS feed to ') + binName);
  printHelp();
  process.exit(1);
}

const req = request(input);
const feedparser = new FeedParser();

var options = {
  channels: 2,
  bitDepth: 16,
  sampleRate: 44100
};
var decoder = new lame.Decoder(options);
var speaker = new Speaker(options);

req.on('error', function(error) {
  console.error(error);
  process.exit(1);
});
req.on('response', function(res) {
  if (res.statusCode !== 200) {
    this.emit('error', new Error('Bad status code'));
  } else {
    this.pipe(feedparser);
  }
});
feedparser.on('error', function(error) {
  console.error(error);
  process.exit(1);
});

function getMp3(item) {
  return request(item.enclosures[0].url);
}

function startPlaying(item) {
  getMp3(item)
    .pipe(decoder)
    .pipe(speaker);
}

const items = [];
let meta;
feedparser
  .on('readable', function() {
    meta = this.meta;
    let item;
    while ((item = this.read())) {
      items.push(item);
    }
  })
  .on('finish', function() {
    selectSong(items);
  });

function selectSong(items) {
  console.log(
    '\n' + chalk.magenta(meta.title) + ' – ' + chalk.blue(meta.link) + '\n'
  );

  inquirer
    .prompt([
      {
        type: 'list',
        name: 'episode',
        message: 'Which episode do you want to play?',
        choices: items.map(i => i.title)
      }
    ])
    .then(({ episode }) => {
      const episodeToPlay = items.find(i => i.title === episode);
      if (!episodeToPlay) {
        console.error('Could not find episode');
        return process.exit(1);
      }
      startPlaying(episodeToPlay);
      ora(`Now playing ${chalk.green(episode)}`).start();
    });
}
