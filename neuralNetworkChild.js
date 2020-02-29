const ONE_SECOND = 1000;
const ONE_MINUTE = 60*ONE_SECOND;
const ONE_HOUR = 60*ONE_MINUTE;
const DEFAULT_MAX_NETWORK_JSON_SIZE_MB = 15;

const DEFAULT_BRAIN_HIDDEN_LAYER_SIZE = 9;
const DEFAULT_NEATAPTIC_HIDDEN_LAYER_SIZE = 9;
const DEFAULT_USER_PROFILE_CHAR_CODES_ONLY_INPUTS_ID = "inputs_25250101_000000_255_profilecharcodes";

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

let childNetworkObj; // this is the common, default nn object
let seedNetworkObj; // this is the common, default nn object

const os = require("os");
const _ = require("lodash");
const omit = require("object.omit");
const path = require("path");

let hostname = os.hostname();
if (hostname.startsWith("mbp3")){
  hostname = "mbp3";
}
hostname = hostname.replace(/.tld/g, ""); // amtrak wifi
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const MODULE_NAME = "tncChild";
let MODULE_ID_PREFIX = "NNC";
const DEFAULT_NETWORK_TECHNOLOGY = "carrot";
const DEFAULT_BINARY_MODE = true;
const DEFAULT_TEST_RATIO = 0.25;
const QUIT_WAIT_INTERVAL = ONE_SECOND;
const DEFAULT_USER_ARCHIVE_FILE_EXITS_MAX_WAIT_TIME = 2*ONE_HOUR;

const TEST_MODE_LENGTH = 1000;

let DROPBOX_ROOT_FOLDER;

if (hostname === "google") {
  DROPBOX_ROOT_FOLDER = "/home/tc/Dropbox/Apps/wordAssociation";
}
else {
  DROPBOX_ROOT_FOLDER = "/Users/tc/Dropbox/Apps/wordAssociation";
}

global.wordAssoDb = require("@threeceelabs/mongoose-twitter");

let configuration = {};
configuration.equalCategoriesFlag = false;
configuration.userProfileCharCodesOnlyFlag = false;
configuration.userProfileCharCodesOnlyInputsId = DEFAULT_USER_PROFILE_CHAR_CODES_ONLY_INPUTS_ID 
configuration.userCharCountScreenName = 15;
configuration.userCharCountName = 50;
configuration.userCharCountDescription = 160;
configuration.userCharCountLocation = 30;

configuration.maxNetworkJsonSizeMB = DEFAULT_MAX_NETWORK_JSON_SIZE_MB;
configuration.userArchiveFileExistsMaxWaitTime = DEFAULT_USER_ARCHIVE_FILE_EXITS_MAX_WAIT_TIME;
configuration.testSetRatio = DEFAULT_TEST_RATIO;
configuration.binaryMode = DEFAULT_BINARY_MODE;
configuration.fHiddenLayerSize = DEFAULT_BRAIN_HIDDEN_LAYER_SIZE;
configuration.neatapticHiddenLayerSize = DEFAULT_NEATAPTIC_HIDDEN_LAYER_SIZE;
configuration.networkTechnology = DEFAULT_NETWORK_TECHNOLOGY;

const configDefaultFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility/default");

const brainTrainOptionsPickArray = [
  // net.train(data, {
  //   // Defaults values --> expected validation
  //   iterations: 20000, // the maximum times to iterate the training data --> number greater than 0
  //   errorThresh: 0.005, // the acceptable error percentage from training data --> number between 0 and 1
  //   log: false, // true to use console.log, when a function is supplied it is used --> Either true or a function
  //   logPeriod: 10, // iterations between logging out --> number greater than 0
  //   learningRate: 0.3, // scales with delta to effect training rate --> number between 0 and 1
  //   momentum: 0.1, // scales with next layer's change value --> number between 0 and 1
  //   callback: null, // a periodic call back that can be triggered while training --> null or function
  //   callbackPeriod: 10, // the number of iterations through the training data between callback calls --> number greater than 0
  //   timeout: Infinity, // the max number of milliseconds to train for --> number greater than 0
  // })

  "iterations",
  "error",
  "errorThresh",
  "log",
  "logPeriod",
  "learningRate",
  "momentum",
  "network",
  "schedule",
  "callbackPeriod",
  "timeout"
];

const neatapticEvolveOptionsPickArray = [
  // "clear",
  "cost",
  "crossover",
  "elitism",
  "equal",
  "error",
  "growth",
  "iterations",
  // "log",
  "mutation",
  "mutationAmount",
  "mutationRate",
  "mutationSelection",
  "network",
  "popsize",
  "provenance",
  "schedule",
  "selection",
  "threads"
];

const carrotEvolveOptionsPickArray = [
  // "activation",
  // "clear",
  "cost",
  "crossover",
  "efficient_mutation",
  "elitism",
  "equal",
  "error",
  "fitness",
  "fitness_population",
  "growth",
  "iterations",
  // "log",
  "max_nodes",
  "maxConns",
  "maxGates",
  "mutation",
  "mutation_amount",
  "mutation_rate",
  "mutationSelection",
  "network",
  "popsize",
  "population_size",
  "provenance",
  "schedule",
  "selection",
  "threads"
];

const ThreeceeUtilities = require("@threeceelabs/threecee-utilities");
const tcUtils = new ThreeceeUtilities("NNC_TCU");

const msToTime = tcUtils.msToTime;
const jsonPrint = tcUtils.jsonPrint;
const getTimeStamp = tcUtils.getTimeStamp;

const NeuralNetworkTools = require("@threeceelabs/neural-network-tools");
const nnTools = new NeuralNetworkTools("NNC_NNT");

const fs = require("fs");
const empty = require("is-empty");
const HashMap = require("hashmap").HashMap;
const yauzl = require("yauzl");

const MODULE_ID = MODULE_ID_PREFIX + "_" + hostname;

const PRIMARY_HOST = process.env.PRIMARY_HOST || "google";
const HOST = (hostname === PRIMARY_HOST) ? "default" : "local";

console.log("=========================================");
console.log("=========================================");
console.log("MODULE_NAME:  " + MODULE_NAME);
console.log("PRIMARY_HOST: " + PRIMARY_HOST);
console.log("HOST:         " + HOST);
console.log("HOST NAME:    " + hostname);
console.log("=========================================");
console.log("=========================================");

//=========================================================================
// MODULE REQUIRES
//=========================================================================
const neataptic = require("neataptic");
const brain = require("brain.js");
const carrot = require("@liquid-carrot/carrot");

const moment = require("moment");
const pick = require("object.pick");
const debug = require("debug")("tfe");
const util = require("util");
const deepcopy = require("deep-copy");
const async = require("async");

const chalk = require("chalk");
const chalkNetwork = chalk.blue;
const chalkBlueBold = chalk.blue.bold;
const chalkGreenBold = chalk.green.bold;
const chalkBlue = chalk.blue;
const chalkGreen = chalk.green;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;

//=========================================================================
// HOST
//=========================================================================
// let preppedTrainingSet = [];
let trainingSetObj = {};
let testSetObj = {};

//=========================================================================
// STATS
//=========================================================================

const startTimeMoment = moment();

const statsObj = {};

statsObj.archiveFile = "";

statsObj.trainingSetReady = false;

let statsObjSmall = {};

statsObj.users = {};

statsObj.pid = process.pid;
statsObj.runId = MODULE_ID.toLowerCase() + "_" + getTimeStamp();

statsObj.hostname = hostname;
statsObj.startTime = getTimeStamp();
statsObj.elapsedMS = 0;
statsObj.elapsed = getElapsedTimeStamp();

statsObj.status = "START";

statsObj.queues = {};

statsObj.evolve = {};
statsObj.evolve.options = {};

statsObj.training = {};
statsObj.training.startTime = moment();
statsObj.training.testRunId = "";
statsObj.training.seedNetworkId = false;
statsObj.training.seedNetworkRes = 0;
statsObj.training.iterations = 0;

statsObj.inputsId = "";
// statsObj.inputsObj = {};
statsObj.outputs = [];

const statsPickArray = [
  "pid", 
  "startTime", 
  "elapsed", 
  "elapsedMS", 
  "status"
];

//=========================================================================
// PROCESS EVENT HANDLERS
//=========================================================================

process.title = MODULE_ID.toLowerCase() + "_node_" + process.pid;

process.on("exit", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS EXIT"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
  quit({cause: "PARENT EXIT"});
});

process.on("close", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS CLOSE"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
  quit({cause: "PARENT CLOSE"});
});

process.on("disconnect", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS DISCONNECT"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
  process.exit(1);
});

process.on("SIGHUP", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS SIGHUP"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
  quit({cause: "PARENT SIGHUP"});
});

process.on("SIGINT", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS SIGINT"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
  quit({cause: "PARENT SIGINT"});
});

process.on("unhandledRejection", function(err, promise) {
  console.trace(MODULE_ID_PREFIX + " | *** Unhandled rejection (promise: ", promise, ", reason: ", err, ").");
  quit("unhandledRejection");
  process.exit(1);
});

const trainingSetUsersHashMap = {};
trainingSetUsersHashMap.left = new HashMap();
trainingSetUsersHashMap.neutral = new HashMap();
trainingSetUsersHashMap.right = new HashMap();

function initConfig(cnf) {

  return new Promise(function(resolve, reject){

    statsObj.status = "INIT CONFIG";

    if (debug.enabled) {
      console.log("\nTFE | %%%%%%%%%%%%%%\nTFE |  DEBUG ENABLED \nTFE | %%%%%%%%%%%%%%\n");
    }

    cnf.processName = process.env.PROCESS_NAME || MODULE_ID;
    cnf.testMode = (process.env.TEST_MODE === "true") ? true : cnf.testMode;
    cnf.quitOnError = process.env.QUIT_ON_ERROR || false;

    if (process.env.QUIT_ON_COMPLETE === "false") { cnf.quitOnComplete = false; }
    else if ((process.env.QUIT_ON_COMPLETE === true) || (process.env.QUIT_ON_COMPLETE === "true")) {
      cnf.quitOnComplete = true;
    }

    try {

      const configArgs = Object.keys(cnf);

      configArgs.forEach(function(arg){
        if (_.isObject(cnf[arg])) {
          console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + "\n" + jsonPrint(cnf[arg]));
        }
        else {
          console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + ": " + cnf[arg]);
        }
      });
      
      resolve(cnf);

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** CONFIG LOAD ERROR: " + err ));
      reject(err);
    }

  });
}

//=========================================================================
// MISC FUNCTIONS (own module?)
//=========================================================================

function getElapsedTimeStamp(){
  statsObj.elapsedMS = moment().valueOf() - startTimeMoment.valueOf();
  return msToTime(statsObj.elapsedMS);
}

function showStats(options) {

  statsObj.elapsed = getElapsedTimeStamp();

  statsObjSmall = pick(statsObj, statsPickArray);

  if (options) {
    console.log(MODULE_ID_PREFIX + " | STATS\n" + jsonPrint(statsObjSmall));
  }
  else {

    console.log(chalkLog(MODULE_ID_PREFIX + " | STATUS"
      + " | FSM: " + fsm.getMachineState()
      + " | START: " + statsObj.startTime
      + " | NOW: " + getTimeStamp()
      + " | ELAPSED: " + statsObj.elapsed
    ));
  }
}

