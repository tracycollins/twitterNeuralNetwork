/*jslint node: true */
"use strict";

const inputTypes = ["hashtags", "mentions", "urls", "words", "emoji"];
inputTypes.sort();

let trainingSet = [];
let trainingSetNormalized = [];

let trainingSetLabels = {};
trainingSetLabels.inputRaw = [];
trainingSetLabels.inputs = {};
trainingSetLabels.outputs = ["left", "neutral", "right"];

inputTypes.forEach(function(type){
  trainingSetLabels.inputs[type] = [];
});

let inputArrays = {};


let requiredTrainingSet = new Set();
// requiredTrainingSet.add("angela_rye");
// requiredTrainingSet.add("barackobama");
// requiredTrainingSet.add("bfraser747");
// requiredTrainingSet.add("breitbartnews");
// requiredTrainingSet.add("danscavino");
// requiredTrainingSet.add("dnc");
// requiredTrainingSet.add("foxandfriends");
// requiredTrainingSet.add("foxnews");
// requiredTrainingSet.add("gop");
// requiredTrainingSet.add("gopchairwoman");
// requiredTrainingSet.add("hannity");
// requiredTrainingSet.add("hillaryclinton");
// requiredTrainingSet.add("jaketapper");
// requiredTrainingSet.add("jaredkushner");
// requiredTrainingSet.add("kamalaharris");
// requiredTrainingSet.add("loudobbs");
// requiredTrainingSet.add("maddow");
// requiredTrainingSet.add("mikepence");
// requiredTrainingSet.add("mikepencevp");
// requiredTrainingSet.add("mittromney");
// requiredTrainingSet.add("mmflint");
// requiredTrainingSet.add("msnbc");
// requiredTrainingSet.add("nancypelosi");
// requiredTrainingSet.add("newtgingrich");
// requiredTrainingSet.add("nytimes");
// requiredTrainingSet.add("potus");
// requiredTrainingSet.add("proudresister");
// requiredTrainingSet.add("realalexjones");
requiredTrainingSet.add("realdonaldtrump");
// requiredTrainingSet.add("realjameswoods");
// requiredTrainingSet.add("senategop");
// requiredTrainingSet.add("sensanders");
// requiredTrainingSet.add("sheriffclarke");
// requiredTrainingSet.add("speakerryan");
// requiredTrainingSet.add("tuckercarlson");
// requiredTrainingSet.add("usatoday");
// requiredTrainingSet.add("vp");


let currentBestNetwork;

let slackChannel = "#nn";

const neataptic = require("neataptic");
const twitterTextParser = require("@threeceelabs/twitter-text-parser");

const DEFAULT_TEST_RATIO = 0.1;

const DEFAULT_NETWORK_CREATE_MODE = "evolve";
const DEFAULT_ITERATIONS = 1;
const DEFAULT_SEED_NETWORK_ID = false;

const DEFAULT_EVOLVE_THREADS = 2;
const DEFAULT_EVOLVE_ARCHITECTURE = "random";
const DEFAULT_EVOLVE_BEST_NETWORK = false;
const DEFAULT_EVOLVE_ACTIVATION = "LOGISTIC";
const DEFAULT_EVOLVE_CLEAR = false;
const DEFAULT_EVOLVE_COST = "MSE";
const DEFAULT_EVOLVE_ELITISM = 10;
const DEFAULT_EVOLVE_EQUAL = true;
const DEFAULT_EVOLVE_ERROR = 0.03;
const DEFAULT_EVOLVE_LOG = 1;
const DEFAULT_EVOLVE_MUTATION = "FFW";
const DEFAULT_EVOLVE_MUTATION_RATE = 0.75;
const DEFAULT_EVOLVE_POPSIZE = 100;

const DEFAULT_TRAIN_THREADS = 2;
const DEFAULT_TRAIN_ARCHITECTURE = "perceptron";
const DEFAULT_TRAIN_BEST_NETWORK = false;
const DEFAULT_TRAIN_HIDDEN_LAYER_SIZE = 10;
const DEFAULT_TRAIN_LOG = 1;
const DEFAULT_TRAIN_ERROR = 0.01;
const DEFAULT_TRAIN_COST = "MSE";
const DEFAULT_TRAIN_RATE = 0.3;
const DEFAULT_TRAIN_DROPOUT = 0;
const DEFAULT_TRAIN_SHUFFLE = false;
const DEFAULT_TRAIN_CLEAR = false;
const DEFAULT_TRAIN_MOMENTUM = 0;
const DEFAULT_TRAIN_RATE_POLICY = "FIXED";
const DEFAULT_TRAIN_BATCH_SIZE = 1;

let configuration = {};
configuration.normalization = null;
configuration.verbose = false;
configuration.testMode = false; // per tweet test mode
configuration.testSetRatio = DEFAULT_TEST_RATIO;

configuration.evolve = {};
configuration.evolve.useBestNetwork = DEFAULT_EVOLVE_BEST_NETWORK;
configuration.evolve.networkId = DEFAULT_SEED_NETWORK_ID;
configuration.evolve.threads = DEFAULT_EVOLVE_THREADS;
configuration.evolve.architecture = DEFAULT_EVOLVE_ARCHITECTURE;
configuration.evolve.network = null;
configuration.evolve.elitism = DEFAULT_EVOLVE_ELITISM;
configuration.evolve.equal = DEFAULT_EVOLVE_EQUAL;
configuration.evolve.error = DEFAULT_EVOLVE_ERROR;
configuration.evolve.iterations = DEFAULT_ITERATIONS;
configuration.evolve.log = DEFAULT_EVOLVE_LOG;
configuration.evolve.mutation = DEFAULT_EVOLVE_MUTATION;
configuration.evolve.mutationRate = DEFAULT_EVOLVE_MUTATION_RATE;
configuration.evolve.popsize = DEFAULT_EVOLVE_POPSIZE;
configuration.evolve.cost = DEFAULT_EVOLVE_COST;
configuration.evolve.activation = DEFAULT_EVOLVE_ACTIVATION;

configuration.train = {};
configuration.train.threads = DEFAULT_TRAIN_THREADS;
configuration.train.architecture = DEFAULT_TRAIN_ARCHITECTURE;
configuration.train.hiddenLayerSize = DEFAULT_TRAIN_HIDDEN_LAYER_SIZE;
configuration.train.useBestNetwork = DEFAULT_TRAIN_BEST_NETWORK;
configuration.train.network = null;
configuration.train.networkId = DEFAULT_SEED_NETWORK_ID;
configuration.train.log = DEFAULT_TRAIN_LOG;
configuration.train.error = DEFAULT_TRAIN_ERROR;
configuration.train.cost = DEFAULT_TRAIN_COST;
configuration.train.rate = DEFAULT_TRAIN_RATE;
configuration.train.dropout = DEFAULT_TRAIN_DROPOUT;
configuration.train.shuffle = DEFAULT_TRAIN_SHUFFLE;
configuration.train.iterations = DEFAULT_ITERATIONS;
configuration.train.clear = DEFAULT_TRAIN_CLEAR;
configuration.train.momentum = DEFAULT_TRAIN_MOMENTUM;
configuration.train.ratePolicy = DEFAULT_TRAIN_RATE_POLICY;
configuration.train.batchSize = DEFAULT_TRAIN_BATCH_SIZE;

const slackOAuthAccessToken = "xoxp-3708084981-3708084993-206468961315-ec62db5792cd55071a51c544acf0da55";

const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const os = require("os");
const util = require("util");
const moment = require("moment");
const Dropbox = require("dropbox");
const pick = require("object.pick");
const omit = require("object.omit");
const arrayUnique = require("array-unique");
const Slack = require("slack-node");
const cp = require("child_process");
const arrayNormalize = require("array-normalize");
const columnify = require("columnify");
const mongoose = require("mongoose");

const EventEmitter2 = require("eventemitter2").EventEmitter2;
const async = require("async");
const chalk = require("chalk");
const debug = require("debug")("tnn");
const debugCache = require("debug")("cache");
const debugQ = require("debug")("queue");
const commandLineArgs = require("command-line-args");

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

