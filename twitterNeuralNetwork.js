/*jslint node: true */
/*jshint sub:true*/
"use strict";

// const HOST = process.env.PRIMARY_HOST || "local";
// const PRIMARY_HOST = process.env.PRIMARY_HOST || "macpro2";
const HOST = "default";

let quitOnCompleteFlag = false;


const TEST_MODE = false; // applies only to parent
const CHILD_TEST_MODE = false; // applies only to children
const GLOBAL_TEST_MODE = false;  // applies to parent and all children
const QUIT_ON_COMPLETE = false;

const MODULE_NAME = "twitterNeuralNetwork";
const MODULE_ID_PREFIX = "TNN";
const CHILD_PREFIX = "tnc_node";

const ONE_SECOND = 1000 ;
const ONE_MINUTE = ONE_SECOND*60 ;

const ONE_KILOBYTE = 1024;
const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;

const KEEPALIVE_INTERVAL = ONE_MINUTE;
const QUIT_WAIT_INTERVAL = 5*ONE_SECOND;
const STATS_UPDATE_INTERVAL = ONE_MINUTE;
const DEFAULT_CHILD_PING_INTERVAL = ONE_MINUTE;

const SAVE_CACHE_DEFAULT_TTL = 60;
const SAVE_FILE_QUEUE_INTERVAL = ONE_SECOND;

const TWITTER_DEFAULT_USER = "altthreecee00";

const DROPBOX_MAX_SAVE_NORMAL = 20 * ONE_MEGABYTE;
const DROPBOX_LIST_FOLDER_LIMIT = 50;
const DROPBOX_TIMEOUT = 30 * ONE_SECOND;

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const NUM_RANDOM_NETWORKS = 100;
const IMAGE_QUOTA_TIMEOUT = 60000;

const DEFAULT_FORCE_INIT_RANDOM_NETWORKS = true;
const OFFLINE_MODE = false;

let statsObj = {};
let statsObjSmall = {};
let configuration = {};

configuration.testMode = TEST_MODE;
configuration.globalTestMode = GLOBAL_TEST_MODE;
configuration.quitOnComplete = QUIT_ON_COMPLETE;
configuration.statsUpdateIntervalTime = STATS_UPDATE_INTERVAL;

const os = require("os");
const path = require("path");
const watch = require("watch");
const moment = require("moment");
const HashMap = require("hashmap").HashMap;
const pick = require("object.pick");
const shell = require("shelljs");
const touch = require("touch");
const kill = require("tree-kill");
const dot = require("dot-object");
const _ = require("lodash");
const defaults = require("object.defaults");
const treeify = require("treeify");
const objectPath = require("object-path");
const fetch = require("isomorphic-fetch"); // or another library of choice.
const NodeCache = require("node-cache");
const merge = require("deepmerge");
const MergeHistograms = require("@threeceelabs/mergehistograms");
const mergeHistograms = new MergeHistograms();
const table = require("text-table");
const randomItem = require("random-item");
const randomFloat = require("random-float");
const randomInt = require("random-int");
const yauzl = require("yauzl");
const validUrl = require("valid-url");
const atob = require("atob");
const btoa = require("btoa");
const https = require("follow-redirects").https;

const writeJsonFile = require("write-json-file");
const sizeof = require("object-sizeof");

const fs = require("fs");
// const JSONParse = require("json-parse-safe");
const JSONParse = require("safe-json-parse");
const debug = require("debug")("TNN");
const util = require("util");
const deepcopy = require("deep-copy");
const async = require("async");
const omit = require("object.omit");

const chalk = require("chalk");
const chalkConnect = chalk.green;
const chalkNetwork = chalk.blue;
const chalkBlueBold = chalk.blue.bold;
const chalkTwitter = chalk.blue;
const chalkTwitterBold = chalk.bold.blue;
const chalkBlue = chalk.blue;
const chalkGreen = chalk.green;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;


const EventEmitter = require("eventemitter3");

class ChildEvents extends EventEmitter {};

const childEvents = new ChildEvents();


//=========================================================================
// HOST
//=========================================================================

let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const MODULE_ID = MODULE_ID_PREFIX + "_node_" + hostname;

let startTimeMoment = moment();

const DEFAULT_NETWORK_ID_PREFIX = hostname + "_" + getTimeStamp();

configuration.networkIdPrefix = DEFAULT_NETWORK_ID_PREFIX;

statsObj.pid = process.pid;
statsObj.cpus = os.cpus().length;

statsObj.runId = MODULE_ID.toLowerCase() + "_" + getTimeStamp();

statsObj.hostname = hostname;
statsObj.startTime = getTimeStamp();
statsObj.elapsedMS = 0;
statsObj.elapsed = getElapsedTimeStamp();
statsObj.status = "START";

statsObj.serverConnected = false;
statsObj.userReadyAck = false;
statsObj.userReadyAckWait = 0;
statsObj.userReadyTransmitted = false;
statsObj.authenticated = false;

statsObj.maxChildrenCreated = false; 

statsObj.queues = {};

//=========================================================================
// TNN SPECIFIC
//=========================================================================
const ENABLE_INIT_PURGE_LOCAL = true;
const DEFAULT_LOAD_ALL_INPUTS = false;
const DEFAULT_ARCHIVE_NOT_IN_INPUTS_ID_ARRAY = true;
const DEFAULT_DELETE_NOT_IN_INPUTS_ID_ARRAY = false;
const SMALL_SET_SIZE = 100;
const SMALL_TEST_SET_SIZE = 20;
const TEST_MODE_LENGTH = 500;
const TEST_DROPBOX_NN_LOAD = 10;
const TEST_DROPBOX_INPUTS_LOAD = 10;
const DEFAULT_CHILD_ID_PREFIX = "tnc_node_";

configuration.childAppPath = "/Volumes/RAID1/projects/twitterNeuralNetwork/neuralNetworkChild.js";
configuration.childIdPrefix = DEFAULT_CHILD_ID_PREFIX;
configuration.childIndex = 0;

const neataptic = require("neataptic");
const twitterTextParser = require("@threeceelabs/twitter-text-parser");
const twitterImageParser = require("@threeceelabs/twitter-image-parser");

const DEFAULT_RUN_ID = hostname + "_" + process.pid + "_" + statsObj.startTime;

let initMainReady = false;
let initMainInterval;
let networkCreateInterval;
let childPingAllInterval;

let runOnceFlag = false;
let allCompleteFlag = false;

const bestRuntimeNetworkFileName = "bestRuntimeNetwork.json";
let enableCreateChildren = false;
let tempArchiveDirectory = "temp/archive_" + getTimeStamp();

let categorizedUserHashmap = new HashMap();

let categorizedUserHistogram = {};
categorizedUserHistogram.left = 0;
categorizedUserHistogram.right = 0;
categorizedUserHistogram.neutral = 0;
categorizedUserHistogram.positive = 0;
categorizedUserHistogram.negative = 0;
categorizedUserHistogram.none = 0;

statsObj.normalization = {};
statsObj.normalization.score = {};
statsObj.normalization.magnitude = {};

statsObj.normalization.score.min = 1.0;
statsObj.normalization.score.max = -1.0;
statsObj.normalization.magnitude.min = 0;
statsObj.normalization.magnitude.max = -Infinity;

const DEFAULT_INPUT_TYPES = [
  "emoji", 
  "hashtags",  
  "images", 
  "locations", 
  "media", 
  "mentions", 
  "places", 
  "sentiment", 
  "urls", 
  "userMentions", 
  "words"
];

DEFAULT_INPUT_TYPES.sort();


const GLOBAL_TRAINING_SET_ID = "globalTrainingSet";

const DEFAULT_SEED_RANDOMIZE_OPTIONS = true;
const DEFAULT_USE_LOCAL_TRAINING_SETS = false;
const DEFAULT_MAX_NEURAL_NETWORK_CHILDREN = 1;
const DEFAULT_TEST_RATIO = 0.20;
const DEFAULT_NETWORK_CREATE_MODE = "evolve";
const DEFAULT_ITERATIONS = 10;
const DEFAULT_SEED_NETWORK_ID = false;
const DEFAULT_SEED_NETWORK_PROBABILITY = 0.5;
const DEFAULT_GLOBAL_MIN_SUCCESS_RATE = 80; // percent
const DEFAULT_LOCAL_MIN_SUCCESS_RATE = 50; // percent
const DEFAULT_LOCAL_PURGE_MIN_SUCCESS_RATE = 70; // percent
const DEFAULT_CREATE_TRAINING_SET_ONLY = false;
const DEFAULT_DISABLE_CREATE_TEST_SET = false;
const DEFAULT_INIT_MAIN_INTERVAL = process.env.TNN_INIT_MAIN_INTERVAL || 10*ONE_MINUTE;

const DEFAULT_EVOLVE_THREADS = 4;
const DEFAULT_EVOLVE_ARCHITECTURE = "random";
const DEFAULT_EVOLVE_BEST_NETWORK = false;
const DEFAULT_EVOLVE_CLEAR = true;
const DEFAULT_EVOLVE_ELITISM = 10;
const DEFAULT_EVOLVE_EQUAL = true;
const DEFAULT_EVOLVE_ERROR = 0.03;
const DEFAULT_EVOLVE_LOG = 1;
const DEFAULT_EVOLVE_MUTATION = neataptic.methods.mutation.FFW;
const DEFAULT_EVOLVE_MUTATION_RATE = 0.5;
const DEFAULT_EVOLVE_POPSIZE = { min: 75, max: 125 };
const DEFAULT_EVOLVE_GROWTH = 0.0001;
const DEFAULT_EVOLVE_COST = "CROSS_ENTROPY";
const EVOLVE_MUTATION_RATE_RANGE = { min: 0.35, max: 0.75 } ;
const EVOLVE_POP_SIZE_RANGE = { min: DEFAULT_EVOLVE_POPSIZE.min, max: DEFAULT_EVOLVE_POPSIZE.max } ;
const DEFAULT_GROWTH = { min: 0.00005, max: 0.00015 } ;
const EVOLVE_GROWTH_RANGE = { min: DEFAULT_GROWTH.min, max: DEFAULT_GROWTH.max } ;
const EVOLVE_ELITISM_RANGE = { min: 5, max: 20 } ;
const DEFAULT_EVOLVE_COST_ARRAY = [
  "CROSS_ENTROPY",
  "CROSS_ENTROPY",
  "CROSS_ENTROPY",
  "CROSS_ENTROPY",
  "MSE"
];

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

let globalhistograms = {};

DEFAULT_INPUT_TYPES.forEach(function(type){
  globalhistograms[type] = {};
});

let resultsHashmap = {};
let networkHashMap = new HashMap();
let currentBestNetwork;
let betterChildSeedNetworkIdSet = new Set();
let skipLoadNetworkSet = new Set();
let localNetworkFile;
let networkIndex = 0;
let bestNetworkFile;

let inputsHashMap = new HashMap();
let inputsNetworksHashMap = {};
let skipLoadInputsSet = new Set();
let userMaxInputHashMap = {};

let testObj = {};
testObj.testRunId = hostname + "_" + statsObj.startTime;
testObj.results = {};
testObj.testSet = [];

let trainingSetUsersHashMap = new HashMap();
let trainingSetHashMap = new HashMap();
let requiredTrainingSet = new Set();
let archive;
let archiveOutputStream;
statsObj.trainingSetReady = false;

configuration.quitOnComplete = QUIT_ON_COMPLETE;

configuration.processName = process.env.TNN_PROCESS_NAME || "tnn_node";
configuration.networkCreateMode = "evole";

configuration.childPingAllInterval = DEFAULT_CHILD_PING_INTERVAL;

configuration.archiveNotInInputsIdArray = DEFAULT_ARCHIVE_NOT_IN_INPUTS_ID_ARRAY;
configuration.deleteNotInInputsIdArray = DEFAULT_DELETE_NOT_IN_INPUTS_ID_ARRAY;

configuration.globalTrainingSetId = GLOBAL_TRAINING_SET_ID;

configuration.disableCreateTestSet = DEFAULT_DISABLE_CREATE_TEST_SET;

configuration.inputsIdArray = [];
configuration.saveFileQueueInterval = 1000;

configuration.useLocalTrainingSets = DEFAULT_USE_LOCAL_TRAINING_SETS;
configuration.loadAllInputs = DEFAULT_LOAD_ALL_INPUTS;

configuration.forceBannerImageAnalysis = false;
configuration.interruptFlag = false;
configuration.useLocalNetworksOnly = false;
configuration.networkCreateIntervalTime = 15000;
configuration.enableSeedNetwork = true;

configuration.randomizeSeedOptions = (process.env.TNN_SEED_RANDOMIZE_OPTIONS !== undefined) 
  ? process.env.TNN_SEED_RANDOMIZE_OPTIONS 
  : DEFAULT_SEED_RANDOMIZE_OPTIONS;

configuration.seedNetworkProbability = DEFAULT_SEED_NETWORK_PROBABILITY;

configuration.initMainIntervalTime = DEFAULT_INIT_MAIN_INTERVAL;
configuration.enableRequiredTrainingSet = false;

const DROPBOX_CONFIG_FOLDER = "/config/utility";
const DROPBOX_CONFIG_DEFAULT_FOLDER = DROPBOX_CONFIG_FOLDER + "/default";
const DROPBOX_CONFIG_HOST_FOLDER = DROPBOX_CONFIG_FOLDER + "/" + hostname;

configuration.local = {};
configuration.local.trainingSetsFolder = DROPBOX_CONFIG_HOST_FOLDER + "/trainingSets";
configuration.local.userArchiveFolder = DROPBOX_CONFIG_HOST_FOLDER + "/trainingSets/users";
configuration.local.userArchivePath = configuration.local.userArchiveFolder + "/" + configuration.userArchiveFile;

configuration.default = {};
configuration.default.trainingSetsFolder = DROPBOX_CONFIG_DEFAULT_FOLDER + "/trainingSets";
configuration.default.userArchiveFolder = DROPBOX_CONFIG_DEFAULT_FOLDER + "/trainingSets/users";
configuration.default.userArchivePath = configuration.default.userArchiveFolder + "/" + configuration.userArchiveFile;

configuration.trainingSetsFolder = configuration[HOST].trainingSetsFolder;
configuration.archiveFileUploadCompleteFlagFolder = configuration[HOST].trainingSetsFolder + "/users";
configuration.userArchiveFolder = configuration[HOST].userArchiveFolder;
configuration.userArchivePath = "/Users/tc/Dropbox/Apps/wordAssociation" + configuration[HOST].userArchivePath;

configuration.defaultUserArchiveFlagFile = "usersZipUploadComplete.json";
configuration.trainingSetFile = "trainingSet.json";
configuration.requiredTrainingSetFile = "requiredTrainingSet.txt";

configuration.maxNumberChildren = (process.env.TNN_MAX_NEURAL_NETWORK_CHILDREN !== undefined) 
  ? process.env.TNN_MAX_NEURAL_NETWORK_CHILDREN 
  : DEFAULT_MAX_NEURAL_NETWORK_CHILDREN;


if (process.env.TNN_QUIT_ON_COMPLETE !== undefined) {

  console.log(MODULE_ID_PREFIX + " | ENV TNN_QUIT_ON_COMPLETE: " + process.env.TNN_QUIT_ON_COMPLETE);

  if (!process.env.TNN_QUIT_ON_COMPLETE || (process.env.TNN_QUIT_ON_COMPLETE === false) || (process.env.TNN_QUIT_ON_COMPLETE === "false")) {
    configuration.quitOnComplete = false ;
  }
  else {
    configuration.quitOnComplete = true ;
  }
}

configuration.costArray = (process.env.TNN_EVOLVE_COST_ARRAY !== undefined) 
  ? process.env.TNN_EVOLVE_COST_ARRAY 
  : DEFAULT_EVOLVE_COST_ARRAY;

configuration.globalMinSuccessRate = (process.env.TNN_GLOBAL_MIN_SUCCESS_RATE !== undefined) 
  ? process.env.TNN_GLOBAL_MIN_SUCCESS_RATE 
  : DEFAULT_GLOBAL_MIN_SUCCESS_RATE;

configuration.localMinSuccessRate = (process.env.TNN_LOCAL_MIN_SUCCESS_RATE !== undefined) 
  ? process.env.TNN_LOCAL_MIN_SUCCESS_RATE 
  : DEFAULT_LOCAL_MIN_SUCCESS_RATE;

// delete local nn's at start that are below  
configuration.localPurgeMinSuccessRate = (process.env.TNN_LOCAL_PURGE_MIN_SUCCESS_RATE !== undefined) 
  ? process.env.TNN_LOCAL_PURGE_MIN_SUCCESS_RATE 
  : DEFAULT_LOCAL_PURGE_MIN_SUCCESS_RATE;

configuration.loadTrainingSetFromFile = false;

configuration.DROPBOX = {};
configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
configuration.DROPBOX.DROPBOX_TNN_CONFIG_FILE = process.env.DROPBOX_TNN_CONFIG_FILE || "twitterNeuralNetworkConfig.json";
configuration.DROPBOX.DROPBOX_TNN_STATS_FILE = process.env.DROPBOX_TNN_STATS_FILE || "twitterNeuralNetworkStats.json";

configuration.normalization = null;
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

statsObj.evolveStats = {};
statsObj.evolveStats.results = {};
statsObj.evolveStats.total = 0;
statsObj.evolveStats.passLocal = 0;
statsObj.evolveStats.passGlobal = 0;
statsObj.evolveStats.fail = 0;

statsObj.users = {};
statsObj.users.imageParse = {};
statsObj.users.imageParse.parsed = 0;
statsObj.users.imageParse.skipped = 0;
statsObj.users.notCategorized = 0;
statsObj.users.updatedCategorized = 0;
statsObj.users.notFound = 0;
statsObj.users.screenNameUndefined = 0;
statsObj.users.unzipped = 0;
statsObj.users.zipHashMapHit = 0;

statsObj.errors = {};
statsObj.errors.imageParse = {};
statsObj.errors.users = {};
statsObj.errors.users.findOne = 0;

let statsPickArray = [
  "pid", 
  "startTime", 
  "elapsed", 
  "serverConnected", 
  "status", 
  "authenticated", 
  "numChildren", 
  // "socketError", 
  "userReadyAck", 
  "userReadyAckWait", 
  "userReadyTransmitted"
];

statsObjSmall = pick(statsObj, statsPickArray);

const networkDefaults = function (networkObj){

  if (networkObj.betterChild === undefined) { networkObj.betterChild = false; }
  if (networkObj.testCycles === undefined) { networkObj.testCycles = 0; }
  if (networkObj.testCycleHistory === undefined) { networkObj.testCycleHistory = []; }
  if (networkObj.overallMatchRate === undefined) { networkObj.overallMatchRate = 0; }
  if (networkObj.matchRate === undefined) { networkObj.matchRate = 0; }
  if (networkObj.successRate === undefined) { networkObj.successRate = 0; }

  return networkObj;
};

function printNetworkObj(title, networkObj, format) {

  const chalkFormat = (format !== undefined) ? format : chalkNetwork;

  networkObj = networkDefaults(networkObj);

  console.log(chalkFormat(title
    + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
    + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
    + " | SR: " + networkObj.successRate.toFixed(2) + "%"
    + " | CR: " + getTimeStamp(networkObj.createdAt)
    + " | TC:  " + networkObj.testCycles
    + " | TCH: " + networkObj.testCycleHistory.length
    + " | INPUTS: " + networkObj.numInputs
    + " | IN ID:  " + networkObj.inputsId
    + " | " + networkObj.networkId
  ));
}

