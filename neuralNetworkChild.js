 /*jslint node: true */
/*jshint sub:true*/
"use strict";

let quitOnCompleteFlag = false;

const DEFAULT_INPUTS_BINARY_MODE = true;

const TEST_MODE = false; // applies only to parent
const QUIT_ON_COMPLETE = false;

const MODULE_NAME = "tncChild";
const MODULE_ID_PREFIX = "TNC";

const ONE_SECOND = 1000 ;
const ONE_MINUTE = ONE_SECOND*60 ;

const ONE_KILOBYTE = 1024;
const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;

const KEEPALIVE_INTERVAL = ONE_MINUTE;
const QUIT_WAIT_INTERVAL = ONE_SECOND;
const STATS_UPDATE_INTERVAL = 30*ONE_SECOND;

const SAVE_CACHE_DEFAULT_TTL = 60;
const SAVE_FILE_QUEUE_INTERVAL = ONE_SECOND;

const DROPBOX_MAX_SAVE_NORMAL = 20 * ONE_MEGABYTE;
const DROPBOX_LIST_FOLDER_LIMIT = 50;
const DROPBOX_TIMEOUT = 30 * ONE_SECOND;

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const NUM_RANDOM_NETWORKS = 100;
const IMAGE_QUOTA_TIMEOUT = 60000;

const DEFAULT_FORCE_INIT_RANDOM_NETWORKS = true;
const OFFLINE_MODE = false;

//=========================================================================
// MODULE REQUIRES
//=========================================================================
const neataptic = require("neataptic");

let network;

const os = require("os");
const _ = require("lodash");
const moment = require("moment");
const defaults = require("object.defaults");
const pick = require("object.pick");
const treeify = require("treeify");
const objectPath = require("object-path");
const fetch = require("isomorphic-fetch"); // or another library of choice.
const NodeCache = require("node-cache");
const merge = require("deepmerge");
const MergeHistograms = require("@threeceelabs/mergehistograms");
const mergeHistograms = new MergeHistograms();
const arrayNormalize = require("array-normalize");

const writeJsonFile = require("write-json-file");
const sizeof = require("object-sizeof");

const fs = require("fs");
const JSONParse = require("json-parse-safe");
const debug = require("debug")("tfe");
const util = require("util");
const deepcopy = require("deep-copy");
const randomItem = require("random-item");
const async = require("async");
const omit = require("object.omit");
const HashMap = require("hashmap").HashMap;

const chalk = require("chalk");
const chalkConnect = chalk.green;
const chalkNetwork = chalk.blue;
const chalkBlueBold = chalk.blue.bold;
const chalkTwitter = chalk.blue;
const chalkTwitterBold = chalk.bold.blue;
const chalkBlue = chalk.blue;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;

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

const MODULE_ID = MODULE_ID_PREFIX + "_" + hostname;

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

let configuration = {};

configuration.inputsBinaryMode = DEFAULT_INPUTS_BINARY_MODE;
configuration.testMode = TEST_MODE;
configuration.statsUpdateIntervalTime = STATS_UPDATE_INTERVAL;

configuration.slackChannel = {};

configuration.keepaliveInterval = KEEPALIVE_INTERVAL;
configuration.quitOnComplete = QUIT_ON_COMPLETE;

let evolveOptions = {};

function initConfig(cnf) {

  return new Promise(async function(resolve, reject){

    statsObj.status = "INIT CONFIG";

    if (debug.enabled) {
      console.log("\nTFE | %%%%%%%%%%%%%%\nTFE |  DEBUG ENABLED \nTFE | %%%%%%%%%%%%%%\n");
    }

    cnf.processName = process.env.PROCESS_NAME || MODULE_ID;
    cnf.testMode = (process.env.TEST_MODE === "true") ? true : cnf.testMode;
    cnf.quitOnError = process.env.QUIT_ON_ERROR || false ;

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
      
      resolve(configuration) ;

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** CONFIG LOAD ERROR: " + err ));
      reject(err);
    }

  });
}

