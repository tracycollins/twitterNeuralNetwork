/*jslint node: true */
"use strict";

const DEFAULT_OFFLINE_MODE = false;
const DEFAULT_SERVER_MODE = false;

const os = require("os");
const moment = require("moment");

let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

const USER_ID = "tnn_" + hostname;
const SCREEN_NAME = "tnn_" + hostname;

let userObj = { 
  name: USER_ID, 
  nodeId: USER_ID, 
  userId: USER_ID, 
  utilId: USER_ID, 
  screenName: SCREEN_NAME, 
  namespace: "util", 
  timeStamp: moment().valueOf(),
  type: "TNN", 
  tags: {},
  stats: {}
} ;


const DEFAULT_DELETE_NOT_IN_INPUTS_ID_ARRAY = false;

let runOnceFlag = false;
let enableCreateChildren = false;

const ENABLE_INIT_PURGE_LOCAL = true;

const NN_CHILD_PREFIX = "node_NNC_";
const GLOBAL_TRAINING_SET_ID = "globalTrainingSet";

const SMALL_SET_SIZE = 100;
const SMALL_TEST_SET_SIZE = 20;

const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;
const ONE_HOUR = 60 * ONE_MINUTE;

const ONE_KILOBYTE = 1024;
const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;

const TEST_MODE_LENGTH = 100;
const TEST_DROPBOX_NN_LOAD = 5;

const DEFAULT_LOAD_ALL_INPUTS = false;

const DEFAULT_SEED_RANDOMIZE_OPTIONS = true;
const DEFAULT_QUIT_ON_COMPLETE = false;
const DEFAULT_USE_LOCAL_TRAINING_SETS = false;
const DEFAULT_MAX_NEURAL_NETWORK_CHILDREN = 2;
const DEFAULT_TEST_RATIO = 0.20;
const DEFAULT_NETWORK_CREATE_MODE = "evolve";
const DEFAULT_ITERATIONS = 10;
const DEFAULT_SEED_NETWORK_ID = false;
const DEFAULT_SEED_NETWORK_PROBABILITY = 0.5;
const DEFAULT_GLOBAL_MIN_SUCCESS_RATE = 80; // percent
const DEFAULT_LOCAL_MIN_SUCCESS_RATE = 50; // percent
const DEFAULT_LOCAL_PURGE_MIN_SUCCESS_RATE = 70; // percent
const DEFAULT_GENERATE_TRAINING_SET_ONLY = false;
const DEFAULT_INIT_MAIN_INTERVAL = process.env.TNN_INIT_MAIN_INTERVAL || 10*ONE_MINUTE;

const DROPBOX_LIST_FOLDER_LIMIT = 50;
const DROPBOX_MAX_FILE_UPLOAD = 140 * ONE_MEGABYTE; // bytes

// let resetInProgressFlag = false;

let socket;
let socketKeepaliveInterval;

let userReadyInterval;

let localNetworkFile;

let nnChildIndex = 0;
let allCompleteFlag = false;

const bestRuntimeNetworkFileName = "bestRuntimeNetwork.json";

let saveFileQueue = [];

const shell = require("shelljs");
const arraySlice = require("array-slice");
const util = require("util");
const _ = require("lodash");
const dot = require("dot-object");
const writeJsonFile = require("write-json-file");
const sizeof = require("object-sizeof");

require("isomorphic-fetch");
const Dropbox = require("dropbox").Dropbox;

const pick = require("object.pick");
const omit = require("object.omit");
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
const chalkAlert = chalk.red;
const chalkBlue = chalk.blue;
const chalkBlueBold = chalk.bold.blue;
const chalkGreen = chalk.green;
const chalkRedBold = chalk.bold.red;
const chalkError = chalk.bold.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;
const chalkNetwork = chalk.blue;
const chalkConnect = chalk.green;
const chalkDisconnect = chalk.yellow;
const chalkRed = chalk.red;

const debug = require("debug")("tnn");
const debugCache = require("debug")("cache");
const debugQ = require("debug")("queue");
const commandLineArgs = require("command-line-args");

const neataptic = require("neataptic");

const twitterTextParser = require("@threeceelabs/twitter-text-parser");
const twitterImageParser = require("@threeceelabs/twitter-image-parser");
const deepcopy = require("deep-copy");
const table = require("text-table");
const fs = require("fs");

let prevHostConfigFileModifiedMoment = moment("2010-01-01");
let prevDefaultConfigFileModifiedMoment = moment("2010-01-01");
let prevConfigFileModifiedMoment = moment("2010-01-01");

let statsObj = {};

statsObj.hostname = hostname;
statsObj.pid = process.pid;
statsObj.cpus = os.cpus().length;
statsObj.commandLineArgsLoaded = false;

statsObj.serverConnected = false;
statsObj.userReadyAck = false;
statsObj.userReadyAckWait = 0;
statsObj.userReadyTransmitted = false;

statsObj.startTimeMoment = moment();
statsObj.startTime = moment().valueOf();
statsObj.elapsed = moment().valueOf() - statsObj.startTime;

statsObj.numChildren = 0;

statsObj.evolveStats = {};
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

statsObj.errors = {};
statsObj.errors.imageParse = {};
statsObj.errors.users = {};
statsObj.errors.users.findOne = 0;

let neuralNetworkChildHashMap = {};


function getChildProcesses(callback){

  const command = "pgrep " + NN_CHILD_PREFIX;

  debug(chalkAlert("command: " + command));

  let numChildren = 0;
  let childPidArray = [];

  shell.exec(command, {silent: true}, function(code, stdout, stderr){

    if (code === 0) {

      let soArray = stdout.trim();

      let stdoutArray = soArray.split("\n");

      statsObj.numChildren = stdoutArray.length;

      debug(chalkInfo("NNT | FOUND CHILD PROCESSSES | NUM CH: " + statsObj.numChildren));


      async.eachSeries(stdoutArray, function(pidRaw, cb){

        const pid = pidRaw.trim();

        if (parseInt(pid) > 0) {

          const c = "ps -o command= -p " + pid;

          shell.exec(c, {silent: true}, function(code, stdout, stderr){

            const nnChildId = stdout.trim();

            numChildren += 1;

            debug(chalkAlert("NNT | FOUND CHILD PROCESS"
              + " | NUM: " + numChildren
              + " | PID: " + pid
              + " | " + nnChildId
            ));

            if (neuralNetworkChildHashMap[nnChildId] === undefined) {

              neuralNetworkChildHashMap[nnChildId] = {};
              neuralNetworkChildHashMap[nnChildId].status = "ZOMBIE";

              console.log(chalkError("NNT | ??? CHILD ZOMBIE ???"
                + " | NUM: " + numChildren
                + " | PID: " + pid
                + " | " + nnChildId
                + " | STATUS: " + neuralNetworkChildHashMap[nnChildId].status
              ));
            }
            else {
              debug(chalkInfo("NNT | CHILD"
                + " | PID: " + pid
                + " | " + nnChildId
                + " | STATUS: " + neuralNetworkChildHashMap[nnChildId].status
              ));
            }

            childPidArray.push({ pid: pid, nnChildId: nnChildId});

            cb();
          });
        }
        else {
          cb();
        }

      }, function(err){

        if (callback !== undefined) { callback(null, childPidArray); }

      });

    }

    if (code === 1) {
      console.log(chalkInfo("NNT | NO NN CHILD PROCESSES FOUND"));
        if (callback !== undefined) { callback(null, []); }
    }

    if (code > 1) {
      console.log(chalkAlert("SHELL : NNT | ERROR *** KILL CHILD"
        + "\nSHELL :: NNT | COMMAND: " + command
        + "\nSHELL :: NNT | EXIT CODE: " + code
        + "\nSHELL :: NNT | STDOUT\n" + stdout
        + "\nSHELL :: NNT | STDERR\n" + stderr
      ));
      if (callback !== undefined) { callback(stderr, command); }
    }

  });
}

getChildProcesses(function(err, results){

  debug(chalkAlert("getChildProcesses RESULTS\n" + jsonPrint(results)));

  if (results) {
    results.forEach(function(childObj){
      killChild({pid: childObj.pid}, function(err, numKilled){
        console.log(chalkAlert("KILLED | PID: " + childObj.pid + " | CH ID: " + childObj.nnChildId));
      });
    });
  }
});

function killAll(callback){

  getChildProcesses(function(err, results){

    debug(chalkAlert("getChildProcesses RESULTS\n" + jsonPrint(results)));

    if (results) {

      async.eachSeries(results, function(childObj, cb){
        killChild({pid: childObj.pid}, function(err, numKilled){
          console.log(chalkAlert("NNT | KILL ALL | KILLED | PID: " + childObj.pid + " | CH ID: " + childObj.nnChildId));
          cb();
        });
      }, function(err){
        if (callback !== undefined) { callback(err, results); }
      });
    }
    else {
      console.log(chalkAlert("NNT | KILL ALL | NO CHILDREN"));
      if (callback !== undefined) { callback(err, results); }
    }
  });
}