function indexOfMax (arr, callback) {

  if (arr.length === 0) {
    console.log(chalkAlert(MODULE_ID_PREFIX + " | indexOfMax: 0 LENG ARRAY: -1"));
    return callback(-2, arr) ; 
  }

  if ((arr[0] === arr[1]) && (arr[1] === arr[2])){
    debug(chalkInfo(MODULE_ID_PREFIX + " | indexOfMax: ALL EQUAL"));
    debug(chalkInfo(MODULE_ID_PREFIX + " | ARR" 
      + " | " + arr[0].toFixed(2) 
      + " - " + arr[1].toFixed(2) 
      + " - " + arr[2].toFixed(2)
    ));
    if (arr[0] === 0) { return callback(-4, arr); }
    return callback(4, [1,1,1]) ; 
  }

  debug(MODULE_ID_PREFIX + " | B4 ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));
  arrayNormalize(arr);
  debug(MODULE_ID_PREFIX + " | AF ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));

  if (((arr[0] === 1) && (arr[1] === 1)) 
    || ((arr[0] === 1) && (arr[2] === 1))
    || ((arr[1] === 1) && (arr[2] === 1))){

    debug(chalkAlert(MODULE_ID_PREFIX + " | indexOfMax: MULTIPLE SET"));

    debug(chalkAlert(MODULE_ID_PREFIX + " | ARR" 
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

const sortedObjectValues = function(params) {

  return new Promise(function(resolve, reject) {

    const keys = Object.keys(params.obj);

    const sortedKeys = keys.sort(function(a,b){
      const objA = params.obj[a];
      const objB = params.obj[b];
      return objB[params.sortKey] - objA[params.sortKey];
    });

    if (keys.length !== undefined) {
      if (sortedKeys !== undefined) { 
        resolve({sortKey: params.sortKey, sortedKeys: sortedKeys.slice(0,params.max)});
      }
      else {
        resolve({sortKey: params.sortKey, sortedKeys: []});
      }

    }
    else {
      console.error("sortedObjectValues ERROR | params\n" + jsonPrint(params));
      reject(new Error("sortedObjectValues ERROR | keys.length UNDEFINED"));
    }

  });
};

function sortedHashmap(params) {

  return new Promise(function(resolve, reject) {

    const keys = params.hashmap.keys();

    const sortedKeys = keys.sort(function(a,b){
      const objA = params.hashmap.get(a);
      const objB = params.hashmap.get(b);
      const objAvalue = dot.pick(params.sortKey, params.hashmap.get(a));
      const objBvalue = dot.pick(params.sortKey, params.hashmap.get(b));
      return objBvalue - objAvalue;
    });

    if (keys !== undefined) {
      if (sortedKeys !== undefined) { 
        resolve({sortKey: params.sortKey, sortedKeys: sortedKeys.slice(0,params.max)});
      }
      else {
        console.log(chalkAlert("sortedHashmap NO SORTED KEYS? | SORT KEY: " + params.sortKey + " | KEYS: " + keys.length + " | SORTED KEYS: " + sortedKeys.length));
        resolve({sortKey: params.sortKey, sortedKeys: []});
      }

    }
    else {
      console.error("sortedHashmap ERROR | params\n" + jsonPrint(params));
      reject(new Error("sortedHashmap ERROR | keys UNDEFINED"));
    }

  });
}

function printResultsHashmap(){

  let tableArray = [];

  tableArray.push([
    MODULE_ID_PREFIX + " | NNID",
    "STATUS",
    "BETTER CH",
    "SEED",
    "RES %",
    "INPTS",
    "CLEAR",
    "COST",
    "GRWTH",
    "EQUAL",
    "M RATE",
    "POP",
    "ELITE",
    "START",
    "ELPSD",
    "ITRNS",
    "ERROR",
    "RES %"
  ]);

  async.each(Object.keys(resultsHashmap), function(networkId, cb){

    const networkObj = resultsHashmap[networkId];

    if (networkObj === undefined) {
      return cb("UNDEFINED");
    }
    
    if (networkObj.numInputs === undefined) {
      return cb("numInputs UNDEFINED");
    }
    
    if (networkObj.evolve === undefined) {
      networkObj.evolve.options.clear = "---";
      networkObj.evolve.options.cost = "---";
      networkObj.evolve.options.growth = "---";
      networkObj.evolve.options.equal = "---";
      networkObj.evolve.options.mutationRate = "---";
      networkObj.evolve.options.popsize = "---";
      networkObj.evolve.options.elitism = "---";
    }

    let status = "";
    let snIdRes = "";
    let iterations = "";
    let error = "";
    let successRate = "";
    let elapsed = "";
    let betterChild = "";
    let seedNetworkId = "";

    status = (networkObj.status && networkObj.status !== undefined) ? networkObj.status : "UNKNOWN";
    snIdRes = (networkObj.seedNetworkId && networkObj.seedNetworkId !== undefined) ? networkObj.seedNetworkRes.toFixed(2) : "---";
    betterChild = (networkObj.betterChild && networkObj.betterChild !== undefined) ? networkObj.betterChild : "---";
    seedNetworkId = (networkObj.seedNetworkId && networkObj.seedNetworkId !== undefined) ? networkObj.seedNetworkId : "---";
    iterations = (networkObj.evolve.results && networkObj.evolve.results !== undefined) ? networkObj.evolve.results.iterations : "---";

    error = ((networkObj.evolve.results && networkObj.evolve.results !== undefined) 
      && (networkObj.evolve.results.error !== undefined)
      && networkObj.evolve.results.error)  ? networkObj.evolve.results.error.toFixed(5) : "---";

    successRate = (networkObj.successRate && networkObj.successRate !== undefined) ? networkObj.successRate.toFixed(2) : "---";
    elapsed = (networkObj.evolve.elapsed && networkObj.evolve.elapsed !== undefined) ? networkObj.evolve.elapsed : (moment().valueOf() - networkObj.evolve.startTime);

    tableArray.push([
      MODULE_ID_PREFIX + " | " + networkId,
      status,
      betterChild,
      seedNetworkId,
      snIdRes,
      networkObj.numInputs,
      networkObj.evolve.options.clear,
      networkObj.evolve.options.cost,
      networkObj.evolve.options.growth.toFixed(8),
      networkObj.evolve.options.equal,
      networkObj.evolve.options.mutationRate.toFixed(3),
      networkObj.evolve.options.popsize,
      networkObj.evolve.options.elitism,
      getTimeStamp(networkObj.evolve.startTime),
      msToTime(elapsed),
      iterations,
      error,
      successRate
    ]);

    async.setImmediate(function() { cb(); });

  }, function(){

    const t = table(tableArray, { align: ["l", "l", "l", "l", "l", "r", "l", "l", "l", "l", "r", "r", "r", "l", "l", "r", "r", "r"] });

    console.log(chalkLog(MODULE_ID_PREFIX + " | === NETWORK RESULTS ========================================================================================================================"));
    console.log(chalkLog(t));
    console.log(chalkLog(MODULE_ID_PREFIX + " | ============================================================================================================================================"));

  });
}

function printInputsHashMap(){

  let tableArray = [];

  tableArray.push([
    MODULE_ID_PREFIX + " | INPUTS ID",
    "INPTS"
  ]);

  async.each(inputsHashMap.keys(), function(inputsId, cb){

    const inputsObj = inputsHashMap.get(inputsId).inputsObj;

    tableArray.push([
      MODULE_ID_PREFIX + " | " + inputsId,
      inputsObj.meta.numInputs
    ]);

    async.setImmediate(function() { cb(); });

  }, function(){

    const t = table(tableArray, { align: ["l", "r"] });

    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | ============================================================================================================================================"));
    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | INPUTS HASHMAP"));
    console.log(chalkInfo(t));
    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | ============================================================================================================================================"));

  });
}

function purgeNetwork(networkId){

  return new Promise(function(resolve, reject){

    try {
      console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX PURGE NETWORK: " + networkId));

      networkHashMap.delete(networkId);

      betterChildSeedNetworkIdSet.delete(networkId);

      skipLoadNetworkSet.add(networkId);
          throw err;

      if (resultsHashmap[networkId] !== undefined) { 
        resultsHashmap[networkId].status = "PURGED";
      }
      resolve();
    }
    catch(err){
      return reject(err);
    }

  });
}

function purgeInputs(inputsId, callback){

  return new Promise(function(resolve, reject){

    try {
      if (!configuration.inputsIdArray.includes(inputsId)){
        console.log(chalkInfo(MODULE_ID_PREFIX + " | XXX PURGE INPUTS: " + inputsId));
        inputsHashMap.delete(inputsId);
        skipLoadInputsSet.add(inputsId);
      }
      else {
        console.log(chalkInfo(MODULE_ID_PREFIX + " | ** NO XXX PURGE INPUTS ... IN CONFIGURATION INPUTS ID ARRAY" 
          + " | INPUTS ID: " + inputsId
        ));

        if (configuration.verbose) {
          console.log(chalkInfo(MODULE_ID_PREFIX + " | CONFIGURATION INPUTS ID ARRAY\n" + jsonPrint(configuration.inputsIdArray) ));
        }
      }
      resolve();
    }
    catch(err){
      return reject(err);
    }

  });


  if (callback !== undefined) { callback(); }
}

function loadInputsDropboxFile(params){
  return new Promise(async function(resolve, reject){

    let inputsObj;

    try {
      inputsObj = await loadFileRetry({folder: params.folder, file: params.file});
    }
    catch(err) {
      console.log(chalkError(MODULE_ID_PREFIX + " | DROPBOX INPUTS LOAD FILE ERROR: " + err));
      return reject(err);
    }

    if ((inputsObj === undefined) || !inputsObj) {
      console.log(chalkError(MODULE_ID_PREFIX + " | DROPBOX INPUTS LOAD FILE ERROR | JSON UNDEFINED ??? "));
      return reject(new Error("JSON UNDEFINED"));
    }

    if (inputsObj.meta === undefined) {
      inputsObj.meta = {};
      inputsObj.meta.numInputs = 0;
      Object.keys(inputsObj.inputs).forEach(function(inputType){
        inputsObj.meta.numInputs += inputsObj.inputs[inputType].length;
      });
    }

    if (inputsHashMap.has(inputsObj.inputsId) && (params.entry === undefined)){

      params.entry = inputsHashMap.get(inputsObj.inputsId).entry;

    }

    inputsHashMap.set(inputsObj.inputsId, {entry: params.entry, inputsObj: inputsObj} );

    if (inputsNetworksHashMap[inputsObj.inputsId] === undefined) {
      inputsNetworksHashMap[inputsObj.inputsId] = new Set();
    }

    console.log(MODULE_ID_PREFIX + " | +++ INPUTS [" + inputsHashMap.size + " IN HM] | " + inputsObj.meta.numInputs + " INPUTS | " + inputsObj.inputsId);

    resolve(inputsObj);

  });
}


function loadInputsDropboxFolder(params){

  return new Promise(async function(resolve, reject){

    statsObj.status = "LOAD INPUTS";

    let folder = params.folder || defaultInputsFolder;

    console.log(chalkLog(MODULE_ID_PREFIX + " | LOADING DROPBOX INPUTS FOLDER | " + folder));

    let listDropboxFolderParams = {
      folder: params.folder,
      limit: DROPBOX_LIST_FOLDER_LIMIT
    };

    let skippedInputsFiles = 0;
    let dropboxFolderResults;

    try{
      dropboxFolderResults = await listDropboxFolder(listDropboxFolderParams);
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | ERROR LOADING DROPBOX INPUTS FOLDER | " + listDropboxFolderParams.folder + " | " + err));
      return reject(err);
    }

    console.log(chalkBlue(MODULE_ID_PREFIX + " | DROPBOX LIST INPUTS FOLDER"
      + " | ENTRIES: " + dropboxFolderResults.entries.length
      + " | PATH:" + listDropboxFolderParams.folder
    ));

    async.eachSeries(dropboxFolderResults.entries, async function(entry){

      debug(chalkInfo("entry: " + entry));

      const entryNameArray = entry.name.split(".");
      const entryInputsId = entryNameArray[0];

      let inputsObj;

      debug(chalkInfo(MODULE_ID_PREFIX + " | DROPBOX INPUTS FILE FOUND"
        + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
        + " | INPUTS ID: " + entryInputsId
        + " | " + entry.name
      ));

      if (configuration.testMode && (inputsHashMap.size >= TEST_DROPBOX_INPUTS_LOAD)){
        if (configuration.verbose) {
          console.log(chalkInfo(MODULE_ID_PREFIX + " | TEST MODE SKIP LOAD INPUTS SET | " + entryInputsId));
        }
        skippedInputsFiles += 1;
        return;
      }
      
      if (skipLoadInputsSet.has(entryInputsId)){
        if (configuration.verbose) {
          console.log(chalkInfo(MODULE_ID_PREFIX + " | INPUTS IN SKIP LOAD INPUTS SET ... SKIPPING LOAD OF " + entryInputsId));
        }
        skippedInputsFiles += 1;
        return;
      }
      
      if (!configuration.loadAllInputs && !configuration.inputsIdArray.includes(entryInputsId)){

        if (configuration.verbose){
          console.log(chalkInfo(MODULE_ID_PREFIX + " | DROPBOX INPUTS NOT IN INPUTS ID ARRAY ... SKIPPING"
            + " | " + entryInputsId
            + " | " + defaultInputsArchiveFolder + "/" + entry.name
          ));
        }

        skipLoadInputsSet.add(entryInputsId);
        skippedInputsFiles += 1;

        return;
      }
      
      if (inputsHashMap.has(entryInputsId)){

        let curInputsObj = inputsHashMap.get(entryInputsId);

        if ((curInputsObj.entry.content_hash !== entry.content_hash) && (curInputsObj.entry.path_display === entry.path_display)) {

          console.log(chalkInfo(MODULE_ID_PREFIX + " | DROPBOX INPUTS CONTENT CHANGE"
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
            + " | " + entry.name
            // + "\nCUR HASH: " + entry.content_hash
            // + "\nOLD HASH: " + curInputsObj.entry.content_hash
          ));
        }
        
        if ((curInputsObj.entry.content_hash !== entry.content_hash) && (curInputsObj.entry.path_display !== entry.path_display)) {

          console.log(chalkNetwork(MODULE_ID_PREFIX + " | DROPBOX INPUTS CONTENT DIFF IN DIFF FOLDERS"
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
            // + "\nCUR: " + entry.path_display
            // + "\nOLD: " + curInputsObj.entry.path_display
          ));

        }

      }

      await loadInputsDropboxFile({folder: folder, file: entry.name, entry: entry});

      return;

    }, function(err){

      if (skippedInputsFiles > 0) {
        console.log(chalkInfo(MODULE_ID_PREFIX + " | SKIPPED LOAD OF " + skippedInputsFiles + " INPUTS FILES | " + folder));
      }

      if (configuration.verbose) {
        printInputsHashMap();
      }

      resolve();
    });

  });

}

let userWatchPropertyArray = [
  "bannerImageUrl",
  "category", 
  "description",
  "expandedUrl",
  "followersCount", 
  "following", 
  "friendsCount", 
  "isTopTerm",
  "lastTweetId",
  "location",
  "profileUrl",
  "quotedStatusId",
  "statusesCount",
  "statusId",
  "threeceeFollowing",
  "url",
  "verified"
];

function userChanged(uOld, uNew){
  userWatchPropertyArray.forEach(function(prop){
    if (uOld[prop] !== uNew[prop]){
      return true;
    }
    return false;
  });
}


function encodeHistogramUrls(params){
  return new Promise(function(resolve, reject){

    let user = params.user;

    async.eachSeries(["profileHistograms", "tweetHistograms"], function(histogram, cb){

      let urls = objectPath.get(user, [histogram, "urls"]);

      if (urls) {

        debug("URLS\n" + jsonPrint(urls));

        async.eachSeries(Object.keys(urls), async function(url){

          if (validUrl.isUri(url)){
            const urlB64 = btoa(url);
            debug(chalkAlert("HISTOGRAM " + histogram + ".urls | " + url + " -> " + urlB64));
            urls[urlB64] = urls[url];
            delete urls[url];
            return;
          }

          if (url === "url") {
            debug(chalkAlert("HISTOGRAM " + histogram + ".urls | XXX URL: " + url));
            delete urls[url];
            return;
          }

          if (validUrl.isUri(atob(url))) {
            debug(chalkGreen("HISTOGRAM " + histogram + ".urls | IS B64: " + url));
            return;
          }

          debug(chalkAlert("HISTOGRAM " + histogram + ".urls |  XXX NOT URL NOR B64: " + url));
          delete urls[url];
          return;

        }, function(err){
          if (err) {
            console.log(chalkError(MODULE_ID_PREFIX + " | *** ENCODE HISTOGRAM URL ERROR: " + err));
            return cb(err);
          }
          // if (Object.keys(urls).length > 0){
          //   console.log("CONVERTED URLS\n" + jsonPrint(urls));
          // }
          user[histogram].urls = urls;
          cb();
        });

      }
      else {
        cb();
      }

    }, function(err){
      if (err) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ENCODE HISTOGRAM URL ERROR: " + err));
        return reject(err);
      }
      resolve(user);
    });

  });
}

function updateUserFromTrainingSet(params){

  return new Promise(async function(resolve, reject){

    let user = params.user;

    if ((user.userId === undefined) && (user.nodeId === undefined)) { 
      return reject (new Error("userId and nodeId undefined"));
    }

    debug(chalkLog("... UPDATING USER FROM TRAINING SET"
      + " | CM: " + printCat(user.category)
      + " | CA: " + printCat(user.categoryAuto)
      + " | @" + user.screenName
    ));

    if (user.nodeId && (user.userId === undefined)) { user.userId = user.nodeId; }
    if (user.userId && (user.nodeId === undefined)) { user.nodeId = user.userId; }

    try {
      user = await encodeHistogramUrls({user: user});
    }
    catch(err){
      return reject(err);
    }

    User.findOne({ nodeId: user.nodeId }).exec(function(err, userDb) {
      if (err) {
        console.log(chalkError("*** ERROR FIND ONE USER trainingSet: "
          + " | CM: " + printCat(user.category)
          + " | CA: " + printCat(user.categoryAuto)
          + " | UID: " + user.userId
          + " | @" + user.screenName
          + " | ERROR: " + err
        ));
        return reject(err);
      }
      
      if (!userDb){

        const newUser = new User(user);

        newUser.save()
        .then(function(updatedUser){

          console.log(chalkLog(MODULE_ID_PREFIX + " | +++ ADD NET USER FROM TRAINING SET  "
            + " | CM: " + printCat(updatedUser.category)
            + " | CA: " + printCat(updatedUser.categoryAuto)
            + " | UID: " + updatedUser.userId
            + " | @" + updatedUser.screenName
            + " | 3CF: " + updatedUser.threeceeFollowing
            + " | Ts: " + updatedUser.statusesCount
            + " | FLWRs: " + updatedUser.followersCount
            + " | FRNDS: " + updatedUser.friendsCount
          ));

          resolve(updatedUser);

        })
        .catch(function(err){
          console.log(MODULE_ID_PREFIX + " | ERROR: updateUserFromTrainingSet newUser: " + err.message);
          resolve();
        });


      }
      else if (userChanged(user, userDb)) {

        userDb.bannerImageUrl = user.bannerImageUrl;
        userDb.category = user.category;
        userDb.categoryAuto = user.categoryAuto;
        userDb.description = user.description;
        userDb.expandedUrl = user.expandedUrl;
        userDb.followersCount = user.followersCount;
        userDb.following = user.following;
        userDb.friends = user.friends;
        userDb.friendsCount = user.friendsCount;
        userDb.mentions = user.mentions;
        userDb.name = user.name;
        userDb.profileHistograms = user.profileHistograms;
        userDb.profileUrl = user.profileUrl;
        userDb.screenName = user.screenName;
        userDb.statusesCount = user.statusesCount;
        userDb.status = user.status;
        userDb.threeceeFollowing = user.threeceeFollowing;
        userDb.tweetHistograms = user.tweetHistograms;
        userDb.url = user.url;
        userDb.verified = user.verified;

        userdb.markModified("category");
        userdb.markModified("categoryAuto");
        userdb.markModified("profileHistograms");
        userdb.markModified("tweetHistograms");

        userDb.save()
        .then(function(updatedUser){

          console.log(chalkLog("+++ UPDATED USER FROM TRAINING SET  "
            + " | CM: " + printCat(userDb.category)
            + " | CA: " + printCat(userDb.categoryAuto)
            + " | UID: " + userDb.userId
            + " | @" + userDb.screenName
            + " | 3CF: " + userDb.threeceeFollowing
            + " | Ts: " + userDb.statusesCount
            + " | FLWRs: " + userDb.followersCount
            + " | FRNDS: " + userDb.friendsCount
          ));

          resolve(updatedUser);

        })
        .catch(function(err){
          console.log(MODULE_ID_PREFIX + " | ERROR: updateUserFromTrainingSet: " + err.message);
          return reject(err);
        });

      }
      else {

        if (configuration.verbose) {
          console.log(chalkLog(MODULE_ID_PREFIX + " | --- NO UPDATE USER FROM TRAINING SET"
            + " | CM: " + printCat(userDb.category)
            + " | CA: " + printCat(userDb.categoryAuto)
            + " | UID: " + userDb.userId
            + " | @" + userDb.screenName
            + " | 3CF: " + userDb.threeceeFollowing
            + " | Ts: " + userDb.statusesCount
            + " | FLWRs: " + userDb.followersCount
            + " | FRNDS: " + userDb.friendsCount
          ));
        }

        resolve(userDb);

      }
    });

  });

}

function updateDbNetwork(params) {

  return new Promise(function(resolve, reject){

    statsObj.status = "UPDATE DB NETWORKS";

    if (configuration.verbose) {
      printNetworkObj(MODULE_ID_PREFIX + " | [" + networkHashMap.size + "] >>> UPDATE NN DB", params.networkObj);
    }

    const networkObj = params.networkObj;
    const incrementTestCycles = (params.incrementTestCycles !== undefined) ? params.incrementTestCycles : false;
    const testHistoryItem = (params.testHistoryItem !== undefined) ? params.testHistoryItem : false;
    const addToTestHistory = (params.addToTestHistory !== undefined) ? params.addToTestHistory : true;
    const verbose = params.verbose || false;

    const query = { networkId: networkObj.networkId };

    let update = {};

    update["$setOnInsert"] = { 
      seedNetworkId: networkObj.seedNetworkId,
      seedNetworkRes: networkObj.seedNetworkRes,
      network: networkObj.network,
      successRate: networkObj.successRate, 
      numInputs: networkObj.numInputs,
      numOutputs: networkObj.numOutputs,
      inputsId: networkObj.inputsId,
      inputsObj: networkObj.inputsObj,
      outputs: networkObj.outputs,
      evolve: networkObj.evolve,
      test: networkObj.test
    };

    update["$set"] = { 
      matchRate: networkObj.matchRate, 
      overallMatchRate: networkObj.overallMatchRate,
    };

    if (incrementTestCycles) { update["$inc"] = { testCycles: 1 }; }
    
    if (testHistoryItem) { 
      update["$push"] = { testCycleHistory: testHistoryItem };
    }
    else if (addToTestHistory) {
      update["$addToSet"] = { testCycleHistory: { $each: networkObj.testCycleHistory } };
    }

    const options = {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    };

    NeuralNetwork.findOneAndUpdate(query, update, options, function(err, nnDbUpdated){

      if (err) {
        console.log(chalkError("*** updateDbNetwork | NETWORK FIND ONE ERROR: " + err));
        return reject(err);
      }

      if (verbose) { printNetworkObj(MODULE_ID_PREFIX + " | +++ NN DB UPDATED", nnDbUpdated); }

      resolve(nnDbUpdated);
    });

  });
}

function listDropboxFolders(params){

  return new Promise(function(resolve, reject){

    if (configuration.offlineMode) {
      dropboxClient = dropboxLocalClient;
    }
    else {
      dropboxClient = dropboxRemoteClient;
    }

    console.log(chalkNetwork(MODULE_ID_PREFIX + " | ... GETTING DROPBOX FOLDERS ENTRIES"
      + " | " + params.folders.length + " FOLDERS"
      + "\n" + jsonPrint(params.folders)
    ));

    let totalEntries = [];
    let promiseArray = [];

    params.folders.forEach(function(folder){

      const listDropboxFolderParams = {
        folder: folder,
        limit: DROPBOX_LIST_FOLDER_LIMIT
      };

      const p = listDropboxFolder(listDropboxFolderParams);
      promiseArray.push(p);

    });

    Promise.all(promiseArray)
    .then(function(results){
      results.forEach(function(folderListing){
        console.log(chalkLog(MODULE_ID_PREFIX + " | RESULTS | ENTRIES: "  + folderListing.entries.length));
        totalEntries = _.concat(totalEntries, folderListing.entries);
      });
      resolve(totalEntries);
    })
    .catch(function(err){
      reject(err);
    });

    // async.each(params.folders, async function(folder){

    //   debug(chalkNetwork(MODULE_ID_PREFIX + " | ... LOADING DROPBOX FOLDER | " + folder));

    //   let listDropboxFolderParams = {
    //     folder: folder,
    //     limit: DROPBOX_LIST_FOLDER_LIMIT
    //   };


    //   try {

    //     let entries = await listDropboxFolder(listDropboxFolderParams);

    //     totalEntries.push(entries);

    //     console.log(chalkLog("DROPBOX LIST FOLDER"
    //       + " | ENTRIES: " + entries.length
    //       + " | PATH:" + listDropboxFolderParams.folder
    //     ));

    //     return;

    //   }
    //   catch(err){
    //     console.log(chalkError(MODULE_ID_PREFIX + " | ERROR LOADING DROPBOX INPUTS FOLDER | " + listDropboxFolderParams.folder + " | " + err));
    //     return err;
    //   }

    // }, function(err, allEntries){
    //   if (err) {
    //     return reject(err);
    //   }
    //   const result = _.concat(totalEntries);
    //   resolve(allEntries);
    // });

  });
}

function validateNetwork(params){

  return new Promise(function(resolve, reject){

    if (!params || params === undefined || params.networkObj === undefined || params.networkId === undefined) {
      console.log(chalkError(MODULE_ID_PREFIX + " | validateNetwork *** PARAMS UNDEFINED ??? "));
      return reject(new Error("params undefined"));
    }

    let networkObj = params.networkObj;

    if (networkObj.networkId !== params.networkId) {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** NETWORK ID MISMATCH"
        + " | " + networkObj.networkId 
        + " | " + params.networkId
      ));
      return resolve();
      // return reject(new Error("NETWORK ID MISMATCH"));
    }

    if (networkObj.numInputs === undefined) {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** NETWORK NETWORK numInputs UNDEFINED"
        + " | " + networkObj.networkId
      ));
      return resolve();
      // return reject(new Error("NETWORK NUMBER OF INPUTS UNDEFINED"));
    }

    if (networkObj.inputsId === undefined) {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** NETWORK INPUTS ID UNDEFINED"
        + " | " + networkObj.networkId));
      return resolve();
      // return reject(new Error("NETWORK INPUTS ID UNDEFINED"));
    }

    let nnObj = networkDefaults(networkObj);

    resolve(nnObj);

  });
}


function checkNetworkHash(params){

  return new Promise(function(resolve, reject){

    if (!params || params === undefined || params.entry === undefined) {
      console.log(chalkError(MODULE_ID_PREFIX + " | checkNetworkHash *** PARAMS UNDEFINED ??? "));
      return reject(new Error("params undefined"));
    }

    let entry = params.entry;

    debug("entry\n" + jsonPrint(entry));

    if (entry.name === bestRuntimeNetworkFileName) {
      console.log(chalkInfo(MODULE_ID_PREFIX + " | ... SKIPPING LOAD OF " + entry.name));
      return ;
    }

    if (!entry.name.endsWith(".json")) {
      console.log(chalkInfo(MODULE_ID_PREFIX + " | ... SKIPPING LOAD OF " + entry.name));
      return ;
    }

    const entryNameArray = entry.name.split(".");
    const networkId = entryNameArray[0];

    if (!networkHashMap.has(networkId)){
      // console.log(chalkInfo(MODULE_ID_PREFIX + " | ... NOT IN HASH " + entry.name));
      return resolve("miss");
    }

    let networkObj = networkHashMap.get(networkId);
    let oldContentHash = false;

    if ((networkObj.entry.path_display === entry.path_display) 
      && (networkObj.entry !== undefined) && (networkObj.entry.content_hash !== undefined)){
      oldContentHash = networkObj.entry.content_hash;
    }

    if (oldContentHash && (oldContentHash !== entry.content_hash) 
      && (networkObj.entry.path_display === entry.path_display)) {

      console.log(chalkNetwork(MODULE_ID_PREFIX + " | DROPBOX NETWORK CONTENT CHANGE"
        + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
        + " | " + entry.path_display
      ));

      return resolve("stale");

    }
    
    if (oldContentHash && (oldContentHash !== entry.content_hash) 
      && (networkObj.entry.path_display !== entry.path_display)) {

      console.log(chalkNetwork(MODULE_ID_PREFIX + " | DROPBOX NETWORK CONTENT DIFF IN DIFF params.folders"
        + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
        // + "\nCUR: " + entry.path_display
        // + " | " + entry.content_hash
        // + "\nOLD: " + networkObj.entry.path_display
        // + " | " + networkObj.entry.content_hash
      ));

      return resolve("mismatch");

    }

    console.log(chalkLog(MODULE_ID_PREFIX + " | DROPBOX NETWORK CONTENT SAME  "
      + " | " + entry.name
      + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
      // + "\nCUR HASH: " + entry.content_hash
      // + "\nOLD HASH: " + oldContentHash
    ));

    resolve("same");

  });
}


function dropboxFileMove(params){

  return new Promise(function(resolve, reject){

    if (!params || !params.srcFolder || !params.srcFile || !params.dstFolder || !params.dstFile) {
      return reject(new Error("params undefined"));
    }

    const srcPath = params.srcFolder + "/" + params.srcFile;
    const dstPath = params.dstFolder + "/" + params.dstFile;

    dropboxClient.filesMoveV2({from_path: srcPath, to_path: dstPath})
    .then(function(response){
      console.log(chalkAlert(MODULE_ID_PREFIX + " | ->- DROPBOX FILE MOVE"
        + " | " + srcPath
        + " > " + dstPath
        // + " | RESPONSE\n" + jsonPrint(response)
      ));
      debug("dropboxClient filesMoveV2 response\n" + jsonPrint(response));
      return resolve();
    })
    .catch(function(err){
      if (err.status === 409) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR DROPBOX FILE MOVE"
          + " | STATUS: " + err.status
          + " | " + srcPath
          + " > " + dstPath
          + " | DOES NOT EXIST"
        ));
      }
      else if (err.status === 429) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR: XXX NN"
          + " | STATUS: " + err.status
          + " | " + srcPath
          + " > " + dstPath
          + " | TOO MANY REQUESTS"
        ));
      }
      else {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR: XXX NN"
          + " | STATUS: " + err.status
          + " | " + srcPath
          + " > " + dstPath
          + " | SUMMARY: " + err.response.statusText
          + "\n" + jsonPrint(err)
        ));
      }
      return reject(err);
    });

  });
}

