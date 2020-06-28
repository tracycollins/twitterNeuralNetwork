const DEFAULT_DATA_ROOT = process.env.DATA_ROOT_FOLDER || "/Volumes/nas4/data";
const TEST_MODE_LENGTH = 1000;

const ONE_SECOND = 1000;
const ONE_MINUTE = 60*ONE_SECOND;
const ONE_HOUR = 60*ONE_MINUTE;

const DEFAULT_SEND_QUEUE_INTERVAL = 100;
const DEFAULT_LOAD_USERS_FOLDER_ON_START = true;
const DEFAULT_LOAD_USER_FILE_INTERVAL = 10;

// const ONE_KILOBYTE = 1024;
// const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;

const DEFAULT_MAX_NETWORK_JSON_SIZE_MB = 15;

const DEFAULT_BRAIN_HIDDEN_LAYER_SIZE = 9;
const DEFAULT_NEATAPTIC_HIDDEN_LAYER_SIZE = 9;
const DEFAULT_USER_PROFILE_CHAR_CODES_ONLY_INPUTS_ID = "inputs_25250101_000000_255_profilecharcodes";

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

let childNetworkObj; // this is the common, default nn object

const os = require("os");
const fs = require("fs-extra");
const _ = require("lodash");
const omit = require("object.omit");
const path = require("path");
const walker = require("folder-walker");
const empty = require("is-empty");

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

// const DEFAULT_INPUT_TYPES = [
//   "emoji",
//   "friends",
//   "hashtags",  
//   "images", 
//   "locations", 
//   "media", 
//   "ngrams",
//   "places", 
//   "sentiment", 
//   "urls", 
//   "userMentions", 
//   "words"
// ];

let DROPBOX_ROOT_FOLDER;

if (hostname === "google") {
  DROPBOX_ROOT_FOLDER = "/home/tc/Dropbox/Apps/wordAssociation";
}
else {
  DROPBOX_ROOT_FOLDER = "/Users/tc/Dropbox/Apps/wordAssociation";
}

let dbConnection;

global.wordAssoDb = require("@threeceelabs/mongoose-twitter");

let configuration = {};

configuration.defaultLoadUserFileInterval = DEFAULT_LOAD_USER_FILE_INTERVAL;
configuration.loadUsersFolderOnStart = DEFAULT_LOAD_USERS_FOLDER_ON_START;
configuration.testMode = false;
configuration.verbose = false;
configuration.dataSetPrepMaxParallel = 32;
configuration.parallelLoadMax = 16;
configuration.updateDbUser = false; // updates user in db from training set
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
  "cost",
  "crossover",
  "elitism",
  "equal",
  "error",
  "growth",
  "iterations",
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
  "cost",
  "crossover",
  "efficientMutation",
  "elitism",
  "equal",
  "error",
  "fitness",
  "fitnessPopulation",
  "growth",
  "iterations",
  "maxNodes",
  "maxConns",
  "maxGates",
  "mutation",
  "mutationAmount",
  "mutationRate",
  "mutationSelection",
  "network",
  "popsize",
  "populationSize",
  "provenance",
  "schedule",
  "selection",
  "threads"
];

const ThreeceeUtilities = require("@threeceelabs/threecee-utilities");
const tcUtils = new ThreeceeUtilities("NNC_TCU");

// const delay = tcUtils.delay;
const msToTime = tcUtils.msToTime;
const jsonPrint = tcUtils.jsonPrint;
const getTimeStamp = tcUtils.getTimeStamp;
const formatBoolean = tcUtils.formatBoolean;

const NeuralNetworkTools = require("@threeceelabs/neural-network-tools");
const nnTools = new NeuralNetworkTools("NNC_NNT");

const MODULE_ID = MODULE_ID_PREFIX + "_" + hostname;

const PRIMARY_HOST = process.env.PRIMARY_HOST || "google";
const DATABASE_HOST = process.env.DATABASE_HOST || "macpro2";
const HOST = (hostname === PRIMARY_HOST || hostname === DATABASE_HOST) ? "default" : "local";

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
// const chalkNetwork = chalk.blue;
const chalkBlueBold = chalk.blue.bold;
const chalkGreenBold = chalk.green.bold;
const chalkBlue = chalk.blue;
const chalkGreen = chalk.green;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;
const chalkWarn = chalk.red;

//=========================================================================
// HOST
//=========================================================================
const configDefaultFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility/default");
const configHostFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility", hostname);

configuration.archiveFileUploadCompleteFlagFile = "usersZipUploadComplete.json";
configuration.trainingSetFile = "trainingSet.json";
configuration.requiredTrainingSetFile = "requiredTrainingSet.txt";

configuration.local = {};
configuration.local.trainingSetsFolder = path.join(configHostFolder, "trainingSets");
configuration.local.userArchiveFolder = path.join(configHostFolder, "trainingSets/users");

configuration.default = {};
configuration.default.trainingSetsFolder = path.join(configDefaultFolder, "trainingSets");
configuration.default.userArchiveFolder = path.join(configDefaultFolder, "trainingSets/users");

configuration.trainingSetsFolder = configuration[HOST].trainingSetsFolder;
configuration.archiveFileUploadCompleteFlagFolder = path.join(configuration[HOST].trainingSetsFolder, "users");
configuration.userArchiveFolder = configuration[HOST].userArchiveFolder;
configuration.userTempArchiveFolder = configuration[HOST].userTempArchiveFolder;
configuration.userArchivePath = configuration[HOST].userArchivePath;
configuration.userTempArchivePath = configuration[HOST].userTempArchivePath;

configuration.userDataFolder = path.join(DEFAULT_DATA_ROOT, "users");

let preppedTrainingSet = [];
let preppedTestSet = [];
let trainingSetObj = {};
let testSetObj = {};

//=========================================================================
// STATS
//=========================================================================

const startTimeMoment = moment();

const statsObj = {};

statsObj.archiveFlagObj = {};

statsObj.loadUsersFolderBusy = false;
statsObj.trainingSetReady = false;

statsObj.trainingSet = {};
statsObj.trainingSet.total = 0;

let statsObjSmall = {};

statsObj.users = {};
statsObj.users.files = {};
statsObj.users.files.added = 0;
statsObj.users.files.changed = 0;
statsObj.users.files.deleted = 0;
statsObj.users.grandTotal = 0;
statsObj.users.notCategorized = 0;
statsObj.users.notFound = 0;
statsObj.users.screenNameUndefined = 0;
statsObj.users.processed = {};
statsObj.users.processed.total = 0;
statsObj.users.processed.percent = 0;
statsObj.users.processed.empty = 0;
statsObj.users.processed.errors = 0;
statsObj.users.processed.elapsed = 0;
statsObj.users.processed.rate = 0;
statsObj.users.processed.remain = 0;
statsObj.users.processed.remainMS = 0;
statsObj.users.processed.startMoment = 0;
statsObj.users.processed.endMoment = moment();

