/*jslint node: true */
"use strict";

var ONE_SECOND = 1000 ;
var ONE_MINUTE = ONE_SECOND*60 ;

var os = require("os");
var hostname = os.hostname();
hostname = hostname.replace(/\.home/g, "");
hostname = hostname.replace(/\.local/g, "");
hostname = hostname.replace(/\.fios-router\.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

var defaultNeuralNetworkFile = "neuralNetwork_" + hostname + ".json";
var neuralNetworkFile = "neuralNetwork_" + hostname + "_" + process.pid + ".json";

var defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
var compactDateTimeFormat = "YYYYMMDD HHmmss";

var evolveRunning = false;
var evolveReady = true;

var neataptic = require("neataptic");
// var neataptic = require("./js/neataptic/neataptic.js");
var network;

var EventEmitter2 = require("eventemitter2").EventEmitter2;
var configEvents = new EventEmitter2({
  wildcard: true,
  newListener: true,
  maxListeners: 20,
  verboseMemoryLeak: true
});

var trainingSet = [];

var configuration = {};
configuration.verbose = false;
configuration.globalTestMode = false;
configuration.testMode = false; // 
configuration.keepaliveInterval = 30*ONE_SECOND;
configuration.rxQueueInterval = 1*ONE_SECOND;

var S = require("string");
var util = require("util");
var moment = require("moment");
var Dropbox = require("dropbox");
var HashMap = require("hashmap").HashMap;
var async = require("async");
var debug = require("debug")("la");
var debugLang = require("debug")("lang");
var debugQ = require("debug")("queue");

var chalk = require("chalk");
var chalkAlert = chalk.red;
var chalkRed = chalk.red;
var chalkRedBold = chalk.bold.red;
var chalkError = chalk.bold.red;
var chalkWarn = chalk.red;
var chalkLog = chalk.gray;
var chalkInfo = chalk.black;
var chalkInfoBold = chalk.bold.black;
var chalkConnect = chalk.blue;
var chalkDisconnect = chalk.yellow;


var resetInProgressFlag = false;

function reset(cause, callback){

  if (!resetInProgressFlag) {

    var c = cause;
    resetInProgressFlag = true;

    setTimeout(function(){
      resetInProgressFlag = false;
      console.log(chalkError(moment().format(compactDateTimeFormat) + " | RESET: " + c));
      if (callback) { callback(); }
    }, 1*ONE_SECOND);

  }
}

var jsonPrint = function (obj){
  if (obj) {
    return JSON.stringify(obj, null, 2);
  }
  else {
    return "UNDEFINED";
  }
};

console.log("\n\n=================================");
console.log("HOST:          " + hostname);
console.log("PROCESS ID:    " + process.pid);
console.log("PROCESS ARGS:  " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("=================================");

process.on("message", function(msg) {
  if (msg === "shutdown") {
    console.log("\n\n!!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n");
    setTimeout(function() {
      console.log("**** Finished closing connections ****\n\n ***** RELOADING evolveNeuralNetwork.js NOW *****\n\n");
      process.exit(0);
    }, 1500);
  }
});

function msToTime(duration) {
  var seconds = parseInt((duration / 1000) % 60);
  var minutes = parseInt((duration / (1000 * 60)) % 60);
  var hours = parseInt((duration / (1000 * 60 * 60)) % 24);
  var days = parseInt(duration / (1000 * 60 * 60 * 24));

  days = (days < 10) ? "0" + days : days;
  hours = (hours < 10) ? "0" + hours : hours;
  minutes = (minutes < 10) ? "0" + minutes : minutes;
  seconds = (seconds < 10) ? "0" + seconds : seconds;

  return days + ":" + hours + ":" + minutes + ":" + seconds;
}

var statsObj = {};

statsObj.hostname = hostname;
statsObj.pid = process.pid;
statsObj.heap = process.memoryUsage().heapUsed/(1024*1024);
statsObj.maxHeap = process.memoryUsage().heapUsed/(1024*1024);

statsObj.startTime = moment().valueOf();
statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

statsObj.training = {};
statsObj.training.startTime = 0;
statsObj.training.endTime = 0;
// ==================================================================
// DROPBOX
// ==================================================================

var DROPBOX_DEFAULT_SEARCH_TERM_FILES_DIR;

if (process.env.DROPBOX_DEFAULT_SEARCH_TERM_FILES_DIR !== undefined) {
  DROPBOX_DEFAULT_SEARCH_TERM_FILES_DIR = process.env.DROPBOX_DEFAULT_SEARCH_TERM_FILES_DIR + "/usa" ;
}
else {
  DROPBOX_DEFAULT_SEARCH_TERM_FILES_DIR = "/config/searchTerms/usa" ;
}

var DROPBOX_DEFAULT_SEARCH_TERMS_FILE = "defaultSearchTerms.txt";

var DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
var DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
var DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
var DROPBOX_NN_CONFIG_FILE = process.env.DROPBOX_NN_CONFIG_FILE || "evolveNeuralNetworkConfig.json";
var DROPBOX_NN_STATS_FILE = process.env.DROPBOX_NN_STATS_FILE || "evolveNeuralNetworkStats.json";

var dropboxConfigFolder = "/config/utility/" + hostname;
var dropboxConfigFile = hostname + "_" + DROPBOX_NN_CONFIG_FILE;
var statsFolder = "/stats/" + hostname;
var statsFile = DROPBOX_NN_STATS_FILE;

console.log("DROPBOX_NN_CONFIG_FILE: " + DROPBOX_NN_CONFIG_FILE);
console.log("DROPBOX_NN_STATS_FILE : " + DROPBOX_NN_STATS_FILE);

debug("dropboxConfigFolder : " + dropboxConfigFolder);
debug("dropboxConfigFile : " + dropboxConfigFile);

debug("statsFolder : " + statsFolder);
debug("statsFile : " + statsFile);

console.log("DROPBOX_WORD_ASSO_ACCESS_TOKEN :" + DROPBOX_WORD_ASSO_ACCESS_TOKEN);
console.log("DROPBOX_WORD_ASSO_APP_KEY :" + DROPBOX_WORD_ASSO_APP_KEY);
console.log("DROPBOX_WORD_ASSO_APP_SECRET :" + DROPBOX_WORD_ASSO_APP_SECRET);

var dropboxClient = new Dropbox({ accessToken: DROPBOX_WORD_ASSO_ACCESS_TOKEN });

function getTimeStamp(inputTime) {
  var currentTimeStamp ;

  if (inputTime  === undefined) {
    currentTimeStamp = moment().format(defaultDateTimeFormat);
    return currentTimeStamp;
  }
  else if (moment.isMoment(inputTime)) {
    currentTimeStamp = moment(inputTime).format(defaultDateTimeFormat);
    return currentTimeStamp;
  }
  else {
    currentTimeStamp = moment(parseInt(inputTime)).format(defaultDateTimeFormat);
    return currentTimeStamp;
  }
}

function showStats(options){
  if ((statsObj.training.startTime > 0) && (statsObj.training.endTime > 0)){
    statsObj.training.elapsed = msToTime(statsObj.training.endTime - statsObj.training.startTime);
  }
  else if (statsObj.training.startTime > 0){
    statsObj.training.elapsed = msToTime(moment().valueOf() - statsObj.training.startTime);
  }
  statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
  statsObj.heap = process.memoryUsage().heapUsed/(1024*1024);
  statsObj.maxHeap = Math.max(statsObj.maxHeap, statsObj.heap);

  if (options) {
    console.log("NN STATS\n" + jsonPrint(statsObj));
  }
  else {
    console.log(chalk.green("S - NN"
      + " | START: " + moment(parseInt(statsObj.startTime)).format(compactDateTimeFormat)
      + " | ELAPSED: " + statsObj.elapsed
      + " | TRAINING START: " + moment(parseInt(statsObj.training.startTime)).format(compactDateTimeFormat)
      + " | TRAINING ELAPSED: " + statsObj.elapsed
    ));
  }
}

function quit(message) {
  var msg = '';
  if (message) msg = message;
  console.log(process.argv[1]
    + " | NEURAL NET **** QUITTING"
    + " | CAUSE: " + msg
    + " | PID: " + process.pid
    
  );
  process.exit();
}

process.on('SIGHUP', function() {
  quit('SIGHUP');
});

process.on('SIGINT', function() {
  quit('SIGINT');
});


function evolve (params, callback){

  var options = {
    mutation: neataptic.Methods.Mutation.FFW,
    equal: true,
    popsize: 100,
    elitism: 10,
    log: 1,
    error: 0.03,
    iterations: params.iterations,
    mutationRate: 0.5
  };

  var numInputs = params.trainingSet[0]["input"].length;
  var numOutputs = params.trainingSet[0]["output"].length;

  console.log("EVOLVE"
    + " | INPUTS: " + numInputs
    + " | OUTPUTS: " + numOutputs
    + " | SET: " + params.trainingSet.length + " DATA POINTS"
    + " | ITERATIONS: " + options.iterations
    // + "\nOPTIONS\n" + jsonPrint(options)
  );

  network = new neataptic.Network(numInputs, numOutputs);

  network.evolve(params.trainingSet, options);
  
  if (callback !== undefined) { callback(); }
}

process.on('message', function(m) {

  debug(chalkAlert("NEURAL NET RX MESSAGE"
    + " | OP: " + m.op
    + "\n" + jsonPrint(m)
  ));

  switch (m.op) {

    case "INIT":
      statsObj.testRunId = m.testRunId;
      neuralNetworkFile = "neuralNetwork_" + m.testRunId + ".json";
      statsObj.neuralNetworkFile = "neuralNetwork_" + m.testRunId + ".json";
      console.log(chalkInfo("NEURAL NET INIT"
        + " | TEST RUN ID: " + m.testRunId
        + " | NEURAL NETWORK FILE: " + neuralNetworkFile
      ));
    break;

    case "STATS":
      showStats(m.options);
    break;

    case "EVOLVE":

      trainingSet = m.trainingSet;

      statsObj.training.startTime = moment().valueOf();
      statsObj.training.trainingSet = {};
      statsObj.training.trainingSet.length = trainingSet.length;

      console.log(chalkAlert("NN CHILD: NEURAL NET EVOLVE"
        + " | " + trainingSet.length + " TRAINING DATA POINTS"
      ));

      var evolveParams = {
        trainingSet: trainingSet,
        iterations: m.iterations
      };

      evolve(evolveParams, function(err){

        statsObj.training.endTime = moment().valueOf();
        statsObj.training.elapsed = moment().valueOf() - statsObj.training.startTime;

        var exportedNetwork = network.toJSON();

        var networkObj = {};
        networkObj.normalization = {};
        networkObj.normalization = m.normalization;
        networkObj.network = {};
        networkObj.network = exportedNetwork;

        console.log(chalkAlert("TRAINING COMPLETE"));
        console.log(chalkAlert("NORMALIZATION\n" + jsonPrint(networkObj.normalization)));

        saveFile(dropboxConfigFolder, neuralNetworkFile, networkObj, function(err){
          if (err){
            console.error(chalkError("SAVE NEURAL NETWORK FILE ERROR | " + neuralNetworkFile + " | " + err));
          }
          else {
            statsObj.neuralNetworkFile = neuralNetworkFile;
            console.log(chalkLog("SAVED NEURAL NETWORK FILE | " + dropboxConfigFolder + "/" + neuralNetworkFile));
          }
          process.send({op:"EVOLVE_COMPLETE", networkObj: networkObj, statsObj: statsObj});
        });
        showStats();
      });
    break;
    default:
      console.log(chalkError("NEURAL NETIZE UNKNOWN OP ERROR"
        + " | " + m.op
        + "\n" + jsonPrint(m)
      ));
  }
});

function saveFile (path, file, jsonObj, callback){

  var fullPath = path + "/" + file;

  debug(chalkInfo("LOAD FOLDER " + path));
  debug(chalkInfo("LOAD FILE " + file));
  debug(chalkInfo("FULL PATH " + fullPath));

  var options = {};

  options.contents = JSON.stringify(jsonObj, null, 2);
  options.path = fullPath;
  options.mode = "overwrite";
  options.autorename = false;

  dropboxClient.filesUpload(options)
    .then(function(response){
      debug(chalkLog("... SAVED DROPBOX JSON | " + options.path));
      callback(null, response);
    })
    .catch(function(error){
      console.error(chalkError(moment().format(defaultDateTimeFormat) 
        + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
        + "\nERROR: " + error.error));
      callback(error.error, null);
    });
}

function loadFile(path, file, callback) {

  debug(chalkInfo("LOAD FOLDER " + path));
  debug(chalkInfo("LOAD FILE " + file));
  debug(chalkInfo("FULL PATH " + path + "/" + file));

  var fileExists = false;

  dropboxClient.filesListFolder({path: path})
    .then(function(response) {

        async.each(response.entries, function(folderFile, cb) {

          debug("FOUND FILE " + folderFile.name);

          if (folderFile.name === file) {
            debug(chalkRedBold("SOURCE FILE EXISTS: " + path + "/" + file));
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

                var payload = data.fileBinary;
                debug(payload);

                if (file.match(/\.json$/gi)) {
                  var fileObj = JSON.parse(payload);
                  return(callback(null, fileObj));
                }
                else {
                  return(callback(null, payload));
                }

              })
              .catch(function(error) {
                console.log(chalkAlert("DROPBOX loadFile ERROR: " + file + "\n" + error));
                console.log(chalkError("!!! DROPBOX READ " + file + " ERROR"));
                console.log(chalkError(jsonPrint(error)));

                if (error.status === 404) {
                  console.error(chalkError("!!! DROPBOX READ FILE " + file + " NOT FOUND ... SKIPPING ..."));
                  return(callback(null, null));
                }
                if (error.status === 0) {
                  console.error(chalkError("!!! DROPBOX NO RESPONSE ... NO INTERNET CONNECTION? ... SKIPPING ..."));
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

  console.log(chalkInfo("initStatsUpdate | INTERVAL: " + cnf.statsUpdateIntervalTime));

  setInterval(function () {

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
    statsObj.timeStamp = moment().format(defaultDateTimeFormat);

    saveFile(statsFolder, statsFile, statsObj, function(){
      showStats();
    });

  }, cnf.statsUpdateIntervalTime);

  callback(null, cnf);

  // loadFile(statsFolder, statsFile, function(err, loadedStatsObj){
  //   if (!err) {
  //     debug(jsonPrint(loadedStatsObj));
  //   }
  //   else {
  //     console.log(chalkError("ERROR: loadFile: " + statsFolder + "/" + statsFile));
  //     return(callback(err, cnf));
  //   }
  // });
}

function initialize(cnf, callback){

  cnf.processName = process.env.NN_PROCESS_NAME || "evolveNeuralNetworkChild";

  cnf.verbose = process.env.NN_VERBOSE_MODE || false ;
  cnf.globalTestMode = process.env.NN_GLOBAL_TEST_MODE || false ;
  cnf.testMode = process.env.NN_TEST_MODE || false ;
  cnf.quitOnError = process.env.NN_QUIT_ON_ERROR || false ;

  cnf.statsUpdateIntervalTime = process.env.NN_STATS_UPDATE_INTERVAL || 60000;

  console.log("CONFIG\n" + jsonPrint(cnf));

  debug(chalkWarn("dropboxConfigFolder: " + dropboxConfigFolder));
  debug(chalkWarn("dropboxConfigFile  : " + dropboxConfigFile));

  callback(null, cnf);
}

configEvents.on("newListener", function(data){
  console.log(chalkInfo("*** NEW CONFIG EVENT LISTENER: " + data));
});

configEvents.on("removeListener", function(data){
  console.log(chalkInfo("*** REMOVED CONFIG EVENT LISTENER: " + data));
});


var initCompleteInterval;

setTimeout(function(){

  initialize(configuration, function(err, cnf){

    if (err && (err.status !== 404)) {
      console.error(chalkError("***** INIT ERROR *****\n" + jsonPrint(err)));
      // if (err.status !== 404){
      //   console.log("err.status: " + err.status);
        quit();
      // }
    }

    console.log(cnf.processName + " STARTED " + getTimeStamp() + "\n");

    initStatsUpdate(cnf, function(){
    });
  });
}, 1 * ONE_SECOND);