function dropboxFileDelete(params){

  return new Promise(function(resolve, reject){

    if (!params || !params.folder || !params.file) {
      return reject(new Error("params undefined"));
    }

    const path = params.folder + "/" + params.file;

    dropboxClient.filesDelete({path: path})
    .then(function(response){
      console.log(chalkError(MODULE_ID_PREFIX + " | XXX DROPBOX FILE DELETE"
        + " | STATUS: " + err.status
        + " | " + path
      ));
      debug("dropboxClient filesDelete response\n" + jsonPrint(response));
      return resolve();
    })
    .catch(function(err){
      if (err.status === 409) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR DROPBOX FILE DELETE"
          + " | STATUS: " + err.status
          + " | PATH: " + path
          + " | DOES NOT EXIST"
        ));
      }
      else if (err.status === 429) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR: XXX NN"
          + " | STATUS: " + err.status
          + " | PATH: " + path
          + " | TOO MANY REQUESTS"
        ));
      }
      else {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR: XXX NN"
          + " | STATUS: " + err.status
          + " | PATH: " + path
          + " | SUMMARY: " + err.response.statusText
          + "\n" + jsonPrint(err)
        ));
      }
      return reject(err);
    });

  });
}

function networkPass(params) {
  const pass = ((params.folder === "/config/utility/best/neuralNetworks") && (params.networkObj.successRate > configuration.globalMinSuccessRate))
  || ((params.folder === "/config/utility/best/neuralNetworks") && (params.networkObj.matchRate > configuration.globalMinSuccessRate))
  || (params.purgeMin && (params.folder !== "/config/utility/best/neuralNetworks") && (params.networkObj.successRate > configuration.localPurgeMinSuccessRate))
  || (params.purgeMin && (params.folder !== "/config/utility/best/neuralNetworks") && (params.networkObj.matchRate > configuration.localPurgeMinSuccessRate))
  || (!params.purgeMin && (params.folder !== "/config/utility/best/neuralNetworks") && (params.networkObj.successRate > configuration.localMinSuccessRate))
  || (!params.purgeMin && (params.folder !== "/config/utility/best/neuralNetworks") && (params.networkObj.matchRate > configuration.localMinSuccessRate));

  return pass;
}

function loadBestNetworkDropboxFolders (params){

  return new Promise(async function(resolve, reject){

    if (configuration.offlineMode) {
      dropboxClient = dropboxLocalClient;
    }
    else {
      dropboxClient = dropboxRemoteClient;
    }

    let numNetworksLoaded = 0;
    let dropboxFoldersEntries;

    console.log(chalkNetwork(MODULE_ID_PREFIX + " | ... LOADING DROPBOX NETWORK FOLDERS"
      + " | " + params.folders.length + " FOLDERS"
      + "\n" + jsonPrint(params.folders)
    ));

    try {
      dropboxFoldersEntries = await listDropboxFolders(params);
    }
    catch(err){
      return reject(err);
    }

    if (configuration.testMode) {
      dropboxFoldersEntries = _.shuffle(dropboxFoldersEntries);
    }

    async.eachSeries(dropboxFoldersEntries, async function(entry){

      if (configuration.testMode && (numNetworksLoaded >= TEST_DROPBOX_NN_LOAD)) {
        return "TEST_MODE";
      }

      debug("entry\n" + jsonPrint(entry));

      if (entry.name === bestRuntimeNetworkFileName) {
        console.log(chalkInfo(MODULE_ID_PREFIX + " | ... SKIPPING LOAD OF " + entry.name));
        return ;
      }

      if (!entry.name.endsWith(".json")) {
        console.log(chalkInfo(MODULE_ID_PREFIX + " | ... SKIPPING LOAD OF " + entry.name));
        return ;
      }

      const folder = path.dirname(entry.path_display);

      const entryNameArray = entry.name.split(".");
      const networkId = entryNameArray[0];

      if (configuration.verbose) {
        console.log(chalkInfo(MODULE_ID_PREFIX + " | DROPBOX NETWORK FOUND"
          + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
          + " | " + networkId
          + " | FOLDER: " + folder
          + " | " + entry.name
        ));
      }

      if (skipLoadNetworkSet.has(networkId)){
        console.log(chalkInfo(MODULE_ID_PREFIX + " | DROPBOX NETWORK IN SKIP SET | SKIPPING ..."
          + " | " + networkId
          + " | FOLDER: " + folder
          + " | " + entry.name
        ));
        return ;
      }
      
      // console.log(chalkInfo(MODULE_ID_PREFIX + " | DROPBOX NETWORK IN *NOT* SKIP SET"
      //   + " | " + networkId
      //   + " | FOLDER: " + folder
      //   + " | " + entry.name
      // ));

      let networkObj;

      try {

        // console.log(chalkInfo(MODULE_ID_PREFIX + " | CHECK NETWORK HASH"
        //   + " | " + networkId
        //   + " | FOLDER: " + folder
        //   + " | " + entry.name
        // ));

        const networkHashResult = await checkNetworkHash({entry: entry});

        // console.log(chalkInfo(MODULE_ID_PREFIX + " | CHECK NETWORK HASH RESULT: " + networkHashResult
        //   + " | " + networkId
        //   + " | FOLDER: " + folder
        //   + " | " + entry.name
        // ));

        if (networkHashResult === "same"){ // no change
          console.log(chalkInfo(MODULE_ID_PREFIX + " | NN NO CHANGE"
            + " | " + networkId
            + " | FOLDER: " + folder
            + " | " + entry.name
          ));
          return;
        }

        networkObj = await loadFileRetry({path: entry.path_display});

        // printNetworkObj(MODULE_ID_PREFIX + " | LOADED DROPBOX NETWORK", networkObj);

        networkObj = await validateNetwork({networkId: networkId, networkObj: networkObj});

        // printNetworkObj(MODULE_ID_PREFIX + " | VALIDATED DROPBOX NETWORK", networkObj);

        // invalid networkObj
        if (!networkObj) {  
          await purgeNetwork(networkId);
          return;
        }

        // load only networks using specific inputIds; maybe delete if not in set
        if (!configuration.inputsIdArray.includes(networkObj.inputsId)) {

          if (configuration.archiveNotInInputsIdArray && (entry.path_display.toLowerCase().includes(localBestNetworkFolder.toLowerCase()))){
            console.log(chalkInfo(MODULE_ID_PREFIX + " | 000 NN INPUTS NOT IN INPUTS ID ARRAY ... ARCHIVING"
              + " | NUM INPUTS: " + networkObj.numInputs
              + " | INPUTS ID: " + networkObj.inputsId
              + " | " + entry.path_display
            ));
            await dropboxFileMove({srcFolder: localBestNetworkFolder, srcFile: entry.name, dstFolder: localArchiveNetworkFolder, dstFile: entry.name});
            return;
          }
          else if (configuration.deleteNotInInputsIdArray){
            console.log(chalkInfo(MODULE_ID_PREFIX + " | XXX NN INPUTS NOT IN INPUTS ID ARRAY ... DELETING"
              + " | NUM INPUTS: " + networkObj.numInputs
              + " | INPUTS ID: " + networkObj.inputsId
              + " | " + entry.path_display
            ));
            await dropboxFileDelete({folder: localBestNetworkFolder, file: entry.name});
            return;
          }

          console.log(chalkInfo(MODULE_ID_PREFIX + " | --- NN INPUTS NOT IN INPUTS ID ARRAY ... SKIPPING"
            + " | NUM INPUTS: " + networkObj.numInputs
            + " | INPUTS ID: " + networkObj.inputsId
            + " | " + entry.path_display
          ));

          skipLoadNetworkSet.add(networkObj.networkId);
          throw err;
          return;
        }

        // printNetworkObj(MODULE_ID_PREFIX + " | 0 | DROPBOX NETWORK", networkObj);

        //========================
        // SAVE LOCAL NETWORK TO GLOBAL
        //========================

        if (!networkHashMap.has(networkObj.networkId) 
          && ((networkObj.successRate >= configuration.globalMinSuccessRate) 
          || (networkObj.overallMatchRate >= configuration.globalMinSuccessRate))) {

          networkHashMap.set(networkObj.networkId, { entry: entry, networkObj: networkObj});

          printNetworkObj(MODULE_ID_PREFIX + " | SAVE LOCAL NETWORK TO GLOBAL", networkObj, chalkGreen);

          saveFileQueue.push({localFlag: false, folder: globalBestNetworkFolder, file: entry.name, obj: networkObj});
        }

        // printNetworkObj(MODULE_ID_PREFIX + " | 1 | DROPBOX NETWORK", networkObj);

        //========================
        // NETWORK MISMATCH GLOBAL/LOCAL
        //========================

        if (networkHashResult === "mismatch"){
          console.log(chalkNetwork(MODULE_ID_PREFIX + " | DROPBOX GLOBAL/LOCAL NETWORK MISMATCH ... DELETING"
            + " | INPUTS: " + networkObj.numInputs
            + " | INPUTS ID: " + networkObj.inputsId
            + " | " + entry.path_display
          ));
          await dropboxFileDelete({folder: localBestNetworkFolder, file: entry.name});
          return;
        }

        // printNetworkObj(MODULE_ID_PREFIX + " | 2 | DROPBOX NETWORK", networkObj);

        //========================
        // NETWORK PASS SUCCESS or MATCH MIN
        //========================

        const passed = networkPass({folder: folder, purgeMin: params.purgeMin, networkObj: networkObj});

        if (passed) {

          numNetworksLoaded += 1;

          networkHashMap.set(networkObj.networkId, { entry: entry, networkObj: networkObj});

          printNetworkObj(MODULE_ID_PREFIX + " | +++ NN HASH MAP [" + numNetworksLoaded + " LOADED / " + networkHashMap.size + " IN HM]", networkObj);

          if (!currentBestNetwork || (networkObj.overallMatchRate > currentBestNetwork.overallMatchRate)) {
            currentBestNetwork = networkObj;
            printNetworkObj(MODULE_ID_PREFIX + " | *** NEW BEST NN", networkObj, chalkGreen);
          }

          //========================
          // UPDATE INPUTS HASHMAP
          //========================

          let inObj = {};

          if (inputsHashMap.has(networkObj.inputsId)) {
            inObj = inputsHashMap.get(networkObj.inputsId);
            inObj.inputsObj = networkObj.inputsObj;
            inObj.entry.content_hash = false;
            inObj.entry.client_modified = moment();
          }
          else {
            inObj.inputsObj = {};
            inObj.inputsObj = networkObj.inputsObj;
            inObj.entry = {};
            inObj.entry.name = networkObj.inputsId + ".json";
            inObj.entry.content_hash = false;
            inObj.entry.client_modified = moment();
          }

          inputsHashMap.set(networkObj.inputsId, inObj);

          if (inputsNetworksHashMap[networkObj.inputsId] === undefined) {
            inputsNetworksHashMap[networkObj.inputsId] = new Set();
          }

          inputsNetworksHashMap[networkObj.inputsId].add(networkObj.networkId);

          //========================
          // UPDATE DB
          //========================
          let nnDb;

          try {
            nnDb = await updateDbNetwork({networkObj: networkObj, addToTestHistory: true});
          }
          catch(err){
            console.log(chalkError("*** ERROR: DB NN FIND ONE ERROR | "+ networkObj.networkId + " | " + err));
            return err;
          }

          if (nnDb) {

            if (!currentBestNetwork || (nnDb.overallMatchRate > currentBestNetwork.overallMatchRate)) {
              currentBestNetwork = nnDb;
              printNetworkObj(MODULE_ID_PREFIX + " | *** NEW BEST NN (DB)", nnDb, chalkGreen);
            }

            networkHashMap.set(nnDb.networkId, { entry: entry, networkObj: nnDb});
            // printNetworkObj(MODULE_ID_PREFIX + " | >>> NN DB UPDATE [" + numNetworksLoaded + " LOADED / " + networkHashMap.size + " IN HM]", nnDb);
          }

          // if (!currentBestNetwork || (networkObj.overallMatchRate > currentBestNetwork.overallMatchRate)) {
          //   currentBestNetwork = networkObj;
          //   printNetworkObj(MODULE_ID_PREFIX + " | * NEW BEST NN", networkObj);
          // }

          return;
        }

        // printNetworkObj(MODULE_ID_PREFIX + " | 3 | DROPBOX NETWORK", networkObj);

        //========================
        // PURGE FAILING NETWORKS
        //========================

        if (((hostname === "google") && (folder === globalBestNetworkFolder))
          || ((hostname !== "google") && (folder === localBestNetworkFolder)) ) {

          printNetworkObj(MODULE_ID_PREFIX + " | DELETING NN", networkObj);

          await purgeNetwork(networkObj.networkId);
          await purgeInputs(networkObj.inputsId);
          await dropboxFileDelete({folder: localBestNetworkFolder, file: entry.name});
          return;
        }

        printNetworkObj(MODULE_ID_PREFIX + " | --- NN HASH MAP [" + numNetworksLoaded + " LOADED / " + networkHashMap.size + " IN HM]", nnDb);

        return;
      }
      catch(err){
        return err;
      }

    }, function(err){
      if (err) { 
        if (err == "TEST_MODE") {
          console.log(chalkInfo(MODULE_ID_PREFIX + " | !!! TEST MODE | LOADED " + numNetworksLoaded + " NNs"));
          return resolve(numNetworksLoaded);
        }
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR LOAD DROPBOX FOLDERS: " + err)); 
        return reject(err);
      }
      resolve(numNetworksLoaded);
    });

  });
}

function loadSeedNeuralNetwork(params){

  return new Promise(async function(resolve, reject){

    statsObj.status = "LOAD NEURAL NETWORKS";

    console.log(chalkNetwork(MODULE_ID_PREFIX + " | LOADING SEED NETWORKS FROM DROPBOX ..."));

    let numNetworksLoaded = 0;

    try{
      numNetworksLoaded = await loadBestNetworkDropboxFolders(params);
      console.log(chalkBlueBold(MODULE_ID_PREFIX + " | LOADED " + numNetworksLoaded + " NETWORKS"));
      printNetworkObj(MODULE_ID_PREFIX + " | BEST NETWORK", currentBestNetwork, chalkBlueBold);
      currentBestNetwork
    }
    catch(err){
      if (err.status === 429) {
        console.log(chalkError(MODULE_ID_PREFIX + " | LOAD DROPBOX NETWORKS ERR"
          + " | FOLDERS: " + params.folders
          + " | STATUS: " + err.status
          + " | TOO MANY REQUESTS"
        ));
      }
      else {
        console.log(chalkError(MODULE_ID_PREFIX + " | LOAD DROPBOX NETWORKS ERR"
          + " | FOLDERS: " + params.folders
          + " | STATUS: " + err.status
          + " | ERROR: " + err
        ));
      }
      return reject(err);
    }


    if (numNetworksLoaded === 0){

      if (configuration.verbose){

        sortedHashmap({ sortKey: "networkObj.overallMatchRate", hashmap: networkHashMap, max: 500})
        .then(function(sortedBestNetworks){

          let tableArray = [];

          tableArray.push([
            MODULE_ID_PREFIX + " | ",
            "TC",
            "TCH",
            "OAMR %",
            "MR %",
            "SR %",
            "INPUTS",
            "INPUTS ID",
            "NNID"
          ]);

          sortedBestNetworks.sortedKeys.forEach(function(networkId){

            if (networkHashMap.has(networkId)) {

              const nn = networkHashMap.get(networkId).networkObj;

              if ((nn.overallMatchRate === undefined) || (nn.matchRate === undefined) || (nn.successRate === undefined)) {
                console.log(chalkAlert("BEST NETWORK UNDEFINED RATE"
                  + " | " + networkId
                  + " | OAMR: " + nn.overallMatchRate
                  + " | MR: " + nn.matchRate
                  + " | SR: " + nn.successRate
                ));
              }

              tableArray.push([
                MODULE_ID_PREFIX + " | ",
                nn.testCycles,
                nn.testCycleHistory.length,
                nn.overallMatchRate.toFixed(2),
                nn.matchRate.toFixed(2),
                nn.successRate.toFixed(2),
                nn.numInputs,
                nn.inputsId,
                networkId
              ]);
            }
            else {
              console.log(chalkAlert("BEST NETWORK NOT IN HASHMAP??"
                + " | " + networkId
              ));
            }
          });

          const t = table(tableArray, { align: ["l", "r", "r", "r", "r", "r", "r", "l", "l"] });

          console.log(MODULE_ID_PREFIX + " | ============================================================================================================================================");
          console.log(chalkLog(MODULE_ID_PREFIX + " | ... NO BEST NETWORKS CHANGED / LOADED | NNs IN HM: " + sortedBestNetworks.sortedKeys.length));
          if (configuration.verbose) { console.log(t); }
          console.log(MODULE_ID_PREFIX + " | ============================================================================================================================================");

        })
        .catch(function(err){
          console.trace(chalkError("generateRandomEvolveConfig sortedHashmap ERROR: " + err + "/" + jsonPrint(err)));
          return reject(err);
        });
      }

      return resolve(numNetworksLoaded);
    }


    sortedHashmap({ sortKey: "networkObj.overallMatchRate", hashmap: networkHashMap, max: 500})
    .then(function(sortedBestNetworks){

      let tableArray = [];

      tableArray.push([
        MODULE_ID_PREFIX + " | ",
        "TCs",
        "TCH",
        "OAMR %",
        "MR %",
        "SR %",
        "INPUTS",
        "INPUTS ID",
        "NNID"
      ]);

      let nn;

      async.eachSeries(sortedBestNetworks.sortedKeys, function(networkId, cb){

        if (networkHashMap.has(networkId)) {

          nn = networkHashMap.get(networkId).networkObj;

          if ((nn.overallMatchRate === undefined) || (nn.matchRate === undefined) || (nn.successRate === undefined)) {
            console.log(chalkAlert("BEST NETWORK UNDEFINED RATE"
              + " | " + networkId
              + " | OAMR: " + nn.overallMatchRate
              + " | MR: " + nn.matchRate
              + " | SR: " + nn.successRate
            ));
          }

          tableArray.push([
            MODULE_ID_PREFIX + " | ",
            nn.testCycles,
            nn.testCycleHistory.length,
            nn.overallMatchRate.toFixed(2),
            nn.matchRate.toFixed(2),
            nn.successRate.toFixed(2),
            nn.numInputs,
            nn.inputsId,
            networkId
          ]);

          async.setImmediate(function() { cb(); });
        }
        else {
          async.setImmediate(function() { cb(); });
        }

      }, function(){

        const t = table(tableArray, { align: ["l", "r", "r", "r", "r", "r", "r", "l", "l"] });

        console.log(MODULE_ID_PREFIX + " | ============================================================================================================================================");
        console.log(chalkInfo(MODULE_ID_PREFIX + " | +++ BEST NETWORKS CHANGED / LOADED | NNs IN HM: " + sortedBestNetworks.sortedKeys.length));
        console.log(t);
        console.log(MODULE_ID_PREFIX + " | ============================================================================================================================================");

      });
    })
    .catch(function(err){
      console.trace(chalkError("generateRandomEvolveConfig sortedHashmap ERROR: " + err + "/" + jsonPrint(err)));
      return reject(err);
    });

    resolve(numNetworksLoaded);
    
  });

}

function activateNetwork(n, input){
  const output = n.activate(input);
  return output;
}

function unzipUsersToArray(params){

  console.log(chalkBlue(MODULE_ID_PREFIX + " | UNZIP USERS TO TRAINING SET: " + params.path));

  return new Promise(async function(resolve, reject) {

    try {

      yauzl.open(params.path, {lazyEntries: true}, function(err, zipfile) {

        if (err) {
          return reject(err);
        }

        zipfile.on("error", async function(err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** UNZIP ERROR: " + err));
          reject(err);
        });

        zipfile.on("close", async function() {
          console.log(chalkLog(MODULE_ID_PREFIX + " | UNZIP CLOSE"));
          resolve(true);
        });

        zipfile.on("end", async function() {
          console.log(chalkLog(MODULE_ID_PREFIX + " | UNZIP END"));
          resolve(true);
        });

        let hmHit = MODULE_ID_PREFIX + " | --> UNZIP";

        zipfile.on("entry", function(entry) {
          
          if (/\/$/.test(entry.fileName)) { 
            zipfile.readEntry(); 
          } 
          else {
            zipfile.openReadStream(entry, async function(err, readStream) {

              if (err) {
                return reject(err);
              }

              let userString = "";
              let percent = 0;

              statsObj.users.zipHashMapHit = 0;
              statsObj.users.zipHashMapMiss = 0;
              statsObj.users.unzipped = 0;

              readStream.on("end", async function() {

                try {
                  const fileObj = JSON.parse(userString);

                  if (entry.fileName.endsWith("maxInputHashMap.json")) {

                    console.log(chalkLog(MODULE_ID_PREFIX + " | UNZIPPED MAX INPUT"));

                    userMaxInputHashMap = fileObj.maxInputHashMap;
                  }
                  else {

                    statsObj.users.unzipped += 1;

                    hmHit = MODULE_ID_PREFIX + " | --> UNZIP";

                    if (trainingSetUsersHashMap.has(fileObj.userId)) {
                      hmHit = MODULE_ID_PREFIX + " | **> UNZIP";
                      statsObj.users.zipHashMapHit += 1;
                    }
                    else {
                      statsObj.users.zipHashMapMiss += 1;
                    }

                    percent = 100*(statsObj.users.zipHashMapHit/statsObj.users.unzipped);

                    let dbUser = await updateUserFromTrainingSet({user: fileObj});

                    if (dbUser && dbUser !== undefined) {


                      trainingSetUsersHashMap.set(dbUser.nodeId, dbUser);

                      if (dbUser && (configuration.verbose || (statsObj.users.unzipped % 1000 === 0))) {

                        console.log(chalkLog(hmHit
                          + " | " + trainingSetUsersHashMap.size + " USERS IN HM"
                          + " [ ZipHM: " + statsObj.users.zipHashMapMiss 
                          + " MISS / " + statsObj.users.zipHashMapHit 
                          + " HIT (" + percent.toFixed(2) + "%) ]"
                          + " | " + statsObj.users.unzipped + " UNZPD ]"
                          + " 3C: " + dbUser.threeceeFollowing
                          + " | " + dbUser.userId
                          + " | @" + dbUser.screenName
                          + " | " + dbUser.name
                          + " | FLWRs: " + dbUser.followersCount
                          + " | FRNDs: " + dbUser.friendsCount
                          + " | CAT M: " + dbUser.category + " A: " + dbUser.categoryAuto
                          // + "\n" + jsonPrint(fileObj)
                        ));
                      }

                    }

                  }

                  zipfile.readEntry();
                }
                catch (err){
                  console.log(chalkError(MODULE_ID_PREFIX + " | *** UNZIP READ STREAM ERROR: " + err));
                  return reject(err);
                }
              });

              readStream.on("data",function(chunk){
                let part = chunk.toString();
                userString += part;
              });

              readStream.on("close", async function(){
                console.log(chalkInfo(MODULE_ID_PREFIX + " | UNZIP STREAM CLOSED | TRAINING SET USERS HM SIZE: " + trainingSetUsersHashMap.size));
                resolve();
              });

              readStream.on("error",async function(err){
                console.log(chalkError(MODULE_ID_PREFIX + " | *** UNZIP READ STREAM ERROR EVENT: " + err));
                reject(err);
              });
            });
          }
        });

        zipfile.readEntry();

      });

    }
    catch(err){
      console.error(chalkError(MODULE_ID_PREFIX + " | *** USER ARCHIVE READ ERROR: " + err));
      return reject(new Error("USER ARCHIVE READ ERROR"));
    }

  });
}

function updateTrainingSet(params){

  console.log(chalkBlue(MODULE_ID_PREFIX + " | UPDATE TRAINING SET"));

  return new Promise(function(resolve, reject) {

    let tObj = {};

    if (trainingSetHashMap.has(configuration.globalTrainingSetId)) {
      tObj = trainingSetHashMap.get(configuration.globalTrainingSetId);
      console.log(chalkInfo(MODULE_ID_PREFIX + " | +++ TRAINING SET HM HIT: " + tObj.trainingSetObj.trainingSetId));
    }
    else {

      console.log(chalkInfo(MODULE_ID_PREFIX + " | --- TRAINING SET HM MISS: " + configuration.globalTrainingSetId + " ... CREATING..."));

      tObj.trainingSetObj = {};

      tObj.trainingSetObj.trainingSetId = configuration.globalTrainingSetId;

      tObj.trainingSetObj.meta = {};
      tObj.trainingSetObj.meta.numInputs = 0;
      tObj.trainingSetObj.meta.numOutputs = 3;
      tObj.trainingSetObj.trainingSet = {};
      tObj.trainingSetObj.trainingSet.meta = {};
      tObj.trainingSetObj.trainingSet.meta.numInputs = 0;
      tObj.trainingSetObj.trainingSet.meta.numOutputs = 3;
      tObj.trainingSetObj.trainingSet.meta.setSize = 0;
      tObj.trainingSetObj.trainingSet.data = [];

      tObj.trainingSetObj.testSet = {};
      tObj.trainingSetObj.testSet.meta = {};
      tObj.trainingSetObj.testSet.meta.numInputs = 0;
      tObj.trainingSetObj.testSet.meta.numOutputs = 3;
      tObj.trainingSetObj.testSet.meta.setSize = 0;
      tObj.trainingSetObj.testSet.data = [];

      tObj.trainingSetObj.maxInputHashMap = {};
    }

    const testSetSize = parseInt(configuration.testSetRatio * trainingSetUsersHashMap.size);

    tObj.trainingSetObj.trainingSet.data = trainingSetUsersHashMap.values().slice(testSetSize);
    tObj.trainingSetObj.trainingSet.meta.setSize = tObj.trainingSetObj.trainingSet.data.length;

    tObj.trainingSetObj.testSet.data = trainingSetUsersHashMap.values().slice(0, testSetSize-1);
    tObj.trainingSetObj.testSet.meta.setSize = tObj.trainingSetObj.testSet.data.length;


    tObj.trainingSetObj.maxInputHashMap = userMaxInputHashMap;

    console.log(chalkLog(MODULE_ID_PREFIX + " | TRAINING SET"
      + " | SIZE: " + tObj.trainingSetObj.trainingSet.meta.setSize
      + " | TEST SIZE: " + tObj.trainingSetObj.testSet.meta.setSize
    ));

    trainingSetHashMap.set(tObj.trainingSetObj.trainingSetId, tObj);

    resolve();

  });
}

