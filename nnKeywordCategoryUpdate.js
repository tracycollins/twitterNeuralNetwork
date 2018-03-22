/*jslint node: true */
"use strict";

const DEFAULT_QUIT_ON_COMPLETE = true;

const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;
const ONE_HOUR = 60 * ONE_MINUTE;

const os = require("os");
const util = require("util");
const moment = require("moment");

const mongoose = require("mongoose");
const wordAssoDb = require("@threeceelabs/mongoose-twitter");

const userServer = require("@threeceelabs/user-server-controller");
const User = mongoose.model("User", wordAssoDb.UserSchema);

require("isomorphic-fetch");
const Dropbox = require("dropbox").Dropbox;

const async = require("async");
const chalk = require("chalk");
const debug = require("debug")("tnn");
const commandLineArgs = require("command-line-args");
const fs = require("fs");

let configuration = {};

configuration.processName = process.env.TNN_PROCESS_NAME || "node_nnKeywordCategoryUpdate";

if (process.env.TNN_QUIT_ON_COMPLETE === "true") {
  configuration.quitOnComplete = true;
}
else {
  configuration.quitOnComplete = DEFAULT_QUIT_ON_COMPLETE;
}


configuration.DROPBOX = {};
configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
configuration.DROPBOX.DROPBOX_TNN_CONFIG_FILE = process.env.DROPBOX_TNN_CONFIG_FILE || "twitterNeuralNetworkConfig.json";
configuration.DROPBOX.DROPBOX_TNN_STATS_FILE = process.env.DROPBOX_TNN_STATS_FILE || "twitterNeuralNetworkStats.json";

const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

const chalkAlert = chalk.red;
const chalkBlue = chalk.blue;
const chalkRedBold = chalk.bold.red;
const chalkError = chalk.bold.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;
const chalkNetwork = chalk.blue;

function msToTime(d) {
  const duration = parseInt(d);
  let seconds = parseInt((duration / 1000) % 60);
  let minutes = parseInt((duration / (1000 * 60)) % 60);
  let hours = parseInt((duration / (1000 * 60 * 60)) % 24);
  let days = parseInt(duration / (1000 * 60 * 60 * 24));
  days = (days < 10) ? "0" + days : days;
  hours = (hours < 10) ? "0" + hours : hours;
  minutes = (minutes < 10) ? "0" + minutes : minutes;
  seconds = (seconds < 10) ? "0" + seconds : seconds;
  return days + ":" + hours + ":" + minutes + ":" + seconds;
}

let statsObj = {};

statsObj.hostname = hostname;
statsObj.pid = process.pid;
statsObj.cpus = os.cpus().length;
statsObj.users = {};

statsObj.users.notClassified = 0;
statsObj.users.updatedClassified = 0;
statsObj.users.notFound = 0;
statsObj.users.screenNameUndefined = 0;
statsObj.errors = {};
statsObj.errors.imageParse = {};
statsObj.errors.users = {};
statsObj.errors.users.findOne = 0;
statsObj.startTimeMoment = moment();
statsObj.startTime = moment().valueOf();
statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

let classifiedUserHashmap = {};

let classifiedUserHistogram = {};
classifiedUserHistogram.left = 0;
classifiedUserHistogram.right = 0;
classifiedUserHistogram.neutral = 0;
classifiedUserHistogram.positive = 0;
classifiedUserHistogram.negative = 0;
classifiedUserHistogram.none = 0;

const jsonPrint = function (obj, prefix){
  if (obj) {
    if (prefix) {
      return JSON.stringify(obj, null, 2).replace(/^./gm, prefix);
    }
    return JSON.stringify(obj, null, 2);
  }
  else {
    return "UNDEFINED";
  }
};

const enableStdin = { name: "enableStdin", alias: "S", type: Boolean, defaultValue: true };
const quitOnComplete = { name: "quitOnComplete", alias: "q", type: Boolean };
const quitOnError = { name: "quitOnError", alias: "Q", type: Boolean, defaultValue: true };
const verbose = { name: "verbose", alias: "v", type: Boolean };