function init(params){
  return new Promise(async function(resolve, reject){
    statsObj.status = "INIT";
    resolve();
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
          // slackSendMessage(hostname + " | TFE | " + statsObj.status);
          dbConnectionReady = false;
          quit({cause: "MONGO DB ERROR: " + err});
          return reject(err);
        }

        db.on("error", async function(){
          statsObj.status = "MONGO ERROR";
          console.error.bind(console, MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR");
          console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR"));
          // slackSendMessage(hostname + " | TFE | " + statsObj.status);
          db.close();
          dbConnectionReady = false;
          quit({cause: "MONGO DB ERROR: " + err});
        });

        db.on("disconnected", async function(){
          statsObj.status = "MONGO DISCONNECTED";
          console.error.bind(console, MODULE_ID_PREFIX + " | *** MONGO DB DISCONNECTED");
          // slackSendMessage(hostname + " | TFE | " + statsObj.status);
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
          // slackSendMessage(hostname + " | TFE | " + statsObj.status);

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
//=========================================================================
// STATS
//=========================================================================

let startTimeMoment = moment();

let statsObj = {};
let statsObjSmall = {};

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
statsObj.training.startTime;
statsObj.training.testRunId;
statsObj.training.seedNetworkId;
statsObj.training.seedNetworkRes;
statsObj.training.iterations;

statsObj.inputsId
statsObj.inputsObj = {};
statsObj.outputs = {};

statsObj.normalization = {};

let statsPickArray = [
  "pid", 
  "startTime", 
  "elapsed", 
  "elapsedMS", 
  "status"
];

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

// ==================================================================
// DROPBOX
// ==================================================================
const Dropbox = require("dropbox").Dropbox;

configuration.DROPBOX = {};

configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
configuration.DROPBOX.DROPBOX_CONFIG_FILE = process.env.DROPBOX_CONFIG_FILE || MODULE_NAME + "Config.json";
configuration.DROPBOX.DROPBOX_STATS_FILE = process.env.DROPBOX_STATS_FILE || MODULE_NAME + "Stats.json";

const dropboxConfigFolder = "/config/utility";
const dropboxConfigDefaultFolder = "/config/utility/default";
const dropboxConfigHostFolder = "/config/utility/" + hostname;

const dropboxConfigDefaultFile = "default_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;
const dropboxConfigHostFile = hostname + "_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;

let statsFolder = "/stats/" + hostname;
let statsFile = configuration.DROPBOX.DROPBOX_STATS_FILE;

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
          return reject(err);
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

            return resolve(fileObj.value);
          }

          console.log(chalkError(getTimeStamp()
            + " | *** LOAD FILE FROM DROPBOX ERROR"
            + " | " + fullPath
            + " | " + fileObj.error
          ));

          return reject(fileObj.error);

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

        if (params.file.match(/\.json$/gi)) {

          let payload = data.fileBinary;

          if (!payload || (payload === undefined)) {
            return reject(new Error(MODULE_ID_PREFIX + " LOAD FILE PAYLOAD UNDEFINED"));
          }

          const fileObj = JSONParse(payload);

          if (fileObj.value) {
            return resolve(fileObj.value);
          }

          console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX loadFile ERROR: " + fullPath));
          return reject(fileObj.error);
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

        reject(error);

      });
    }
  });
}