let sizeInterval;

function fileSize(params){

  return new Promise(async function(resolve, reject){

    clearInterval(sizeInterval);

    let interval = params.interval || ONE_MINUTE;

    console.log(chalkLog(MODULE_ID_PREFIX + " | WAIT FILE SIZE: " + params.path + " | EXPECTED SIZE: " + params.size));

    let stats;
    let size;
    let prevSize;

    try {
      stats = fs.statSync(params.path);
      size = stats.size;
      prevSize = stats.size;

      if (params.size && (size === params.size)) {
        console.log(chalkInfo(MODULE_ID_PREFIX + " | FILE SIZE EXPECTED | " + getTimeStamp()
          + " | CUR: " + size
          + " | EXPECTED: " + params.size
        ));
        return resolve();
      }
    }
    catch(err){
      return reject(err);
    }


    sizeInterval = setInterval(async function(){

      console.log(chalkInfo(MODULE_ID_PREFIX + " | FILE SIZE | " + getTimeStamp()
        + " | CUR: " + size
        + " | PREV: " + prevSize
        + " | EXPECTED: " + params.size
      ));

      fs.stat(params.path, function(err, stats){

        if (err) {
          return reject(err);
        }

        prevSize = size;
        size = stats.size;

        if ((size > 0) && ((params.size && (size === params.size)) || (size === prevSize))) {

          clearInterval(sizeInterval);

          console.log(chalkInfo(MODULE_ID_PREFIX + " | FILE SIZE STABLE | " + getTimeStamp()
            + " | CUR: " + size
            + " | PREV: " + prevSize
            + " | EXPECTED: " + params.size
          ));

          resolve();
        }

      });

    }, interval);

  });
}

function loadUsersArchive(params){

  return new Promise(async function(resolve, reject){

    console.log(chalkLog(MODULE_ID_PREFIX + " | LOADING USERS ARCHIVE | " + getTimeStamp() + " | " + params.path));

    try {
      // const fileOpen = await checkFileOpen(params);
      await fileSize(params);
      const unzipSuccess = await unzipUsersToArray(params);
      await updateTrainingSet();
      resolve();
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD USERS ARCHIVE ERROR | " + getTimeStamp() + " | " + err));
      reject(err);
    }

  });
}

let watchOptions = {
  ignoreDotFiles: true,
  ignoreUnreadableDir: true,
  ignoreNotPermitted: true,
}

function initWatch(params){

  console.log(chalkLog(MODULE_ID_PREFIX + " | INIT WATCH\n" + jsonPrint(params)));

  watch.createMonitor(params.rootFolder, watchOptions, function (monitor) {

    const loadArchive = async function (f, stat) {

      console.log(chalkInfo(MODULE_ID_PREFIX + " | +++ FILE CREATED or CHANGED | " + getTimeStamp() + " | " + f));

      if (f.endsWith(configuration.defaultUserArchiveFlagFile)){

        console.log(chalkLog(MODULE_ID_PREFIX + " | LOAD USER ARCHIVE FLAG FILE: " + params.rootFolder + "/" + configuration.defaultUserArchiveFlagFile));

        loadFileRetry({folder: configuration.userArchiveFolder, file: configuration.defaultUserArchiveFlagFile}, async function(err, archiveFlagObj){

          console.log(chalkLog(MODULE_ID_PREFIX + " | USER ARCHIVE FLAG FILE | PATH: " + archiveFlagObj.path + " | SIZE: " + archiveFlagObj.size));

          // const fullLocalPath = (hostname === "google") ? "/home/tc/Dropbox/Apps/wordAssociation" + archiveFlagObj.path : "/Users/tc/Dropbox/Apps/wordAssociation" + archiveFlagObj.path;

          try {
            await loadTrainingSet({folder: configuration.userArchiveFolder, file: configuration.defaultUserArchiveFlagFile});
          }
          catch(err){
            console.log(chalkError(MODULE_ID_PREFIX + " | *** WATCH CHANGE ERROR | " + getTimeStamp() + " | " + err));
          }

        });

      }
    };

    monitor.on("created", loadArchive);

    monitor.on("changed", loadArchive);

    monitor.on("removed", function (f, stat) {
      console.log(chalkInfo(MODULE_ID_PREFIX + " | XXX FILE DELETED | " + getTimeStamp() + " | " + f));
    });

    // monitor.stop(); // Stop watching
  });
}

function initCategorizedUserHashmap(params){

  return new Promise(function(resolve, reject){

    statsObj.status = "INIT CATEGORIZED USER HASHMAP";

    // const query = (params.query) ? params.query : { $or: [ { "category": { $nin: [ false, null ] } } , { "categoryAuto": { $nin: [ false, null ] } } ] };

    let p = {};

    p.skip = 0;
    p.limit = DEFAULT_FIND_CAT_USER_CURSOR_LIMIT;
    p.batchSize = DEFAULT_CURSOR_BATCH_SIZE;
    p.query = { 
      "category": { "$nin": [ false, null ] } 
    };

    let more = true;
    let totalCount = 0;
    let totalManual = 0;
    let totalAuto = 0;
    let totalMatched = 0;
    let totalMismatched = 0;
    let totalMatchRate = 0;

    async.whilst(

      function() {
        return more;
      },

      function(cb){

        userServerController.findCategorizedUsersCursor(p, function(err, results){

          if (err) {
            console.error(chalkError(MODULE_ID_PREFIX + " | ERROR: initCategorizedUserHashmap: " + err));
            cb(err);
          }
          else if (results) {

            more = true;
            totalCount += results.count;
            totalManual += results.manual;
            totalAuto += results.auto;
            totalMatched += results.matched;
            totalMismatched += results.mismatched;

            totalMatchRate = 100*(totalMatched/totalCount);

            Object.keys(results.obj).forEach(function(nodeId){
              categorizedUserHashmap.set(nodeId, results.obj[nodeId]);
            });

            if (configuration.verbose || (totalCount % 1000 === 0)) {

              console.log(chalkLog(MODULE_ID_PREFIX + " | LOADING CATEGORIZED USERS FROM DB"
                + " | TOTAL CATEGORIZED: " + totalCount
                + " | LIMIT: " + p.limit
                + " | SKIP: " + p.skip
                + " | " + totalManual + " MAN"
                + " | " + totalAuto + " AUTO"
                + " | " + totalMatched + " MATCHED"
                + " / " + totalMismatched + " MISMATCHED"
                + " | " + totalMatchRate.toFixed(2) + "% MATCHRATE"
              ));

            }

            p.skip += results.count;

            cb();
          }
          else {

            more = false;

            console.log(chalkLog(MODULE_ID_PREFIX + " | LOADING CATEGORIZED USERS FROM DB"
              + " | TOTAL CATEGORIZED: " + totalCount
              + " | LIMIT: " + p.limit
              + " | SKIP: " + p.skip
              + " | " + totalManual + " MAN"
              + " | " + totalAuto + " AUTO"
              + " | " + totalMatched + " MATCHED"
              + " / " + totalMismatched + " MISMATCHED"
              + " | " + totalMatchRate.toFixed(2) + "% MATCHRATE"
            ));

            cb();
          }

        });
      },

      function(err){
        if (err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | INIT CATEGORIZED USER HASHMAP ERROR: " + err + "\n" + jsonPrint(err)));
          return reject(err);
        }
        resolve();
      }
    );

  });

}

function archiveUsers(){

  return new Promise(function(resolve, reject){

    if (archive === undefined) { return reject(err); }

    async.each(trainingSetUsersHashMap.values(), function(user, cb){
      const userFile = "user_" + user.userId + ".json";
      const userBuffer = Buffer.from(JSON.stringify(user));
      archive.append(userBuffer, { name: userFile });
      cb();
    }, function(err){
      resolve();
    });


  });
}

async function generateGlobalTrainingTestSet (userHashMap, maxInputHashMap, callback){

  statsObj.status = "GENERATE TRAINING SET";

  console.log(chalkBlueBold(MODULE_ID_PREFIX + " | ==================================================================="));
  console.log(chalkBlueBold(MODULE_ID_PREFIX + " | GENERATE TRAINING SET | " + trainingSetUsersHashMap.size + " USERS | " + getTimeStamp()));
  console.log(chalkBlueBold(MODULE_ID_PREFIX + " | ==================================================================="));

  try {

    await initArchiver({outputFile: configuration.defaultUserArchivePath});
    await archiveUsers();

    let mihmObj = {};

    mihmObj.maxInputHashMap = {};
    mihmObj.maxInputHashMap = maxInputHashMap;

    mihmObj.normalization = {};
    mihmObj.normalization = statsObj.normalization;

    const buf = Buffer.from(JSON.stringify(mihmObj));

    archive.append(buf, { name: "maxInputHashMap.json" });

    archive.finalize();

    let waitArchiveDoneInterval;

    waitArchiveDoneInterval = setInterval(async function(){

      if (!statsObj.archiveOpen) {

        clearInterval(waitArchiveDoneInterval);

        setTimeout(async function(){
          console.log(chalkBlueBold(MODULE_ID_PREFIX + " | ARCHIVE | DONE"));
          callback();
        }, 30*ONE_SECOND);

      }
      else {
        console.log(chalkLog(MODULE_ID_PREFIX + " | ARCHIVE | WAIT DONE"
          + " | ARCHIVE OPEN: " + statsObj.archiveOpen
        ));
      }

    }, 5000);

  }
  catch(err){
    console.log(chalkLog(MODULE_ID_PREFIX + " | *** ARCHIVE ERROR: " + err));
    throw err;
  }
}

function generateRandomEvolveConfig (params){

  return new Promise(async function(resolve, reject){

    statsObj.status = "GENERATE EVOLVE CONFIG";

    let config = {};
    config.networkCreateMode = "evolve";

    debug(chalkLog(MODULE_ID_PREFIX + " | NETWORK CREATE MODE: " + config.networkCreateMode));

    let sortedBestNetworks;
    try{

      sortedBestNetworks = await sortedHashmap({ sortKey: "networkObj.overallMatchRate", hashmap: networkHashMap, max: 500});

      if (configuration.verbose) {
        console.log(chalkLog("\nTNN | BEST NETWORKS\nTNN | --------------------------------------------------------"));
        console.log(chalkLog(MODULE_ID_PREFIX + " | NNs IN HM: " + sortedBestNetworks.sortedKeys.length));
        sortedBestNetworks.sortedKeys.forEach(function(networkId){
          const nn = networkHashMap.get(networkId).networkObj;
          printNetworkObj("TNN", nn);
        });
      }
      console.log(chalkLog(MODULE_ID_PREFIX + " | --------------------------------------------------------"));
    }
    catch(err){
      console.trace(chalkError("generateRandomEvolveConfig SORTER ERROR: " + err));
      return reject(err);
    }

    //
    // if available use better child as seed nn
    //
    if (betterChildSeedNetworkIdSet.size > 0) {

      config.seedNetworkId = betterChildSeedNetworkIdSet.keys().next().value;
      config.isBetterChildSeed = true;

      betterChildSeedNetworkIdSet.delete(config.seedNetworkId);

      console.log(chalkBlueBold(MODULE_ID_PREFIX + " | USING BETTER CHILD SEED"
        + " [" + betterChildSeedNetworkIdSet.size + "] SEED: " + config.seedNetworkId
      ));
    }
    else {
      config.seedNetworkId = (Math.random() <= configuration.seedNetworkProbability) ? randomItem(networkHashMap.keys()) : false;
      config.isBetterChildSeed = false;
    }
    
    // seedInputsId only used if seedNetworkId == false

    const inputsHashMapKeys = inputsHashMap.keys();

    console.log(chalkLog(MODULE_ID_PREFIX + " | inputsHashMapKeys: " + inputsHashMapKeys.length));
    debug(chalkLog(MODULE_ID_PREFIX + " | inputsHashMapKeys: " + inputsHashMapKeys));

    config.seedInputsId = randomItem(inputsHashMapKeys);

    config.iterations = configuration.evolve.iterations;
    config.threads = configuration.evolve.threads;
    config.log = configuration.evolve.log;
    config.mutation = DEFAULT_EVOLVE_MUTATION;

    config.cost = randomItem(configuration.costArray);
    config.clear = randomItem([true, false]);
    config.equal = true;
    config.error = configuration.evolve.error;
    config.mutationRate = randomFloat(EVOLVE_MUTATION_RATE_RANGE.min, EVOLVE_MUTATION_RATE_RANGE.max);
    config.popsize = randomInt(EVOLVE_POP_SIZE_RANGE.min, EVOLVE_POP_SIZE_RANGE.max);
    config.growth = randomFloat(EVOLVE_GROWTH_RANGE.min, EVOLVE_GROWTH_RANGE.max);
    config.elitism = randomInt(EVOLVE_ELITISM_RANGE.min, EVOLVE_ELITISM_RANGE.max);

    if (configuration.enableSeedNetwork && config.seedNetworkId && networkHashMap.has(config.seedNetworkId)) {

      console.log(MODULE_ID_PREFIX + " | SEED NETWORK | " + config.seedNetworkId);

      // networkHashMap entry --> bnhmObj = { entry: entry, networkObj: networkObj }
      const networkObj = networkHashMap.get(config.seedNetworkId).networkObj;

      config.networkObj = networkObj;

      config.architecture = "loadedNetwork";
      config.inputsId = networkObj.inputsId;
      config.inputsObj = {};
      config.inputsObj = networkObj.inputsObj;
      console.log(MODULE_ID_PREFIX + " | SEED INPUTS | " + networkObj.inputsId);

      if (configuration.randomizeSeedOptions) {
        console.log(chalkLog(MODULE_ID_PREFIX + " | RANDOMIZE SEED NETWORK OPTIONS | " + config.seedNetworkId));
        config.cost = randomItem([config.cost, networkObj.evolve.options.cost]);
        config.equal = randomItem([config.equal, networkObj.evolve.options.equal]);
        config.error = randomItem([config.error, networkObj.evolve.options.error]);
        config.mutationRate = randomItem([config.mutationRate, networkObj.evolve.options.mutationRate]);
        config.popsize = randomItem([config.popsize, networkObj.evolve.options.popsize]);
        config.growth = randomItem([config.growth, networkObj.evolve.options.growth]);
        config.elitism = randomItem([config.elitism, networkObj.evolve.options.elitism]);
      }
      else {
        console.log(chalkLog(MODULE_ID_PREFIX + " | USE SEED NETWORK OPTIONS | " + config.seedNetworkId));
        config.cost = networkObj.evolve.options.cost;
        config.equal = networkObj.evolve.options.equal;
        config.error = networkObj.evolve.options.error;
        config.mutationRate = networkObj.evolve.options.mutationRate;
        config.popsize = networkObj.evolve.options.popsize;
        config.growth = networkObj.evolve.options.growth;
        config.elitism = networkObj.evolve.options.elitism;
      }
    }
    else {
      if (inputsHashMap.has(config.seedInputsId)) {
        config.inputsObj = {};
        config.inputsObj = inputsHashMap.get(config.seedInputsId).inputsObj;
        config.architecture = "random";
        config.inputsId = config.seedInputsId;
        debug(MODULE_ID_PREFIX + " | RANDOM ARCH | SEED INPUTS: " + config.seedInputsId);
      }
      else {
        console.log("TNN *** ERROR *** | RANDOM ARCH | seedInputsId " + config.seedInputsId + " NOT IN inputsHashMap");
        return reject(new Error(config.seedInputsId + " NOT IN inputsHashMap"));
      }
    }

    let tObj = {};

    console.log(chalkLog(MODULE_ID_PREFIX + " | LOAD GLOBAL TRAINING SET FROM HASHMAP: " + configuration.globalTrainingSetId));

    if (!trainingSetHashMap.has(configuration.globalTrainingSetId)) {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** TRAINING SET NOT IN HASHMAP: " + configuration.globalTrainingSetId));
      return reject(new Error("TRAINING SET NOT IN HASHMAP: " + configuration.globalTrainingSetId));
    }

    tObj = trainingSetHashMap.get(configuration.globalTrainingSetId);

    console.log(chalkLog(MODULE_ID_PREFIX + " | USING TRAINING SET: " + tObj.trainingSetObj.trainingSetId));

    if (configuration.testMode) {
      tObj.trainingSetObj.trainingSet.data.length = Math.min(tObj.trainingSetObj.trainingSet.data.length, TEST_MODE_LENGTH);
      tObj.trainingSetObj.testSet.data.length = parseInt(configuration.testSetRatio * tObj.trainingSetObj.trainingSet.data.length);
      tObj.trainingSetObj.trainingSet.meta.setSize = tObj.trainingSetObj.trainingSet.data.length;
      tObj.trainingSetObj.testSet.meta.setSize = tObj.trainingSetObj.testSet.data.length;
    }

    config.trainingSetId = tObj.trainingSetObj.trainingSetId;
    config.trainingSet = {};
    config.trainingSet.maxInputHashMap = {};
    config.trainingSet.maxInputHashMap = tObj.trainingSetObj.maxInputHashMap;
    config.trainingSet.meta = {};
    config.trainingSet.meta = tObj.trainingSetObj.trainingSet.meta;
    config.trainingSet.data = [];
    config.trainingSet.data = _.shuffle(tObj.trainingSetObj.trainingSet.data);
    config.testSet = {};
    config.testSet = tObj.trainingSetObj.testSet;

    if (config.testSet.meta.testSetId === undefined) { 
      config.testSet.meta.testSetId = tObj.trainingSetObj.trainingSetId + "_" + DEFAULT_RUN_ID + "_" + getTimeStamp();
    }

    resolve(config);

  });

}

function initNetworkCreate(params){

  return new Promise(async function(resolve, reject){

    let childId = params.childId;
    let networkId = params.networkId;

    statsObj.status = "INIT NETWORK CREATE";

    console.log(chalkLog(MODULE_ID_PREFIX + " | INIT NETWORK CREATE"
      + " | CHILD " + childId
      + " | NNC ID: " + networkId
    ));

    let messageObj;

    try {

      let childConf = await generateRandomEvolveConfig(configuration);

      switch (configuration.networkCreateMode) {

        case "evolve":

          statsObj.status = "EVOLVE";

          messageObj = {};
          messageObj = childConf;

          messageObj.childId = childId;
          messageObj.op = "CONFIG_EVOLVE";
          messageObj.testRunId = networkId;
          messageObj.outputs = {};
          messageObj.outputs = ["left", "neutral", "right"];

          messageObj.betterChild = false;
          messageObj.seedNetworkRes = 0;

          if (childConf.seedNetworkId && (messageObj.networkObj !== undefined)) {
            messageObj.seedNetworkRes = messageObj.networkObj.successRate;
          }

          console.log(chalkBlue("\nTNN | START NETWORK EVOLVE"));

          console.log(chalkBlue(
                     MODULE_ID_PREFIX + " | NN ID:        " + networkId
            + "\n" + MODULE_ID_PREFIX + " | ARCHITECTURE: " + messageObj.architecture
            + "\n" + MODULE_ID_PREFIX + " | INPUTS ID:    " + messageObj.inputsId
            + "\n" + MODULE_ID_PREFIX + " | INPUTS:       " + messageObj.inputsObj.meta.numInputs
            + "\n" + MODULE_ID_PREFIX + " | OUTPUTS:      " + messageObj.trainingSet.meta.numOutputs
            + "\n" + MODULE_ID_PREFIX + " | TRAINING SET: " + messageObj.trainingSet.meta.setSize
            + "\n" + MODULE_ID_PREFIX + " | TEST SET:     " + messageObj.testSet.data.length
            + "\n" + MODULE_ID_PREFIX + " | COST:         " + messageObj.cost
            + "\n" + MODULE_ID_PREFIX + " | ITERATIONS:   " + messageObj.iterations
          ));

          if (messageObj.seedNetworkId) {
            console.log(chalkBlue(MODULE_ID_PREFIX + " | SEED:                " + messageObj.seedNetworkId 
              + " | SR: " + messageObj.seedNetworkRes.toFixed(2) + "%"
            ));
            console.log(chalkBlue(MODULE_ID_PREFIX + " | BETTER CHILD SEED:   " + messageObj.isBetterChildSeed));
          }
          else {
            console.log(chalkBlue(MODULE_ID_PREFIX + " | SEED:                ----"));
          }

          resultsHashmap[messageObj.testRunId] = {};

          let networkCreateObj = {};
          networkCreateObj.childId = childId;
          networkCreateObj.status = "EVOLVE";
          networkCreateObj.successRate = 0;
          networkCreateObj.matchRate = 0;
          networkCreateObj.overallMatchRate = 0;
          networkCreateObj.networkId = messageObj.testRunId;
          networkCreateObj.networkId = messageObj.testRunId;
          networkCreateObj.betterChild = false;
          networkCreateObj.seedNetworkId = messageObj.seedNetworkId;
          networkCreateObj.seedNetworkRes = messageObj.seedNetworkRes;
          networkCreateObj.numInputs = messageObj.inputsObj.meta.numInputs;
          networkCreateObj.inputsId = messageObj.inputsId;
          networkCreateObj.evolve = {};
          networkCreateObj.evolve.startTime = moment().valueOf();
          networkCreateObj.evolve.endTime = moment().valueOf();
          networkCreateObj.evolve.complete = false;
          networkCreateObj.evolve.options = {};
          networkCreateObj.evolve.options = pick(childConf, ["clear", "cost", "growth", "equal", "mutationRate", "popsize", "elitism"]);

          resultsHashmap[messageObj.testRunId] = networkCreateObj;

          // saveFileQueue.push({localFlag: false, folder: statsFolder, file: statsFile, obj: statsObj});

          printResultsHashmap();

          await childSend({command: messageObj});

          resolve();

        break;

        default:
          console.log(chalkError(MODULE_ID_PREFIX + " | UNKNOWN NETWORK CREATE MODE: " + configuration.networkCreateMode));
          return reject(new Error("UNKNOWN NETWORK CREATE MODE: " + configuration.networkCreateMode));
      }
    }
    catch(err){
      console.log(chalkError("INIT CREATE NETWORK ERROR: " + err));
      return reject(err);
    }

  });
}

function allComplete(){

  getChildProcesses(function(err, childArray){

    if (Object.keys(childHashMap).length !== 0 ) { 
      allCompleteFlag = false;
      console.log(chalkBlue(MODULE_ID_PREFIX + " | allComplete: " + allCompleteFlag + " | NN CHILDREN IN HM: " + jsonPrint(Object.keys(childHashMap))));
      return;
    }

    if (childArray.length === 0 ) { 
      allCompleteFlag = true;
      console.log(chalkBlue(MODULE_ID_PREFIX + " | allComplete | NO NN CHILDREN PROCESSES"));
      return;
    }

    let index = 0;

    async.each(Object.keys(childHashMap), function(childId, cb){

      if (configuration.verbose) {
        console.log(chalkLog(MODULE_ID_PREFIX + " | allComplete"
          + " | NNC " + childId 
          + " STATUS: " + childHashMap[childId].status
        ));
      }

      if (childHashMap[childId].status === "RUNNING"){
        allCompleteFlag = false;
        return cb("RUNNING");
      }
      cb();

    }, function(running){
      if (!running) { allCompleteFlag = true; }
      return;
    });

  });
}



function printchildHashMap(){

  const childIdArray = Object.keys(childHashMap).sort();

  let chalkValue = chalkLog;

  async.eachSeries(childIdArray, function(childId, cb){

    switch (childHashMap[childId].status) {
      case "IDLE":
        chalkValue = chalk.blue;
      break;
      case "NEW":
        chalkValue = chalk.bold.green;
      break;
      case "TEST PASS":
      case "PASS LOCAL":
      case "RUNNING":
        chalkValue = chalk.green;
      break;
      case "PASS GLOBAL":
        chalkValue = chalk.bold.green;
      break;
      case "INIT":
      case "COMPLETE":
      case "EXIT":
        chalkValue = chalk.blue;
      break;
      case "ERROR":
        chalkValue = chalkError;
      break;
      case "ZOMBIE":
      case "CLOSE":
      case "DEAD":
        chalkValue = chalkAlert;
      break;
      default:
        console.log(chalkWarn("??? UNKNOWN CHILD STATUS: " + childHashMap[childId].status));
        chalkValue = chalkInfo;
    }

    console.log(chalkValue(MODULE_ID_PREFIX + " | CHILD HM"
      + " | CHILD ID: " + childId
      + " | PID: " + childHashMap[childId].pid
      + " | STATUS: " + childHashMap[childId].status
    ));

    cb();

  }, function(){

  });
}

//=========================================================================
//=========================================================================
//const MODULE_ID = MODULE_ID_PREFIX + "_node_" + hostname;

process.title = MODULE_ID.toLowerCase() + "_" + process.pid;

// process.on("exit", function() {
//   console.log(chalkAlert(MODULE_ID_PREFIX + " | PROCESS EXIT | " + getTimeStamp()));
// });

process.on("exit", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS EXIT"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
});

process.on("close", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS CLOSE"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
});

// process.on("message", function(msg) {
//   if ((msg === "SIGINT") || (msg === "shutdown")) {
//     setTimeout(function() {
//       console.log(chalkAlert(MODULE_ID_PREFIX + " | *** QUITTING twitterFollowerExplorer"));
//       // process.exit(0);
//     }, ONE_SECOND);
//   }
// });

process.on("SIGHUP", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS SIGHUP"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
  quit({cause: "SIGINT"});
});

process.on( "SIGINT", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS SIGINT"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
  quit({cause: "SIGINT"});
});

