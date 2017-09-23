/*jslint node: true */
"use strict";

const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;
const ONE_HOUR = 60 * ONE_MINUTE;

const DEFAULT_INIT_MAIN_INTERVAL = process.env.INIT_MAIN_INTERVAL || ONE_HOUR;

const neataptic = require("neataptic");
const twitterTextParser = require("@threeceelabs/twitter-text-parser");
const defaults = require("object.defaults/immutable");
const deepcopy = require("deep-copy");
const table = require("text-table");

const inputTypes = ["emoji", "hashtags", "mentions", "urls", "words"];
inputTypes.sort();

let networkIndex = 0;

const MIN_INPUT_HITS = 10;
const DEFAULT_MAX_NEURAL_NETWORK_CHILDREN = 2;
const DEFAULT_TEST_RATIO = 0.1;

const DEFAULT_NETWORK_CREATE_MODE = "evolve";
const DEFAULT_ITERATIONS = 10;
const DEFAULT_SEED_NETWORK_ID = false;

const DEFAULT_MIN_SUCCESS_RATE = 80; // percent
const OFFLINE_MODE = true;
const DEFAULT_ENABLE_RANDOM = true;
const DEFAULT_BATCH_MAX_INSTANCES = 3;
const DEFAULT_BEST_NETWORK_NUMBER = 5;
const SEED_NETWORK_PROBABILITY = 0.9;

const DEFAULT_EVOLVE_THREADS = 1;
const DEFAULT_EVOLVE_ARCHITECTURE = "random";
const DEFAULT_EVOLVE_BEST_NETWORK = false;

const DEFAULT_EVOLVE_CLEAR = true;

// const EVOLVE_COST_ARRAY = [
//   "CROSS_ENTROPY",
//   "MSE",
//   "BINARY"
//   // "MAE",TEST COMPLETE
//   // "MAPE",
//   // "MSLE",
//   // "HINGE"
// ];

// const DEFAULT_EVOLVE_COST = "MSE";
const DEFAULT_EVOLVE_COST = "CROSS_ENTROPY";
// const DEFAULT_EVOLVE_COST = "BINARY";

const DEFAULT_EVOLVE_ELITISM = 10;
const DEFAULT_EVOLVE_EQUAL = true;
const DEFAULT_EVOLVE_ERROR = 0.03;
const DEFAULT_EVOLVE_LOG = 1;
const DEFAULT_EVOLVE_MUTATION = neataptic.methods.mutation.FFW;
const DEFAULT_EVOLVE_MUTATION_RATE = 0.5;
const DEFAULT_EVOLVE_POPSIZE = 100;

const EVOLVE_COST_ARRAY = [
  "CROSS_ENTROPY",
  "MSE",
  "BINARY"
  // "MAE",
  // "MAPE",
  // "MSLE",
  // "HINGE"
];

const EVOLVE_MUTATION_RATE_RANGE = { min: 0.3, max: 0.85 } ;
const EVOLVE_POP_SIZE_RANGE = { min: 100, max: 200 } ;
const EVOLVE_ELITISM_RANGE = { min: 5, max: 25 } ;

const DEFAULT_TRAIN_THREADS = 1;
const DEFAULT_TRAIN_ARCHITECTURE = "perceptron";
const DEFAULT_TRAIN_BEST_NETWORK = false;
const DEFAULT_TRAIN_HIDDEN_LAYER_SIZE = 10;
const DEFAULT_TRAIN_LOG = 1;
const DEFAULT_TRAIN_ERROR = 0.01;
const DEFAULT_TRAIN_COST = "MSE";
const DEFAULT_TRAIN_RATE = 0.3;
const DEFAULT_TRAIN_DROPOUT = 0;
const DEFAULT_TRAIN_SHUFFLE = false;
const DEFAULT_TRAIN_CLEAR = true;
const DEFAULT_TRAIN_MOMENTUM = 0;
const DEFAULT_TRAIN_RATE_POLICY = "FIXED";
const DEFAULT_TRAIN_BATCH_SIZE = 1;

let neuralNetworkChildHashMap = {};
let classifiedUserHashmapReadyFlag = false;
let trainingSetReady = false;

let trainingSet = [];
let trainingSetNormalized = [];
let trainingSetNormalizedTotal = [];  // to be saved to dropbox
// let trainingSetBasic = []; // only { input: xxx, output: ooo }

let trainingSetLabels = {};
trainingSetLabels.inputRaw = [];
trainingSetLabels.inputs = {};
trainingSetLabels.outputs = ["left", "neutral", "right"];

inputTypes.forEach(function(type){
  trainingSetLabels.inputs[type] = [];
});

let inputArrays = {};


let requiredTrainingSet = new Set();
requiredTrainingSet.add("angela_rye");
requiredTrainingSet.add("barackobama");
requiredTrainingSet.add("bfraser747");
requiredTrainingSet.add("breitbartnews");
requiredTrainingSet.add("danscavino");
requiredTrainingSet.add("dnc");
requiredTrainingSet.add("foxandfriends");
requiredTrainingSet.add("foxnews");
requiredTrainingSet.add("gop");
requiredTrainingSet.add("gopchairwoman");
requiredTrainingSet.add("hannity");
requiredTrainingSet.add("hillaryclinton");
requiredTrainingSet.add("jaketapper");
requiredTrainingSet.add("jaredkushner");
requiredTrainingSet.add("kamalaharris");
requiredTrainingSet.add("loudobbs");
requiredTrainingSet.add("maddow");
requiredTrainingSet.add("mikepence");
requiredTrainingSet.add("mikepencevp");
requiredTrainingSet.add("mittromney");
requiredTrainingSet.add("mmflint");
requiredTrainingSet.add("msnbc");
requiredTrainingSet.add("nancypelosi");
requiredTrainingSet.add("newtgingrich");
requiredTrainingSet.add("nytimes");
requiredTrainingSet.add("potus");
requiredTrainingSet.add("proudresister");
requiredTrainingSet.add("realalexjones");
requiredTrainingSet.add("realdonaldtrump");
requiredTrainingSet.add("realjameswoods");
requiredTrainingSet.add("senategop");
requiredTrainingSet.add("sensanders");
requiredTrainingSet.add("sheriffclarke");
requiredTrainingSet.add("speakerryan");
requiredTrainingSet.add("tuckercarlson");
requiredTrainingSet.add("usatoday");
requiredTrainingSet.add("vp");

let slackChannel = "#nn";



let configuration = {};

configuration.initMainIntervalTime = DEFAULT_INIT_MAIN_INTERVAL;
configuration.enableRequiredTrainingSet = false;

configuration.maxNeuralNetworkChildern = (process.env.TNN_MAX_NEURAL_NETWORK_CHILDREN !== undefined) ? process.env.TNN_MAX_NEURAL_NETWORK_CHILDREN : DEFAULT_MAX_NEURAL_NETWORK_CHILDREN;
configuration.minSuccessRate = (process.env.TNN_MIN_SUCCESS_RATE !== undefined) 
  ? process.env.TNN_MIN_SUCCESS_RATE 
  : DEFAULT_MIN_SUCCESS_RATE;

configuration.loadTrainingSetFromFile = false;
configuration.createTrainingSet = false;

configuration.DROPBOX = {};
configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
configuration.DROPBOX.DROPBOX_TNN_CONFIG_FILE = process.env.DROPBOX_TNN_CONFIG_FILE || "twitterNeuralNetworkConfig.json";
configuration.DROPBOX.DROPBOX_TNN_STATS_FILE = process.env.DROPBOX_TNN_STATS_FILE || "twitterNeuralNetworkStats.json";

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
const randomItem = require("random-item");
const randomFloat = require("random-float");
const randomInt = require("random-int");

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
statsObj.errors.users = {};
statsObj.errors.users.findOne = 0;
statsObj.startTimeMoment = moment();
statsObj.startTime = moment().valueOf();
statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
statsObj.neuralNetworkReady = false;

const DEFAULT_RUN_ID = hostname + "_" + process.pid + "_" + statsObj.startTimeMoment.format(compactDateTimeFormat);

