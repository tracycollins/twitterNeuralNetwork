/*jslint node: true */
"use strict";

const DEFAULT_HISTOGRAM_PARSE_TOTAL_MIN = 7;

const bestRuntimeNetworkFileName = "bestRuntimeNetwork.json";

const TEST_MODE_LENGTH = 1000;
const TEST_DROPBOX_NN_LOAD = 3;
const DEFAULT_USE_LOCAL_TRAINING_SETS = false;
const DEFAULT_MAX_NEURAL_NETWORK_CHILDREN = 2;
const DEFAULT_TEST_RATIO = 0.20;

const DEFAULT_NETWORK_CREATE_MODE = "evolve";
const DEFAULT_ITERATIONS = 10;
const DEFAULT_SEED_NETWORK_ID = false;
const DEFAULT_SEED_NETWORK_PROBABILITY = 0.5;

const MIN_INPUT_HITS = 10;

const OFFLINE_MODE = process.env.OFFLINE_MODE === "true" || false;

console.log("OFFLINE_MODE: " + OFFLINE_MODE);

const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;
const ONE_HOUR = 60 * ONE_MINUTE;

const DEFAULT_GLOBAL_MIN_SUCCESS_RATE = 92; // percent
const DEFAULT_LOCAL_MIN_SUCCESS_RATE = 50; // percent

const DEFAULT_INIT_MAIN_INTERVAL = process.env.TNN_INIT_MAIN_INTERVAL || 10*ONE_MINUTE;

let saveFileQueue = [];

const os = require("os");
const util = require("util");
const S = require("string");
const moment = require("moment");

const mongoose = require("mongoose");
const wordAssoDb = require("@threeceelabs/mongoose-twitter");

const userServer = require("@threeceelabs/user-server-controller");
const User = mongoose.model("User", wordAssoDb.UserSchema);

const histogramParser = require("@threeceelabs/histogram-parser");

require("isomorphic-fetch");
const Dropbox = require("dropbox").Dropbox;
const pick = require("object.pick");
const omit = require("object.omit");
// const arrayUnique = require("array-unique");
const Slack = require("slack-node");
const cp = require("child_process");
const arrayNormalize = require("array-normalize");
const columnify = require("columnify");

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

// const neataptic = require("neataptic");
const neataptic = require("./js/neataptic");

const twitterTextParser = require("@threeceelabs/twitter-text-parser");
const twitterImageParser = require("@threeceelabs/twitter-image-parser");
const defaults = require("object.defaults/immutable");
const deepcopy = require("deep-copy");
const table = require("text-table");
const fs = require("fs");

let prevConfigFileModifiedMoment = moment("2010-01-01");
let prevTrainingSetFileModifiedMoment = moment("2010-01-01");
let prevRequiredTrainingSetFileModifiedMoment = moment("2010-01-01");

let networkIndex = 0;

const DEFAULT_BEST_NETWORK_NUMBER = 5;

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
const DEFAULT_EVOLVE_GROWTH = 0.0001;

const EVOLVE_COST_ARRAY = [
  "CROSS_ENTROPY",
  "MSE"
  // "BINARY"
  // "MAE",
  // "MAPE",
  // "MSLE",
  // "HINGE"
];

const EVOLVE_MUTATION_RATE_RANGE = { min: 0.25, max: 0.75 } ;
const EVOLVE_POP_SIZE_RANGE = { min: 100, max: 100 } ;
const EVOLVE_GROWTH_RANGE = { min: 0.00005, max: 0.00015 } ;
const EVOLVE_ELITISM_RANGE = { min: 5, max: 20 } ;

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

const HashMap = require("hashmap").HashMap;

let trainingSetHashMap = new HashMap();
// let trainingSetHashMap = {};
let neuralNetworkChildHashMap = {};
let initMainReady = false;
let trainingSetReady = false;
let createTrainingSetBusy = false;

let inputArrays = {};

let requiredTrainingSet = new Set();
// requiredTrainingSet.add("angela_rye");
// requiredTrainingSet.add("barackobama");
// requiredTrainingSet.add("bfraser747");
// requiredTrainingSet.add("breitbartnews");
// requiredTrainingSet.add("danscavino");
// requiredTrainingSet.add("dnc");
// requiredTrainingSet.add("donaldjtrumpjr");
// requiredTrainingSet.add("foxandfriends");
// requiredTrainingSet.add("foxnews");
// requiredTrainingSet.add("gop");
// requiredTrainingSet.add("gopchairwoman");
// requiredTrainingSet.add("hannity");
// requiredTrainingSet.add("hillaryclinton");
// requiredTrainingSet.add("jaketapper");
// requiredTrainingSet.add("jaredkushner");
// requiredTrainingSet.add("jeffsessions");
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
// requiredTrainingSet.add("realdonaldtrump");
// requiredTrainingSet.add("realjameswoods");
// requiredTrainingSet.add("senategop");
// requiredTrainingSet.add("senjohnmccain");
// requiredTrainingSet.add("sensanders");
// requiredTrainingSet.add("sheriffclarke");
// requiredTrainingSet.add("speakerryan");
// requiredTrainingSet.add("tuckercarlson");
// requiredTrainingSet.add("usatoday");
// requiredTrainingSet.add("vp");

let slackChannel = "#nn";

let initMainInterval;

let configuration = {};

configuration.inputsIdArray = [];
configuration.saveFileQueueInterval = 1000;

configuration.histogramParseTotalMin = DEFAULT_HISTOGRAM_PARSE_TOTAL_MIN;

configuration.useLocalTrainingSets = DEFAULT_USE_LOCAL_TRAINING_SETS;

configuration.forceBannerImageAnalysis = false;
configuration.interruptFlag = false;
configuration.useLocalNetworksOnly = false;
configuration.networkCreateIntervalTime = 10000;
configuration.enableSeedNetwork = true;
configuration.seedNetworkProbability = DEFAULT_SEED_NETWORK_PROBABILITY;

configuration.initMainIntervalTime = DEFAULT_INIT_MAIN_INTERVAL;
configuration.enableRequiredTrainingSet = false;

configuration.histogramsFolder = "/config/utility/default/histograms";

configuration.trainingSetsFolder = "/config/utility/default/trainingSets";
configuration.trainingSetFile = "trainingSet.json";
configuration.requiredTrainingSetFile = "requiredTrainingSet.txt";

configuration.maxNeuralNetworkChildern = (process.env.TNN_MAX_NEURAL_NETWORK_CHILDREN !== undefined) ? process.env.TNN_MAX_NEURAL_NETWORK_CHILDREN : DEFAULT_MAX_NEURAL_NETWORK_CHILDREN;

configuration.globalMinSuccessRate = (process.env.TNN_GLOBAL_MIN_SUCCESS_RATE !== undefined) 
  ? process.env.TNN_GLOBAL_MIN_SUCCESS_RATE 
  : DEFAULT_GLOBAL_MIN_SUCCESS_RATE;

configuration.localMinSuccessRate = (process.env.TNN_LOCAL_MIN_SUCCESS_RATE !== undefined) 
  ? process.env.TNN_LOCAL_MIN_SUCCESS_RATE 
  : DEFAULT_LOCAL_MIN_SUCCESS_RATE;

// configuration.localMinSuccessRate = DEFAULT_LOCAL_MIN_SUCCESS_RATE;
configuration.loadTrainingSetFromFile = false;
configuration.createTrainingSet = false;
configuration.createTrainingSetOnly = false;

configuration.DROPBOX = {};
configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
configuration.DROPBOX.DROPBOX_TNN_CONFIG_FILE = process.env.DROPBOX_TNN_CONFIG_FILE || "twitterNeuralNetworkConfig.json";
configuration.DROPBOX.DROPBOX_TNN_STATS_FILE = process.env.DROPBOX_TNN_STATS_FILE || "twitterNeuralNetworkStats.json";

configuration.normalization = null;
configuration.verbose = false;
configuration.testMode = true; // per tweet test mode
configuration.testSetRatio = DEFAULT_TEST_RATIO;

configuration.evolve = {};
configuration.evolve.useBestNetwork = DEFAULT_EVOLVE_BEST_NETWORK;
configuration.evolve.networkId = DEFAULT_SEED_NETWORK_ID;
configuration.evolve.threads = DEFAULT_EVOLVE_THREADS;
configuration.evolve.architecture = DEFAULT_EVOLVE_ARCHITECTURE;
configuration.evolve.networkObj = null;
configuration.evolve.elitism = DEFAULT_EVOLVE_ELITISM;
configuration.evolve.equal = DEFAULT_EVOLVE_EQUAL;
configuration.evolve.error = DEFAULT_EVOLVE_ERROR;
configuration.evolve.iterations = DEFAULT_ITERATIONS;
configuration.evolve.log = DEFAULT_EVOLVE_LOG;
configuration.evolve.mutation = DEFAULT_EVOLVE_MUTATION;
configuration.evolve.mutationRate = DEFAULT_EVOLVE_MUTATION_RATE;
configuration.evolve.popsize = DEFAULT_EVOLVE_POPSIZE;
configuration.evolve.growth = DEFAULT_EVOLVE_GROWTH;
configuration.evolve.cost = DEFAULT_EVOLVE_COST;

configuration.train = {};
configuration.train.threads = DEFAULT_TRAIN_THREADS;
configuration.train.architecture = DEFAULT_TRAIN_ARCHITECTURE;
configuration.train.hiddenLayerSize = DEFAULT_TRAIN_HIDDEN_LAYER_SIZE;
configuration.train.useBestNetwork = DEFAULT_TRAIN_BEST_NETWORK;
configuration.train.networkObj = null;
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
statsObj.users.imageParse = {};
statsObj.users.imageParse.parsed = 0;
statsObj.users.imageParse.skipped = 0;

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
statsObj.neuralNetworkReady = false;

statsObj.trainingSet = {};
statsObj.trainingSet.totalInputs = 0;

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

let bestNetworkHashMap = new HashMap();
let histogramsHashMap = new HashMap();
let inputsHashMap = new HashMap();
let trainingSetUsersHashMap = new HashMap();

let inputsNetworksHashMap = {};

let currentBestNetwork;
let networkCreateResultsHashmap = {};

const configEvents = new EventEmitter2({
  wildcard: true,
  newListener: true,
  maxListeners: 20,
  verboseMemoryLeak: true
});

let stdin;

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


const enableStdin = { name: "enableStdin", alias: "S", type: Boolean, defaultValue: true };
const quitOnError = { name: "quitOnError", alias: "q", type: Boolean, defaultValue: true };
const verbose = { name: "verbose", alias: "v", type: Boolean };

const maxNeuralNetworkChildern = { name: "maxNeuralNetworkChildern", alias: "N", type: Number};
const createTrainingSetOnly = { name: "createTrainingSetOnly", alias: "C", type: Boolean};
const createTrainingSet = { name: "createTrainingSet", alias: "c", type: Boolean};
const useLocalTrainingSets = { name: "useLocalTrainingSets", alias: "L", type: Boolean};
const loadTrainingSetFromFile = { name: "loadTrainingSetFromFile", alias: "t", type: Boolean};
const inputsId = { name: "inputsId", alias: "i", type: String};
const trainingSetFile = { name: "trainingSetFile", alias: "T", type: String};
const networkCreateMode = { name: "networkCreateMode", alias: "n", type: String, defaultValue: "evolve" };
const hiddenLayerSize = { name: "hiddenLayerSize", alias: "h", type: Number};
const seedNetworkId = { name: "seedNetworkId", alias: "s", type: String };
const useBestNetwork = { name: "useBestNetwork", alias: "b", type: Boolean };
const testMode = { name: "testMode", alias: "X", type: Boolean, defaultValue: false };
const evolveIterations = { name: "evolveIterations", alias: "I", type: Number};

const optionDefinitions = [
  maxNeuralNetworkChildern,
  createTrainingSetOnly,
  createTrainingSet,
  useLocalTrainingSets,
  loadTrainingSetFromFile,
  inputsId,
  trainingSetFile,
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

statsObj.normalization.score.min = 1.0;
statsObj.normalization.score.max = -1.0;
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

const defaultHistogramsFolder = dropboxConfigDefaultFolder + "/histograms";
const defaultInputsFolder = dropboxConfigDefaultFolder + "/inputs";
const localInputsFolder = dropboxConfigHostFolder + "/inputs";

const defaultTrainingSetFolder = dropboxConfigDefaultFolder + "/trainingSets";
const trainingSetFolder = defaultTrainingSetFolder;

const localTrainingSetFolder = dropboxConfigHostFolder + "/trainingSets";
let localTrainingSetFile = "trainingSet_" + statsObj.runId + ".json";

const defaultTrainingSetFile = "trainingSet.json";

const statsFolder = "/stats/" + hostname + "/neuralNetwork";
const statsFile = "twitterNeuralNetworkStats_" + statsObj.runId + ".json";

const globalBestNetworkFolder = "/config/utility/best/neuralNetworks";
const localBestNetworkFolder = "/config/utility/" + hostname + "/neuralNetworks/best";
const localNetworkFolder = "/config/utility/" + hostname + "/neuralNetworks/local";
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
      // async.setImmediate(function() { 
        cb0(); 
      // });
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
      // async.setImmediate(function() { 
        cb1(); 
      // });
    }, function(){

      async.eachOf(arr, function(val, index, cb2){
        if (val < 1) {
          arr[index] = 0;
        }
        // async.setImmediate(function() { 
          cb2(); 
        // });
      }, function(){
        callback(maxIndex, arr); 
      });

    });

  }
}

function printNetworkCreateResultsHashmap(){

  let tableArray = [];

  tableArray.push([
    "NNT | NNID",
    "SEED",
    "RES %",
    "INPTS",
    // "MUT",
    // "ACTV",
    "CLEAR",
    "COST",
    "GRWTH",
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
    const snIdRes = (networkObj.seedNetworkId !== undefined) ? networkObj.seedNetworkRes.toFixed(2) : "---";

    const iterations = (networkObj.evolve.results !== undefined) ? networkObj.evolve.results.iterations : "---";
    const error = ((networkObj.evolve.results !== undefined) 
      && (networkObj.evolve.results.error !== undefined)
      && networkObj.evolve.results.error)  ? networkObj.evolve.results.error.toFixed(5) : "---";

    tableArray.push([
      "NNT | " + nnId,
      snId,
      snIdRes,
      networkObj.numInputs,
      networkObj.evolve.options.clear,
      networkObj.evolve.options.cost,
      networkObj.evolve.options.growth.toFixed(8),
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

    const t = table(tableArray, { align: ["l", "l", "l", "r", "l", "l", "l", "l", "r", "r", "r", "l", "r", "r", "r"] });

    console.log("NNT | ============================================================================================================================================");
    console.log(t);
    console.log("NNT | ============================================================================================================================================");

  });
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

    if (!configuration.createTrainingSetOnly) {
      printNetworkCreateResultsHashmap();
    }

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

    if (options.networkObj !== undefined) {
      const snid = (options.networkObj.evolve && (options.networkObj.evolve.options.network !== undefined)) 
        ? options.networkObj.evolve.options.networkObj.networkId 
        + " | " + options.networkObj.evolve.options.networkObj.successRate.toFixed(2) + "%"
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
        console.log(chalkAlert("*** KILL CHILD ON QUIT | " + nnChildId));
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
      console.log(chalkAlert("*** KILL CHILD ON SIGINT | " + nnChildId));
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
      console.log(chalkAlert("*** KILL CHILD ON EXIT | " + nnChildId));
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
          + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
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
        // saveFileRetry(timeout, path, file, jsonObj);
      }
      if (callback !== undefined) { callback(err); }
    });
  }, timeout);
}

