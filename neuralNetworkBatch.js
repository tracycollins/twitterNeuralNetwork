/*jslint node: true */
"use strict";

const OFFLINE_MODE = true;
const DEFAULT_ENABLE_RANDOM = true;
const DEFAULT_BATCH_MAX_INSTANCES = 3;
const DEFAULT_BEST_NETWORK_NUMBER = 10;
const SEED_NETWORK_PROBABILITY = 0.5;

const DEFAULT_ITERATIONS = 1;
const DEFAULT_SEED_NETWORK_ID = false; 

// ================ TRAIN ================
const DEFAULT_TRAIN_HIDDEN_LAYER_SIZE = 10;
const DEFAULT_TRAIN_ERROR = 0.03;
const DEFAULT_TRAIN_COST = "MSE";
const DEFAULT_TRAIN_RATE = 0.3;
const DEFAULT_TRAIN_DROPOUT = 0;
const DEFAULT_TRAIN_SHUFFLE = false;
const DEFAULT_TRAIN_CLEAR = false;
const DEFAULT_TRAIN_MOMENTUM = 0;
const DEFAULT_TRAIN_RATE_POLICY = "FIXED";
const DEFAULT_TRAIN_BATCH_SIZE = 1;

const TRAIN_COST_ARRAY = [
  "CROSS_ENTROPY",
  "MSE",
  "BINARY",
  "MAE",
  "MAPE",
  "MSLE",
  "HINGE"
];

const TRAIN_RATE_POLICY_ARRAY = [
  "FIXED",
  "STEP",
  "EXP",
  "INV"
];

const TRAIN_HIDDEN_LAYER_SIZE_RANGE = { min: 10, max: 50 } ;
const TRAIN_RATE_RANGE = { min: 0.2, max: 0.4 } ;
const TRAIN_DROPOUT_RANGE = { min: 0, max: 0.5 } ;
const TRAIN_MOMENTUM_RANGE = { min: 0, max: 0.5 } ;
const TRAIN_BATCH_SIZE_RANGE = { min: 1, max: 1 } ;
const TRAIN_ERROR_RANGE = { min: 0.02, max: 0.04 } ;


// ================ TRAIN ================


// ================ EVOLVE ================
const DEFAULT_EVOLVE_ACTIVATION = "LOGISTIC"; // TAHN | RELU | IDENTITY | STEP
const DEFAULT_EVOLVE_CLEAR = false; // binary
const DEFAULT_EVOLVE_COST = "MSE"; // CROSS_ENTROPY | MSE | BINARY
const DEFAULT_EVOLVE_EQUAL = true;
const DEFAULT_EVOLVE_ERROR = 0.03;
const DEFAULT_EVOLVE_MUTATION = "FFW";
const DEFAULT_EVOLVE_MUTATION_RATE = 0.5;
const DEFAULT_EVOLVE_POP_SIZE = 50;
const DEFAULT_EVOLVE_ELITISM = 5; // %

const EVOLVE_COST_ARRAY = [
  "CROSS_ENTROPY",
  "MSE",
  "BINARY",
  "MAE",
  "MAPE",
  "MSLE",
  "HINGE"
];

const EVOLVE_ACTIVATION_ARRAY = [ 
  "LOGISTIC", 
  "TAHN", 
  "RELU", 
  "IDENTITY", 
  "STEP", 
  "SOFTSIGN", 
  "SINUSOID", 
  "GAUSSIAN", 
  "BENT_IDENTITY",
  "BIPOLAR",
  "BIPOLAR_SIGMOID",
  "HARD_TANH",
  "ABSOLUTE",
  "SELU",
  "INVERSE"
];

const EVOLVE_MUTATION_RATE_RANGE = { min: 0.3, max: 0.9 } ;
const EVOLVE_POP_SIZE_RANGE = { min: 10, max: 100 } ;
const EVOLVE_ELITISM_RANGE = { min: 0, max: 20 } ;
// ================ EVOLVE ================

const DEFAULT_PROCESS_POLL_INTERVAL = 15000;
const DEFAULT_STATS_INTERVAL = 60000;

let configuration = {};
configuration.seedNetworkId = DEFAULT_SEED_NETWORK_ID;
configuration.enableRandom = DEFAULT_ENABLE_RANDOM;
configuration.autoStartInstance = true;
configuration.processPollInterval = DEFAULT_PROCESS_POLL_INTERVAL;
configuration.keepaliveInterval = 3000;

const slackOAuthAccessToken = "xoxp-3708084981-3708084993-206468961315-ec62db5792cd55071a51c544acf0da55";
const slackChannel = "#nn_batch";

const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const os = require("os");
const pm2 = require("pm2");
const Slack = require("slack-node");
const async = require("async");
const defaults = require("object.defaults/immutable");
const moment = require("moment");
const chalk = require("chalk");
const debug = require("debug")("nnb");
const commandLineArgs = require("command-line-args");
const Dropbox = require("dropbox");
const deepcopy = require("deep-copy");
const randomItem = require("random-item");
const randomFloat = require("random-float");
const randomInt = require("random-int");
const mongoose = require("./config/mongoose");
const db = mongoose();
const HashMap = require("hashmap").HashMap;

const chalkNetwork = chalk.blue;
const chalkAlert = chalk.red;
const chalkBlue = chalk.blue;
const chalkError = chalk.bold.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;

let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

let socket;
let userReadyTransmitted = false;
let userReadyAck = false;
let serverConnected = false;

configuration.instanceOptions = {};

configuration.instanceOptions.script = "twitterNeuralNetwork.js";

if (hostname.includes("google")) {
  configuration.instanceOptions.cwd = "/home/tc/twitterNeuralNetwork";
}
else {
  configuration.instanceOptions.cwd = "/Volumes/RAID1/projects/twitterNeuralNetwork";
}

configuration.instanceOptions.autorestart = false;
configuration.instanceOptions.node_args = "--max-old-space-size=4096";

configuration.instanceOptions.env = {};
configuration.instanceOptions.env.NODE_ENV = "production";
configuration.instanceOptions.env.BATCH_MODE = true;
configuration.instanceOptions.env.GCLOUD_PROJECT = "graphic-tangent-627";
configuration.instanceOptions.env.GOOGLE_PROJECT = "graphic-tangent-627";
configuration.instanceOptions.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN = "nknEWsIkD5UAAAAAAAQouTDFRBKfwsFzuS8PPi2Q_JVYnpotNuaHiddNtmG4mUTi";
configuration.instanceOptions.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER = "/config/twitter";
configuration.instanceOptions.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE = "altthreecee00.json";
configuration.instanceOptions.env.TNN_PROCESS_NAME = "tnn";

configuration.instanceOptions.env.TNN_TWITTER_DEFAULT_USER = "altthreecee00";
configuration.instanceOptions.env.TNN_TWITTER_USERS = {"altthreecee00": "altthreecee00", "ninjathreecee": "ninjathreecee"};
configuration.instanceOptions.env.TNN_STATS_UPDATE_INTERVAL = 60000;