if (process.env.TNN_RUN_ID !== undefined) {
  statsObj.runId = process.env.TNN_RUN_ID;
  console.log(chalkAlert("NNT | ENV RUN ID: " + statsObj.runId));
}
else {
  statsObj.runId = DEFAULT_RUN_ID;
  console.log(chalkAlert("NNT | DEFAULT RUN ID: " + statsObj.runId));
}

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
let currentSeedNetwork;
let currentBestNetwork;
let networkCreateResultsHashmap = {};

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
// let NeuralNetwork; // DB

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
      console.error(chalkError("NNT | *** SLACK POST MESSAGE ERROR"
        + " | CH: " + channel
        + "\nNNT | TEXT: " + text
        + "\nNNT | ERROR: " + err
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

const createTrainingSet = { name: "createTrainingSet", alias: "c", type: Boolean};
const loadTrainingSetFromFile = { name: "loadTrainingSetFromFile", alias: "t", type: Boolean};
const networkCreateMode = { name: "networkCreateMode", alias: "n", type: String, defaultValue: "evolve" };
const hiddenLayerSize = { name: "hiddenLayerSize", alias: "h", type: Number, defaultValue: DEFAULT_TRAIN_HIDDEN_LAYER_SIZE };
const seedNetworkId = { name: "seedNetworkId", alias: "s", type: String };
const useBestNetwork = { name: "useBestNetwork", alias: "b", type: Boolean };
const testMode = { name: "testMode", alias: "T", type: Boolean, defaultValue: false };
const evolveIterations = { name: "evolveIterations", alias: "I", type: Number};

const optionDefinitions = [
  createTrainingSet,
  loadTrainingSetFromFile,
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

statsObj.normalization = {};
statsObj.normalization.score = {};
statsObj.normalization.magnitude = {};

statsObj.normalization.score.min = -1.0;
statsObj.normalization.score.max = 1.0;
statsObj.normalization.magnitude.min = 0;
statsObj.normalization.magnitude.max = -Infinity;


let testObj = {};
testObj.testRunId = statsObj.runId;
testObj.results = {};
testObj.testSet = [];

statsObj.tests = {};
statsObj.tests[testObj.testRunId] = {};

statsObj.evolve = {};
statsObj.train = {};

console.log("\n\nNNT | =================================");
console.log("NNT | HOST:          " + hostname);
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

const defaultTrainingSetFolder = dropboxConfigDefaultFolder + "/trainingSets";
const trainingSetFolder = dropboxConfigHostFolder + "/trainingSets";
const defaultTrainingSetFile = "trainingSet.json";
let trainingSetFile = "trainingSet.json";

const statsFolder = "/stats/" + hostname + "/neuralNetwork";
const statsFile = "twitterNeuralNetworkStats_" + statsObj.runId + ".json";

const bestNetworkFolder = "/config/utility/best/neuralNetworks";
let bestNetworkFile;


debug("statsFolder : " + statsFolder);
debug("statsFile : " + statsFile);


console.log("NNT | DROPBOX_TNN_CONFIG_FILE: " + configuration.DROPBOX.DROPBOX_TNN_CONFIG_FILE);
console.log("NNT | DROPBOX_TNN_STATS_FILE : " + configuration.DROPBOX.DROPBOX_TNN_STATS_FILE);

debug("dropboxConfigFolder : " + dropboxConfigFolder);
debug("dropboxConfigHostFolder : " + dropboxConfigHostFolder);
debug("dropboxConfigFile : " + dropboxConfigFile);

debug("NNT | DROPBOX_WORD_ASSO_ACCESS_TOKEN :" + configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN);
debug("NNT | DROPBOX_WORD_ASSO_APP_KEY :" + configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY);
debug("NNT | DROPBOX_WORD_ASSO_APP_SECRET :" + configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET);

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

function indexOfMax (arr, callback) {

  if (arr.length === 0) {
    console.log(chalkAlert("NNT | indexOfMax: 0 LENG ARRAY: -1"));
    return(callback(-2, arr)) ; 
  }

  if ((arr[0] === arr[1]) && (arr[1] === arr[2])){
    debug(chalkAlert("NNT | indexOfMax: ALL EQUAL"));
    debug(chalkAlert("NNT | ARR" 
      + " | " + arr[0].toFixed(2) 
      + " - " + arr[1].toFixed(2) 
      + " - " + arr[2].toFixed(2)
    ));
    if (arr[0] === 0) { return(callback(-4, arr)); }
    return(callback(4, [1,1,1])) ; 
  }

  debug("NNT | B4 ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));
  arrayNormalize(arr);
  debug("NNT | AF ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));

  if (((arr[0] === 1) && (arr[1] === 1)) 
    || ((arr[0] === 1) && (arr[2] === 1))
    || ((arr[1] === 1) && (arr[2] === 1))){

    debug(chalkAlert("NNT | indexOfMax: MULTIPLE SET"));

    debug(chalkAlert("NNT | ARR" 
      + " | " + arr[0].toFixed(2) 
      + " - " + arr[1].toFixed(2) 
      + " - " + arr[2].toFixed(2)
    ));

    async.eachOf(arr, function(val, index, cb0){
      if (val < 1) {
        arr[index] = 0;
      }
      async.setImmediate(function() { cb0(); });
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
      async.setImmediate(function() { cb1(); });
    }, function(){

      async.eachOf(arr, function(val, index, cb2){
        if (val < 1) {
          arr[index] = 0;
        }
        async.setImmediate(function() { cb2(); });
      }, function(){
        callback(maxIndex, arr); 
      });

    });

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
      + " | " + testObj.testRunId
      + " | " + configuration.networkCreateMode.toUpperCase()
      + " | RUN " + statsObj.elapsed
      + " | NOW " + moment().format(compactDateTimeFormat)
      + " | STRT " + moment(parseInt(statsObj.startTime)).format(compactDateTimeFormat)
      + " | ITR " + configuration.evolve.iterations
    ));

    console.log(chalkLog("NNT | CL U HIST"
      + " | L: " + classifiedUserHistogram.left
      + " | R: " + classifiedUserHistogram.right
      + " | N: " + classifiedUserHistogram.neutral
      + " | +: " + classifiedUserHistogram.positive
      + " | -: " + classifiedUserHistogram.negative
      + " | 0: " + classifiedUserHistogram.none
    ));

    printNetworkCreateResultsHashmap();

    // Object.keys(neuralNetworkChildHashMap).forEach(function(nnChildId){

    //   if (statsObj.tests[testObj.testRunId][nnChildId] !== undefined) {
    //     if (statsObj.tests[testObj.testRunId][nnChildId].results.successRate !== undefined) {
    //       console.log(chalkLog("NNT"
    //         + " | " + nnChildId
    //         + " | " + testObj.testRunId
    //         + " | " + configuration.networkCreateMode.toUpperCase()
    //         + " | RUN: " + statsObj.elapsed
    //         + " | ITR: " + configuration.evolve.iterations
    //         + " | TESTS: " + statsObj.tests[testObj.testRunId][nnChildId].results.numTests
    //         + " | PASS: " + statsObj.tests[testObj.testRunId][nnChildId].results.numPassed
    //         + " | SKIP: " + statsObj.tests[testObj.testRunId][nnChildId].results.numSkipped
    //         + " | RES: " + statsObj.tests[testObj.testRunId][nnChildId].results.successRate.toFixed(2) + " %"
    //       ));
    //     }
    //   }

    // });

  }
}

function quit(options){

  console.log(chalkAlert( "\n\nNNT | ... QUITTING ...\n\n" ));

  clearInterval(initMainInterval);

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

      async.eachSeries(Object.keys(neuralNetworkChildHashMap), function(nnChildId, cb){

        if (statsObj.tests[testObj.testRunId][nnChildId].results) {
          slackText = slackText + "\n*RES: " + statsObj.tests[testObj.testRunId][nnChildId].results.successRate.toFixed(2) + " %*";
        }
        slackText = slackText + " | RUN " + statsObj.elapsed;
        slackText = slackText + "\nTESTS: " + statsObj.tests[testObj.testRunId][nnChildId].results.numTests;
        slackText = slackText + " | PASS: " + statsObj.tests[testObj.testRunId][nnChildId].results.numPassed;
        slackText = slackText + " | SKIP: " + statsObj.tests[testObj.testRunId][nnChildId].results.numSkipped;
        slackText = slackText + " | SEED NET: " + snid;
        slackText = slackText + "\nEVOLVE OPTIONS\n" + jsonPrint(statsObj.evolve[nnChildId].options);
        slackText = slackText + "\nTRAIN OPTIONS\n" + jsonPrint(statsObj.train[nnChildId].options);

        cb();

      }, function(){
        console.log("NNT | SLACK TEXT: " + slackText);
        slackPostMessage(slackChannel, slackText);
      });

    }
    else {

      slackText = "\n*" + statsObj.runId + "*";
      slackText = slackText + " | RUN " + statsObj.elapsed;
      slackText = slackText + " | QUIT CAUSE: " + options;

      console.log("NNT | SLACK TEXT: " + slackText);

      slackPostMessage(slackChannel, slackText);
    }

  }

  showStats();

  setTimeout(function(){

    Object.keys(neuralNetworkChildHashMap).forEach(function(nnChildId){

      const neuralNetworkChild = neuralNetworkChildHashMap[nnChildId].child;

      if (neuralNetworkChild !== undefined) {
        console.log(chalkAlert("*** KILL " + nnChildId));
        neuralNetworkChild.kill("SIGKILL");
      }

      delete neuralNetworkChildHashMap[nnChildId];

    });

    setTimeout(function(){
      process.exit();
    }, 3000);

  }, 1000);
}

process.on( "SIGINT", function() {
  Object.keys(neuralNetworkChildHashMap).forEach(function(nnChildId){

    const neuralNetworkChild = neuralNetworkChildHashMap[nnChildId].child;

    if (neuralNetworkChild !== undefined) {
      console.log(chalkAlert("*** KILL " + nnChildId));
      neuralNetworkChild.kill("SIGKILL");
    }

    delete neuralNetworkChildHashMap[nnChildId];

  });
  quit("SIGINT");
});

process.on("exit", function() {

  Object.keys(neuralNetworkChildHashMap).forEach(function(nnChildId){

    const neuralNetworkChild = neuralNetworkChildHashMap[nnChildId].child;

    if (neuralNetworkChild !== undefined) {
      console.log(chalkAlert("*** KILL " + nnChildId));
      neuralNetworkChild.kill("SIGKILL");
    }

    delete neuralNetworkChildHashMap[nnChildId];

  });

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
      if (callback !== undefined) { return callback(null); }
    })
    .catch(function(error){
      if (error.status === 413){
        console.error(chalkError("NNT | " + moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: 413"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { return callback(error.error_summary); }
      }
      else if (error.status === 429){
        console.error(chalkError("NNT | " + moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: TOO MANY WRITES"
          // + " ERROR\n" + "jsonPrint"(error.error)
        ));
        if (callback !== undefined) { return callback(error.error_summary); }
      }
      else if (error.status === 500){
        console.error(chalkError("NNT | " + moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: DROPBOX SERVER ERROR"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { return callback(error.error_summary); }
      }
      else {
        console.trace(chalkError("NNT | " + moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: " + error
          + " | ERROR\n" + jsonPrint(error)
          // + " ERROR\n" + jsonPrint(params)
        ));
        if (callback !== undefined) { return callback(error); }
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

        console.log(chalkInfo("NNT | DROPBOX FILE"
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
          console.log(chalkError("NNT | *** ERROR DROPBOX SAVE FILE: " + err));
          if (callback !== undefined) { 
            return(callback(err, null));
          }
          return;
        }
        if (fileExits) {
          console.log(chalkAlert("NNT | ... DROPBOX FILE EXISTS ... SKIP SAVE | " + fullPath));
          if (callback !== undefined) { callback(err, null); }
        }
        else {
          console.log(chalkAlert("NNT | ... DROPBOX DOES NOT FILE EXIST ... SAVING | " + fullPath));
          dbFileUpload();
        }
      });
    })
    .catch(function(err){
      console.log(chalkError("NNT | *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
      if (callback !== undefined) { callback(err, null); }
    });
  }
  else {
    dbFileUpload();
  }
}

function saveFileRetry (timeout, path, file, jsonObj, callback){
  setTimeout(function(){
    console.log(chalkError("NNT | SAVE RETRY | TIMEOUT: " + timeout + " | " + path + "/" + file));
    saveFile({folder:path, file:file, obj:jsonObj}, function(err){
      if (err) {
        console.log(chalkError("NNT | SAVE RETRY ON ERROR: " + path + "/" + file));
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
        try {
          let fileObj = JSON.parse(payload);
          callback(null, fileObj);
        }
        catch(e){
          console.trace(chalkError("NNT | JSON PARSE ERROR: " + e));
          // callback(e, null);
        }
      }
      else {
        callback(null, null);
      }
    })
    .catch(function(error) {
      console.log(chalkError("NNT | DROPBOX loadFile ERROR: " + file + "\n" + error));
      console.log(chalkError("NNT | !!! DROPBOX READ " + file + " ERROR"));
      console.log(chalkError("NNT | " + jsonPrint(error.error)));

      if (error.status === 404) {
        console.error(chalkError("NNT | !!! DROPBOX READ FILE " + file + " NOT FOUND"
          + " ... SKIPPING ...")
        );
        return(callback(null, null));
      }
      if (error.status === 409) {
        console.error(chalkError("NNT | !!! DROPBOX READ FILE " + file + " NOT FOUND"));
        return(callback(error, null));
      }
      if (error.status === 0) {
        console.error(chalkError("NNT | !!! DROPBOX NO RESPONSE"
          + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
        return(callback(null, null));
      }
      callback(error, null);
    });
}

let statsUpdateInterval;

function initStatsUpdate(cnf, callback){

  console.log(chalkBlue("NNT | INIT STATS UPDATE INTERVAL | " + cnf.statsUpdateIntervalTime + " MS"));

  clearInterval(statsUpdateInterval);

  statsUpdateInterval = setInterval(function () {

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
    statsObj.timeStamp = moment().format(defaultDateTimeFormat);
 
    showStats();

  }, cnf.statsUpdateIntervalTime);

  callback(null, cnf);
}

function loadBestNetworkDropboxFolder(folder, callback){

  let options = {path: folder};
  let newBestNetwork = false;

  dropboxClient.filesListFolder(options)
  .then(function(response){

    debug(chalkLog("DROPBOX LIST FOLDER"
      + " | " + options.path
      + " | " + jsonPrint(response)
    ));

    let nnArray = [];

    async.eachSeries(response.entries, function(entry, cb){

      console.log(chalkInfo("NNT | DROPBOX BEST NETWORK FOUND"
        + " | " + getTimeStamp(entry.client_modified)
        + " | " + entry.name
        // + " | " + entry.content_hash
        // + "\n" + jsonPrint(entry)
      ));

      if (bestNetworkHashMap.has(entry.name)){

        if (bestNetworkHashMap.get(entry.name).entry.content_hash !== entry.content_hash) {

          console.log(chalkInfo("NNT | DROPBOX BEST NETWORK CONTENT CHANGE"
            + " | " + getTimeStamp(entry.client_modified)
            + " | " + entry.name
            + "\nCUR HASH: " + entry.content_hash
            + "\nOLD HASH: " + bestNetworkHashMap.get(entry.name).entry.content_hash
          ));

          loadFile(folder, entry.name, function(err, networkObj){

            if (err) {
              console.log(chalkError("NNT | DROPBOX BEST NETWORK LOAD FILE ERROR: " + err));
              return(cb());
            }

            console.log(chalkInfo("NNT | DROPBOX BEST NETWORK"
              + " | " + networkObj.successRate.toFixed(2) + "%"
              + " | " + getTimeStamp(networkObj.createdAt)
              + " | " + networkObj.networkId
              + " | " + networkObj.networkCreateMode
              + " | IN: " + networkObj.numInputs
              + " | OUT: " + networkObj.numOutputs
            ));

            bestNetworkHashMap.set(networkObj.networkId, { entry: entry, network: networkObj});
            nnArray.push(networkObj);
            cb();

          });
        }
        else{
          debug(chalkLog("NNT | DROPBOX BEST NETWORK CONTENT SAME  "
            + " | " + entry.name
            + " | " + getTimeStamp(entry.client_modified)
          ));
          cb();
        }
      }
      else {

        loadFile(folder, entry.name, function(err, networkObj){

          if (err) {
            console.log(chalkError("NNT | DROPBOX BEST NETWORK LOAD FILE ERROR: " + err));
            cb();
          }
          else if ((networkObj === undefined) || !networkObj) {
            console.log(chalkError("NNT | DROPBOX BEST NETWORK LOAD FILE ERROR | JSON UNDEFINED ??? "));

            dropboxClient.filesDelete({path: folder + "/" + entry.name})
            .then(function(response){
              console.log(chalkAlert("NNT | XXX NN"
                + " | " + entry.name
              ));
              cb();
            })
            .catch(function(err){
              console.log(chalkError("NNT | *** ERROR: XXX NN"
                + " | " + folder + "/" + entry.name
                + " | " + jsonPrint(err)
              ));
              cb();
            });

          }
          else {

            if ((options.networkId !== undefined) 
              || (networkObj.successRate > configuration.minSuccessRate)) {

              bestNetworkHashMap.set(networkObj.networkId, { entry: entry, network: networkObj});
              nnArray.push(networkObj);

              console.log(chalkInfo("NNT | + NN HASH MAP"
                + " | " + bestNetworkHashMap.count() + " NNs IN HM"
                + " | " + networkObj.successRate.toFixed(2) + "%"
                + " | " + getTimeStamp(networkObj.createdAt)
                + " | IN: " + networkObj.numInputs
                + " | OUT: " + networkObj.numOutputs
                + " | " + networkObj.networkCreateMode
                + " | " + networkObj.networkId
              ));

              if (!currentBestNetwork || (networkObj.successRate > currentBestNetwork.successRate)) {
                currentBestNetwork = networkObj;
                newBestNetwork = true;
                console.log(chalkAlert("NNT | * NEW BEST NN"
                  + " | " + bestNetworkHashMap.count() + " NNs IN HM"
                  + " | " + networkObj.successRate.toFixed(2) + "%"
                  + " | " + getTimeStamp(networkObj.createdAt)
                  + " | IN: " + networkObj.numInputs
                  + " | OUT: " + networkObj.numOutputs
                  + " | " + networkObj.networkCreateMode
                  + " | " + networkObj.networkId
                ));
              }

              cb();

            }
            else {

              bestNetworkHashMap.delete(networkObj.networkId);

              dropboxClient.filesDelete({path: folder + "/" + entry.name})
              .then(function(response){
                console.log(chalkAlert("NNT | XXX NN"
                  + " | MIN SUCCESS RATE: " + configuration.minSuccessRate
                  + " | " + networkObj.successRate.toFixed(2) + "%"
                  + " | " + getTimeStamp(networkObj.createdAt)
                  + " | IN: " + networkObj.numInputs
                  + " | OUT: " + networkObj.numOutputs
                  + " | " + networkObj.networkCreateMode
                  + " | " + networkObj.networkId
                ));
                cb();
              })
              .catch(function(err){
                console.log(chalkError("NNT | *** ERROR: XXX NN"
                  + " | " + folder + "/" + entry.name
                  + " | " + jsonPrint(err)
                ));
                cb();
              });
            }


            // console.log(chalkInfo("NNT | DB BEST NN"
            //   + " | " + networkObj.successRate.toFixed(2) + "%"
            //   + " | " + getTimeStamp(networkObj.createdAt)
            //   + " | " + networkObj.networkId
            //   + " | " + networkObj.networkCreateMode
            //   + " | IN: " + networkObj.numInputs
            //   + " | OUT: " + networkObj.numOutputs
            // ));

            // entry.network = {};
            // entry.network = networkObj;

            // bestNetworkHashMap.set(entry.name, entry);
            // nnArray.push(networkObj);
            // cb();

          }

        });
      }
    }, function(){
      if (callback !== undefined) { callback(null, nnArray); }
    });

  })
  .catch(function(err){
    console.log(chalkError("NNT | *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
    if (callback !== undefined) { callback(err, null); }
  });
}

function printDatum(title, input){

  let row = "";
  let col = 0;
  let rowNum = 0;
  const COLS = 50;

  debug("\nNNT | ------------- " + title + " -------------");

  input.forEach(function(bit, i){
    if (i === 0) {
      row = row + bit.toFixed(10) + " | " ;
    }
    else if (i === 1) {
      row = row + bit.toFixed(10);
    }
    else if (i === 2) {
      debug("NNT | ROW " + rowNum + " | " + row);
      row = bit ? "X" : ".";
      col = 1;
      rowNum += 1;
    }
    else if (col < COLS){
      row = row + (bit ? "X" : ".");
      col += 1;
    }
    else {
      debug("NNT | ROW " + rowNum + " | " + row);
      row = bit ? "X" : ".";
      col = 1;
      rowNum += 1;
    }
  });
}


function printNetworkObj(title, nnObj){
  console.log(chalkNetwork("NNT"
    + " | " + nnObj.networkId
    + " | SUCCESS: " + nnObj.successRate.toFixed(2) + "%"
  ));
}

function printNetworkCreateResultsHashmap(){

  let tableArray = [];

  tableArray.push([
    "NNT | NNID",
    "SEED",
    // "MUT",
    // "ACTV",
    "CLEAR",
    "COST",
    "EQUAL",
    "M RATE",
    "POP",
    "ELITE",
    // "START",
    "ELPSD",
    "ITRNS",
    "ERROR",
    "RES %"
  ]);

  async.each(Object.keys(networkCreateResultsHashmap), function(nnId, cb){

    const networkObj = networkCreateResultsHashmap[nnId];

    const snId = (networkObj.seedNetworkId !== undefined) ? networkObj.seedNetworkId : "---";
    const iterations = (networkObj.evolve.results !== undefined) ? networkObj.evolve.results.iterations : "---";
    const error = ((networkObj.evolve.results !== undefined) 
      && (networkObj.evolve.results.error !== undefined)
      && networkObj.evolve.results.error)  ? networkObj.evolve.results.error.toFixed(5) : "---";

    tableArray.push([
      "NNT | " + nnId,
      snId,
      // networkObj.evolve.options.mutation,
      networkObj.evolve.options.clear,
      networkObj.evolve.options.cost,
      networkObj.evolve.options.equal,
      networkObj.evolve.options.mutationRate.toFixed(3),
      networkObj.evolve.options.popsize,
      networkObj.evolve.options.elitism,
      msToTime(networkObj.evolve.elapsed),
      iterations,
      error,
      networkObj.successRate.toFixed(2)
    ]);

    cb();

  }, function(){

    const t = table(tableArray, { align: ["l", "l", "l", "l", "l", "r", "r", "r", "l", "r", "r", "r"] });

    console.log("NNT | ============================================================================================================================================");
    console.log(t);
    console.log("NNT | ============================================================================================================================================");

  });

}


function loadBestNeuralNetworkFile(){

  return new Promise(function(resolve, reject) {

    console.log(chalkNetwork("NNT | LOADING DROPBOX BEST NEURAL NETWORK"));

    loadBestNetworkDropboxFolder(bestNetworkFolder, function(err, dropboxNetworksArray){

      if (err) {
        console.log(chalkError("NNT | LOAD DROPBOX BEST NETWORKS ERROR: " + err));
        reject(new Error(err));
      }
      else if (dropboxNetworksArray.length === 0) {
        console.log(chalkInfo("NNT | NO NEW DROPBOX BEST NETWORKS"));
        resolve(null);
      }
      else {

        let maxSuccessRate = 0;
        let nnCurrent = {};

        console.log(chalkInfo("NNT | FOUND " + dropboxNetworksArray.length + " NEW DROPBOX BEST NETWORKS"));

        async.eachSeries(dropboxNetworksArray, function(nn, cb){

          debug(chalkInfo("NNT"
            + " | ID: " + nn.networkId
            + " | SUCCESS: " + nn.successRate.toFixed(2) + "%"
          ));

          if (nn.successRate > maxSuccessRate) {

             console.log(chalkNetwork("NNT | NEW MAX NN"
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
            console.log(chalkError("NNT | *** loadBestNeuralNetworkFile ERROR\n" + err));
            reject(new Error(err));
          }
          else if (currentBestNetwork) {

            printNetworkObj("NNT | LOADING NEURAL NETWORK", nnCurrent);

            if (currentBestNetwork.networkId !== nnCurrent.networkId) {

              printNetworkObj("NNT | NEW BEST NETWORK", nnCurrent);

              currentBestNetwork = nnCurrent;

              async.eachSeries(Object.keys(nnCurrent.inputs), function(type, cb){

                console.log(chalkNetwork("NNT | NN INPUTS TYPE" 
                  + " | " + type
                  + " | INPUTS: " + nnCurrent.inputs[type].length
                ));

                inputArrays[type] = nnCurrent.inputs[type];

                cb();

              }, function(){

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
              });

            }
            else {
              console.log("NNT | --- " + nnCurrent.networkId + " | " + nnCurrent.successRate.toFixed(2));
              resolve(null);
            }
          }
          else {

            currentBestNetwork = nnCurrent;
            printNetworkObj("NNT | LOADED BEST NETWORK", nnCurrent);

            // Object.keys(nnCurrent.inputs).forEach(function(type){
            //   console.log(chalkNetwork("NNT | NN INPUTS TYPE" 
            //     + " | " + type
            //     + " | INPUTS: " + nnCurrent.inputs[type].length
            //   ));
            //   inputArrays[type] = nnCurrent.inputs[type];
            // });

            // // network = neataptic.Network.fromJSON(nnCurrent.network);

            async.eachSeries(Object.keys(nnCurrent.inputs), function(type, cb){

              console.log(chalkNetwork("NNT | NN INPUTS TYPE" 
                + " | " + type
                + " | INPUTS: " + nnCurrent.inputs[type].length
              ));

              inputArrays[type] = nnCurrent.inputs[type];

              cb();
              
            }, function(){

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
            });
          }
        });

      }

    });

  });
}

function loadNeuralNetwork(options, callback){

  console.log(chalkLog("NNT | loadNeuralNetwork\nNNT | " + jsonPrint(options)));

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
      if (err) {
        console.log(chalkError("NNT | *** DROPBOX LOAD NEURAL NETWORK ERR"
          + " | " + bestNetworkFolder + "/" + file
          + "\n" + err
        ));
        callback(err, null);
      }
      else if (!nn){
        console.log("NNT | NO NETWORK FOUND " + options.networkId);
        callback(null, null);
      }
      else{
        console.log(chalkInfo("NNT | NETWORK FOUND"
          + " | ID: " + nn.networkId
          + " | SUCCESS: " + nn.successRate.toFixed(2) + "%"
        ));

        async.each(Object.keys(nn.inputs), function(type, cb){
          console.log(chalkNetwork("NNT | NN INPUTS TYPE" 
            + " | " + type
            + " | INPUTS: " + nn.inputs[type].length
          ));

          inputArrays[type] = nn.inputs[type];
          trainingSetLabels.inputs[type] = nn.inputs[type];
          cb();

        }, function(){

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

function loadSeedNeuralNetwork(options, callback){

  console.log(chalkNetwork("NNT | LOADING SEED NETWORK FROM DB\nOPTIONS: " + jsonPrint(options)));

  let findQuery = {};
  let findOneNetwork = false;

  if ((options.networkId !== undefined) && (options.networkId !== "false")) {

    if (options.networkId === "BEST") {
      console.log(chalkAlert("NNT | LOADING " + DEFAULT_BEST_NETWORK_NUMBER + " BEST NETWORKS"));
    }
    else {
      findOneNetwork = true;
      findQuery.networkId = options.networkId;
      console.log(chalkAlert("NNT | LOADING SEED NETWORK " + options.networkId));
    }

  }

  loadBestNetworkDropboxFolder(bestNetworkFolder, function(err, dropboxNetworksArray){

    if (err) {
      console.log(chalkError("NNT | LOAD DROPBOX BEST NETWORK ERR"
        + " | FOLDER: " + bestNetworkFolder
        + "\nNNB | " + err
      ));
      quit("LOAD DROPBOX BEST NETWORK ERR");
      if (callback !== undefined) { callback(err, null); }
    }
    else if (dropboxNetworksArray.length === 0){
      console.log(chalkError("NNT | *** NO BEST NETWORK FOUND"));
      if (callback !== undefined) { callback(err, null); }
    }
    else {

      if (callback !== undefined) { 
        callback(null, null);
      }

    }

  });
}

function initInputArrays(cnf, callback){

  console.log(chalkBlue("NNT | INIT INPUT ARRAYS"));
  debug(chalkBlue("NNT | INIT INPUT ARRAYS cnf\nNNT | " + jsonPrint(cnf)));

  let folder = dropboxConfigDefaultFolder;
  let inputFilePrefix = "defaultInput";

  if ((cnf.evolve.networkId !== undefined) && cnf.evolve.networkId && (cnf.evolve.networkId !== "false")) {

    console.log(chalkBlue("NNT | INIT INPUT ARRAYS FROM NET: " + cnf.evolve.networkId));
    loadNeuralNetwork({networkId: cnf.evolve.networkId}, function(err, nnObj){

      if (err) {
        return(callback(err));
      }

      console.log("NNT | FOUND SEED NETWORK"
        + "\nNNT | NET ID:  " + nnObj.networkId 
        + "\nNNT | SUCCESS: " + nnObj.successRate.toFixed(2) + "%"
        + "\nNNT | IN:      " + nnObj.network.input
        + "\nNNT | OUT:     " + nnObj.network.output
        + "\nNNT | EVOLVE:  " + jsonPrint(nnObj.evolve) 
        + "\nNNT | TRAIN:   " + jsonPrint(nnObj.train)
        + "\nNNT | TEST:    " + jsonPrint(nnObj.test)
        + "\nNNT | CREATED: " + moment(new Date(nnObj.createdAt)).format(compactDateTimeFormat) 
      );

      async.eachSeries(inputTypes, function(inputType, cb){

        let inputArrayObj = nnObj.inputs;

        arrayUnique(inputArrayObj[inputType]);

        inputArrayObj[inputType].sort();

        inputArrays[inputType] = {};
        inputArrays[inputType] = inputArrayObj[inputType];

        trainingSetLabels.inputs[inputType] = inputArrays[inputType];

        console.log(chalkBlue("NNT | LOADED " + inputType.toUpperCase() + " ARRAY"
          + " | " + inputArrayObj[inputType].length + " " + inputType.toUpperCase()
        ));
        cb();

      }, function(err){
        if (err){
          console.log(chalkError("NNT | ERR\nNNT | " + jsonPrint(err)));
          callback(err);
        }
        else {
          console.log(chalkBlue("NNT | LOADED INPUT ARRAYS FROM SEED NETWORK"));
          callback(null);
        }

      });

    });
  }
  else {

    let totalInputs = 0;

    async.eachSeries(inputTypes, function(inputType, cb){

      const inputFile = inputFilePrefix + jsUcfirst(inputType) + ".json";

      console.log("NNT | INIT " + inputType.toUpperCase() + " INPUT ARRAY: " + inputFile);


      loadFile(folder, inputFile, function(err, inputArrayObj){
        if (!err) {
          debug(jsonPrint(inputArrayObj));

          arrayUnique(inputArrayObj[inputType]);

          inputArrayObj[inputType].sort();

          inputArrays[inputType] = {};
          inputArrays[inputType] = inputArrayObj[inputType];
          trainingSetLabels.inputs[inputType] = inputArrays[inputType];

          totalInputs += inputArrayObj[inputType].length;

          console.log(chalkBlue("NNT"
            + " | TOTAL INPUTS: " + totalInputs
            + " | LOADED " + inputType.toUpperCase() + " ARRAY"
            + " | " + inputArrayObj[inputType].length + " " + inputType.toUpperCase()
          ));
          cb();
        }
        else {
          console.log(chalkError("NNT | ERROR: loadFile: " + dropboxConfigFolder + "/" + inputFile));
          cb(err);
        }
      });

    }, function(err){
      if (err){
        console.log(chalkError("NNT | ERR\nNNT | " + jsonPrint(err)));
        callback(err);
      }
      else {
        console.log(chalkBlue("NNT | LOADED INPUT ARRAY FILES | TOTAL INPUTS: " + totalInputs));
        callback();
      }
    });
    
  }
}

function initialize(cnf, callback){

  debug(chalkBlue("INITIALIZE cnf\n" + jsonPrint(cnf)));

  if (debug.enabled || debugCache.enabled || debugQ.enabled){
    console.log("\nNNT | %%%%%%%%%%%%%%\nNNT |  DEBUG ENABLED \nNNT | %%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.TNN_PROCESS_NAME || "twitterNeuralNetwork";
  cnf.runId = process.env.TNN_RUN_ID || statsObj.runId;

  cnf.verbose = process.env.TNN_VERBOSE_MODE || false ;
  cnf.quitOnError = process.env.TNN_QUIT_ON_ERROR || false ;
  cnf.enableStdin = process.env.TNN_ENABLE_STDIN || true ;
  cnf.networkCreateMode = process.env.TNN_NETWORK_CREATE_MODE || DEFAULT_NETWORK_CREATE_MODE ;


  if (process.env.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED !== undefined) {
    console.log("NNT | ENV TNN_CROSS_ENTROPY_WORKAROUND_ENABLED: " + process.env.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED);
    if (!process.env.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED || (process.env.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED === "false")) {
      cnf.crossEntropyWorkAroundEnabled = false ;
    }
    else {
      cnf.crossEntropyWorkAroundEnabled = true ;
    }
  }

  if (process.env.TNN_LOAD_TRAINING_SET_FROM_FILE !== undefined) {
    console.log("NNT | ENV TNN_LOAD_TRAINING_SET_FROM_FILE: " + process.env.TNN_LOAD_TRAINING_SET_FROM_FILE);
    if (!process.env.TNN_LOAD_TRAINING_SET_FROM_FILE || (process.env.TNN_LOAD_TRAINING_SET_FROM_FILE === "false")) {
      cnf.loadTrainingSetFromFile = false ;
    }
    else {
      cnf.loadTrainingSetFromFile = true ;
    }
  }

  if (process.env.TNN_CREATE_TRAINING_SET !== undefined) {
    if (process.env.TNN_CREATE_TRAINING_SET === "true") {
      cnf.createTrainingSet = true ;
    }
    else {
      cnf.createTrainingSet = false ;
    }
  }

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
  cnf.evolve.clear = process.env.TNN_EVOLVE_CLEAR || DEFAULT_EVOLVE_CLEAR ;
  cnf.evolve.cost = process.env.TNN_EVOLVE_COST || DEFAULT_EVOLVE_COST ;
  cnf.evolve.elitism = process.env.TNN_EVOLVE_ELITISM || DEFAULT_EVOLVE_ELITISM ;
  cnf.evolve.equal = process.env.TNN_EVOLVE_EQUAL || DEFAULT_EVOLVE_EQUAL ;
  cnf.evolve.error = process.env.TNN_EVOLVE_ERROR || DEFAULT_EVOLVE_ERROR ;
  cnf.evolve.iterations = process.env.TNN_EVOLVE_ITERATIONS || DEFAULT_ITERATIONS ;
  cnf.evolve.mutationRate = process.env.TNN_EVOLVE_MUTATION_RATE || DEFAULT_EVOLVE_MUTATION_RATE ;
  cnf.evolve.popsize = process.env.TNN_EVOLVE_POP_SIZE || DEFAULT_EVOLVE_POPSIZE ;
  cnf.evolve.threads = process.env.TNN_EVOLVE_THREADS || DEFAULT_EVOLVE_THREADS ;

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

    console.log(chalkAlert("\n\nNNT | BATCH MODE\n\n"));

    initStatsUpdate(cnf, function(err, cnf2){
      if (err) {
        console.log(chalkError("NNT | ERROR initStatsUpdate\n" + jsonPrint(err)));
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
        console.log("NNT | " + dropboxConfigFile + "\n" + jsonPrint(loadedConfigObj));

        if (loadedConfigObj.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED  !== undefined){
          console.log("NNT | TNN_CROSS_ENTROPY_WORKAROUND_ENABLED: " + loadedConfigObj.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED);

          if (!loadedConfigObj.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED || (loadedConfigObj.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED === "false")) {
            cnf.crossEntropyWorkAroundEnabled = false;
          }
          else {
            cnf.crossEntropyWorkAroundEnabled = true;
          }
        }

        if (loadedConfigObj.TNN_LOAD_TRAINING_SET_FROM_FILE  !== undefined){
          console.log("NNT | LOADED TNN_LOAD_TRAINING_SET_FROM_FILE: " + loadedConfigObj.TNN_LOAD_TRAINING_SET_FROM_FILE);

          if (!loadedConfigObj.TNN_LOAD_TRAINING_SET_FROM_FILE || (loadedConfigObj.TNN_LOAD_TRAINING_SET_FROM_FILE === "false")) {
            cnf.loadTrainingSetFromFile = false;
          }
          else {
            cnf.loadTrainingSetFromFile = true;
          }
        }

        if (loadedConfigObj.TNN_CREATE_TRAINING_SET  !== undefined){
          console.log("NNT | CREATE TRAINING SET");

          if (!loadedConfigObj.TNN_CREATE_TRAINING_SET || (loadedConfigObj.TNN_CREATE_TRAINING_SET === "false")) {
            cnf.createTrainingSet = false;
          }
          else {
            cnf.createTrainingSet = true;
          }
        }


        if (loadedConfigObj.TNN_MAX_NEURAL_NETWORK_CHILDREN !== undefined){
          console.log("NNT | LOADED TNN_MAX_NEURAL_NETWORK_CHILDREN: " + loadedConfigObj.TNN_MAX_NEURAL_NETWORK_CHILDREN);
          cnf.maxNeuralNetworkChildern = loadedConfigObj.TNN_MAX_NEURAL_NETWORK_CHILDREN;
        }

        if (loadedConfigObj.TNN_MIN_SUCCESS_RATE !== undefined){
          console.log("NNT | LOADED TNN_MIN_SUCCESS_RATE: " + loadedConfigObj.TNN_MIN_SUCCESS_RATE);
          cnf.minSuccessRate = loadedConfigObj.TNN_MIN_SUCCESS_RATE;
        }

        if (loadedConfigObj.TNN_EVOLVE_THREADS !== undefined){
          console.log("NNT | LOADED TNN_EVOLVE_THREADS: " + loadedConfigObj.TNN_EVOLVE_THREADS);
          cnf.evolve.threads = loadedConfigObj.TNN_EVOLVE_THREADS;
        }

        if (loadedConfigObj.TNN_SEED_NETWORK_ID  !== undefined){
          console.log("NNT | LOADED TNN_SEED_NETWORK_ID: " + loadedConfigObj.TNN_SEED_NETWORK_ID);
          cnf.evolve.networkId = loadedConfigObj.TNN_SEED_NETWORK_ID;
          cnf.train.networkId = loadedConfigObj.TNN_SEED_NETWORK_ID;
        }

        if (loadedConfigObj.TNN_TRAIN_BEST_NETWORK  !== undefined){
          console.log("NNT | LOADED TNN_TRAIN_BEST_NETWORK: " + loadedConfigObj.TNN_TRAIN_BEST_NETWORK);
          cnf.train.useBestNetwork = loadedConfigObj.TNN_TRAIN_BEST_NETWORK;
        }

        if (loadedConfigObj.TNN_EVOLVE_BEST_NETWORK  !== undefined){
          console.log("NNT | LOADED TNN_EVOLVE_BEST_NETWORK: " + loadedConfigObj.TNN_EVOLVE_BEST_NETWORK);
          cnf.evolve.useBestNetwork = loadedConfigObj.TNN_EVOLVE_BEST_NETWORK;
        }

        if (loadedConfigObj.TNN_ITERATIONS  !== undefined){
          console.log("NNT | LOADED TNN_ITERATIONS: " + loadedConfigObj.TNN_ITERATIONS);
          cnf.evolve.iterations = loadedConfigObj.TNN_ITERATIONS;
          cnf.train.iterations = loadedConfigObj.TNN_ITERATIONS;
        }

        if (loadedConfigObj.TNN_VERBOSE_MODE  !== undefined){
          console.log("NNT | LOADED TNN_VERBOSE_MODE: " + loadedConfigObj.TNN_VERBOSE_MODE);
          cnf.verbose = loadedConfigObj.TNN_VERBOSE_MODE;
        }

        if (loadedConfigObj.TNN_TEST_MODE  !== undefined){
          console.log("NNT | LOADED TNN_TEST_MODE: " + loadedConfigObj.TNN_TEST_MODE);
          cnf.testMode = loadedConfigObj.TNN_TEST_MODE;
        }

        if (loadedConfigObj.TNN_ENABLE_STDIN  !== undefined){
          console.log("NNT | LOADED TNN_ENABLE_STDIN: " + loadedConfigObj.TNN_ENABLE_STDIN);
          cnf.enableStdin = loadedConfigObj.TNN_ENABLE_STDIN;
        }

        if (loadedConfigObj.TNN_STATS_UPDATE_INTERVAL  !== undefined) {
          console.log("NNT | LOADED TNN_STATS_UPDATE_INTERVAL: " + loadedConfigObj.TNN_STATS_UPDATE_INTERVAL);
          cnf.statsUpdateIntervalTime = loadedConfigObj.TNN_STATS_UPDATE_INTERVAL;
        }

        if (loadedConfigObj.TNN_KEEPALIVE_INTERVAL  !== undefined) {
          console.log("NNT | LOADED TNN_KEEPALIVE_INTERVAL: " + loadedConfigObj.TNN_KEEPALIVE_INTERVAL);
          cnf.keepaliveInterval = loadedConfigObj.TNN_KEEPALIVE_INTERVAL;
        }

        // OVERIDE CONFIG WITH COMMAND LINE ARGS

        commandLineConfigKeys = Object.keys(commandLineConfig);

        commandLineConfigKeys.forEach(function(arg){
          if (arg === "hiddenLayerSize") {
            cnf.train.hiddenLayerSize = commandLineConfig[arg];
            console.log("NNT | --> COMMAND LINE CONFIG | train.hiddenLayerSize: " + cnf.train.hiddenLayerSize);
          }
          else if (arg === "seedNetworkId") {
            cnf.train.networkId = commandLineConfig[arg];
            cnf.evolve.networkId = commandLineConfig[arg];
            console.log("NNT | --> COMMAND LINE CONFIG | train.network.networkId: " + cnf.train.networkId);
            console.log("NNT | --> COMMAND LINE CONFIG | evolve.network.networkId: " + cnf.evolve.networkId);
          }
          else if (arg === "evolveIterations") {
            cnf.train.iterations = commandLineConfig[arg];
            cnf.evolve.iterations = commandLineConfig[arg];
            console.log("NNT | --> COMMAND LINE CONFIG | train.iterations: " + cnf.train.iterations);
            console.log("NNT | --> COMMAND LINE CONFIG | evolve.iterations: " + cnf.evolve.iterations);
          }
          else {
            cnf[arg] = commandLineConfig[arg];
            console.log("NNT | --> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
          }
        });

        configArgs = Object.keys(cnf);

        configArgs.forEach(function(arg){
          if (arg === "evolve") {
            console.log("NNT | FINAL CONFIG | " + arg + ": " + jsonPrint(cnf[arg]));
          }
          else {
            console.log("NNT | FINAL CONFIG | " + arg + ": " + cnf[arg]);
          }
        });

        if (cnf.enableStdin){

          console.log("NNT | STDIN ENABLED");

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
                console.log(chalkRedBold("NNT | VERBOSE: " + configuration.verbose));
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
            console.log(chalkError("NNT | ERROR initStatsUpdate\n" + err));
            return(callback(err, cnf2));
          }

          debug("initStatsUpdate cnf2\n" + jsonPrint(cnf2));

          initInputArrays(cnf2, function(err){
            return(callback(err, cnf2));
          });

        });
      }
      else {
        console.error(chalkError("NNT | ERROR LOAD DROPBOX CONFIG: " + dropboxConfigFile
          + "\n" + jsonPrint(err)
        ));

        if (err.status === 404){
          // OVERIDE CONFIG WITH COMMAND LINE ARGS

          commandLineConfigKeys = Object.keys(commandLineConfig);

          commandLineConfigKeys.forEach(function(arg){
            if (arg === "hiddenLayerSize") {
              cnf.train.hiddenLayerSize = commandLineConfig[arg];
              console.log("NNT | --> COMMAND LINE CONFIG | train.hiddenLayerSize: " + cnf.train.hiddenLayerSize);
            }
            else if (arg === "seedNetworkId") {
              cnf.train.networkId = commandLineConfig[arg];
              cnf.evolve.networkId = commandLineConfig[arg];
              console.log("NNT | --> COMMAND LINE CONFIG | train.network.networkId: " + cnf.train.networkId);
              console.log("NNT | --> COMMAND LINE CONFIG | evolve.network.networkId: " + cnf.evolve.networkId);
            }
            else if (arg === "evolveIterations") {
              cnf.train.iterations = commandLineConfig[arg];
              cnf.evolve.iterations = commandLineConfig[arg];
              console.log("NNT | --> COMMAND LINE CONFIG | train.iterations: " + cnf.train.iterations);
              console.log("NNT | --> COMMAND LINE CONFIG | evolve.iterations: " + cnf.evolve.iterations);
            }
            else {
              cnf[arg] = commandLineConfig[arg];
              console.log("NNT | --> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
            }
          });

          configArgs = Object.keys(cnf);

          configArgs.forEach(function(arg){
            console.log("NNT | _FINAL CONFIG | " + arg + ": " + cnf[arg]);
          });

          if (cnf.enableStdin){

            console.log("NNT | STDIN ENABLED");

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
                  console.log(chalkRedBold("NNT | VERBOSE: " + configuration.verbose));
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
              console.log(chalkError("NNT | ERROR initStatsUpdate\n" + jsonPrint(err)));
            }
            debug("initStatsUpdate cnf2\n" + jsonPrint(cnf2));

            initInputArrays(cnf2, function(err){
              return(callback(err, cnf2));
            });

          });
        }
        else {
          callback(err, null);
        }
       }
    });
  }
}

console.log(chalkInfo("NNT | " + getTimeStamp() 
  + " | WAIT 5 SEC FOR MONGO BEFORE INITIALIZE CONFIGURATION"
));

configEvents.once("INIT_MONGODB", function(){

  wordAssoDb = require("@threeceelabs/mongoose-twitter");
  db = wordAssoDb();

  // NeuralNetwork = require("mongoose").model("NeuralNetwork");
  User = require("mongoose").model("User");

  userServer = require("@threeceelabs/user-server-controller");
});

// FUTURE: break up into updateClassifiedUsers and createTrainingSet
function updateClassifiedUsers(cnf, callback){

  trainingSet = [];
  trainingSetNormalized = [];
  trainingSetNormalizedTotal = [];

  let classifiedUserIds = Object.keys(classifiedUserHashmap);
  let maxMagnitude = 0;
  let totalInputHits = 0;

  console.log(chalkBlue("NNT | UPDATE CLASSIFIED USERS: " + classifiedUserIds.length));

  if (cnf.normalization) {
    maxMagnitude = cnf.normalization.magnitude.max;
  }

  statsObj.users.updatedClassified = 0;

  async.eachSeries(classifiedUserIds, function(userId, cb0){

    debug(chalkInfo("updateClassifiedUsers: userId: " + userId));

    User.findOne({userId: userId.toString()}, function(err, user){

      if (err){
        console.error(chalkError("UPDATE CLASSIFIED USERS: USER FIND ONE ERROR: " + err));
        statsObj.errors.users.findOne += 1;
        return(cb0(err));
      }

      if (!user){
        debug(chalkError("UPDATE CLASSIFIED USERS: USER NOT FOUND: " + userId));
        statsObj.users.notFound += 1;
        return(cb0());
      }

      if (user.screenName === undefined) {
        console.log(chalkError("NNT | UPDATE CLASSIFIED USERS: USER SCREENNAME UNDEFINED\n" + jsonPrint(user)));
        statsObj.users.screenNameUndefined += 1;
        return(cb0("USER SCREENNAME UNDEFINED", null));
      }

      let sentimentText;

      let sentimentObj = {};
      sentimentObj.magnitude = 0;
      sentimentObj.score = 0;

      if ((user.languageAnalysis !== undefined)
        && (user.languageAnalysis.sentiment !== undefined)) {

        sentimentObj.magnitude = user.languageAnalysis.sentiment.magnitude || 0;
        sentimentObj.score = user.languageAnalysis.sentiment.score || 0;

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

        statsObj.users.updatedClassified += 1;

        if (statsObj.users.updatedClassified % 100 === 0){
          console.log(chalkLog("NNT | " + statsObj.users.updatedClassified + " USERS CLASSIFIED"));
        }


        debug(currentChalk("CL U HIST"
          + " | L: " + classifiedUserHistogram.left
          + " | R: " + classifiedUserHistogram.right
          + " | N: " + classifiedUserHistogram.neutral
          + " | +: " + classifiedUserHistogram.positive
          + " | -: " + classifiedUserHistogram.negative
          + " | 0: " + classifiedUserHistogram.none
        ));


        let globalInputIndex = 0;

        let trainingSetDatum = {};

        trainingSetDatum.user = {};
        trainingSetDatum.user.userId = user.userId;
        trainingSetDatum.user.screenName = user.screenName;
        trainingSetDatum.classification = classification;
        trainingSetDatum.inputHits = [];

        trainingSetDatum.input = [];

        trainingSetDatum.input.push(sentimentObj.magnitude);
        globalInputIndex += 1;

        trainingSetDatum.input.push(sentimentObj.score);
        globalInputIndex += 1;

        // KLUDGE!!!! should only need to create trainingSetLabels once per network creation

        if (trainingSetLabels.inputs.length === 0){
          trainingSetLabels.inputs.sentiment = [];

          trainingSetLabels.inputs.sentiment.push("magnitude");
          trainingSetLabels.inputs.sentiment.push("score");

          trainingSetLabels.inputRaw.push("magnitude");
          trainingSetLabels.inputRaw.push("score");
        }

        // create text input from user text in screenName, name, statusText, retweetText and description

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

          // parse the user's text for hashtags, urls, emoji, screenNames, and words; create histogram

          twitterTextParser.parseText(text, {updateGlobalHistograms: true}, function(err, hist){

            if (err) {
              console.error("*** PARSE TEXT ERROR\n" + err);
              return(cb0(err));
            }

            // update user histogram in db

            userServer.updateHistograms({user: user, histograms: hist}, function(err, updateduser){

              if (err) {
                console.error("*** UPDATE USER HISTOGRAMS ERROR\n" + err);
                return(cb0(err));
              }

              const userHistograms = updateduser.histograms;

              // debug(chalkLog("user.description + status histograms\n" + jsonPrint(userHistograms)));

              // debug("user.description + status\n" + jsonPrint(text));


              // CREATE USER TRAINING/TEST SET DATUM

              async.eachSeries(inputTypes, function(type, cb1){  // inputTypes = [ emoji, screenName, hashtag, word, url ]

                debug(chalkAlert("USER DATUM"
                  + " | @" + trainingSetDatum.user.screenName 
                  + " | START ARRAY: " + type 
                  + " | " + inputArrays[type].length
                ));

                if (trainingSetLabels.inputs[type] === undefined) {
                  trainingSetLabels.inputs[type] = [];
                  trainingSetLabels.inputs[type] = inputArrays[type];
                  trainingSetLabels.inputRaw = trainingSetLabels.inputRaw.concat(inputArrays[type]);  // inputRaw is one unified array of input labels
                }

                // for each input type, 
                //    for each input element of input type, 
                //       add 1 to trainingSetDatum arrar if element is in userHistogram

                async.eachOfSeries(inputArrays[type], function(element, index, cb2){

                  if ((userHistograms[type] !== undefined) && userHistograms[type][element]) {

                    trainingSetDatum.input.push(1);
                    // trainingSetDatum.inputHits += 1;
                    trainingSetDatum.inputHits.push({ index: element });

                    debug(chalkBlue("+ DATUM BIT: " + type
                      + " | INPUT HITS: " + trainingSetDatum.inputHits.length 
                      + " | ["  + globalInputIndex + " / " + index + "] " + element + ": " + userHistograms[type][element]
                      + " | @" + trainingSetDatum.user.screenName 
                    ));

                    if ((globalInputIndex % 100 === 0) && (index % 10 === 0)){
                      console.log(chalkBlue("+ DATUM BIT: " + type
                        + " | INPUT HITS: " + trainingSetDatum.inputHits.length 
                        + " | ["  + globalInputIndex + " / " + index + "] " + element + ": " + userHistograms[type][element]
                        + " | @" + trainingSetDatum.user.screenName 
                      ));
                    }

                    globalInputIndex += 1;

                    async.setImmediate(function() {
                      cb2();
                    });

                  }
                  else {

                    trainingSetDatum.input.push(0);
                    // debug(chalkInfo("- DATUM BIT: " + type
                    //   + " | " + element 
                    // ));

                    debug(chalkInfo("- DATUM BIT: " + type
                      + " | INPUT HITS: " + trainingSetDatum.inputHits.length 
                      + " | ["  + globalInputIndex + " / " + index + "] " + element
                      + " | @" + trainingSetDatum.user.screenName 
                    ));

                    // if (globalInputIndex % 100 === 0){
                    //   console.log(chalkInfo("- DATUM BIT: " + type
                    //     + " | INPUT HITS: " + trainingSetDatum.inputHits.length 
                    //     + " | ["  + globalInputIndex + " / " + index + "] " + element
                    //     + " | @" + trainingSetDatum.user.screenName 
                    //   ));
                    // }

                    globalInputIndex += 1;

                    async.setImmediate(function() {
                      cb2();
                    });

                  }
                }, function(err){
                  if (err) {
                    console.error("*** PARSE TEXT ERROR\n" + err);
                    return cb1(err);
                  }
                  debug(chalkAlert("DONE ARRAY: " + type));
                  cb1();
                });

              }, function(err){

                if (err) {
                  console.error("*** PARSE TEXT ERROR\n" + err);
                  return cb0(err);
                }

                // const t = table(trainingSetDatum.inputHits, { align: ["l", "r"] });

                let chk = chalkInfo;

                if (trainingSetDatum.inputHits.length < MIN_INPUT_HITS) { chk = chalkAlert; }

                console.log(chk("=+= PARSE USER TEXT COMPLETE"
                  + " | ["  + globalInputIndex + "] "
                  + " | INPUT HITS: " + trainingSetDatum.inputHits.length 
                  + " | @" + trainingSetDatum.user.screenName
                  // + "\n" + t
                  // + "\n=================================="
                ));

                // IF NOT INPUT HITS, don't user for training
                
                if (trainingSetDatum.inputHits.length < MIN_INPUT_HITS) { 
                  return cb0();
                }

                trainingSetDatum.output = [];

                switch (trainingSetDatum.classification){
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

                totalInputHits += trainingSetDatum.inputHits.length;

                testObj.numInputs = trainingSetDatum.input.length;
                testObj.numOutputs = trainingSetDatum.output.length;

                debug("trainingSet " + trainingSet.length + " | INPUT:  " + trainingSetDatum.input.length);
                debug("trainingSetDatum OUTPUT: " + trainingSetDatum.classification + " | " + trainingSetDatum.output);

                // trainingSet.push({screenName: trainingSetDatum.user.screenName.toLowerCase(), datum: trainingSetDatum});
                trainingSet.push(trainingSetDatum);
                cb0();
              });
            });

          });

        });   
      }
      else {

        statsObj.users.notClassified += 1;

        if (statsObj.users.notClassified % 100 === 0){
          console.log(chalkLog("NNT | " + statsObj.users.notClassified + " USERS NOT CLASSIFIED"));
        }

        console.log(chalkBlue("NNT | USER KW>DB"
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

        console.log(chalkBlue("NNT | KEYWORDS: " + Object.keys(classifiedUserHashmap[userId])));

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
      console.log(chalkError("NNT | UPDATE CLASSIFIED USERS ERROR: " + err));
    }

    console.log(chalkLog("NNT | CL U HIST"
      + " | L: " + classifiedUserHistogram.left
      + " | R: " + classifiedUserHistogram.right
      + " | N: " + classifiedUserHistogram.neutral
      + " | +: " + classifiedUserHistogram.positive
      + " | -: " + classifiedUserHistogram.negative
      + " | 0: " + classifiedUserHistogram.none
    ));

    let inputHitAverage = totalInputHits/trainingSet.length;

    console.log(chalkBlue("\nNNT | TRAINING SET LENGTH: " + trainingSet.length));
    console.log(chalkBlue("NNT | MAX MAGNITUDE:         " + maxMagnitude));
    console.log(chalkBlue("NNT | TOTAL INPUT HITS:      " + totalInputHits));
    console.log(chalkBlue("NNT | AVE INPUT HITS/DATUM:  " + inputHitAverage.toFixed(3)));

    statsObj.normalization.magnitude.max = maxMagnitude;

    testObj.inputHits = totalInputHits;
    testObj.inputHitAverage = inputHitAverage;

    // trainingSetNormalized = [];
    // trainingSetNormalizedTotal = [];

    async.each(trainingSet, function(dataObj, cb3){

      if (maxMagnitude > 0) {
        let normMagnitude = dataObj.input[0]/maxMagnitude;
        dataObj.input[0] = normMagnitude;
      }
      else {
        dataObj.input[0] = 0;
      }

      trainingSetNormalizedTotal.push(dataObj);

      // trainingSetBasic.push({input: dataObj.input, output: dataObj.output});

      if (configuration.testMode) {
        testObj.testSet.push(dataObj);
        cb3();
      }
      // trainingSet.push({name: user.screenName, datum: trainingSetDatum});
      else if (cnf.enableRequiredTrainingSet && requiredTrainingSet.has(dataObj.user.screenName.toLowerCase())) {
        console.log(chalkAlert("NNT | +++ ADD REQ TRAINING SET | @" + dataObj.user.screenName));
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

function testNetwork(nwJson, testObj, callback){

  const nw = neataptic.Network.fromJSON(nwJson);

  console.log(chalkBlue("NNT | TEST NETWORK"
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

    if (testDatumObj.input.length !== testObj.numInputs) {
      console.error(chalkError("NNT | MISMATCH INPUT"
        + " | TEST INPUTS: " + testDatumObj.input.length 
        + " | NETW INPUTS: " + testObj.numInputs 
      ));
      cb("MISMATCH INPUT");
    }


    const testOutput = activateNetwork(nw, testDatumObj.input);

    debug(chalkLog("========================================"));

    numTested += 1;

    indexOfMax(testOutput, function(testMaxOutputIndex, to){

      debug("INDEX OF MAX TEST OUTPUT: " + to);

      indexOfMax(testDatumObj.output, function(expectedMaxOutputIndex, eo){

        debug("INDEX OF MAX TEST OUTPUT: " + eo);

        let passed = (testMaxOutputIndex === expectedMaxOutputIndex);

        numPassed = passed ? numPassed+1 : numPassed;

        successRate = 100 * numPassed/(numTested + numSkipped);

        let currentChalk = passed ? chalkLog : chalkAlert;

        testResultArray.push(
          {
            P: passed,
            EO: testDatumObj.output,
            EOI: expectedMaxOutputIndex,
            TO: testOutput, 
            TOI: testMaxOutputIndex
          }
        );

        const t = "@" + testDatumObj.user.screenName + " | " + testDatumObj.classification;
        printDatum(t, testDatumObj.input);

        debug(currentChalk("TEST RESULT: " + passed 
          + " | " + successRate.toFixed(2) + "%"
          // + "\n" + "TO: " + testOutput 
          + "\n" + testOutput[0]
          + " " + testOutput[1]
          + " " + testOutput[2]
          + " | TMOI: " + testMaxOutputIndex
          // + "\n" + "EO: " + testDatum.output 
          + "\n" + testDatumObj.output[0]
          + " " + testDatumObj.output[1]
          + " " + testDatumObj.output[2]
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

function initClassifiedUserHashmap(folder, file, callback){

  console.log(chalkInfo("NNT | INIT CLASSIFED USERS HASHMAP FROM DB"));

  loadFile(folder, file, function(err, dropboxClassifiedUsersObj){
    if (err) {
      console.error(chalkError("NNT | ERROR: loadFile: " + folder + "/" + file));
      console.log(chalkError("NNT | ERROR: loadFile: " + folder + "/" + file));
      callback(err, file);
    }
    else {
      console.log(chalkInfo("NNT | LOADED CLASSIFED USERS FILE: " + folder + "/" + file));
      console.log(chalkInfo("NNT | DROPBOX DEFAULT | " + Object.keys(dropboxClassifiedUsersObj).length + " CLASSIFED USERS"));

      const params = { auto: false };

      userServer.findClassifiedUsersCursor(params, function(err, results){
        if (err) {
          console.error(chalkError("NNT | ERROR: initClassifiedUserHashmap: "));
          callback(err, null);
        }
        else {
          console.log(chalkInfo("NNT | LOADED CLASSIFED USERS FROM DB"
            + " | " + results.count + " CLASSIFED"
            + " | " + results.manual + " MAN"
            + " | " + results.auto + " AUTO"
            + " | " + results.matchRate.toFixed(1) + "% MATCH"
          ));

          const classifiedUsersObj = defaults(dropboxClassifiedUsersObj, results.obj);

          callback(null, classifiedUsersObj);
        }
      });

    }
  });
}

function generateRandomEvolveConfig (cnf, callback){

  let config = {};

  config.networkCreateMode = "evolve";

  console.log(chalkLog("NNT | NETWORK CREATE MODE: " + config.networkCreateMode));
    
  console.log(chalkLog("\nNNT | BEST NETWORKS\nNNB | ----------------------------------"));

  bestNetworkHashMap.forEach(function(entry, nnId){
    console.log(chalkLog("NNT | " + entry.network.successRate.toFixed(2) + " | " + nnId));
    // console.log(chalkAlert("NNT | " + jsonPrint(entry)));
  });

  console.log(chalkLog("NNT | ----------------------------------"));

  config.seedNetworkId = (Math.random() < SEED_NETWORK_PROBABILITY) ? randomItem(bestNetworkHashMap.keys()) : false;

  if (config.seedNetworkId) {
    config.network = bestNetworkHashMap.get(config.seedNetworkId).network;
  }
  else {
    config.architecture = "random";
  }

  config.iterations = cnf.evolve.iterations;
  config.threads = cnf.evolve.threads;
  config.cost = randomItem(EVOLVE_COST_ARRAY);
  config.clear = randomItem([true, false]);
  // config.clear = true;
  config.equal = randomItem([true, false]);
  config.error = cnf.evolve.error;
  config.mutation = DEFAULT_EVOLVE_MUTATION;
  config.mutationRate = randomFloat(EVOLVE_MUTATION_RATE_RANGE.min, EVOLVE_MUTATION_RATE_RANGE.max);
  config.popsize = randomInt(EVOLVE_POP_SIZE_RANGE.min, EVOLVE_POP_SIZE_RANGE.max);
  config.elitism = randomInt(EVOLVE_ELITISM_RANGE.min, EVOLVE_ELITISM_RANGE.max);
  config.log = cnf.evolve.log;

  debug(chalkLog("NNT RANDOM CONFIG\n" + jsonPrint(config)));

  callback(null, config);
}

function initNetworkCreate(nnChildId, nnId, cnf, callback){


  console.log(chalkLog("NNT | INIT NETWORK CREATE | NNC ID: " + nnId));

  let messageObj;


  statsObj.evolve[nnId] = {};
  statsObj.evolve[nnId].options = {};

  statsObj.train[nnId] = {};
  statsObj.train[nnId].options = {};

  statsObj.tests[testObj.testRunId][nnId] = {};
  statsObj.tests[testObj.testRunId][nnId].numInputs = 0;
  statsObj.tests[testObj.testRunId][nnId].numOutputs = 0;
  statsObj.tests[testObj.testRunId][nnId].network = {};
  statsObj.tests[testObj.testRunId][nnId].results = {};
  statsObj.tests[testObj.testRunId][nnId].results.numTests = 0;
  statsObj.tests[testObj.testRunId][nnId].results.numSkipped = 0;
  statsObj.tests[testObj.testRunId][nnId].results.numPassed = 0;
  statsObj.tests[testObj.testRunId][nnId].results.successRate = 0.0;
  statsObj.tests[testObj.testRunId][nnId].elapsed = 0;

  generateRandomEvolveConfig(cnf, function(err, childConf){

    switch (cnf.networkCreateMode) {

      case "evolve":

        messageObj = {};
        messageObj.op = "EVOLVE";
        messageObj.testRunId = nnId;
        messageObj.inputs = {};
        messageObj.inputs = trainingSetLabels.inputs;
        messageObj.outputs = {};
        messageObj.outputs = trainingSetLabels.outputs;
        messageObj.trainingSet = [];
        messageObj.trainingSet = trainingSetNormalized;
        messageObj.normalization = {};
        messageObj.normalization = statsObj.normalization;

        messageObj.architecture = childConf.architecture;
        messageObj.threads = childConf.threads;
        messageObj.network = {};
        messageObj.network = childConf.network;
        messageObj.iterations = childConf.iterations;
        messageObj.equal = childConf.equal;
        messageObj.popsize = childConf.popsize;
        messageObj.cost = childConf.cost;
        messageObj.elitism = childConf.elitism;
        messageObj.log = childConf.log;
        messageObj.error = childConf.error;
        messageObj.mutation = childConf.mutation;
        messageObj.mutationRate = childConf.mutationRate;
        messageObj.clear = childConf.clear;

        statsObj.tests[testObj.testRunId][nnId].numInputs = trainingSetNormalized[0].input.length;
        statsObj.tests[testObj.testRunId][nnId].numOutputs = trainingSetNormalized[0].output.length;

        statsObj.evolve[nnId].options = omit(messageObj, ["network", "trainingSet", "inputs", "outputs"]);

        if (messageObj.network && (messageObj.network !== undefined)) {
          messageObj.seedNetworkId = messageObj.network.networkId;
          statsObj.evolve[nnId].options.network = {};
          statsObj.evolve[nnId].options.network = pick(messageObj, ["networkId", "successRate"]);
        }

        console.log(chalkBlue("\nNNT | START NETWORK EVOLVE"));

        console.log(chalkBlue("NNT | TEST RUN ID: " + messageObj.testRunId
          + "\nNNT | TRAINING SET LENGTH: " + messageObj.trainingSet.length
          + "\nNNT | TEST SET LENGTH:     " + testObj.testSet.length
          + "\nNNT | ITERATIONS:          " + messageObj.iterations
        ));

        neuralNetworkChildHashMap[nnChildId].child.send(messageObj, function(err){
          if (err) {
            console.error(chalkError("NNT | *** NEURAL NETWORK CHILD SEND ERROR: " + err));
          }
          callback(err, null);

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
        console.log(chalkBlue("\nNNT | START NETWORK TRAIN"));

        console.log(chalkBlue("NNT | TEST RUN ID: " + messageObj.testRunId
          + "\nNNT | TRAINING SET LENGTH: " + messageObj.trainingSet.length
          + "\nNNT | ITERATIONS:          " + messageObj.iterations
        ));

        neuralNetworkChildHashMap[nnId].child.send(messageObj, function(err){
          if (err) {
            console.error(chalkError("NNT | *** NEURAL NETWORK CHILD SEND ERROR: " + err));
          }

          callback(err, null);

        });

      break;

      default:
        console.log(chalkError("NNT | UNKNOWN NETWORK CREATE MODE: " + cnf.networkCreateMode));
        callback("NNT | UNKNOWN NETWORK CREATE MODE: " + cnf.networkCreateMode, null);
    }

  });
}

let nnChildIndex = 0;
let nnChildId = "NNC_" + nnChildIndex;

function initMain(cnf, callback){

  console.log(chalkAlert("INIT MAIN"));

  trainingSetReady = false;

  initClassifiedUserHashmap(cnf.classifiedUsersFolder, cnf.classifiedUsersFile, function(err, classifiedUsersObj){

    if (err) {
      console.error(chalkError("NNT | *** ERROR: CLASSIFED USER HASHMAP NOT INITIALIED: ", err));
      quit("CLASSIFED USER HASHMAP NOT INITIALIED");
      return;
    }

    classifiedUserHashmap = classifiedUsersObj;
    classifiedUserHashmapReadyFlag = true;

    console.log(chalkLog("NNT | LOADED " + Object.keys(classifiedUserHashmap).length + " TOTAL CLASSIFED USERS"));

    if (!cnf.createTrainingSet && cnf.loadTrainingSetFromFile) {

      console.log(chalkInfo("NNT | LOADING DEFAULT TRAINING SET FROM FILE " + defaultTrainingSetFolder + "/" + defaultTrainingSetFile));

      loadFile(defaultTrainingSetFolder, defaultTrainingSetFile, function(err, tsNormal){

        if (err) {
          console.error(chalkError("NNT | ERROR: loadFile: " + defaultTrainingSetFolder + "/" + defaultTrainingSetFile));
          callback(err, null);
        }
        else {

          trainingSetNormalizedTotal = tsNormal;
          console.log(chalkLog("NNT | LOADED " + trainingSetNormalizedTotal.length
            + " | " + trainingSetNormalizedTotal[0].input.length + " INPUTS"
            + " | " + trainingSetNormalizedTotal[0].output.length + " OUTPUTS"
          ));

          testObj.numInputs = trainingSetNormalizedTotal[0].input.length;
          testObj.numOutputs = trainingSetNormalizedTotal[0].output.length;

          async.each(trainingSetNormalizedTotal, function(dataObj, cb){

            if (configuration.testMode) {
              testObj.testSet.push(dataObj);
              cb();
            }
            else if (requiredTrainingSet.has(dataObj.user.screenName.toLowerCase())) {
              console.log(chalkAlert("NNT | +++ ADD REQ TRAINING SET | @" + dataObj.user.screenName));
              trainingSetNormalized.push(dataObj);
              cb();
            }
            else if (Math.random() > cnf.testSetRatio) {
              trainingSetNormalized.push(dataObj);
              cb();
            }
            else {
              testObj.testSet.push(dataObj);
              cb();
            }
          }, function(){

            trainingSetReady = true;

            setTimeout(function(){
              callback(null, trainingSetNormalizedTotal.length);
            }, 3000);

          });

        }

      });
    }
    else {
      updateClassifiedUsers(cnf, function(err, clUsHist){

        debug("updateClassifiedUsers clUsHist\n" + jsonPrint(clUsHist));

        if (err) {
          console.error("NNT | *** UPDATE CLASSIFIED USER ERROR ***\n" + jsonPrint(err));
          quit("UPDATE CLASSIFIED USER ERROR");
        }

        if (trainingSetNormalized.length === 0) {
          console.error("NNT | *** NO TRAINING SET DATA POINTS ??? ***\n" + jsonPrint(err));
          quit("NO TRAINING SET DATA POINTS");
          return callback("NO TRAINING SET DATA POINTS", null);
        }

        let messageObj = {};

        console.log(chalkBlue("\nNNT | TRAINING SET NORMALIZED"
          + " | " + trainingSetNormalized.length + " DATA POINTS"
          + " | NN CREATE MODE: " + cnf.networkCreateMode
          // + " | " + jsonPrint(trainingSetNormalized[0])
        ));

        trainingSetFile = "trainingSetNormalized_" + testObj.testRunId + ".json";

        // saveFile({folder: trainingSetFolder, file: "trainingSetBasic", obj: trainingSetBasic});

        if (hostname === "google") {
          console.log(chalkAlert("NNT | SAVED DEFAULT TRAINING SET TO DROPBOX"
            + " | " + defaultTrainingSetFolder + "/" + defaultTrainingSetFile
          ));
          saveFile({folder: defaultTrainingSetFolder, file: defaultTrainingSetFile, obj: trainingSetNormalizedTotal});
        }

        saveFile({
          folder: trainingSetFolder, 
          file: trainingSetFile, 
          obj: trainingSetNormalizedTotal
        }, function(err){

          if (err) {
            console.error(chalkError("*** SAVE TOTAL TRAINING SET FILE ERROR"
              + " | " + trainingSetFolder + "/" + trainingSetFile 
              + "\n" + jsonPrint(err)
            ));
          }
          else {
            console.log("NNT | SAVED TOTAL TRAINING SET TO DROPBOX"
              + " | " + trainingSetFolder + "/" + trainingSetFile
            );
            trainingSetReady = true;
          }

        });

        callback(null, trainingSetNormalized.length);
      });
    }
  });

}


let networkCreateInterval;

function initNetworkCreateInterval(cnf){

  clearInterval(networkCreateInterval);

  networkCreateInterval = setInterval(function(){

    if (trainingSetReady) {

      Object.keys(neuralNetworkChildHashMap).forEach(function(nnChildId){

        if (neuralNetworkChildHashMap[nnChildId].ready) {

          neuralNetworkChildHashMap[nnChildId].ready = false ;

          const nnId = testObj.testRunId + "_" + nnChildId + "_" + networkIndex;
          networkIndex += 1;

          initNetworkCreate(nnChildId, nnId, configuration, function(err, results){
            if (err) {
              console.error("NNT | *** INIT NETWORK CREATE ERROR ***\n" + jsonPrint(err));
            }
            else {
              console.log(chalkInfo("INIT NETWORK CREATE | " + nnId));
            }
          });
        }
      });

    }

  }, 10000);
}


function initNeuralNetworkChild(cnf, callback){

  nnChildId = "NNC_" + nnChildIndex;

  console.log(chalkAlert("+++ NEW NEURAL NETWORK CHILD | NNC ID: " + nnChildId));

  statsObj.neuralNetworkReady = false;

  let childEnv = {};
  childEnv.env = {};

  childEnv.env = configuration.DROPBOX;
  childEnv.env.DROPBOX_NNC_STATS_FILE = statsObj.runId + "_" + nnChildId + ".json";
  childEnv.env.NNC_PROCESS_NAME = nnChildId;
  childEnv.env.NODE_ENV = "production";
  childEnv.env.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED = cnf.crossEntropyWorkAroundEnabled;

  const neuralNetworkChild = cp.fork("neuralNetworkChild.js", childEnv );

  neuralNetworkChild.on("message", function(m){

    debug(chalkAlert("neuralNetworkChild RX"
      + " | " + m.op
      // + " | " + m.obj.userId
      // + " | " + m.obj.screenName
      // + " | " + m.obj.name
      // + "\n" + jsonPrint(m)
    ));

    if (m.error) {
      console.error(chalkError("NNT | neuralNetworkChild RX ERROR\n" + jsonPrint(m)));
      if (callback !== undefined) { 
        return(callback(m.error, null));
      }
      return;
    }

    switch(m.op) {

      case "INIT_COMPLETE":
        statsObj.neuralNetworkReady = true;
        console.log(chalkInfo("NNT | TEST NEURAL NETWORK | " + m.processName));
        neuralNetworkChild.send({op: "TEST_EVOLVE"});
      break;

      case "READY":
        statsObj.neuralNetworkReady = true;
        console.log(chalkLog("NNT | INIT NEURAL NETWORK | " + m.processName));
        neuralNetworkChild.send({op: "INIT", testRunId: testObj.testRunId});
      break;

      case "STATS":
        console.log("NNC | STATS | " 
          + " | " + m.processName
          + getTimeStamp() + " ___________________________\n" 
          + jsonPrint(statsObj, "NNC | STATS "
        ));
        console.log("NNC | STATS___________________________\n");
      break;

      case "TEST_EVOLVE_COMPLETE":
        if (m.results) {
          console.log(chalkLog("NNT"
            + " | " + m.processName
            + " | TEST EVOLVE XOR PASS"
          ));

          if (neuralNetworkChildHashMap[m.processName] !== undefined) { neuralNetworkChildHashMap[m.processName].ready = true; }

          initNetworkCreateInterval(cnf);

        }
        else {
          console.error(chalkError("NNT | *** TEST EVOLVE XOR FAILED *** | " + m.processName));
          quit("TEST EVOLVE FAILED");
        }
      break;

      // case "TRAIN_COMPLETE":

      //   console.log(chalkBlue("NNT | NETWORK TRAIN COMPLETE"
      //     + "\nNNT | ELAPSED: " + msToTime(m.networkObj.elapsed)
      //     + "\nNNT | ITERTNS: " + m.statsObj.train.options.iterations
      //     // + "\nSEED NN: " + m.networkObj.train.options.network.networkId
      //     + "\nNNT | INPUTS:  " + m.networkObj.network.input
      //     + "\nNNT | OUTPUTS: " + m.networkObj.network.output
      //     + "\nNNT | DROPOUT: " + m.networkObj.network.dropout
      //     + "\nNNT | NODES:   " + m.networkObj.network.nodes.length
      //     + "\nNNT | CONNS:   " + m.networkObj.network.connections.length
      //   ));

      //   if (m.networkObj.train.options.network) {
      //     console.log(chalkBlue("NNT | SEED NN: " + m.networkObj.train.options.network.networkId));
      //   }

      //   testNetwork(m.networkObj.network, testObj, function(err, results){

      //     if (err) {
      //       console.error("NNT | *** TEST NETWORK ERROR ***\n" + jsonPrint(err));
      //     }

      //     testObj.results[m.processName] = {};
      //     testObj.results[m.processName] = results;

      //     statsObj.tests[testObj.testRunId][m.processName] = {};
      //     statsObj.tests[testObj.testRunId][m.processName] = pick(
      //       testObj, 
      //       ["numInputs", "numOutputs", "inputHits", "inputHitAverage"]
      //     );
      //     statsObj.tests[testObj.testRunId][m.processName].results = {};
      //     statsObj.tests[testObj.testRunId][m.processName].results = pick(
      //       testObj.results[m.processName], 
      //       ["successRate", "numPassed", "numSkipped", "numTests", "testRunId"]
      //     );
      //     statsObj.tests[testObj.testRunId][m.processName].training = {};
      //     statsObj.tests[testObj.testRunId][m.processName].train = {};
      //     statsObj.tests[testObj.testRunId][m.processName].train.options = omit(m.statsObj.train.options, ["network", "inputs", "outputs"]);

      //     if (m.statsObj.train.options.network && (m.statsObj.train.options.network !== undefined)){
      //       statsObj.tests[testObj.testRunId][m.processName].train.network = {};
      //       statsObj.tests[testObj.testRunId][m.processName].train.network.networkId = m.statsObj.train.options.network.networkId;
      //       statsObj.tests[testObj.testRunId][m.processName].train.network.successRate = m.statsObj.train.options.network.successRate;
      //     }

      //     statsObj.tests[testObj.testRunId][m.processName].elapsed = m.networkObj.elapsed;

      //     console.log(chalkBlue("\nNNT | NETWORK TEST COMPLETE\nNNT | ==================="));

      //     let columns = columnify(results.testResultArray, {  minWidth: 8});
      //     console.log(chalkAlert(columns));

      //     console.log(chalkBlue("\nNNT | TEST COMPLETE"
      //       + " | " + m.processName
      //       + " | TESTS:   " + results.numTests
      //       + " | PASSED:  " + results.numPassed
      //       + " | SKIPPED: " + results.numSkipped
      //       + " | SUCCESS: " + results.successRate.toFixed(2) + "%"
      //       // + "\n  TRAIN OPTIONS"
      //       // + "\n  " + jsonPrint(statsObj.tests[testObj.testRunId][m.processName].train.options)
      //     ));

      //     const options = statsObj.tests[testObj.testRunId][m.processName].train.options;

      //     console.log("\nNNT | TRAIN OPTIONS\n===================");
      //     Object.keys(options).forEach(function(key){
      //       if (key === "network") {
      //         console.log("NNT |   " + key + ": " + options[key].networkId + " | " + options[key].successRate.toFixed(2) + "%");
      //       }
      //       else {
      //         console.log("NNT |   " + key + ": " + options[key]);
      //       }
      //     });

      //     let networkObj = {};
      //     networkObj.networkCreateMode = "train";
      //     networkObj.createdAt = moment().valueOf();
      //     networkObj.networkId = testObj.testRunId;
      //     networkObj.network = m.networkObj.network;
      //     networkObj.successRate = results.successRate;
      //     networkObj.numInputs = m.networkObj.network.input;
      //     networkObj.numOutputs = m.networkObj.network.output;
      //     networkObj.inputs = trainingSetLabels.inputs;
      //     networkObj.outputs = trainingSetLabels.outputs;
      //     networkObj.train = {};
      //     networkObj.train.options = {};
      //     networkObj.train.options = omit(m.statsObj.train.options, ["network", "inputs", "outputs"]);

      //     networkObj.test = statsObj.tests[testObj.testRunId][m.processName];
      //     networkObj.test.train.options = omit(statsObj.tests[testObj.testRunId][m.processName].train.options, ["inputs", "output"]);

      //     if (m.statsObj.train.options.network && (m.statsObj.train.options.network !== undefined)){
      //       networkObj.train.options.network = {};
      //       networkObj.train.options.network.networkId = m.statsObj.train.options.network.networkId;
      //       networkObj.train.options.network.successRate = m.statsObj.train.options.network.successRate;

      //       networkObj.test.train.network = {};
      //       networkObj.test.train.network.networkId = m.statsObj.train.options.network.networkId;
      //       networkObj.test.train.network.successRate = m.statsObj.train.options.network.successRate;
      //     }

      //     bestNetworkFile = networkObj.networkId + ".json";

      //     console.log(chalkLog("NNT | SAVING NN FILE TO DROPBOX"
      //       + " | " + bestNetworkFolder + "/" + bestNetworkFile
      //     ));

      //     saveFile({
      //       folder: bestNetworkFolder, 
      //       file: bestNetworkFile, 
      //       obj: networkObj
      //     }, function(err){

      //       if (err) {
      //         console.error("SAVE BEST NETWORK ERROR " + err);
      //       }
      //       console.log("NNT | SAVED NETWORK TO DROPBOX"
      //         // + "\nNNT | NET ID:  " + networkObj.networkId 
      //         // + "\nNNT | CREATE:  " + networkObj.networkCreateMode 
      //         // // + "\nTYPE:    " + updateNetworkObj.networkType
      //         // + "\nNNT | SUCCESS: " + networkObj.successRate.toFixed(2) + "%"
      //         // + "\nNNT | IN:      " + networkObj.network.input
      //         // + "\nNNT | OUT:     " + networkObj.network.output
      //         // + "\nNNT | EVOLVE:  " + jsonPrint(networkObj.evolve) 
      //         // + "\nNNT | TRAIN:   " + jsonPrint(networkObj.train)
      //         // + "\nNNT | TEST:    " + jsonPrint(networkObj.test)
      //         // + "\nNNT | CREATED: " + moment(new Date(networkObj.createdAt)).format(compactDateTimeFormat) 
      //       );

      //       console.log(chalkInfo("NNT | WAIT FOR NETWORK FILE SAVE ..."));

      //       // setTimeout(function(){
      //       //   quit();
      //       // }, 10000);

      //     });
      //   });

      // break;

      case "EVOLVE_COMPLETE":

        console.log(chalkBlue(
            "\nNNT ========================================================\n"
          +   "NNT | NETWORK EVOLVE COMPLETE"
          + "\nNNT |          " + m.processName
          + "\nNNT | NID:     " + m.networkObj.networkId
          + "\nNNT | SEED:    " + m.networkObj.seedNetworkId
          + "\nNNT | ELAPSED: " + msToTime(m.networkObj.evolve.elapsed)
          + "\nNNT | ITERTNS: " + m.statsObj.evolve.results.iterations
          + "\nNNT | ERROR:   " + m.statsObj.evolve.results.error
          + "\nNNT | INPUTS:  " + m.networkObj.network.input
          + "\nNNT | OUTPUTS: " + m.networkObj.network.output
          + "\nNNT | DROPOUT: " + m.networkObj.network.dropout
          + "\nNNT | NODES:   " + m.networkObj.network.nodes.length
          + "\nNNT | CONNS:   " + m.networkObj.network.connections.length
        ));

        testNetwork(m.networkObj.network, testObj, function(err, results){

          if (err) {
            console.error("NNT | *** TEST NETWORK ERROR ***\n" + jsonPrint(err));
          }

          testObj.results[m.processName] = {};
          testObj.results[m.processName] = results;

          statsObj.tests[testObj.testRunId][m.processName] = {};
          statsObj.tests[testObj.testRunId][m.processName] = pick(
            testObj, 
            ["numInputs", "numOutputs", "inputHits", "inputHitAverage"]
          );
          statsObj.tests[testObj.testRunId][m.processName].results = {};
          statsObj.tests[testObj.testRunId][m.processName].results = pick(
            testObj.results[m.processName], 
            ["successRate", "numPassed", "numSkipped", "numTests", "testRunId"]
          );

          statsObj.tests[testObj.testRunId][m.processName].elapsed = m.networkObj.elapsed;

          console.log(chalkBlue("\nNNT | NETWORK TEST COMPLETE\nNNT | ==================="));

          let columns = columnify(results.testResultArray, {  minWidth: 8, maxWidth: 16});
          debug(chalkAlert(columns));

          console.log(chalkAlert("NNT | TEST COMPLETE"
            + " | " + m.processName
            + " | TESTS:   " + results.numTests
            + " | PASSED:  " + results.numPassed
            + " | SKIPPED: " + results.numSkipped
            + " | SUCCESS: " + results.successRate.toFixed(2) + "%"
            // + "\n  TRAIN OPTIONS"
            // + "\n  " + jsonPrint(statsObj.tests[testObj.testRunId][m.processName].train.options)
          ));

          const options = m.statsObj.evolve.options;

          // console.log("\nNNT | EVOLVE OPTIONS | " + m.processName + "\nNNT | ======================");

          let networkObj = {};

          networkObj.networkId = m.networkObj.networkId;
          networkObj.seedNetworkId = m.networkObj.seedNetworkId;
          networkObj.networkCreateMode = "evolve";
          networkObj.createdAt = moment().valueOf();
          networkObj.network = {};
          networkObj.network = deepcopy(m.networkObj.network);
          networkObj.successRate = results.successRate;
          networkObj.numInputs = m.networkObj.network.input;
          networkObj.numOutputs = m.networkObj.network.output;
          networkObj.inputs = {};
          networkObj.inputs = trainingSetLabels.inputs;
          networkObj.outputs = {};
          networkObj.outputs = trainingSetLabels.outputs;
          networkObj.evolve = {};
          networkObj.evolve.options = {};
          networkObj.evolve.options = omit(m.statsObj.evolve.options, ["network", "inputs", "outputs"]);
          networkObj.evolve.results = {};
          networkObj.evolve.results = m.networkObj.evolve.results;
          networkObj.evolve.elapsed = m.networkObj.evolve.elapsed;

          networkObj.test = {};
          networkObj.test = statsObj.tests[testObj.testRunId][m.processName];


          networkCreateResultsHashmap[networkObj.networkId] = {};
          networkCreateResultsHashmap[networkObj.networkId] = omit(networkObj, ["network", "inputs", "outputs"]);

          printNetworkCreateResultsHashmap();

          if (m.statsObj.evolve.results.iterations < networkObj.evolve.options.iterations) {
            console.log(chalkLog("NNT | XXX | NOT SAVING NN FILE TO DROPBOX ... EARLY COMPLETE?"
              + " | " + networkObj.networkId
              + " | ITRNS: " + m.statsObj.evolve.results.iterations
              + " | MIN: " + cnf.minSuccessRate.toFixed(2) + "%"
              + " | " + networkObj.successRate.toFixed(2) + "%"
            ));

            printNetworkObj(networkObj.networkId, networkObj);

            if (neuralNetworkChildHashMap[m.processName] !== undefined) { neuralNetworkChildHashMap[m.processName].ready = true; }
          }
          else if (results.successRate > cnf.minSuccessRate) {

            bestNetworkFile = m.networkObj.networkId + ".json";

            // networkCreateResultsHashmap[networkObj.networkId] = {};
            // networkCreateResultsHashmap[networkObj.networkId] = omit(networkObj, ["network", "inputs", "outputs"]);

            console.log(chalkLog("NNT | SAVING NN FILE TO DROPBOX"
              + " | " + bestNetworkFolder + "/" + bestNetworkFile
            ));

            saveFile({
              folder: bestNetworkFolder, 
              file: bestNetworkFile, 
              obj: networkObj
            }, function(err){

              if (err) {
                console.error(chalkError("SAVE BEST NETWORK ERROR " + err));
              }
              console.log("NNT | SAVED NETWORK TO DROPBOX"
                + " | " + bestNetworkFile
              );

              printNetworkObj(networkObj.networkId, networkObj);

              if (neuralNetworkChildHashMap[m.processName] !== undefined) { neuralNetworkChildHashMap[m.processName].ready = true; }

            });
          }
          else {
            console.log(chalkLog("NNT | XXX | NOT SAVING NN FILE TO DROPBOX ... LESS THAN MIN SUCCESS"
              + " | " + networkObj.networkId
              + " | " + networkObj.successRate.toFixed(2) + "%"
              + " | " + cnf.minSuccessRate.toFixed(2) + "%"
            ));

            printNetworkObj(networkObj.networkId, networkObj);

            if (neuralNetworkChildHashMap[m.processName] !== undefined) { neuralNetworkChildHashMap[m.processName].ready = true; }
          }

        });

      break;

      default:
      console.error(chalkError("NNT | neuralNetworkChild | UNKNOWN OP: " + m.op));
    }
  });

  neuralNetworkChildHashMap[nnChildId] = {};
  neuralNetworkChildHashMap[nnChildId].child = {};
  neuralNetworkChildHashMap[nnChildId].child = neuralNetworkChild;
  neuralNetworkChildHashMap[nnChildId].ready = false;

  nnChildIndex += 1;

  if (callback !== undefined) { callback(null, nnChildIndex); }
}

function initTimeout(callback){

  console.log(chalkError("\nNNT | SET TIMEOUT | " + moment().format(compactDateTimeFormat) + "\n"));

  configEvents.emit("INIT_MONGODB");

  initialize(configuration, function(err, cnf){

    if (err && (err.status !== 404)) {
      console.error(chalkError("NNT | ***** INIT ERROR *****\n" + jsonPrint(err)));
      quit();
    }

    configuration = cnf;

    console.log(chalkBlue("\n\nNNT | " + cnf.processName + " STARTED " + getTimeStamp() + "\n" + jsonPrint(configuration)));

    requiredTrainingSet.forEach(function(userId) {
      console.log(chalkLog("NNT | ... REQ TRAINING SET | @" + userId));
    });

    console.log(chalkLog("SAVE TEST"));


    let seedOpt = {};
    if (cnf.seedNetworkId) {
      seedOpt.networkId = cnf.seedNetworkId;
    }

    loadSeedNeuralNetwork(seedOpt, function(err, results){

      console.log(chalkLog("NNT | INIT NN CHILD"));

      async.times(cnf.maxNeuralNetworkChildern, function(n, next) {

          initNeuralNetworkChild(cnf, function(err, nnChildIndex) {
            next(err, nnChildIndex);
          });

      }, function(err, children) {
        console.log(chalkLog("END INIT NEURAL NETWORK CHILDREN: " + children.length));
        callback();
      });

    });

  });
}

if (process.env.TNN_BATCH_MODE){
  slackChannel = "#nn_batch";
}

let initMainInterval;

initTimeout(function(){

  initMain(configuration, function(){
    debug(chalkLog("INIT MAIN CALLBACK"));
  });

  clearInterval(initMainInterval);

  initMainInterval = setInterval(function(){

    console.log(chalkAlert("--- INIT MAIN INTERVAL | trainingSetReady: " + trainingSetReady));

    if (trainingSetReady) {

      console.log(chalkAlert("+++ INIT MAIN INTERVAL | trainingSetReady: " + trainingSetReady));

      initMain(configuration, function(){
        debug(chalkLog("INIT MAIN CALLBACK"));
      });

    }

  }, configuration.initMainIntervalTime);

});

