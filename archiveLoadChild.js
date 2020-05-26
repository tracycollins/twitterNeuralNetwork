const MODULE_NAME = "archiveLoadChild";
let MODULE_ID_PREFIX = "ALC";

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const os = require("os");
const _ = require("lodash");
const fs = require("fs");
const yauzl = require("yauzl");
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

const MODULE_ID = MODULE_ID_PREFIX + "_" + hostname;
const PRIMARY_HOST = process.env.PRIMARY_HOST || "mms1";
const HOST = (hostname === PRIMARY_HOST) ? "default" : "local";

global.wordAssoDb = require("@threeceelabs/mongoose-twitter");

let DROPBOX_ROOT_FOLDER;

if (hostname === "google") {
  DROPBOX_ROOT_FOLDER = "/home/tc/Dropbox/Apps/wordAssociation";
}
else {
  DROPBOX_ROOT_FOLDER = "/Users/tc/Dropbox/Apps/wordAssociation";
}

const configDefaultFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility/default");
// const configHostFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility",hostname);

let configuration = {};

configuration.default = {};
configuration.default.trainingSetsFolder = configDefaultFolder + "/trainingSets";
configuration.default.userArchiveFolder = configDefaultFolder + "/trainingSets/users";

configuration.trainingSetsFolder = configuration.default.trainingSetsFolder;
configuration.userArchiveFolder = configuration.default.userArchiveFolder;
configuration.defaultUserArchiveFlagFile = "usersZipUploadComplete.json";

const ThreeceeUtilities = require("@threeceelabs/threecee-utilities");
const tcUtils = new ThreeceeUtilities("ALC_TCU");

const NeuralNetworkTools = require("@threeceelabs/neural-network-tools");
const nnTools = new NeuralNetworkTools("ALC_NNT");

const CONSTANTS = tcUtils.constants;
const msToTime = tcUtils.msToTime;
const jsonPrint = tcUtils.jsonPrint;
const getTimeStamp = tcUtils.getTimeStamp;
const formatBoolean = tcUtils.formatBoolean;
const formatCategory = tcUtils.formatCategory;

const QUIT_WAIT_INTERVAL = CONSTANTS.ONE_SECOND;


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
const pick = require("object.pick");
const debug = require("debug")("tfe");
const util = require("util");
const deepcopy = require("deep-copy");

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

//=========================================================================
// STATS
//=========================================================================

const startTimeMoment = moment();

const statsObj = {};

statsObj.archiveFile = "";

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

// function processSend(message){
//   return new Promise(function(resolve, reject){

//     if (configuration.verbose){
//       console.log(chalkGreen(MODULE_ID_PREFIX 
//         + " | >T MESSAGE | " + getTimeStamp() 
//         + " | OP: " + message.op
//       )); 
//     }

//     try{
//       process.send(message);
//     }
//     catch(err){
//       return reject(err);
//     }

//     resolve();
//   });
// }

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

  if (options) {
    console.log(MODULE_ID_PREFIX + " | QUIT INFO\n" + jsonPrint(options) );
  }

  showStats(true);

  // await processSend({op: "QUIT", childId: configuration.childId});

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