configuration.instanceOptions.env.TNN_ITERATIONS = DEFAULT_ITERATIONS;
configuration.instanceOptions.env.SEED_NETWORK_ID = false;

configuration.instanceOptions.env.TNN_EVOLVE_ELITISM = DEFAULT_EVOLVE_ELITISM;
configuration.instanceOptions.env.TNN_EVOLVE_EQUAL = DEFAULT_EVOLVE_EQUAL;
configuration.instanceOptions.env.TNN_EVOLVE_ERROR = DEFAULT_EVOLVE_ERROR;
configuration.instanceOptions.env.TNN_EVOLVE_MUTATION = DEFAULT_EVOLVE_MUTATION;
configuration.instanceOptions.env.TNN_EVOLVE_MUTATION_RATE = DEFAULT_EVOLVE_MUTATION_RATE;
configuration.instanceOptions.env.TNN_EVOLVE_POP_SIZE = DEFAULT_EVOLVE_POP_SIZE;
configuration.instanceOptions.env.TNN_EVOLVE_ACTIVATION = DEFAULT_EVOLVE_ACTIVATION;
configuration.instanceOptions.env.TNN_EVOLVE_COST = DEFAULT_EVOLVE_COST;
configuration.instanceOptions.env.TNN_EVOLVE_CLEAR = DEFAULT_EVOLVE_CLEAR;

configuration.instanceOptions.env.TNN_TRAIN_HIDDEN_LAYER_SIZE = DEFAULT_TRAIN_HIDDEN_LAYER_SIZE;
configuration.instanceOptions.env.TNN_TRAIN_ERROR = DEFAULT_TRAIN_ERROR;
configuration.instanceOptions.env.TNN_TRAIN_COST = DEFAULT_TRAIN_COST;
configuration.instanceOptions.env.TNN_TRAIN_RATE = DEFAULT_TRAIN_RATE;
configuration.instanceOptions.env.TNN_TRAIN_DROPOUT = DEFAULT_TRAIN_DROPOUT;
configuration.instanceOptions.env.TNN_TRAIN_SHUFFLE = DEFAULT_TRAIN_SHUFFLE;
configuration.instanceOptions.env.TNN_TRAIN_CLEAR = DEFAULT_TRAIN_CLEAR;
configuration.instanceOptions.env.TNN_TRAIN_MOMENTUM = DEFAULT_TRAIN_MOMENTUM;
configuration.instanceOptions.env.TNN_TRAIN_RATE_POLICY = DEFAULT_TRAIN_RATE_POLICY;
configuration.instanceOptions.env.TNN_TRAIN_BATCH_SIZE = DEFAULT_TRAIN_BATCH_SIZE;

// const User = require("mongoose").model("User");
// const Word = require("mongoose").model("Word");
const NeuralNetwork = require("mongoose").model("NeuralNetwork");

// const userServer = require("./app/controllers/user.server.controller");
// const neuralNetworkServer = require("./app/controllers/neuralNetwork.server.controller");

let currentSeedNetwork;
let currentBestNetwork;
const bestNetworksHashMap = new HashMap();
const instanceConfigHashMap = new HashMap();