process.on("unhandledRejection", function(err, promise) {
  console.trace(MODULE_ID_PREFIX + " | *** Unhandled rejection (promise: ", promise, ", reason: ", err, ").");
  quit("unhandledRejection");
  process.exit(1);
});



//=========================================================================
// CONFIGURATION
//=========================================================================

let prevHostConfigFileModifiedMoment = moment("2010-01-01");
let prevDefaultConfigFileModifiedMoment = moment("2010-01-01");
let prevConfigFileModifiedMoment = moment("2010-01-01");

let defaultConfiguration = {}; // general configuration for TNN
let hostConfiguration = {}; // host-specific configuration for TNN

// configuration.testMode = TEST_MODE;
// configuration.globalTestMode = GLOBAL_TEST_MODE;
// configuration.statsUpdateIntervalTime = STATS_UPDATE_INTERVAL;
// configuration.verbose = false;

configuration.slackChannel = {};

// configuration.keepaliveInterval = KEEPALIVE_INTERVAL;
// configuration.quitOnComplete = QUIT_ON_COMPLETE;

function initWatchAllConfigFolders(params){
  return new Promise(async function(resolve, reject){

    params = params || {};

    console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT WATCH ALL CONFIG FILES\n" + jsonPrint(params)));

    try{

      await loadAllConfigFiles();
      await loadCommandLineArgs();

      const options = {
        ignoreDotFiles: true,
        ignoreUnreadableDir: true,
        ignoreNotPermitted: true,
      }

      watch.createMonitor("/Users/tc/Dropbox/Apps/wordAssociation" + defaultInputsFolder, options, function (monitorInputs) {

        console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT WATCH INPUTS CONFIG FOLDER: " + "/Users/tc/Dropbox/Apps/wordAssociation" + defaultInputsFolder));

        monitorInputs.on("created", async function(f, stat){
          const fileNameArray = f.split("/");
          const file = fileNameArray[fileNameArray.length-1];
          if (file.startsWith("inputs_")) {
            console.log(chalkBlue(MODULE_ID_PREFIX + " | +++ INPUTS FILE CREATED: " + f));
            await loadInputsDropboxFile({folder: defaultInputsFolder, file: file});
          }

        });

        monitorInputs.on("changed", async function(f, stat){
          const fileNameArray = f.split("/");
          const file = fileNameArray[fileNameArray.length-1];
          if (file.startsWith("inputs_")) {
            console.log(chalkBlue(MODULE_ID_PREFIX + " | -/- INPUTS FILE CHANGED: " + f));
            await loadInputsDropboxFile({folder: defaultInputsFolder, file: file});
          }
        });


        monitorInputs.on("removed", function (f, stat) {
          const fileNameArray = f.split("/");
          const inputsId = fileNameArray[fileNameArray.length-1].replace(".json", "");
          console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX INPUTS FILE DELETED | " + getTimeStamp() 
            + " | " + inputsId 
            + "\n" + f
          ));
          inputsHashMap.delete(inputsId);
        });

      });

      watch.createMonitor("/Users/tc/Dropbox/Apps/wordAssociation" + dropboxConfigDefaultFolder, options, function (monitorDefaultConfig) {

        console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT WATCH DEFAULT CONFIG FOLDER: " + "/Users/tc/Dropbox/Apps/wordAssociation" + dropboxConfigDefaultFolder));

        monitorDefaultConfig.on("created", async function(f, stat){
          if (f.endsWith(dropboxConfigDefaultFile)){
            await loadAllConfigFiles();
            await loadCommandLineArgs();
          }

        });

        monitorDefaultConfig.on("changed", async function(f, stat){
          if (f.endsWith(dropboxConfigDefaultFile)){
            await loadAllConfigFiles();
            await loadCommandLineArgs();
          }
        });

        monitorDefaultConfig.on("removed", function (f, stat) {
          console.log(chalkInfo(MODULE_ID_PREFIX + " | XXX FILE DELETED | " + getTimeStamp() + " | " + f));
        });

      });

      watch.createMonitor("/Users/tc/Dropbox/Apps/wordAssociation" + dropboxConfigHostFolder, options, function (monitorHostConfig) {

        console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT WATCH HOSE CONFIG FOLDER: " + "/Users/tc/Dropbox/Apps/wordAssociation" + dropboxConfigHostFolder));

        monitorHostConfig.on("created", async function(f, stat){
          if (f.endsWith(dropboxConfigHostFile)){
            await loadAllConfigFiles();
            await loadCommandLineArgs();
          }
        });

        monitorHostConfig.on("changed", async function(f, stat){
          if (f.endsWith(dropboxConfigHostFile)){
            await loadAllConfigFiles();
            await loadCommandLineArgs();
          }
        });

        monitorHostConfig.on("removed", function (f, stat) {
          console.log(chalkInfo(MODULE_ID_PREFIX + " | XXX FILE DELETED | " + getTimeStamp() + " | " + f));
        });

      });

      resolve();
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX
        + " | *** INIT LOAD ALL CONFIG INTERVAL ERROR: " + err
      ));
      return reject(err);
    }
  });
}

function initConfig(cnf) {

  return new Promise(async function(resolve, reject){

    statsObj.status = "INIT CONFIG";

    console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT CONFIG"));

    if (debug.enabled) {
      console.log("\nTNN | %%%%%%%%%%%%%%\nTNN |  DEBUG ENABLED \nTNN | %%%%%%%%%%%%%%\n");
    }

    cnf.processName = process.env.PROCESS_NAME || MODULE_ID;
    cnf.testMode = (process.env.TEST_MODE === "true") ? true : cnf.testMode;
    cnf.quitOnError = process.env.QUIT_ON_ERROR || false ;
    cnf.enableStdin = process.env.ENABLE_STDIN || true ;

    if (process.env.QUIT_ON_COMPLETE === "false") { cnf.quitOnComplete = false; }
    else if ((process.env.QUIT_ON_COMPLETE === true) || (process.env.QUIT_ON_COMPLETE === "true")) {
      cnf.quitOnComplete = true;
    }

    try {

      await initWatchAllConfigFolders();

      const configArgs = Object.keys(configuration);

      configArgs.forEach(function(arg){
        if (_.isObject(configuration[arg])) {
          console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + "\n" + jsonPrint(configuration[arg]));
        }
        else {
          console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + ": " + configuration[arg]);
        }
      });
      
      statsObj.commandLineArgsLoaded = true;

      if (configuration.enableStdin) {  initStdIn(); }

      await initStatsUpdate();

      resolve(configuration) ;

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** CONFIG LOAD ERROR: " + err ));
      reject(err);
    }

  });
}

//=========================================================================
// MONGO DB
//=========================================================================

global.dbConnection = false;
const mongoose = require("mongoose");
mongoose.set("useFindAndModify", false);

global.wordAssoDb = require("@threeceelabs/mongoose-twitter");

global.Emoji;
global.Hashtag;
global.Location;
global.Media;
global.NetworkInputs;
global.NeuralNetwork;
global.Place;
global.Tweet;
global.Url;
global.User;
global.Word;

let dbConnectionReady = false;
let dbConnectionReadyInterval;

let UserServerController;
let userServerController;
let userServerControllerReady = false;

let TweetServerController;
let tweetServerController;
let tweetServerControllerReady = false;

let userDbUpdateQueueInterval;
let userDbUpdateQueueReadyFlag = true;
let userDbUpdateQueue = [];

function connectDb(){

  return new Promise(async function(resolve, reject){

    try {

      statsObj.status = "CONNECTING MONGO DB";

      wordAssoDb.connect(MODULE_ID + "_" + process.pid, async function(err, db){

        if (err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR: " + err));
          statsObj.status = "MONGO CONNECTION ERROR";
          // slackSendMessage(hostname + " | TNN | " + statsObj.status);
          dbConnectionReady = false;
          quit({cause: "MONGO DB ERROR: " + err});
          return reject(err);
        }

        db.on("error", async function(){
          statsObj.status = "MONGO ERROR";
          console.error.bind(console, MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR");
          console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR"));
          // slackSendMessage(hostname + " | TNN | " + statsObj.status);
          db.close();
          dbConnectionReady = false;
          quit({cause: "MONGO DB ERROR: " + err});
        });

        db.on("disconnected", async function(){
          statsObj.status = "MONGO DISCONNECTED";
          console.error.bind(console, MODULE_ID_PREFIX + " | *** MONGO DB DISCONNECTED");
          // slackSendMessage(hostname + " | TNN | " + statsObj.status);
          console.log(chalkAlert(MODULE_ID_PREFIX + " | *** MONGO DB DISCONNECTED"));
          dbConnectionReady = false;
          quit({cause: "MONGO DB DISCONNECTED"});
        });


        global.dbConnection = db;

        console.log(chalk.green(MODULE_ID_PREFIX + " | MONGOOSE DEFAULT CONNECTION OPEN"));


        const emojiModel = require("@threeceelabs/mongoose-twitter/models/emoji.server.model");
        const hashtagModel = require("@threeceelabs/mongoose-twitter/models/hashtag.server.model");
        const locationModel = require("@threeceelabs/mongoose-twitter/models/location.server.model");
        const mediaModel = require("@threeceelabs/mongoose-twitter/models/media.server.model");
        const neuralNetworkModel = require("@threeceelabs/mongoose-twitter/models/neuralNetwork.server.model");
        const placeModel = require("@threeceelabs/mongoose-twitter/models/place.server.model");
        const tweetModel = require("@threeceelabs/mongoose-twitter/models/tweet.server.model");
        const urlModel = require("@threeceelabs/mongoose-twitter/models/url.server.model");
        const userModel = require("@threeceelabs/mongoose-twitter/models/user.server.model");
        const wordModel = require("@threeceelabs/mongoose-twitter/models/word.server.model");

        global.Emoji = global.dbConnection.model("Emoji", emojiModel.EmojiSchema);
        global.Hashtag = global.dbConnection.model("Hashtag", hashtagModel.HashtagSchema);
        global.Location = global.dbConnection.model("Location", locationModel.LocationSchema);
        global.Media = global.dbConnection.model("Media", mediaModel.MediaSchema);
        global.NeuralNetwork = global.dbConnection.model("NeuralNetwork", neuralNetworkModel.NeuralNetworkSchema);
        global.Place = global.dbConnection.model("Place", placeModel.PlaceSchema);
        global.Tweet = global.dbConnection.model("Tweet", tweetModel.TweetSchema);
        global.Url = global.dbConnection.model("Url", urlModel.UrlSchema);
        global.User = global.dbConnection.model("User", userModel.UserSchema);
        global.Word = global.dbConnection.model("Word", wordModel.WordSchema);

        const uscChildName = MODULE_ID_PREFIX + "_USC";
        UserServerController = require("@threeceelabs/user-server-controller");
        userServerController = new UserServerController(uscChildName);

        const tscChildName = MODULE_ID_PREFIX + "_TSC";
        TweetServerController = require("@threeceelabs/tweet-server-controller");
        tweetServerController = new TweetServerController(tscChildName);

        tweetServerController.on("ready", function(appname){
          tweetServerControllerReady = true;
          console.log(chalk.green(MODULE_ID_PREFIX + " | " + tscChildName + " READY | " + appname));
        });

        tweetServerController.on("error", function(err){
          tweetServerControllerReady = false;
          console.trace(chalkError(MODULE_ID_PREFIX + " | *** " + tscChildName + " ERROR | " + err));
        });

        userServerControllerReady = false;
        userServerController.on("ready", function(appname){

          statsObj.status = "MONGO DB CONNECTED";
          // slackSendMessage(hostname + " | TNN | " + statsObj.status);

          userServerControllerReady = true;
          console.log(chalkLog(MODULE_ID_PREFIX + " | " + uscChildName + " READY | " + appname));
          dbConnectionReady = true;

          resolve(db);

        });
      });
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECT ERROR: " + err));
      reject(err);
    }
  });
}

//=========================================================================

//=========================================================================
// MISC FUNCTIONS (own module?)
//=========================================================================
function jsonPrint(obj) {
  if (obj) {
    return treeify.asTree(obj, true, true);
  }
  else {
    return "UNDEFINED";
  }
}

function msToTime(duration) {

  let sign = 1;

  if (duration < 0) {
    sign = -1;
    duration = -duration;
  }

  let seconds = parseInt((duration / 1000) % 60);
  let minutes = parseInt((duration / (1000 * 60)) % 60);
  let hours = parseInt((duration / (1000 * 60 * 60)) % 24);
  let days = parseInt(duration / (1000 * 60 * 60 * 24));
  days = (days < 10) ? "0" + days : days;
  hours = (hours < 10) ? "0" + hours : hours;
  minutes = (minutes < 10) ? "0" + minutes : minutes;
  seconds = (seconds < 10) ? "0" + seconds : seconds;

  if (sign > 0) return days + ":" + hours + ":" + minutes + ":" + seconds;
  return "- " + days + ":" + hours + ":" + minutes + ":" + seconds;
}

function getTimeStamp(inputTime) {
  let currentTimeStamp ;
  if (inputTime === undefined) {
    currentTimeStamp = moment().format(compactDateTimeFormat);
    return currentTimeStamp;
  }
  else if (moment.isMoment(inputTime)) {
    currentTimeStamp = moment(inputTime).format(compactDateTimeFormat);
    return currentTimeStamp;
  }
  else if (moment.isDate(new Date(inputTime))) {
    currentTimeStamp = moment(new Date(inputTime)).format(compactDateTimeFormat);
    return currentTimeStamp;
  }
  else {
    currentTimeStamp = moment(parseInt(inputTime)).format(compactDateTimeFormat);
    return currentTimeStamp;
  }
}

function getElapsed(){
  statsObj.elapsedMS = moment().valueOf() - startTimeMoment.valueOf();
  return statsObj.elapsedMS;
}

function getElapsedTimeStamp(){
  statsObj.elapsedMS = moment().valueOf() - startTimeMoment.valueOf();
  return msToTime(statsObj.elapsedMS);
}

function toMegabytes(sizeInBytes) {
  return sizeInBytes/ONE_MEGABYTE;
}

function printCat(c){
  if (c === "left") { return "L"; }
  if (c === "neutral") { return "N"; }
  if (c === "right") { return "R"; }
  if (c === "positive") { return "+"; }
  if (c === "negative") { return "-"; }
  if (c === "none") { return "0"; }
  return ".";
}

function touchChildPidFile(params){

  return new Promise(function(resolve, reject){

    try{

      const childPidFile = params.childId + "=" + params.pid;

      const folder = params.folder || childPidFolderLocal;

      shell.mkdir("-p", folder);

      const path = folder + "/" + childPidFile;

      touch.sync(path, { force: true });

      console.log(chalkBlue(MODULE_ID_PREFIX + " | TOUCH CHILD PID FILE: " + path));
      resolve(path);
    }
    catch(err){
      return reject(err);
    }

  });
}

function getChildProcesses(params){

  return new Promise(function(resolve, reject){

    let command;
    let pid;
    let childId;
    let numChildren = 0;
    let childPidArray = [];

    // DEFAULT_CHILD_ID_PREFIX_XXX=[pid] 

    shell.mkdir("-p", childPidFolderLocal);

    console.log("SHELL: cd " + childPidFolderLocal);
    shell.cd(childPidFolderLocal);

    const childPidFileNameArray = shell.ls(configuration.childIdPrefix + "*");

    async.eachSeries(childPidFileNameArray, function (childPidFileName, cb) {

      console.log("SHELL: childPidFileName: " + childPidFileName);

      // wa_node_child_dbu=46633
      const childPidStringArray = childPidFileName.split("=");

      const childId = childPidStringArray[0];
      const childPid = parseInt(childPidStringArray[1]);

      console.log("SHELL: CHILD ID: " + childId + " | PID: " + childPid);

      if (childHashMap[childId]) {
        debug("CHILD HM HIT"
          + " | ID: " + childId 
          + " | SHELL PID: " + childPid 
          + " | HM PID: " + childHashMap[childId].pid 
          + " | STATUS: " + childHashMap[childId].status
        );
      }
      else {
        console.log("CHILD HM MISS | ID: " + childId + " | PID: " + childPid + " | STATUS: UNKNOWN");
      }

      if ((childHashMap[childId] !== undefined) && (childHashMap[childId].pid === childPid)) {
        // cool kid
        childPidArray.push({ pid: childPid, childId: childId});

        console.log(chalkInfo(MODULE_ID_PREFIX + " | FOUND CHILD"
          + " [ " + childPidArray.length + " CHILDREN ]"
          + " | ID: " + childId
          + " | PID: " + childPid
          + " | FILE: " + childPidFileName
        ));

        cb();

      }
      else {

        console.log("SHELL: CHILD NOT IN HASH | ID: " + childId + " | PID: " + childPid);

        if (childHashMap[childId] === undefined) {
          console.log(chalkAlert(MODULE_ID_PREFIX + " | *** CHILD NOT IN HM"
            + " | " + childId
          ));
        }

        if (childHashMap[childId] && childHashMap[childId].pid === undefined) {
          console.log(chalkAlert(MODULE_ID_PREFIX + " | *** CHILD PID HM MISMATCH"
            + " | " + childId
            + " | HM PID: " + childHashMap[childId].pid
            + " | PID: " + childPid
          ));
        }

        console.log(chalkAlert(MODULE_ID_PREFIX + " | *** CHILD ZOMBIE"
          + " | " + childId
          + " | TERMINATING ..."
          // + "\nchildHashMap[childId]" + jsonPrint(childHashMap[childId])
        ));

        kill(childPid, function(err){

          if (err) {
            console.log(chalkError(MODULE_ID_PREFIX + " | *** KILL ZOMBIE ERROR: ", err));
            return cb(err);
          }

          shell.cd(childPidFolderLocal);
          shell.rm(childId + "*");

          delete childHashMap[childId];

          console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX CHILD ZOMBIE"
            + " [ " + childPidArray.length + " CHILDREN ]"
            + " | ID: " + childId
            + " | PID: " + childPid
          ));

          cb();

        });

      }

    }, function(err){
      if (err) {
        return reject(err);
      }

      resolve(childPidArray);

    });

  });
}

function findChildByPid(pid, callback){

  let foundChildId = false;

  async.each(Object.keys(childHashMap), function(nnChildId, cb){

    if (pid && (childHashMap[nnChildId].pid === pid)){

      foundChildId = nnChildId;

      cb(foundChildId);

    }
    else {
      cb();
    }

  }, function(result){
    callback(null, foundChildId);
  });

}


function killChild(params){

  return new Promise(function(resolve, reject){

    let pid;

    if ((params.pid === undefined) && childHashMap[params.childId] === undefined) {
      return reject(new Error("CHILD ID NOT FOUND: " + params.childId));
    }

    if (params.pid) {
      pid = params.pid;
    }
    else if (params.childId && childHashMap[params.childId] !== undefined) {
      pid = childHashMap[params.childId].pid;
    }


    kill(pid, function(err){

      if (err) { return reject(err); }
      resolve(params);

    });

  });
}

function killAll(params){

  console.log("KILL ALL");

  return new Promise(async function(resolve, reject){

    try {

      const childPidArray = await getChildProcesses({searchTerm: configuration.childIdPrefix});

      console.log(chalkAlert("getChildProcesses childPidArray\n" + jsonPrint(childPidArray)));
      if (childPidArray && (childPidArray.length > 0)) {

        async.eachSeries(childPidArray, function(childObj, cb){

          killChild({pid: childObj.pid})
          .then(function(){
            console.log(chalkAlert(MODULE_ID_PREFIX + " | KILL ALL | KILLED | PID: " + childObj.pid + " | CH ID: " + childObj.childId));
            cb();
          })
          .catch(function(err){
            console.log(chalkError(MODULE_ID_PREFIX + " | *** KILL CHILD ERROR"
              + " | PID: " + childObj.pid
              + " | ERROR: " + err
            ));
            return cb(err);
          });

        }, function(err){

          if (err){
            return reject(err);
          }

          resolve(childPidArray);

        });
      }
      else {

        console.log(chalkBlue(MODULE_ID_PREFIX + " | KILL ALL | NO CHILDREN"));
        resolve(childPidArray);
      }
    }
    catch(err){
      reject(err);
    }


  });
}

//=========================================================================
// STATS
//=========================================================================

// let startTimeMoment = moment();

// statsObj.pid = process.pid;
// statsObj.cpus = os.cpus().length;

// statsObj.runId = MODULE_ID.toLowerCase() + "_" + getTimeStamp();

// statsObj.hostname = hostname;
// statsObj.startTime = getTimeStamp();
// statsObj.elapsedMS = 0;
// statsObj.elapsed = getElapsedTimeStamp();
// statsObj.status = "START";

// statsObj.serverConnected = false;
// statsObj.userReadyAck = false;
// statsObj.userReadyAckWait = 0;
// statsObj.userReadyTransmitted = false;
// statsObj.authenticated = false;

// statsObj.queues = {};

// let statsPickArray = [
//   "pid", 
//   "startTime", 
//   "elapsed", 
//   "elapsedMS", 
//   "status"
// ];

function showStats(options) {

  return new Promise(async function(resolve, reject){

    statsObj.elapsed = getElapsedTimeStamp();

    try{
      await childStatsAll();
    }
    catch(err){
      return reject(err);
    }

    statsObjSmall = pick(statsObj, statsPickArray);

    if (options) {
      console.log(MODULE_ID_PREFIX + " | STATS\n" + jsonPrint(statsObjSmall));
      resolve();
    }
    else {

      Object.keys(childHashMap).forEach(function(childId) {

        console.log(chalkLog(MODULE_ID_PREFIX + " | STATUS CHILD"
          + " | CHILD ID: " + childId + " | CH FSM: " + childHashMap[childId].status
        ));

        objectPath.set(statsObj, ["children", childId, "status"], childHashMap[childId].status);
      });

      console.log(chalkLog(MODULE_ID_PREFIX + " | STATUS"
        + " | FSM: " + fsm.getMachineState()
        + " | START: " + statsObj.startTime
        + " | NOW: " + getTimeStamp()
        + " | ELAPSED: " + statsObj.elapsed
      ));

      resolve();
    }

  });

}

function initStatsUpdate(callback) {

  return new Promise(function(resolve, reject){

    console.log(chalkLog(MODULE_ID_PREFIX + " | INIT STATS UPDATE INTERVAL | " + msToTime(configuration.statsUpdateIntervalTime)));


    statsObj.elapsed = getElapsedTimeStamp();
    statsObj.timeStamp = getTimeStamp();

    saveFile({localFlag: false, folder: statsFolder, file: statsFile, obj: statsObj});

    clearInterval(statsUpdateInterval);

    statsUpdateInterval = setInterval(async function () {

      statsObj.elapsed = getElapsedTimeStamp();
      statsObj.timeStamp = getTimeStamp();

      saveFileQueue.push({localFlag: false, folder: statsFolder, file: statsFile, obj: statsObj});
      statsObj.queues.saveFileQueue.size = saveFileQueue.length;

      try{
        await showStats();
      }
      catch(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** SHOW STATS ERROR: " + err));
      }
      
    }, configuration.statsUpdateIntervalTime);

    resolve();

  });
}

// ==================================================================
// DROPBOX
// ==================================================================
const Dropbox = require("dropbox").Dropbox;

const DROPBOX_MAX_FILE_UPLOAD = 140 * ONE_MEGABYTE; // bytes

configuration.dropboxMaxFileUpload = DROPBOX_MAX_FILE_UPLOAD;

configuration.DROPBOX = {};

configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
configuration.DROPBOX.DROPBOX_CONFIG_FILE = process.env.DROPBOX_CONFIG_FILE || MODULE_NAME + "Config.json";
configuration.DROPBOX.DROPBOX_STATS_FILE = process.env.DROPBOX_STATS_FILE || MODULE_NAME + "Stats.json";

const dropboxConfigFolder = "/config/utility";
const dropboxConfigDefaultFolder = "/config/utility/default";
const dropboxConfigHostFolder = "/config/utility/" + hostname;

const defaultNetworkInputsConfigFile = "default_networkInputsConfig.json";

const dropboxConfigDefaultFile = "default_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;
const dropboxConfigHostFile = hostname + "_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;

let childPidFolderLocal = (hostname === "google") 
  ? "/home/tc/Dropbox/Apps/wordAssociation/config/utility/google/children" 
  : "/Users/tc/Dropbox/Apps/wordAssociation/config/utility/" + hostname + "/children";

let statsFolder = "/stats/" + hostname;
let statsFile = configuration.DROPBOX.DROPBOX_STATS_FILE;

const defaultInputsFolder = dropboxConfigDefaultFolder + "/inputs";
const defaultInputsArchiveFolder = dropboxConfigDefaultFolder + "/inputsArchive";

const defaultTrainingSetFolder = dropboxConfigDefaultFolder + "/trainingSets";
const localTrainingSetFolder = dropboxConfigHostFolder + "/trainingSets";

const defaultTrainingSetUserArchive = defaultTrainingSetFolder + "/users/users.zip";

const globalBestNetworkFolder = "/config/utility/best/neuralNetworks";
const localBestNetworkFolder =    "/config/utility/" + hostname + "/neuralNetworks/best";
const localArchiveNetworkFolder = "/config/utility/" + hostname + "/neuralNetworks/archive";

let globalCategorizedUsersFolder = dropboxConfigDefaultFolder + "/categorizedUsers";
let categorizedUsersFile = "categorizedUsers_manual.json";


let dropboxRemoteClient = new Dropbox({ 
  accessToken: configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN,
  fetch: fetch
});

let dropboxLocalClient = {  // offline mode
  filesListFolder: filesListFolderLocal,
  filesUpload: function(){},
  filesDownload: function(){},
  filesGetMetadata: filesGetMetadataLocal,
  filesDelete: function(){}
};