//=========================================================================
// INTERVALS
//=========================================================================
const intervalsSet = new Set();

function clearAllIntervals(){
  return new Promise(function(resolve, reject){
    try {
      [...intervalsSet].forEach(function(intervalHandle){
        clearInterval(intervalHandle);
      });
      resolve();
    }
    catch(err){
      reject(err);
    }
  });
}

function processSend(message){
  return new Promise(function(resolve, reject){

    if (configuration.verbose){
      console.log(chalkGreen(MODULE_ID_PREFIX 
        + " [" + processSendQueue.length + "]"
        + " | >T MESSAGE | " + getTimeStamp() 
        + " | OP: " + message.op
      )); 
    }

    try{
      process.send(message);
    }
    catch(err){
      return reject(err);
    }

    resolve();
  });
}

//=========================================================================
// QUIT + EXIT
//=========================================================================

function readyToQuit() {
  const flag = true; // replace with function returns true when ready to quit
  return flag;
}

async function quit(opts) {

  const options = opts || {};

  statsObj.elapsed = getElapsedTimeStamp();
  statsObj.timeStamp = getTimeStamp();
  statsObj.status = "QUIT";

  const forceQuitFlag = options.force || false;

  fsm.fsm_exit();

  if (options) {
    console.log(MODULE_ID_PREFIX + " | QUIT INFO\n" + jsonPrint(options) );
  }

  showStats(true);

  await processSend({op: "QUIT", childId: configuration.childId, fsmStatus: statsObj.fsmStatus});

  setInterval(async function() {

    if (readyToQuit()) {

      await clearAllIntervals();

      if (forceQuitFlag) {
        console.log(chalkAlert(MODULE_ID_PREFIX + " | *** FORCE QUIT"
        ));
      }
      else {
        console.log(chalkBlueBold(MODULE_ID_PREFIX + " | ALL PROCESSES COMPLETE ... QUITTING"
        ));
      }

      process.exit();
 
    }

  }, QUIT_WAIT_INTERVAL);
}


//=========================================================================
// EVOLVE
//=========================================================================

