 /*jslint node: true */
/*jshint sub:true*/

let childNetworkObj; // this is the common, default nn object
let seedNetworkObj; // this is the common, default nn object

const os = require("os");
const _ = require("lodash");
let hostname = os.hostname();
hostname = hostname.replace(/.tld/g, ""); // amtrak wifi
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const MODULE_NAME = "tncChild";
let MODULE_ID_PREFIX = "NNC";
const DEFAULT_NETWORK_TECHNOLOGY = "neataptic";
const DEFAULT_BINARY_MODE = true;

const TEST_MODE_LENGTH = 1000;

const ONE_SECOND = 1000;

const DEFAULT_TEST_RATIO = 0.20;

let configuration = {};

configuration.testSetRatio = DEFAULT_TEST_RATIO;
configuration.binaryMode = DEFAULT_BINARY_MODE;
configuration.neatapticHiddenLayerSize = 9;
configuration.networkTechnology = DEFAULT_NETWORK_TECHNOLOGY;

const carrotEvolveOptionsPickArray = [
  // "activation",
  "amount",
  "clear",
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
  "log",
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

const neatapticEvolveOptionsPickArray = [
  // "amount",
  "clear",
  "cost",
  "crossover",
  "elitism",
  "equal",
  "error",
  "growth",
  "iterations",
  "log",
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
const HOST = (hostname == PRIMARY_HOST) ? "default" : "local";

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
statsObj.inputsObj = {};
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
    cnf.testMode = (process.env.TEST_MODE == "true") ? true : cnf.testMode;
    cnf.quitOnError = process.env.QUIT_ON_ERROR || false;

    if (process.env.QUIT_ON_COMPLETE == "false") { cnf.quitOnComplete = false; }
    else if ((process.env.QUIT_ON_COMPLETE == true) || (process.env.QUIT_ON_COMPLETE == "true")) {
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

function expo(x, f) {
  return Number.parseFloat(x).toExponential(f);
}

async function createXorOptions(){

  const testIterations = 100000;

  const xorOptions = {
    // amount: 1,
    // clear: false,
    // cost: networkTech.methods.cost.MSE,
    // efficient_mutation: true,
    // efficientMutation: true,
    // elitism: 5,
    // equal: true,
    error: 0.05,
    // fitness_population: true,
    // growth: 0.0001,
    // iterations: testIterations,
    // mutation: networkTech.methods.mutation.FFW,
    // mutation_amount: 1,
    // mutation_rate: 0.4,
    // popsize: 50,
    // population_size: 50,
    // provenance: 0,
    // threads: 8,
  };

  xorOptions.schedule = {

    function: function(schedParams){

      const error = (schedParams.error > 1000) ? expo(schedParams.error, 2) : schedParams.error;
      const fitness = (schedParams.fitness < -1000) ? expo(schedParams.fitness, 2) : schedParams.fitness;

      console.log(chalkLog(MODULE_ID_PREFIX 
        + " | XOR TEST"
        + " | ERR: " + error
        + " | FIT: " + fitness
        + " | I: " + schedParams.iteration + "/" + testIterations
      ));

    },
    
    iterations: 1000
  };

  return xorOptions;
}

async function init(){

  statsObj.status = "INIT";

  let childNetworkRaw;

  console.log(chalkBlueBold("\n=============================\nNNC | TEST | CARROT TECH XOR")); 

  // if (configuration.networkTechnology == "carrot"){
  //   childNetworkRaw = new carrot.Network(2,1);
  // }
  // else{
    childNetworkRaw = new neataptic.Network(2,1);
  // }

  // XOR dataset
  const xorTrainingSet = [
    { input: [0,0], output: [0] },
    { input: [0,1], output: [1] },
    { input: [1,0], output: [1] },
    { input: [1,1], output: [0] }
  ];

  const xorOptions = await createXorOptions();

  console.log(chalkBlueBold(MODULE_ID_PREFIX + " | TEST | CARROT TECH XOR\nOPTIONS\n" + jsonPrint(xorOptions))); 

  console.log(xorTrainingSet);

  await childNetworkRaw.evolve(xorTrainingSet, xorOptions);

  let out = childNetworkRaw.activate([0,0]); // 0.2413

  if (out > 0.5) { 
    console.log(chalkError(MODULE_ID_PREFIX + " | *** XOR TEST FAIL | IN 0,0 | EXPECTED 0 : OUTPUT: " + out));
    return(new Error("XOR test fail"));
  }
  console.log(chalkGreen(MODULE_ID_PREFIX + " | XOR | [0, 0] --> " + out));

  out = childNetworkRaw.activate([0,1]); // 1.0000
  if (out < 0.5) { 
    console.log(chalkError(MODULE_ID_PREFIX + " | *** XOR TEST FAIL | IN 0,1 | EXPECTED 1 : OUTPUT: " + out));
    return(new Error("XOR test fail"));
  }
  console.log(chalkGreen(MODULE_ID_PREFIX + " | XOR | [0, 1] --> " + out));

  out = childNetworkRaw.activate([1,0]); // 0.7663
  if (out < 0.5) { 
    console.log(chalkError(MODULE_ID_PREFIX + " | *** XOR TEST FAIL | IN 1,0 | EXPECTED 1 : OUTPUT: " + out));
    return(new Error("XOR test fail"));
  }
  console.log(chalkGreen(MODULE_ID_PREFIX + " | XOR | [1, 0] --> " + out));

  out = childNetworkRaw.activate([1,1]); // -0.008
  if (out > 0.5) { 
    console.log(chalkError(MODULE_ID_PREFIX + " | *** XOR TEST FAIL | IN 1,1 | EXPECTED 0 : OUTPUT: " + out));
    return(new Error("XOR test fail"));
  }

  console.log(chalkGreen(MODULE_ID_PREFIX + " | XOR | [1, 1] --> " + out));



  const chalkNetworkJson = childNetworkRaw.toJSON();

  childNetworkRaw = neataptic.Network.fromJSON(chalkNetworkJson);

  // await childNetworkRaw.evolve(xorTrainingSet, xorOptions);

  
  out = childNetworkRaw.activate([0,0]); // 0.2413
  if (out > 0.5) { 
    console.log(chalkError(MODULE_ID_PREFIX + " | *** XOR TEST FAIL | IN 0,0 | EXPECTED 0 : OUTPUT: " + out));
    return(new Error("XOR test fail"));
  }
  console.log(chalkGreen(MODULE_ID_PREFIX + " | XOR | [0, 0] --> " + out));

  out = childNetworkRaw.activate([0,1]); // 1.0000
  if (out < 0.5) { 
    console.log(chalkError(MODULE_ID_PREFIX + " | *** XOR TEST FAIL | IN 0,1 | EXPECTED 1 : OUTPUT: " + out));
    return(new Error("XOR test fail"));
  }
  console.log(chalkGreen(MODULE_ID_PREFIX + " | XOR | [0, 1] --> " + out));

  out = childNetworkRaw.activate([1,0]); // 0.7663
  if (out < 0.5) { 
    console.log(chalkError(MODULE_ID_PREFIX + " | *** XOR TEST FAIL | IN 1,0 | EXPECTED 1 : OUTPUT: " + out));
    return(new Error("XOR test fail"));
  }
  console.log(chalkGreen(MODULE_ID_PREFIX + " | XOR | [1, 0] --> " + out));

  out = childNetworkRaw.activate([1,1]); // -0.008
  if (out > 0.5) { 
    console.log(chalkError(MODULE_ID_PREFIX + " | *** XOR TEST FAIL | IN 1,1 | EXPECTED 0 : OUTPUT: " + out));
    return(new Error("XOR test fail"));
  }

  console.log(chalkGreen(MODULE_ID_PREFIX + " | XOR | [1, 1] --> " + out));

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

        // const tscChildName = MODULE_ID_PREFIX + "_TSC";
        // tweetServerController = new TweetServerController(tscChildName);

        // tweetServerController.on("ready", function(appname){
        //   tweetServerControllerReady = true;
        //   console.log(chalk.green(MODULE_ID_PREFIX + " | " + tscChildName + " READY | " + appname));
        // });

        // tweetServerController.on("error", function(err){
        //   tweetServerControllerReady = false;
        //   console.trace(chalkError(MODULE_ID_PREFIX + " | *** " + tscChildName + " ERROR | " + err));
        // });

        userServerController.on("ready", function(appname){
          userServerControllerReady = true;
          console.log(chalkLog(MODULE_ID_PREFIX + " | " + uscChildName + " READY | " + appname));
        });

        dbConnectionReadyInterval = setInterval(function(){

          if (userServerControllerReady) {

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

                    if ((userObj.category == "left") || (userObj.category == "right") || (userObj.category == "neutral")) {

                      trainingSetUsersHashMap[userObj.category].set(userObj.nodeId, userObj);

                      if (configuration.verbose || (statsObj.users.unzipped % 1000 == 0)) {

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

        if (params.size && (size == params.size)) {
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

          if ((size > 0) && ((params.size && (size == params.size)) || (size == prevSize))) {

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

  let file = params.file;

  if (configuration.testMode) {
    file = file.replace(/users\.zip/, "users_test.zip");
  }

  params.folder = params.folder || configuration.userArchiveFolder;
  params.path = (params.path != undefined) ? params.path : params.folder + "/" + file;

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

  if (archiveFlagObj.file != statsObj.archiveFile) {

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

    const testSet = params.testSet;
    const convertDatumFlag = params.convertDatumFlag || false;
    const binaryMode = (params.binaryMode != undefined) ? params.binaryMode : configuration.binaryMode;

    let numTested = 0;
    let numPassed = 0;
    let successRate = 0;

    async.eachSeries(testSet, function(datum, cb){

      // nnTools.activateSingleNetwork({networkId: params.networkId, user: datum, binaryMode: binaryMode, verbose: configuration.verbose}).
      nnTools.activateSingleNetwork({user: datum.user, datum: datum, convertDatumFlag: convertDatumFlag, binaryMode: binaryMode, verbose: configuration.verbose}).
      then(function(testOutput){

        numTested += 1;

        let match = "FAIL";
        let currentChalk = chalkAlert;

        if (testOutput.categoryAuto == datum.user.category){
          match = "PASS";
          numPassed += 1;
          currentChalk = chalkGreenBold;
        }

        successRate = 100 * numPassed/numTested;

        if (configuration.testMode || configuration.verbose){
          console.log(currentChalk(MODULE_ID_PREFIX + " | TESTING"
            + " | " + successRate.toFixed(2) + "%"
            + " | " + numPassed + "/" + numTested
            + " | CAT M: " + datum.user.category[0].toUpperCase() + " A: " + testOutput.categoryAuto[0].toUpperCase()
            + " | MATCH: " + match
            + " | @" + datum.user.screenName
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

      console.log(chalkBlueBold("\n================================================\n"
        + MODULE_ID_PREFIX + " | TEST COMPLETE"
        + " | " + numPassed + "/" + testSetObj.meta.setSize
        + " | " + successRate.toFixed(2) + "%"
        + "\n================================================\n"
      ));

      debug(chalkNetwork(MODULE_ID_PREFIX
        + " | TEST RESULTS\n" + jsonPrint(testResults)
      ));

      resolve(testResults);

    });

  });
}

async function testNetwork(p){

  const params = p || {};

  const binaryMode = (params.binaryMode != undefined) ? params.binaryMode : configuration.binaryMode;

  const testSet = await dataSetPrep({dataSetObj: testSetObj, binaryMode: binaryMode});

  console.log(chalkBlue(MODULE_ID_PREFIX + " | TEST NETWORK"
    + " | NETWORK ID: " + childNetworkObj.networkId
    + " | " + testSet.length + " TEST DATA LENGTH"
  ));

  await nnTools.loadNetwork({networkObj: childNetworkObj, networkIsRaw: true});
  await nnTools.setPrimaryNeuralNetwork(childNetworkObj.networkId);
  await nnTools.setBinaryMode(binaryMode);

  childNetworkObj.test = {};
  childNetworkObj.test.results = {};

  childNetworkObj.test.results = await testNetworkData({networkId: childNetworkObj.networkId, testSet: testSet, convertDatumFlag: false, binaryMode: binaryMode});

  childNetworkObj.successRate = childNetworkObj.test.results.successRate;

  return;
}

async function prepNetworkEvolve() {

  console.log(chalkBlueBold(MODULE_ID_PREFIX + " | >>> START NETWORK EVOLVE"
    + " | " + getTimeStamp()
    + " | NNID: " + statsObj.training.testRunId
  ));

  const options = deepcopy(childNetworkObj.evolve.options);
  const schedStartTime = moment().valueOf();

  options.schedule = {

    function: function(schedParams){

      const elapsedInt = moment().valueOf() - schedStartTime;
      const iterationRate = elapsedInt/schedParams.iteration;
      const timeToComplete = iterationRate*(options.iterations - schedParams.iteration);

      statsObj.evolve.stats = schedParams;

      const sObj = {
        networkTechnology: childNetworkObj.networkTechnology,
        binaryMode: childNetworkObj.binaryMode,
        networkId: childNetworkObj.networkId,
        numInputs: childNetworkObj.inputsObj.meta.numInputs,
        inputsId: childNetworkObj.inputsId,
        evolveStart: schedStartTime,
        evolveElapsed: elapsedInt,
        totalIterations: childNetworkObj.evolve.options.iterations,
        iteration: schedParams.iteration,
        iterationRate: iterationRate,
        timeToComplete: timeToComplete,
        error: schedParams.error.toFixed(5) || Infinity,
        fitness: schedParams.fitness.toFixed(5) || -Infinity
      };

      process.send({op: "EVOLVE_SCHEDULE", childId: configuration.childId, childIdShort: configuration.childIdShort, stats: sObj});

    },
    
    iterations: 1
  };

  let finalOptions = options;

  if (childNetworkObj.networkTechnology == "carrot"){
    finalOptions = pick(options, carrotEvolveOptionsPickArray);
  }

  if (childNetworkObj.networkTechnology == "neataptic"){
    finalOptions = pick(options, neatapticEvolveOptionsPickArray);
  }

  console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE OPTIONS\n" + jsonPrint(finalOptions)));

  if ((childNetworkObj.networkTechnology == "neataptic") && (options.activation != undefined) && (typeof options.activation == "string")) {
    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE OPTIONS | ACTIVATION: " + options.activation));
    finalOptions.activation = neataptic.methods.activation[options.activation];
  }

  if ((options.selection != undefined) && (typeof options.selection == "string")) {
    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE OPTIONS | SELECTION: " + options.selection));
    finalOptions.selection = neataptic.methods.selection[options.selection];
  }

  if ((options.cost != undefined) && (typeof options.cost == "string")) {
    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE OPTIONS | COST: " + options.cost));
    finalOptions.cost = neataptic.methods.cost[options.cost];
  }

  if ((options.mutation != undefined) && (typeof options.mutation == "string")) {
    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE OPTIONS | MUTATION: " + options.mutation));
    finalOptions.mutation = neataptic.methods.mutation[options.mutation];
  }

  return finalOptions;
}

function dataSetPrep(p){

  return new Promise(function(resolve, reject){

    const params = p || {};
    const dataSetObj = params.dataSetObj;

    const binaryMode = (params.binaryMode != undefined) ? params.binaryMode : configuration.binaryMode;

    const dataSet = [];

    let dataConverted = 0;

    dataSetObj.meta.numInputs = childNetworkObj.inputsObj.meta.numInputs;
    // testSetObj.meta.numInputs = childNetworkObj.inputsObj.meta.numInputs;

    console.log(chalkBlue(MODULE_ID_PREFIX
      + " | DATA SET PREP"
      + " | DATA LENGTH: " + dataSetObj.data.length
      + " | INPUTS: " + childNetworkObj.inputsObj.meta.numInputs
      + "\nDATA SET META\n" + jsonPrint(dataSetObj.meta)
    ));

    const shuffledData = _.shuffle(dataSetObj.data);

    async.each(shuffledData, function(user, cb){

      try {

        if ((!user.profileHistograms || user.profileHistograms == undefined || user.profileHistograms == {}) 
          && (!user.tweetHistograms || user.tweetHistograms == undefined || user.tweetHistograms == {})){
          console.log(chalkAlert(MODULE_ID_PREFIX + " | !!! EMPTY USER HISTOGRAMS ... SKIPPING | @" + user.screenName));
          return cb();
        }

        tcUtils.convertDatumOneNetwork({primaryInputsFlag: true, user: user, binaryMode: binaryMode}).
        then(function(results){

          if (results.emptyFlag) {
            debug(chalkAlert(MODULE_ID_PREFIX + " | !!! EMPTY CONVERTED DATUM ... SKIPPING | @" + user.screenName));
            return cb();
          }

          dataConverted += 1;

          if (results.datum.input.length != childNetworkObj.inputsObj.meta.numInputs) { 
            console.log(chalkError(MODULE_ID_PREFIX
              + " | *** ERROR DATA SET PREP ERROR" 
              + " | INPUT NUMBER MISMATCH" 
              + " | INPUTS NUM IN: " + childNetworkObj.inputsObj.meta.numInputs
              + " | DATUM NUM IN: " + results.datum.input.length
            ));
            return cb(new Error("INPUT NUMBER MISMATCH"));
          }

          if (results.datum.output.length != 3) { 
            console.log(chalkError(MODULE_ID_PREFIX
              + " | *** ERROR DATA SET PREP ERROR" 
              + " | OUTPUT NUMBER MISMATCH" 
              + " | INPUTS NUM IN: " + childNetworkObj.inputsObj.meta.numOutputs
              + " | DATUM NUM IN: " + results.datum.output.length
            ));
            return cb(new Error("INPUT NUMBER MISMATCH"));
          }

          for(const inputValue of results.datum.input){
            if (typeof inputValue != "number") {
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
            if (typeof outputValue != "number") {
              return cb(new Error("OUTPUT VALUE NOT TYPE NUMBER | @" + results.user.screenName + " | OUTPUT TYPE: " + typeof outputValue));
            }
            if (outputValue < 0) {
              return cb(new Error("OUTPUT VALUE LESS THAN ZERO | @" + results.user.screenName + " | OUTPUT: " + outputValue));
            }
            if (outputValue > 1) {
              return cb(new Error("OUTPUT VALUE GREATER THAN ONE | @" + results.user.screenName + " | OUTPUT: " + outputValue));
            }
          }

          dataSet.push({user: results.user, input: results.datum.input, output: results.datum.output});

          if (configuration.verbose || (dataConverted % 1000 == 0) || configuration.testMode && (dataConverted % 100 == 0)){
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

    const numInputs = childNetworkObj.inputsObj.meta.numInputs;

    switch (childNetworkObj.architecture) {

      case "loadedNetwork":

        if (!empty(childNetworkObj.networkRaw) && (childNetworkObj.networkRaw.evolve != undefined)){
          networkRaw = childNetworkObj.networkRaw;
        }
        else if (childNetworkObj.network.evolve != undefined){
          networkRaw = childNetworkObj.network;
        }
        else{
          try {
            if (childNetworkObj.networkTechnology == "carrot"){
              networkRaw = carrot.Network.fromJSON(childNetworkObj.network);
            }
            else{
              networkRaw = neataptic.Network.fromJSON(childNetworkObj.network);
            }
          }
          catch(err){
            console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR CREATE NETWORK | CARROT fromJSON: " + err));
            return reject(err);
          }
        }

        console.log(chalkBlueBold(MODULE_ID_PREFIX
          + " | " + configuration.childId
          + " | " + childNetworkObj.networkTechnology.toUpperCase()
          + " | EVOLVE ARCH | LOADED: " + childNetworkObj.networkId
          + " | IN: " + networkRaw.input
          + " | OUT: " + networkRaw.output
        ));

        resolve(networkRaw);

      break;

      case "perceptron":

        if (childNetworkObj.networkTechnology == "carrot"){

          if (childNetworkObj.hiddenLayerSize && (childNetworkObj.hiddenLayerSize > 0)){
            networkRaw = new carrot.architect.Perceptron(numInputs, childNetworkObj.hiddenLayerSize, 3);
          }
          else{
            childNetworkObj.architecture = "random";
            networkRaw = new carrot.Network(numInputs,3);
          }

          console.log(chalkBlueBold("NNC"
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

          if (childNetworkObj.hiddenLayerSize && (childNetworkObj.hiddenLayerSize > 0)){

            childNetworkObj.hiddenLayerSize = Math.min(configuration.neatapticHiddenLayerSize, childNetworkObj.hiddenLayerSize);
            childNetworkObj.hiddenLayerSize = Math.max(childNetworkObj.hiddenLayerSize, trainingSetObj.meta.numOutputs);

            networkRaw = new neataptic.architect.Perceptron(numInputs, childNetworkObj.hiddenLayerSize, 3);
          }
          else{
            childNetworkObj.architecture = "random";
            if (childNetworkObj.networkTechnology == "neataptic"){
              networkRaw = new neataptic.Network(numInputs, 3);
            }
            else{
              networkRaw = new carrot.Network(numInputs, 3);
            }
          }

          console.log(chalkBlueBold("NNC"
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

        if (childNetworkObj.networkTechnology == "carrot"){
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

    const binaryMode = (params.binaryMode != undefined) ? params.binaryMode : configuration.binaryMode;

    await tcUtils.loadInputs({inputsObj: childNetworkObj.inputsObj});
    await tcUtils.setPrimaryInputs({inputsId: childNetworkObj.inputsObj.inputsId});

    const trainingSet = await dataSetPrep({dataSetObj: trainingSetObj, binaryMode: binaryMode});

    const childNetworkRaw = await createNetwork();

    const preppedOptions = await prepNetworkEvolve();

    const evolveResults = await childNetworkRaw.evolve(trainingSet, preppedOptions);

    childNetworkObj.networkJson = childNetworkRaw.toJSON();
    childNetworkObj.networkRaw = childNetworkRaw;

    debug("childNetworkRaw.evolve evolveResults\n" + jsonPrint(Object.keys(evolveResults)));

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

    console.log(chalkBlueBold("=======================================================\n"
      + MODULE_ID_PREFIX
      + " | EVOLVE COMPLETE"
      + " | " + configuration.childId
      + " | " + getTimeStamp()
      + " | " + "TECH: " + childNetworkObj.networkTechnology
      + " | " + "INPUT ID: " + childNetworkObj.inputsId
      + " | " + "INPUTS: " + childNetworkObj.inputsObj.meta.numInputs
      + " | " + "TIME: " + evolveResults.time
      + " | " + "THREADS: " + evolveResults.threads
      + " | " + "ITERATIONS: " + evolveResults.iterations
      + " | " + "ERROR: " + evolveResults.error
      + " | " + "ELAPSED: " + msToTime(statsObj.evolve.elapsed)
      + "\n======================================================="
    ));

    if (evolveResults.iterations != childNetworkObj.evolve.options.iterations) {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR: ITERATIONS"
        + " | EXPECTED: " + childNetworkObj.evolve.options.iterations
        + " | ACTUAL: " + evolveResults.iterations
      ));
      // throw new Error("EVOLVE ITERATIONS");
    }

    await testNetwork({binaryMode: binaryMode});

    return;
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR: " + err));
    console.trace(err);
    throw err;
  }
}

function networkEvolve(){

  return new Promise(function(resolve, reject){

    const params = childNetworkObj.evolve.options;

    const binaryMode = (params.binaryMode != undefined) ? params.binaryMode : configuration.binaryMode;
    
    const options = {};

    if (params.seedNetworkId) {
      params.architecture = "loadedNetwork";
      params.networkTechnology = (params.networkTechnology) ? params.networkTechnology : "neataptic";
      debug(chalkAlert(MODULE_ID_PREFIX + " | START NETWORK DEFINED: " + params.networkId));
    }

    if (!params.architecture || (params.architecture == undefined)) { params.architecture = "perceptron"; }
    if (!params.networkTechnology || (params.networkTechnology == undefined)) { params.networkTechnology = configuration.networkTechnology; }

    const networkTech = (params.networkTechnology == "carrot") ? carrot : neataptic;

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
          console.log("NNC" + " | " + configuration.childId + " | EVOLVE OPTION | " + key + ": " + params[key]);
          options.mutation = networkTech.methods.mutation[params[key]];
        break;
              
        case "selection":
          console.log("NNC" + " | " + configuration.childId + " | EVOLVE OPTION | " + key + ": " + params[key]);
          options.selection = networkTech.methods.selection[params[key]];
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
          if (!ignoreKeyArray.includes(key)){
            console.log("NNC" + " | " + configuration.childId + " | EVOLVE OPTION | " + key + ": " + params[key]);
            options[key] = params[key];
          }
      }

      cb();

    }, function(){

      evolve({binaryMode: binaryMode})
      .then(function(){
        resolve();
      })
      .catch(function(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR: " + err));
        console.trace(err);
        return reject(err);
      });

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

      if (event != "fsm_tick") {
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

      if (event != "fsm_tick") {
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
      if (event != "fsm_tick") {
        reporter(event, oldState, newState);
        statsObj.fsmStatus = "INIT";
        try {
          const initError = await init();
          if (initError) {
            fsm.fsm_error();
          }
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
      if (event != "fsm_tick") {
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

      if (event != "fsm_tick") {

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
      if (event != "fsm_tick") {

        reporter(event, oldState, newState);
        statsObj.fsmStatus = "EVOLVE";
        process.send({op: "STATS", childId: configuration.childId, data: statsObj});

        try {

          await networkEvolve();

          process.send({op: "EVOLVE_COMPLETE", childId: configuration.childId, networkObj: childNetworkObj, statsObj: statsObj});

          fsm.fsm_evolve_complete();

        }
        catch(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR: " + err));
          console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR\nnetworkObj.meta\n" + jsonPrint(childNetworkObj.meta)));
          console.log(chalkError(MODULE_ID_PREFIX + " | *** EVOLVE ERROR\ninputsObj\n" + jsonPrint(childNetworkObj.inputsObj.meta)));
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

      if (event != "fsm_tick") {

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

async function calculateHiddenLayerSize(params){
  const networkObj = params.networkObj;

  let hiddenLayerSize = 0;

  if (!networkObj.network.nodes || (networkObj.network.nodes == undefined)){
    return hiddenLayerSize;
  }

  for(const node of networkObj.network.nodes){
    if (node.type == "hidden") { hiddenLayerSize += 1; }
  }

  return hiddenLayerSize;
}

async function networkObjDefaults(nnObj){

  try{
    if (empty(nnObj)) {
      console.trace(chalkError("networkObjDefaults ERROR: networkObj UNDEFINED"));
      throw new Error("networkObjDefaults ERROR: networkObj UNDEFINED");
    }

    if(empty(nnObj.networkTechnology)) { nnObj.networkTechnology = "neataptic"; }
    if(empty(nnObj.betterChild)) { nnObj.betterChild = false; }
    if(empty(nnObj.testCycles)) { nnObj.testCycles = 0; }
    if(empty(nnObj.testCycleHistory)) { nnObj.testCycleHistory = []; }
    if(empty(nnObj.overallMatchRate)) { nnObj.overallMatchRate = 0; }
    if(empty(nnObj.matchRate)) { nnObj.matchRate = 0; }
    if(empty(nnObj.successRate)) { nnObj.successRate = 0; }

    if (!nnObj.hiddenLayerSize || (nnObj.hiddenLayerSize == undefined)){
      nnObj.hiddenLayerSize = await calculateHiddenLayerSize({networkObj: nnObj});
    }

    const nn = await nnTools.convertNetwork({networkObj: nnObj});

    return nn;
  }
  catch(err){
    throw err;
  }

}

async function configNetworkEvolve(params){

  let nnObj = {};
  const newNetObj = {};

  if (params.testSetRatio != undefined) { configuration.testSetRatio = params.testSetRatio; }

  console.log(chalkInfo(MODULE_ID_PREFIX + " | CONFIG EVOLVE"
    + " | CHILD ID: " + params.childId
    + " | NETWORK TECH: " + params.networkTechnology
    + " | TEST SET RATIO: " + configuration.testSetRatio
  ));

  configuration.childId = params.childId;

  newNetObj.binaryMode = (params.binaryMode != undefined) ? params.binaryMode : configuration.binaryMode;

  newNetObj.networkTechnology = params.networkTechnology || "neataptic";

  newNetObj.networkId = params.testRunId;
  newNetObj.seedNetworkId = params.seedNetworkId || false;
  newNetObj.seedNetworkRes = params.seedNetworkRes;
  newNetObj.networkCreateMode = "evolve";
  newNetObj.testRunId = params.testRunId;
  newNetObj.network = {};
  newNetObj.inputsId = params.inputsId;
  newNetObj.inputsObj = {};
  newNetObj.inputsObj = params.inputsObj;
  newNetObj.numInputs = params.inputsObj.meta.numInputs;
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
      "amount", 
      "architecture",
      "binaryMode",
      "clear", 
      "cost", 
      "efficient_mutation", 
      "elitism", 
      "equal", 
      "error",
      "fitness_population", 
      "growth",
      "hiddenLayerSize",
      "inputsId",
      "iterations",
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

    seedNetworkObj = params.networkObj;

    if (seedNetworkObj.networkTechnology != newNetObj.networkTechnology){
      console.log(chalkAlert(MODULE_ID_PREFIX + " | !!! CHANGE NETWORK TECH TO SEED NN TECH"
        + " | SEED: " + seedNetworkObj.networkTechnology
        + " --> CHILD: " + newNetObj.networkTechnology
      ));
      newNetObj.networkTechnology = seedNetworkObj.networkTechnology;
    }

    newNetObj.numInputs = seedNetworkObj.numInputs;
    newNetObj.numOutputs = seedNetworkObj.numOutputs;

    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE | " + getTimeStamp()
      + " | " + configuration.childId
      + " | " + newNetObj.networkId
      + " | BIN MODE: " + newNetObj.evolve.options.binaryMode
      + " | TECH: " + newNetObj.evolve.options.networkTechnology
      + " | HIDDEN: " + newNetObj.evolve.options.hiddenLayerSize
      + "\n SEED: " + seedNetworkObj.networkId
      + " | SEED RES %: " + seedNetworkObj.successRate.toFixed(2)
      + "\n THREADs: " + newNetObj.evolve.options.threads
      + " | ITRS: " + newNetObj.evolve.options.iterations
    ));
  }
  else {

    seedNetworkObj = {};

    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | EVOLVE | " + getTimeStamp()
      + " | " + configuration.childId
      + " | " + newNetObj.networkId
      + " | BIN MODE: " + newNetObj.evolve.options.binaryMode
      + " | TECH: " + newNetObj.evolve.options.networkTechnology
      + " | HIDDEN: " + newNetObj.evolve.options.hiddenLayerSize
      + " | THREADs: " + newNetObj.evolve.options.threads
      + " | ITRS: " + newNetObj.evolve.options.iterations
    ));
  }

  nnObj = await networkObjDefaults(newNetObj);
  return nnObj;
}

process.on("message", async function(m) {

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

      MODULE_ID_PREFIX = m.moduleIdPrefix || MODULE_ID_PREFIX;

      console.log(chalkInfo(MODULE_ID_PREFIX + " | INIT"
        + " | CHILD ID: " + m.childId
      ));

      console.log(configuration);

      configuration = _.assign(configuration, m.configuration);

      if (m.testMode != undefined) { configuration.testMode = m.testMode; }
      if (m.verbose != undefined) { configuration.verbose = m.verbose; }
      if (m.testSetRatio != undefined) { configuration.testSetRatio = m.testSetRatio; }
      if (m.binaryMode != undefined) { 
        configuration.binaryMode = m.binaryMode;
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

      childNetworkObj = await configNetworkEvolve(m);

      statsObj.evolve.options = childNetworkObj.evolve.options;

      statsObj.training.startTime = moment().valueOf();
      statsObj.training.testRunId = m.testRunId;
      statsObj.training.seedNetworkId = m.seedNetworkId;
      statsObj.training.seedNetworkRes = m.seedNetworkRes;
      statsObj.training.iterations = m.iterations;

      statsObj.inputsId = m.inputsId;
      statsObj.inputsObj = {};
      statsObj.inputsObj = m.inputsObj;
      statsObj.outputs = [];
      statsObj.outputs = m.outputs;

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
    if (err.code != 404) {
      quit({cause: new Error("INIT CONFIG ERROR")});
    }
  }
}, 1000);
