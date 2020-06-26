const DEFAULT_DATA_ROOT = process.env.DATA_ROOT_FOLDER || "/Volumes/nas4/data";

const DEFAULT_STAND_ALONE = false;
const DEFAULT_TEST_MODE = false;
const DEFAULT_VERBOSE = false;
const DEFAULT_UPDATE_DB_USER = true;

const ONE_SECOND = 1000;
const ONE_MINUTE = 60*ONE_SECOND;
const ONE_HOUR = 60*ONE_MINUTE;

const DEFAULT_QUEUE_INTERVAL = 10;
const DEFAULT_SEND_QUEUE_INTERVAL = 100;
// const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const util = require("util");
const pick = require("object.pick");
const deepcopy = require("deep-copy");
const os = require("os");
const fs = require("fs-extra");
const path = require("path");
const debug = require("debug");
const _ = require("lodash");
const chokidar = require("chokidar");
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

const MODULE_NAME = "twcChild";
let MODULE_ID_PREFIX = "NWC";
const QUIT_WAIT_INTERVAL = ONE_SECOND;
const DEFAULT_USER_ARCHIVE_FILE_EXITS_MAX_WAIT_TIME = 2*ONE_HOUR;

let dbConnection;

global.wordAssoDb = require("@threeceelabs/mongoose-twitter");

let configuration = {};

configuration.standAlone = DEFAULT_STAND_ALONE;
configuration.testMode = DEFAULT_TEST_MODE;
configuration.verbose = DEFAULT_VERBOSE;
configuration.updateDbUser = DEFAULT_UPDATE_DB_USER; // updates user in db from training set

configuration.userArchiveFileExistsMaxWaitTime = DEFAULT_USER_ARCHIVE_FILE_EXITS_MAX_WAIT_TIME;
const ThreeceeUtilities = require("@threeceelabs/threecee-utilities");
const tcUtils = new ThreeceeUtilities("NNC_TCU");

// const delay = tcUtils.delay;
const msToTime = tcUtils.msToTime;
const jsonPrint = tcUtils.jsonPrint;
const getTimeStamp = tcUtils.getTimeStamp;
// const formatBoolean = tcUtils.formatBoolean;

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
const moment = require("moment");

const chalk = require("chalk");
const chalkBlue = chalk.blue;
const chalkBlueBold = chalk.bold.blue;
const chalkGreen = chalk.green;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;
// const chalkWarn = chalk.red;

//=========================================================================
// HOST
//=========================================================================
// const configDefaultFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility/default");
// const configHostFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility", hostname);

configuration.archiveFileUploadCompleteFlagFile = "usersZipUploadComplete.json";

configuration.userDataFolder = path.join(DEFAULT_DATA_ROOT, "users");

//=========================================================================
// STATS
//=========================================================================

const startTimeMoment = moment();

const statsObj = {};

statsObj.archiveFlagObj = {};

statsObj.loadUsersFolderBusy = false;

let statsObjSmall = {};

statsObj.userUpdateQueue = 0;
statsObj.users = {};
statsObj.users.folder = {};
statsObj.users.folder.total = 0;
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

const statsPickArray = [
  "pid", 
  "startTime", 
  "elapsed", 
  "elapsedMS", 
  "userUpdateQueue",
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
      console.log("\n | %%%%%%%%%%%%%%\n | WATCHER CHILD DEBUG ENABLED \n | %%%%%%%%%%%%%%\n");
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
      + " | UUQ: " + userUpdateQueue.length
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
      if (!configuration.standAlone) { process.send(message); }
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

  const updateDbUser = params.updateDbUser || true;
  const folder = params.folder || path.dirname(params.path);
  const file = params.file || path.basename(params.path);

  const filePath = params.path || path.join(folder, file);

  let userObj = await fs.readJson(filePath);

  statsObj.users.folder.total += 1;

  if ((userObj.category === "left") || (userObj.category === "right") || (userObj.category === "neutral")) {


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

    if (((configuration.testMode || configuration.verbose) && (statsObj.users.folder.total % 100 === 0)) || (statsObj.users.folder.total % 1000 === 0)) {

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
            console.log(chalkAlert(MODULE_ID_PREFIX + " | TEST MODE"));
          }

          console.log(chalkBlueBold(
              "\n--------------------------------------------------------"
            + "\n" + MODULE_ID_PREFIX + " | " + configuration.processName 
            + "\nCONFIGURATION\n" + jsonPrint(configuration)
            + "--------------------------------------------------------"
          ));

          await initProcessSendQueue();
          await processSend({op: "STATS", childId: configuration.childId, fsmStatus: statsObj.fsmStatus});
          await initWatchUserDataFolders();

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
    "fsm_reset": "RESET"
  },

};

const fsm = Stately.machine(fsmStates);