function msToTime(duration) {
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

// statsObj.memory = {};
// statsObj.memory.rss = process.memoryUsage().rss/(1024*1024);
// statsObj.memory.maxRss = process.memoryUsage().rss/(1024*1024);
// statsObj.memory.maxRssTime = moment().valueOf();

statsObj.startTimeMoment = moment();
statsObj.startTime = moment().valueOf();
statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
statsObj.neuralNetworkReady = false;

const DEFAULT_RUN_ID = hostname + "_" + process.pid + "_" + statsObj.startTimeMoment.format(compactDateTimeFormat);

if (process.env.TNN_RUN_ID !== undefined) {
  statsObj.runId = process.env.TNN_RUN_ID;
  console.log(chalkAlert("ENV RUN ID: " + statsObj.runId));
}
else {
  statsObj.runId = DEFAULT_RUN_ID;
  console.log(chalkAlert("DEFAULT RUN ID: " + statsObj.runId));
}

let neuralNetworkChild;
let network;

let globalhistograms = {};
globalhistograms.words = {};
globalhistograms.urls = {};
globalhistograms.hashtags = {};
globalhistograms.mentions = {};
globalhistograms.emoji = {};

let classifiedUserHashmap = {};

let classifiedUserHistogram = {};
classifiedUserHistogram.left = 0;
classifiedUserHistogram.right = 0;
classifiedUserHistogram.neutral = 0;
classifiedUserHistogram.positive = 0;
classifiedUserHistogram.negative = 0;
classifiedUserHistogram.none = 0;


const HashMap = require("hashmap").HashMap;
let bestNetworkHashMap = new HashMap();

const jsUcfirst = function(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const configEvents = new EventEmitter2({
  wildcard: true,
  newListener: true,
  maxListeners: 20,
  verboseMemoryLeak: true
});

let stdin;

let db;
let wordAssoDb;
let User;
let NeuralNetwork; // DB

let userServer;

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


let slack = new Slack(slackOAuthAccessToken);

function slackPostMessage(channel, text, callback){

  slack.api("chat.postMessage", {
    text: text,
    channel: channel
  }, function(err, response){
    if (err){
      console.error(chalkError("*** SLACK POST MESSAGE ERROR"
        + " | CH: " + channel
        + "\nTEXT: " + text
        + "\nERROR: " + err
      ));
    }
    else {
      debug(response);
    }
    if (callback !== undefined) { callback(err, response); }
  });
}


const enableStdin = { name: "enableStdin", alias: "i", type: Boolean, defaultValue: true };
const quitOnError = { name: "quitOnError", alias: "q", type: Boolean, defaultValue: true };
const verbose = { name: "verbose", alias: "v", type: Boolean };

const networkCreateMode = { name: "networkCreateMode", alias: "c", type: String, defaultValue: "evolve" };
const hiddenLayerSize = { name: "hiddenLayerSize", alias: "h", type: Number, defaultValue: DEFAULT_TRAIN_HIDDEN_LAYER_SIZE };
const seedNetworkId = { name: "seedNetworkId", alias: "s", type: String };
const useBestNetwork = { name: "useBestNetwork", alias: "b", type: Boolean };
const testMode = { name: "testMode", alias: "T", type: Boolean, defaultValue: false };
const evolveIterations = { name: "evolveIterations", alias: "I", type: Number};

const optionDefinitions = [
  networkCreateMode,
  hiddenLayerSize,
  seedNetworkId,
  useBestNetwork, 
  enableStdin, 
  quitOnError, 
  verbose, 
  evolveIterations, 
  testMode
];

const commandLineConfig = commandLineArgs(optionDefinitions);
console.log(chalkInfo("COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));
console.log("COMMAND LINE OPTIONS\n" + jsonPrint(commandLineConfig));

process.on("message", function(msg) {
  if (msg === "shutdown") {
    console.log("\n\n!!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n");
    setTimeout(function() {
      console.log("**** Finished closing connections ****"
        + "\n\n ***** RELOADING twitterNeuralNet.js NOW *****\n\n");
      process.exit(0);
    }, 1500);
  }
  else {
    console.log("R<\n" + jsonPrint(msg));
  }
});

statsObj.commandLineConfig = commandLineConfig;

statsObj.normalization = {};
statsObj.normalization.score = {};
statsObj.normalization.magnitude = {};

statsObj.normalization.score.min = -1.0;
statsObj.normalization.score.max = 1.0;
statsObj.normalization.magnitude.min = 0;
statsObj.normalization.magnitude.max = -Infinity;


let testObj = {};
testObj.testRunId = statsObj.runId;
testObj.testSet = [];

statsObj.tests = {};
statsObj.tests[testObj.testRunId] = {};
statsObj.tests[testObj.testRunId].numInputs = 0;
statsObj.tests[testObj.testRunId].numOutputs = 0;
statsObj.tests[testObj.testRunId].network = {};
statsObj.tests[testObj.testRunId].results = {};
statsObj.tests[testObj.testRunId].results.numTests = 0;
statsObj.tests[testObj.testRunId].results.numSkipped = 0;
statsObj.tests[testObj.testRunId].results.numPassed = 0;
statsObj.tests[testObj.testRunId].results.successRate = 0.0;
statsObj.tests[testObj.testRunId].elapsed = 0;

statsObj.evolve = {};
statsObj.evolve.options = {};
statsObj.train = {};
statsObj.train.options = {};

console.log("\n\n=================================");
console.log("HOST:          " + hostname);
console.log("PROCESS ID:    " + process.pid);
console.log("RUN ID:        " + statsObj.runId);
console.log("PROCESS ARGS:  " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("=================================");

// ==================================================================
// DROPBOX
// ==================================================================

const DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
const DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
const DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
const DROPBOX_TNN_CONFIG_FILE = process.env.DROPBOX_TNN_CONFIG_FILE || "twitterNeuralNetworkConfig.json";
const DROPBOX_TNN_STATS_FILE = process.env.DROPBOX_TNN_STATS_FILE || "twitterNeuralNetworkStats.json";

const dropboxConfigFolder = "/config/utility";
const dropboxConfigDefaultFolder = "/config/utility/default";
const dropboxConfigHostFolder = "/config/utility/" + hostname;

const dropboxConfigFile = hostname + "_" + DROPBOX_TNN_CONFIG_FILE;

const statsFolder = "/stats/" + hostname + "/neuralNetwork";
const statsFile = "twitterNeuralNetworkStats_" + statsObj.runId + ".json";

const bestNetworkFolder = "/config/utility/best/neuralNetworks";
let bestNetworkFile;


debug("statsFolder : " + statsFolder);
debug("statsFile : " + statsFile);


console.log("DROPBOX_TNN_CONFIG_FILE: " + DROPBOX_TNN_CONFIG_FILE);
console.log("DROPBOX_TNN_STATS_FILE : " + DROPBOX_TNN_STATS_FILE);

debug("dropboxConfigFolder : " + dropboxConfigFolder);
debug("dropboxConfigHostFolder : " + dropboxConfigHostFolder);
debug("dropboxConfigFile : " + dropboxConfigFile);

console.log("DROPBOX_WORD_ASSO_ACCESS_TOKEN :" + DROPBOX_WORD_ASSO_ACCESS_TOKEN);
console.log("DROPBOX_WORD_ASSO_APP_KEY :" + DROPBOX_WORD_ASSO_APP_KEY);
console.log("DROPBOX_WORD_ASSO_APP_SECRET :" + DROPBOX_WORD_ASSO_APP_SECRET);

let dropboxClient = new Dropbox({ accessToken: DROPBOX_WORD_ASSO_ACCESS_TOKEN });

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

function indexOfMax (arr, callback) {

  if (arr.length === 0) {
    console.log(chalkAlert("indexOfMax: 0 LENG ARRAY: -1"));
    return(callback(-2, arr)) ; 
  }

  if ((arr[0] === arr[1]) && (arr[1] === arr[2])){
    debug(chalkAlert("indexOfMax: ALL EQUAL"));
    debug(chalkAlert("ARR" 
      + " | " + arr[0].toFixed(2) 
      + " - " + arr[1].toFixed(2) 
      + " - " + arr[2].toFixed(2)
    ));
    if (arr[0] === 0) { return(callback(-4, arr)); }
    return(callback(4, [1,1,1])) ; 
  }

  debug("B4 ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));
  arrayNormalize(arr);
  debug("AF ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));

  if (((arr[0] === 1) && (arr[1] === 1)) 
    || ((arr[0] === 1) && (arr[2] === 1))
    || ((arr[1] === 1) && (arr[2] === 1))){

    debug(chalkAlert("indexOfMax: MULTIPLE SET"));

    debug(chalkAlert("ARR" 
      + " | " + arr[0].toFixed(2) 
      + " - " + arr[1].toFixed(2) 
      + " - " + arr[2].toFixed(2)
    ));

    async.eachOf(arr, function(val, index, cb0){
      if (val < 1) {
        arr[index] = 0;
      }
      cb0();
    }, function(){
      callback(3, arr); 
    });

  }
  else {

    let max = 0;
    let maxIndex = -1;

    async.eachOfSeries(arr, function(val, index, cb1){
      if (val > max) {
        maxIndex = index;
        max = val;
      }
      cb1();
    }, function(){

      async.eachOf(arr, function(val, index, cb2){
        if (val < 1) {
          arr[index] = 0;
        }
        cb2();
      }, function(){
        callback(maxIndex, arr); 
      });

    });

  }
}

function showStats(options){

  if (neuralNetworkChild !== undefined) {
    neuralNetworkChild.send({op: "STATS", options: options});
  }

  statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

  // statsObj.memory.rss = process.memoryUsage().rss/(1024*1024);
  // if (statsObj.memory.rss > statsObj.memory.maxRss) {
  //   statsObj.memory.maxRss = statsObj.memory.rss;
  //   statsObj.memory.maxRssTime = moment().valueOf();
  // }

  if (options) {
    console.log("STATS\n" + jsonPrint(statsObj));
  }
  else {
    console.log(chalkLog("S"
      + " | CPUs: " + statsObj.cpus
      + " | " + testObj.testRunId
      + " | " + configuration.networkCreateMode.toUpperCase()
      + " | RUN " + statsObj.elapsed
      + " | NOW " + moment().format(compactDateTimeFormat)
      + " | STRT " + moment(parseInt(statsObj.startTime)).format(compactDateTimeFormat)
      + " | ITR " + configuration.evolve.iterations
      // + " | RSS " + statsObj.memory.rss.toFixed(1) + " MB"
      // + " / " + statsObj.memory.maxRss.toFixed(1) + " MAX"
      // + " @ " + getTimeStamp(statsObj.memory.maxRssTime)
    ));

    console.log(chalkLog("CL U HIST"
      + " | L: " + classifiedUserHistogram.left
      + " | R: " + classifiedUserHistogram.right
      + " | N: " + classifiedUserHistogram.neutral
      + " | +: " + classifiedUserHistogram.positive
      + " | -: " + classifiedUserHistogram.negative
      + " | 0: " + classifiedUserHistogram.none
    ));

    if (statsObj.tests[testObj.testRunId].results.successRate !== undefined) {
      console.log(chalkAlert(testObj.testRunId
        + " | " + configuration.networkCreateMode.toUpperCase()
        + " | RUN: " + statsObj.elapsed
        + " | ITR: " + configuration.evolve.iterations
        + " | TESTS: " + statsObj.tests[testObj.testRunId].results.numTests
        + " | PASS: " + statsObj.tests[testObj.testRunId].results.numPassed
        + " | SKIP: " + statsObj.tests[testObj.testRunId].results.numSkipped
        + " | RES: " + statsObj.tests[testObj.testRunId].results.successRate.toFixed(1) + " %"
      ));
    }
  }
}

function quit(options){

  console.log(chalkAlert( "\n\n... QUITTING ...\n\n" ));

  statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

  if (process.env.TNN_BATCH_MODE){
    slackChannel = "#nn_batch";
  }

  let slackText = "";

  if (options !== undefined) {

    if (options.network !== undefined) {
      const snid = (options.network.evolve && (options.network.evolve.options.network !== undefined)) 
        ? options.network.evolve.options.network.networkId 
        + " | " + options.network.evolve.options.network.successRate.toFixed(2) + "%"
        : "-" ;

      slackText = "\n*" + statsObj.runId + "*";
      if (statsObj.tests[testObj.testRunId].results) {
        slackText = slackText + "\n*RES: " + statsObj.tests[testObj.testRunId].results.successRate.toFixed(1) + " %*";
      }
      slackText = slackText + " | RUN " + statsObj.elapsed;
      slackText = slackText + "\nTESTS: " + statsObj.tests[testObj.testRunId].results.numTests;
      slackText = slackText + " | PASS: " + statsObj.tests[testObj.testRunId].results.numPassed;
      slackText = slackText + " | SKIP: " + statsObj.tests[testObj.testRunId].results.numSkipped;
      slackText = slackText + " | SEED NET: " + snid;
      slackText = slackText + "\nEVOLVE OPTIONS\n" + jsonPrint(statsObj.evolve.options);
      slackText = slackText + "\nTRAIN OPTIONS\n" + jsonPrint(statsObj.train.options);

      console.log("SLACK TEXT: " + slackText);

      slackPostMessage(slackChannel, slackText);
    }
    else {

      slackText = "\n*" + statsObj.runId + "*";
      slackText = slackText + " | RUN " + statsObj.elapsed;
      slackText = slackText + " | QUIT CAUSE: " + options;

      console.log("SLACK TEXT: " + slackText);

      slackPostMessage(slackChannel, slackText);
    }

  }

  showStats();
  setTimeout(function(){
    if (neuralNetworkChild !== undefined) { neuralNetworkChild.kill("SIGINT"); }
    process.exit();
  }, 1000);
}

process.on( "SIGINT", function() {
  if (neuralNetworkChild !== undefined) { neuralNetworkChild.kill("SIGINT"); }
  quit("SIGINT");
});

process.on("exit", function() {
  if (neuralNetworkChild !== undefined) { neuralNetworkChild.kill("SIGKILL"); }
});


function saveFile (params, callback){

  const fullPath = params.folder + "/" + params.file;

  debug(chalkInfo("LOAD FOLDER " + params.folder));
  debug(chalkInfo("LOAD FILE " + params.file));
  debug(chalkInfo("FULL PATH " + fullPath));

  let options = {};

  options.contents = JSON.stringify(params.obj, null, 2);
  options.path = fullPath;
  options.mode = params.mode || "overwrite";
  options.autorename = params.autorename || false;


  const dbFileUpload = function () {
    dropboxClient.filesUpload(options)
    .then(function(){
      debug(chalkLog("SAVED DROPBOX JSON | " + options.path));
      if (callback !== undefined) { callback(null); }
    })
    .catch(function(error){
      if (error.status === 413){
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: 413"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error.error_summary); }
      }
      else if (error.status === 429){
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: TOO MANY WRITES"
          // + " ERROR\n" + "jsonPrint"(error.error)
        ));
        if (callback !== undefined) { callback(error.error_summary); }
      }
      else if (error.status === 500){
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: DROPBOX SERVER ERROR"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error.error_summary); }
      }
      else {
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR\n" + jsonPrint(error)
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error); }
      }
    });
  };

  if (options.mode === "add") {
    dropboxClient.filesListFolder({path: params.folder})
    .then(function(response){

      debug(chalkLog("DROPBOX LIST FOLDER"
        + " | " + options.path
        + " | " + jsonPrint(response)
      ));

      let fileExits = false;

      async.each(response.entries, function(entry, cb){

        console.log(chalkInfo("DROPBOX FILE"
          + " | " + params.folder
          + " | " + getTimeStamp(entry.client_modified)
          + " | " + entry.name
          // + " | " + entry.content_hash
          // + "\n" + jsonPrint(entry)
        ));

        if (entry.name === params.file) {
          fileExits = true;
        }

        cb();

      }, function(err){
        if (err) {
          console.log(chalkError("*** ERROR DROPBOX SAVE FILE: " + err));
          if (callback !== undefined) { 
            return(callback(err, null));
          }
          return;
        }
        if (fileExits) {
          console.log(chalkAlert("... DROPBOX FILE EXISTS ... SKIP SAVE | " + fullPath));
          if (callback !== undefined) { callback(err, null); }
        }
        else {
          console.log(chalkAlert("... DROPBOX DOES NOT FILE EXIST ... SAVING | " + fullPath));
          dbFileUpload();
        }
      });
    })
    .catch(function(err){
      console.log(chalkError("*** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
      if (callback !== undefined) { callback(err, null); }
    });
  }
  else {
    dbFileUpload();
  }
}

function saveFileRetry (timeout, path, file, jsonObj, callback){
  setTimeout(function(){
    console.log(chalkError("SAVE RETRY | TIMEOUT: " + timeout + " | " + path + "/" + file));
    saveFile({folder:path, file:file, obj:jsonObj}, function(err){
      if (err) {
        console.log(chalkError("SAVE RETRY ON ERROR: " + path + "/" + file));
        saveFileRetry(timeout, path, file, jsonObj);
      }
    });
  }, timeout);
  if (callback !== undefined) { callback(); }
}

function loadFile(path, file, callback) {

  debug(chalkInfo("LOAD FOLDER " + path));
  debug(chalkInfo("LOAD FILE " + file));
  debug(chalkInfo("FULL PATH " + path + "/" + file));

  dropboxClient.filesDownload({path: path + "/" + file})
    .then(function(data) {
      debug(chalkLog(getTimeStamp()
        + " | LOADING FILE FROM DROPBOX FILE: " + path + "/" + file
      ));

      let payload = data.fileBinary;
      debug(payload);

      if (file.match(/\.json$/gi)) {
        let fileObj = JSON.parse(payload);
        callback(null, fileObj);
      }
      else {
        callback(null, payload);
      }
    })
    .catch(function(error) {
      console.log(chalkError("DROPBOX loadFile ERROR: " + file + "\n" + error));
      console.log(chalkError("!!! DROPBOX READ " + file + " ERROR"));
      console.log(chalkError(jsonPrint(error)));

      if (error.status === 404) {
        console.error(chalkError("!!! DROPBOX READ FILE " + file + " NOT FOUND"
          + " ... SKIPPING ...")
        );
        return(callback(null, null));
      }
      if (error.status === 0) {
        console.error(chalkError("!!! DROPBOX NO RESPONSE"
          + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
        return(callback(null, null));
      }
      callback(error, null);
    });
}

let statsUpdateInterval;

function initStatsUpdate(cnf, callback){

  console.log(chalkBlue("INIT STATS UPDATE INTERVAL | " + cnf.statsUpdateIntervalTime + " MS"));

  clearInterval(statsUpdateInterval);

  statsUpdateInterval = setInterval(function () {

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
    statsObj.timeStamp = moment().format(defaultDateTimeFormat);

    // statsObj.memory.rss = process.memoryUsage().rss/(1024*1024);
    // if (statsObj.memory.rss > statsObj.memory.maxRss) {
    //   statsObj.memory.maxRss = statsObj.memory.rss;
    //   statsObj.memory.maxRssTime = moment().valueOf();
    //   console.log(chalkAlert("NEW MAX RSS"
    //     + " | " + statsObj.memory.maxRss.toFixed(1)
    //     + " | " + getTimeStamp(statsObj.memory.maxRssTime)
    //   ));
    // }

    saveFile({folder: statsFolder, file: statsFile, obj: statsObj});

    // saveFile(statsFolder, statsFile, statsObj, function(){
    //   debug("END SAVE FILE");
    // });
 
    showStats();

  }, cnf.statsUpdateIntervalTime);

  callback(null, cnf);
}

function loadBestNetworkDropboxFolder(folder, callback){

  let options = {path: folder};

  dropboxClient.filesListFolder(options)
  .then(function(response){

    debug(chalkLog("DROPBOX LIST FOLDER"
      + " | " + options.path
      + " | " + jsonPrint(response)
    ));

    let nnArray = [];

    async.each(response.entries, function(entry, cb){

      console.log(chalkInfo("DROPBOX BEST NETWORK FOUND"
        + " | " + getTimeStamp(entry.client_modified)
        + " | " + entry.name
        // + " | " + entry.content_hash
        // + "\n" + jsonPrint(entry)
      ));

      if (bestNetworkHashMap.has(entry.name)){

        if (bestNetworkHashMap.get(entry.name).content_hash !== entry.content_hash) {

          console.log(chalkInfo("DROPBOX BEST NETWORK CONTENT CHANGE"
            + " | " + getTimeStamp(entry.client_modified)
            + " | " + entry.name
            + "\nCUR HASH: " + entry.content_hash
            + "\nOLD HASH: " + bestNetworkHashMap.get(entry.name).content_hash
          ));

          // bestNetworkHashMap.set(entry.name, entry);

          loadFile(folder, entry.name, function(err, networkObj){

            if (err) {
              console.log(chalkError("DROPBOX BEST NETWORK LOAD FILE ERROR: " + err));
              return(cb());
            }

            console.log(chalkInfo("DROPBOX BEST NETWORK"
              + " | " + networkObj.successRate.toFixed(1) + "%"
              + " | " + getTimeStamp(networkObj.createdAt)
              + " | " + networkObj.networkId
              + " | " + networkObj.networkCreateMode
              + " | IN: " + networkObj.numInputs
              + " | OUT: " + networkObj.numOutputs
            ));


            bestNetworkHashMap.set(entry.name, entry);
            nnArray.push(networkObj);
            cb();

            // neuralNetworkServer.findOneNetwork(networkObj, {}, function(err, updatedNetworkObj){
            //   if (err) {
            //     cb();
            //   }
            //   else {
            //     bestNetworkHashMap.set(entry.name, entry);
            //     nnArray.push(updatedNetworkObj);
            //     cb();
            //   }
            // });

          });
        }
        else{
          debug(chalkLog("DROPBOX BEST NETWORK CONTENT SAME  "
            + " | " + entry.name
            // + " | CUR HASH: " + entry.content_hash
            // + " | OLD HASH: " + bestNetworkHashMap.get(entry.name).content_hash
            + " | " + getTimeStamp(entry.client_modified)
          ));
          cb();
        }
      }
      else {

        loadFile(folder, entry.name, function(err, networkObj){

          if (err) {
            console.log(chalkError("DROPBOX BEST NETWORK LOAD FILE ERROR: " + err));
            return(cb());
          }

          console.log(chalkInfo("DROPBOX BEST NETWORK"
            + " | " + networkObj.successRate.toFixed(1) + "%"
            + " | " + getTimeStamp(networkObj.createdAt)
            + " | " + networkObj.networkId
            + " | " + networkObj.networkCreateMode
            + " | IN: " + networkObj.numInputs
            + " | OUT: " + networkObj.numOutputs
          ));

          bestNetworkHashMap.set(entry.name, entry);
          nnArray.push(networkObj);
          cb();

        });
      }
    }, function(){
      if (callback !== undefined) { callback(null, nnArray); }
    });

  })
  .catch(function(err){
    console.log(chalkError("*** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
    if (callback !== undefined) { callback(err, null); }
  });
}

function printNetworkObj(title, nnObj){
  console.log(chalkNetwork("\n==================="
    + "\n" + title
    + "\nID:      " + nnObj.networkId
    + "\nCREATED: " + getTimeStamp(nnObj.createdAt)
    + "\nSUCCESS: " + nnObj.successRate.toFixed(2) + "%"
    + "\nINPUTS:  " + Object.keys(nnObj.inputs)
    + "\nEVOLVE\n" + jsonPrint(nnObj.evolve)
    + "\n===================\n"
  ));
}



function loadBestNeuralNetworkFile(){

  return new Promise(function(resolve, reject) {

    console.log(chalkNetwork("LOADING DROPBOX BEST NEURAL NETWORK"));

    loadBestNetworkDropboxFolder(bestNetworkFolder, function(err, dropboxNetworksArray){

      if (err) {
        console.log(chalkError("LOAD DROPBOX BEST NETWORKS ERROR: " + err));
        reject(new Error(err));
      }
      else if (dropboxNetworksArray.length === 0) {
        console.log(chalkInfo("NO NEW DROPBOX BEST NETWORKS"));
        resolve(null);
      }
      else {

        let maxSuccessRate = 0;
        let nnCurrent = {};

        // let saveFileParams = {
        //   folder: bestNetworkFolder,
        //   file: "",
        //   obj: {},
        //   mode: "add",
        //   autorename: false
        // };

        console.log(chalkInfo("FOUND " + dropboxNetworksArray.length + " NEW DROPBOX BEST NETWORKS"));

        async.eachSeries(dropboxNetworksArray, function(nn, cb){

          debug(chalkInfo("NN"
            + " | ID: " + nn.networkId
            + " | SUCCESS: " + nn.successRate.toFixed(2) + "%"
          ));

          if (nn.successRate > maxSuccessRate) {

             console.log(chalkNetwork("NEW MAX NN"
              + " | ID: " + nn.networkId
              + " | SUCCESS: " + nn.successRate.toFixed(2) + "%"
            ));

            maxSuccessRate = nn.successRate;
            nnCurrent = nn;
            nnCurrent.inputs = nn.inputs;

            cb();

          }
          else {
            cb();
          }

        }, function(err){
          if (err) {
            console.log(chalkError("*** loadBestNeuralNetworkFile ERROR\n" + err));
            reject(new Error(err));
          }
          else if (currentBestNetwork) {

            printNetworkObj("LOADING NEURAL NETWORK", nnCurrent);

            if (currentBestNetwork.networkId !== nnCurrent.networkId) {

              printNetworkObj("NEW BEST NETWORK", nnCurrent);

              currentBestNetwork = nnCurrent;

              Object.keys(nnCurrent.inputs).forEach(function(type){
                console.log(chalkNetwork("NN INPUTS TYPE" 
                  + " | " + type
                  + " | INPUTS: " + nnCurrent.inputs[type].length
                ));
                inputArrays[type] = nnCurrent.inputs[type];
              });

              network = neataptic.Network.fromJSON(nnCurrent.network);

              statsObj.currentBestNetworkId = nnCurrent.networkId;
              statsObj.network = {};
              statsObj.network.networkId = nnCurrent.networkId;
              statsObj.network.networkType = nnCurrent.networkType;
              statsObj.network.successRate = nnCurrent.successRate;
              statsObj.network.input = nnCurrent.network.input;
              statsObj.network.output = nnCurrent.network.output;
              statsObj.network.evolve = {};
              statsObj.network.evolve = nnCurrent.evolve;

              resolve(nnCurrent);

            }
            else {
              console.log("--- " + nnCurrent.networkId + " | " + nnCurrent.successRate.toFixed(2));
              resolve(null);
            }
          }
          else {

            currentBestNetwork = nnCurrent;
            printNetworkObj("LOADED BEST NETWORK", nnCurrent);

            Object.keys(nnCurrent.inputs).forEach(function(type){
              console.log(chalkNetwork("NN INPUTS TYPE" 
                + " | " + type
                + " | INPUTS: " + nnCurrent.inputs[type].length
              ));
              inputArrays[type] = nnCurrent.inputs[type];
            });

            network = neataptic.Network.fromJSON(nnCurrent.network);

            statsObj.currentBestNetworkId = nnCurrent.networkId;
            statsObj.network = {};
            statsObj.network.networkId = nnCurrent.networkId;
            statsObj.network.networkType = nnCurrent.networkType;
            statsObj.network.successRate = nnCurrent.successRate;
            statsObj.network.input = nnCurrent.network.input;
            statsObj.network.output = nnCurrent.network.output;
            statsObj.network.evolve = {};
            statsObj.network.evolve = nnCurrent.evolve;

            resolve(nnCurrent);
          }
        });

      }

    });

  });
}


function loadNeuralNetwork(options, callback){

  console.log(chalkAlert("loadNeuralNetwork\n" + jsonPrint(options)));

  if (options.networkId === "BEST"){
    loadBestNeuralNetworkFile()
    .then(function(bestNetworkObj){
      callback(null, bestNetworkObj);
    })
    .catch(function(err){
      callback(err, null);
    });
  }
  else {
    const file = options.networkId + ".json";
    loadFile(bestNetworkFolder, file, function(err, nn){
    // NeuralNetwork.findOne({networkId: options.networkId}, function(err, nn){
      if (err) {
        console.log(chalkError("*** DROPBOX LOAD NEURAL NETWORK ERR"
          + " | " + bestNetworkFolder + "/" + file
          + "\n" + err
        ));
        callback(err, null);
      }
      else if (!nn){
        console.log("NO NETWORK FOUND " + options.networkId);
        callback(null, null);
      }
      else{
        console.log(chalkInfo("NETWORK FOUND"
          + " | ID: " + nn.networkId
          + " | SUCCESS: " + nn.successRate.toFixed(2) + "%"
        ));

        async.each(Object.keys(nn.inputs), function(type, cb){
          console.log(chalkNetwork("NN INPUTS TYPE" 
            + " | " + type
            + " | INPUTS: " + nn.inputs[type].length
          ));

          inputArrays[type] = nn.inputs[type];
          trainingSetLabels.inputs[type] = nn.inputs[type];
          cb();

        }, function(){

          network = neataptic.Network.fromJSON(nn.network);

          statsObj.seedNetworkId = nn.networkId;
          statsObj.network = {};
          statsObj.network.networkId = nn.networkId;
          statsObj.network.networkType = nn.networkType;
          statsObj.network.successRate = nn.successRate;
          statsObj.network.input = nn.network.input;
          statsObj.network.output = nn.network.output;
          statsObj.network.evolve = {};
          statsObj.network.evolve = nn.evolve;

          callback(null, nn);
        });
      }
    });
  }
}


function initInputArrays(cnf, callback){

  console.log(chalkBlue("INIT INPUT ARRAYS"));
  console.log(chalkBlue("INIT INPUT ARRAYS cnf\n" + jsonPrint(cnf)));

  let folder = dropboxConfigDefaultFolder;
  let inputFilePrefix = "defaultInput";

  if ((cnf.evolve.networkId !== undefined) && cnf.evolve.networkId && (cnf.evolve.networkId !== "false")) {

    console.log(chalkBlue("INIT INPUT ARRAYS FROM NET: " + cnf.evolve.networkId));
    // NeuralNetwork.findOne({networkId: cnf.evolve.networkId}, function(err, nnObj){
    loadNeuralNetwork({networkId: cnf.evolve.networkId}, function(err, nnObj){

      if (err) {
        return(callback(err));
      }

      console.log("FOUND SEED NETWORK"
        + "\nNET ID:  " + nnObj.networkId 
        + "\nSUCCESS: " + nnObj.successRate.toFixed(1) + "%"
        + "\nIN:      " + nnObj.network.input
        + "\nOUT:     " + nnObj.network.output
        + "\nEVOLVE:  " + jsonPrint(nnObj.evolve) 
        + "\nTRAIN:   " + jsonPrint(nnObj.train)
        + "\nTEST:    " + jsonPrint(nnObj.test)
        + "\nCREATED: " + moment(new Date(nnObj.createdAt)).format(compactDateTimeFormat) 
      );

      async.eachSeries(inputTypes, function(inputType, cb){

        let inputArrayObj = nnObj.inputs;

        arrayUnique(inputArrayObj[inputType]);

        inputArrayObj[inputType].sort();

        inputArrays[inputType] = {};
        inputArrays[inputType] = inputArrayObj[inputType];

        trainingSetLabels.inputs[inputType] = inputArrays[inputType];

        console.log(chalkBlue("LOADED " + inputType.toUpperCase() + " ARRAY"
          + " | " + inputArrayObj[inputType].length + " " + inputType.toUpperCase()
        ));
        cb();

      }, function(err){
        if (err){
          console.log(chalkError("ERR\n" + jsonPrint(err)));
          callback(err);
        }
        else {
          console.log(chalkBlue("LOADED INPUT ARRAYS FROM SEED NETWORK"));
          callback(null);
        }

      });

    });


  }
  else {

    async.eachSeries(inputTypes, function(inputType, cb){

      const inputFile = inputFilePrefix + jsUcfirst(inputType) + ".json";

      console.log("INIT " + inputType.toUpperCase() + " INPUT ARRAY: " + inputFile);

      loadFile(folder, inputFile, function(err, inputArrayObj){
        if (!err) {
          debug(jsonPrint(inputArrayObj));

          arrayUnique(inputArrayObj[inputType]);

          inputArrayObj[inputType].sort();

          inputArrays[inputType] = {};
          inputArrays[inputType] = inputArrayObj[inputType];
          trainingSetLabels.inputs[inputType] = inputArrays[inputType];

          console.log(chalkBlue("LOADED " + inputType.toUpperCase() + " ARRAY"
            + " | " + inputArrayObj[inputType].length + " " + inputType.toUpperCase()
          ));
          cb();
        }
        else {
          console.log(chalkError("ERROR: loadFile: " + dropboxConfigFolder + "/" + inputFile));
          cb(err);
        }
      });

    }, function(err){
      if (err){
        console.log(chalkError("ERR\n" + jsonPrint(err)));
        callback(err);
      }
      else {
        console.log(chalkBlue("LOADED INPUT ARRAY FILES"));
        callback();
      }
    });
    
  }
}

function initialize(cnf, callback){

  debug(chalkBlue("INITIALIZE cnf\n" + jsonPrint(cnf)));

  if (debug.enabled || debugCache.enabled || debugQ.enabled){
    console.log("\n%%%%%%%%%%%%%%\n DEBUG ENABLED \n%%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.TNN_PROCESS_NAME || "twitterNeuralNetwork";
  cnf.runId = process.env.TNN_RUN_ID || statsObj.runId;

  cnf.verbose = process.env.TNN_VERBOSE_MODE || false ;
  cnf.quitOnError = process.env.TNN_QUIT_ON_ERROR || false ;
  cnf.enableStdin = process.env.TNN_ENABLE_STDIN || true ;
  cnf.networkCreateMode = process.env.TNN_NETWORK_CREATE_MODE || DEFAULT_NETWORK_CREATE_MODE ;


  if (process.env.TNN_EVOLVE_BEST_NETWORK !== undefined) {
    if (process.env.TNN_EVOLVE_BEST_NETWORK === "true") {
      cnf.useBestNetwork = true ;
    }
    else {
      cnf.useBestNetwork = false ;
    }
  }

  cnf.evolve.networkId = process.env.TNN_SEED_NETWORK_ID || DEFAULT_SEED_NETWORK_ID ;

  if (cnf.evolve.networkId === "false") {
    cnf.evolve.networkId = false;
  }
  cnf.evolve.activation = process.env.TNN_EVOLVE_ACTIVATION || DEFAULT_EVOLVE_ACTIVATION ;
  cnf.evolve.clear = process.env.TNN_EVOLVE_CLEAR || DEFAULT_EVOLVE_CLEAR ;
  cnf.evolve.cost = process.env.TNN_EVOLVE_COST || DEFAULT_EVOLVE_COST ;
  cnf.evolve.elitism = process.env.TNN_EVOLVE_ELITISM || DEFAULT_EVOLVE_ELITISM ;
  cnf.evolve.equal = process.env.TNN_EVOLVE_EQUAL || DEFAULT_EVOLVE_EQUAL ;
  cnf.evolve.error = process.env.TNN_EVOLVE_ERROR || DEFAULT_EVOLVE_ERROR ;
  cnf.evolve.iterations = process.env.TNN_ITERATIONS || DEFAULT_ITERATIONS ;
  cnf.evolve.mutation = process.env.TNN_EVOLVE_MUTATION || DEFAULT_EVOLVE_MUTATION ;
  cnf.evolve.mutationRate = process.env.TNN_EVOLVE_MUTATION_RATE || DEFAULT_EVOLVE_MUTATION_RATE ;
  cnf.evolve.popsize = process.env.TNN_EVOLVE_POP_SIZE || DEFAULT_EVOLVE_POPSIZE ;

  cnf.train.networkId = process.env.TNN_SEED_NETWORK_ID || DEFAULT_SEED_NETWORK_ID ;
  if (cnf.train.networkId === "false") {
    cnf.train.networkId = false;
  }
  cnf.train.hiddenLayerSize = process.env.TNN_TRAIN_HIDDEN_LAYER_SIZE || DEFAULT_TRAIN_HIDDEN_LAYER_SIZE ;
  cnf.train.error = process.env.TNN_TRAIN_ERROR || DEFAULT_TRAIN_ERROR ;
  cnf.train.cost = process.env.TNN_TRAIN_COST || DEFAULT_TRAIN_COST ;
  cnf.train.rate = process.env.TNN_TRAIN_RATE || DEFAULT_TRAIN_RATE ;
  cnf.train.dropout = process.env.TNN_TRAIN_DROPOUT || DEFAULT_TRAIN_DROPOUT;
  cnf.train.shuffle = process.env.TNN_TRAIN_SHUFFLE || DEFAULT_TRAIN_SHUFFLE;
  cnf.train.iterations = process.env.TNN_ITERATIONS || DEFAULT_ITERATIONS ;
  cnf.train.clear = process.env.TNN_TRAIN_CLEAR || DEFAULT_TRAIN_CLEAR ;
  cnf.train.momentum = process.env.TNN_TRAIN_MOMENTUM || DEFAULT_TRAIN_MOMENTUM ;
  cnf.train.ratePolicy = process.env.TNN_TRAIN_RATE_POLICY || DEFAULT_TRAIN_RATE_POLICY ;
  cnf.train.batchSize = process.env.TNN_TRAIN_BATCH_SIZE || DEFAULT_TRAIN_BATCH_SIZE ;

  cnf.classifiedUsersFile = process.env.TNN_CLASSIFIED_USERS_FILE || classifiedUsersFile;
  cnf.classifiedUsersFolder = classifiedUsersFolder;
  cnf.statsUpdateIntervalTime = process.env.TNN_STATS_UPDATE_INTERVAL || 60000;

  debug(chalkWarn("dropboxConfigFolder: " + dropboxConfigFolder));
  debug(chalkWarn("dropboxConfigFile  : " + dropboxConfigFile));

  if (process.env.TNN_BATCH_MODE) {

    console.log(chalkAlert("\n\nBATCH MODE\n\n"));

    initStatsUpdate(cnf, function(err, cnf2){
      if (err) {
        console.log(chalkError("ERROR initStatsUpdate\n" + jsonPrint(err)));
      }
      debug("initStatsUpdate cnf2\n" + jsonPrint(cnf2));

      initInputArrays(cnf2, function(err){
        return(callback(err, cnf2));
      });

    });
  }
  else{
    loadFile(dropboxConfigHostFolder, dropboxConfigFile, function(err, loadedConfigObj){

      let commandLineConfigKeys;
      let configArgs;

      if (!err) {
        console.log(dropboxConfigFile + "\n" + jsonPrint(loadedConfigObj));

        if (loadedConfigObj.TNN_SEED_NETWORK_ID  !== undefined){
          console.log("LOADED TNN_SEED_NETWORK_ID: " + loadedConfigObj.TNN_SEED_NETWORK_ID);
          cnf.evolve.networkId = loadedConfigObj.TNN_SEED_NETWORK_ID;
          cnf.train.networkId = loadedConfigObj.TNN_SEED_NETWORK_ID;
        }

        if (loadedConfigObj.TNN_TRAIN_BEST_NETWORK  !== undefined){
          console.log("LOADED TNN_TRAIN_BEST_NETWORK: " + loadedConfigObj.TNN_TRAIN_BEST_NETWORK);
          cnf.train.useBestNetwork = loadedConfigObj.TNN_TRAIN_BEST_NETWORK;
        }

        if (loadedConfigObj.TNN_EVOLVE_BEST_NETWORK  !== undefined){
          console.log("LOADED TNN_EVOLVE_BEST_NETWORK: " + loadedConfigObj.TNN_EVOLVE_BEST_NETWORK);
          cnf.evolve.useBestNetwork = loadedConfigObj.TNN_EVOLVE_BEST_NETWORK;
        }

        if (loadedConfigObj.TNN_ITERATIONS  !== undefined){
          console.log("LOADED TNN_ITERATIONS: " + loadedConfigObj.TNN_ITERATIONS);
          cnf.evolve.iterations = loadedConfigObj.TNN_ITERATIONS;
          cnf.train.iterations = loadedConfigObj.TNN_ITERATIONS;
        }

        if (loadedConfigObj.TNN_VERBOSE_MODE  !== undefined){
          console.log("LOADED TNN_VERBOSE_MODE: " + loadedConfigObj.TNN_VERBOSE_MODE);
          cnf.verbose = loadedConfigObj.TNN_VERBOSE_MODE;
        }

        if (loadedConfigObj.TNN_TEST_MODE  !== undefined){
          console.log("LOADED TNN_TEST_MODE: " + loadedConfigObj.TNN_TEST_MODE);
          cnf.testMode = loadedConfigObj.TNN_TEST_MODE;
        }

        if (loadedConfigObj.TNN_ENABLE_STDIN  !== undefined){
          console.log("LOADED TNN_ENABLE_STDIN: " + loadedConfigObj.TNN_ENABLE_STDIN);
          cnf.enableStdin = loadedConfigObj.TNN_ENABLE_STDIN;
        }

        if (loadedConfigObj.TNN_STATS_UPDATE_INTERVAL  !== undefined) {
          console.log("LOADED TNN_STATS_UPDATE_INTERVAL: " + loadedConfigObj.TNN_STATS_UPDATE_INTERVAL);
          cnf.statsUpdateIntervalTime = loadedConfigObj.TNN_STATS_UPDATE_INTERVAL;
        }

        if (loadedConfigObj.TNN_KEEPALIVE_INTERVAL  !== undefined) {
          console.log("LOADED TNN_KEEPALIVE_INTERVAL: " + loadedConfigObj.TNN_KEEPALIVE_INTERVAL);
          cnf.keepaliveInterval = loadedConfigObj.TNN_KEEPALIVE_INTERVAL;
        }

        // OVERIDE CONFIG WITH COMMAND LINE ARGS

        commandLineConfigKeys = Object.keys(commandLineConfig);

        commandLineConfigKeys.forEach(function(arg){
          if (arg === "hiddenLayerSize") {
            cnf.train.hiddenLayerSize = commandLineConfig[arg];
            console.log("--> COMMAND LINE CONFIG | train.hiddenLayerSize: " + cnf.train.hiddenLayerSize);
          }
          else if (arg === "seedNetworkId") {
            cnf.train.networkId = commandLineConfig[arg];
            cnf.evolve.networkId = commandLineConfig[arg];
            console.log("--> COMMAND LINE CONFIG | train.network.networkId: " + cnf.train.networkId);
            console.log("--> COMMAND LINE CONFIG | evolve.network.networkId: " + cnf.evolve.networkId);
          }
          else if (arg === "evolveIterations") {
            cnf.train.iterations = commandLineConfig[arg];
            cnf.evolve.iterations = commandLineConfig[arg];
            console.log("--> COMMAND LINE CONFIG | train.iterations: " + cnf.train.iterations);
            console.log("--> COMMAND LINE CONFIG | evolve.iterations: " + cnf.evolve.iterations);
          }
          else {
            cnf[arg] = commandLineConfig[arg];
            console.log("--> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
          }
        });

        configArgs = Object.keys(cnf);

        configArgs.forEach(function(arg){
          if (arg === "evolve") {
            console.log("FINAL CONFIG | " + arg + ": " + jsonPrint(cnf[arg]));
          }
          else {
            console.log("FINAL CONFIG | " + arg + ": " + cnf[arg]);
          }
        });

        if (cnf.enableStdin){

          console.log("STDIN ENABLED");

          stdin = process.stdin;
          if(stdin.setRawMode  !== undefined) {
            stdin.setRawMode( true );
          }
          stdin.resume();
          stdin.setEncoding( "utf8" );
          stdin.on( "data", function( key ){

            switch (key) {
              case "\u0003":
                process.exit();
              break;

              // case "d":
              //   configuration.enableHeapDump = !configuration.enableHeapDump;
              //   console.log(chalkRedBold("HEAP DUMP: " + configuration.enableHeapDump));
              // break;
              case "v":
                configuration.verbose = !configuration.verbose;
                console.log(chalkRedBold("VERBOSE: " + configuration.verbose));
              break;
              case "q":
                quit();
              break;
              case "Q":
                quit();
              break;
              case "s":
                showStats();
              break;
              case "S":
                showStats(true);
              break;
              default:
                console.log(
                  "\n" + "q/Q: quit"
                  + "\n" + "s: showStats"
                  + "\n" + "S: showStats verbose"
                );
            }

          });
        }

        initStatsUpdate(cnf, function(err, cnf2){

          if (err) {
            console.log(chalkError("ERROR initStatsUpdate\n" + err));
          }

          debug("initStatsUpdate cnf2\n" + jsonPrint(cnf2));

          initInputArrays(cnf2, function(err){
            return(callback(err, cnf2));
          });

        });
      }
      else {
        console.error(chalkError("ERROR LOAD DROPBOX CONFIG: " + dropboxConfigFile
          + "\n" + jsonPrint(err)
        ));

        if (err.status === 404){
          // OVERIDE CONFIG WITH COMMAND LINE ARGS

          commandLineConfigKeys = Object.keys(commandLineConfig);

          commandLineConfigKeys.forEach(function(arg){
            if (arg === "hiddenLayerSize") {
              cnf.train.hiddenLayerSize = commandLineConfig[arg];
              console.log("--> COMMAND LINE CONFIG | train.hiddenLayerSize: " + cnf.train.hiddenLayerSize);
            }
            else if (arg === "seedNetworkId") {
              cnf.train.networkId = commandLineConfig[arg];
              cnf.evolve.networkId = commandLineConfig[arg];
              console.log("--> COMMAND LINE CONFIG | train.network.networkId: " + cnf.train.networkId);
              console.log("--> COMMAND LINE CONFIG | evolve.network.networkId: " + cnf.evolve.networkId);
            }
            else if (arg === "evolveIterations") {
              cnf.train.iterations = commandLineConfig[arg];
              cnf.evolve.iterations = commandLineConfig[arg];
              console.log("--> COMMAND LINE CONFIG | train.iterations: " + cnf.train.iterations);
              console.log("--> COMMAND LINE CONFIG | evolve.iterations: " + cnf.evolve.iterations);
            }
            else {
              cnf[arg] = commandLineConfig[arg];
              console.log("--> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
            }
          });

          configArgs = Object.keys(cnf);

          configArgs.forEach(function(arg){
            console.log("_FINAL CONFIG | " + arg + ": " + cnf[arg]);
          });

          if (cnf.enableStdin){

            console.log("STDIN ENABLED");

            stdin = process.stdin;
            if(stdin.setRawMode  !== undefined) {
              stdin.setRawMode( true );
            }
            stdin.resume();
            stdin.setEncoding( "utf8" );
            stdin.on( "data", function( key ){

              switch (key) {
                case "\u0003":
                  process.exit();
                break;
                case "v":
                  configuration.verbose = !configuration.verbose;
                  console.log(chalkRedBold("VERBOSE: " + configuration.verbose));
                break;
                case "q":
                  quit();
                break;
                case "Q":
                  quit();
                break;
                case "s":
                  showStats();
                break;
                case "S":
                  showStats(true);
                break;
                default:
                  console.log(
                    "\n" + "q/Q: quit"
                    + "\n" + "s: showStats"
                    + "\n" + "S: showStats verbose"
                  );
              }
            });
          }

          initStatsUpdate(cnf, function(err, cnf2){
            if (err) {
              console.log(chalkError("ERROR initStatsUpdate\n" + jsonPrint(err)));
            }
            debug("initStatsUpdate cnf2\n" + jsonPrint(cnf2));

            initInputArrays(cnf2, function(err){
              return(callback(err, cnf2));
            });

          });


        }
       }
    });
  }
}

console.log(chalkInfo(getTimeStamp() 
  + " | WAIT 5 SEC FOR MONGO BEFORE INITIALIZE CONFIGURATION"
));

configEvents.once("INIT_MONGODB", function(){

  wordAssoDb = require("@threeceelabs/mongoose-twitter");
  db = wordAssoDb();

  NeuralNetwork = require("mongoose").model("NeuralNetwork");
  User = require("mongoose").model("User");

  userServer = require("@threeceelabs/user-server-controller");
});


// FUTURE: break up into updateClassifiedUsers and createTrainingSet
function updateClassifiedUsers(cnf, callback){

  let classifiedUserIds = Object.keys(classifiedUserHashmap);
  let maxMagnitude = 0;
  let totalInputHits = 0;

  console.log(chalkBlue("UPDATE CLASSIFIED USERS: " + classifiedUserIds.length));

  if (cnf.normalization) {
    maxMagnitude = cnf.normalization.magnitude.max;
  }

  async.each(classifiedUserIds, function(userId, cb0){

    debug(chalkInfo("updateClassifiedUsers: userId: " + userId));

    User.findOne({userId: userId.toString()}, function(err, user){

      if (err){
        console.error(chalkError("USER FIND ONE ERROR: " + err));
        return(cb0(err));
      }

      if (!user){
        debug(chalkError("USER NOT FOUND: " + userId));
        return(cb0());
      }

      if (user.screenName === undefined) {
        console.log(chalkError("USER SCREENNAME UNDEFINED\n" + jsonPrint(user)));
        return(cb0("USER SCREENNAME UNDEFINED", null));
      }

      let sentimentText;

      let sentimentObj = {};
      sentimentObj.magnitude = 0;
      sentimentObj.score = 0;

      if ((user.languageAnalysis !== undefined)
        && (user.languageAnalysis.sentiment !== undefined)) {

        sentimentObj.magnitude = user.languageAnalysis.sentiment.magnitude;
        sentimentObj.score = user.languageAnalysis.sentiment.score;

        if (!cnf.normalization) {
          maxMagnitude = Math.max(maxMagnitude, sentimentObj.magnitude);
        }
      }

      sentimentText = "M: " + sentimentObj.magnitude.toFixed(2) + " S: " + sentimentObj.score.toFixed(2);

      let keywordArray = Object.keys(user.keywords);

      let classification = (keywordArray[0] !== undefined) ? keywordArray[0] : false;
      let threeceeFollowing = (user.threeceeFollowing) ? user.threeceeFollowing.screenName : "-";

      if (classification) {

        let classText = "";
        let currentChalk = chalkLog;

        switch (classification) {
          case "left":
            classifiedUserHistogram.left += 1;
            classText = "L";
            currentChalk = chalk.blue;
          break;
          case "right":
            classifiedUserHistogram.right += 1;
            classText = "R";
            currentChalk = chalk.yellow;
          break;
          case "neutral":
            classifiedUserHistogram.neutral += 1;
            classText = "N";
            currentChalk = chalk.black;
          break;
          case "positive":
            classifiedUserHistogram.positive += 1;
            classText = "+";
            currentChalk = chalk.green;
          break;
          case "negative":
            classifiedUserHistogram.negative += 1;
            classText = "-";
            currentChalk = chalk.red;
          break;
          default:
            classifiedUserHistogram.none += 1;
            classText = "O";
            currentChalk = chalk.bold.gray;
        }

        debug(chalkInfo("\n==============================\n"));
        debug(currentChalk("ADD  | U"
          + " | SEN: " + sentimentText
          + " | " + classText
          + " | " + user.screenName
          + " | " + user.userId
          + " | " + user.name
          + " | 3C FOLLOW: " + threeceeFollowing
          + " | FLLWs: " + user.followersCount
          + " | FRNDs: " + user.friendsCount
          // + " | " + jsonPrint(user.keywords)
        ));

        debug(currentChalk("CL U HIST"
          + " | L: " + classifiedUserHistogram.left
          + " | R: " + classifiedUserHistogram.right
          + " | N: " + classifiedUserHistogram.neutral
          + " | +: " + classifiedUserHistogram.positive
          + " | -: " + classifiedUserHistogram.negative
          + " | 0: " + classifiedUserHistogram.none
        ));

        let trainingSetDatum = {};

        trainingSetDatum.inputHits = 0;

        trainingSetDatum.input = [];
        trainingSetDatum.input.push(sentimentObj.magnitude);
        trainingSetDatum.input.push(sentimentObj.score);

        // KLUDGE!!!! should only need to create trainingSetLabels once per network creation

        if (trainingSetLabels.inputs.length === 0){
          trainingSetLabels.inputs.sentiment = [];

          trainingSetLabels.inputs.sentiment.push("magnitude");
          trainingSetLabels.inputs.sentiment.push("score");

          trainingSetLabels.inputRaw.push("magnitude");
          trainingSetLabels.inputRaw.push("score");
        }

        async.waterfall([
          function userScreenName(cb) {
            if (user.screenName !== undefined) {
              cb(null, "@" + user.screenName);
            }
            else {
              cb(null, null);
            }
          },
          function userName(text, cb) {
            if (user.name !== undefined) {
              if (text) {
                cb(null, text + " | " + user.name);
              }
              else {
                cb(null, user.name);
              }
            }
            else {
              if (text) {
                cb(null, text);
              }
              else {
                cb(null, null);
              }
            }
          },
          function userStatusText(text, cb) {
            // console.log("user.status\n" + jsonPrint(user.status));
            if ((user.status !== undefined) && user.status && user.status.text) {

              debug(chalkBlue("T"
                + " | " + user.userId
                + " | " + jsonPrint(user.status.text)
              ));

              if (text) {
                cb(null, text + "\n" + user.status.text);
              }
              else {
                cb(null, user.status.text);
              }
            }
            else {
              if (text) {
                cb(null, text);
              }
              else {
                cb(null, null);
              }
            }
          },
          function userRetweetText(text, cb) {
            if ((user.status !== undefined) && user.status) {
              if ((user.status.retweeted_status !== undefined) && user.status.retweeted_status) {

                debug(chalkBlue("R"
                  + " | " + user.userId
                  + " | " + jsonPrint(user.status.retweeted_status.text)
                ));


                if (text) {
                  cb(null, text + "\n" + user.status.retweeted_status.text);
                }
                else {
                  cb(null, user.status.retweeted_status.text);
                }
              }
              else {
                if (text) {
                  cb(null, text);
                }
                else {
                  cb(null, null);
                }
              }
            }
            else {
              if (text) {
                cb(null, text);
              }
              else {
                cb(null, null);
              }
            }
          },
          function userDescriptionText(text, cb) {
            if ((user.description !== undefined) && user.description) {
              if (text) {
                cb(null, text + "\n" + user.description);
              }
              else {
                cb(null, user.description);
              }
            }
            else {
              if (text) {
                cb(null, text);
              }
              else {
                cb(null, null);
              }
            }
          }
        ], function (err, text) {

          if (err) {
            console.error(chalkError("*** ERROR " + err));
            return(cb0(err));
          }

          if (!text || (text === undefined)) { text = " "; }

          twitterTextParser.parseText(text, {updateGlobalHistograms: true}, function(err, hist){

            if (err) {
              console.error("*** PARSE TEXT ERROR\n" + err);
              return(cb0(err));
            }

            userServer.updateHistograms({user: user, histograms: hist}, function(err, updateduser){

              if (err) {
                console.error("*** UPDATE USER HISTOGRAMS ERROR\n" + err);
                return(cb0(err));
              }

              const userHistograms = updateduser.histograms;

              debug(chalkLog("user.description + status histograms\n" + jsonPrint(userHistograms)));

              debug("user.description + status\n" + jsonPrint(text));

              async.eachSeries(inputTypes, function(type, cb1){

                debug(chalkAlert("START ARRAY: " + type + " | " + inputArrays[type].length));

                if (trainingSetLabels.inputs[type] === undefined) {
                  trainingSetLabels.inputs[type] = [];
                  trainingSetLabels.inputs[type] = inputArrays[type];
                  trainingSetLabels.inputRaw = trainingSetLabels.inputRaw.concat(inputArrays[type]);
                }

                async.eachSeries(inputArrays[type], function(element, cb2){

                  if ((userHistograms[type] !== undefined) && userHistograms[type][element]) {

                    trainingSetDatum.input.push(1);
                    trainingSetDatum.inputHits += 1;

                    debug(chalkBlue("+ DATUM BIT: " + type
                      + " | INPUT HITS: " + trainingSetDatum.inputHits 
                      + " | " + element 
                      + " | " + userHistograms[type][element]
                    ));

                    async.setImmediate(function() {
                      cb2();
                    });

                  }
                  else {

                    trainingSetDatum.input.push(0);
                    debug(chalkInfo("- DATUM BIT: " + type
                      + " | " + element 
                    ));

                    async.setImmediate(function() {
                      cb2();
                    });

                  }
                }, function(err){
                  if (err) {
                    console.error("*** PARSE TEXT ERROR\n" + err);
                    cb1(err);
                  }
                  debug(chalkAlert("DONE ARRAY: " + type));
                  cb1();
                });

              }, function(err){

                if (err) {
                  console.error("*** PARSE TEXT ERROR\n" + err);
                  return(cb0(err));
                }

                debug(chalkAlert("PARSE DESC COMPLETE"));

                trainingSetDatum.output = [];

                switch (keywordArray[0]){
                  case "left":
                    trainingSetDatum.output = [1,0,0];
                  break;
                  case "neutral":
                    trainingSetDatum.output = [0,1,0];
                  break;
                  case "right":
                    trainingSetDatum.output = [0,0,1];
                  break;
                  default:
                    trainingSetDatum.output = [0,0,0];
                }

                totalInputHits += trainingSetDatum.inputHits;

                testObj.numInputs = trainingSetDatum.input.length;
                testObj.numOutputs = trainingSetDatum.output.length;

                debug("trainingSet " + trainingSet.length + " | INPUT:  " + trainingSetDatum.input.length);
                debug("trainingSetDatum OUTPUT: " + trainingSetDatum.output);

                trainingSet.push({name: user.screenName.toLowerCase(), datum: trainingSetDatum});
                cb0();
              });
            });

          });

        });   
      }
      else {
        console.log(chalkBlue("USER KW>DB"
          + " | KW: " + keywordArray
          + " | " + classification
          + " | " + user.userId
          + " | " + user.screenName
          + " | " + user.name
          + " | 3CF: " + threeceeFollowing
          + " | FLs: " + user.followersCount
          + " | FRs: " + user.friendsCount
          + " | SEN: " + sentimentText
        ));

        console.log(chalkBlue("KEYWORDS: " + Object.keys(classifiedUserHashmap[userId])));

        user.keywords = classifiedUserHashmap[userId];

        userServer.findOneUser(user, {noInc: true}, function(err, updatedUser){
          if (err) {
            return(cb0(err));
          }
          debug("updatedUser\n" + jsonPrint(updatedUser));
          cb0();
        });
      }

    });
  }, function(err){

    if (err) {
      console.log(chalkError("UPDATE CLASSIFIED USERS ERROR: " + err));
    }

    console.log(chalkAlert("CL U HIST"
      + " | L: " + classifiedUserHistogram.left
      + " | R: " + classifiedUserHistogram.right
      + " | N: " + classifiedUserHistogram.neutral
      + " | +: " + classifiedUserHistogram.positive
      + " | -: " + classifiedUserHistogram.negative
      + " | 0: " + classifiedUserHistogram.none
    ));

    let inputHitAverage = totalInputHits/trainingSet.length;

    console.log(chalkBlue("\nMAX MAGNITUDE:        " + maxMagnitude));
    console.log(chalkBlue("TOTAL INPUT HITS:     " + totalInputHits));
    console.log(chalkBlue("AVE INPUT HITS/DATUM: " + inputHitAverage.toFixed(3)));
    statsObj.normalization.magnitude.max = maxMagnitude;

    testObj.inputHits = totalInputHits;
    testObj.inputHitAverage = inputHitAverage;

    async.each(trainingSet, function(dataObj, cb3){

      if (maxMagnitude > 0) {
        let normMagnitude = dataObj.datum.input[0]/maxMagnitude;
        dataObj.datum.input[0] = normMagnitude;
      }
      else {
        dataObj.datum.input[0] = 0;
      }

      if (configuration.testMode) {
        testObj.testSet.push(dataObj);
        cb3();
      }
      // trainingSet.push({name: user.screenName, datum: trainingSetDatum});
      else if (requiredTrainingSet.has(dataObj.name.toLowerCase())) {
        console.log(chalkAlert("+++ ADD REQ TRAINING SET | @" + dataObj.name));
        trainingSetNormalized.push(dataObj);
        cb3();
      }
      else if (Math.random() > cnf.testSetRatio) {
        trainingSetNormalized.push(dataObj);
        cb3();
      }
      else {
        testObj.testSet.push(dataObj);
        cb3();
      }

    }, function(){
      callback(err, null);
    });

  });
}

function activateNetwork(n, input){

  const output = n.activate(input);
  return output;
}

function testNetwork(nw, testObj, callback){

  console.log(chalkBlue("TEST NETWORK"
    + " | TEST RUN ID: " + testObj.testRunId
    + " | NETWORK ID: " + testObj.testRunId
    + " | " + testObj.testSet.length + " TEST DATA POINTS"
  ));

  let numTested = 0;
  let numSkipped = 0;
  let numPassed = 0;
  let successRate = 0;
  let testResultArray = [];

  async.each(testObj.testSet, function(testDatumObj, cb){

    if (testDatumObj.datum.input.length !== testObj.numInputs) {
      console.error(chalkError("MISMATCH INPUT"
        + " | TEST INPUTS: " + testDatumObj.datum.input.length 
        + " | NETW INPUTS: " + testObj.numInputs 
      ));
      cb("MISMATCH INPUT");
    }


    const testOutput = activateNetwork(nw, testDatumObj.datum.input);

    debug(chalkLog("========================================"));

    numTested += 1;

    indexOfMax(testOutput, function(testMaxOutputIndex, to){

      debug("INDEX OF MAX TEST OUTPUT: " + to);

      indexOfMax(testDatumObj.datum.output, function(expectedMaxOutputIndex, eo){

        debug("INDEX OF MAX TEST OUTPUT: " + eo);

        let passed = (testMaxOutputIndex === expectedMaxOutputIndex);

        numPassed = passed ? numPassed+1 : numPassed;

        successRate = 100 * numPassed/(numTested + numSkipped);

        let currentChalk = passed ? chalkLog : chalkAlert;

        testResultArray.push(
          {
            // testIn: testDatumObj.datum.input,
            P: passed,
            EO: testDatumObj.datum.output,
            EOI: expectedMaxOutputIndex,
            TO: testOutput, 
            TOI: testMaxOutputIndex
          }
        );

        debug(currentChalk("TEST RESULT: " + passed 
          + " | " + successRate.toFixed(2) + "%"
          // + "\n" + "TO: " + testOutput 
          + "\n" + testOutput[0]
          + " " + testOutput[1]
          + " " + testOutput[2]
          + " | TMOI: " + testMaxOutputIndex
          // + "\n" + "EO: " + testDatum.output 
          + "\n" + testDatumObj.datum.output[0]
          + " " + testDatumObj.datum.output[1]
          + " " + testDatumObj.datum.output[2]
          + " | EMOI: " + expectedMaxOutputIndex
          // + "\n==================================="
        ));

        cb();
      });

    });

  }, function(err){

    callback(err, 
      { testRunId: testObj.testRunId, 
        numTests: testObj.testSet.length, 
        numSkipped: numSkipped, 
        numPassed: numPassed, 
        successRate: successRate,
        testResultArray: testResultArray
      }
    );

  });
}

function initMain(cnf){

  loadFile(cnf.classifiedUsersFolder, cnf.classifiedUsersFile, function(err, clUsObj){

    if (!err) {

      debug(jsonPrint(clUsObj));

      classifiedUserHashmap = clUsObj;

      console.log(chalkBlue("INITIALIZED CLASSIFIED USERS"
        + " | " + Object.keys(classifiedUserHashmap).length
      ));

      updateClassifiedUsers(cnf, function(err, clUsHist){

        debug("updateClassifiedUsers clUsHist\n" + jsonPrint(clUsHist));

        if (err) {
          console.error("*** UPDATE CLASSIFIED USER ERROR ***\n" + jsonPrint(err));
          quit("UPDATE CLASSIFIED USER ERROR");
        }

        if (trainingSetNormalized.length === 0) {
          console.error("*** NO TRAINING SET DATA POINTS ??? ***\n" + jsonPrint(err));
          quit("NO TRAINING SET DATA POINTS");
          return;
        }

        let messageObj = {};

        console.log(chalkBlue("\nTRAINING SET NORMALIZED"
          + " | " + trainingSetNormalized.length + " DATA POINTS"
          + " | NN CREATE MODE: " + cnf.networkCreateMode
          // + " | " + jsonPrint(trainingSetNormalized[0])
        ));

        debug(chalkBlue("\nTRAINING SET NORMALIZED\n" + jsonPrint(trainingSetNormalized[0])));

        switch (cnf.networkCreateMode) {

          case "evolve":
            messageObj = {
              op: "EVOLVE",
              testRunId: testObj.testRunId,
              threads: cnf.evolve.threads,
              architecture: cnf.evolve.architecture,
              network: cnf.evolve.network,
              inputs: trainingSetLabels.inputs,
              outputs: trainingSetLabels.outputs,
              trainingSet: trainingSetNormalized,
              normalization: statsObj.normalization,
              iterations: cnf.evolve.iterations,
              mutation: cnf.evolve.mutation,
              activation: cnf.evolve.activation,
              equal: cnf.evolve.equal,
              popsize: cnf.evolve.popsize,
              cost: cnf.evolve.cost,
              elitism: cnf.evolve.elitism,
              log: cnf.evolve.log,
              error: cnf.evolve.error,
              mutationRate: cnf.evolve.mutationRate,
              clear: cnf.evolve.clear
            };

            statsObj.tests[testObj.testRunId].numInputs = trainingSetNormalized[0].datum.input.length;
            statsObj.tests[testObj.testRunId].numOutputs = trainingSetNormalized[0].datum.output.length;

            statsObj.evolve = {};
            statsObj.evolve.options = {};
            statsObj.evolve.options = omit(messageObj, ["network", "trainingSet", "inputs", "outputs"]);

            if (messageObj.network && (messageObj.network !== undefined)) {
              statsObj.evolve.options.network = {};
              statsObj.evolve.options.network = pick(messageObj, ["networkId", "successRate"]);
            }

            console.log(chalkBlue("\nSTART NETWORK EVOLVE"));

            console.log(chalkBlue("TEST RUN ID: " + messageObj.testRunId
              + "\nTRAINING SET LENGTH: " + messageObj.trainingSet.length
              + "\nTEST SET LENGTH:     " + testObj.testSet.length
              + "\nITERATIONS:          " + messageObj.iterations
            ));

            neuralNetworkChild.send(messageObj, function(err){
              if (err) {
                console.error(chalkError("*** NEURAL NETWORK CHILD SEND ERROR: " + err));
              }
            });

          break;

          case "train":

            messageObj = {
              op: "TRAIN",
              testRunId: testObj.testRunId,
              trainingSet: trainingSetNormalized,
              threads: cnf.train.threads,
              architecture: cnf.train.architecture,
              inputs: trainingSetLabels.inputs,
              outputs: trainingSetLabels.outputs,
              hiddenLayerSize: cnf.train.hiddenLayerSize,
              log: cnf.train.log,
              error: cnf.train.error,
              cost: cnf.train.cost,
              rate: cnf.train.rate,
              dropout: cnf.train.dropout,
              shuffle: cnf.train.shuffle,
              iterations: cnf.train.iterations,
              clear: cnf.train.clear,
              momentum: cnf.train.momentum,
              ratePolicy: cnf.train.ratePolicy,
              batchSize: cnf.train.batchSize
            };
            console.log(chalkBlue("\nSTART NETWORK TRAIN"));

            console.log(chalkBlue("TEST RUN ID: " + messageObj.testRunId
              + "\nTRAINING SET LENGTH: " + messageObj.trainingSet.length
              + "\nITERATIONS:          " + messageObj.iterations
            ));

            neuralNetworkChild.send(messageObj, function(err){
              if (err) {
                console.error(chalkError("*** NEURAL NETWORK CHILD SEND ERROR: " + err));
              }
            });

          break;

          default:
            console.log(chalkError("UNKNOWN NETWORK CREATE MODE: " + cnf.networkCreateMode));
        }


      });
    }
    else {
      console.log(chalkError("ERROR: loadFile: " + cnf.classifiedUsersFolder + "/" + cnf.classifiedUsersFile));
    }
  });
}

function initNeuralNetworkChild(callback){

  statsObj.neuralNetworkReady = false;

  neuralNetworkChild = cp.fork(`neuralNetworkChild.js`);

  neuralNetworkChild.on("message", function(m){

    debug(chalkAlert("neuralNetworkChild RX"
      + " | " + m.op
      // + " | " + m.obj.userId
      // + " | " + m.obj.screenName
      // + " | " + m.obj.name
      // + "\n" + jsonPrint(m)
    ));

    if (m.error) {
      console.error(chalkError("neuralNetworkChild RX ERROR: " + m.error));
      if (callback !== undefined) { 
        return(callback(m.error));
      }
      return;
    }

    switch(m.op) {

      case "INIT_COMPLETE":
        statsObj.neuralNetworkReady = true;
        console.log(chalkInfo("TEST NEURAL NETWORK"));
        neuralNetworkChild.send({op: "TEST_EVOLVE"});
      break;

      case "READY":
        statsObj.neuralNetworkReady = true;
        console.log(chalkInfo("INIT NEURAL NETWORK"));
        neuralNetworkChild.send({op: "INIT", testRunId: testObj.testRunId});
      break;

      case "STATS":
        console.log("NNC | STATS___________________________\n" + jsonPrint(statsObj, "NNC | STATS "));
        console.log("NNC | STATS___________________________\n");
      break;

      case "TEST_EVOLVE_COMPLETE":
        if (m.results) {
          console.log(chalkAlert("TEST EVOLVE XOR PASS"));
          // neuralNetworkReady = true;
          initMain(configuration);
        }
        else {
          console.error(chalkError("*** TEST EVOLVE XOR FAILED ***"));
          quit("TEST EVOLVE FAILED");
        }
      break;

      case "TRAIN_COMPLETE":

        console.log(chalkBlue("NETWORK TRAIN COMPLETE"
          + "\nELAPSED: " + msToTime(m.networkObj.elapsed)
          + "\nITERTNS: " + m.statsObj.train.options.iterations
          // + "\nSEED NN: " + m.networkObj.train.options.network.networkId
          + "\nINPUTS:  " + m.networkObj.network.input
          + "\nOUTPUTS: " + m.networkObj.network.output
          + "\nDROPOUT: " + m.networkObj.network.dropout
          + "\nNODES:   " + m.networkObj.network.nodes.length
          + "\nCONNS:   " + m.networkObj.network.connections.length
        ));

        if (m.networkObj.train.options.network) {
          console.log(chalkBlue("\nSEED NN: " + m.networkObj.train.options.network.networkId));
        }

        network = neataptic.Network.fromJSON(m.networkObj.network);

        testNetwork(network, testObj, function(err, results){

          if (err) {
            console.error("*** TEST NETWORK ERROR ***\n" + jsonPrint(err));
          }

          testObj.results = {};
          testObj.results = results;

          statsObj.tests[testObj.testRunId] = {};
          statsObj.tests[testObj.testRunId] = pick(
            testObj, 
            ["numInputs", "numOutputs", "inputHits", "inputHitAverage"]
          );
          statsObj.tests[testObj.testRunId].results = {};
          statsObj.tests[testObj.testRunId].results = pick(
            testObj.results, 
            ["successRate", "numPassed", "numSkipped", "numTests", "testRunId"]
          );
          statsObj.tests[testObj.testRunId].training = {};
          statsObj.tests[testObj.testRunId].train = {};
          statsObj.tests[testObj.testRunId].train.options = omit(m.statsObj.train.options, ["network", "inputs", "outputs"]);

          if (m.statsObj.train.options.network && (m.statsObj.train.options.network !== undefined)){
            statsObj.tests[testObj.testRunId].train.network = {};
            statsObj.tests[testObj.testRunId].train.network.networkId = m.statsObj.train.options.network.networkId;
            statsObj.tests[testObj.testRunId].train.network.successRate = m.statsObj.train.options.network.successRate;
          }

          statsObj.tests[testObj.testRunId].elapsed = m.networkObj.elapsed;

          console.log(chalkBlue("\nNETWORK TEST COMPLETE\n==================="));

          let columns = columnify(results.testResultArray, {  minWidth: 8});
          console.log(chalkAlert(columns));

          console.log(chalkBlue("\nNETWORK TEST COMPLETE\n==================="
            + "\n  TESTS:   " + results.numTests
            + "\n  PASSED:  " + results.numPassed
            + "\n  SKIPPED: " + results.numSkipped
            + "\n  SUCCESS: " + results.successRate.toFixed(1) + "%"
            // + "\n  TRAIN OPTIONS"
            // + "\n  " + jsonPrint(statsObj.tests[testObj.testRunId].train.options)
          ));

          const options = statsObj.tests[testObj.testRunId].train.options;

          console.log("\nTRAIN OPTIONS\n===================");
          Object.keys(options).forEach(function(key){
            if (key === "network") {
              console.log("  " + key + ": " + options[key].networkId + " | " + options[key].successRate.toFixed(2) + "%");
            }
            else {
              console.log("  " + key + ": " + options[key]);
            }
          });

          let networkObj = new NeuralNetwork();
          networkObj.networkCreateMode = "train";
          networkObj.createdAt = moment().valueOf();
          networkObj.networkId = testObj.testRunId;
          networkObj.network = m.networkObj.network;
          networkObj.successRate = results.successRate;
          networkObj.numInputs = m.networkObj.network.input
          networkObj.numOutputs = m.networkObj.network.output
          networkObj.inputs = trainingSetLabels.inputs;
          networkObj.outputs = trainingSetLabels.outputs;
          networkObj.train = {};
          networkObj.train.options = {};
          networkObj.train.options = omit(m.statsObj.train.options, ["network", "inputs", "outputs"]);

          networkObj.test = statsObj.tests[testObj.testRunId];
          networkObj.test.train.options = omit(statsObj.tests[testObj.testRunId].train.options, ["inputs", "output"]);

          if (m.statsObj.train.options.network && (m.statsObj.train.options.network !== undefined)){
            networkObj.train.options.network = {};
            networkObj.train.options.network.networkId = m.statsObj.train.options.network.networkId;
            networkObj.train.options.network.successRate = m.statsObj.train.options.network.successRate;

            networkObj.test.train.network = {};
            networkObj.test.train.network.networkId = m.statsObj.train.options.network.networkId;
            networkObj.test.train.network.successRate = m.statsObj.train.options.network.successRate;
          }

          bestNetworkFile = networkObj.networkId + ".json";

          console.log(chalkLog("SAVING NN FILE TO DROPBOX"
            + " | " + bestNetworkFolder + "/" + bestNetworkFile
          ));

          saveFile({folder: bestNetworkFolder, file: bestNetworkFile, obj: networkObj}, function(err){
            console.log("SAVED NETWORK TO DROPBOX"
              + "\nNET ID:  " + networkObj.networkId 
              + "\nCREATE:  " + networkObj.networkCreateMode 
              // + "\nTYPE:    " + updateNetworkObj.networkType
              + "\nSUCCESS: " + networkObj.successRate.toFixed(1) + "%"
              + "\nIN:      " + networkObj.network.input
              + "\nOUT:     " + networkObj.network.output
              + "\nEVOLVE:  " + jsonPrint(networkObj.evolve) 
              + "\nTRAIN:   " + jsonPrint(networkObj.train)
              + "\nTEST:    " + jsonPrint(networkObj.test)
              + "\nCREATED: " + moment(new Date(networkObj.createdAt)).format(compactDateTimeFormat) 
            );

            console.log(chalkInfo("WAIT FOR NETWORK FILE SAVE ..."));

            setTimeout(function(){
              quit();
            }, 10000);

          });

        });

      break;

      case "EVOLVE_COMPLETE":

        console.log(chalkBlue("NETWORK EVOLVE COMPLETE"
          + "\nELAPSED: " + msToTime(m.networkObj.elapsed)
          + "\nITERTNS: " + m.statsObj.evolve.results.iterations
          + "\nERROR:   " + m.statsObj.evolve.results.error
          + "\nINPUTS:  " + m.networkObj.network.input
          + "\nOUTPUTS: " + m.networkObj.network.output
          + "\nDROPOUT: " + m.networkObj.network.dropout
          + "\nNODES:   " + m.networkObj.network.nodes.length
          + "\nCONNS:   " + m.networkObj.network.connections.length
        ));

        if (m.networkObj.evolve.options.network) {
          console.log(chalkBlue("\nSEED NN"
            + " | " + m.networkObj.evolve.options.network.networkId
          ));
        }

        network = neataptic.Network.fromJSON(m.networkObj.network);

        testNetwork(network, testObj, function(err, results){

          if (err) {
            console.error("*** TEST NETWORK ERROR ***\n" + jsonPrint(err));
          }

          testObj.results = {};
          testObj.results = results;

          statsObj.tests[testObj.testRunId] = {};
          statsObj.tests[testObj.testRunId] = pick(
            testObj, 
            ["numInputs", "numOutputs", "inputHits", "inputHitAverage"]
          );
          statsObj.tests[testObj.testRunId].results = {};
          statsObj.tests[testObj.testRunId].results = pick(
            testObj.results, 
            ["successRate", "numPassed", "numSkipped", "numTests", "testRunId"]
          );

          statsObj.tests[testObj.testRunId].elapsed = m.networkObj.elapsed;

          console.log(chalkBlue("\nNETWORK TEST COMPLETE\n==================="));

          let columns = columnify(results.testResultArray, {  minWidth: 8, maxWidth: 16});
          console.log(chalkAlert(columns));

          console.log(chalkBlue("\nNETWORK TEST COMPLETE\n==================="
            + "\n  TESTS:   " + results.numTests
            + "\n  PASSED:  " + results.numPassed
            + "\n  SKIPPED: " + results.numSkipped
            + "\n  SUCCESS: " + results.successRate.toFixed(1) + "%"
          ));

          // const options = statsObj.tests[testObj.testRunId].evolve.options;
          const options = m.statsObj.evolve.options;

          console.log("\nEVOLVE OPTIONS\n===================");
          Object.keys(options).forEach(function(key){
            if (key === "network") {
              console.log("  " + key + ": " + options[key].networkId + " | " + options[key].successRate.toFixed(2) + "%");
            }
            else {
              console.log("  " + key + ": " + options[key]);
            }
          });

          let networkObj = new NeuralNetwork();
          networkObj.networkCreateMode = "evolve";
          networkObj.createdAt = moment().valueOf();
          networkObj.networkId = testObj.testRunId;
          networkObj.network = m.networkObj.network;
          networkObj.successRate = results.successRate;
          networkObj.numInputs = m.networkObj.network.input
          networkObj.numOutputs = m.networkObj.network.output
          networkObj.inputs = trainingSetLabels.inputs;
          networkObj.outputs = trainingSetLabels.outputs;
          networkObj.evolve = {};
          networkObj.evolve.options = {};
          networkObj.evolve.options = omit(m.statsObj.evolve.options, ["network", "inputs", "outputs"]);

          networkObj.test = statsObj.tests[testObj.testRunId];

          if (m.statsObj.evolve.options.network && (m.statsObj.evolve.options.network !== undefined)){
            networkObj.evolve.options.network = {};
            networkObj.evolve.options.network.networkId = m.statsObj.evolve.options.network.networkId;
            networkObj.evolve.options.network.successRate = m.statsObj.evolve.options.network.successRate;
          }

          bestNetworkFile = networkObj.networkId + ".json";

          console.log(chalkLog("SAVING NN FILE TO DROPBOX"
            + " | " + bestNetworkFolder + "/" + bestNetworkFile
          ));

          saveFile({folder: bestNetworkFolder, file: bestNetworkFile, obj: networkObj}, function(err){
            console.log("SAVED NETWORK TO DROPBOX"
              + "\nNET ID:  " + networkObj.networkId 
              + "\nCREATE:  " + networkObj.networkCreateMode 
              // + "\nTYPE:    " + updateNetworkObj.networkType
              + "\nSUCCESS: " + networkObj.successRate.toFixed(1) + "%"
              + "\nIN:      " + networkObj.network.input
              + "\nOUT:     " + networkObj.network.output
              + "\nEVOLVE:  " + jsonPrint(networkObj.evolve) 
              + "\nTRAIN:   " + jsonPrint(networkObj.train)
              + "\nTEST:    " + jsonPrint(networkObj.test)
              + "\nCREATED: " + moment(new Date(networkObj.createdAt)).format(compactDateTimeFormat) 
            );

            console.log(chalkInfo("WAIT FOR NETWORK FILE SAVE ..."));

            setTimeout(function(){
              quit();
            }, 10000);

          });

        });
      break;

      default:
      console.error(chalkError("neuralNetworkChild | UNKNOWN OP: " + m.op));
    }
  });

  if (callback !== undefined) { callback(); }
}

function initTimeout(){

  console.log(chalkError("\nSET TIMEOUT | " + moment().format(compactDateTimeFormat) + "\n"));

  configEvents.emit("INIT_MONGODB");

  initialize(configuration, function(err, cnf){

    if (err && (err.status !== 404)) {
      console.error(chalkError("***** INIT ERROR *****\n" + jsonPrint(err)));
      quit();
    }

    configuration = cnf;

    console.log(chalkBlue("\n\n" + cnf.processName + " STARTED " + getTimeStamp() + "\n" + jsonPrint(configuration)));

    requiredTrainingSet.forEach(function(userId) {
      console.log(chalkAlert("... REQ TRAINING SET | @" + userId));
    });

    if (cnf.useBestNetwork) {

      loadBestNeuralNetworkFile()
      .then(function(nnObj){

        console.log(chalkAlert("BEST NN: " + nnObj.networkId));

        configuration.evolve.networkId = nnObj.networkId;
        configuration.evolve.network = nnObj;

        initNeuralNetworkChild(function(){
          if (process.env.TNN_BATCH_MODE){
            slackChannel = "#nn_batch";
          }
        });

      })
      .catch(function(err){
        console.log(chalkError("LOAD NN ERROR\n" + err));
        quit(err);
      });

    }
    else if (cnf.evolve.networkId){

      loadNeuralNetwork({networkId: cnf.evolve.networkId}, function(err, nnObj){

        if (err) {
          console.error(chalkError("loadNeuralNetwork ERROR\n" + err));
          throw err;
        }

        configuration.evolve.network = nnObj;

        initNeuralNetworkChild(function(){

          if (process.env.TNN_BATCH_MODE){
            slackChannel = "#nn_batch";
          }

        });

      });
    }

    else {

      initNeuralNetworkChild(function(){

        if (process.env.TNN_BATCH_MODE){
          slackChannel = "#nn_batch";
        }

      });
    }

  });
}

initTimeout();