function unzipUsersToArray(params){

  console.log(chalkBlue(MODULE_ID_PREFIX + " | UNZIP USERS TO TRAINING SET: " + params.path));

  return new Promise(function(resolve, reject) {

    try {

      trainingSetUsersHashMap.left.clear();
      trainingSetUsersHashMap.neutral.clear();
      trainingSetUsersHashMap.right.clear();

      let entryNumber = 0;

      statsObj.users.zipHashMapHit = 0;
      statsObj.users.zipHashMapMiss = 0;
      statsObj.users.unzipped = 0;

      yauzl.open(params.path, {lazyEntries: true}, function(err, zipfile) {

        if (err) {
          return reject(err);
        }

        zipfile.on("error", function(err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** UNZIP ERROR: " + err));
          reject(err);
        });

        zipfile.on("close", function() {
          console.log(chalkLog(MODULE_ID_PREFIX + " | UNZIP CLOSE"));
          resolve(true);
        });

        zipfile.on("end", function() {
          console.log(chalkLog(MODULE_ID_PREFIX + " | UNZIP END"));
          resolve(true);
        });

        let hmHit = MODULE_ID_PREFIX + " | --> UNZIP";

        zipfile.on("entry", function(entry) {
          
          if ((/\/$/).test(entry.fileName)) { 
            zipfile.readEntry(); 
          } 
          else {
            zipfile.openReadStream(entry, function(err, readStream) {

              entryNumber += 1;
              
              if (err) {
                console.log(chalkError(MODULE_ID_PREFIX + " | *** UNZIP USERS ENTRY ERROR [" + entryNumber + "]: " + err));
                return reject(err);
              }

              let userString = "";

              readStream.on("end", async function() {

                try {
                  const userObj = JSON.parse(userString);

                  if (entry.fileName.includes("maxInputHashMap")) {

                    console.log(chalkLog(MODULE_ID_PREFIX + " | UNZIPPED MAX INPUT"));

                    await nnTools.setMaxInputHashMap(userObj.maxInputHashMap);
                    await nnTools.setNormalization(userObj.normalization);

                    zipfile.readEntry();
                  }
                  else {

                    statsObj.users.unzipped += 1;

                    hmHit = MODULE_ID_PREFIX + " | UNZIP";

                    if ( trainingSetUsersHashMap.left.has(userObj.userId)
                      || trainingSetUsersHashMap.neutral.has(userObj.userId) 
                      || trainingSetUsersHashMap.right.has(userObj.userId)
                      ) 
                    {
                      hmHit = MODULE_ID_PREFIX + " | **> UNZIP";
                    }

                    if ((userObj.category === "left") || (userObj.category === "right") || (userObj.category === "neutral")) {

                      trainingSetUsersHashMap[userObj.category].set(userObj.nodeId, userObj);

                      if ((configuration.testMode && (statsObj.users.unzipped % 100 === 0)) || configuration.verbose || (statsObj.users.unzipped % 1000 === 0)) {

                        console.log(chalkLog(hmHit
                          + " [" + statsObj.users.unzipped + "]"
                          + " USERS - L: " + trainingSetUsersHashMap.left.size
                          + " N: " + trainingSetUsersHashMap.neutral.size
                          + " R: " + trainingSetUsersHashMap.right.size
                          + " | " + userObj.userId
                          + " | @" + userObj.screenName
                          + " | " + userObj.name
                          + " | FLWRs: " + userObj.followersCount
                          + " | FRNDs: " + userObj.friendsCount
                          + " | FRNDs DB: " + userObj.friends.length
                          + " | CAT M: " + userObj.category + " A: " + userObj.categoryAuto
                        ));
                      }

                      zipfile.readEntry();
                    }
                    else{
                      console.log(chalkAlert(MODULE_ID_PREFIX + " | ??? UNCAT UNZIPPED USER"
                        + " [" + statsObj.users.unzipped + "]"
                        + " USERS - L: " + trainingSetUsersHashMap.left.size
                        + " N: " + trainingSetUsersHashMap.neutral.size
                        + " R: " + trainingSetUsersHashMap.right.size
                        + " | " + userObj.userId
                        + " | @" + userObj.screenName
                        + " | " + userObj.name
                        + " | FLWRs: " + userObj.followersCount
                        + " | FRNDs: " + userObj.friendsCount
                        + " | CAT M: " + userObj.category + " A: " + userObj.categoryAuto
                      ));                      

                      zipfile.readEntry();
                    }
                  }
                }
                catch (e){
                  console.log(chalkError(MODULE_ID_PREFIX + " | *** UNZIP READ STREAM ERROR: " + err));
                  return reject(e);
                }
              });

              readStream.on("data",function(chunk){
                const part = chunk.toString();
                userString += part;
              });

              readStream.on("close", function(){
                console.log(chalkBlueBold(MODULE_ID_PREFIX + " | UNZIP STREAM CLOSED"));
                resolve();
              });

              readStream.on("error", function(err){
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
      console.log(chalkError(MODULE_ID_PREFIX + " | *** USER ARCHIVE READ ERROR: " + err));
      return reject(new Error("USER ARCHIVE READ ERROR"));
    }

  });
}

function updateTrainingSet(p){

  console.log(chalkBlue(MODULE_ID_PREFIX + " | UPDATE TRAINING SET"));

  const params = p || {};

  const equalCategoriesFlag = (params.equalCategoriesFlag !== undefined) ? params.equalCategoriesFlag : configuration.equalCategoriesFlag;

  return new Promise(function(resolve, reject) {

    try {

      trainingSetObj = {};
      trainingSetObj.meta = {};
      trainingSetObj.meta.numInputs = 0;
      trainingSetObj.meta.numOutputs = 3;
      trainingSetObj.meta.setSize = 0;
      trainingSetObj.data = [];

      testSetObj = {};
      testSetObj.meta = {};
      testSetObj.meta.numInputs = 0;
      testSetObj.meta.numOutputs = 3;
      testSetObj.meta.setSize = 0;
      testSetObj.data = [];

      const minCategorySize = Math.min(
        trainingSetUsersHashMap.left.size, 
        trainingSetUsersHashMap.neutral.size, 
        trainingSetUsersHashMap.right.size
      );

      async.eachSeries(["left", "neutral", "right"], function(category, cb){

        const categorySize = (equalCategoriesFlag) ? minCategorySize : trainingSetUsersHashMap[category].size;

        const trainingSetSize = parseInt((1 - configuration.testSetRatio) * categorySize);
        const testSetSize = parseInt(configuration.testSetRatio * categorySize);

        const shuffledTrainingSet = _.shuffle(trainingSetUsersHashMap[category].values());

        const trainingSetData = shuffledTrainingSet.slice(0, trainingSetSize);
        const testSetData = shuffledTrainingSet.slice(trainingSetSize, trainingSetSize+testSetSize);

        trainingSetObj.data = trainingSetObj.data.concat(trainingSetData);
        testSetObj.data = testSetObj.data.concat(testSetData);

        console.log(chalkLog(MODULE_ID_PREFIX + " | TRAINING SET | " + category.toUpperCase()
          + " | EQ CATEGORIES FLAG: " + equalCategoriesFlag
          + " | MIN CAT SIZE: " + minCategorySize
          + " | CAT SIZE: " + categorySize
          + " | TRAIN SIZE: " + trainingSetSize
          + " | TEST SIZE: " + testSetSize
          + " | TRAIN SET DATA SIZE: " + trainingSetObj.data.length
        ));

        cb();

      }, function(err){

        if (err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** UPDATE TRAINING SET ERROR: " + err));
          return reject(err);
        }

        trainingSetObj.data = _.shuffle(trainingSetObj.data);
        testSetObj.data = _.shuffle(testSetObj.data);

        trainingSetObj.meta.setSize = trainingSetObj.data.length;
        testSetObj.meta.setSize = testSetObj.data.length;

        if (nnTools.getMaxInputHashMap()) {
          console.log(chalkLog(MODULE_ID_PREFIX + " | maxInputHashMap"
            + "\n" + jsonPrint(Object.keys(nnTools.getMaxInputHashMap()))
          ));
        }

        if (nnTools.getNormalization()) {
          console.log(chalkLog(MODULE_ID_PREFIX + " | NORMALIZATION"
            + "\n" + jsonPrint(nnTools.getNormalization())
          ));
        }

        console.log(chalkLog(MODULE_ID_PREFIX + " | TRAINING SET"
          + " | SIZE: " + trainingSetObj.meta.setSize
          + " | TEST SIZE: " + testSetObj.meta.setSize
        ));

        resolve();

      });

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** updateTrainingSet ERROR:", err));
      reject(err);
    }

  });
}

let existsInterval;

function waitFileExists(params){

  return new Promise(function(resolve, reject){

    clearInterval(existsInterval);

    const interval = params.interval || 5*ONE_MINUTE;
    const maxWaitTime = params.maxWaitTime || configuration.userArchiveFileExistsMaxWaitTime;

    const endWaitTimeMoment = moment().add(maxWaitTime, "ms");

    let exists = fs.existsSync(params.path);

    if (exists) {

      console.log(chalkLog(MODULE_ID_PREFIX
        + " | FILE EXISTS"
        // + " | MAX WAIT TIME: " + msToTime(maxWaitTime)
        + " | NOW: " + getTimeStamp()
        // + " | END WAIT TIME: " + endWaitTimeMoment.format(compactDateTimeFormat)
        + " | PATH: " + params.path
      ));

      return resolve();
    }

    console.log(chalkAlert(MODULE_ID_PREFIX
      + " | !!! FILE DOES NOT EXIST | START WAIT"
      + " | MAX WAIT TIME: " + msToTime(maxWaitTime)
      + " | NOW: " + getTimeStamp()
      + " | END WAIT TIME: " + endWaitTimeMoment.format(compactDateTimeFormat)
      + " | PATH: " + params.path
    ));

    existsInterval = setInterval(function(){

      exists = fs.existsSync(params.path);

      if (exists) {
        clearInterval(existsInterval);
        console.log(chalkGreenBold(MODULE_ID_PREFIX
          + " | FILE EXISTS"
          + " | MAX WAIT TIME: " + msToTime(maxWaitTime)
          + " | NOW: " + getTimeStamp()
          + " | END WAIT TIME: " + endWaitTimeMoment.format(compactDateTimeFormat)
          + " | PATH: " + params.path
        ));
        return resolve();
      }
      else if (moment().isAfter(endWaitTimeMoment)){
        clearInterval(existsInterval);
        console.log(chalkError(MODULE_ID_PREFIX
          + " | *** WAIT FILE EXISTS EXPIRED"
          + " | MAX WAIT TIME: " + msToTime(maxWaitTime)
          + " | NOW: " + getTimeStamp()
          + " | END WAIT TIME: " + endWaitTimeMoment.format(compactDateTimeFormat)
          + " | PATH: " + params.path
        ));
        return reject(new Error("WAIT FILE EXISTS EXPIRED: " + msToTime(maxWaitTime)));
      }
      else{
        console.log(chalkAlert(MODULE_ID_PREFIX
          + " | ... WAIT FILE EXISTS"
          + " | MAX WAIT TIME: " + msToTime(maxWaitTime)
          + " | NOW: " + getTimeStamp()
          + " | END WAIT TIME: " + endWaitTimeMoment.format(compactDateTimeFormat)
          + " | PATH: " + params.path
        ));
      }

    }, interval);

  });
}

let sizeInterval;

function fileSize(params){

  return new Promise(function(resolve, reject){

    clearInterval(sizeInterval);

    const interval = params.interval || 10*ONE_SECOND;

    console.log(chalkLog(MODULE_ID_PREFIX + " | WAIT FILE SIZE: " + params.path + " | EXPECTED SIZE: " + params.size));

    let stats;
    let size = 0;
    let prevSize = 0;

    let exists = fs.existsSync(params.path);

    if (exists) {

      try {
        stats = fs.statSync(params.path);
        size = stats.size;
        prevSize = stats.size;

        if (params.size && (size === params.size)) {
          console.log(chalkGreen(MODULE_ID_PREFIX + " | FILE SIZE EXPECTED | " + getTimeStamp()
            + " | EXISTS: " + exists
            + " | CUR: " + size
            + " | EXPECTED: " + params.size
            + " | " + params.path
          ));
          return resolve();
        }

        sizeInterval = setInterval(function(){

          console.log(chalkInfo(MODULE_ID_PREFIX + " | FILE SIZE | " + getTimeStamp()
            + " | EXISTS: " + exists
            + " | CUR: " + size
            + " | PREV: " + prevSize
            + " | EXPECTED: " + params.size
            + " | " + params.path
          ));

          exists = fs.existsSync(params.path);

          if (exists) {
            fs.stat(params.path, function(err, stats){

              if (err) {
                return reject(err);
              }

              prevSize = size;
              size = stats.size;

              if ((size > 0) && ((params.size && (size === params.size)) || (size === prevSize))) {

                clearInterval(sizeInterval);

                console.log(chalkGreen(MODULE_ID_PREFIX + " | FILE SIZE STABLE | " + getTimeStamp()
                  + " | EXISTS: " + exists
                  + " | CUR: " + size
                  + " | PREV: " + prevSize
                  + " | EXPECTED: " + params.size
                  + " | " + params.path
                ));

                return resolve();
              }
            });
          }

        }, interval);

      }
      catch(err){
        return reject(err);
      }
    }
    else {
      console.log(chalkAlert(MODULE_ID_PREFIX + " | ??? FILE SIZE | NON-EXISTENT FILE | " + getTimeStamp()
        + " | EXISTS: " + exists
        + " | EXPECTED: " + params.size
        + " | " + params.path
      ));

      return reject(new Error("NON-EXISTENT FILE: " + params.path));
    }

  });
}

async function loadUsersArchive(params){

  try {
    let file = params.archiveFlagObj.file;

    if (configuration.testMode) {
      file = file.replace(/users\.zip/, "users_test.zip");
    }

    params.archiveFlagObj.folder = params.archiveFlagObj.folder || configuration.userArchiveFolder;
    params.archiveFlagObj.path = (params.archiveFlagObj.path !== undefined) ? params.archiveFlagObj.path : params.archiveFlagObj.folder + "/" + file;

    console.log(chalkLog(MODULE_ID_PREFIX 
      + " | LOADING USERS ARCHIVE"
      + " | " + getTimeStamp() 
      + "\n PATH:   " + params.archiveFlagObj.path
      + "\n FOLDER: " + params.archiveFlagObj.folder
      + "\n FILE:   " + file
    ));

    console.log(chalkLog(MODULE_ID_PREFIX 
      + " | USER ARCHIVE FILE | FILE: " + params.archiveFlagObj.file 
      + " | SIZE: " + params.archiveFlagObj.size
      + " | TOTAL USERS: " + params.archiveFlagObj.histogram.total
      + " | CAT: L/N/R: " + params.archiveFlagObj.histogram.left 
      + "/" + params.archiveFlagObj.histogram.neutral 
      + "/" + params.archiveFlagObj.histogram.right
    ));

    // defaultUserArchiveFlagFile
    // {
    //   "file": "google_20200211_130922_users.zip",
    //   "size": 1109751363,
    //   "histogram": {
    //     "left": 25157,
    //     "right": 25159,
    //     "neutral": 1981,
    //     "positive": 0,
    //     "negative": 0,
    //     "none": 0,
    //     "total": 52297
    //   }
    // }

    await waitFileExists(params.archiveFlagObj);
    await fileSize(params.archiveFlagObj);
    await unzipUsersToArray(params.archiveFlagObj);
    await updateTrainingSet();
    return;
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD USERS ARCHIVE ERROR | " + getTimeStamp() + " | " + err));
    throw err;
  }
}

async function loadTrainingSet(){

  try{
    statsObj.status = "LOAD TRAINING SET";

    console.log(chalkLog(MODULE_ID_PREFIX
      + " | LOAD ARCHIVE FLAG FILE: " + configuration.userArchiveFolder + "/" + configuration.defaultUserArchiveFlagFile
    ));

    const archiveFlagObj = await tcUtils.loadFileRetry({folder: configuration.userArchiveFolder, file: configuration.defaultUserArchiveFlagFile});
    console.log(chalkNetwork(MODULE_ID_PREFIX + " | USERS ARCHIVE FLAG FILE\n" + jsonPrint(archiveFlagObj)));

    // defaultUserArchiveFlagFile
    // {
    //   "file": "google_20200211_130922_users.zip",
    //   "size": 1109751363,
    //   "histogram": {
    //     "left": 25157,
    //     "right": 25159,
    //     "neutral": 1981,
    //     "positive": 0,
    //     "negative": 0,
    //     "none": 0,
    //     "total": 52297
    //   }
    // }

    console.log(chalkLog(MODULE_ID_PREFIX 
      + " | USER ARCHIVE FILE | FILE: " + archiveFlagObj.file 
      + " | SIZE: " + archiveFlagObj.size
      + " | TOTAL USERS: " + archiveFlagObj.histogram.total
      + " | CAT: L/N/R: " + archiveFlagObj.histogram.left 
      + "/" + archiveFlagObj.histogram.neutral 
      + "/" + archiveFlagObj.histogram.right
    ));

    if (archiveFlagObj.file !== statsObj.archiveFile) {

      statsObj.trainingSetReady = false;
      statsObj.loadUsersArchiveBusy = true;

      await loadUsersArchive({archiveFlagObj: archiveFlagObj});

      statsObj.archiveModified = getTimeStamp();
      statsObj.loadUsersArchiveBusy = false;
      statsObj.archiveFile = archiveFlagObj.file;
      statsObj.trainingSetReady = true;
      console.log(chalkGreenBold(MODULE_ID_PREFIX + " | TRAINING SET LOADED: " + archiveFlagObj.file));
      return;
    }
    else {
      console.log(chalkLog(MODULE_ID_PREFIX + " | USERS ARCHIVE SAME ... SKIPPING | " + archiveFlagObj.file + " | SIZE: " + archiveFlagObj.size));
      statsObj.loadUsersArchiveBusy = false;
      statsObj.trainingSetReady = true;
      return;
    }

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** USERS ARCHIVE FLAG FILE LOAD ERROR: " + err));
    statsObj.loadUsersArchiveBusy = false;
    statsObj.trainingSetReady = false;
    throw err;
  }
}

async function testNetworkData(params){

  const testSet = params.testSet;

  const convertDatumFlag = (params.convertDatumFlag !== undefined) ? params.convertDatumFlag : false;
  // const binaryMode = (params.binaryMode !== undefined) ? params.binaryMode : configuration.binaryMode;
  const userProfileOnlyFlag = (params.userProfileOnlyFlag !== undefined) ? params.userProfileOnlyFlag : configuration.userProfileOnlyFlag;

  const verbose = params.verbose || false;

  let numTested = 0;
  let numPassed = 0;
  let successRate = 0;

  for(const datum of testSet){

    const activateParams = {
      user: datum.user, 
      datum: datum, // user, input, output
      convertDatumFlag: convertDatumFlag, 
      userProfileOnlyFlag: userProfileOnlyFlag,
      // binaryMode: binaryMode, 
      verbose: verbose
    };

    let testOutput;
    
    try{
      testOutput = await nnTools.activateSingleNetwork(activateParams);
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX
        + " | TEST NN ERROR "
        + "\n" + jsonPrint(err)
      ));
      throw err;
    }

    numTested += 1;

    let match = "FAIL";
    let currentChalk = chalkAlert;

    if (testOutput.categoryAuto === datum.user.category){
      match = "PASS";
      numPassed += 1;
      currentChalk = chalkGreenBold;
    }

    successRate = 100 * numPassed/numTested;

    if (configuration.testMode 
      || (configuration.verbose && (numTested % 10 === 0))
      || (numTested % 100 === 0)
    ){
      console.log(currentChalk(MODULE_ID_PREFIX + " | TESTING"
        + " | " + successRate.toFixed(2) + "%"
        + " | " + numPassed + "/" + numTested
        + " | CAT M: " + datum.user.category[0].toUpperCase() + " A: " + testOutput.categoryAuto[0].toUpperCase()
        + " | MATCH: " + match
        + " | @" + datum.user.screenName
      ));
    }
  }

  const testResults = { 
    testSetId: testSetObj.meta.testSetId, 
    numTests: numTested, 
    numPassed: numPassed, 
    successRate: successRate
  };

  console.log(chalkBlueBold("\n================================================\n"
    + MODULE_ID_PREFIX + " | TEST COMPLETE"
    + " | " + numPassed + "/" + testSetObj.meta.setSize
    + " | " + successRate.toFixed(2) + "%"
    + "\n================================================\n"
  ));

  return testResults;
}

async function testNetwork(p){

  const params = p || {};

  const binaryMode = (params.binaryMode !== undefined) ? params.binaryMode : configuration.binaryMode;
  const userProfileOnlyFlag = (params.userProfileOnlyFlag !== undefined) ? params.userProfileOnlyFlag : configuration.userProfileOnlyFlag;
  const userProfileCharCodesOnlyFlag = (params.userProfileCharCodesOnlyFlag !== undefined) ? params.userProfileCharCodesOnlyFlag : configuration.userProfileCharCodesOnlyFlag;

  const testSet = await dataSetPrep({
    inputsId: params.inputsId,
    dataSetObj: testSetObj,
    userProfileCharCodesOnlyFlag: userProfileCharCodesOnlyFlag,
    userProfileOnlyFlag: userProfileOnlyFlag,
    binaryMode: binaryMode,
    verbose: params.verbose
  });

  console.log(chalkBlue(MODULE_ID_PREFIX + " | TEST NETWORK"
    + " | NETWORK ID: " + childNetworkObj.networkId
    + " | USER PROFILE ONLY: " + userProfileOnlyFlag
    + " | " + testSet.length + " TEST DATA LENGTH"
    + " | VERBOSE: " + params.verbose
  ));

  await nnTools.loadNetwork({networkObj: childNetworkObj});
  await nnTools.setPrimaryNeuralNetwork(childNetworkObj.networkId);
  await nnTools.setBinaryMode(binaryMode);

  childNetworkObj.test = {};
  childNetworkObj.test.results = {};

  childNetworkObj.test.results = await testNetworkData({
    networkId: childNetworkObj.networkId, 
    testSet: testSet, 
    convertDatumFlag: false,
    userProfileOnlyFlag: userProfileOnlyFlag,
    binaryMode: binaryMode,
    verbose: params.verbose
  });

  childNetworkObj.successRate = childNetworkObj.test.results.successRate;

  return;
}

let processSendQueueInterval;
const processSendQueue = [];
let processSendQueueReady = true;

function initProcessSendQueue(params){

  const interval = (params) ? params.interval : 10;

  return new Promise(function(resolve){

    statsObj.status = "INIT PROCESS SEND QUEUE";

    clearInterval(processSendQueueInterval);

    processSendQueueInterval = setInterval(function(){

      if (processSendQueueReady && (processSendQueue.length > 0)){

        processSendQueueReady = false;

        const messageObj = processSendQueue.shift();

        processSend(messageObj)
        .then(function(){
          processSendQueueReady = true;
        })
        .catch(function(err){
          console.err("processSend ERROR: " + err);
          processSendQueueReady = true;
        });

      }

    }, interval);

    intervalsSet.add("processSendQueueInterval");

    resolve();

  });
}

function prepNetworkEvolve() {

  console.log(chalkBlueBold(MODULE_ID_PREFIX + " | PREP NETWORK EVOLVE OPTIONS"
    + " | " + getTimeStamp()
    + " | NNID: " + statsObj.training.testRunId
  ));

  const options = childNetworkObj.evolve.options;
  const schedStartTime = moment().valueOf();

  switch (childNetworkObj.networkTechnology){

    case "brain":

      options.error = options.error || options.errorThresh;
      
      options.schedule = function(schedParams){

        const elapsedInt = moment().valueOf() - schedStartTime;
        const iterationRate = elapsedInt/(schedParams.iterations+1);
        const timeToComplete = iterationRate*(options.iterations - (schedParams.iterations+1));

        const sObj = {
          networkTechnology: "BRAIN",
          binaryMode: childNetworkObj.binaryMode,
          networkId: childNetworkObj.networkId,
          numInputs: childNetworkObj.numInputs,
          inputsId: childNetworkObj.inputsId,
          evolveStart: schedStartTime,
          evolveElapsed: elapsedInt,
          totalIterations: options.iterations,
          iteration: schedParams.iterations+1,
          iterationRate: iterationRate,
          timeToComplete: timeToComplete,
          error: schedParams.error.toFixed(5) || Infinity,
        };

        console.log(chalkLog(MODULE_ID_PREFIX 
          + " | " + sObj.networkId 
          + " | " + sObj.networkTechnology.slice(0,1).toUpperCase()
          + " | " + sObj.networkId
          + " | " + sObj.inputsId
          + " | ERR " + sObj.error
          + " | R " + tcUtils.msToTime(sObj.evolveElapsed)
          + " | ETC " + tcUtils.msToTime(sObj.timeToComplete) + " " + moment().add(sObj.timeToComplete).format(compactDateTimeFormat)
          + " | " + (sObj.iterationRate/1000.0).toFixed(1) + " spi"
          + " | I " + sObj.iteration + "/" + sObj.totalIterations
        ));

        processSendQueue.push({op: "EVOLVE_SCHEDULE", childId: configuration.childId, childIdShort: configuration.childIdShort, stats: sObj});
      };
  
    break;
    default:
      options.schedule = {

        function: function(schedParams){

          const elapsedInt = moment().valueOf() - schedStartTime;
          const iterationRate = elapsedInt/schedParams.iteration;
          const timeToComplete = iterationRate*(options.iterations - schedParams.iteration);

          const fitness = schedParams.fitness || 0;

          statsObj.evolve.stats = schedParams;

          const sObj = {
            networkTechnology: childNetworkObj.networkTechnology,
            binaryMode: childNetworkObj.binaryMode,
            networkId: childNetworkObj.networkId,
            seedNetworkId: childNetworkObj.seedNetworkId,
            seedNetworkRes: childNetworkObj.seedNetworkRes,
            numInputs: childNetworkObj.numInputs,
            inputsId: childNetworkObj.inputsId,
            evolveStart: schedStartTime,
            evolveElapsed: elapsedInt,
            totalIterations: childNetworkObj.evolve.options.iterations,
            iteration: schedParams.iteration,
            iterationRate: iterationRate,
            timeToComplete: timeToComplete,
            error: schedParams.error.toFixed(5) || Infinity,
            fitness: fitness.toFixed(5) || -Infinity
          };

          processSendQueue.push({op: "EVOLVE_SCHEDULE", childId: configuration.childId, childIdShort: configuration.childIdShort, stats: sObj});

        },
        
        iterations: 1
      };


  }

  let finalOptions;

  if (childNetworkObj.networkTechnology === "carrot"){
    finalOptions = pick(options, carrotEvolveOptionsPickArray);
  }

  if (childNetworkObj.networkTechnology === "brain"){
    finalOptions = pick(options, brainTrainOptionsPickArray);
  }

  if (childNetworkObj.networkTechnology === "neataptic"){
    finalOptions = pick(options, neatapticEvolveOptionsPickArray);
  }

  if (!empty(options.network)) {
    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE OPTIONS | NETWORK: " + Object.keys(options.network)));
  }

  if ((childNetworkObj.networkTechnology === "neataptic") && (options.activation !== undefined) && (typeof options.activation === "string")) {
    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE OPTIONS | ACTIVATION: " + options.activation));
    finalOptions.activation = neataptic.methods.activation[options.activation];
  }

  if ((options.selection !== undefined) && (typeof options.selection === "string")) {
    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE OPTIONS | SELECTION: " + options.selection));
    finalOptions.selection = neataptic.methods.selection[options.selection];
  }

  if ((options.cost !== undefined) && (typeof options.cost === "string")) {
    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE OPTIONS | COST: " + options.cost));
    finalOptions.cost = neataptic.methods.cost[options.cost];
  }

  if ((options.mutation !== undefined) && (typeof options.mutation === "string")) {
    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE OPTIONS | MUTATION: " + options.mutation));
    finalOptions.mutation = neataptic.methods.mutation[options.mutation];
  }

  return finalOptions;
}

function dataSetPrep(p){

  return new Promise(function(resolve, reject){

    const params = p || {};
    const dataSetObj = params.dataSetObj;

    const userProfileCharCodesOnlyFlag = (params.userProfileCharCodesOnlyFlag !== undefined) ? params.userProfileCharCodesOnlyFlag : configuration.userProfileCharCodesOnlyFlag;
    const binaryMode = (params.binaryMode !== undefined) ? params.binaryMode : configuration.binaryMode;
    const userProfileOnlyFlag = (params.userProfileOnlyFlag !== undefined) ? params.userProfileOnlyFlag : configuration.userProfileOnlyFlag;

    const dataSet = [];

    let dataConverted = 0;

    // configuration.userCharCountScreenName = 15;
    // configuration.userCharCountName = 50;
    // configuration.userCharCountDescription = 160;
    // configuration.userCharCountLocation = 30;

    const numCharInputs = configuration.userCharCountScreenName 
      + configuration.userCharCountName 
      + configuration.userCharCountDescription 
      + configuration.userCharCountLocation;

    if (userProfileCharCodesOnlyFlag){
      dataSetObj.meta.numInputs = numCharInputs;
      childNetworkObj.numInputs = numCharInputs;
    }
    else{
      dataSetObj.meta.numInputs = childNetworkObj.numInputs;
    }

    console.log(chalkBlue(MODULE_ID_PREFIX
      + " | DATA SET preppedOptions"
      + " | DATA LENGTH: " + dataSetObj.data.length
      + " | INPUTS: " + dataSetObj.meta.numInputs
      + " | USER PROFILE ONLY: " + userProfileOnlyFlag
      + " | BIN MODE: " + binaryMode
      + "\nDATA SET META\n" + jsonPrint(dataSetObj.meta)
    ));

    const shuffledData = _.shuffle(dataSetObj.data);

    async.eachSeries(shuffledData, function(user, cb){

      try {

        if (!userProfileCharCodesOnlyFlag
          && (!user.profileHistograms || user.profileHistograms === undefined || user.profileHistograms === {}) 
          && (!user.tweetHistograms || user.tweetHistograms === undefined || user.tweetHistograms === {}))
        {
          console.log(chalkAlert(MODULE_ID_PREFIX + " | !!! EMPTY USER HISTOGRAMS ... SKIPPING | @" + user.screenName));
          return cb();
        }

        //convertDatumOneNetwork
        // results = {user: user, datum: datum, inputHits: inputHits, inputMisses: inputMisses, inputHitRate: inputHitRate};

        tcUtils.convertDatumOneNetwork({
          primaryInputsFlag: true, 
          user: user,
          inputsId: params.inputsId,
          userProfileCharCodesOnlyFlag: userProfileCharCodesOnlyFlag,
          userProfileOnlyFlag: userProfileOnlyFlag,
          binaryMode: binaryMode, 
          verbose: params.verbose
        }).
        then(function(results){

          if (results.emptyFlag) {
            debug(chalkAlert(MODULE_ID_PREFIX + " | !!! EMPTY CONVERTED DATUM ... SKIPPING | @" + user.screenName));
            return cb();
          }

          dataConverted += 1;

          if (results.datum.input.length !== childNetworkObj.numInputs) { 
            console.log(chalkError(MODULE_ID_PREFIX
              + " | *** ERROR DATA SET PREP ERROR" 
              + " | INPUT NUMBER MISMATCH" 
              + " | INPUTS NUM IN: " + childNetworkObj.numInputs
              + " | DATUM NUM IN: " + results.datum.input.length
            ));
            return cb(new Error("INPUT NUMBER MISMATCH"));
          }

          if (results.datum.output.length !== 3) { 
            console.log(chalkError(MODULE_ID_PREFIX
              + " | *** ERROR DATA SET PREP ERROR" 
              + " | OUTPUT NUMBER MISMATCH" 
              + " | OUTPUTS NUM IN: " + childNetworkObj.numOutputs
              + " | DATUM NUM IN: " + results.datum.output.length
            ));
            return cb(new Error("OUTPUT NUMBER MISMATCH"));
          }

          for(const inputValue of results.datum.input){
            if (typeof inputValue !== "number") {
              return cb(new Error("INPUT VALUE NOT TYPE NUMBER | @" + results.user.screenName + " | INPUT TYPE: " + typeof inputValue));
            }
            if (inputValue < 0) {
              return cb(new Error("INPUT VALUE LESS THAN ZERO | @" + results.user.screenName + " | INPUT: " + inputValue));
            }
            if (inputValue > 1) {
              return cb(new Error("INPUT VALUE GREATER THAN ONE | @" + results.user.screenName + " | INPUT: " + inputValue));
            }
          }

          for(const outputValue of results.datum.output){
            if (typeof outputValue !== "number") {
              return cb(new Error("OUTPUT VALUE NOT TYPE NUMBER | @" + results.user.screenName + " | OUTPUT TYPE: " + typeof outputValue));
            }
            if (outputValue < 0) {
              return cb(new Error("OUTPUT VALUE LESS THAN ZERO | @" + results.user.screenName + " | OUTPUT: " + outputValue));
            }
            if (outputValue > 1) {
              return cb(new Error("OUTPUT VALUE GREATER THAN ONE | @" + results.user.screenName + " | OUTPUT: " + outputValue));
            }
          }

          dataSet.push({
            user: results.user, 
            screenName: user.screenName, 
            name: results.datum.name, 
            input: results.datum.input, 
            output: results.datum.output,
            inputHits: results.inputHits,
            inputMisses: results.inputMisses,
            inputHitRate: results.inputHitRate
          });

          if (configuration.verbose || (dataConverted % 1000 === 0) || configuration.testMode && (dataConverted % 100 === 0)){
            console.log(chalkLog(MODULE_ID_PREFIX + " | DATA CONVERTED: " + dataConverted + "/" + dataSetObj.data.length));
          }

          cb();
        }).
        catch(function(err){
          console.log(chalkError(MODULE_ID_PREFIX
            + " | *** ERROR convertDatumOneNetwork: " + err 
          ));
          cb(err);
        });

      }
      catch(err){
        console.log(chalkError(MODULE_ID_PREFIX
          + " | *** ERROR DATA SET PREP: " + err 
        ));
        return cb(err);
      }

    }, function(err){

      if (err) {
        return reject(err);
      }

      console.log(chalkBlue(MODULE_ID_PREFIX + " | DATA SET PREP COMPLETE | DATA SET LENGTH: " + dataSet.length));

      resolve(dataSet);

    });

  });
}

const ignoreKeyArray = [
  "architecture",
  "log",
  "hiddenLayerSize",
  "inputsId",
  "inputsObj",
  "networkTechnology",
  "runId",
  "schedule",
  "schedStartTime",
  "seedNetworkId",
  "seedNetworkRes",
  "outputs",
  "popsize",
];

function createNetwork(){

  return new Promise(function(resolve, reject){

    let networkRaw;

    const numInputs = childNetworkObj.numInputs;

    switch (childNetworkObj.architecture) {

      case "seed":

        console.log(chalkBlueBold(MODULE_ID_PREFIX
          + " | " + configuration.childId
          + " | EVOLVE ARCH: LOADED | SEED: " + childNetworkObj.seedNetworkId
          + " | " + childNetworkObj.networkTechnology.toUpperCase()
         ));

        if (!empty(childNetworkObj.networkRaw) && (childNetworkObj.networkRaw.evolve !== undefined)){
          console.log(chalkLog(MODULE_ID_PREFIX + " | CHILD RAW NETWORK: " + childNetworkObj.seedNetworkId));
          networkRaw = childNetworkObj.networkRaw;
        }
        else if (!empty(childNetworkObj.network) && childNetworkObj.network.evolve !== undefined){
          console.log(chalkLog(MODULE_ID_PREFIX + " | CHILD RAW NETWORK: " + childNetworkObj.seedNetworkId));
          childNetworkObj.networkRaw = childNetworkObj.network;
          networkRaw = childNetworkObj.network;
          delete childNetworkObj.network;
        }
        else{
          try {
            if (childNetworkObj.networkTechnology === "carrot"){
              if (!empty(childNetworkObj.networkRaw)){
                networkRaw = childNetworkObj.networkRaw;
                console.log(chalkLog(MODULE_ID_PREFIX + " | CHILD CARROT RAW NETWORK: " + childNetworkObj.seedNetworkId));
              }
              else if (!empty(childNetworkObj.network)){
                networkRaw = carrot.Network.fromJSON(childNetworkObj.network);
                console.log(chalkLog(MODULE_ID_PREFIX + " | CHILD CARROT RAW NETWORK: " + childNetworkObj.seedNetworkId));
              }
              else if (!empty(childNetworkObj.networkJson)){
                networkRaw = carrot.Network.fromJSON(childNetworkObj.networkJson);
                console.log(chalkLog(MODULE_ID_PREFIX + " | CHILD CARROT RAW NETWORK: " + childNetworkObj.seedNetworkId));
              }
            }
            else if (childNetworkObj.networkTechnology === "neataptic"){
              if (!empty(childNetworkObj.networkRaw)){
                networkRaw = childNetworkObj.networkRaw;
                console.log(chalkLog(MODULE_ID_PREFIX + " | CHILD NEATAPTIC RAW NETWORK: " + childNetworkObj.seedNetworkId));
              }
              else if (!empty(childNetworkObj.network)){
                networkRaw = neataptic.Network.fromJSON(childNetworkObj.network);
                console.log(chalkLog(MODULE_ID_PREFIX + " | CHILD NEATAPTIC RAW NETWORK: " + childNetworkObj.seedNetworkId));
              }
              else if (!empty(childNetworkObj.networkJson)){
                networkRaw = neataptic.Network.fromJSON(childNetworkObj.networkJson);
                console.log(chalkLog(MODULE_ID_PREFIX + " | CHILD NEATAPTIC RAW NETWORK: " + childNetworkObj.seedNetworkId));
              }
            }
            else if (childNetworkObj.networkTechnology === "brain"){
              if (!empty(childNetworkObj.networkRaw)){
                networkRaw = childNetworkObj.networkRaw;
                console.log(chalkLog(MODULE_ID_PREFIX + " | CHILD BRAIN RAW NETWORK: " + childNetworkObj.seedNetworkId));
              }
              else if (!empty(childNetworkObj.network)){
                networkRaw = new brain.NeuralNetwork();
                networkRaw.fromJSON(childNetworkObj.network);
                console.log(chalkLog(MODULE_ID_PREFIX + " | CHILD BRAIN RAW NETWORK: " + childNetworkObj.seedNetworkId));
              }
              else if (!empty(childNetworkObj.networkJson)){
                networkRaw = new brain.NeuralNetwork();
                networkRaw.fromJSON(childNetworkObj.networkJson);
                console.log(chalkLog(MODULE_ID_PREFIX + " | CHILD BRAIN RAW NETWORK: " + childNetworkObj.seedNetworkId));
              }
            }
            else{
              console.log(chalkError(MODULE_ID_PREFIX
                + " | TECH: " + childNetworkObj.networkTechnology
                + " | *** CHILD NO RAW NETWORK: " + childNetworkObj.seedNetworkId
              ));
              return reject(new Error("NO RAW NETWORK: " + childNetworkObj.networkId));
            }
          }
          catch(err){
            console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR CREATE NETWORK | " + childNetworkObj.networkTechnology + " fromJSON: " + err));
            return reject(err);
          }
        }

        console.log(chalkBlueBold(MODULE_ID_PREFIX
          + " | " + configuration.childId
          + " | " + childNetworkObj.networkTechnology.toUpperCase()
          + " | EVOLVE ARCH | LOADED: " + childNetworkObj.networkId
          + " | IN: " + numInputs
          + " | OUT: " + childNetworkObj.numOutputs
        ));

        resolve(networkRaw);
      break;

      case "perceptron":

        if (childNetworkObj.networkTechnology === "carrot"){

          if (childNetworkObj.hiddenLayerSize && (childNetworkObj.hiddenLayerSize > 0)){
            networkRaw = new carrot.architect.Perceptron(numInputs, childNetworkObj.hiddenLayerSize, 3);
          }
          else{
            childNetworkObj.architecture = "random";
            networkRaw = new carrot.Network(numInputs,3);
          }

          console.log(chalkBlueBold(MODULE_ID_PREFIX
            + " | " + configuration.childId
            + " | " + childNetworkObj.networkTechnology.toUpperCase()
            + " | " + childNetworkObj.architecture.toUpperCase()
            + " | IN: " + numInputs 
            + " | OUT: " + trainingSetObj.meta.numOutputs
            + " | HIDDEN LAYER NODES: " + childNetworkObj.hiddenLayerSize
          ));
          resolve(networkRaw);
        }
        else if (childNetworkObj.networkTechnology === "brain"){

          if (childNetworkObj.hiddenLayerSize){
            childNetworkObj.hiddenLayerSize = Math.min(configuration.brainHiddenLayerSize, childNetworkObj.hiddenLayerSize);
            childNetworkObj.hiddenLayerSize = Math.max(childNetworkObj.hiddenLayerSize, trainingSetObj.meta.numOutputs);
          }
          else{
            childNetworkObj.hiddenLayerSize = configuration.brainHiddenLayerSize;
          }

          networkRaw = new brain.NeuralNetwork({
            inputSize: numInputs,
            outputSize: trainingSetObj.meta.numOutputs
          });

          console.log(chalkBlueBold(MODULE_ID_PREFIX
            + " | " + configuration.childId
            + " | " + childNetworkObj.networkTechnology.toUpperCase()
            + " | " + childNetworkObj.architecture.toUpperCase()
            + " | IN: " + numInputs 
            + " | OUT: " + trainingSetObj.meta.numOutputs
            + " | HIDDEN LAYER NODES: " + childNetworkObj.hiddenLayerSize
          ));

          resolve(networkRaw);
        }
        else{

          if (childNetworkObj.hiddenLayerSize){
            childNetworkObj.hiddenLayerSize = Math.min(configuration.neatapticHiddenLayerSize, childNetworkObj.hiddenLayerSize);
            childNetworkObj.hiddenLayerSize = Math.max(childNetworkObj.hiddenLayerSize, trainingSetObj.meta.numOutputs);
          }
          else{
            childNetworkObj.hiddenLayerSize = configuration.neatapticHiddenLayerSize;
          }

          networkRaw = new neataptic.architect.Perceptron(numInputs, childNetworkObj.hiddenLayerSize, 3);

          console.log(chalkBlueBold(MODULE_ID_PREFIX
            + " | " + configuration.childId
            + " | " + childNetworkObj.networkTechnology.toUpperCase()
            + " | " + childNetworkObj.architecture.toUpperCase()
            + " | IN: " + numInputs 
            + " | OUT: " + trainingSetObj.meta.numOutputs
            + " | HIDDEN LAYER NODES: " + childNetworkObj.hiddenLayerSize
          ));

          resolve(networkRaw);
        }
      break;

      default:

        childNetworkObj.architecture = "random";

        console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE ARCH"
          + " | " + configuration.childId
          + " | " + childNetworkObj.networkTechnology.toUpperCase()
          + " | " + childNetworkObj.architecture.toUpperCase()
          + " | INPUTS: " + numInputs
          + " | OUTPUTS: " + trainingSetObj.meta.numOutputs
        ));

        if (childNetworkObj.networkTechnology === "brain"){
          networkRaw = new brain.NeuralNetwork({inputSize: numInputs, outputSize: 3});
          resolve(networkRaw);
        }
        else if (childNetworkObj.networkTechnology === "carrot"){
          networkRaw = new carrot.Network(numInputs, 3);
          resolve(networkRaw);
        }
        else{
          networkRaw = new neataptic.Network(numInputs, 3);
          resolve(networkRaw);
        }
    }

  });
}

async function evolve(params){

  try {

    console.log(chalkBlue(MODULE_ID_PREFIX + " | >>> START NETWORK EVOLVE"
      + " | TECH: " + childNetworkObj.networkTechnology
      + " | NN: " + childNetworkObj.networkId
      + " | SEED: " + childNetworkObj.seedNetworkId
      + " | IN: " + childNetworkObj.inputsId
    ));

    let inputsObj = await global.wordAssoDb.NetworkInputs.findOne({inputsId: childNetworkObj.inputsId}).lean();

    if (!inputsObj) {

      const file = childNetworkObj.inputsId + ".json";

      console.log(chalkAlert(MODULE_ID_PREFIX
        + " | !!! INPUTS OBJ NOT IN DB: " + childNetworkObj.inputsId
      ));

      inputsObj = await tcUtils.loadFileRetry({
        folder: configDefaultFolder, 
        file: file
      });

      if (!inputsObj) {
        throw new Error("evolve INPUTS OBJ NOT FOUND: " + childNetworkObj.inputsId);
      }
    }
    
    childNetworkObj.numInputs = inputsObj.meta.numInputs;
    trainingSetObj.meta.numInputs = inputsObj.meta.numInputs;

    const binaryMode = (params.binaryMode !== undefined) ? params.binaryMode : configuration.binaryMode;
    const userProfileOnlyFlag = inputsObj.meta.userProfileOnlyFlag || false;
    let userProfileCharCodesOnlyFlag = (params.userProfileCharCodesOnlyFlag !== undefined) ? params.userProfileCharCodesOnlyFlag : configuration.userProfileCharCodesOnlyFlag;

    if (childNetworkObj.inputsId !== configuration.userProfileCharCodesOnlyInputsId){

      console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX userProfileCharCodesOnlyFlag"
        + " | ARCH: " + childNetworkObj.architecture
        + " | TECH: " + childNetworkObj.networkTechnology
        + " | NN: " + childNetworkObj.networkId
        + " | IN: " + childNetworkObj.inputsId
      ));

      userProfileCharCodesOnlyFlag = false;
    }

    if (childNetworkObj.meta === undefined) { childNetworkObj.meta = {}; }
    childNetworkObj.meta.userProfileOnlyFlag = userProfileOnlyFlag;

    await tcUtils.loadInputs({inputsObj: inputsObj});
    await tcUtils.setPrimaryInputs({inputsId: inputsObj.inputsId});

    const trainingSet = await dataSetPrep({
      inputsId: inputsObj.inputsId,
      dataSetObj: trainingSetObj, 
      userProfileCharCodesOnlyFlag: userProfileCharCodesOnlyFlag,
      userProfileOnlyFlag: userProfileOnlyFlag,
      binaryMode: binaryMode,
      verbose: params.verbose
    });

    const childNetworkRaw = await createNetwork({userProfileCharCodesOnlyFlag: userProfileCharCodesOnlyFlag});

    const preppedOptions = await prepNetworkEvolve({userProfileCharCodesOnlyFlag: userProfileCharCodesOnlyFlag});

    let evolveResults;

    if (childNetworkObj.networkTechnology === "brain"){

      childNetworkObj.inputsId = inputsObj.inputsId;
      childNetworkObj.numInputs = inputsObj.meta.numInputs;

      evolveResults = await nnTools.streamTrainNetwork({
        options: preppedOptions,
        network: childNetworkRaw, 
        trainingSet: trainingSet
      });

      childNetworkObj.networkRaw = evolveResults.network;
      childNetworkObj.networkJson = childNetworkObj.networkRaw.toJSON();

      delete evolveResults.network;

      evolveResults.threads = 1;
      evolveResults.fitness = 0;

      statsObj.evolve.endTime = moment().valueOf();
      statsObj.evolve.elapsed = moment().valueOf() - statsObj.evolve.startTime;
      statsObj.evolve.results = evolveResults.stats;

      childNetworkObj.evolve.results = {};
      childNetworkObj.evolve.results = evolveResults.stats;

      childNetworkObj.elapsed = statsObj.evolve.elapsed;
      childNetworkObj.evolve.elapsed = statsObj.evolve.elapsed;
      childNetworkObj.evolve.startTime = statsObj.evolve.startTime;
      childNetworkObj.evolve.endTime = statsObj.evolve.endTime;
    }
    else{
      evolveResults = await childNetworkRaw.evolve(trainingSet, preppedOptions);

      childNetworkObj.networkJson = childNetworkRaw.toJSON();
      childNetworkObj.networkRaw = childNetworkRaw;

      evolveResults.threads = preppedOptions.threads;
      evolveResults.fitness = statsObj.evolve.stats.fitness;

      statsObj.evolve.endTime = moment().valueOf();
      statsObj.evolve.elapsed = moment().valueOf() - statsObj.evolve.startTime;
      statsObj.evolve.results = evolveResults;

      childNetworkObj.evolve.results = {};
      childNetworkObj.evolve.results = evolveResults;

      childNetworkObj.elapsed = statsObj.evolve.elapsed;
      childNetworkObj.evolve.elapsed = statsObj.evolve.elapsed;
      childNetworkObj.evolve.startTime = statsObj.evolve.startTime;
      childNetworkObj.evolve.endTime = statsObj.evolve.endTime;
    }

    console.log(chalkBlueBold("=======================================================\n"
      + MODULE_ID_PREFIX
      + " | EVOLVE COMPLETE"
      + " | " + configuration.childId
      + " | " + getTimeStamp()
      + " | " + "TECH: " + childNetworkObj.networkTechnology
      + " | " + "INPUT ID: " + childNetworkObj.inputsId
      + " | " + "INPUTS: " + childNetworkObj.numInputs
      + " | " + "TIME: " + evolveResults.time
      + " | " + "THREADS: " + evolveResults.threads
      + " | " + "ITERATIONS: " + evolveResults.iterations
      + " | " + "ERROR: " + evolveResults.error
      + " | " + "ELAPSED: " + msToTime(statsObj.evolve.elapsed)
      + "\n======================================================="
    ));

    if ((childNetworkObj.networkTechnology !== "brain") 
      && (evolveResults.iterations !== childNetworkObj.evolve.options.iterations)) {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR: ITERATIONS"
        + " | EXPECTED: " + childNetworkObj.evolve.options.iterations
        + " | ACTUAL: " + evolveResults.iterations
      ));
    }
    return;
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR: " + err));
    console.trace(err);
    throw err;
  }
}

function networkEvolve(p){

  return new Promise(function(resolve, reject){

    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | NETWORK EVOLVE | " + configuration.childId));

    const params = childNetworkObj.evolve.options;

    const binaryMode = (params.binaryMode !== undefined) ? params.binaryMode : configuration.binaryMode;
    const userProfileCharCodesOnlyFlag = (params.userProfileCharCodesOnlyFlag !== undefined) ? params.userProfileCharCodesOnlyFlag : configuration.userProfileCharCodesOnlyFlag;

    const options = {};

    if (params.seedNetworkId) {
      params.architecture = "seed";
      params.networkTechnology = (params.networkTechnology) ? params.networkTechnology : "neataptic";
      debug(chalkAlert(MODULE_ID_PREFIX + " | START NETWORK DEFINED: " + params.networkId));
    }

    if (!params.architecture || (params.architecture === undefined)) { params.architecture = "random"; }
    if (!params.networkTechnology || (params.networkTechnology === undefined)) { 
      params.networkTechnology = configuration.networkTechnology;
    }

    const networkTech = (params.networkTechnology === "carrot") ? carrot : neataptic;

    statsObj.evolve.startTime = moment().valueOf();
    statsObj.evolve.elapsed = 0;
    statsObj.evolve.stats = {};

    async.eachSeries(Object.keys(params), function(key, cb){

      debug(">>>> KEY: " + key);

      switch (key) {

        case "networkObj":
          console.log(MODULE_ID_PREFIX
            + " | " + configuration.childId
            + " | EVOLVE OPTION"
            + " | NN ID: " + key + ": " + params[key].networkId 
            + " | IN: " + params[key].inputsId
            + " | SR: " + params[key].successRate.toFixed(2) + "%"
          );
        break;

        case "network":
          if (!empty(params.network)){
            console.log(MODULE_ID_PREFIX + " | " + configuration.childId + " | EVOLVE OPTION | " + key + "\n" + Object.keys(params[key]));
          }
          else {
            console.log(MODULE_ID_PREFIX + " | " + configuration.childId + " | EVOLVE OPTION | " + key + ": " + params[key]);
          }
        break;
              
        case "mutation":
          console.log(MODULE_ID_PREFIX + " | " + configuration.childId + " | EVOLVE OPTION | " + key + ": " + params[key]);
          options.mutation = networkTech.methods.mutation[params[key]];
        break;
              
        case "selection":
          console.log(MODULE_ID_PREFIX + " | " + configuration.childId + " | EVOLVE OPTION | " + key + ": " + params[key]);
          options.selection = networkTech.methods.selection[params[key]];
        break;
              
        case "cost":
          console.log(MODULE_ID_PREFIX + " | " + configuration.childId + " | EVOLVE OPTION | " + key + ": " + params[key]);
          options.cost = networkTech.methods.cost[params[key]];
        break;

        case "activation":
          console.log(MODULE_ID_PREFIX + " | " + configuration.childId + " | EVOLVE OPTION | " + key + ": " + params[key]);
          options.activation = networkTech.methods.activation[params[key]];
        break;

        default:
          if (!ignoreKeyArray.includes(key)){
            console.log(MODULE_ID_PREFIX + " | " + configuration.childId + " | EVOLVE OPTION | " + key + ": " + params[key]);
            options[key] = params[key];
          }
      }

      cb();

    }, async function(err){

      try{

        if (err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** networkEvolve ERROR: " + err));
          return reject(err);
        }

        await evolve({userProfileCharCodesOnlyFlag: userProfileCharCodesOnlyFlag, binaryMode: binaryMode, verbose: p.verbose});

        console.log(chalkGreen(MODULE_ID_PREFIX + " | END networkEvolve"));

        resolve();
      }
      catch(e){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR: " + e));
        return reject(e);
      }

    });

  });
}

//=========================================================================
// FSM
//=========================================================================
const Stately = require("stately.js");
const FSM_TICK_INTERVAL = ONE_SECOND;

let fsmTickInterval;
let fsmPreviousState = "IDLE";

statsObj.fsmState = "---";

function reporter(event, oldState, newState) {

  statsObj.fsmState = newState;

  fsmPreviousState = oldState;

  console.log(chalkLog(MODULE_ID_PREFIX + " | --------------------------------------------------------\n"
    + MODULE_ID_PREFIX + " | << FSM >> CHILD"
    + " | " + configuration.childId
    + " | " + event
    + " | " + fsmPreviousState
    + " -> " + newState
    + "\n" + MODULE_ID_PREFIX + " | --------------------------------------------------------"
  ));
}

const fsmStates = {

  "RESET": {

    onEnter: function(event, oldState, newState) {

      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
        statsObj.fsmStatus = "RESET";
      }

    },

    fsm_tick: function() {
    },

    "fsm_init": "INIT",
    "fsm_idle": "IDLE",
    "fsm_exit": "EXIT",
    "fsm_resetEnd": "IDLE"
  },

  "IDLE": {
    onEnter: function(event, oldState, newState) {

      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);

        statsObj.fsmStatus = "IDLE";
      }

    },

    fsm_tick: function() {
    },

    "fsm_init": "INIT",
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR"
  },

  "EXIT": {
    onEnter: function(event, oldState, newState) {
      reporter(event, oldState, newState);
      statsObj.fsmStatus = "EXIT";
    }
  },

  "ERROR": {
    onEnter: async function(event, oldState, newState) {
      reporter(event, oldState, newState);

      statsObj.fsmStatus = "ERROR";

      await processSend({op: "ERROR", childId: configuration.childId, err: statsObj.error, fsmStatus: statsObj.fsmStatus});

      if (configuration.quitOnError) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR | QUITTING ..."));
        quit({cause: "QUIT_ON_ERROR"});
      }
      else {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR | ==> READY STATE"));
        fsm.fsm_ready();
      }

    }
  },

  "INIT": {
    onEnter: async function(event, oldState, newState) {
      if (event !== "fsm_tick") {
        try {

          reporter(event, oldState, newState);
          statsObj.fsmStatus = "INIT";

          // await connectDb();
          await processSend({op: "STATS", childId: configuration.childId, fsmStatus: statsObj.fsmStatus});
          fsm.fsm_ready();
        }
        catch(err){
          console.log(MODULE_ID_PREFIX + " | *** INIT ERROR: " + err);
          statsObj.error = err;
          fsm.fsm_error();
        }
      }
    },
    fsm_tick: function() {
    },
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR",
    "fsm_ready": "READY",
    "fsm_reset": "RESET"
  },

  "READY": {
    onEnter: async function(event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
        statsObj.fsmStatus = "READY";
        await processSend({op: "STATS", childId: configuration.childId, fsmStatus: statsObj.fsmStatus});
      }
    },
    fsm_tick: function() {
    },
    "fsm_init": "INIT",
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET",
    "fsm_config_evolve": "CONFIG_EVOLVE"
  },

  "CONFIG_EVOLVE": {
    onEnter: async function(event, oldState, newState) {

      if (event !== "fsm_tick") {

        try{
          reporter(event, oldState, newState);
          statsObj.fsmStatus = "CONFIG_EVOLVE";

          await processSend({op: "STATS", childId: configuration.childId, fsmStatus: statsObj.fsmStatus});
          await loadTrainingSet();

          if (configuration.testMode) {
            trainingSetObj.data = _.shuffle(trainingSetObj.data);
            trainingSetObj.data.length = Math.min(trainingSetObj.data.length, TEST_MODE_LENGTH);
            testSetObj.data.length = parseInt(configuration.testSetRatio * trainingSetObj.data.length);
            trainingSetObj.meta.setSize = trainingSetObj.data.length;
            testSetObj.meta.setSize = testSetObj.data.length;
          }

          fsm.fsm_evolve();
        }
        catch(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** CONFIG_EVOLVE ERROR: " + err));
          statsObj.error = err;
          fsm.fsm_error();
        }
      }
    },
    fsm_tick: function() {
    },
    "fsm_init": "INIT",
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET",
    "fsm_evolve": "EVOLVE"
  },

  "EVOLVE": {
    onEnter: async function(event, oldState, newState) {
      if (event !== "fsm_tick") {

        try {

          reporter(event, oldState, newState);
          
          statsObj.fsmStatus = "EVOLVE";
          await processSend({op: "STATS", childId: configuration.childId, fsmStatus: statsObj.fsmStatus});

          await networkEvolve({userProfileCharCodesOnlyFlag: configuration.userProfileCharCodesOnlyFlag, verbose: configuration.verbose});

          await testNetwork({
            inputsId: childNetworkObj.inputsId,
            binaryMode: childNetworkObj.binaryMode, 
            verbose: configuration.verbose
          });

          console.log(chalkLog(MODULE_ID_PREFIX 
            + " | ... SAVING NN TO DB: " + childNetworkObj.networkId
            + " | INPUTS: " + childNetworkObj.inputsId
          ));

          try{

            const childNetworkObjSmall = omit(childNetworkObj, ["inputsObj", "network", "networkRaw", "evolve.options.network", "evolve.options.schedule"]);
            const nnDoc = new global.wordAssoDb.NeuralNetwork(childNetworkObjSmall);

            await nnDoc.save();
          }
          catch(e){
            console.trace(MODULE_ID_PREFIX + " | *** NN DB SAVE ERROR: ", e);
            throw e;
          }

          console.log(chalkGreen(MODULE_ID_PREFIX + " | +++ ADDED NN TO DB: " + childNetworkObj.networkId));

          const messageObj = {
            op: "EVOLVE_COMPLETE", 
            childId: configuration.childId, 
            networkId: childNetworkObj.networkId, 
            statsObj: statsObj.evolve.results
          };

          await processSend(messageObj);

          console.log(chalkLog(MODULE_ID_PREFIX + " | SENT EVOLVE_COMPLETE: " + childNetworkObj.networkId));
          fsm.fsm_evolve_complete();

        }
        catch(err){

          delete childNetworkObj.inputsObj;
          delete childNetworkObj.network;
          delete childNetworkObj.networkJson;
          delete childNetworkObj.networkRaw;
          delete childNetworkObj.evolve.options.network;
          delete childNetworkObj.evolve.options.schedule;

          const messageObj = {
            op: "EVOLVE_ERROR", 
            childId: configuration.childId, 
            networkId: childNetworkObj.networkId,
            networkObj: childNetworkObj,
            err: err,
            statsObj: statsObj.evolve.results
          };

          await processSend(messageObj);
          console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR: " + err));
          console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR\nnetworkObj.meta\n" + jsonPrint(childNetworkObj.meta)));
          console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR\ntrainingSet\n" + jsonPrint(trainingSetObj.meta)));
          console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR\ntestSet\n" + jsonPrint(testSetObj.meta)));
          fsm.fsm_evolve_complete();
        }

      }
    },
    fsm_tick: function() {
    },
    "fsm_init": "INIT",
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET",
    "fsm_evolve_complete": "EVOLVE_COMPLETE"
  },

  "EVOLVE_COMPLETE": {

    onEnter: async function(event, oldState, newState) {

      if (event !== "fsm_tick") {

        reporter(event, oldState, newState);
        statsObj.fsmStatus = "EVOLVE_COMPLETE";

        await processSend({op: "STATS", childId: configuration.childId, fsmStatus: statsObj.fsmStatus});

        if (configuration.quitOnComplete) {
          console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE COMPLETE | QUITTING ..."));
          quit({cause: "QUIT_ON_COMPLETE"});
        }
        else {
          console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE COMPLETE"));
          fsm.fsm_ready();
        }

      }

    },

    fsm_tick: function() {
    },

    "fsm_init": "INIT",
    "fsm_ready": "READY",
    "fsm_exit": "EXIT",
    "fsm_reset": "RESET",
    "fsm_error": "ERROR",
    "fsm_resetEnd": "IDLE"
  },
};

