/*jslint node: true */
"use strict";

const version = 0.47;

var DEFAULT_EVOLVE_ITERATIONS = 100;

var ONE_SECOND = 1000 ;

var os = require("os");
var util = require("util");
var moment = require("moment");
var Dropbox = require("dropbox");

var hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

var neuralNetworkFile = "neuralNetwork_" + hostname + ".json";

// var neataptic = require("./js/neataptic/neataptic.js");
var neataptic = require("neataptic");
var network;
var evolveNeuralNetwork;

var cp = require("child_process");
var keywordExtractor = require("keyword-extractor");

var mentionsRegex = require('mentions-regex');
var hashtagRegex = require('hashtag-regex');

var defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
var compactDateTimeFormat = "YYYYMMDD_HHmmss";

var classifiedUserHashmap = {};

var trainingSet = [];
var trainingSetNormalized = [];

var testObj = {};
testObj.testRunId = hostname + "_" + process.pid + "_" + moment().format(compactDateTimeFormat);
testObj.testSet = [];

var descriptionWordsFile = "defaultDescriptionWords.json";
var descriptionWordsArray = [];

var descriptionMentionsFile = "defaultDescriptionMentions.json";
var descriptionMentionsArray = [];

var descriptionHashtagsFile = "defaultDescriptionHashtags.json";
var descriptionHashtagsArray = [];

var descriptionArrays = [];
var descriptionArraysFile = "descriptionArraysFile_" + testObj.testRunId + ".json";


function initDescriptionArrays(callback){

  async.each([descriptionWordsFile, descriptionMentionsFile, descriptionHashtagsFile], function(file, cb){

    loadFile(dropboxConfigDefaultFolder, file, function(err, loadedArrayObj){
      if (!err) {
        debug(jsonPrint(loadedArrayObj));
        if (loadedArrayObj["words"] !== undefined) { 
          descriptionWordsArray = loadedArrayObj["words"].sort();
          console.log(chalkAlert("LOADED WORDS ARRAY | " + descriptionWordsArray.length + " WORDS"));
        }
        if (loadedArrayObj["mentions"] !== undefined) { 
          descriptionMentionsArray = loadedArrayObj["mentions"].sort();
          console.log(chalkAlert("LOADED MENTIONS ARRAY | " + descriptionMentionsArray.length + " MENTIONS"));
        }
        if (loadedArrayObj["hashtags"] !== undefined) { 
          descriptionHashtagsArray = loadedArrayObj["hashtags"].sort();
          console.log(chalkAlert("LOADED HASHTAGS ARRAY | " + descriptionHashtagsArray.length + " HASHTAGS"));
        }
        cb();
      }
      else {
        console.log(chalkError("ERROR: loadFile: " + dropboxConfigFolder + "/" + file));
        cb(err);
      }
    });
  }, function(err){
    if (err){
      console.log(chalkError("ERR\n" + jsonPrint(err)));
      return(callback(err));
    }
    else {
      descriptionArrays.push({type: "mentions", array: descriptionMentionsArray});
      descriptionArrays.push({type: "hashtags", array: descriptionHashtagsArray});
      descriptionArrays.push({type: "words", array: descriptionWordsArray});

      console.log(chalkAlert("LOADED DESCRIPTION ARRAY FILES"));

      saveFile(statsFolder, descriptionArraysFile, descriptionArrays, function(){
        statsObj.descriptionArraysFile = descriptionArraysFile;
        debug("descriptionArrays\n" + jsonPrint(descriptionArrays));
        return(callback(null));
      });
    }
  });
}

var EventEmitter2 = require("eventemitter2").EventEmitter2;
var configEvents = new EventEmitter2({
  wildcard: true,
  newListener: true,
  maxListeners: 20,
  verboseMemoryLeak: true
});

var userReadyTransmitted = false;
var userReadyAck = false;
var serverConnected = false;

var stdin;

var cursorTweet;

var configuration = {};
configuration.normalization = null;
configuration.cursorTweetPause = false;
configuration.verbose = false;
configuration.testMode = false; // per tweet test mode
configuration.testSetRatio = 0.05;

configuration.twitterConfigs = {};

// altThreecee00 twitter config
configuration.twitterConfigs.altthreecee00 = {
  CONSUMER_KEY: "0g1pAgIqe6f3LN9yjaPBGJcSL",
  CONSUMER_SECRET: "op5mSFdo1jenyiTxFyED0yD2W1rmviq35qpVlgSSyIIlFPuBj7",
  TOKEN: "848591649575927810-g8Hx92DSSYk0yoN08KGRs6Fbc79yFXG",
  TOKEN_SECRET: "MiQPSuEXlkYcinlSFdLFdbjPbtFanCtLf8o6sE9BFPyPI"
};

