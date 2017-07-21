/*jslint node: true */
"use strict";

const inputTypes = ["hashtags", "mentions", "urls", "words", "emoji"];
inputTypes.sort();

let trainingSetLabels = {};

let currentBestNetwork;
// let currentSeedNetwork;

let slackChannel = "#nn";

const neataptic = require("neataptic");

const DEFAULT_TEST_RATIO = 0.1;

const DEFAULT_NETWORK_CREATE_MODE = "evolve";

const DEFAULT_EVOLVE_BEST_NETWORK = false;
const DEFAULT_EVOLVE_SEED_NETWORK_ID = null;
const DEFAULT_EVOLVE_ACTIVATION = "LOGISTIC";
const DEFAULT_EVOLVE_CLEAR = false;
const DEFAULT_EVOLVE_COST = "CROSS_ENTROPY";
const DEFAULT_EVOLVE_ELITISM = 10;
const DEFAULT_EVOLVE_EQUAL = false;
const DEFAULT_EVOLVE_ERROR = 0.03;
const DEFAULT_EVOLVE_ITERATIONS = 100;
const DEFAULT_EVOLVE_LOG = 1;
const DEFAULT_EVOLVE_MUTATION = "FFW";
const DEFAULT_EVOLVE_MUTATION_RATE = 0.75;
const DEFAULT_EVOLVE_POPSIZE = 100;

let configuration = {};
configuration.evolveNetwork = true;
configuration.seedNetworkId = null;
configuration.normalization = null;
configuration.verbose = false;
configuration.testMode = false; // per tweet test mode
configuration.testSetRatio = DEFAULT_TEST_RATIO;

configuration.evolve = {};
configuration.useBestNetwork = DEFAULT_EVOLVE_BEST_NETWORK;
configuration.evolve.network = null;
configuration.evolve.networkId = DEFAULT_EVOLVE_SEED_NETWORK_ID;
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

// const DEFAULT_NEURAL_NETWORK_FILE = "neuralNetwork.json";
const slackOAuthAccessToken = "xoxp-3708084981-3708084993-206468961315-ec62db5792cd55071a51c544acf0da55";

const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const os = require("os");
const util = require("util");
const moment = require("moment");
const Dropbox = require("dropbox");
const pick = require("object.pick");
const omit = require("object.omit");
const arrayUnique = require("array-unique");
const Autolinker = require( "autolinker" );
const Slack = require("slack-node");
const cp = require("child_process");
const arrayNormalize = require("array-normalize");
const emojiRegex = require("emoji-regex");
const eRegex = emojiRegex();
// const consoleTable = require("console.table");
const columnify = require("columnify");

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
const chalkNetwork = chalk.blue;

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

let statsObj = {};
statsObj.hostname = hostname;
statsObj.pid = process.pid;

statsObj.memory = {};
statsObj.memory.rss = process.memoryUsage().rss/(1024*1024);
statsObj.memory.maxRss = process.memoryUsage().rss/(1024*1024);
statsObj.memory.maxRssTime = moment().valueOf();

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
histograms.emoji = {};

let classifiedUserHashmap = {};

let trainingSet = [];
let trainingSetNormalized = [];

let inputArrays = {};