const fsm = Stately.machine(fsmStates);

function initFsmTickInterval(interval) {

  console.log(chalkLog(MODULE_ID_PREFIX + " | INIT FSM TICK INTERVAL | " + msToTime(interval)));

  clearInterval(fsmTickInterval);

  fsmTickInterval = setInterval(function() {
    fsm.fsm_tick();
  }, FSM_TICK_INTERVAL);
}

reporter("START", "---", fsm.getMachineState());

console.log(MODULE_ID_PREFIX + " | =================================");
console.log(MODULE_ID_PREFIX + " | PROCESS TITLE: " + process.title);
console.log(MODULE_ID_PREFIX + " | HOST:          " + hostname);
console.log(MODULE_ID_PREFIX + " | PROCESS ID:    " + process.pid);
console.log(MODULE_ID_PREFIX + " | RUN ID:        " + statsObj.runId);
console.log(MODULE_ID_PREFIX + " | PROCESS ARGS   " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log(MODULE_ID_PREFIX + " | =================================");

console.log(chalkBlueBold(
    "\n=======================================================================\n"
  + MODULE_ID_PREFIX + " | " + MODULE_ID + " STARTED | " + getTimeStamp()
  + "\n=======================================================================\n"
));

async function networkDefaults(nnObj){

  try{
    if (empty(nnObj)) {
      console.trace(chalkError("networkDefaults ERROR: networkObj UNDEFINED"));
      throw new Error("networkDefaults ERROR: networkObj UNDEFINED");
    }

    if(empty(nnObj.networkTechnology)) { nnObj.networkTechnology = "neataptic"; }
    if(empty(nnObj.betterChild)) { nnObj.betterChild = false; }
    if(empty(nnObj.testCycles)) { nnObj.testCycles = 0; }
    if(empty(nnObj.testCycleHistory)) { nnObj.testCycleHistory = []; }
    if(empty(nnObj.overallMatchRate)) { nnObj.overallMatchRate = 0; }
    if(empty(nnObj.matchRate)) { nnObj.matchRate = 0; }
    if(empty(nnObj.successRate)) { nnObj.successRate = 0; }

    return nnObj;
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** networkDefaults ERROR: " + err));
    throw err;
  }
}

async function configNetworkEvolve(params){

  const newNetObj = {};

  if (params.testSetRatio !== undefined) { configuration.testSetRatio = params.testSetRatio; }

  console.log(chalkInfo(MODULE_ID_PREFIX + " | CONFIG EVOLVE"
    + " | CHILD ID: " + params.childId
    + " | ARCH: " + params.architecture
    + " | TECH: " + params.networkTechnology
    + " | IN: " + params.numInputs
    + " | SEED: " + params.seedNetworkId
    + " | SEED RES: " + params.seedNetworkRes
    + " | TEST SET RATIO: " + configuration.testSetRatio
  ));

  configuration.childId = params.childId;

  newNetObj.binaryMode = (params.binaryMode !== undefined) ? params.binaryMode : configuration.binaryMode;

  newNetObj.networkTechnology = params.networkTechnology || "neataptic";

  newNetObj.networkId = params.testRunId;
  newNetObj.architecture = params.architecture;
  newNetObj.seedNetworkId = (params.seedNetworkId && params.seedNetworkId !== undefined && params.seedNetworkId !== "false") ? params.seedNetworkId : false;
  newNetObj.seedNetworkRes = params.seedNetworkRes;
  newNetObj.networkCreateMode = "evolve";
  newNetObj.testRunId = params.testRunId;
  newNetObj.inputsId = params.inputsId;
  newNetObj.numInputs = params.numInputs;
  newNetObj.numOutputs = 3;
  newNetObj.outputs = [];
  newNetObj.outputs = params.outputs;

  newNetObj.evolve = {};
  newNetObj.evolve.results = {};
  newNetObj.evolve.options = {};

  newNetObj.evolve.options = pick(
    params,
    [
      "activation",
      "architecture",
      "binaryMode",
      "clear", 
      "cost", 
      "efficient_mutation", 
      "elitism", 
      "equal", 
      "error",
      "errorThresh",
      "fitness_population", 
      "growth",
      "hiddenLayerSize",
      "inputsId",
      "iterations",
      "learningRate",
      "momentum",
      "mutation", 
      "mutation_amount", 
      "mutation_rate",
      "networkTechnology",
      "outputs",
      "popsize", 
      "population_size", 
      "provenance",
      "runId",
      "seedNetworkId",
      "seedNetworkRes",
      "selection",
      "threads",
    ]
  );

  newNetObj.evolve.elapsed = statsObj.evolve.elapsed;
  newNetObj.evolve.startTime = statsObj.evolve.startTime;
  newNetObj.evolve.endTime = statsObj.evolve.endTime;

  if (newNetObj.evolve.options.seedNetworkId) {

    const seedNetworkDoc = await global.wordAssoDb.NeuralNetwork.findOne({networkId: newNetObj.seedNetworkId});

    seedNetworkObj = seedNetworkDoc.toObject();

    if (seedNetworkObj && seedNetworkObj.networkTechnology !== newNetObj.networkTechnology){
      console.log(chalkAlert(MODULE_ID_PREFIX + " | !!! CHANGE NETWORK TECH TO SEED NN TECH"
        + " | SEED: " + seedNetworkObj.networkTechnology
        + " --> CHILD: " + newNetObj.networkTechnology
      ));
      newNetObj.networkTechnology = seedNetworkObj.networkTechnology;
    }

    newNetObj.numInputs = seedNetworkObj.numInputs;
    newNetObj.numOutputs = seedNetworkObj.numOutputs;
    newNetObj.seedNetworkId = seedNetworkObj.networkId;
    newNetObj.seedNetworkRes = seedNetworkObj.successRate;

    if (!empty(seedNetworkObj.networkJson)) {
      newNetObj.networkJson = seedNetworkObj.networkJson;        
    }
    else if (!empty(seedNetworkObj.network)) {
      newNetObj.networkJson = seedNetworkObj.network;        
    }
    else {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** NN JSON UNDEFINED"
        + " | SEED: " + seedNetworkObj.networkId
        + " | TECH: " + seedNetworkObj.networkTechnology
      ));
      throw new Error("SEED NN JSON UNDEFINED: " + seedNetworkObj.networkId);
    }

    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE | " + getTimeStamp()
      + " | " + configuration.childId
      + " | " + newNetObj.networkId
      + " | BIN MODE: " + newNetObj.evolve.options.binaryMode
      + " | ARCH: " + newNetObj.architecture
      + " | TECH: " + newNetObj.networkTechnology
      + " | INPUTS: " + newNetObj.numInputs
      + " | HIDDEN: " + newNetObj.evolve.options.hiddenLayerSize
      + " | THREADs: " + newNetObj.evolve.options.threads
      + " | ITRS: " + newNetObj.evolve.options.iterations
      + " | SEED: " + newNetObj.seedNetworkId
      + " | SEED RES %: " + newNetObj.seedNetworkRes
    ));

    return newNetObj;

  }
  else {

    seedNetworkObj = null;
    newNetObj.evolve.options.network = null;

    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE | " + getTimeStamp()
      + " | " + configuration.childId
      + " | " + newNetObj.networkId
      + " | BIN MODE: " + newNetObj.evolve.options.binaryMode
      + " | ARCH: " + newNetObj.architecture
      + " | TECH: " + newNetObj.evolve.options.networkTechnology
      + " | INPUTS: " + newNetObj.numInputs
      + " | HIDDEN: " + newNetObj.evolve.options.hiddenLayerSize
      + " | THREADs: " + newNetObj.evolve.options.threads
      + " | ITRS: " + newNetObj.evolve.options.iterations
    ));

    const nnObj = await networkDefaults(newNetObj);
    return nnObj;
  }
}

