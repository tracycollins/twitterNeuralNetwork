 /*jslint node: true */
/*jshint sub:true*/
const os = require("os");
let hostname = os.hostname();
hostname = hostname.replace(/.tld/g, ""); // amtrak wifi
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const MODULE_NAME = "tncChild";
const MODULE_ID_PREFIX = "TNC";

const DEFAULT_TEST_RATIO = 0.20;
const DEFAULT_NETWORK_TECHNOLOGY = "neataptic";
const DEFAULT_QUIT_ON_COMPLETE = false;
const DEFAULT_INPUTS_BINARY_MODE = false;
const TEST_MODE_LENGTH = 500;

const TEST_MODE = false; // applies only to parent

const ONE_SECOND = 1000;
const ONE_MINUTE = ONE_SECOND*60;

const ONE_KILOBYTE = 1024;
const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;

const DROPBOX_MAX_FILE_UPLOAD = 140 * ONE_MEGABYTE; // bytes

const fs = require("fs");
const JSONParse = require("safe-json-parse");
const sizeof = require("object-sizeof");
const HashMap = require("hashmap").HashMap;
const Dropbox = require("dropbox").Dropbox;
const yauzl = require("yauzl");
const fetch = require("isomorphic-fetch"); // or another library of choice.

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

const KEEPALIVE_INTERVAL = ONE_MINUTE;
const QUIT_WAIT_INTERVAL = ONE_SECOND;

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

let DROPBOX_ROOT_FOLDER;

if (hostname === "google") {
  DROPBOX_ROOT_FOLDER = "/home/tc/Dropbox/Apps/wordAssociation";
}
else {
  DROPBOX_ROOT_FOLDER = "/Users/tc/Dropbox/Apps/wordAssociation";
}

//=========================================================================
// MODULE REQUIRES
//=========================================================================
const neataptic = require("neataptic");
const carrot = require("@liquid-carrot/carrot");

let networkTech;
let network;
let networkObj = {};

const _ = require("lodash");
const moment = require("moment");
const pick = require("object.pick");
const treeify = require("treeify");
const MergeHistograms = require("@threeceelabs/mergehistograms");
const mergeHistograms = new MergeHistograms();
const arrayNormalize = require("array-normalize");

const debug = require("debug")("tfe");
const util = require("util");
const deepcopy = require("deep-copy");
const async = require("async");

const chalk = require("chalk");
const chalkNetwork = chalk.blue;
const chalkBlueBold = chalk.blue.bold;
const chalkBlue = chalk.blue;
const chalkGreen = chalk.green;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;

//=========================================================================
// HOST
//=========================================================================
let preppedTrainingSet = [];
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
statsObj.inputsObj = {};
statsObj.outputs = {};

statsObj.normalization = {};

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
  // quit({cause: "PARENT DISCONNECT"});
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

//=========================================================================
// CONFIGURATION
//=========================================================================