async function initFsmTickInterval(interval) {

  console.log(chalkLog(MODULE_ID_PREFIX + " | INIT FSM TICK INTERVAL | " + msToTime(interval)));

  clearInterval(fsmTickInterval);

  fsmTickInterval = setInterval(function() {
    fsm.fsm_tick();
  }, FSM_TICK_INTERVAL);

  intervalsSet.add("fsmTickInterval");

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

        configuration.standAlone = false;

        MODULE_ID_PREFIX = m.moduleIdPrefix || MODULE_ID_PREFIX;

        console.log(chalkBlueBold(MODULE_ID_PREFIX + " | <R INIT"
          + " | CHILD ID: " + m.childId
          + "\nDEFAULT CONFIGURATION\n" + jsonPrint(configuration)
          + "\nLOADED  CONFIGURATION\n" + jsonPrint(m.configuration)
        ));

        configuration = _.assign(configuration, m.configuration);

        if (m.testMode !== undefined) { configuration.testMode = m.testMode; }
        if (m.verbose !== undefined) { configuration.verbose = m.verbose; }

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


let userUpdateQueueInterval;
const userUpdateQueue = [];
let userUpdateQueueReady = true;

function initUserUpdateQueue(p){

  const params = p || {};

  const interval = (params.interval !== undefined) ? params.interval : DEFAULT_QUEUE_INTERVAL;

  return new Promise(function(resolve){

    statsObj.status = "INIT USER UPDATE QUEUE";

    clearInterval(userUpdateQueueInterval);

    userUpdateQueueInterval = setInterval(async function(){

      if (userUpdateQueueReady && (userUpdateQueue.length > 0)){

        userUpdateQueueReady = false;

        const filePath = userUpdateQueue.shift();
        statsObj.userUpdateQueue = userUpdateQueue.length;

        try{
          await loadUserFile({path: filePath});
          userUpdateQueueReady = true;
        }
        catch(err){
          console.log(chalkError(MODULE_ID_PREFIX
            + " | *** LOAD USER FILE"
            + " | PATH: " + filePath
            + " | ERROR: " + err
          ));
          userUpdateQueueReady = true;
        }
      }

    }, interval);

    intervalsSet.add("userUpdateQueueInterval");

    resolve();

  });
}


const directoriesAdded = new Set();

function initWatchUserDataFolders(p){

  return new Promise(function(resolve){

    const params = p || {};
    let folder = params.folder || configuration.userDataFolder;

    const updateDbUser = (params.updateDbUser !== undefined) ? params.updateDbUser : configuration.updateDbUser;
    const verbose = (params.verbose !== undefined) ? params.verbose : configuration.verbose;

    console.log(chalkBlue(MODULE_ID_PREFIX + " | +++ INIT WATCH USER DATA"
      + " | userDataFolder: " + folder
      + " | updateDbUser: " + updateDbUser
    ));

    const options = {
      usePolling: true,
      depth: 1,
      awaitWriteFinish: true,
      persistent: true
    };

    if (configuration.testMode){ 
      folder += "/00000000"; 

      console.log(chalkAlert(MODULE_ID_PREFIX + " | +++ INIT WATCH USER DATA"
        + " | userDataFolder: " + folder
        + " | updateDbUser: " + updateDbUser
      ));

    }

    const watcher = chokidar.watch(folder, options);

    watcher.on("error", function(err){
      console.log(chalkError(MODULE_ID_PREFIX 
        + " | *** USER DATA WATCH ERROR | " + err
      ));
    });

    watcher.on("ready", function(){
      console.log(chalkGreen(MODULE_ID_PREFIX 
        + " | === USER DATA WATCH READY"
      ));
    });

    watcher.on("addDir", function(folderPath){

      directoriesAdded.add(folderPath);

      if(directoriesAdded.size % 100 === 0 || configuration.testMode){
        console.log(chalkLog(MODULE_ID_PREFIX 
          + " | +++ USER DATA WATCH FOLDER"
          + " [" + directoriesAdded.size + "] " + folderPath
        ));
      }
    });

    watcher.on("add", async function(filePath){
      if (filePath.endsWith(".json")){
        statsObj.users.files.added += 1;

        if (verbose || statsObj.users.files.added % 1000 === 0){
          console.log(chalkBlue(MODULE_ID_PREFIX
            + " [" + statsObj.users.files.added + "] +++ USER FILE CREATED: " + filePath
          ));
        }

        userUpdateQueue.push(filePath);
      }
    });  

    watcher.on("change", async function(filePath){
      if (filePath.endsWith(".json")){
        statsObj.users.files.added += 1;

        if (verbose || statsObj.users.files.added % 100 === 0){
          console.log(chalkBlue(MODULE_ID_PREFIX + " | +++ USER FILE CHANGED: " + filePath));
        }

        userUpdateQueue.push(filePath);
      }
    });  

    resolve();

  });
}

setTimeout(async function(){

  try {
    await initFsmTickInterval(FSM_TICK_INTERVAL);
    await initUserUpdateQueue();
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | **** INIT CONFIG ERROR *****\n" + jsonPrint(err)));
    if (err.code !== 404) {
      quit({cause: new Error("INIT CONFIG ERROR")});
    }
  }
}, 1000);