function jsonPrint(obj) {
  if (obj) {
    return JSON.stringify(obj, null, 2);
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
  else {
    currentTimeStamp = moment(parseInt(inputTime)).format(compactDateTimeFormat);
    return currentTimeStamp;
  }
}

function msToTime(duration) {
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

const seedNetworkId = { name: "seedNetworkId", alias: "s", type: String};
const enableRandom = { name: "enableRandom", alias: "r", type: Boolean};
const targetServer = { name: "targetServer", alias: "S", type: String };
const enableStdin = { name: "enableStdin", alias: "i", type: Boolean, defaultValue: true };
const quitOnError = { name: "quitOnError", alias: "q", type: Boolean, defaultValue: true };
const verbose = { name: "verbose", alias: "v", type: Boolean };

const testMode = { name: "testMode", alias: "T", type: Boolean, defaultValue: false };
// const loadNeuralNetworkFileRunID = { name: "loadNeuralNetworkFileRunID", alias: "N", type: String };
const iterations = { name: "iterations", alias: "I", type: Number};

const optionDefinitions = [ seedNetworkId, enableRandom, targetServer, enableStdin, quitOnError, verbose, iterations, testMode];

const commandLineConfig = commandLineArgs(optionDefinitions);
console.log(chalkInfo("COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));
console.log("COMMAND LINE OPTIONS\n" + jsonPrint(commandLineConfig));

if (commandLineConfig.targetServer === "LOCAL"){
  commandLineConfig.targetServer = "http://localhost:9997/util";
}
if (commandLineConfig.targetServer === "REMOTE"){
  commandLineConfig.targetServer = "http://word.threeceelabs.com:9997/util";
}

// ==================================================================
// DROPBOX
// ==================================================================

const DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN || "nknEWsIkD5UAAAAAAAQouTDFRBKfwsFzuS8PPi2Q_JVYnpotNuaHiddNtmG4mUTi";

let dropboxClient = new Dropbox({ accessToken: DROPBOX_WORD_ASSO_ACCESS_TOKEN });

const DROPBOX_NNB_CONFIG_FILE = process.env.DROPBOX_NNB_CONFIG_FILE || "neuralNetworkBatchConfig.json";

const dropboxConfigFolder = "/config/utility";
const dropboxConfigHostFolder = "/config/utility/" + hostname;
const dropboxConfigFile = hostname + "_" + DROPBOX_NNB_CONFIG_FILE;


let stdin;

let statsObj = {};

statsObj.commandLineConfig = commandLineConfig;

statsObj.hostname = hostname;
statsObj.pid = process.pid;

statsObj.startTimeMoment = moment();
statsObj.startTime = moment().valueOf();
statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

statsObj.instances = {};
statsObj.instances.started = 0;
statsObj.instances.completed = 0;
statsObj.instances.errors = 0;
statsObj.instances.instanceIndex = 0;

const NNB_RUN_ID = "NNB_" + hostname + "_" + process.pid + "_" + statsObj.startTimeMoment.format(compactDateTimeFormat);
statsObj.runId = NNB_RUN_ID;
console.log(chalkAlert("RUN ID: " + statsObj.runId));

const statsFolder = "/stats/" + hostname + "/neuralNetworkBatch";
const statsFile = "neuralNetworkBatch_" + statsObj.runId + ".json";
console.log(chalkInfo("STATS FILE : " + statsFolder + "/" + statsFile));


const USER_ID = NNB_RUN_ID;
const SCREEN_NAME = NNB_RUN_ID;

let userObj = { 
  name: USER_ID, 
  nodeId: USER_ID, 
  userId: USER_ID, 
  utilId: USER_ID, 
  url: "https://word.threeceelabs.com", 
  screenName: SCREEN_NAME, 
  namespace: "util", 
  type: "util", 
  mode: "batch",
  tags: {},
  stats: {}
};

userObj.tags.entity = USER_ID;
userObj.tags.mode = "util";
userObj.tags.channel = "neural_network";
userObj.tags.url = "https://word.threeceelabs.com";


let processPollInterval;
let statsUpdateInterval;

function showStats(options){

  statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

  if (options) {
    console.log("\n\nSTATS\n" + jsonPrint(statsObj));
  }
  else {
    console.log(chalkLog("\nS"
      + " | RUN " + statsObj.elapsed
      + " | NOW " + moment().format(compactDateTimeFormat)
      + " | STRT " + moment(parseInt(statsObj.startTime)).format(compactDateTimeFormat)
      + " | ITERATIONS " + configuration.iterations
    ));
    printInstanceConfigHashMap();
  }
}

let slack = new Slack(slackOAuthAccessToken);
function slackPostMessage(channel, text, callback){

  debug(chalkInfo("SLACK POST: " + text));

  slack.api("chat.postMessage", {
    text: text,
    channel: channel
  }, function(err, response){
    if (err){
      console.error(chalkError("*** SLACK POST MESSAGE ERROR\n" + err));
    }
    else {
      debug(response);
    }
    if (callback !== undefined) { callback(err, response); }
  });
}

let appHashMap = {};

function quit(){

  console.log(chalkAlert( "\n\n... QUITTING ...\n\n" ));

  clearInterval(processPollInterval);
  clearInterval(statsUpdateInterval);

  statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

  Object.keys(appHashMap).forEach(function(instanceName){
    pm2.delete(instanceName, function(err, results){
      if (err) {
        console.error(chalkError("pm2 DELETE ERROR\n" + err));
      }
      console.log(chalkAlert("PM2 DELETE APP: " + instanceName));
      debug(chalkAlert("PM2 DELETE RESULTS\n " + jsonPrint(results)));
    });
  });

  const slackText = "QUIT BATCH\n" + getTimeStamp() + "\n" + statsObj.runId;

  showStats(true);

  slackPostMessage(slackChannel, slackText, function(){
    setTimeout(function(){
      pm2.disconnect();   // Disconnects from PM2
      process.exit();
    }, 3000);
  });
}

function saveFile (path, file, jsonObj, callback){

  const fullPath = path + "/" + file;

  debug(chalkInfo("LOAD FOLDER " + path));
  debug(chalkInfo("LOAD FILE " + file));
  debug(chalkInfo("FULL PATH " + fullPath));

  let options = {};

  options.contents = JSON.stringify(jsonObj, null, 2);
  // options.contents = jsonObj;
  options.path = fullPath;
  options.mode = "overwrite";
  options.autorename = false;

  dropboxClient.filesUpload(options)
    .then(function(response){
      debug(chalkLog("SAVED DROPBOX JSON | " + options.path));
      callback(null, response);
    })
    .catch(function(error){
      if (error.status === 429) {
        console.error(chalkAlert("TOO MANY DROPBOX WRITES"));
      }
      else {
        console.error(chalkError(moment().format(defaultDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + "\nERROR: " + error
          + "\nERROR: " + jsonPrint(error)
          // + "\nERROR\n" + jsonPrint(error)
        ));
      }
      callback(error, null);
    });
}

function loadFile(path, file, callback) {

  console.log(chalkInfo("LOAD FOLDER " + path));
  console.log(chalkInfo("LOAD FILE " + file));
  console.log(chalkInfo("FULL PATH " + path + "/" + file));

  let fileExists = false;

  dropboxClient.filesListFolder({path: path})
    .then(function(response) {

        async.each(response.entries, function(folderFile, cb) {

          debug("FOUND FILE " + folderFile.name);

          if (folderFile.name === file) {
            debug(chalkAlert("SOURCE FILE EXISTS: " + path + "/" + file));
            fileExists = true;
          }

          cb();

        }, function(err) {

          if (err) {
            console.log(chalkError("ERR\n" + jsonPrint(err)));
            return(callback(err, null));
          }

          if (fileExists) {

            dropboxClient.filesDownload({path: path + "/" + file})
              .then(function(data) {
                console.log(chalkLog(getTimeStamp()
                  + " | LOADING FILE FROM DROPBOX FILE: " + path + "/" + file
                ));

                let payload = data.fileBinary;
                debug(payload);

                if (file.match(/\.json$/gi)) {
                  let fileObj = JSON.parse(payload);
                  return(callback(null, fileObj));
                }
                else {
                  return(callback(null, payload));
                }

              })
              .catch(function(error) {
                console.log(chalkError("DROPBOX loadFile ERROR: " + file + "\n" + error));
                console.log(chalkError("!!! DROPBOX READ " + file + " ERROR"));
                console.log(chalkError(jsonPrint(error)));

                if (error.status === 404) {
                  console.error(chalkError("!!! DROPBOX READ FILE " + file + " NOT FOUND"
                    + " ... SKIPPING ...")
                  );
                  return(callback(null, null));
                }
                if (error.status === 0) {
                  console.error(chalkError("!!! DROPBOX NO RESPONSE"
                    + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
                  return(callback(null, null));
                }
                return(callback(error, null));
              });
          }
          else {
            console.log(chalkError("*** FILE DOES NOT EXIST: " + path + "/" + file));
            return(callback({status: 404}, null));
          }
        });
    })
    .catch(function(err) {
      console.log(chalkError("*** ERROR DROPBOX LOAD FILE\n" + err));
      callback(err, null);
    });
}

function initStatsUpdate(cnf, callback){

  console.log(chalkBlue("INIT STATS UPDATE INTERVAL | " + cnf.statsUpdateIntervalTime + " MS"));

  clearInterval(statsUpdateInterval);

  statsUpdateInterval = setInterval(function () {

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
    statsObj.timeStamp = moment().format(defaultDateTimeFormat);

    saveFile(statsFolder, statsFile, statsObj, function(){
      showStats();
    });

  }, cnf.statsUpdateIntervalTime);

  callback(null, cnf);
}

function initStdIn(){
  console.log("STDIN ENABLED");
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
        console.log(chalkAlert("VERBOSE: " + configuration.verbose));
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
}

let userReadyInterval;
function initUserReadyInterval(interval){

  console.log(chalkInfo("INIT USER READY INTERVAL"));

  clearInterval(userReadyInterval);

  userReadyInterval = setInterval(function(){

    if (serverConnected && !userReadyTransmitted && !userReadyAck){

      userReadyTransmitted = true; 
      userObj.timeStamp = moment().valueOf();
      socket.emit("USER_READY", {userId: userObj.userId, timeStamp: moment().valueOf()}); 

    }
    else if (userReadyTransmitted && !userReadyAck) {

      statsObj.userReadyAckWait += 1;
      console.log(chalkAlert("... WAITING FOR USER_READY_ACK ..."));

    }
  }, interval);
}

function sendKeepAlive(userObj, callback){
  if (userReadyAck && serverConnected){
    debug(chalkInfo("TX KEEPALIVE"
      + " | " + userObj.userId
      + " | " + moment().format(defaultDateTimeFormat)
    ));
    socket.emit("SESSION_KEEPALIVE", userObj);
    callback(null);
  }
  else {
    console.log(chalkError("!!!! CANNOT TX KEEPALIVE"
      + " | " + userObj.userId
      + " | CONNECTED: " + serverConnected
      + " | READY ACK: " + userReadyAck
      + " | " + moment().format(defaultDateTimeFormat)
    ));
    callback("ERROR");
  }
}


let socketKeepaliveInterval;
function initKeepalive(userObj, interval){

  let keepaliveIndex = 0;

  clearInterval(socketKeepaliveInterval);

  console.log(chalkAlert("START PRIMARY KEEPALIVE"
    // + " | USER ID: " + userId
    + " | READY ACK: " + userReadyAck
    + " | SERVER CONNECTED: " + serverConnected
    + " | INTERVAL: " + interval + " ms"
  ));

  sendKeepAlive(userObj, function(err){
    if (err) {
      console.log(chalkError("KEEPALIVE ERROR: " + err));
    }
    debug(chalkAlert("KEEPALIVE"
      + " | " + moment().format(defaultDateTimeFormat)
    ));
  });

  socketKeepaliveInterval = setInterval(function(){ // TX KEEPALIVE

    userObj.stats = statsObj;

    sendKeepAlive(userObj, function(err){
      if (err) {
        console.log(chalkError("KEEPALIVE ERROR: " + err));
      }
      debug(chalkAlert("KEEPALIVE"
        + " | " + moment().format(defaultDateTimeFormat)
      ));
    });

    keepaliveIndex += 1;

  }, interval);
}

function initSocket(cnf, callback){

  if (OFFLINE_MODE){
    return(callback(null, null));
  }

  console.log(chalkLog("INIT SOCKET"
    + " | " + cnf.targetServer
    + " | " + jsonPrint(userObj)
  ));

  socket = require("socket.io-client")(cnf.targetServer);

  socket.on("connect", function(){

    serverConnected = true ;
    userReadyTransmitted = false;
    userReadyAck = false ;

    statsObj.socketId = socket.id;

    console.log(chalkAlert( "CONNECTED TO HOST" 
      + " | SERVER: " + cnf.targetServer 
      + " | ID: " + socket.id 
    ));

    initUserReadyInterval(5000);
  });

  socket.on("reconnect", function(){
    serverConnected = true ;
    userReadyAck = false ;
    console.log(chalkAlert(moment().format(defaultDateTimeFormat) 
      + " | SOCKET RECONNECT: " + socket.id));
  });

  socket.on("USER_READY_ACK", function(ackObj) {

    clearInterval(userReadyInterval);

    serverConnected = true ;
    userReadyAck = true ;

    console.log(chalkAlert("RX USER_READY_ACK"
      + " | " + moment().format(defaultDateTimeFormat)
      + " | " + socket.id
      + " | USER ID: " + ackObj.userId
      + " | ACK TIMESTAMP: " + moment(parseInt(ackObj.timeStamp)).format(compactDateTimeFormat)
    ));

    initKeepalive(userObj, cnf.keepaliveInterval);
  });

  socket.on("error", function(err){
    userReadyTransmitted = false;
    userReadyAck = false ;
    serverConnected = false ;
    console.log(chalkAlert(moment().format(compactDateTimeFormat)
      + " | ***** SOCKET ERROR"
      + " | " + err.type
      + " | " + err.description
    ));
  });

  socket.on("connect_error", function(err){
    userReadyTransmitted = false;
    userReadyAck = false ;
    serverConnected = false ;
    console.log(chalkAlert(moment().format(compactDateTimeFormat)
      + " | ***** SOCKET CONNECT ERROR"
      + " | " + err.type
      + " | " + err.description
    ));

    slackPostMessage(slackChannel, "\n*SOCKET CONN ERROR*"
      + "\n*" + userObj.userId + "*\n"
      + "\n*TYPE: " + err.type + "*\n"
      + "\n" + err.description + "\n"
    );
  });

  socket.on("reconnect_error", function(){
    userReadyTransmitted = false;
    userReadyAck = false ;
    serverConnected = false ;
    console.log(chalkAlert(moment().format(compactDateTimeFormat)
      + " | ***** SOCKET RECONNECT ERROR"
    ));
  });

  socket.on("disconnect", function(){
    userReadyTransmitted = false;
    userReadyAck = false ;
    serverConnected = false;
    console.log(chalkAlert(moment().format(compactDateTimeFormat)
      + " | ***** SOCKET DISCONNECT"
    ));
 
    slackPostMessage(slackChannel, "\n*SOCKET DISCONN*"
      + "\n*" + userObj.userId + "*\n"
    );
  });

  socket.on("SET_ITERATIONS", function(value){
    console.log(chalkAlert("RX SET_ITERATIONS | " + value));
  });

  socket.on("KEEPALIVE_ACK", function(userId) {
    debug(chalkLog("RX KEEPALIVE_ACK | " + userId));
  });

  callback(null, null);
}

function printNetworkObj(title, nnObj){
  console.log(chalkNetwork("\n==================="
    + "\n" + title
    + "\nID:      " + nnObj.networkId
    + "\nCREATED: " + getTimeStamp(nnObj.createdAt)
    + "\nSUCCESS: " + nnObj.successRate.toFixed(2) + "%"
    + "\nINPUTS:  " + Object.keys(nnObj.inputs)
    + "\nEVOLVE\n" + jsonPrint(nnObj.evolve)
    + "\nTRAIN\n" + jsonPrint(nnObj.train)
    + "\n===================\n"
  ));
}

function loadSeedNeuralNetwork(options, callback){

  console.log(chalkNetwork("LOADING SEED NETWORK FROM DB\nOPTIONS: " + jsonPrint(options)));

  let findQuery = {};
  let findOneNetwork = false;
  let newBestNetwork = false;

  if ((options.networkId !== undefined) && (options.networkId !== "false")) {

    if (options.networkId === "BEST") {
      console.log(chalkAlert("LOADING " + DEFAULT_BEST_NETWORK_NUMBER + " BEST NETWORKS"));
    }
    else {
      findOneNetwork = true;
      findQuery.networkId = options.networkId;
      console.log(chalkAlert("LOADING SEED NETWORK " + options.networkId));
    }

  }

  NeuralNetwork.find(findQuery, null, {sort: {successRate: -1}, limit: DEFAULT_BEST_NETWORK_NUMBER}, function(err, nnArray){
    if (err) {
      console.log(chalkError("NEUAL NETWORK FIND ERR"
        + "\n" + jsonPrint(findQuery)
        + "\n" + err
      ));
      if (callback !== undefined) { callback(err, null); }
    }
    else if (nnArray.length === 0){
      console.log("NO NETWORKS FOUND");
      if (callback !== undefined) { callback(err, null); }
    }
    else{
      console.log(nnArray.length + " NETWORKS FOUND");

      if (findOneNetwork) {
        currentSeedNetwork = nnArray[0];
      }
      else {

        if (!currentBestNetwork || (nnArray[0].successRate > currentBestNetwork.successRate)) {

          console.log(chalkNetwork("NEW MAX NN"
            + " | CREATE: " + nnArray[0].networkCreateMode
            + " | ID: " + nnArray[0].networkId
            + " | IN: " + nnArray[0].network.input
            + " | OUT: " + nnArray[0].network.output
            + " | SUCCESS: " + nnArray[0].successRate.toFixed(2) + "%"
          ));

          newBestNetwork = true;
        }

        currentBestNetwork = nnArray[0];

        bestNetworksHashMap.clear();
        nnArray.forEach(function(nn){
          bestNetworksHashMap.set(nn.networkId, nn);
        });
      }

      if (findOneNetwork && currentSeedNetwork){
        printNetworkObj("LOADING NEURAL NETWORK", currentSeedNetwork);
      }

      let messageText;

      if (newBestNetwork) {

        statsObj.bestNetworkId = currentBestNetwork.networkId;

        printNetworkObj("NEW SEED NETWORK", currentBestNetwork);

        messageText = "\n*NN NEW SEED*\n*" 
          + currentBestNetwork.networkId + "*\n*"
          + currentBestNetwork.successRate.toFixed(2) + "%*\n"
          + currentBestNetwork.networkCreateMode + "*\n"
          + getTimeStamp(currentBestNetwork.createdAt) + "\n"
          + jsonPrint(currentBestNetwork.evolve) + "\n";

        slackPostMessage(slackChannel, messageText);

      }

      if (currentSeedNetwork) {

        statsObj.seedNetworkId = currentSeedNetwork.networkId;

        messageText = "\n*NN SEED*\n*" 
          + currentSeedNetwork.networkId + "*\n*"
          + currentSeedNetwork.successRate.toFixed(2) + "%*\n"
          + currentBestNetwork.networkCreateMode + "*\n"
          + getTimeStamp(currentSeedNetwork.createdAt) + "\n"
          + jsonPrint(currentSeedNetwork.evolve) + "\n";

        slackPostMessage(slackChannel, messageText);
      }

      if (callback !== undefined) { 
        callback(null, {best: currentBestNetwork, seed: currentSeedNetwork});
      }
      // });
    }
  });
}

function initInstance(instanceIndex, options, callback){

  const runId = hostname + "_" + process.pid + "_" + instanceIndex;
  const instanceName = "NNB_" + runId;

  let logfile = "/Users/tc/logs/batch/neuralNetwork/" + hostname + "/" + instanceName + ".log";

  if (hostname.includes("google")){
    logfile = "/home/tc/logs/batch/neuralNetwork/" + hostname + "/" + instanceName + ".log";
  }

  let currentOptions = {};
   currentOptions = defaults(options, {
    name: instanceName,
    out_file: logfile,
    error_file: logfile
  });

  currentOptions.env.TNN_PROCESS_NAME = instanceName;
  currentOptions.env.TNN_RUN_ID = runId;

  console.log("INIT INSTANCE " + instanceIndex
    + " | " + currentOptions.name
    + " | ID: " + currentOptions.env.TNN_RUN_ID
    + " | ITERATIONS: " + currentOptions.env.TNN_ITERATIONS
    // + " | " + currentOptions.out_file
  );

  const opt = deepcopy(currentOptions);

  console.log("\n***** CURRENT INSTANCE OPTIONS *****\n" + jsonPrint(opt));

  callback(opt);
}

function startInstance(instanceConfig, callback){

  pm2.start(instanceConfig, function(err, apps) {

    if (err) {
      console.error(chalkError("PM2 START ERROR\n" + err));
      return(callback(err));
    }

    let instanceObj = {};

    instanceObj.id = instanceConfig.name;
    instanceObj.config = instanceConfig;
    instanceObj.stats = {};
    instanceObj.stats.started = moment().valueOf();
    instanceObj.stats.elapsed = 0;
    instanceObj.stats.ended = 0;
    instanceObj.results = {};
    instanceObj.results.successRate = 0;

    console.log(chalkInfo("START INSTANCE\n" + jsonPrint(instanceConfig)));
    instanceConfigHashMap.set(instanceObj.id, instanceObj);
    printInstanceConfigHashMap();

    statsObj.instances.started += 1;


    if (apps.length > 0) {

      console.log(chalkAlert("START"
        + " | " + instanceConfig.env.TNN_NETWORK_CREATE_MODE.toUpperCase()
        + " | " + apps[0].pm2_env.TNN_RUN_ID
        // + " | " + apps[0].pm2_env.name
        + " | PM2 ID: " + apps[0].pm2_env.pm_id
        + " | PID: " + apps[0].process.pid
        + " | ITERATIONS: " + apps[0].pm2_env.TNN_ITERATIONS
        + " | STATUS: " + apps[0].pm2_env.status
      ));

      appHashMap[apps[0].pm2_env.name] = apps[0];

    }

    setTimeout(function(){
      if (callback !== undefined) { 
        callback(err);
      }
    }, 1000);


  });
}

const noInstancesRunning = function(){
  return (Object.keys(appHashMap).length === 0);
};

const generateRandomEvolveEnv = function(cnf){

  let env = {};

  env.TNN_BATCH_MODE = true;
  env.TNN_STATS_UPDATE_INTERVAL = 120000;

  env.TNN_ITERATIONS = cnf.iterations;

  env.TNN_NETWORK_CREATE_MODE = randomItem(["evolve", "train"]);
  // env.TNN_NETWORK_CREATE_MODE = randomItem(["train"]);

  console.log(chalkAlert("NETWORK CREATE MODE: " + env.TNN_NETWORK_CREATE_MODE));

  if (currentSeedNetwork) {

    env.TNN_SEED_NETWORK_ID = currentSeedNetwork.networkId;

    console.log(chalkAlert("\nSEED NETWORK\n----------------------------------"));
    console.log(chalkAlert(currentSeedNetwork.successRate.toFixed(2) + " | " + currentSeedNetwork.networkId));
    console.log(chalkAlert("----------------------------------"));
  }
  else {

    // const randomNetworkArray = bestNetworksHashMap.keys().concat([null]);

    console.log(chalkAlert("\nBEST NETWORKS\n----------------------------------"));

    bestNetworksHashMap.forEach(function(nn, nnId){
      console.log(chalkAlert(nn.successRate.toFixed(2) + " | " + nnId));
    });

    console.log(chalkAlert("----------------------------------"));

    env.TNN_SEED_NETWORK_ID = (Math.random() > SEED_NETWORK_PROBABILITY) ? randomItem(bestNetworksHashMap.keys()) : false;

    if (!env.TNN_SEED_NETWORK_ID) {
      env.TNN_EVOLVE_ARCHITECTURE = "perceptron";
    }

    if (!env.TNN_SEED_NETWORK_ID) {
      env.TNN_TRAIN_ARCHITECTURE = "perceptron";
    }
  }

  env.TNN_EVOLVE_ACTIVATION = randomItem(EVOLVE_ACTIVATION_ARRAY);
  env.TNN_EVOLVE_COST = randomItem(EVOLVE_COST_ARRAY);
  env.TNN_EVOLVE_CLEAR = randomItem([true, false]);
  env.TNN_EVOLVE_EQUAL = randomItem([true, false]);
  env.TNN_EVOLVE_MUTATION_RATE = randomFloat(EVOLVE_MUTATION_RATE_RANGE.min, EVOLVE_MUTATION_RATE_RANGE.max);
  env.TNN_EVOLVE_POP_SIZE = randomInt(EVOLVE_POP_SIZE_RANGE.min, EVOLVE_POP_SIZE_RANGE.max);
  env.TNN_EVOLVE_ELITISM = randomInt(EVOLVE_ELITISM_RANGE.min, EVOLVE_ELITISM_RANGE.max);

  env.TNN_TRAIN_ERROR = randomInt(TRAIN_ERROR_RANGE.min, TRAIN_ERROR_RANGE.max);
  env.TNN_TRAIN_COST = randomItem(TRAIN_COST_ARRAY);
  env.TNN_TRAIN_HIDDEN_LAYER_SIZE = randomInt(TRAIN_HIDDEN_LAYER_SIZE_RANGE.min, TRAIN_HIDDEN_LAYER_SIZE_RANGE.max);
  env.TNN_TRAIN_RATE = randomFloat(TRAIN_RATE_RANGE.min, TRAIN_RATE_RANGE.max);
  env.TNN_TRAIN_DROPOUT = randomFloat(TRAIN_DROPOUT_RANGE.min, TRAIN_DROPOUT_RANGE.max);
  env.TNN_TRAIN_SHUFFLE = randomItem([true, false]);
  env.TNN_TRAIN_CLEAR = randomItem([true, false]);
  env.TNN_TRAIN_MOMENTUM = randomFloat(TRAIN_MOMENTUM_RANGE.min, TRAIN_MOMENTUM_RANGE.max);
  env.TNN_TRAIN_RATE_POLICY = randomItem(TRAIN_RATE_POLICY_ARRAY);
  env.TNN_TRAIN_BATCH_SIZE = randomInt(TRAIN_BATCH_SIZE_RANGE.min, TRAIN_BATCH_SIZE_RANGE.max);

  debug(chalkAlert("NNB RANDOM ENV\n" + jsonPrint(env)));

  return(env);
};

function loadDropboxConfig(callback){

  let cnf = deepcopy(configuration);

  loadFile(dropboxConfigHostFolder, dropboxConfigFile, function(err, loadedConfigObj){

    let commandLineConfigKeys;
    let configArgs;

    if (!err) {
      console.log(dropboxConfigHostFolder + "/" + dropboxConfigFile + "\n" + jsonPrint(loadedConfigObj));

      if (loadedConfigObj.NNB_ENABLE_RANDOM  !== undefined){
        console.log("LOADED NNB_ENABLE_RANDOM: " + loadedConfigObj.NNB_ENABLE_RANDOM);
        cnf.enableRandom = loadedConfigObj.NNB_ENABLE_RANDOM;
      }

      if (loadedConfigObj.NNB_ITERATIONS  !== undefined){
        console.log("LOADED NNB_ITERATIONS: " + loadedConfigObj.NNB_ITERATIONS);
        cnf.iterations = loadedConfigObj.NNB_ITERATIONS;
      }

      if (loadedConfigObj.NNB_MAX_INSTANCES  !== undefined){
        console.log("LOADED NNB_MAX_INSTANCES: " + loadedConfigObj.NNB_MAX_INSTANCES);
        cnf.maxInstances = loadedConfigObj.NNB_MAX_INSTANCES;
      }

      if (loadedConfigObj.NNB_VERBOSE_MODE  !== undefined){
        console.log("LOADED NNB_VERBOSE_MODE: " + loadedConfigObj.NNB_VERBOSE_MODE);
        cnf.verbose = loadedConfigObj.NNB_VERBOSE_MODE;
      }

      if (loadedConfigObj.NNB_TEST_MODE  !== undefined){
        console.log("LOADED NNB_TEST_MODE: " + loadedConfigObj.NNB_TEST_MODE);
        cnf.testMode = loadedConfigObj.NNB_TEST_MODE;
      }

      if (loadedConfigObj.NNB_ENABLE_STDIN  !== undefined){
        console.log("LOADED NNB_ENABLE_STDIN: " + loadedConfigObj.NNB_ENABLE_STDIN);
        cnf.enableStdin = loadedConfigObj.NNB_ENABLE_STDIN;
      }

      if (loadedConfigObj.NNB_STATS_UPDATE_INTERVAL  !== undefined) {
        console.log("LOADED NNB_STATS_UPDATE_INTERVAL: " + loadedConfigObj.NNB_STATS_UPDATE_INTERVAL);
        cnf.statsUpdateIntervalTime = loadedConfigObj.NNB_STATS_UPDATE_INTERVAL;
      }

      if (loadedConfigObj.NNB_KEEPALIVE_INTERVAL  !== undefined) {
        console.log("LOADED NNB_KEEPALIVE_INTERVAL: " + loadedConfigObj.NNB_KEEPALIVE_INTERVAL);
        cnf.keepaliveInterval = loadedConfigObj.NNB_KEEPALIVE_INTERVAL;
      }

      // OVERIDE CONFIG WITH COMMAND LINE ARGS

      commandLineConfigKeys = Object.keys(commandLineConfig);

      async.each(commandLineConfigKeys, function(arg, cb){

        if (arg === "enableRandom") {
          cnf[arg] = commandLineConfig[arg] || cnf[arg];
        }
        else {
          cnf[arg] = commandLineConfig[arg];
        }
        console.log("--> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);

        cb();

      }, function(){

        configArgs = Object.keys(cnf);

        configArgs.forEach(function(arg){
          console.log(chalkAlert(">>> FINAL CONFIG (FILE) | " + arg + ": " + cnf[arg]));
        });

        callback(null, cnf);

      });
    }
    else {
      console.log(chalkError("ERROR LOADING CONFIG: " + err));
      callback(err, cnf);
    }
  });
}

function printInstanceConfigHashMap(){
  console.log("\nNNB INSTANCE CONFIG HASH MAP_____________________________________");
  instanceConfigHashMap.forEach(function(instanceObj, nnId){

    if (instanceObj.stats.ended === 0) {
      instanceObj.stats.elapsed = moment().valueOf() - instanceObj.stats.started;
      instanceConfigHashMap.set(nnId, instanceObj);
    }

    console.log(nnId
      // + "\n" + jsonPrint(instanceObj)
      + " | " + instanceObj.config.env.TNN_NETWORK_CREATE_MODE
      + " | N: " + getTimeStamp()
      + " | S: " + getTimeStamp(instanceObj.stats.started)
      + " | RUN: " + msToTime(instanceObj.stats.elapsed)
      + " | RESULTS: " + instanceObj.results.successRate.toFixed(1) + "%"
    );
  });
  console.log("_____________________________________________________________\n");
}

function initProcessPollInterval(interval){

  console.log(chalkInfo("INIT PROCESS POLL INTERVAL | " + interval));

  const seedOpt = {};
  if (configuration.seedNetworkId) {
    seedOpt.networkId = configuration.seedNetworkId;
  }

  loadSeedNeuralNetwork(seedOpt, function(err, results){
    if (err) {
      console.error(chalkError("loadSeedNeuralNetwork ERROR: " + err));
    }
    if (results.best) {
      console.log(chalkAlert("LOAD NN"
        + " | BEST: " + results.best.networkId
        + " " + results.best.successRate.toFixed(2) + "%"
      ));
    }
    if (results.seed) {
      console.log(chalkAlert("LOAD NN"
        + " | SEED: " + results.seed.networkId
        + " " + results.seed.successRate.toFixed(2) + "%"
      ));
    }
  });

  processPollInterval = setInterval(function(){

    loadDropboxConfig(function(err, cnf){

      if (Object.keys(appHashMap).length < cnf.maxInstances) {

        let options = deepcopy(cnf.instanceOptions);

        if (cnf.enableRandom){
          options.env = generateRandomEvolveEnv(cnf);
        }

        initInstance(statsObj.instances.instanceIndex, options, function(opt){

          const instanceOptions = deepcopy(opt);

          startInstance(instanceOptions);

          statsObj.instances.instanceIndex += 1;

        });
      }

      pm2.list(function(err, apps){

        if (err) { throw err; }
        if (!cnf.autoStartInstance && noInstancesRunning()) { 
          quit(); 
        }
        else  {
          showStats();
          console.log("\nAPPS__________________________________________");

          apps.forEach(function(app){

            console.log(app.name
              + " | PM2 ID: " + app.pm2_env.pm_id
              + " | " + app.pm2_env.TNN_NETWORK_CREATE_MODE
              + " | PID: " + app.pid
              + " | STATUS: " + app.pm2_env.status
              + " | ITR: " + app.pm2_env.TNN_ITERATIONS
              + " | START: " + moment(parseInt(app.pm2_env.created_at)).format(compactDateTimeFormat)
              // + " | UPTIME: " + app.pm2_env.pm_uptime
              + " | RUN: " + msToTime(moment().valueOf()-parseInt(app.pm2_env.created_at))
            );

            if (appHashMap[app.name] && app.pm2_env.status === "stopped"){

              loadSeedNeuralNetwork(seedOpt, function(err, results){
                if (err) {
                  console.error(chalkError("loadSeedNeuralNetwork ERROR: " + err));
                }
                if (results.best) {
                  console.log(chalkAlert("LOAD NN"
                    + " | BEST: " + results.best.networkId
                    + " " + results.best.successRate.toFixed(2) + "%"
                  ));
                }
                if (results.seed) {
                  console.log(chalkAlert("LOAD NN"
                    + " | SEED: " + results.seed.networkId
                    + " " + results.seed.successRate.toFixed(2) + "%"
                  ));
                }
              });

              const nnId = app.name.replace("NNB_", "");

              NeuralNetwork.find({networkId: nnId}, function(err, nnArray){

                if (err){
                  console.log(chalkError("*** DB NN FIND ERROR: " + nnId + " | " + err));
                }
                else if (nnArray.length === 0){
                  console.log(chalkError("??? DB NN NOT FOUND: " + nnId));
                }
                else {

                  const nn = nnArray[0];

                  debug("<DB NETWORK\n" + jsonPrint(nn));

                  console.log("<DB NETWORK"
                    + " | " + nn.networkId 
                    + " | CREATE: " + nn.networkCreateMode.toUpperCase()
                    + " | SUCCESS: " + nn.successRate.toFixed(1) + "%"
                    + " | IN: " + nn.network.input
                    + " | OUT: " + nn.network.output
                    // + " | EVOLVE:  " + jsonPrint(nn.evolve) 
                    // + " | TRAIN:   " + jsonPrint(nn.train)
                    // + " | TEST:    " + jsonPrint(nn.test)
                    + " | CREATED: " + moment(new Date(nn.createdAt)).format(compactDateTimeFormat) 
                  );

                  let instanceObj = instanceConfigHashMap.get(app.name);

                  instanceObj.stats.elapsed = moment().valueOf() - instanceObj.stats.started;  
                  instanceObj.stats.ended = moment().valueOf();
                  instanceObj.results.successRate = nn.successRate;
                  instanceConfigHashMap.set(instanceObj.id, instanceObj);

                  printInstanceConfigHashMap();

                  statsObj.instances.completed += 1;

                  pm2.delete(app.pm2_env.pm_id, function(err, results){

                    delete appHashMap[app.name];

                    if (err) { 
                      console.log(chalkError("PM2 DELETE ERROR: " + err));
                    }
                    else {
                      debug("PM2 DELETE RESULTS\n" + results);
                    }

                  });

                }

              });

            }
          });
        }
      });

    });

  }, interval);
}

function initBatch(callback){

  const seedOpt = {};
  if (configuration.seedNetworkId) {
    seedOpt.networkId = configuration.seedNetworkId;
  }

  loadSeedNeuralNetwork(seedOpt, function(err, results){

    if (err) {
      console.error(chalkError("loadSeedNeuralNetwork ERROR: " + err));
    }

    if (results.best) {
      console.log(chalkAlert("LOAD NN"
        + " | BEST: " + results.best.networkId
        + " " + results.best.successRate.toFixed(2) + "%"
      ));
    }
    if (results.seed) {
      console.log(chalkAlert("LOAD NN"
        + " | SEED: " + results.seed.networkId
        + " " + results.seed.successRate.toFixed(2) + "%"
      ));
    }

    console.log(chalkAlert("INIT BATCH"
      + " | " + getTimeStamp()
    ));

    pm2.connect(function(err) {

      if (err) {
        console.error(err);
        callback(err);
        process.exit(2);
      }


      initProcessPollInterval(configuration.processPollInterval);
      callback(null);

    });

  });

}

function initialize(cnf, callback){

  console.log(chalkBlue("INITIALIZE cnf\n" + jsonPrint(cnf)));

  if (debug.enabled){
    console.log("\n%%%%%%%%%%%%%%\n DEBUG ENABLED \n%%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.NNB_PROCESS_NAME || "neuralNetworkBatch";

  cnf.targetServer = process.env.TNNB_UTIL_TARGET_SERVER || "http://localhost:9997/util" ;

  cnf.verbose = process.env.NNB_VERBOSE_MODE || false ;
  cnf.quitOnError = process.env.NNB_QUIT_ON_ERROR || false ;
  cnf.enableStdin = process.env.NNB_ENABLE_STDIN || true ;
  cnf.iterations = process.env.NNB_ITERATIONS || DEFAULT_ITERATIONS ;
  cnf.maxInstances = process.env.NNB_MAX_INSTANCES || DEFAULT_BATCH_MAX_INSTANCES ;

  cnf.enableRandom = process.env.NNB_ENABLE_RANDOM || DEFAULT_ENABLE_RANDOM ;
  cnf.seedNetworkId = process.env.NNB_SEED_NETWORK_ID || DEFAULT_SEED_NETWORK_ID ;

  cnf.statsUpdateIntervalTime = process.env.NNB_STATS_UPDATE_INTERVAL || DEFAULT_STATS_INTERVAL;

  debug(chalkWarn("dropboxConfigFolder: " + dropboxConfigFolder));
  debug(chalkWarn("dropboxConfigFile  : " + dropboxConfigFile));

  loadFile(dropboxConfigHostFolder, dropboxConfigFile, function(err, loadedConfigObj){

    let commandLineConfigKeys;
    let configArgs;

    if (!err) {
      console.log(dropboxConfigFile + "\n" + jsonPrint(loadedConfigObj));

      if (loadedConfigObj.NNB_ENABLE_RANDOM  !== undefined){
        console.log("LOADED NNB_ENABLE_RANDOM: " + loadedConfigObj.NNB_ENABLE_RANDOM);
        cnf.enableRandom = loadedConfigObj.NNB_ENABLE_RANDOM;
      }

      if (loadedConfigObj.NNB_ITERATIONS  !== undefined){
        console.log("LOADED NNB_ITERATIONS: " + loadedConfigObj.NNB_ITERATIONS);
        cnf.iterations = loadedConfigObj.NNB_ITERATIONS;
      }

      if (loadedConfigObj.NNB_MAX_INSTANCES  !== undefined){
        console.log("LOADED NNB_MAX_INSTANCES: " + loadedConfigObj.NNB_MAX_INSTANCES);
        cnf.maxInstances = loadedConfigObj.NNB_MAX_INSTANCES;
      }

      if (loadedConfigObj.NNB_VERBOSE_MODE  !== undefined){
        console.log("LOADED NNB_VERBOSE_MODE: " + loadedConfigObj.NNB_VERBOSE_MODE);
        cnf.verbose = loadedConfigObj.NNB_VERBOSE_MODE;
      }

      if (loadedConfigObj.NNB_TEST_MODE  !== undefined){
        console.log("LOADED NNB_TEST_MODE: " + loadedConfigObj.NNB_TEST_MODE);
        cnf.testMode = loadedConfigObj.NNB_TEST_MODE;
      }

      if (loadedConfigObj.NNB_ENABLE_STDIN  !== undefined){
        console.log("LOADED NNB_ENABLE_STDIN: " + loadedConfigObj.NNB_ENABLE_STDIN);
        cnf.enableStdin = loadedConfigObj.NNB_ENABLE_STDIN;
      }

      if (loadedConfigObj.NNB_STATS_UPDATE_INTERVAL  !== undefined) {
        console.log("LOADED NNB_STATS_UPDATE_INTERVAL: " + loadedConfigObj.NNB_STATS_UPDATE_INTERVAL);
        cnf.statsUpdateIntervalTime = loadedConfigObj.NNB_STATS_UPDATE_INTERVAL;
      }

      if (loadedConfigObj.NNB_KEEPALIVE_INTERVAL  !== undefined) {
        console.log("LOADED NNB_KEEPALIVE_INTERVAL: " + loadedConfigObj.NNB_KEEPALIVE_INTERVAL);
        cnf.keepaliveInterval = loadedConfigObj.NNB_KEEPALIVE_INTERVAL;
      }

      // OVERIDE CONFIG WITH COMMAND LINE ARGS

      commandLineConfigKeys = Object.keys(commandLineConfig);

      commandLineConfigKeys.forEach(function(arg){
        if (arg === "enableRandom") {
          cnf[arg] = commandLineConfig[arg] || cnf[arg];
        }
        else {
          cnf[arg] = commandLineConfig[arg];
        }
        console.log("--> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
      });

      configArgs = Object.keys(cnf);

      configArgs.forEach(function(arg){
        console.log(chalkAlert(">>> FINAL CONFIG (FILE) | " + arg + ": " + cnf[arg]));
      });

      if (cnf.enableStdin){
        initStdIn();
      }

      initSocket(cnf, function(){
        initStatsUpdate(cnf, function(err, cnf2){
          if (err) {
            console.log(chalkError("ERROR initStatsUpdate\n" + err));
          }
          return(callback(err, cnf2));
        });
      });
    }
    else {

      if (err.status === 404){
        // OVERIDE CONFIG WITH COMMAND LINE ARGS

        commandLineConfigKeys = Object.keys(commandLineConfig);

        commandLineConfigKeys.forEach(function(arg){
          cnf[arg] = commandLineConfig[arg];
          debug("--> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
        });

        configArgs = Object.keys(cnf);

        configArgs.forEach(function(arg){
          console.log(chalkAlert(">>> FINAL CONFIG | " + arg + ": " + cnf[arg]));
        });

        if (cnf.enableStdin){
          initStdIn();
        }

        initSocket(cnf, function(){
          initStatsUpdate(cnf, function(err, cnf2){
            if (err) {
              console.log(chalkError("ERROR initStatsUpdate\n" + jsonPrint(err)));
            }
            debug("initStatsUpdate cnf2\n" + jsonPrint(cnf2));
          });
        });

        callback(null, cnf);
      }
      else {
        console.error(chalkError("ERROR LOAD DROPBOX CONFIG: " + dropboxConfigFile
          + "\n" + jsonPrint(err)
        ));
        callback(err, cnf);
      }
    }
  });
}

process.on( "SIGINT", function() {
  quit("SIGINT");
});

initialize(configuration, function(err, cnf){
  if (err) { throw err; }
  configuration = cnf;
  configuration.instanceOptions.env.TNN_ITERATIONS = configuration.iterations;
  configuration.instanceOptions.env.TNN_SEED_NETWORK_ID = configuration.seedNetworkId;
  statsObj.configuration = {};
  statsObj.configuration = configuration;

  slackPostMessage(slackChannel, "\n*NN BATCH START*\n*" + statsObj.runId + "*\n");

  initBatch(function(){
    console.log(chalkAlert("INITIALIZED"));
  });
});