function unzipUsers(params){

  console.log(chalkBlue(MODULE_ID_PREFIX + " | UNZIP USERS | " + params.path));

  return new Promise(function(resolve, reject) {

    try {

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
                    console.log(chalkLog(MODULE_ID_PREFIX + " | ... SKIP MAX INPUT"));
                    zipfile.readEntry();
                  }
                  else {

                    statsObj.users.unzipped += 1;

                    if ((userObj.category === "left") || (userObj.category === "right") || (userObj.category === "neutral")) {

                      let dbUser = await global.wordAssoDb.User.findOne({nodeId: userObj.nodeId});

                      if (dbUser) {
                        if (dbUser.category !== userObj.category) {
                          console.log(chalkLog(MODULE_ID_PREFIX + " | DB CAT CHANGE"
                            + " | " + formatCategory(dbUser.category) + " -> " + formatCategory(userObj.category)
                            + " | NID: " + dbUser.nodeId
                            + " | @" + dbUser.screenName
                          ));

                          dbUser.category = userObj.category;
                          await dbUser.save();
                        }
                      }
                      else{
                        console.log(chalkAlert(MODULE_ID_PREFIX + " | DB USER MISS"
                          + " | CAT M: " + formatCategory(userObj.category)
                          + " | NID: " + userObj.nodeId
                          + " | @" + userObj.screenName
                        ));

                        dbUser = new global.wordAssoDb.User(userObj);
                        try{
                          await dbUser.save();
                        }
                        catch(e){
                          console.log(chalkError(MODULE_ID_PREFIX + " | *** DB SAVE ERROR: " + err));
                        }
                      }

                      if ((configuration.testMode && (statsObj.users.unzipped % 100 === 0)) || configuration.verbose || (statsObj.users.unzipped % 1000 === 0)) {

                        console.log(chalkLog(MODULE_ID_PREFIX + " | UNZIP"
                          + " [" + statsObj.users.unzipped + "]"
                          + " | " + dbUser.nodeId
                          + " | @" + dbUser.screenName
                          + " | " + dbUser.name
                          + " | FLWRs: " + dbUser.followersCount
                          + " | FRNDs: " + dbUser.friendsCount
                          + " | FRNDs DB: " + dbUser.friends.length
                          + " | CAT M: " + dbUser.category + " A: " + dbUser.categoryAuto
                        ));
                      }

                      zipfile.readEntry();
                    }
                    else{
                      console.log(chalkAlert(MODULE_ID_PREFIX + " | ??? UNCAT UNZIPPED USER"
                        + " [" + statsObj.users.unzipped + "]"
                        + " | " + userObj.nodeId
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

let existsInterval;

function waitFileExists(params){

  return new Promise(function(resolve, reject){

    clearInterval(existsInterval);

    const interval = params.interval || 5*CONSTANTS.ONE_MINUTE;
    const maxWaitTime = params.maxWaitTime || configuration.userArchiveFileExistsMaxWaitTime;

    const endWaitTimeMoment = moment().add(maxWaitTime, "ms");

    let exists = fs.existsSync(params.path);

    if (exists) {

      console.log(chalkLog(MODULE_ID_PREFIX
        + " | FILE EXISTS"
        + " | NOW: " + getTimeStamp()
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

    const interval = params.interval || 10*CONSTANTS.ONE_SECOND;

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

// async function loadUsersArchive(params){

//   try {

//     let file = params.archiveFlagObj.file;

//     if (configuration.testMode) {
//       file = file.replace(/users\.zip/, "users_test.zip");
//     }

//     params.archiveFlagObj.folder = params.archiveFlagObj.folder || configuration.userArchiveFolder;
//     params.archiveFlagObj.path = (params.archiveFlagObj.path !== undefined) ? params.archiveFlagObj.path : params.archiveFlagObj.folder + "/" + file;

//     console.log(chalkLog(MODULE_ID_PREFIX 
//       + " | LOADING USERS ARCHIVE"
//       + " | " + getTimeStamp() 
//       + "\n PATH:   " + params.archiveFlagObj.path
//       + "\n FOLDER: " + params.archiveFlagObj.folder
//       + "\n FILE:   " + file
//     ));

//     console.log(chalkLog(MODULE_ID_PREFIX 
//       + " | USER ARCHIVE FILE | FILE: " + params.archiveFlagObj.file 
//       + " | SIZE: " + params.archiveFlagObj.size
//       + " | TOTAL USERS: " + params.archiveFlagObj.histograms.total
//       + " | CAT: L/N/R: " + params.archiveFlagObj.histograms.left 
//       + "/" + params.archiveFlagObj.histograms.neutral 
//       + "/" + params.archiveFlagObj.histograms.right
//     ));

//     // defaultUserArchiveFlagFile
//     // {
//     //   "file": "google_20200211_130922_users.zip",
//     //   "size": 1109751363,
//     //   "histogram": {
//     //     "left": 25157,
//     //     "right": 25159,
//     //     "neutral": 1981,
//     //     "positive": 0,
//     //     "negative": 0,
//     //     "none": 0,
//     //     "total": 52297
//     //   }
//     // }

//     await waitFileExists(params.archiveFlagObj);
//     await fileSize(params.archiveFlagObj);
//     await unzipUsers(params.archiveFlagObj);
//     return;
//   }
//   catch(err){
//     console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD USERS ARCHIVE ERROR | " + getTimeStamp() + " | " + err));
//     throw err;
//   }
// }


async function loadUsersArchive(params){

  try {

    let maxInputHashMapFile = "maxInputHashMap.json";

    if (configuration.testMode) { maxInputHashMapFile = "maxInputHashMapFile_test.json"; }

    const maxInputObj = await tcUtils.loadFileRetry({
      folder: configuration.trainingSetsFolder,
      file: maxInputHashMapFile
    });

    await nnTools.setMaxInputHashMap(maxInputObj.maxInputHashMap);
    await nnTools.setNormalization(maxInputObj.normalization);

    const files = params.archiveFlagObj.files;

    // if (configuration.testMode) {
    //   file = file.replace(/users\.zip/, "users_test.zip");
    // }

    params.archiveFlagObj.folder = params.archiveFlagObj.folder || configuration.trainingSetsFolder;
    // params.archiveFlagObj.path = (params.archiveFlagObj.path !== undefined) ? params.archiveFlagObj.path : params.archiveFlagObj.folder + "/" + file;

    console.log(chalkLog(MODULE_ID_PREFIX 
      + " | LOADING USERS ARCHIVE"
      + " | " + getTimeStamp() 
      // + "\n PATH:   " + params.archiveFlagObj.path
      + "\n FOLDER: " + params.archiveFlagObj.folder
      + "\n FILES:   " + files.length
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

    let resetFlag = true;

    for (const fileObj of params.archiveFlagObj.files){
      if (resetFlag) { 
        fileObj.resetFlag = true;
        resetFlag = false;
      }
      console.log(chalkInfo(MODULE_ID_PREFIX + " | ... LOAD ARCHIVE | " + fileObj.path));
      await waitFileExists(fileObj);
      await fileSize(fileObj);
      await unzipUsers(fileObj);
    }
    // await updateTrainingSet();
    return;
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD USERS ARCHIVE ERROR | " + getTimeStamp() + " | " + err));
    throw err;
  }
}

async function loadArchive(){

  try{
    statsObj.status = "LOAD ARCHIVE";

    console.log(chalkLog(MODULE_ID_PREFIX
      + " | LOAD USERS ARCHIVE FLAG FILE: " + configuration.trainingSetsFolder + "/" + configuration.defaultUserArchiveFlagFile
    ));

    const archiveFlagObj = await tcUtils.loadFileRetry({folder: configuration.trainingSetsFolder, file: configuration.defaultUserArchiveFlagFile});
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
      + " | USER ARCHIVE | FILES: " + archiveFlagObj.files.length 
      // + " | SIZE: " + archiveFlagObj.size
      + " | TOTAL USERS: " + archiveFlagObj.histograms.total
      + " | CAT: L/N/R: " + archiveFlagObj.histograms.left 
      + "/" + archiveFlagObj.histograms.neutral 
      + "/" + archiveFlagObj.histograms.right
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

        if (m.quitOnComplete !== undefined) { configuration.quitOnComplete = m.quitOnComplete; }
        if (m.testMode !== undefined) { configuration.testMode = m.testMode; }
        if (m.verbose !== undefined) { configuration.verbose = m.verbose; }
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
      break;

      case "STATS":
        showStats();
        // await processSend({op: "STATS", childId: configuration.childId, stats: statsObj});
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
        // await processSend({op: "PONG", pingId: m.pingId, childId: configuration.childId});
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
      await loadArchive();
      quit({cause: "END"});
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