let dropboxClient;

if (configuration.offlineMode) {
  dropboxClient = dropboxLocalClient;
}
else {
  dropboxClient = dropboxRemoteClient;
}


function filesListFolderLocal(options){
  return new Promise(function(resolve, reject) {

    const fullPath = "/Users/tc/Dropbox/Apps/wordAssociation" + options.path;

    fs.readdir(fullPath, function(err, items){
      if (err) {
        reject(err);
      }
      else {

        let itemArray = [];

        async.each(items, function(item, cb){

          itemArray.push(
            {
              name: item, 
              client_modified: false,
              content_hash: false,
              path_display: fullPath + "/" + item
            }
          );
          cb();

        }, function(err){

          const response = {
            cursor: false,
            has_more: false,
            entries: itemArray
          };

          resolve(response);
        });
        }
    });
  });
}

function filesGetMetadataLocal(options){

  return new Promise(function(resolve, reject) {

    const fullPath = "/Users/tc/Dropbox/Apps/wordAssociation" + options.path;

    fs.stat(fullPath, function(err, stats){
      if (err) {
        reject(err);
      }
      else {
        const response = {
          client_modified: stats.mtimeMs
        };
        
        resolve(response);
      }
    });
  });
}

function loadFile(params) {

  return new Promise(async function(resolve, reject){

    let noErrorNotFound = params.noErrorNotFound || false;

    let fullPath = params.path || params.folder + "/" + params.file;

    debug(chalkInfo("LOAD PATH " + params.path));
    debug(chalkInfo("LOAD FOLDER " + params.folder));
    debug(chalkInfo("LOAD FILE " + params.file));
    debug(chalkInfo("FULL PATH " + fullPath));


    if (configuration.offlineMode || params.loadLocalFile) {

      if (hostname === "google") {
        fullPath = "/home/tc/Dropbox/Apps/wordAssociation/" + fullPath;
        console.log(chalkInfo("OFFLINE_MODE: FULL PATH " + fullPath));
      }

      if ((hostname === "mbp3") || (hostname === "mbp2")) {
        fullPath = "/Users/tc/Dropbox/Apps/wordAssociation/" + fullPath;
        console.log(chalkInfo("OFFLINE_MODE: FULL PATH " + fullPath));
      }

      fs.readFile(fullPath, "utf8", function(err, data) {

        if (err) {
          console.log(chalkError("fs readFile ERROR: " + err));
          return reject(err);
        }

        console.log(chalkInfo(getTimeStamp()
          + " | LOADING FILE FROM DROPBOX"
          + " | " + fullPath
        ));

        if (fullPath.match(/\.json$/gi)) {

          JSONParse(data, function(err, fileObj){
            if (err) {
              console.log(chalkError(getTimeStamp()
                + " | *** LOAD FILE FROM DROPBOX ERROR"
                + " | " + fullPath
                + " | " + err
              ));

              return reject(err);
            }

            const fileObjSizeMbytes = sizeof(fileObj)/ONE_MEGABYTE;

            console.log(chalkInfo(getTimeStamp()
              + " | LOADED FILE FROM DROPBOX"
              + " | " + fileObjSizeMbytes.toFixed(2) + " MB"
              + " | " + fullPath
            ));

            return resolve(fileObj);

          });

        }

        console.log(chalkError(getTimeStamp()
          + " | ... SKIP LOAD FILE FROM DROPBOX"
          + " | " + fullPath
        ));
        resolve();

      });

     }
    else {

      dropboxClient.filesDownload({path: fullPath})
      .then(function(data) {

        debug(chalkLog(getTimeStamp()
          + " | LOADING FILE FROM DROPBOX FILE: " + fullPath
        ));

        if (fullPath.match(/\.json$/gi)) {

          let payload = data.fileBinary;

          if (!payload || (payload === undefined)) {
            return reject(new Error(MODULE_ID_PREFIX + " LOAD FILE PAYLOAD UNDEFINED"));
          }

          JSONParse(payload, function(err, fileObj){
            if (err) {
              console.log(chalkError(getTimeStamp()
                + " | *** LOAD FILE FROM DROPBOX ERROR"
                + " | " + fullPath
                + " | " + err
              ));

              return reject(err);
            }

            return resolve(fileObj);

          });

        }
        else {
          resolve();
        }
      })
      .catch(function(err) {

        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX loadFile ERROR: " + fullPath));
        
        if ((err.status === 409) || (err.status === 404)) {
          if (noErrorNotFound) {
            console.log(chalkAlert(MODULE_ID_PREFIX + " | *** DROPBOX READ FILE " + fullPath + " NOT FOUND"));
            return resolve(new Error("NOT FOUND"));
          }
          console.log(chalkAlert(MODULE_ID_PREFIX + " | *** DROPBOX READ FILE " + fullPath + " NOT FOUND ... SKIPPING ..."));
          return resolve(err);
        }
        
        if (err.status === 0) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX NO RESPONSE"
            + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
          return resolve(new Error("NO INTERNET"));
        }

        reject(err);

      });
    }
  });
}

function loadFileRetry(params){

  return new Promise(async function(resolve, reject){

    let resolveOnNotFound = params.resolveOnNotFound || false;
    let maxRetries = params.maxRetries || 10;
    let retryNumber;
    let backOffTime = params.initialBackOffTime || ONE_SECOND;
    let path = params.path || params.folder + "/" + params.file;

    for (retryNumber = 0; retryNumber < maxRetries; retryNumber++) {
      try {
        
        const fileObj = await loadFile(params);

        if (retryNumber > 0) { 
          console.log(chalkAlert(MODULE_ID_PREFIX + " | FILE LOAD RETRY"
            + " | " + path
            + " | BACKOFF: " + msToTime(backOffTime)
            + " | " + retryNumber + " OF " + maxRetries
          )); 
        }

        return resolve(fileObj);
        break;
      } 
      catch(err) {
        backOffTime *= 2;
        setTimeout(function(){
          console.log(chalkAlert(MODULE_ID_PREFIX + " | FILE LOAD ERROR ... RETRY"
            + " | " + path
            + " | BACKOFF: " + msToTime(backOffTime)
            + " | " + retryNumber + " OF " + maxRetries
            + " | ERROR: " + err
          )); 
        }, backOffTime);
      }
    }

    if (resolveOnNotFound) {
      console.log(chalkAlert(MODULE_ID_PREFIX + " | resolve FILE LOAD FAILED | RETRY: " + retryNumber + " OF " + maxRetries));
      return resolve(false);
    }
    console.log(chalkError(MODULE_ID_PREFIX + " | reject FILE LOAD FAILED | RETRY: " + retryNumber + " OF " + maxRetries));
    reject(new Error("FILE LOAD ERROR | RETRIES " + maxRetries));

  });
}