function filesListFolderLocal(options){
  return new Promise(function(resolve, reject) {

    const fullPath = DROPBOX_ROOT_FOLDER + options.path;

    fs.readdir(fullPath, function(err, items){
      if (err) {
        reject(err);
      }
      else {

        const itemArray = [];

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

          if (err) {
            console.log(chalkError(MODULE_ID_PREFIX + " | *** filesListFolderLocal ERROR:", err));
            return reject(err);
          }
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

    const fullPath = DROPBOX_ROOT_FOLDER + options.path;

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

let configuration = {};

configuration.offlineMode = false;
configuration.networkTechnology = DEFAULT_NETWORK_TECHNOLOGY;
configuration.inputsBinaryMode = DEFAULT_INPUTS_BINARY_MODE;
configuration.testMode = TEST_MODE;

configuration.testSetRatio = DEFAULT_TEST_RATIO;

configuration.dropboxMaxFileUpload = DROPBOX_MAX_FILE_UPLOAD;

configuration.DROPBOX = {};
configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;

const DROPBOX_CONFIG_FOLDER = "/config/utility";
const DROPBOX_CONFIG_DEFAULT_FOLDER = DROPBOX_CONFIG_FOLDER + "/default";
const DROPBOX_CONFIG_HOST_FOLDER = DROPBOX_CONFIG_FOLDER + "/" + hostname;

configuration.local = {};
configuration.local.trainingSetsFolder = DROPBOX_CONFIG_HOST_FOLDER + "/trainingSets";
configuration.local.userArchiveFolder = DROPBOX_CONFIG_HOST_FOLDER + "/trainingSets/users";

configuration.default = {};
configuration.default.trainingSetsFolder = DROPBOX_CONFIG_DEFAULT_FOLDER + "/trainingSets";
configuration.default.userArchiveFolder = DROPBOX_CONFIG_DEFAULT_FOLDER + "/trainingSets/users";

configuration.trainingSetsFolder = configuration[HOST].trainingSetsFolder;
configuration.archiveFileUploadCompleteFlagFolder = configuration[HOST].trainingSetsFolder + "/users";

configuration.userArchiveFolder = configuration.default.userArchiveFolder;

configuration.defaultUserArchiveFlagFile = "usersZipUploadComplete.json";
configuration.trainingSetFile = "trainingSet.json";
configuration.requiredTrainingSetFile = "requiredTrainingSet.txt";

configuration.slackChannel = {};

configuration.keepaliveInterval = KEEPALIVE_INTERVAL;
configuration.quitOnComplete = DEFAULT_QUIT_ON_COMPLETE;

let dropboxClient;

const dropboxRemoteClient = new Dropbox({ 
  accessToken: configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN,
  fetch: fetch
});

const dropboxLocalClient = { // offline mode
  filesListFolder: filesListFolderLocal,
  filesUpload: function(){},
  filesDownload: function(){},
  filesGetMetadata: filesGetMetadataLocal,
  filesDelete: function(){}
};

if (configuration.offlineMode) {
  dropboxClient = dropboxLocalClient;
}
else {
  dropboxClient = dropboxRemoteClient;
}

let userMaxInputHashMap = {};

const trainingSetUsersHashMap = {};
trainingSetUsersHashMap.left = new HashMap();
trainingSetUsersHashMap.neutral = new HashMap();
trainingSetUsersHashMap.right = new HashMap();

let maxInputHashMap = {};

let evolveOptions = {};

function initConfig(cnf) {

  return new Promise(async function(resolve, reject){

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

      const configArgs = Object.keys(configuration);

      configArgs.forEach(function(arg){
        if (_.isObject(configuration[arg])) {
          console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + "\n" + jsonPrint(configuration[arg]));
        }
        else {
          console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + ": " + configuration[arg]);
        }
      });
      
      resolve(configuration);

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** CONFIG LOAD ERROR: " + err ));
      reject(err);
    }

  });
}

function init(){
  return new Promise(async function(resolve){
    statsObj.status = "INIT";
    resolve();
  });
}

//=========================================================================
// MONGO DB
//=========================================================================

global.globalDbConnection = false;
const mongoose = require("mongoose");
mongoose.set("useFindAndModify", false);

global.globalWordAssoDb = require("@threeceelabs/mongoose-twitter");

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

let dbConnectionReadyInterval;

const UserServerController = require("@threeceelabs/user-server-controller");
let userServerController;
let userServerControllerReady = false;

const TweetServerController = require("@threeceelabs/tweet-server-controller");
let tweetServerController;
let tweetServerControllerReady = false;

function connectDb(){

  return new Promise(async function(resolve, reject){

    try {

      statsObj.status = "CONNECTING MONGO DB";

      global.globalWordAssoDb.connect(MODULE_ID + "_" + process.pid, async function(err, db){

        if (err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR: " + err));
          statsObj.status = "MONGO CONNECTION ERROR";
          quit({cause: "MONGO DB ERROR: " + err});
          return reject(err);
        }

        db.on("error", async function(){
          statsObj.status = "MONGO ERROR";
          console.error.bind(console, MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR");
          console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR"));
          db.close();
          quit({cause: "MONGO DB ERROR: " + err});
        });

        db.on("disconnected", async function(){
          statsObj.status = "MONGO DISCONNECTED";
          console.error.bind(console, MODULE_ID_PREFIX + " | *** MONGO DB DISCONNECTED");
          // slackSendMessage(hostname + " | TFE | " + statsObj.status);
          console.log(chalkAlert(MODULE_ID_PREFIX + " | *** MONGO DB DISCONNECTED"));
          quit({cause: "MONGO DB DISCONNECTED"});
        });


        global.globalDbConnection = db;

        console.log(chalk.green(MODULE_ID_PREFIX + " | MONGOOSE DEFAULT CONNECTION OPEN"));

        global.globalEmoji = global.globalDbConnection.model("Emoji", emojiModel.EmojiSchema);
        global.globalHashtag = global.globalDbConnection.model("Hashtag", hashtagModel.HashtagSchema);
        global.globalLocation = global.globalDbConnection.model("Location", locationModel.LocationSchema);
        global.globalMedia = global.globalDbConnection.model("Media", mediaModel.MediaSchema);
        global.globalNeuralNetwork = global.globalDbConnection.model("NeuralNetwork", neuralNetworkModel.NeuralNetworkSchema);
        global.globalPlace = global.globalDbConnection.model("Place", placeModel.PlaceSchema);
        global.globalTweet = global.globalDbConnection.model("Tweet", tweetModel.TweetSchema);
        global.globalUrl = global.globalDbConnection.model("Url", urlModel.UrlSchema);
        global.globalUser = global.globalDbConnection.model("User", userModel.UserSchema);
        global.globalWord = global.globalDbConnection.model("Word", wordModel.WordSchema);

        const uscChildName = MODULE_ID_PREFIX + "_USC";
        userServerController = new UserServerController(uscChildName);

        const tscChildName = MODULE_ID_PREFIX + "_TSC";
        tweetServerController = new TweetServerController(tscChildName);

        tweetServerController.on("ready", function(appname){
          tweetServerControllerReady = true;
          console.log(chalk.green(MODULE_ID_PREFIX + " | " + tscChildName + " READY | " + appname));
        });

        tweetServerController.on("error", function(err){
          tweetServerControllerReady = false;
          console.trace(chalkError(MODULE_ID_PREFIX + " | *** " + tscChildName + " ERROR | " + err));
        });

        userServerController.on("ready", function(appname){
          userServerControllerReady = true;
          console.log(chalkLog(MODULE_ID_PREFIX + " | " + uscChildName + " READY | " + appname));
        });

        dbConnectionReadyInterval = setInterval(function(){

          if (userServerControllerReady && tweetServerControllerReady) {

            console.log(chalk.green(MODULE_ID_PREFIX + " | MONGO DB READY"));

            clearInterval(dbConnectionReadyInterval);
            statsObj.status = "MONGO DB CONNECTED";
            resolve(db);
          }

        }, 1000);

      });
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECT ERROR: " + err));
      reject(err);
    }
  });
}
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

function msToTime(d) {

  let duration = d;
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
  let currentTimeStamp;
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

function getElapsedTimeStamp(){
  statsObj.elapsedMS = moment().valueOf() - startTimeMoment.valueOf();
  return msToTime(statsObj.elapsedMS);
}


async function showStats(options) {

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

  process.send({op: "QUIT", childId: configuration.childId, data: statsObj});

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
function loadFile(params) {

  return new Promise(async function(resolve, reject){

    const noErrorNotFound = params.noErrorNotFound || false;

    let fullPath = params.path || params.folder + "/" + params.file;

    debug(chalkInfo("LOAD PATH " + params.path));
    debug(chalkInfo("LOAD FOLDER " + params.folder));
    debug(chalkInfo("LOAD FILE " + params.file));
    debug(chalkInfo("FULL PATH " + fullPath));


    if (configuration.offlineMode || params.loadLocalFile) {

      fullPath = DROPBOX_ROOT_FOLDER + fullPath;
      console.log(chalkInfo("OFFLINE_MODE: FULL PATH " + fullPath));

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

      dropboxClient.filesDownload({path: fullPath}).
      then(function(data) {

        debug(chalkLog(getTimeStamp()
          + " | LOADING FILE FROM DROPBOX FILE: " + fullPath
        ));

        if (fullPath.match(/\.json$/gi)) {

          const payload = data.fileBinary;

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

            if (params.includeMetaData) {

              const results = {};

              results.data = fileObj;

              results.meta = {};
              delete data.fileBinary;
              results.meta = data;

              return resolve(results);

            }
            return resolve(fileObj);

          });

        }
        else {
          resolve();
        }
      }).
      catch(function(err) {

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

    // const includeMetaData = params.includeMetaData || false;
    const resolveOnNotFound = params.resolveOnNotFound || false;
    const maxRetries = params.maxRetries || 10;
    let retryNumber;
    let backOffTime = params.initialBackOffTime || ONE_SECOND;
    const path = params.path || params.folder + "/" + params.file;

    for (retryNumber = 0;retryNumber < maxRetries;retryNumber++) {
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

function unzipUsersToArray(params){

  console.log(chalkBlue(MODULE_ID_PREFIX + " | UNZIP USERS TO TRAINING SET: " + params.path));

  return new Promise(async function(resolve, reject) {

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
          
          if ((/\/$/).test(entry.fileName)) { 
            zipfile.readEntry(); 
          } 
          else {
            zipfile.openReadStream(entry, async function(err, readStream) {

              entryNumber += 1;
              
              if (err) {
                console.log(chalkError("TNN | *** UNZIP USERS ENTRY ERROR [" + entryNumber + "]: " + err));
                return reject(err);
              }

              let userString = "";

              readStream.on("end", async function() {

                try {
                  const userObj = JSON.parse(userString);

                  if (entry.fileName.endsWith("maxInputHashMap.json")) {

                    console.log(chalkLog(MODULE_ID_PREFIX + " | UNZIPPED MAX INPUT"));

                    userMaxInputHashMap = userObj.maxInputHashMap;
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

                      if (configuration.verbose || (statsObj.users.unzipped % 1000 === 0)) {

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
                          + " | CAT M: " + userObj.category + " A: " + userObj.categoryAuto
                        ));
                      }
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
                    }

                  }

                  zipfile.readEntry();
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

              readStream.on("close", async function(){
                console.log(chalkInfo(MODULE_ID_PREFIX + " | UNZIP STREAM CLOSED"));
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

function updateTrainingSet(){

  console.log(chalkBlue(MODULE_ID_PREFIX + " | UPDATE TRAINING SET"));

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

      maxInputHashMap = {};

      async.eachSeries(["left", "neutral", "right"], function(category, cb){

        const trainingSetSize = parseInt((1 - configuration.testSetRatio) * trainingSetUsersHashMap[category].size);
        const testSetSize = parseInt(configuration.testSetRatio * trainingSetUsersHashMap[category].size);

        console.log(chalkLog(MODULE_ID_PREFIX + " | TRAINING SET | " + category.toUpperCase()
          + " | SIZE: " + trainingSetSize
          + " | TEST SIZE: " + testSetSize
        ));

        trainingSetObj.data = trainingSetObj.data.concat(trainingSetUsersHashMap[category].values().slice(testSetSize));
        testSetObj.data = testSetObj.data.concat(trainingSetUsersHashMap[category].values().slice(0, testSetSize-1));

        cb();

      }, function(err){

        if (err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** UPDATE TRAINING SET ERROR: " + err));
          return reject(err);
        }

        trainingSetObj.meta.setSize = trainingSetObj.data.length;
        testSetObj.meta.setSize = testSetObj.data.length;

        maxInputHashMap = userMaxInputHashMap;

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

let sizeInterval;

function fileSize(params){

  return new Promise(async function(resolve, reject){

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
    }


    sizeInterval = setInterval(async function(){

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

            resolve();
          }
        });
      }

    }, interval);

  });
}

function loadUsersArchive(params){

  return new Promise(async function(resolve, reject){

    const defaultUserArchiveFolder = DROPBOX_ROOT_FOLDER + configuration.userArchiveFolder;

    params.folder = params.folder || defaultUserArchiveFolder;
    params.path = (params.path !== undefined) ? params.path : params.folder + "/" + params.file;

    console.log(chalkLog(MODULE_ID_PREFIX 
      + " | LOADING USERS ARCHIVE"
      + " | " + getTimeStamp() 
      + "\n PATH:   " + params.path
      + "\n FOLDER: " + params.folder
      + "\n FILE:   " + params.file
    ));

    try {
      await fileSize(params);
      await unzipUsersToArray(params);
      await updateTrainingSet();
      resolve();
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD USERS ARCHIVE ERROR | " + getTimeStamp() + " | " + err));
      reject(err);
    }

  });
}

function loadTrainingSet(){

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


    console.log(chalkLog(MODULE_ID_PREFIX + " | USER ARCHIVE FILE | FILE: " + archiveFlagObj.file + " | SIZE: " + archiveFlagObj.size));

    if (archiveFlagObj.file !== statsObj.archiveFile) {

      statsObj.trainingSetReady = false;

      try {
        await loadUsersArchive({file: archiveFlagObj.file, size: archiveFlagObj.size});
        statsObj.archiveModified = getTimeStamp();
        statsObj.loadUsersArchiveBusy = false;
        statsObj.archiveFile = archiveFlagObj.file;
        statsObj.trainingSetReady = true;
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


function testNetwork(){

  return new Promise(async function(resolve, reject){

    console.log(chalkBlue("NNC | TEST NETWORK"
      + " | NETWORK ID: " + networkObj.networkId
      + " | " + testSetObj.data.length + " TEST DATA LENGTH"
    ));

    const nw = networkTech.Network.fromJSON(networkObj.network);

    let numTested = 0;
    const numSkipped = 0; 
    let numPassed = 0;
    let successRate = 0;
    const testResultArray = [];

    const convertDatumParams = {};
    convertDatumParams.normalization = statsObj.normalization;
    convertDatumParams.maxInputHashMap = maxInputHashMap;

    const shuffledTestData = _.shuffle(testSetObj.data);

    async.each(shuffledTestData, async function(datum){

      try {

        const testDatumObj = await convertDatum({datum: datum, inputsObj: networkObj.inputsObj, generateInputRaw: false});
        const testOutput = await activateNetwork({network: nw, input: testDatumObj.input});
        const testMaxOutputIndex = await indexOfMax(testOutput);
        const expectedMaxOutputIndex = await indexOfMax(testDatumObj.output);

        debug("INDEX OF MAX TEST OUTPUT: " + expectedMaxOutputIndex);

        const passed = (testMaxOutputIndex === expectedMaxOutputIndex);

        numTested += 1;

        numPassed = passed ? numPassed+1 : numPassed;

        successRate = 100 * numPassed/(numTested + numSkipped);

        const currentChalk = passed ? chalkLog : chalkAlert;

        testResultArray.push(
          {
            P: passed,
            EO: testDatumObj.output,
            EOI: expectedMaxOutputIndex,
            TO: testOutput, 
            TOI: testMaxOutputIndex
          }
        );

        if ((configuration.testMode || configuration.verbose) && (numTested % 100 === 0)){
          console.log(currentChalk(MODULE_ID_PREFIX + " | TEST RESULT: " + passed 
            + " | " + successRate.toFixed(2) + "%"
            + " | " + testOutput[0]
            + " " + testOutput[1]
            + " " + testOutput[2]
            + " | TMOI: " + testMaxOutputIndex
            + " | " + testDatumObj.output[0]
            + " " + testDatumObj.output[1]
            + " " + testDatumObj.output[2]
            + " | EMOI: " + expectedMaxOutputIndex
          ));
        }

        return;

      }
      catch(err){
        console.trace(chalkError(MODULE_ID_PREFIX
          + " | *** TEST ERROR: " + err
        ));
        return err;
      }

    }, function(err){

      if (err){
        return reject(err);
      }

      const testResults = { 
        testSetId: testSetObj.meta.testSetId, 
        numTests: testSetObj.meta.setSize, 
        numSkipped: numSkipped, 
        numPassed: numPassed, 
        successRate: successRate
      };

      console.log(chalkNetwork(MODULE_ID_PREFIX + " | TEST COMPLETE"));

      debug(chalkNetwork(MODULE_ID_PREFIX
        + " | TEST RESULTS\n" + jsonPrint(testResults)
      ));

      resolve(testResults);

    });

  });
}

function convertDatum(params){

  const datum = params.datum;
  const generateInputRaw = params.generateInputRaw;

  return new Promise(async function(resolve, reject){

    try {

      const inputTypes = Object.keys(params.inputsObj.inputs).sort();

      const mergedHistograms = await mergeHistograms.merge({ histogramA: datum.tweetHistograms, histogramB: datum.profileHistograms });

      const convertedDatum = {};

      convertedDatum.screenName = datum.screenName;
      convertedDatum.input = [];
      convertedDatum.output = [];
      convertedDatum.inputRaw = [];

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
        console.log(chalkError(MODULE_ID_PREFIX
          + " | *** CATEGORY ERROR: " + datum.category 
          + " | @" + datum.screenName
        ));
        return reject(new Error("UNKNOWN CATEGORY: " + datum.category));
      }

      async.eachSeries(inputTypes, function(inputType, cb0){

        const inNames = params.inputsObj.inputs[inputType].sort();

        async.eachSeries(inNames, function(inName, cb1){

          const inputName = inName;

          if (generateInputRaw) {
            convertedDatum.inputRaw.push(inputName);
          }

          if (inputType === "sentiment") {
            if (datum.languageAnalysis === undefined) {
              convertedDatum.input.push(0);
            }
            else if (datum.languageAnalysis[inputName] === undefined) {
              convertedDatum.input.push(0);
            }
            else {
              convertedDatum.input.push(datum.languageAnalysis[inputName]);
            }
            async.setImmediate(function() {
              cb1();
            });
          }
          else if (inputType === "friends"){
            if ((datum.friends !== undefined) && (datum.friends.length > 0) && (datum.friends.includes(inputName))){
              convertedDatum.input.push(1);
              debug(chalkLog("TNC | +++ FRIEND INPUT | @" + datum.screenName + " | " + inputName));
            }
            else {
              convertedDatum.input.push(0);
            }
            async.setImmediate(function() {
              cb1();
            });
          }
          else if (
            mergedHistograms[inputType] 
            && (mergedHistograms[inputType] !== undefined) 
            && (mergedHistograms[inputType][inputName] !== undefined)
          ){

            if (configuration.inputsBinaryMode) {
              convertedDatum.input.push(1);
            }
            else if ((maxInputHashMap === undefined) 
              || (maxInputHashMap[inputType] === undefined)) {
              debug(chalkAlert("UNDEFINED??? maxInputHashMap." + inputType + " | " + inputName));
              convertedDatum.input.push(1);
            }
            else {
              const inputValue = (
                maxInputHashMap[inputType] 
                && maxInputHashMap[inputType][inputName] 
                && (maxInputHashMap[inputType][inputName] > 0)
              ) 
                ? mergedHistograms[inputType][inputName]/maxInputHashMap[inputType][inputName] 
                : 1;
              convertedDatum.input.push(inputValue);
            }

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
        resolve(convertedDatum);
      });

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX
        + " | *** CONVERT TRAINING DATUM ERROR: " + err
      ));
      return reject(err);
    }

  });
}

function networkEvolve(params) {

  return new Promise(async function(resolve, reject){

    console.log(chalkBlueBold("TNC | >>> START NETWORK EVOLVE"
      + " | " + getTimeStamp()
      + " | NNID: " + statsObj.training.testRunId
    ));

    const network = params.network;
    const options = params.options;

    let results;

    try {
      results = await network.evolve(preppedTrainingSet, options);
    }
    catch(err){
      console.log(chalkError("TNC | *** EVOLVE ERROR: " + err));
      return reject(err);
    }

    results.threads = options.threads;

    statsObj.evolve.endTime = moment().valueOf();
    statsObj.evolve.elapsed = moment().valueOf() - statsObj.evolve.startTime;
    statsObj.evolve.results = results;

    const exportedNetwork = network.toJSON();

    const nnInputTypes = Object.keys(params.inputsObj.inputs).sort();

    let nodeIndex = 0; // 

    async.eachSeries(nnInputTypes, function(inputType, cb0){

      const typeInputArray = params.inputsObj.inputs[inputType].sort();

      async.eachSeries(typeInputArray, function(inputName, cb1){

        debug("IN [" + nodeIndex + "]: " + inputName);

        if (exportedNetwork.nodes[nodeIndex].type !== "input") {
          console.log(chalkError("NNC | NOT INPUT ERROR " + nodeIndex + " | " + inputName));
          return cb1("NN NOT INPUT NODE ERROR");
        }

        exportedNetwork.nodes[nodeIndex].name = inputName;
        exportedNetwork.nodes[nodeIndex].inputType = inputType;
        nodeIndex += 1;

        cb1();

      }, function(err){

        if (err) {
          return cb0(err);
        }

        debug("... END NN NODE NAME TYPE: " + inputType);
        cb0();

      });

    }, function(err){

      if (err) {
        return reject(err);
      }

      nodeIndex = exportedNetwork.nodes.length - exportedNetwork.output;
      debug("OUTPUT INDEX START " + nodeIndex);

      if (exportedNetwork.nodes[nodeIndex].type !== "output") {
        console.log(chalkError("NNC | NOT OUTPUT ERROR " 
          + nodeIndex 
          + "\n" + jsonPrint(exportedNetwork.nodes[nodeIndex])
        ));
      }

      exportedNetwork.nodes[nodeIndex].name = "left";
      nodeIndex += 1;
      exportedNetwork.nodes[nodeIndex].name = "neutral";
      nodeIndex += 1;
      exportedNetwork.nodes[nodeIndex].name = "right";

      debug("... END NETWORK NODE UPDATE: " + statsObj.training.testRunId);

      networkObj = {};
      networkObj.networkId = statsObj.training.testRunId;
      networkObj.seedNetworkId = statsObj.training.seedNetworkId;
      networkObj.seedNetworkRes = statsObj.training.seedNetworkRes;
      networkObj.networkCreateMode = "evolve";
      networkObj.successRate = 0;
      networkObj.matchRate = 0;
      networkObj.testRunId = statsObj.training.testRunId;
      networkObj.network = {};
      networkObj.network = exportedNetwork;
      networkObj.numInputs = exportedNetwork.input;
      networkObj.numOutputs = exportedNetwork.output;
      networkObj.inputsId = params.inputsId;
      networkObj.inputsObj = {};
      networkObj.inputsObj = params.inputsObj;
      networkObj.outputs = {};
      networkObj.outputs = options.outputs;
      networkObj.evolve = {};
      networkObj.evolve.results = {};
      networkObj.evolve.results = results;
      networkObj.evolve.results.error = ((results.error !== undefined) && results.error && (results.error < Infinity)) ? results.error : 0;
      networkObj.evolve.options = {};
      networkObj.evolve.options = params;
      networkObj.evolve.elapsed = statsObj.evolve.elapsed;
      networkObj.evolve.startTime = statsObj.evolve.startTime;
      networkObj.evolve.endTime = statsObj.evolve.endTime;

      if (((results.error === 0) || (results.error > options.error)) && (results.iterations < options.iterations)) {

        statsObj.evolve.results.earlyComplete = true;
        networkObj.evolve.results.earlyComplete = true;

        console.log(chalkError("NNC | EVOLVE COMPLETE EARLY???"
          + " | " + configuration.childId
          + " | " + getTimeStamp()
          + " | " + "TIME: " + results.time
          + " | " + "THREADS: " + results.threads
          + " | " + "ITERATIONS: " + results.iterations
          + " | " + "ERROR: " + results.error
          + " | " + "ELAPSED: " + msToTime(statsObj.evolve.elapsed)
        ));

        return reject(new Error("EVOLVE EARLY COMPLETE"));

      }

      console.log(chalkBlueBold("=======================================================\n"
        + MODULE_ID_PREFIX
        + " | EVOLVE COMPLETE"
        + " | " + configuration.childId
        + " | " + getTimeStamp()
        + " | " + "TIME: " + results.time
        + " | " + "THREADS: " + results.threads
        + " | " + "ITERATIONS: " + results.iterations
        + " | " + "ERROR: " + results.error
        + " | " + "ELAPSED: " + msToTime(statsObj.evolve.elapsed)
        + "\n======================================================="
      ));

      resolve(networkObj);

    });

  });
}
function trainingSetPrep(params){

  return new Promise(function(resolve, reject){

    preppedTrainingSet = [];
    let generateInputRaw = true;

    let dataConverted = 0;

    trainingSetObj.meta.numInputs = params.inputsObj.meta.numInputs;
    testSetObj.meta.numInputs = params.inputsObj.meta.numInputs;

    console.log(chalkBlue(MODULE_ID_PREFIX
      + " | TRAINING SET PREP"
      + " | DATA LENGTH: " + trainingSetObj.data.length
      + " | INPUTS NUM IN: " + params.inputsObj.meta.numInputs
      + "\nTRAINING SET META\n" + jsonPrint(trainingSetObj.meta)
    ));

    const shuffledTrainingData = _.shuffle(trainingSetObj.data);

    async.eachSeries(shuffledTrainingData, async function(datum){

      try {
        const datumObj = await convertDatum({datum: datum, inputsObj: params.inputsObj, generateInputRaw: generateInputRaw});

        dataConverted += 1;

        if (datumObj.input.length !== params.inputsObj.meta.numInputs) { 
          console.log(chalkError(MODULE_ID_PREFIX
            + " | *** ERROR TRAINING SET PREP ERROR" 
            + " | INPUT NUMBER MISMATCH" 
            + " | INPUTS NUM IN: " + params.inputsObj.meta.numInputs
            + " | DATUM NUM IN: " + datumObj.input.length
          ));
          return (new Error("INPUT NUMBER MISMATCH"));
        }

        if (datumObj.output.length !== 3) { 
          console.log(chalkError(MODULE_ID_PREFIX
            + " | *** ERROR TRAINING SET PREP ERROR" 
            + " | OUTPUT NUMBER MISMATCH" 
            + " | INPUTS NUM IN: " + params.inputsObj.meta.numOutputs
            + " | DATUM NUM IN: " + datumObj.output.length
          ));
          return (new Error("INPUT NUMBER MISMATCH"));
        }

        if (datumObj.inputRaw.length > 0) { 
          generateInputRaw = false;
        }

        preppedTrainingSet.push({ 
          input: datumObj.input, 
          output: datumObj.output
        });

        if (configuration.verbose || (dataConverted % 1000 === 0)){
          console.log(chalkLog("TNC | DATA CONVERTED: " + dataConverted + "/" + trainingSetObj.data.length));
        }

        return;
      }
      catch(err){
        console.log(chalkError(MODULE_ID_PREFIX
          + " | *** ERROR TRAINING SET PREP: " + err 
        ));
        return err;
      }

    }, function(err){

      if (err) {
        return reject(err);
      }

      console.log(chalkBlue("TNC | TRAINING SET PREP COMPLETE | TRAINING SET LENGTH: " + preppedTrainingSet.length));

      resolve();

    });

  });
}

function evolve(p){

  return new Promise(function(resolve, reject){

    let params = {};
    params = p;
    params.schedStartTime = moment().valueOf();

    debug("evolve params.network\n" + jsonPrint(params.network));

    if (params.architecture === undefined) { params.architecture = "random"; }
    if (params.networkTechnology === undefined) { params.networkTechnology = configuration.networkTechnology; }

    switch (params.networkTechnology) {
      case "neataptic":
        networkTech = neataptic;
      break;
      case "carrot":
        networkTech = carrot;
      break;
      default:
        networkTech = neataptic;
    }

    const options = {};

    if ((params.network !== undefined) && params.networkObj) {
      options.networkObj = params.networkObj;
      params.architecture = "loadedNetwork";
      debug(chalkAlert("NNC | START NETWORK DEFINED: " + options.networkObj.networkId));
    }

    options.iterations = params.iterations;
    options.error = params.error;
    options.growth = params.growth;
    options.threads = params.threads;
    options.elitism = params.elitism;
    options.equal = params.equal;
    options.mutation = networkTech.methods.mutation.FFW;
    options.mutationRate = params.mutationRate;
    options.popsize = params.popsize;

    statsObj.evolve.startTime = moment().valueOf();
    statsObj.evolve.elapsed = 0;
    statsObj.evolve.stats = {};

    async.each(Object.keys(params), function(key, cb){

      debug(">>>> KEY: " + key);

      switch (key) {

        case "network":
          console.log("NNC"
            + " | " + configuration.childId
            + " | EVOLVE OPTION"
            + " | " + key + ": " + params[key].networkId 
            + " | " + params[key].successRate.toFixed(2) + "%"
          );
        break;

        case "mutation":
          console.log("NNC" + " | " + configuration.childId + " | EVOLVE OPTION | " + key + ": " + "FFW");
        break;
              
        case "cost":
          console.log("NNC" + " | " + configuration.childId + " | EVOLVE OPTION | " + key + ": " + params[key]);
          // options.cost = neataptic.methods.cost[params[key]];
          // options.cost = carrot.methods.cost[params[key]];
          options.cost = networkTech.methods.cost[params[key]];
        break;

        case "activation":
          console.log("NNC" + " | " + configuration.childId + " | EVOLVE OPTION | " + key + ": " + params[key]);
          // options.activation = neataptic.methods.activation[params[key]];
          // options.activation = carrot.methods.activation[params[key]];
          options.activation = networkTech.methods.activation[params[key]];
        break;

        default:
          if (key !== "log"){
            console.log("NNC" + " | " + configuration.childId + " | EVOLVE OPTION | " + key + ": " + params[key]);
            options[key] = params[key];
          }
      }

      cb();

    }, async function(){

      network = {};
      let networkObj;
      let testResults;

      switch (params.architecture) {

        case "loadedNetwork":

          network = networkTech.Network.fromJSON(options.networkObj.network);

          console.log("NNC"
            + " | " + configuration.childId
            + " | EVOLVE ARCH | LOADED: " + options.networkObj.networkId
            + " | IN: " + options.networkObj.network.input
            + " | OUT: " + options.networkObj.network.output
          );

        break;

        case "perceptron":

          console.log("NNC | EVOLVE ARCH"
            + " | " + configuration.childId
            + " | " + params.architecture
            + " | HIDDEN LAYER NODES: " + params.hiddenLayerSize
          );

          network = new networkTech.architect.Perceptron(
            trainingSetObj.meta.numInputs, 
            params.hiddenLayerSize,
            trainingSetObj.meta.numOutputs
          );

        break;

        default:

          console.log("NNC | EVOLVE ARCH"
            + " | " + configuration.childId
            + " | " + params.architecture.toUpperCase()
            + " | INPUTS: " + params.inputsObj.meta.numInputs
            + " | OUTPUTS: " + trainingSetObj.meta.numOutputs
          );

          network = new networkTech.Network(
            params.inputsObj.meta.numInputs, 
            3
          );

        }

        params.network = network; // network evolve options
        // params.options = options; // network evolve options

        try {
          
          await trainingSetPrep(params);

          params.schedStartTime = moment().valueOf();

          options.schedule = {

            function: function(schedParams){

              const elapsedInt = moment().valueOf() - params.schedStartTime;
              const iterationRate = elapsedInt/schedParams.iteration;
              const iterationRateSec = iterationRate/1000.0;
              const timeToComplete = iterationRate*(params.iterations - schedParams.iteration);

              statsObj.evolve.stats = schedParams;

              const sObj = {
                networkId: params.runId,
                numInputs: params.inputsObj.meta.numInputs,
                inputsId: params.inputsId,
                evolveStart: params.schedStartTime,
                evolveElapsed: elapsedInt,
                totalIterations: params.iterations,
                iteration: schedParams.iteration,
                iterationRate: iterationRate,
                timeToComplete: timeToComplete,
                error: schedParams.error.toFixed(5) || "---",
                fitness: schedParams.fitness.toFixed(5) || "---"
              };

              process.send({op: "EVOLVE_SCHEDULE", childId: configuration.childId, childIdShort: configuration.childIdShort, stats: sObj});

              // function schedMsToTime(duration) {
              //   let seconds = parseInt((duration / 1000) % 60);
              //   let minutes = parseInt((duration / (1000 * 60)) % 60);
              //   let hours = parseInt((duration / (1000 * 60 * 60)) % 24);
              //   let days = parseInt(duration / (1000 * 60 * 60 * 24));

              //   days = (days < 10) ? "0" + days : days;
              //   hours = (hours < 10) ? "0" + hours : hours;
              //   minutes = (minutes < 10) ? "0" + minutes : minutes;
              //   seconds = (seconds < 10) ? "0" + seconds : seconds;

              //   return days + ":" + hours + ":" + minutes + ":" + seconds;
              // }

              // debug("NNC | EVOLVE"
              //   + " | " + configuration.childId
              //   + " | IN: " + params.inputsObj.meta.numInputs
              //   + " | S: " + moment(params.schedStartTime).format(compactDateTimeFormat)
              //   + " | R: " + schedMsToTime(elapsedInt)
              //   + " | RATE: " + iterationRateSec.toFixed(1) + " s/I"
              //   + " | ETC: " + schedMsToTime(timeToComplete)
              //   + " | ETC: " + moment().add(timeToComplete).format(compactDateTimeFormat)
              //   + " | I: " + schedParams.iteration + " / " + params.iterations
              //   + " | F: " + schedParams.fitness.toFixed(5)
              //   + " | E: " + schedParams.error.toFixed(5)
              // );
            },
            
            iterations: params.log
          };

          params.options = options; // network evolve options

          networkObj = await networkEvolve(params);

          params.networkObj = networkObj;

          testResults = await testNetwork();

          networkObj.successRate = testResults.successRate;
          networkObj.test = {};
          networkObj.test.results = {};
          networkObj.test.results = testResults;

          return resolve(networkObj);
        }
        catch(err){
          console.log(chalkError("TNC | *** EVOLVE ERROR: " + err));
          return reject(err);
        }

    });

  });
}

function activateNetwork(params){
  return new Promise(function(resolve, reject){
    try {
      const output = params.network.activate(params.input);
      resolve(output);
    }
    catch(err){
      return reject(err);
    }

  });
}

function indexOfMax (arr) {

  return new Promise(function(resolve, reject){

    try {
      if (arr.length === 0) {
        debug(chalkAlert("NNC | indexOfMax: 0 LENG ARRAY: -1"));
        return resolve(-2); 
      }

      if ((arr[0] === arr[1]) && (arr[1] === arr[2])){
        debug(chalkAlert("NNT | indexOfMax: ALL EQUAL"));
        debug(chalkAlert("NNT | ARR" 
          + " | " + arr[0].toFixed(2) 
          + " - " + arr[1].toFixed(2) 
          + " - " + arr[2].toFixed(2)
        ));
        if (arr[0] === 0) { 
          return resolve(-4); 
        }
        return resolve(4); 
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
          resolve(3); 
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
            resolve(maxIndex); 
          });

        });
      }
    }
    catch(err){
      return reject(err);
    }

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
    onEnter: function(event, oldState, newState) {
      reporter(event, oldState, newState);

      statsObj.fsmStatus = "ERROR";

      quit("FSM ERROR");
    }
  },

  "INIT": {
    onEnter: async function(event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
        statsObj.fsmStatus = "INIT";
        try {
          await init();
          fsm.fsm_ready();
        }
        catch(err){
          console.log(MODULE_ID_PREFIX + " | *** INIT ERROR: " + err);
          fsm.fsm_error();
        }
        process.send({op: "STATS", childId: configuration.childId, data: statsObj});
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
    onEnter: function(event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
        statsObj.fsmStatus = "READY";
        process.send({op: "STATS", childId: configuration.childId, data: statsObj});
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

        reporter(event, oldState, newState);
        statsObj.fsmStatus = "CONFIG_EVOLVE";
        process.send({op: "STATS", childId: configuration.childId, data: statsObj});

        if (!statsObj.trainingSetReady) {
          await loadTrainingSet();
        }
        else {
          console.log(chalkLog(MODULE_ID_PREFIX + " | --- TRAINING SET UNCHANGED ... SKIP LOAD"));
        }

        if (configuration.testMode) {
          trainingSetObj.data.length = Math.min(trainingSetObj.data.length, TEST_MODE_LENGTH);
          testSetObj.data.length = parseInt(configuration.testSetRatio * trainingSetObj.data.length);
          trainingSetObj.meta.setSize = trainingSetObj.data.length;
          testSetObj.meta.setSize = testSetObj.data.length;
        }

        fsm.fsm_evolve();
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

        reporter(event, oldState, newState);
        statsObj.fsmStatus = "EVOLVE";
        process.send({op: "STATS", childId: configuration.childId, data: statsObj});

        try {

          const networkObj = await evolve(evolveOptions);

          networkObj.evolve.options = pick(
            networkObj.evolve.options, 
            ["clear", "cost", "activation", "growth", "equal", "mutationRate", "popsize", "elitism"]
          );

          process.send({op: "EVOLVE_COMPLETE", childId: configuration.childId, networkObj: networkObj, statsObj: statsObj});

          fsm.fsm_evolve_complete();

        }
        catch(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR: " + err));
          console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR\ninputsObj\n" + jsonPrint(evolveOptions.inputsObj.meta)));
          console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR\ntrainingSet\n" + jsonPrint(evolveOptions.trainingSetObj.meta)));
          console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR\ntestSet\n" + jsonPrint(evolveOptions.testSetObj.meta)));
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
    "fsm_evolve_complete": "EVOLVE_COMPLETE"
  },

  "EVOLVE_COMPLETE": {

    onEnter: function(event, oldState, newState) {

      if (event !== "fsm_tick") {

        reporter(event, oldState, newState);

        statsObj.fsmStatus = "EVOLVE_COMPLETE";

        process.send({op: "STATS", childId: configuration.childId, data: statsObj});

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

process.on("message", function(m) {

  if (configuration.verbose) { console.log(chalkLog(MODULE_ID_PREFIX + " | CHILD RX MESSAGE | OP: " + m.op)); }

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
      ));
      configuration.verbose = m.verbose;
    break;

    case "INIT":
      console.log(chalkInfo(MODULE_ID_PREFIX + " | INIT"
        + " | CHILD ID: " + m.childId
      ));
      configuration.childId = m.childId;
      configuration.childIdShort = m.childIdShort;
      statsObj.childId = m.childId;
      statsObj.childIdShort = m.childIdShort;
      process.title = m.childId;
      process.name = m.childId;
      configuration.inputsBinaryMode = m.inputsBinaryMode || DEFAULT_INPUTS_BINARY_MODE;
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
      ));

      configuration.childId = m.childId;

      maxInputHashMap = m.maxInputHashMap;

      statsObj.training.startTime = moment().valueOf();
      statsObj.training.testRunId = m.testRunId;
      statsObj.training.seedNetworkId = m.seedNetworkId;
      statsObj.training.seedNetworkRes = m.seedNetworkRes;
      statsObj.training.iterations = m.iterations;

      statsObj.inputsId = m.inputsId;
      statsObj.inputsObj = {};
      statsObj.inputsObj = m.inputsObj;
      statsObj.outputs = {};
      statsObj.outputs = m.outputs;

      statsObj.normalization = {};
      statsObj.normalization = m.normalization;

      evolveOptions = {
        runId: m.testRunId,
        threads: m.threads,
        networkTechnology: m.networkTechnology,
        architecture: m.architecture,
        seedNetworkId: m.seedNetworkId,
        seedNetworkRes: m.seedNetworkRes,
        inputsId: m.inputsId,
        inputsObj: m.inputsObj,
        outputs: m.outputs,
        // trainingSet: m.trainingSet,
        // testSetObj: m.testSetObj,
        mutation: m.mutation,
        equal: m.equal,
        popsize: m.popsize,
        elitism: m.elitism,
        log: m.log,
        error: m.error,
        iterations: m.iterations,
        mutationRate: m.mutationRate,
        cost: m.cost,
        activation: m.activation,
        growth: m.growth,
        clear: m.clear
      };

      statsObj.evolve.options = {};

      statsObj.evolve.options = {
        networkTechnology: m.networkTechnology,
        threads: m.threads,
        seedNetworkId: m.seedNetworkId,
        seedNetworkRes: m.seedNetworkRes,
        architecture: m.architecture,
        mutation: m.mutation,
        mutationRate: m.mutationRate,
        equal: m.equal,
        cost: m.cost,
        activation: m.activation,
        clear: m.clear,
        error: m.error,
        popsize: m.popsize,
        growth: m.growth,
        elitism: m.elitism,
        iterations: m.iterations,
        log: m.log
      };

      if (m.networkObj && (m.networkObj !== undefined)) {

        evolveOptions.networkObj = m.networkObj;
        statsObj.evolve.options.networkObj = m.networkObj;

        console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE | " + getTimeStamp()
          + " | " + configuration.childId
          + " | " + m.testRunId
          + " | TECH: " + m.networkTechnology
          + "\n SEED: " + m.seedNetworkId
          + " | SEED RES %: " + m.seedNetworkRes.toFixed(2)
          + "\n THREADs: " + m.threads
          + "\n NET: " + m.networkObj.networkId + " | " + m.networkObj.successRate.toFixed(2) + "%"
          // + "\n TRAINING SET: " + m.trainingSet.meta.setSize
          + " | ITRS: " + statsObj.training.iterations
        ));
      }
      else {
        console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE | " + getTimeStamp()
          + " | " + configuration.childId
          + " | " + m.testRunId
          + " | TECH: " + m.networkTechnology
          + "\n SEED: " + "---"
          + " | SEED RES %: " + "---"
          + "\n THREADs: " + m.threads
          // + "\n TRAINING SET: " + m.trainingSet.meta.setSize
          + " | ITRS: " + statsObj.training.iterations
        ));
      }

      fsm.fsm_config_evolve();
    break;

    case "EVOLVE":
      console.log(chalkInfo(MODULE_ID_PREFIX + " | EVOLVE"
        + " | CHILD ID: " + m.childId
      ));
      configuration.childId = m.childId;

      fsm.fsm_evolve();
    break;

    case "STATS":
      showStats();
      process.send({op: "STATS", childId: configuration.childId, data: statsObj});
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
      process.send({op: "PONG", pingId: m.pingId, childId: configuration.childId, data: statsObj});
    break;

    default:
      console.log(chalkError(MODULE_ID_PREFIX + " | UNKNOWN OP ERROR | " + m.op ));
  }
});


setTimeout(async function(){

  try {

    const cnf = await initConfig(configuration);
    configuration = deepcopy(cnf);

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

    initFsmTickInterval(FSM_TICK_INTERVAL);

    try {
      await connectDb();
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECT ERROR: " + err + " | QUITTING ***"));
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