function loadFileRetry(params){

  return new Promise(async function(resolve, reject){

    let resolveOnNotFound = params.resolveOnNotFound || false;
    let maxRetries = params.maxRetries || 5;
    let retryNumber;

    for (retryNumber = 0; retryNumber < maxRetries; retryNumber++) {
      try {
        
        if (retryNumber > 0) { 
          console.log(chalkAlert(MODULE_ID_PREFIX + " | FILE LOAD RETRY"
            + " | " + folder + "/" + file
            + " | " + retryNumber + " OF " + maxRetries
          )); 
        }

        const fileObj = await loadFile(params);
        return resolve(fileObj);
        break;
      } 
      catch(err) {
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
                console.trace(chalkError("TXX | *** DROPBOX filesListFolderContinue ERROR: ", err));
                return reject(err);
              });

              async.setImmediate(function() { cb(); });

            }, 1000);
          },

          function(err){
            if (err) {
              console.log(chalkError("TXX | DROPBOX LIST FOLDERS: " + err + "\n" + jsonPrint(err)));
              return reject(err);
            }
            resolve(results);
          });
      })
      .catch(function(err){
        console.log(chalkError("TXX | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
        return reject(err);
      });

    }
    catch(err){
      console.log(chalkError("TXX | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
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

      configuration = tempConfig;

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

  debug(chalkInfo("LOAD FOLDER " + params.folder));
  debug(chalkInfo("LOAD FILE " + params.file));
  debug(chalkInfo("FULL PATH " + fullPath));

  let options = {};

  if (params.localFlag) {

    const objSizeMBytes = sizeof(params.obj)/ONE_MEGABYTE;

    showStats();
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
          console.error(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: 413"
            + " | ERROR: FILE TOO LARGE"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else if (error.status === 429){
          console.error(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: TOO MANY WRITES"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else if (error.status === 500){
          console.error(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: DROPBOX SERVER ERROR"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else {
          console.trace(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: " + error
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
const DEFAULT_QUIT_ON_COMPLETE = true;

let quitWaitInterval;
let quitFlag = false;

function readyToQuit(params) {
  let flag = true; // replace with function returns true when ready to quit
  return flag;
}

async function quit(opts) {

  let options = opts || {};

  statsObj.elapsed = getElapsedTimeStamp();
  statsObj.timeStamp = getTimeStamp();
  statsObj.status = "QUIT";

  const forceQuitFlag = options.force || false;

  quitFlag = true;

  fsm.fsm_exit();

  if (options) {
    console.log(MODULE_ID_PREFIX + " | QUIT INFO\n" + jsonPrint(options) );
  }

  showStats(true);

  process.send({op:"QUIT", childId: configuration.childId, data: statsObj});

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

      process.exit();
 
    }

  }, QUIT_WAIT_INTERVAL);
};


//=========================================================================
// EVOLVE
//=========================================================================
function testNetwork(params){

  return new Promise(async function(resolve, reject){

    let networkObj = params.networkObj;
    let testSet = params.testSet;
    let maxInputHashMap = params.maxInputHashMap;

    console.log(chalkBlue("NNC | TEST NETWORK"
      + " | TEST SET ID: " + params.testSet.meta.testSetId
      + " | NETWORK ID: " + networkObj.networkId
      + " | " + params.testSet.meta.setSize + " TEST META DATA POINTS"
      + " | " + params.testSet.data.length + " TEST DATA LENGTH"
    ));

    const nw = neataptic.Network.fromJSON(networkObj.network);

    let numTested = 0;
    let numSkipped = 0; 
    let numPassed = 0;
    let successRate = 0;
    let testResultArray = [];

    let convertDatumParams = {};
    convertDatumParams.normalization = statsObj.normalization;
    convertDatumParams.maxInputHashMap = maxInputHashMap;

    let shuffledTestData = _.shuffle(params.testSet.data);

    async.each(shuffledTestData, async function(datum){

      try {

        // console.log(chalkLog(MODULE_ID_PREFIX
        //  + " | IN: " + networkObj.inputsObj.inputsId
        //  + " | @" + datum.screenName
        //  // + "\ndatum\n" + jsonPrint(datum)
        // ));

        let testDatumObj = await convertDatum({datum: datum, inputsObj: networkObj.inputsObj, generateInputRaw: false});
        let testOutput = await activateNetwork({network: nw, input: testDatumObj.input});
        let testMaxOutputIndex = await indexOfMax(testOutput);
        let expectedMaxOutputIndex = await indexOfMax(testDatumObj.output);

        debug("INDEX OF MAX TEST OUTPUT: " + expectedMaxOutputIndex);

        let passed = (testMaxOutputIndex === expectedMaxOutputIndex);

        numTested += 1;

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
          + " | " + testOutput[0]
          + " " + testOutput[1]
          + " " + testOutput[2]
          + " | TMOI: " + testMaxOutputIndex
          + " | " + testDatumObj.output[0]
          + " " + testDatumObj.output[1]
          + " " + testDatumObj.output[2]
          + " | EMOI: " + expectedMaxOutputIndex
        ));

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
        testSetId: params.testSet.meta.testSetId, 
        numTests: params.testSet.meta.setSize, 
        numSkipped: numSkipped, 
        numPassed: numPassed, 
        successRate: successRate
      };

      debug(chalkNetwork(MODULE_ID_PREFIX
        + " | TEST RESULTS\n" + jsonPrint(testResults)
      ));

      resolve(testResults);

    });

  });

}

function convertDatum(params){

  let datum = params.datum;
  let generateInputRaw = params.generateInputRaw;

    // console.log(chalkLog(MODULE_ID_PREFIX
    //  + " | IN: " + params.inputsObj.inputsId
    //  + " | @" + datum.screenName
    //  // + "\ndatum\n" + jsonPrint(datum)
    // ));

  return new Promise(async function(resolve, reject){

    try {

      const inputTypes = Object.keys(params.inputsObj.inputs).sort();

      let mergedHistograms = await mergeHistograms.merge({ histogramA: datum.tweetHistograms, histogramB: datum.profileHistograms });

      let convertedDatum = {};

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
        case "default":
        convertedDatum.output = [0, 0, 0];
        break;
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
          else if (mergedHistograms[inputType] && (mergedHistograms[inputType] !== undefined) && (mergedHistograms[inputType][inputName] !== undefined)){

            if (configuration.inputsBinaryMode) {
              convertedDatum.input.push(1);
            }
            else if ((params.trainingSet.maxInputHashMap === undefined) 
              || (params.trainingSet.maxInputHashMap[inputType] === undefined)) {
              debug(chalkAlert("UNDEFINED??? params.trainingSet.maxInputHashMap." + inputType + " | " + inputName));
              convertedDatum.input.push(1);
            }
            else {
              const inputValue = (
                params.trainingSet.maxInputHashMap[inputType] 
                && params.trainingSet.maxInputHashMap[inputType][inputName] 
                && (params.trainingSet.maxInputHashMap[inputType][inputName] > 0)
              ) 
                ? mergedHistograms[inputType][inputName]/params.trainingSet.maxInputHashMap[inputType][inputName] 
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

    let network = params.network;
    let trainingSet = params.trainingSet;
    let options = params.options;

    let results;

    try {
      results = await network.evolve(trainingSet, options);
    }
    catch(err){
      return reject(err);
    }

    results.threads = options.threads;

    statsObj.evolve.endTime = moment().valueOf();
    statsObj.evolve.elapsed = moment().valueOf() - statsObj.evolve.startTime;
    statsObj.evolve.results = results;

    let exportedNetwork = network.toJSON();

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


      const defaultResults = {
        error: 0,
        iterations: 0
      };

      let networkObj = {};
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

    let trainingSet = [];
    let inputRaw = [];
    let generateInputRaw = true;
    
    console.log(chalkLog(MODULE_ID_PREFIX
      + " | TRAINING SET PREP"
      + " | DATA LENGTH: " + params.trainingSet.data.length
    ));

    const shuffledTrainingData = _.shuffle(params.trainingSet.data);

    async.eachSeries(shuffledTrainingData, async function(datum){

      try {
        let datumObj = await convertDatum({datum: datum, inputsObj: params.inputsObj, generateInputRaw: generateInputRaw});

        if (datumObj.inputRaw.length > 0) { 
          generateInputRaw = false;
          inputRaw = datumObj.inputRaw;
        }

        trainingSet.push({ 
          input: datumObj.input, 
          output: datumObj.output
        });

        async.setImmediate(function() { return; });
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

      resolve(trainingSet);

    });

  });
}

function evolve(params){

  return new Promise(function(resolve, reject){

    debug("evolve params.network\n" + jsonPrint(params.network));

    if (params.architecture === undefined) { params.architecture = "random"; }

    let options = {};

    if ((params.network !== undefined) && params.networkObj) {
      options.networkObj = params.networkObj;
      params.architecture = "loadedNetwork";
      debug(chalkAlert("NNC | START NETWORK DEFINED: " + options.networkObj.networkId));
    }

    options.threads = params.threads;
    options.elitism = params.elitism;
    options.equal = params.equal;
    options.error = params.error;
    options.iterations = params.iterations;
    options.mutation = neataptic.methods.mutation.FFW;
    options.mutationRate = params.mutationRate;
    options.popsize = params.popsize;
    options.growth = params.growth;

    let schedStartTime = moment().valueOf();

    statsObj.evolve.startTime = moment().valueOf();
    statsObj.evolve.elapsed = 0;
    statsObj.evolve.stats = {};

    options.schedule = {
      function: function(schedParams){

        let elapsedInt = moment().valueOf() - schedStartTime;
        let iterationRate = elapsedInt/schedParams.iteration;
        let iterationRateSec = iterationRate/1000.0;
        let timeToComplete = iterationRate*(params.iterations - schedParams.iteration);

        statsObj.evolve.stats = schedParams;

        const sObj = {
          networkId: params.runId,
          evolveStart: schedStartTime,
          evolveElapsed: elapsedInt,
          totalIterations: params.iterations,
          iteration: schedParams.iteration,
          iterationRate: iterationRate,
          timeToComplete: timeToComplete,
          error: schedParams.error.toFixed(5) || "---",
          fitness: schedParams.fitness.toFixed(5) || "---"
        };

        process.send({op: "EVOLVE_SCHEDULE", childId: configuration.childId, stats: sObj});

        function schedMsToTime(duration) {
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

        debug("NNC | EVOLVE"
          + " | " + configuration.childId
          + " | IN: " + params.inputsObj.meta.numInputs
          + " | S: " + moment(schedStartTime).format(compactDateTimeFormat)
          + " | R: " + schedMsToTime(elapsedInt)
          + " | RATE: " + iterationRateSec.toFixed(1) + " s/I"
          + " | ETC: " + schedMsToTime(timeToComplete)
          + " | ETC: " + moment().add(timeToComplete).format(compactDateTimeFormat)
          + " | I: " + schedParams.iteration + " / " + params.iterations
          + " | F: " + schedParams.fitness.toFixed(5)
          + " | E: " + schedParams.error.toFixed(5)
        );
      },
      
      iterations: params.log
    };

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
          options.cost = neataptic.methods.cost[params[key]];
        break;

        default:
          if ((key !== "log") && (key !== "trainingSet")){
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

          network = neataptic.Network.fromJSON(options.networkObj.network);

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

          network = new neataptic.architect.Perceptron(
            params.trainingSet.meta.numInputs, 
            params.hiddenLayerSize,
            params.trainingSet.meta.numOutputs
          );

        break;

        default:

          console.log("NNC | EVOLVE ARCH"
            + " | " + configuration.childId
            + " | " + params.architecture.toUpperCase()
            + " | INPUTS: " + params.inputsObj.meta.numInputs
            + " | OUTPUTS: " + params.trainingSet.meta.numOutputs
          );

          network = new neataptic.Network(
            params.inputsObj.meta.numInputs, 
            3
          );

        }

        params.network = network; // network evolve options
        params.options = options; // network evolve options

        try {
          params.trainingSet = await trainingSetPrep(params);

          networkObj = await networkEvolve(params);

          params.networkObj = networkObj;

          testResults = await testNetwork(params);

          networkObj.successRate = testResults.successRate;
          networkObj.test = {};
          networkObj.test.results = {};
          networkObj.test.results = testResults;

          return resolve(networkObj);
        }
        catch(err){
          return reject(err);
        }

    });

  });
}

function activateNetwork(params){
  return new Promise(function(resolve, reject){
    try {
      let output;
      output = params.network.activate(params.input);
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

let fsm;
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

  "RESET":{

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

  "IDLE":{
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

  "EXIT":{
    onEnter: function(event, oldState, newState) {
      reporter(event, oldState, newState);
      statsObj.fsmStatus = "EXIT";
    }
  },

  "ERROR":{
    onEnter: function(event, oldState, newState) {
      reporter(event, oldState, newState);

      statsObj.fsmStatus = "ERROR";

      quit("FSM ERROR");
    }
  },

  "INIT":{
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
        process.send({op:"STATS", childId: configuration.childId, data: statsObj});
      }
    },
    fsm_tick: function() {
    },
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR",
    "fsm_ready": "READY",
    "fsm_reset": "RESET"
  },

  "READY":{
    onEnter: function(event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
        statsObj.fsmStatus = "READY";
        process.send({op:"STATS", childId: configuration.childId, data: statsObj});
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

  "CONFIG_EVOLVE":{
    onEnter: function(event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
        statsObj.fsmStatus = "CONFIG_EVOLVE";
        process.send({op:"STATS", childId: configuration.childId, data: statsObj});
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

  "EVOLVE":{
    onEnter: async function(event, oldState, newState) {
      if (event !== "fsm_tick") {

        reporter(event, oldState, newState);
        statsObj.fsmStatus = "EVOLVE";
        process.send({op:"STATS", childId: configuration.childId, data: statsObj});

        try {

          let networkObj = await evolve(evolveOptions);

          networkObj.evolve.options = pick(networkObj.evolve.options, ["clear", "cost", "growth", "equal", "mutationRate", "popsize", "elitism"]);

          process.send({op:"EVOLVE_COMPLETE", childId: configuration.childId, networkObj: networkObj, statsObj: statsObj});

          fsm.fsm_evolve_complete();

        }
        catch(err){
          console.log(MODULE_ID_PREFIX + " | *** EVOLVE ERROR: " + err);
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

  "EVOLVE_COMPLETE":{

    onEnter: function(event, oldState, newState) {

      if (event !== "fsm_tick") {

        reporter(event, oldState, newState);

        statsObj.fsmStatus = "EVOLVE_COMPLETE";

        process.send({op:"STATS", childId: configuration.childId, data: statsObj});

        if (configuration.quitOnComplete) {
          console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE COMPLETE | QUITTING ..."));
          quit({cause:"QUIT_ON_COMPLETE"});
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

fsm = Stately.machine(fsmStates);

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
  +    MODULE_ID_PREFIX + " | " + MODULE_ID + " STARTED | " + getTimeStamp()
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

    case "INIT":
      console.log(chalkInfo(MODULE_ID_PREFIX + " | INIT"
        + " | CHILD ID: " + m.childId
      ));
      configuration.childId = m.childId;
      statsObj.childId = m.childId;
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
        architecture: m.architecture,
        seedNetworkId: m.seedNetworkId,
        seedNetworkRes: m.seedNetworkRes,
        inputsId: m.inputsId,
        inputsObj: m.inputsObj,
        outputs: m.outputs,
        trainingSet: m.trainingSet,
        testSet: m.testSet,
        mutation: m.mutation,
        equal: m.equal,
        popsize: m.popsize,
        elitism: m.elitism,
        log: m.log,
        error: m.error,
        iterations: m.iterations,
        mutationRate: m.mutationRate,
        cost: m.cost,
        growth: m.growth,
        clear: m.clear
      };

      statsObj.evolve.options = {};

      statsObj.evolve.options = {
        threads: m.threads,
        seedNetworkId: m.seedNetworkId,
        seedNetworkRes: m.seedNetworkRes,
        architecture: m.architecture,
        mutation: m.mutation,
        mutationRate: m.mutationRate,
        equal: m.equal,
        cost: m.cost,
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
          + "\n SEED: " + m.seedNetworkId
          + " | SEED RES %: " + m.seedNetworkRes.toFixed(2)
          + "\n THREADs: " + m.threads
          + "\n NET: " + m.networkObj.networkId + " | " + m.networkObj.successRate.toFixed(2) + "%"
          + "\n TRAINING SET: " + m.trainingSet.meta.setSize
          + " | ITRS: " + statsObj.training.iterations
        ));
      }
      else {
        console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE | " + getTimeStamp()
          + " | " + configuration.childId
          + " | " + m.testRunId
          + "\n SEED: " + "---"
          + " | SEED RES %: " + "---"
          + "\n THREADs: " + m.threads
          + "\n TRAINING SET: " + m.trainingSet.meta.setSize
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

      // evolve(evolveOptions, function(err, networkObj){

      //   networkObj.evolve.options = pick(networkObj.evolve.options, ["clear", "cost", "growth", "equal", "mutationRate", "popsize", "elitism"]);

      //   if (err) {
      //     console.error(chalkError("NNC | EVOLVE ERROR: " + err));
      //     console.trace("NNC | EVOLVE ERROR");
      //     process.send({op: "ERROR", childId: configuration.childId, error: err});
      //     showStats();
      //   }
      //   else {
      //     process.send({op:"EVOLVE_COMPLETE", childId: configuration.childId, networkObj: networkObj, statsObj: statsObj});
      //   }
      // });

      fsm.fsm_evolve();
    break;

    case "STATS":
      showStats();
      process.send({op:"STATS", childId: configuration.childId, data: statsObj});
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
      process.send({op:"PONG", pingId: m.pingId, childId: configuration.childId, data: statsObj});
    break;

    default:
      console.log(chalkError(MODULE_ID_PREFIX + " | UNKNOWN OP ERROR | " + m.op ));
  }
});


setTimeout(async function(){

  try {

    let cnf = await initConfig(configuration);
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
      quit({cause: new Error("INIT CONFIG ERROR")});
    }
  }
}, 1000);