process.on("message", async function(m) {

  try{

    if (configuration.verbose) { 
      console.log(chalkLog(MODULE_ID_PREFIX + " | <R MESSAGE | " + getTimeStamp() + " | OP: " + m.op)); 
    }

    switch (m.op) {

      case "RESET":
        console.log(chalkInfo(MODULE_ID_PREFIX + " | RESET"
          + " | CHILD ID: " + m.childId
        ));
        fsm.fsm_reset();
      break;

      case "VERBOSE":
        console.log(chalkInfo(MODULE_ID_PREFIX + " | VERBOSE"
          + " | CHILD ID: " + m.childId
          + " | VERBOSE: " + m.verbose
          + "\n" + jsonPrint(m)
        ));
        configuration.verbose = m.verbose;
      break;

      case "INIT":

        MODULE_ID_PREFIX = m.moduleIdPrefix || MODULE_ID_PREFIX;

        console.log(chalkBlueBold(MODULE_ID_PREFIX + " | <R INIT"
          + " | CHILD ID: " + m.childId
          + "\nDEFAULT CONFIGURATION\n" + jsonPrint(configuration)
          + "\nLOADED  CONFIGURATION\n" + jsonPrint(m.configuration)
        ));

        configuration = _.assign(configuration, m.configuration);

        if (m.testMode !== undefined) { configuration.testMode = m.testMode; }
        if (m.verbose !== undefined) { configuration.verbose = m.verbose; }
        if (m.testSetRatio !== undefined) { configuration.testSetRatio = m.testSetRatio; }
        if (m.binaryMode !== undefined) { configuration.binaryMode = m.binaryMode; }
        if (m.equalCategoriesFlag !== undefined) { configuration.equalCategoriesFlag = m.equalCategoriesFlag; }
        if (m.userProfileCharCodesOnlyFlag !== undefined) { configuration.userProfileCharCodesOnlyFlag = m.userProfileCharCodesOnlyFlag; }
        if (m.userArchiveFileExistsMaxWaitTime !== undefined) { 
          configuration.userArchiveFileExistsMaxWaitTime = m.userArchiveFileExistsMaxWaitTime;
        }

        configuration.childId = m.childId;
        configuration.childIdShort = m.childIdShort;

        statsObj.childId = m.childId;
        statsObj.childIdShort = m.childIdShort;

        process.title = m.childId;
        process.name = m.childId;

        console.log(chalkBlueBold(MODULE_ID_PREFIX + " | FINAL INIT CONFIGURATION"
          + "\n" + jsonPrint(configuration)
        ));


        fsm.fsm_init();
      break;

      case "READY":
        console.log(chalkInfo(MODULE_ID_PREFIX + " | READY"
          + " | CHILD ID: " + m.childId
        ));
        fsm.fsm_ready();
      break;

      case "CONFIG_EVOLVE":
        childNetworkObj = null;
        childNetworkObj = await configNetworkEvolve(m);

        statsObj.evolve.options = omit(childNetworkObj.evolve.options, ["network"]);

        statsObj.training.startTime = moment().valueOf();
        statsObj.training.testRunId = m.testRunId;
        statsObj.training.seedNetworkId = m.seedNetworkId;
        statsObj.training.seedNetworkRes = m.seedNetworkRes;
        statsObj.training.iterations = m.iterations;

        statsObj.inputsId = m.inputsId;
        statsObj.outputs = [];
        statsObj.outputs = m.outputs;

        fsm.fsm_config_evolve();
      break;

      case "STATS":
        showStats();
        await processSend({op: "STATS", childId: configuration.childId, fsmStatus: statsObj.fsmStatus});
      break;
      
      case "QUIT":
        quit({cause: "PARENT QUIT"});
      break;

      case "PING":
        if (configuration.verbose) {
          console.log(chalkInfo(MODULE_ID_PREFIX + " | PING"
            + " | CHILD ID: " + m.childId
            + " | PING ID: " + m.pingId
          ));
        }
        await processSend({op: "PONG", pingId: m.pingId, childId: configuration.childId, fsmStatus: statsObj.fsmStatus});
      break;

      default:
        console.log(chalkError(MODULE_ID_PREFIX + " | UNKNOWN OP ERROR | " + m.op ));
    }
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** PROCESS ON MESSAGE ERROR: " + err));
  }
});

