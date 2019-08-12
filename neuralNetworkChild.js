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
const DEFAULT_NETWORK_TECHNOLOGY = "neataptic";
const DEFAULT_INPUTS_BINARY_MODE = false;
const TEST_MODE_LENGTH = 500;

const ONE_SECOND = 1000;

const DEFAULT_TEST_RATIO = 0.20;

let configuration = {};
configuration.testSetRatio = DEFAULT_TEST_RATIO;
configuration.inputsBinaryMode = DEFAULT_INPUTS_BINARY_MODE;
configuration.neatapticHiddenLayerSize = 9;

const ThreeceeUtilities = require("@threeceelabs/threecee-utilities");
const tcUtils = new ThreeceeUtilities("NNC_TCU");

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

const QUIT_WAIT_INTERVAL = ONE_SECOND;

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

//=========================================================================
// MODULE REQUIRES
//=========================================================================
const neataptic = require("neataptic");
const carrot = require("@liquid-carrot/carrot");

let networkTech = (DEFAULT_NETWORK_TECHNOLOGY === "neataptic") ? neataptic : carrot;
let networkObj = {};

const _ = require("lodash");
const moment = require("moment");
const pick = require("object.pick");
const treeify = require("treeify");
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

let evolveOptions = {};

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

async function init(){

  statsObj.status = "INIT";

  console.log(chalkBlueBold("TNC | TEST | CARROT TECH XOR")); 

  const network = new networkTech.Network(2,1);

   // XOR dataset
  const trainingSet = [
    { input: [0,0], output: [0] },
    { input: [0,1], output: [1] },
    { input: [1,0], output: [1] },
    { input: [1,1], output: [0] }
  ];

  await network.evolve(trainingSet, {
    mutation: networkTech.methods.mutation.FFW,
    equal: true,
    error: 0.01,
    elitism: 5,
    mutation_rate: 0.25
  });

  let out = network.activate([0,0]); // 0.2413
  if (out > 0.5) { 
    console.log(chalkError("TNC | *** XOR TEST FAIL | IN 0,0 | EXPECTED 0 : OUTPUT: " + out));
    return(new Error("XOR test fail"));
  }
  console.log(chalkGreen("TNC | XOR | [0, 0] --> " + out));

  out = network.activate([0,1]); // 1.0000
  if (out < 0.5) { 
    console.log(chalkError("TNC | *** XOR TEST FAIL | IN 0,1 | EXPECTED 1 : OUTPUT: " + out));
    return(new Error("XOR test fail"));
  }
  console.log(chalkGreen("TNC | XOR | [0, 1] --> " + out));

  out = network.activate([1,0]); // 0.7663
  if (out < 0.5) { 
    console.log(chalkError("TNC | *** XOR TEST FAIL | IN 1,0 | EXPECTED 1 : OUTPUT: " + out));
    return(new Error("XOR test fail"));
  }
  console.log(chalkGreen("TNC | XOR | [1, 0] --> " + out));

  out = network.activate([1,1]); // -0.008
  if (out > 0.5) { 
    console.log(chalkError("TNC | *** XOR TEST FAIL | IN 1,1 | EXPECTED 0 : OUTPUT: " + out));
    return(new Error("XOR test fail"));
  }

  console.log(chalkGreen("TNC | XOR | [1, 1] --> " + out));

  const netJson = network.toJSON();

  console.log(chalkLog("TNC | TEST XOR NETWORK\n" + jsonPrint(netJson)));

  return;
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

  return new Promise(function(resolve, reject){

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
  if(empty(inputTime)) {
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
                          + " | FRNDs DB: " + userObj.friends.length
                          + " | CAT M: " + userObj.category + " A: " + userObj.categoryAuto
                        ));
                      }

                      if (configuration.updateUserDb) {
                        await userServerController.findOneUserV2({user: userObj, mergeHistograms: false, noInc: true});
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

      }, async function(err){

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

async function loadUsersArchive(params){

  // const defaultUserArchiveFolder = path.join(DROPBOX_ROOT_FOLDER, configuration.userArchiveFolder);

  let file = params.file;

  if (configuration.testMode) {
    file = file.replace(/users\.zip/, "users_test.zip");
  }

  params.folder = params.folder || configuration.userArchiveFolder;
  params.path = (params.path !== undefined) ? params.path : params.folder + "/" + file;

  console.log(chalkLog(MODULE_ID_PREFIX 
    + " | LOADING USERS ARCHIVE"
    + " | " + getTimeStamp() 
    + "\n PATH:   " + params.path
    + "\n FOLDER: " + params.folder
    + "\n FILE:   " + file
  ));

  try {
    await fileSize(params);
    await unzipUsersToArray(params);
    await updateTrainingSet();
    return;
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD USERS ARCHIVE ERROR | " + getTimeStamp() + " | " + err));
    throw err;
  }

}

async function loadTrainingSet(){

  statsObj.status = "LOAD TRAINING SET";

  console.log(chalkLog(MODULE_ID_PREFIX
    + " | LOAD ARCHIVE FLAG FILE: " + configuration.userArchiveFolder + "/" + configuration.defaultUserArchiveFlagFile
  ));

  let archiveFlagObj;

  try{
    archiveFlagObj = await tcUtils.loadFileRetry({folder: configuration.userArchiveFolder, file: configuration.defaultUserArchiveFlagFile});
    console.log(chalkNetwork(MODULE_ID_PREFIX + " | USERS ARCHIVE FLAG FILE\n" + jsonPrint(archiveFlagObj)));
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** USERS ARCHIVE FLAG FILE LOAD ERROR: " + err));
    statsObj.loadUsersArchiveBusy = false;
    statsObj.trainingSetReady = false;
    throw err;
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
      return;
    }
    catch(err){
      statsObj.loadUsersArchiveBusy = false;
      statsObj.trainingSetReady = false;
      throw err;
    }
  }
  else {
    console.log(chalkLog(MODULE_ID_PREFIX + " | USERS ARCHIVE SAME ... SKIPPING | " + archiveFlagObj.path));
    statsObj.loadUsersArchiveBusy = false;
    statsObj.trainingSetReady = true;
    return;
  }
}

function testNetworkData(params){
  return new Promise(function(resolve, reject){

    const testData = params.testData;
    let numTested = 0;
    let numPassed = 0;
    let successRate = 0;

    async.eachSeries(testData, function(datum, cb){

      nnTools.activateSingleNetwork({networkId: networkObj.networkId, user: datum, verbose: configuration.verbose}).
      then(function(testOutput){

        const passed = (testOutput.categoryAuto === datum.category);

        numTested += 1;

        numPassed = passed ? numPassed+1 : numPassed;

        successRate = 100 * numPassed/numTested;

        const currentChalk = passed ? chalkLog : chalkAlert;

        if ((configuration.testMode && (numTested % 100 === 0)) || configuration.verbose){
          console.log(currentChalk(MODULE_ID_PREFIX + " | TEST RESULT: " + numPassed + "/" + numTested
            + " | " + successRate.toFixed(2) + "%"
          ));
        }

        cb();
      }).
      catch(function(err){
        return cb(err);
      });

    }, function(err){

      if (err){
        return reject(err);
      }

      const testResults = { 
        testSetId: testSetObj.meta.testSetId, 
        numTests: numTested, 
        numPassed: numPassed, 
        successRate: successRate
      };

      console.log(chalkAlert(MODULE_ID_PREFIX + " | TEST COMPLETE"
        + " | " + numPassed + "/" + testSetObj.meta.setSize
        + " | " + successRate.toFixed(2) + "%"
      ));

      debug(chalkNetwork(MODULE_ID_PREFIX
        + " | TEST RESULTS\n" + jsonPrint(testResults)
      ));

      resolve(testResults);

    });

  });
}

async function testNetwork(){

  const shuffledTestData = _.shuffle(testSetObj.data);

  console.log(chalkBlue("NNC | TEST NETWORK"
    + " | NETWORK ID: " + networkObj.networkId
    + " | " + shuffledTestData.length + " TEST DATA LENGTH"
  ));

  await nnTools.loadNetwork({networkObj: networkObj});
  await nnTools.setPrimaryNeuralNetwork(networkObj.networkId);
  const results = await testNetworkData({testData: shuffledTestData});
  return results;
}

function updateNetworkNodes(params){

  return new Promise(function(resolve, reject){

    const network = params.network;

    const nnInputTypes = Object.keys(params.inputsObj.inputs).sort();

    let nodeIndex = 0; // 

    async.eachSeries(nnInputTypes, function(inputType, cb0){

      const typeInputArray = params.inputsObj.inputs[inputType].sort();

      async.eachSeries(typeInputArray, function(inputName, cb1){

        debug("IN [" + nodeIndex + "]: " + inputName);

        if (params.networkTechnology === "neataptic") {
          if (network.nodes[nodeIndex].type !== "input") {
            console.log(chalkError("NNC | NOT INPUT ERROR" 
              + " | TECH: " + params.networkTechnology 
              + " | NODE INDEX: " + nodeIndex 
              + " | INPUT NAME: " + inputName 
              + "\nparams.network.nodes[nodeIndex]\n" + jsonPrint(network.nodes[nodeIndex])
            ));
            return cb1("NN NOT INPUT NODE ERROR");
          }

          network.nodes[nodeIndex].name = inputName;
          network.nodes[nodeIndex].inputType = inputType;

        }
        else { 
          // carrot
          // const json = {
          //   nodes: [],
          //   connections: [],
          //   input_nodes: [],
          //   output_nodes: [],
          //   input_size: this.input_size,
          //   output_size: this.output_size,
          //   dropout: this.dropout,
          //   // backward compatibility
          //   input: this.input_size,
          //   output: this.output_size,
          // };
          const inputNodeIdex = network.input_nodes[nodeIndex];

          network.nodes[inputNodeIdex].type = "input";
          network.nodes[inputNodeIdex].name = inputName;
          network.nodes[inputNodeIdex].inputType = inputType;
        }

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

      if (params.networkTechnology === "neataptic") {

        nodeIndex = network.nodes.length - network.output;
        debug("OUTPUT INDEX START " + nodeIndex);

        if (network.nodes[nodeIndex].type !== "output") {
          console.log(chalkError("NNC | NOT OUTPUT ERROR " 
            + nodeIndex 
            + "\n" + jsonPrint(network.nodes[nodeIndex])
          ));
          throw new Error("OUTPUT NODE INDEX MISMATCH?");
        }

        network.nodes[nodeIndex].name = "left";
        nodeIndex += 1;
        network.nodes[nodeIndex].name = "neutral";
        nodeIndex += 1;
        network.nodes[nodeIndex].name = "right";
      }
      else{
        nodeIndex = 0;
        const outputNodeIdex = network.output_nodes[nodeIndex];

        network.nodes[outputNodeIdex].type = "output";
        network.nodes[outputNodeIdex].name = "left";
        nodeIndex += 1;
        network.nodes[outputNodeIdex].type = "output";
        network.nodes[outputNodeIdex].name = "neutral";
        nodeIndex += 1;
        network.nodes[outputNodeIdex].type = "output";
        network.nodes[outputNodeIdex].name = "right";
      }

      resolve(network);
    });

  });
}


async function networkEvolve(params) {

  console.log(chalkBlueBold("TNC | >>> START NETWORK EVOLVE"
    + " | " + getTimeStamp()
    + " | NNID: " + statsObj.training.testRunId
  ));

  const nn = params.network;
  const options = params.options;
  let network = {};

  options.schedule = {

    function: function(schedParams){

      const elapsedInt = moment().valueOf() - params.schedStartTime;
      const iterationRate = elapsedInt/schedParams.iteration;
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

    },
    
    iterations: params.log
  };

  if(!nn.evolve || (nn.evolve === undefined)) {

    console.log(chalkAlert("TNC | !!! NETWORK EVOLVE UNDEFINED | CONVERT FROM JSON"
      + " | NNID: " + statsObj.training.testRunId
    ));

    if(!nn.input_size || (nn.input_size === undefined)) { nn.input_size = nn.input; }
    if(!nn.output_size || (nn.output_size === undefined)) { nn.output_size = nn.output; }
    if(!nn.input_nodes || (nn.input_nodes === undefined)) { nn.input_nodes = []; }
    if(!nn.output_nodes || (nn.output_nodes === undefined)) { nn.output_nodes = []; }

    for(const node of nn.nodes){

      switch (node.type) {
        case "input":
          nn.input_nodes.push(node.index);
        break;
        case "oputput":
          nn.output_nodes.push(node.index);
        break;
        default:
          console.log(chalkLog("TNC | ??? NN NODE TYPE: " + node.type));
          throw new Error("UNKNOWN NN NODE TYPE: " + node.type);
      }
      
    }
  }
  else {
    network = nn;
  }

  const results = await network.evolve(preppedTrainingSet, options);

  debug("network.evolve results\n" + jsonPrint(results));

  results.threads = options.threads;

  statsObj.evolve.endTime = moment().valueOf();
  statsObj.evolve.elapsed = moment().valueOf() - statsObj.evolve.startTime;
  statsObj.evolve.results = results;
  statsObj.evolve.results.fitness = statsObj.evolve.stats.fitness;

  const exportedNetwork = network.toJSON();

  const updatedNetwork = await updateNetworkNodes({
    network: exportedNetwork,
    inputsObj: params.inputsObj, 
    networkTechnology: params.networkTechnology
  });

  debug("... END NETWORK NODE UPDATE: " + statsObj.training.testRunId);

  networkObj = {};
  networkObj.networkId = statsObj.training.testRunId;
  networkObj.networkTechnology = params.networkTechnology;
  networkObj.seedNetworkId = statsObj.training.seedNetworkId;
  networkObj.seedNetworkRes = statsObj.training.seedNetworkRes;
  networkObj.hiddenLayerSize = params.hiddenLayerSize;
  networkObj.networkCreateMode = "evolve";
  networkObj.successRate = 0;
  networkObj.matchRate = 0;
  networkObj.testRunId = statsObj.training.testRunId;
  networkObj.network = {};
  networkObj.network = updatedNetwork;
  networkObj.numInputs = updatedNetwork.input;
  networkObj.numOutputs = updatedNetwork.output;
  networkObj.inputsId = params.inputsId;
  networkObj.inputsObj = {};
  networkObj.inputsObj = params.inputsObj;
  networkObj.outputs = {};
  networkObj.outputs = options.outputs;
  networkObj.evolve = {};
  networkObj.evolve.results = {};
  networkObj.evolve.results = results;
  networkObj.evolve.results.error = ((results.error !== undefined) && results.error && (results.error < Infinity)) ? results.error : 0;
  networkObj.evolve.results.efficientMutation = ((results.efficientMutation !== undefined) && results.efficientMutation) ? results.efficientMutation : false;

  networkObj.evolve.options = {};

  networkObj.evolve.options = pick(
    params, 
    [
      "hiddenLayerSize", 
      "clear", 
      "cost", 
      "activation", 
      "growth", 
      "equal", 
      "mutation", 
      "mutationRate", 
      "mutationAmount", 
      "efficientMutation", 
      "popsize", 
      "elitism", 
      "provenance", 
      "fitnessPopulation", 
      "error"
    ]
  );

  networkObj.evolve.elapsed = statsObj.evolve.elapsed;
  networkObj.evolve.startTime = statsObj.evolve.startTime;
  networkObj.evolve.endTime = statsObj.evolve.endTime;

  if (((results.error === 0) || (results.error > options.error)) && (results.iterations < options.iterations)) {

    statsObj.evolve.results.earlyComplete = true;
    networkObj.evolve.results.earlyComplete = true;

    console.log(chalkError("NNC | EVOLVE COMPLETE EARLY???"
      + " | " + configuration.childId
      + " | " + getTimeStamp()
      + " | " + "TECH: " + networkObj.networkTechnology
      + " | " + "TIME: " + results.time
      + " | " + "THREADS: " + results.threads
      + " | " + "ITERATIONS: " + results.iterations
      + " | " + "ERROR: " + results.error
      + " | " + "ELAPSED: " + msToTime(statsObj.evolve.elapsed)
    ));

    throw new Error("EVOLVE EARLY COMPLETE");
  }

  console.log(chalkBlueBold("=======================================================\n"
    + MODULE_ID_PREFIX
    + " | EVOLVE COMPLETE"
    + " | " + configuration.childId
    + " | " + getTimeStamp()
    + " | " + "TECH: " + networkObj.networkTechnology
    + " | " + "TIME: " + results.time
    + " | " + "THREADS: " + results.threads
    + " | " + "ITERATIONS: " + results.iterations
    + " | " + "ERROR: " + results.error
    + " | " + "ELAPSED: " + msToTime(statsObj.evolve.elapsed)
    + "\n======================================================="
  ));

  return networkObj;

}

function trainingSetPrep(params){

  return new Promise(function(resolve, reject){

    preppedTrainingSet = [];

    let dataConverted = 0;

    trainingSetObj.meta.numInputs = params.inputsObj.meta.numInputs;
    testSetObj.meta.numInputs = params.inputsObj.meta.numInputs;

    console.log(chalkBlue(MODULE_ID_PREFIX
      + " | TRAINING SET PREP"
      + " | DATA LENGTH: " + trainingSetObj.data.length
      + " | INPUTS: " + params.inputsObj.meta.numInputs
      + "\nTRAINING SET META\n" + jsonPrint(trainingSetObj.meta)
    ));

    const shuffledTrainingData = _.shuffle(trainingSetObj.data);

    async.eachSeries(shuffledTrainingData, function(datum, cb){

      try {
        // const datumObj = await tcUtils.convertDatumOneNetwork({primaryInputsFlag: true, datum: datum});
        tcUtils.convertDatumOneNetwork({primaryInputsFlag: true, datum: datum}).
        then(function(datumObj){

          dataConverted += 1;

          if (datumObj.input.length !== params.inputsObj.meta.numInputs) { 
            console.log(chalkError(MODULE_ID_PREFIX
              + " | *** ERROR TRAINING SET PREP ERROR" 
              + " | INPUT NUMBER MISMATCH" 
              + " | INPUTS NUM IN: " + params.inputsObj.meta.numInputs
              + " | DATUM NUM IN: " + datumObj.input.length
            ));
            return cb(new Error("INPUT NUMBER MISMATCH"));
          }

          if (datumObj.output.length !== 3) { 
            console.log(chalkError(MODULE_ID_PREFIX
              + " | *** ERROR TRAINING SET PREP ERROR" 
              + " | OUTPUT NUMBER MISMATCH" 
              + " | INPUTS NUM IN: " + params.inputsObj.meta.numOutputs
              + " | DATUM NUM IN: " + datumObj.output.length
            ));
            return cb(new Error("INPUT NUMBER MISMATCH"));
          }

          preppedTrainingSet.push({ 
            input: datumObj.input, 
            output: datumObj.output
          });

          if (configuration.verbose || (dataConverted % 1000 === 0) || configuration.testMode && (dataConverted % 100 === 0)){
            console.log(chalkLog("TNC | DATA CONVERTED: " + dataConverted + "/" + trainingSetObj.data.length));
          }

          cb();

        }).
        catch(function(err){
          cb(err);
        });

      }
      catch(err){
        console.log(chalkError(MODULE_ID_PREFIX
          + " | *** ERROR TRAINING SET PREP: " + err 
        ));
        return cb(err);
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

    const options = {};

    debug("evolve params.network\n" + jsonPrint(params.network));

    if ((params.networkObj !== undefined) && params.networkObj) {
      options.networkObj = deepcopy(params.networkObj);
      params.architecture = "loadedNetwork";
      params.networkTechnology = (params.networkObj.networkTechnology) ? params.networkObj.networkTechnology : "neataptic";
      debug(chalkAlert("NNC | START NETWORK DEFINED: " + options.networkObj.networkId));
    }

    if (!params.architecture || (params.architecture === undefined)) { params.architecture = "perceptron"; }
    if (!params.networkTechnology || (params.networkTechnology === undefined)) { params.networkTechnology = configuration.networkTechnology; }

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


    options.clear = params.clear;
    options.efficientMutation = params.efficientMutation; // carrot
    options.elitism = params.elitism;
    options.equal = params.equal;
    options.error = params.error;
    options.fitness_population = params.fitnessPopulation; // carrot
    options.growth = params.growth;
    options.iterations = params.iterations;
    options.mutation = networkTech.methods.mutation.FFW;
    options.mutationAmount = params.mutationAmount;
    options.mutation_amount = params.mutationAmount; // carrot
    options.mutationRate = params.mutationRate; 
    options.mutation_rate = params.mutationRate; // carrot
    options.popsize = params.popsize;
    options.provenance = params.provenance; // carrot
    options.threads = params.threads;

    statsObj.evolve.startTime = moment().valueOf();
    statsObj.evolve.elapsed = 0;
    statsObj.evolve.stats = {};

    async.each(Object.keys(params), function(key, cb){

      debug(">>>> KEY: " + key);

      switch (key) {

        case "networkObj":
          console.log("NNC"
            + " | " + configuration.childId
            + " | EVOLVE OPTION"
            + " | NN ID: " + key + ": " + params[key].networkId 
            + " | IN: " + params[key].inputsId
            + " | SR: " + params[key].successRate.toFixed(2) + "%"
          );
        break;

        case "mutation":
          console.log("NNC" + " | " + configuration.childId + " | EVOLVE OPTION | " + key + ": " + "FFW");
        break;
              
        case "cost":
          console.log("NNC" + " | " + configuration.childId + " | EVOLVE OPTION | " + key + ": " + params[key]);
          options.cost = networkTech.methods.cost[params[key]];
        break;

        case "activation":
          console.log("NNC" + " | " + configuration.childId + " | EVOLVE OPTION | " + key + ": " + params[key]);
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

      let network;
      let networkObj;
      let testResults;

      switch (params.architecture) {

        case "loadedNetwork":

          try{
            network = networkTech.Network.fromJSON(options.networkObj.network);
          }
          catch(err){
            network = deepcopy(options.networkObj.network);
          }

          // if (typeof options.networkObj.network.toJSON === "function") { 
          //   console.log(chalkAlert("NNC | ... NETWORK NOT JSON | " + options.networkObj.networkId));
          //   network = options.networkObj.network;
          // }
          // else {
          //   console.log(chalkAlert("NNC | >>> NETWORK FROM JSON | " + options.networkObj.networkId));
          //   network = networkTech.Network.fromJSON(options.networkObj.network);
          // }

          console.log("NNC"
            + " | " + configuration.childId
            + " | " + options.networkObj.networkTechnology.toUpperCase()
            + " | EVOLVE ARCH | LOADED: " + options.networkObj.networkId
            + " | IN: " + options.networkObj.numInputs
            + " | OUT: " + options.networkObj.network.output
          );
        break;

        case "perceptron":

          if (networkTech === "carrot"){

            if (params.hiddenLayerSize && (params.hiddenLayerSize > 0)){
              network = new networkTech.architect.Perceptron(
                params.inputsObj.meta.numInputs, 
                params.hiddenLayerSize,
                3
              );
            }
            else{
              params.architecture = "random";
              network = new networkTech.Network(
                params.inputsObj.meta.numInputs, 
                3
              );
            }

            console.log("NNC"
              + " | " + configuration.childId
              + " | " + params.networkTechnology.toUpperCase()
              + " | " + params.architecture.toUpperCase()
              + " | IN: " + params.inputsObj.meta.numInputs 
              + " | OUT: " + trainingSetObj.meta.numOutputs
              + " | HIDDEN LAYER NODES: " + params.hiddenLayerSize
            );
          }
          else{

            if (params.hiddenLayerSize && (params.hiddenLayerSize > 0)){

              params.hiddenLayerSize = Math.min(configuration.neatapticHiddenLayerSize, params.hiddenLayerSize);
              params.hiddenLayerSize = Math.max(params.hiddenLayerSize, trainingSetObj.meta.numOutputs);

              network = new networkTech.architect.Perceptron(
                params.inputsObj.meta.numInputs, 
                params.hiddenLayerSize,
                3
              );
            }
            else{
              params.architecture = "random";
              network = new networkTech.Network(
                params.inputsObj.meta.numInputs, 
                3
              );
            }

            console.log("NNC"
              + " | " + configuration.childId
              + " | " + params.networkTechnology.toUpperCase()
              + " | " + params.architecture.toUpperCase()
              + " | IN: " + params.inputsObj.meta.numInputs 
              + " | OUT: " + trainingSetObj.meta.numOutputs
              + " | HIDDEN LAYER NODES: " + params.hiddenLayerSize
            );

          }

        break;

        default:

          console.log("NNC | EVOLVE ARCH"
            + " | " + configuration.childId
            + " | " + params.networkTechnology.toUpperCase()
            + " | " + params.architecture.toUpperCase()
            + " | INPUTS: " + params.inputsObj.meta.numInputs
            + " | OUTPUTS: " + trainingSetObj.meta.numOutputs
          );

          params.architecture = "random";
          network = new networkTech.Network(
            params.inputsObj.meta.numInputs, 
            3
          );
      }

      params.network = network; // network evolve options

      try {
        await tcUtils.loadInputs({inputsObj: params.inputsObj});
        await tcUtils.setPrimaryInputs({inputsId: params.inputsObj.inputsId});
        await trainingSetPrep(params);

        params.schedStartTime = moment().valueOf();
        params.options = options; // network evolve options

        networkObj = await networkEvolve(params);

        testResults = await testNetwork();

        networkObj.successRate = testResults.successRate;
        networkObj.test = {};
        networkObj.test.results = {};
        networkObj.test.results = testResults;

        if (empty(networkObj.inputsObj)) {
          networkObj.inputsObj = params.inputsObj;
        }

        return resolve(networkObj);
      }
      catch(err){
        console.log(chalkError("NNC | *** EVOLVE ERROR: " + err));
        return reject(err);
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
    onEnter: function(event, oldState, newState) {
      reporter(event, oldState, newState);

      statsObj.fsmStatus = "ERROR";

      quit({cause: "FSM ERROR"});
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
          networkObj.hiddenLayerSize = networkObj.evolve.options.hiddenLayerSize;

          networkObj.evolve.options = pick(
            networkObj.evolve.options, 
            [
              "hiddenLayerSize", 
              "clear", 
              "cost", 
              "activation", 
              "growth", 
              "equal", 
              "mutation", 
              "mutationRate", 
              "mutationAmount", 
              "efficientMutation", 
              "popsize", 
              "elitism", 
              "provenance", 
              "fitnessPopulation", 
              "error"
            ]
          );

          process.send({op: "EVOLVE_COMPLETE", childId: configuration.childId, networkObj: networkObj, statsObj: statsObj});

          fsm.fsm_evolve_complete();

        }
        catch(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR: " + err));
          console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR\nnetworkObj.meta\n" + jsonPrint(networkObj.meta)));
          console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR\ninputsObj\n" + jsonPrint(evolveOptions.inputsObj.meta)));
          console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR\ntrainingSet\n" + jsonPrint(trainingSetObj.meta)));
          console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR\ntestSet\n" + jsonPrint(testSetObj.meta)));
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
        + " | VERBOSE: " + m.verbose
        + "\n" + jsonPrint(m)
      ));
      configuration.verbose = m.verbose;
    break;

    case "INIT":

      console.log(chalkInfo(MODULE_ID_PREFIX + " | INIT"
        + " | CHILD ID: " + m.childId
      ));

      console.log(configuration);

      configuration = _.assign(configuration, m.configuration);

      if (m.testMode !== undefined) { configuration.testMode = m.testMode; }
      if (m.verbose !== undefined) { configuration.verbose = m.verbose; }
      if (m.testSetRatio !== undefined) { configuration.testSetRatio = m.testSetRatio; }
      if (m.inputsBinaryMode !== undefined) { 
        configuration.inputsBinaryMode = m.inputsBinaryMode;
      }

      configuration.childId = m.childId;
      configuration.childIdShort = m.childIdShort;

      statsObj.childId = m.childId;
      statsObj.childIdShort = m.childIdShort;

      process.title = m.childId;
      process.name = m.childId;

      fsm.fsm_init();
    break;

    case "READY":
      console.log(chalkInfo(MODULE_ID_PREFIX + " | READY"
        + " | CHILD ID: " + m.childId
      ));
      fsm.fsm_ready();
    break;

    case "CONFIG_EVOLVE":

      if (m.testSetRatio !== undefined) { configuration.testSetRatio = m.testSetRatio; }

      console.log(chalkInfo(MODULE_ID_PREFIX + " | CONFIG_EVOLVE"
        + " | CHILD ID: " + m.childId
        + " | NETWORK TECH: " + m.networkTechnology
        + " | TEST SET RATIO: " + configuration.testSetRatio
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

      evolveOptions = {
        activation: m.activation,
        architecture: m.architecture,
        hiddenLayerSize: m.hiddenLayerSize,
        clear: m.clear,
        cost: m.cost,
        efficientMutation: m.efficientMutation,
        elitism: m.elitism,
        equal: m.equal,
        error: m.error,
        fitnessPopulation: m.fitnessPopulation,
        growth: m.growth,
        inputsId: m.inputsId,
        inputsObj: m.inputsObj,
        iterations: m.iterations,
        log: m.log,
        mutation: m.mutation,
        mutationAmount: m.mutationAmount,
        mutationRate: m.mutationRate,
        networkTechnology: m.networkTechnology,
        outputs: m.outputs,
        popsize: m.popsize,
        provenance: m.provenance,
        runId: m.testRunId,
        seedNetworkId: m.seedNetworkId,
        seedNetworkRes: m.seedNetworkRes,
        threads: m.threads
      };

      statsObj.evolve.options = {};

      statsObj.evolve.options = {
        activation: m.activation,
        architecture: m.architecture,
        hiddenLayerSize: m.hiddenLayerSize,
        clear: m.clear,
        cost: m.cost,
        efficientMutation: m.efficientMutation,
        elitism: m.elitism,
        equal: m.equal,
        error: m.error,
        fitnessPopulation: m.fitnessPopulation,
        growth: m.growth,
        iterations: m.iterations,
        log: m.log,
        mutation: m.mutation,
        mutationAmount: m.mutationAmount,
        mutationRate: m.mutationRate,
        networkTechnology: m.networkTechnology,
        popsize: m.popsize,
        provenance: m.provenance,
        seedNetworkId: m.seedNetworkId,
        seedNetworkRes: m.seedNetworkRes,
        threads: m.threads
      };

      if (m.networkObj && (m.networkObj !== undefined)) {

        evolveOptions.networkObj = m.networkObj;
        statsObj.evolve.options.networkObj = m.networkObj;

        console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE | " + getTimeStamp()
          + " | " + configuration.childId
          + " | " + m.testRunId
          + " | TECH: " + m.networkTechnology
          + " | HIDDEN: " + m.hiddenLayerSize
          + "\n SEED: " + m.seedNetworkId
          + " | SEED RES %: " + m.seedNetworkRes.toFixed(2)
          + "\n THREADs: " + m.threads
          + "\n NET: " + m.networkObj.networkId + " | " + m.networkObj.successRate.toFixed(2) + "%"
          + " | ITRS: " + statsObj.training.iterations
        ));
      }
      else {
        console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE | " + getTimeStamp()
          + " | " + configuration.childId
          + " | " + m.testRunId
          + " | TECH: " + m.networkTechnology
          + " | HIDDEN: " + m.hiddenLayerSize
          + "\n SEED: " + "---"
          + " | SEED RES %: " + "---"
          + "\n THREADs: " + m.threads
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

    initFsmTickInterval(FSM_TICK_INTERVAL);

    try {
      await connectDb();
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