// threeceeInfo
configuration.twitterConfigs.threeceeinfo = {
  CONSUMER_KEY: "fSzMXlWMe9Pkb7wZmjk9RAvPq",
  CONSUMER_SECRET: "9UxaLZeUopnASZhiQcdb8me9Vmr6ZIYmQH1rnSTegYADzYK5xi",
  TOKEN: "2965616537-ftHgycWsPO6O6DbhIZdnifcfegnEKfa876Ue09C",
  TOKEN_SECRET: "4p6OowdsTENcQBQWk1ERjwqqsQF0sUd6n2VPJ7AN6NLVG"
};

// ninjathreecee
configuration.twitterConfigs.ninjathreecee = {
  "CONSUMER_KEY": "KTDtT7IouFrskZBcjeI9x45kk",
  "CONSUMER_SECRET": "6jHURX5dMx9ubXNZcMQ3qszAVPTyge4UK3YUPqvEKPw3dQfdF3",
  "TOKEN": "1118058524-pjFKKdB1htLvyMLvuzzkjaOphewOcKUmj2VGVCR",
  "TOKEN_SECRET": "qT5RoHUgoE768ztcGO4EccrSf6HrxDHD075f4L41zxrme",
};


var socket;

var async = require("async");

var chalk = require("chalk");
var chalkAlert = chalk.red;
var chalkTwitter = chalk.blue;
var chalkRed = chalk.red;
var chalkRedBold = chalk.bold.red;
var chalkError = chalk.bold.red;
var chalkWarn = chalk.red;
var chalkLog = chalk.gray;
var chalkInfo = chalk.black;
var chalkConnect = chalk.green;
var chalkDisconnect = chalk.yellow;

var debug = require("debug")("twm");
var debugCache = require("debug")("cache");
var debugQ = require("debug")("queue");

var socketKeepaliveInterval;

var HashMap = require("hashmap").HashMap;

var searchTermHashMap = new HashMap();
var twitterUserHashMap = new HashMap();

var Tweet;

var resetInProgressFlag = false;

var mongoose;
var db;
var userServer;
var User;