async function connectDb(){

  try {

    statsObj.status = "CONNECTING MONGO DB";

    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | CONNECT MONGO DB ..."));

    const db = await global.wordAssoDb.connect(MODULE_ID_PREFIX + "_" + process.pid);

    db.on("error", async function(err){
      statsObj.status = "MONGO ERROR";
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR"));
      db.close();
      quit({cause: "MONGO DB ERROR: " + err});
    });

    db.on("disconnected", async function(){
      statsObj.status = "MONGO DISCONNECTED";
      console.log(chalkAlert(MODULE_ID_PREFIX + " | *** MONGO DB DISCONNECTED"));
      quit({cause: "MONGO DB DISCONNECTED"});
    });

    console.log(chalk.green(MODULE_ID_PREFIX + " | MONGOOSE DEFAULT CONNECTION OPEN"));

    return db;

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECT ERROR: " + err));
    throw err;
  }
}

setTimeout(async function(){

  try {

    const cnf = await initConfig(configuration);
    configuration = deepcopy(cnf);

    statsObj.status = "START";

    if (configuration.testMode) {
      configuration.trainingSetFile = "trainingSet_test.json";
      configuration.defaultUserArchiveFlagFile = "usersZipUploadComplete_test.json";
      console.log(chalkAlert(MODULE_ID_PREFIX + " | TEST MODE"));
      console.log(chalkAlert(MODULE_ID_PREFIX + " | trainingSetFile:            " + configuration.trainingSetFile));
      console.log(chalkAlert(MODULE_ID_PREFIX + " | defaultUserArchiveFlagFile: " + configuration.defaultUserArchiveFlagFile));
    }

    console.log(chalkBlueBold(
        "\n--------------------------------------------------------"
      + "\n" + MODULE_ID_PREFIX + " | " + configuration.processName 
      + "\nCONFIGURATION\n" + jsonPrint(configuration)
      + "--------------------------------------------------------"
    ));

    try {
      await connectDb();
      await initProcessSendQueue();
      initFsmTickInterval(FSM_TICK_INTERVAL);
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR: " + err + " | QUITTING ***"));
      quit({cause: "MONGO DB CONNECT ERROR"});
    }

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | **** INIT CONFIG ERROR *****\n" + jsonPrint(err)));
    if (err.code !== 404) {
      quit({cause: new Error("INIT CONFIG ERROR")});
    }
  }
}, 1000);