function loadFile(path, file, callback) {

  debug(chalkInfo("LOAD FOLDER " + path));
  debug(chalkInfo("LOAD FILE " + file));
  debug(chalkInfo("FULL PATH " + path + "/" + file));

  let fullPath = path + "/" + file;

  if (OFFLINE_MODE) {
    if (hostname === "mbp2") {
      fullPath = "/Users/tc/Dropbox/Apps/wordAssociation" + path + "/" + file;
      debug(chalkInfo("OFFLINE_MODE: FULL PATH " + fullPath));
    }
    fs.readFile(fullPath, "utf8", function(err, data) {

      if (err) {
        console.log(chalkError(getTimeStamp()
          + " | *** ERROR LOADING FILE FROM DROPBOX FILE"
          + " | " + fullPath
          // + "\n" + jsonPrint(data)
        ));
        return(callback(err, null));
      }

      debug(chalkLog(getTimeStamp()
        + " | LOADING FILE FROM DROPBOX FILE"
        + " | " + fullPath
        // + "\n" + jsonPrint(data)
      ));

      if (file.match(/\.json$/gi)) {
        try {
          let fileObj = JSON.parse(data);
          callback(null, fileObj);
        }
        catch(e){
          console.trace(chalkError("NNT | JSON PARSE ERROR: " + e));
          callback(e, null);
        }
      }
      else if (file.match(/\.txt$/gi)) {
        callback(null, data);
      }
      else {
        callback(null, null);
      }
    });
   }
  else {
    dropboxClient.filesDownload({path: fullPath})
    .then(function(data) {
      debug(chalkLog(getTimeStamp()
        + " | LOADING FILE FROM DROPBOX FILE: " + fullPath
      ));

      let payload = data.fileBinary;
      debug(payload);

      if (file.match(/\.json$/gi)) {
        try {
          let fileObj = JSON.parse(payload);
          callback(null, fileObj);
        }
        catch(e){
          console.trace(chalkError("NNT | JSON PARSE ERROR: " + fullPath  + " | ERROR: " + e + "\n" + jsonPrint(e)));
          callback(null, null);
        }
      }
      else if (file.match(/\.txt$/gi)) {
        callback(null, data);
      }
      else {
        callback(null, null);
      }
    })
    .catch(function(error) {
      console.log(chalkError("NNT | DROPBOX loadFile ERROR: " + fullPath + "\n" + error));
      console.log(chalkError("NNT | !!! DROPBOX READ " + fullPath + " ERROR"));
      console.log(chalkError("NNT | " + jsonPrint(error.error)));

      if (error.status === 404) {
        console.error(chalkError("NNT | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND"
          + " ... SKIPPING ...")
        );
        return(callback(null, null));
      }
      if (error.status === 409) {
        console.error(chalkError("NNT | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND"));
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
}

function getFileMetadata(path, file, callback) {

  const fullPath = path + "/" + file;
  debug(chalkInfo("FOLDER " + path));
  debug(chalkInfo("FILE " + file));
  debug(chalkInfo("getFileMetadata FULL PATH: " + fullPath));

  dropboxClient.filesGetMetadata({path: fullPath})
    .then(function(response) {
      debug(chalkInfo("FILE META\n" + jsonPrint(response)));
      return(callback(null, response));
    })
    .catch(function(error) {
      console.log(chalkError("NNT | DROPBOX getFileMetadata ERROR: " + fullPath + "\n" + error));
      console.log(chalkError("NNT | !!! DROPBOX READ " + fullPath + " ERROR"));
      console.log(chalkError("NNT | " + jsonPrint(error.error)));

      if (error.status === 404) {
        console.error(chalkError("NNT | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND"));
        return(callback(error, null));
      }
      if (error.status === 409) {
        console.error(chalkError("NNT | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND"));
        return(callback(error, null));
      }
      if (error.status === 0) {
        console.error(chalkError("NNT | !!! DROPBOX NO RESPONSE"
          + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
        return(callback(null, null));
      }
      return(callback(error, null));
    });
}

let saveFileQueueInterval;
let saveFileBusy = false;

function initSaveFileQueue(cnf){

  console.log(chalkBlue("NNT | INIT DROPBOX SAVE FILE INTERVAL | " + cnf.saveFileQueueInterval + " MS"));

  clearInterval(saveFileQueueInterval);

  saveFileQueueInterval = setInterval(function () {

    if (!saveFileBusy && saveFileQueue.length > 0) {

      saveFileBusy = true;

      const saveFileObj = saveFileQueue.shift();

      saveFile(saveFileObj, function(err){
        if (err) {
          console.log(chalkError("NNT | *** SAVE FILE ERROR ... RETRY | " + saveFileObj.folder + "/" + saveFileObj.file));
          saveFileQueue.push(saveFileObj);
        }
        else {
          console.log(chalkBlue("NNT | SAVED FILE | " + saveFileObj.folder + "/" + saveFileObj.file));
        }
        saveFileBusy = false;
      });
    }

  }, cnf.saveFileQueueInterval);
}

function initRequiredTrainingSet(cnf, callback){

  console.log(chalkAlert("NNT | INIT REQUIRED TRAINING SET"));

  getFileMetadata(cnf.trainingSetsFolder, cnf.requiredTrainingSetFile, function(err, response){

    if (err) {
      return(callback(err, null));
    }

    const fileModifiedMoment = moment(new Date(response.client_modified));
  
    if (fileModifiedMoment.isSameOrBefore(prevRequiredTrainingSetFileModifiedMoment)){
      console.log(chalkInfo("NNT | REQUIRED TRAINING SET FILE BEFORE OR EQUAL"
        + " | " + cnf.trainingSetsFolder + "/" + cnf.requiredTrainingSetFile
        + " | PREV: " + prevRequiredTrainingSetFileModifiedMoment.format(compactDateTimeFormat)
        + " | " + fileModifiedMoment.format(compactDateTimeFormat)
      ));
      callback(null);
    }
    else {
      console.log(chalkAlert("NNT | ... REQUIRED TRAINING SET FILE AFTER"
        + " | " + cnf.trainingSetsFolder + "/" + cnf.requiredTrainingSetFile
        + " | PREV: " + prevRequiredTrainingSetFileModifiedMoment.format(compactDateTimeFormat)
        + " | " + fileModifiedMoment.format(compactDateTimeFormat)
      ));

      prevRequiredTrainingSetFileModifiedMoment = moment(fileModifiedMoment);

      loadFile(cnf.trainingSetsFolder, cnf.requiredTrainingSetFile, function(err, data){

        if (err){
          console.log(chalkError("NNT | LOAD REQUIRED TRAINING SET FILE ERROR"
            + " | " + cnf.trainingSetsFolder + "/" + cnf.requiredTrainingSetFile
            + "\n" + err
          ));
          return(callback(err));
        }

        if (data  === undefined){
          console.log(chalkError("NNT | DROPBOX REQUIRED TRAINING SET FILE DOWNLOAD DATA UNDEFINED ON FILE"
            + " | " + cnf.trainingSetsFolder + "/" + cnf.requiredTrainingSetFile
          ));
          return(callback("DROPBOX FILE DOWNLOAD DATA UNDEFINED"));
        }

        debug(chalkInfo("NNT | DROPBOX REQUIRED TRAINING SET FILE\n" + jsonPrint(data)));

        const dataConvertAccent = data.fileBinary.toString().replace(/Ã©/g, "e");
        const dataConvertTilde = dataConvertAccent.toString().replace(/Ã£/g, "a");
        const dataArray = dataConvertTilde.toString().split("\n");

        let requiredTrainingSetString;

        requiredTrainingSet = new Set();

        async.eachSeries(dataArray, function(trainingSetItem, cb){

          trainingSetItem = trainingSetItem.replace(/^\s+/g, "");
          trainingSetItem = trainingSetItem.replace(/\s+$/g, "");
          trainingSetItem = trainingSetItem.replace(/\s+/g, " ");

          requiredTrainingSetString = new S(trainingSetItem);

          if (requiredTrainingSetString !== ""){
            requiredTrainingSet.add(requiredTrainingSetString);
            console.log(chalkInfo("NNT | +++ REQ TRAINING SET | " + requiredTrainingSetString));
            async.setImmediate(function() {
              cb();
            });
          }
          else {
            console.log(chalkInfo("NNT | ??? REQ TRAINING SET | " + requiredTrainingSetString));
            async.setImmediate(function() {
              cb();
            });
          }


        }, function(err){
          if (err) {
            callback(err);
          }
          else {
            console.log(chalkInfo("NNT | INIT REQ TRAINING SET COMPLETE| " + requiredTrainingSet.size));
            callback(null);
          }
        });

      });
    }
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

function loadHistogramsDropboxFolder(folder, callback){

  console.log(chalkNetwork("NNT | ... LOADING DROPBOX HISTOGRAMS FOLDER | " + folder));

  let options = {path: folder};

  dropboxClient.filesListFolder(options)
  .then(function(response){

    debug(chalkLog("DROPBOX LIST FOLDER"
      + " | " + options.path
      + " | " + jsonPrint(response)
    ));

    async.eachSeries(response.entries, function(entry, cb){

      console.log(chalkInfo("NNT | DROPBOX HISTOGRAMS FILE FOUND"
        + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
        + " | " + entry.name
        // + " | " + entry.content_hash
        // + "\n" + jsonPrint(entry)
      ));

      const entryNameArray = entry.name.split(".");
      const histogramsId = entryNameArray[0];

      if (histogramsHashMap.has(histogramsId)){

        if (histogramsHashMap.get(histogramsId).entry.content_hash !== entry.content_hash) {

          console.log(chalkInfo("NNT | DROPBOX HISTOGRAMS CONTENT CHANGE"
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
            + " | " + entry.name
            + "\nCUR HASH: " + entry.content_hash
            + "\nOLD HASH: " + histogramsHashMap.get(histogramsId).entry.content_hash
          ));

          loadFile(folder, entry.name, function(err, histogramsObj){

            if (err) {
              console.log(chalkError("NNT | DROPBOX HISTOGRAMS LOAD FILE ERROR: " + err));
              return(cb());
            }

            console.log(chalkInfo("NNT | DROPBOX HISTOGRAMS"
              + " | " + entry.name
              + " | " + histogramsObj.histogramsId
            ));

            histogramsHashMap.set(histogramsObj.histogramsId, histogramsObj);
            cb();

          });
        }
        else{
          debug(chalkLog("NNT | DROPBOX HISTOGRAMS CONTENT SAME  "
            + " | " + entry.name
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
          ));
          cb();
        }
      }
      else {

        loadFile(folder, entry.name, function(err, histogramsObj){

          if (err) {
            console.log(chalkError("NNT | DROPBOX HISTOGRAMS LOAD FILE ERROR: " + err));
            cb();
          }
          else if ((histogramsObj === undefined) || !histogramsObj) {
            console.log(chalkError("NNT | DROPBOX HISTOGRAMS LOAD FILE ERROR | JSON UNDEFINED ??? "));

            dropboxClient.filesDelete({path: folder + "/" + entry.name})
            .then(function(response){
              debug("dropboxClient filesDelete response\n" + jsonPrint(response));
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

            histogramsHashMap.set(histogramsObj.histogramsId, histogramsObj);

            const histogramTypes = Object.keys(histogramsObj.histograms);

            console.log(chalkInfo("NNT | + HISTOGRAMS HASH MAP"
              + " | " + histogramsHashMap.count() + " INs IN HM"
              + " | " + histogramsObj.histogramsId
            ));

            let totalHistograms = 0;

            histogramTypes.forEach(function(histogramType){
              console.log("NNT | " + histogramsObj.histogramsId 
                + " | HISTOGRAM TYPE: " + histogramType 
                + " | " + Object.keys(histogramsObj.histograms[histogramType]).length + " ENTRIES"
              );
              totalHistograms += Object.keys(histogramsObj.histograms[histogramType]).length;
            });

            console.log("NNT | " + histogramsObj.histogramsId 
              + " | TOTAL histograms TYPE: " + totalHistograms
            );

            histogramParser.parse({histogram: histogramsObj.histograms, totalMin: configuration.histogramParseTotalMin}, function(err, histResults){

              debug(chalkNetwork("HISTOGRAMS RESULTS\n" + jsonPrint(histResults)));

              let newInputsObj = {};
              newInputsObj.inputsId = histogramsObj.histogramsId;
              newInputsObj.entry = {};
              newInputsObj.meta = {};
              newInputsObj.inputs = {};

              const inputTypes = Object.keys(histResults.entries);

              inputTypes.forEach(function(type){
                newInputsObj.inputs[type] = [];
                newInputsObj.inputs[type] = Object.keys(histResults.entries[type].dominantEntries).sort();
              });

              debug(chalkNetwork("NEW INPUTS\n" + jsonPrint(newInputsObj)));

              // inputsHashMap.set(newInputsObj.inputsId, newInputsObj);

              let inputsObj = {};

              if (inputsHashMap.has(histogramsObj.histogramsId)) {
                newInputsObj.entry = inputsHashMap.get(histogramsObj.histogramsId).entry;
                inputsHashMap.set(histogramsObj.histogramsId, newInputsObj);
              }
              else {
                newInputsObj.entry.name = histogramsObj.histogramsId + ".json";
                newInputsObj.entry.content_hash = false;
                newInputsObj.entry.client_modified = moment();
                inputsHashMap.set(histogramsObj.histogramsId, newInputsObj);
              }

              if (inputsNetworksHashMap[newInputsObj.inputsId] === undefined) {
                inputsNetworksHashMap[newInputsObj.inputsId] = new Set();
              }

              const newInputsFile = histogramsObj.histogramsId + ".json";


              const fldr = (hostname === "google") ? defaultInputsFolder : localInputsFolder;

              saveFileQueue.push({folder: fldr, file: newInputsFile, obj: newInputsObj});

              cb();
            });

          }

        });
      }
    }, function(){
      if (callback !== undefined) { callback(null); }
    });

  })
  .catch(function(err){
    console.log(chalkError("NNT | *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
    if (callback !== undefined) { callback(err); }
  });
}

function loadInputsDropboxFolder(folder, callback){

  console.log(chalkNetwork("NNT | ... LOADING DROPBOX INPUTS FOLDER | " + folder));

  let options = {path: folder};

  dropboxClient.filesListFolder(options)
  .then(function(response){

    debug(chalkLog("DROPBOX LIST FOLDER"
      + " | " + options.path
      + " | " + jsonPrint(response)
    ));

    async.eachSeries(response.entries, function(entry, cb){

      const entryNameArray = entry.name.split(".");
      const entryInputsId = entryNameArray[0];

      console.log(chalkInfo("NNT | DROPBOX INPUTS FILE FOUND"
        + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
        + " | INPUTS ID: " + entryInputsId
        + " | " + entry.name
        // + " | " + entry.content_hash
        // + "\n" + jsonPrint(entry)
      ));


      if (inputsHashMap.has(entryInputsId)){

        if (inputsHashMap.get(entryInputsId).entry.content_hash !== entry.content_hash) {

          console.log(chalkInfo("NNT | DROPBOX INPUTS CONTENT CHANGE"
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
            + " | " + entry.name
            + "\nCUR HASH: " + entry.content_hash
            + "\nOLD HASH: " + inputsHashMap.get(entryInputsId).entry.content_hash
          ));

          loadFile(folder, entry.name, function(err, inputsObj){

            if (err) {
              console.log(chalkError("NNT | DROPBOX INPUTS LOAD FILE ERROR: " + err));
              return(cb());
            }

            console.log(chalkInfo("NNT | DROPBOX INPUTS"
              + " | " + entry.name
              + " | " + inputsObj.inputsId
            ));

            inputsObj.entry = {};
            inputsObj.entry = entry;

            inputsHashMap.set(inputsObj.inputsId, inputsObj);

            if (inputsNetworksHashMap[inputsObj.inputsId] === undefined) {
              inputsNetworksHashMap[inputsObj.inputsId] = new Set();
            }

            cb();

          });
        }
        else{
          debug(chalkLog("NNT | DROPBOX INPUTS CONTENT SAME  "
            + " | " + entry.name
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
          ));
          cb();
        }
      }
      else {

        loadFile(folder, entry.name, function(err, inputsObj){

          if (err) {
            console.log(chalkError("NNT | DROPBOX INPUTS LOAD FILE ERROR: " + err));
            cb();
          }
          else if ((inputsObj === undefined) || !inputsObj) {
            console.log(chalkError("NNT | DROPBOX INPUTS LOAD FILE ERROR | JSON UNDEFINED ??? "));

            cb();

            // dropboxClient.filesDelete({path: folder + "/" + entry.name})
            // .then(function(response){
            //   debug("dropboxClient filesDelete response\n" + jsonPrint(response));
            //   console.log(chalkAlert("NNT | XXX NN"
            //     + " | " + entry.name
            //   ));
            //   cb();
            // })
            // .catch(function(err){
            //   console.log(chalkError("NNT | *** ERROR: XXX NN"
            //     + " | " + folder + "/" + entry.name
            //     + " | " + jsonPrint(err)
            //   ));
            //   cb();
            // });

          }
          else {

            inputsObj.entry = {};
            inputsObj.entry = entry;

            inputsHashMap.set(inputsObj.inputsId, inputsObj);

            if (inputsNetworksHashMap[inputsObj.inputsId] === undefined) {
              inputsNetworksHashMap[inputsObj.inputsId] = new Set();
            }

            const inputTypes = Object.keys(inputsObj.inputs);

            console.log(chalkInfo("NNT | + INPUTS HASH MAP"
              + " | " + inputsHashMap.count() + " INs IN HM"
              + " | " + inputsObj.inputsId
            ));

            let totalInputs = 0;

            inputTypes.forEach(function(inputType){
              console.log("NNT | " + inputsObj.inputsId + " | INPUT TYPE: " + inputType + " | " + inputsObj.inputs[inputType].length + " INPUTS");
              totalInputs += inputsObj.inputs[inputType].length;
            });

            console.log("NNT | " + inputsObj.inputsId + " | TOTAL INPUTS TYPE: " + totalInputs);

            cb();

          }

        });
      }
    }, function(){
      if (callback !== undefined) { callback(null); }
    });

  })
  .catch(function(err){
    console.log(chalkError("NNT | *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
    if (callback !== undefined) { callback(err); }
  });
}

function loadTrainingSetsDropboxFolder(folder, callback){

  console.log(chalkNetwork("NNT | ... LOADING DROPBOX TRAINING SETS FOLDER | " + folder));

  if (configuration.useLocalNetworksOnly) {
    return (callback(null, []));
  }

  let options = {path: folder};

  dropboxClient.filesListFolder(options)
  .then(function(response){

    debug(chalkLog("DROPBOX LIST FOLDER"
      + " | " + options.path
      + " | " + jsonPrint(response)
    ));

    async.eachSeries(response.entries, function(entry, cb){

      console.log(chalkInfo("NNT | DROPBOX TRAINING SET FOUND"
        + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
        + " | " + entry.name
      ));

      if (!entry.name.endsWith(".json")){
        console.log("NNT | ... IGNORE DROPBOX TRAINING SETS FOLDER FILE: " + entry.name);
        return cb();
      }

      const entryNameArray = entry.name.split(".");
      const trainingSetId = entryNameArray[0];

      if (trainingSetHashMap.has(trainingSetId)){

        if (trainingSetHashMap.get(trainingSetId).entry.content_hash !== entry.content_hash) {

          console.log(chalkInfo("NNT | DROPBOX TRAINING SET CONTENT CHANGE"
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
            + " | " + entry.name
            + "\nCUR HASH: " + entry.content_hash
            + "\nOLD HASH: " + trainingSetHashMap.get(trainingSetId).entry.content_hash
          ));

          loadFile(folder, entry.name, function(err, trainingSetObj){

            if (err) {
              console.log(chalkError("NNT | DROPBOX TRAINING SET LOAD FILE ERROR: " + err));
              return(cb());
            }

            console.log(chalkInfo("NNT | DROPBOX TRAINING SET"
              + " | " + entry.name
              + " | " + trainingSetObj.trainingSetId
            ));

            trainingSetHashMap.set(trainingSetObj.trainingSetId, trainingSetObj);
            cb();

          });
        }
        else{
          debug(chalkLog("NNT | DROPBOX TRAINING SET CONTENT SAME  "
            + " | " + entry.name
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
          ));
          cb();
        }
      }
      else {

        loadFile(folder, entry.name, function(err, trainingSetObj){

          if (err) {
            console.log(chalkError("NNT | DROPBOX TRAINING SET LOAD FILE ERROR: " + err));
            return cb("NNT | DROPBOX TRAINING SET LOAD FILE ERROR: " + err);
          }

          trainingSetHashMap.set(trainingSetObj.trainingSetId, trainingSetObj);

          console.log(chalkNetwork("NNT | LOADED DROPBOX TRAINING SET"
            + " | " + folder + "/" + entry.name
            + " | " + trainingSetObj.trainingSetId
            + " | META\n" + jsonPrint(trainingSetObj.trainingSet.meta)
          ));

          cb();

        });

      }

    }, function(){
      if (callback !== undefined) { callback(null); }
    });

  })
  .catch(function(err){
    console.log(chalkError("NNT | *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
    if (callback !== undefined) { callback(err, null); }
  });
}

function loadBestNetworkDropboxFolders (folders, callback){

  let numNetworksLoaded = 0;

  debug(chalkNetwork("NNT | ... LOADING DROPBOX BEST NN FOLDERS | " + folders));

  // if (configuration.useLocalNetworksOnly) {
  //   return (callback(null, []));
  // }

  async.eachSeries(folders, function(folder, cb0){

    debug(chalkNetwork("NNT | ... LOADING DROPBOX BEST NN FOLDER | " + folder));

    let options = {path: folder};

    dropboxClient.filesListFolder(options)
    .then(function(response){

      debug(chalkLog("DROPBOX LIST FOLDER"
        + " | " + options.path
        + " | " + jsonPrint(response)
      ));

      if (configuration.testMode) {
        response.entries.length = TEST_DROPBOX_NN_LOAD;
      }

      debug(chalkNetwork("NNT | DROPBOX BEST NETWORKS FOLDER FILES " + folder
        + " | " + response.entries.length + " FILES FOUND"
      ));

      async.eachSeries(response.entries, function(entry, cb1){

        if (entry.name === bestRuntimeNetworkFileName) {
          debug(chalkInfo("... SKIPPING LOAD OF " + entry.name));
          return(cb1());
        }

        const entryNameArray = entry.name.split(".");
        const networkId = entryNameArray[0];

        debug(chalkInfo("NNT | DROPBOX BEST NETWORK FOUND"
          + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
          + " | " + networkId
          + " | " + entry.name
        ));

        if (bestNetworkHashMap.has(networkId)){

          if (bestNetworkHashMap.get(networkId).entry.content_hash !== entry.content_hash) {

            console.log(chalkNetwork("NNT | DROPBOX BEST NETWORK CONTENT CHANGE"
              + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
              + " | " + entry.name
              + "\nCUR HASH: " + entry.content_hash
              + "\nOLD HASH: " + bestNetworkHashMap.get(networkId).entry.content_hash
            ));

            loadFile(folder, entry.name, function(err, networkObj){

              if (err) {
                console.log(chalkError("NNT | DROPBOX BEST NETWORK LOAD FILE ERROR: " + err));
                return(cb1(err));
              }

              if (networkObj.inputsId === undefined) {
                console.log(chalkError("*** NETWORK OBJ INPUTS ID UNDEFINED | " + networkObj.networkId));
                return cb1("NETWORK OBJ INPUTS ID UNDEFINED");
              }

              // if (networkObj.networkId === networkId) {
              if (networkObj.networkId !== networkId) {
                console.log(chalkError("*** NETWORK OBJ NETWORK ID MISMATCH | " + networkObj.networkId + " | " + networkId));
                return cb1("NETWORK OBJ NETWORK ID MISMATCH");
              }

              console.log(chalkNetwork("NNT | DROPBOX BEST NETWORK"
                + " | " + networkObj.successRate.toFixed(2) + "%"
                + " | " + getTimeStamp(networkObj.createdAt)
                + " | " + networkObj.networkId
                + " | " + networkObj.networkCreateMode
                + " | IN: " + networkObj.numInputs
                + " | OUT: " + networkObj.numOutputs
              ));

              bestNetworkHashMap.set(networkObj.networkId, { entry: entry, networkObj: networkObj});

              let inputsObj = {};

              if (inputsHashMap.has(networkObj.inputsId)) {
                inputsObj = inputsHashMap.get(networkObj.inputsId);
                inputsObj.inputs = networkObj.inputs;
                inputsHashMap.set(networkObj.inputsId, inputsObj);
              }
              else {
                inputsObj.inputsId = networkObj.inputsId;
                inputsObj.inputs = networkObj.inputs;
                inputsObj.entry = {};
                inputsObj.entry.name = networkObj.inputsId + ".json";
                inputsObj.entry.content_hash = false;
                inputsObj.entry.client_modified = moment();
                inputsHashMap.set(networkObj.inputsId, inputsObj);
              }

              if (inputsNetworksHashMap[networkObj.inputsId] === undefined) {
                inputsNetworksHashMap[networkObj.inputsId] = new Set();
              }
              inputsNetworksHashMap[networkObj.inputsId].add(networkObj.networkId);

              numNetworksLoaded += 1;

              if (!currentBestNetwork || (networkObj.successRate > currentBestNetwork.successRate)) {

                currentBestNetwork = networkObj;

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

              cb1();

            });
          }
          else{
            debug(chalkLog("NNT | DROPBOX BEST NETWORK CONTENT SAME  "
              + " | " + entry.name
              + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
            ));
            cb1();
          }
        }
        else {

          loadFile(folder, entry.name, function(err, networkObj){

            if (err) {
              console.log(chalkError("NNT | DROPBOX BEST NETWORK LOAD FILE ERROR: " + err));
              cb1();
            }
            else if ((networkObj === undefined) || !networkObj) {
              console.log(chalkError("NNT | DROPBOX BEST NETWORK LOAD FILE ERROR | JSON UNDEFINED ??? "));

              dropboxClient.filesDelete({path: folder + "/" + entry.name})
              .then(function(response){
                debug("dropboxClient filesDelete response\n" + jsonPrint(response));
                console.log(chalkAlert("NNT | XXX NN"
                  + " | " + entry.name
                ));
                cb1();
              })
              .catch(function(err){
                console.log(chalkError("NNT | *** ERROR: XXX NN"
                  + " | " + folder + "/" + entry.name
                  + " | " + jsonPrint(err)
                ));
                cb1(err);
              });

            }
            else {

              if ((options.networkId !== undefined) 
                || ((folder === "/config/utility/best/neuralNetworks") && (networkObj.successRate > configuration.globalMinSuccessRate))
                || ((folder !== "/config/utility/best/neuralNetworks") && (networkObj.successRate > configuration.localMinSuccessRate))
              ) {

                bestNetworkHashMap.set(networkObj.networkId, { entry: entry, networkObj: networkObj});
                // inputsHashMap.set(networkObj.inputsId, {inputsId: networkObj.inputsId, inputs:networkObj.inputs});

                let inputsObj = {};

                if (inputsHashMap.has(networkObj.inputsId)) {
                  inputsObj = inputsHashMap.get(networkObj.inputsId);
                  inputsObj.inputs = networkObj.inputs;
                  inputsHashMap.set(networkObj.inputsId, inputsObj);
                }
                else {
                  inputsObj.inputsId = networkObj.inputsId;
                  inputsObj.inputs = networkObj.inputs;
                  inputsObj.entry = {};
                  inputsObj.entry.name = networkObj.inputsId + ".json";
                  inputsObj.entry.content_hash = false;
                  inputsObj.entry.client_modified = moment();
                  inputsHashMap.set(networkObj.inputsId, inputsObj);
                }

                if (inputsNetworksHashMap[networkObj.inputsId] === undefined) {
                  inputsNetworksHashMap[networkObj.inputsId] = new Set();
                }
                inputsNetworksHashMap[networkObj.inputsId].add(networkObj.networkId);

                numNetworksLoaded += 1;

                console.log(chalkNetwork("NNT | + NN HASH MAP"
                  + " | " + bestNetworkHashMap.count() + " NNs IN HM"
                  + " | " + networkObj.successRate.toFixed(2) + "%"
                  + " | " + getTimeStamp(networkObj.createdAt)
                  + " | IN: " + networkObj.numInputs
                  + " | OUT: " + networkObj.numOutputs
                  + " | " + networkObj.networkCreateMode
                  + " | " + networkId
                  + " | " + networkObj.networkId
                ));

                if (!currentBestNetwork || (networkObj.successRate > currentBestNetwork.successRate)) {

                  currentBestNetwork = networkObj;

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

                cb1();

              }
              else {

                bestNetworkHashMap.delete(networkObj.networkId);

                dropboxClient.filesDelete({path: folder + "/" + entry.name})
                .then(function(response){
                  debug("dropboxClient filesDelete response\n" + jsonPrint(response));
                  console.log(chalkAlert("NNT | XXX NN"
                    + " | MIN SUCCESS RATE: GLOBAL: " + configuration.globalMinSuccessRate + " LOCAL: " + configuration.localMinSuccessRate
                    + " | " + networkObj.successRate.toFixed(2) + "%"
                    + " | " + getTimeStamp(networkObj.createdAt)
                    + " | IN: " + networkObj.numInputs
                    + " | OUT: " + networkObj.numOutputs
                    + " | " + networkObj.networkCreateMode
                    + " | " + networkObj.networkId
                  ));
                  cb1();
                })
                .catch(function(err){
                  console.log(chalkError("NNT | *** ERROR: XXX NN"
                    + " | " + folder + "/" + entry.name
                    + " | " + jsonPrint(err)
                  ));
                  cb1(err);
                });
              }

            }

          });
        }
      }, function(err){
        cb0(err);
      });
    })
    .catch(function(err){
      console.log(chalkError("NNT | *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
      cb0(err);
    });

  }, function(err){
      if (callback !== undefined) { callback(err, numNetworksLoaded); }
  });
}

function printDatum(title, input){

  let row = "";
  let col = 0;
  let rowNum = 0;
  const COLS = 50;

  console.log("\nNNT | ------------- " + title + " -------------");

  input.forEach(function(bit, i){
    if (i === 0) {
      row = row + bit.toFixed(10) + " | " ;
    }
    else if (i === 1) {
      row = row + bit.toFixed(10);
    }
    else if (i === 2) {
      console.log("NNT | ROW " + rowNum + " | " + row);
      row = bit ? "X" : ".";
      col = 1;
      rowNum += 1;
    }
    else if (col < COLS){
      row = row + (bit ? "X" : ".");
      col += 1;
    }
    else {
      console.log("NNT | ROW " + rowNum + " | " + row);
      row = bit ? "X" : ".";
      col = 1;
      rowNum += 1;
    }
  });
}

function printNetworkObj(title, nnObj){
  console.log(chalkNetwork(title
    // + " | " + nnObj.networkId
    + " | SUCCESS: " + nnObj.successRate.toFixed(2) + "%"
  ));
}

function loadConfigFile(folder, file, callback) {

  const fullPath = folder + "/" + file;

  getFileMetadata(folder, file, function(err, response){

    if (err) {
      return(callback(err, null));
    }

    const fileModifiedMoment = moment(new Date(response.client_modified));
  
    if (fileModifiedMoment.isSameOrBefore(prevConfigFileModifiedMoment)){

      debug(chalkInfo("NNT | CONFIG FILE BEFORE OR EQUAL"
        + " | " + fullPath
        + " | PREV: " + prevConfigFileModifiedMoment.format(compactDateTimeFormat)
        + " | " + fileModifiedMoment.format(compactDateTimeFormat)
      ));
      callback(null, null);
    }
    else {
      console.log(chalkAlert("NNT | ... CONFIG FILE AFTER ... LOADING ..."
        + " | " + fullPath
        + " | PREV: " + prevConfigFileModifiedMoment.format(compactDateTimeFormat)
        + " | " + fileModifiedMoment.format(compactDateTimeFormat)
      ));

      prevConfigFileModifiedMoment = moment(fileModifiedMoment);

      loadFile(folder, file, function(err, loadedConfigObj){

        let commandLineConfigKeys;
        let configArgs;

        if (!err) {

          console.log(chalkAlert("NNT | LOADED CONFIG FILE: " + dropboxConfigFile + "\n" + jsonPrint(loadedConfigObj)));

          if (loadedConfigObj.TNN_HISTOGRAM_PARSE_TOTAL_MIN !== undefined){
            console.log("NNT | LOADED TNN_HISTOGRAM_PARSE_TOTAL_MIN: " + loadedConfigObj.TNN_HISTOGRAM_PARSE_TOTAL_MIN);
            configuration.histogramParseTotalMin = loadedConfigObj.TNN_HISTOGRAM_PARSE_TOTAL_MIN;
          }

          if (loadedConfigObj.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED  !== undefined){
            console.log("NNT | TNN_CROSS_ENTROPY_WORKAROUND_ENABLED: " + loadedConfigObj.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED);

            if (!loadedConfigObj.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED || (loadedConfigObj.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED === "false")) {
              configuration.crossEntropyWorkAroundEnabled = false;
            }
            else {
              configuration.crossEntropyWorkAroundEnabled = true;
            }
          }

          if (loadedConfigObj.TNN_CREATE_TRAINING_SET  !== undefined){
            console.log("NNT | CREATE TRAINING SET");

            if (!loadedConfigObj.TNN_CREATE_TRAINING_SET || (loadedConfigObj.TNN_CREATE_TRAINING_SET === "false")) {
              configuration.createTrainingSet = false;
            }
            else {
              configuration.createTrainingSet = true;
            }
          }

          if (loadedConfigObj.TNN_CREATE_TRAINING_SET_ONLY  !== undefined){
            console.log("NNT | CREATE TRAINING SET ONLY");

            if (!loadedConfigObj.TNN_CREATE_TRAINING_SET_ONLY || (loadedConfigObj.TNN_CREATE_TRAINING_SET_ONLY === "false")) {
              configuration.createTrainingSetOnly = false;
            }
            else {
              configuration.createTrainingSet = true;
              configuration.createTrainingSetOnly = true;
            }
          }

          if (loadedConfigObj.TNN_LOAD_TRAINING_SET_FROM_FILE  !== undefined){
            console.log("NNT | LOADED TNN_LOAD_TRAINING_SET_FROM_FILE: " + loadedConfigObj.TNN_LOAD_TRAINING_SET_FROM_FILE);

            if (!loadedConfigObj.TNN_LOAD_TRAINING_SET_FROM_FILE || (loadedConfigObj.TNN_LOAD_TRAINING_SET_FROM_FILE === "false")) {
              configuration.loadTrainingSetFromFile = false;
            }
            else if (!configuration.createTrainingSet && !configuration.createTrainingSetOnly) {
              configuration.loadTrainingSetFromFile = true;
            }
          }

          if (loadedConfigObj.TNN_USE_LOCAL_TRAINING_SETS  !== undefined){
            console.log("NNT | LOADED TNN_USE_LOCAL_TRAINING_SETS: " + loadedConfigObj.TNN_USE_LOCAL_TRAINING_SETS);

            if (!loadedConfigObj.TNN_USE_LOCAL_TRAINING_SETS || (loadedConfigObj.TNN_USE_LOCAL_TRAINING_SETS === "false")) {
              configuration.useLocalTrainingSets = false;
            }
            else {
              configuration.useLocalTrainingSets = true;
            }
          }

          if (loadedConfigObj.TNN_INPUTS_IDS !== undefined){
            console.log("NNT | LOADED TNN_INPUTS_IDS: " + loadedConfigObj.TNN_INPUTS_IDS);
            configuration.inputsIdArray = loadedConfigObj.TNN_INPUTS_IDS;
          }

          if (loadedConfigObj.TNN_INPUTS_ID !== undefined){
            console.log("NNT | LOADED TNN_INPUTS_ID: " + loadedConfigObj.TNN_INPUTS_ID);
            configuration.inputsId = loadedConfigObj.TNN_INPUTS_ID;
          }

          if (loadedConfigObj.TNN_SEED_NETWORK_PROBABILITY !== undefined){
            console.log("NNT | LOADED TNN_SEED_NETWORK_PROBABILITY: " + loadedConfigObj.TNN_SEED_NETWORK_PROBABILITY);
            configuration.seedNetworkProbability = loadedConfigObj.TNN_SEED_NETWORK_PROBABILITY;
          }

          if (loadedConfigObj.TNN_INIT_MAIN_INTERVAL !== undefined){
            console.log("NNT | LOADED TNN_INIT_MAIN_INTERVAL: " + loadedConfigObj.TNN_INIT_MAIN_INTERVAL);
            configuration.initMainIntervalTime = loadedConfigObj.TNN_INIT_MAIN_INTERVAL;
          }

          if (loadedConfigObj.TNN_MAX_NEURAL_NETWORK_CHILDREN !== undefined){
            console.log("NNT | LOADED TNN_MAX_NEURAL_NETWORK_CHILDREN: " + loadedConfigObj.TNN_MAX_NEURAL_NETWORK_CHILDREN);
            configuration.maxNeuralNetworkChildern = loadedConfigObj.TNN_MAX_NEURAL_NETWORK_CHILDREN;
          }

          if (loadedConfigObj.TNN_GLOBAL_MIN_SUCCESS_RATE !== undefined){
            console.log("NNT | LOADED TNN_GLOBAL_MIN_SUCCESS_RATE: " + loadedConfigObj.TNN_GLOBAL_MIN_SUCCESS_RATE);
            configuration.globalMinSuccessRate = loadedConfigObj.TNN_GLOBAL_MIN_SUCCESS_RATE;
          }

          if (loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE !== undefined){
            console.log("NNT | LOADED TNN_LOCAL_MIN_SUCCESS_RATE: " + loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE);
            configuration.localMinSuccessRate = loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE;
          }

          if (loadedConfigObj.TNN_EVOLVE_THREADS !== undefined){
            console.log("NNT | LOADED TNN_EVOLVE_THREADS: " + loadedConfigObj.TNN_EVOLVE_THREADS);
            configuration.evolve.threads = loadedConfigObj.TNN_EVOLVE_THREADS;
          }

          if (loadedConfigObj.TNN_SEED_NETWORK_ID  !== undefined){
            console.log("NNT | LOADED TNN_SEED_NETWORK_ID: " + loadedConfigObj.TNN_SEED_NETWORK_ID);
            configuration.evolve.networkId = loadedConfigObj.TNN_SEED_NETWORK_ID;
            configuration.train.networkId = loadedConfigObj.TNN_SEED_NETWORK_ID;
          }

          if (loadedConfigObj.TNN_TRAIN_BEST_NETWORK  !== undefined){
            console.log("NNT | LOADED TNN_TRAIN_BEST_NETWORK: " + loadedConfigObj.TNN_TRAIN_BEST_NETWORK);
            configuration.train.useBestNetwork = loadedConfigObj.TNN_TRAIN_BEST_NETWORK;
          }

          if (loadedConfigObj.TNN_EVOLVE_BEST_NETWORK  !== undefined){
            console.log("NNT | LOADED TNN_EVOLVE_BEST_NETWORK: " + loadedConfigObj.TNN_EVOLVE_BEST_NETWORK);
            configuration.evolve.useBestNetwork = loadedConfigObj.TNN_EVOLVE_BEST_NETWORK;
          }

          if (loadedConfigObj.TNN_EVOLVE_ITERATIONS  !== undefined){
            console.log("NNT | LOADED TNN_EVOLVE_ITERATIONS: " + loadedConfigObj.TNN_EVOLVE_ITERATIONS);
            configuration.evolve.iterations = loadedConfigObj.TNN_EVOLVE_ITERATIONS;
          }

          if (loadedConfigObj.TNN_TRAIN_ITERATIONS  !== undefined){
            console.log("NNT | LOADED TNN_TRAIN_ITERATIONS: " + loadedConfigObj.TNN_TRAIN_ITERATIONS);
            configuration.train.iterations = loadedConfigObj.TNN_TRAIN_ITERATIONS;
          }

          if (loadedConfigObj.TNN_VERBOSE_MODE  !== undefined){
            console.log("NNT | LOADED TNN_VERBOSE_MODE: " + loadedConfigObj.TNN_VERBOSE_MODE);
            configuration.verbose = loadedConfigObj.TNN_VERBOSE_MODE;
          }

          if (loadedConfigObj.TNN_TEST_MODE  !== undefined){
            console.log("NNT | LOADED TNN_TEST_MODE: " + loadedConfigObj.TNN_TEST_MODE);
            configuration.testMode = loadedConfigObj.TNN_TEST_MODE;
          }

          if (loadedConfigObj.TNN_ENABLE_STDIN  !== undefined){
            console.log("NNT | LOADED TNN_ENABLE_STDIN: " + loadedConfigObj.TNN_ENABLE_STDIN);
            configuration.enableStdin = loadedConfigObj.TNN_ENABLE_STDIN;
          }

          if (loadedConfigObj.TNN_STATS_UPDATE_INTERVAL  !== undefined) {
            console.log("NNT | LOADED TNN_STATS_UPDATE_INTERVAL: " + loadedConfigObj.TNN_STATS_UPDATE_INTERVAL);
            configuration.statsUpdateIntervalTime = loadedConfigObj.TNN_STATS_UPDATE_INTERVAL;
          }

          if (loadedConfigObj.TNN_KEEPALIVE_INTERVAL  !== undefined) {
            console.log("NNT | LOADED TNN_KEEPALIVE_INTERVAL: " + loadedConfigObj.TNN_KEEPALIVE_INTERVAL);
            configuration.keepaliveInterval = loadedConfigObj.TNN_KEEPALIVE_INTERVAL;
          }

          // OVERIDE CONFIG WITH COMMAND LINE ARGS

          commandLineConfigKeys = Object.keys(commandLineConfig);

          commandLineConfigKeys.forEach(function(arg){
            if ((arg === "createTrainingSet") || (arg === "createTrainingSetOnly")) {
              configuration.loadTrainingSetFromFile = false;
              configuration[arg] = commandLineConfig[arg];
              console.log("NNT | --> COMMAND LINE CONFIG | " + arg + ": " + configuration[arg]);
            }
            else if (arg === "hiddenLayerSize") {
              configuration.train.hiddenLayerSize = commandLineConfig[arg];
              console.log("NNT | --> COMMAND LINE CONFIG | train.hiddenLayerSize: " + configuration.train.hiddenLayerSize);
            }
            else if (arg === "seedNetworkId") {
              if (commandLineConfig[arg] === "none") {
                console.log("NNT | --> COMMAND LINE CONFIG | train.networkObj.networkId: NONE");
                console.log("NNT | --> COMMAND LINE CONFIG | evolve.networkObj.networkId: NONE");
                configuration.enableSeedNetwork = false;
              }
              else {
                configuration.enableSeedNetwork = true;
                configuration.train.networkId = commandLineConfig[arg];
                configuration.evolve.networkId = commandLineConfig[arg];
                console.log("NNT | --> COMMAND LINE CONFIG | train.networkObj.networkId: " + configuration.train.networkId);
                console.log("NNT | --> COMMAND LINE CONFIG | evolve.networkObj.networkId: " + configuration.evolve.networkId);
              }
            }
            else if (arg === "evolveIterations") {
              configuration.train.iterations = commandLineConfig[arg];
              configuration.evolve.iterations = commandLineConfig[arg];
              console.log("NNT | --> COMMAND LINE CONFIG | train.iterations: " + configuration.train.iterations);
              console.log("NNT | --> COMMAND LINE CONFIG | evolve.iterations: " + configuration.evolve.iterations);
            }
            else {
              configuration[arg] = commandLineConfig[arg];
              console.log("NNT | --> COMMAND LINE CONFIG | " + arg + ": " + configuration[arg]);
            }
          });

          configArgs = Object.keys(configuration);

          configArgs.forEach(function(arg){
            if (arg === "evolve") {
              console.log("NNT | FINAL CONFIG | " + arg + ": " + jsonPrint(configuration[arg]));
            }
            else {
              console.log("NNT | FINAL CONFIG | " + arg + ": " + configuration[arg]);
            }
          });

          if (configuration.enableStdin){

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
                case "n":
                  configuration.interruptFlag = true;
                  console.log(chalkRedBold("NNT | *** INTERRUPT ***"));
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

          callback(null, true);

        }
        else {

          console.error(chalkError("NNT | ERROR LOAD DROPBOX CONFIG: " + dropboxConfigFile
            + "\n" + jsonPrint(err)
          ));

          if (err.status === 404){
            // OVERIDE CONFIG WITH COMMAND LINE ARGS

            commandLineConfigKeys = Object.keys(commandLineConfig);

            commandLineConfigKeys.forEach(function(arg){
              if ((arg === "createTrainingSet") || (arg === "createTrainingSetOnly")) {
                configuration.loadTrainingSetFromFile = false;
                configuration[arg] = commandLineConfig[arg];
                console.log("NNT | --> COMMAND LINE CONFIG | " + arg + ": " + configuration[arg]);
              }
              else if (arg === "hiddenLayerSize") {
                configuration.train.hiddenLayerSize = commandLineConfig[arg];
                console.log("NNT | --> COMMAND LINE CONFIG | train.hiddenLayerSize: " + configuration.train.hiddenLayerSize);
              }
              else if (arg === "seedNetworkId") {
                configuration.train.networkId = commandLineConfig[arg];
                configuration.evolve.networkId = commandLineConfig[arg];
                console.log("NNT | --> COMMAND LINE CONFIG | train.networkObj.networkId: " + configuration.train.networkId);
                console.log("NNT | --> COMMAND LINE CONFIG | evolve.networkObj.networkId: " + configuration.evolve.networkId);
              }
              else if (arg === "evolveIterations") {
                configuration.train.iterations = commandLineConfig[arg];
                configuration.evolve.iterations = commandLineConfig[arg];
                console.log("NNT | --> COMMAND LINE CONFIG | train.iterations: " + configuration.train.iterations);
                console.log("NNT | --> COMMAND LINE CONFIG | evolve.iterations: " + configuration.evolve.iterations);
              }
              else {
                configuration[arg] = commandLineConfig[arg];
                console.log("NNT | --> COMMAND LINE CONFIG | " + arg + ": " + configuration[arg]);
              }
            });

            configArgs = Object.keys(configuration);

            configArgs.forEach(function(arg){
              console.log("NNT | _FINAL CONFIG | " + arg + ": " + configuration[arg]);
            });

            if (configuration.enableStdin){

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

            callback(null, false);

          }
          else {
            callback(err, false);
          }
        }

      });

    }

  });

}

function loadNeuralNetwork(options, callback){

  console.log(chalkLog("NNT | loadNeuralNetwork\nNNT | " + jsonPrint(options)));

  const file = options.networkId + ".json";
  const folder = options.folder ;

  loadFile(folder, file, function(err, nn){
    if (err) {
      console.log(chalkError("NNT | *** DROPBOX LOAD NEURAL NETWORK ERR"
        + " | " + folder + "/" + file
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
        cb();

      }, function(){

        statsObj.seedNetworkId = nn.networkId;
        statsObj.networkObj = {};
        statsObj.networkObj.networkId = nn.networkId;
        statsObj.networkObj.networkType = nn.networkType;
        statsObj.networkObj.successRate = nn.successRate;
        statsObj.networkObj.input = nn.network.input;
        statsObj.networkObj.output = nn.network.output;
        statsObj.networkObj.evolve = {};
        statsObj.networkObj.evolve = nn.evolve;

        callback(null, nn);
      });
    }
  });
}

function loadSeedNeuralNetwork(options, callback){

  console.log(chalkNetwork("NNT | ... LOADING SEED NETWORK FROM DB\nOPTIONS: " + jsonPrint(options)));

  let findQuery = {};

  if ((options.networkId !== undefined) && (options.networkId !== "false")) {

    if (options.networkId === "BEST") {
      console.log(chalkAlert("NNT | ... LOADING " + DEFAULT_BEST_NETWORK_NUMBER + " BEST NETWORKS"));
    }
    else {
      // findOneNetwork = true;
      findQuery.networkId = options.networkId;
      console.log(chalkAlert("NNT | ... LOADING SEED NETWORK " + options.folder + "/" + options.networkId));
    }

  }

  loadBestNetworkDropboxFolders(options.folders, function loadBestCallback (err, numNetworksLoaded){

    if (err) {
      console.log(chalkError("NNT | LOAD DROPBOX BEST NETWORK ERR"
        + " | FOLDERS: " + options.folders
        + "\nNNB | " + err
      ));
      quit("LOAD DROPBOX BEST NETWORK ERR");
      if (callback !== undefined) { callback(err, null); }
    }
    else if (numNetworksLoaded === 0){
      console.log(chalkAlert("NNT | *** NO BEST NETWORKS LOADED"));
      if (callback !== undefined) { callback(err, null); }
    }
    else {

      if (callback !== undefined) { 
        callback(null, null);
      }

    }

  });
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
  cnf.initMainIntervalTime = process.env.TNN_INIT_MAIN_INTERVAL || DEFAULT_INIT_MAIN_INTERVAL ;
  cnf.inputsId = process.env.TNN_INPUTS_ID || false ;
  cnf.inputsIdArray = process.env.TNN_INPUTS_IDS || [] ;
  cnf.seedNetworkProbability = process.env.TNN_SEED_NETWORK_PROBABILITY || DEFAULT_SEED_NETWORK_PROBABILITY ;

  cnf.histogramParseTotalMin = process.env.TNN_HISTOGRAM_PARSE_TOTAL_MIN || DEFAULT_HISTOGRAM_PARSE_TOTAL_MIN ;

  cnf.crossEntropyWorkAroundEnabled = false ;

  if (process.env.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED !== undefined) {
    console.log("NNT | ENV TNN_CROSS_ENTROPY_WORKAROUND_ENABLED: " + process.env.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED);
    if (!process.env.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED || (process.env.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED === "false")) {
      cnf.crossEntropyWorkAroundEnabled = false ;
    }
    else {
      cnf.crossEntropyWorkAroundEnabled = true ;
    }
  }

  console.log(chalkAlert("NNT | crossEntropyWorkAroundEnabled: " + cnf.crossEntropyWorkAroundEnabled));

  if (process.env.TNN_CREATE_TRAINING_SET !== undefined) {
    if (process.env.TNN_CREATE_TRAINING_SET === "true") {
      cnf.createTrainingSet = true ;
    }
    else {
      cnf.createTrainingSet = false ;
    }
  }

  if (process.env.TNN_CREATE_TRAINING_SET_ONLY !== undefined) {
    if (process.env.TNN_CREATE_TRAINING_SET_ONLY === "true") {
      cnf.createTrainingSetOnly = true ;
      cnf.createTrainingSet = true ;
    }
    else {
      cnf.createTrainingSetOnly = false ;
    }
  }

  if (process.env.TNN_LOAD_TRAINING_SET_FROM_FILE !== undefined) {
    console.log("NNT | ENV TNN_LOAD_TRAINING_SET_FROM_FILE: " + process.env.TNN_LOAD_TRAINING_SET_FROM_FILE);
    if (!process.env.TNN_LOAD_TRAINING_SET_FROM_FILE || (process.env.TNN_LOAD_TRAINING_SET_FROM_FILE === "false")) {
      cnf.loadTrainingSetFromFile = false ;
    }
    else if (!cnf.createTrainingSet && !cnf.createTrainingSetOnly) {
      cnf.loadTrainingSetFromFile = true ;
    }
  }

  if (process.env.TNN_USE_LOCAL_TRAINING_SETS !== undefined) {
    console.log("NNT | ENV TNN_USE_LOCAL_TRAINING_SETS: " + process.env.TNN_USE_LOCAL_TRAINING_SETS);
    if (!process.env.TNN_USE_LOCAL_TRAINING_SETS || (process.env.TNN_USE_LOCAL_TRAINING_SETS === "false")) {
      cnf.useLocalTrainingSets = false ;
    }
    else {
      cnf.useLocalTrainingSets = true ;
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
  cnf.evolve.growth = process.env.TNN_EVOLVE_GROWTH || DEFAULT_EVOLVE_GROWTH ;
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
  cnf.train.iterations = process.env.TNN_TRAIN_ITERATIONS || DEFAULT_ITERATIONS ;
  cnf.train.clear = process.env.TNN_TRAIN_CLEAR || DEFAULT_TRAIN_CLEAR ;
  cnf.train.momentum = process.env.TNN_TRAIN_MOMENTUM || DEFAULT_TRAIN_MOMENTUM ;
  cnf.train.ratePolicy = process.env.TNN_TRAIN_RATE_POLICY || DEFAULT_TRAIN_RATE_POLICY ;
  cnf.train.batchSize = process.env.TNN_TRAIN_BATCH_SIZE || DEFAULT_TRAIN_BATCH_SIZE ;

  cnf.classifiedUsersFile = process.env.TNN_CLASSIFIED_USERS_FILE || classifiedUsersFile;
  cnf.classifiedUsersFolder = classifiedUsersFolder;
  cnf.statsUpdateIntervalTime = process.env.TNN_STATS_UPDATE_INTERVAL || 300000;

  debug(chalkWarn("dropboxConfigFolder: " + dropboxConfigFolder));
  debug(chalkWarn("dropboxConfigFile  : " + dropboxConfigFile));

  if (process.env.TNN_BATCH_MODE) {

    console.log(chalkAlert("\n\nNNT | BATCH MODE\n\n"));

    initStatsUpdate(cnf, function(err, cnf2){
      if (err) {
        console.log(chalkError("NNT | ERROR initStatsUpdate\n" + jsonPrint(err)));
      }
      debug("initStatsUpdate cnf2\n" + jsonPrint(cnf2));

      loadHistogramsDropboxFolder(defaultHistogramsFolder, function(err){
        loadInputsDropboxFolder(defaultInputsFolder, function(err){
          return(callback(err, cnf2));
        });
      });


    });
  }
  else{

    loadFile(dropboxConfigHostFolder, dropboxConfigFile, function(err, loadedConfigObj){

      let commandLineConfigKeys;
      let configArgs;

      if (!err) {
        console.log("NNT | " + dropboxConfigFile + "\n" + jsonPrint(loadedConfigObj));

        prevConfigFileModifiedMoment = moment();

        if (loadedConfigObj.TNN_HISTOGRAM_PARSE_TOTAL_MIN !== undefined){
          console.log("NNT | LOADED TNN_HISTOGRAM_PARSE_TOTAL_MIN: " + loadedConfigObj.TNN_HISTOGRAM_PARSE_TOTAL_MIN);
          cnf.histogramParseTotalMin = loadedConfigObj.TNN_HISTOGRAM_PARSE_TOTAL_MIN;
        }

        if (loadedConfigObj.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED  !== undefined){
          console.log("NNT | TNN_CROSS_ENTROPY_WORKAROUND_ENABLED: " + loadedConfigObj.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED);

          if (!loadedConfigObj.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED || (loadedConfigObj.TNN_CROSS_ENTROPY_WORKAROUND_ENABLED === "false")) {
            cnf.crossEntropyWorkAroundEnabled = false;
          }
          else {
            cnf.crossEntropyWorkAroundEnabled = true;
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

        if (loadedConfigObj.TNN_CREATE_TRAINING_SET_ONLY  !== undefined){
          console.log("NNT | CREATE TRAINING SET ONLY");

          if (!loadedConfigObj.TNN_CREATE_TRAINING_SET_ONLY || (loadedConfigObj.TNN_CREATE_TRAINING_SET_ONLY === "false")) {
            cnf.createTrainingSetOnly = false;
          }
          else {
            cnf.createTrainingSet = true;
            cnf.createTrainingSetOnly = true;
          }
        }

        if (loadedConfigObj.TNN_LOAD_TRAINING_SET_FROM_FILE  !== undefined){
          console.log("NNT | LOADED TNN_LOAD_TRAINING_SET_FROM_FILE: " + loadedConfigObj.TNN_LOAD_TRAINING_SET_FROM_FILE);

          if (!loadedConfigObj.TNN_LOAD_TRAINING_SET_FROM_FILE || (loadedConfigObj.TNN_LOAD_TRAINING_SET_FROM_FILE === "false")) {
            cnf.loadTrainingSetFromFile = false;
          }
          else if (!cnf.createTrainingSet && !cnf.createTrainingSetOnly) {
            cnf.loadTrainingSetFromFile = true;
          }
        }

        if (loadedConfigObj.TNN_USE_LOCAL_TRAINING_SETS  !== undefined){
          console.log("NNT | LOADED TNN_USE_LOCAL_TRAINING_SETS: " + loadedConfigObj.TNN_USE_LOCAL_TRAINING_SETS);

          if (!loadedConfigObj.TNN_USE_LOCAL_TRAINING_SETS || (loadedConfigObj.TNN_USE_LOCAL_TRAINING_SETS === "false")) {
            cnf.useLocalTrainingSets = false;
          }
          else {
            cnf.useLocalTrainingSets = true;
          }
        }

        if (loadedConfigObj.TNN_INPUTS_IDS !== undefined){
          console.log("NNT | LOADED TNN_INPUTS_IDS: " + loadedConfigObj.TNN_INPUTS_IDS);
          cnf.inputsIdArray = loadedConfigObj.TNN_INPUTS_IDS;
        }

        if (loadedConfigObj.TNN_INPUTS_ID !== undefined){
          console.log("NNT | LOADED TNN_INPUTS_ID: " + loadedConfigObj.TNN_INPUTS_ID);
          cnf.inputsId = loadedConfigObj.TNN_INPUTS_ID;
        }

        if (loadedConfigObj.TNN_SEED_NETWORK_PROBABILITY !== undefined){
          console.log("NNT | LOADED TNN_SEED_NETWORK_PROBABILITY: " + loadedConfigObj.TNN_SEED_NETWORK_PROBABILITY);
          cnf.seedNetworkProbability = loadedConfigObj.TNN_SEED_NETWORK_PROBABILITY;
        }

        if (loadedConfigObj.TNN_INIT_MAIN_INTERVAL !== undefined){
          console.log("NNT | LOADED TNN_INIT_MAIN_INTERVAL: " + loadedConfigObj.TNN_INIT_MAIN_INTERVAL);
          cnf.initMainIntervalTime = loadedConfigObj.TNN_INIT_MAIN_INTERVAL;
        }

        if (loadedConfigObj.TNN_MAX_NEURAL_NETWORK_CHILDREN !== undefined){
          console.log("NNT | LOADED TNN_MAX_NEURAL_NETWORK_CHILDREN: " + loadedConfigObj.TNN_MAX_NEURAL_NETWORK_CHILDREN);
          cnf.maxNeuralNetworkChildern = loadedConfigObj.TNN_MAX_NEURAL_NETWORK_CHILDREN;
        }

        if (loadedConfigObj.TNN_GLOBAL_MIN_SUCCESS_RATE !== undefined){
          console.log("NNT | LOADED TNN_GLOBAL_MIN_SUCCESS_RATE: " + loadedConfigObj.TNN_GLOBAL_MIN_SUCCESS_RATE);
          cnf.globalMinSuccessRate = loadedConfigObj.TNN_GLOBAL_MIN_SUCCESS_RATE;
        }

        if (loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE !== undefined){
          console.log("NNT | LOADED TNN_LOCAL_MIN_SUCCESS_RATE: " + loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE);
          cnf.localMinSuccessRate = loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE;
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

        if (loadedConfigObj.TNN_EVOLVE_ITERATIONS  !== undefined){
          console.log("NNT | LOADED TNN_EVOLVE_ITERATIONS: " + loadedConfigObj.TNN_EVOLVE_ITERATIONS);
          cnf.evolve.iterations = loadedConfigObj.TNN_EVOLVE_ITERATIONS;
        }

        if (loadedConfigObj.TNN_TRAIN_ITERATIONS  !== undefined){
          console.log("NNT | LOADED TNN_TRAIN_ITERATIONS: " + loadedConfigObj.TNN_TRAIN_ITERATIONS);
          cnf.train.iterations = loadedConfigObj.TNN_TRAIN_ITERATIONS;
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
          if ((arg === "createTrainingSet") || (arg === "createTrainingSetOnly")) {
            cnf.loadTrainingSetFromFile = false;
            cnf[arg] = commandLineConfig[arg];
            console.log("NNT | --> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
          }
          else if (arg === "hiddenLayerSize") {
            cnf.train.hiddenLayerSize = commandLineConfig[arg];
            console.log("NNT | --> COMMAND LINE CONFIG | train.hiddenLayerSize: " + cnf.train.hiddenLayerSize);
          }
          else if (arg === "seedNetworkId") {
            if (commandLineConfig[arg] === "none") {
              console.log("NNT | --> COMMAND LINE CONFIG | train.networkObj.networkId: NONE");
              console.log("NNT | --> COMMAND LINE CONFIG | evolve.networkObj.networkId: NONE");
              cnf.enableSeedNetwork = false;
            }
            else {
              cnf.enableSeedNetwork = true;
              cnf.train.networkId = commandLineConfig[arg];
              cnf.evolve.networkId = commandLineConfig[arg];
              console.log("NNT | --> COMMAND LINE CONFIG | train.networkObj.networkId: " + cnf.train.networkId);
              console.log("NNT | --> COMMAND LINE CONFIG | evolve.networkObj.networkId: " + cnf.evolve.networkId);
            }
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

              case "v":
                configuration.verbose = !configuration.verbose;
                console.log(chalkRedBold("NNT | VERBOSE: " + configuration.verbose));
              break;
              case "n":
                configuration.interruptFlag = true;
                console.log(chalkRedBold("NNT | *** INTERRUPT ***"));
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

          loadHistogramsDropboxFolder(defaultHistogramsFolder, function(err){
            loadInputsDropboxFolder(defaultInputsFolder, function(err){
              return(callback(err, cnf2));
            });
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
            if ((arg === "createTrainingSet") || (arg === "createTrainingSetOnly")) {
              cnf.loadTrainingSetFromFile = false;
              cnf[arg] = commandLineConfig[arg];
              console.log("NNT | --> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
            }
            else if (arg === "hiddenLayerSize") {
              cnf.train.hiddenLayerSize = commandLineConfig[arg];
              console.log("NNT | --> COMMAND LINE CONFIG | train.hiddenLayerSize: " + cnf.train.hiddenLayerSize);
            }
            else if (arg === "seedNetworkId") {
              cnf.train.networkId = commandLineConfig[arg];
              cnf.evolve.networkId = commandLineConfig[arg];
              console.log("NNT | --> COMMAND LINE CONFIG | train.networkObj.networkId: " + cnf.train.networkId);
              console.log("NNT | --> COMMAND LINE CONFIG | evolve.networkObj.networkId: " + cnf.evolve.networkId);
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

            loadHistogramsDropboxFolder(defaultHistogramsFolder, function(err){
              loadInputsDropboxFolder(defaultInputsFolder, function(err){
                return(callback(err, cnf2));
              });
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

  console.log(chalkAlert("INIT_MONGODB"));
});

function printHistogram(title, hist){
  let tableArray = [];

  const sortedLabels = Object.keys(hist).sort(function(a,b){
    return hist[b] - hist[a];
  });

  async.eachSeries(sortedLabels, function(label, cb){
    if (inputArrays.images.includes(label)){
      tableArray.push(["HIT", hist[label], label]);
      cb();
    }
    else {
      tableArray.push(["---", hist[label], label]);
      cb();
    }
  }, function(){
    console.log(
        "--------------------------------------------------------------"
      + "\n" + title + " | " + sortedLabels.length + " IMAGE ENTRIES"  
      + "\n--------------------------------------------------------------\n"
      + table(tableArray, { align: [ "r", "l", "l"] })
      + "\n--------------------------------------------------------------"
    );
  });
}

// FUTURE: break up into updateClassifiedUsers and createTrainingSet
function updateClassifiedUsers(cnf, callback){

  let classifiedUserIds = Object.keys(classifiedUserHashmap);

  if (cnf.testMode) {
    classifiedUserIds.length = TEST_MODE_LENGTH;
  }

  let maxMagnitude = -Infinity;
  let minScore = 1;
  let maxScore = -1;

  console.log(chalkBlue("NNT | UPDATE CLASSIFIED USERS: " + classifiedUserIds.length));

  // statsObj.normalization.score.min = -1.0;
  // statsObj.normalization.score.max = 1.0;
  // statsObj.normalization.magnitude.min = 0;
  // statsObj.normalization.magnitude.max = -Infinity;

  if (cnf.normalization) {
    maxMagnitude = cnf.normalization.magnitude.max;
    minScore = cnf.normalization.score.min;
    maxScore = cnf.normalization.score.max;
    console.log(chalkAlert("NNT | SET NORMALIZATION\n" + jsonPrint(cnf.normalization)));
  }

  statsObj.users.updatedClassified = 0;
  statsObj.users.notClassified = 0;

  let userIndex = 0;
  let classifiedUsersPercent = 0;
  let classifiedUsersStartMoment = moment();
  let classifiedUsersEndMoment = moment();
  let classifiedUsersElapsed = 0;
  let classifiedUsersRemain = 0;
  let classifiedUsersRate = 0;

  async.eachSeries(classifiedUserIds, function(userId, cb0){

    // User.findOne({userId: userId.toString()}, function(err, user){
    User.findOne( { "$or":[ {userId: userId.toString()}, {screenName: userId.toLowerCase()} ]}, function(err, user){

      userIndex += 1;

      if (err){
        console.error(chalkError("NNT | *** UPDATE CLASSIFIED USERS: USER FIND ONE ERROR: " + err));
        statsObj.errors.users.findOne += 1;
        return(cb0(err));
      }

      if (!user){
        console.log(chalkAlert("NNT | *** UPDATE CLASSIFIED USERS: USER NOT FOUND: UID: " + userId));
        statsObj.users.notFound += 1;
        statsObj.users.notClassified += 1;
        return(cb0());
      }

      if (user.screenName === undefined) {
        console.log(chalkError("NNT | *** UPDATE CLASSIFIED USERS: USER SCREENNAME UNDEFINED\n" + jsonPrint(user)));
        statsObj.users.screenNameUndefined += 1;
        statsObj.users.notClassified += 1;
        return(cb0("USER SCREENNAME UNDEFINED", null));
      }

      debug(chalkInfo("NNT | UPDATE CL USR <DB"
        + " [" + userIndex + "/" + classifiedUserIds.length + "]"
        + " | " + user.userId
        + " | @" + user.screenName
      ));

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
          minScore = Math.min(minScore, sentimentObj.score);
          maxScore = Math.max(maxScore, sentimentObj.score);
        }
      }

      sentimentText = "M: " + sentimentObj.magnitude.toFixed(2) + " S: " + sentimentObj.score.toFixed(2);

      const keywordArray = Object.keys(user.keywords);

      const classification = (keywordArray[0] !== undefined) ? keywordArray[0] : false;
      const threeceeFollowing = (user.threeceeFollowing) ? user.threeceeFollowing.screenName : "-";

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

        classifiedUsersPercent = 100 * (statsObj.users.notClassified + statsObj.users.updatedClassified)/classifiedUserIds.length;
        classifiedUsersElapsed = (moment().valueOf() - classifiedUsersStartMoment.valueOf()); // mseconds
        classifiedUsersRate = classifiedUsersElapsed/statsObj.users.updatedClassified; // msecs/userClassified
        classifiedUsersRemain = (classifiedUserIds.length - (statsObj.users.notClassified + statsObj.users.updatedClassified)) * classifiedUsersRate; // mseconds
        classifiedUsersEndMoment = moment();
        classifiedUsersEndMoment.add(classifiedUsersRemain, "ms");

        if ((statsObj.users.notClassified + statsObj.users.updatedClassified) % 20 === 0){
          console.log(chalkInfo("NNT"
            + " | START: " + classifiedUsersStartMoment.format(compactDateTimeFormat)
            + " | ELAPSED: " + msToTime(classifiedUsersElapsed)
            + " | REMAIN: " + msToTime(classifiedUsersRemain)
            + " | ETC: " + classifiedUsersEndMoment.format(compactDateTimeFormat)
            + " | " + (statsObj.users.notClassified + statsObj.users.updatedClassified) + "/" + classifiedUserIds.length
            + " (" + classifiedUsersPercent.toFixed(1) + "%)"
            + " USERS CLASSIFIED"
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
          },
          function userBannerImage(text, cb) {
            if (user.bannerImageUrl 
              && (!user.bannerImageAnalyzed 
                || (user.bannerImageAnalyzed !== user.bannerImageUrl)
                || cnf.forceBannerImageAnalysis
              )) 
            {

              twitterImageParser.parseImage(user.bannerImageUrl, { screenName: user.screenName, keywords: user.keywords, updateGlobalHistograms: true}, function(err, results){
                if (err) {
                  console.log(chalkError("*** PARSE BANNER IMAGE ERROR"
                    + " | REQ: " + results.text
                    + " | ERR: " + err.code + " | " + err.note
                  ));

                  if (statsObj.errors.imageParse[err.code] === undefined) {
                    statsObj.errors.imageParse[err.code] = 1;
                  }
                  else {
                    statsObj.errors.imageParse[err.code] += 1;
                  }
                  cb(null, text, null);
                }
                else {
                  statsObj.users.imageParse.parsed += 1;
                  user.bannerImageAnalyzed = user.bannerImageUrl;
                  debug(chalkAlert("PARSE BANNER IMAGE"
                    + " | RESULTS\n" + jsonPrint(results)
                  ));
                  if (results.text !== undefined) {
                    debug(chalkInfo("@" + user.screenName + " | " + classText + " | " + results.text));
                    text = text + "\n" + results.text;
                  }
                  cb(null, text, results);
                }
              });
            }
            else if (user.bannerImageUrl && user.bannerImageAnalyzed && (user.bannerImageUrl === user.bannerImageAnalyzed)) {
              statsObj.users.imageParse.skipped += 1;
              const imageHits = (user.histograms.images === undefined) ? 0 : Object.keys(user.histograms.images);
              debug(chalkAlert("BANNER ANALYZED: @" + user.screenName + " | HITS: " + imageHits));
              // async.setImmediate(function() {
                cb(null, text, null);
              // });
            }
            else {
              // async.setImmediate(function() {
                cb(null, text, null);
              // });
            }
          }
        ], function (err, text, bannerResults) {

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

            if (bannerResults && bannerResults.label && bannerResults.label.images) {
              hist.images = bannerResults.label.images;
            }

            debug(chalkInfo("hist\n" + jsonPrint(hist)));
            // update user histogram in db

            userServer.updateHistograms({user: user, histograms: hist}, function(err, updatedUser){

              if (err) {
                console.error("*** UPDATE USER HISTOGRAMS ERROR\n" + err);
                return(cb0(err));
              }


              const subUser = pick(updatedUser, ["userId", "screenName", "name", "languageAnalysis", "keywords", "keywordsAuto", "histograms"]);

              trainingSetUsersHashMap.set(subUser.userId, subUser);

              debug("CL USR >DB"
                + " | " + subUser.userId
                + " | @" + subUser.screenName
                + " | KW: " + Object.keys(subUser.keywords)[0]
              );

              cb0();

            });

          });

        });   
      }
      else {

        statsObj.users.notClassified += 1;

        if (statsObj.users.notClassified % 10 === 0){
          console.log(chalkLog("NNT | " + statsObj.users.notClassified + " USERS NOT CLASSIFIED"));
        }

        console.log(chalkBlue("NNT *** USR DB NOT CL"
          + " | KW: " + keywordArray
          // + " | CL: " + classification
          + " | CLHashMap: " + Object.keys(classifiedUserHashmap[userId])
          + " | " + user.userId
          + " | " + user.screenName
          + " | " + user.name
          + " | 3CF: " + threeceeFollowing
          + " | FLs: " + user.followersCount
          + " | FRs: " + user.friendsCount
          + " | SEN: " + sentimentText
        ));

        classifiedUsersPercent = 100 * (statsObj.users.notClassified + statsObj.users.updatedClassified)/classifiedUserIds.length;
        classifiedUsersElapsed = (moment().valueOf() - classifiedUsersStartMoment.valueOf()); // mseconds
        classifiedUsersRate = classifiedUsersElapsed/statsObj.users.updatedClassified; // msecs/userClassified
        classifiedUsersRemain = (classifiedUserIds.length - (statsObj.users.notClassified + statsObj.users.updatedClassified)) * classifiedUsersRate; // mseconds
        classifiedUsersEndMoment = moment();
        classifiedUsersEndMoment.add(classifiedUsersRemain, "ms");

        if ((statsObj.users.notClassified + statsObj.users.updatedClassified) % 20 === 0){
          console.log(chalkInfo("NNT"
            + " | START: " + classifiedUsersStartMoment.format(compactDateTimeFormat)
            + " | ELAPSED: " + msToTime(classifiedUsersElapsed)
            + " | REMAIN: " + msToTime(classifiedUsersRemain)
            + " | ETC: " + classifiedUsersEndMoment.format(compactDateTimeFormat)
            + " | " + (statsObj.users.notClassified + statsObj.users.updatedClassified) + "/" + classifiedUserIds.length
            + " (" + classifiedUsersPercent.toFixed(1) + "%)"
            + " USERS CLASSIFIED"
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
      if (err === "INTERRUPT") {
        console.log(chalkAlert("NNT | INTERRUPT"));
      }
      else {
        console.log(chalkError("NNT | UPDATE CLASSIFIED USERS ERROR: " + err));
      }
    }

    classifiedUsersPercent = 100 * (statsObj.users.notClassified + statsObj.users.updatedClassified)/classifiedUserIds.length;
    classifiedUsersElapsed = (moment().valueOf() - classifiedUsersStartMoment.valueOf()); // mseconds
    classifiedUsersRate = classifiedUsersElapsed/statsObj.users.updatedClassified; // msecs/userClassified
    classifiedUsersRemain = (classifiedUserIds.length - (statsObj.users.notClassified + statsObj.users.updatedClassified)) * classifiedUsersRate; // mseconds
    classifiedUsersEndMoment = moment();
    classifiedUsersEndMoment.add(classifiedUsersRemain, "ms");

    console.log(chalkAlert("NNT | === END CLASSIFY USERS ==="
      + " | START: " + classifiedUsersStartMoment.format(compactDateTimeFormat)
      + " | ELAPSED: " + msToTime(classifiedUsersElapsed)
      + " | REMAIN: " + msToTime(classifiedUsersRemain)
      + " | ETC: " + classifiedUsersEndMoment.format(compactDateTimeFormat)
      + " | " + (statsObj.users.notClassified + statsObj.users.updatedClassified) + "/" + classifiedUserIds.length
      + " (" + classifiedUsersPercent.toFixed(1) + "%)"
      + " USERS CLASSIFIED"
    ));

    console.log(chalkAlert("NNT | CL U HIST"
      + " | L: " + classifiedUserHistogram.left
      + " | R: " + classifiedUserHistogram.right
      + " | N: " + classifiedUserHistogram.neutral
      + " | +: " + classifiedUserHistogram.positive
      + " | -: " + classifiedUserHistogram.negative
      + " | 0: " + classifiedUserHistogram.none
    ));


    statsObj.normalization.magnitude.max = maxMagnitude;
    statsObj.normalization.score.min = minScore;
    statsObj.normalization.score.max = maxScore;

    console.log(chalkAlert("NNT | CL U HIST | NORMALIZATION"
      + " | MAG " + statsObj.normalization.magnitude.min + " min /" + statsObj.normalization.magnitude.max + " max"
      + " | SCORE " + statsObj.normalization.score.min + " min /" + statsObj.normalization.score.max + " max"
    ));

    showStats();

    callback(null);

  });
}

function activateNetwork(n, input){

  const output = n.activate(input);
  return output;
}

function convertDatum(params, inputs, datum, callback){

  const inputTypes = Object.keys(inputs).sort();

  let convertedDatum = {};
  convertedDatum.user = {};
  convertedDatum.user = datum.user;
  convertedDatum.input = [];
  convertedDatum.output = [];

  switch (datum.classification) {
    case "left":
    convertedDatum.output = [1, 0, 0];
    break;
    case "neutral":
    convertedDatum.output = [0, 1, 0];
    break;
    case "right":
    convertedDatum.output = [0, 0, 1];
    break;
    default:
    convertedDatum.output = [0, 0, 0];
  }

  // convertedDatum.input.push(datum.inputHits.sentiment[0].magnitude);
  // convertedDatum.input.push(datum.inputHits.sentiment[1].score);

  let magnitudeNormalized = 0;
  let scoreNormalized = 0.5;

  if (params.normalization.magnitude.max !== undefined) {
    magnitudeNormalized = datum.inputHits.sentiment[0].magnitude/params.normalization.magnitude.max;
    convertedDatum.input.push(magnitudeNormalized);
    debug("NNC | MAG  "
      + " | MIN:  " + params.normalization.magnitude.min.toFixed(2)
      + " | MAX: " + params.normalization.magnitude.max.toFixed(2)
      + " | ORG: " + datum.inputHits.sentiment[0].magnitude.toFixed(2)
      + " | NORM: " + magnitudeNormalized.toFixed(2)
    );
  }
  else {
    convertedDatum.input.push(datum.inputHits.sentiment[0].magnitude);
  }

  if ((params.normalization.score.min !== undefined) && (params.normalization.score.max !== undefined)) {
    scoreNormalized = (datum.inputHits.sentiment[1].score + Math.abs(params.normalization.score.min))/(Math.abs(params.normalization.score.min) + Math.abs(params.normalization.score.max));
    convertedDatum.input.push(scoreNormalized);
    debug("NNC | SCORE"
      + " | MIN: " + params.normalization.score.min.toFixed(2)
      + " | MAX: " + params.normalization.score.max.toFixed(2)
      + " | ORG: " + datum.inputHits.sentiment[1].score.toFixed(2)
      + " | NORM: " + scoreNormalized.toFixed(2)
    );
  }
  else {
    convertedDatum.input.push(datum.inputHits.sentiment[1].score);
  }


  async.eachSeries(inputTypes, function(inputType, cb0){

    async.eachSeries(inputs[inputType], function(inName, cb1){

      const inputName = inName;

      if (datum.inputHits[inputType].includes(inputName)){
        convertedDatum.input.push(1);
        async.setImmediate(function() {
          cb1();
        });
      }
      else {
        convertedDatum.input.push(0);
        async.setImmediate(function() {
          cb1();
        });
      }
    }, function(){
      // async.setImmediate(function() {
        cb0();
      // });
    });

  }, function(){
    callback(null, convertedDatum);
  });
}

function testNetwork(nwObj, testObj, callback){

  const nw = neataptic.Network.fromJSON(nwObj.network);

  // console.log(chalkBlue("NNT | TEST NETWORK nwObj.inputs\n" + jsonPrint(nwObj.inputs)));
  // console.log(chalkBlue("NNT | TEST NETWORK testObj\n" + jsonPrint(testObj)));

  console.log(chalkBlue("NNT | TEST NETWORK"
    + " | TEST RUN ID: " + testObj.testRunId
    + " | NETWORK ID: " + testObj.testRunId
    + " | " + testObj.testSet.meta.setSize + " TEST DATA POINTS"
  ));

  let numTested = 0;
  let numSkipped = 0; 
  let numPassed = 0;
  let successRate = 0;
  let testResultArray = [];

  let convertDatumParams = {};
  convertDatumParams.normalization = statsObj.normalization;

  async.each(testObj.testSet.data, function(datum, cb){

    convertDatum(convertDatumParams, nwObj.inputs, datum, function(err, testDatumObj){

      if (testDatumObj.input.length !== testObj.testSet.meta.numInputs) {
        console.error(chalkError("NNT | MISMATCH INPUT"
          + " | TEST INPUTS: " + testDatumObj.input.length 
          + " | NETW INPUTS: " + testObj.testSet.meta.numInputs 
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

          debug(currentChalk("TEST RESULT: " + passed 
            + " | " + successRate.toFixed(2) + "%"
            + "\n" + testOutput[0]
            + " " + testOutput[1]
            + " " + testOutput[2]
            + " | TMOI: " + testMaxOutputIndex
            + "\n" + testDatumObj.output[0]
            + " " + testDatumObj.output[1]
            + " " + testDatumObj.output[2]
            + " | EMOI: " + expectedMaxOutputIndex
          ));

          cb();
        });

      });

    });

  }, function(err){

    callback(err, 
      { testRunId: testObj.testRunId, 
        numTests: testObj.testSet.meta.setSize, 
        numSkipped: numSkipped, 
        numPassed: numPassed, 
        successRate: successRate,
        testResultArray: testResultArray
      }
    );

  });
}

function initClassifiedUserHashmap(folder, file, callback){

  console.log(chalkInfo("NNT | INIT CLASSIFIED USERS HASHMAP FROM DB"));

  loadFile(folder, file, function(err, dropboxClassifiedUsersObj){
    if (err) {
      console.error(chalkError("NNT | ERROR: loadFile: " + folder + "/" + file));
      console.log(chalkError("NNT | ERROR: loadFile: " + folder + "/" + file));
      callback(err, file);
    }
    else {
      console.log(chalkInfo("NNT | LOADED CLASSIFIED USERS FILE: " + folder + "/" + file));
      console.log(chalkInfo("NNT | DROPBOX DEFAULT | " + Object.keys(dropboxClassifiedUsersObj).length + " CLASSIFIED USERS"));

      const params = { auto: false };

      userServer.findClassifiedUsersCursor(params, function(err, results){
        if (err) {
          console.error(chalkError("NNT | ERROR: initClassifiedUserHashmap: "));
          callback(err, null);
        }
        else {
          console.log(chalkInfo("NNT | LOADED CLASSIFIED USERS FROM DB"
            + " | " + results.count + " CLASSIFIED"
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

function generateTrainingTestSets (inputsIds, userHashMap, callback){

  const userIds = userHashMap.keys();

  console.log(chalkInfo("NNT | GENERATE TRAINING SET | " + userIds.length + " USERS | " + inputsIds.length + " INPUT GROUPS"));

  async.each(inputsIds, function(inputsId, cb0){ 

    if (!inputsHashMap.has(inputsId)) {
      console.log(chalkError("*** INPUTS ID NOT IN HASH: " + inputsId));
      return cb0("INPUTS ID NOT IN HASH: " + inputsId);
    }

    const inputsObj = inputsHashMap.get(inputsId);
    const inputs = inputsObj.inputs;
    const inputTypes = Object.keys(inputs).sort();

    console.log(chalkInfo("NNT | GENERATE TRAINING SET FOR INPUTS"
      + " | INPUTS ID: " + inputsId
      + " | INPUT TYPES: " + inputTypes
    ));

    inputTypes.forEach(function(inputType){
      console.log(chalkInfo("NNT | "
        + " | INPUT TYPE: " + inputType
        + " | LEN: " + inputs[inputType].length
      ));
    });

    let maxMagnitude = 0;
    let maxScore = 0;
    let minScore = 0;

    let trainingSet = {};
    trainingSet.meta = {};
    trainingSet.data = [];

    let testSet = {};
    testSet.meta = {};
    testSet.data = [];

    async.each(userIds, function(userId, cb1){ 

      let globalInputIndex = 2;
      let totalInputHits = 0;
      let numInputHits = 0;

      const user = userHashMap.get(userId);
      const userHistograms = user.histograms;

      let sentimentObj = {};
      sentimentObj.magnitude = 0;
      sentimentObj.score = 0;

      if ((user.languageAnalysis !== undefined)
        && (user.languageAnalysis.sentiment !== undefined)) {

        sentimentObj.magnitude = user.languageAnalysis.sentiment.magnitude || 0;
        sentimentObj.score = user.languageAnalysis.sentiment.score || 0;

        if (!configuration.normalization) {
          maxMagnitude = Math.max(maxMagnitude, sentimentObj.magnitude);
        }
      }

      let typeIndexOffset = 2;  // to allow for paralles trainingSetDatum creation

      let trainingSetDatum = {};
      trainingSetDatum.user = {};
      trainingSetDatum.user.screenName = user.screenName;
      trainingSetDatum.inputHits = {};

      trainingSetDatum.inputHits.sentiment = [];

      trainingSetDatum.inputHits.sentiment.push({ magnitude: sentimentObj.magnitude});
      trainingSetDatum.inputHits.sentiment.push({ score: sentimentObj.score});


      async.eachSeries(inputTypes, function(type, cb2){  // inputTypes = [ emoji, screenName, hashtag, images, word, url ]

        trainingSetDatum.inputHits[type] = [];

        async.eachOfSeries(inputs[type], function(element, index, cb3){

          const trainingSetDatumInputIndex = typeIndexOffset + index;

          if ((userHistograms[type] !== undefined) && userHistograms[type][element]) { // cb3

            numInputHits +=1;

            trainingSetDatum.inputHits[type].push(element);

            debug(chalkBlue("+ DATUM BIT: " + type
              + " | typeIndexOffset: " + typeIndexOffset
              + " | INPUT HITS: " + numInputHits 
              + " | ["  + trainingSetDatumInputIndex + " / " + index + "] " + element + ": " + userHistograms[type][element]
              + " | @" + trainingSetDatum.user.screenName 
            ));

            if ((globalInputIndex % 100 === 0) && (index % 10 === 0)){
              debug(chalkBlue("+ DATUM BIT: " + type
                + " | INPUT HITS: " + numInputHits 
                + " | ["  + trainingSetDatumInputIndex + " / " + index + "] " + element + ": " + userHistograms[type][element]
                + " | @" + trainingSetDatum.user.screenName 
              ));
            }

            globalInputIndex += 1;

            // async.setImmediate(function() {
              cb3();
            // });
          }
          else { // cb3

            debug(chalkInfo("- DATUM BIT: " + type
              + " | INPUT HITS: " + numInputHits 
              + " | ["  + globalInputIndex + " / " + index + "] " + element
              + " | @" + trainingSetDatum.user.screenName 
            ));

            globalInputIndex += 1;

            // async.setImmediate(function() {
              cb3();
            // });
          }
        }, function(err){ // cb2  async.eachOfSeries(inputs[type]

          if (err) { // cb2
            console.error("*** PARSE TEXT ERROR\n" + err);
            return cb2(err);
          }

          typeIndexOffset += inputs[type].length; 

          debug(chalkAlert(
            "typeIndexOffset: " + typeIndexOffset
            + " | type: " + type
            + " | inputs[type].length: " + inputs[type].length
          ));


          // console.log(chalkAlert("DONE ARRAY: " + type));
          // async.setImmediate(function() {
            cb2();
          // });
        });
      }, function(err){  // cb1 async.eachSeries(inputTypes...)

        if (err) {
          console.error("*** PARSE TEXT ERROR\n" + err);
          return cb1(err);
        }

        let chk = chalkInfo;

        if (numInputHits < MIN_INPUT_HITS) { chk = chalkAlert; }

        const userInputHitAverage = 100 * numInputHits / globalInputIndex;

        debug(chk("=+= PARSE USER TEXT COMPLETE"
          + " | INPUT HITS: " + numInputHits + "/" + globalInputIndex
          + " - " + userInputHitAverage.toFixed(2)
          + " | @" + trainingSetDatum.user.screenName
        ));

        // IF NOT INPUT HITS, don't user for training
        
        if (numInputHits < MIN_INPUT_HITS) { 
          // async.setImmediate(function() { 
            return cb1(); 
          // });
        }

        totalInputHits += numInputHits;

        const keywordArray = Object.keys(user.keywords);

        trainingSetDatum.classification = (keywordArray[0] !== undefined) ? keywordArray[0] : false;

        if (Math.random() > configuration.testSetRatio) {
          trainingSet.data.push(trainingSetDatum);
          trainingSet.meta.numInputs = globalInputIndex;
          // async.setImmediate(function() { 
            cb1(); 
          // });
        }
        else {
          testSet.data.push(trainingSetDatum);
          testSet.meta.numInputs = globalInputIndex;
          // async.setImmediate(function() { 
            cb1(); 
          // });
        }
      });
    }, function(err) {  // cb0 

      if (err) {
        console.log(chalkError("GENERATE TRAINING SET ERROR\n" + jsonPrint(err)));
        return cb0(err);
      }

      const trainingSetId = inputsId;

      trainingSet.meta.numOutputs = 3;
      trainingSet.meta.setSize = trainingSet.data.length;

      testSet.meta.numOutputs = 3;
      testSet.meta.setSize = testSet.data.length;

      console.log(chalkInfo("NNT | END GENERATE TRAINING SET"
        + "\nNNT | TRAINING SET ID: " + trainingSetId
        + " | NUM INPUTS: " + trainingSet.meta.numInputs
        + " | NUM OUTPUTS: " + trainingSet.meta.numOutputs
        + " | SIZE: " + trainingSet.meta.setSize
        + "\nNNT | TEST SET"
        + " | NUM INPUTS: " + testSet.meta.numInputs
        + " | NUM OUTPUTS: " + testSet.meta.numOutputs
        + " | SIZE: " + testSet.meta.setSize
        // + "\n trainingSet.meta\n" + jsonPrint(trainingSet.meta) 
        // + "\n testSet.meta\n" + jsonPrint(testSet.meta)
      ));

      const trainingSetObj = {trainingSetId: trainingSetId, trainingSet: trainingSet, testSet: testSet};

      trainingSetHashMap.set(trainingSetId, trainingSetObj);

      const file = "trainingSet_" + trainingSetId + ".json";
      let folder = (hostname === "google") ? defaultTrainingSetFolder : localTrainingSetFolder;
      // let folder = localTrainingSetFolder;

      saveFileQueue.push({folder: folder, file: file, obj: trainingSetObj});

      setTimeout(function(){
        cb0();
      }, 2000);
    });

  }, function(err){

    console.log(chalkAlert("NNT | END GENERATE ALL TRAINING SETS"));
    callback(err);

  });
}

function generateRandomEvolveConfig (cnf, callback){

  let config = {};

  config.networkCreateMode = "evolve";
  config.seedNetworkId = false;

  console.log(chalkLog("NNT | NETWORK CREATE MODE: " + config.networkCreateMode));
    
  console.log(chalkLog("\nNNT | BEST NETWORKS\nNNB | --------------------------------------------------------"));

  bestNetworkHashMap.forEach(function(entry, nnId){
    console.log(chalkLog("NNT | " + entry.networkObj.successRate.toFixed(2) + " | " + nnId));
  });

  console.log(chalkLog("NNT | --------------------------------------------------------"));

  if (cnf.inputsId) {
    console.log(chalkAlert("LOADING INPUTS USING INPUTS ID ARRAY: " + jsonPrint(cnf.inputsIdArray)));
    config.seedInputsId = cnf.inputsId;
    if (inputsNetworksHashMap[cnf.inputsId] !== undefined){
      if (inputsNetworksHashMap[cnf.inputsId].size > 0) {
        config.seedNetworkId = (Math.random() < cnf.seedNetworkProbability) ? randomItem([...inputsNetworksHashMap[cnf.inputsId]]) : false;
      }
    }
  }
  else if (cnf.inputsIdArray.length > 0) {
    console.log(chalkAlert("LOADING INPUTS USING INPUTS ID ARRAY: " + jsonPrint(cnf.inputsIdArray)));
    config.seedInputsId = randomItem(cnf.inputsIdArray);
    if (inputsNetworksHashMap[config.seedInputsId] !== undefined){
      if (inputsNetworksHashMap[config.seedInputsId].size > 0) {
        config.seedNetworkId = (Math.random() < cnf.seedNetworkProbability) ? randomItem([...inputsNetworksHashMap[config.seedInputsId]]) : false;
      }
    }
  }
  else {
    config.seedInputsId = randomItem(inputsHashMap.keys());
    config.seedNetworkId = (Math.random() < cnf.seedNetworkProbability) ? randomItem(bestNetworkHashMap.keys()) : false;
  }



  if (cnf.enableSeedNetwork && config.seedNetworkId) {
    console.log("NNT | seedNetworkId: " + config.seedNetworkId);
    const networkObj = bestNetworkHashMap.get(config.seedNetworkId).networkObj;
    config.networkObj = deepcopy(networkObj);
    config.architecture = "loadedNetwork";
    config.inputsId = networkObj.inputsId;
    config.inputs = {};
    // config.inputs = networkObj.inputs;
    console.log("NNT | networkObj.inputsId: " + networkObj.inputsId);
    config.inputs = inputsHashMap.get(networkObj.inputsId).inputs;
  }
  else {
    console.log("NNT | seedInputsId: " + config.seedInputsId);
    config.architecture = "random";
    config.inputsId = config.seedInputsId;
    config.inputs = {};
    config.inputs = inputsHashMap.get(config.seedInputsId).inputs;
  }

  config.iterations = cnf.evolve.iterations;
  config.threads = cnf.evolve.threads;
  config.cost = randomItem(EVOLVE_COST_ARRAY);
  config.clear = randomItem([true, false]);
  // config.clear = true;
  // config.equal = randomItem([true, false]);
  config.equal = true;
  config.error = cnf.evolve.error;
  config.mutation = DEFAULT_EVOLVE_MUTATION;
  config.mutationRate = randomFloat(EVOLVE_MUTATION_RATE_RANGE.min, EVOLVE_MUTATION_RATE_RANGE.max);
  config.popsize = randomInt(EVOLVE_POP_SIZE_RANGE.min, EVOLVE_POP_SIZE_RANGE.max);
  config.growth = randomFloat(EVOLVE_GROWTH_RANGE.min, EVOLVE_GROWTH_RANGE.max);
  config.elitism = randomInt(EVOLVE_ELITISM_RANGE.min, EVOLVE_ELITISM_RANGE.max);
  config.log = cnf.evolve.log;

  if (!cnf.createTrainingSet && !cnf.createTrainingSetOnly && cnf.loadTrainingSetFromFile && trainingSetReady) {

    console.log(chalkAlert("LOAD TRAINING SET FROM HASHMAP: " + config.inputsId));

    if (!trainingSetHashMap.has(config.inputsId)) {
      console.log(chalkError("*** TRAINING SET NOT IN HASHMAP: " + config.inputsId));
      return callback("TRAINING SET NOT IN HASHMAP: " + config.inputsId, null);
    }

    const tSet = trainingSetHashMap.get(config.inputsId);

    config.trainingSet = {};
    config.trainingSet.meta = {};
    config.trainingSet.meta = tSet.trainingSet.meta;
    config.trainingSet.data = [];
    config.trainingSet.data = tSet.trainingSet.data;
    config.testSet = {};
    config.testSet = tSet.testSet;

    callback(null, config);
  }
  else {

    console.log(chalkAlert("NNT | ... START CREATE TRAINING SET"));

    generateTrainingTestSets([config.inputsId], trainingSetUsersHashMap, function(err){

      if (err) {
        return(callback(err, null));
      }

      const trainingSetObj = trainingSetHashMap.get(config.inputsId);

      console.log(chalkAlert("NNT | USING TRAINING SET " + config.inputsId));

      config.trainingSetId = trainingSetObj.trainingSetId;
      config.trainingSet = {};
      config.trainingSet.meta = {};
      config.trainingSet.meta = trainingSetObj.trainingSet.meta;
      config.trainingSet.data = [];
      config.trainingSet.data = trainingSetObj.trainingSet.data;
      config.testSet = {};
      config.testSet = trainingSetObj.testSet;

      console.log(chalkLog("NNT | TRAINING SET META\n" + jsonPrint(trainingSetObj.trainingSet.meta)));

      callback(null, config);

    });
  }
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
  statsObj.tests[testObj.testRunId][nnId].testRunId = nnId;
  statsObj.tests[testObj.testRunId][nnId].testSet = {};
  statsObj.tests[testObj.testRunId][nnId].results = {};
  statsObj.tests[testObj.testRunId][nnId].results.numTests = 0;
  statsObj.tests[testObj.testRunId][nnId].results.numSkipped = 0;
  statsObj.tests[testObj.testRunId][nnId].results.numPassed = 0;
  statsObj.tests[testObj.testRunId][nnId].results.successRate = 0.0;
  statsObj.tests[testObj.testRunId][nnId].elapsed = 0;

  generateRandomEvolveConfig(cnf, function(err, childConf){

    if (err) {
      console.log(chalkError("generateRandomEvolveConfig ERROR\n" + jsonPrint(err)));
      return(callback(err, childConf));
    }

    switch (cnf.networkCreateMode) {

      case "evolve":

        messageObj = {};
        messageObj.op = "EVOLVE";
        messageObj.testRunId = nnId;
        messageObj.inputsId = childConf.inputsId;
        messageObj.inputs = {};
        messageObj.inputs = childConf.inputs;
        messageObj.outputs = {};
        messageObj.outputs = ["left", "neutral", "right"];
        messageObj.trainingSet = {};
        messageObj.trainingSet = childConf.trainingSet;
        messageObj.normalization = {};
        messageObj.normalization = statsObj.normalization;

        messageObj.architecture = childConf.architecture;
        messageObj.threads = childConf.threads;
        messageObj.networkObj = {};
        messageObj.networkObj = childConf.networkObj;
        messageObj.iterations = childConf.iterations;
        messageObj.equal = childConf.equal;
        messageObj.popsize = childConf.popsize;
        messageObj.growth = childConf.growth;
        messageObj.cost = childConf.cost;
        messageObj.elitism = childConf.elitism;
        messageObj.log = childConf.log;
        messageObj.error = childConf.error;
        messageObj.mutation = childConf.mutation;
        messageObj.mutationRate = childConf.mutationRate;
        messageObj.clear = childConf.clear;

        statsObj.tests[testObj.testRunId][nnId].testSet = childConf.testSet;

        statsObj.evolve[nnId].options = omit(messageObj, ["network", "trainingSet", "testSet", "inputs", "outputs"]);

        if (messageObj.networkObj && (messageObj.networkObj !== undefined)) {
          messageObj.seedNetworkId = messageObj.networkObj.networkId;
          messageObj.seedNetworkRes = messageObj.networkObj.successRate;
          statsObj.evolve[nnId].options.networkObj = {};
          statsObj.evolve[nnId].options.networkObj = pick(messageObj, ["networkId", "successRate", "inputsId"]);
        }

        console.log(chalkBlue("\nNNT | START NETWORK EVOLVE"));

        console.log(chalkBlue("NNT | TEST RUN ID: " + statsObj.tests[testObj.testRunId][nnId].testRunId
          + "\nNNT | TRAINING SET LENGTH: " + messageObj.trainingSet.meta.setSize
          + "\nNNT | TEST SET LENGTH:     " + statsObj.tests[testObj.testRunId][nnId].testSet.data.length
          + "\nNNT | INPUTS ID:           " + messageObj.inputsId
          + "\nNNT | INPUTS:              " + messageObj.trainingSet.meta.numInputs
          + "\nNNT | OUTPUTS:             " + messageObj.trainingSet.meta.numOutputs
          + "\nNNT | ITERATIONS:          " + messageObj.iterations
        ));

        neuralNetworkChildHashMap[nnChildId].child.send(messageObj, function(err){
          if (err) {
            console.log(chalkError("NNT | *** NEURAL NETWORK CHILD SEND ERROR: " + err));
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

  initMainReady = false;

  console.log(chalkAlert("NNT | ***===*** INIT MAIN ***===*** | INTERVAL: " + msToTime(cnf.initMainIntervalTime)));


  loadHistogramsDropboxFolder(defaultHistogramsFolder, function(err){
    loadInputsDropboxFolder(defaultInputsFolder, function(err){
      let seedOpt = {};
      seedOpt.folders = [globalBestNetworkFolder, localBestNetworkFolder];

      if (cnf.seedNetworkId) {
        seedOpt.networkId = cnf.seedNetworkId;
      }

      loadSeedNeuralNetwork(seedOpt, function(err, results){});

      initClassifiedUserHashmap(cnf.classifiedUsersFolder, cnf.classifiedUsersFile, function(err, classifiedUsersObj){

        if (err) {
          console.error(chalkError("NNT | *** ERROR: CLASSIFIED USER HASHMAP NOT INITIALIED: ", err));
          quit("CLASSIFIED USER HASHMAP NOT INITIALIED");
          return;
        }

        classifiedUserHashmap = {};
        classifiedUserHashmap = classifiedUsersObj;

        console.log(chalkInfo("NNT | LOADED " + Object.keys(classifiedUserHashmap).length + " TOTAL CLASSIFIED USERS"));

        if (cnf.loadTrainingSetFromFile) {

          let folder;
          // let file;

          if (cnf.useLocalTrainingSets) {
            console.log(chalkInfo("NNT | ... LOADING LOCAL TRAINING SETS FROM FOLDER " + localTrainingSetFolder));
            folder = localTrainingSetFolder;
          }
          else {
            console.log(chalkInfo("NNT | ... LOADING DEFAULT TRAINING SETS FROM FOLDER " + defaultTrainingSetFolder));
            folder = defaultTrainingSetFolder;
          }

          loadTrainingSetsDropboxFolder(folder, function(err){

            if (err) {
              console.log(chalkError("*** LOAD TRAINING SETS FOLDER\n" + jsonPrint(err)));
              initMainReady = true;
              createTrainingSetBusy = false;
              trainingSetReady = false;
              return(callback(err, null));
            }

            initMainReady = true;
            createTrainingSetBusy = false;
            trainingSetReady = true;

            callback(null, null);

          });

        }
        else {

          createTrainingSetBusy = true;
          trainingSetReady = false;

          updateClassifiedUsers(cnf, function(err){

            if (err) {
              console.error("NNT | *** UPDATE CLASSIFIED USER ERROR ***\n" + jsonPrint(err));
              quit("UPDATE CLASSIFIED USER ERROR");
            }

            console.log(chalkAlert("NNT | ... START CREATE TRAINING SET"));
            console.log(chalkAlert("NNT | inputsHashMap keys: " + inputsHashMap.keys()));


            loadInputsDropboxFolder(defaultInputsFolder, function(err){
              generateTrainingTestSets(inputsHashMap.keys(), trainingSetUsersHashMap, function(err){

                if (err) {
                  initMainReady = true;
                  trainingSetReady = true;
                  createTrainingSetBusy = false;
                  return(callback(err, null));
                }

                statsObj.classifiedUserHistogram = {};
                statsObj.classifiedUserHistogram = classifiedUserHistogram;

                classifiedUserHistogram.left = 0;
                classifiedUserHistogram.right = 0;
                classifiedUserHistogram.neutral = 0;
                classifiedUserHistogram.positive = 0;
                classifiedUserHistogram.negative = 0;
                classifiedUserHistogram.none = 0;

                trainingSetReady = true;
                createTrainingSetBusy = false;
                initMainReady = true;

                callback(null, null);
              });
            });
          });
        }
      });
    });
  });
}

let networkCreateInterval;

function initNetworkCreateInterval(cnf){

  clearInterval(networkCreateInterval);

  networkCreateInterval = setInterval(function(){

    if (initMainReady) {

      // RELOAD CONFIG FILE

      loadConfigFile(dropboxConfigHostFolder, dropboxConfigFile, function(err, configLoadedFlag){

        if (configLoadedFlag) {
          console.log(chalkAlert("+++ RELOADED CONFIG " + dropboxConfigHostFolder + "/" + dropboxConfigFile));
        }
        else {
          debug(chalkAlert("... NO RELOAD CONFIG FILE" + dropboxConfigHostFolder + "/" + dropboxConfigFile));
        }

        const bestNetworkFolders = [globalBestNetworkFolder];

        loadBestNetworkDropboxFolders(bestNetworkFolders, function (err, numNetworksLoaded){

          if (err) {
            console.log(chalkError("*** LOAD BEST NETWORK ERROR in initNetworkCreateInterval " + err));
          }
          else if (numNetworksLoaded > 0) {
            console.log(chalkAlert("LOADED BEST NETWORK FOLDERS: " + bestNetworkFolders + " | " + numNetworksLoaded + " NETWORKS LOADED"));
          }

          Object.keys(neuralNetworkChildHashMap).forEach(function(nnChildId){

            if (neuralNetworkChildHashMap[nnChildId].ready) {

              neuralNetworkChildHashMap[nnChildId].ready = false ;

              const nnId = testObj.testRunId + "_" + nnChildId + "_" + networkIndex;
              networkIndex += 1;

              initNetworkCreate(nnChildId, nnId, configuration, function(err, results){

                debug("initNetworkCreate results\n" + jsonPrint(results));

                if (err) {
                  console.log("NNT | *** INIT NETWORK CREATE ERROR ***\n" + jsonPrint(err));
                  neuralNetworkChildHashMap[nnChildId].ready = true ;
                }
                else {
                  console.log(chalkInfo("NETWORK CREATED | " + nnId));
                }
              });
            }
          });

        });

      });

    }

  }, cnf.networkCreateIntervalTime);
}

function initNeuralNetworkChild(cnf, callback){

  nnChildId = "NNC_" + nnChildIndex;

  console.log(chalkAlert("+++ NEW NEURAL NETWORK CHILD | NNC ID: " + nnChildId));

  statsObj.neuralNetworkReady = false;

  let childEnv = {};
  // childEnv.silent = false;
  // childEnv.execArgv = [];
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
    ));

    if (m.error) {
      console.error(chalkError("NNT | neuralNetworkChild RX ERROR\n" + jsonPrint(m)));
      if (callback !== undefined) { 
        return(callback(m.error, null));
      }
      return;
    }

    let snIdRes = "---";

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

          if (neuralNetworkChildHashMap[m.processName] !== undefined) { 
            neuralNetworkChildHashMap[m.processName].ready = true; 
          }

          if (!cnf.createTrainingSetOnly) { 
            initNetworkCreateInterval(cnf);
          }

        }
        else {
          console.error(chalkError("NNT | *** TEST EVOLVE XOR FAILED *** | " + m.processName));
          quit("TEST EVOLVE FAILED");
        }
      break;

      case "EVOLVE_COMPLETE":

        snIdRes = (m.networkObj.seedNetworkId !== undefined) ? m.networkObj.seedNetworkRes.toFixed(2) : "---";

        console.log(chalkBlue(
            "\nNNT ========================================================\n"
          +   "NNT | NETWORK EVOLVE COMPLETE"
          + "\nNNT |            " + m.processName
          + "\nNNT | NID:       " + m.networkObj.networkId
          + "\nNNT | SEED:      " + m.networkObj.seedNetworkId
          + "\nNNT | SEED RES%: " + snIdRes
          + "\nNNT | ELAPSED:   " + msToTime(m.networkObj.evolve.elapsed)
          + "\nNNT | ITERTNS:   " + m.statsObj.evolve.results.iterations
          + "\nNNT | ERROR:     " + m.statsObj.evolve.results.error
          + "\nNNT | INPUTS ID: " + m.networkObj.inputsId
          + "\nNNT | INPUTS:    " + m.networkObj.network.input
          + "\nNNT | OUTPUTS:   " + m.networkObj.network.output
          + "\nNNT | DROPOUT:   " + m.networkObj.network.dropout
          + "\nNNT | NODES:     " + m.networkObj.network.nodes.length
          + "\nNNT | CONNS:     " + m.networkObj.network.connections.length
        ));

        testNetwork(m.networkObj, statsObj.tests[testObj.testRunId][m.networkObj.networkId], function(err, results){

          if (err) {
            console.error("NNT | *** TEST NETWORK ERROR ***\n" + jsonPrint(err));
          }

          testObj.results[m.processName] = {};
          testObj.results[m.processName] = results;

          statsObj.tests[testObj.testRunId][m.networkObj.networkId].results = {};
          statsObj.tests[testObj.testRunId][m.networkObj.networkId].results = pick(
            testObj.results[m.processName], 
            ["successRate", "numPassed", "numSkipped", "numTests", "testRunId"]
          );

          statsObj.tests[testObj.testRunId][m.networkObj.networkId].elapsed = m.networkObj.elapsed;

          console.log(chalkBlue("\nNNT | NETWORK TEST COMPLETE\nNNT | ==================="));

          let columns = columnify(results.testResultArray, {  minWidth: 8, maxWidth: 16});
          debug(chalkAlert(columns));

          console.log(chalkAlert("NNT | TEST COMPLETE"
            + " | " + m.processName
            + " | TESTS:   " + results.numTests
            + " | PASSED:  " + results.numPassed
            + " | SKIPPED: " + results.numSkipped
            + " | SUCCESS: " + results.successRate.toFixed(2) + "%"
          ));

          let networkObj = {};

          networkObj.networkId = m.networkObj.networkId;
          networkObj.seedNetworkId = m.networkObj.seedNetworkId;
          networkObj.seedNetworkRes = m.networkObj.seedNetworkRes;
          networkObj.networkCreateMode = "evolve";
          networkObj.createdAt = moment().valueOf();
          networkObj.network = {};
          networkObj.network = deepcopy(m.networkObj.network);
          networkObj.successRate = results.successRate;
          networkObj.numInputs = m.networkObj.network.input;
          networkObj.numOutputs = m.networkObj.network.output;
          networkObj.inputsId = m.networkObj.inputsId;
          networkObj.inputs = {};
          networkObj.inputs = m.networkObj.inputs;
          networkObj.outputs = {};
          networkObj.outputs = m.networkObj.outputs;
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

          let entry;

          if (m.statsObj.evolve.results.iterations < networkObj.evolve.options.iterations) {
            console.log(chalkError("NNT | XXX | NOT SAVING NN FILE TO DROPBOX ... EARLY COMPLETE?"
              + " | " + networkObj.networkId
              + " | ITRNS: " + m.statsObj.evolve.results.iterations
              + " | MIN: " + cnf.globalMinSuccessRate.toFixed(2) + "%"
              + " | " + networkObj.successRate.toFixed(2) + "%"
            ));

            printNetworkObj("NNT | " + networkObj.networkId, networkObj);

            if (neuralNetworkChildHashMap[m.processName] !== undefined) { 
              neuralNetworkChildHashMap[m.processName].ready = true; 
            }
          }
          else if (
            (m.networkObj.seedNetworkId && (results.successRate > m.networkObj.seedNetworkRes)) // better than seed nn
            || ((m.networkObj.seedNetworkId === undefined) && ((results.successRate >= cnf.localMinSuccessRate) // no seed but better than local min
            || (results.successRate >= cnf.globalMinSuccessRate))) // better than global min
            ) { 

            // It's a Keeper!!

            bestNetworkFile = m.networkObj.networkId + ".json";

            entry = {
              client_modified: moment(),
              name: bestNetworkFile,
              content_hash: false
            };

            bestNetworkHashMap.set(networkObj.networkId, { entry: entry, networkObj: networkObj});
            // inputsHashMap.set(networkObj.inputsId, {inputsId: networkObj.inputsId, inputs:networkObj.inputs});

            let inputsObj = {};

            if (inputsHashMap.has(networkObj.inputsId)) {
              inputsObj = inputsHashMap.get(networkObj.inputsId);
              inputsObj.inputs = networkObj.inputs;
              inputsHashMap.set(networkObj.inputsId, inputsObj);
            }
            else {
              inputsObj.inputsId = networkObj.inputsId;
              inputsObj.inputs = networkObj.inputs;
              inputsObj.entry = {};
              inputsObj.entry.name = networkObj.inputsId + ".json";
              inputsObj.entry.content_hash = false;
              inputsObj.entry.client_modified = moment();
              inputsHashMap.set(networkObj.inputsId, inputsObj);
            }

            if (inputsNetworksHashMap[networkObj.inputsId] === undefined) {
              inputsNetworksHashMap[networkObj.inputsId] = new Set();
            }
            inputsNetworksHashMap[networkObj.inputsId].add(networkObj.networkId);

            if (results.successRate >= cnf.globalMinSuccessRate) {

              console.log(chalkInfo("NNT | ... SAVING NN FILE TO DROPBOX GLOBAL BEST"
                + " | " + globalBestNetworkFolder + "/" + bestNetworkFile
              ));

              saveFileQueue.push({folder: globalBestNetworkFolder, file: bestNetworkFile, obj: networkObj});

            }
            else if (results.successRate >= cnf.localMinSuccessRate) {

              const localNetworkFile = m.networkObj.networkId + ".json";

              entry = {
                client_modified: moment(),
                name: bestNetworkFile,
                content_hash: false
              };

              console.log(chalkInfo("NNT | ... SAVING NN FILE TO DROPBOX LOCAL BEST"
                + " | " + localBestNetworkFolder + "/" + localNetworkFile
              ));

              saveFileQueue.push({folder: localBestNetworkFolder, file: localNetworkFile, obj: networkObj});

            }

            printNetworkObj("NNT | " + networkObj.networkId, networkObj);

            if (neuralNetworkChildHashMap[m.processName] !== undefined) { 
              neuralNetworkChildHashMap[m.processName].ready = true;
            }

          }

          else {
            console.log(chalkInfo("NNT | XXX | NOT SAVING NN GLOBAL DROPBOX ... LESS THAN GLOBAL MIN SUCCESS"
              + " | " + networkObj.networkId
              + " | " + networkObj.successRate.toFixed(2) + "%"
              + " | " + cnf.globalMinSuccessRate.toFixed(2) + "%"
            ));

            printNetworkObj("NNT | " + networkObj.networkId, networkObj);

            if (neuralNetworkChildHashMap[m.processName] !== undefined) { 
              neuralNetworkChildHashMap[m.processName].ready = true; 
            }

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

    let seedOpt = {};
    seedOpt.folders = [globalBestNetworkFolder, localBestNetworkFolder];

    if (cnf.seedNetworkId) {
      seedOpt.networkId = cnf.seedNetworkId;
    }

    if (cnf.createTrainingSetOnly) {
      console.log(chalkAlert("NNT | *** CREATE TRAINING SET ONLY ... SKIP INIT NN CHILD ***"));
      callback();
    }
    else {
      loadSeedNeuralNetwork(seedOpt, function(err, results){

        debug("loadSeedNeuralNetwork results\n" + jsonPrint(results));

        if (err){
          console.log(chalkError("loadSeedNeuralNetwork ERROR\n" + jsonPrint(err)));
          return(callback(err));
        }

        console.log(chalkLog("NNT | INIT NN CHILD"));

        async.times(cnf.maxNeuralNetworkChildern, function initNnChild (n, next) {

          debug("INIT NN CHILD NUMBER " + n);

          initNeuralNetworkChild(cnf, function(err, nnChildIndex) {
            next(err, nnChildIndex);
          });
        }, function(err, children) {

          if (err){
            console.log(chalkError("INIT NEURAL NETWORK CHILDREN ERROR\n" + jsonPrint(err)));
            return(callback(err));
          }

          console.log(chalkLog("END INIT NEURAL NETWORK CHILDREN: " + children.length));
          callback();
        });

      });
    }

  });
}

if (process.env.TNN_BATCH_MODE){
  slackChannel = "#nn_batch";
}

initTimeout(function(){

  initSaveFileQueue(configuration);

  initMain(configuration, function(){
    debug(chalkLog("FIRST INIT MAIN CALLBACK"
      + " | configuration.initMainIntervalTime: " + configuration.initMainIntervalTime
    ));
  });

  initMainInterval = setInterval(function(){

    console.log(chalkAlert("NNT | +++ INIT MAIN INTERVAL"
      + " | trainingSetReady: " + trainingSetReady
      + " | createTrainingSetBusy: " + createTrainingSetBusy
    ));

    if (initMainReady) {
      initMain(configuration, function(){
        debug(chalkLog("INIT MAIN CALLBACK"));
      });
    }
    else {
      console.log(chalkAlert("NNT | ... INIT MAIN INTERVAL | NOT READY"
        + " | LOADING HISTOGRAMS + INPUTS "
      ));

      loadHistogramsDropboxFolder(defaultHistogramsFolder, function(err){
        loadInputsDropboxFolder(defaultInputsFolder, function(err){
          // return(callback(err, cnf2));
        });
      });
    }

  }, configuration.initMainIntervalTime);
});