function findChildByPid(pid, callback){

  let foundChildId = false;

  async.each(Object.keys(neuralNetworkChildHashMap), function(nnChildId, cb){

    if (pid && (neuralNetworkChildHashMap[nnChildId].pid === pid)){

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

function killChild(params, callback){

  let pid = false;

  if (params.nnChildId !== undefined) {
    if (neuralNetworkChildHashMap[params.nnChild] === undefined) {
      if (callback !== undefined) { return callback("ERROR: CHILD NOT IN HM: " + params.nnChildId, null); }
    }
    else {
      pid = neuralNetworkChildHashMap[params.nnChild].pid;
    }
  }

  if (params.pid !== undefined) {
    pid = params.pid;
  }

  const command = "kill -9 " + pid;

  shell.exec(command, function(code, stdout, stderr){

    getChildProcesses(function(err, childArray){

      if (code === 0) {
        console.log(chalkAlert("NNT | *** KILL CHILD"
          + " | XXX NN CHILD PROCESSES: " + command
        ));

        if (params.nnChildId === undefined) {
          findChildByPid(pid, function(err, nnChildId){
            if (neuralNetworkChildHashMap[nnChildId] === undefined) { neuralNetworkChildHashMap[nnChildId] = {}; }
            neuralNetworkChildHashMap[nnChildId].status = "DEAD";
            if (callback !== undefined) { return callback(null, 1); }
          });
        }
        else {
          if (neuralNetworkChildHashMap[params.nnChildId] === undefined) { neuralNetworkChildHashMap[params.nnChildId] = {}; }
          neuralNetworkChildHashMap[params.nnChildId].status = "DEAD";
          if (callback !== undefined) { return callback(null, 1); }
        }
      }
      if (code === 1) {
        console.log(chalkInfo("NNT | KILL CHILD | NO NN CHILD PROCESSES: " + command));
        if (callback !== undefined) { return callback(null, 0); }
      }
      if (code > 1) {
        console.log(chalkAlert("SHELL : NNT | ERROR *** KILL CHILD"
          + "\nSHELL :: NNT | COMMAND: " + command
          + "\nSHELL :: NNT | EXIT CODE: " + code
          + "\nSHELL :: NNT | STDOUT\n" + stdout
          + "\nSHELL :: NNT | STDERR\n" + stderr
        ));
        if (callback !== undefined) { return callback(stderr, params); }
      }
    });

  });
}


let networkIndex = 0;

const DEFAULT_EVOLVE_THREADS = 1;
const DEFAULT_EVOLVE_ARCHITECTURE = "random";
const DEFAULT_EVOLVE_BEST_NETWORK = false;

const DEFAULT_EVOLVE_CLEAR = true;
const DEFAULT_EVOLVE_ELITISM = 10;
const DEFAULT_EVOLVE_EQUAL = true;
const DEFAULT_EVOLVE_ERROR = 0.03;
const DEFAULT_EVOLVE_LOG = 1;
const DEFAULT_EVOLVE_MUTATION = neataptic.methods.mutation.FFW;
const DEFAULT_EVOLVE_MUTATION_RATE = 0.5;
const DEFAULT_EVOLVE_POPSIZE = 100;
const DEFAULT_EVOLVE_GROWTH = 0.0001;

const DEFAULT_EVOLVE_COST = "CROSS_ENTROPY";
const DEFAULT_EVOLVE_COST_ARRAY = [
  "CROSS_ENTROPY",
  "CROSS_ENTROPY",
  "CROSS_ENTROPY",
  "CROSS_ENTROPY",
  "MSE"
];

const EVOLVE_MUTATION_RATE_RANGE = { min: 0.35, max: 0.75 } ;
const EVOLVE_POP_SIZE_RANGE = { min: DEFAULT_EVOLVE_POPSIZE, max: DEFAULT_EVOLVE_POPSIZE } ;
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

let initMainReady = false;
let trainingSetReady = false;
let createTrainingSetBusy = false;

let skipLoadNetworkSet = new Set();
let skipLoadInputsSet = new Set();
let requiredTrainingSet = new Set();

let slackChannel = "#nn";
let slackText = "";

let initMainInterval;


const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

let dbConnection;

const userModel = require("@threeceelabs/mongoose-twitter/models/user.server.model");
const neuralNetworkModel = require("@threeceelabs/mongoose-twitter/models/neuralNetwork.server.model");

let User;
let NeuralNetwork;
let userServer;

const wordAssoDb = require("@threeceelabs/mongoose-twitter");

let dbConnectionReady = false;

wordAssoDb.connect("node_twitterNeuralNetwork", function(err, dbCon){
  if (err) {
    console.log(chalkError("*** TNN | MONGO DB CONNECTION ERROR: " + err));
    quit("MONGO DB CONNECTION ERROR");
  }
  else {

    dbConnection = dbCon;

    dbConnection.on("error", function(){
      console.error.bind(console, "*** TNN | MONGO DB CONNECTION ERROR ***\n");
      console.log(chalkError("*** TNN | MONGO DB CONNECTION ERROR ***\n"));
      dbConnectionReady = false;
    });

    dbConnection.on("disconnected", function(){
      console.error.bind(console, "*** TNN | MONGO DB CONNECTION DISCONNECTED ***\n");
      console.log(chalkAlert("*** TFE | MONGO DB CONNECTION DISCONNECTED ***\n"));
      dbConnectionReady = false;
    });


    console.log(chalkGreen("TNN | MONGOOSE DEFAULT CONNECTION OPEN"));

    dbConnectionReady = true;

    User = mongoose.model("User", userModel.UserSchema);
    NeuralNetwork = mongoose.model("NeuralNetwork", neuralNetworkModel.NeuralNetworkSchema);
    userServer = require("@threeceelabs/user-server-controller");
  }

});

let networkCreateInterval;
let saveFileQueueInterval;
let saveFileBusy = false;

let configuration = {};

if (DEFAULT_OFFLINE_MODE) {
  configuration.offlineMode = true;
  console.log(chalkAlert("NNT | DEFAULT_OFFLINE_MODE: " + configuration.offlineMode));
}
else if (
  (process.env.TNN_OFFLINE_MODE !== undefined)
  && (process.env.TNN_OFFLINE_MODE === "true") || (process.env.TNN_OFFLINE_MODE === true)
  )
{
  configuration.offlineMode = true;
}
else {
  configuration.offlineMode = false;
}

if ( (process.env.TNN_SERVER_MODE !== undefined) 
  && (process.env.TNN_SERVER_MODE === "true" || process.env.TNN_SERVER_MODE === true))
{
  configuration.serverMode = true;
}
else {
  configuration.serverMode = DEFAULT_SERVER_MODE;
  console.log(chalkAlert("NNT | DEFAULT_SERVER_MODE: " + configuration.serverMode));
}

console.log(chalkAlert("NNT | SERVER MODE: " + configuration.serverMode));

configuration.networkCreateMode = "evole";

configuration.globalTrainingSetId = GLOBAL_TRAINING_SET_ID;
configuration.deleteNotInInputsIdArray = DEFAULT_DELETE_NOT_IN_INPUTS_ID_ARRAY;

configuration.processName = process.env.TNN_PROCESS_NAME || "node_twitterNeuralNetwork";

configuration.generateTrainingSetOnly = DEFAULT_GENERATE_TRAINING_SET_ONLY;
configuration.dropboxMaxFileUpload = DROPBOX_MAX_FILE_UPLOAD;

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

configuration.histogramsFolder = "/config/utility/default/histograms";

configuration.trainingSetsFolder = "/config/utility/default/trainingSets";
configuration.trainingSetFile = "trainingSet.json";
configuration.requiredTrainingSetFile = "requiredTrainingSet.txt";

configuration.maxNeuralNetworkChildern = (process.env.TNN_MAX_NEURAL_NETWORK_CHILDREN !== undefined) 
  ? process.env.TNN_MAX_NEURAL_NETWORK_CHILDREN 
  : DEFAULT_MAX_NEURAL_NETWORK_CHILDREN;

if (process.env.TNN_QUIT_ON_COMPLETE === "false") {
  configuration.quitOnComplete = false;
}
else {
  configuration.quitOnComplete = DEFAULT_QUIT_ON_COMPLETE;
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
configuration.testMode = false; // per tweet test mode
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


function toMegabytes(sizeInBytes) {
  return sizeInBytes/ONE_MEGABYTE;
}

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

function printCat(c){
  if (c === "left") { return "L"; }
  if (c === "neutral") { return "N"; }
  if (c === "right") { return "R"; }
  if (c === "positive") { return "+"; }
  if (c === "negative") { return "-"; }
  if (c === "none") { return "0"; }
  return ".";
}

// function reset(cause, callback){

//   console.log(moment().format(compactDateTimeFormat) + " | *** RESET *** | " + cause);

//   if (!resetInProgressFlag) {

//     const c = cause;
//     resetInProgressFlag = true;

//     setTimeout(function(){
//       resetInProgressFlag = false;
//       console.log(chalkError(moment().format(compactDateTimeFormat) + " | RESET: " + c));
      
//       if (callback) { callback(); }
//     }, 1*ONE_SECOND);

//   }
// }



const DEFAULT_RUN_ID = hostname + "_" + process.pid + "_" + statsObj.startTimeMoment.format(compactDateTimeFormat);

if (process.env.TNN_RUN_ID !== undefined) {
  statsObj.runId = process.env.TNN_RUN_ID;
  console.log(chalkAlert("NNT | ENV RUN ID: " + statsObj.runId));
}
else {
  statsObj.runId = DEFAULT_RUN_ID;
  console.log(chalkLog("NNT | DEFAULT RUN ID: " + statsObj.runId));
}

let globalhistograms = {};
globalhistograms.words = {};
globalhistograms.urls = {};
globalhistograms.hashtags = {};
globalhistograms.mentions = {};
globalhistograms.emoji = {};

let categorizedUserHashmap = new HashMap();

let categorizedUserHistogram = {};
categorizedUserHistogram.left = 0;
categorizedUserHistogram.right = 0;
categorizedUserHistogram.neutral = 0;
categorizedUserHistogram.positive = 0;
categorizedUserHistogram.negative = 0;
categorizedUserHistogram.none = 0;

let bestNetworkHashMap = new HashMap();
let inputsHashMap = new HashMap();
let trainingSetUsersHashMap = new HashMap();

let inputsNetworksHashMap = {};

let currentBestNetwork;
let networkCreateResultsHashmap = {};

let betterChildSeedNetworkIdSet = new Set();

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

  if (configuration.offlineMode) {
    console.log(chalkAlert("TNN | SLACK DISABLED"
      + " | OFFLINE_MODE: " + configuration.offlineMode
      + " | SERVER CONNECTED: " + statsObj.serverConnected
    ));
    if (callback !== undefined) { 
      return callback(null, null);
    }
    else{
      return;
    }
  }

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

const help = { name: "help", alias: "h", type: Boolean};

const enableStdin = { name: "enableStdin", alias: "S", type: Boolean, defaultValue: true };
const quitOnComplete = { name: "quitOnComplete", alias: "q", type: Boolean };
const quitOnError = { name: "quitOnError", alias: "Q", type: Boolean, defaultValue: true };
const verbose = { name: "verbose", alias: "v", type: Boolean };

const maxNeuralNetworkChildern = { name: "maxNeuralNetworkChildern", alias: "N", type: Number};
const createTrainingSetOnly = { name: "createTrainingSetOnly", alias: "C", type: Boolean};
const createTrainingSet = { name: "createTrainingSet", alias: "c", type: Boolean};
const useLocalTrainingSets = { name: "useLocalTrainingSets", alias: "L", type: Boolean};
const loadAllInputs = { name: "loadAllInputs", type: Boolean};
const loadTrainingSetFromFile = { name: "loadTrainingSetFromFile", alias: "t", type: Boolean};
const inputsId = { name: "inputsId", alias: "i", type: String};
const trainingSetFile = { name: "trainingSetFile", alias: "T", type: String};
const networkCreateMode = { name: "networkCreateMode", alias: "n", type: String, defaultValue: "evolve" };
const hiddenLayerSize = { name: "hiddenLayerSize", alias: "H", type: Number};
const seedNetworkId = { name: "seedNetworkId", alias: "s", type: String };
const useBestNetwork = { name: "useBestNetwork", alias: "b", type: Boolean };
const testMode = { name: "testMode", alias: "X", type: Boolean, defaultValue: false };
const evolveIterations = { name: "evolveIterations", alias: "I", type: Number};
const targetServer = { name: "targetServer", type: String };

const optionDefinitions = [
  maxNeuralNetworkChildern,
  createTrainingSetOnly,
  createTrainingSet,
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

const commandLineConfig = commandLineArgs(optionDefinitions);
console.log(chalkInfo("NNT | COMMAND LINE CONFIG\nNNT | " + jsonPrint(commandLineConfig)));
console.log("NNT | COMMAND LINE OPTIONS\nNNT | " + jsonPrint(commandLineConfig));


if (commandLineConfig.targetServer === "LOCAL"){
  commandLineConfig.targetServer = "http://127.0.0.1:9997/util";
}
if (commandLineConfig.targetServer === "REMOTE"){
  commandLineConfig.targetServer = "http://word.threeceelabs.com/util";
}

if (Object.keys(commandLineConfig).includes("help")) {
  console.log("NNT |optionDefinitions\n" + jsonPrint(optionDefinitions));
  quit("help");
}


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

process.title = "node_twitterNeuralNetwork";
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

const dropboxConfigDefaultFile = "default_" + configuration.DROPBOX.DROPBOX_TNN_CONFIG_FILE;
const dropboxConfigHostFile = hostname + "_" + configuration.DROPBOX.DROPBOX_TNN_CONFIG_FILE;

// const defaultHistogramsFolder = dropboxConfigDefaultFolder + "/histograms";
// const localInputsFolder = dropboxConfigHostFolder + "/inputs";
const defaultInputsFolder = dropboxConfigDefaultFolder + "/inputs";
const defaultInputsArchiveFolder = dropboxConfigDefaultFolder + "/inputsArchive";

const defaultTrainingSetFolder = dropboxConfigDefaultFolder + "/trainingSets";
const localTrainingSetFolder = dropboxConfigHostFolder + "/trainingSets";

const statsFolder = "/stats/" + hostname + "/neuralNetwork";
const statsFile = "twitterNeuralNetworkStats_" + statsObj.runId + ".json";

const globalBestNetworkFolder = "/config/utility/best/neuralNetworks";
const localBestNetworkFolder = "/config/utility/" + hostname + "/neuralNetworks/best";

let bestNetworkFile;

debug("statsFolder : " + statsFolder);
debug("statsFile : " + statsFile);


console.log("NNT | DROPBOX_TNN_CONFIG_FILE: " + configuration.DROPBOX.DROPBOX_TNN_CONFIG_FILE);
console.log("NNT | DROPBOX_TNN_STATS_FILE : " + configuration.DROPBOX.DROPBOX_TNN_STATS_FILE);

debug("dropboxConfigFolder : " + dropboxConfigFolder);
debug("dropboxConfigHostFolder : " + dropboxConfigHostFolder);
debug("dropboxConfigDefaultFile : " + dropboxConfigDefaultFile);
debug("dropboxConfigHostFile : " + dropboxConfigHostFile);

debug("NNT | DROPBOX_WORD_ASSO_ACCESS_TOKEN :" + configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN);
debug("NNT | DROPBOX_WORD_ASSO_APP_KEY :" + configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY);
debug("NNT | DROPBOX_WORD_ASSO_APP_SECRET :" + configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET);

// dropboxClient
let dropboxRemoteClient = new Dropbox({ accessToken: configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN });
let dropboxLocalClient = {  // offline mode
  filesListFolder: filesListFolderLocal,
  filesUpload: function(){},
  filesDownload: function(){},
  filesGetMetadata: filesGetMetadataLocal,
  filesDelete: function(){}
};

function filesGetMetadataLocal(options){

  return new Promise(function(resolve, reject) {

    console.log("filesGetMetadataLocal options\n" + jsonPrint(options));

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

function filesListFolderLocal(options){
  return new Promise(function(resolve, reject) {

    debug("filesListFolderLocal options\n" + jsonPrint(options));

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

let dropboxClient;

if (configuration.offlineMode) {
  dropboxClient = dropboxLocalClient;
}
else {
  dropboxClient = dropboxRemoteClient;
}

let globalCategorizedUsersFolder = dropboxConfigDefaultFolder + "/categorizedUsers";
let categorizedUsersFile = "categorizedUsers_manual.json";

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
      reject(new Error("ERROR"));
    }

  });
};

const sortedHashmap = function(params) {

  return new Promise(function(resolve, reject) {

    const keys = params.hashmap.keys();

    const sortedKeys = keys.sort(function(a,b){
      const objA = params.hashmap.get(a);
      const objB = params.hashmap.get(b);
      const objAvalue = dot.pick(params.sortKey, params.hashmap.get(a));
      const objBvalue = dot.pick(params.sortKey, params.hashmap.get(b));
      return objBvalue - objAvalue;
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
      console.error("sortedHashmap ERROR | params\n" + jsonPrint(params));
      reject(new Error("ERROR"));
    }

  });
};



function printNetworkCreateResultsHashmap(){

  let tableArray = [];

  tableArray.push([
    "NNT | NNID",
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

  async.each(Object.keys(networkCreateResultsHashmap), function(nnId, cb){

    const networkObj = networkCreateResultsHashmap[nnId];

    if (networkObj === undefined) {
      return(cb("UNDEFINED"));
    }
    else if (networkObj.evolve === undefined) {
      networkObj.evolve.options.clear = "---";
      networkObj.evolve.options.cost = "---";
      networkObj.evolve.options.growth = "---";
      networkObj.evolve.options.equal = "---";
      networkObj.evolve.options.mutationRate = "---";
      networkObj.evolve.options.popsize = "---";
      networkObj.evolve.options.elitism = "---";
    }

    let status = "";
    let betterChild = "";
    let snId = "";
    let snIdRes = "";
    let iterations = "";
    let error = "";
    let successRate = "";
    let elapsed = "";

    status = (networkObj.status !== undefined) ? networkObj.status : "UNKNOWN";
    betterChild = (networkObj.betterChild !== undefined) ? networkObj.betterChild : "---";
    snId = (networkObj.seedNetworkId !== undefined) ? networkObj.seedNetworkId : "---";
    snIdRes = (networkObj.seedNetworkId !== undefined) ? networkObj.seedNetworkRes.toFixed(2) : "---";

    iterations = (networkObj.evolve.results !== undefined) ? networkObj.evolve.results.iterations : "---";
    error = ((networkObj.evolve.results !== undefined) 
      && (networkObj.evolve.results.error !== undefined)
      && networkObj.evolve.results.error)  ? networkObj.evolve.results.error.toFixed(5) : "---";

    successRate = (networkObj.successRate !== undefined) ? networkObj.successRate.toFixed(2) : "---";
    elapsed = (networkObj.evolve.elapsed !== undefined) ? networkObj.evolve.elapsed : (moment().valueOf() - networkObj.evolve.startTime);

    tableArray.push([
      "NNT | " + nnId,
      status,
      betterChild,
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
      getTimeStamp(networkObj.evolve.startTime),
      msToTime(elapsed),
      iterations,
      error,
      successRate
    ]);

    async.setImmediate(function() { cb(); });

  }, function(err){

    if (err) { return; }

    const t = table(tableArray, { align: ["l", "l", "l", "l", "l", "r", "l", "l", "l", "l", "r", "r", "r", "l", "l", "r", "r", "r"] });

    console.log("NNT | ============================================================================================================================================");
    console.log(t);
    console.log("NNT | ============================================================================================================================================");

  });
}

function printInputsHashMap(){

  let tableArray = [];

  tableArray.push([
    "NNT | INPUTS ID",
    "INPTS"
  ]);

  async.each(inputsHashMap.keys(), function(inputsId, cb){

    const inputsObj = inputsHashMap.get(inputsId).inputsObj;

    tableArray.push([
      "NNT | " + inputsId,
      inputsObj.meta.numInputs
    ]);

    async.setImmediate(function() { cb(); });

  }, function(){

    const t = table(tableArray, { align: ["l", "r"] });

    console.log(chalkBlueBold("NNT | ============================================================================================================================================"));
    console.log(chalkBlueBold("NNT | INPUTS HASHMAP"));
    console.log(chalkInfo(t));
    console.log(chalkBlueBold("NNT | ============================================================================================================================================"));

  });
}

let statsObjSmall = {};

function showStats(options){

  getChildProcesses();

  statsObj.elapsed = moment().valueOf() - statsObj.startTime;

  statsObjSmall = omit(statsObj, ["network", "trainingSet", "testSet", "inputs", "outputs"]);


  if (options) {
    console.log("NNT | STATS\nNNT | " + jsonPrint(statsObjSmall));
    printNeuralNetworkChildHashMap();
    printNetworkCreateResultsHashmap();
  }
  else {
    console.log(chalkLog("NNT | S"
      + " | CPUs: " + statsObj.cpus
      + " | CH: " + statsObj.numChildren
      + " | " + testObj.testRunId
      + " | " + configuration.networkCreateMode.toUpperCase()
      + " | RUN " + statsObj.elapsed
      + " | NOW " + moment().format(compactDateTimeFormat)
      + " | STRT " + moment(parseInt(statsObj.startTime)).format(compactDateTimeFormat)
      + " | ITR " + configuration.evolve.iterations
    ));

    console.log(chalkLog("NNT | CL U HIST"
      + " | L: " + categorizedUserHistogram.left
      + " | R: " + categorizedUserHistogram.right
      + " | N: " + categorizedUserHistogram.neutral
      + " | +: " + categorizedUserHistogram.positive
      + " | -: " + categorizedUserHistogram.negative
      + " | 0: " + categorizedUserHistogram.none
    ));

    if (!configuration.createTrainingSetOnly) {
      printNeuralNetworkChildHashMap();
    }

  }
}

function quit(options){

  console.log(chalkAlert( "\n\nNNT | ... QUITTING ...\n\n" ));

  clearInterval(initMainInterval);
  clearInterval(networkCreateInterval);
  clearInterval(saveFileQueueInterval);

  statsObj.elapsed = moment().valueOf() - statsObj.startTime;

  if (process.env.TNN_BATCH_MODE){
    slackChannel = "#nn_batch";
  }

  if (options !== undefined) {

    if (options === "help") {
      process.exit();
    }

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
        slackText = slackText + " | RUN " + msToTime(statsObj.elapsed);
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
      slackText = slackText + " | RUN " + msToTime(statsObj.elapsed);
      slackText = slackText + " | QUIT CAUSE: " + options;

      console.log("NNT | SLACK TEXT: " + slackText);

      slackPostMessage(slackChannel, slackText);
    }

  }

  showStats();

  setTimeout(function(){

    killAll();

    setTimeout(function() {

      dbConnection.close(function () {
        console.log(chalkAlert("\n==========================\nMONGO DB CONNECTION CLOSED\n==========================\n"));
        process.exit();
      });

    }, 5000);

  }, 1000);
}

process.on( "SIGINT", function() {
  killAll(function(){
    quit("SIGINT");
  });
});

process.on("exit", function() {
  killAll(function(){
    quit("SIGINT");
  });
});


function saveFile (params, callback){

  const fullPath = params.folder + "/" + params.file;

  debug(chalkInfo("LOAD FOLDER " + params.folder));
  debug(chalkInfo("LOAD FILE " + params.file));
  debug(chalkInfo("FULL PATH " + fullPath));

  let options = {};

  if (params.localFlag) {

    // const jsonfileOptions = {};

    options.access_token = configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN;
    options.file_size = sizeof(params.obj);
    options.destination = params.dropboxFolder + "/" + params.file;
    options.autorename = true;
    options.mode = params.mode || "overwrite";
    options.mode = "overwrite";

    const objSizeMBytes = options.file_size/ONE_MEGABYTE;

    showStats();
    console.log(chalkInfo("NNT | ... SAVING LOCALLY | " + objSizeMBytes.toFixed(2) + " MB | " + fullPath));

    writeJsonFile(fullPath, params.obj)
    .then(function() {

      console.log(chalkInfo("NNT | SAVED LOCALLY | " + objSizeMBytes.toFixed(2) + " MB | " + fullPath));
      console.log(chalkInfo("NNT | ... PAUSE 5 SEC TO FINISH FILE SAVE | " + objSizeMBytes.toFixed(2) + " MB | " + fullPath));

      setTimeout(function(){

        console.log(chalkInfo("NNT | ... DROPBOX UPLOADING | " + objSizeMBytes.toFixed(2) + " MB | " + fullPath + " > " + options.destination));

        // const source = fs.createReadStream(fullPath);

        const stats = fs.statSync(fullPath);
        const fileSizeInBytes = stats.size;
        const savedSize = fileSizeInBytes/ONE_MEGABYTE;

        console.log(chalkLog("NNT | ... SAVING DROPBOX JSON"
          + " | " + getTimeStamp()
          + " | " + savedSize.toFixed(2) + " MBYTES"
          + "\n SRC: " + fullPath
          + "\n DST: " + options.destination
          // + " successMetadata\n" + jsonPrint(successMetadata)
          // + " successMetadata\n" + jsonPrint(successMetadata)
        ));

        const drbx = require("@davvo/drbx")({
          token: configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN
        });

        let localReadStream = fs.createReadStream(fullPath);
        let remoteWriteStream = drbx.file(options.destination).createWriteStream();


        let bytesRead = 0;
        let chunksRead = 0;
        let mbytesRead = 0;
        let percentRead = 0;

        localReadStream.pipe(remoteWriteStream);

        localReadStream.on("data", function(chunk){
          bytesRead += chunk.length;
          mbytesRead = bytesRead/ONE_MEGABYTE;
          percentRead = 100 * bytesRead/fileSizeInBytes;
          chunksRead += 1;
          if (chunksRead % 100 === 0){
            console.log(chalkInfo("NNT | LOCAL READ"
              + " | " + mbytesRead.toFixed(2) + " / " + savedSize.toFixed(2) + " MB"
              + " (" + percentRead.toFixed(2) + "%)"
            ));
          }
        });

        localReadStream.on("close", function(){
          console.log(chalkAlert("NNT | LOCAL STREAM READ CLOSED | SOURCE: " + fullPath));
        });

        remoteWriteStream.on("close", function(){
          console.log(chalkAlert("NNT | REMOTE STREAM WRITE CLOSED | DEST: " + options.destination));
        });

        localReadStream.on("end", function(){
          console.log(chalkInfo("NNT | LOCAL READ COMPLETE"
            + " | SOURCE: " + fullPath
            + " | " + mbytesRead.toFixed(2) + " / " + savedSize.toFixed(2) + " MB"
            + " (" + percentRead.toFixed(2) + "%)"
          ));
          localReadStream.close();
        });

        localReadStream.on("error", function(err){
          console.error("NNT | *** LOCAL STREAM READ ERROR | " + err);
          if (callback !== undefined) { return callback(err); }
        });

        remoteWriteStream.on("end", function(){
          console.log(chalkAlert("NNT | REMOTE STREAM WRITE END | DEST: " + options.destination));
          if (callback !== undefined) { return callback(null); }
        });

        remoteWriteStream.on("error", function(err){
          console.error("NNT | *** REMOTE STREAM WRITE ERROR | DEST: " + options.destination + "\n" + err);
          if (callback !== undefined) { return callback(err); }
        });

      }, 5000);

    })
    .catch(function(error){
      console.trace(chalkError("NNT | " + moment().format(compactDateTimeFormat) 
        + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
        + " | ERROR: " + error
        + " | ERROR\n" + jsonPrint(error)
        // + " ERROR\n" + jsonPrint(params)
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
          console.error(chalkError("NNT | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: 413"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else if (error.status === 429){
          console.error(chalkError("NNT | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: TOO MANY WRITES"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else if (error.status === 500){
          console.error(chalkError("NNT | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: DROPBOX SERVER ERROR"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else {
          console.trace(chalkError("NNT | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: " + error
            + " | ERROR\n" + jsonPrint(error)
          ));
          if (callback !== undefined) { return callback(error); }
        }
      });
    };

    if (options.mode === "add") {

      dropboxClient.filesListFolder({path: params.folder, limit: DROPBOX_LIST_FOLDER_LIMIT})
      .then(function(response){

        debug(chalkLog("DROPBOX LIST FOLDER"
          + " | ENTRIES: " + response.entries.length
          + " | CURSOR (trunc): " + response.cursor
          + " | MORE: " + response.has_more
          + " | PATH:" + options.path
        ));

        let fileExits = false;

        async.each(response.entries, function(entry, cb){

          console.log(chalkInfo("NNT | DROPBOX FILE"
            + " | " + params.folder
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
            + " | " + entry.name
          ));

          if (entry.name === params.file) {
            fileExits = true;
          }

          async.setImmediate(function() { cb(); });

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
        console.log(chalkError("NNT | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
        console.log(chalkError("NNT | *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
        if (callback !== undefined) { callback(err, null); }
      });
    }
    else {
      dbFileUpload();
    }
  }
}

function loadFile(path, file, callback) {

  debug(chalkInfo("LOAD FOLDER " + path));
  debug(chalkInfo("LOAD FILE " + file));
  debug(chalkInfo("FULL PATH " + path + "/" + file));

  let fullPath = path + "/" + file;

  debug(chalkAlert("TNN | DROPBOX LOADFILE OFFLINE MODE: " + configuration.offlineMode));

  if (configuration.offlineMode) {

    console.log(chalkAlert("TNN | DROPBOX LOADFILE OFFLINE MODE"));

    if (hostname !== "google") {
      fullPath = "/Users/tc/Dropbox/Apps/wordAssociation" + path + "/" + file;
      debug(chalkInfo("OFFLINE MODE: FULL PATH " + fullPath));
    }
    fs.readFile(fullPath, "utf8", function(err, data) {

      if (err) {
        console.log("NNT"
          + " | " + chalkError(getTimeStamp()
          + " | *** ERROR LOADING FILE FROM DROPBOX FILE"
          + " | " + fullPath
        ));
        return(callback(err, null));
      }

      debug("NNT"
        + " | " + chalkLog(getTimeStamp()
        + " | LOADING FILE FROM DROPBOX FILE"
        + " | " + fullPath
      ));

      if (file.match(/\.json$/gi)) {
        try {
          let fileObj = JSON.parse(data);
          return(callback(null, fileObj));
        }
        catch(e){
          console.trace(chalkError("NNT | JSON PARSE ERROR: " + e));
          return(callback(e, null));
        }
      }
      if (file.match(/\.txt$/gi)) {
        return(callback(null, data));
      }
      return(callback(null, null));

    });
   }
  else {

    dropboxClient.filesDownload({path: fullPath})
    .then(function(data) {

      debug("NNT"
        + " | " + chalkLog(getTimeStamp()
        + " | LOADING FILE FROM DROPBOX: [" + toMegabytes(data.size).toFixed(3) + " MB] | " + fullPath
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
          return(callback(e, null));
        }
      }
      else if (file.match(/\.txt$/gi)) {
        callback(null, data);
      }
      else {
        console.log(chalkLog("NNT"
          + " | " + getTimeStamp()
          + " | ??? LOADING FILE FROM DROPBOX FILE | NOT .json OR .txt: " + fullPath
        ));
        callback(null, null);
      }
    })
    .catch(function(error) {
      if ((error.status === 404) || (error.status === 409)) {
        console.error(chalkError("NNT | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND"
          + " ... SKIPPING ...")
        );
        callback({status: error.status}, null);
      }
      else if (error.status === 0) {
        console.error(chalkError("NNT | !!! DROPBOX NO RESPONSE"
          + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
        callback({status: error.status}, null);
      }
      else {
        console.log(chalkError("NNT | DROPBOX loadFile ERROR: " + fullPath
          + " | " + error.error_summary
        ));
        callback(error, null);
      }
    });
  }
}

function getFileMetadata(path, file, callback) {

  const fullPath = path + "/" + file;
  debug(chalkInfo("FOLDER " + path));
  debug(chalkInfo("FILE " + file));
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
      return(callback(null, response));
    })
    .catch(function(error) {
      console.log(chalkError("NNT | DROPBOX getFileMetadata ERROR: " + fullPath + "\n" + error));
      console.log(chalkError("NNT | !!! DROPBOX READ " + fullPath + " ERROR"));
      console.log(chalkError("NNT | " + jsonPrint(error.error)));

      if ((error.status === 404) || (error.status === 409)) {
        console.error(chalkError("NNT | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND"
          + " ... SKIPPING ...")
        );
        return(callback(null, null));
      }
      if (error.status === 0) {
        console.error(chalkError("NNT | !!! DROPBOX NO RESPONSE"
          + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
        return(callback(null, null));
      }
      return(callback(error, null));
    });
}

function purgeNetwork(nnId, callback){

  console.log(chalkAlert("NNT | XXX PURGE NETWORK: " + nnId));
  bestNetworkHashMap.delete(nnId);
  betterChildSeedNetworkIdSet.delete(nnId);
  skipLoadNetworkSet.add(nnId);
  if (networkCreateResultsHashmap[nnId] !== undefined) { networkCreateResultsHashmap[nnId].status = "PURGED"; }

  if (callback !== undefined) { callback(); }
}

function purgeInputs(inputsId, callback){

  if (!configuration.inputsIdArray.includes(inputsId)){
    console.log(chalkAlert("NNT | XXX PURGE INPUTS: " + inputsId));
    inputsHashMap.delete(inputsId);
    skipLoadInputsSet.add(inputsId);
  }
  else {
    console.log(chalkAlert("NNT | ** NO XXX PURGE INPUTS ... IN CONFIGURATION INPUTS ID ARRAY" 
      + " | INPUTS ID: " + inputsId
      + " | CONFIGURATION INPUTS ID ARRAY\n" + jsonPrint(configuration.inputsIdArray)
    ));
  }

  if (callback !== undefined) { callback(); }
}

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

let statsUpdateInterval;

function initStatsUpdate(cnf){

  console.log(chalkBlue("NNT | INIT STATS UPDATE INTERVAL | " + cnf.statsUpdateIntervalTime + " MS"));

  clearInterval(statsUpdateInterval);

  statsUpdateInterval = setInterval(function () {

    statsObj.elapsed = moment().valueOf() - statsObj.startTime;
    statsObj.timeStamp = moment().format(defaultDateTimeFormat);
 
    showStats();

  }, cnf.statsUpdateIntervalTime);

}

function loadDropboxFolder(options, callback){

  debug(chalkNetwork("NNT | ... LOADING DROPBOX FOLDER | " + options.path));

  let results = {};
  results.entries = [];

  let cursor;
  let more = false;

  if (configuration.offlineMode) {
    dropboxClient = dropboxLocalClient;
  }
  else {
    dropboxClient = dropboxRemoteClient;
  }

  dropboxClient.filesListFolder(options)
  .then(function(response){

    cursor = response.cursor;
    more = response.has_more;
    results.entries = response.entries;

    console.log(chalkLog("DROPBOX LIST FOLDER"
      + " | PATH:" + options.path
      + " | ENTRIES: " + response.entries.length
      // + " | CURSOR (trunc): " + cursor
      + " | LIMIT: " + options.limit
      + " | MORE: " + more
    ));

    async.whilst(

      function() {
        return (more);
      },

      function(cb){

        dropboxClient.filesListFolderContinue({cursor: cursor})
        .then(function(responseCont){

          cursor = responseCont.cursor;
          more = responseCont.has_more;
          results.entries = results.entries.concat(responseCont.entries);

          debug(chalkLog("DROPBOX LIST FOLDER CONT"
            + " | PATH:" + options.path
            + " | ENTRIES: " + responseCont.entries.length + "/" + results.entries.length
            + " | CURSOR (trunc): " + responseCont.cursor
            + " | LIMIT: " + options.limit
            + " | MORE: " + more
          ));

          async.setImmediate(function() { cb(); });

        })
        .catch(function(err){
          console.log(chalkError("NNT | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
          console.log(chalkError("NNT | *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
          cb(err);
        });
      },

      function(err){
        callback(err, results);
      });

  })
  .catch(function(err){
    console.log(chalkError("NNT | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
    console.log(chalkError("NNT | *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
    callback(err, null);
  });
}

function loadInputsDropboxFolder(folder, callback){

  if (configuration.createTrainingSetOnly) {
    if (callback !== undefined) { 
      return callback(null, null); 
    }
  }

  console.log(chalkLog("NNT | ... LOADING DROPBOX INPUTS FOLDER | " + folder));

  let options = {
    path: folder,
    limit: DROPBOX_LIST_FOLDER_LIMIT
  };
  let skippedInputsFiles = 0;

  loadDropboxFolder(options, function(err, results){

    if (err) {
      console.log(chalkError("NNT | ERROR LOADING DROPBOX INPUTS FOLDER | " + options.path + " | " + err));
      return(callback(err, null));
    }

    console.log(chalkBlue("NNT | DROPBOX LIST INPUTS FOLDER"
      + " | ENTRIES: " + results.entries.length
      + " | PATH:" + options.path
    ));

    async.eachSeries(results.entries, function(entry, cb){

      debug(chalkAlert("entry: " + entry));

      const entryNameArray = entry.name.split(".");
      const entryInputsId = entryNameArray[0];

      debug(chalkInfo("NNT | DROPBOX INPUTS FILE FOUND"
        + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
        + " | INPUTS ID: " + entryInputsId
        + " | " + entry.name
      ));

      if (skipLoadInputsSet.has(entryInputsId)){
        console.log(chalkInfo("NNT | INPUTS IN SKIP LOAD INPUTS SET ... SKIPPING LOAD OF " + entryInputsId));
        cb();
      }
      else if (!configuration.loadAllInputs && !configuration.inputsIdArray.includes(entryInputsId)){

        if (configuration.verbose){
          console.log(chalkInfo("NNT | DROPBOX INPUTS NOT IN INPUTS ID ARRAY ... SKIPPING"
            + " | " + entryInputsId
            + " | " + defaultInputsArchiveFolder + "/" + entry.name
          ));
        }

        skipLoadInputsSet.add(entryInputsId);
        skippedInputsFiles += 1;

        cb();

      }
      else if (inputsHashMap.has(entryInputsId)){

        let curInputsObj = inputsHashMap.get(entryInputsId);

        if ((curInputsObj.entry.content_hash !== entry.content_hash) && (curInputsObj.entry.path_display === entry.path_display)) {

          console.log(chalkInfo("NNT | DROPBOX INPUTS CONTENT CHANGE"
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
            + " | " + entry.name
            + "\nCUR HASH: " + entry.content_hash
            + "\nOLD HASH: " + curInputsObj.entry.content_hash
          ));

          loadFile(folder, entry.name, function(err, inputsObj){

            if (err) {
              console.log(chalkError("NNT | DROPBOX INPUTS LOAD FILE ERROR: " + err));
              cb();
            }
            else if ((inputsObj === undefined) || !inputsObj) {
              console.log(chalkError("NNT | DROPBOX INPUTS LOAD FILE ERROR | JSON UNDEFINED ??? "));
              cb();
            }
            else {
              console.log(chalkInfo("NNT | DROPBOX INPUTS"
                + " | " + entry.name
                + " | " + inputsObj.inputsId
              ));

              if (inputsObj.meta === undefined) {
                inputsObj.meta = {};
                inputsObj.meta.numInputs = 0;
                Object.keys(inputsObj.inputs).forEach(function(inputType){
                  inputsObj.meta.numInputs += inputsObj.inputs[inputType].length;
                });
              }

              inputsHashMap.set(inputsObj.inputsId, {entry: entry, inputsObj: inputsObj} );

              if (inputsNetworksHashMap[inputsObj.inputsId] === undefined) {
                inputsNetworksHashMap[inputsObj.inputsId] = new Set();
              }

              cb();
            }
          });
        }
        else if ((curInputsObj.entry.content_hash !== entry.content_hash) && (curInputsObj.entry.path_display !== entry.path_display)) {

          console.log(chalkNetwork("NNT | DROPBOX INPUTS CONTENT DIFF IN DIFF FOLDERS"
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
            + "\nCUR: " + entry.path_display
            + " | " + entry.content_hash
            + "\nOLD: " + curInputsObj.entry.path_display
            + " | " + curInputsObj.entry.content_hash
          ));

          // LOAD FROM BEST FOLDER AND SAVE LOCALLY
          loadFile(folder, entry.name, function(err, inputsObj){

            if (err) {
              console.log(chalkError("NNT | DROPBOX INPUTS LOAD FILE ERROR: " + err));
              // purgeInputs(entryInputsId);
              cb();
            }
            else if ((inputsObj === undefined) || !inputsObj) {
              console.log(chalkError("NNT | DROPBOX INPUTS LOAD FILE ERROR | JSON UNDEFINED ??? "));
              // purgeInputs(entryInputsId);
              cb();
            }
            else {

              if (inputsObj.meta === undefined) {
                inputsObj.meta = {};
                inputsObj.meta.numInputs = 0;
                Object.keys(inputsObj.inputs).forEach(function(inputType){
                  inputsObj.meta.numInputs += inputsObj.inputs[inputType].length;
                });
              }

              inputsHashMap.set(inputsObj.inputsId, {entry: entry, inputsObj: inputsObj} );

              // inputsIdSet.add(inputsObj.inputsId);

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
                debug("NNT | " + inputsObj.inputsId + " | INPUT TYPE: " + inputType + " | " + inputsObj.inputs[inputType].length + " INPUTS");
                totalInputs += inputsObj.inputs[inputType].length;
              });

              console.log("NNT | " + inputsObj.inputsId + " | TOTAL INPUTS TYPE: " + totalInputs);

              cb();

            }
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
            // purgeInputs(entryInputsId);
            cb();
          }
          else if ((inputsObj === undefined) || !inputsObj) {
            console.log(chalkError("NNT | DROPBOX INPUTS LOAD FILE ERROR | JSON UNDEFINED ??? "));
            // purgeInputs(entryInputsId);
            cb();
          }
          else {

            if (inputsObj.meta === undefined) {
              inputsObj.meta = {};
              inputsObj.meta.numInputs = 0;
              Object.keys(inputsObj.inputs).forEach(function(inputType){
                inputsObj.meta.numInputs += inputsObj.inputs[inputType].length;
              });
            }

            inputsHashMap.set(inputsObj.inputsId, {entry: entry, inputsObj: inputsObj} );

            // inputsIdSet.add(inputsObj.inputsId);

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
              debug("NNT | " + inputsObj.inputsId + " | INPUT TYPE: " + inputType + " | " + inputsObj.inputs[inputType].length + " INPUTS");
              totalInputs += inputsObj.inputs[inputType].length;
            });

            console.log("NNT | " + inputsObj.inputsId + " | TOTAL INPUTS TYPE: " + totalInputs);

            cb();

          }
        });
      }
    }, function(){
      if (skippedInputsFiles > 0) {
        console.log(chalkInfo("NNT | SKIPPED LOAD OF " + skippedInputsFiles + " INPUTS FILES | " + folder));
      }

      printInputsHashMap();

      if (callback !== undefined) { callback(null, null); }
    });
  });
}

function userChanged(uOld, uNew){
  ["category"].forEach(function(prop){
    if (uOld[prop] !== uNew[prop]){
      return true;
    }
    return false;
  });
}

function updateUsersFromTrainingSet(trainingSetData, callback){

  let updatedUserCount = 0;
  let userIndex = 0;
  const numberUsers = trainingSetData.length;

  if (configuration.testMode) {
    trainingSetData.length = 100;
  }

  async.eachSeries(trainingSetData, function(user, cb) {

    debug(chalkLog("... UPDATING USER FROM TRAINING + TEST SET DATA"
      + " | CM: " + printCat(user.category)
      + " | CA: " + printCat(user.categoryAuto)
      + " | @" + user.screenName
    ));

    if (user.userId === undefined) { user.userId = user.nodeId; }

    User.findOne({ nodeId: user.nodeId }).exec(function(err, userDb) {
      userIndex += 1;
      if (err) {
        console.log(chalkError("*** ERROR FIND ONE USER trainingSet: "
          + " [" + updatedUserCount + "/" + userIndex + "/" + numberUsers + "]"
          + " | CM: " + printCat(user.category)
          + " | CA: " + printCat(user.categoryAuto)
          + " | UID: " + user.userId
          + " | @" + user.screenName
          + " | ERROR: " + err
        ));
        cb();
      }
      else if (!userDb){

        const newUser = new User(user);

        newUser.save()
        .then(function(updatedUser){

          updatedUserCount += 1;

          console.log(chalkLog("NNT | +++ ADD NET USER FROM TRAINING SET  "
            + " [" + updatedUserCount + "/" + userIndex + "/" + numberUsers + "]"
            + " | CM: " + printCat(updatedUser.category)
            + " | CA: " + printCat(updatedUser.categoryAuto)
            + " | UID: " + updatedUser.userId
            + " | @" + updatedUser.screenName
            + " | 3CF: " + updatedUser.threeceeFollowing
            + " | Ts: " + updatedUser.statusesCount
            + " | FLWRs: " + updatedUser.followersCount
            + " | FRNDS: " + updatedUser.friendsCount
          ));

        })
        .catch(function(err){
          console.log("NNT |ERROR: updateUsersFromTrainingSet newUser: " + err.message);
        });

        cb();

      }
      else if (userChanged(user, userDb)) {

        userDb.category = user.category;
        userDb.categoryAuto = user.categoryAuto;

        userDb.save()
        .then(function(updatedUser){
          updatedUserCount += 1;

          console.log(chalkLog("+++ UPDATED USER FROM TRAINING SET  "
            + " [" + updatedUserCount + "/" + userIndex + "/" + numberUsers + "]"
            + " | CM: " + printCat(updatedUser.category)
            + " | CA: " + printCat(updatedUser.categoryAuto)
            + " | UID: " + updatedUser.userId
            + " | @" + updatedUser.screenName
            + " | 3CF: " + updatedUser.threeceeFollowing
            + " | Ts: " + updatedUser.statusesCount
            + " | FLWRs: " + updatedUser.followersCount
            + " | FRNDS: " + updatedUser.friendsCount
          ));

        })
        .catch(function(err){
          console.log("NNT | ERROR: updateUsersFromTrainingSet: " + err.message);
        });

        cb();
      }
      else {
        if ((userIndex % 1000) === 0) {
          console.log(chalkLog("NNT | --- NO UPDATE USER FROM TRAINING SET"
            + " [" + updatedUserCount + "/" + userIndex + "/" + numberUsers + "]"
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
        cb();
      }
    });
  }, function(){
    // spinnerUpdateUsers.succeed("NNT | UPDATED USERS: " + updatedUserCount + "/" + userIndex + "/" + numberUsers );
    callback();
  });
}

function loadTrainingSetsDropboxFolder(folder, callback){

  console.log(chalkLog("NNT | ... LOADING DROPBOX TRAINING SETS FOLDER | " + folder));

  let options = {
    path: folder,
    limit: DROPBOX_LIST_FOLDER_LIMIT
  };

  if (configuration.offlineMode) {
    dropboxClient = dropboxLocalClient;
  }
  else {
    dropboxClient = dropboxRemoteClient;
  }


  dropboxClient.filesListFolder(options)
  .then(function(response){

    debug(chalkLog("DROPBOX LIST FOLDER"
      + " | ENTRIES: " + response.entries.length
      + " | CURSOR (trunc): " + response.cursor
      + " | MORE: " + response.has_more
      + " | PATH:" + options.path
      // + " | " + jsonPrint(response)
    ));

    async.eachSeries(response.entries, function(entry, cb){

      debug(chalkAlert("entry\n" + jsonPrint(entry)));

      debug(chalkLog("NNT | DROPBOX TRAINING SET FOUND"
        + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
        + " | " + entry.name
      ));

      if (!entry.name.startsWith(configuration.globalTrainingSetId)){
        debug("NNT | ... IGNORE DROPBOX TRAINING SETS FOLDER FILE: " + entry.name);
        return(cb());
      }

      if (!entry.name.endsWith(".json")){
        debug("NNT | ... IGNORE DROPBOX TRAINING SETS FOLDER FILE: " + entry.name);
        return(cb());
      }

      const entryNameArray = entry.name.split(".");
      const trainingSetId = entryNameArray[0].replace("trainingSet_", "");

      if (trainingSetHashMap.has(trainingSetId)){

        let curTrainingSetObj = trainingSetHashMap.get(trainingSetId);
        let oldContentHash = false;

        if ((curTrainingSetObj.entry !== undefined) && (curTrainingSetObj.entry.content_hash !== undefined)){
          oldContentHash = curTrainingSetObj.entry.content_hash;
        }

        if (oldContentHash !== entry.content_hash) {

          console.log(chalkInfo("NNT | DROPBOX TRAINING SET CONTENT CHANGE"
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
            + " | TRAINING SET ID: " + trainingSetId
            + " | " + entry.name
            + "\nCUR HASH: " + entry.content_hash
            + "\nOLD HASH: " + oldContentHash
          ));

          loadFile(folder, entry.name, function(err, trainingSetObj){
            if (err) {
              console.log(chalkError("NNT | DROPBOX TRAINING SET LOAD FILE ERROR: " + err));
              cb();
            }
            else if ((trainingSetObj === undefined) || !trainingSetObj) {
              console.log(chalkError("NNT | DROPBOX TRAINING SET LOAD FILE ERROR | JSON UNDEFINED ??? "));
              cb();
            }
            else {

              if (trainingSetObj.testSet.meta === undefined) { 
                trainingSetObj.testSet.meta = {};
                trainingSetObj.testSet.meta.testSetId = trainingSetObj.trainingSetId;
                trainingSetObj.testSet.meta.setSize = trainingSetObj.testSet.data.length;
              }

              trainingSetObj.testSet.meta.testSetId = trainingSetObj.testSet.meta.testSetId || trainingSetObj.trainingSetId;


              trainingSetHashMap.set(trainingSetObj.trainingSetId, {entry: entry, trainingSetObj: trainingSetObj} );

              console.log(chalkInfo("NNT | DROPBOX TRAINING SET"
                + " [" + trainingSetHashMap.count() + "]"
                + " | TRAINING SET SIZE: " + trainingSetObj.trainingSet.meta.setSize
                // + " | " + trainingSetObj.trainingSet.meta.numInputs + " INPUTS"
                + " | " + entry.name
                + " | " + trainingSetObj.trainingSetId
                // + "\n" + jsonPrint(trainingSetObj.entry)
              ));

              if (hostname === "google") {
                cb();
              }
              else {
                updateUsersFromTrainingSet(trainingSetObj.trainingSet.data.concat(trainingSetObj.testSet.data), function(err){
                  cb();
                });
              }
            }

          });
        }
        else{
          console.log(chalkLog("NNT | DROPBOX TRAINING SET CONTENT SAME  "
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
            cb();
          }
          else if ((trainingSetObj === undefined) || !trainingSetObj) {
            console.log(chalkError("NNT | DROPBOX TRAINING SET LOAD FILE ERROR | JSON UNDEFINED ??? "));
            cb();
          }
          else {

            trainingSetHashMap.set(trainingSetObj.trainingSetId, {entry: entry, trainingSetObj: trainingSetObj} );

            console.log(chalkNetwork("NNT | LOADED DROPBOX TRAINING SET"
              + " [" + trainingSetHashMap.count() + "]"
              + " | TRAINING SET SIZE: " + trainingSetObj.trainingSet.meta.setSize
              + " | " + folder + "/" + entry.name
              + " | " + trainingSetObj.trainingSetId
              // + "\n" + jsonPrint(trainingSetObj.entry)
              // + " | META\n" + jsonPrint(trainingSetObj.trainingSet.meta)
            ));

            if (hostname === "google") {
              cb();
            }
            else {
              updateUsersFromTrainingSet(trainingSetObj.trainingSet.data.concat(trainingSetObj.testSet.data), function(err){
                cb();
              });
            }

          }

        });

      }

    }, function(){
      console.log(chalkNetwork("NNT | =*=*= END LOAD DROPBOX TRAINING SETS"
        + " | " + trainingSetHashMap.count() + " TRAINING SETS IN HASHMAP"
      ));

      if (callback !== undefined) { callback(null); }

    });

  })
  .catch(function(err){
    console.log(chalkError("NNT | *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
    // quit("DROPBOX FILES LIST FOLDER ERROR");
    if (callback !== undefined) { callback(err); }
  });
}

function loadBestNetworkDropboxFolders (params, callback){

  if (configuration.offlineMode) {
    dropboxClient = dropboxLocalClient;
  }
  else {
    dropboxClient = dropboxRemoteClient;
  }

  let numNetworksLoaded = 0;

  debug(chalkNetwork("NNT | ... LOADING DROPBOX BEST NN FOLDERS"
    + " | " + params.folders.length + " FOLDERS"
    + "\n" + jsonPrint(params.folders)
  ));

  async.eachSeries(params.folders, function(folder, cb0){

    debug(chalkNetwork("NNT | ... LOADING DROPBOX BEST NN FOLDER | " + folder));

    let options = {
      path: folder,
      limit: DROPBOX_LIST_FOLDER_LIMIT
    };

    loadDropboxFolder(options, function(err, response){

      if (err) {
        return(cb0(err));
      }

      debug(chalkLog("DROPBOX LIST FOLDER"
        + " | ENTRIES: " + response.entries.length
        + " | PATH:" + options.path
      ));

      if (response.entries.length === 0) {
        console.log(chalkAlert("NNT | DROPBOX BEST NETWORKS FOLDER: NO FILES? " + folder
          + " | " + response.entries.length + " FILES FOUND"
        ));
        return(cb0());
      }

      if (configuration.testMode) {
        response.entries.length = Math.min(response.entries.length, TEST_DROPBOX_NN_LOAD);
        console.log(chalkAlert("NNT | *** TEST MODE *** | LOAD MAX " + TEST_DROPBOX_NN_LOAD + " BEST NETWORKS"));
      }

      console.log(chalkLog("NNT | DROPBOX BEST NETWORKS FOLDER FILES " + folder
        + " | " + response.entries.length + " FILES FOUND"
      ));

      async.eachSeries(response.entries, function(entry, cb1){

        debug("entry\n" + jsonPrint(entry));

        if (entry.name === bestRuntimeNetworkFileName) {
          debug(chalkInfo("... SKIPPING LOAD OF " + entry.name));
          return(cb1());
        }

        if (!entry.name.endsWith(".json")) {
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

        if (skipLoadNetworkSet.has(networkId)){
          debug(chalkInfo("NNT | NN IN SKIP LOAD NN SET ... SKIPPING LOAD OF " + networkId));
          cb1();
        }
        else if (bestNetworkHashMap.has(networkId)){

          let curNetworkObj = bestNetworkHashMap.get(networkId);
          let oldContentHash = false;

          if ((curNetworkObj.entry.path_display === entry.path_display) 
            && (curNetworkObj.entry !== undefined) && (curNetworkObj.entry.content_hash !== undefined)){
            oldContentHash = curNetworkObj.entry.content_hash;
          }

          if (oldContentHash && (oldContentHash !== entry.content_hash) 
            && (curNetworkObj.entry.path_display === entry.path_display)) {

            console.log(chalkNetwork("NNT | DROPBOX BEST NETWORK CONTENT CHANGE"
              + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
              + " | " + entry.path_display
              + "\nCUR HASH: " + entry.content_hash
              + "\nOLD HASH: " + oldContentHash
            ));

            loadFile(folder, entry.name, function(err, networkObj){

              if (err) {
                console.log(chalkError("NNT | DROPBOX BEST NETWORK RELOAD FILE ERROR: " + err));
                purgeNetwork(networkId);
                cb1();
              }
              else if ((networkObj === undefined) || !networkObj) {
                console.log(chalkError("NNT | DROPBOX BEST NETWORK RELOAD FILE ERROR | JSON UNDEFINED ??? "));
                purgeNetwork(networkId);
                cb1();
              }
              else {

                if (networkObj.networkId !== networkId) {
                  console.log(chalkError("*** NETWORK OBJ NETWORK ID MISMATCH | " + networkObj.networkId + " | " + networkId));
                  return cb1("NETWORK OBJ NETWORK ID MISMATCH");
                }

                if (networkObj.numInputs === undefined) {
                  console.log(chalkError("*** NETWORK NETWORK numInputs UNDEFINED | " + networkObj.networkId));
                  return cb1("NETWORK OBJ NETWORK numInputs UNDEFINED");
                }

                if (networkObj.inputsId === undefined) {
                  console.log(chalkError("*** NETWORK OBJ INPUTS ID UNDEFINED | entry.name: " + entry.name 
                    + " | networkObj.networkId: " + networkObj.networkId));
                  console.log(chalkError("*** NETWORK OBJ INPUTS ID UNDEFINED | networkObj:" + jsonPrint(networkObj)));
                  return cb1("NETWORK OBJ INPUTS ID UNDEFINED");
                }

                if (networkObj.overallMatchRate === undefined) { networkObj.overallMatchRate = 0; }
                if (networkObj.matchRate === undefined) { networkObj.matchRate = 0; }
                if (networkObj.successRate === undefined) { networkObj.successRate = 0; }

                console.log(chalkNetwork("NNT | DROPBOX BEST NETWORK"
                  + " | SR: " + networkObj.successRate.toFixed(2) + "%"
                  + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
                  + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
                  + " | " + getTimeStamp(networkObj.createdAt)
                  + " | " + networkObj.networkId
                  + " | " + networkObj.networkCreateMode
                  + " | IN: " + networkObj.numInputs
                  + " | OUT: " + networkObj.numOutputs
                ));

                bestNetworkHashMap.set(networkObj.networkId, { entry: entry, networkObj: networkObj});

                let inputsEntry = {};

                inputsEntry.name = networkObj.inputsId + ".json";
                inputsEntry.content_hash = false;
                inputsEntry.client_modified = moment();

                inputsHashMap.set(networkObj.inputsId, {entry: inputsEntry, inputsObj: networkObj.inputsObj});

                if (inputsNetworksHashMap[networkObj.inputsId] === undefined) {
                  inputsNetworksHashMap[networkObj.inputsId] = new Set();
                }

                inputsNetworksHashMap[networkObj.inputsId].add(networkObj.networkId);

                numNetworksLoaded += 1;

                if (!currentBestNetwork || (networkObj.successRate > currentBestNetwork.successRate)) {

                  currentBestNetwork = networkObj.network;

                  console.log(chalkBlueBold("NNT | * NEW BEST NN"
                  + " | SR: " + networkObj.successRate.toFixed(2) + "%"
                  + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
                  + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
                  + " | " + getTimeStamp(networkObj.createdAt)
                  + " | " + networkObj.networkId
                  + " | " + networkObj.networkCreateMode
                  + " | IN: " + networkObj.numInputs
                  + " | OUT: " + networkObj.numOutputs
                  ));
                }

                cb1();
              }
            });
          }
          else if (oldContentHash && (oldContentHash !== entry.content_hash) && (curNetworkObj.entry.path_display !== entry.path_display)) {

            console.log(chalkNetwork("NNT | DROPBOX BEST NETWORK CONTENT DIFF IN DIFF params.folders"
              + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
              + "\nCUR: " + entry.path_display
              + " | " + entry.content_hash
              + "\nOLD: " + curNetworkObj.entry.path_display
              + " | " + curNetworkObj.entry.content_hash
            ));

            // LOAD FROM BEST FOLDER AND SAVE LOCALLY
            loadFile(globalBestNetworkFolder, entry.name, function(err, networkObj){

              if (err) {
                console.log(chalkError("NNT | DROPBOX BEST NETWORK RELOAD FILE ERROR: " + err));
                purgeNetwork(networkId);
                cb1();
              }
              else if ((networkObj === undefined) || !networkObj) {
                console.log(chalkError("NNT | DROPBOX BEST NETWORK RELOAD FILE ERROR | JSON UNDEFINED ??? "));
                purgeNetwork(networkId);
                cb1();
              }
              else {

                if (networkObj.inputsId === undefined) {
                  console.log(chalkError("*** NETWORK OBJ INPUTS ID UNDEFINED | entry.name: " + entry.name 
                    + " | networkObj.networkId: " + networkObj.networkId));
                  console.log(chalkError("*** NETWORK OBJ INPUTS ID UNDEFINED | networkObj:" + jsonPrint(networkObj)));
                  return cb1("NETWORK OBJ INPUTS ID UNDEFINED");
                }

                if (networkObj.networkId !== networkId) {
                  console.log(chalkError("*** NETWORK OBJ NETWORK ID MISMATCH | " 
                    + networkObj.networkId + " | " + networkId));
                  return cb1("NETWORK OBJ NETWORK ID MISMATCH");
                }

                if (networkObj.numInputs === undefined) {
                  console.log(chalkError("*** NETWORK NETWORK numInputs UNDEFINED | " + networkObj.networkId));
                  return cb1("NETWORK OBJ NETWORK numInputs UNDEFINED");
                }

                if (networkObj.overallMatchRate === undefined) { networkObj.overallMatchRate = 0; }
                if (networkObj.matchRate === undefined) { networkObj.matchRate = 0; }
                if (networkObj.successRate === undefined) { networkObj.successRate = 0; }

                console.log(chalkNetwork("NNT | DROPBOX GLOBAL BEST NETWORK"
                  + " | SR: " + networkObj.successRate.toFixed(2) + "%"
                  + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
                  + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
                  + " | " + getTimeStamp(networkObj.createdAt)
                  + " | " + networkObj.networkId
                  + " | " + networkObj.networkCreateMode
                  + " | IN: " + networkObj.numInputs
                  + " | OUT: " + networkObj.numOutputs
                ));

                bestNetworkHashMap.set(networkObj.networkId, { entry: entry, networkObj: networkObj.network});


                dropboxClient.filesDelete({path: localBestNetworkFolder + "/" + entry.name})
                .then(function(response){

                  debug("dropboxClient filesDelete response\n" + jsonPrint(response));

                  console.log(chalkAlert("NNT | XXX LOCAL NN (GLOBAL EXISTS)"
                  + " | SR: " + networkObj.successRate.toFixed(2) + "%"
                  + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
                  + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
                  + " | " + getTimeStamp(networkObj.createdAt)
                  + " | " + networkObj.networkId
                  + " | " + networkObj.networkCreateMode
                  + " | IN: " + networkObj.numInputs
                  + " | OUT: " + networkObj.numOutputs
                  ));
                })
                .catch(function(err){
                  if (err.status === 409) {
                    console.log(chalkError("NNT | *** ERROR: XXX NN"
                      + " | STATUS: " + err.status
                      + " | PATH: " + localBestNetworkFolder + "/" + entry.name
                      + " | CONFLICT | DOES NOT EXIST"
                    ));
                  }
                  else if (err.status === 429) {
                    console.log(chalkError("NNT | *** ERROR: XXX NN"
                      + " | STATUS: " + err.status
                      + " | PATH: " + localBestNetworkFolder + "/" + entry.name
                      + " | TOO MANY REQUESTS"
                    ));
                  }
                  else {
                    console.log(chalkError("NNT | *** ERROR: XXX NN"
                      + " | STATUS: " + err.status
                      + " | PATH: " + localBestNetworkFolder + "/" + entry.name
                      + " | SUMMARY: " + err.response.statusText
                      + "\n" + jsonPrint(err)
                    ));
                  }
                });

                let inputsEntry = {};

                inputsEntry.name = networkObj.inputsId + ".json";
                inputsEntry.content_hash = false;
                inputsEntry.client_modified = moment();

                inputsHashMap.set(networkObj.inputsId, {entry: inputsEntry, inputsObj: networkObj.inputsObj});
                // inputsIdSet.add(networkObj.inputsId);

                if (inputsNetworksHashMap[networkObj.inputsId] === undefined) {
                  inputsNetworksHashMap[networkObj.inputsId] = new Set();
                }
                inputsNetworksHashMap[networkObj.inputsId].add(networkObj.networkId);

                numNetworksLoaded += 1;

                if (!currentBestNetwork || (networkObj.successRate > currentBestNetwork.successRate)) {

                  currentBestNetwork = networkObj.network;

                  console.log(chalkBlueBold("NNT | * NEW BEST NN"
                  + " | SR: " + networkObj.successRate.toFixed(2) + "%"
                  + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
                  + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
                  + " | " + getTimeStamp(networkObj.createdAt)
                  + " | " + networkObj.networkId
                  + " | " + networkObj.networkCreateMode
                  + " | IN: " + networkObj.numInputs
                  + " | OUT: " + networkObj.numOutputs
                  ));

                }

                cb1();
              }
            });
          }
          else {
            debug(chalkLog("NNT | DROPBOX BEST NETWORK CONTENT SAME  "
              + " | " + entry.name
              + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
              + "\nCUR HASH: " + entry.content_hash
              + "\nOLD HASH: " + oldContentHash
            ));
            cb1();
          }
        }
        else {

          loadFile(folder, entry.name, function(err, networkObj){

            if (err) {
              console.log(chalkError("NNT | DROPBOX BEST NETWORK LOAD FILE ERROR: " + err));
              purgeNetwork(networkId);
              cb1();
            }
            else if ((networkObj === undefined) || !networkObj) {
              console.log(chalkError("NNT | DROPBOX BEST NETWORK LOAD FILE ERROR | JSON UNDEFINED ??? "));
              purgeNetwork(networkId);
              cb1();
            }
            else {

              if (networkObj.overallMatchRate === undefined) { networkObj.overallMatchRate = 0; }
              if (networkObj.matchRate === undefined) { networkObj.matchRate = 0; }
              if (networkObj.successRate === undefined) { networkObj.successRate = 0; }

              if (!configuration.inputsIdArray.includes(networkObj.inputsId)) {

                if (!configuration.deleteNotInInputsIdArray){
                  console.log(chalkInfo("NNT | NN INPUTS NOT IN INPUTS ID ARRAY ... SKIPPING"
                    + " | NUM INPUTS: " + networkObj.numInputs
                    + " | INPUTS ID: " + networkObj.inputsId
                    + " | " + folder + "/" + entry.name
                  ));
                  skipLoadNetworkSet.add(networkObj.networkId);
                  return(cb1());
                }

                console.log(chalkInfo("NNT | NN INPUTS NOT IN INPUTS ID ARRAY ... DELETING: " 
                  + folder + "/" + entry.name));

                dropboxClient.filesDelete({path: folder + "/" + entry.name})
                .then(function(response){

                  debug("dropboxClient filesDelete response\n" + jsonPrint(response));

                  console.log(chalkAlert("NNT | XXX NN"
                    + " | NN INPUTS NOT IN INPUTS ID ARRAY: " + networkObj.inputsId
                    + " | SR: " + networkObj.successRate.toFixed(2) + "%"
                    + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
                    + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
                    + " | " + getTimeStamp(networkObj.createdAt)
                    + " | " + networkObj.networkId
                    + " | " + networkObj.networkCreateMode
                    + " | IN: " + networkObj.numInputs
                    + " | OUT: " + networkObj.numOutputs
                  ));

                  cb1();
                })
                .catch(function(err){
                  if (err.status === 429) {
                    console.log(chalkError("NNT | *** ERROR: XXX NN"
                      + " | STATUS: " + err.status
                      + " | PATH: " + folder + "/" + entry.name
                      + " | TOO MANY REQUESTS"
                    ));
                  }
                  else {
                    console.log(chalkError("NNT | *** ERROR: XXX NN"
                      + " | STATUS: " + err.status
                      + " | PATH: " + folder + "/" + entry.name
                      + " | SUMMARY: " + err.response.statusText
                    ));
                  }
                  cb1(err);
                });

              }
              else if ((options.networkId !== undefined) 
                || ((folder === "/config/utility/best/neuralNetworks") && (networkObj.successRate > configuration.globalMinSuccessRate))
                || ((folder === "/config/utility/best/neuralNetworks") && (networkObj.matchRate > configuration.globalMinSuccessRate))
                || (params.purgeMin && (folder !== "/config/utility/best/neuralNetworks") && (networkObj.successRate > configuration.localPurgeMinSuccessRate))
                || (params.purgeMin && (folder !== "/config/utility/best/neuralNetworks") && (networkObj.matchRate > configuration.localPurgeMinSuccessRate))
                || (!params.purgeMin && (folder !== "/config/utility/best/neuralNetworks") && (networkObj.successRate > configuration.localMinSuccessRate))
                || (!params.purgeMin && (folder !== "/config/utility/best/neuralNetworks") && (networkObj.matchRate > configuration.localMinSuccessRate))) {


                if (networkObj.overallMatchRate === undefined) { networkObj.overallMatchRate = 0; }
                if (networkObj.matchRate === undefined) { networkObj.matchRate = 0; }
                if (networkObj.successRate === undefined) { networkObj.successRate = 0; }

                bestNetworkHashMap.set(networkObj.networkId, { entry: entry, networkObj: networkObj});

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

                 NeuralNetwork.findOne({ networkId: networkObj.networkId }, function(err, nnDb){
                  if (err) {
                    console.log(chalkError("*** ERROR: DB NN FIND ONE ERROR | "+ networkObj.networkId + " | " + err));
                  }
                  else if (nnDb) {
                    if (
                      (networkObj.overallMatchRate !== undefined) 
                      && (networkObj.overallMatchRate > 0)
                      && (networkObj.overallMatchRate < 100)
                    ) {
                      nnDb.overallMatchRate = networkObj.overallMatchRate;
                    }
                    else if (nnDb.overallMatchRate === undefined){
                      nnDb.overallMatchRate = 0;
                    }
                    nnDb.markModified("overallMatchRate");
                    nnDb.matchRate = networkObj.matchRate || 0;
                    nnDb.successRate = networkObj.successRate || 0;

                    console.log(chalkLog("NNT | . NN DB HIT"
                      + " | " + nnDb.networkId
                      + " | OAMR: " + nnDb.overallMatchRate.toFixed(2) + "%"
                      + " | MR: " + nnDb.matchRate.toFixed(2) + "%"
                      + " | SR: " + nnDb.successRate.toFixed(2) + "%"
                      + " | " + nnDb.numInputs + " IN"
                      + " | SEED: " + nnDb.seedNetworkId + " IN"
                      + " | CR: " + nnDb.createdAt
                    ));


                    nnDb.save()
                    .catch(function(err){
                      console.log(err.message);
                    });

                  }
                  else {
                    let nn = new NeuralNetwork(networkObj);

                    if ((nn.networkId === undefined) || (!nn.networkId) || (nn.networkId === null)) {
                      console.log(chalkError("NNT | ERROR: NN NETWORK ID UNDEFINED ???\n" + jsonPrint(nn)));
                    }
                    nn.markModified("overallMatchRate");
                    nn.save()
                    .catch(function(err){
                      console.log(err.message);
                    });
                  }
                });


                numNetworksLoaded += 1;

                console.log(chalkLog("NNT | + NN HASH MAP"
                  + " | " + bestNetworkHashMap.count() + " NNs IN HM"
                  + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
                  + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
                  + " | SR: " + networkObj.successRate.toFixed(2) + "%"
                  + " | " + getTimeStamp(networkObj.createdAt)
                  + " | IN: " + networkObj.numInputs
                  + " | OUT: " + networkObj.numOutputs
                  + " | " + networkObj.networkCreateMode
                  // + " | " + networkId
                  + " | " + networkObj.networkId
                ));

                if (!currentBestNetwork || (networkObj.matchRate > currentBestNetwork.matchRate)) {

                  currentBestNetwork = networkObj.network;

                  console.log(chalkAlert("NNT | * NEW BEST NN"
                    + " | " + bestNetworkHashMap.count() + " NNs IN HM"
                    + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
                    + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
                    + " | SR: " + networkObj.successRate.toFixed(2) + "%"
                    + " | " + getTimeStamp(networkObj.createdAt)
                    + " | IN: " + networkObj.numInputs
                    + " | OUT: " + networkObj.numOutputs
                    + " | " + networkObj.networkCreateMode
                    + " | " + networkObj.networkId
                  ));
                }

                cb1();
              }
              else if (((hostname === "google") && (folder === globalBestNetworkFolder))
                || ((hostname !== "google") && (folder === localBestNetworkFolder)) ) {

                debug(chalkAlert("NNT | DELETING NN"
                  + " | MIN SUCCESS RATE: GLOBAL: " + configuration.globalMinSuccessRate + " LOCAL: " + configuration.localMinSuccessRate
                  + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
                  + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
                  + " | SR: " + networkObj.successRate.toFixed(2) + "%"
                  + " | " + getTimeStamp(networkObj.createdAt)
                  + " | IN: " + networkObj.numInputs
                  + " | OUT: " + networkObj.numOutputs
                  + " | " + networkObj.networkCreateMode
                  + " | " + networkObj.networkId
                ));

                purgeNetwork(networkObj.networkId);
                purgeInputs(networkObj.inputsId);

                dropboxClient.filesDelete({path: folder + "/" + entry.name})
                .then(function(response){

                  debug("dropboxClient filesDelete response\n" + jsonPrint(response));

                  console.log(chalkAlert("NNT | XXX NN"
                    + " | MIN SR: GLOBAL: " + configuration.globalMinSuccessRate
                    + " | MIN SR: LOCAL: " + configuration.localMinSuccessRate
                    + " | MIN SR: LOCAL PURGE: " + configuration.localPurgeMinSuccessRate
                    + " | SR: " + networkObj.successRate.toFixed(2) + "%"
                    + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
                    + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
                    + " | " + getTimeStamp(networkObj.createdAt)
                    + " | IN: " + networkObj.numInputs
                    + " | OUT: " + networkObj.numOutputs
                    + " | " + networkObj.networkCreateMode
                    + " | " + networkObj.networkId
                  ));

                  cb1();
                })
                .catch(function(err){
                  if (err.status === 429) {
                    console.log(chalkError("NNT | *** ERROR: XXX NN"
                      + " | STATUS: " + err.status
                      + " | PATH: " + folder + "/" + entry.name
                      + " | TOO MANY REQUESTS"
                    ));
                  }
                  else {
                    console.log(chalkError("NNT | *** ERROR: XXX NN"
                      + " | STATUS: " + err.status
                      + " | PATH: " + folder + "/" + entry.name
                      + " | SUMMARY: " + err.response.statusText
                    ));
                  }
                  cb1(err);
                });
              }
              else {
                cb1();
              }
            }
          });
        }
      }, function(err){
        cb0(err);
      });

    });

  }, function(err){
      if (callback !== undefined) { callback(err, numNetworksLoaded); }
  });
}

function printNetworkObj(title, nnObj){
  console.log(chalkNetwork(title
    // + " | " + nnObj.networkId
    + " | SUCCESS: " + nnObj.successRate.toFixed(2) + "%"
  ));
}

function initStdIn(callback){
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

  if (callback !== undefined) { callback(null, stdin); }
}

function loadCommandLineArgs(callback){

  if (statsObj.commandLineArgsLoaded) {
    if (callback !== undefined) { 
      return callback(null, false);
    }
    return;
  }

  const commandLineConfigKeys = Object.keys(commandLineConfig);

  async.each(commandLineConfigKeys, function(arg, cb){
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
    cb();
  }, function(){
    statsObj.commandLineArgsLoaded = true;

    if (callback !== undefined) { callback(null, false); }
  });

  // const configArgs = Object.keys(configuration);

  // configArgs.forEach(function(arg){
  //   console.log("NNT | _FINAL CONFIG | " + arg + ": " + configuration[arg]);
  // });


}

function loadConfigFile(folder, file, callback) {

  if (file === dropboxConfigDefaultFile) {
    prevConfigFileModifiedMoment = moment(prevDefaultConfigFileModifiedMoment);
  }
  else {
    prevConfigFileModifiedMoment = moment(prevHostConfigFileModifiedMoment);
  }

  if (configuration.offlineMode) {
    loadCommandLineArgs(function(err, loadedConfigObj){
      return callback(null, null);
    });
  }
  else {

    const fullPath = folder + "/" + file;

    getFileMetadata(folder, file, function(err, response){

      if (err) {
        return(callback(err, null));
      }

      const fileModifiedMoment = moment(new Date(response.client_modified));
    
      if (fileModifiedMoment.isSameOrBefore(prevConfigFileModifiedMoment)){

        console.log(chalkInfo("NNT | CONFIG FILE BEFORE OR EQUAL"
          + " | " + fullPath
          + " | PREV: " + prevConfigFileModifiedMoment.format(compactDateTimeFormat)
          + " | " + fileModifiedMoment.format(compactDateTimeFormat)
        ));
        callback(null, null);
      }
      else {
        console.log(chalkAlert("NNT | +++ CONFIG FILE AFTER ... LOADING"
          + " | " + fullPath
          + " | PREV: " + prevConfigFileModifiedMoment.format(compactDateTimeFormat)
          + " | " + fileModifiedMoment.format(compactDateTimeFormat)
        ));

        prevConfigFileModifiedMoment = moment(fileModifiedMoment);

        if (file === dropboxConfigDefaultFile) {
          prevDefaultConfigFileModifiedMoment = moment(fileModifiedMoment);
        }
        else {
          prevHostConfigFileModifiedMoment = moment(fileModifiedMoment);
        }

        loadFile(folder, file, function(err, loadedConfigObj){

          if (err) {
            console.error(chalkError("NNT | ERROR LOAD DROPBOX CONFIG: " + file
              + "\n" + jsonPrint(err)
            ));
            callback(err, false);
          }
          else if ((loadedConfigObj === undefined) || !loadedConfigObj) {
            console.log(chalkError("NNT | DROPBOX CONFIG LOAD FILE ERROR | JSON UNDEFINED ??? "));
            callback("JSON UNDEFINED", null);
          }

          else {

            console.log(chalkInfo("NNT | LOADED CONFIG FILE: " + file + "\n" + jsonPrint(loadedConfigObj)));

            if (loadedConfigObj.TNN_OFFLINE_MODE  !== undefined){
              console.log("NNT | LOADED TNN_OFFLINE_MODE: " + loadedConfigObj.TNN_OFFLINE_MODE);

              if ((loadedConfigObj.TNN_OFFLINE_MODE === false) || (loadedConfigObj.TNN_OFFLINE_MODE === "false")) {
                configuration.offlineMode = false;
              }
              else if ((loadedConfigObj.TNN_OFFLINE_MODE === true) || (loadedConfigObj.TNN_OFFLINE_MODE === "true")) {
                configuration.offlineMode = true;
              }
              else {
                configuration.offlineMode = false;
              }
            }

            if (loadedConfigObj.TNN_SERVER_MODE  !== undefined){
              console.log("NNT | LOADED TNN_SERVER_MODE: " + loadedConfigObj.TNN_SERVER_MODE);

              if ((loadedConfigObj.TNN_SERVER_MODE === true) || (loadedConfigObj.TNN_SERVER_MODE === "true")) {
                configuration.serverMode = true;
              }
              else {
                configuration.serverMode = false;
              }
            }

            if (loadedConfigObj.TNN_QUIT_ON_COMPLETE !== undefined) {
              console.log("NNT | LOADED TNN_QUIT_ON_COMPLETE: " + loadedConfigObj.TNN_QUIT_ON_COMPLETE);
              if (!loadedConfigObj.TNN_QUIT_ON_COMPLETE || (loadedConfigObj.TNN_QUIT_ON_COMPLETE === "false")) {
                configuration.quitOnComplete = false ;
              }
              else {
                configuration.quitOnComplete = true ;
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

            if (loadedConfigObj.TNN_LOAD_ALL_INPUTS !== undefined){
              console.log("NNT | LOADED TNN_LOAD_ALL_INPUTS: " + loadedConfigObj.TNN_LOAD_ALL_INPUTS);

              if ((loadedConfigObj.TNN_LOAD_ALL_INPUTS === true) || (loadedConfigObj.TNN_LOAD_ALL_INPUTS === "true")) {
                configuration.loadAllInputs = true;
              }
              else {
                configuration.loadAllInputs = false;
              }
            }

            if (loadedConfigObj.TNN_DELETE_NOT_IN_INPUTS_ID_ARRAY !== undefined){
              console.log("NNT | LOADED TNN_DELETE_NOT_IN_INPUTS_ID_ARRAY: " + loadedConfigObj.TNN_DELETE_NOT_IN_INPUTS_ID_ARRAY);

              if ((loadedConfigObj.TNN_DELETE_NOT_IN_INPUTS_ID_ARRAY === true) || (loadedConfigObj.TNN_DELETE_NOT_IN_INPUTS_ID_ARRAY === "true")) {
                configuration.deleteNotInInputsIdArray = true;
              }
              else {
                configuration.deleteNotInInputsIdArray = false;
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

            if (loadedConfigObj.TNN_SEED_RANDOMIZE_OPTIONS !== undefined){
              console.log("NNT | LOADED TNN_SEED_RANDOMIZE_OPTIONS: " + loadedConfigObj.TNN_SEED_RANDOMIZE_OPTIONS);
              configuration.randomizeSeedOptions = loadedConfigObj.TNN_SEED_RANDOMIZE_OPTIONS;
            }

            if (loadedConfigObj.TNN_EVOLVE_COST_ARRAY !== undefined){
              console.log("NNT | LOADED TNN_EVOLVE_COST_ARRAY: " + loadedConfigObj.TNN_EVOLVE_COST_ARRAY);
              configuration.costArray = loadedConfigObj.TNN_EVOLVE_COST_ARRAY;
            }

            if (loadedConfigObj.TNN_GLOBAL_MIN_SUCCESS_RATE !== undefined){
              console.log("NNT | LOADED TNN_GLOBAL_MIN_SUCCESS_RATE: " + loadedConfigObj.TNN_GLOBAL_MIN_SUCCESS_RATE);
              configuration.globalMinSuccessRate = loadedConfigObj.TNN_GLOBAL_MIN_SUCCESS_RATE;
            }

            if (loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE !== undefined){
              console.log("NNT | LOADED TNN_LOCAL_MIN_SUCCESS_RATE: " + loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE);
              configuration.localMinSuccessRate = loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE;
            }

            if (loadedConfigObj.TNN_LOCAL_PURGE_MIN_SUCCESS_RATE !== undefined){
              console.log("NNT | LOADED TNN_LOCAL_PURGE_MIN_SUCCESS_RATE: " + loadedConfigObj.TNN_LOCAL_PURGE_MIN_SUCCESS_RATE);
              configuration.localPurgeMinSuccessRate = loadedConfigObj.TNN_LOCAL_PURGE_MIN_SUCCESS_RATE;
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

            callback(null, true);

          }
        });

      }
    });
  }

}

function loadSeedNeuralNetwork(params, callback){

  debug(chalkNetwork("NNT | ... LOADING SEED NETWORK FROM DB\nPARAMS: " + jsonPrint(params)));

  loadBestNetworkDropboxFolders(params, function loadBestCallback (err, numNetworksLoaded){

    if (err) {
      if (err.status === 429) {
        console.log(chalkError("NNT | LOAD DROPBOX BEST NETWORK ERR"
          + " | FOLDERS: " + params.folders
          + " | STATUS: " + err.status
          + " | TOO MANY REQUESTS"
        ));
      }
      else {
        console.log(chalkError("NNT | LOAD DROPBOX BEST NETWORK ERR"
          + " | FOLDERS: " + params.folders
          + " | STATUS: " + err.status
          + " | ERROR: " + jsonPrint(err)
        ));
      }
      if (callback !== undefined) { callback(err, null); }
    }
    else if (numNetworksLoaded === 0){

      if (configuration.verbose){

        sortedHashmap({ sortKey: "networkObj.overallMatchRate", hashmap: bestNetworkHashMap, max: 500})
        .then(function(sortedBestNetworks){

        let tableArray = [];

        tableArray.push([
          "NNT | ",
          "MR %",
          "SR %",
          "INPUTS",
          "INPUTS ID",
          "NNID"
        ]);

        sortedBestNetworks.sortedKeys.forEach(function(nnId){

          tableArray.push([
            "NNT | ",
            bestNetworkHashMap.get(nnId).networkObj.matchRate.toFixed(2),
            bestNetworkHashMap.get(nnId).networkObj.successRate.toFixed(2),
            bestNetworkHashMap.get(nnId).networkObj.numInputs,
            bestNetworkHashMap.get(nnId).networkObj.inputsId,
            nnId
          ]);
        });

        const t = table(tableArray, { align: ["l", "r", "r", "r", "l", "l"] });

        console.log("NNT | ============================================================================================================================================");

        console.log(chalkLog("NNT | ... NO BEST NETWORKS CHANGED / LOADED | NNs IN HM: " + sortedBestNetworks.sortedKeys.length));

        if (configuration.verbose) { console.log(t); }

        console.log("NNT | ============================================================================================================================================");

        })
        .catch(function(err){
          console.trace(chalkError("generateRandomEvolveConfig SORTER ERROR: " + err));
        });
      }

      if (callback !== undefined) { callback(err, numNetworksLoaded); }
    }
    else {

      sortedHashmap({ sortKey: "networkObj.overallMatchRate", hashmap: bestNetworkHashMap, max: 500})
      .then(function(sortedBestNetworks){

        let tableArray = [];

        tableArray.push([
          "NNT | ",
          "OAMR %",
          "MR %",
          "SR %",
          "INPUTS",
          "INPUTS ID",
          "NNID"
        ]);

        sortedBestNetworks.sortedKeys.forEach(function(nnId){

          tableArray.push([
            "NNT | ",
            bestNetworkHashMap.get(nnId).networkObj.overallMatchRate.toFixed(2),
            bestNetworkHashMap.get(nnId).networkObj.matchRate.toFixed(2),
            bestNetworkHashMap.get(nnId).networkObj.successRate.toFixed(2),
            bestNetworkHashMap.get(nnId).networkObj.numInputs,
            bestNetworkHashMap.get(nnId).networkObj.inputsId,
            nnId
          ]);

        });

        const t = table(tableArray, { align: ["l", "r", "r", "r", "r", "l", "l"] });

        console.log("NNT | ============================================================================================================================================");
        console.log(chalkInfo("NNT | +++ BEST NETWORKS CHANGED / LOADED | NNs IN HM: " + sortedBestNetworks.sortedKeys.length));
        console.log(t);
        console.log("NNT | ============================================================================================================================================");

      })
      .catch(function(err){
        console.trace(chalkError("generateRandomEvolveConfig SORTER ERROR: " + err));
      });

      if (callback !== undefined) { callback(null, null); }

    }
  });
}

function sendKeepAlive(userObj, callback){
  if (!configuration.offlineMode && statsObj.userReadyAck && statsObj.serverConnected){

    statsObj.elapsed = moment().valueOf() - statsObj.startTime;
    userObj.stats = statsObj;

    debug(chalkInfo("TX KEEPALIVE"
      + " | " + userObj.userId
      + " | " + moment().format(defaultDateTimeFormat)
    ));
    socket.emit("SESSION_KEEPALIVE", userObj);
    callback(null);
  }
  else if (!configuration.serverMode) {
    debug(chalkError("... OFFLINE | NO TX KEEPALIVE"
      + " | " + userObj.userId
      + " | CONNECTED: " + statsObj.serverConnected
      + " | READY ACK: " + statsObj.userReadyAck
      + " | " + moment().format(defaultDateTimeFormat)
    ));
    callback(null);
  }
  else {
    console.log(chalkError("!!!! CANNOT TX KEEPALIVE"
      + " | " + userObj.userId
      + " | CONNECTED: " + statsObj.serverConnected
      + " | READY ACK: " + statsObj.userReadyAck
      + " | " + moment().format(defaultDateTimeFormat)
    ));
    callback("ERROR");
  }
}

function initKeepalive(userObj, interval){

  clearInterval(socketKeepaliveInterval);

  console.log(chalkConnect("START PRIMARY KEEPALIVE"
    + " | READY ACK: " + statsObj.userReadyAck
    + " | SERVER CONNECTED: " + statsObj.serverConnected
    + " | INTERVAL: " + interval + " ms"
  ));

  sendKeepAlive(userObj, function(err){
    if (err) {
      console.log(chalkError("KEEPALIVE ERROR: " + err));
    }
    debug(chalkRed("KEEPALIVE"
      + " | " + moment().format(defaultDateTimeFormat)
    ));
  });

  socketKeepaliveInterval = setInterval(function(){ // TX KEEPALIVE

    userObj.stats = statsObj;

    sendKeepAlive(userObj, function(err){
      if (err) {
        console.log(chalkError("KEEPALIVE ERROR: " + err));
      }
      debug(chalkRed("KEEPALIVE"
        + " | " + moment().format(defaultDateTimeFormat)
      ));
    });

  }, interval);
}

function initUserReadyInterval(interval){

  console.log(chalkInfo("INIT USER READY INTERVAL"));

  clearInterval(userReadyInterval);

  userReadyInterval = setInterval(function(){

    if (statsObj.serverConnected && !statsObj.userReadyTransmitted && !statsObj.userReadyAck){

      statsObj.userReadyTransmitted = true; 
      userObj.timeStamp = moment().valueOf();
      socket.emit("USER_READY", {userId: userObj.userId, timeStamp: moment().valueOf()}); 

    }

    else if (statsObj.userReadyTransmitted && !statsObj.userReadyAck) {

      statsObj.userReadyAckWait += 1;
      console.log(chalkDisconnect("... WAITING FOR USER_READY_ACK ..."));

    }
  }, interval);
}

function initSocket(callback){

  if (!configuration.serverMode) {
    console.log(chalkAlert("NNT | NO SERVER MODE | SKIP INIT SOCKET"));
    return(callback(null, null));
  }

  console.log(chalkLog("INIT SOCKET"
    + " | serverMode: " + configuration.serverMode
    + " | TARGET SERVER: " + configuration.targetServer
    + "\n" + jsonPrint(userObj)
  ));

  socket = require("socket.io-client")(configuration.targetServer);

  socket.on("connect", function(){

    statsObj.online = true;

    console.log(chalkInfo("NNT | SERVER CONNECT | " + socket.id + " ... AUTHENTICATE ..."));

    socket.on("unauthorized", function(err){
      console.log("NNT | There was an error with the authentication:", err.message);
    });

    socket.emit("authentication", { namespace: "util", userId: userObj.userId, password: "0123456789" });

    socket.on("authenticated", function() {

      console.log("AUTHENTICATED | " + socket.id);

      statsObj.serverConnected = true ;
      statsObj.userReadyAck = false ;

      statsObj.socketId = socket.id;

      console.log(chalkConnect( "CONNECTED TO HOST" 
        + " | SERVER: " + configuration.targetServer 
        + " | ID: " + socket.id 
      ));

      initUserReadyInterval(5000);

    });

  });

  socket.on("reconnect", function(){
    statsObj.serverConnected = true ;
    statsObj.userReadyAck = false ;
    statsObj.online = true;
    console.log(chalkConnect(moment().format(defaultDateTimeFormat) 
      + " | SERVER RECONNECT: " + socket.id));
  });

  socket.on("USER_READY_ACK", function(ackObj) {

    clearInterval(userReadyInterval);

    statsObj.serverConnected = true ;
    statsObj.userReadyAck = true ;

    console.log(chalkConnect("RX USER_READY_ACK"
      + " | " + moment().format(defaultDateTimeFormat)
      + " | " + socket.id
      + " | USER ID: " + ackObj.userId
      + " | ACK TIMESTAMP: " + moment(parseInt(ackObj.timeStamp)).format(compactDateTimeFormat)
    ));

    initKeepalive(userObj, configuration.keepaliveInterval);
  });

  socket.on("error", function(err){
    statsObj.userReadyTransmitted = false;
    statsObj.userReadyAck = false ;
    statsObj.serverConnected = false ;
    console.log(chalkDisconnect(moment().format(compactDateTimeFormat)
      + " | ***** SERVER SOCKET ERROR"
      + " | " + err.type
      + " | " + err.description
    ));
  });

  socket.on("connect_error", function(err){
    statsObj.userReadyTransmitted = false;
    statsObj.userReadyAck = false ;
    statsObj.serverConnected = false ;
    console.log(chalkDisconnect(moment().format(compactDateTimeFormat)
      + " | ***** SERVER CONNECT ERROR"
      + " | " + err.type
      + " | " + err.description
    ));

  });

  socket.on("reconnect_error", function(){
    statsObj.userReadyTransmitted = false;
    statsObj.userReadyAck = false ;
    statsObj.serverConnected = false ;
    console.log(chalkDisconnect(moment().format(compactDateTimeFormat)
      + " | ***** SERVER RECONNECT ERROR"
    ));
  });

  socket.on("disconnect", function(){
    statsObj.userReadyTransmitted = false;
    statsObj.userReadyAck = false ;
    statsObj.serverConnected = false;
    console.log(chalkDisconnect(moment().format(compactDateTimeFormat)
      + " | ***** SERVER DISCONNECT"
    ));

   // reset("disconnect");
  });

  socket.on("KEEPALIVE_ACK", function(userId) {
    debug(chalkLog("RX KEEPALIVE_ACK | " + userId));
  });

  callback(null, null);
}

function loadAllConfigFiles(callback){
  async.series({
      defaultConfig: function(cb) {
        loadConfigFile(dropboxConfigDefaultFolder, dropboxConfigDefaultFile, function(err, defaultConfigLoadedFlag){
          cb(err, defaultConfigLoadedFlag);
        });
      },
      hostConfig: function(cb){
        loadConfigFile(dropboxConfigHostFolder, dropboxConfigHostFile, function(err, hostConfigLoadedFlag){
          cb(err, hostConfigLoadedFlag);
        });
      }
  }, function(err, results) {
    if (results.defaultConfig || results.hostConfig) {
      if (results.defaultConfig) {
        console.log(chalkAlert("NNT | +++ RELOADED DEFAULT CONFIG " + dropboxConfigDefaultFolder + "/" + dropboxConfigDefaultFile));
      }
      if (results.hostConfig) {
        console.log(chalkAlert("NNT | +++ RELOADED HOST CONFIG " + dropboxConfigHostFolder + "/" + dropboxConfigHostFile));
      }
    }
    else {
      debug(chalkLog("... NO RELOAD CONFIG FILE" + dropboxConfigDefaultFolder + "/" + dropboxConfigDefaultFile));
      debug(chalkLog("... NO RELOAD CONFIG FILE" + dropboxConfigHostFolder + "/" + dropboxConfigHostFile));
    }
    callback(err, results);
  });
}

function initialize(cnf, callback){

  debug(chalkBlue("INITIALIZE cnf\n" + jsonPrint(cnf)));

  if (debug.enabled || debugCache.enabled || debugQ.enabled){
    console.log("\nNNT | %%%%%%%%%%%%%%\nNNT |  DEBUG ENABLED \nNNT | %%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.TNN_PROCESS_NAME || "node_twitterNeuralNetwork";
  cnf.runId = process.env.TNN_RUN_ID || statsObj.runId;
  cnf.targetServer = process.env.TNN_UTIL_TARGET_SERVER || "http://127.0.0.1:9997/util" ;

  cnf.verbose = process.env.TNN_VERBOSE_MODE || false ;
  cnf.quitOnError = process.env.TNN_QUIT_ON_ERROR || false ;
  cnf.enableStdin = process.env.TNN_ENABLE_STDIN || true ;
  cnf.networkCreateMode = process.env.TNN_NETWORK_CREATE_MODE || DEFAULT_NETWORK_CREATE_MODE ;
  cnf.initMainIntervalTime = process.env.TNN_INIT_MAIN_INTERVAL || DEFAULT_INIT_MAIN_INTERVAL ;
  cnf.inputsId = process.env.TNN_INPUTS_ID || false ;
  cnf.inputsIdArray = process.env.TNN_INPUTS_IDS || [] ;
  cnf.seedNetworkProbability = process.env.TNN_SEED_NETWORK_PROBABILITY || DEFAULT_SEED_NETWORK_PROBABILITY ;

  if (process.env.TNN_QUIT_ON_COMPLETE !== undefined) {
    console.log("NNT | ENV TNN_QUIT_ON_COMPLETE: " + process.env.TNN_QUIT_ON_COMPLETE);
    if (!process.env.TNN_QUIT_ON_COMPLETE || (process.env.TNN_QUIT_ON_COMPLETE === "false")) {
      cnf.quitOnComplete = false ;
    }
    else {
      cnf.quitOnComplete = true ;
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

  if (process.env.TNN_LOAD_ALL_INPUTS !== undefined){
    console.log("NNT | LOADED TNN_LOAD_ALL_INPUTS: " + process.env.TNN_LOAD_ALL_INPUTS);

    if (process.env.TNN_LOAD_ALL_INPUTS || (process.env.TNN_LOAD_ALL_INPUTS === "true")) {
      cnf.loadAllInputs = true;
    }
    else {
      cnf.loadAllInputs = false;
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

  cnf.categorizedUsersFile = process.env.TNN_CATEGORIZED_USERS_FILE || categorizedUsersFile;
  cnf.categorizedUsersFolder = globalCategorizedUsersFolder;
  cnf.statsUpdateIntervalTime = process.env.TNN_STATS_UPDATE_INTERVAL || 300000;

  debug(chalkWarn("dropboxConfigDefaultFolder: " + dropboxConfigDefaultFolder));
  debug(chalkWarn("dropboxConfigDefaultFile  : " + dropboxConfigDefaultFile));


  loadAllConfigFiles(function(err, results){

    loadCommandLineArgs(function(err, results){
    
      const configArgs = Object.keys(configuration);

      configArgs.forEach(function(arg){
        console.log("NNT | _FINAL CONFIG | " + arg + ": " + configuration[arg]);
      });
      
      statsObj.commandLineArgsLoaded = true;

      initStatsUpdate(configuration);

      loadInputsDropboxFolder(defaultInputsFolder, function(err, results){
        return(callback(err, configuration));
      });

    });

  });

}

console.log(chalkInfo("NNT | " + getTimeStamp() 
  + " | WAIT 5 SEC FOR MONGO BEFORE INITIALIZE CONFIGURATION"
));

configEvents.once("INIT_MONGODB", function(){

  console.log(chalkLog("NNT | INIT_MONGODB"));

});

let userMaxInputHashMap = {};

// FUTURE: break up into updateCategorizedUsers and createTrainingSet
function updateCategorizedUsers(cnf, callback){

  userServer.resetMaxInputsHashMap();

  let categorizedNodeIds = categorizedUserHashmap.keys();

  if (cnf.testMode) {
    categorizedNodeIds.length = TEST_MODE_LENGTH;
    console.log(chalkAlert("NNT | *** TEST MODE *** | CATEGORIZE MAX " + TEST_MODE_LENGTH + " USERS"));
  }

  let maxMagnitude = -Infinity;
  let minScore = Infinity;
  let maxScore = -Infinity;

  console.log(chalkBlue("NNT | UPDATE CATEGORIZED USERS: " + categorizedNodeIds.length));

  if (cnf.normalization) {
    maxMagnitude = cnf.normalization.magnitude.max;
    minScore = cnf.normalization.score.min;
    maxScore = cnf.normalization.score.max;
    console.log(chalkInfo("NNT | SET NORMALIZATION\n" + jsonPrint(cnf.normalization)));
  }

  statsObj.users.updatedCategorized = 0;
  statsObj.users.notCategorized = 0;

  let userIndex = 0;
  let categorizedUsersPercent = 0;
  let categorizedUsersStartMoment = moment();
  let categorizedUsersEndMoment = moment();
  let categorizedUsersElapsed = 0;
  let categorizedUsersRemain = 0;
  let categorizedUsersRate = 0;

  async.eachSeries(categorizedNodeIds, function(nodeId, cb0){

    User.findOne( { "$or":[ {nodeId: nodeId.toString()}, {screenName: nodeId.toLowerCase()} ]}, function(err, user){

      userIndex += 1;

      if (err){
        console.error(chalkError("NNT | *** UPDATE CATEGORIZED USERS: USER FIND ONE ERROR: " + err));
        statsObj.errors.users.findOne += 1;
        return(cb0(err));
      }

      if (!user){
        console.log(chalkLog("NNT | *** UPDATE CATEGORIZED USERS: USER NOT FOUND: NID: " + nodeId));
        statsObj.users.notFound += 1;
        statsObj.users.notCategorized += 1;
        return(cb0());
      }

      if (user.screenName === undefined) {
        console.log(chalkError("NNT | *** UPDATE CATEGORIZED USERS: USER SCREENNAME UNDEFINED\n" + jsonPrint(user)));
        statsObj.users.screenNameUndefined += 1;
        statsObj.users.notCategorized += 1;
        return(cb0("USER SCREENNAME UNDEFINED", null));
      }

      debug(chalkInfo("NNT | UPDATE CL USR <DB"
        + " [" + userIndex + "/" + categorizedNodeIds.length + "]"
        + " | " + user.nodeId
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
      else {
        user.languageAnalysis = {};
        user.languageAnalysis.sentiment = {};
        user.languageAnalysis.sentiment.magnitude = 0;
        user.languageAnalysis.sentiment.score = 0;
      }

      sentimentText = "M: " + sentimentObj.magnitude.toFixed(2) + " S: " + sentimentObj.score.toFixed(2);

      const category = user.category || false;

      if (category) {

        let classText = "";
        let currentChalk = chalkLog;

        switch (category) {
          case "left":
            categorizedUserHistogram.left += 1;
            classText = "L";
            currentChalk = chalk.blue;
          break;
          case "right":
            categorizedUserHistogram.right += 1;
            classText = "R";
            currentChalk = chalk.yellow;
          break;
          case "neutral":
            categorizedUserHistogram.neutral += 1;
            classText = "N";
            currentChalk = chalk.black;
          break;
          case "positive":
            categorizedUserHistogram.positive += 1;
            classText = "+";
            currentChalk = chalk.green;
          break;
          case "negative":
            categorizedUserHistogram.negative += 1;
            classText = "-";
            currentChalk = chalk.red;
          break;
          default:
            categorizedUserHistogram.none += 1;
            classText = "O";
            currentChalk = chalk.bold.gray;
        }

        debug(chalkInfo("\n==============================\n"));
        debug(currentChalk("ADD  | U"
          + " | SEN: " + sentimentText
          + " | " + classText
          + " | " + user.screenName
          + " | " + user.nodeId
          + " | " + user.name
          + " | 3C FOLLOW: " + user.threeceeFollowing
          + " | FLLWs: " + user.followersCount
          + " | FRNDs: " + user.friendsCount
        ));

        statsObj.users.updatedCategorized += 1;

        categorizedUsersPercent = 100 * (statsObj.users.notCategorized + statsObj.users.updatedCategorized)/categorizedNodeIds.length;
        categorizedUsersElapsed = (moment().valueOf() - categorizedUsersStartMoment.valueOf()); // mseconds
        categorizedUsersRate = categorizedUsersElapsed/statsObj.users.updatedCategorized; // msecs/userCategorized
        categorizedUsersRemain = (categorizedNodeIds.length - (statsObj.users.notCategorized + statsObj.users.updatedCategorized)) * categorizedUsersRate; // mseconds
        categorizedUsersEndMoment = moment();
        categorizedUsersEndMoment.add(categorizedUsersRemain, "ms");

        if ((statsObj.users.notCategorized + statsObj.users.updatedCategorized) % 100 === 0){
          console.log(chalkInfo("NNT"
            + " | START: " + categorizedUsersStartMoment.format(compactDateTimeFormat)
            + " | ELAPSED: " + msToTime(categorizedUsersElapsed)
            + " | REMAIN: " + msToTime(categorizedUsersRemain)
            + " | ETC: " + categorizedUsersEndMoment.format(compactDateTimeFormat)
            + " | " + (statsObj.users.notCategorized + statsObj.users.updatedCategorized) + "/" + categorizedNodeIds.length
            + " (" + categorizedUsersPercent.toFixed(1) + "%)"
            + " USERS CATEGORIZED"
          ));

          console.log(chalkLog("NNT | CL U HIST"
            + " | L: " + categorizedUserHistogram.left 
            + " | R: " + categorizedUserHistogram.right
            + " | N: " + categorizedUserHistogram.neutral
            + " | +: " + categorizedUserHistogram.positive
            + " | -: " + categorizedUserHistogram.negative
            + " | 0: " + categorizedUserHistogram.none
          ));
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
                + " | " + user.nodeId
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
                  + " | " + user.nodeId
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

              twitterImageParser.parseImage(user.bannerImageUrl, { screenName: user.screenName, category: user.category, updateGlobalHistograms: true}, function(err, results){
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
                    console.log(chalkInfo("NNT | +++ BANNER ANALYZED: @" + user.screenName + " | " + classText + " | " + results.text));
                    text = text + "\n" + results.text;
                  }

                  cb(null, text, results);
                }
              });
            }
            else if (user.bannerImageUrl && user.bannerImageAnalyzed && (user.bannerImageUrl === user.bannerImageAnalyzed)) {

              statsObj.users.imageParse.skipped += 1;

              const imageHits = (user.histograms.images === undefined) ? 0 : Object.keys(user.histograms.images);
              debug(chalkInfo("--- BANNER HIST HIT: @" + user.screenName + " | HITS: " + imageHits));

              async.setImmediate(function() {
                cb(null, text, null);
              });

            }
            else {
              async.setImmediate(function() {
                cb(null, text, null);
              });
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

            // console.log(chalkInfo("hist keys: " + Object.keys(hist)));
            // update user histogram in db

            const updateHistogramsParams = { 
              user: user, 
              histograms: hist, 
              computeMaxInputsFlag: true,
              accumulateFlag: true
            };

            userServer.updateHistograms(updateHistogramsParams, function(err, updatedUser){

              if (err) {
                console.error("*** UPDATE USER HISTOGRAMS ERROR\n" + err);
                return(cb0(err));
              }

              // console.log(chalkInfo("hist keys: " + Object.keys(updatedUser.histograms)));

              const subUser = pick(
                updatedUser,
                [
                  "userId", 
                  "screenName", 
                  "nodeId", 
                  "name",
                  "statusesCount",
                  "followersCount",
                  "friendsCount",
                  "languageAnalysis", 
                  "category", 
                  "categoryAuto", 
                  "histograms", 
                  "threeceeFollowing"
                ]);

              trainingSetUsersHashMap.set(subUser.nodeId, subUser);

              debug("CL USR >DB"
                + " | " + subUser.nodeId
                + " | @" + subUser.screenName
                + " | C: " + subUser.category
              );

              cb0();

            });

          });

        });   
      }
      else {

        statsObj.users.notCategorized += 1;

        if (statsObj.users.notCategorized % 10 === 0){
          console.log(chalkLog("NNT | " + statsObj.users.notCategorized + " USERS NOT CATEGORIZED"));
        }

        debug(chalkBlue("NNT *** USR DB NOT CL"
          + " | CM: " + user.category
          + " | CM HM: " + categorizedUserHashmap.get(nodeId).manual
          + " | " + user.nodeId
          + " | " + user.screenName
          + " | " + user.name
          + " | 3CF: " + user.threeceeFollowing
          + " | FLs: " + user.followersCount
          + " | FRs: " + user.friendsCount
          + " | SEN: " + sentimentText
        ));

        categorizedUsersPercent = 100 * (statsObj.users.notCategorized + statsObj.users.updatedCategorized)/categorizedNodeIds.length;
        categorizedUsersElapsed = (moment().valueOf() - categorizedUsersStartMoment.valueOf()); // mseconds
        categorizedUsersRate = categorizedUsersElapsed/statsObj.users.updatedCategorized; // msecs/userCategorized
        categorizedUsersRemain = (categorizedNodeIds.length - (statsObj.users.notCategorized + statsObj.users.updatedCategorized)) * categorizedUsersRate; // mseconds
        categorizedUsersEndMoment = moment();
        categorizedUsersEndMoment.add(categorizedUsersRemain, "ms");

        if ((statsObj.users.notCategorized + statsObj.users.updatedCategorized) % 20 === 0){
          console.log(chalkInfo("NNT"
            + " | START: " + categorizedUsersStartMoment.format(compactDateTimeFormat)
            + " | ELAPSED: " + msToTime(categorizedUsersElapsed)
            + " | REMAIN: " + msToTime(categorizedUsersRemain)
            + " | ETC: " + categorizedUsersEndMoment.format(compactDateTimeFormat)
            + " | " + (statsObj.users.notCategorized + statsObj.users.updatedCategorized) + "/" + categorizedNodeIds.length
            + " (" + categorizedUsersPercent.toFixed(1) + "%)"
            + " USERS CATEGORIZED"
          ));

          console.log(chalkLog("NNT | CL U HIST"
            + " | L: " + categorizedUserHistogram.left
            + " | R: " + categorizedUserHistogram.right
            + " | N: " + categorizedUserHistogram.neutral
            + " | +: " + categorizedUserHistogram.positive
            + " | -: " + categorizedUserHistogram.negative
            + " | 0: " + categorizedUserHistogram.none
          ));

        }

        user.category = categorizedUserHashmap.get(nodeId).manual;

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
        console.log(chalkError("NNT | UPDATE CATEGORIZED USERS ERROR: " + err));
      }
    }

    userMaxInputHashMap = userServer.getMaxInputsHashMap();

    // console.log("MAX INPUT HASHMAP keys\n" + Object.keys(userMaxInputHashMap.images));

    categorizedUsersPercent = 100 * (statsObj.users.notCategorized + statsObj.users.updatedCategorized)/categorizedNodeIds.length;
    categorizedUsersElapsed = (moment().valueOf() - categorizedUsersStartMoment.valueOf()); // mseconds
    categorizedUsersRate = categorizedUsersElapsed/statsObj.users.updatedCategorized; // msecs/userCategorized
    categorizedUsersRemain = (categorizedNodeIds.length - (statsObj.users.notCategorized + statsObj.users.updatedCategorized)) * categorizedUsersRate; // mseconds
    categorizedUsersEndMoment = moment();
    categorizedUsersEndMoment.add(categorizedUsersRemain, "ms");

    console.log(chalkAlert("\nNNT | ======================= END CATEGORIZE USERS ======================="
      + "\nNNT | ==== START:   " + categorizedUsersStartMoment.format(compactDateTimeFormat)
      + "\nNNT | ==== ELAPSED: " + msToTime(categorizedUsersElapsed)
      + "\nNNT | ==== REMAIN:  " + msToTime(categorizedUsersRemain)
      + "\nNNT | ==== ETC:     " + categorizedUsersEndMoment.format(compactDateTimeFormat)
      + "\nNNT | ====          " + (statsObj.users.notCategorized + statsObj.users.updatedCategorized) + "/" + categorizedNodeIds.length
      + " (" + categorizedUsersPercent.toFixed(1) + "%)" + " USERS CATEGORIZED"
    ));

    console.log(chalkAlert("NNT | CL U HIST"
      + " | L: " + categorizedUserHistogram.left
      + " | R: " + categorizedUserHistogram.right
      + " | N: " + categorizedUserHistogram.neutral
      + " | +: " + categorizedUserHistogram.positive
      + " | -: " + categorizedUserHistogram.negative
      + " | 0: " + categorizedUserHistogram.none
    ));


    statsObj.normalization.magnitude.max = maxMagnitude;
    statsObj.normalization.score.min = minScore;
    statsObj.normalization.score.max = maxScore;

    console.log(chalkInfo("NNT | CL U HIST | NORMALIZATION"
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
  convertedDatum.user = datum.screenName;
  convertedDatum.input = [];
  convertedDatum.output = [];

  switch (datum.category) {
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

  async.eachSeries(inputTypes, function(inputType, cb0){

    async.eachSeries(inputs[inputType], function(inName, cb1){

      const inputName = inName;

      if ((datum.histograms[inputType] !== undefined) && (datum.histograms[inputType][inputName] !== undefined)){
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
      cb0();
    });

  }, function(){
    callback(null, convertedDatum);
  });
}

function testNetwork(nwObj, testObj, callback){

  const nw = neataptic.Network.fromJSON(nwObj.network);

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

  let shuffledTestData = _.shuffle(testObj.testSet.data);

  async.eachSeries(shuffledTestData, function(datum, cb){

    convertDatum(convertDatumParams, nwObj.inputsObj.inputs, datum, function(err, testDatumObj){

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

function initCategorizedUserHashmap(callback){

  // const query = (params.query) ? params.query : { $or: [ { "category": { $nin: [ false, null ] } } , { "categoryAuto": { $nin: [ false, null ] } } ] };

  let p = {};
  p.query = { 
    "category": { "$nin": [ false, null ] } 
  };

  userServer.findCategorizedUsersCursor(p, function(err, results){
    if (err) {
      console.error(chalkError("NNT | ERROR: initCategorizedUserHashmap: " + err));
      callback(err);
    }
    else {
      console.log(chalkInfo("NNT | LOADED CATEGORIZED USERS FROM DB"
        + " | " + results.count + " CATEGORIZED"
        + " | " + results.manual + " MAN"
        + " | " + results.auto + " AUTO"
        + " | " + results.matchRate.toFixed(1) + "% MATCH"
      ));

      // results.obj[nodeId] = { manual: user.category, auto: user.categoryAuto };

      Object.keys(results.obj).forEach(function(nodeId){
        categorizedUserHashmap.set(nodeId, results.obj[nodeId]);
      });

      callback();
    }
  });
}

function generateGlobalTrainingTestSet (userHashMap, maxInputHashMap, callback){

  const nIds = userHashMap.keys();
  const nodeIds = _.shuffle(nIds);

  let trainingSetId;

  if (configuration.testMode) { 
    trainingSetId = "test_" + configuration.globalTrainingSetId + "_" + statsObj.runId; 
  }
  else {
    trainingSetId = configuration.globalTrainingSetId + "_" + statsObj.runId; 
  }

  console.log(chalkAlert("NNT | ==================================================================="));
  console.log(chalkAlert("NNT | GENERATE TRAINING SET | " + nodeIds.length + " USERS | " + getTimeStamp()));
  console.log(chalkAlert("NNT | ==================================================================="));

  let trainingSet = {};
  trainingSet.meta = {};
  trainingSet.data = [];

  let testSet = {};
  testSet.meta = {};
  testSet.meta.testSetId = trainingSetId + "_" + getTimeStamp();
  testSet.data = [];

  async.eachSeries(nodeIds, function(nodeId, cb){ 

    const user = userHashMap.get(nodeId);

    let sentimentObj = {};
    sentimentObj.magnitude = 0;
    sentimentObj.score = 0;

    if ((user.languageAnalysis !== undefined)
      && (user.languageAnalysis.sentiment !== undefined)) {

      sentimentObj.magnitude = user.languageAnalysis.sentiment.magnitude || 0;
      sentimentObj.score = user.languageAnalysis.sentiment.score || 0;

    }

    user.category = user.category || false;

    if (configuration.generateTrainingSetOnly) {

      trainingSet.data.push(user);

      async.setImmediate(function() { 
        cb(); 
      });
    }
    else if ((testSet.data.length < (configuration.testSetRatio * nodeIds.length)) && (Math.random() >= configuration.testSetRatio)) {

      trainingSet.data.push(user);

      async.setImmediate(function() { 
        cb(); 
      });
    }
    else {

      testSet.data.push(user);

      async.setImmediate(function() { 
        cb(); 
      });
    }


  }, function(err) { 

    if (err) {
      console.log(chalkError("GENERATE TRAINING SET ERROR\n" + jsonPrint(err)));
      return callback(err, null);
    }

    // const trainingSetId = GLOBAL_TRAINING_SET_ID + "_" + statsObj.runId;

    trainingSet.meta.numOutputs = 3;
    trainingSet.meta.setSize = trainingSet.data.length;

    testSet.meta.numOutputs = 3;
    testSet.meta.setSize = testSet.data.length;

    console.log(chalkInfo("NNT | +++ TRAINING SET"
      + " | ID: " + trainingSetId
      + " | OUT: " + trainingSet.meta.numOutputs
      + " | SIZE: " + trainingSet.meta.setSize
      + " | TEST SET SIZE: " + testSet.meta.setSize
    ));

    let trainingSetObj = {};
    trainingSetObj.trainingSetId = "globalTrainingSet";
    trainingSetObj.globalTrainingSetFlag = true;
    trainingSetObj.normalization = {};
    trainingSetObj.normalization = statsObj.normalization;
    trainingSetObj.maxInputHashMap = {};
    trainingSetObj.maxInputHashMap = maxInputHashMap;
    trainingSetObj.trainingSet = {};
    trainingSetObj.trainingSet = trainingSet;
    trainingSetObj.testSet = {};
    trainingSetObj.testSet = testSet;

    let trainingSetEntry = {};
    trainingSetEntry.name = trainingSetObj.trainingSetId + ".json";
    trainingSetEntry.content_hash = false;
    trainingSetEntry.client_modified = moment();

    let trainingSetSmallObj = {};
    trainingSetSmallObj.trainingSetId = "smallGlobalTrainingSet";
    trainingSetSmallObj.globalTrainingSetFlag = true;
    trainingSetSmallObj.normalization = {};
    trainingSetSmallObj.normalization = statsObj.normalization;
    trainingSetSmallObj.maxInputHashMap = {};
    trainingSetSmallObj.maxInputHashMap = maxInputHashMap;

    trainingSetSmallObj.trainingSet = {};
    trainingSetSmallObj.trainingSet.meta = {};
    trainingSetSmallObj.trainingSet.meta.numOutputs = trainingSet.meta.numOutputs;
    trainingSetSmallObj.trainingSet.meta.setSize = SMALL_SET_SIZE;
    trainingSetSmallObj.trainingSet.data = [];
    trainingSetSmallObj.trainingSet.data = arraySlice(trainingSet.data, 0, SMALL_SET_SIZE);

    trainingSetSmallObj.testSet = {};
    trainingSetSmallObj.testSet.meta = {};
    trainingSetSmallObj.testSet.meta.setSize = SMALL_TEST_SET_SIZE;
    trainingSetSmallObj.testSet.meta.numOutputs = trainingSet.meta.numOutputs;
    trainingSetSmallObj.testSet.data = [];
    trainingSetSmallObj.testSet.data = arraySlice(testSet.data, 0, SMALL_TEST_SET_SIZE);

    let trainingSetSmallEntry = {};
    trainingSetSmallEntry.name = trainingSetSmallObj.trainingSetId + ".json";
    trainingSetSmallEntry.content_hash = false;
    trainingSetSmallEntry.client_modified = moment();

    console.log(chalkInfo("NNT | +++ SMALL TRAINING SET"
      + " | ID: " + trainingSetSmallObj.trainingSetId
      + " | OUT: " + trainingSetSmallObj.trainingSet.meta.numOutputs
      + " | SIZE: " + trainingSetSmallObj.trainingSet.meta.setSize
      + " | TEST SET SIZE: " + trainingSetSmallObj.testSet.meta.setSize
    ));

    trainingSetHashMap.set(
      trainingSetObj.trainingSetId, 
      {entry: trainingSetEntry, trainingSetObj: trainingSetObj}
    );

    trainingSetHashMap.set(
      trainingSetSmallObj.trainingSetId, 
      {entry: trainingSetEntry, trainingSetObj: trainingSetSmallObj}
    );

    let file = trainingSetEntry.name;
    let fileSmall = trainingSetSmallEntry.name;

    let dropboxFolder = (hostname === "google") ? "/home/tc/Dropbox/Apps/wordAssociation/config/utility/default/trainingSets" 
    : "/Users/tc/Dropbox/Apps/wordAssociation/config/utility/" + hostname + "/trainingSets";

    if (configuration.testMode) {
      dropboxFolder = (hostname === "google") ? "/home/tc/Dropbox/Apps/wordAssociation/config/utility/default/trainingSets_test" 
      : "/Users/tc/Dropbox/Apps/wordAssociation/config/utility/" + hostname + "/trainingSets_test";
    }

    let folder = dropboxFolder;
    let fullPath = folder + "/" + file;

    console.log(chalkInfo("NNT | SAVING TRAINING SET: " + fullPath));

    writeJsonFile(fullPath, trainingSetObj)
    .then(function() {
      console.log(chalkInfo("NNT | SAVED GLOBAL TRAINING SET | " + fullPath));

      const maxInputHashMapPath = folder + "/maxInputHashMap.json";

      let mihmObj = {};
      mihmObj.maxInputHashMap = {};
      mihmObj.maxInputHashMap = trainingSetObj.maxInputHashMap;
      mihmObj.normalization = {};
      mihmObj.normalization = trainingSetObj.normalization;

      writeJsonFile(maxInputHashMapPath, mihmObj)
      .then(function() {
 
        console.log(chalkInfo("NNT | SAVED MAX INPUT HASHMAP | " + maxInputHashMapPath));

        const fullPathSmall = folder + "/" + fileSmall;

        console.log(chalkInfo("NNT | SAVING SMALL TRAINING SET: " + fullPathSmall));
        
        writeJsonFile(fullPathSmall, trainingSetSmallObj)
        .then(function() {
          console.log(chalkInfo("NNT | SAVED SMALL TRAINING SET | " + fullPathSmall));
          console.log(chalkInfo("NNT | ======================= END GENERATE GLOBAL TRAINING SET ======================="));
          callback(null, null);
        });

      })
      .catch(function(error){
        console.log(chalkError("NNT | " + moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: " + error
          + " | ERROR\n" + jsonPrint(error)
        ));
        if (callback !== undefined) { return callback(error, null); }
      });
    })
    .catch(function(error){
      console.log(chalkError("NNT | " + moment().format(compactDateTimeFormat) 
        + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
        + " | ERROR: " + error
        + " | ERROR\n" + jsonPrint(error)
      ));
      if (callback !== undefined) { return callback(error, null); }
    });

  });
}

function generateRandomEvolveConfig (cnf, callback){

  let config = {};
  config.networkCreateMode = "evolve";

  debug(chalkLog("NNT | NETWORK CREATE MODE: " + config.networkCreateMode));

  sortedHashmap({ sortKey: "networkObj.overallMatchRate", hashmap: bestNetworkHashMap, max: 500})
  .then(function(sortedBestNetworks){

    if (configuration.verbose) {
      console.log(chalkLog("\nNNT | BEST NETWORKS\nNNT | --------------------------------------------------------"));
      console.log(chalkInfo("NNT | NNs IN HM: " + sortedBestNetworks.sortedKeys.length));

      sortedBestNetworks.sortedKeys.forEach(function(nnId){
        console.log(chalkLog("NNT"
          + " | MR: " + bestNetworkHashMap.get(nnId).networkObj.matchRate.toFixed(2)
          + " | SR: " + bestNetworkHashMap.get(nnId).networkObj.successRate.toFixed(2)
          + " | " + bestNetworkHashMap.get(nnId).networkObj.numInputs
          + " | " + bestNetworkHashMap.get(nnId).networkObj.inputsId
          + " | " + nnId
        ));
      });
    }

    console.log(chalkLog("NNT | --------------------------------------------------------"));
  })
  .catch(function(err){
    console.trace(chalkError("generateRandomEvolveConfig SORTER ERROR: " + err));
  });

  //
  // if available use better child as seed nn
  //
  if (betterChildSeedNetworkIdSet.size > 0) {

    config.seedNetworkId = betterChildSeedNetworkIdSet.keys().next().value;
    config.isBetterChildSeed = true;

    betterChildSeedNetworkIdSet.delete(config.seedNetworkId);

    console.log(chalkAlert("NNT | USING BETTER CHILD SEED"
      + " [" + betterChildSeedNetworkIdSet.size + "] SEED: " + config.seedNetworkId
    ));
  }
  else {
    config.seedNetworkId = (Math.random() <= cnf.seedNetworkProbability) ? randomItem(bestNetworkHashMap.keys()) : false;
    config.isBetterChildSeed = false;
  }
  
  // seedInputsId only used if seedNetworkId == false

  const inputsHashMapKeys = inputsHashMap.keys();

  debug(chalkLog("NNT | inputsHashMapKeys: " + inputsHashMapKeys));

  config.seedInputsId = randomItem(inputsHashMapKeys);

  config.iterations = cnf.evolve.iterations;
  config.threads = cnf.evolve.threads;
  config.log = cnf.evolve.log;
  config.mutation = DEFAULT_EVOLVE_MUTATION;

  config.cost = randomItem(cnf.costArray);
  config.clear = randomItem([true, false]);
  config.equal = true;
  config.error = cnf.evolve.error;
  config.mutationRate = randomFloat(EVOLVE_MUTATION_RATE_RANGE.min, EVOLVE_MUTATION_RATE_RANGE.max);
  config.popsize = randomInt(EVOLVE_POP_SIZE_RANGE.min, EVOLVE_POP_SIZE_RANGE.max);
  config.growth = randomFloat(EVOLVE_GROWTH_RANGE.min, EVOLVE_GROWTH_RANGE.max);
  config.elitism = randomInt(EVOLVE_ELITISM_RANGE.min, EVOLVE_ELITISM_RANGE.max);

  if (cnf.enableSeedNetwork && config.seedNetworkId && bestNetworkHashMap.has(config.seedNetworkId)) {

    console.log("NNT | SEED NETWORK | " + config.seedNetworkId);

    // bestNetworkHashMap entry --> bnhmObj = { entry: entry, networkObj: networkObj }
    const networkObj = bestNetworkHashMap.get(config.seedNetworkId).networkObj;

    config.networkObj = deepcopy(networkObj);

    config.architecture = "loadedNetwork";
    config.inputsId = networkObj.inputsId;
    config.inputsObj = {};
    // config.inputsObj = inputsHashMap.get(networkObj.inputsId).inputsObj;
    config.inputsObj = networkObj.inputsObj;
    console.log("NNT | SEED INPUTS | " + networkObj.inputsId);

    if (cnf.randomizeSeedOptions) {
      console.log(chalkInfo("NNT | RANDOMIZE SEED NETWORK OPTIONS | " + config.seedNetworkId));
      config.cost = randomItem([config.cost, networkObj.evolve.options.cost]);
      config.equal = randomItem([config.equal, networkObj.evolve.options.equal]);
      config.error = randomItem([config.error, networkObj.evolve.options.error]);
      config.mutationRate = randomItem([config.mutationRate, networkObj.evolve.options.mutationRate]);
      config.popsize = randomItem([config.popsize, networkObj.evolve.options.popsize]);
      config.growth = randomItem([config.growth, networkObj.evolve.options.growth]);
      config.elitism = randomItem([config.elitism, networkObj.evolve.options.elitism]);
    }
    else {
      console.log(chalkLog("NNT | USE SEED NETWORK OPTIONS | " + config.seedNetworkId));
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
      debug("NNT | RANDOM ARCH | SEED INPUTS: " + config.seedInputsId);
    }
    else {
      console.log("NNT *** ERROR *** | RANDOM ARCH | seedInputsId " + config.seedInputsId + " NOT IN inputsHashMap");
      return(callback(config.seedInputsId + " NOT IN inputsHashMap", null));
    }
  }

  let tObj = {};

  if (!cnf.createTrainingSet && !cnf.createTrainingSetOnly && cnf.loadTrainingSetFromFile && trainingSetReady) {

    console.log(chalkLog("NNT | LOAD GLOBAL TRAINING SET FROM HASHMAP: " + cnf.globalTrainingSetId));

    if (!trainingSetHashMap.has(cnf.globalTrainingSetId)) {
      console.log(chalkError("NNT | *** TRAINING SET NOT IN HASHMAP: " + cnf.globalTrainingSetId));
      return callback("TRAINING SET NOT IN HASHMAP: " + cnf.globalTrainingSetId, null);
    }

    tObj = trainingSetHashMap.get(cnf.globalTrainingSetId);

    console.log(chalkInfo("NNT | USING TRAINING SET: " + tObj.trainingSetObj.trainingSetId));

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

    callback(null, config);
  }
  else { // createTrainingSetOnly create training set

    console.log(chalkInfo("NNT | ... START CREATE TRAINING SET"));

    generateGlobalTrainingTestSet(trainingSetUsersHashMap, userMaxInputHashMap, function(err){

      if (err) {
        return(callback(err, null));
      }

      tObj = trainingSetHashMap.get(cnf.globalTrainingSetId);

      console.log(chalkInfo("NNT | USING TRAINING SET " + cnf.globalTrainingSetId));

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

      console.log(chalkLog("NNT | TRAINING SET META\n" + jsonPrint(tObj.trainingSetObj.trainingSet.meta)));

      callback(null, config);

    });
  }
}

function initNetworkCreate(nnChildId, nnId, callback){

  debug(chalkLog("NNT | INIT NETWORK CREATE | NNC ID: " + nnId));

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

  generateRandomEvolveConfig(configuration, function(err, childConf){

    if (err) {
      console.log(chalkError("generateRandomEvolveConfig ERROR\n" + jsonPrint(err)));
      return(callback(err, childConf));
    }

    switch (configuration.networkCreateMode) {

      case "evolve":

        messageObj = {};
        messageObj.op = "EVOLVE";
        messageObj.testRunId = nnId;
        messageObj.inputsId = childConf.inputsId;
        messageObj.inputsObj = {};
        messageObj.inputsObj = childConf.inputsObj;
        messageObj.outputs = {};
        messageObj.outputs = ["left", "neutral", "right"];
        messageObj.trainingSet = {};
        messageObj.trainingSet = childConf.trainingSet;
        messageObj.testSet = {};
        messageObj.testSet = childConf.testSet;
        messageObj.normalization = {};
        messageObj.normalization = statsObj.normalization;

        messageObj.architecture = childConf.architecture;
        messageObj.isBetterChildSeed = childConf.isBetterChildSeed;
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

        statsObj.evolve[nnId].options = omit(messageObj, ["network", "trainingSet", "testSet", "inputs", "outputs"]);

        if (messageObj.networkObj && (messageObj.networkObj !== undefined)) {
          messageObj.seedNetworkId = messageObj.networkObj.networkId;
          messageObj.seedNetworkRes = messageObj.networkObj.successRate;
          statsObj.evolve[nnId].options.networkObj = {};
          statsObj.evolve[nnId].options.networkObj = pick(messageObj, ["networkId", "successRate", "inputsId"]);
        }

        console.log(chalkBlue("\nNNT | START NETWORK EVOLVE"));

        console.log(chalkBlue("NNT | TEST RUN ID: " + statsObj.tests[testObj.testRunId][nnId].testRunId
          + "\nNNT | ARCHITECTURE:        " + messageObj.architecture
          + "\nNNT | COST:                " + messageObj.cost
          + "\nNNT | TRAINING SET LENGTH: " + messageObj.trainingSet.meta.setSize
          + "\nNNT | TEST SET LENGTH:     " + messageObj.testSet.data.length
          + "\nNNT | INPUTS ID:           " + messageObj.inputsId
          + "\nNNT | INPUTS:              " + messageObj.inputsObj.meta.numInputs
          + "\nNNT | OUTPUTS:             " + messageObj.trainingSet.meta.numOutputs
          + "\nNNT | ITERATIONS:          " + messageObj.iterations
        ));

        if (messageObj.seedNetworkId !== undefined) {
          console.log(chalkBlue("NNT | SEED:                " + messageObj.seedNetworkId 
            + " | SR: " + messageObj.seedNetworkRes.toFixed(2) + "%"
          ));
          console.log(chalkBlue("NNT | BETTER CHILD SEED:   " + messageObj.isBetterChildSeed));
        }
        else {
          console.log(chalkBlue("NNT | SEED:                ----"));
        }

        neuralNetworkChildHashMap[nnChildId].child.send(messageObj, function(err){
          if (err) {
            console.log(chalkError("NNT | *** NEURAL NETWORK CHILD SEND ERROR: " + err));
            return callback(err, messageObj);
          }

          networkCreateResultsHashmap[messageObj.testRunId] = {};

          let networkCreateObj = {};
          networkCreateObj.nnChildId = nnChildId;
          networkCreateObj.status = "EVOLVE";
          networkCreateObj.successRate = 0;
          networkCreateObj.matchRate = 0;
          networkCreateObj.overallMatchRate = 0;
          networkCreateObj.networkId = messageObj.testRunId;
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

          networkCreateResultsHashmap[messageObj.testRunId] = networkCreateObj;

          printNetworkCreateResultsHashmap();

          callback(err, null);

        });
      break;

      default:
        console.log(chalkError("NNT | UNKNOWN NETWORK CREATE MODE: " + configuration.networkCreateMode));
        callback("NNT | UNKNOWN NETWORK CREATE MODE: " + configuration.networkCreateMode, null);
    }

  });
}

function allComplete(){

  getChildProcesses(function(err, childArray){

    if (childArray.length === 0 ) { 
      allCompleteFlag = true;
      console.log(chalkBlue("NNT | allComplete | NO NN CHILDREN"));
      return;
    }

    if (Object.keys(neuralNetworkChildHashMap).length === 0 ) { 
      allCompleteFlag = true;
      console.log(chalkBlue("NNT | allComplete | NO NN CHILDREN"));
      return;
    }

    let index = 0;

    async.each(Object.keys(neuralNetworkChildHashMap), function(nnChildId, cb){

      console.log(chalkLog("NNT | allComplete"
        + " | NNC " + nnChildId 
        + " STATUS: " + neuralNetworkChildHashMap[nnChildId].status
      ));

      if (neuralNetworkChildHashMap[nnChildId].status === "RUNNING"){
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

function initMain(cnf, callback){

  const acf = allComplete();

  // initMainReady = false;

  showStats();

  console.log(chalkBlue("NNT | ***===*** INIT MAIN ***===***"
    + " | " + getTimeStamp()
    + " | ALL COMPLETE: " + allCompleteFlag
    + " | INTERVAL: " + msToTime(cnf.initMainIntervalTime)
  ));

  if (runOnceFlag && configuration.quitOnComplete && allCompleteFlag) {
    // initMainReady = true;
    quit("QUIT ON COMPLETE");
    return callback(null, null);
  }

  loadInputsDropboxFolder(defaultInputsFolder, function(err1, results){

    if (err1) {
      console.log(chalkError("NNT | ERROR LOADING DROPBOX INPUTS FOLDER | " + defaultInputsFolder + " | " + err1));
      // initMainReady = true;
      return(callback(err1, null));
    }

    let seedParams = {};
    seedParams.purgeMin = false ;  // use localPurgeMinSuccessRate to delete nn's
    seedParams.folders = [globalBestNetworkFolder, localBestNetworkFolder];

    if (cnf.seedNetworkId) {
      seedParams.networkId = cnf.seedNetworkId;
    }

    loadSeedNeuralNetwork(seedParams, function(err0, results){
      if (err0) {
        console.log(chalkError("*** ERROR loadSeedNeuralNetwork"));
        // initMainReady = true;
        return (callback(err0, null));
      }

      initCategorizedUserHashmap(function(err){

        if (err) {
          console.error(chalkError("NNT | *** ERROR: CATEGORIZED USER HASHMAP NOT INITIALIZED: ", err));
          // initMainReady = true;
          return (callback(err, null));
        }

        console.log(chalkInfo("NNT | LOADED " + categorizedUserHashmap.size + " TOTAL CATEGORIZED USERS"));

        if (cnf.loadTrainingSetFromFile) {

          let folder;

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
              // initMainReady = true;
              createTrainingSetBusy = false;
              trainingSetReady = false;
              return(callback(err, null));
            }

            // initMainReady = true;
            createTrainingSetBusy = false;
            trainingSetReady = true;
            runOnceFlag = true;

            callback(null, null);

          });
        }
        else {

          createTrainingSetBusy = true;
          trainingSetReady = false;

          updateCategorizedUsers(cnf, function(err){

            if (err) {
              console.error("NNT | *** UPDATE CATEGORIZED USER ERROR ***\n" + jsonPrint(err));
              // initMainReady = true;
              return(callback(err, null));
            }

            console.log(chalkInfo("NNT | ... START CREATE TRAINING SET"));

            generateGlobalTrainingTestSet(trainingSetUsersHashMap, userMaxInputHashMap, function(err){

              if (err) {
                // initMainReady = true;
                trainingSetReady = true;
                createTrainingSetBusy = false;
                return(callback(err, null));
              }

              statsObj.categorizedUserHistogram = {};
              statsObj.categorizedUserHistogram = categorizedUserHistogram;

              categorizedUserHistogram.left = 0;
              categorizedUserHistogram.right = 0;
              categorizedUserHistogram.neutral = 0;
              categorizedUserHistogram.positive = 0;
              categorizedUserHistogram.negative = 0;
              categorizedUserHistogram.none = 0;

              trainingSetReady = true;
              createTrainingSetBusy = false;
              // initMainReady = true;
              runOnceFlag = true;

              callback(null, null);
            });
          });
        }
      });
    });

  });
}

function printNeuralNetworkChildHashMap(){

  const nnChildIdArray = Object.keys(neuralNetworkChildHashMap).sort();

  let chalkValue = chalkLog;

  async.eachSeries(nnChildIdArray, function(nnChildId, cb){

    switch (neuralNetworkChildHashMap[nnChildId].status) {
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
        console.log(chalkWarn("??? UNKNOWN CHILD STATUS: " + neuralNetworkChildHashMap[nnChildId].status));
        chalkValue = chalkInfo;
    }
    console.log(chalkValue("NNT"
      + " | " + nnChildId
      + " | PID: " + neuralNetworkChildHashMap[nnChildId].pid
      + " | STATUS: " + neuralNetworkChildHashMap[nnChildId].status
    ));
    cb();
  }, function(){

  });
}

function initNeuralNetworkChild(nnChildIndex, cnf, callback){

  let nnChildId = NN_CHILD_PREFIX + nnChildIndex;

  console.log(chalkBlue("NNT | +++ NEW NEURAL NETWORK CHILD | NNC ID: " + nnChildId));

  if ((neuralNetworkChildHashMap[nnChildId] !== undefined) && (neuralNetworkChildHashMap[nnChildId].status !== "NEW")) {
    console.log(chalkError("!!! ERROR initNeuralNetworkChild: NN CHILD EXISTS !!! | NNC ID: " + nnChildId
      + "\n" + jsonPrint(neuralNetworkChildHashMap[nnChildId])
    ));
    return(callback("NN CHILD EXISTS", nnChildId));
  }

  let childEnv = {};

  childEnv.env = {};
  childEnv.env = configuration.DROPBOX;
  childEnv.env.DROPBOX_NNC_STATS_FILE = statsObj.runId + "_" + nnChildId + ".json";
  childEnv.env.NNC_CHILD_ID = nnChildId;
  childEnv.env.NODE_ENV = "production";

  neuralNetworkChildHashMap[nnChildId] = {};
  neuralNetworkChildHashMap[nnChildId].status = "NEW";

  neuralNetworkChildHashMap[nnChildId].child = cp.fork("neuralNetworkChild.js", childEnv );
  neuralNetworkChildHashMap[nnChildId].pid = neuralNetworkChildHashMap[nnChildId].child.pid;


  neuralNetworkChildHashMap[nnChildId].child.on("message", function(m){

    debug(chalkAlert("neuralNetworkChild RX"
      + " | " + m.op
    ));

    if (m.error) {
      console.error(chalkError("NNT | neuralNetworkChild RX ERROR"
        + " | PID: " + neuralNetworkChildHashMap[nnChildId].pid
        + " | STATUS: " + neuralNetworkChildHashMap[nnChildId].status
        + "\n" + jsonPrint(m)
      ));
      neuralNetworkChildHashMap[m.nnChildId].status = "ERROR";
      neuralNetworkChildHashMap[m.nnChildId].error = {};
      neuralNetworkChildHashMap[m.nnChildId].error = m.error;
      return;
    }

    let snIdRes = "---";

    let newNeuralNetwork;

    switch(m.op) {

      case "INIT_COMPLETE":
        console.log(chalkInfo("NNT | TEST NEURAL NETWORK | " + m.nnChildId));
        neuralNetworkChildHashMap[m.nnChildId].child.send({op: "TEST_EVOLVE"});
      break;

      case "READY":
        console.log(chalkLog("NNT | INIT NEURAL NETWORK | " + m.nnChildId));
        neuralNetworkChildHashMap[m.nnChildId].child.send({op: "INIT", testRunId: testObj.testRunId});
      break;

      case "STATS":
        console.log("NNT | STATS | " 
          + " | " + m.nnChildId
          + getTimeStamp() + " ___________________________\n" 
          + jsonPrint(statsObj, "NNC | STATS "
        ));
        console.log("NNT | STATS___________________________\n");
      break;

      case "TEST_EVOLVE_COMPLETE":
        if (m.results) {
          console.log(chalkLog("NNT"
            + " | " + m.nnChildId
            + " | TEST EVOLVE XOR PASS"
          ));

          if (neuralNetworkChildHashMap[m.nnChildId] !== undefined) { 
            neuralNetworkChildHashMap[m.nnChildId].status = "TEST PASS"; 
          }
        }
        else {
          console.error(chalkError("NNT | *** TEST EVOLVE XOR FAILED *** | " + m.nnChildId));
          console.log(chalkInfo("NNT | *** RETRY *** TEST NEURAL NETWORK | " + m.nnChildId));
          neuralNetworkChildHashMap[m.nnChildId].child.send({op: "TEST_EVOLVE"});
        }
      break;

      case "EVOLVE_COMPLETE":

        statsObj.evolveStats.total += 1;

        snIdRes = (m.networkObj.seedNetworkId !== undefined) ? m.networkObj.seedNetworkRes.toFixed(2) : "---";

        console.log(chalkBlue(
            "\nNNT ========================================================\n"
          +   "NNT | NETWORK EVOLVE + TEST COMPLETE"
          + "\nNNT |             " + m.nnChildId
          + "\nNNT | NID:        " + m.networkObj.networkId
          + "\nNNT | SEED:       " + m.networkObj.seedNetworkId
          + "\nNNT | SEED RES%:  " + snIdRes
          + "\nNNT | ELAPSED:    " + msToTime(m.networkObj.evolve.elapsed)
          + "\nNNT | ITERTNS:    " + m.statsObj.evolve.results.iterations
          + "\nNNT | ERROR:      " + m.statsObj.evolve.results.error
          + "\nNNT | INPUTS ID:  " + m.networkObj.inputsId
          + "\nNNT | INPUTS:     " + m.networkObj.network.input
          + "\nNNT | OUTPUTS:    " + m.networkObj.network.output
          + "\nNNT | DROPOUT:    " + m.networkObj.network.dropout
          + "\nNNT | NODES:      " + m.networkObj.network.nodes.length
          + "\nNNT | CONNS:      " + m.networkObj.network.connections.length
        ));


        networkCreateResultsHashmap[m.networkObj.networkId] = {};
        networkCreateResultsHashmap[m.networkObj.networkId] = omit(m.networkObj, ["network", "inputs", "outputs"]);
        networkCreateResultsHashmap[m.networkObj.networkId].status = "COMPLETE";

        newNeuralNetwork = new NeuralNetwork(m.networkObj);
        newNeuralNetwork.markModified("overallMatchRate");

        newNeuralNetwork
        .save()
        .catch(function(err){
          console.log(chalkError("NNT | *** ERROR SAVE NN TO DB" 
            + " | NID: " + m.networkObj.networkId
            + " | " + err.message
          ));
        });


        printNetworkCreateResultsHashmap();

        if (neuralNetworkChildHashMap[m.nnChildId] === undefined) {
          console.log(chalkError("??? CHILD NOT IN neuralNetworkChildHashMap ??? | CHILD ID: "+ m.nnChildId));
          neuralNetworkChildHashMap[m.nnChildId] = {};
          neuralNetworkChildHashMap[m.nnChildId].status = "IDLE";
        }
        else {
          if (configuration.quitOnComplete) {
            neuralNetworkChildHashMap[m.nnChildId].status = "COMPLETE";
          }
          else {
            neuralNetworkChildHashMap[m.nnChildId].status = "IDLE";
          }
        }

        if (m.statsObj.evolve.results.iterations < m.networkObj.evolve.options.iterations) {
          console.log(chalkError("NNT | XXX | NOT SAVING NN FILE TO DROPBOX ... EARLY COMPLETE?"
            + " | " + m.networkObj.networkId
            + " | ITRNS: " + m.statsObj.evolve.results.iterations
            + " | MIN: " + cnf.globalMinSuccessRate.toFixed(2) + "%"
            + " | " + m.networkObj.successRate.toFixed(2) + "%"
          ));

          printNetworkObj("NNT | " + m.networkObj.networkId, m.networkObj);
        }
        else if (
          (m.networkObj.seedNetworkId && (m.networkObj.test.results.successRate > m.networkObj.seedNetworkRes)) // better than seed nn
          || ((m.networkObj.seedNetworkId === undefined) && ((m.networkObj.test.results.successRate >= cnf.localMinSuccessRate) // no seed but better than local min
          || (m.networkObj.test.results.successRate >= cnf.globalMinSuccessRate))) // better than global min
          ) { 

          // It's a Keeper!!

          bestNetworkFile = m.networkObj.networkId + ".json";

          if (m.networkObj.successRate === undefined) { m.networkObj.successRate = m.networkObj.test.results.successRate; }
          if (m.networkObj.matchRate === undefined) { m.networkObj.matchRate = 0; }
          if (m.networkObj.overallMatchRate === undefined) { m.networkObj.overallMatchRate = 0; }

          bestNetworkHashMap.set(
            m.networkObj.networkId, 
            { 
              entry: {
                client_modified: moment(),
                name: bestNetworkFile,
                content_hash: false
              }, 
              networkObj: m.networkObj
            }
          );

          // Add to nn child better than parent array
          if (m.networkObj.seedNetworkId && (m.networkObj.test.results.successRate > m.networkObj.seedNetworkRes)) {

            betterChildSeedNetworkIdSet.add(m.networkObj.networkId);

            m.networkObj.betterChild = true;
            neuralNetworkChildHashMap[m.nnChildId].betterChild = true;

            console.log(chalkAlert("NNT | +++ BETTER CHILD"
              + " [" + betterChildSeedNetworkIdSet.size + "] " + m.networkObj.networkId
              + " | SR: " + m.networkObj.test.results.successRate.toFixed(3) + "%"
              + " | SEED: " + m.networkObj.networkId
              + " | SR: " + m.networkObj.seedNetworkRes.toFixed(3) + "%"
            ));
          }
          else {
            neuralNetworkChildHashMap[m.nnChildId].betterChild = false;
          }

          if (inputsNetworksHashMap[m.networkObj.inputsId] === undefined) {
            inputsNetworksHashMap[m.networkObj.inputsId] = new Set();
          }

          inputsNetworksHashMap[m.networkObj.inputsId].add(m.networkObj.networkId);

          console.log(chalkInfo("NNT | INPUTS ID"
            + " | " + m.networkObj.inputsId
            + " | INPUTS: " + m.networkObj.inputsObj.meta.numInputs
            + " | " + inputsNetworksHashMap[m.networkObj.inputsId].size + " NETWORKS"
          ));

          if (m.networkObj.test.results.successRate >= cnf.globalMinSuccessRate) {

            console.log(chalkInfo("NNT | ### SAVING NN FILE TO DROPBOX GLOBAL BEST"
              + " | " + globalBestNetworkFolder + "/" + bestNetworkFile
            ));

            networkCreateResultsHashmap[m.networkObj.networkId].status = "PASS GLOBAL";

            statsObj.evolveStats.passGlobal += 1;

            slackText = "\n*GLOBAL BEST: " + m.networkObj.test.results.successRate.toFixed(2) + "*";
            slackText = slackText + "\n" + m.networkObj.networkId;
            slackText = slackText + "\nIN: " + m.networkObj.inputsId;
            slackText = slackText + "\nINPUTS: " + m.networkObj.network.input;

            slackPostMessage(slackChannel, slackText);

            saveFileQueue.push({localFlag: false, folder: globalBestNetworkFolder, file: bestNetworkFile, obj: m.networkObj});
          }
          else if (m.networkObj.test.results.successRate >= cnf.localMinSuccessRate) {

            localNetworkFile = m.networkObj.networkId + ".json";

            console.log(chalkInfo("NNT | ... SAVING NN FILE TO DROPBOX LOCAL BEST"
              + " | " + localBestNetworkFolder + "/" + localNetworkFile
            ));

            networkCreateResultsHashmap[m.networkObj.networkId].status = "PASS LOCAL";

            statsObj.evolveStats.passLocal += 1;

            slackText = "\n*LOCAL BEST: " + m.networkObj.test.results.successRate.toFixed(2) + "*";
            slackText = slackText + "\n" + m.networkObj.networkId;
            slackText = slackText + "\nIN: " + m.networkObj.inputsId;
            slackText = slackText + "\nINPUTS: " + m.networkObj.network.input;

            slackPostMessage(slackChannel, slackText);

            saveFileQueue.push({localFlag: false, folder: localBestNetworkFolder, file: localNetworkFile, obj: m.networkObj});
          }

          printNetworkObj("NNT | " + m.networkObj.networkId, m.networkObj);
        }
        else {
          console.log(chalkInfo("NNT | XXX | NOT SAVING NN GLOBAL DROPBOX ... LESS THAN GLOBAL MIN SUCCESS *OR* NOT BETTER THAN SEED"
            + " | " + m.networkObj.networkId
            + " | " + m.networkObj.successRate.toFixed(2) + "%"
            + " | " + cnf.globalMinSuccessRate.toFixed(2) + "%"
          ));

          networkCreateResultsHashmap[m.networkObj.networkId].status = "FAIL";

          slackText = "\n*-FAIL-: " + m.networkObj.test.results.successRate.toFixed(2) + "*";
          slackText = slackText + "\n" + m.networkObj.networkId;
          slackText = slackText + "\nIN: " + m.networkObj.inputsId;
          slackText = slackText + "\nINPUTS: " + m.networkObj.network.input;

          slackPostMessage(slackChannel, slackText);

          statsObj.evolveStats.fail += 1;

          printNetworkObj("NNT | " + m.networkObj.networkId, m.networkObj);
        }

       break;

      default:
      console.error(chalkError("NNT | neuralNetworkChild | UNKNOWN OP: " + m.op));
    }
  });

  neuralNetworkChildHashMap[nnChildId].child.on("error", function(err){
    if (neuralNetworkChildHashMap[nnChildId] !== undefined) {
      neuralNetworkChildHashMap[nnChildId].status = "ERROR";
      console.log(chalkError("*** neuralNetworkChildHashMap | PID: " + neuralNetworkChildHashMap[nnChildId].pid 
        + " | " + nnChildId + " ERROR *** : " + err
      ));
    }

    printNeuralNetworkChildHashMap();
  });

  neuralNetworkChildHashMap[nnChildId].child.on("exit", function(err){
    if (neuralNetworkChildHashMap[nnChildId] !== undefined) {
      neuralNetworkChildHashMap[nnChildId].status = "EXIT";
      console.log(chalkError("*** neuralNetworkChildHashMap | PID: " + neuralNetworkChildHashMap[nnChildId].pid 
        + " | " + nnChildId + " EXIT *** : " + err
      ));
    }

    printNeuralNetworkChildHashMap();
  });

  neuralNetworkChildHashMap[nnChildId].child.on("close", function(code){
    // stdio of child closed. why???  
    if (neuralNetworkChildHashMap[nnChildId] !== undefined) {
      neuralNetworkChildHashMap[nnChildId].status = "CLOSE";
      console.log(chalkError("*** neuralNetworkChildHashMap | PID: " + neuralNetworkChildHashMap[nnChildId].pid 
        + " | " + nnChildId + " CLOSE *** : CODE: " + code
      ));
    }


    printNeuralNetworkChildHashMap();
  });

  neuralNetworkChildHashMap[nnChildId].status = "IDLE";

  getChildProcesses(function(err, childArray){

    slackText = "\n*NNT | INIT CHILD*";
    slackText = slackText + "\n" + hostname;
    slackText = slackText + "\n" + nnChildId;
    slackText = slackText + "\n" + statsObj.numChildren + " CHILDREN";

    slackPostMessage(slackChannel, slackText);

    if (callback !== undefined) { callback(null, nnChildId); }
  });
}

function initNetworkCreateInterval(interval) {

  console.log(chalkLog("NNT | INIT NETWORK CREATE INTERVAL | " + interval + " MS"));

  clearInterval(networkCreateInterval);

  networkCreateInterval = setInterval(function(){

    if (initMainReady) {
      getChildProcesses(function(err, childArray){

        if (err) {
          console.log(chalkError("NNT | *** getChildProcesses ERROR: " + err));
        }

        // console.log(chalkLog("NNT | INIT MAIN INTERVAL | FOUND " + statsObj.numChildren + " CHILDREN PROCESSES"));

        if (enableCreateChildren && (statsObj.numChildren < configuration.maxNeuralNetworkChildern)) {

          console.log(chalkAlert("NNT | +++ CREATING NNC"
            + " | CURRENT NUM NNC: " + Object.keys(neuralNetworkChildHashMap).length
            + " | MAX NUM NNC: " + configuration.maxNeuralNetworkChildern
          ));

          initNeuralNetworkChild(nnChildIndex, configuration, function(err, nnChildId) {
            if (err) {
            }
            nnChildIndex += 1;
          });
        }
        else if (statsObj.numChildren > configuration.maxNeuralNetworkChildern) {

          console.log(chalkAlert("NNT | XXX DELETING NNC"
            + " | CURRENT NUM NNC: " + childArray.length
            + " | MAX NUM NNC: " + configuration.maxNeuralNetworkChildern
          ));

          async.forEach(childArray, function(childObj, cb){

            if (neuralNetworkChildHashMap[childObj.nnChildId] === undefined) {

              neuralNetworkChildHashMap[childObj.nnChildId] = {};

              killChild({childPid: childObj.pid}, function(err, numKilled){

                if (err) {
                  return cb(err);
                }

                neuralNetworkChildHashMap[childObj.nnChildId].status = "DEAD";

                console.log(chalkAlert("KILLED"
                  + " | PID: " + childObj.pid 
                  + " | NNCID: " + childObj.nnChildId 
                ));

                networkCreateResultsHashmap[childObj.nnChildId].status = "DEAD CHILD";

                slackText = "\n*NNT | DEAD CHILD*";
                slackText = slackText + "\n" + hostname;
                slackText = slackText + "\n" + childObj.nnChildId;
                slackText = slackText + "\nCH IN HM: " + statsObj.numChildren;

                slackPostMessage(slackChannel, slackText);

                cb();
              });
            }
            else {

              if (
                     (neuralNetworkChildHashMap[childObj.nnChildId].status === "ERROR")
                  || (neuralNetworkChildHashMap[childObj.nnChildId].status === "CLOSE")
                  || (neuralNetworkChildHashMap[childObj.nnChildId].status === "TEST COMPLETE")
                  || (neuralNetworkChildHashMap[childObj.nnChildId].status === "IDLE")
                  || (neuralNetworkChildHashMap[childObj.nnChildId].status === "ZOMBIE")
              ) {

                console.log(chalkAlert("NNT | XXX DELETING NNC"
                  + " | " + childObj.nnChildId
                  + " | CHILD STATUS: " + neuralNetworkChildHashMap[childObj.nnChildId].status
                  + " | CURRENT NUM NNC: " + childArray.length
                  + " | MAX NUM NNC: " + configuration.maxNeuralNetworkChildern
                ));

                killChild({nnChildId: childObj.nnChildId}, function(err, numKilled){

                  if (err) {
                    return cb(err);
                  }

                  neuralNetworkChildHashMap[childObj.nnChildId].status = "DEAD";

                  console.log(chalkAlert("NNT | XXX KILLED"
                    + " | PID: " + childObj.pid 
                    + " | NNCID: " + childObj.nnChildId 
                    + " | CHILD STATUS: " + neuralNetworkChildHashMap[childObj.nnChildId].status
                  ));

                  cb();

                });
              }
            }

          }, function(err){

          });

        }
        else {
          Object.keys(neuralNetworkChildHashMap).forEach(function(nnChildId){

            const currentChild = neuralNetworkChildHashMap[nnChildId];

            let nnId = "";

            switch (currentChild.status) {

              case "IDLE":

                nnId = testObj.testRunId + "_" + nnChildId + "_" + networkIndex;
                networkIndex += 1;

                currentChild.status = "RUNNING" ;
                neuralNetworkChildHashMap[nnChildId] = currentChild;

                initNetworkCreate(nnChildId, nnId, function(err, results){

                  debug("initNetworkCreate results\n" + jsonPrint(results));

                  if (err) {
                    console.log("NNT | *** INIT NETWORK CREATE ERROR ***\n" + jsonPrint(err));
                    currentChild.status = "ERROR" ;
                    neuralNetworkChildHashMap[nnChildId] = currentChild;
                  }
                  else if (currentChild !== undefined) {
                    currentChild.status = "RUNNING" ;
                    neuralNetworkChildHashMap[nnChildId] = currentChild;
                    console.log(chalkInfo("NNT | NETWORK CREATED | " + nnId));
                  }
                  else {
                    console.log(chalkAlert("NNT | ??? NETWORK NOT CREATED ??? | NN CHID: " + nnChildId + " | NNID: " + nnId));
                    currentChild.status = "UNKNOWN" ;
                    neuralNetworkChildHashMap[nnChildId] = currentChild;
                  }

                });

              break;

              case "TEST COMPLETE":
              case "COMPLETE":
                if (!configuration.quitOnComplete) {
                  currentChild.status = "IDLE" ;
                }
              break;

              case "TEST PASS":
                console.log(chalkGreen("NNT | +++ NNC XOR TEST PASS | " + nnChildId));
                currentChild.status = "IDLE" ;
                neuralNetworkChildHashMap[nnChildId] = currentChild;
              break;

              case "EXIT":
                console.log(chalkAlert("NNT | *** NNC EXIT | " + nnChildId));
                killChild({nnChildId: nnChildId});
              break;

              case "CLOSE":
                console.log(chalkAlert("NNT | *** NNC CLOSE | " + nnChildId));
                killChild({nnChildId: nnChildId});
              break;

              case "ERROR":
                console.log(chalkAlert("NNT | *** NNC ERROR | " + nnChildId));
                killChild({nnChildId: nnChildId});
              break;

              case "ZOMBIE":
                console.log(chalkAlert("NNT | *** NNC ZOMBIE | " + nnChildId));
                killChild({nnChildId: nnChildId});
              break;

              case "RUNNING":
                debug(chalkAlert("NNT | ... NNC RUNNING ..."
                  + " | CURRENT NUM NNC: " + Object.keys(neuralNetworkChildHashMap).length
                  + " | MAX NUM NNC: " + configuration.maxNeuralNetworkChildern
                ));
              break;

              case "UNKNOWN":
                console.log(chalkAlert("NNT | *** NNC UNKNOWN STATE | " + nnChildId));
                killChild({nnChildId: nnChildId});
              break;

              default:
                console.log(chalkAlert("NNT | ??? UNKNOWN NNC STATUS"
                  + " | " + nnChildId
                  + " | STATUS: " + currentChild.status
                ));
                killChild({nnChildId: nnChildId});
            }

          });
        }
      });
    }
    else {
      getChildProcesses();
    }

  }, interval);
}

function initTimeout(callback){

  console.log(chalkLog("NNT | SET INIT TIMEOUT | " + moment().format(compactDateTimeFormat) + "\n"));

  configEvents.emit("INIT_MONGODB");

  initialize(configuration, function(err0, cnf){

    if (err0 && (err0.status !== 404)) {
      console.error(chalkError("NNT | ***** INIT ERROR *****\n" + jsonPrint(err0)));
      quit("INIT ERROR");
    }

    // configuration = deepcopy(cnf);

    if (configuration.enableStdin) {
      initStdIn();
    }

    console.log(chalkBlue("\n\nNNT"
      + " | " + cnf.processName 
      + " STARTED " + getTimeStamp() 
      + "\n" + jsonPrint(configuration)
    ));

    initSocket(function(){

      requiredTrainingSet.forEach(function(nodeId) {
        console.log(chalkLog("NNT | ... REQ TRAINING SET | @" + nodeId));
      });

      let seedParams = {};
      seedParams.purgeMin = ENABLE_INIT_PURGE_LOCAL ;  // use localPurgeMinSuccessRate to delete nn's
      seedParams.folders = [globalBestNetworkFolder, localBestNetworkFolder];

      if (cnf.seedNetworkId) {
        seedParams.networkId = cnf.seedNetworkId;
      }

      if (cnf.createTrainingSetOnly) {
        console.log(chalkAlert("NNT | *** CREATE TRAINING SET ONLY ... SKIP INIT NN CHILD ***"));
        callback();
      }
      else {

        loadSeedNeuralNetwork(seedParams, function(err1, results){

          debug("loadSeedNeuralNetwork results\n" + jsonPrint(results));

          if (err1){
            if (err1.status === 429) {
              console.log(chalkError("loadSeedNeuralNetwork ERROR | TOO MANY WRITES"));
            }
            else {
              console.log(chalkError("loadSeedNeuralNetwork ERROR" + jsonPrint(err1)));
            }
          }

          enableCreateChildren = true;

          console.log(chalkLog("NNT | INIT NN CHILD"));

          async.timesSeries(cnf.maxNeuralNetworkChildern, function initNnChild (n, next) {

            console.log(chalkAlert("INIT NN CHILD NUMBER " + n));

            initNeuralNetworkChild(nnChildIndex, cnf, function(err, nnChild) {
              nnChildIndex += 1;
              next(err, nnChildIndex);
            });

          }, function(err2, children) {

            if (err2){
              console.log(chalkError("INIT NEURAL NETWORK CHILDREN ERROR\n" + jsonPrint(err2)));
              return(callback(err2));
            }

            console.log(chalkLog("END INIT NEURAL NETWORK CHILDREN: " + children.length));
            enableCreateChildren = false;
            callback();
          });

        });
      }

    });

  });
}

slackText = "\n*NNT START | " + hostname + "*";
slackText = slackText + "\n" + getTimeStamp();

slackPostMessage(slackChannel, slackText);

setTimeout(function(){

  initTimeout(function(){

    initMainReady = false;

    initSaveFileQueue(configuration);

    initMain(configuration, function(){

      initMainReady = true;
      enableCreateChildren = true;

        if (!configuration.createTrainingSetOnly) { 
          initNetworkCreateInterval(configuration.networkCreateIntervalTime);
        }

      debug(chalkLog("FIRST INIT MAIN CALLBACK"
        + " | configuration.initMainIntervalTime: " + configuration.initMainIntervalTime
      ));
    });

    initMainInterval = setInterval(function(){

      console.log(chalkBlue("NNT | +++ INIT MAIN INTERVAL"
        + " | INTERVAL: " + msToTime(configuration.initMainIntervalTime)
        + " | ALL COMPLETE: " + allCompleteFlag
        + " | initMainReady: " + initMainReady
        + " | trainingSetReady: " + trainingSetReady
        + " | createTrainingSetBusy: " + createTrainingSetBusy
      ));

      if (initMainReady) {

        initMainReady = false;

        loadAllConfigFiles(function(){
          initMain(configuration, function(){
            debug(chalkLog("INIT MAIN CALLBACK"));
            initMainReady = true;
          });
        });

      }
      else {
        console.log(chalkLog("NNT | ... INIT MAIN INTERVAL | NOT READY"
        ));
      }

    }, configuration.initMainIntervalTime);
  });

}, 5*ONE_SECOND);