function reset(cause, callback){

  if (!resetInProgressFlag) {

    var c = cause;
    resetInProgressFlag = true;

    setTimeout(function(){
      resetInProgressFlag = false;
      console.log(chalkError(moment().format(compactDateTimeFormat) + " | RESET: " + c));
      clearInterval(socketKeepaliveInterval);
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

var USER_ID = "TNN_" + hostname + "_" + process.pid;
var SCREEN_NAME = "TNN_" + hostname + "_" + process.pid;

var userObj = { 
  name: USER_ID, 
  nodeId: USER_ID, 
  userId: USER_ID, 
  utilId: USER_ID, 
  url: "https://www.twitter.com", 
  screenName: SCREEN_NAME, 
  namespace: "util", 
  type: "util", 
  mode: "muxstream",
  tags: {},
  stats: {}
} ;

userObj.tags.entity = "muxstream_" + hostname + "_" + process.pid;
userObj.tags.mode = "muxed";
userObj.tags.channel = "twitter";
userObj.tags.url = "https://www.twitter.com";

var commandLineArgs = require("command-line-args");

var enableStdin = { name: "enableStdin", alias: "i", type: Boolean, defaultValue: true };
var quitOnError = { name: "quitOnError", alias: "q", type: Boolean, defaultValue: true };
var verbose = { name: "verbose", alias: "v", type: Boolean };

var testMode = { name: "testMode", alias: "T", type: Boolean, defaultValue: false };
var loadNeuralNetworkFilePID = { name: "loadNeuralNetworkFilePID", alias: "N", type: Number };
var evolveIterations = { name: "evolveIterations", alias: "I", type: Number};

var optionDefinitions = [enableStdin, quitOnError, verbose, evolveIterations, testMode, loadNeuralNetworkFilePID];

var commandLineConfig = commandLineArgs(optionDefinitions);
console.log(chalkInfo("COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));
console.log("COMMAND LINE OPTIONS\n" + jsonPrint(commandLineConfig));

console.log("\n\n=================================");
console.log("HOST:          " + hostname);
console.log("PROCESS ID:    " + process.pid);
console.log("PROCESS ARGS:  " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("=================================");

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

statsObj.commandLineConfig = commandLineConfig;

statsObj.hostname = hostname;
statsObj.pid = process.pid;
statsObj.heap = process.memoryUsage().heapUsed/(1024*1024);
statsObj.maxHeap = process.memoryUsage().heapUsed/(1024*1024);

statsObj.tests = {};
statsObj.tests[testObj.testRunId] = {};
statsObj.tests[testObj.testRunId].results = {};
statsObj.tests[testObj.testRunId].network = {};

statsObj.startTime = moment().valueOf();
statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

statsObj.userReadyAckWait = 0;

statsObj.queues = {};

statsObj.tweetsProcessed = 0;
statsObj.deltaTweetsReceived = 0;
statsObj.tweetsReceived = 0;
statsObj.deltaRetweetsReceived = 0;
statsObj.retweetsReceived = 0;

statsObj.tweetsPerSecond = 0.0;
statsObj.tweetsPerMinute = 0.0;

statsObj.twitterDeletes = 0;
statsObj.twitterConnects = 0;
statsObj.twitterDisconnects = 0;
statsObj.twitterReconnects = 0;
statsObj.twitterWarnings = 0;
statsObj.twitterErrors = 0;
statsObj.twitterLimit = 0;
statsObj.twitterScrubGeo = 0;

statsObj.twitterLimit = 0;
statsObj.twitterLimitMax = 0;
statsObj.twitterLimitMaxTime = moment().valueOf();

statsObj.normalization = {};
statsObj.normalization.score = {};
statsObj.normalization.magnitude = {};

statsObj.normalization.score.min = -1.0;
statsObj.normalization.score.max = 1.0;
statsObj.normalization.magnitude.min = 0;
statsObj.normalization.magnitude.max = -Infinity;
// ==================================================================
// DROPBOX
// ==================================================================

var DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
var DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
var DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
var DROPBOX_TNN_CONFIG_FILE = process.env.DROPBOX_TNN_CONFIG_FILE || "twitterNeuralNetworkConfig.json";
var DROPBOX_TNN_STATS_FILE = process.env.DROPBOX_TNN_STATS_FILE || "twitterNeuralNetworkStats.json";

var dropboxConfigFolder = "/config/utility";
var dropboxConfigDefaultFolder = "/config/utility/default";
var dropboxConfigHostFolder = "/config/utility/" + hostname;

var dropboxConfigFile = hostname + "_" + DROPBOX_TNN_CONFIG_FILE;
var statsFolder = "/stats/" + hostname;
var statsFile = "twitterNeuralNetworkStats_" + hostname + "_" + process.pid + ".json";

console.log("DROPBOX_TNN_CONFIG_FILE: " + DROPBOX_TNN_CONFIG_FILE);
console.log("DROPBOX_TNN_STATS_FILE : " + DROPBOX_TNN_STATS_FILE);

debug("dropboxConfigFolder : " + dropboxConfigFolder);
debug("dropboxConfigHostFolder : " + dropboxConfigHostFolder);
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

function indexOfMax(arr) {
  if (arr.length === 0) {
    return -1;
  }

  var max = arr[0];
  var maxIndex = 0;

  for (var i = 1; i < arr.length; i++) {
    if (arr[i] > max) {
      maxIndex = i;
      max = arr[i];
    }
  }
  return maxIndex;
}

function showStats(options){
  if (evolveNeuralNetwork !== undefined) {
    evolveNeuralNetwork.send({op: "STATS", options: options});
  }

  statsObj.heap = process.memoryUsage().heapUsed/(1024*1024);
  statsObj.maxHeap = Math.max(statsObj.maxHeap, statsObj.heap);

  if (options) {
    console.log("STATS\n" + jsonPrint(statsObj));
  }
  else {
    console.log(chalkLog("S"
      + " | RUN " + statsObj.elapsed
      + " | NOW " + moment().format(compactDateTimeFormat)
      + " | STRT " + moment(parseInt(statsObj.startTime)).format(compactDateTimeFormat)
      + " | ITERATIONS " + configuration.evolveIterations
      + " | HEAP " + statsObj.heap.toFixed(0) + "MB"
      + " MAX " + statsObj.maxHeap.toFixed(0)
    ));
  }
}

function quit(){
  console.log( "\n... QUITTING ..." );
  showStats(true);
  if (evolveNeuralNetwork !== undefined) { evolveNeuralNetwork.kill("SIGINT"); }
  process.exit();
}

process.on( 'SIGINT', function() {
  if (evolveNeuralNetwork !== undefined) { evolveNeuralNetwork.kill("SIGINT"); }
  quit("SIGINT");
});

process.on("exit", function() {
  if (evolveNeuralNetwork !== undefined) { evolveNeuralNetwork.kill("SIGKILL"); }
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
      console.log(chalkLog("... SAVED DROPBOX JSON | " + options.path));
      callback(null, response);
    })
    .catch(function(error){
      console.error(chalkError(moment().format(defaultDateTimeFormat) 
        + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
        + "\nERROR: " + error
        + "\nERROR: " + jsonPrint(error)
        // + "\nERROR\n" + jsonPrint(error)
      ));
      callback(error, null);
    });
}

function loadFile(path, file, callback) {

  console.log(chalkInfo("LOAD FOLDER " + path));
  console.log(chalkInfo("LOAD FILE " + file));
  console.log(chalkInfo("FULL PATH " + path + "/" + file));

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

var statsUpdateInterval;
function initStatsUpdate(cnf, callback){

  console.log(chalkAlert("INIT STATS UPDATE INTERVAL | " + cnf.statsUpdateIntervalTime + " MS"));

  clearInterval(statsUpdateInterval);

  statsUpdateInterval = setInterval(function () {

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

function initTwitterUsers(cnf, callback){

  debug(chalkInfo("INIT TWITTER USERS"));

  if (!cnf.twitterUsers){
    console.log(chalkWarn("??? NO FEEDS"));
    configEvents.emit("TWITTER_INIT_COMPLETE", null);
    callback(null, null);
  }
  else {

    var twitterUsers = Object.keys(cnf.twitterUsers);

    console.log(chalkTwitter("INIT TWITTER USERS | USERS FOUND: " + twitterUsers.length));
    debug(chalkTwitter("cnf\n" + jsonPrint(cnf)));

    twitterUsers.forEach(function(userId){

      var twitterUserObj = {};
      twitterUserObj.trackingNumber = 0;

      console.log("userId: " + userId);
      console.log("screenName: " + cnf.twitterUsers[userId]);

      twitterUserObj.userId = userId ;
      twitterUserObj.screenName = cnf.twitterUsers[userId] ;
      twitterUserObj.twitterConfig = {} ;
      twitterUserObj.twitterConfig = cnf.twitterConfigs[userId] ;

      twitterUserHashMap.set(userId, twitterUserObj);
      
      console.log(chalkTwitter("ADDED TWITTER USER stream"
        + " | NAME: " + userId
      ));

    });

    configEvents.emit("TWITTER_INIT_COMPLETE", null);

    callback(null);
  }
}

function initialize(cnf, callback){

  console.log(chalkAlert("INITIALIZE cnf\n" + jsonPrint(cnf)));

  if (debug.enabled || debugCache.enabled || debugQ.enabled){
    console.log("\n%%%%%%%%%%%%%%\n DEBUG ENABLED \n%%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.TNN_PROCESS_NAME || "twitterNeuralNetwork";

  cnf.verbose = process.env.TNN_VERBOSE_MODE || false ;
  cnf.quitOnError = process.env.TNN_QUIT_ON_ERROR || false ;
  cnf.enableStdin = process.env.TNN_ENABLE_STDIN || true ;
  cnf.evolveIterations = process.env.TNN_EVOLVE_ITERATIONS || DEFAULT_EVOLVE_ITERATIONS ;

  cnf.twitterUsers = {};
  cnf.twitterUsers.altThreecee00 = "altThreecee00";
  cnf.twitterUsers.threeceeInfo = "threeceeInfo";

  cnf.twitterConfigFolder = process.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER
    || "/config/twitter"; 
  cnf.twitterConfigFile = process.env.DROPBOX_TNN_DEFAULT_TWITTER_CONFIG_FILE 
    || "twitterConfig_altThreecee00TwitterTest.json";

  cnf.classifiedUsersFile = process.env.TNN_CLASSIFIED_USERS_FILE || "classifiedUsers_" + hostname + ".json";

  cnf.statsUpdateIntervalTime = process.env.TNN_STATS_UPDATE_INTERVAL || 60000;

  debug(chalkWarn("dropboxConfigFolder: " + dropboxConfigFolder));
  debug(chalkWarn("dropboxConfigFile  : " + dropboxConfigFile));

  loadFile(dropboxConfigHostFolder, dropboxConfigFile, function(err, loadedConfigObj){

    var commandLineConfigKeys;
    var configArgs;

    if (!err) {
      console.log(dropboxConfigFile + "\n" + jsonPrint(loadedConfigObj));

      if (loadedConfigObj.TNN_EVOLVE_ITERATIONS  !== undefined){
        console.log("LOADED TNN_EVOLVE_ITERATIONS: " + loadedConfigObj.TNN_EVOLVE_ITERATIONS);
        cnf.evolveIterations = loadedConfigObj.TNN_EVOLVE_ITERATIONS;
      }

      if (loadedConfigObj.TNN_VERBOSE_MODE  !== undefined){
        console.log("LOADED TNN_VERBOSE_MODE: " + loadedConfigObj.TNN_VERBOSE_MODE);
        cnf.verbose = loadedConfigObj.TNN_VERBOSE_MODE;
      }

      if (loadedConfigObj.TNN_TEST_MODE  !== undefined){
        console.log("LOADED TNN_TEST_MODE: " + loadedConfigObj.TNN_TEST_MODE);
        cnf.testMode = loadedConfigObj.TNN_TEST_MODE;
      }

      if (loadedConfigObj.TNN_NEURAL_NETWORK_FILE_PID  !== undefined){
        console.log("LOADED TNN_NEURAL_NETWORK_FILE_PID: " + loadedConfigObj.TNN_NEURAL_NETWORK_FILE_PID);
        cnf.loadNeuralNetworkFilePID = loadedConfigObj.TNN_NEURAL_NETWORK_FILE_PID;
      }

      if (loadedConfigObj.TNN_ENABLE_STDIN  !== undefined){
        console.log("LOADED TNN_ENABLE_STDIN: " + loadedConfigObj.TNN_ENABLE_STDIN);
        cnf.enableStdin = loadedConfigObj.TNN_ENABLE_STDIN;
      }

      if (loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER  !== undefined){
        console.log("LOADED DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER: " 
          + jsonPrint(loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER));
        cnf.twitterConfigFolder = loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER;
      }

      if (loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE  !== undefined){
        console.log("LOADED DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE: " 
          + jsonPrint(loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE));
        cnf.twitterConfigFile = loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE;
      }

      if (loadedConfigObj.TNN_TWITTER_USERS  !== undefined){
        console.log("LOADED TNN_TWITTER_USERS: " + jsonPrint(loadedConfigObj.TNN_TWITTER_USERS));
        cnf.twitterUsers = loadedConfigObj.TNN_TWITTER_USERS;
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
        cnf[arg] = commandLineConfig[arg];
        console.log("--> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
      });

      console.log(chalkLog("USER\n" + jsonPrint(userObj)));

      configArgs = Object.keys(cnf);

      configArgs.forEach(function(arg){
        console.log("FINAL CONFIG | " + arg + ": " + cnf[arg]);
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

            case "c":
              configuration.cursorTweetPause = !configuration.cursorTweetPause;
              if (configuration.cursorTweetPause) {
                cursorTweet.pause();
              }
              else {
                cursorTweet.resume();
              }
              console.log(chalkRedBold("CURSOR TWEET PAUSE: " + configuration.cursorTweetPause));
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

        loadFile(cnf2.twitterConfigFolder, cnf2.twitterConfigFile, function(err, tc){
          if (err){
            console.error(chalkError("*** TWITTER CONFIG LOAD ERROR\n" + err));
            quit();
            return;
          }

          cnf2.twitterConfig = {};
          cnf2.twitterConfig = tc;

          console.log(chalkInfo(getTimeStamp() + " | TWITTER CONFIG FILE " 
            + cnf2.twitterConfigFolder
            + cnf2.twitterConfigFile
            + "\n" + jsonPrint(cnf2.twitterConfig )
          ));

          initDescriptionArrays(function(err){
            return(callback(err, cnf2));
          });

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

        console.log(chalkLog("USER\n" + jsonPrint(userObj)));

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

              case "c":
                configuration.cursorTweetPause = !configuration.cursorTweetPause;
                if (configuration.cursorTweetPause) {
                  cursorTweet.pause();
                }
                else {
                  cursorTweet.resume();
                }
                console.log(chalkRedBold("CURSOR TWEET PAUSE: " + configuration.cursorTweetPause));
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
        });
      }
      initDescriptionArrays(function(err){
        return(callback(err, cnf));
      });
     }
  });
}

console.log(chalkInfo(getTimeStamp() 
  + " | WAIT 5 SEC FOR MONGO BEFORE INITIALIZE CONFIGURATION"
));

configEvents.on("newListener", function(data){
  console.log(chalkInfo("*** NEW CONFIG EVENT LISTENER: " + data));
});

configEvents.on("removeListener", function(data){
  console.log(chalkInfo("*** REMOVED CONFIG EVENT LISTENER: " + data));
});

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

  // tweetServer = require("./app/controllers/tweets.server.controller");
  userServer = require("./app/controllers/user.server.controller");

  // Tweet = require("mongoose").model("Tweet");
  User = require("mongoose").model("User");
});

configEvents.on("INIT_COMPLETE", function(cnf){
  console.log(chalkError("INIT_COMPLETE"));
  setInterval(function(){
    if (!userReadyAck 
      && (statsObj.userReadyAckWait > 1) 
      && (statsObj.userReadyAckWait % 10 === 0)){
      socket.emit("USER_READY", userObj, function(userId){
        console.log("R< USER_READY ACK | USER ID: " + userId); // data will be "woot"
        userReadyAck = true ;

        console.log(chalkConnect("RX USER_READY_ACK"
          + " | " + socket.id
          + " | USER ID: " + userId
          + " | " + moment().format(defaultDateTimeFormat)
        ));

        initKeepalive(userObj, cnf.keepaliveInterval);
      }); 
    }
    else if (!userReadyAck) {
      statsObj.userReadyAckWait += 1;
      console.log(chalkDisconnect("... WAITING FOR USER_READY_ACK ..."));
    }
  }, 3000);
});

var mRegEx = mentionsRegex();
var hRegEx = hashtagRegex();
var wordExtractionOptions = {
  language:"english",
  remove_digits: true,
  return_changed_case: true,
  remove_duplicates: true
};

function parseDescription(description, callback){
  var histogram = {};
  var mentionArray = mRegEx.exec(description);
  var hashtagArray = hRegEx.exec(description);
  var wordArray = keywordExtractor.extract(description, wordExtractionOptions);
 
  async.parallel(
    [
      function(cbp){
        if (!wordArray) { return(cbp()); }
        async.each(wordArray, function(word, cb){
          word = word.toLowerCase();
          histogram[word] = (histogram[word] === undefined) ? 1 : histogram[word]+1;
          debug(chalkAlert("->- DESC Ws"
            + " | " + histogram[word]
            + " | " + word
          ));
          cb();
        }, function(err){
          cbp();
        });
      },

      function(cbp){
        if (!mentionArray) { return(cbp()); }
        async.each(mentionArray, function(userId, cb){
          if (!userId.match("@")) { return(cb()); }
          userId = "@" + userId.toLowerCase();
          histogram[userId] = (histogram[userId] === undefined) ? 1 : histogram[userId]+1;
          debug(chalkAlert("->- DESC Ms"
            + " | " + histogram[userId]
            + " | " + userId
          ));
          cb();
        }, function(err){
          cbp();
        });
      },

      function(cbp){
        if (!hashtagArray) { return(cbp()); }
        async.each(hashtagArray, function(hashtag, cb){
          hashtag = hashtag.toLowerCase();
          histogram[hashtag] = (histogram[hashtag] === undefined) ? 1 : histogram[hashtag]+1;
          debug(chalkAlert("->- DESC Hs"
            + " | " + histogram[hashtag]
            + " | " + hashtag
          ));
          cb();
        }, function(err){
          cbp();
        });
      }

    ],
    function(err, results) {
      if (err) {
        console.log(chalkError("\n" + moment().format(compactDateTimeFormat) 
          + " | !!! parseDescription ERROR: " + err
        ));
        callback(err, null);
      } 
      else {
        debug(chalkAlert("\n" + moment().format(compactDateTimeFormat) 
          + " | parseDescription RESULTS\n" + jsonPrint(histogram)
        ));
        callback(null, histogram);
      }
    }

  );
}

function updateClassifiedUsers(cnf, callback){


  var classifiedUserIds = Object.keys(classifiedUserHashmap);
  var minMagnitude = 0;
  var maxMagnitude = 0;
  // var minScore = Infinity;
  // var maxScore = 0;

  console.log(chalkAlert("UPDATE CLASSIFIED USERS: " + classifiedUserIds.length));

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

      var sentimentText;

      var sentimentObj = {};
      sentimentObj.magnitude = 0;
      sentimentObj.score = 0;

      if ((user.languageAnalysis !== undefined)
        && (user.languageAnalysis.sentiment !== undefined)) {

        sentimentObj.magnitude = user.languageAnalysis.sentiment.magnitude;
        sentimentObj.score = user.languageAnalysis.sentiment.score;

        if (!cnf.normalization) {
          // minMagnitude = Math.min(minMagnitude, sentimentObj.magnitude);
          maxMagnitude = Math.max(maxMagnitude, sentimentObj.magnitude);
          // minScore = Math.min(minScore, sentimentObj.score);
          // maxScore = Math.max(maxScore, sentimentObj.score);
        }
      }

      sentimentText = "M: " + (sentimentObj.magnitude).toFixed(2)
        + " S: " + (sentimentObj.score).toFixed(2);

      var keywordArray = Object.keys(user.keywords);

      var classification = (keywordArray[0] !== undefined) ? keywordArray[0] : false;
      var threeceeFollowing = (user.threeceeFollowing) ? user.threeceeFollowing.screenName : "-";

      // if (classification && (!cnf.zeroSentiment && (sentiment !== undefined))) {
      if (classification) {

        var classText = "";
        var currentChalk = chalkLog;

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

        var trainingSetDatum = {};

        trainingSetDatum.input = [
          sentimentObj.magnitude, 
          sentimentObj.score
        ];

        if (user.description){

          parseDescription(user.description, function(err, histogram){

            debug("user.description\n" + jsonPrint(user.description));

            async.eachSeries(descriptionArrays, function(descArray, cb1){

              var type = descArray.type;

              debug(chalkAlert("START ARRAY: " + type + " | " + descArray.array.length));

              async.eachSeries(descArray.array, function(element, cb2){
                if (histogram[element]) {
                  // console.log("ARRAY: " + descArray.type + " | + " + element);
                  trainingSetDatum.input.push(1);
                  cb2();
                }
                else {
                  // console.log("ARRAY: " + descArray.type + " | - " + element);
                  trainingSetDatum.input.push(0);
                  cb2();
                }
              }, function(err){
                debug(chalkAlert("DONE ARRAY: " + type));
                cb1();
              });

            }, function(err){
              debug(chalkAlert("PARSE DESC COMPLETE"));
            });

          });
        }
        else {
          descriptionWordsArray.forEach(function(word){
            trainingSetDatum.input.push(0);
          });
          descriptionMentionsArray.forEach(function(word){
            trainingSetDatum.input.push(0);
          });
          descriptionHashtagsArray.forEach(function(word){
            trainingSetDatum.input.push(0);
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

        trainingSet.push(trainingSetDatum);
        debug("trainingSetDatum INPUT:  " + trainingSetDatum.input);
        debug("trainingSetDatum OUTPUT: " + trainingSetDatum.output);
        cb0();
      }
      else {
        console.log(chalkAlert("SKIP | U"
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

      // console.log(chalkError("minMagnitude: " + minMagnitude));
      console.log(chalkAlert("MAX MAGNITUDE: " + maxMagnitude));
      // console.log(chalkError("minScore:     " + minScore));
      // console.log(chalkError("maxScore:     " + maxScore));

      // statsObj.normalization.score.min = minScore;
      // statsObj.normalization.score.max = maxScore;

      // statsObj.normalization.magnitude.min = minMagnitude;
      statsObj.normalization.magnitude.max = maxMagnitude;

      trainingSet.forEach(function(datum){
        var normMagnitude = datum.input[0]/maxMagnitude;
        // var normScore = (datum.input[1] - minScore)/(maxScore - minScore);
        datum.input[0] = normMagnitude;
        // datum.input[1] = normScore;
        if (configuration.testMode) {
          testObj.testSet.push(datum);
        }
        else if (Math.random() < cnf.testSetRatio) {
          testObj.testSet.push(datum);
        }
        else {
          trainingSetNormalized.push(datum);
        }
      });

      callback(err);
  });
}

function testNetwork(nw, testObj, callback){

  console.log(chalkAlert("TEST NETWORK"
    + " | TEST RUN ID: " + testObj.testRunId
    + " | " + testObj.testSet.length + " TEST DATA POINTS"
  ));

  var numTested = 0;
  var numSkipped = 0;
  var numPassed = 0;
  var successRate = 0;

  testObj.testSet.forEach(function(testDatum){

    if (testDatum.output === [0,0,0]) {
      console.log(chalkError("NO TEST OUTPUT ... SKIPPING | " + testOutput));
      numSkipped += 1;
      return;
    }

    var testOutput = nw.activate(testDatum.input); // 0.0275

    numTested += 1;

    var testMaxOutputIndex = indexOfMax(testOutput);
    var expectedMaxOutputIndex = indexOfMax(testDatum.output);

    var passed = (testMaxOutputIndex === expectedMaxOutputIndex);

    numPassed = passed ? numPassed+1 : numPassed;

    successRate = 100 * numPassed/numTested;

    var currentChalk = passed ? chalkLog : chalkAlert;

    console.log(currentChalk("\n-----\nTEST RESULT: " + passed + " | " + successRate.toFixed(3) + "%"
      + "\n" + testOutput[0].toFixed(3) + " " + testOutput[1].toFixed(3) + " " + testOutput[2].toFixed(3)
      + "\n" + testDatum.output[0].toFixed(3) + " " + testDatum.output[1].toFixed(3) + " " + testDatum.output[2].toFixed(3)
    ));
  });

  callback(null, { testRunId: testObj.testRunId, numTests: testObj.testSet.length, numSkipped: numSkipped, numPassed: numPassed, successRate: successRate});
}

function initTimeout(){

  console.log(chalkError("\nSET TIMEOUT | " + moment().format(compactDateTimeFormat) + "\n"));

  configEvents.emit("INIT_MONGODB");

  initialize(configuration, function(err, cnf){

    if (err && (err.status !== 404)) {
      console.error(chalkError("***** INIT ERROR *****\n" + jsonPrint(err)));
      // if (err.status !== 404){
      //   console.log("err.status: " + err.status);
        quit();
      // }
    }

    evolveNeuralNetwork = cp.fork(`evolveNeuralNetworkChild.js`);

    evolveNeuralNetwork.on("message", function(m){
      console.log(chalkLog("evolveNeuralNetwork RX"
        + " | " + m.op
        // + " | " + m.obj.userId
        // + " | " + m.obj.screenName
        // + " | " + m.obj.name
        // + "\n" + jsonPrint(m)
      ));

      if (m.op === "EVOLVE_COMPLETE") {

        console.log(chalkAlert("NETWORK EVOLVE COMPLETE"
          + " | INPUTS: " + m.networkObj.network.input
          + " | OUTPUTS: " + m.networkObj.network.output
          + " | DROPOUT: " + m.networkObj.network.dropout
          + " | NODES: " + m.networkObj.network.nodes.length
          + " | CONNECTIONS: " + m.networkObj.network.connections.length
          + " | NORMALIZATION: MAG: min/max" 
          + m.networkObj.normalization.magnitude.min.toFixed(3) 
          + "/" + m.networkObj.normalization.magnitude.min.toFixed(3)
          + " | SCORE: min/max" 
          + m.networkObj.normalization.score.min.toFixed(3) 
          + "/" + m.networkObj.normalization.score.min.toFixed(3)
          // + "\nNETWORK\n" + jsonPrint(m.network)
        ));

        network = neataptic.Network.fromJSON(m.networkObj.network);

        testNetwork(network, testObj, function(err, results){

          statsObj.tests[testObj.testRunId] = {};
          statsObj.tests[testObj.testRunId].results = results;

          console.log(chalkAlert("\nNETWORK TEST COMPLETE\n==================="
            + "\n  TESTS:   " + results.numTests
            + "\n  PASSED:  " + results.numPassed
            + "\n  SKIPPED:  " + results.numSkipped
            + "\n  SUCCESS: " + results.successRate.toFixed(3) + "%"
            // + " | " + jsonPrint(results)
          ));
          quit();
        });
      }
    });

    var evolveMessageObj = {
      op: "INIT",
      testRunId: testObj.testRunId
    };

    evolveNeuralNetwork.send(evolveMessageObj);

    if (cnf.testMode) {

      var nnFile;
      if (cnf.loadNeuralNetworkFilePID) {
        folder = dropboxConfigHostFolder;
        nnFile = neuralNetworkFile.replace(".json", "_" + cnf.loadNeuralNetworkFilePID + ".json");
      }
      else {
        folder = dropboxConfigDefaultFolder;
        nnFile = neuralNetworkFile;
      }

      statsObj.test.neuralNetworkFile = nnFile;

      console.log(chalkAlert("LOAD NEURAL NETWORK FILE: " + nnFile));

      loadFile(dropboxConfigHostFolder, nnFile, function(err, loadedNetworkObj){

        if (err) {
          console.log(chalkError("ERROR: loadFile: " + statsFolder + "/" + statsFile));
          quit("LOAD FILE ERROR");
        }
        else {

          cnf.normalization = loadedNetworkObj.normalization;
          var loadedNetwork = neataptic.Network.fromJSON(loadedNetworkObj.network);

          loadFile(dropboxConfigHostFolder, cnf.classifiedUsersFile, function(err, clUsObj){
            classifiedUserHashmap = clUsObj;

            console.log(chalkAlert("INITIALIZED CLASSIFIED USERS"
              + " | " + Object.keys(classifiedUserHashmap).length
            ));
            updateClassifiedUsers(cnf, function(err){

              if (err) {
                console.error("UPDATE CLASSIFIED USERS ERROR\n" + err);
                quit("UPDATE CLASSIFIED USERS ERROR");
              }

              testNetwork(loadedNetwork, testObj, function(err, results){
                statsObj.test.results = results;
                console.log(chalkAlert("\nNETWORK TEST COMPLETE\n==================="
                  + "\n  TESTS:   " + results.numTests
                  + "\n  PASSED:  " + results.numPassed
                  + "\n  SKIPPED:  " + results.numSkipped
                  + "\n  SUCCESS: " + results.successRate.toFixed(3) + "%"
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
      loadFile(dropboxConfigHostFolder, cnf.classifiedUsersFile, function(err, clUsObj){
        if (!err) {

          debug(jsonPrint(clUsObj));

          classifiedUserHashmap = clUsObj;

          console.log(chalkAlert("INITIALIZED CLASSIFIED USERS"
            + " | " + Object.keys(classifiedUserHashmap).length
          ));

          updateClassifiedUsers(cnf, function(err){

            var evolveMessageObj = {};

            console.log(chalkAlert("TRAINING SET NORMALIZED"
              + " | " + trainingSetNormalized.length + " DATA POINTS"
              // + " | " + jsonPrint(trainingSetNormalized[0])
            ));
            debug(chalkAlert("TRAINING SET NORMALIZED\n" + jsonPrint(trainingSetNormalized)));

            evolveMessageObj = {
              op: "EVOLVE",
              testRunId: testObj.testRunId,
              trainingSet: trainingSetNormalized,
              normalization: statsObj.normalization,
              iterations: cnf.evolveIterations
            };

            evolveNeuralNetwork.send(evolveMessageObj, function(err){
              if (err) {
                console.error("*** CHILD SEND ERROR: " + err);
              }
            });

          });
        }
        else {
          console.log(chalkError("ERROR: loadFile: " + dropboxConfigHostFolder + "/classifiedUsers.json"));
        }
      });
    }

    console.log(chalkError(cnf.processName + " STARTED " + getTimeStamp() + "\n"));

    initTwitterUsers(cnf, function(err){
      if (err){
        console.log(chalkError("ERROR initTwitterUsers\n" + err));
      }
      console.log(chalkTwitter("TWITTER USER HASH MAP ENTRIES"
        + " | " + twitterUserHashMap.keys()
      ));
    });

  });
}

initTimeout();