const testMode = { name: "testMode", alias: "X", type: Boolean, defaultValue: false };

const optionDefinitions = [
  enableStdin, 
  quitOnComplete, 
  quitOnError, 
  verbose, 
  testMode
];

const commandLineConfig = commandLineArgs(optionDefinitions);
console.log(chalkInfo("NNT | COMMAND LINE CONFIG\nNNT | " + jsonPrint(commandLineConfig)));
console.log("NNT | COMMAND LINE OPTIONS\nNNT | " + jsonPrint(commandLineConfig));

process.on("message", function(msg) {
  if (msg === "shutdown") {
    console.log("\n\nNNT | !!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n");
    setTimeout(function() {
      console.log("NNT | **** Finished closing connections ****"
        + "\n\n NNT | ***** RELOADING twitterNeuralNet.js NOW *****\n\n");
      process.exit(0);
    }, 1500);
  }
  else {
    console.log("NNT | R<\n" + jsonPrint(msg));
  }
});

statsObj.commandLineConfig = commandLineConfig;

process.title = "node_nnKeywordCategoryUpdate";
console.log("\n\nNNT | =================================");
console.log("NNT | HOST:          " + hostname);
console.log("NNT | PROCESS TITLE: " + process.title);
console.log("NNT | PROCESS ID:    " + process.pid);
console.log("NNT | RUN ID:        " + statsObj.runId);
console.log("NNT | PROCESS ARGS:  " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("NNT | =================================");

// ==================================================================
// DROPBOX
// ==================================================================

const dropboxConfigFolder = "/config/utility";
const dropboxConfigDefaultFolder = "/config/utility/default";
const dropboxConfigHostFolder = "/config/utility/" + hostname;

const dropboxConfigFile = hostname + "_" + configuration.DROPBOX.DROPBOX_TNN_CONFIG_FILE;

const statsFolder = "/stats/" + hostname + "/neuralNetwork";
const statsFile = "twitterNeuralNetworkStats_" + statsObj.runId + ".json";

let dropboxClient = new Dropbox({ accessToken: configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN });

let classifiedUsersFolder = dropboxConfigHostFolder + "/classifiedUsers";
let classifiedUsersFile = "classifiedUsers.json";

function getTimeStamp(inputTime) {
  let currentTimeStamp ;

  if (inputTime  === undefined) {
    currentTimeStamp = moment().format(compactDateTimeFormat);
    return currentTimeStamp;
  }
  else if (moment.isMoment(inputTime)) {
    currentTimeStamp = moment(inputTime).format(compactDateTimeFormat);
    return currentTimeStamp;
  }
  else {
    currentTimeStamp = moment(parseInt(inputTime)).format(compactDateTimeFormat);
    return currentTimeStamp;
  }
}

function showStats(options){

  statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

  if (options) {
    console.log("NNT | STATS\nNNT | " + jsonPrint(statsObj));
  }
  else {
    console.log(chalkLog("NNT | S"
      + " | CPUs: " + statsObj.cpus
      + " | RUN " + statsObj.elapsed
      + " | NOW " + moment().format(compactDateTimeFormat)
      + " | STRT " + moment(parseInt(statsObj.startTime)).format(compactDateTimeFormat)
    ));

    console.log(chalkLog("NNT | CL U HIST"
      + " | L: " + classifiedUserHistogram.left
      + " | R: " + classifiedUserHistogram.right
      + " | N: " + classifiedUserHistogram.neutral
      + " | +: " + classifiedUserHistogram.positive
      + " | -: " + classifiedUserHistogram.negative
      + " | 0: " + classifiedUserHistogram.none
    ));
  }
}

function quit(options){

  console.log(chalkAlert( "\n\nNNT | ... QUITTING ...\n\n" ));

  statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

  showStats();

  setTimeout(function(){
    process.exit();
  }, 1000);
}

process.on( "SIGINT", function() {
  quit("SIGINT");
});

process.on("exit", function() {
});

userServer.convertClassifiedUsersCursor({verbose: true}, function(){
  quit();
});