statsObj.pid = process.pid;
statsObj.runId = MODULE_ID.toLowerCase() + "_" + getTimeStamp();

statsObj.hostname = hostname;
statsObj.startTime = getTimeStamp();
statsObj.elapsedMS = 0;
statsObj.elapsed = getElapsedTimeStamp();

statsObj.usersFolderLoaded = false;

statsObj.status = "START";

statsObj.queues = {};

statsObj.evolve = {};
statsObj.evolve.options = {};
statsObj.evolve.startTime = moment().valueOf();
statsObj.evolve.endTime = moment().valueOf();
statsObj.evolve.elapsed = 0;

statsObj.training = {};
statsObj.training.startTime = moment();
statsObj.training.testRunId = "";
statsObj.training.seedNetworkId = false;
statsObj.training.seedNetworkRes = 0;
statsObj.training.iterations = 0;

statsObj.inputsId = "";
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

const trainingSetUsersSet = {};
trainingSetUsersSet.left = new Set();
trainingSetUsersSet.neutral = new Set();
trainingSetUsersSet.right = new Set();

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

      if (!dbConnection) {
        process.exit();
      }
      else {
        setTimeout(function() {

          dbConnection.close(async function () {
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
}

function updateTrainingSet(p){

  console.log(chalkBlue(MODULE_ID_PREFIX + " | UPDATE TRAINING SET"));

  const params = p || {};

  const equalCategoriesFlag = (params.equalCategoriesFlag !== undefined) ? params.equalCategoriesFlag : configuration.equalCategoriesFlag;

  return new Promise(function(resolve, reject) {

    try {

      trainingSetObj = {};
      trainingSetObj.meta = {};
      trainingSetObj.meta.runId = statsObj.archiveFlagObj.runId;
      trainingSetObj.meta.numInputs = 0;
      trainingSetObj.meta.numOutputs = 3;
      trainingSetObj.meta.setSize = 0;
      trainingSetObj.nodeIdArray = [];

      testSetObj = {};
      testSetObj.meta = {};
      testSetObj.meta.numInputs = 0;
      testSetObj.meta.numOutputs = 3;
      testSetObj.meta.setSize = 0;
      testSetObj.nodeIdArray = [];

      const minCategorySize = Math.min(
        trainingSetUsersSet.left.size, 
        trainingSetUsersSet.neutral.size, 
        trainingSetUsersSet.right.size
      );

      async.eachSeries(["left", "neutral", "right"], function(category, cb){

        const categorySize = (equalCategoriesFlag) ? minCategorySize : trainingSetUsersSet[category].size;

        const trainingSetSize = parseInt((1 - configuration.testSetRatio) * categorySize);
        const testSetSize = parseInt(configuration.testSetRatio * categorySize);

        console.log(chalkLog(MODULE_ID_PREFIX + " | UPDATE TRAINING SET | " + category.toUpperCase()
          + " | trainingSetSize: " + trainingSetSize
          + " | testSetSize: " + testSetSize
        ));

        const shuffledTrainingSetNodeIdArray = _.shuffle([...trainingSetUsersSet[category]]);

        const trainingSetNodeIdArray = shuffledTrainingSetNodeIdArray.slice(0, trainingSetSize);
        const testSetNodeIdArray = shuffledTrainingSetNodeIdArray.slice(trainingSetSize, trainingSetSize+testSetSize);

        trainingSetObj.nodeIdArray = trainingSetObj.nodeIdArray.concat(trainingSetNodeIdArray);
        testSetObj.nodeIdArray = testSetObj.nodeIdArray.concat(testSetNodeIdArray);

        console.log(chalkLog(MODULE_ID_PREFIX + " | TRAINING SET | " + category.toUpperCase()
          + " | EQ CATEGORIES FLAG: " + equalCategoriesFlag
          + " | MIN CAT SIZE: " + minCategorySize
          + " | CAT SIZE: " + categorySize
          + " | TRAIN SIZE: " + trainingSetSize
          + " | TEST SIZE: " + testSetSize
          + " | TRAIN SET DATA SIZE: " + trainingSetObj.nodeIdArray.length
        ));

        cb();

      }, function(err){

        if (err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** UPDATE TRAINING SET ERROR: " + err));
          return reject(err);
        }

        if (trainingSetObj.nodeIdArray.length === 0){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** EMPTY TRAINING SET"
            + " | SIZE: " + trainingSetObj.nodeIdArray.length
          ));
          return reject(err);
        }

        trainingSetObj.nodeIdArray = _.shuffle(trainingSetObj.nodeIdArray);
        testSetObj.nodeIdArray = _.shuffle(testSetObj.nodeIdArray);

        trainingSetObj.meta.setSize = trainingSetObj.nodeIdArray.length;
        testSetObj.meta.setSize = testSetObj.nodeIdArray.length;

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

const defaultUserUpdatePropArray = [
  "ageDays",
  "category",
  "categoryAuto",
  "categorizeNetwork",
  "description",
  "followersCount",
  "following",
  "friends",
  "friendsCount",
  "lang",
  "languageAnalysis",
  "location",
  "name",
  "profileHistograms",
  "rate",
  "mentions",
  "screenName",
  "statusesCount",
  "tweetHistograms",
  "tweetsPerDay"
];

const defaultDbUpdateOptions = {
  new: true,
  upsert: true
};

async function loadUserFile(params){

    const updateDbUser = params.updateDbUser || false;
    const returnOnError = params.returnOnError || false;
    const folder = params.folder || path.dirname(params.path);
    const file = params.file || path.basename(params.path);

    const filePath = params.path || path.join(folder, file);

    try{
      let userObj = await fs.readJson(filePath);

      statsObj.users.folder.total += 1;

      if ((userObj.category === "left") || (userObj.category === "right") || (userObj.category === "neutral")) {

        userObj.categorized = true;

        if (updateDbUser){

          const update = pick(userObj, defaultUserUpdatePropArray);

          const userDoc = await global.wordAssoDb.User.findOneAndUpdate(
            {nodeId: userObj.nodeId}, 
            update, 
            defaultDbUpdateOptions
          ).exec();

          if (userDoc) {
            userObj = userDoc.toObject();
          }
        }

        if (empty(userObj.tweetHistograms) || !userObj.tweetHistograms || userObj.tweetHistograms === undefined){
          userObj.tweetHistograms = {};
        }
        
        if (empty(userObj.profileHistograms) || !userObj.profileHistograms || userObj.profileHistograms === undefined){
          userObj.profileHistograms = {};
        }
        
        trainingSetUsersSet[userObj.category].add(userObj.nodeId);

        if (((configuration.testMode || configuration.verbose) 
          && (statsObj.users.folder.total % 100 === 0)) || (statsObj.users.folder.total % 1000 === 0)
        ) {

          console.log(chalkLog(MODULE_ID_PREFIX
            + " [" + statsObj.users.folder.total + "]"
            + " USERS - L: " + trainingSetUsersSet.left.size
            + " N: " + trainingSetUsersSet.neutral.size
            + " R: " + trainingSetUsersSet.right.size
            + " | " + userObj.userId
            + " | @" + userObj.screenName
            + " | " + userObj.name
            + " | FLWRs: " + userObj.followersCount
            + " | FRNDs: " + userObj.friendsCount
            + " | FRNDs DB: " + userObj.friends.length
            + " | CAT M: " + userObj.category + " A: " + userObj.categoryAuto
          ));
        }

        if (configuration.testMode && statsObj.users.folder.total >= TEST_MODE_LENGTH){
          return;
        }
      }
      else{
        console.log(chalkAlert(MODULE_ID_PREFIX + " | ??? UNCAT UNZIPPED USER"
          + " [" + statsObj.users.folder.total + "]"
          + " USERS - L: " + trainingSetUsersSet.left.size
          + " N: " + trainingSetUsersSet.neutral.size
          + " R: " + trainingSetUsersSet.right.size
          + " | " + userObj.userId
          + " | @" + userObj.screenName
          + " | " + userObj.name
          + " | FLWRs: " + userObj.followersCount
          + " | FRNDs: " + userObj.friendsCount
          + " | CAT M: " + userObj.category + " A: " + userObj.categoryAuto
        ));                      
      }
      return;
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** loadUserFile USER"
        + " | PATH: " + filePath
        + " | ERROR: " + err
      ));

      if (returnOnError) {
        return;
      }

      throw err;               
    }
}

function loadUsersFolder(params){

  return new Promise(function(resolve, reject){

    const updateDbUser = params.updateDbUser || true;
    const interval = params.interval || configuration.defaultLoadUserFileInterval;
    const verbose = params.verbose || configuration.verbose;
    const folder = params.folder || configuration.userDataFolder;
    let folderStreamEnd = false;
    const userFileArray = [];
    const parallelLoadMax = params.parallelLoadMax || configuration.parallelLoadMax;

    console.log(chalkLog(MODULE_ID_PREFIX 
      + " | LOADING USERS FOLDER"
      + " | " + getTimeStamp() 
      + " | parallelLoadMax: " + parallelLoadMax
      + " | updateDbUser: " + formatBoolean(updateDbUser)
      + " | interval: " + interval + " ms"
      + " | FOLDER: " + folder
    ));

    if (statsObj.users.folder === undefined) { 
      statsObj.users.folder = {};
      statsObj.users.folder.total = 0;
      statsObj.users.folder.hits = 0;
      statsObj.users.folder.misses = 0;
    }

    if (params.resetFlag){
      trainingSetUsersSet.left.clear();
      trainingSetUsersSet.neutral.clear();
      trainingSetUsersSet.right.clear();

      statsObj.users.folder.hits = 0;
      statsObj.users.folder.misses = 0;
      statsObj.users.folder.total = 0;
    }

    let ready = true;
    const loadUserFilePromiseArray = [];

    const loadUserFileInterval = setInterval(async function(){

      if (folderStreamEnd && ready && userFileArray.length === 0) {

        console.log(chalkBlue(MODULE_ID_PREFIX 
          + " | +++ LOADING USERS FOLDER COMPLETE"
          + " | " + getTimeStamp() 
          + " | parallelLoadMax: " + parallelLoadMax
          + " | updateDbUser: " + formatBoolean(updateDbUser)
          + " | FOLDER: " + folder
        ));

        clearInterval(loadUserFileInterval);

        resolve(statsObj.users.folder.total);
      }
      else if (ready && userFileArray.length > parallelLoadMax){

        ready = false;
        loadUserFilePromiseArray.length = 0;

        while ((userFileArray.length > 0) && (loadUserFilePromiseArray.length < parallelLoadMax)){

          const fileObj = userFileArray.shift();

          if (fileObj){
            loadUserFilePromiseArray.push(loadUserFile({
              folder: fileObj.root, 
              file: fileObj.relname,
              updateDbUser: updateDbUser,
              returnOnError: true, // don't throw error; just return on errors
              verbose: verbose
            }));
          }

        }

        try{
          if (loadUserFilePromiseArray.length > 0) { 
            await Promise.all(loadUserFilePromiseArray);
          }
          ready = true;
        }
        catch(err){
          console.log(chalkLog(MODULE_ID_PREFIX 
            + " | *** LOAD USER FILE ERROR"
            + " | ERR: " + err
          ));
          ready = true;
        }
      }
      else if (ready && userFileArray.length > 0){

        const fileObj = userFileArray.shift();

        try{
          await loadUserFile({
            folder: fileObj.root, 
            file: fileObj.relname,
            updateDbUser: updateDbUser,
            returnOnError: true, // don't throw error; just return on errors
            verbose: verbose
          });
          ready = true;
        }
        catch(err){
          console.log(chalkLog(MODULE_ID_PREFIX 
            + " | *** LOAD USER FILE ERROR"
            + " | ERR: " + err
            + " | fileObj\n: " + jsonPrint(fileObj)
          ));
          ready = true;
        }
      }
    }, interval);

    let loadFileEnable = true;
    const folderStream = walker([folder]);

    folderStream.on("error", function (err) {
      if (err.code === "ENOENT"){
        console.log(chalkAlert(MODULE_ID_PREFIX
          + " | ... LOAD USERS FOLDER | FILE NOT FOUND | SKIPPING | " + err.path
        ));
      }
      else{
        console.log(chalkError(MODULE_ID_PREFIX
          + " | *** LOAD USERS FOLDER ERROR: " + err
          + " | FOLDER: " + folder
        ));
        clearInterval(loadUserFileInterval);
        return reject(err);
      }
    });

    folderStream.on("end", function () {

      debug(chalkBlue(MODULE_ID_PREFIX
        + " [" + statsObj.users.folder.total + "]"
        + " | LOAD USERS FOLDERS COMPLETE"
        + " | L: " + trainingSetUsersSet.left.size
        + " N: " + trainingSetUsersSet.neutral.size
        + " R: " + trainingSetUsersSet.right.size
      ));

      folderStreamEnd = true;
    });

    folderStream.on("data", async function (fileObj) {

      loadFileEnable = (configuration.testMode) ? (Math.random() > 0.5) : true;

      if (fileObj.basename.endsWith(".json") && loadFileEnable){
        userFileArray.push(fileObj);
      }
    });

  });
}

async function initLoadUsersFolder(params){
  await loadUsersFolder(params);
  return;
}

async function cursorDataHandler(user){

  if (!user.screenName){
    console.log(chalkWarn(MODULE_ID_PREFIX + " | !!! USER SCREENNAME UNDEFINED\n" + jsonPrint(user)));
    statsObj.users.processed.errors += 1;
    return;
  }
  
  if (empty(user.friends) && empty(user.profileHistograms) && empty(user.tweetHistograms)){

    statsObj.users.processed.empty += 1;

    if (statsObj.users.processed.empty % 100 === 0){
      console.log(chalkWarn(MODULE_ID_PREFIX 
        + " | --- EMPTY HISTOGRAMS"
        + " | SKIPPING"
        + " | PRCSD/REM/MT/ERR/TOT: " 
        + statsObj.users.processed.total 
        + "/" + statsObj.users.processed.remain 
        + "/" + statsObj.users.processed.empty 
        + "/" + statsObj.users.processed.errors
        + "/" + statsObj.users.grandTotal
        + " | @" + user.screenName 
      )); 
    }
    return;
  }

  if (!user.profileHistograms || user.profileHistograms === undefined || empty(user.profileHistograms)){
    user.profileHistograms = {};
  }

  if (!user.tweetHistograms || user.tweetHistograms === undefined || empty(user.tweetHistograms)){
    user.tweetHistograms = {};
  }

  if (!user.friends || user.friends == undefined) {
    user.friends = [];
  }
  else{
    user.friends = _.slice(user.friends, 0,5000);
  }

  trainingSetUsersSet[user.category].add(user.nodeId);

  categorizedUsers[user.category] += 1;
  statsObj.categorizedCount += 1;


  if (statsObj.categorizedCount > 0 && statsObj.categorizedCount % 1000 === 0){
    console.log(chalkInfo(MODULE_ID_PREFIX
      + " | cursorDataHandler"
      + " | CATEGORIZED: " + statsObj.categorizedCount
      + " | L: " + categorizedUsers.left
      + " | N: " + categorizedUsers.neutral
      + " | R: " + categorizedUsers.right
    ));
  }

  return;
}

function cursorDataHandlerPromise(user){

  return new Promise(function(resolve, reject){

    cursorDataHandler(user)
    .then(function(){

      statsObj.users.processed.total += 1;
      statsObj.users.processed.elapsed = (moment().valueOf() - statsObj.users.processed.startMoment.valueOf()); // mseconds
      statsObj.users.processed.rate = (statsObj.users.processed.total >0) ? statsObj.users.processed.elapsed/statsObj.users.processed.total : 0; // msecs/usersArchived
      statsObj.users.processed.remain = statsObj.users.grandTotal - (statsObj.users.processed.total + statsObj.users.processed.errors);
      statsObj.users.processed.remainMS = statsObj.users.processed.remain * statsObj.users.processed.rate; // mseconds
      statsObj.users.processed.endMoment = moment();
      statsObj.users.processed.endMoment.add(statsObj.users.processed.remainMS, "ms");
      statsObj.users.processed.percent = 100 * (statsObj.users.notCategorized + statsObj.users.processed.total)/statsObj.users.grandTotal;

      resolve();
    })
    .catch(function(err){
      reject(err);
    });

  });
}

const categorizedUsers = {};

async function loadTrainingSetUsersFromDb(p) {

  const params = p || {};

  statsObj.status = "LOAD TRAINING SET FROM DB";
  statsObj.trainingSetReady = false;

  statsObj.categorizedCount = 0;

  categorizedUsers.left = 0;
  categorizedUsers.neutral = 0;
  categorizedUsers.right = 0;

  const query = params.query || {category: { "$in": ["left", "right", "neutral"]}};
  const batchSize = params.batchSize || 1000;
  const cursorParallel = params.cursorParallel || 8;
  const limit = params.limit || 1000;

  let cursor;

  const session = await dbConnection.startSession();

  debug("MONGO DB SESSION\n" + session.id);

  console.log(chalkBlue(MODULE_ID_PREFIX
    + " | LOADING TRAINING SET FROM DB ..."
    + " | batchSize: " + batchSize
    + " | cursorParallel: " + cursorParallel
  ));

  if (configuration.testMode) {
    cursor = global.wordAssoDb.User
    .find(query, {timeout: false})
    // .find(query)
    .lean()
    .batchSize(batchSize)
    .limit(limit)
    .session(session)
    .cursor()
    .addCursorFlag("noCursorTimeout", true);
  }
  else{
    cursor = global.wordAssoDb.User
    .find(query, {timeout: false})
    // .find(query)
    .lean()
    .batchSize(batchSize)
    .session(session)
    .cursor()
    .addCursorFlag("noCursorTimeout", true);
  }

  cursor.on("end", function() {
    console.log(chalkAlert(MODULE_ID_PREFIX + " | --- loadTrainingSetUsersFromDb CURSOR END"));
  });

  cursor.on("error", function(err) {
    console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR loadTrainingSetUsersFromDb: CURSOR ERROR: " + err));
    throw err;
  });

  cursor.on("close", function() {
    console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX loadTrainingSetUsersFromDb CURSOR CLOSE"));
  });

  await cursor.eachAsync(async function(user){
    await cursorDataHandlerPromise(user);
    return;

  }, {parallel: cursorParallel});

  statsObj.trainingSet.total = trainingSetUsersSet.left.size + trainingSetUsersSet.neutral.size + trainingSetUsersSet.right.size;

  console.log(chalkBlueBold(MODULE_ID_PREFIX
    + " | +++ LOAD TRAINING SET FROM DB COMPLETE"
    + " | SET SIZE: L: " + statsObj.trainingSet.tota
    + " / L: " + trainingSetUsersSet.left.size
    + " / N: " + trainingSetUsersSet.neutral.size
    + " / R: " + trainingSetUsersSet.right.size
  ));

  return; 
}

async function loadTrainingSet(p){

  try{

    const params = p || {};
    const verbose = (params.verbose !== undefined) ? params.verbose : configuration.verbose;

    console.log(chalkLog(MODULE_ID_PREFIX
      + " | loadTrainingSet | LOAD TRAINING SET + NORMALIZATION"
      + " | VERBOSE: " + verbose
    ));

    statsObj.status = "LOAD TRAINING SET";
    statsObj.trainingSetReady = false;

    console.log(chalkLog(MODULE_ID_PREFIX
      + " | loadTrainingSet | LOAD NORMALIZATION"
      + " | " + configuration.trainingSetsFolder + "/normalization.json"
    ));

    const filePath = path.join(configuration.trainingSetsFolder, "normalization.json");

    const normalization = await fs.readJson(filePath);

    if (normalization) { 

      console.log(chalk.black.bold(MODULE_ID_PREFIX
        + " | loadTrainingSet | SET NORMALIZATION ..."
      ));

      await nnTools.setNormalization(normalization);
    }
    else{
      console.log(chalkAlert(MODULE_ID_PREFIX
        + " | loadTrainingSet | !!! NORMALIZATION NOT LOADED"
        + " | " + configuration.trainingSetsFolder + "/normalization.json"
      ));
    }

    if (hostname === DATABASE_HOST){
      console.log(chalk.black.bold(MODULE_ID_PREFIX
        + " | loadTrainingSet | !!! SKIP LOAD USERS FOLDER | DATABASE_HOST: " + DATABASE_HOST
      ));
    }
    else if (hostname !== DATABASE_HOST
      && configuration.loadUsersFolderOnStart 
      && !statsObj.usersFolderLoaded 
      && !statsObj.loadUsersFolderBusy
    ){

      console.log(chalk.black.bold(MODULE_ID_PREFIX
        + " | loadTrainingSet | LOAD USERS FOLDER: " + configuration.userDataFolder
      ));
      
      statsObj.loadUsersFolderBusy = true;
      await initLoadUsersFolder({folder: configuration.userDataFolder});
      statsObj.usersFolderLoaded = true;
      statsObj.loadUsersFolderBusy = false;
    }

    console.log(chalk.black.bold(MODULE_ID_PREFIX
      + " | loadTrainingSet | LOAD TRAINING SET USERS FROM DB"
    ));

    await loadTrainingSetUsersFromDb();

    console.log(chalk.black.bold(MODULE_ID_PREFIX
      + " | loadTrainingSet | UPDATE TRAINING SET"
    ));

    await updateTrainingSet();

    statsObj.loadUsersFolderBusy = false;
    statsObj.trainingSetReady = true;
    console.log(chalkGreenBold(MODULE_ID_PREFIX + " | TRAINING SET LOADED"));

    return;
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** USERS TRAINING SET LOAD ERROR: " + err));
    statsObj.loadUsersFolderBusy = false;
    statsObj.trainingSetReady = false;
    throw err;
  }
}

async function testNetworkData(params){

  const testSet = params.testSet;

  const convertDatumFlag = (params.convertDatumFlag !== undefined) ? params.convertDatumFlag : false;
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

  const userProfileOnlyFlag = (params.userProfileOnlyFlag !== undefined) 
    ? params.userProfileOnlyFlag 
    : configuration.userProfileOnlyFlag;

  await nnTools.loadNetwork({networkObj: childNetworkObj});
  await nnTools.setPrimaryNeuralNetwork(childNetworkObj.networkId);
  await nnTools.setBinaryMode(childNetworkObj.binaryMode);

  console.log(chalkBlue(MODULE_ID_PREFIX + " | TEST NETWORK"
    + " | NETWORK ID: " + childNetworkObj.networkId
    + " | USER PROFILE ONLY: " + userProfileOnlyFlag
    + " | " + preppedTestSet.length + " TEST DATA LENGTH"
    + " | VERBOSE: " + params.verbose
  ));


  childNetworkObj.test = {};
  childNetworkObj.test.results = {};

  childNetworkObj.test.results = await testNetworkData({
    networkId: childNetworkObj.networkId, 
    testSet: preppedTestSet, 
    convertDatumFlag: false,
    userProfileOnlyFlag: userProfileOnlyFlag,
    binaryMode: childNetworkObj.binaryMode,
    verbose: params.verbose
  });

  childNetworkObj.successRate = childNetworkObj.test.results.successRate;

  return;
}

let processSendQueueInterval;
const processSendQueue = [];
let processSendQueueReady = true;

function initProcessSendQueue(params){

  const interval = (params) ? params.interval : DEFAULT_SEND_QUEUE_INTERVAL;

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
          binaryMode: childNetworkObj.binaryMode,
          error: schedParams.error.toFixed(5) || Infinity,
          evolveElapsed: elapsedInt,
          evolveStart: schedStartTime,
          fitness: 0,
          inputsId: childNetworkObj.inputsId,
          iteration: schedParams.iterations+1,
          iterationRate: iterationRate,
          networkId: childNetworkObj.networkId,
          networkTechnology: "BRAIN",
          numInputs: childNetworkObj.numInputs,
          timeToComplete: timeToComplete,
          totalIterations: options.iterations
        };

        console.log(chalkLog(MODULE_ID_PREFIX 
          + " | " + sObj.networkId 
          + " | " + sObj.networkTechnology.slice(0,1).toUpperCase()
          + " | " + sObj.networkId
          + " | " + sObj.inputsId
          + " | ERR " + sObj.error
          + " | R " + msToTime(sObj.evolveElapsed)
          + " | ETC " + msToTime(sObj.timeToComplete) + " " + moment().add(sObj.timeToComplete).format(compactDateTimeFormat)
          + " | " + (sObj.iterationRate/1000.0).toFixed(1) + " spi"
          + " | I " + sObj.iteration + "/" + sObj.totalIterations
        ));

        processSendQueue.push({
          op: "EVOLVE_SCHEDULE", 
          childId: configuration.childId, 
          childIdShort: configuration.childIdShort, 
          stats: sObj
        });
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

          processSendQueue.push({
            op: "EVOLVE_SCHEDULE", 
            childId: configuration.childId, 
            childIdShort: configuration.childIdShort, 
            stats: sObj
          });

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

function dataSetPrep(params){

  return new Promise(function(resolve, reject){

    const maxParallel = params.maxParallel || configuration.dataSetPrepMaxParallel;

    const nodeIdArray = params.setObj.nodeIdArray; // array

    const userProfileCharCodesOnlyFlag = (params.userProfileCharCodesOnlyFlag !== undefined) 
      ? params.userProfileCharCodesOnlyFlag 
      : false;

    const binaryMode = (params.binaryMode !== undefined) 
      ? params.binaryMode 
      : configuration.binaryMode;

    const userProfileOnlyFlag = (params.userProfileOnlyFlag !== undefined) 
      ? params.userProfileOnlyFlag 
      : configuration.userProfileOnlyFlag;

    const dataSet = [];

    let dataConverted = 0;

    const numCharInputs = configuration.userCharCountScreenName 
      + configuration.userCharCountName 
      + configuration.userCharCountDescription 
      + configuration.userCharCountLocation;

    if (userProfileCharCodesOnlyFlag){
      childNetworkObj.numInputs = numCharInputs;
    }

    console.log(chalkBlue(MODULE_ID_PREFIX
      + " | DATA SET preppedOptions"
      + " | DATA LENGTH: " + nodeIdArray.length
      + " | USER PROFILE ONLY: " + formatBoolean(userProfileOnlyFlag)
      + " | BIN MODE: " + formatBoolean(binaryMode)
      + " | INPUTS ID: " + params.inputsId
    ));

    async.eachLimit(nodeIdArray, maxParallel, async function(nodeId){

      const user = await global.wordAssoDb.User.findOne({nodeId: nodeId}).lean().exec();

      if (!user) {
        console.log(chalkAlert(MODULE_ID_PREFIX + " | dataSetPrep | !!! USER NOT IN DB ... SKIPPING | NID: " + nodeId));
        return;
      }

      if (!userProfileCharCodesOnlyFlag
        && (!user.profileHistograms || user.profileHistograms === undefined || user.profileHistograms === {}) 
        && (!user.tweetHistograms || user.tweetHistograms === undefined || user.tweetHistograms === {}))
      {
        console.log(chalkAlert(MODULE_ID_PREFIX + " | dataSetPrep | !!! EMPTY USER HISTOGRAMS ... SKIPPING | @" + user.screenName));
        return;
      }

      if (!user.profileHistograms || user.profileHistograms === undefined || user.profileHistograms === {}){
        console.log(chalkAlert(MODULE_ID_PREFIX + " | dataSetPrep | !!! EMPTY USER PROFILE HISTOGRAM | @" + user.screenName));
        user.profileHistograms = {};
      }

      if (!user.tweetHistograms || user.tweetHistograms === undefined || user.tweetHistograms === {}){
        console.log(chalkAlert(MODULE_ID_PREFIX + " | dataSetPrep | !!! EMPTY USER TWEETS HISTOGRAM | @" + user.screenName));
        user.tweetHistograms = {};
      }

      const results = await tcUtils.convertDatumOneNetwork({
        primaryInputsFlag: true, 
        user: user,
        inputsId: params.inputsId,
        userProfileCharCodesOnlyFlag: userProfileCharCodesOnlyFlag,
        userProfileOnlyFlag: userProfileOnlyFlag,
        binaryMode: binaryMode, 
        verbose: params.verbose
      });

      if (results.emptyFlag) {
        debug(chalkAlert(MODULE_ID_PREFIX + " | !!! EMPTY CONVERTED DATUM ... SKIPPING | @" + user.screenName));
        return;
      }

      dataConverted += 1;

      if (results.datum.input.length !== childNetworkObj.numInputs) { 
        console.log(chalkError(MODULE_ID_PREFIX
          + " | *** ERROR DATA SET PREP ERROR" 
          + " | INPUT NUMBER MISMATCH" 
          + " | INPUTS NUM IN: " + childNetworkObj.numInputs
          + " | DATUM NUM IN: " + results.datum.input.length
        ));
        return new Error("INPUT NUMBER MISMATCH");
      }

      if (results.datum.output.length !== 3) { 
        console.log(chalkError(MODULE_ID_PREFIX
          + " | *** ERROR DATA SET PREP ERROR" 
          + " | OUTPUT NUMBER MISMATCH" 
          + " | OUTPUTS NUM IN: " + childNetworkObj.numOutputs
          + " | DATUM NUM IN: " + results.datum.output.length
        ));
        return new Error("OUTPUT NUMBER MISMATCH");
      }

      for(const inputValue of results.datum.input){
        if (typeof inputValue !== "number") {
          return new Error("INPUT VALUE NOT TYPE NUMBER | @" + results.user.screenName + " | INPUT TYPE: " + typeof inputValue);
        }
        if (inputValue < 0) {
          return new Error("INPUT VALUE LESS THAN ZERO | @" + results.user.screenName + " | INPUT: " + inputValue);
        }
        if (inputValue > 1) {
          return new Error("INPUT VALUE GREATER THAN ONE | @" + results.user.screenName + " | INPUT: " + inputValue);
        }
      }

      for(const outputValue of results.datum.output){
        if (typeof outputValue !== "number") {
          return new Error("OUTPUT VALUE NOT TYPE NUMBER | @" + results.user.screenName + " | OUTPUT TYPE: " + typeof outputValue);
        }
        if (outputValue < 0) {
          return new Error("OUTPUT VALUE LESS THAN ZERO | @" + results.user.screenName + " | OUTPUT: " + outputValue);
        }
        if (outputValue > 1) {
          return new Error("OUTPUT VALUE GREATER THAN ONE | @" + results.user.screenName + " | OUTPUT: " + outputValue);
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
        console.log(chalkLog(MODULE_ID_PREFIX + " | DATA CONVERTED: " + dataConverted + "/" + nodeIdArray.length));
      }

      return;

    }, function(err){

      if (err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** dataSetPrep ERROR: " + err));
        return reject(err);
      }

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
        // try {
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
        // }
        // catch(err){
        //   console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR CREATE NETWORK | " + childNetworkObj.networkTechnology + " fromJSON: " + err));
        //   return reject(err);
        // }
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

const setPrepRequired = function(preppedSetsConfig){
  if (empty(statsObj.preppedSetsConfig)) { 
    console.log(chalkAlert(MODULE_ID_PREFIX + " | setPrepRequired | EMPTY PREPPED SETS CONFIG"));
    return true;
  }

  for (const prop of preppedSetsConfigPickArray){
    if (statsObj.preppedSetsConfig[prop] === undefined) { 
      console.log(chalkAlert(MODULE_ID_PREFIX + " | setPrepRequired | UNDEFINED PROP: " + prop));
      return true;
    }
    if (statsObj.preppedSetsConfig[prop] !== preppedSetsConfig[prop]) { 
      console.log(chalkAlert(MODULE_ID_PREFIX + " | setPrepRequired | CHANGED PROP"
        + " | " + prop
        + " | PREV: " + statsObj.preppedSetsConfig[prop]
        + " | CURR: " + preppedSetsConfig[prop]
      ));
      return true;
    }
  }

  return false;
}

const preppedSetsConfigPickArray = [
  "binaryMode", 
  "inputsId", 
  "userProfileCharCodesOnlyFlag",
  "userProfileOnlyFlag"
];

async function evolve(params){

  try {

    console.log(chalkLog(MODULE_ID_PREFIX + " | PREPARE NETWORK EVOLVE"
      + " | TECH: " + childNetworkObj.networkTechnology
      + " | NN: " + childNetworkObj.networkId
      + " | SEED: " + childNetworkObj.seedNetworkId
      + " | IN: " + childNetworkObj.inputsId
    ));

    if (childNetworkObj.meta === undefined) { childNetworkObj.meta = {}; }

    let inputsObj = await global.wordAssoDb.NetworkInputs.findOne({inputsId: childNetworkObj.inputsId}).lean().exec();

    if (!inputsObj) {

      const file = childNetworkObj.inputsId + ".json";

      console.log(chalkAlert(MODULE_ID_PREFIX
        + " | !!! INPUTS OBJ NOT IN DB: " + childNetworkObj.inputsId
      ));

      const filePath = path.join(configDefaultFolder, file);

      inputsObj = await fs.readJson(filePath);

      if (!inputsObj) {
        throw new Error("evolve INPUTS OBJ NOT FOUND: " + childNetworkObj.inputsId);
      }
    }
    
    childNetworkObj.numInputs = inputsObj.meta.numInputs;
    trainingSetObj.meta.numInputs = inputsObj.meta.numInputs;

    childNetworkObj.meta.userProfileOnlyFlag = (inputsObj.meta.userProfileOnlyFlag !== undefined) ? inputsObj.meta.userProfileOnlyFlag : false;

    if (childNetworkObj.inputsId !== configuration.userProfileCharCodesOnlyInputsId){

      console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX userProfileCharCodesOnlyFlag"
        + " | ARCH: " + childNetworkObj.architecture
        + " | TECH: " + childNetworkObj.networkTechnology
        + " | NN: " + childNetworkObj.networkId
        + " | IN: " + childNetworkObj.inputsId
      ));

      childNetworkObj.meta.userProfileCharCodesOnlyFlag = false;
    }

    await tcUtils.loadInputs({inputsObj: inputsObj});
    await tcUtils.setPrimaryInputs({inputsId: inputsObj.inputsId});

    const preppedSetsConfig = {
      binaryMode: childNetworkObj.binaryMode,
      inputsId: childNetworkObj.inputsId,
      userProfileCharCodesOnlyFlag: childNetworkObj.meta.userProfileCharCodesOnlyFlag,
      userProfileOnlyFlag: childNetworkObj.meta.userProfileOnlyFlag,
      verbose: params.verbose
    };

    if (setPrepRequired(preppedSetsConfig)) {

      console.log(chalkLog(MODULE_ID_PREFIX
        + "\npreppedSetsConfig\n" + jsonPrint(preppedSetsConfig)
        + "\nstatsObj.preppedSetsConfig\n" + jsonPrint(statsObj.preppedSetsConfig)
      ));

      statsObj.preppedSetsConfig = {};
      statsObj.preppedSetsConfig = pick(preppedSetsConfig, preppedSetsConfigPickArray);

      preppedSetsConfig.setObj = trainingSetObj;
      preppedTrainingSet = await dataSetPrep(preppedSetsConfig);

      preppedSetsConfig.setObj = testSetObj;
      preppedTestSet = await dataSetPrep(preppedSetsConfig);

    }

    const childNetworkRaw = await createNetwork();

    const preppedOptions = await prepNetworkEvolve();

    let evolveResults;

    if (childNetworkObj.networkTechnology === "brain"){

      childNetworkObj.inputsId = inputsObj.inputsId;
      childNetworkObj.numInputs = inputsObj.meta.numInputs;

      console.log(chalkBlueBold(MODULE_ID_PREFIX + " | ==============================================="));
      console.log(chalkBlueBold(MODULE_ID_PREFIX + " | >>> START NETWORK EVOLVE"
        + " | ARCH: " + childNetworkObj.architecture
        + " | TECH: " + childNetworkObj.networkTechnology
        + " | NN: " + childNetworkObj.networkId
        + " | IN: " + childNetworkObj.inputsId
      ));
      console.log(chalkBlueBold(MODULE_ID_PREFIX + " | ==============================================="));

      evolveResults = await nnTools.streamTrainNetwork({
        networkId: childNetworkObj.networkId,
        options: preppedOptions,
        network: childNetworkRaw, 
        trainingSet: preppedTrainingSet
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

      if (childNetworkObj.networkTechnology === "carrot"){
        preppedOptions.population_size = preppedOptions.populationSize;
        preppedOptions.mutation_rate = preppedOptions.mutationRate;
        preppedOptions.mutation_amount = preppedOptions.mutationAmount;
        preppedOptions.fitness_population = preppedOptions.fitnessPopulation;
        preppedOptions.max_nodes = preppedOptions.maxNodes;
      }

      console.log(chalkBlueBold(MODULE_ID_PREFIX + " | ==============================================="));
      console.log(chalkBlueBold(MODULE_ID_PREFIX + " | >>> START NETWORK EVOLVE"
        + " | ARCH: " + childNetworkObj.architecture
        + " | TECH: " + childNetworkObj.networkTechnology
        + " | NN: " + childNetworkObj.networkId
        + " | IN: " + childNetworkObj.inputsId
      ));
      console.log(chalkBlueBold(MODULE_ID_PREFIX + " | ==============================================="));
      
      evolveResults = await childNetworkRaw.evolve(preppedTrainingSet, preppedOptions);

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

        await evolve({verbose: p.verbose});

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

          const cnf = await initConfig(configuration);
          configuration = deepcopy(cnf);

          dbConnection = await connectDb();

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

          await processSend({op: "STATS", childId: configuration.childId, fsmStatus: statsObj.fsmStatus});
          // await initWatchUserDataFolders();
          await initProcessSendQueue();

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

          await processSend({
            op: "STATS", 
            childId: configuration.childId, 
            fsmStatus: statsObj.fsmStatus
          });

          if (!statsObj.trainingSetReady) { 
            await loadTrainingSet();
          }

          if (configuration.testMode) {
            trainingSetObj.nodeIdArray = _.shuffle(trainingSetObj.nodeIdArray);
            trainingSetObj.nodeIdArray.length = Math.min(trainingSetObj.nodeIdArray.length, TEST_MODE_LENGTH);
            testSetObj.nodeIdArray.length = parseInt(configuration.testSetRatio * trainingSetObj.nodeIdArray.length);
            trainingSetObj.meta.setSize = trainingSetObj.nodeIdArray.length;
            testSetObj.meta.setSize = testSetObj.nodeIdArray.length;
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
          await networkEvolve({verbose: configuration.verbose});
          await testNetwork({
            inputsId: childNetworkObj.inputsId,
            binaryMode: childNetworkObj.binaryMode, 
            userProfileOnlyFlag: childNetworkObj.meta.userProfileOnlyFlag, 
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

async function initFsmTickInterval(interval) {

  console.log(chalkLog(MODULE_ID_PREFIX + " | INIT FSM TICK INTERVAL | " + msToTime(interval)));

  clearInterval(fsmTickInterval);

  fsmTickInterval = setInterval(function() {
    fsm.fsm_tick();
  }, FSM_TICK_INTERVAL);

  return;
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
    if(empty(nnObj.runtimeMatchRate)) { nnObj.runtimeMatchRate = 0; }
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

  try{
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

    newNetObj.binaryMode = params.binaryMode;
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
        "efficientMutation", 
        "elitism", 
        "equal", 
        "error",
        "errorThresh",
        "fitnessPopulation", 
        "growth",
        "hiddenLayerSize",
        "inputsId",
        "iterations",
        "learningRate",
        "momentum",
        "mutation", 
        "mutationAmount", 
        "mutationRate",
        "networkTechnology",
        "outputs",
        "popsize", 
        "populationSize", 
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

      let seedNetworkObj = await global.wordAssoDb.NeuralNetwork.findOne({networkId: newNetObj.seedNetworkId}).exec();

      if(!seedNetworkObj || seedNetworkObj === undefined) {

        console.log(chalkAlert(MODULE_ID_PREFIX + " | !!! SEED NETWORK NOT FOUND IN DB ... CHECK FOR FILE"
          + " | SEED: " + newNetObj.seedNetworkId
        ));

        const file = newNetObj.seedNetworkId + ".json";
        const filePath = path.join("/Users/tc/Dropbox/Apps/wordAssociation/config/utility/best/neuralNetworks", file);

        seedNetworkObj = await fs.readJson(filePath);
      }
      
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
        + " | BIN MODE: " + newNetObj.binaryMode
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

      newNetObj.evolve.options.network = null;

      console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE | " + getTimeStamp()
        + " | " + configuration.childId
        + " | " + newNetObj.networkId
        + " | BIN MODE: " + newNetObj.binaryMode
        + " | ARCH: " + newNetObj.architecture
        + " | TECH: " + newNetObj.networkTechnology
        + " | INPUTS: " + newNetObj.numInputs
        + " | HIDDEN: " + newNetObj.evolve.options.hiddenLayerSize
        + " | THREADs: " + newNetObj.evolve.options.threads
        + " | ITRS: " + newNetObj.evolve.options.iterations
      ));

      const nnObj = await networkDefaults(newNetObj);
      return nnObj;
    }
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** configNetworkEvolve ERROR: " + err)); 
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

        
        if (m.loadUsersFolderOnStart !== undefined) { configuration.loadUsersFolderOnStart = m.loadUsersFolderOnStart; }
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

        console.log(chalkInfo(MODULE_ID_PREFIX + " | CONFIG_EVOLVE"
          + " | CHILD ID: " + m.childId
          + "\n" + jsonPrint(m)
        ));

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

    const db = await global.wordAssoDb.connect(MODULE_ID + "_" + process.pid);

    db.on("error", async function(err){
      statsObj.status = "MONGO ERROR";
      statsObj.dbConnectionReady = false;
      console.log(chalkError(MODULE_ID_PREFIX 
        + " | " + getTimeStamp()
        + " | *** MONGO DB CONNECTION ERROR: " + err));
    });

    db.on("close", async function(){
      statsObj.status = "MONGO CLOSED";
      statsObj.dbConnectionReady = false;
      console.log(chalkAlert(MODULE_ID_PREFIX 
        + " | " + getTimeStamp()
        + " | XXX MONGO DB CONNECTION CLOSED"));
    });

    db.on("connecting", async function(){
      statsObj.status = "MONGO CONNECTED";
      statsObj.dbConnectionReady = true;
      console.log(chalkBlue(MODULE_ID_PREFIX 
        + " | " + getTimeStamp()
        + " | --> MONGO DB CONNECTING ..."));
    });

    db.on("connected", async function(){
      statsObj.status = "MONGO CONNECTED";
      statsObj.dbConnectionReady = true;
      console.log(chalkGreen(MODULE_ID_PREFIX 
        + " | " + getTimeStamp()
        + " | +++ MONGO DB CONNECTED"));
    });

    db.on("reconnected", async function(){
      statsObj.status = "MONGO RECONNECTED";
      statsObj.dbConnectionReady = true;
      console.log(chalkGreen(MODULE_ID_PREFIX
        + " | " + getTimeStamp()
        + " | -+- MONGO DB RECONNECTED"));
    });

    db.on("disconnecting", async function(){
      statsObj.status = "MONGO DISCONNECTING";
      statsObj.dbConnectionReady = false;
      console.log(chalkAlert(MODULE_ID_PREFIX
        + " | " + getTimeStamp()
        + " | !!! MONGO DB DISCONNECTING ..."));
    });

    db.on("disconnected", async function(){
      statsObj.status = "MONGO DISCONNECTED";
      statsObj.dbConnectionReady = false;
      console.log(chalkAlert(MODULE_ID_PREFIX
        + " | " + getTimeStamp()
        + " | !!! MONGO DB DISCONNECTED"
      ));
    });

    console.log(chalk.green(MODULE_ID_PREFIX + " | +++ MONGOOSE DEFAULT CONNECTION OPEN"));

    statsObj.dbConnectionReady = true;

    return db;

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECT ERROR: " + err));
    throw err;
  }
}

// !!!KLUDGE !!!BUG??? watch fucks up loading user data and I don't know why! :(
// const directoriesAdded = new Set();

setTimeout(async function(){

  try {
    await initFsmTickInterval(FSM_TICK_INTERVAL);
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | **** INIT CONFIG ERROR *****\n" + jsonPrint(err)));
    if (err.code !== 404) {
      quit({cause: new Error("INIT CONFIG ERROR")});
    }
  }
}, 1000);
