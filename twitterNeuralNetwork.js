/*jslint node: true */
"use strict";

let slackChannel = "#word";

const neataptic = require("neataptic");
const DEFAULT_NETWORK_CREATE_MODE = "evolve";
const DEFAULT_TEST_RATIO = 0.05;

const DEFAULT_EVOLVE_MUTATION = "FFW";
const DEFAULT_EVOLVE_MUTATION_RATE = 0.7;
// const DEFAULT_EVOLVE_ACTIVATION = "STEP";
const DEFAULT_EVOLVE_ACTIVATION = "LOGISTIC";
const DEFAULT_EVOLVE_POPSIZE = 100;
const DEFAULT_EVOLVE_ELITISM = 5;
const DEFAULT_EVOLVE_ITERATIONS = 100;
const DEFAULT_EVOLVE_EQUAL = false;
const DEFAULT_EVOLVE_ERROR = 0.03;
const DEFAULT_EVOLVE_LOG = 1;
const DEFAULT_EVOLVE_COST = "BINARY";
// const DEFAULT_EVOLVE_COST = "CROSS_ENTROPY";
const DEFAULT_EVOLVE_CLEAR = false;

let configuration = {};
configuration.evolveNetwork = true;
configuration.normalization = null;
configuration.verbose = false;
configuration.testMode = false; // per tweet test mode
configuration.testSetRatio = DEFAULT_TEST_RATIO;

configuration.evolve = {};

configuration.evolve.elitism = DEFAULT_EVOLVE_ELITISM;
configuration.evolve.equal = DEFAULT_EVOLVE_EQUAL;
configuration.evolve.error = DEFAULT_EVOLVE_ERROR;
configuration.evolve.iterations = DEFAULT_EVOLVE_ITERATIONS;
configuration.evolve.log = DEFAULT_EVOLVE_LOG;
configuration.evolve.mutation = DEFAULT_EVOLVE_MUTATION;
configuration.evolve.mutationRate = DEFAULT_EVOLVE_MUTATION_RATE;
configuration.evolve.popsize = DEFAULT_EVOLVE_POPSIZE;
configuration.evolve.cost = DEFAULT_EVOLVE_COST;
configuration.evolve.activation = DEFAULT_EVOLVE_ACTIVATION;

const DEFAULT_NEURAL_NETWORK_FILE = "neuralNetwork.json";
const slackOAuthAccessToken = "xoxp-3708084981-3708084993-206468961315-ec62db5792cd55071a51c544acf0da55";

const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const os = require("os");
const util = require("util");
const moment = require("moment");
const Dropbox = require("dropbox");
const pick = require("object.pick");
const arrayUnique = require("array-unique");
const Autolinker = require( "autolinker" );
const Slack = require("slack-node");
const cp = require("child_process");
const arrayNormalize = require("array-normalize");

// const keywordExtractor = require("keyword-extractor");
const keywordExtractor = require("./js/keyword-extractor");

const mentionsRegex = require("mentions-regex");
const hashtagRegex = require("hashtag-regex");
const getUrls = require("get-urls");
const EventEmitter2 = require("eventemitter2").EventEmitter2;
const async = require("async");
const chalk = require("chalk");
const debug = require("debug")("tnn");
const debugCache = require("debug")("cache");
const debugQ = require("debug")("queue");
const commandLineArgs = require("command-line-args");

let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

const chalkAlert = chalk.red;
const chalkBlue = chalk.blue;
const chalkRedBold = chalk.bold.red;
const chalkError = chalk.bold.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;


let statsObj = {};
statsObj.hostname = hostname;
statsObj.pid = process.pid;
statsObj.heap = process.memoryUsage().heapUsed/(1024*1024);
statsObj.maxHeap = process.memoryUsage().heapUsed/(1024*1024);

statsObj.startTimeMoment = moment();
statsObj.startTime = moment().valueOf();
statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

const DEFAULT_RUN_ID = hostname + "_" + process.pid + "_" + statsObj.startTimeMoment.format(compactDateTimeFormat);

if (process.env.TNN_RUN_ID !== undefined) {
  statsObj.runId = process.env.TNN_RUN_ID;
  console.log(chalkAlert("ENV RUN ID: " + statsObj.runId));
}
else {
  statsObj.runId = DEFAULT_RUN_ID;
  console.log(chalkAlert("DEFAULT RUN ID: " + statsObj.runId));
}

let neuralNetworkChild;
let network;

let histograms = {};
histograms.words = {};
histograms.urls = {};
histograms.hashtags = {};
histograms.mentions = {};

let classifiedUserHashmap = {};

let trainingSet = [];
let trainingSetNormalized = [];

let inputArrays = [];

