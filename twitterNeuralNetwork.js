/*jslint node: true */
/*jshint sub:true*/
"use strict";

console.log("\n\n=======================================");
console.log("================ TNN ==================");
console.log("=======================================\n\n");

let inputTypes = [
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

inputTypes.sort();

global.dbConnection = false;
let dbConnectionReady = false;

const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;
const ONE_HOUR = 60 * ONE_MINUTE;

const ONE_KILOBYTE = 1024;
const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const DEFAULT_OFFLINE_MODE = false;
const DEFAULT_SERVER_MODE = false;

const DEFAULT_FIND_CAT_USER_CURSOR_LIMIT = 100;
const DEFAULT_CURSOR_BATCH_SIZE = process.env.DEFAULT_CURSOR_BATCH_SIZE || 100;

const DEFAULT_WAIT_UNLOCK_INTERVAL = 15*ONE_SECOND;
const DEFAULT_WAIT_UNLOCK_TIMEOUT = 10*ONE_MINUTE;

const DEFAULT_FILELOCK_RETRIES = 20;
const DEFAULT_FILELOCK_RETRY_WAIT = DEFAULT_WAIT_UNLOCK_INTERVAL;
const DEFAULT_FILELOCK_STALE = 2*DEFAULT_WAIT_UNLOCK_TIMEOUT;
const DEFAULT_FILELOCK_WAIT = DEFAULT_WAIT_UNLOCK_TIMEOUT;

let fileLockOptions = { 
  retries: DEFAULT_FILELOCK_WAIT,
  retryWait: DEFAULT_FILELOCK_RETRY_WAIT,
  stale: DEFAULT_FILELOCK_STALE,
  wait: DEFAULT_FILELOCK_WAIT
};

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

let configuration = {}; // merge of defaultConfiguration & hostConfiguration

let defaultConfiguration = {}; // general configuration for TNN
let hostConfiguration = {}; // host-specific configuration for TNN

configuration.saveTrainingSetDirectory = true;

if (DEFAULT_OFFLINE_MODE) {
  configuration.offlineMode = true;
  console.log(chalkAlert("TNN | DEFAULT_OFFLINE_MODE: " + configuration.offlineMode));
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
  console.log(chalkLog("TNN | DEFAULT_SERVER_MODE: " + configuration.serverMode));
}

console.log(chalkLog("TNN | SERVER MODE: " + configuration.serverMode));


const os = require("os");
const moment = require("moment");
const lockFile = require("lockfile");
const merge = require("deepmerge");
const treeify = require("treeify");
const archiver = require("archiver");
const watch = require("watch");
const unzip = require("unzip");
const fs = require("fs");
const yauzl = require("yauzl");

let archive;
let archiveOutputStream;


let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word/g, "google");

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

const TEST_MODE_LENGTH = 500;
const TEST_DROPBOX_NN_LOAD = 10;

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
const DEFAULT_CREATE_TRAINING_SET_ONLY = false;
const DEFAULT_DISABLE_CREATE_TEST_SET = false;
const DEFAULT_INIT_MAIN_INTERVAL = process.env.TNN_INIT_MAIN_INTERVAL || 10*ONE_MINUTE;

const DROPBOX_LIST_FOLDER_LIMIT = 50;
const DROPBOX_MAX_FILE_UPLOAD = 140 * ONE_MEGABYTE; // bytes

// let socket;
// let socketKeepaliveInterval;

let userReadyInterval;

let localNetworkFile;

let nnChildIndex = 0;
let allCompleteFlag = false;

const bestRuntimeNetworkFileName = "bestRuntimeNetwork.json";

let saveFileQueue = [];

const shell = require("shelljs");
const retry = require("retry");
const JSONParse = require("json-parse-safe");
const arraySlice = require("array-slice");
const util = require("util");
const _ = require("lodash");
const dot = require("dot-object");
const writeJsonFile = require("write-json-file");
const sizeof = require("object-sizeof");
const HashMap = require("hashmap").HashMap;

const fetch = require("isomorphic-fetch"); // or another library of choice.
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


const debug = require("debug")("tnn");
const debugCache = require("debug")("cache");
const debugQ = require("debug")("queue");
const commandLineArgs = require("command-line-args");

const neataptic = require("neataptic");

const twitterTextParser = require("@threeceelabs/twitter-text-parser");
const twitterImageParser = require("@threeceelabs/twitter-image-parser");
const deepcopy = require("deep-copy");
const table = require("text-table");

let prevHostConfigFileModifiedMoment = moment("2010-01-01");
let prevDefaultConfigFileModifiedMoment = moment("2010-01-01");
let prevConfigFileModifiedMoment = moment("2010-01-01");

let waitUnlockedSet = new Set();

let bestNetworkHashMap = new HashMap();
let inputsHashMap = new HashMap();
let trainingSetUsersHashMap = new HashMap();

let inputsNetworksHashMap = {};

let currentBestNetwork;
let networkCreateResultsHashmap = {};


let betterChildSeedNetworkIdSet = new Set();

let statsObj = {};
let statsObjSmall = {};

statsObj.status = "LOAD";
statsObj.hostname = hostname;
statsObj.pid = process.pid;
statsObj.cpus = os.cpus().length;
statsObj.commandLineArgsLoaded = false;

statsObj.lockFileNameSet = new Set();

statsObj.archiveOpen = false;
statsObj.archiveModifiedMoment = moment("2010-01-01");
statsObj.loadUsersArchiveBusy = false;

statsObj.serverConnected = false;
statsObj.userReadyAck = false;
statsObj.userReadyAckWait = 0;
statsObj.userReadyTransmitted = false;
statsObj.authenticated = false;

statsObj.startTimeMoment = moment();
statsObj.startTime = moment().valueOf();
statsObj.elapsed = moment().valueOf() - statsObj.startTime;

statsObj.numChildren = 0;

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

let neuralNetworkChildHashMap = {};


process.on("unhandledRejection", function(err, promise) {
  console.trace("Unhandled rejection (promise: ", promise, ", reason: ", err, ").");
  process.exit();
});

// const jsonPrint = function (obj){
//   try {
//     if (obj) {
//       return treeify.asTree(obj, true);
//     }
//     else {
//       return "UNDEFINED";
//     }
//   }
//   catch (err) {
//     console.log(chalkError("*** ERROR jsonPrint: " + err));
//     return "UNDEFINED";
//   }
// };

function jsonPrint(obj) {
  if (obj) {
    return treeify.asTree(obj, true, true);
  } 
  else {
    return obj;
  }
}

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
  else if (moment.isDate(new Date(inputTime)) && moment(new Date(inputTime)).isValid()) {
    currentTimeStamp = moment(new Date(inputTime)).format(compactDateTimeFormat);
    return currentTimeStamp;
  }
  else if (Number.isInteger(inputTime)) {
    currentTimeStamp = moment(parseInt(inputTime)).format(compactDateTimeFormat);
    return currentTimeStamp;
  }
  else {
    return "NOT VALID TIMESTAMP: " + inputTime;
  }
}

let tempArchiveDirectory = "temp/archive_" + getTimeStamp();

const networkDefaults = function (networkObj){

  if (networkObj.betterChild === undefined) { networkObj.betterChild = false; }
  if (networkObj.testCycles === undefined) { networkObj.testCycles = 0; }
  if (networkObj.testCycleHistory === undefined) { networkObj.testCycleHistory = []; }
  if (networkObj.overallMatchRate === undefined) { networkObj.overallMatchRate = 0; }
  if (networkObj.matchRate === undefined) { networkObj.matchRate = 0; }
  if (networkObj.successRate === undefined) { networkObj.successRate = 0; }

  return networkObj;
};