const jsUcfirst = function(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

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
let NeuralNetwork; // DB

let neuralNetworkServer;
let userServer;

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

const seedNetworkId = { name: "seedNetworkId", alias: "s", type: String };
const useBestNetwork = { name: "useBestNetwork", alias: "b", type: Boolean };
const testMode = { name: "testMode", alias: "T", type: Boolean, defaultValue: false };
const evolveIterations = { name: "evolveIterations", alias: "I", type: Number};

const optionDefinitions = [
  seedNetworkId,
  useBestNetwork, 
  enableStdin, 
  quitOnError, 
  verbose, 
  evolveIterations, 
  testMode
];

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

// let neuralNetworkFolder = dropboxConfigHostFolder + "/neuralNetworks";
// let neuralNetworkFile = "neuralNetwork.json";

let classifiedUsersFolder = dropboxConfigDefaultFolder + "/classifiedUsers";
let classifiedUsersFile = "classifiedUsers.json";

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

// function allZeros(array){
//   let i = 0;
//   for (i = 0; i < array.length; i +=1){
//     if (array[i] !== 0) { return false; }
//   }
//   if (i === array.length) { return true; }
// }

// function allOnes(array){
//   let i = 0;
//   for (i = 0; i < array.length; i +=1){
//     if (array[i] !== 1) { return false; }
//   }
//   if (i === array.length) { return true; }
// }

function indexOfMax (arr, callback) {

  if (arr.length === 0) {
    console.log(chalkAlert("indexOfMax: 0 LENG ARRAY: -1"));
    return(callback(-2, arr)) ; 
  }

  if ((arr[0] === arr[1]) && (arr[1] === arr[2])){
    debug(chalkAlert("indexOfMax: ALL EQUAL"));
    debug(chalkAlert("ARR" 
      + " | " + arr[0].toFixed(2) 
      + " - " + arr[1].toFixed(2) 
      + " - " + arr[2].toFixed(2)
    ));
    if (arr[0] === 0) { return(callback(-4, arr)); }
    return(callback(4, [1,1,1])) ; 
  }

  debug("B4 ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));
  arrayNormalize(arr);
  debug("AF ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));

  if (((arr[0] === 1) && (arr[1] === 1)) 
    || ((arr[0] === 1) && (arr[2] === 1))
    || ((arr[1] === 1) && (arr[2] === 1))){

    debug(chalkAlert("indexOfMax: MULTIPLE SET"));

    debug(chalkAlert("ARR" 
      + " | " + arr[0].toFixed(2) 
      + " - " + arr[1].toFixed(2) 
      + " - " + arr[2].toFixed(2)
    ));

    async.eachOf(arr, function(val, index, cb){
      if (val < 1) {
        arr[index] = 0;
      }
      cb();
    }, function(){
      return( callback(3, arr) ); 
    });

  }
  else {

    // let max = arr[0];
    let max = 0;
    let maxIndex = -1;

    async.eachOfSeries(arr, function(val, index, cb1){
      if (val > max) {
        maxIndex = index;
        max = val;
      }
      cb1();
    }, function(){

      async.eachOf(arr, function(val, index, cb){
        if (val < 1) {
          arr[index] = 0;
        }
        cb();
      }, function(){
        return(callback(maxIndex, arr)); 
      });

    });

  }
}

function showStats(options){

  if (neuralNetworkChild !== undefined) {
    neuralNetworkChild.send({op: "STATS", options: options});
  }

  statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

  statsObj.memory.rss = process.memoryUsage().rss/(1024*1024);
  if (statsObj.memory.rss > statsObj.memory.maxRss) {
    statsObj.memory.maxRss = statsObj.memory.rss;
    statsObj.memory.maxRssTime = moment().valueOf();
  }

  if (options) {
    console.log("STATS\n" + jsonPrint(statsObj));
  }
  else {
    console.log(chalkLog("S"
      + " | RUN " + statsObj.elapsed
      + " | NOW " + moment().format(compactDateTimeFormat)
      + " | STRT " + moment(parseInt(statsObj.startTime)).format(compactDateTimeFormat)
      + " | ITERATIONS " + configuration.evolve.iterations
      + " | RSS " + statsObj.memory.rss.toFixed(1) + " MB"
      + " / " + statsObj.memory.maxRss.toFixed(1) + " MAX"
      + " @ " + getTimeStamp(statsObj.memory.maxRssTime)
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

  if (process.env.TNN_BATCH_MODE){
    slackChannel = "#nn_batch";
  }

  let slackText = "";

  if (statsObj.tests[testObj.testRunId].results.successRate !== undefined) {

    const snid = (statsObj.tests[testObj.testRunId].evolve.networkId !== undefined) 
      ? statsObj.tests[testObj.testRunId].evolve.networkId 
      + " | " + statsObj.tests[testObj.testRunId].evolve.network.successRate.toFixed(2) + "%"
      : "-" ;
    // console.log("\n=====================\nRESULTS\n" + jsonPrint(statsObj.tests[testObj.testRunId].results));
    slackText = "\n*" + statsObj.runId + "*";
    slackText = slackText + "\n*RES: " + statsObj.tests[testObj.testRunId].results.successRate.toFixed(1) + " %*";
    slackText = slackText + " | RUN " + statsObj.elapsed;
    slackText = slackText + "\nTESTS: " + statsObj.tests[testObj.testRunId].results.numTests;
    slackText = slackText + " | PASS: " + statsObj.tests[testObj.testRunId].results.numPassed;
    slackText = slackText + " | SKIP: " + statsObj.tests[testObj.testRunId].results.numSkipped;
    slackText = slackText + " | SEED NET: " + snid;
    slackText = slackText + "\nOPTIONS\n" + jsonPrint(statsObj.tests[testObj.testRunId].evolve.options);

    slackPostMessage(slackChannel, slackText);
  }

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
  console.log(chalkInfo("SAVE FILE FULL PATH " + fullPath));

  let options = {};

  options.contents = JSON.stringify(jsonObj, null, 2);
  options.path = fullPath;
  options.mode = "overwrite";
  options.autorename = false;

  dropboxClient.filesUpload(options)
    .then(function(response){
      debug(chalkLog("SAVED DROPBOX JSON | " + options.path));
      if (callback !== undefined) { callback(null, response); }
    })
    .catch(function(err){
      console.error(chalkError(moment().format(defaultDateTimeFormat) 
        + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
      ));
      if (err.status === 429) {
        console.error("TOO MANY DROPBOX WRITES");
        if (callback !== undefined) { callback(null, null); }
      }
      else {
        console.error("ERROR\n" + jsonPrint(err));
        console.error("ERROR.ERROR\n" + jsonPrint(err.error));
        if (callback !== undefined) { callback(err, null); }
      }
    });
}

function loadFile(path, file, callback) {

  console.log(chalkInfo("LOAD FOLDER " + path));
  console.log(chalkInfo("LOAD FILE " + file));
  console.log(chalkInfo("FULL PATH " + path + "/" + file));

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
// let statsIndex = 0;

function initStatsUpdate(cnf, callback){

  console.log(chalkBlue("INIT STATS UPDATE INTERVAL | " + cnf.statsUpdateIntervalTime + " MS"));

  clearInterval(statsUpdateInterval);

  statsUpdateInterval = setInterval(function () {

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
    statsObj.timeStamp = moment().format(defaultDateTimeFormat);

    statsObj.memory.rss = process.memoryUsage().rss/(1024*1024);
    if (statsObj.memory.rss > statsObj.memory.maxRss) {
      statsObj.memory.maxRss = statsObj.memory.rss;
      statsObj.memory.maxRssTime = moment().valueOf();
      console.log(chalkAlert("NEW MAX RSS"
        + " | " + statsObj.memory.maxRss.toFixed(1)
        + " | " + getTimeStamp(statsObj.memory.maxRssTime)
      ));
    }

    // if (statsIndex % 6 === 0){
      saveFile(statsFolder, statsFile, statsObj, function(){
        debug("END SAVE FILE");
      });
    // }
 
    showStats();

    // statsIndex += 1;

  }, cnf.statsUpdateIntervalTime);

  callback(null, cnf);
}

function initInputArrays(callback){

  console.log(chalkBlue("INIT INPUT ARRAYS"));

  async.eachSeries(inputTypes, function(inputType, cb){

    const inputFile = "defaultInput" + jsUcfirst(inputType) + ".json";

    console.log("INIT " + inputType.toUpperCase() + " INPUT ARRAY: " + inputFile);

    loadFile(dropboxConfigDefaultFolder, inputFile, function(err, inputArrayObj){
      if (!err) {
        debug(jsonPrint(inputArrayObj));

        arrayUnique(inputArrayObj[inputType]);

        inputArrayObj[inputType].sort();

        inputArrays[inputType] = {};
        inputArrays[inputType] = inputArrayObj[inputType];

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

      saveFile(inputArraysFolder, inputArraysFile, inputArrays, function(err, results){
        statsObj.inputArraysFile = inputArraysFolder + "/" + inputArraysFile;
        debug("results\n" + jsonPrint(results));
        debug("descriptionArrays\n" + jsonPrint(inputArrays));
        callback(err);
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


  if (process.env.TNN_EVOLVE_BEST_NETWORK !== undefined) {
    if (process.env.TNN_EVOLVE_BEST_NETWORK === "true") {
      cnf.useBestNetwork = true ;
    }
    else {
      cnf.useBestNetwork = false ;
    }
  }

  cnf.evolve.networkId = process.env.TNN_EVOLVE_SEED_NETWORK_ID || DEFAULT_EVOLVE_SEED_NETWORK_ID ;
  cnf.evolve.activation = process.env.TNN_EVOLVE_ACTIVATION || DEFAULT_EVOLVE_ACTIVATION ;
  cnf.evolve.clear = process.env.TNN_EVOLVE_CLEAR || DEFAULT_EVOLVE_CLEAR ;
  cnf.evolve.cost = process.env.TNN_EVOLVE_COST || DEFAULT_EVOLVE_COST ;
  cnf.evolve.elitism = process.env.TNN_EVOLVE_ELITISM || DEFAULT_EVOLVE_ELITISM ;
  cnf.evolve.equal = process.env.TNN_EVOLVE_EQUAL || DEFAULT_EVOLVE_EQUAL ;
  cnf.evolve.error = process.env.TNN_EVOLVE_ERROR || DEFAULT_EVOLVE_ERROR ;
  cnf.evolve.iterations = process.env.TNN_EVOLVE_ITERATIONS || DEFAULT_EVOLVE_ITERATIONS ;
  cnf.evolve.mutation = process.env.TNN_EVOLVE_MUTATION || DEFAULT_EVOLVE_MUTATION ;
  cnf.evolve.mutationRate = process.env.TNN_EVOLVE_MUTATION_RATE || DEFAULT_EVOLVE_MUTATION_RATE ;
  cnf.evolve.popsize = process.env.TNN_EVOLVE_POP_SIZE || DEFAULT_EVOLVE_POPSIZE ;

  // cnf.neuralNetworkFile = process.env.TNN_NEURAL_NETWORK_FILE || DEFAULT_NEURAL_NETWORK_FILE ;

  cnf.classifiedUsersFile = process.env.TNN_CLASSIFIED_USERS_FILE || classifiedUsersFile;
  cnf.classifiedUsersFolder = classifiedUsersFolder;
  cnf.statsUpdateIntervalTime = process.env.TNN_STATS_UPDATE_INTERVAL || 60000;

  debug(chalkWarn("dropboxConfigFolder: " + dropboxConfigFolder));
  debug(chalkWarn("dropboxConfigFile  : " + dropboxConfigFile));

  if (process.env.TNN_BATCH_MODE) {

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

        if (loadedConfigObj.TNN_EVOLVE_SEED_NETWORK_ID  !== undefined){
          console.log("LOADED TNN_EVOLVE_SEED_NETWORK_ID: " + loadedConfigObj.TNN_EVOLVE_SEED_NETWORK_ID);
          cnf.evolve.networkId = loadedConfigObj.TNN_EVOLVE_SEED_NETWORK_ID;
        }

        if (loadedConfigObj.TNN_EVOLVE_BEST_NETWORK  !== undefined){
          console.log("LOADED TNN_EVOLVE_BEST_NETWORK: " + loadedConfigObj.TNN_EVOLVE_BEST_NETWORK);
          cnf.useBestNetwork = loadedConfigObj.TNN_EVOLVE_BEST_NETWORK;
        }

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

        // if (loadedConfigObj.TNN_NEURAL_NETWORK_FILE_RUNID  !== undefined){
        //   console.log("LOADED TNN_NEURAL_NETWORK_FILE_RUNID: " + loadedConfigObj.TNN_NEURAL_NETWORK_FILE_RUNID);
        //   cnf.loadNeuralNetworkFileRunID = loadedConfigObj.TNN_NEURAL_NETWORK_FILE_RUNID;
        // }

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
          if (arg === "seedNetworkId") {
            cnf.evolve.networkId = commandLineConfig[arg];
            console.log("--> COMMAND LINE CONFIG | evolve.network.networkId: " + cnf.evolve.networkId);
          }
          else if (arg === "evolveIterations") {
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
            if (arg === "seedNetworkId") {
              cnf.evolve.networkId = commandLineConfig[arg];
              console.log("--> COMMAND LINE CONFIG | evolve.network.networkId: " + cnf.evolve.networkId);
            }
            else if (arg === "evolveIterations") {
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

  NeuralNetwork = require("mongoose").model("NeuralNetwork");
  User = require("mongoose").model("User");

  neuralNetworkServer = require("./app/controllers/neuralNetwork.server.controller");
  userServer = require("./app/controllers/user.server.controller");

});

let wordExtractionOptions = {
  language:"english",
  remove_digits: false,
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

  debug(chalk.blue("\nPARSE TEXT\n" + text + "\n"));

  if (text === "undefined") {
    console.error(chalkError("*** PARSER TEXT UNDEFINED"));
  }

  const userHistograms = {};
  userHistograms.words = {};
  userHistograms.urls = {};
  userHistograms.hashtags = {};
  userHistograms.mentions = {};
  userHistograms.emoji = {};

  text = text.replace(/,/gi, " ");

  const parseResults = parser.parse(text);

  let urlArray = [];
  let mentionArray = [];
  let hashtagArray = [];
  let emojiArray = [];


  async.each(parseResults, function(matchObj, cb0){

    const type = matchObj.getType();

    debug(chalkAlert("PARSE TEXT"
      + " | " + matchObj.getMatchedText().toLowerCase()
      + " | TYPE: " + type
    ));

    switch (type) {
      case "url":
        urlArray.push(matchObj.getMatchedText().toLowerCase());
        debug(chalkInfo(urlArray.length + " | URL: " + matchObj.getMatchedText().toLowerCase()));
        cb0();
      break;
      case "mention":
        mentionArray.push(matchObj.getMatchedText().toLowerCase());
        debug(chalkInfo(mentionArray.length + " | MEN: " + matchObj.getMatchedText().toLowerCase()));
        cb0();
      break;
      case "hashtag":
        hashtagArray.push(matchObj.getMatchedText().toLowerCase());
        debug(chalkInfo(hashtagArray.length + " | HTG: " + matchObj.getMatchedText().toLowerCase()));
        cb0();
      break;
      default:
        debug(chalkInfo("UNKNOWN PARSE TYPE: " + type));
        cb0();
    }

   }, function(){

    let mEmoji;

    while (mEmoji = eRegex.exec(text)) {
      const emj = mEmoji[0];
      emojiArray.push(emj);
      text = text.replace(emj, " ");
      debug(chalkInfo(emojiArray.length + " | EMJ: " + emj));
      debug(chalk.bold.black("\nTEXT LESS EMOJI: " + text + "\n\n"));
    }
 
    // let textWordBreaks = text.replace(/\//gim, " ");
    const wordArray = keywordExtractor.extract(text, wordExtractionOptions);

    async.parallel({

      mentions: function(cb1){
        if (mentionArray) {

          async.each(mentionArray, function(userId, cb2){
            userId = userId.toLowerCase();
            if (options.updateGlobalHistograms) {
              histograms.mentions[userId] = (histograms.mentions[userId] === undefined) ? 1 
                : histograms.mentions[userId]+1;
            }
            userHistograms.mentions[userId] = (userHistograms.mentions[userId] === undefined) ? 1 
              : userHistograms.mentions[userId]+1;
            debug(chalkAlert("->- DESC Ms"
              + " | " + userHistograms.mentions[userId]
              + " | " + userId
            ));
            cb2();
          }, function(err2){
            cb1(err2, userHistograms.mentions);
          });
        }
        else {
          cb1(null, userHistograms.mentions);
        }
      },

      hashtags: function(cb1){

        if (hashtagArray) {

          async.each(hashtagArray, function(hashtag, cb2){
            hashtag = hashtag.toLowerCase();
            if (options.updateGlobalHistograms) {
              histograms.hashtags[hashtag] = (histograms.hashtags[hashtag] === undefined) ? 1 
              : histograms.hashtags[hashtag]+1;
            }
            userHistograms.hashtags[hashtag] = (userHistograms.hashtags[hashtag] === undefined) ? 1 
              : userHistograms.hashtags[hashtag]+1;
            debug(chalkAlert("->- DESC Hs"
              + " | " + userHistograms.hashtags[hashtag]
              + " | " + hashtag
            ));
            cb2();
          }, function(err2){
            cb1(err2, userHistograms.hashtags);
          });
        }
        else {
          cb1(null, userHistograms.hashtags);
        }
      },

      words: function(cb1){

        if (wordArray) {

          async.each(wordArray, function(w, cb2){

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
              cb2();
            }
            else {
              if (options.updateGlobalHistograms) {
                histograms.words[word] = (histograms.words[word] === undefined) ? 1 
                  : histograms.words[word]+1;
              }
              userHistograms.words[word] = (userHistograms.words[word] === undefined) ? 1 
                : userHistograms.words[word]+1;

              debug(chalkAlert("->- DESC Ws"
                // + " | HIST: " + histograms.words[word]
                + " | " + userHistograms.words[word]
                + " | " + word
              ));

              cb2();
            }
          }, function(){
            cb1(null, userHistograms.words);
          });
        }
        else {
          cb1(null, userHistograms.words);
        }
      },

      urls: function(cb1){

        if (urlArray) {

          async.each(urlArray, function(url, cb2){

            url = url.toLowerCase();
            if (options.updateGlobalHistograms) {
              histograms.urls[url] = (histograms.urls[url] === undefined) ? 1 : histograms.urls[url]+1;
            }
            userHistograms.urls[url] = (userHistograms.urls[url] === undefined) ? 1 : userHistograms.urls[url]+1;
            debug(chalkAlert("->- DESC Us"
              + " | " + userHistograms.urls[url]
              + " | " + url
            ));
            cb2();
          }, function(err2){
            cb1(err2, userHistograms.urls);
          });
        }
        else {
          cb1(null, userHistograms.urls);
        }
      },

      emoji: function(cb1){

        if (emojiArray) {

          async.each(emojiArray, function(emoji, cb2){

            if (options.updateGlobalHistograms) {
              histograms.emoji[emoji] = (histograms.emoji[emoji] === undefined) 
              ? 1 
              : histograms.emoji[emoji]+1;
            }
            userHistograms.emoji[emoji] = (userHistograms.emoji[emoji] === undefined) 
              ? 1 
              : userHistograms.emoji[emoji]+1;

            debug(chalkAlert("->- DESC Es"
              + " | " + userHistograms.emoji[emoji]
              + " | " + emoji
            ));
            cb2();
          }, function(err2){
            cb1(err2, userHistograms.emoji);
          });
        }
        else {
          cb1(null, userHistograms.emoji);
        }
      }

    }, function(err, results){

      let t = "\nHISTOGRAMS";

      Object.keys(results).forEach(function(key){
        if (results[key]) {
          t = t + " | " + key.toUpperCase() + ": " + Object.keys(results[key]).length;
        }
      });
      debug(chalkInfo(t + "\n"));
      callback((err), results);
    });

  });
}

function printDatum(title, datum, label, callback){

  if (datum.input.length === 0) {
    console.error(chalkError("*** EMPTY DATUM INPUT ***\n" + jsonPrint(datum)));
  }

  let row = "";
  let col = 0;
  let rowNum = 0;
  const COLS = 50;
  let text = "";

  if (title) {
    debug(title + " --------");
    text = "\n-------- " + title + " --------\n";
  }
  else {
    debug("\n--------------------");
    text = "\n--------------------\n";
  }


  async.eachOfSeries(datum.input, function(bit, i, cb){

    if (bit && (i >= 2)) {
      debug("IN | " + label.inputRaw[i]);
    }

    if (i === 0) {
      debug("IN | " + label.inputRaw[i] + ": " + bit.toFixed(10));
      row = row + bit.toFixed(10) + " | " ;
    }
    else if (i === 1) {
      debug("IN | " + label.inputRaw[i] + ": " + bit.toFixed(10));
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
    // console.warn(text);
    callback(text);
  });
}

// FUTURE: break up into updateClassifiedUsers and createTrainingSet
function updateClassifiedUsers(cnf, callback){


  let classifiedUserIds = Object.keys(classifiedUserHashmap);
  let maxMagnitude = 0;
  let totalInputHits = 0;

  console.log(chalkBlue("UPDATE CLASSIFIED USERS: " + classifiedUserIds.length));

  if (cnf.normalization) {
    maxMagnitude = cnf.normalization.magnitude.max;
  }

  async.each(classifiedUserIds, function(userId, cb0){

    debug(chalkInfo("updateClassifiedUsers: userId: " + userId));

    User.findOne({userId: userId.toString()}, function(err, user){

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

        debug(chalkInfo("\n==============================\n"));
        debug(currentChalk("ADD  | U"
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

        trainingSetDatum.input = [];
        trainingSetDatum.input.push(sentimentObj.magnitude);
        trainingSetDatum.input.push(sentimentObj.score);


        // KLUDGE!!!! should only need to create trainingSetLabels once per network creation

        trainingSetLabels.inputRaw = [];
        trainingSetLabels.inputs = {};

        trainingSetLabels.inputs.sentiment = [];

        trainingSetLabels.inputs.sentiment.push("magnitude");
        trainingSetLabels.inputs.sentiment.push("score");

        trainingSetLabels.inputRaw.push("magnitude");
        trainingSetLabels.inputRaw.push("score");

        inputTypes.forEach(function(type){
          trainingSetLabels.inputs[type] = [];
        });


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
              if ((user.status !== undefined) && user.status && user.status.text) {
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

                debug(chalkBlue("RT\n" + jsonPrint(user.retweeted_status.text)));

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

              async.eachSeries(inputTypes, function(type, cb1){

                debug(chalkAlert("START ARRAY: " + type + " | " + inputArrays[type].length));

                async.eachSeries(inputArrays[type], function(element, cb2){

                  trainingSetLabels.inputs[type].push(element);
                  trainingSetLabels.inputRaw.push(element);

                  if (histogram[type][element]) {
                    trainingSetDatum.inputHits += 1;
                    debug(chalkBlue("+ DATUM BIT: " + type
                      + " | INPUT HITS: " + trainingSetDatum.inputHits 
                      + " | " + element 
                      + " | " + histogram[type][element]
                    ));
                    trainingSetDatum.input.push(1);
                    cb2();
                  }
                  else {
                    debug(chalkInfo("- DATUM BIT: " + type
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
          async.eachSeries(inputTypes, function(type, cb3){

            async.each(inputArrays[type], function(val, cb4){
              debug(type + ": " + val);
              trainingSetDatum.input.push(0);
              cb4();
            }, function(){
              cb3();
            });

          }, function(err){
            if (err) {
              console.error("*** INIT INPUT ARRAY ERROR\n" + err);
            }
            console.log(chalkBlue("INIT INPUT ARRAY COMPLETE"
              + " | " + trainingSetDatum.input.length + " INPUTS"
              + " | " + trainingSetDatum.inputHits + " INPUT HITS"
            ));
          });
        }

        trainingSetDatum.output = [];
        trainingSetLabels.outputs = [];
        trainingSetLabels.outputs = ["LEFT", "NEUTRAL", "RIGHT"];

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

        testObj.numInputs = trainingSetDatum.input.length;
        testObj.numOutputs = trainingSetDatum.output.length;

        debug("trainingSetDatum INPUT:  " + trainingSetDatum.input);
        debug("trainingSetDatum OUTPUT: " + trainingSetDatum.output);

        printDatum(user.screenName, trainingSetDatum, trainingSetLabels, function(text){
          debug(chalkInfo(text));
          trainingSet.push({name: user.screenName, datum: trainingSetDatum, labels: trainingSetLabels});
          cb0();
        });
      }
      else {
        console.log(chalkBlue("UPDATING DB USER KEYWORDS"
          + " | " + keywordArray
          + " | " + classification
          + " | " + user.userId
          + " | " + user.screenName
          + " | " + user.name
          + " | 3C FOLLOW: " + threeceeFollowing
          + " | FLLWs: " + user.followersCount
          + " | FRNDs: " + user.friendsCount
          + " | SEN: " + sentimentText
          + " | KW: " + keywordArray
        ));

        console.log(chalkBlue("KEYWORDS: " + Object.keys(classifiedUserHashmap[userId])));

        user.keywords = classifiedUserHashmap[userId];

        userServer.findOneUser(user, {noInc: true}, function(err, updatedUser){
          debug("updatedUser\n" + jsonPrint(updatedUser));
          cb0(err);
        });
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

      async.each(trainingSet, function(dataObj, cb){

        if (maxMagnitude > 0) {
          let normMagnitude = dataObj.datum.input[0]/maxMagnitude;
          dataObj.datum.input[0] = normMagnitude;
        }
        else {
          dataObj.datum.input[0] = 0;
        }


        if (configuration.testMode) {
          testObj.testSet.push(dataObj);
          cb();
        }
        else if (Math.random() < cnf.testSetRatio) {
          testObj.testSet.push(dataObj);
          cb();
        }
        else {
          trainingSetNormalized.push(dataObj);
          cb();
        }

      }, function(){
        callback(err);
      });

  });
}

let activateInterval;

function activateNetwork(n, input, callback){

  let output;
  output = n.activate(input);

  activateInterval = setInterval(function(){

    if (output) {
      clearInterval(activateInterval);
      debug(chalkAlert("NET OUTPUT\n" + jsonPrint(output)));
      callback(output);
    }
  }, 200);
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
  let testResultArray = [];

  async.eachSeries(testObj.testSet, function(testDatumObj, cb){

    if (testDatumObj.datum.input.length !== testObj.numInputs) {
      console.error(chalkError("MISMATCH INPUT"
        + " | TEST INPUTS: " + testDatumObj.datum.input.length 
        + " | NETW INPUTS: " + testObj.numInputs 
      ));
      quit();
    }

    activateNetwork(nw, testDatumObj.datum.input, function(to){

      let testOutput = to;

      debug(chalkLog("========================================"));

      // printDatum(testDatumObj.name, testDatumObj.datum, testDatumObj.labels, function(text){

        // debug(chalkInfo(text));

        numTested += 1;

        indexOfMax(testOutput, function(testMaxOutputIndex, to){

          debug("INDEX OF MAX TEST OUTPUT: " + to);

          indexOfMax(testDatumObj.datum.output, function(expectedMaxOutputIndex, eo){

            debug("INDEX OF MAX TEST OUTPUT: " + eo);

            let passed = (testMaxOutputIndex === expectedMaxOutputIndex);

            numPassed = passed ? numPassed+1 : numPassed;

            successRate = 100 * numPassed/(numTested + numSkipped);

            let currentChalk = passed ? chalkLog : chalkAlert;

            testResultArray.push(
              {
                // testIn: testDatumObj.datum.input,
                P: passed,
                EO: testDatumObj.datum.output,
                EOI: expectedMaxOutputIndex,
                TO: testOutput, 
                TOI: testMaxOutputIndex
              }
            );

            debug(currentChalk("TEST RESULT: " + passed 
              + " | " + successRate.toFixed(2) + "%"
              // + "\n" + "TO: " + testOutput 
              + "\n" + testOutput[0]
              + " " + testOutput[1]
              + " " + testOutput[2]
              + " | TMOI: " + testMaxOutputIndex
              // + "\n" + "EO: " + testDatum.output 
              + "\n" + testDatumObj.datum.output[0]
              + " " + testDatumObj.datum.output[1]
              + " " + testDatumObj.datum.output[2]
              + " | EMOI: " + expectedMaxOutputIndex
              // + "\n==================================="
            ));

            cb();
          });

        });
      // });
    });
  }, function(err){
    callback(err, 
      { testRunId: testObj.testRunId, 
        numTests: testObj.testSet.length, 
        numSkipped: numSkipped, 
        numPassed: numPassed, 
        successRate: successRate,
        testResultArray: testResultArray
      }
    );
  });
}

function initMain(cnf){

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
          quit("UPDATE CLASSIFIED USER ERROR");
        }

        if (trainingSetNormalized.length === 0) {
          console.error("*** NO TRAINING SET DATA POINTS ??? ***\n" + jsonPrint(err));
          quit("NO TRAINING SET DATA POINTS");
          return;
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
              network: cnf.evolve.network,
              inputs: trainingSetLabels.inputs,
              outputs: trainingSetLabels.outputs,
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
            console.log(chalkError("UNKNOWN NETWORK CREATE MODE: " + cnf.networkCreateMode));
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
      console.log(chalkError("ERROR: loadFile: " + cnf.classifiedUsersFolder + "/" + cnf.classifiedUsersFile));
    }
  });
}


function initNeuralNetworkChild(callback){

  // neuralNetworkReady = false;

  neuralNetworkChild = cp.fork(`neuralNetworkChild.js`);

  neuralNetworkChild.on("message", function(m){

    console.log(chalkAlert("neuralNetworkChild RX"
      + " | " + m.op
      // + " | " + m.obj.userId
      // + " | " + m.obj.screenName
      // + " | " + m.obj.name
      // + "\n" + jsonPrint(m)
    ));

    if (m.error) {
      console.error(chalkError("neuralNetworkChild RX ERROR: " + m.error));
      if (callback !== undefined) { 
        return(callback(m.error));
      }
      return;
    }

    switch(m.op) {

      case "READY":
        console.log(chalkInfo("TEST NEURAL NETWORK"));
        neuralNetworkChild.send({op: "TEST_EVOLVE"});
      break;

      case "STATS":
        console.log("NNC | STATS | " + Object.keys(statsObj));
      break;

      case "TEST_EVOLVE_COMPLETE":
        if (m.results) {
          console.log(chalkAlert("TEST EVOLVE XOR PASS"));
          // neuralNetworkReady = true;
          initMain(configuration);
        }
        else {
          console.error(chalkError("*** TEST EVOLVE XOR FAILED ***"));
          quit("TEST EVOLVE FAILED");
        }
      break;

      case "TRAIN_COMPLETE":
      case "EVOLVE_COMPLETE":

        console.log(chalkBlue("NETWORK EVOLVE/TRAIN COMPLETE"
          + "\nELAPSED: " + msToTime(m.networkObj.elapsed)
          + "\nITERTNS: " + m.statsObj.evolve.options.iterations
          + "\nSEED NN: " + m.networkObj.evolve.options.network.networkId
          + "\nINPUTS:  " + m.networkObj.network.input
          + "\nOUTPUTS: " + m.networkObj.network.output
          + "\nDROPOUT: " + m.networkObj.network.dropout
          + "\nNODES:   " + m.networkObj.network.nodes.length
          + "\nCONNS:   " + m.networkObj.network.connections.length
          // + "\nNORM: M: "
          // + m.networkObj.normalization.magnitude.min.toFixed(3) 
          // + "/" + m.networkObj.normalization.magnitude.max.toFixed(3)
          // + " | S: " 
          // + m.networkObj.normalization.score.min.toFixed(3) 
          // + "/" + m.networkObj.normalization.score.max.toFixed(3)
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
          statsObj.tests[testObj.testRunId].results = pick(
            testObj.results, 
            ["successRate", "numPassed", "numSkipped", "numTests", "testRunId"]
          );
          statsObj.tests[testObj.testRunId].training = {};
          statsObj.tests[testObj.testRunId].evolve = {};
          statsObj.tests[testObj.testRunId].evolve.options = omit(m.statsObj.evolve.options, "network");

          if (m.statsObj.evolve.options.network && (m.statsObj.evolve.options.network !== undefined)){
            statsObj.tests[testObj.testRunId].evolve.network = {};
            statsObj.tests[testObj.testRunId].evolve.network.networkId = m.statsObj.evolve.options.network.networkId;
            statsObj.tests[testObj.testRunId].evolve.network.successRate = m.statsObj.evolve.options.network.successRate;
          }

          statsObj.tests[testObj.testRunId].elapsed = m.networkObj.elapsed;

          // console.table(results.testResultArray);
          console.log(chalkBlue("\nNETWORK TEST COMPLETE\n==================="));

          let columns = columnify(results.testResultArray, {  minWidth: 8, maxWidth: 16});
          console.log(chalkAlert(columns));

          console.log(chalkBlue("\nNETWORK TEST COMPLETE\n==================="
            + "\n  TESTS:   " + results.numTests
            + "\n  PASSED:  " + results.numPassed
            + "\n  SKIPPED: " + results.numSkipped
            + "\n  SUCCESS: " + results.successRate.toFixed(1) + "%"
            // + "\n  EVOLVE OPTIONS"
            // + "\n  " + jsonPrint(statsObj.tests[testObj.testRunId].evolve.options)
          ));

          const options = statsObj.tests[testObj.testRunId].evolve.options;

          console.log("\nEVOLVE OPTIONS\n===================");
          Object.keys(options).forEach(function(key){
            if (key === "network") {
              console.log("  " + key + ": " + options[key].networkId + " | " + options[key].successRate.toFixed(2) + "%");
            }
            else {
              console.log("  " + key + ": " + options[key]);
            }
          });

          console.log(chalkLog("SAVING NEURAL NETWORK FILE TO DB"
            + " | ID: " + testObj.testRunId
          ));

          let networkObj = new NeuralNetwork();
          networkObj.networkId = testObj.testRunId;
          networkObj.network = m.networkObj.network;
          networkObj.successRate = results.successRate;
          networkObj.inputs = trainingSetLabels.inputs;
          networkObj.outputs = trainingSetLabels.outputs;
          networkObj.evolve = {};
          networkObj.evolve.options = {};
          networkObj.evolve.options = omit(m.statsObj.evolve.options, "network");

          networkObj.test = statsObj.tests[testObj.testRunId];

          // if (m.statsObj.evolve.options.network !== undefined){
          if (m.statsObj.evolve.options.network && (m.statsObj.evolve.options.network !== undefined)){
            networkObj.evolve.options.network = {};
            networkObj.evolve.options.network.networkId = m.statsObj.evolve.options.network.networkId;
            networkObj.evolve.options.network.successRate = m.statsObj.evolve.options.network.successRate;

            networkObj.test.evolve.network = {};
            networkObj.test.evolve.network.networkId = m.statsObj.evolve.options.network.networkId;
            networkObj.test.evolve.network.successRate = m.statsObj.evolve.options.network.successRate;
          }

          console.log("networkObj.network\n" + jsonPrint(Object.keys(networkObj.network)));

          neuralNetworkServer.findOneNetwork(networkObj, {}, function(err, updateNetworkObj){
            if (err) {
              throw err;
            }

            console.log("> NETWORK UPDATED"
              + "\nNET ID:  " + updateNetworkObj.networkId 
              // + "\nTYPE:    " + updateNetworkObj.networkType
              + "\nSUCCESS: " + updateNetworkObj.successRate.toFixed(1) + "%"
              + "\nIN:      " + updateNetworkObj.network.input
              + "\nOUT:     " + updateNetworkObj.network.output
              + "\nEVOLVE:  " + jsonPrint(updateNetworkObj.evolve) 
              + "\nTRAIN:   " + jsonPrint(updateNetworkObj.train)
              + "\nTEST:    " + jsonPrint(updateNetworkObj.test)
              + "\nCREATED: " + moment(new Date(updateNetworkObj.createdAt)).format(compactDateTimeFormat) 
            );

            quit();
          });

        });
      break;

      default:
      console.error(chalkError("neuralNetworkChild | UNKNOWN OP: " + m.op));
    }
  });

  if (callback !== undefined) { callback(); }
}

function printNetworkObj(title, nnObj){
  console.log(chalkNetwork("\n==================="
    + "\n" + title
    + "\nID:      " + nnObj.networkId
    + "\nCREATED: " + getTimeStamp(nnObj.createdAt)
    + "\nSUCCESS: " + nnObj.successRate.toFixed(2) + "%"
    + "\nINPUTS:  " + Object.keys(nnObj.inputs)
    + "\nEVOLVE\n" + jsonPrint(nnObj.evolve)
    + "\n===================\n"
  ));
}

function loadBestNeuralNetwork(callback){

  console.log(chalkNetwork("LOADING BEST NEURAL NETWORK FROM DB"));

  let maxSuccessRate = 0;
  let nnCurrent = {};

  NeuralNetwork.find({}, function(err, nnArray){
    if (err) {
      console.log(chalkError("NEUAL NETWORK FIND ERR\n" + err));
      callback(err, null);
    }
    else if (nnArray.length === 0){
      console.log("NO NETWORKS FOUND");
      callback(err, null);
    }
    else{
      console.log(nnArray.length + " NETWORKS FOUND");

      async.eachSeries(nnArray, function(nn, cb){

        debug(chalkInfo("NN"
          + " | ID: " + nn.networkId
          + " | SUCCESS: " + nn.successRate.toFixed(2) + "%"
        ));

        if (nn.successRate > maxSuccessRate) {

           console.log(chalkNetwork("NEW MAX NN"
            + " | ID: " + nn.networkId
            + " | SUCCESS: " + nn.successRate.toFixed(2) + "%"
          ));

          maxSuccessRate = nn.successRate;
          nnCurrent = nn;
          nnCurrent.inputs = nn.inputs;

        }

        cb();

      }, function(err){

        if (err) {
          console.log(chalkError("*** loadBestNeuralNetwork ERROR\n" + err));
          return(callback(err, null));
        }

        printNetworkObj("LOADING NEURAL NETWORK", nnCurrent);

        if (currentBestNetwork) {

          if (currentBestNetwork.networkId !== nnCurrent.networkId) {

            printNetworkObj("NEW BEST NETWORK", nnCurrent);

            currentBestNetwork = nnCurrent;

            Object.keys(nnCurrent.inputs).forEach(function(type){
              console.log(chalkNetwork("NN INPUTS TYPE" 
                + " | " + type
                + " | INPUTS: " + nnCurrent.inputs[type].length
              ));
              inputArrays[type] = nnCurrent.inputs[type];
            });

            network = neataptic.Network.fromJSON(nnCurrent.network);

            statsObj.currentBestNetworkId = nnCurrent.networkId;
            statsObj.network.networkId = nnCurrent.networkId;
            statsObj.network.networkType = nnCurrent.networkType;
            statsObj.network.successRate = nnCurrent.successRate;
            statsObj.network.input = nnCurrent.network.input;
            statsObj.network.output = nnCurrent.network.output;
            statsObj.network.evolve = {};
            statsObj.network.evolve = nnCurrent.evolve;

            callback(null, nnCurrent);

          }
          else {
            console.log("--- " + nnCurrent.networkId + " | " + nnCurrent.successRate.toFixed(2));

            callback(null, null);
          }
        }
        else {

          currentBestNetwork = nnCurrent;

          printNetworkObj("LOADED BEST NETWORK", nnCurrent);

          Object.keys(nnCurrent.inputs).forEach(function(type){
            console.log(chalkNetwork("NN INPUTS TYPE" 
              + " | " + type
              + " | INPUTS: " + nnCurrent.inputs[type].length
            ));
            inputArrays[type] = nnCurrent.inputs[type];
          });

          network = neataptic.Network.fromJSON(nnCurrent.network);

          statsObj.currentBestNetworkId = nnCurrent.networkId;

          statsObj.network = {};
          statsObj.network.networkId = nnCurrent.networkId;
          statsObj.network.networkType = nnCurrent.networkType;
          statsObj.network.successRate = nnCurrent.successRate;
          statsObj.network.input = nnCurrent.network.input;
          statsObj.network.output = nnCurrent.network.output;
          statsObj.network.evolve = {};
          statsObj.network.evolve = nnCurrent.evolve;

          callback(null, nnCurrent);

        }
      });
    }
  });
}

function loadNeuralNetwork(options, callback){

  if (options.networkId === "BEST"){
    loadBestNeuralNetwork(function(err, nn){
      callback(err, nn);
    });
  }
  else {
    NeuralNetwork.findOne({networkId: options.networkId}, function(err, nn){
      if (err) {
        console.log(chalkError("NEUAL NETWORK FIND ONE ERR\n" + err));
        callback(err, null);
      }
      else if (!nn){
        console.log("NO NETWORK FOUND " + options.networkId);
        callback(null, null);
      }
      else{
        console.log(chalkInfo("NETWORK FOUND"
          + " | ID: " + nn.networkId
          + " | SUCCESS: " + nn.successRate.toFixed(2) + "%"
        ));

        async.each(Object.keys(nn.inputs), function(type, cb){
          console.log(chalkNetwork("NN INPUTS TYPE" 
            + " | " + type
            + " | INPUTS: " + nn.inputs[type].length
          ));

          inputArrays[type] = nn.inputs[type];
          cb();

        }, function(){
          network = neataptic.Network.fromJSON(nn.network);

          statsObj.seedNetworkId = nn.networkId;
          statsObj.network = {};
          statsObj.network.networkId = nn.networkId;
          statsObj.network.networkType = nn.networkType;
          statsObj.network.successRate = nn.successRate;
          statsObj.network.input = nn.network.input;
          statsObj.network.output = nn.network.output;
          statsObj.network.evolve = {};
          statsObj.network.evolve = nn.evolve;

          callback(null, nn);
        });
      }
    });
  }
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

    console.log(chalkBlue("\n\n" + cnf.processName + " STARTED " + getTimeStamp() + "\n" + jsonPrint(configuration)));

    if (cnf.useBestNetwork) {

      loadBestNeuralNetwork(function(err, nnObj){

        if (err) {
          console.log(chalkError("LOAD NN ERROR\n" + err));
        }

        console.log(chalkAlert("NN: " + nnObj.networkId));

        configuration.evolve.network = nnObj;

        initNeuralNetworkChild(function(){
          if (process.env.TNN_BATCH_MODE){
            slackChannel = "#nn_batch";
          }
        });

      });
    }
    else if (cnf.evolve.networkId){

      loadNeuralNetwork({networkId: cnf.evolve.networkId}, function(err, nnObj){

        if (err) {
          console.error(chalkError("loadNeuralNetwork ERROR\n" + err));
          throw err;
        }

        cnf.evolve.network = nnObj;

        initNeuralNetworkChild(function(){

          if (process.env.TNN_BATCH_MODE){
            slackChannel = "#nn_batch";
          }

        });

      });
    }

    else {
      initNeuralNetworkChild(function(){

        if (process.env.TNN_BATCH_MODE){
          slackChannel = "#nn_batch";
        }

      });
    }

  

  });
}

initTimeout();