const jsUcfirst = function(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const inputTypes = ["hashtags", "mentions", "urls", "words"];


const configEvents = new EventEmitter2({
  wildcard: true,
  newListener: true,
  maxListeners: 20,
  verboseMemoryLeak: true
});

let stdin;


let mongoose;
let db;
let User;

const jsonPrint = function (obj){
  if (obj) {
    return JSON.stringify(obj, null, 2);
  }
  else {
    return "UNDEFINED";
  }
};


let slack = new Slack(slackOAuthAccessToken);

function slackPostMessage(channel, text, callback){

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


const enableStdin = { name: "enableStdin", alias: "i", type: Boolean, defaultValue: true };
const quitOnError = { name: "quitOnError", alias: "q", type: Boolean, defaultValue: true };
const verbose = { name: "verbose", alias: "v", type: Boolean };

const testMode = { name: "testMode", alias: "T", type: Boolean, defaultValue: false };
const loadNeuralNetworkFileRunID = { name: "loadNeuralNetworkFileRunID", alias: "N", type: String };
const evolveIterations = { name: "evolveIterations", alias: "I", type: Number};

const optionDefinitions = [enableStdin, quitOnError, verbose, evolveIterations, testMode, loadNeuralNetworkFileRunID];

const commandLineConfig = commandLineArgs(optionDefinitions);
console.log(chalkInfo("COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));
console.log("COMMAND LINE OPTIONS\n" + jsonPrint(commandLineConfig));

process.on("message", function(msg) {
  if (msg === "shutdown") {
    console.log("\n\n!!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n");
    setTimeout(function() {
      console.log("**** Finished closing connections ****"
        + "\n\n ***** RELOADING twitterNeuralNet.js NOW *****\n\n");
      process.exit(0);
    }, 1500);
  }
  else {
    console.log("R<\n" + jsonPrint(msg));
  }
});

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


statsObj.commandLineConfig = commandLineConfig;

statsObj.normalization = {};
statsObj.normalization.score = {};
statsObj.normalization.magnitude = {};

statsObj.normalization.score.min = -1.0;
statsObj.normalization.score.max = 1.0;
statsObj.normalization.magnitude.min = 0;
statsObj.normalization.magnitude.max = -Infinity;


let testObj = {};
testObj.testRunId = statsObj.runId;
testObj.testSet = [];

statsObj.tests = {};
statsObj.tests[statsObj.runId] = {};
statsObj.tests[statsObj.runId].results = {};
statsObj.tests[statsObj.runId].network = {};


console.log("\n\n=================================");
console.log("HOST:          " + hostname);
console.log("PROCESS ID:    " + process.pid);
console.log("RUN ID:        " + statsObj.runId);
console.log("PROCESS ARGS:  " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("=================================");

// ==================================================================
// DROPBOX
// ==================================================================

const DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
const DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
const DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
const DROPBOX_TNN_CONFIG_FILE = process.env.DROPBOX_TNN_CONFIG_FILE || "twitterNeuralNetworkConfig.json";
const DROPBOX_TNN_STATS_FILE = process.env.DROPBOX_TNN_STATS_FILE || "twitterNeuralNetworkStats.json";

const dropboxConfigFolder = "/config/utility";
const dropboxConfigDefaultFolder = "/config/utility/default";
const dropboxConfigHostFolder = "/config/utility/" + hostname;

const dropboxConfigFile = hostname + "_" + DROPBOX_TNN_CONFIG_FILE;
const statsFolder = "/stats/" + hostname + "/neuralNetwork";
const statsFile = "twitterNeuralNetworkStats_" + statsObj.runId + ".json";
debug("statsFolder : " + statsFolder);
debug("statsFile : " + statsFile);


console.log("DROPBOX_TNN_CONFIG_FILE: " + DROPBOX_TNN_CONFIG_FILE);
console.log("DROPBOX_TNN_STATS_FILE : " + DROPBOX_TNN_STATS_FILE);

debug("dropboxConfigFolder : " + dropboxConfigFolder);
debug("dropboxConfigHostFolder : " + dropboxConfigHostFolder);
debug("dropboxConfigFile : " + dropboxConfigFile);

console.log("DROPBOX_WORD_ASSO_ACCESS_TOKEN :" + DROPBOX_WORD_ASSO_ACCESS_TOKEN);
console.log("DROPBOX_WORD_ASSO_APP_KEY :" + DROPBOX_WORD_ASSO_APP_KEY);
console.log("DROPBOX_WORD_ASSO_APP_SECRET :" + DROPBOX_WORD_ASSO_APP_SECRET);

let dropboxClient = new Dropbox({ accessToken: DROPBOX_WORD_ASSO_ACCESS_TOKEN });

const inputArraysFolder = dropboxConfigHostFolder + "/inputArrays";
const inputArraysFile = "inputArrays_" + statsObj.runId + ".json";

let neuralNetworkFolder = dropboxConfigHostFolder + "/neuralNetworks";
let neuralNetworkFile = "neuralNetwork.json";

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

function allZeros(array){
  let i = 0;
  for (i = 0; i < array.length; i +=1){
    if (array[i] !== 0) { return false; }
  }
  if (i === array.length) { return true; }
}

function allOnes(array){
  let i = 0;
  for (i = 0; i < array.length; i +=1){
    if (array[i] !== 1) { return false; }
  }
  if (i === array.length) { return true; }
}

function indexOfMax (arr, callback) {
  if (arr.length === 0) {
    console.log(chalkAlert("indexOfMax: 0 LENG ARRAY: -1"));
    return(callback(-1)) ; 
  }
  if ((arr[0] === arr[1]) && (arr[1] === arr[2])){
    console.log(chalkAlert("indexOfMax: ALL EQUAL: " + arr[0]));
    return(callback(-1)) ; 
  }

  console.log("B4 ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));
  arrayNormalize(arr);
  console.log("AF ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));

  let max = arr[0];
  let maxIndex = 0;
  let i=1;

  async.eachOfSeries(arr, function(val, index, cb){
    if (arr[index] > max) {
      maxIndex = index;
      max = arr[index];
    }
    cb();
  }, function(){
    console.log(chalk.blue("indexOfMax: " + maxIndex 
      + " | " + arr[maxIndex].toFixed(2)
      + " | " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2)
    ));
    callback(maxIndex) ; 
  });
}

function showStats(options){

  if (neuralNetworkChild !== undefined) {
    neuralNetworkChild.send({op: "STATS", options: options});
  }

  statsObj.heap = process.memoryUsage().heapUsed/(1024*1024);
  statsObj.maxHeap = Math.max(statsObj.maxHeap, statsObj.heap);
  statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

  if (options) {
    console.log("STATS\n" + jsonPrint(statsObj));
  }
  else {
    console.log(chalkLog("S"
      + " | RUN " + statsObj.elapsed
      + " | NOW " + moment().format(compactDateTimeFormat)
      + " | STRT " + moment(parseInt(statsObj.startTime)).format(compactDateTimeFormat)
      + " | ITERATIONS " + configuration.evolve.iterations
      + " | HEAP " + statsObj.heap.toFixed(0) + " MB"
      + " MAX " + statsObj.maxHeap.toFixed(0)
    ));

    if (statsObj.tests[testObj.testRunId].results.successRate !== undefined) {
      console.log(chalkAlert("\nRESULTS: " + statsObj.tests[testObj.testRunId].results.successRate.toFixed(1) + " %"
         + " | TESTS: " + statsObj.tests[testObj.testRunId].results.numTests
         + " | PASS: " + statsObj.tests[testObj.testRunId].results.numPassed
         + " | SKIP: " + statsObj.tests[testObj.testRunId].results.numSkipped
         + " | RUN TIME: " + statsObj.elapsed
      ));
    }
  }
}

function quit(){

  console.log(chalkAlert( "\n\n... QUITTING ...\n\n" ));

  statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

  if (process.env.BATCH_MODE){
    slackChannel = "#nn_batch";
  }
  // else {
    let slackText = "";

    if (statsObj.tests[testObj.testRunId].results.successRate !== undefined) {
      // console.log("\n=====================\nRESULTS\n" + jsonPrint(statsObj.tests[testObj.testRunId].results));
      slackText = "\n*" + statsObj.runId + "*";
      slackText = slackText + "\n*RESULTS: " + statsObj.tests[testObj.testRunId].results.successRate.toFixed(1) + " %*";
      slackText = slackText + "\nITERATIONS: " + statsObj.tests[testObj.testRunId].training.evolve.options.iterations;
      slackText = slackText + "\nTESTS: " + statsObj.tests[testObj.testRunId].results.numTests;
      slackText = slackText + " | PASS: " + statsObj.tests[testObj.testRunId].results.numPassed;
      slackText = slackText + " | SKIP: " + statsObj.tests[testObj.testRunId].results.numSkipped;
      slackText = slackText + "\nRUN TIME: " + statsObj.elapsed;
    }
    else {
      slackText = "\n*QUIT*\n" + statsObj.runId;
    }

    slackPostMessage(slackChannel, slackText);
  // }

  showStats();
  setTimeout(function(){
    if (neuralNetworkChild !== undefined) { neuralNetworkChild.kill("SIGINT"); }
    process.exit();
  }, 1000);
}

process.on( "SIGINT", function() {
  if (neuralNetworkChild !== undefined) { neuralNetworkChild.kill("SIGINT"); }
  quit("SIGINT");
});

process.on("exit", function() {
  if (neuralNetworkChild !== undefined) { neuralNetworkChild.kill("SIGKILL"); }
});

function saveFile (path, file, jsonObj, callback){

  const fullPath = path + "/" + file;

  debug(chalkInfo("LOAD FOLDER " + path));
  debug(chalkInfo("LOAD FILE " + file));
  debug(chalkInfo("FULL PATH " + fullPath));

  let options = {};

  options.contents = JSON.stringify(jsonObj, null, 2);
  options.path = fullPath;
  options.mode = "overwrite";
  options.autorename = false;

  dropboxClient.filesUpload(options)
    .then(function(response){
      debug(chalkLog("SAVED DROPBOX JSON | " + options.path));
      callback(null, response);
    })
    .catch(function(error){
      console.error(chalkError(moment().format(defaultDateTimeFormat) 
        + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
        // + "\nERROR: " + error
        // + "\nERROR: " + jsonPrint(error)
        // + "\nERROR\n" + jsonPrint(error)
      ));
      if (error.status === 429) {
        console.error("TOO MANY DROPBOX WRITES");
      }
      else {
        console.error(jsonPrint(error.error));
      }
      callback(error, null);
    });
}

function loadFile(path, file, callback) {

  console.log(chalkInfo("LOAD FOLDER " + path));
  console.log(chalkInfo("LOAD FILE " + file));
  console.log(chalkInfo("FULL PATH " + path + "/" + file));

  let fileExists = false;

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
    })
    .catch(function(err) {
      console.log(chalkError("*** ERROR DROPBOX LOAD FILE\n" + err));
      callback(err, null);
    });
}

let statsUpdateInterval;
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

function initInputArrays(callback){

  console.log(chalkBlue("INIT INPUT ARRAYS"));

  async.each(inputTypes, function(inputType, cb){

    const inputFile = "defaultInput" + jsUcfirst(inputType) + ".json";

    console.log("INIT " + inputType.toUpperCase() + " INPUT ARRAY: " + inputFile);

    loadFile(dropboxConfigDefaultFolder, inputFile, function(err, inputArrayObj){
      if (!err) {
        debug(jsonPrint(inputArrayObj));

        arrayUnique(inputArrayObj[inputType]);

        inputArrayObj[inputType].sort();

        inputArrays.push(inputArrayObj);

        console.log(chalkBlue("LOADED " + inputType.toUpperCase() + " ARRAY"
          + " | " + inputArrayObj[inputType].length + " " + inputType.toUpperCase()
        ));
        cb();
      }
      else {
        console.log(chalkError("ERROR: loadFile: " + dropboxConfigFolder + "/" + inputFile));
        cb(err);
      }
    });
  }, function(err){
    if (err){
      console.log(chalkError("ERR\n" + jsonPrint(err)));
      callback(err);
    }
    else {
      console.log(chalkBlue("LOADED INPUT ARRAY FILES"));

      saveFile(inputArraysFolder, inputArraysFile, inputArrays, function(){
        statsObj.inputArraysFile = inputArraysFolder + "/" + inputArraysFile;
        debug("descriptionArrays\n" + jsonPrint(inputArrays));
        callback(null);
      });
    }
  });
}

function initialize(cnf, callback){

  debug(chalkBlue("INITIALIZE cnf\n" + jsonPrint(cnf)));

  if (debug.enabled || debugCache.enabled || debugQ.enabled){
    console.log("\n%%%%%%%%%%%%%%\n DEBUG ENABLED \n%%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.TNN_PROCESS_NAME || "twitterNeuralNetwork";
  cnf.runId = process.env.TNN_RUN_ID || statsObj.runId;

  cnf.verbose = process.env.TNN_VERBOSE_MODE || false ;
  cnf.quitOnError = process.env.TNN_QUIT_ON_ERROR || false ;
  cnf.enableStdin = process.env.TNN_ENABLE_STDIN || true ;
  cnf.networkCreateMode = process.env.TNN_NETWORK_CREATE_MODE || DEFAULT_NETWORK_CREATE_MODE ;
  cnf.evolve.iterations = process.env.TNN_EVOLVE_ITERATIONS || DEFAULT_EVOLVE_ITERATIONS ;
  cnf.neuralNetworkFile = process.env.TNN_NEURAL_NETWORK_FILE || DEFAULT_NEURAL_NETWORK_FILE ;

  cnf.classifiedUsersFile = process.env.TNN_CLASSIFIED_USERS_FILE || "classifiedUsers.json";
  cnf.classifiedUsersFolder = dropboxConfigHostFolder + "/classifiedUsers";
  cnf.statsUpdateIntervalTime = process.env.TNN_STATS_UPDATE_INTERVAL || 60000;

  debug(chalkWarn("dropboxConfigFolder: " + dropboxConfigFolder));
  debug(chalkWarn("dropboxConfigFile  : " + dropboxConfigFile));

  if (process.env.BATCH_MODE) {

    console.log(chalkAlert("\n\nBATCH MODE\n\n"));

    initStatsUpdate(cnf, function(err, cnf2){
      if (err) {
        console.log(chalkError("ERROR initStatsUpdate\n" + jsonPrint(err)));
      }
      debug("initStatsUpdate cnf2\n" + jsonPrint(cnf2));
    });
    initInputArrays(function(err){
      return(callback(err, cnf));
    });
  }
  else{
    loadFile(dropboxConfigHostFolder, dropboxConfigFile, function(err, loadedConfigObj){

      let commandLineConfigKeys;
      let configArgs;

      if (!err) {
        console.log(dropboxConfigFile + "\n" + jsonPrint(loadedConfigObj));

        if (loadedConfigObj.TNN_EVOLVE_ITERATIONS  !== undefined){
          console.log("LOADED TNN_EVOLVE_ITERATIONS: " + loadedConfigObj.TNN_EVOLVE_ITERATIONS);
          cnf.evolve.iterations = loadedConfigObj.TNN_EVOLVE_ITERATIONS;
        }

        if (loadedConfigObj.TNN_VERBOSE_MODE  !== undefined){
          console.log("LOADED TNN_VERBOSE_MODE: " + loadedConfigObj.TNN_VERBOSE_MODE);
          cnf.verbose = loadedConfigObj.TNN_VERBOSE_MODE;
        }

        if (loadedConfigObj.TNN_TEST_MODE  !== undefined){
          console.log("LOADED TNN_TEST_MODE: " + loadedConfigObj.TNN_TEST_MODE);
          cnf.testMode = loadedConfigObj.TNN_TEST_MODE;
        }

        if (loadedConfigObj.TNN_NEURAL_NETWORK_FILE_RUNID  !== undefined){
          console.log("LOADED TNN_NEURAL_NETWORK_FILE_RUNID: " + loadedConfigObj.TNN_NEURAL_NETWORK_FILE_RUNID);
          cnf.loadNeuralNetworkFileRunID = loadedConfigObj.TNN_NEURAL_NETWORK_FILE_RUNID;
        }

        if (loadedConfigObj.TNN_ENABLE_STDIN  !== undefined){
          console.log("LOADED TNN_ENABLE_STDIN: " + loadedConfigObj.TNN_ENABLE_STDIN);
          cnf.enableStdin = loadedConfigObj.TNN_ENABLE_STDIN;
        }

        if (loadedConfigObj.TNN_STATS_UPDATE_INTERVAL  !== undefined) {
          console.log("LOADED TNN_STATS_UPDATE_INTERVAL: " + loadedConfigObj.TNN_STATS_UPDATE_INTERVAL);
          cnf.statsUpdateIntervalTime = loadedConfigObj.TNN_STATS_UPDATE_INTERVAL;
        }

        if (loadedConfigObj.TNN_KEEPALIVE_INTERVAL  !== undefined) {
          console.log("LOADED TNN_KEEPALIVE_INTERVAL: " + loadedConfigObj.TNN_KEEPALIVE_INTERVAL);
          cnf.keepaliveInterval = loadedConfigObj.TNN_KEEPALIVE_INTERVAL;
        }

        // OVERIDE CONFIG WITH COMMAND LINE ARGS

        commandLineConfigKeys = Object.keys(commandLineConfig);

        commandLineConfigKeys.forEach(function(arg){
          if (arg === "evolveIterations") {
            cnf.evolve.iterations = commandLineConfig[arg];
            console.log("--> COMMAND LINE CONFIG | evolve.iterations: " + cnf.evolve.iterations);
          }
          else {
            cnf[arg] = commandLineConfig[arg];
            console.log("--> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
          }
        });

        configArgs = Object.keys(cnf);

        configArgs.forEach(function(arg){
          if (arg === "evolve") {
            console.log("FINAL CONFIG | " + arg + ": " + jsonPrint(cnf[arg]));
          }
          else {
            console.log("FINAL CONFIG | " + arg + ": " + cnf[arg]);
          }
        });

        if (cnf.enableStdin){

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

              // case "d":
              //   configuration.enableHeapDump = !configuration.enableHeapDump;
              //   console.log(chalkRedBold("HEAP DUMP: " + configuration.enableHeapDump));
              // break;
              case "v":
                configuration.verbose = !configuration.verbose;
                console.log(chalkRedBold("VERBOSE: " + configuration.verbose));
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

        initStatsUpdate(cnf, function(err, cnf2){

          if (err) {
            console.log(chalkError("ERROR initStatsUpdate\n" + err));
          }

          debug("initStatsUpdate cnf2\n" + jsonPrint(cnf2));

          initInputArrays(function(err){
            return(callback(err, cnf2));
          });

        });
      }
      else {
        console.error(chalkError("ERROR LOAD DROPBOX CONFIG: " + dropboxConfigFile
          + "\n" + jsonPrint(err)
        ));

        if (err.status === 404){
          // OVERIDE CONFIG WITH COMMAND LINE ARGS

          commandLineConfigKeys = Object.keys(commandLineConfig);

          commandLineConfigKeys.forEach(function(arg){
            cnf[arg] = commandLineConfig[arg];
            debug("--> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
          });

          configArgs = Object.keys(cnf);

          configArgs.forEach(function(arg){
            console.log("_FINAL CONFIG | " + arg + ": " + cnf[arg]);
          });

          if (cnf.enableStdin){

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

                // case "d":
                //   configuration.enableHeapDump = !configuration.enableHeapDump;
                //   console.log(chalkRedBold("HEAP DUMP: " + configuration.enableHeapDump));
                // break;
                case "v":
                  configuration.verbose = !configuration.verbose;
                  console.log(chalkRedBold("VERBOSE: " + configuration.verbose));
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

          initStatsUpdate(cnf, function(err, cnf2){
            if (err) {
              console.log(chalkError("ERROR initStatsUpdate\n" + jsonPrint(err)));
            }
            debug("initStatsUpdate cnf2\n" + jsonPrint(cnf2));
          });
        }
        initInputArrays(function(err){
          return(callback(err, cnf));
        });
       }
    });
  }

}

console.log(chalkInfo(getTimeStamp() 
  + " | WAIT 5 SEC FOR MONGO BEFORE INITIALIZE CONFIGURATION"
));

configEvents.once("INIT_MONGODB", function(){
  mongoose = require("./config/mongoose");

  db = mongoose();

  db.connection.on("error", function(err){
    console.log(chalkError("*** DB ERROR\n" + err));
  });

  db.connection.on("connected", function(){
    console.log(chalkInfo("DB CONNECT"));
  });

  db.connection.on("disconnected", function(){
    console.log(chalkError("*** DB DISCONNECT"));
  });

  User = require("mongoose").model("User");
});

let wordExtractionOptions = {
  language:"english",
  remove_digits: true,
  return_changed_case: true,
  remove_duplicates: true
};

let parser = new Autolinker( {
  email: false,
  urls: true,
  hashtag: "twitter",
  mention: "twitter"
} );

function parseText(text, options, callback){

  console.log(chalk.blue("\ntext\n" + text));

  if (text === "undefined") {
    console.error(chalkError("*** PARSER TEXT UNDEFINED"));
  }

  text = text.replace(/,/gi, " ");

  const parseResults = parser.parse(text);

  let urlArray = [];
  let mentionArray = [];
  let hashtagArray = [];

  async.each(parseResults, function(matchObj, cb){

    const type = matchObj.getType();

    console.log(chalkAlert("PARSE TEXT"
      + " | " + matchObj.getMatchedText().toLowerCase()
      + " | TYPE: " + type
    ));

    switch (type) {
      case "url":
        urlArray.push(matchObj.getMatchedText().toLowerCase());
        console.log(chalkInfo(urlArray.length + " | URL: " + matchObj.getMatchedText().toLowerCase()));
        cb();
      break;
      case "mention":
        mentionArray.push(matchObj.getMatchedText().toLowerCase());
        console.log(chalkInfo(mentionArray.length + " | MEN: " + matchObj.getMatchedText().toLowerCase()));
        cb();
      break;
      case "hashtag":
        hashtagArray.push(matchObj.getMatchedText().toLowerCase());
        console.log(chalkInfo(hashtagArray.length + " | HTG: " + matchObj.getMatchedText().toLowerCase()));
        cb();
      break;
      default:
        console.error(chalkError("UNKNOWN PARSE TYPE: " + type));
        cb();
    }

   }, function(err){

    const wordArray = keywordExtractor.extract(text, wordExtractionOptions);

    const userHistograms = {};
    userHistograms.words = {};
    userHistograms.urls = {};
    userHistograms.hashtags = {};
    userHistograms.mentions = {};

    async.parallel({

      mentions: function(cb){
        if (mentionArray) {

          async.each(mentionArray, function(userId, cb2){
            userId = userId.toLowerCase();
            if (options.updateGlobalHistograms) {
              histograms.mentions[userId] = (histograms.mentions[userId] === undefined) ? 1 
                : histograms.mentions[userId]+1;
            }
            userHistograms.mentions[userId] = (userHistograms.mentions[userId] === undefined) ? 1 
              : userHistograms.mentions[userId]+1;
            console.log(chalkAlert("->- DESC Ms"
              + " | " + userHistograms.mentions[userId]
              + " | " + userId
            ));
            cb2();
          }, function(err2){
            cb(err2, userHistograms.mentions);
          });
        }
        else {
          cb(null, userHistograms.mentions);
        }
      },

      hashtags: function(cb){
        if (hashtagArray) {
          async.each(hashtagArray, function(hashtag, cb2){
            hashtag = hashtag.toLowerCase();
            if (options.updateGlobalHistograms) {
              histograms.hashtags[hashtag] = (histograms.hashtags[hashtag] === undefined) ? 1 
              : histograms.hashtags[hashtag]+1;
            }
            userHistograms.hashtags[hashtag] = (userHistograms.hashtags[hashtag] === undefined) ? 1 
              : userHistograms.hashtags[hashtag]+1;
            console.log(chalkAlert("->- DESC Hs"
              + " | " + userHistograms.hashtags[hashtag]
              + " | " + hashtag
            ));
            cb2();
          }, function(err2){
            cb(err2, userHistograms.hashtags);
          });
        }
        else {
          cb(null, userHistograms.hashtags);
        }
      },

      words: function(cb){
        if (wordArray) {
          async.each(wordArray, function(w, cb1){

            debug(chalkAlert("w"
              + " | " + w
            ));

            let word = w.toLowerCase();

            word = word.replace(/'s/gi, "");
            word = word.replace(/’s/gi, "");
            word = word.replace(/'ve/gi, "");
            word = word.replace(/’ve/gi, "");
            word = word.replace(/'re/gi, "");
            word = word.replace(/’re/gi, "");

            const m = mentionsRegex().exec(word);
            const h = hashtagRegex().exec(word);
            const u = (Array.from(getUrls(word)).length > 0) ? Array.from(getUrls(word)) : null;

            if (m || h || u 
              || (word === "/") 
              || word.includes("--") 
              || word.includes("|") 
              || word.includes("#") 
              || word.includes("w/") 
              || word.includes("≠") 
              || word.includes("http") 
              || word.includes("+")) {
              debug(chalkAlert("-- SKIP WORD"
                + " | M: " + m
                + " | H: " + h
                + " | U: " + u
                + " | " + word
              ));
              cb1();
            }
            else {
              if (options.updateGlobalHistograms) {
                histograms.words[word] = (histograms.words[word] === undefined) ? 1 
                  : histograms.words[word]+1;
              }
              userHistograms.words[word] = (userHistograms.words[word] === undefined) ? 1 
                : userHistograms.words[word]+1;

              console.log(chalkAlert("->- DESC Ws"
                // + " | HIST: " + histograms.words[word]
                + " | " + userHistograms.words[word]
                + " | " + word
              ));

              cb1();
            }
          }, function(err){
            cb(null, userHistograms.words);
          });
        }
        else {
          cb(null, userHistograms.words);
        }
      },

      urls: function(cb){
        if (urlArray) {
          async.each(urlArray, function(url, cb2){
            url = url.toLowerCase();
            if (options.updateGlobalHistograms) {
              histograms.urls[url] = (histograms.urls[url] === undefined) ? 1 : histograms.urls[url]+1;
            }
            userHistograms.urls[url] = (userHistograms.urls[url] === undefined) ? 1 : userHistograms.urls[url]+1;
            console.log(chalkAlert("->- DESC Us"
              + " | " + userHistograms.urls[url]
              + " | " + url
            ));
            cb2();
          }, function(err2){
            cb(err2, userHistograms.urls);
          });
        }
        else {
          cb(null, userHistograms.urls);
        }
      }

    }, function(err2, results){

      let t = "HISTOGRAMS";

      Object.keys(results).forEach(function(key){
        if (results[key]) {
          t = t + " | " + key.toUpperCase() + ": " + Object.keys(results[key]).length;
        }
      });
      console.log(chalkLog(t));
      callback((err || err2), results);
    });

  });
}

function printDatum(title, datum, callback){

  if (datum.input.length === 0) {
    console.error(chalkError("*** EMPTY DATUM INPUT ***\n" + jsonPrint(datum)));
  }

  let row = "";
  let col = 0;
  let rowNum = 0;
  const COLS = 50;
  let text = "";

  if (title) {
    // console.log("\n-------- " + title + " --------");
    text = "\n-------- " + title + " --------\n";
  }
  else {
    // console.log("\n--------------------");
    text = "\n--------------------\n";
  }

  // datum.input.forEach(function(bit, i){

  let i=0;
  async.eachSeries(datum.input, function(bit, cb){

    if (i === 0) {
      row = row + bit.toFixed(10) + " | " ;
    }
    else if (i === 1) {
      row = row + bit.toFixed(10);
    }
    else if (i === 2) {
      // console.log("ROW " + rowNum + " | " + row);
      text = text + "ROW " + rowNum + " | " + row + "\n";
      row = bit ? "X" : ".";
      col = 1;
      rowNum += 1;
    }
    else if (col < COLS){
      row = row + (bit ? "X" : ".");
      col += 1;
    }
    else {
      // console.log("ROW " + rowNum + " | " + row);
      text = text + "ROW " + rowNum + " | " + row + "\n";
      row = bit ? "X" : ".";
      col = 1;
      rowNum += 1;
    }

    i += 1;

    cb();

  }, function(){
    console.warn(text);
    callback();
  });
}

// FUTURE: break up into updateClassifiedUsers and createTrainingSet
function updateClassifiedUsers(cnf, callback){


  let classifiedUserIds = Object.keys(classifiedUserHashmap);
  let maxMagnitude = 0;
  let totalInputHits = 0;

  console.log(chalkBlue("UPDATE CLASSIFIED USERS: " + classifiedUserIds.length));

  if (cnf.normalization) {
    // minMagnitude = cnf.normalization.magnitude.min;
    maxMagnitude = cnf.normalization.magnitude.max;
    // minScore = cnf.normalization.score.min;
    // maxScore = cnf.normalization.score.max;
  }

  async.each(classifiedUserIds, function(userId, cb0){

    User.findOne({userId: userId}, function(err, user){

      if (err || !user){
        return(cb0());
      }

      let sentimentText;

      let sentimentObj = {};
      sentimentObj.magnitude = 0;
      sentimentObj.score = 0;

      if ((user.languageAnalysis !== undefined)
        && (user.languageAnalysis.sentiment !== undefined)) {

        sentimentObj.magnitude = user.languageAnalysis.sentiment.magnitude;
        sentimentObj.score = user.languageAnalysis.sentiment.score;

        if (!cnf.normalization) {
          maxMagnitude = Math.max(maxMagnitude, sentimentObj.magnitude);
        }
      }

      sentimentText = "M: " + (sentimentObj.magnitude).toFixed(2)
        + " S: " + (sentimentObj.score).toFixed(2);

      let keywordArray = Object.keys(user.keywords);

      let classification = (keywordArray[0] !== undefined) ? keywordArray[0] : false;
      let threeceeFollowing = (user.threeceeFollowing) ? user.threeceeFollowing.screenName : "-";

      // if (classification && (!cnf.zeroSentiment && (sentiment !== undefined))) {
      if (classification) {

        let classText = "";
        let currentChalk = chalkLog;

        switch (classification) {
          case "left":
            classText = "L";
            currentChalk = chalk.blue;
          break;
          case "right":
            classText = "R";
            currentChalk = chalk.yellow;
          break;
          case "neutral":
            classText = "N";
            currentChalk = chalk.black;
          break;
          case "positive":
            classText = "+";
            currentChalk = chalk.green;
          break;
          case "negative":
            classText = "-";
            currentChalk = chalk.red;
          break;
          default:
            classText = "O";
            currentChalk = chalk.bold.gray;
        }

        console.log(currentChalk("ADD  | U"
          // + " | " + keywordArray
          // + " | " + classification
          + " | SEN: " + sentimentText
          + " | " + classText
          + " | " + user.screenName
          + " | " + user.userId
          + " | " + user.name
          + " | 3C FOLLOW: " + threeceeFollowing
          + " | FLLWs: " + user.followersCount
          + " | FRNDs: " + user.friendsCount
          // + " | " + jsonPrint(user.keywords)
        ));

        let trainingSetDatum = {};
        trainingSetDatum.inputHits = 0;

        trainingSetDatum.input = [
          sentimentObj.magnitude, 
          sentimentObj.score
        ];

        if (user.screenName !== undefined) {

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
            function userStatusText(text, cb) {
              // console.log("user.status\n" + jsonPrint(user.status));
              if ((user.status !== undefined) && user.status) {
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
              if ((user.retweeted_status !== undefined) && user.retweeted_status) {

                console.log(chalkBlue("RT\n" + jsonPrint(user.retweeted_status.text)));

                if (text) {
                  cb(null, text + "\n" + user.retweeted_status.text);
                }
                else {
                  cb(null, user.retweeted_status.text);
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
            }
          ], function (error, text) {

            if (error) {
              console.error(chalkError("*** ERROR " + error));
            }

            if (!text || (text === undefined)) { text = " "; }

            parseText(text, {updateGlobalHistograms: true}, function(err, histogram){

              if (err) {
                console.error("*** PARSE TEXT ERROR\n" + err);
              }

              debug(chalkLog("user.description + status histogram\n" + jsonPrint(histogram)));
              debug("user.description + status\n" + jsonPrint(text));

              async.eachSeries(inputArrays, function(inputArray, cb1){

                const type = Object.keys(inputArray)[0];

                debug(chalkAlert("START ARRAY: " + type + " | " + inputArray[type].length));

                async.eachSeries(inputArray[type], function(element, cb2){
                  if (histogram[type][element]) {
                    trainingSetDatum.inputHits += 1;
                    console.log(chalkBlue("+++ DATUM BIT: " + type
                      + " | INPUT HITS: " + trainingSetDatum.inputHits 
                      + " | " + element 
                      + " | " + histogram[type][element]
                    ));
                    trainingSetDatum.input.push(1);
                    cb2();
                  }
                  else {
                    debug(chalkInfo("--- DATUM BIT: " + type
                      + " | " + element 
                      + " | " + histogram[type][element]
                    ));
                    trainingSetDatum.input.push(0);
                    cb2();
                  }
                }, function(err){
                 if (err) {
                    console.error("*** PARSE TEXT ERROR\n" + err);
                  }
                  debug(chalkAlert("DONE ARRAY: " + type));
                  cb1();
                });
              }, function(err){
               if (err) {
                  console.error("*** PARSE TEXT ERROR\n" + err);
                }
                debug(chalkAlert("PARSE DESC COMPLETE"));
              });

            });

          });     
        }
        else {
          async.eachSeries(inputArrays, function(inputArray, cb3){

            const type = Object.keys(inputArray)[0];

            inputArray[type].forEach(function(){
              debug("ARRAY: " + type + " | 0");
              trainingSetDatum.input.push(0);
            });

            cb3();

          }, function(err){
            if (err) {
              console.error("*** INIT INPUT ARRAY ERROR\n" + err);
            }
            console.log(chalkBlue("INIT INPUT ARRAY COMPLETE"
              + " | " + trainingSetDatum.input.length + " INPUTS"
              + " | " + trainingSetDatum.inputHits + " INPUT HITS"
            ));
            testObj.numInputs = trainingSetDatum.input.length;
          });
        }

        trainingSetDatum.output = [];

        switch (keywordArray[0]){
          case "left":
            trainingSetDatum.output = [1,0,0];
          break;
          case "neutral":
            trainingSetDatum.output = [0,1,0];
          break;
          case "right":
            trainingSetDatum.output = [0,0,1];
          break;
          default:
            trainingSetDatum.output = [0,0,0];
        }

        totalInputHits += trainingSetDatum.inputHits;
        testObj.numOutputs = trainingSetDatum.output.length;


        debug("trainingSetDatum INPUT:  " + trainingSetDatum.input);
        debug("trainingSetDatum OUTPUT: " + trainingSetDatum.output);

        printDatum(user.screenName, trainingSetDatum, function(){
          trainingSet.push({name: user.screenName, datum:trainingSetDatum});
          cb0();
        });

      }
      else {
        console.log(chalkBlue("SKIP | U"
          + " | " + keywordArray
          + " | " + classification
          + " | " + user.userId
          + " | " + user.screenName
          + " | " + user.name
          + " | 3C FOLLOW: " + threeceeFollowing
          + " | FLLWs: " + user.followersCount
          + " | FRNDs: " + user.friendsCount
          + " | SEN: " + sentimentText
          // + " | " + jsonPrint(user.keywords)
        ));
        cb0();
      }

    });
  }, function(err){

      let inputHitAverage = totalInputHits/trainingSet.length;

      console.log(chalkBlue("\nMAX MAGNITUDE:        " + maxMagnitude));
      console.log(chalkBlue("TOTAL INPUT HITS:     " + totalInputHits));
      console.log(chalkBlue("AVE INPUT HITS/DATUM: " + inputHitAverage.toFixed(3)));
      statsObj.normalization.magnitude.max = maxMagnitude;

      testObj.inputHits = totalInputHits;
      testObj.inputHitAverage = inputHitAverage;

      trainingSet.forEach(function(dataObj){

        let normMagnitude = dataObj.datum.input[0]/maxMagnitude;

        dataObj.datum.input[0] = normMagnitude;

        if (configuration.testMode) {
          testObj.testSet.push(dataObj);
        }
        else if (Math.random() < cnf.testSetRatio) {
          testObj.testSet.push(dataObj);
        }
        else {
          trainingSetNormalized.push(dataObj);
        }

      });

      callback(err);
  });
}

let activateInterval;

function activateNetwork(n, input, callback){

  let output;

  activateInterval = setInterval(function(){

    if (output) {
      clearInterval(activateInterval);
      callback(output);
    }
  }, 200);

  output = n.activate(input);
}

function testNetwork(nw, testObj, callback){

  console.log(chalkBlue("TEST NETWORK"
    + " | TEST RUN ID: " + testObj.testRunId
    + " | NETWORK ID: " + testObj.testRunId
    + " | " + testObj.testSet.length + " TEST DATA POINTS"
  ));

  let numTested = 0;
  let numSkipped = 0;
  let numPassed = 0;
  let successRate = 0;

  async.eachSeries(testObj.testSet, function(testDatumObj, cb){

    activateNetwork(nw, testDatumObj.datum.input, function(testOutput){

      printDatum(testDatumObj.name, testDatumObj.datum, function(){

        // if (allZeros(testOutput)) {
        //   console.log(chalkError("\n??? NO TEST OUTPUT ... SKIPPING | " + testOutput));
        //   numSkipped += 1;
        //   cb();
        //   return;
        // }

        // if (allOnes(testOutput)) {
        //   console.log(chalkError("\n??? ALL ONES TEST OUTPUT ... SKIPPING | " + testOutput));
        //   numSkipped += 1;
        //   cb();
        //   return;
        // }

        numTested += 1;

        indexOfMax(testOutput, function(testMaxOutputIndex){

          indexOfMax(testDatumObj.datum.output, function(expectedMaxOutputIndex){

            let passed = (testMaxOutputIndex === expectedMaxOutputIndex);

            numPassed = passed ? numPassed+1 : numPassed;

            successRate = 100 * numPassed/(numTested + numSkipped);

            let currentChalk = passed ? chalkLog : chalkAlert;

            console.log(currentChalk("\n-----\nTEST RESULT: " + passed 
              + " | " + successRate.toFixed(2) + "%"
              // + "\n" + "TO: " + testOutput 
              + "\n" + testOutput[0].toFixed(10)
              + " " + testOutput[1].toFixed(10) 
              + " " + testOutput[2].toFixed(10) 
              + " | TMOI: " + testMaxOutputIndex
              // + "\n" + "EO: " + testDatum.output 
              + "\n" + testDatumObj.datum.output[0].toFixed(10) 
              + " " + testDatumObj.datum.output[1].toFixed(10) 
              + " " + testDatumObj.datum.output[2].toFixed(10) 
              + " | EMOI: " + expectedMaxOutputIndex
            ));

            cb();
          });

        });
      });
    });
  }, function(err){
    callback(err, 
      { testRunId: testObj.testRunId, 
        numTests: testObj.testSet.length, 
        numSkipped: numSkipped, 
        numPassed: numPassed, 
        successRate: successRate
      }
    );
  });
}

function initNeuralNetworkChild(callback){

  neuralNetworkChild = cp.fork(`neuralNetworkChild.js`);

  neuralNetworkChild.on("message", function(m){

    console.log(chalkLog("neuralNetworkChild RX"
      + " | " + m.op
      // + " | " + m.obj.userId
      // + " | " + m.obj.screenName
      // + " | " + m.obj.name
      // + "\n" + jsonPrint(m)
    ));

    switch(m.op) {
      case "TRAIN_COMPLETE":
      case "EVOLVE_COMPLETE":

        console.log(chalkBlue("NETWORK EVOLVE/TRAIN COMPLETE"
          + "\nELAPSED: " + getTimeStamp(m.networkObj.elapsed)
          + "\nITERTNS: " + m.statsObj.training.evolve.options.iterations
          + "\nNN:      " + m.networkObj.neuralNetworkFile
          + "\nINPUTS:  " + m.networkObj.network.input
          + "\nOUTPUTS: " + m.networkObj.network.output
          + "\nDROPOUT: " + m.networkObj.network.dropout
          + "\nNODES:   " + m.networkObj.network.nodes.length
          + "\nCONNS:   " + m.networkObj.network.connections.length
          + "\nNORM: M: "
          + m.networkObj.normalization.magnitude.min.toFixed(3) 
          + "/" + m.networkObj.normalization.magnitude.max.toFixed(3)
          + " | S: " 
          + m.networkObj.normalization.score.min.toFixed(3) 
          + "/" + m.networkObj.normalization.score.max.toFixed(3)
          // + "\nNETWORK\n" + jsonPrint(m.network)
        ));

        network = neataptic.Network.fromJSON(m.networkObj.network);

        testNetwork(network, testObj, function(err, results){

          if (err) {
            console.error("*** TEST NETWORK ERROR ***\n" + jsonPrint(err));
          }

          testObj.results = {};
          testObj.results = results;

          statsObj.tests[testObj.testRunId] = {};
          statsObj.tests[testObj.testRunId] = pick(
            testObj, 
            ["numInputs", "numOutputs", "inputArraysFile", "inputHits", "inputHitAverage"]
          );
          statsObj.tests[testObj.testRunId].results = {};
          statsObj.tests[testObj.testRunId].results = testObj.results;
          statsObj.tests[testObj.testRunId].training = {};
          statsObj.tests[testObj.testRunId].training.evolve = {};
          statsObj.tests[testObj.testRunId].training.evolve.options = {};
          statsObj.tests[testObj.testRunId].training.evolve.options = m.statsObj.training.evolve.options;
          statsObj.tests[testObj.testRunId].neuralNetworkFile = m.networkObj.neuralNetworkFile;
          statsObj.tests[testObj.testRunId].elapsed = m.networkObj.elapsed;

          console.log(chalkBlue("\nNETWORK TEST COMPLETE\n==================="
            + "\n  TESTS:   " + results.numTests
            + "\n  PASSED:  " + results.numPassed
            + "\n  SKIPPED: " + results.numSkipped
            + "\n  SUCCESS: " + results.successRate.toFixed(1) + "%"
            // + "\nTRAINING OPTIONS"
            // + "\n" + jsonPrint(statsObj.tests[testObj.testRunId].training.evolve.options)
          ));

          console.log(chalkLog("... SAVING NEURAL NETWORK FILE"
            + " | " + neuralNetworkFolder + "/" + m.networkObj.neuralNetworkFile
          ));

          saveFile(neuralNetworkFolder, m.networkObj.neuralNetworkFile, m.networkObj, function(err){
            if (err){
              console.error(chalkError("*** SAVE NEURAL NETWORK FILE ERROR"
                + " | " + m.networkObj.neuralNetworkFile + " | " + err
              ));
            }
            else {
              console.log(chalkLog("SAVED NEURAL NETWORK FILE"
                + " | " + neuralNetworkFolder + "/" + m.networkObj.neuralNetworkFile
              ));
            }

            quit();

          });
        });
      break;
    }
  });

  let messageObj = {
    op: "INIT",
    testRunId: testObj.testRunId
  };

  neuralNetworkChild.send(messageObj);

  if (callback !== undefined) { callback(); }
}

function initTimeout(){

  console.log(chalkError("\nSET TIMEOUT | " + moment().format(compactDateTimeFormat) + "\n"));

  configEvents.emit("INIT_MONGODB");

  initialize(configuration, function(err, cnf){

    if (err && (err.status !== 404)) {
      console.error(chalkError("***** INIT ERROR *****\n" + jsonPrint(err)));
      quit();
    }

    configuration = cnf;

    if (cnf.testMode) {

      let nnFile;
      if (cnf.loadNeuralNetworkFileRunID) {
        // folder = neuralNetworkFolder;
        nnFile = neuralNetworkFile.replace(".json", "_" + cnf.loadNeuralNetworkFileRunID + ".json");
      }
      else {
        // folder = neuralNetworkFolder;
        nnFile = neuralNetworkFile;
      }

      statsObj.tests[testObj.testRunId].neuralNetworkFile = nnFile;
      // statsObj.test.neuralNetworkFile = nnFile;

      console.log(chalkInfo("LOAD NEURAL NETWORK FILE: " + neuralNetworkFolder + "/" + nnFile));

      loadFile(neuralNetworkFolder, nnFile, function(err, loadedNetworkObj){

        if (err) {
          console.log(chalkError("ERROR: LOAD NEURAL NETWORK FILE: "
            + neuralNetworkFolder + "/" + statsFile
          ));
          quit("LOAD FILE ERROR");
        }
        else {

          cnf.normalization = loadedNetworkObj.normalization;
          let loadedNetwork = neataptic.Network.fromJSON(loadedNetworkObj.network);

          loadFile(cnf.classifiedUsersFolder, cnf.classifiedUsersFile, function(err, clUsObj){

            if (err) {
              console.error("*** LOAD CLASSIFIED USER FILE ERROR ***\n" + jsonPrint(err));
            }

            classifiedUserHashmap = clUsObj;

            console.log(chalkBlue("INITIALIZED CLASSIFIED USERS"
              + " | " + Object.keys(classifiedUserHashmap).length
            ));
            updateClassifiedUsers(cnf, function(err){

              if (err) {
                console.error("UPDATE CLASSIFIED USERS ERROR\n" + err);
                quit("UPDATE CLASSIFIED USERS ERROR");
              }

              testNetwork(loadedNetwork, testObj, function(err, results){

                if (err) {
                  console.error("*** TEST NETWORK ERROR ***\n" + jsonPrint(err));
                }

                statsObj.tests[testObj.testRunId].results = results;

                console.log(chalkBlue("\nNETWORK TEST COMPLETE\n==================="
                  + "\n  TESTS:   " + results.numTests
                  + "\n  PASSED:  " + results.numPassed
                  + "\n  SKIPPED:  " + results.numSkipped
                  + "\n  SUCCESS: " + results.successRate.toFixed(1) + "%"
                  // + " | " + jsonPrint(results)
                ));
                quit();
              });
            });
          });

        }
      });
    }
    else {
      loadFile(cnf.classifiedUsersFolder, cnf.classifiedUsersFile, function(err, clUsObj){
        if (!err) {

          debug(jsonPrint(clUsObj));

          classifiedUserHashmap = clUsObj;

          console.log(chalkBlue("INITIALIZED CLASSIFIED USERS"
            + " | " + Object.keys(classifiedUserHashmap).length
          ));

          updateClassifiedUsers(cnf, function(err){

            if (err) {
              console.error("*** UPDATE CLASSIFIED USER ERROR ***\n" + jsonPrint(err));
            }

            let messageObj = {};

            console.log(chalkBlue("\nTRAINING SET NORMALIZED"
              + " | " + trainingSetNormalized.length + " DATA POINTS"
              // + " | " + jsonPrint(trainingSetNormalized[0])
            ));
            debug(chalkBlue("\nTRAINING SET NORMALIZED\n" + jsonPrint(trainingSetNormalized)));

            testObj.inputArraysFile = inputArraysFolder + "/" + inputArraysFile;


            switch (cnf.networkCreateMode) {

              case "evolve":
                messageObj = {
                  op: "EVOLVE",
                  testRunId: testObj.testRunId,
                  inputArraysFile: testObj.inputArraysFile,
                  trainingSet: trainingSetNormalized,
                  normalization: statsObj.normalization,
                  iterations: cnf.evolve.iterations,
                  mutation: cnf.evolve.mutation,
                  activation: cnf.evolve.activation,
                  equal: cnf.evolve.equal,
                  popsize: cnf.evolve.popsize,
                  cost: cnf.evolve.cost,
                  elitism: cnf.evolve.elitism,
                  log: cnf.evolve.log,
                  error: cnf.evolve.error,
                  mutationRate: cnf.evolve.mutationRate,
                  clear: cnf.evolve.clear
                };
                console.log(chalkBlue("\nSTART NETWORK EVOLVE"));
              break;

              case "train":
                messageObj = {
                  op: "TRAIN",
                  testRunId: testObj.testRunId,
                  inputArraysFile: testObj.inputArraysFile,
                  trainingSet: trainingSetNormalized,
                  normalization: statsObj.normalization,
                  iterations: cnf.evolve.iterations
                };
                console.log(chalkBlue("\nSTART NETWORK TRAIN"));
              break;

              default:
            }

            console.log(chalkBlue("TEST RUN ID: " + messageObj.testRunId
              + "\nINPUT ARRAYS FILE:   " + messageObj.inputArraysFile
              + "\nTRAINING SET LENGTH: " + messageObj.trainingSet.length
              + "\nITERATIONS:          " + messageObj.iterations
            ));

            neuralNetworkChild.send(messageObj, function(err){
              if (err) {
                console.error(chalkError("*** NEURAL NETWORK CHILD SEND ERROR: " + err));
              }
            });

          });
        }
        else {
          console.log(chalkError("ERROR: loadFile: " + dropboxConfigHostFolder + "/classifiedUsers.json"));
        }
      });
    }

    console.log(chalkBlue(cnf.processName + " STARTED " + getTimeStamp() + "\n"));

    if (process.env.BATCH_MODE){
      slackChannel = "#nn_batch";
    }
    // else {
    // slackPostMessage(slackChannel, "\nSTART\n" + statsObj.runId);
    // }

    initNeuralNetworkChild();

  });
}

initTimeout();