function getFileMetadata(params) {

  return new Promise(function(resolve, reject){

    const fullPath = params.folder + "/" + params.file;
    debug(chalkInfo("FOLDER " + params.folder));
    debug(chalkInfo("FILE " + params.file));
    debug(chalkInfo("getFileMetadata FULL PATH: " + fullPath));

    if (configuration.offlineMode) {
      dropboxClient = dropboxLocalClient;
    }
    else {
      dropboxClient = dropboxRemoteClient;
    }

    dropboxClient.filesGetMetadata({path: fullPath})
    .then(function(response) {
      debug(chalkInfo("FILE META\n" + jsonPrint(response)));
      resolve(response);
    })
    .catch(function(err) {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX getFileMetadata ERROR: " + fullPath));

      if ((err.status === 404) || (err.status === 409)) {
        console.error(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX READ FILE " + fullPath + " NOT FOUND"));
      }
      if (err.status === 0) {
        console.error(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX NO RESPONSE"));
      }

      reject(err);

    });

  });
}

function listDropboxFolder(params){

  return new Promise(function(resolve, reject){

    try{

      statsObj.status = "LIST DROPBOX FOLDER: " + params.folder;

      console.log(chalkNetwork(MODULE_ID_PREFIX + " | LISTING DROPBOX FOLDER | " + params.folder));

      let results = {};
      results.entries = [];

      let cursor;
      let more = false;
      let limit = params.limit || DROPBOX_LIST_FOLDER_LIMIT;

      if (configuration.offlineMode) {
        dropboxClient = dropboxLocalClient;
      }
      else {
        dropboxClient = dropboxRemoteClient;
      }

      dropboxClient.filesListFolder({path: params.folder, limit: limit})
      .then(function(response){

        cursor = response.cursor;
        more = response.has_more;
        results.entries = response.entries;

        if (configuration.verbose) {
          console.log(chalkLog("DROPBOX LIST FOLDER"
            + " | FOLDER:" + params.folder
            + " | ENTRIES: " + response.entries.length
            + " | LIMIT: " + limit
            + " | MORE: " + more
          ));
        }

        async.whilst(

          function() {
            return more;
          },

          function(cb){

            setTimeout(function(){

              dropboxClient.filesListFolderContinue({cursor: cursor})
              .then(function(responseCont){

                cursor = responseCont.cursor;
                more = responseCont.has_more;
                results.entries = results.entries.concat(responseCont.entries);

                if (configuration.verbose) {
                  console.log(chalkLog("DROPBOX LIST FOLDER CONT"
                    + " | PATH:" + params.folder
                    + " | ENTRIES: " + responseCont.entries.length + "/" + results.entries.length
                    + " | LIMIT: " + limit
                    + " | MORE: " + more
                  ));
                }

              })
              .catch(function(err){
                console.trace(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX filesListFolderContinue ERROR: ", jsonPrint(err.tag)));
                console.trace(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX filesListFolderContinue ERROR: ", err.tag));
                return reject(err);
              });

              async.setImmediate(function() { cb(); });

            }, 1000);
          },

          function(err){
            if (err) {
              console.log(chalkError(MODULE_ID_PREFIX + " | DROPBOX LIST FOLDERS: " + err + "\n" + jsonPrint(err)));
              return reject(err);
            }
            resolve(results);
          });
      })
      .catch(function(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
        return reject(err);
      });

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
      return reject(err);
    }

  });
}

function loadConfigFile(params) {

  return new Promise(async function(resolve, reject){

    const fullPath = params.folder + "/" + params.file;

    try {

      if (params.file === dropboxConfigDefaultFile) {
        prevConfigFileModifiedMoment = moment(prevDefaultConfigFileModifiedMoment);
      }
      else {
        prevConfigFileModifiedMoment = moment(prevHostConfigFileModifiedMoment);
      }

      if (configuration.offlineMode) {
        await loadCommandLineArgs();
        return resolve();
      }

      try {

        const response = await getFileMetadata({folder: params.folder, file: params.file});

        const fileModifiedMoment = moment(new Date(response.client_modified));
        
        if (fileModifiedMoment.isSameOrBefore(prevConfigFileModifiedMoment)){

          console.log(chalkInfo(MODULE_ID_PREFIX + " | CONFIG FILE BEFORE OR EQUAL"
            + " | " + fullPath
            + " | PREV: " + prevConfigFileModifiedMoment.format(compactDateTimeFormat)
            + " | " + fileModifiedMoment.format(compactDateTimeFormat)
          ));
          return resolve();
        }

        console.log(chalkLog(MODULE_ID_PREFIX + " | +++ CONFIG FILE AFTER ... LOADING"
          + " | " + fullPath
          + " | PREV: " + prevConfigFileModifiedMoment.format(compactDateTimeFormat)
          + " | " + fileModifiedMoment.format(compactDateTimeFormat)
        ));

        prevConfigFileModifiedMoment = moment(fileModifiedMoment);

        if (params.file === dropboxConfigDefaultFile) {
          prevDefaultConfigFileModifiedMoment = moment(fileModifiedMoment);
        }
        else {
          prevHostConfigFileModifiedMoment = moment(fileModifiedMoment);
        }

      }
      catch(err){

      }


      const loadedConfigObj = await loadFile({folder: params.folder, file: params.file, noErrorNotFound: true });

      if (loadedConfigObj === undefined) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX CONFIG LOAD FILE ERROR | JSON UNDEFINED ??? "));
        return reject(new Error("JSON UNDEFINED"));
      }

      if (loadedConfigObj instanceof Error) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX CONFIG LOAD FILE ERROR: " + loadedConfigObj));
      }

      console.log(chalkInfo(MODULE_ID_PREFIX + " | LOADED CONFIG FILE: " + params.file + "\n" + jsonPrint(loadedConfigObj)));

      let newConfiguration = {};
      newConfiguration.evolve = {};

      if (loadedConfigObj.TEST_MODE !== undefined) {
        console.log(MODULE_ID_PREFIX + " | LOADED TEST_MODE: " + loadedConfigObj.TEST_MODE);
        if ((loadedConfigObj.TEST_MODE === true) || (loadedConfigObj.TEST_MODE === "true")) {
          newConfiguration.testMode = true;
        }
        if ((loadedConfigObj.TEST_MODE === false) || (loadedConfigObj.TEST_MODE === "false")) {
          newConfiguration.testMode = false;
        }
      }

      if (loadedConfigObj.QUIT_ON_COMPLETE !== undefined) {
        console.log(MODULE_ID_PREFIX + " | LOADED QUIT_ON_COMPLETE: " + loadedConfigObj.QUIT_ON_COMPLETE);
        if ((loadedConfigObj.QUIT_ON_COMPLETE === true) || (loadedConfigObj.QUIT_ON_COMPLETE === "true")) {
          newConfiguration.quitOnComplete = true;
        }
        if ((loadedConfigObj.QUIT_ON_COMPLETE === false) || (loadedConfigObj.QUIT_ON_COMPLETE === "false")) {
          newConfiguration.quitOnComplete = false;
        }
      }

      if (loadedConfigObj.VERBOSE !== undefined) {
        console.log(MODULE_ID_PREFIX + " | LOADED VERBOSE: " + loadedConfigObj.VERBOSE);
        if ((loadedConfigObj.VERBOSE === true) || (loadedConfigObj.VERBOSE === "true")) {
          newConfiguration.verbose = true;
        }
        if ((loadedConfigObj.VERBOSE === false) || (loadedConfigObj.VERBOSE === "false")) {
          newConfiguration.verbose = false;
        }
      }

      if (loadedConfigObj.ENABLE_STDIN !== undefined) {
        console.log(MODULE_ID_PREFIX + " | LOADED ENABLE_STDIN: " + loadedConfigObj.ENABLE_STDIN);
        newConfiguration.enableStdin = loadedConfigObj.ENABLE_STDIN;
      }

      if (loadedConfigObj.KEEPALIVE_INTERVAL !== undefined) {
        console.log(MODULE_ID_PREFIX + " | LOADED KEEPALIVE_INTERVAL: " + loadedConfigObj.KEEPALIVE_INTERVAL);
        newConfiguration.keepaliveInterval = loadedConfigObj.KEEPALIVE_INTERVAL;
      }

      if (loadedConfigObj.TNN_MAX_NEURAL_NETWORK_CHILDREN !== undefined){
        console.log(MODULE_ID_PREFIX + " | LOADED TNN_MAX_NEURAL_NETWORK_CHILDREN: " + loadedConfigObj.TNN_MAX_NEURAL_NETWORK_CHILDREN);
        newConfiguration.maxNumberChildren = loadedConfigObj.TNN_MAX_NEURAL_NETWORK_CHILDREN;
      }


      if (loadedConfigObj.TNN_GLOBAL_MIN_SUCCESS_RATE !== undefined){
        console.log(MODULE_ID_PREFIX + " | LOADED TNN_GLOBAL_MIN_SUCCESS_RATE: " + loadedConfigObj.TNN_GLOBAL_MIN_SUCCESS_RATE);
        newConfiguration.globalMinSuccessRate = loadedConfigObj.TNN_GLOBAL_MIN_SUCCESS_RATE;
      }

      if (loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE !== undefined){
        console.log(MODULE_ID_PREFIX + " | LOADED TNN_LOCAL_MIN_SUCCESS_RATE: " + loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE);
        newConfiguration.localMinSuccessRate = loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE;
      }

      if (loadedConfigObj.TNN_LOCAL_PURGE_MIN_SUCCESS_RATE !== undefined){
        console.log(MODULE_ID_PREFIX + " | LOADED TNN_LOCAL_PURGE_MIN_SUCCESS_RATE: " + loadedConfigObj.TNN_LOCAL_PURGE_MIN_SUCCESS_RATE);
        newConfiguration.localPurgeMinSuccessRate = loadedConfigObj.TNN_LOCAL_PURGE_MIN_SUCCESS_RATE;
      }

      if (loadedConfigObj.TNN_EVOLVE_THREADS !== undefined){
        console.log(MODULE_ID_PREFIX + " | LOADED TNN_EVOLVE_THREADS: " + loadedConfigObj.TNN_EVOLVE_THREADS);
        newConfiguration.evolve.threads = loadedConfigObj.TNN_EVOLVE_THREADS;
      }

      if (loadedConfigObj.TNN_INPUTS_IDS !== undefined){
        console.log(MODULE_ID_PREFIX + " | LOADED TNN_INPUTS_IDS: " + loadedConfigObj.TNN_INPUTS_IDS);
        newConfiguration.inputsIdArray = loadedConfigObj.TNN_INPUTS_IDS;
      }

      if (loadedConfigObj.TNN_EVOLVE_ITERATIONS !== undefined){
        console.log(MODULE_ID_PREFIX + " | LOADED TNN_EVOLVE_ITERATIONS: " + loadedConfigObj.TNN_EVOLVE_ITERATIONS);
        if (newConfiguration.evolve === undefined) { newConfiguration.evolve = {}; }
        newConfiguration.evolve.iterations = loadedConfigObj.TNN_EVOLVE_ITERATIONS;
      }


      resolve(newConfiguration);
    }
    catch(err){
      console.error(chalkError(MODULE_ID_PREFIX + " | ERROR LOAD DROPBOX CONFIG: " + fullPath
        + "\n" + jsonPrint(err)
      ));
      reject(err);
    }

  });
}

function loadAllConfigFiles(){

  return new Promise(async function(resolve, reject){

    try {

      statsObj.status = "LOAD CONFIG";

      const defaultConfig = await loadConfigFile({folder: dropboxConfigDefaultFolder, file: dropboxConfigDefaultFile});

      if (defaultConfig) {
        defaultConfiguration = defaultConfig;
        console.log(chalkLog(MODULE_ID_PREFIX + " | +++ RELOADED DEFAULT CONFIG " + dropboxConfigDefaultFolder + "/" + dropboxConfigDefaultFile));
      }
      
      const hostConfig = await loadConfigFile({folder: dropboxConfigHostFolder, file: dropboxConfigHostFile});

      if (hostConfig) {
        hostConfiguration = hostConfig;
        console.log(chalkLog(MODULE_ID_PREFIX + " | +++ RELOADED HOST CONFIG " + dropboxConfigHostFolder + "/" + dropboxConfigHostFile));
      }
      
      let defaultAndHostConfig = merge(defaultConfiguration, hostConfiguration); // host settings override defaults
      let tempConfig = merge(configuration, defaultAndHostConfig); // any new settings override existing config

      configuration = deepcopy(tempConfig);

      resolve();

    }
    catch(err){
      reject(err);
    }
  });
}


//=========================================================================
// FILE SAVE
//=========================================================================
let saveFileQueueInterval;
let saveFileQueue = [];
let statsUpdateInterval;

configuration.saveFileQueueInterval = SAVE_FILE_QUEUE_INTERVAL;

statsObj.queues.saveFileQueue = {};
statsObj.queues.saveFileQueue.busy = false;
statsObj.queues.saveFileQueue.size = 0;


let saveCacheTtl = process.env.SAVE_CACHE_DEFAULT_TTL;

if (saveCacheTtl === undefined) { saveCacheTtl = SAVE_CACHE_DEFAULT_TTL; }

console.log(MODULE_ID_PREFIX + " | SAVE CACHE TTL: " + saveCacheTtl + " SECONDS");

let saveCacheCheckPeriod = process.env.SAVE_CACHE_CHECK_PERIOD;

if (saveCacheCheckPeriod === undefined) { saveCacheCheckPeriod = 10; }

console.log(MODULE_ID_PREFIX + " | SAVE CACHE CHECK PERIOD: " + saveCacheCheckPeriod + " SECONDS");

const saveCache = new NodeCache({
  stdTTL: saveCacheTtl,
  checkperiod: saveCacheCheckPeriod
});

function saveCacheExpired(file, fileObj) {
  debug(chalkLog("XXX $ SAVE"
    + " [" + saveCache.getStats().keys + "]"
    + " | " + file
  ));
  saveFileQueue.push(fileObj);
  statsObj.queues.saveFileQueue.size = saveFileQueue.length;
}

saveCache.on("expired", saveCacheExpired);

saveCache.on("set", function(file, fileObj) {
  debug(chalkLog(MODULE_ID_PREFIX + " | $$$ SAVE CACHE"
    + " [" + saveCache.getStats().keys + "]"
    + " | " + fileObj.folder + "/" + file
  ));
});

function saveFile(params, callback){

  let fullPath = params.folder + "/" + params.file;
  let limit = params.limit || DROPBOX_LIST_FOLDER_LIMIT;
  let localFlag = params.localFlag || false;

  debug(chalkInfo("LOAD FOLDER " + params.folder));
  debug(chalkInfo("LOAD FILE " + params.file));
  debug(chalkInfo("FULL PATH " + fullPath));

  let options = {};

  if (localFlag) {

    const objSizeMBytes = sizeof(params.obj)/ONE_MEGABYTE;

    showStats().then(function(){

    }).catch(function(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** SHOW STATS ERROR"));
    });

    console.log(chalkBlue(MODULE_ID_PREFIX + " | ... SAVING DROPBOX LOCALLY"
      + " | " + objSizeMBytes.toFixed(3) + " MB"
      + " | " + fullPath
    ));

    writeJsonFile(fullPath, params.obj, { mode: 0o777 })
    .then(function() {

      console.log(chalkBlue(MODULE_ID_PREFIX + " | SAVED DROPBOX LOCALLY"
        + " | " + objSizeMBytes.toFixed(3) + " MB"
        + " | " + fullPath
      ));
      if (callback !== undefined) { return callback(null); }

    })
    .catch(function(error){
      console.trace(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
        + " | !!! ERROR DROBOX LOCAL JSON WRITE | FILE: " + fullPath 
        + " | ERROR: " + error
        + " | ERROR\n" + jsonPrint(error)
      ));
      if (callback !== undefined) { return callback(error); }
    });
  }
  else {

    options.contents = JSON.stringify(params.obj, null, 2);
    options.autorename = params.autorename || false;
    options.mode = params.mode || "overwrite";
    options.path = fullPath;

    const dbFileUpload = function () {

      dropboxClient.filesUpload(options)
      .then(function(){
        debug(chalkLog("SAVED DROPBOX JSON | " + options.path));
        if (callback !== undefined) { return callback(null); }
      })
      .catch(function(error){
        if (error.status === 413){
          console.log(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: 413"
            + " | ERROR: FILE TOO LARGE"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else if (error.status === 429){
          console.log(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: TOO MANY WRITES"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else if (error.status === 500){
          console.log(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: DROPBOX SERVER ERROR"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else {
          console.log(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + "\n" + MODULE_ID_PREFIX + " | ERROR:        " + error
            + "\n" + MODULE_ID_PREFIX + " | ERROR CODE:   " + error.code
            + "\n" + MODULE_ID_PREFIX + " | ERROR STATUS: " + error.status
          ));
          if (callback !== undefined) { return callback(error); }
        }
      });
    };

    if (options.mode === "add") {

      dropboxClient.filesListFolder({path: params.folder, limit: limit})
      .then(function(response){

        debug(chalkLog("DROPBOX LIST FOLDER"
          + " | ENTRIES: " + response.entries.length
          + " | MORE: " + response.has_more
          + " | PATH:" + options.path
        ));

        let fileExits = false;

        async.each(response.entries, function(entry, cb){

          console.log(chalkLog(MODULE_ID_PREFIX + " | DROPBOX FILE"
            + " | " + params.folder
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
            + " | " + entry.name
          ));

          if (entry.name === params.file) {
            fileExits = true;
          }

          cb();

        }, function(err){
          if (err) {
            console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR DROPBOX SAVE FILE: " + err));
            if (callback !== undefined) { 
              return callback(err, null);
            }
            return;
          }
          if (fileExits) {
            console.log(chalkAlert(MODULE_ID_PREFIX + " | ... DROPBOX FILE EXISTS ... SKIP SAVE | " + fullPath));
            if (callback !== undefined) { callback(err, null); }
          }
          else {
            console.log(chalkAlert(MODULE_ID_PREFIX + " | ... DROPBOX DOES NOT FILE EXIST ... SAVING | " + fullPath));
            dbFileUpload();
          }
        });
      })
      .catch(function(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
        if (callback !== undefined) { callback(err, null); }
      });
    }
    else {
      dbFileUpload();
    }
  }
}

function initSaveFileQueue(cnf) {

  console.log(chalkLog(MODULE_ID_PREFIX + " | INIT DROPBOX SAVE FILE INTERVAL | " + msToTime(cnf.saveFileQueueInterval)));

  clearInterval(saveFileQueueInterval);

  saveFileQueueInterval = setInterval(function () {

    if (!statsObj.queues.saveFileQueue.busy && saveFileQueue.length > 0) {

      statsObj.queues.saveFileQueue.busy = true;

      const saveFileObj = saveFileQueue.shift();

      statsObj.queues.saveFileQueue.size = saveFileQueue.length;

      saveFile(saveFileObj, function(err) {
        if (err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** SAVE FILE ERROR ... RETRY | " + saveFileObj.folder + "/" + saveFileObj.file));
          saveFileQueue.push(saveFileObj);
          statsObj.queues.saveFileQueue.size = saveFileQueue.length;
        }
        else {
          console.log(chalkLog(MODULE_ID_PREFIX + " | SAVED FILE [Q: " + saveFileQueue.length + "] " + saveFileObj.folder + "/" + saveFileObj.file));
        }
        statsObj.queues.saveFileQueue.busy = false;
      });

    }
  }, cnf.saveFileQueueInterval);
}


//=========================================================================
// INTERVALS
//=========================================================================
const intervalsSet = new Set();

function clearAllIntervals(params){
  return new Promise(function(resolve, reject){
    try {
      [...intervalsSet].forEach(function(intervalHandle){
        console.log(chalkInfo(MODULE_ID_PREFIX + " | CLEAR INTERVAL | " + intervalHandle));
        clearInterval(intervalHandle);
      });
      resolve();
    }
    catch(err){
      reject(err);
    }
  });
}

//=========================================================================
// QUIT + EXIT
//=========================================================================

let quitWaitInterval;
let quitFlag = false;

function readyToQuit(params) {
  let flag = true; // replace with function returns true when ready to quit
  return flag;
}

async function quit(opts) {

  if (quitFlag) {
    console.log(chalkInfo(MODULE_ID_PREFIX + " | ALREADY IN QUIT"));
    if (opts) {
      console.log(chalkInfo(MODULE_ID_PREFIX + " | REDUNDANT QUIT INFO\n" + jsonPrint(opts) ));
    }
    return;
  }

  quitFlag = true;

  let options = opts || false;

  statsObj.elapsed = getElapsedTimeStamp();
  statsObj.timeStamp = getTimeStamp();
  statsObj.status = "QUIT";

  const forceQuitFlag = options.force || false;

  fsm.fsm_quit();

  try{
    await childQuitAll();

    await killAll();

    await showStats(true);
  }
  catch(err){
    console.log(MODULE_ID_PREFIX + " | *** QUIT ERROR: " + err);
  }


  if (options) {
    console.log(MODULE_ID_PREFIX + " | QUIT INFO\n" + jsonPrint(options) );
  }

  intervalsSet.add("quitWaitInterval");

  quitWaitInterval = setInterval(async function() {

    if (readyToQuit()) {

      await clearAllIntervals();

      if (forceQuitFlag) {
        console.log(chalkAlert(MODULE_ID_PREFIX + " | *** FORCE QUIT"
          + " | SAVE FILE BUSY: " + statsObj.queues.saveFileQueue.busy
          + " | SAVE FILE Q: " + statsObj.queues.saveFileQueue.size
        ));
      }
      else {
        console.log(chalkBlueBold(MODULE_ID_PREFIX + " | ALL PROCESSES COMPLETE ... QUITTING"
          + " | SAVE FILE BUSY: " + statsObj.queues.saveFileQueue.busy
          + " | SAVE FILE Q: " + statsObj.queues.saveFileQueue.size
        ));
      }

      const command = 'pkill ' + configuration.childIdPrefix + '*';

      shell.exec(command, function(code, stdout, stderr){

        console.log(chalkAlert(MODULE_ID_PREFIX + " | KILL ALL CHILD"
          + "\nCOMMAND: " + command
          + "\nCODE:    " + code
          + "\nSTDOUT:  " + stdout
          + "\nSTDERR:  " + stderr
        ));

        shell.cd(childPidFolderLocal);
        shell.rm(configuration.childIdPrefix + "*");
      });

      if (!global.dbConnection) {
        process.exit();
      }
      else {
        setTimeout(function() {

          global.dbConnection.close(async function () {
            console.log(chalkBlue(
                MODULE_ID_PREFIX + " | ==========================\n"
              + MODULE_ID_PREFIX + " | MONGO DB CONNECTION CLOSED\n"
              + MODULE_ID_PREFIX + " | ==========================\n"
            ));

            process.exit();
          });

        }, 1000);
      }

    }

  }, QUIT_WAIT_INTERVAL);

};

//=========================================================================
// STDIN
//=========================================================================
let stdin;
let abortCursor = false;

const cla = require("command-line-args");

const help = { name: "help", alias: "h", type: Boolean};

const enableStdin = { name: "enableStdin", alias: "S", type: Boolean, defaultValue: true };
const quitNow = { name: "quitNow", alias: "K", type: Boolean};
const quitOnComplete = { name: "quitOnComplete", alias: "q", type: Boolean };
const quitOnError = { name: "quitOnError", alias: "Q", type: Boolean, defaultValue: true };
const verbose = { name: "verbose", alias: "v", type: Boolean };
const testMode = { name: "testMode", alias: "X", type: Boolean};

const maxNumberChildren = { name: "maxNumberChildren", alias: "N", type: Number};
const useLocalTrainingSets = { name: "useLocalTrainingSets", alias: "L", type: Boolean};
const loadAllInputs = { name: "loadAllInputs", type: Boolean};
const loadTrainingSetFromFile = { name: "loadTrainingSetFromFile", alias: "t", type: Boolean};
const inputsId = { name: "inputsId", alias: "i", type: String};
const trainingSetFile = { name: "trainingSetFile", alias: "T", type: String};
const networkCreateMode = { name: "networkCreateMode", alias: "n", type: String, defaultValue: "evolve" };
const hiddenLayerSize = { name: "hiddenLayerSize", alias: "H", type: Number};
const seedNetworkId = { name: "seedNetworkId", alias: "s", type: String };
const useBestNetwork = { name: "useBestNetwork", alias: "b", type: Boolean };
const evolveIterations = { name: "evolveIterations", alias: "I", type: Number};
const targetServer = { name: "targetServer", type: String };

const optionDefinitions = [
  maxNumberChildren,
  useLocalTrainingSets,
  loadAllInputs,
  loadTrainingSetFromFile,
  inputsId,
  trainingSetFile,
  networkCreateMode,
  hiddenLayerSize,
  seedNetworkId,
  useBestNetwork, 
  enableStdin, 
  quitOnComplete, 
  quitOnError, 
  verbose, 
  evolveIterations, 
  testMode,
  help
];

const commandLineConfig = cla(optionDefinitions);

console.log(chalkInfo(MODULE_ID_PREFIX + " | COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));


if (commandLineConfig.targetServer === "LOCAL"){
  commandLineConfig.targetServer = "http://127.0.0.1:9997/util";
}
if (commandLineConfig.targetServer === "REMOTE"){
  commandLineConfig.targetServer = "http://word.threeceelabs.com/util";
}

if (Object.keys(commandLineConfig).includes("help")) {
  console.log(MODULE_ID_PREFIX + " |optionDefinitions\n" + jsonPrint(optionDefinitions));
  quit("help");
}

statsObj.commandLineConfig = commandLineConfig;


function loadCommandLineArgs(){

  return new Promise(function(resolve, reject){

    statsObj.status = "LOAD COMMAND LINE ARGS";

    const commandLineConfigKeys = Object.keys(commandLineConfig);

    async.each(commandLineConfigKeys, function(arg, cb){

      if (arg === "evolveIterations"){
        configuration.evolve.iterations = commandLineConfig[arg];
        console.log(MODULE_ID_PREFIX + " | --> COMMAND LINE CONFIG | " + arg + ": " + configuration.evolve.iterations);
      }
      else {
        configuration[arg] = commandLineConfig[arg];
        console.log(MODULE_ID_PREFIX + " | --> COMMAND LINE CONFIG | " + arg + ": " + configuration[arg]);
      }

      cb();

    }, function(){
      statsObj.commandLineArgsLoaded = true;
      resolve();
    });

  });
}


function initChildPingAllInterval(params){

  let interval = (params) ? params.interval : configuration.childPingAllInterval;

  return new Promise(function(resolve, reject){

    statsObj.status = "INIT CHILD PING ALL INTERVAL";

    clearInterval(childPingAllInterval);

    childPingAllInterval = setInterval(async function(){

      try{
        await childPingAll();
      }
      catch(err){
        console.log(chalkAlert(MODULE_ID_PREFIX + " | *** CHILD PING ALL ERROR: " + err));
      }

    }, interval);

    intervalsSet.add("childPingAllInterval");

    resolve();

  });
}

function loadTrainingSet(params){

  return new Promise(async function(resolve, reject){

    statsObj.status = "LOAD TRAINING SET";

    console.log(chalkLog(MODULE_ID_PREFIX
      + " | LOAD ARCHIVE FLAG FILE: " + configuration.userArchiveFolder + "/" + configuration.defaultUserArchiveFlagFile
    ));

    let archiveFlagObj;

    try{
      archiveFlagObj = await loadFileRetry({folder: configuration.userArchiveFolder, file: configuration.defaultUserArchiveFlagFile});
      console.log(chalkNetwork(MODULE_ID_PREFIX + " | USERS ARCHIVE FLAG FILE\n" + jsonPrint(archiveFlagObj)));
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** USERS ARCHIVE FLAG FILE LOAD ERROR: " + err));
      statsObj.loadUsersArchiveBusy = false;
      statsObj.trainingSetReady = false;
      return reject(err);
    }


    console.log(chalkLog(MODULE_ID_PREFIX + " | USER ARCHIVE FILE | PATH: " + archiveFlagObj.path + " | SIZE: " + archiveFlagObj.size));

    if (archiveFlagObj.path !== statsObj.archivePath) {

      try {
        await loadUsersArchive({path: archiveFlagObj.path, size: archiveFlagObj.size});
        statsObj.archiveModified = getTimeStamp();
        statsObj.loadUsersArchiveBusy = false;
        statsObj.archivePath = archiveFlagObj.path;
        statsObj.trainingSetReady = true;
        runOnceFlag = true;
        resolve();
      }
      catch(err){
        statsObj.loadUsersArchiveBusy = false;
        statsObj.trainingSetReady = false;
        return reject(err);
      }
    }
    else {
      console.log(chalkLog(MODULE_ID_PREFIX + " | USERS ARCHIVE SAME ... SKIPPING | " + archiveFlagObj.path));
      statsObj.loadUsersArchiveBusy = false;
      statsObj.trainingSetReady = true;
      resolve();
    }

  });
}

//=========================================================================
// FSM
//=========================================================================
const Stately = require("stately.js");
const FSM_TICK_INTERVAL = ONE_SECOND;

let fsm;
let fsmTickInterval;
let fsmPreviousState = "RESET";
let sentAllChildrenCompleteFlag = false;
let createChildrenInProgress = false;
let killAllInProgress = false;

statsObj.fsmState = "RESET";

function reporter(event, oldState, newState) {

  statsObj.fsmState = newState;

  fsmPreviousState = oldState;

  console.log(chalkLog(MODULE_ID_PREFIX + " | --------------------------------------------------------\n"
    + MODULE_ID_PREFIX + " | << FSM >> MAIN"
    + " | " + event
    + " | " + fsmPreviousState
    + " -> " + newState
    + "\nTNN | --------------------------------------------------------"
  ));
}


const fsmStates = {

  "RESET":{

    onEnter: async function(event, oldState, newState) {

      if (event !== "fsm_tick") {

        console.log(chalkTwitter(MODULE_ID_PREFIX + " | FSM RESET"));

        reporter(event, oldState, newState);
        statsObj.status = "FSM RESET";

        try{
          await childQuitAll();
          await killAll();
          await showStats(true);
        }
        catch(err){
          console.log(MODULE_ID_PREFIX + " | *** QUIT ERROR: " + err);
        }
      }

    },

    fsm_tick: function() {

      if (getChildProcesses() > 0) {

        if (!killAllInProgress) {

          killAllInProgress = true;

          killAll()
            .then(function(){
              killAllInProgress = false;
            })
            .catch(function(err){
              killAllInProgress = false;
              console.log(chalkError(MODULE_ID_PREFIX + " | KILL ALL CHILD ERROR: " + err));
            });
        }
      }
      else {
        checkChildState({checkState: "RESET", noChildrenTrue: true}).then(function(allChildrenReset){
          console.log(chalkTwitter(MODULE_ID_PREFIX + " | ALL CHILDREN RESET: " + allChildrenReset));
          if (!killAllInProgress && allChildrenReset) { fsm.fsm_resetEnd(); }
        })
        .catch(function(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** ALL CHILDREN RESET ERROR: " + err));
          fsm.fsm_error();
        });
      }
    },

    "fsm_resetEnd": "IDLE"
  },

  "IDLE":{
    onEnter: function(event, oldState, newState) {

      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);

        statsObj.status = "FSM IDLE";

        checkChildState({checkState: "IDLE", noChildrenTrue: true}).then(function(allChildrenIdle){
          console.log(chalkTwitter(MODULE_ID_PREFIX + " | ALL CHILDREN IDLE: " + allChildrenIdle));
        })
        .catch(function(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** ALL CHILDREN IDLE ERROR: " + err));
          fsm.fsm_error();
        });
      }

    },

    fsm_tick: function() {

      checkChildState({checkState: "IDLE", noChildrenTrue: true}).then(function(allChildrenIdle){
        debug("INIT TICK | ALL CHILDREN IDLE: " + allChildrenIdle );
        if (allChildrenIdle) { fsm.fsm_init(); }
      })
      .catch(function(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ALL CHILDREN IDLE ERROR: " + err));
        fsm.fsm_error();
      });

    },

    "fsm_init": "INIT",
    "fsm_quit": "QUIT",
    "fsm_error": "ERROR"
  },

  "QUIT":{
    onEnter: function(event, oldState, newState) {

      quitFlag = true;

      reporter(event, oldState, newState);

      statsObj.status = "FSM QUIT";

      quit("FSM QUIT");
    }
  },

  "EXIT":{
    onEnter: function(event, oldState, newState) {

      quitFlag = true;

      reporter(event, oldState, newState);

      statsObj.status = "FSM EXIT";

      quit("FSM EXIT");
    }
  },

  "ERROR":{
    onEnter: function(event, oldState, newState) {

      quitFlag = true;

      reporter(event, oldState, newState);

      statsObj.status = "FSM ERROR";

      quit("FSM ERROR");
    }
  },

  "INIT":{
    onEnter: async function(event, oldState, newState) {
      if (event !== "fsm_tick") {

        reporter(event, oldState, newState);

        statsObj.status = "FSM INIT";

        // const childId = params.childId;
        // const appPath = params.appPath;
        // const env = params.env;
        // const config = params.config || {};
        // const verbose = params.verbose || false;

        try {
          await childCreateAll();
          console.log(chalkBlue(MODULE_ID_PREFIX + " | CREATED ALL CHILDREN: " + Object.keys(childHashMap).length));
        }
        catch(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** CREATE ALL CHILDREN ERROR: " + err));
          fsm.fsm_error();
        }

      }
    },
    fsm_tick: function() {

      checkChildState({checkState:"READY", noChildrenTrue: false}).then(function(allChildrenReady){

        debug("READY INIT"
          + " | ALL CHILDREN READY: " + allChildrenReady
        );

        if (maxChildren() && allChildrenReady) { fsm.fsm_ready(); }

      })
      .catch(function(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ALL CHILDREN READY ERROR: " + err));
        fsm.fsm_error();
      });

    },
    "fsm_quit": "QUIT",
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR",
    "fsm_ready": "READY",
    "fsm_reset": "RESET"
  },

  "READY":{
    onEnter: function(event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);

        statsObj.status = "FSM READY";

        checkChildState({checkState:"READY", noChildrenTrue: false}).then(function(allChildrenReady){
          console.log(MODULE_ID_PREFIX + " | ALL CHILDREN READY: " + allChildrenReady);
        })
        .catch(function(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** ALL CHILDREN READY ERROR: " + err));
          fsm.fsm_error();
        });

      }
    },
    fsm_tick: function() {

      checkChildState({checkState:"READY", noChildrenTrue: false})
      .then(function(allChildrenReady){

        debug("READY TICK"
          + " | ALL CHILDREN READY: " + allChildrenReady
        );

        if (maxChildren() && allChildrenReady) { 
          fsm.fsm_run();
        }

      })
      .catch(function(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ALL CHILDREN READY ERROR: " + err));
        fsm.fsm_error();
      });

    },
    "fsm_run": "RUN",
    "fsm_quit": "QUIT",
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET"
  },


  "RUN":{
    onEnter: async function(event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
        statsObj.status = "FSM RUN";

        try {

          let seedParams = {};

          seedParams.purgeMin = false ;  // use localPurgeMinSuccessRate to delete nn's
          seedParams.folders = [globalBestNetworkFolder, localBestNetworkFolder];

          if (configuration.seedNetworkId) {
            seedParams.networkId = configuration.seedNetworkId;
          }
          console.log("seedParams\n" + jsonPrint(seedParams));

          await initChildPingAllInterval();
          await childStatsAll();

          await loadInputsDropboxFolder({folder: defaultInputsFolder});
          await loadSeedNeuralNetwork(seedParams);
          await loadTrainingSet({folder: configuration.userArchiveFolder, file: configuration.defaultUserArchiveFlagFile});
          await childStartAll();

        }
        catch(err){
          console.trace(chalkError(MODULE_ID_PREFIX + " | *** RUN ERROR: " + err));
        }

        // console.log(MODULE_ID_PREFIX + " | RUN | onEnter | " + event);
      }

    },
    fsm_tick: function() {

      if (configuration.quitOnComplete){
        checkChildState({checkState:"COMPLETE"}).then(function(allChildrenComplete){

          debug("FETCH_END TICK"
            + " | ALL CHILDREN COMPLETE: " + allChildrenComplete
          );

          if (allChildrenComplete) { 
            console.log(chalkLog(MODULE_ID_PREFIX + " | ALL CHILDREN COMPLETE"));
            sentAllChildrenCompleteFlag = false;
            fsm.fsm_complete();
          }

        })
        .catch(function(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** ALL CHILDREN COMPLETE ERROR: " + err));
          fsm.fsm_error();
        });
      }

      else if (!maxChildren()){
        console.log(chalkLog(MODULE_ID_PREFIX 
          + " | LESS THAN MAX CHILDREN: " + getNumberOfChildren() 
          + " | MAX: " + configuration.maxNumberChildren
        ));

        if (!createChildrenInProgress){

          createChildrenInProgress = true;

          childCreateAll()
            .then(function(childIdArray){
              console.log(chalkBlue(MODULE_ID_PREFIX + " | CREATED ALL CHILDREN: " + childIdArray.length));
              childIdArray.forEach(async function(childId){
                await startNetworkCreate({childId: childId});
              });
              createChildrenInProgress = false;
            })
            .catch(function(err){
              console.log(chalkError(MODULE_ID_PREFIX + " | *** CREATE ALL CHILDREN ERROR: " + err));
              createChildrenInProgress = false;
              fsm.fsm_error();
            });
        }
      }

    },
    "fsm_quit": "QUIT",
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET",
    "fsm_complete": "COMPLETE"
  },

  "COMPLETE":{

    onEnter: function(event, oldState, newState) {

      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);

        statsObj.status = "FSM COMPLETE";

        console.log(chalkBlueBold(MODULE_ID_PREFIX + " | FSM COMPLETE | QUITTING ..."));

        quit({cause:"FSM_COMPLETE"});
      }

    },

    fsm_tick: function() {

      checkChildState({checkState:"RESET", noChildrenTrue: true}).then(function(allChildrenReset){
        console.log(MODULE_ID_PREFIX + " | RESET TICK"
          + " | ALL CHILDREN RESET: " + allChildrenReset
        );
        if (allChildrenReset) { fsm.fsm_resetEnd(); }
      })
      .catch(function(err){
        fsm.fsm_error();
      });

    },

    "fsm_init": "INIT",
    "fsm_resetEnd": "INIT",
    "fsm_quit": "QUIT",
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET"
  },
};

fsm = Stately.machine(fsmStates);

function initFsmTickInterval(interval) {

  console.log(chalkLog(MODULE_ID_PREFIX + " | INIT FSM TICK INTERVAL | " + msToTime(interval)));

  clearInterval(fsmTickInterval);

  fsmTickInterval = setInterval(function() {
    fsm.fsm_tick();
  }, FSM_TICK_INTERVAL);
}

// reporter("NEW", "NEW", fsm.getMachineState());

//=========================================================================
// CHILD PROCESS
//=========================================================================
configuration.reinitializeChildOnClose = false;

const cp = require("child_process");
let childHashMap = {};

function maxChildren(){
  return getNumberOfChildren() >= configuration.maxNumberChildren;
}

function getNumberOfChildren(){
  return Object.keys(childHashMap).length;
}

function childCreateAll(params){

  return new Promise(async function(resolve, reject){

    params = params || {};

    let childrenCreatedArray = [];
    let maxNumberChildren = params.maxNumberChildren || configuration.maxNumberChildren;

    let interval = params.interval || 5*ONE_SECOND;
    let childIndex = params.childIndex || configuration.childIndex;

    let childId = CHILD_PREFIX + "_" + childIndex;

    let options = {};
    options.cwd = "/Volumes/RAID1/projects/twitterNeuralNetwork";
    options.env = {};
    options.env = configuration.DROPBOX;
    options.env.DROPBOX_STATS_FILE = statsObj.runId + "_" + childId + ".json";
    options.env.CHILD_ID = childId;
    options.env.NODE_ENV = "production";

    let createParams = {};
    createParams.args = {};
    createParams.options = {};
    createParams.config = {};
    createParams.childId = childId;
    createParams.verbose = params.verbose || configuration.verbose;
    createParams.appPath = params.appPath || configuration.childAppPath;
    createParams.options = params.options || options;
    createParams.config = params.config || {};


    async.whilst(

      function() {
        return !maxChildren();
      },

      function(cb){

        setTimeout(async function(){

          // const childId = params.childId;
          // const appPath = params.appPath;
          // const env = params.env;
          // const config = params.config || {};
          // const verbose = params.verbose || false;

          // options.env = {};
          // options.env = configuration.DROPBOX;
          // options.env.DROPBOX_NNC_STATS_FILE = statsObj.runId + "_" + childId + ".json";
          // options.env.NNC_CHILD_ID = childId;
          // options.env.NODE_ENV = "production";


          childId = CHILD_PREFIX + "_" + hostname + "_" + process.pid + "_" + childIndex;
          createParams.childId = childId;
          options.env.CHILD_ID = childId;

          if (configuration.verbose) {console.log("createParams\n" + jsonPrint(createParams));}

          childCreate(createParams)
          .then(function(){
            childrenCreatedArray.push(childId);
            childIndex += 1;
            configuration.childIndex = childIndex;
            statsObj.childIndex = childIndex;
            cb();
          })
          .catch(function(err){
            console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR CHILD CREATE ERROR: " + err));
            return cb(err);
          });


        }, interval);
      },

      function(err){
        if (err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR CREATE ALL CHILDREN: " + err));
          return reject(err);
        }
        resolve(childrenCreatedArray);
      });


  });
}

function childStatsAll(params){

  return new Promise(async function(resolve, reject){

    params = params || {};

    const now = params.now || false;

    let defaultCommand = {};
    defaultCommand.op = "STATS";
    defaultCommand.now = now;

    let command = params.command || defaultCommand;

    try {
      await childSendAll({command: command});
      resolve();
    }
    catch(err){
      reject(err);
    }

  });
}

function getNewNetworkId(params){
  params = params || {};
  params.prefix = params.prefix || configuration.networkIdPrefix;
  const networkId = params.prefix + "_" + networkIndex;
  networkIndex += 1;
  return networkId;
}

function startNetworkCreate(params){

  return new Promise(async function(resolve, reject){

    try {
      let networkId = getNewNetworkId();

      console.log(chalkBlue(MODULE_ID_PREFIX + " | START EVOLVE CHILD"
        + " | CHILD: " + params.childId
        + " | NETWORK ID: " + networkId
      ));

      await initNetworkCreate({childId: params.childId, networkId: networkId});
    }
    catch(err){
      return reject(err);
    }

  });
}

function childStartAll(params){

  return new Promise(function(resolve, reject){
    try {

      console.log(chalkBlue(MODULE_ID_PREFIX + " | START EVOLVE ALL CHILDREN: " + Object.keys(childHashMap).length));

      Object.keys(childHashMap).forEach(async function(childId) {

        if (childHashMap[childId] !== undefined){
          try {
            await startNetworkCreate({childId: childId});
          }
          catch(err){
            return reject(err);
          }
         }

      });

      resolve();
    }
    catch(err){
      return reject(err);
    }
  });
}

function childQuitAll(params){

  return new Promise(async function(resolve, reject){

    params = params || {};

    const now = params.now || false;

    let defaultCommand = {};
    defaultCommand.op = "QUIT";
    defaultCommand.now = now;

    let command = params.command || defaultCommand;

    try {
      await childSendAll({command: command});
      resolve();
    }
    catch(err){
      reject(err);
    }

  });
}

function childSend(params){

  params = params || {};

  return new Promise(function(resolve, reject){

    const childId = params.command.childId;
    const command = params.command;

    statsObj.status = "SEND CHILD | CH ID: " + childId + " | " + command.op;

    if (configuration.verbose) {console.log(chalkLog(MODULE_ID_PREFIX + " | " + statsObj.status));}

    if (childHashMap[childId] === undefined || !childHashMap[childId].child || !childHashMap[childId].child.connected) {
      console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX CHILD SEND ABORTED | CHILD NOT CONNECTED OR UNDEFINED | " + childId));
    // if (childHashMap[childId] === undefined || childHashMap[childId].child === undefined) {
      return reject(new Error("CHILD NOT CONNECTED OR UNDEFINED: " + childId));
    }

    childHashMap[childId].child.send(command, function(err) {
      if (err) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** CHILD SEND INIT ERROR"
          + " | OP: " + command.op
          + " | ERR: " + err
        ));
        return reject(err);
      }
      resolve();
    });

  });
}