function printNetworkObj(title, networkObj) {

  networkObj = networkDefaults(networkObj);

  console.log(chalkNetwork(title
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

function getChildProcesses(callback){

  const command = 'bash -c "pgrep ' + NN_CHILD_PREFIX + '"';

  if (configuration.verbose) { console.log(chalkLog("getChildProcesses command: " + command)); }

  let numChildren = 0;
  let childPidArray = [];

  // const shPath = shell.exec("which sh").stdout;
  // const bashPath = shell.exec("which bash").stdout;
  // const pgrepPath = shell.exec("which pgrep").stdout;

  // console.log("shPath: " + shPath);
  // console.log("bashPath: " + bashPath);
  // console.log("pgrepPath: " + pgrepPath);

  shell.exec(command, {silent: true}, function(code, stdout, stderr){

    if (code === 0) {

      let soArray = stdout.trim();

      let stdoutArray = soArray.split("\n");

      statsObj.numChildren = stdoutArray.length;

      if (configuration.verbose) {
        console.log(chalkInfo("TNN | command: " + command));
        console.log(chalkInfo("TNN | code:    " + code));
        console.log(chalkInfo("TNN | stdout:  " + stdout));
        console.log(chalkInfo("TNN | stderr:  " + stderr));
        console.log(chalkInfo("TNN | stdoutArray:   " + stdoutArray));
        console.log(chalkInfo("TNN | FOUND CHILD PROCESSSES | NUM CH: " + statsObj.numChildren));
      }

      if ((statsObj.numChildren === 0) && (callback !== undefined)) { callback(null, false); }

      async.eachSeries(stdoutArray, function(pidRaw, cb){

        const pid = pidRaw.trim();

        if (parseInt(pid) > 0) {

          const c = 'bash -c "ps -o command= -p ' + pid + '"';
          // const c = "ps -o command= -p " + pid;
          if (configuration.verbose) { console.log(chalkLog("getChildProcesses getChildIds command: " + c)); }

          shell.exec(c, {silent: true}, function getChildIds(code, stdout, stderr){

            const nnChildId = stdout.trim();

            numChildren += 1;

            debug(chalkInfo("TNN | FOUND CHILD PROCESS"
              + " | NUM: " + numChildren
              + " | PID: " + pid
              + " | " + nnChildId
            ));

            if (neuralNetworkChildHashMap[nnChildId] === undefined) {

              neuralNetworkChildHashMap[nnChildId] = {};
              neuralNetworkChildHashMap[nnChildId].status = "ZOMBIE";

              console.log(chalkError("TNN | ??? CHILD ZOMBIE ???"
                + " | NUM: " + numChildren
                + " | PID: " + pid
                + " | " + nnChildId
                + " | STATUS: " + neuralNetworkChildHashMap[nnChildId].status
              ));
            }
            else {
              debug(chalkInfo("TNN | CHILD"
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
      console.log(chalkBlue("TNN | NO NN CHILD PROCESSES FOUND"));
        if (callback !== undefined) { callback(null, []); }
    }

    if (code > 1) {
      console.log(chalkAlert("SHELL : TNN | ERROR *** KILL CHILD"
        + "\nSHELL :: TNN | COMMAND: " + command
        + "\nSHELL :: TNN | EXIT CODE: " + code
        + "\nSHELL :: TNN | STDOUT\n" + stdout
        + "\nSHELL :: TNN | STDERR\n" + stderr
      ));
      if (callback !== undefined) { callback(stderr, command); }
    }

  });
}

getChildProcesses(function(err, results){

  debug(chalkInfo("getChildProcesses RESULTS\n" + jsonPrint(results)));

  if (results) {
    results.forEach(function(childObj){
      killChild({pid: childObj.pid}, function(err, numKilled){
        console.log(chalkAlert("KILLED | PID: " + childObj.pid + " | CH ID: " + childObj.nnChildId));
      });
    });
  }
});

function killAll(){

  return new Promise(function(resolve, reject){

    try {

      getChildProcesses(function(err, results){

        debug(chalkInfo("getChildProcesses RESULTS\n" + jsonPrint(results)));

        let numKilled = 0;

        if (results) {

          async.eachSeries(results, function(childObj, cb){

            killChild({pid: childObj.pid}, function(err, numKilled){
              if (err) {
                return cb(err);
              }
              numKilled += 1;
              console.log(chalkAlert("TNN | KILL ALL | KILLED | PID: " + childObj.pid + " | CH ID: " + childObj.nnChildId));
              cb();
            });

          }, function(err){

            if (err) {
              console.log(chalkError("TNN | *** KILL ALL ERROR: " + err));
              return reject(err);
            }

            resolve(numKilled);

          });
        }
        else {
          console.log(chalkAlert("TNN | KILL ALL | NO CHILDREN"));
          resolve(numKilled);
        }
      });

    }
    catch(err){
      console.log(chalkAlert("TNN | *** KILL ALL ERROR: " + err));
      return reject(err);
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
      console.log(chalkAlert("KILL CHILD ID FOUND IN HM | " + params.nnChild + " | PID: " + pid));
    }
  }

  if (params.pid !== undefined) {
    pid = params.pid;
  }

  const command = "kill -9 " + pid;

  shell.exec(command, function(code, stdout, stderr){

    getChildProcesses(function(err, childArray){

      if (code === 0) {
        console.log(chalkAlert("TNN | *** KILL CHILD"
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
        console.log(chalkInfo("TNN | KILL CHILD | NO NN CHILD PROCESSES: " + command));
        if (callback !== undefined) { return callback(null, 0); }
      }
      if (code > 1) {
        console.log(chalkAlert("SHELL : TNN | ERROR *** KILL CHILD"
          + "\nSHELL :: TNN | COMMAND: " + command
          + "\nSHELL :: TNN | EXIT CODE: " + code
          + "\nSHELL :: TNN | STDOUT\n" + stdout
          + "\nSHELL :: TNN | STDERR\n" + stderr
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


let trainingSetHashMap = new HashMap();

let initMainReady = false;
let trainingSetReady = false;
let createTrainingSetBusy = false;

let skipLoadNetworkSet = new Set();
let skipLoadInputsSet = new Set();
let requiredTrainingSet = new Set();

let slackChannelPassGlobal = "#nn-pass-global";
let slackChannelPassLocal = "#nn-pass-local";
let slackChannelFail = "#nn-fail";
let slackChannel = "#nn";
let slackText = "";

let initMainInterval;


const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

const userModel = require("@threeceelabs/mongoose-twitter/models/user.server.model");
const neuralNetworkModel = require("@threeceelabs/mongoose-twitter/models/neuralNetwork.server.model");
const networkInputsModel = require("@threeceelabs/mongoose-twitter/models/networkInputs.server.model");

let User;
let NeuralNetwork;
let NetworkInputs;

const wordAssoDb = require("@threeceelabs/mongoose-twitter");

let UserServerController;
let userServerController;

let userServerControllerReady = false;

let networkCreateInterval;
let saveFileQueueInterval;
let saveFileBusy = false;



configuration.networkCreateMode = "evole";

configuration.globalTrainingSetId = GLOBAL_TRAINING_SET_ID;
configuration.deleteNotInInputsIdArray = DEFAULT_DELETE_NOT_IN_INPUTS_ID_ARRAY;

configuration.processName = process.env.TNN_PROCESS_NAME || "node_twitterNeuralNetwork";

configuration.createTrainingSetOnly = DEFAULT_CREATE_TRAINING_SET_ONLY;
configuration.disableCreateTestSet = DEFAULT_DISABLE_CREATE_TEST_SET;
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

configuration.defaultTrainingSetsFolder = "/config/utility/default/trainingSets";
configuration.hostTrainingSetsFolder = "/config/utility/" + hostname + "/trainingSets";

configuration.defaultUserArchiveFolder = (hostname === "google") ? "/home/tc/Dropbox/Apps/wordAssociation" + configuration.defaultTrainingSetsFolder + "/users" 
  : "/Users/tc/Dropbox/Apps/wordAssociation" + configuration.defaultTrainingSetsFolder + "/users";

configuration.defaultUserArchiveFile = "users.zip";
configuration.defaultUserArchivePath = configuration.defaultUserArchiveFolder + "/" + configuration.defaultUserArchiveFile;

configuration.trainingSetFile = "trainingSet.json";
configuration.requiredTrainingSetFile = "requiredTrainingSet.txt";

configuration.maxNeuralNetworkChildern = (process.env.TNN_MAX_NEURAL_NETWORK_CHILDREN !== undefined) 
  ? process.env.TNN_MAX_NEURAL_NETWORK_CHILDREN 
  : DEFAULT_MAX_NEURAL_NETWORK_CHILDREN;

configuration.waitUnlockIntervalValue = DEFAULT_WAIT_UNLOCK_INTERVAL;
configuration.waitUnlockedTimeoutValue = DEFAULT_WAIT_UNLOCK_TIMEOUT;

configuration.quitOnComplete = DEFAULT_QUIT_ON_COMPLETE;

if (process.env.TNN_QUIT_ON_COMPLETE !== undefined) {

  console.log("TNN | ENV TNN_QUIT_ON_COMPLETE: " + process.env.TNN_QUIT_ON_COMPLETE);

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

// const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";


function toMegabytes(sizeInBytes) {
  return sizeInBytes/ONE_MEGABYTE;
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

function printCat(c){
  if (c === "left") { return "L"; }
  if (c === "neutral") { return "N"; }
  if (c === "right") { return "R"; }
  if (c === "positive") { return "+"; }
  if (c === "negative") { return "-"; }
  if (c === "none") { return "0"; }
  return ".";
}

const DEFAULT_RUN_ID = hostname + "_" + process.pid + "_" + statsObj.startTimeMoment.format(compactDateTimeFormat);

if (process.env.TNN_RUN_ID !== undefined) {
  statsObj.runId = process.env.TNN_RUN_ID;
  console.log(chalkLog("TNN | ENV RUN ID: " + statsObj.runId));
}
else {
  statsObj.runId = DEFAULT_RUN_ID;
  console.log(chalkLog("TNN | DEFAULT RUN ID: " + statsObj.runId));
}

let globalhistograms = {};

inputTypes.forEach(function(type){
  globalhistograms[type] = {};
});

let categorizedUserHashmap = new HashMap();

let categorizedUserHistogram = {};
categorizedUserHistogram.left = 0;
categorizedUserHistogram.right = 0;
categorizedUserHistogram.neutral = 0;
categorizedUserHistogram.positive = 0;
categorizedUserHistogram.negative = 0;
categorizedUserHistogram.none = 0;


const configEvents = new EventEmitter2({
  wildcard: true,
  newListener: true,
  maxListeners: 20,
  verboseMemoryLeak: true
});

let stdin;



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
      console.error(chalkError("TNN | *** SLACK POST MESSAGE ERROR"
        + " | CH: " + channel
        + "\nTNN | TEXT: " + text
        + "\nTNN | ERROR: " + err
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
console.log(chalkInfo("TNN | COMMAND LINE CONFIG\nTNN | " + jsonPrint(commandLineConfig)));
console.log("TNN | COMMAND LINE OPTIONS\nTNN | " + jsonPrint(commandLineConfig));


if (commandLineConfig.targetServer === "LOCAL"){
  commandLineConfig.targetServer = "http://127.0.0.1:9997/util";
}
if (commandLineConfig.targetServer === "REMOTE"){
  commandLineConfig.targetServer = "http://word.threeceelabs.com/util";
}

if (Object.keys(commandLineConfig).includes("help")) {
  console.log("TNN |optionDefinitions\n" + jsonPrint(optionDefinitions));
  quit("help");
}


process.on("message", function(msg) {
  if (msg === "shutdown") {
    console.log("\n\nTNN | !!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n");
    setTimeout(function() {
      console.log("TNN | **** Finished closing connections ****"
        + "\n\n TNN | ***** RELOADING twitterNeuralNet.js NOW *****\n\n");
      process.exit(0);
    }, 1500);
  }
  else {
    console.log("TNN | R<\n" + jsonPrint(msg));
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

process.title = "node_twitterNeuralNetwork";
console.log("\n\nTNN | =================================");
console.log("TNN | HOST:          " + hostname);
console.log("TNN | PROCESS TITLE: " + process.title);
console.log("TNN | PROCESS ID:    " + process.pid);
console.log("TNN | RUN ID:        " + statsObj.runId);
console.log("TNN | PROCESS ARGS:  " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("TNN | =================================");

// ==================================================================
// DROPBOX
// ==================================================================

const dropboxConfigFolder = "/config/utility";
const dropboxConfigDefaultFolder = "/config/utility/default";
const dropboxConfigHostFolder = "/config/utility/" + hostname;

const dropboxConfigDefaultFile = "default_" + configuration.DROPBOX.DROPBOX_TNN_CONFIG_FILE;
const dropboxConfigHostFile = hostname + "_" + configuration.DROPBOX.DROPBOX_TNN_CONFIG_FILE;

const defaultInputsFolder = dropboxConfigDefaultFolder + "/inputs";
const defaultInputsArchiveFolder = dropboxConfigDefaultFolder + "/inputsArchive";

const defaultTrainingSetFolder = dropboxConfigDefaultFolder + "/trainingSets";
const localTrainingSetFolder = dropboxConfigHostFolder + "/trainingSets";

const defaultTrainingSetUserArchive = defaultTrainingSetFolder + "/users/users.zip";

const statsFolder = "/stats/" + hostname + "/neuralNetwork";
const statsFile = "twitterNeuralNetworkStats_" + statsObj.runId + ".json";

const globalBestNetworkFolder = "/config/utility/best/neuralNetworks";
const localBestNetworkFolder = "/config/utility/" + hostname + "/neuralNetworks/best";

let bestNetworkFile;

debug("statsFolder : " + statsFolder);
debug("statsFile : " + statsFile);


console.log("TNN | DROPBOX_TNN_CONFIG_FILE: " + configuration.DROPBOX.DROPBOX_TNN_CONFIG_FILE);
console.log("TNN | DROPBOX_TNN_STATS_FILE : " + configuration.DROPBOX.DROPBOX_TNN_STATS_FILE);

debug("dropboxConfigFolder : " + dropboxConfigFolder);
debug("dropboxConfigHostFolder : " + dropboxConfigHostFolder);
debug("dropboxConfigDefaultFile : " + dropboxConfigDefaultFile);
debug("dropboxConfigHostFile : " + dropboxConfigHostFile);

debug("TNN | DROPBOX_WORD_ASSO_ACCESS_TOKEN :" + configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN);
debug("TNN | DROPBOX_WORD_ASSO_APP_KEY :" + configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY);
debug("TNN | DROPBOX_WORD_ASSO_APP_SECRET :" + configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET);

// dropboxClient
// let dropboxRemoteClient = new Dropbox({ accessToken: configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN });

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

function indexOfMax (arr, callback) {

  if (arr.length === 0) {
    console.log(chalkAlert("TNN | indexOfMax: 0 LENG ARRAY: -1"));
    return callback(-2, arr) ; 
  }

  if ((arr[0] === arr[1]) && (arr[1] === arr[2])){
    debug(chalkInfo("TNN | indexOfMax: ALL EQUAL"));
    debug(chalkInfo("TNN | ARR" 
      + " | " + arr[0].toFixed(2) 
      + " - " + arr[1].toFixed(2) 
      + " - " + arr[2].toFixed(2)
    ));
    if (arr[0] === 0) { return callback(-4, arr); }
    return callback(4, [1,1,1]) ; 
  }

  debug("TNN | B4 ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));
  arrayNormalize(arr);
  debug("TNN | AF ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));

  if (((arr[0] === 1) && (arr[1] === 1)) 
    || ((arr[0] === 1) && (arr[2] === 1))
    || ((arr[1] === 1) && (arr[2] === 1))){

    debug(chalkAlert("TNN | indexOfMax: MULTIPLE SET"));

    debug(chalkAlert("TNN | ARR" 
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
};

function printNetworkCreateResultsHashmap(){

  let tableArray = [];

  tableArray.push([
    "TNN | NNID",
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
      return cb("UNDEFINED");
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
    let snIdRes = "";
    let iterations = "";
    let error = "";
    let successRate = "";
    let elapsed = "";

    status = (networkObj.status !== undefined) ? networkObj.status : "UNKNOWN";
    snIdRes = (networkObj.seedNetworkId) ? networkObj.seedNetworkRes.toFixed(2) : "---";

    iterations = (networkObj.evolve.results !== undefined) ? networkObj.evolve.results.iterations : "---";
    error = ((networkObj.evolve.results !== undefined) 
      && (networkObj.evolve.results.error !== undefined)
      && networkObj.evolve.results.error)  ? networkObj.evolve.results.error.toFixed(5) : "---";

    successRate = (networkObj.successRate !== undefined) ? networkObj.successRate.toFixed(2) : "---";
    elapsed = (networkObj.evolve.elapsed !== undefined) ? networkObj.evolve.elapsed : (moment().valueOf() - networkObj.evolve.startTime);

    tableArray.push([
      "TNN | " + nnId,
      status,
      networkObj.betterChild,
      networkObj.seedNetworkId,
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

    console.log(chalkLog("TNN | === NETWORK RESULTS ========================================================================================================================"));
    console.log(chalkLog(t));
    console.log(chalkLog("TNN | ============================================================================================================================================"));

  });
}

function printInputsHashMap(){

  let tableArray = [];

  tableArray.push([
    "TNN | INPUTS ID",
    "INPTS"
  ]);

  async.each(inputsHashMap.keys(), function(inputsId, cb){

    const inputsObj = inputsHashMap.get(inputsId).inputsObj;

    tableArray.push([
      "TNN | " + inputsId,
      inputsObj.meta.numInputs
    ]);

    async.setImmediate(function() { cb(); });

  }, function(){

    const t = table(tableArray, { align: ["l", "r"] });

    console.log(chalkBlueBold("TNN | ============================================================================================================================================"));
    console.log(chalkBlueBold("TNN | INPUTS HASHMAP"));
    console.log(chalkInfo(t));
    console.log(chalkBlueBold("TNN | ============================================================================================================================================"));

  });
}

function showStats(options){

  getChildProcesses();

  statsObj.elapsed = moment().valueOf() - statsObj.startTime;

  statsObjSmall = pick(statsObj, statsPickArray);


  if (options) {
    console.log("TNN | STATS\nTNN | " + jsonPrint(statsObjSmall));
    printNeuralNetworkChildHashMap();
    printNetworkCreateResultsHashmap();
  }
  else {
    console.log(chalkLog("TNN | ============================================================"
      + "\nTNN | S"
      + " | STATUS: " + statsObj.status
      + " | CPUs: " + statsObj.cpus
      + " | CH: " + statsObj.numChildren
      + " | " + testObj.testRunId
      + " | " + configuration.networkCreateMode.toUpperCase()
      + " | RUN " + statsObj.elapsed
      + " | NOW " + moment().format(compactDateTimeFormat)
      + " | STRT " + moment(parseInt(statsObj.startTime)).format(compactDateTimeFormat)
      + " | ITR " + configuration.evolve.iterations
      + "\nTNN | ============================================================"
    ));

    console.log(chalkLog("TNN | CL U HIST"
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

  console.log(chalkAlert( "\n\nTNN | ... QUITTING ...\n\n" ));

  clearInterval(initMainInterval);
  clearInterval(networkCreateInterval);
  clearInterval(saveFileQueueInterval);

  statsObj.elapsed = moment().valueOf() - statsObj.startTime;

  if (options !== undefined) {

    if (options === "help") {
      process.exit();
    }
    else {
      slackText = "\n*" + statsObj.runId + "*";
      slackText = slackText + " | RUN " + msToTime(statsObj.elapsed);
      slackText = slackText + " | QUIT CAUSE: " + options;

      console.log("TNN | SLACK TEXT: " + slackText);

      slackPostMessage(slackChannel, slackText);
    }
  }

  showStats();

  setTimeout(async function(){

    await killAll();
    await releaseAllFileLocks();

    setTimeout(function() {

      global.dbConnection.close(function () {
        
        console.log(chalkAlert(
            "\nTNN | =========================="
          + "\nTNN | MONGO DB CONNECTION CLOSED"
          + "\nTNN | ==========================\n"
        ));

        // if (socket) { socket.disconnect(); }
        process.exit();
      });

    }, 5000);

  }, 1000);
}

process.on( "SIGINT", async function() {
  await killAll();
  await releaseAllFileLocks();
  quit("SIGINT");
});

process.on("exit", async function() {
  await killAll();
  await releaseAllFileLocks();
  quit("SIGINT");
});

function connectDb(callback){

  statsObj.status = "CONNECT DB";

  wordAssoDb.connect("TNN_" + process.pid, function(err, db){
    if (err) {
      console.log(chalkError("*** TNN | MONGO DB CONNECTION ERROR: " + err));
      callback(err, null);
      dbConnectionReady = false;
    }
    else {

      db.on("error", function(){
        console.error.bind(console, "*** TNN | MONGO DB CONNECTION ERROR ***\n");
        console.log(chalkError("*** TNN | MONGO DB CONNECTION ERROR ***\n"));
        db.close();
        dbConnectionReady = false;
      });

      db.on("disconnected", function(){
        console.error.bind(console, "*** TNN | MONGO DB DISCONNECTED ***\n");
        console.log(chalkAlert("*** TNN | MONGO DB DISCONNECTED ***\n"));
        dbConnectionReady = false;
      });


      console.log(chalkGreen("TNN | MONGOOSE DEFAULT CONNECTION OPEN"));

      dbConnectionReady = true;

      User = mongoose.model("User", userModel.UserSchema);
      NeuralNetwork = mongoose.model("NeuralNetwork", neuralNetworkModel.NeuralNetworkSchema);
      NetworkInputs = mongoose.model("NetworkInputs", networkInputsModel.NetworkInputsSchema);

      callback(null, db);
    }
  });
}

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
    options.destination = params.folder + "/" + params.file;
    options.autorename = true;
    options.mode = params.mode || "overwrite";
    options.mode = "overwrite";

    const objSizeMBytes = options.file_size/ONE_MEGABYTE;

    showStats();
    console.log(chalkInfo("TNN | ... SAVING LOCALLY | " + objSizeMBytes.toFixed(2) + " MB | " + fullPath));

    writeJsonFile(fullPath, params.obj)
    .then(function() {

      console.log(chalkInfo("TNN | SAVED LOCALLY | " + objSizeMBytes.toFixed(2) + " MB | " + fullPath));

      const waitSaveTimeout = (objSizeMBytes < 10) ? 100 : 5*ONE_SECOND;

      // console.log(chalkInfo("TNN | ... PAUSE 5 SEC TO FINISH FILE SAVE | " + objSizeMBytes.toFixed(2) + " MB | " + fullPath));

      setTimeout(function(){

        console.log(chalkInfo("TNN | ... DROPBOX UPLOADING | " + objSizeMBytes.toFixed(2) + " MB | " + fullPath + " > " + options.destination));

        const stats = fs.statSync(fullPath);
        const fileSizeInBytes = stats.size;
        const savedSize = fileSizeInBytes/ONE_MEGABYTE;

        console.log(chalkLog("TNN | ... SAVING DROPBOX JSON"
          + " | " + getTimeStamp()
          + " | " + savedSize.toFixed(2) + " MBYTES"
          + "\n SRC: " + fullPath
          + "\n DST: " + options.destination
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
            console.log(chalkInfo("TNN | LOCAL READ"
              + " | " + mbytesRead.toFixed(2) + " / " + savedSize.toFixed(2) + " MB"
              + " (" + percentRead.toFixed(2) + "%)"
            ));
          }
        });

        localReadStream.on("close", function(){
          console.log(chalkInfo("TNN | LOCAL STREAM READ CLOSED | SOURCE: " + fullPath));
        });

        remoteWriteStream.on("close", function(){
          console.log(chalkInfo("TNN | REMOTE STREAM WRITE CLOSED | DEST: " + options.destination));
        });

        localReadStream.on("end", function(){
          console.log(chalkInfo("TNN | LOCAL READ COMPLETE"
            + " | SOURCE: " + fullPath
            + " | " + mbytesRead.toFixed(2) + " / " + savedSize.toFixed(2) + " MB"
            + " (" + percentRead.toFixed(2) + "%)"
          ));
          localReadStream.close();
        });

        localReadStream.on("error", function(err){
          console.error("TNN | *** LOCAL STREAM READ ERROR | " + err);
          if (callback !== undefined) { return callback(err); }
        });

        remoteWriteStream.on("end", function(){
          console.log(chalkInfo("TNN | REMOTE STREAM WRITE END | DEST: " + options.destination));
          if (callback !== undefined) { return callback(null); }
        });

        remoteWriteStream.on("error", function(err){
          console.error("TNN | *** REMOTE STREAM WRITE ERROR | DEST: " + options.destination + "\n" + err);
          if (callback !== undefined) { return callback(err); }
        });

      }, waitInterval);

    })
    .catch(function(error){
      console.trace(chalkError("TNN | " + moment().format(compactDateTimeFormat) 
        + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
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
          console.log(chalkError("TNN | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: 413"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else if (error.status === 429){
          console.log(chalkError("TNN | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: TOO MANY WRITES"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else if (error.status === 500){
          console.log(chalkError("TNN | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: DROPBOX SERVER ERROR"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else {
          console.log(chalkError("TNN | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: " + error
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
          + " | MORE: " + response.has_more
          + " | PATH:" + options.path
        ));

        let fileExits = false;

        async.each(response.entries, function(entry, cb){

          console.log(chalkInfo("TNN | DROPBOX FILE"
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
            console.log(chalkError("TNN | *** ERROR DROPBOX SAVE FILE: " + err));
            if (callback !== undefined) { 
              return callback(err, null);
            }
            return;
          }
          if (fileExits) {
            console.log(chalkInfo("TNN | ... DROPBOX FILE EXISTS ... SKIP SAVE | " + fullPath));
            if (callback !== undefined) { callback(err, null); }
          }
          else {
            console.log(chalkInfo("TNN | ... DROPBOX DOES NOT FILE EXIST ... SAVING | " + fullPath));
            dbFileUpload();
          }
        });

      })
      .catch(function(err){
        console.log(chalkError("TNN | *** DROPBOX SAVE FILE ERROR: " + err));
        if (callback !== undefined) { callback(err, null); }
      });
    }
    else {
      dbFileUpload();
    }
  }
}

function loadFileRetry(params, callback){

  let operation = retry.operation();

  operation.attempt(function(currentAttempt){

    debug(chalkInfo("loadFileRetry currentAttempt: " + currentAttempt));

    loadFile(params, function(err, fileObj){

      if (operation.retry(err)){
        return;
      }

      callback(err ? operation.mainError() : null, fileObj);

    });

  });
}

function loadFile(params, callback) {

  let fullPath = params.folder + "/" + params.file

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
      }

      console.log(chalkInfo(getTimeStamp()
        + " | LOADING FILE FROM DROPBOX"
        + " | " + fullPath
      ));

      if (params.file.match(/\.json$/gi)) {

        const fileObj = JSONParse(data);

        if (fileObj.value) {

          const fileObjSizeMbytes = sizeof(fileObj)/ONE_MEGABYTE;

          console.log(chalkInfo(getTimeStamp()
            + " | LOADED FILE FROM DROPBOX"
            + " | " + fileObjSizeMbytes.toFixed(2) + " MB"
            + " | " + fullPath
          ));
          callback(null, fileObj.value);
        }
        else {
          console.log(chalkError(getTimeStamp()
            + " | *** LOAD FILE FROM DROPBOX ERROR"
            + " | " + fullPath
            + " | " + fileObj.error
          ));
          callback(fileObj.error, null);
        }
      }
      else {
        console.log(chalkError(getTimeStamp()
          + " | ... SKIP LOAD FILE FROM DROPBOX"
          + " | " + fullPath
        ));
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

      if (params.file.match(/\.json$/gi)) {

        let payload = data.fileBinary;

        if (!payload || (payload === undefined)) {
          return callback(new Error("TNN LOAD FILE PAYLOAD UNDEFINED"), null);
        }

        const fileObj = JSONParse(payload);

        if (fileObj.value) {
          callback(null, fileObj.value);
        }
        else {
          console.log(chalkError("TNN | DROPBOX loadFile ERROR: " + fullPath + "\n", fileObj.error));
          callback(fileObj.error, null);
        }
      }
      else {
        callback(null, null);
      }
    })
    .catch(function(error) {

      console.log(chalkError("TNN | DROPBOX loadFile ERROR: " + fullPath + "\n", error));
      console.log(chalkError("TNN | " + jsonPrint(error.error)));
      
      if ((error.status === 409) || (error.status === 404)) {
        console.log(chalkError("TNN | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND"
          + " ... SKIPPING ...")
        );
        callback(null, null);
      }
      else if (error.status === 0) {
        console.log(chalkError("TNN | !!! DROPBOX NO RESPONSE"
          + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
        callback(null, null);
      }
      else {
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
      callback(null, response);
    })
    .catch(function(error) {
      console.log(chalkError("TNN | DROPBOX getFileMetadata ERROR: " + fullPath + "\n" + error));
      console.log(chalkError("TNN | !!! DROPBOX READ " + fullPath + " ERROR"));
      console.log(chalkError("TNN | " + jsonPrint(error.error)));

      if ((error.status === 404) || (error.status === 409)) {
        console.error(chalkError("TNN | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND"
          + " ... SKIPPING ...")
        );
        return callback(null, null);
      }
      if (error.status === 0) {
        console.error(chalkError("TNN | !!! DROPBOX NO RESPONSE"
          + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
        return callback(null, null);
      }
      
    callback(error, null);
    });
}

function purgeNetwork(nnId, callback){

  console.log(chalkInfo("TNN | XXX PURGE NETWORK: " + nnId));

  bestNetworkHashMap.delete(nnId);

  betterChildSeedNetworkIdSet.delete(nnId);

  skipLoadNetworkSet.add(nnId);

  if (networkCreateResultsHashmap[nnId] !== undefined) { 
    networkCreateResultsHashmap[nnId].status = "PURGED";
  }

  if (callback !== undefined) { callback(); }
}

function purgeInputs(inputsId, callback){

  if (!configuration.inputsIdArray.includes(inputsId)){
    console.log(chalkInfo("TNN | XXX PURGE INPUTS: " + inputsId));
    inputsHashMap.delete(inputsId);
    skipLoadInputsSet.add(inputsId);
  }
  else {
    console.log(chalkInfo("TNN | ** NO XXX PURGE INPUTS ... IN CONFIGURATION INPUTS ID ARRAY" 
      + " | INPUTS ID: " + inputsId
    ));

    if (configuration.verbose) {
      console.log(chalkInfo("TNN | CONFIGURATION INPUTS ID ARRAY\n" + jsonPrint(configuration.inputsIdArray) ));
    }
  }

  if (callback !== undefined) { callback(); }
}

function initSaveFileQueue(cnf){

  console.log(chalkBlue("TNN | INIT DROPBOX SAVE FILE INTERVAL | " + cnf.saveFileQueueInterval + " MS"));

  clearInterval(saveFileQueueInterval);

  saveFileQueueInterval = setInterval(function () {

    if (!saveFileBusy && saveFileQueue.length > 0) {

      saveFileBusy = true;

      const saveFileObj = saveFileQueue.shift();

      saveFile(saveFileObj, function(err){
        if (err) {
          console.log(chalkError("TNN | *** SAVE FILE ERROR ... RETRY | " + saveFileObj.folder + "/" + saveFileObj.file));
          saveFileQueue.push(saveFileObj);
        }
        else {
          console.log(chalkBlue("TNN | SAVED FILE"
            + " [" + saveFileQueue.length + "] "
            + saveFileObj.folder + "/" + saveFileObj.file
          ));
        }
        saveFileBusy = false;
      });
    }

  }, cnf.saveFileQueueInterval);
}

let statsUpdateInterval;


function initStatsUpdate(cnf){

  console.log(chalkBlue("TNN | INIT STATS UPDATE INTERVAL | " + cnf.statsUpdateIntervalTime + " MS"));

  clearInterval(statsUpdateInterval);

  let count = 0;

  saveFileQueue.push({localFlag: false, folder: statsFolder, file: statsFile, obj: statsObj});

  statsUpdateInterval = setInterval(function () {


    statsObj.elapsed = moment().valueOf() - statsObj.startTime;
    statsObj.timeStamp = moment().format(compactDateTimeFormat);
 
    showStats();

    saveFileQueue.push({localFlag: false, folder: statsFolder, file: statsFile, obj: statsObj});

    if (count % 10 === 0) {
      printNetworkCreateResultsHashmap();
    }

    count += 1;

  }, cnf.statsUpdateIntervalTime);
}

function listDropboxFolder(options, callback){

  debug(chalkNetwork("TNN | ... LISTING DROPBOX FOLDER | " + options.path));

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

    if (configuration.verbose) {
      console.log(chalkLog("DROPBOX LIST FOLDER"
        + " | PATH:" + options.path
        + " | ENTRIES: " + response.entries.length
        // + " | CURSOR (trunc): " + cursor
        + " | LIMIT: " + options.limit
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
                + " | PATH:" + options.path
                + " | ENTRIES: " + responseCont.entries.length + "/" + results.entries.length
                + " | LIMIT: " + options.limit
                + " | MORE: " + more
              ));
            }

          })
          .catch(function(err){
            console.trace(chalkError("TNN | *** DROPBOX filesListFolderContinue ERROR: ", err));
          });

          async.setImmediate(function() { cb(); });

        }, 1000);
      },

      function(err){
        if (err) {
          console.log(chalkError("TNN | DROPBOX LIST FOLDERS: " + err + "\n" + jsonPrint(err)));
        }
        callback(err, results);
      });
  })
  .catch(function(err){
    console.log(chalkError("TNN | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
    callback(err, null);
  });
}

function loadInputsDropboxFolder(folder, callback){

  statsObj.status = "LOAD INPUTS";

  if (configuration.createTrainingSetOnly) {
    if (callback !== undefined) { 
      return callback(null, null); 
    }
  }

  console.log(chalkLog("TNN | ... LOADING DROPBOX INPUTS FOLDER | " + folder));

  let options = {
    path: folder,
    limit: DROPBOX_LIST_FOLDER_LIMIT
  };
  let skippedInputsFiles = 0;

  listDropboxFolder(options, function(err, results){

    if (err) {
      console.log(chalkError("TNN | ERROR LOADING DROPBOX INPUTS FOLDER | " + options.path + " | " + err));
      return callback(err, null);
    }

    console.log(chalkBlue("TNN | DROPBOX LIST INPUTS FOLDER"
      + " | ENTRIES: " + results.entries.length
      + " | PATH:" + options.path
    ));

    async.eachSeries(results.entries, function(entry, cb){

      debug(chalkInfo("entry: " + entry));

      const entryNameArray = entry.name.split(".");
      const entryInputsId = entryNameArray[0];

      debug(chalkInfo("TNN | DROPBOX INPUTS FILE FOUND"
        + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
        + " | INPUTS ID: " + entryInputsId
        + " | " + entry.name
      ));

      if (skipLoadInputsSet.has(entryInputsId)){
        if (configuration.verbose) {
          console.log(chalkInfo("TNN | INPUTS IN SKIP LOAD INPUTS SET ... SKIPPING LOAD OF " + entryInputsId));
        }
        skippedInputsFiles += 1;
        cb();
      }
      else if (!configuration.loadAllInputs && !configuration.inputsIdArray.includes(entryInputsId)){

        if (configuration.verbose){
          console.log(chalkInfo("TNN | DROPBOX INPUTS NOT IN INPUTS ID ARRAY ... SKIPPING"
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

          console.log(chalkInfo("TNN | DROPBOX INPUTS CONTENT CHANGE"
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
            + " | " + entry.name
            // + "\nCUR HASH: " + entry.content_hash
            // + "\nOLD HASH: " + curInputsObj.entry.content_hash
          ));

          loadFileRetry({folder: folder, file: entry.name}, function(err, inputsObj){

            if (err) {
              console.log(chalkError("TNN | DROPBOX INPUTS LOAD FILE ERROR: " + err));
              cb();
            }
            else if ((inputsObj === undefined) || !inputsObj) {
              console.log(chalkError("TNN | DROPBOX INPUTS LOAD FILE ERROR | JSON UNDEFINED ??? "));
              cb();
            }
            else {
              console.log(chalkInfo("TNN | DROPBOX INPUTS"
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

          console.log(chalkNetwork("TNN | DROPBOX INPUTS CONTENT DIFF IN DIFF FOLDERS"
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
            // + "\nCUR: " + entry.path_display
            // + "\nOLD: " + curInputsObj.entry.path_display
          ));

          // LOAD FROM BEST FOLDER AND SAVE LOCALLY
          loadFileRetry({folder: folder, file: entry.name}, function(err, inputsObj){

            if (err) {
              console.log(chalkError("TNN | DROPBOX INPUTS LOAD FILE ERROR: " + err));
              cb();
            }
            else if ((inputsObj === undefined) || !inputsObj) {
              console.log(chalkError("TNN | DROPBOX INPUTS LOAD FILE ERROR | JSON UNDEFINED ??? "));
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

              if (inputsNetworksHashMap[inputsObj.inputsId] === undefined) {
                inputsNetworksHashMap[inputsObj.inputsId] = new Set();
              }

              const inputTypes = Object.keys(inputsObj.inputs);

              console.log(chalkInfo("TNN | + INPUTS HASH MAP"
                + " | " + inputsHashMap.count() + " INs IN HM"
                + " | " + inputsObj.inputsId
              ));

              let totalInputs = 0;

              inputTypes.forEach(function(inputType){
                debug("TNN | " + inputsObj.inputsId + " | INPUT TYPE: " + inputType + " | " + inputsObj.inputs[inputType].length + " INPUTS");
                totalInputs += inputsObj.inputs[inputType].length;
              });

              console.log("TNN | " + inputsObj.inputsId + " | TOTAL INPUTS TYPE: " + totalInputs);

              cb();

            }
          });

        }
        else{
          debug(chalkLog("TNN | DROPBOX INPUTS CONTENT SAME  "
            + " | " + entry.name
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
          ));
          cb();
        }
      }
      else {

        loadFileRetry({folder: folder, file: entry.name}, function(err, inputsObj){

          if (err) {
            console.log(chalkError("TNN | DROPBOX INPUTS LOAD FILE ERROR: " + err));
            // purgeInputs(entryInputsId);
            cb();
          }
          else if ((inputsObj === undefined) || !inputsObj) {
            console.log(chalkError("TNN | DROPBOX INPUTS LOAD FILE ERROR | JSON UNDEFINED ??? "));
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

            console.log(chalkInfo("TNN | + INPUTS HASH MAP"
              + " | " + inputsHashMap.count() + " INs IN HM"
              + " | " + inputsObj.inputsId
            ));

            let totalInputs = 0;

            inputTypes.forEach(function(inputType){
              debug("TNN | " + inputsObj.inputsId + " | INPUT TYPE: " + inputType + " | " + inputsObj.inputs[inputType].length + " INPUTS");
              totalInputs += inputsObj.inputs[inputType].length;
            });

            console.log("TNN | " + inputsObj.inputsId + " | TOTAL INPUTS TYPE: " + totalInputs);

            cb();

          }
        });
      }
    }, function(){
      if (skippedInputsFiles > 0) {
        console.log(chalkInfo("TNN | SKIPPED LOAD OF " + skippedInputsFiles + " INPUTS FILES | " + folder));
      }

      if (configuration.verbose) {
        printInputsHashMap();
      }

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

  // if (configuration.testMode) {
  //   trainingSetData.length = 100;
  //   configuration.globalTrainingSetId = "smallGlobalTrainingSet";
  // }

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

          console.log(chalkLog("TNN | +++ ADD NET USER FROM TRAINING SET  "
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
          console.log("TNN |ERROR: updateUsersFromTrainingSet newUser: " + err.message);
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
          console.log("TNN | ERROR: updateUsersFromTrainingSet: " + err.message);
        });

        cb();
      }
      else {
        if ((userIndex % 1000) === 0) {
          console.log(chalkLog("TNN | --- NO UPDATE USER FROM TRAINING SET"
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
    // spinnerUpdateUsers.succeed("TNN | UPDATED USERS: " + updatedUserCount + "/" + userIndex + "/" + numberUsers );
    callback();
  });
}

// function loadTrainingSet(params){

//   statsObj.status = "LOAD TRAINING SET";

//   console.log(chalkLog("TNN | ... LOADING DROPBOX TRAINING SET | " + params.folder + "/" + params.file));

//   loadFileRetry({folder: params.folder, file: params.file}, function(err, trainingSetObj){
//     if (err) {
//       console.log(chalkError("TNN | DROPBOX TRAINING SET LOAD FILE ERROR: " + err));
//       cb(err);
//     }
//     else if ((trainingSetObj === undefined) || !trainingSetObj) {
//       console.log(chalkError("TNN | DROPBOX TRAINING SET LOAD FILE ERROR | JSON UNDEFINED ??? "));
//       cb(err);
//     }
//     else {

//       if (trainingSetObj.testSet.meta === undefined) { 
//         trainingSetObj.testSet.meta = {};
//         trainingSetObj.testSet.meta.testSetId = trainingSetObj.trainingSetId;
//         trainingSetObj.testSet.meta.setSize = trainingSetObj.testSet.data.length;
//       }

//       trainingSetObj.testSet.meta.testSetId = trainingSetObj.testSet.meta.testSetId || trainingSetObj.trainingSetId;

//       trainingSetHashMap.set(trainingSetObj.trainingSetId, {entry: entry, trainingSetObj: trainingSetObj} );

//       console.log(chalkInfo("TNN | DROPBOX TRAINING SET"
//         + " [" + trainingSetHashMap.count() + "]"
//         + " | TRAINING SET SIZE: " + trainingSetObj.trainingSet.meta.setSize
//         + " | " + entry.name
//         + " | " + trainingSetObj.trainingSetId
//       ));

//       if (hostname === "google") {
//         cb();
//       }
//       else {
//         updateUsersFromTrainingSet(trainingSetObj.trainingSet.data.concat(trainingSetObj.testSet.data), function(err){
//           cb();
//         });
//       }
//     }

//   });
// }

function updateDbNetwork(params, callback) {

  statsObj.status = "UPDATE DB NETWORKS";

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
      return callback(err, null);
    }

    if (verbose) { printNetworkObj("TNN | +++ NN DB UPDATED", nnDbUpdated); }

    callback(null, nnDbUpdated);

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

  debug(chalkNetwork("TNN | ... LOADING DROPBOX BEST NN FOLDERS"
    + " | " + params.folders.length + " FOLDERS"
    + "\n" + jsonPrint(params.folders)
  ));

  async.eachSeries(params.folders, function(folder, cb0){

    debug(chalkNetwork("TNN | ... LOADING DROPBOX BEST NN FOLDER | " + folder));

    let options = {
      path: folder,
      limit: DROPBOX_LIST_FOLDER_LIMIT
    };

    listDropboxFolder(options, function(err, response){

      if (err) {
        return cb0(err);
      }

      debug(chalkLog("DROPBOX LIST FOLDER"
        + " | ENTRIES: " + response.entries.length
        + " | PATH:" + options.path
      ));

      if (response.entries.length === 0) {
        console.log(chalkAlert("TNN | DROPBOX BEST NETWORKS FOLDER: NO FILES? " + folder
          + " | " + response.entries.length + " FILES FOUND"
        ));
        return cb0();
      }

      if (configuration.testMode) {
        response.entries.length = Math.min(response.entries.length, TEST_DROPBOX_NN_LOAD);
        console.log(chalkAlert("TNN | *** TEST MODE *** | LOAD MAX " + TEST_DROPBOX_NN_LOAD + " BEST NETWORKS"));
      }

      console.log(chalkLog("TNN | DROPBOX BEST NETWORKS FOLDER FILES " + folder
        + " | " + response.entries.length + " FILES FOUND"
      ));

      async.eachSeries(response.entries, function(entry, cb1){

        debug("entry\n" + jsonPrint(entry));

        if (entry.name === bestRuntimeNetworkFileName) {
          debug(chalkInfo("... SKIPPING LOAD OF " + entry.name));
          return cb1();
        }

        if (!entry.name.endsWith(".json")) {
          debug(chalkInfo("... SKIPPING LOAD OF " + entry.name));
          return cb1();
        }

        const entryNameArray = entry.name.split(".");
        const networkId = entryNameArray[0];

        debug(chalkInfo("TNN | DROPBOX BEST NETWORK FOUND"
          + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
          + " | " + networkId
          + " | " + entry.name
        ));

        if (skipLoadNetworkSet.has(networkId)){
          debug(chalkInfo("TNN | NN IN SKIP LOAD NN SET ... SKIPPING LOAD OF " + networkId));
          return cb1();
        }
        
        if (bestNetworkHashMap.has(networkId)){

          let curNetworkObj = bestNetworkHashMap.get(networkId);
          let oldContentHash = false;

          if ((curNetworkObj.entry.path_display === entry.path_display) 
            && (curNetworkObj.entry !== undefined) && (curNetworkObj.entry.content_hash !== undefined)){
            oldContentHash = curNetworkObj.entry.content_hash;
          }

          if (oldContentHash && (oldContentHash !== entry.content_hash) 
            && (curNetworkObj.entry.path_display === entry.path_display)) {

            console.log(chalkNetwork("TNN | DROPBOX BEST NETWORK CONTENT CHANGE"
              + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
              + " | " + entry.path_display
              // + "\nCUR HASH: " + entry.content_hash
              // + "\nOLD HASH: " + oldContentHash
            ));

            loadFileRetry({folder: folder, file: entry.name}, function(err, networkObj){

              if (err) {
                console.log(chalkError("TNN | DROPBOX BEST NETWORK RELOAD FILE ERROR: " + err));
                purgeNetwork(networkId);
                cb1();
              }
              else if ((networkObj === undefined) || !networkObj) {
                console.log(chalkError("TNN | DROPBOX BEST NETWORK RELOAD FILE ERROR | JSON UNDEFINED ??? "));
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


                networkObj = networkDefaults(networkObj);

                printNetworkObj("TNN | DROPBOX BEST NETWORK", networkObj);

                if (!bestNetworkHashMap.has(networkObj.networkId) 
                  && ((networkObj.successRate >= configuration.globalMinSuccessRate) 
                  || (networkObj.overallMatchRate >= configuration.globalMinSuccessRate))) {

                  printNetworkObj("TNN | LOAD GLOBAL BEST NETWORK", networkObj);

                  slackText = "\n*GLOBAL BEST (ON LOCAL DIR LOAD)*";
                  slackText = slackText + "\n*" + networkObj.successRate.toFixed(2) + "%*";
                  slackText = slackText + "\n" + networkObj.networkId;
                  slackText = slackText + "\nELAPSED: " + msToTime(networkObj.evolve.elapsed);
                  slackText = slackText + "\nBETTER CHILD: " + networkObj.betterChild;
                  slackText = slackText + "\nIN: " + networkObj.inputsId;
                  slackText = slackText + "\nINPUTS: " + networkObj.network.input;

                  slackPostMessage(slackChannelPassGlobal, slackText);

                  saveFileQueue.push({localFlag: false, folder: globalBestNetworkFolder, file: entry.name, obj: networkObj});

                }

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

                if (!currentBestNetwork || (networkObj.overallMatchRate > currentBestNetwork.overallMatchRate)) {

                  currentBestNetwork = networkObj;

                  printNetworkObj("TNN | * NEW BEST NN", networkObj);
                 }

                cb1();
              }
            });
          }
          else if (oldContentHash && (oldContentHash !== entry.content_hash) 
            && (curNetworkObj.entry.path_display !== entry.path_display)) {

            console.log(chalkNetwork("TNN | DROPBOX BEST NETWORK CONTENT DIFF IN DIFF params.folders"
              + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
              + "\nCUR: " + entry.path_display
              + " | " + entry.content_hash
              + "\nOLD: " + curNetworkObj.entry.path_display
              + " | " + curNetworkObj.entry.content_hash
            ));

            // LOAD FROM BEST FOLDER AND SAVE LOCALLY
            loadFileRetry({folder: globalBestNetworkFolder, file: entry.name}, function(err, networkObj){

              if (err) {
                console.log(chalkError("TNN | DROPBOX BEST NETWORK RELOAD FILE ERROR: " + err));
                purgeNetwork(networkId);
                return cb1();
              }
              
              if ((networkObj === undefined) || !networkObj) {
                console.log(chalkError("TNN | DROPBOX BEST NETWORK RELOAD FILE ERROR | JSON UNDEFINED ??? "));
                purgeNetwork(networkId);
                return cb1();
              }

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

              networkObj = networkDefaults(networkObj);

              printNetworkObj("TNN | DROPBOX GLOBAL BEST NETWORK", networkObj);

              bestNetworkHashMap.set(networkObj.networkId, { entry: entry, networkObj: networkObj.network});

              dropboxClient.filesDelete({path: localBestNetworkFolder + "/" + entry.name})
              .then(function(response){

                debug("dropboxClient filesDelete response\n" + jsonPrint(response));

                printNetworkObj("TNN | XXX LOCAL NN (GLOBAL EXISTS)", networkObj);
              })
              .catch(function(err){
                if (err.status === 409) {
                  console.log(chalkError("TNN | *** ERROR: XXX NN"
                    + " | STATUS: " + err.status
                    + " | PATH: " + localBestNetworkFolder + "/" + entry.name
                    + " | CONFLICT | DOES NOT EXIST"
                  ));
                }
                else if (err.status === 429) {
                  console.log(chalkError("TNN | *** ERROR: XXX NN"
                    + " | STATUS: " + err.status
                    + " | PATH: " + localBestNetworkFolder + "/" + entry.name
                    + " | TOO MANY REQUESTS"
                  ));
                }
                else {
                  console.log(chalkError("TNN | *** ERROR: XXX NN"
                    + " | STATUS: " + err.status
                    + " | PATH: " + localBestNetworkFolder + "/" + entry.name
                    + " | SUMMARY: " + err.response.statusText
                    + "\n" + jsonPrint(err)
                  ));
                }
                return cb1(err);
              });

              let inputsEntry = {};

              inputsEntry.name = networkObj.inputsId + ".json";
              inputsEntry.content_hash = false;
              inputsEntry.client_modified = moment();

              inputsHashMap.set(networkObj.inputsId, {entry: inputsEntry, inputsObj: networkObj.inputsObj});

              if (inputsNetworksHashMap[networkObj.inputsId] === undefined) {
                inputsNetworksHashMap[networkObj.inputsId] = new Set();
              }

              inputsNetworksHashMap[networkObj.inputsId].add(networkObj.networkId);

              updateDbNetwork({networkObj: networkObj, addToTestHistory: true}, function(err, nnDb){
                if (err) {
                  console.log(chalkError("*** ERROR: DB NN FIND ONE ERROR | "+ networkObj.networkId + " | " + err));
                  cb1();
                }
                else if (nnDb) {

                  numNetworksLoaded += 1;


                  if (!currentBestNetwork || (nnDb.overallMatchRate > currentBestNetwork.overallMatchRate)) {

                    currentBestNetwork = nnDb;

                    printNetworkObj("TNN | *** NEW BEST NN", nnDb);

                  }

                  bestNetworkHashMap.set(nnDb.networkId, { entry: entry, networkObj: nnDb});

                  printNetworkObj("TNN | +++ NN HASH MAP [" + numNetworksLoaded + " LOADED / " + bestNetworkHashMap.size + " IN HM]", nnDb);

                  cb1();

                }
                else {
                  cb1();
                }
              });

            });
          }
          else {
            debug(chalkLog("TNN | DROPBOX BEST NETWORK CONTENT SAME  "
              + " | " + entry.name
              + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
              + "\nCUR HASH: " + entry.content_hash
              + "\nOLD HASH: " + oldContentHash
            ));
            cb1();
          }
        }
        else {

          loadFileRetry({folder: folder, file: entry.name}, function(err, networkObj){

            if (err) {
              console.log(chalkError("TNN | DROPBOX BEST NETWORK LOAD FILE ERROR: " + err));
              purgeNetwork(networkId);
              return cb1();
            }
            
            if ((networkObj === undefined) || !networkObj) {
              console.log(chalkError("TNN | DROPBOX BEST NETWORK LOAD FILE ERROR | JSON UNDEFINED ??? "));
              purgeNetwork(networkId);
              return cb1();
            }

            networkObj = networkDefaults(networkObj);

            if (!configuration.inputsIdArray.includes(networkObj.inputsId)) {

              if (!configuration.deleteNotInInputsIdArray){
                console.log(chalkInfo("TNN | NN INPUTS NOT IN INPUTS ID ARRAY ... SKIPPING"
                  + " | NUM INPUTS: " + networkObj.numInputs
                  + " | INPUTS ID: " + networkObj.inputsId
                  + " | " + folder + "/" + entry.name
                ));
                skipLoadNetworkSet.add(networkObj.networkId);
                return cb1();
              }

              console.log(chalkInfo("TNN | NN INPUTS NOT IN INPUTS ID ARRAY ... DELETING: " 
                + folder + "/" + entry.name));

              dropboxClient.filesDelete({path: folder + "/" + entry.name})
                .then(function(response){

                  debug("dropboxClient filesDelete response\n" + jsonPrint(response));

                  printNetworkObj("TNN | XXX | INPUTS NOT IN INPUTS ID ARRAY", networkObj);
                })
                .catch(function(err){
                  if (err.status === 429) {
                    console.log(chalkError("TNN | *** ERROR: XXX NN"
                      + " | STATUS: " + err.status
                      + " | PATH: " + folder + "/" + entry.name
                      + " | TOO MANY REQUESTS"
                    ));
                  }
                  else {
                    console.log(chalkError("TNN | *** ERROR: XXX NN"
                      + " | STATUS: " + err.status
                      + " | PATH: " + folder + "/" + entry.name
                      + " | SUMMARY: " + err.response.statusText
                    ));
                  }
                  return cb1(err);
                });

              cb1();
            }
            else if ((options.networkId !== undefined) 
              || ((folder === "/config/utility/best/neuralNetworks") && (networkObj.successRate > configuration.globalMinSuccessRate))
              || ((folder === "/config/utility/best/neuralNetworks") && (networkObj.matchRate > configuration.globalMinSuccessRate))
              || (params.purgeMin && (folder !== "/config/utility/best/neuralNetworks") && (networkObj.successRate > configuration.localPurgeMinSuccessRate))
              || (params.purgeMin && (folder !== "/config/utility/best/neuralNetworks") && (networkObj.matchRate > configuration.localPurgeMinSuccessRate))
              || (!params.purgeMin && (folder !== "/config/utility/best/neuralNetworks") && (networkObj.successRate > configuration.localMinSuccessRate))
              || (!params.purgeMin && (folder !== "/config/utility/best/neuralNetworks") && (networkObj.matchRate > configuration.localMinSuccessRate))) {


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

              updateDbNetwork({networkObj: networkObj, addToTestHistory: true}, function(err, nnDb){
                if (err) {
                  console.log(chalkError("*** ERROR: DB NN FIND ONE ERROR | "+ networkObj.networkId + " | " + err));
                  cb1();
                }
                else if (nnDb) {

                  numNetworksLoaded += 1;


                  if (!currentBestNetwork || (nnDb.overallMatchRate > currentBestNetwork.overallMatchRate)) {

                    currentBestNetwork = nnDb;

                    printNetworkObj("TNN | *** NEW BEST NN", nnDb);

                  }

                  if ((folder !== "/config/utility/best/neuralNetworks") 
                    && ((nnDb.successRate >= configuration.globalMinSuccessRate) 
                    || (nnDb.overallMatchRate >= configuration.globalMinSuccessRate))) {

                    printNetworkObj("TNN | LOAD GLOBAL BEST NETWORK", nnDb);

                    slackText = "\n*GLOBAL BEST (ON LOCAL DIR LOAD)*";
                    slackText = slackText + "\n*" + nnDb.successRate.toFixed(2) + "%*";
                    slackText = slackText + "\n" + nnDb.networkId;
                    slackText = slackText + "\nELAPSED: " + msToTime(nnDb.evolve.elapsed);
                    slackText = slackText + "\nBETTER CHILD: " + nnDb.betterChild;
                    slackText = slackText + "\nIN: " + nnDb.inputsId;
                    slackText = slackText + "\nINPUTS: " + nnDb.network.input;

                    slackPostMessage(slackChannelPassGlobal, slackText);

                    saveFileQueue.push({localFlag: false, folder: globalBestNetworkFolder, file: entry.name, obj: nnDb});

                  }



                  bestNetworkHashMap.set(nnDb.networkId, { entry: entry, networkObj: nnDb});

                  printNetworkObj("TNN | +++ NN HASH MAP [" + numNetworksLoaded + " LOADED / " + bestNetworkHashMap.size + " IN HM]", nnDb);

                  cb1();

                }
                else {
                  cb1();
                }
              });

            }
            else if (((hostname === "google") && (folder === globalBestNetworkFolder))
              || ((hostname !== "google") && (folder === localBestNetworkFolder)) ) {

              printNetworkObj("TNN | DELETING NN", networkObj);

              purgeNetwork(networkObj.networkId);
              purgeInputs(networkObj.inputsId);

              dropboxClient.filesDelete({path: folder + "/" + entry.name})
              .then(function(response){

                debug("dropboxClient filesDelete response\n" + jsonPrint(response));

                printNetworkObj("TNN | XXX NN", networkObj);
                cb1();

              })
              .catch(function(err){
                if (err.status === 429) {
                  console.log(chalkError("TNN | *** ERROR: XXX NN"
                    + " | STATUS: " + err.status
                    + " | PATH: " + folder + "/" + entry.name
                    + " | TOO MANY REQUESTS"
                  ));
                  return cb1(err);
                }
                console.log(chalkError("TNN | *** ERROR: XXX NN"
                  + " | STATUS: " + err.status
                  + " | PATH: " + folder + "/" + entry.name
                  + " | SUMMARY: " + err.response.statusText
                ));
                cb1(err);
              });

            }
            else {
              cb1();
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


function initStdIn(callback){
  console.log("TNN | STDIN ENABLED");

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
        console.log(chalkRedBold("TNN | VERBOSE: " + configuration.verbose));
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
        console.log(chalkAlert(
          "\n" + "q/Q: quit"
          + "\n" + "s: showStats"
          + "\n" + "S: showStats verbose"
          + "\n" + "v: verbose log"
        ));
    }
  });

  if (callback !== undefined) { callback(null, stdin); }
}

function loadCommandLineArgs(callback){


  statsObj.status = "LOAD COMMAND LINE ARGS";

  const commandLineConfigKeys = Object.keys(commandLineConfig);

  async.each(commandLineConfigKeys, function(arg, cb){
    if ((arg === "createTrainingSet") || (arg === "createTrainingSetOnly")) {
      configuration.loadTrainingSetFromFile = false;
      configuration[arg] = commandLineConfig[arg];
      console.log("TNN | --> COMMAND LINE CONFIG | " + arg + ": " + configuration[arg]);
    }
    else if (arg === "hiddenLayerSize") {
      configuration.train.hiddenLayerSize = commandLineConfig[arg];
      console.log("TNN | --> COMMAND LINE CONFIG | train.hiddenLayerSize: " + configuration.train.hiddenLayerSize);
    }
    else if (arg === "seedNetworkId") {
      configuration.train.networkId = commandLineConfig[arg];
      configuration.evolve.networkId = commandLineConfig[arg];
      console.log("TNN | --> COMMAND LINE CONFIG | train.networkObj.networkId: " + configuration.train.networkId);
      console.log("TNN | --> COMMAND LINE CONFIG | evolve.networkObj.networkId: " + configuration.evolve.networkId);
    }
    else if (arg === "evolveIterations") {
      configuration.train.iterations = commandLineConfig[arg];
      configuration.evolve.iterations = commandLineConfig[arg];
      console.log("TNN | --> COMMAND LINE CONFIG | train.iterations: " + configuration.train.iterations);
      console.log("TNN | --> COMMAND LINE CONFIG | evolve.iterations: " + configuration.evolve.iterations);
    }
    else {
      configuration[arg] = commandLineConfig[arg];
      console.log("TNN | --> COMMAND LINE CONFIG | " + arg + ": " + configuration[arg]);
    }
    cb();
  }, function(){
    statsObj.commandLineArgsLoaded = true;

    if (callback !== undefined) { callback(null, commandLineConfig); }
  });

}

function loadConfigFile(folder, file, callback) {

  if (file === dropboxConfigDefaultFile) {
    prevConfigFileModifiedMoment = moment(prevDefaultConfigFileModifiedMoment);
  }
  else {
    prevConfigFileModifiedMoment = moment(prevHostConfigFileModifiedMoment);
  }

  if (configuration.offlineMode) {
    loadCommandLineArgs(function(err, commandLineConfig){
      return callback(null, null);
    });
  }
  else {

    const fullPath = folder + "/" + file;

    getFileMetadata(folder, file, function(err, response){

      if (err) {
        return callback(err, null);
      }

      let fileModifiedMoment;
      
      if (response) {
        fileModifiedMoment = moment(new Date(response.client_modified));
    
        if (fileModifiedMoment.isSameOrBefore(prevConfigFileModifiedMoment)){

          console.log(chalkLog("TNN | CONFIG FILE BEFORE OR EQUAL"
            + " | " + fullPath
            + " | PREV: " + prevConfigFileModifiedMoment.format(compactDateTimeFormat)
            + " | " + fileModifiedMoment.format(compactDateTimeFormat)
          ));
          callback(null, null);
        }
        else {
          console.log(chalkAlert("TNN | +++ CONFIG FILE AFTER ... LOADING"
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

          loadFileRetry({folder: folder, file: file}, function(err, loadedConfigObj){

            if (err) {
              console.error(chalkError("TNN | ERROR LOAD DROPBOX CONFIG: " + file
                + "\n" + jsonPrint(err)
              ));
              callback(err, false);
            }
            else if ((loadedConfigObj === undefined) || !loadedConfigObj) {
              console.log(chalkError("TNN | DROPBOX CONFIG LOAD FILE ERROR | JSON UNDEFINED ??? "));
              callback("JSON UNDEFINED", null);
            }

            else {

              console.log(chalkInfo("TNN | LOADED CONFIG FILE: " + file + "\n" + jsonPrint(loadedConfigObj)));

              let newConfiguration = {};
              newConfiguration.evolve = {};

              if (loadedConfigObj.TNN_OFFLINE_MODE  !== undefined){
                console.log("TNN | LOADED TNN_OFFLINE_MODE: " + loadedConfigObj.TNN_OFFLINE_MODE);

                if ((loadedConfigObj.TNN_OFFLINE_MODE === false) || (loadedConfigObj.TNN_OFFLINE_MODE === "false")) {
                  newConfiguration.offlineMode = false;
                }
                else if ((loadedConfigObj.TNN_OFFLINE_MODE === true) || (loadedConfigObj.TNN_OFFLINE_MODE === "true")) {
                  newConfiguration.offlineMode = true;
                }
                else {
                  newConfiguration.offlineMode = false;
                }
              }

              if (loadedConfigObj.TNN_SERVER_MODE  !== undefined){
                console.log("TNN | LOADED TNN_SERVER_MODE: " + loadedConfigObj.TNN_SERVER_MODE);

                if ((loadedConfigObj.TNN_SERVER_MODE === true) || (loadedConfigObj.TNN_SERVER_MODE === "true")) {
                  newConfiguration.serverMode = true;
                }
                else {
                  newConfiguration.serverMode = false;
                }
              }

              if (loadedConfigObj.TNN_UTIL_TARGET_SERVER !== undefined){
                console.log("TNN | LOADED TNN_UTIL_TARGET_SERVER: " + loadedConfigObj.TNN_UTIL_TARGET_SERVER);
                newConfiguration.targetServer = loadedConfigObj.TNN_UTIL_TARGET_SERVER;
              }


              if (loadedConfigObj.TNN_QUIT_ON_COMPLETE !== undefined) {
                console.log("TNN | LOADED TNN_QUIT_ON_COMPLETE: " + loadedConfigObj.TNN_QUIT_ON_COMPLETE);
                if (!loadedConfigObj.TNN_QUIT_ON_COMPLETE || (loadedConfigObj.TNN_QUIT_ON_COMPLETE === "false")) {
                  newConfiguration.quitOnComplete = false ;
                }
                else {
                  newConfiguration.quitOnComplete = true ;
                }
              }

              if (loadedConfigObj.TNN_CREATE_TRAINING_SET  !== undefined){
                console.log("TNN | CREATE TRAINING SET");

                if (!loadedConfigObj.TNN_CREATE_TRAINING_SET || (loadedConfigObj.TNN_CREATE_TRAINING_SET === "false")) {
                  newConfiguration.createTrainingSet = false;
                }
                else {
                  newConfiguration.createTrainingSet = true;
                }
              }

              if (loadedConfigObj.TNN_CREATE_TRAINING_SET_ONLY  !== undefined){
                console.log("TNN | CREATE TRAINING SET ONLY");

                if (!loadedConfigObj.TNN_CREATE_TRAINING_SET_ONLY || (loadedConfigObj.TNN_CREATE_TRAINING_SET_ONLY === "false")) {
                  newConfiguration.createTrainingSetOnly = false;
                }
                else {
                  newConfiguration.createTrainingSet = true;
                  newConfiguration.createTrainingSetOnly = true;
                }
              }

              if (loadedConfigObj.TNN_LOAD_TRAINING_SET_FROM_FILE  !== undefined){
                console.log("TNN | LOADED TNN_LOAD_TRAINING_SET_FROM_FILE: " + loadedConfigObj.TNN_LOAD_TRAINING_SET_FROM_FILE);

                if (!loadedConfigObj.TNN_LOAD_TRAINING_SET_FROM_FILE || (loadedConfigObj.TNN_LOAD_TRAINING_SET_FROM_FILE === "false")) {
                  newConfiguration.loadTrainingSetFromFile = false;
                }
                else if (!newConfiguration.createTrainingSet && !newConfiguration.createTrainingSetOnly) {
                  newConfiguration.loadTrainingSetFromFile = true;
                }
              }

              if (loadedConfigObj.TNN_USE_LOCAL_TRAINING_SETS  !== undefined){
                console.log("TNN | LOADED TNN_USE_LOCAL_TRAINING_SETS: " + loadedConfigObj.TNN_USE_LOCAL_TRAINING_SETS);

                if (!loadedConfigObj.TNN_USE_LOCAL_TRAINING_SETS || (loadedConfigObj.TNN_USE_LOCAL_TRAINING_SETS === "false")) {
                  newConfiguration.useLocalTrainingSets = false;
                }
                else {
                  newConfiguration.useLocalTrainingSets = true;
                }
              }

              if (loadedConfigObj.TNN_LOAD_ALL_INPUTS !== undefined){
                console.log("TNN | LOADED TNN_LOAD_ALL_INPUTS: " + loadedConfigObj.TNN_LOAD_ALL_INPUTS);

                if ((loadedConfigObj.TNN_LOAD_ALL_INPUTS === true) || (loadedConfigObj.TNN_LOAD_ALL_INPUTS === "true")) {
                  newConfiguration.loadAllInputs = true;
                }
                else {
                  newConfiguration.loadAllInputs = false;
                }
              }

              if (loadedConfigObj.TNN_DELETE_NOT_IN_INPUTS_ID_ARRAY !== undefined){
                console.log("TNN | LOADED TNN_DELETE_NOT_IN_INPUTS_ID_ARRAY: " + loadedConfigObj.TNN_DELETE_NOT_IN_INPUTS_ID_ARRAY);

                if ((loadedConfigObj.TNN_DELETE_NOT_IN_INPUTS_ID_ARRAY === true) || (loadedConfigObj.TNN_DELETE_NOT_IN_INPUTS_ID_ARRAY === "true")) {
                  newConfiguration.deleteNotInInputsIdArray = true;
                }
                else {
                  newConfiguration.deleteNotInInputsIdArray = false;
                }

              }

              if (loadedConfigObj.TNN_INPUTS_IDS !== undefined){
                console.log("TNN | LOADED TNN_INPUTS_IDS: " + loadedConfigObj.TNN_INPUTS_IDS);
                newConfiguration.inputsIdArray = loadedConfigObj.TNN_INPUTS_IDS;
              }

              if (loadedConfigObj.TNN_INPUTS_ID !== undefined){
                console.log("TNN | LOADED TNN_INPUTS_ID: " + loadedConfigObj.TNN_INPUTS_ID);
                newConfiguration.inputsId = loadedConfigObj.TNN_INPUTS_ID;
              }

              if (loadedConfigObj.TNN_SEED_NETWORK_PROBABILITY !== undefined){
                console.log("TNN | LOADED TNN_SEED_NETWORK_PROBABILITY: " + loadedConfigObj.TNN_SEED_NETWORK_PROBABILITY);
                newConfiguration.seedNetworkProbability = loadedConfigObj.TNN_SEED_NETWORK_PROBABILITY;
              }

              if (loadedConfigObj.TNN_INIT_MAIN_INTERVAL !== undefined){
                console.log("TNN | LOADED TNN_INIT_MAIN_INTERVAL: " + loadedConfigObj.TNN_INIT_MAIN_INTERVAL);
                newConfiguration.initMainIntervalTime = loadedConfigObj.TNN_INIT_MAIN_INTERVAL;
              }

              if (loadedConfigObj.TNN_MAX_NEURAL_NETWORK_CHILDREN !== undefined){
                console.log("TNN | LOADED TNN_MAX_NEURAL_NETWORK_CHILDREN: " + loadedConfigObj.TNN_MAX_NEURAL_NETWORK_CHILDREN);
                newConfiguration.maxNeuralNetworkChildern = loadedConfigObj.TNN_MAX_NEURAL_NETWORK_CHILDREN;
              }

              if (loadedConfigObj.TNN_SEED_RANDOMIZE_OPTIONS !== undefined){
                console.log("TNN | LOADED TNN_SEED_RANDOMIZE_OPTIONS: " + loadedConfigObj.TNN_SEED_RANDOMIZE_OPTIONS);
                newConfiguration.randomizeSeedOptions = loadedConfigObj.TNN_SEED_RANDOMIZE_OPTIONS;
              }

              if (loadedConfigObj.TNN_EVOLVE_COST_ARRAY !== undefined){
                console.log("TNN | LOADED TNN_EVOLVE_COST_ARRAY: " + loadedConfigObj.TNN_EVOLVE_COST_ARRAY);
                newConfiguration.costArray = loadedConfigObj.TNN_EVOLVE_COST_ARRAY;
              }

              if (loadedConfigObj.TNN_GLOBAL_MIN_SUCCESS_RATE !== undefined){
                console.log("TNN | LOADED TNN_GLOBAL_MIN_SUCCESS_RATE: " + loadedConfigObj.TNN_GLOBAL_MIN_SUCCESS_RATE);
                newConfiguration.globalMinSuccessRate = loadedConfigObj.TNN_GLOBAL_MIN_SUCCESS_RATE;
              }

              if (loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE !== undefined){
                console.log("TNN | LOADED TNN_LOCAL_MIN_SUCCESS_RATE: " + loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE);
                newConfiguration.localMinSuccessRate = loadedConfigObj.TNN_LOCAL_MIN_SUCCESS_RATE;
              }

              if (loadedConfigObj.TNN_LOCAL_PURGE_MIN_SUCCESS_RATE !== undefined){
                console.log("TNN | LOADED TNN_LOCAL_PURGE_MIN_SUCCESS_RATE: " + loadedConfigObj.TNN_LOCAL_PURGE_MIN_SUCCESS_RATE);
                newConfiguration.localPurgeMinSuccessRate = loadedConfigObj.TNN_LOCAL_PURGE_MIN_SUCCESS_RATE;
              }

              if (loadedConfigObj.TNN_EVOLVE_THREADS !== undefined){
                console.log("TNN | LOADED TNN_EVOLVE_THREADS: " + loadedConfigObj.TNN_EVOLVE_THREADS);
                newConfiguration.evolve.threads = loadedConfigObj.TNN_EVOLVE_THREADS;
              }

              if (loadedConfigObj.TNN_SEED_NETWORK_ID  !== undefined){
                console.log("TNN | LOADED TNN_SEED_NETWORK_ID: " + loadedConfigObj.TNN_SEED_NETWORK_ID);
                newConfiguration.evolve.networkId = loadedConfigObj.TNN_SEED_NETWORK_ID;
              }

              if (loadedConfigObj.TNN_TRAIN_BEST_NETWORK  !== undefined){
                console.log("TNN | LOADED TNN_TRAIN_BEST_NETWORK: " + loadedConfigObj.TNN_TRAIN_BEST_NETWORK);
                newConfiguration.train.useBestNetwork = loadedConfigObj.TNN_TRAIN_BEST_NETWORK;
              }

              if (loadedConfigObj.TNN_EVOLVE_BEST_NETWORK  !== undefined){
                console.log("TNN | LOADED TNN_EVOLVE_BEST_NETWORK: " + loadedConfigObj.TNN_EVOLVE_BEST_NETWORK);
                newConfiguration.evolve.useBestNetwork = loadedConfigObj.TNN_EVOLVE_BEST_NETWORK;
              }

              if (loadedConfigObj.TNN_EVOLVE_ITERATIONS  !== undefined){
                console.log("TNN | LOADED TNN_EVOLVE_ITERATIONS: " + loadedConfigObj.TNN_EVOLVE_ITERATIONS);
                newConfiguration.evolve.iterations = loadedConfigObj.TNN_EVOLVE_ITERATIONS;
              }

              if (loadedConfigObj.TNN_TRAIN_ITERATIONS  !== undefined){
                console.log("TNN | LOADED TNN_TRAIN_ITERATIONS: " + loadedConfigObj.TNN_TRAIN_ITERATIONS);
                newConfiguration.train.iterations = loadedConfigObj.TNN_TRAIN_ITERATIONS;
              }

              if (loadedConfigObj.TNN_VERBOSE_MODE  !== undefined){
                console.log("TNN | LOADED TNN_VERBOSE_MODE: " + loadedConfigObj.TNN_VERBOSE_MODE);
                newConfiguration.verbose = loadedConfigObj.TNN_VERBOSE_MODE;
              }

              if (loadedConfigObj.TNN_TEST_MODE  !== undefined){
                console.log("TNN | LOADED TNN_TEST_MODE: " + loadedConfigObj.TNN_TEST_MODE);
                newConfiguration.testMode = loadedConfigObj.TNN_TEST_MODE;
              }

              if (loadedConfigObj.TNN_ENABLE_STDIN  !== undefined){
                console.log("TNN | LOADED TNN_ENABLE_STDIN: " + loadedConfigObj.TNN_ENABLE_STDIN);
                newConfiguration.enableStdin = loadedConfigObj.TNN_ENABLE_STDIN;
              }

              if (loadedConfigObj.TNN_STATS_UPDATE_INTERVAL  !== undefined) {
                console.log("TNN | LOADED TNN_STATS_UPDATE_INTERVAL: " + loadedConfigObj.TNN_STATS_UPDATE_INTERVAL);
                newConfiguration.statsUpdateIntervalTime = loadedConfigObj.TNN_STATS_UPDATE_INTERVAL;
              }

              if (loadedConfigObj.TNN_KEEPALIVE_INTERVAL  !== undefined) {
                console.log("TNN | LOADED TNN_KEEPALIVE_INTERVAL: " + loadedConfigObj.TNN_KEEPALIVE_INTERVAL);
                newConfiguration.keepaliveInterval = loadedConfigObj.TNN_KEEPALIVE_INTERVAL;
              }

              callback(null, newConfiguration);

            }
          });
        }
      }
      else {
        console.log(chalkAlert("TNN | ??? CONFIG FILE NOT FOUND ... SKIPPING | " + fullPath ));
        callback(null, null);
      }

    });
  }
}

function loadSeedNeuralNetwork(params, callback){

  statsObj.status = "LOAD NEURAL NETWORKS";

  debug(chalkNetwork("TNN | ... LOADING SEED NETWORK FROM DB\nPARAMS: " + jsonPrint(params)));

  loadBestNetworkDropboxFolders(params, function(err, numNetworksLoaded){

    if (err) {
      if (err.status === 429) {
        console.log(chalkError("TNN | LOAD DROPBOX BEST NETWORK ERR"
          + " | FOLDERS: " + params.folders
          + " | STATUS: " + err.status
          + " | TOO MANY REQUESTS"
        ));
      }
      else {
        console.log(chalkError("TNN | LOAD DROPBOX BEST NETWORK ERR"
          + " | FOLDERS: " + params.folders
          + " | STATUS: " + err.status
          + " | ERROR: " + err
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
            "TNN | ",
            "TC",
            "TCH",
            "OAMR %",
            "MR %",
            "SR %",
            "INPUTS",
            "INPUTS ID",
            "NNID"
          ]);

          sortedBestNetworks.sortedKeys.forEach(function(nnId){

            if (bestNetworkHashMap.has(nnId)) {

              const nn = bestNetworkHashMap.get(nnId).networkObj;

              if ((nn.overallMatchRate === undefined) || (nn.matchRate === undefined) || (nn.successRate === undefined)) {
                console.log(chalkAlert("BEST NETWORK UNDEFINED RATE"
                  + " | " + nnId
                  + " | OAMR: " + nn.overallMatchRate
                  + " | MR: " + nn.matchRate
                  + " | SR: " + nn.successRate
                ));
              }

              tableArray.push([
                "TNN | ",
                nn.testCycles,
                nn.testCycleHistory.length,
                nn.overallMatchRate.toFixed(2),
                nn.matchRate.toFixed(2),
                nn.successRate.toFixed(2),
                nn.numInputs,
                nn.inputsId,
                nnId
              ]);
            }
            else {
              console.log(chalkAlert("BEST NETWORK NOT IN HASHMAP??"
                + " | " + nnId
              ));
            }

          });

          const t = table(tableArray, { align: ["l", "r", "r", "r", "r", "r", "r", "l", "l"] });

          console.log("TNN | ============================================================================================================================================");

          console.log(chalkLog("TNN | ... NO BEST NETWORKS CHANGED / LOADED | NNs IN HM: " + sortedBestNetworks.sortedKeys.length));

          if (configuration.verbose) { console.log(t); }

          console.log("TNN | ============================================================================================================================================");
        })
        .catch(function(err){
          console.trace(chalkError("generateRandomEvolveConfig sortedHashmap ERROR: " + err + "/" + jsonPrint(err)));
        });
      }

      if (callback !== undefined) { callback(err, numNetworksLoaded); }
    }
    else {

      sortedHashmap({ sortKey: "networkObj.overallMatchRate", hashmap: bestNetworkHashMap, max: 500})
      .then(function(sortedBestNetworks){

        let tableArray = [];

        tableArray.push([
          "TNN | ",
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

        async.eachSeries(sortedBestNetworks.sortedKeys, function(nnId, cb){

          if (bestNetworkHashMap.has(nnId)) {

            nn = bestNetworkHashMap.get(nnId).networkObj;

            if ((nn.overallMatchRate === undefined) || (nn.matchRate === undefined) || (nn.successRate === undefined)) {
              console.log(chalkAlert("BEST NETWORK UNDEFINED RATE"
                + " | " + nnId
                + " | OAMR: " + nn.overallMatchRate
                + " | MR: " + nn.matchRate
                + " | SR: " + nn.successRate
              ));
            }

            tableArray.push([
              "TNN | ",
              nn.testCycles,
              nn.testCycleHistory.length,
              nn.overallMatchRate.toFixed(2),
              nn.matchRate.toFixed(2),
              nn.successRate.toFixed(2),
              nn.numInputs,
              nn.inputsId,
              nnId
            ]);

            async.setImmediate(function() { cb(); });
          }
          else {
            async.setImmediate(function() { cb(); });
          }

        }, function(){

          const t = table(tableArray, { align: ["l", "r", "r", "r", "r", "r", "r", "l", "l"] });

          console.log("TNN | ============================================================================================================================================");
          console.log(chalkInfo("TNN | +++ BEST NETWORKS CHANGED / LOADED | NNs IN HM: " + sortedBestNetworks.sortedKeys.length));
          console.log(t);
          console.log("TNN | ============================================================================================================================================");

        });
      })
      .catch(function(err){
        console.trace(chalkError("generateRandomEvolveConfig sortedHashmap ERROR: " + err + "/" + jsonPrint(err)));
      });

      if (callback !== undefined) { callback(null, null); }

    }
  });
}

function loadAllConfigFiles(callback){

  statsObj.status = "LOAD CONFIG";

  async.series({

    defaultConfig: function(cb) {
      loadConfigFile(dropboxConfigDefaultFolder, dropboxConfigDefaultFile, function(err, defaultConfig){

        if (err) {
          console.log(chalkError("TNN | ERROR LOADED DEFAULT CONFIG " + dropboxConfigDefaultFolder + "/" + dropboxConfigDefaultFile));
          console.log(chalkError("TNN | ERROR LOADED DEFAULT CONFIG " + err));
          return cb(err);
        }

        if (defaultConfig) {

          // defaultConfiguration = deepcopy(defaultConfig);
          defaultConfiguration = defaultConfig;

          console.log(chalkAlert("TNN | +++ RELOADED DEFAULT CONFIG " + dropboxConfigDefaultFolder + "/" + dropboxConfigDefaultFile));

          cb();
        }
        else {
          cb();
        }

      });
    },

    hostConfig: function(cb){
      loadConfigFile(dropboxConfigHostFolder, dropboxConfigHostFile, function(err, hostConfig){

        if (err) {
          console.log(error("TNN | ERROR LOADED HOST CONFIG " + dropboxConfigHostFolder + "/" + dropboxConfigHostFile));
          console.log(error("TNN | ERROR LOADED HOST CONFIG " + err));
          return cb(err);
        }

        if (hostConfig) {

          // hostConfiguration = deepcopy(hostConfig);
          hostConfiguration = hostConfig;

          console.log(chalkAlert("TNN | +++ RELOADED HOST CONFIG " + dropboxConfigHostFolder + "/" + dropboxConfigHostFile));

          cb();
        }
        else {
          cb();
        }

      });
    }

  }, function(err, results) {

    if (err) {
      console.log(chalkError("LOAD ALL CONFIG FILES ERROR: " + err));
      return callback(err);
    }

    let defaultAndHostConfig = merge(defaultConfiguration, hostConfiguration); // host settings override defaults
    let tempConfig = merge(configuration, defaultAndHostConfig); // any new settings override existing config

    // configuration = deepcopy(tempConfig);
    configuration = tempConfig;

    callback();
  });
}

function initialize(cnf, callback){

  statsObj.status = "INITIALIZE";

  debug(chalkBlue("INITIALIZE cnf\n" + jsonPrint(cnf)));

  if (debug.enabled || debugCache.enabled || debugQ.enabled){
    console.log("\nTNN | %%%%%%%%%%%%%%\nTNN |  DEBUG ENABLED \nTNN | %%%%%%%%%%%%%%\n");
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
    console.log("TNN | ENV TNN_QUIT_ON_COMPLETE: " + process.env.TNN_QUIT_ON_COMPLETE);
    if (!process.env.TNN_QUIT_ON_COMPLETE || (process.env.TNN_QUIT_ON_COMPLETE === false) || (process.env.TNN_QUIT_ON_COMPLETE === "false")) {
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
    console.log("TNN | ENV TNN_LOAD_TRAINING_SET_FROM_FILE: " + process.env.TNN_LOAD_TRAINING_SET_FROM_FILE);
    if (!process.env.TNN_LOAD_TRAINING_SET_FROM_FILE || (process.env.TNN_LOAD_TRAINING_SET_FROM_FILE === "false")) {
      cnf.loadTrainingSetFromFile = false ;
    }
    else if (!cnf.createTrainingSet && !cnf.createTrainingSetOnly) {
      cnf.loadTrainingSetFromFile = true ;
    }
  }

  if (process.env.TNN_USE_LOCAL_TRAINING_SETS !== undefined) {
    console.log("TNN | ENV TNN_USE_LOCAL_TRAINING_SETS: " + process.env.TNN_USE_LOCAL_TRAINING_SETS);
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
    console.log("TNN | LOADED TNN_LOAD_ALL_INPUTS: " + process.env.TNN_LOAD_ALL_INPUTS);

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
  cnf.statsUpdateIntervalTime = process.env.TNN_STATS_UPDATE_INTERVAL || 10000;

  debug(chalkWarn("dropboxConfigDefaultFolder: " + dropboxConfigDefaultFolder));
  debug(chalkWarn("dropboxConfigDefaultFile  : " + dropboxConfigDefaultFile));


  loadAllConfigFiles(function(err){

    loadCommandLineArgs(function(err, results){
    
      const configArgs = Object.keys(configuration);

      configArgs.forEach(function(arg){
        if (_.isObject(configuration[arg])) {
          console.log("TNN | _FINAL CONFIG | " + arg + "\n" + jsonPrint(configuration[arg]));
        }
        else {
          console.log("TNN | _FINAL CONFIG | " + arg + ": " + configuration[arg]);
        }
      });
      
      statsObj.commandLineArgsLoaded = true;


      if (configuration.enableStdin) {
        initStdIn();
      }

      connectDb(function(err, db){
        if (err) {
          dbConnectionReady = false;
          return callback(err, configuration);
        }

        global.dbConnection = db;

        UserServerController = require("@threeceelabs/user-server-controller");
        userServerController = new UserServerController("TNN_USC");

        userServerControllerReady = false;

        userServerController.on("ready", function(appname){
          userServerControllerReady = true;
          console.log(chalkGreen("TNN | +++ USC READY | " + appname));
        });

        // if (configuration.createTrainingSet || configuration.createTrainingSetOnly){
        //   initArchiver({outputFile: configuration.defaultUserArchivePath});
        // }

        initStatsUpdate(configuration);

        loadInputsDropboxFolder(defaultInputsFolder, function(err, results){
          callback(err, configuration);
        });
      });

    });
  });
}

console.log(chalkInfo("TNN | " + getTimeStamp() 
  + " | WAIT 5 SEC FOR MONGO BEFORE INITIALIZE CONFIGURATION"
));

configEvents.once("INIT_MONGODB", function(){

  console.log(chalkLog("TNN | INIT_MONGODB"));

});

let userMaxInputHashMap = {};

// FUTURE: break up into updateCategorizedUsers and createTrainingSet
function updateCategorizedUsers(cnf, callback){

  statsObj.status = "UPDATE CATEGORIZED USERS";

  let userSubDirectory = (hostname === "google") ? configuration.defaultTrainingSetsFolder + "/users"
  : configuration.hostTrainingSetsFolder + "/users";

  let userFile;

  userServerController.resetMaxInputsHashMap();

  let categorizedNodeIds = categorizedUserHashmap.keys();

  if (cnf.testMode) {
    categorizedNodeIds.length = TEST_MODE_LENGTH;
    console.log(chalkAlert("TNN | *** TEST MODE *** | CATEGORIZE MAX " + TEST_MODE_LENGTH + " USERS"));
  }

  let maxMagnitude = -Infinity;
  let minScore = Infinity;
  let maxScore = -Infinity;

  console.log(chalkBlue("TNN | UPDATE CATEGORIZED USERS: " + categorizedNodeIds.length));

  if (cnf.normalization) {
    maxMagnitude = cnf.normalization.magnitude.max;
    minScore = cnf.normalization.score.min;
    maxScore = cnf.normalization.score.max;
    console.log(chalkInfo("TNN | SET NORMALIZATION\n" + jsonPrint(cnf.normalization)));
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
        console.error(chalkError("TNN | *** UPDATE CATEGORIZED USERS: USER FIND ONE ERROR: " + err));
        statsObj.errors.users.findOne += 1;
        return cb0(err) ;
      }

      if (!user){
        console.log(chalkLog("TNN | *** UPDATE CATEGORIZED USERS: USER NOT FOUND: NID: " + nodeId));
        statsObj.users.notFound += 1;
        statsObj.users.notCategorized += 1;
        return cb0() ;
      }

      if (user.screenName === undefined) {
        console.log(chalkError("TNN | *** UPDATE CATEGORIZED USERS: USER SCREENNAME UNDEFINED\n" + jsonPrint(user)));
        statsObj.users.screenNameUndefined += 1;
        statsObj.users.notCategorized += 1;
        return cb0("USER SCREENNAME UNDEFINED", null) ;
      }

      debug(chalkInfo("TNN | UPDATE CL USR <DB"
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

        debug(chalkLog("\n==============================\n"));
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

          console.log(chalkLog("TNN"
            + " | START: " + categorizedUsersStartMoment.format(compactDateTimeFormat)
            + " | ELAPSED: " + msToTime(categorizedUsersElapsed)
            + " | REMAIN: " + msToTime(categorizedUsersRemain)
            + " | ETC: " + categorizedUsersEndMoment.format(compactDateTimeFormat)
            + " | " + (statsObj.users.notCategorized + statsObj.users.updatedCategorized) + "/" + categorizedNodeIds.length
            + " (" + categorizedUsersPercent.toFixed(1) + "%)"
            + " USERS CATEGORIZED"
          ));

          console.log(chalkLog("TNN | CL U HIST"
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
          function userLocation(text, cb) {
            if (user.location !== undefined) {
              if (text) {
                cb(null, text + " | " + user.location);
              }
              else {
                cb(null, user.location);
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
                  debug(chalkInfo("TNN | PARSE BANNER IMAGE"
                    + " | RESULTS\n" + jsonPrint(results)
                  ));
                  if (results.text !== undefined) {
                    console.log(chalkInfo("TNN | +++ BANNER ANALYZED: @" + user.screenName + " | " + classText + " | " + results.text));
                    text = text + "\n" + results.text;
                  }

                  cb(null, text, results);
                }
              });
            }
            else if (user.bannerImageUrl && user.bannerImageAnalyzed && (user.bannerImageUrl === user.bannerImageAnalyzed)) {

              statsObj.users.imageParse.skipped += 1;

              const imageHits = (user.histograms.images === undefined) ? 0 : Object.keys(user.histograms.images);
              debug(chalkLog("--- BANNER HIST HIT: @" + user.screenName + " | HITS: " + imageHits));

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
            return cb0(err) ;
          }

          if (!text || (text === undefined)) { text = " "; }

          // parse the user's text for hashtags, urls, emoji, screenNames, and words; create histogram

          twitterTextParser.parseText(text, {updateGlobalHistograms: true}, function(err, hist){

            if (err) {
              console.error("*** PARSE TEXT ERROR\n" + err);
              return cb0(err);
            }

            if (bannerResults && bannerResults.label && bannerResults.label.images) {
              hist.images = bannerResults.label.images;
            }

            const updateHistogramsParams = { 
              user: user, 
              histograms: hist, 
              computeMaxInputsFlag: true,
              accumulateFlag: true
            };

            userServerController.updateHistograms(updateHistogramsParams, function(err, updatedUser){

              if (err) {
                console.error("*** UPDATE USER HISTOGRAMS ERROR\n" + err);
                return cb0(err);
              }

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

              cb0();

            });

          });

        });   
      }
      else {

        statsObj.users.notCategorized += 1;

        if (statsObj.users.notCategorized % 10 === 0){
          console.log(chalkLog("TNN | " + statsObj.users.notCategorized + " USERS NOT CATEGORIZED"));
        }

        debug(chalkBlue("TNN *** USR DB NOT CL"
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

          console.log(chalkLog("TNN"
            + " | START: " + categorizedUsersStartMoment.format(compactDateTimeFormat)
            + " | ELAPSED: " + msToTime(categorizedUsersElapsed)
            + " | REMAIN: " + msToTime(categorizedUsersRemain)
            + " | ETC: " + categorizedUsersEndMoment.format(compactDateTimeFormat)
            + " | " + (statsObj.users.notCategorized + statsObj.users.updatedCategorized) + "/" + categorizedNodeIds.length
            + " (" + categorizedUsersPercent.toFixed(1) + "%)"
            + " USERS CATEGORIZED"
          ));

          console.log(chalkLog("TNN | CL U HIST"
            + " | L: " + categorizedUserHistogram.left
            + " | R: " + categorizedUserHistogram.right
            + " | N: " + categorizedUserHistogram.neutral
            + " | +: " + categorizedUserHistogram.positive
            + " | -: " + categorizedUserHistogram.negative
            + " | 0: " + categorizedUserHistogram.none
          ));

        }

        user.category = categorizedUserHashmap.get(nodeId).manual;

        userServerController.findOneUser(user, {noInc: true}, function(err, updatedUser){
          if (err) {
            return cb0(err);
          }
          debug("updatedUser\n" + jsonPrint(updatedUser));
          cb0();
        });
      }
    });

  }, function(err){

    if (err) {
      if (err === "INTERRUPT") {
        console.log(chalkAlert("TNN | INTERRUPT"));
      }
      else {
        console.log(chalkError("TNN | UPDATE CATEGORIZED USERS ERROR: " + err));
      }
    }

    userMaxInputHashMap = userServerController.getMaxInputsHashMap();

    // console.log("MAX INPUT HASHMAP keys\n" + Object.keys(userMaxInputHashMap.images));

    categorizedUsersPercent = 100 * (statsObj.users.notCategorized + statsObj.users.updatedCategorized)/categorizedNodeIds.length;
    categorizedUsersElapsed = (moment().valueOf() - categorizedUsersStartMoment.valueOf()); // mseconds
    categorizedUsersRate = categorizedUsersElapsed/statsObj.users.updatedCategorized; // msecs/userCategorized
    categorizedUsersRemain = (categorizedNodeIds.length - (statsObj.users.notCategorized + statsObj.users.updatedCategorized)) * categorizedUsersRate; // mseconds
    categorizedUsersEndMoment = moment();
    categorizedUsersEndMoment.add(categorizedUsersRemain, "ms");

    console.log(chalkBlueBold("\nTNN | ======================= END CATEGORIZE USERS ======================="
      + "\nTNN | ==== START:   " + categorizedUsersStartMoment.format(compactDateTimeFormat)
      + "\nTNN | ==== ELAPSED: " + msToTime(categorizedUsersElapsed)
      + "\nTNN | ==== REMAIN:  " + msToTime(categorizedUsersRemain)
      + "\nTNN | ==== ETC:     " + categorizedUsersEndMoment.format(compactDateTimeFormat)
      + "\nTNN | ====          " + (statsObj.users.notCategorized + statsObj.users.updatedCategorized) + "/" + categorizedNodeIds.length
      + " (" + categorizedUsersPercent.toFixed(1) + "%)" + " USERS CATEGORIZED"
    ));

    console.log(chalkBlueBold("TNN | CL U HIST"
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

    console.log(chalkLog("TNN | CL U HIST | NORMALIZATION"
      + " | MAG " + statsObj.normalization.magnitude.min.toFixed(2) + " MIN / " + statsObj.normalization.magnitude.max.toFixed(2) + " MAX"
      + " | SCORE " + statsObj.normalization.score.min.toFixed(2) + " MIN / " + statsObj.normalization.score.max.toFixed(2) + " MAX"
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

  statsObj.status = "TEST NETWORK";

  const nw = neataptic.Network.fromJSON(nwObj.network);

  console.log(chalkBlue("TNN | TEST NETWORK"
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

function unzipUsersToArray(params){

  console.log(chalkBlue("TNN | UNZIP USERS TO TRAINING SET: " + params.path));

  return new Promise(async function(resolve, reject) {

    const lockFileName = params.path + ".lock";
    let archiveFileLocked;

    try {

      archiveFileLocked = await getFileLock({file: lockFileName, options: fileLockOptions});

      if (!archiveFileLocked) {

        console.log(chalkAlert("TNN | *** USER ARCHIVE FILE LOCK FAILED: " + params.path));

        statsObj.archiveOpen = false;
        createTrainingSetBusy = false;

        return resolve(false);
      }

      await fileSize({path: params.path});

      yauzl.open(params.path, {lazyEntries: true}, function(err, zipfile) {

        if (err) {
          return reject(err);
        }

        zipfile.on("error", async function(err) {
          console.log(chalkError("TNN | *** UNZIP ERROR: " + err));
          await releaseFileLock({file: lockFileName});
          archiveFileLocked = false;
          reject(err);
        });

        zipfile.on("close", async function() {
          console.log(chalkLog("TNN | UNZIP CLOSE"));
          await releaseFileLock({file: lockFileName});
          archiveFileLocked = false;
          resolve(true);
        });

        zipfile.on("end", async function() {
          console.log(chalkLog("TNN | UNZIP END"));
          await releaseFileLock({file: lockFileName});
          archiveFileLocked = false;
          resolve(true);
        });

        let hmHit = "TNN | --> UNZIP";

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

                    console.log(chalkLog("TNN | UNZIPPED MAX INPUT"));

                    userMaxInputHashMap = fileObj.maxInputHashMap;
                  }
                  else {

                    statsObj.users.unzipped += 1;

                    hmHit = "TNN | --> UNZIP";

                    if (trainingSetUsersHashMap.has(fileObj.userId)) {
                      hmHit = "TNN | **> UNZIP";
                      statsObj.users.zipHashMapHit += 1;
                    }
                    else {
                      statsObj.users.zipHashMapMiss += 1;
                    }

                    percent = 100*(statsObj.users.zipHashMapHit/statsObj.users.unzipped);

                    trainingSetUsersHashMap.set(fileObj.userId, fileObj);

                    if (configuration.verbose || (statsObj.users.unzipped % 1000 === 0)) {
                      console.log(chalkLog(hmHit
                        + " | " + trainingSetUsersHashMap.size + " USERS IN HM"
                        + " [ ZipHM: " + statsObj.users.zipHashMapMiss 
                        + " MISS / " + statsObj.users.zipHashMapHit 
                        + " HIT (" + percent.toFixed(2) + "%) ]"
                        + " | " + statsObj.users.unzipped + " UNZPD ]"
                        + " 3C: " + fileObj.threeceeFollowing
                        + " | " + fileObj.userId
                        + " | @" + fileObj.screenName
                        + " | " + fileObj.name
                        + " | FLWRs: " + fileObj.followersCount
                        + " | FRNDs: " + fileObj.friendsCount
                        + " | CAT M: " + fileObj.category + " A: " + fileObj.categoryAuto
                        // + "\n" + jsonPrint(fileObj)
                      ));
                    }
                  }

                  zipfile.readEntry();
                }
                catch (err){
                  console.log(chalkError("TNN | *** UNZIP READ STREAM ERROR: " + err));
                  await releaseFileLock({file: lockFileName});
                  archiveFileLocked = false;
                  return reject(err);
                }
              });

              readStream.on("data",function(chunk){
                let part = chunk.toString();
                userString += part;
              });

              readStream.on("close", async function(){
                console.log(chalkInfo("TNN | UNZIP STREAM CLOSED | TRAINING SET USERS HM SIZE: " + trainingSetUsersHashMap.size));
                await releaseFileLock({file: lockFileName});
                archiveFileLocked = false;
                resolve();
              });

              readStream.on("error",async function(err){
                console.log(chalkError("TNN | *** UNZIP READ STREAM ERROR: " + err));
                await releaseFileLock({file: lockFileName});
                archiveFileLocked = false;
                reject(err);
              });
            });
          }
        });

        zipfile.readEntry();

      });


    }
    catch(err){
      console.error(chalkError("TNN | *** USER ARCHIVE READ ERROR: " + err));
      return reject(new Error("USER ARCHIVE READ ERROR"));
    }



  });
}

function updateTrainingSet(params){

  console.log(chalkBlue("TNN | UPDATE TRAINING SET"));

  return new Promise(function(resolve, reject) {

    let tObj = {};

    if (trainingSetHashMap.has(configuration.globalTrainingSetId)) {
      tObj = trainingSetHashMap.get(configuration.globalTrainingSetId);
      console.log(chalkInfo("TNN | +++ TRAINING SET HM HIT: " + tObj.trainingSetObj.trainingSetId));
    }
    else {

      console.log(chalkInfo("TNN | --- TRAINING SET HM MISS: " + configuration.globalTrainingSetId + " ... CREATING..."));

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

    console.log(chalkLog("TNN | TRAINING SET"
      + " | SIZE: " + tObj.trainingSetObj.trainingSet.meta.setSize
      + " | TEST SIZE: " + tObj.trainingSetObj.testSet.meta.setSize
    ));

    trainingSetHashMap.set(tObj.trainingSetObj.trainingSetId, tObj);

    resolve();

  });
}

function checkFileOpen(params){

  return new Promise(async function(resolve, reject){

    console.log(chalkLog("TNN | CHECK IF FILE OPEN: " + params.path));

    let checkFileOpenInterval;

    checkFileOpenInterval = setInterval(function(){

      fs.open(params.path,"r+", function(err,fd) {
        if (err) {
          console.log(chalkAlert("TNN | XXX FILE ALREADY OPEN: " + params.path + " | " + err));
          // return resolve(true);
        }
        else {
          clearInterval(checkFileOpenInterval);
          console.log(chalkLog("TNN | ... FILE NOT OPEN: " + params.path));
          fs.close(fd, function(err){
            if (err) {
              return reject(err);
            }
            resolve(false);
          });
        }
 
      });

    }, 1000);

  });
}

let sizeInterval;

function fileSize(params){

  return new Promise(async function(resolve, reject){

    clearInterval(sizeInterval);

    let interval = params.interval || ONE_MINUTE;

    console.log(chalkLog("TNN | WAIT FILE SIZE: " + params.path));

    let stats;
    let size;
    let prevSize;

    try {
      stats = fs.statSync(params.path);
      size = stats.size;
      prevSize = stats.size;
    }
    catch(err){
      return reject(err);
    }


    sizeInterval = setInterval(async function(){

      console.log(chalkInfo("TNN | FILE SIZE | " + getTimeStamp()
        + " | CUR: " + size
        + " | PREV: " + prevSize
      ));

      fs.stat(params.path, function(err, stats){

        if (err) {
          return reject(err);
        }

        prevSize = size;
        size = stats.size;

        if ((size > 0) && (size === prevSize)) {

          clearInterval(sizeInterval);

          console.log(chalkInfo("TNN | FILE SIZE STABLE | " + getTimeStamp()
            + " | CUR: " + size
            + " | PREV: " + prevSize
          ));

          resolve();
        }

      });

    }, interval);

  });
}

function loadUsersArchive(params){

  return new Promise(async function(resolve, reject){

    console.log(chalkLog("TNN | LOADING USERS ARCHIVE | " + getTimeStamp() + " | " + params.path));

    try {
      const fileOpen = await checkFileOpen({path: params.path});
      await fileSize({path: params.path});
      const unzipSuccess = await unzipUsersToArray({path: params.path});
      await updateTrainingSet();
      resolve();
    }
    catch(err){
      console.log(chalkError("TNN | *** LOAD USERS ARCHIVE ERROR | " + getTimeStamp() + " | " + err));
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

  console.log(chalkLog("TNN | INIT WATCH\n" + jsonPrint(params)));

  watch.createMonitor(params.rootFolder, watchOptions, function (monitor) {

    monitor.on("created", async function (f, stat) {

      console.log(chalkInfo("TNN | +++ FILE CREATED | " + getTimeStamp() + " | " + f));

      if (f.endsWith("users.zip")){

        if  (statsObj.loadUsersArchiveBusy) {
          console.log(chalkInfo("TNN | LOAD USERS ARCHIVE ALREADY BUSY | " + getTimeStamp() + " | " + f));
        }
        else {
          statsObj.loadUsersArchiveBusy = true;

          setTimeout(async function(){
            try {
              await loadUsersArchive({path: f});
              statsObj.loadUsersArchiveBusy = false;
            }
            catch(err){
              statsObj.loadUsersArchiveBusy = false;
              console.log(chalkError("TNN | *** WATCH CHANGE ERROR | " + getTimeStamp() + " | " + err));
            }
          }, 30*ONE_SECOND);

        }

      }
    });

    monitor.on("changed", async function (f, curr, prev) {

      console.log(chalkInfo("TNN | !!! FILE CHANGED: " + f));

      if (f.endsWith("users.zip")){

        if  (statsObj.loadUsersArchiveBusy) {
          console.log(chalkAlert("TNN | LOAD USERS ARCHIVE ALREADY BUSY | " + getTimeStamp() + " | " + f));
        }
        else {
          statsObj.loadUsersArchiveBusy = true;

          setTimeout(async function(){
            try {
              await loadUsersArchive({path: f});
              statsObj.loadUsersArchiveBusy = false;
            }
            catch(err){
              statsObj.loadUsersArchiveBusy = false;
              console.log(chalkError("TNN | *** WATCH CHANGE ERROR | " + getTimeStamp() + " | " + err));
            }
          }, 30*ONE_SECOND);
        }
      }
    });

    monitor.on("removed", function (f, stat) {
      console.log(chalkInfo("TNN | XXX FILE DELETED | " + getTimeStamp() + " | " + f));
    });

    // monitor.stop(); // Stop watching
  })
}

function initCategorizedUserHashmap(callback){

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
          console.error(chalkError("TNN | ERROR: initCategorizedUserHashmap: " + err));
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

            console.log(chalkLog("TNN | LOADING CATEGORIZED USERS FROM DB"
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

          console.log(chalkLog("TNN | LOADING CATEGORIZED USERS FROM DB"
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
        console.log(chalkError("TNN | INIT CATEGORIZED USER HASHMAP ERROR: " + err + "\n" + jsonPrint(err)));
      }
      callback(err);
    }
  );
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

  console.log(chalkBlueBold("TNN | ==================================================================="));
  console.log(chalkBlueBold("TNN | GENERATE TRAINING SET | " + trainingSetUsersHashMap.size + " USERS | " + getTimeStamp()));
  console.log(chalkBlueBold("TNN | ==================================================================="));

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

      if (!statsObj.archiveOpen && !createTrainingSetBusy) {

        clearInterval(waitArchiveDoneInterval);

        const lockFileName = configuration.defaultUserArchivePath + ".lock";

        setTimeout(async function(){

          await releaseFileLock({file: lockFileName});
          console.log(chalkBlueBold("TNN | ARCHIVE | DONE"));
          callback();

        }, 30*ONE_SECOND);

      }
      else {
        console.log(chalkLog("TNN | ARCHIVE | WAIT DONE"
          + " | ARCHIVE OPEN: " + statsObj.archiveOpen
          + " | CREATE TSET BUSY: " + createTrainingSetBusy
        ));
      }

    }, 5000);

  }
  catch(err){
    console.log(chalkLog("TNN | *** ARCHIVE ERROR: " + err));
    throw err;
  }

}

function generateRandomEvolveConfig (cnf, callback){

  statsObj.status = "GENERATE EVOLVE CONFIG";

  let config = {};
  config.networkCreateMode = "evolve";

  debug(chalkLog("TNN | NETWORK CREATE MODE: " + config.networkCreateMode));

  sortedHashmap({ sortKey: "networkObj.overallMatchRate", hashmap: bestNetworkHashMap, max: 500})
  .then(function(sortedBestNetworks){

    if (configuration.verbose) {

      console.log(chalkLog("\nTNN | BEST NETWORKS\nTNN | --------------------------------------------------------"));
      console.log(chalkLog("TNN | NNs IN HM: " + sortedBestNetworks.sortedKeys.length));

      sortedBestNetworks.sortedKeys.forEach(function(nnId){

        const nn = bestNetworkHashMap.get(nnId).networkObj;

        printNetworkObj("TNN", nn);

      });

    }

    console.log(chalkLog("TNN | --------------------------------------------------------"));
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

    console.log(chalkBlueBold("TNN | USING BETTER CHILD SEED"
      + " [" + betterChildSeedNetworkIdSet.size + "] SEED: " + config.seedNetworkId
    ));
  }
  else {
    config.seedNetworkId = (Math.random() <= cnf.seedNetworkProbability) ? randomItem(bestNetworkHashMap.keys()) : false;
    config.isBetterChildSeed = false;
  }
  
  // seedInputsId only used if seedNetworkId == false

  const inputsHashMapKeys = inputsHashMap.keys();

  debug(chalkLog("TNN | inputsHashMapKeys: " + inputsHashMapKeys));

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

    console.log("TNN | SEED NETWORK | " + config.seedNetworkId);

    // bestNetworkHashMap entry --> bnhmObj = { entry: entry, networkObj: networkObj }
    const networkObj = bestNetworkHashMap.get(config.seedNetworkId).networkObj;

    // config.networkObj = deepcopy(networkObj);
    config.networkObj = networkObj;

    config.architecture = "loadedNetwork";
    config.inputsId = networkObj.inputsId;
    config.inputsObj = {};
    config.inputsObj = networkObj.inputsObj;
    console.log("TNN | SEED INPUTS | " + networkObj.inputsId);

    if (cnf.randomizeSeedOptions) {
      console.log(chalkLog("TNN | RANDOMIZE SEED NETWORK OPTIONS | " + config.seedNetworkId));
      config.cost = randomItem([config.cost, networkObj.evolve.options.cost]);
      config.equal = randomItem([config.equal, networkObj.evolve.options.equal]);
      config.error = randomItem([config.error, networkObj.evolve.options.error]);
      config.mutationRate = randomItem([config.mutationRate, networkObj.evolve.options.mutationRate]);
      config.popsize = randomItem([config.popsize, networkObj.evolve.options.popsize]);
      config.growth = randomItem([config.growth, networkObj.evolve.options.growth]);
      config.elitism = randomItem([config.elitism, networkObj.evolve.options.elitism]);
    }
    else {
      console.log(chalkLog("TNN | USE SEED NETWORK OPTIONS | " + config.seedNetworkId));
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
      debug("TNN | RANDOM ARCH | SEED INPUTS: " + config.seedInputsId);
    }
    else {
      console.log("TNN *** ERROR *** | RANDOM ARCH | seedInputsId " + config.seedInputsId + " NOT IN inputsHashMap");
      return callback(config.seedInputsId + " NOT IN inputsHashMap", null);
    }
  }

  let tObj = {};

  if (!cnf.createTrainingSet && !cnf.createTrainingSetOnly && cnf.loadTrainingSetFromFile && trainingSetReady) {

    console.log(chalkLog("TNN | LOAD GLOBAL TRAINING SET FROM HASHMAP: " + cnf.globalTrainingSetId));

    if (!trainingSetHashMap.has(cnf.globalTrainingSetId)) {
      console.log(chalkError("TNN | *** TRAINING SET NOT IN HASHMAP: " + cnf.globalTrainingSetId));
      return callback("TRAINING SET NOT IN HASHMAP: " + cnf.globalTrainingSetId, null);
    }

    tObj = trainingSetHashMap.get(cnf.globalTrainingSetId);

    console.log(chalkLog("TNN | USING TRAINING SET: " + tObj.trainingSetObj.trainingSetId));

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

    console.log(chalkLog("TNN | ... START CREATE TRAINING SET"));

    generateGlobalTrainingTestSet(trainingSetUsersHashMap, userMaxInputHashMap, function(err){

      if (err) {
        return callback(err, null);
      }

      tObj = trainingSetHashMap.get(cnf.globalTrainingSetId);

      console.log(chalkLog("TNN | USING TRAINING SET " + cnf.globalTrainingSetId));

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

      console.log(chalkLog("TNN | TRAINING SET META\n" + jsonPrint(tObj.trainingSetObj.trainingSet.meta)));

      callback(null, config);

    });
  }
}

function initNetworkCreate(nnChildId, nnId, callback){

  statsObj.status = "INIT NETWORK CREATE";

  debug(chalkLog("TNN | INIT NETWORK CREATE | NNC ID: " + nnId));

  let messageObj;

  generateRandomEvolveConfig(configuration, function(err, childConf){

    if (err) {
      console.log(chalkError("generateRandomEvolveConfig ERROR\n" + jsonPrint(err)));
      return callback(err, childConf);
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
        messageObj.betterChild = false;
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

        messageObj.seedNetworkId = childConf.seedNetworkId;
        messageObj.seedNetworkRes = 0;

        if (childConf.seedNetworkId && (messageObj.networkObj !== undefined)) {
          messageObj.seedNetworkRes = messageObj.networkObj.successRate;
        }

        console.log(chalkBlue("\nTNN | START NETWORK EVOLVE"));

        console.log(chalkBlue(
             "TNN | NN ID: " + nnId
          + "\nTNN | ARCHITECTURE:        " + messageObj.architecture
          + "\nTNN | COST:                " + messageObj.cost
          + "\nTNN | TRAINING SET LENGTH: " + messageObj.trainingSet.meta.setSize
          + "\nTNN | TEST SET LENGTH:     " + messageObj.testSet.data.length
          + "\nTNN | INPUTS ID:           " + messageObj.inputsId
          + "\nTNN | INPUTS:              " + messageObj.inputsObj.meta.numInputs
          + "\nTNN | OUTPUTS:             " + messageObj.trainingSet.meta.numOutputs
          + "\nTNN | ITERATIONS:          " + messageObj.iterations
        ));

        if (messageObj.seedNetworkId) {
          console.log(chalkBlue("TNN | SEED:                " + messageObj.seedNetworkId 
            + " | SR: " + messageObj.seedNetworkRes.toFixed(2) + "%"
          ));
          console.log(chalkBlue("TNN | BETTER CHILD SEED:   " + messageObj.isBetterChildSeed));
        }
        else {
          console.log(chalkBlue("TNN | SEED:                ----"));
        }

        neuralNetworkChildHashMap[nnChildId].child.send(messageObj, function(err){
          if (err) {
            console.log(chalkError("TNN | *** NEURAL NETWORK CHILD SEND ERROR: " + err));
            return callback(err, messageObj);
          }

          statsObj.status = "EVOLVE";

          networkCreateResultsHashmap[messageObj.testRunId] = {};

          let networkCreateObj = {};
          networkCreateObj.nnChildId = nnChildId;
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

          networkCreateResultsHashmap[messageObj.testRunId] = networkCreateObj;

          saveFileQueue.push({localFlag: false, folder: statsFolder, file: statsFile, obj: statsObj});

          printNetworkCreateResultsHashmap();

          callback(err, null);

        });
      break;

      default:
        console.log(chalkError("TNN | UNKNOWN NETWORK CREATE MODE: " + configuration.networkCreateMode));
        callback("TNN | UNKNOWN NETWORK CREATE MODE: " + configuration.networkCreateMode, null);
    }

  });
}

function allComplete(){

  getChildProcesses(function(err, childArray){

    if (childArray.length === 0 ) { 
      allCompleteFlag = true;
      console.log(chalkBlue("TNN | allComplete | NO NN CHILDREN"));
      return;
    }

    if (Object.keys(neuralNetworkChildHashMap).length === 0 ) { 
      allCompleteFlag = true;
      console.log(chalkBlue("TNN | allComplete | NO NN CHILDREN"));
      return;
    }

    let index = 0;

    async.each(Object.keys(neuralNetworkChildHashMap), function(nnChildId, cb){

      if (configuration.verbose) {
        console.log(chalkLog("TNN | allComplete"
          + " | NNC " + nnChildId 
          + " STATUS: " + neuralNetworkChildHashMap[nnChildId].status
        ));
      }

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

  statsObj.status = "INIT MAIN";

  allComplete();

  showStats();

  console.log(chalkBlue("TNN | ***===*** INIT MAIN ***===***"
    + " | " + getTimeStamp()
    + " | ALL COMPLETE: " + allCompleteFlag
    + " | INTERVAL: " + msToTime(cnf.initMainIntervalTime)
  ));

  if (runOnceFlag && configuration.quitOnComplete && allCompleteFlag) {

    if (saveFileQueue.length > 0) {

      let waitSaveInterval;

      waitSaveInterval = setInterval(function(){

        if (saveFileQueue.length === 0) {
          clearInterval(waitSaveInterval);
          quit("QUIT ON COMPLETE");
          return callback();
        }

        console.log(chalkLog("TNN | WAIT SAVE"));

      }, 5000);

    }
    else {
      quit("QUIT ON COMPLETE");
      return callback();
    }
  }

  loadInputsDropboxFolder(defaultInputsFolder, function(err1, results){

    if (err1) {
      console.log(chalkError("TNN | ERROR LOADING DROPBOX INPUTS FOLDER | " + defaultInputsFolder + " | " + err1));
      return callback(err1) ;
    }

    let seedParams = {};
    seedParams.purgeMin = false ;  // use localPurgeMinSuccessRate to delete nn's
    seedParams.folders = [globalBestNetworkFolder, localBestNetworkFolder];

    if (cnf.seedNetworkId) {
      seedParams.networkId = cnf.seedNetworkId;
    }

    loadSeedNeuralNetwork(seedParams, async function(err0, results){

      if (err0) {
        console.log(chalkError("*** ERROR loadSeedNeuralNetwork"));
        return callback(err0);
      }


      if (cnf.loadTrainingSetFromFile) {

        // try {

        fs.stat(configuration.defaultUserArchivePath, async function(err, stats){
          if (err) {
            console.log(chalkError("TNN | *** USER ARCHIVE STATS ERROR: " + err));
            return callback(err);
          }

          const curModifiedMoment = moment(stats.mtimeMs);

          if (statsObj.archiveModifiedMoment.isBefore(curModifiedMoment)){

            console.log(chalkBlueBold("TNN | *** USER ARCHIVE CHANGED"
              + " | SIZE: " + stats.size
              + " | CUR MOD: " + getTimeStamp(curModifiedMoment)
              + " | PREV MOD: " + getTimeStamp(statsObj.archiveModifiedMoment)
              // + "\n" + jsonPrint(stats)
            ));

            try {
              await fileSize({path: configuration.defaultUserArchivePath});
              await loadUsersArchive({path: configuration.defaultUserArchivePath});
              statsObj.archiveModifiedMoment = moment(curModifiedMoment);
              createTrainingSetBusy = false;
              trainingSetReady = true;
              runOnceFlag = true;
              callback();
            }
            catch(err){
              createTrainingSetBusy = false;
              trainingSetReady = false;
              return callback();
            }


          }
          else {

            console.log(chalkLog("TNN | ... USER ARCHIVE NO CHANGE"
              + " | CUR MOD: " + getTimeStamp(curModifiedMoment)
              + " | PREV MOD: " + getTimeStamp(statsObj.archiveModifiedMoment)
            ));

            createTrainingSetBusy = false;
            trainingSetReady = true;
            runOnceFlag = true;
            callback();
          }

        });
 
        // }
        // catch(err) {
        //   console.log(chalkError("TNN | *** LOAD USER ARCHIVE ERROR: " + err));
        //   createTrainingSetBusy = false;
        //   trainingSetReady = false;
        //   return callback(err);
        // }
      }
      else {

        createTrainingSetBusy = true;
        trainingSetReady = false;

        initCategorizedUserHashmap(async function(err){

          if (err) {
            console.error(chalkError("TNN | *** ERROR: CATEGORIZED USER HASHMAP NOT INITIALIZED: ", err));
            return callback(err);
          }

          console.log(chalkInfo("TNN | LOADED " + categorizedUserHashmap.size + " TOTAL CATEGORIZED USERS"));

          updateCategorizedUsers(cnf, function(err){

            if (err) {
              console.error("TNN | *** UPDATE CATEGORIZED USER ERROR ***\n" + jsonPrint(err));
              return callback(err);
            }

            console.log(chalkLog("TNN | ... START CREATE TRAINING SET"));

            generateGlobalTrainingTestSet(trainingSetUsersHashMap, userMaxInputHashMap, function(err){

              if (err) {
                trainingSetReady = false;
                createTrainingSetBusy = false;
                return callback(err);
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
              runOnceFlag = true;

              callback();
            });
          });

        });
      }


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
        console.log(chalkWarn("??? UNKNOWN CHILD STATUS: " + neuralNetworkChildHashMap[nnChildId].status));
        chalkValue = chalkInfo;
    }

    console.log(chalkValue("TNN CHILD HM"
      + " | CHILD ID: " + nnChildId
      + " | PID: " + neuralNetworkChildHashMap[nnChildId].pid
      + " | STATUS: " + neuralNetworkChildHashMap[nnChildId].status
    ));

    cb();

  }, function(){

  });
}

function initNeuralNetworkChild(nnChildIndex, cnf, callback){

  statsObj.status = "INIT NN CHILD";

  let nnChildId = NN_CHILD_PREFIX + nnChildIndex;

  console.log(chalkBlue("TNN | +++ NEW NEURAL NETWORK CHILD | NNC ID: " + nnChildId));

  if ((neuralNetworkChildHashMap[nnChildId] !== undefined) && (neuralNetworkChildHashMap[nnChildId].status !== "NEW")) {
    console.log(chalkError("!!! ERROR initNeuralNetworkChild: NN CHILD EXISTS !!! | NNC ID: " + nnChildId
      + "\n" + jsonPrint(neuralNetworkChildHashMap[nnChildId])
    ));
    return callback("NN CHILD EXISTS", nnChildId);
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

    debug(chalkBlueBold("neuralNetworkChild RX"
      + " | " + m.op
    ));

    if (m.error) {
      console.error(chalkError("TNN | neuralNetworkChild RX ERROR"
        + " | PID: " + neuralNetworkChildHashMap[nnChildId].pid
        + " | STATUS: " + neuralNetworkChildHashMap[nnChildId].status
        + "\n" + jsonPrint(m)
      ));
      neuralNetworkChildHashMap[m.nnChildId].status = "ERROR";
      neuralNetworkChildHashMap[m.nnChildId].error = {};
      neuralNetworkChildHashMap[m.nnChildId].error = m.error;
      return;
    }

    let snId = "---";
    let snIdRes = "---";

    let newNeuralNetwork;

    switch(m.op) {

      case "INIT_COMPLETE":
        console.log(chalkLog("TNN | TEST NEURAL NETWORK | " + m.nnChildId));
        neuralNetworkChildHashMap[m.nnChildId].child.send({op: "TEST_EVOLVE"});
      break;

      case "READY":
        console.log(chalkLog("TNN | INIT NEURAL NETWORK | " + m.nnChildId));
        neuralNetworkChildHashMap[m.nnChildId].child.send({op: "INIT", testRunId: testObj.testRunId});
      break;

      case "STATS":
        console.log("TNN | STATS | " 
          + " | " + m.nnChildId
          + getTimeStamp() + " ___________________________\n" 
          + jsonPrint(statsObj, "NNC | STATS "
        ));
        console.log("TNN | STATS___________________________\n");
      break;

      case "TEST_EVOLVE_COMPLETE":
        if (m.results) {
          console.log(chalkLog("TNN"
            + " | " + m.nnChildId
            + " | TEST EVOLVE XOR PASS"
          ));

          if (neuralNetworkChildHashMap[m.nnChildId] !== undefined) { 
            neuralNetworkChildHashMap[m.nnChildId].status = "TEST PASS"; 
          }
        }
        else {
          console.error(chalkError("TNN | *** TEST EVOLVE XOR FAILED *** | " + m.nnChildId));
          console.log(chalkLog("TNN | *** RETRY *** TEST NEURAL NETWORK | " + m.nnChildId));
          neuralNetworkChildHashMap[m.nnChildId].child.send({op: "TEST_EVOLVE"});
        }
      break;

      case "EVOLVE_SCHEDULE":

        console.log(chalkLog("TNN | EVOLVE | " + m.nnChildId + " | " + m.stats.networkId
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

        console.log(chalkBlue(
            "\nTNN ========================================================\n"
          +   "TNN | NETWORK EVOLVE + TEST COMPLETE"
          + "\nTNN |                  " + m.nnChildId
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

        networkCreateResultsHashmap[nn.networkId] = {};
        networkCreateResultsHashmap[nn.networkId] = omit(nn, ["network", "inputs", "outputs", "inputsObj"]);
        networkCreateResultsHashmap[nn.networkId].status = "COMPLETE";
        networkCreateResultsHashmap[nn.networkId].stats = {};
        networkCreateResultsHashmap[nn.networkId].stats = omit(m.statsObj, ["inputsObj", "train", "outputs", "normalization"]);

        
        newNeuralNetwork.markModified("overallMatchRate");

        newNeuralNetwork
        .save()
        .catch(function(err){
          console.log(chalkError("TNN | *** ERROR SAVE NN TO DB" 
            + " | NID: " + nn.networkId
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

        if (m.statsObj.evolve.results.iterations < nn.evolve.options.iterations) {

          console.log(chalkError("TNN | XXX | NOT SAVING NN FILE TO DROPBOX ... EARLY COMPLETE?"
            + " | " + nn.networkId
            + " | ITRNS: " + m.statsObj.evolve.results.iterations
            + " | MIN: " + cnf.globalMinSuccessRate.toFixed(2) + "%"
            + " | " + nn.successRate.toFixed(2) + "%"
          ));

          saveFileQueue.push({localFlag: false, folder: statsFolder, file: statsFile, obj: statsObj});

          printNetworkObj("TNN | " + nn.networkId, nn);
        }
        else if (
          (nn.seedNetworkId && (nn.test.results.successRate > nn.seedNetworkRes)) // better than seed nn
          || (!nn.seedNetworkId && (nn.test.results.successRate >= cnf.localMinSuccessRate)) // no seed but better than local min
          || (nn.test.results.successRate >= cnf.globalMinSuccessRate) // better than global min
          ) { 

          // It's a Keeper!!

          bestNetworkFile = nn.networkId + ".json";

          // nn = networkDefaults(nn);

          bestNetworkHashMap.set(
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
            networkCreateResultsHashmap[nn.networkId].betterChild = true;

            console.log(chalkGreen("TNN | +++ BETTER CHILD"
              + " [" + betterChildSeedNetworkIdSet.size + "] " + nn.networkId
              + " | SR: " + nn.test.results.successRate.toFixed(3) + "%"
              + " | SEED: " + nn.seedNetworkId
              + " | SR: " + nn.seedNetworkRes.toFixed(3) + "%"
            ));
          }
          // no seed but better than localMinSuccessRate, so act like better child and start parent/child chain
          else if (!nn.seedNetworkId && (nn.test.results.successRate >= cnf.localMinSuccessRate)) {

            betterChildSeedNetworkIdSet.add(nn.networkId);

            nn.betterChild = false;
            networkCreateResultsHashmap[nn.networkId].betterChild = false;

            console.log(chalkGreen("TNN | +++ ADD LOCAL SUCCESS TO BETTER CHILD SET"
              + " [" + betterChildSeedNetworkIdSet.size + "] " + nn.networkId
              + " | SR: " + nn.test.results.successRate.toFixed(3) + "%"
            ));
          }
          else {
            nn.betterChild = false;
            networkCreateResultsHashmap[nn.networkId].betterChild = false;
          }

          if (inputsNetworksHashMap[nn.inputsId] === undefined) {
            inputsNetworksHashMap[nn.inputsId] = new Set();
          }

          inputsNetworksHashMap[nn.inputsId].add(nn.networkId);

          console.log(chalkLog("TNN | INPUTS ID"
            + " | " + nn.inputsId
            + " | INPUTS: " + nn.inputsObj.meta.numInputs
            + " | " + inputsNetworksHashMap[nn.inputsId].size + " NETWORKS"
          ));

          if (nn.test.results.successRate >= cnf.globalMinSuccessRate) {

            console.log(chalkInfo("TNN | ### SAVING NN FILE TO DROPBOX GLOBAL BEST"
              + " | " + globalBestNetworkFolder + "/" + bestNetworkFile
            ));

            networkCreateResultsHashmap[nn.networkId].status = "PASS GLOBAL";

            statsObj.evolveStats.passGlobal += 1;

            slackText = "\n*GLOBAL BEST*";
            slackText = slackText + "\n*" + nn.test.results.successRate.toFixed(2) + "%*";
            slackText = slackText + "\n" + nn.networkId;
            slackText = slackText + "\nELAPSED: " + msToTime(nn.evolve.elapsed);
            slackText = slackText + "\nBETTER CHILD: " + nn.betterChild;
            slackText = slackText + "\nIN: " + nn.inputsId;
            slackText = slackText + "\nINPUTS: " + nn.network.input;

            slackPostMessage(slackChannelPassGlobal, slackText);

            saveFileQueue.push({localFlag: false, folder: globalBestNetworkFolder, file: bestNetworkFile, obj: nn});
            saveFileQueue.push({localFlag: false, folder: statsFolder, file: statsFile, obj: statsObj});
          }
          else if (nn.test.results.successRate >= cnf.localMinSuccessRate) {

            localNetworkFile = nn.networkId + ".json";

            console.log(chalkLog("TNN | ... SAVING NN FILE TO DROPBOX LOCAL BEST"
              + " | " + localBestNetworkFolder + "/" + localNetworkFile
            ));

            networkCreateResultsHashmap[nn.networkId].status = "PASS LOCAL";

            statsObj.evolveStats.passLocal += 1;

            slackText = "\n*LOCAL BEST*";
            slackText = slackText + "\n*" + nn.test.results.successRate.toFixed(2) + "%*";
            slackText = slackText + "\n" + nn.networkId;
            slackText = slackText + "\nELAPSED: " + msToTime(nn.evolve.elapsed);
            slackText = slackText + "\nBETTER CHILD: " + nn.betterChild;
            slackText = slackText + "\nIN: " + nn.inputsId;
            slackText = slackText + "\nINPUTS: " + nn.network.input;

            slackPostMessage(slackChannelPassLocal, slackText);

            saveFileQueue.push({localFlag: false, folder: localBestNetworkFolder, file: localNetworkFile, obj: nn});
            saveFileQueue.push({localFlag: false, folder: statsFolder, file: statsFile, obj: statsObj});
          }

          printNetworkObj("TNN | " + nn.networkId, nn);
        }
        else {
          console.log(chalkInfo("TNN | XXX | NOT SAVING NN GLOBAL DROPBOX ... LESS THAN GLOBAL MIN SUCCESS *OR* NOT BETTER THAN SEED"
            + " | " + nn.networkId
            + " | " + nn.successRate.toFixed(2) + "%"
            + " | " + cnf.globalMinSuccessRate.toFixed(2) + "%"
          ));

          networkCreateResultsHashmap[nn.networkId].status = "FAIL";
          saveFileQueue.push({localFlag: false, folder: statsFolder, file: statsFile, obj: statsObj});

          slackText = "\n*-FAIL-*";
          slackText = slackText + "\n*" + nn.test.results.successRate.toFixed(2) + "%*";
          slackText = slackText + "\n" + nn.networkId;
          slackText = slackText + "\nELAPSED: " + msToTime(nn.evolve.elapsed);
          slackText = slackText + "\nIN: " + nn.inputsId;
          slackText = slackText + "\nINPUTS: " + nn.network.input;

          slackPostMessage(slackChannelFail, slackText);

          statsObj.evolveStats.fail += 1;

          printNetworkObj("TNN" + newNeuralNetwork.networkId, newNeuralNetwork);
        }

        statsObj.evolveStats.results[nn.networkId] = {};
        statsObj.evolveStats.results[nn.networkId] = networkCreateResultsHashmap[nn.networkId];

       break;

      default:
        console.error(chalkError("TNN | neuralNetworkChild | UNKNOWN OP: " + m.op));
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

    slackText = "\n*TNN | INIT CHILD*";
    slackText = slackText + "\n" + hostname;
    slackText = slackText + "\n" + nnChildId;
    slackText = slackText + "\n" + statsObj.numChildren + " CHILDREN";

    slackPostMessage(slackChannel, slackText);

    if (callback !== undefined) { callback(null, nnChildId); }
  });
}

function initNetworkCreateInterval(interval) {

  console.log(chalkLog("TNN | INIT NETWORK CREATE INTERVAL | " + interval + " MS"));

  clearInterval(networkCreateInterval);

  networkCreateInterval = setInterval(function(){

    if (initMainTimeOutComplete && trainingSetReady) {

      getChildProcesses(function(err, childArray){

        if (err) {
          console.log(chalkError("TNN | *** getChildProcesses ERROR: " + err));
        }

        if (enableCreateChildren && (statsObj.numChildren < configuration.maxNeuralNetworkChildern)) {

          console.log(chalkGreen("TNN | +++ CREATING NNC"
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

          console.log(chalkBlueBold("TNN | XXX DELETING NNC"
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

                slackText = "\n*TNN | DEAD CHILD*";
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

                console.log(chalkAlert("TNN | XXX DELETING NNC"
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

                  console.log(chalkAlert("TNN | XXX KILLED"
                    + " | PID: " + childObj.pid 
                    + " | NNCID: " + childObj.nnChildId 
                    + " | CHILD STATUS: " + neuralNetworkChildHashMap[childObj.nnChildId].status
                  ));

                  cb();

                });
              }
              else {
                cb();
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
                    console.log("TNN | *** INIT NETWORK CREATE ERROR ***\n" + jsonPrint(err));
                    currentChild.status = "ERROR" ;
                    neuralNetworkChildHashMap[nnChildId] = currentChild;
                  }
                  else if (currentChild !== undefined) {
                    currentChild.status = "RUNNING" ;
                    neuralNetworkChildHashMap[nnChildId] = currentChild;
                    console.log(chalkLog("TNN | NETWORK CREATED | " + nnId));
                  }
                  else {
                    console.log(chalkAlert("TNN | ??? NETWORK NOT CREATED ??? | NN CHID: " + nnChildId + " | NNID: " + nnId));
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
                console.log(chalkGreen("TNN | +++ NNC XOR TEST PASS | CHILD ID: " + nnChildId));
                currentChild.status = "IDLE" ;
                neuralNetworkChildHashMap[nnChildId] = currentChild;
              break;

              case "EXIT":
                console.log(chalkAlert("TNN | *** NNC EXIT | CHILD ID: " + nnChildId));
                killChild({nnChildId: nnChildId});
              break;

              case "CLOSE":
                console.log(chalkAlert("TNN | *** NNC CLOSE | CHILD ID: " + nnChildId));
                killChild({nnChildId: nnChildId});
              break;

              case "ERROR":
                console.log(chalkAlert("TNN | *** NNC ERROR | CHILD ID: " + nnChildId));
                killChild({nnChildId: nnChildId});
              break;

              case "ZOMBIE":
                console.log(chalkAlert("TNN | *** NNC ZOMBIE | CHILD ID: " + nnChildId));
                killChild({nnChildId: nnChildId});
              break;

              case "RUNNING":
                debug(chalkGreen("TNN | ... NNC RUNNING ..."
                  + " | CURRENT NUM NNC: " + Object.keys(neuralNetworkChildHashMap).length
                  + " | MAX NUM NNC: " + configuration.maxNeuralNetworkChildern
                ));
              break;

              case "UNKNOWN":
                console.log(chalkAlert("TNN | *** NNC UNKNOWN STATE | " + nnChildId));
                killChild({nnChildId: nnChildId});
              break;

              default:
                console.log(chalkAlert("TNN | ??? UNKNOWN NNC STATUS"
                  + " | CHILD ID: " + nnChildId
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

  console.log(chalkLog("TNN | SET INIT TIMEOUT | " + moment().format(compactDateTimeFormat) + "\n"));

  configEvents.emit("INIT_MONGODB");

  initialize(configuration, function(err0, cnf){

    if (err0 && (err0.status !== 404)) {
      console.error(chalkError("TNN | ***** INIT ERROR *****\n" + jsonPrint(err0)));
      quit("INIT ERROR");
    }

    // if (configuration.enableStdin) {
    //   initStdIn();
    // }

    console.log(chalkBlue("\n\nTNN"
      + " | " + cnf.processName 
      + " STARTED " + getTimeStamp() 
      + "\n" + jsonPrint(configuration)
    ));

    const sfObj = {localFlag: false, folder: statsFolder, file: statsFile, obj: statsObj};

    saveFile(sfObj, function(err){
      if (err) {
        console.log(chalkError("TNN | *** SAVE FILE ERROR ... RETRY | " + sfObj.folder + "/" + sfObj.file));
        saveFileQueue.push(sfObj);
      }
      else {
        console.log(chalkBlue("TNN | SAVED FILE"
          + " [" + saveFileQueue.length + "] "
          + sfObj.folder + "/" + sfObj.file
        ));
      }
    });

    initSaveFileQueue(configuration);

    requiredTrainingSet.forEach(function(nodeId) {
      console.log(chalkLog("TNN | ... REQ TRAINING SET | @" + nodeId));
    });

    let seedParams = {};
    seedParams.purgeMin = ENABLE_INIT_PURGE_LOCAL ;  // use localPurgeMinSuccessRate to delete nn's
    seedParams.folders = [globalBestNetworkFolder, localBestNetworkFolder];

    if (cnf.seedNetworkId) {
      seedParams.networkId = cnf.seedNetworkId;
    }

    if (cnf.createTrainingSetOnly) {
      console.log(chalkBlueBold("TNN | *** CREATE TRAINING SET ONLY ... SKIP INIT NN CHILD ***"));
      callback();
    }
    else {

      try {
        initWatch({rootFolder: configuration.defaultUserArchiveFolder});
      }
      catch(err){
        console.log(chalkError("TNN | *** INIT WATCH ERROR: " + err));
      }

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

        console.log(chalkLog("TNN | INIT NN CHILD"));

        async.timesSeries(cnf.maxNeuralNetworkChildern, function initNnChild (n, next) {

          console.log(chalkGreen("INIT NN CHILD NUMBER " + n));

          initNeuralNetworkChild(nnChildIndex, cnf, function(err, nnChild) {
            nnChildIndex += 1;
            next(err, nnChildIndex);
          });

        }, function(err2, children) {

          if (err2){
            console.log(chalkError("INIT NEURAL NETWORK CHILDREN ERROR\n" + jsonPrint(err2)));
            return callback(err2);
          }

          console.log(chalkLog("END INIT NEURAL NETWORK CHILDREN: " + children.length));
          enableCreateChildren = false;
          callback();
        });
      });

    }

  });
}

slackText = "\n*TNN START | " + hostname + "*";
slackText = slackText + "\n" + getTimeStamp();

slackPostMessage(slackChannel, slackText);


function waitUnlocked(params){

  return new Promise(function(resolve, reject){

    if (waitUnlockedSet.has(params.file)){
      console.log(chalkAlert("TNN | ALREADY WAITING FOR UNLOCK: " + params.file));
      return resolve(false);
    }

    let waitUnlockedTimeout;
    const waitUnlockedTimeoutValue = params.timeout || configuration.waitUnlockedTimeoutValue;
    const waitUnlockIntervalValue = params.interval || configuration.waitUnlockIntervalValue;

    let fileIsLocked;
    let waitUnlockInterval;

    fileIsLocked = lockFile.checkSync(params.file);

    if (!fileIsLocked) {
      console.log(chalkInfo("TNN | OOO FILE IS UNLOCKED: " + params.file));
      return resolve();
    }

    waitUnlockedSet.add(params.file);

    console.log(chalkInfo("TNN | ... WAITING UNLOCK: " + params.file));

    waitUnlockedTimeout = setTimeout(function(){

      console.log(chalkAlert("TNN | *** WAIT UNLOCK TIMEOUT: " + params.file));
      clearInterval(waitUnlockInterval);
      return resolve(false);

    }, waitUnlockedTimeoutValue);

    waitUnlockInterval = setInterval(function(){

      fileIsLocked = lockFile.checkSync(params.file);

      if (!fileIsLocked) {
        clearTimeout(waitUnlockedTimeout);
        clearInterval(waitUnlockInterval);
        console.log(chalkInfo("TNN | OOO FILE IS UNLOCKED: " + params.file));
        waitUnlockedSet.delete(params.file);
        return resolve(true);
      }

      console.log(chalkInfo("TNN | ... WAITING UNLOCK: " + params.file));

    }, configuration.waitUnlockIntervalValue);

  });

}

function getFileLock(params){

  return new Promise(async function(resolve, reject){

    try {

      const fileUnlocked = await waitUnlocked(params);

      lockFile.lock(params.file, params.options, function(err){

        if (err) {
          console.log(chalkError("TNN | *** FILE LOCK FAIL: " + params.file + "\n" + err));
          // return reject(err);
          return resolve(false);
        }

        statsObj.lockFileNameSet.add(params.file);

        console.log(chalkGreen("TNN | +++ FILE LOCK: " + params.file));
        console.log(chalkGreen("TNN | LOCKED FILES: " + statsObj.lockFileNameSet.size
          + "\n" + [...statsObj.lockFileNameSet]
        ));
        resolve(true);
      });

    }
    catch(err){
      console.log(chalkError("TNN | *** GET FILE LOCK ERROR: " + err));
      return reject(err);
    }

  });

}

function releaseFileLock(params){

  return new Promise(function(resolve, reject){

    const fileIsLocked = lockFile.checkSync(params.file);

    if (!fileIsLocked) {
      statsObj.lockFileNameSet.delete(params.file);
      console.log(chalkGreen("TNN | LOCKED FILES\n" + [...statsObj.lockFileNameSet]));
      return resolve(true);
    }

    lockFile.unlock(params.file, function(err){

      if (err) {
        console.log(chalkError("TNN | *** FILE UNLOCK FAIL: " + params.file + "\n" + err));
        return reject(err);
      }

      console.log(chalkLog("TNN | --- FILE UNLOCK: " + params.file));

      statsObj.lockFileNameSet.delete(params.file);

      console.log(chalkGreen("TNN | LOCKED FILES\n" + [...statsObj.lockFileNameSet]));

      resolve(true);

    });

  });

}


function releaseAllFileLocks(params){

  return new Promise(async function(resolve, reject){

    console.log(chalkBlue("TNN | RELEASE ALL LOCKED FILES: " + statsObj.lockFileNameSet.size));

    for (let lockFileName of statsObj.lockFileNameSet) {
      try{
        await releaseFileLock(lockFileName);
      }
      catch (err){
        console.log(chalkError("TNN | *** RELEASE FILE LOCK ERROR: " + err));
        return reject(err);
      }
    }

    resolve();

  });

}


let initMainTimeOut;
let initMainTimeOutComplete = false;

function initArchiver(params){

  return new Promise(async function(resolve, reject){

    if (archive && archive.isOpen) {
      return resolve();
    }

    try {

      const lockFileName = params.outputFile + ".lock";

      let archiveFileLocked = await getFileLock({file: lockFileName, options: fileLockOptions});

      if (!archiveFileLocked) {

        console.log(chalkAlert("TNN | *** FILE LOCK FAILED | SKIP INIT ARCHIVE: " + params.outputFile));

        statsObj.archiveOpen = false;
        createTrainingSetBusy = false;
        return resolve();
      }

      createTrainingSetBusy = true;

      console.log(chalkGreen("TNN | INIT ARCHIVE\n" + jsonPrint(params)));
      // create a file to stream archive data to.
      const output = fs.createWriteStream(params.outputFile);

      archive = archiver("zip", {
        zlib: { level: 9 } // Sets the compression level.
      });
       
      output.on("close", function() {
        const archiveSize = toMegabytes(archive.pointer());
        console.log(chalkGreen("TNN | ARCHIVE | CLOSED | " + archiveSize.toFixed(2) + " MB"));
        statsObj.archiveOpen = false;
        createTrainingSetBusy = false;
      });
       
      output.on("end", function() {
        const archiveSize = toMegabytes(archive.pointer());
        console.log(chalkGreen("TNN | ARCHIVE | END | " + archiveSize.toFixed(2) + " MB"));
        statsObj.archiveOpen = false;
        createTrainingSetBusy = false;
      });
       
      archive.on("warning", function(err) {
        console.log(chalkAlert("TNN | ARCHIVE | WARNING\n" + jsonPrint(err)));
        if (err.code === "ENOENT") {
        } else {
          throw err;
        }
      });
       
      archive.on("progress", function(progress) {

        const progressMbytes = toMegabytes(progress.fs.processedBytes);
        const totalMbytes = toMegabytes(archive.pointer());

        if (progress.entries.processed % 100 === 0) {
          console.log(chalkLog("TNN | ARCHIVE | PROGRESS"
            + " | ENTRIES: " + progress.entries.processed + " PROCESSED / " + progress.entries.total + " TOTAL"
            + " (" + (100*progress.entries.processed/progress.entries.total).toFixed(2) + "%)"
            + " | SIZE: " + progressMbytes.toFixed(2) + " PROCESSED / " + totalMbytes.toFixed(2) + " MB"
          ));
        }
      });
       
      archive.on("close", function() {
        console.log(chalkInfo("TNN | ARCHIVE | CLOSED"));
        statsObj.archiveOpen = false;
        createTrainingSetBusy = false;
      });
       
      archive.on("finish", function() {
        console.log(chalkInfo("TNN | ARCHIVE | FINISHED"));
        statsObj.archiveOpen = false;
        createTrainingSetBusy = false;
      });
       
      archive.on("error", function(err) {
        console.log(chalkError("TNN | ARCHIVE | ERROR\n" + jsonPrint(err)));
        statsObj.archiveOpen = false;
        createTrainingSetBusy = false;
        throw err;
      });
       
      archive.pipe(output);
      statsObj.archiveOpen = true;

      resolve();
    }
    catch(err){
      console.log(chalkError("TNN | *** INIT ARCHIVE ERROR: " + err));
      reject(err);
    }

  });
}

function initMainTimeOutFunction(){

  statsObj.status = "INIT";

  initMainTimeOut = setTimeout(function(){

  initTimeout(function(){

    initMain(configuration, function(err){

      if (err){
        console.log(chalkError("INIT MAIN ERROR", err));
        console.log(chalkError("INIT MAIN ERROR" + jsonPrint(err)));
        console.log(chalkAlert("RETRYING INIT MAIN..."));
        initMainTimeOutComplete = true;
        clearInterval(initMainInterval);
        initMainTimeOutFunction();
        return;
      }


      initMainTimeOutComplete = true;
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

      console.log(chalkBlue("TNN | +++ INIT MAIN INTERVAL"
        + " | STATUS: " + statsObj.status
        + " | INTERVAL: " + msToTime(configuration.initMainIntervalTime)
        + " | ALL COMPLETE: " + allCompleteFlag
        + " | initMainTimeOutComplete: " + initMainTimeOutComplete
        + " | initMainReady: " + initMainReady
        + " | trainingSetReady: " + trainingSetReady
        + " | createTrainingSetBusy: " + createTrainingSetBusy
      ));

      if (initMainTimeOutComplete && initMainReady) {

        initMainReady = false;

        loadAllConfigFiles(function(err){
          loadCommandLineArgs(function(err, results){
            initMain(configuration, function(){
              debug(chalkLog("INIT MAIN CALLBACK"));
              initMainReady = true;
            });
          });
        });

      }
      else {
        console.log(chalkLog("TNN | ... INIT MAIN INTERVAL | NOT READY"
        ));
      }

    }, configuration.initMainIntervalTime);
  });

  }, 5*ONE_SECOND);
}

initMainTimeOutFunction();