function childSendAll(params){

  params = params || {};

  const childId = (params.command) ? params.command.childId : params.childId ;
  const op = (params.command) ? params.command.op : (params.op) ? params.op : "PING" ;
  const now = params.now || true;

  let defaultCommand = {};
  defaultCommand.op = op;
  defaultCommand.now = now;
  defaultCommand.pingId = getTimeStamp();

  let command = params.command || defaultCommand;

  return new Promise(function(resolve, reject){
    try {
      Object.keys(childHashMap).forEach(async function(childId) {
        if (childHashMap[childId] !== undefined) {
          command.childId = childId;
          await childSend({command: command});
        }
      });
      resolve();
    }
    catch(err){
      reject(err);
    }
  });
}

function childInit(params){

  params = params || {};

  const childId = params.childId;
  const config = params.config || {};
  const verbose = params.verbose || false;

  statsObj.status = "INIT CHILD | CH ID: " + childId;

  return new Promise(async function(resolve, reject){

    const command = {
      op: "INIT",
      childId: childId,
      verbose: verbose,
      config: config
    };

    try {
      const response = await childSend({childId: childId, command: command});
      resolve(response);
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** CHILD SEND INIT ERROR"
        + " | ERR: " + err
        + "\nCOMMAND\n" + jsonPrint(command)
      ));
      return reject(err);
    }

  });
}

function childCreate(params){

  return new Promise(async function(resolve, reject){

    params = params || {};
    let args = params.args || [];

    const childId = params.childId;
    const appPath = params.appPath;
    const env = params.env;
    const config = params.config || {};
    const verbose = params.verbose || false;

    let child = {};
    let options = {};

    // console.log("cwd: " + process.cwd());

    options.cwd = params.cwd || "/Volumes/RAID1/projects/twitterNeuralNetwork";


    statsObj.status = "CHILD CREATE | CH ID: " + childId + " | APP: " + appPath;

    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | CREATE CHILD | " + childId));

    try {

      if (env) {
        options.env = env;
      }
      else {
        options.env = {};
        options.env = configuration.DROPBOX;
        options.env.DROPBOX_STATS_FILE = statsObj.runId + "_" + childId + ".json";
        options.env.CHILD_ID = childId;
        options.env.NODE_ENV = "production";
      }

      childHashMap[childId] = {};
      childHashMap[childId].status = "NEW";
      childHashMap[childId].messageQueue = [];

      child = cp.fork(appPath, args, options);

      childHashMap[childId].pid = child.pid;

      child.on("message", async function(m){

        let snId = "---";
        let snIdRes = "---";

        let newNeuralNetwork;

        if (configuration.verbose) {console.log(chalkLog(MODULE_ID_PREFIX + " | <R MSG | CHILD " + childId + " | " + m.op));}

        switch(m.op) {

          case "STATS":
            childHashMap[childId].status = m.data.fsmStatus;
            objectPath.set(statsObj, ["children", childId, "status"], childHashMap[childId].status);
          break;

          case "EVOLVE_SCHEDULE":
            console.log(chalkLog(MODULE_ID_PREFIX + " | EVOLVE | " + m.childId + " | " + m.stats.networkId
              + " | F: " + m.stats.fitness
              + " | E: " + m.stats.error
              + " | S: " + moment(m.stats.evolveStart).format(compactDateTimeFormat)
              + " | N: " + moment().format(compactDateTimeFormat)
              + " | R: " + msToTime(m.stats.evolveElapsed)
              + " | RATE: " + (m.stats.iterationRate/1000.0).toFixed(1) + " s/I"
              + " | ETC: " + msToTime(m.stats.timeToComplete)
              + " | ETC: " + moment().add(m.stats.timeToComplete).format(compactDateTimeFormat)
              + " | I: " + m.stats.iteration + " / " + m.stats.totalIterations
            ));
          break;

          case "EVOLVE_COMPLETE":

            const nn = networkDefaults(m.networkObj);

            statsObj.evolveStats.total += 1;

            snId = (nn.seedNetworkId !== undefined) ? nn.seedNetworkId : "---";
            snIdRes = (nn.seedNetworkId !== undefined) ? nn.seedNetworkRes.toFixed(2) : "---";

            console.log(chalkBlue("\nTNN ========================================================\n"
              +   MODULE_ID_PREFIX + " | NETWORK EVOLVE + TEST COMPLETE"
              + "\nTNN |                  " + m.childId
              + "\nTNN | NID:             " + nn.networkId
              + "\nTNN | SR%:             " + nn.test.results.successRate.toFixed(2) + "%"
              + "\nTNN | TEST [PASS/SET]: " + nn.test.results.numPassed + "/" + nn.test.results.numTests
              + "\nTNN | SEED:            " + snId
              + "\nTNN | SEED SR%:        " + snIdRes
              + "\nTNN | ELAPSED:         " + msToTime(nn.evolve.elapsed)
              + "\nTNN | ITERTNS:         " + m.statsObj.evolve.results.iterations
              + "\nTNN | ERROR:           " + m.statsObj.evolve.results.error
              + "\nTNN | INPUTS ID:       " + nn.inputsId
              + "\nTNN | INPUTS:          " + nn.network.input
              + "\nTNN | OUTPUTS:         " + nn.network.output
              + "\nTNN | DROPOUT:         " + nn.network.dropout
              + "\nTNN | NODES:           " + nn.network.nodes.length
              + "\nTNN | CONNS:           " + nn.network.connections.length
            ));

            newNeuralNetwork = new NeuralNetwork(nn);

            newNeuralNetwork.markModified("overallMatchRate");

            newNeuralNetwork
            .save()
            .catch(function(err){
              console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR SAVE NN TO DB" 
                + " | NID: " + nn.networkId
                + " | " + err.message
              ));
            });

            resultsHashmap[nn.networkId] = {};
            resultsHashmap[nn.networkId] = omit(nn, ["network", "inputs", "outputs", "inputsObj"]);
            resultsHashmap[nn.networkId].status = "COMPLETE";
            resultsHashmap[nn.networkId].stats = {};
            resultsHashmap[nn.networkId].stats = omit(m.statsObj, ["inputsObj", "train", "outputs", "normalization"]);


            if (childHashMap[m.childId] === undefined) {
              console.log(chalkError("??? CHILD NOT IN childHashMap ??? | CHILD ID: "+ m.childId));
              childHashMap[m.childId] = {};
              childHashMap[m.childId].status = "IDLE";
            }
            else {
              if (configuration.quitOnComplete) {
                childHashMap[m.childId].status = "COMPLETE";
              }
              else {
                childHashMap[m.childId].status = "READY";
              }
            }

            if (m.statsObj.evolve.results.iterations < nn.evolve.options.iterations) {

              console.log(chalkError(MODULE_ID_PREFIX + " | XXX | NOT SAVING NN FILE TO DROPBOX ... EARLY COMPLETE?"
                + " | " + nn.networkId
                + " | ITRNS: " + m.statsObj.evolve.results.iterations
                + " | MIN: " + configuration.globalMinSuccessRate.toFixed(2) + "%"
                + " | " + nn.successRate.toFixed(2) + "%"
              ));

              resultsHashmap[nn.networkId].status = "FAIL";

              // saveFileQueue.push({localFlag: false, folder: statsFolder, file: statsFile, obj: statsObj});

              printNetworkObj(MODULE_ID_PREFIX + " | " + nn.networkId, nn);
            }
            else if (
              (nn.seedNetworkId && (nn.test.results.successRate > nn.seedNetworkRes)) // better than seed nn
              || (!nn.seedNetworkId && (nn.test.results.successRate >= configuration.localMinSuccessRate)) // no seed but better than local min
              || (nn.test.results.successRate >= configuration.globalMinSuccessRate) // better than global min
              ) { 

              // It's a Keeper!!

              bestNetworkFile = nn.networkId + ".json";

              networkHashMap.set(
                nn.networkId, 
                { 
                  entry: {
                    client_modified: moment(),
                    name: bestNetworkFile,
                    content_hash: false
                  }, 
                  networkObj: nn
                }
              );

              // Add to nn child better than parent array
              if (nn.seedNetworkId && (nn.test.results.successRate > nn.seedNetworkRes)) {

                betterChildSeedNetworkIdSet.add(nn.networkId);

                nn.betterChild = true;
                resultsHashmap[nn.networkId].betterChild = true;

                console.log(chalk.green(MODULE_ID_PREFIX + " | +++ BETTER CHILD"
                  + " [" + betterChildSeedNetworkIdSet.size + "] " + nn.networkId
                  + " | SR: " + nn.test.results.successRate.toFixed(3) + "%"
                  + " | SEED: " + nn.seedNetworkId
                  + " | SR: " + nn.seedNetworkRes.toFixed(3) + "%"
                ));
              }
              // no seed but better than localMinSuccessRate, so act like better child and start parent/child chain
              else if (!nn.seedNetworkId && (nn.test.results.successRate >= configuration.localMinSuccessRate)) {

                betterChildSeedNetworkIdSet.add(nn.networkId);

                nn.betterChild = false;
                resultsHashmap[nn.networkId].betterChild = false;

                console.log(chalkGreen(MODULE_ID_PREFIX + " | +++ ADD LOCAL SUCCESS TO BETTER CHILD SET"
                  + " [" + betterChildSeedNetworkIdSet.size + "] " + nn.networkId
                  + " | SR: " + nn.test.results.successRate.toFixed(3) + "%"
                ));
              }
              else {
                nn.betterChild = false;
                resultsHashmap[nn.networkId].betterChild = false;
              }

              if (inputsNetworksHashMap[nn.inputsId] === undefined) {
                inputsNetworksHashMap[nn.inputsId] = new Set();
              }

              inputsNetworksHashMap[nn.inputsId].add(nn.networkId);

              console.log(chalkLog(MODULE_ID_PREFIX + " | INPUTS ID"
                + " | " + nn.inputsId
                + " | INPUTS: " + nn.inputsObj.meta.numInputs
                + " | " + inputsNetworksHashMap[nn.inputsId].size + " NETWORKS"
              ));

              if (nn.test.results.successRate >= configuration.globalMinSuccessRate) {

                console.log(chalkInfo(MODULE_ID_PREFIX + " | ### SAVING NN FILE TO DROPBOX GLOBAL BEST"
                  + " | " + globalBestNetworkFolder + "/" + bestNetworkFile
                ));

                resultsHashmap[nn.networkId].status = "PASS GLOBAL";

                statsObj.evolveStats.passGlobal += 1;

                // slackText = "\n*GLOBAL BEST | " + nn.test.results.successRate.toFixed(2) + "%*";
                // slackText = slackText + "\n              " + nn.networkId;
                // slackText = slackText + "\nIN:           " + nn.inputsId;
                // slackText = slackText + "\nINPUTS:       " + nn.network.input;
                // slackText = slackText + "\nBETTER CHILD: " + nn.betterChild;
                // slackText = slackText + "\nELAPSED:      " + msToTime(nn.evolve.elapsed);

                // slackPostMessage(slackChannelPassGlobal, slackText);

                // printNetworkObj(MODULE_ID_PREFIX + " | " + nn.networkId, nn);

                saveFileQueue.push({localFlag: false, folder: globalBestNetworkFolder, file: bestNetworkFile, obj: nn});
                // saveFileQueue.push({localFlag: false, folder: statsFolder, file: statsFile, obj: statsObj});
              }
              else if (nn.test.results.successRate >= configuration.localMinSuccessRate) {

                localNetworkFile = nn.networkId + ".json";

                console.log(chalkLog(MODULE_ID_PREFIX + " | ... SAVING NN FILE TO DROPBOX LOCAL BEST"
                  + " | " + localBestNetworkFolder + "/" + localNetworkFile
                ));

                resultsHashmap[nn.networkId].status = "PASS LOCAL";

                statsObj.evolveStats.passLocal += 1;

                // slackText = "\n*LOCAL BEST | " + nn.test.results.successRate.toFixed(2) + "%*";
                // slackText = slackText + "\n              " + nn.networkId;
                // slackText = slackText + "\nIN:           " + nn.inputsId;
                // slackText = slackText + "\nINPUTS:       " + nn.network.input;
                // slackText = slackText + "\nBETTER CHILD: " + nn.betterChild;
                // slackText = slackText + "\nELAPSED:      " + msToTime(nn.evolve.elapsed);

                // slackPostMessage(slackChannelPassLocal, slackText);
                // printNetworkObj(MODULE_ID_PREFIX + " | " + nn.networkId, nn);

                saveFileQueue.push({localFlag: false, folder: localBestNetworkFolder, file: localNetworkFile, obj: nn});
                // saveFileQueue.push({localFlag: false, folder: statsFolder, file: statsFile, obj: statsObj});
              }

              // printNetworkObj(MODULE_ID_PREFIX + " | " + nn.networkId, nn);
            }
            else {
              console.log(chalkInfo(MODULE_ID_PREFIX + " | XXX | NOT SAVING NN GLOBAL DROPBOX ... LESS THAN GLOBAL MIN SUCCESS *OR* NOT BETTER THAN SEED"
                + " | " + nn.networkId
                + " | " + nn.successRate.toFixed(2) + "%"
                + " | " + configuration.globalMinSuccessRate.toFixed(2) + "%"
              ));

              resultsHashmap[nn.networkId].status = "FAIL";
              // saveFileQueue.push({localFlag: false, folder: statsFolder, file: statsFile, obj: statsObj});

              // slackText = "\n*-FAIL-*";
              // slackText = slackText + "\n*" + nn.test.results.successRate.toFixed(2) + "%*";
              // slackText = slackText + "\n" + nn.networkId;
              // slackText = slackText + "\nELAPSED: " + msToTime(nn.evolve.elapsed);
              // slackText = slackText + "\nIN: " + nn.inputsId;
              // slackText = slackText + "\nINPUTS: " + nn.network.input;

              // slackPostMessage(slackChannelFail, slackText);

              statsObj.evolveStats.fail += 1;
              // printNetworkObj(MODULE_ID_PREFIX + " | " + nn.networkId, nn);

              // printNetworkObj("TNN" + newNeuralNetwork.networkId, newNeuralNetwork);
            }

            statsObj.evolveStats.results[nn.networkId] = {};
            statsObj.evolveStats.results[nn.networkId] = resultsHashmap[nn.networkId];

            printNetworkObj(MODULE_ID_PREFIX + " | " + nn.networkId, nn);

            printResultsHashmap();

            if (!configuration.quitOnComplete){
              try{
                await startNetworkCreate({childId: childId});
              }
              catch(err){
                console.log(chalkError(MODULE_ID_PREFIX 
                  + " | " + childId
                  + " | *** START NETWORK CREATE ERROR: " + err
                ));
              }
            }

           break;



          case "EXIT":
          case "QUIT":
          case "ERROR":
          case "INIT":
          case "INIT_COMPLETE":
          case "PONG":
          case "READY":
          case "RESET":
            childHashMap[childId].status = m.data.fsmStatus;
            objectPath.set(statsObj, ["children", childId, "status"], childHashMap[childId].status);
            childEvents.emit(m.op, { data: { childId: childId, op: m.op, data: m.data } } );
          break;

          case "DATA":
            childEvents.emit(m.op, { data: { childId: childId, op: m.op, data: m.data } } );
            child.messageQueue.push(m);
          break;

          default:
            console.error(chalkError(MODULE_ID_PREFIX + " | CHILD " + childId + " | UNKNOWN OP: " + m.op));
            childEvents.emit("CHILD_UNKNOWN_OP", { data: { childId: childId, op: m.op } } );
        }
      });

      childHashMap[childId].child = child;

      const initResponse = await childInit({childId: childId, config: config});

      const childPidFile = await touchChildPidFile({ childId: childId, pid: child.pid });

      childHashMap[childId].childPidFile = childPidFile;

      child.on("close", function(){
        console.log(chalkAlert(MODULE_ID_PREFIX + " | CHILD CLOSED | " + childId));
        shell.cd(childPidFolderLocal);
        shell.rm(childPidFile);
        delete childHashMap[childId];
      });

      child.on("exit", function(code, signal){
        console.log(chalkAlert(MODULE_ID_PREFIX + " | CHILD EXITED | " + childId));
        shell.cd(childPidFolderLocal);
        shell.rm(childPidFile);
        delete childHashMap[childId];
      });

      if (quitFlag) {
        console.log(chalkAlert(MODULE_ID_PREFIX
          + " | KILL CHILD IN CREATE ON QUIT FLAG"
          + " | " + getTimeStamp()
          + " | " + childId
        ));
        child.kill();
      }

      resolve(initResponse);
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** CHILD INIT ERROR"
        + " | ERR: " + err
        + "\nCONFIG\n" + jsonPrint(config)
        + "\nENV\n" + jsonPrint(options.env)
      ));
      return reject(err);
    }

  });
}

function childDisable(params){

  params = params || {};

  const childId = params.childId;
  const config = params.config || {};
  const verbose = params.verbose || false;

  statsObj.status = "CHILD DISABLE | CH ID: " + childId;

  return new Promise(async function(resolve, reject){

    const command = {
      op: "DISABLE",
      verbose: verbose,
      config: config
    };

    try {
      const response = await childSend({childId: childId, command: command});
      resolve(response);
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** CHILD SEND DISABLE ERROR"
        + " | ERR: " + err
        + "\nCOMMAND\n" + jsonPrint(command)
      ));
      return reject(err);
    }

  });
}

function childPing(params){

  params = params || {};

  const childId = params.childId;
  const config = params.config || {};
  const verbose = params.verbose || false;

  statsObj.status = "CHILD PING | CH ID: " + childId;

  return new Promise(async function(resolve, reject){

    const command = {
      op: "PING",
      verbose: verbose,
      pingId: getTimeStamp(),
      config: config
    };

    try {
      const response = await childSend({childId: childId, command: command});
      resolve(response);
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** CHILD SEND " + op + " ERROR"
        + " | ERR: " + err
        + "\nCOMMAND\n" + jsonPrint(command)
      ));
      return reject(err);
    }

  });
}

function checkChildState (params) {

  let checkState = params.checkState;
  let noChildrenTrue = params.noChildrenTrue || false;

  return new Promise(function(resolve, reject){

    if (Object.keys(childHashMap).length === 0) {
      resolve(noChildrenTrue);
    }

    let allCheckState = true;

    Object.keys(childHashMap).forEach(function(childId){

      const child = childHashMap[childId];

      if (child === undefined) { 
        console.error("CHILD UNDEFINED");
        return reject(new Error("CHILD UNDEFINED"));
      }

      const cs = ((child.status === "DISABLED") || (child.status === checkState));

      // if (!cs && (checkState === "FETCH_END") 
      //   && ((child.status === "ERROR") || (child.status === "RESET") || (child.status === "IDLE"))){

      //   child.child.send({op: "FETCH_END", verbose: configuration.verbose}, function(err) {
      //     if (err) {
      //       // slackSendRtmMessage(MODULE_ID_PREFIX + " | " + hostname + " | ERROR | CHILD SEND FETCH_END");
      //       console.log(chalkError(MODULE_ID_PREFIX + " | *** CHILD SEND FETCH_END ERROR"
      //         + " | @" + user
      //         + " | ERR: " + err
      //       ));
      //       return reject(err);
      //     }
      //   });
      // }

      if (!cs) {
        allCheckState = false;
      } 

      if (configuration.verbose) {
        console.log("checkChildState"
          + " | CH ID: " + childId 
          + " | " + child.status 
          + " | CHCK STATE: " + checkState 
          + " | cs: " + cs
          + " | allCheckState: " + allCheckState
        );
      }

    });

    if (configuration.verbose) {
      console.log(chalkLog(MODULE_ID_PREFIX + " | MAIN: " + fsm.getMachineState()
        + " | ALL CHILDREN CHECKSTATE: " + checkState + " | " + allCheckState
      ));
    }

    resolve(allCheckState);

  });
}

// function createChildEventHandler(params) {
//   return new Promise(async function(resolve, reject){

//     const child = params.child;
//     const childId = child.childId;

//     child.on("message", function(m){

//       console.log(chalkLog(MODULE_ID_PREFIX + " | <R MSG | CHILD " + childId + " | " + m.op));

//       switch(m.op) {

//         case "ERROR":
//         case "EVOLVE_COMPLETE":
//         case "EVOLVE_SCHEDULE":
//         case "INIT":
//         case "INIT_COMPLETE":
//         case "PONG":
//         case "READY":
//         case "RESET":
//         case "STATS":
//         case "TEST_EVOLVE_COMPLETE":
//           childEvents.emit(m.op, { data: { childId: childId, op: m.op, data: m.data } } );
//         break;

//         case "DATA":
//           childEvents.emit(m.op, { data: { childId: childId, op: m.op, data: m.data } } );
//           child.messageQueue.push(m);
//         break;

//         default:
//           console.error(chalkError(MODULE_ID_PREFIX + " | CHILD " + childId + " | UNKNOWN OP: " + m.op));
//           childEvents.emit("CHILD_UNKNOWN_OP", { data: { childId: childId, op: m.op } } );
//       }
//     });

//     resolve(child);

//   });
// }

function childPingAll(params){

  return new Promise(async function(resolve, reject){

    params = params || {};

    const now = params.now || false;

    let defaultCommand = {};
    defaultCommand.op = "PING";
    defaultCommand.now = now;
    defaultCommand.pingId = getTimeStamp();

    let command = params.command || defaultCommand;

    try {
      await childSendAll({command: command});
      resolve();
    }
    catch(err){
      reject(err);
    }

  });
}

//=========================================================================
// SLACK
//=========================================================================

// ./lib/js/slackModule.js


console.log(MODULE_ID_PREFIX + " | =================================");
console.log(MODULE_ID_PREFIX + " | HOST:          " + hostname);
console.log(MODULE_ID_PREFIX + " | PROCESS TITLE: " + process.title);
console.log(MODULE_ID_PREFIX + " | PROCESS ID:    " + process.pid);
console.log(MODULE_ID_PREFIX + " | RUN ID:        " + statsObj.runId);
console.log(MODULE_ID_PREFIX + " | PROCESS ARGS   " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log(MODULE_ID_PREFIX + " | =================================");


function toggleVerbose(){

  configuration.verbose = !configuration.verbose;

  console.log(chalkLog(MODULE_ID_PREFIX + " | VERBOSE: " + configuration.verbose));

  childSendAll({op: "VERBOSE", verbose: configuration.verbose})
  .then(function(){

  })
  .catch(function(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR VERBOSE: " + err));
  });
}

function initStdIn() {
  console.log(MODULE_ID_PREFIX + " | STDIN ENABLED");
  stdin = process.stdin;
  if(stdin.setRawMode !== undefined) {
    stdin.setRawMode( true );
  }
  stdin.resume();
  stdin.setEncoding( "utf8" );
  stdin.on( "data", async function( key ) {
    switch (key) {
      // case "\u0003":
      //   process.exit();
      // break;
      case "a":
        abortCursor = true;
        console.log(chalkLog(MODULE_ID_PREFIX + " | STDIN | ABORT: " + abortCursor));
      break;

      case "K":
        quit({force: true});
      break;

      case "q":
      case "Q":
        quit({source: "STDIN"});
      break;

      case "S":
      case "s":
        try {
          await showStats((key === "S"));
        }
        catch(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** SHOW STATS ERROR: " + err));
        }
      break;

      case "V":
        toggleVerbose();
      break;

      case "x":
        quitOnCompleteFlag = true;
        console.log(chalkLog(MODULE_ID_PREFIX + " | STDIN | QUIT ON COMPLETE FLAG SET"));
      break;

      default:
        console.log(chalkInfo(
          "\nTNN | " + "q/Q: quit"
          + "\nTNN | " + "s: showStats"
          + "\nTNN | " + "S: showStats verbose"
          + "\nTNN | " + "V: toggle verbose"
        ));
    }
  });
}

console.log(chalkBlueBold(
    "\n=======================================================================\n"
  +    MODULE_ID_PREFIX + " | " + MODULE_ID + " STARTED | " + getTimeStamp()
  + "\n=======================================================================\n"
));

setTimeout(async function(){

  try {

    let cnf = await initConfig(configuration);
    configuration = deepcopy(cnf);

    statsObj.status = "START";

    // slackSendMessage(hostname + " | TNN | " + statsObj.status);

    initSaveFileQueue(cnf);

    if (configuration.testMode) {
      console.log(chalkAlert(MODULE_ID_PREFIX + " | TEST MODE"));
    }

    console.log(chalkBlueBold(
        "\n--------------------------------------------------------"
      + "\n" + MODULE_ID_PREFIX + " | " + configuration.processName 
      + "\nCONFIGURATION\n" + jsonPrint(configuration)
      + "--------------------------------------------------------"
    ));

    initFsmTickInterval(FSM_TICK_INTERVAL);

    try {
      await connectDb();
      initWatch({rootFolder: "/Users/tc/Dropbox/Apps/wordAssociation" + configuration.userArchiveFolder});
    }
    catch(err){
      dbConnectionReady = false;
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECT ERROR: " + err + " | QUITTING ***"));
      quit({cause:"MONGO DB CONNECT ERROR"});
    }

    dbConnectionReadyInterval = setInterval(async function() {

      if (dbConnectionReady) {

        clearInterval(dbConnectionReadyInterval);
        
      }
      else {
        console.log(chalkLog(MODULE_ID_PREFIX + " | ... WAIT DB CONNECTED ..."));
      }
    }, 1000);

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | **** INIT CONFIG ERROR *****\n" + jsonPrint(err)));
    if (err.code !== 404) {
      // console.log(MODULE_ID_PREFIX + " | err.status: " + err.status);
      quit({cause: new Error("INIT CONFIG ERROR")});
    }
  }
}, 1000);


