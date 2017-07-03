/*jslint node: true */
"use strict";

const slackOAuthAccessToken = "xoxp-3708084981-3708084993-206468961315-ec62db5792cd55071a51c544acf0da55";
const slackChannel = "#tnn_batch";

const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const os = require("os");
const pm2 = require("pm2");
const Slack = require("slack-node");
const async = require("async");
const defaults = require("object.defaults/immutable");
const moment = require("moment");
const chalk = require("chalk");
const debug = require("debug")("tnn");

const chalkAlert = chalk.red;
const chalkBlue = chalk.blue;
const chalkRedBold = chalk.bold.red;
const chalkError = chalk.bold.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;


const maxInstances = 3;

let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

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

let slack = new Slack(slackOAuthAccessToken);

function slackPostMessage(channel, text, callback){

  console.log(chalkInfo("SLACK POST: " + text));

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
function quit(){

  console.log(chalkAlert( "\n\n... QUITTING ...\n\n" ));

  // statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

  // let slackText = "";

  // if (statsObj.tests[testObj.testRunId].results.successRate !== undefined) {
  //   // console.log("\n=====================\nRESULTS\n" + jsonPrint(statsObj.tests[testObj.testRunId].results));
  //   slackText = "\n" + testObj.testRunId;
  //   slackText = slackText + "\nRESULTS: " + statsObj.tests[testObj.testRunId].results.successRate.toFixed(1) + " %";
  //   slackText = slackText + "\nITERATIONS: " + statsObj.tests[testObj.testRunId].training.evolve.options.iterations;
  //   slackText = slackText + "\nTESTS: " + statsObj.tests[testObj.testRunId].results.numTests;
  //   slackText = slackText + " | PASS: " + statsObj.tests[testObj.testRunId].results.numPassed;
  //   slackText = slackText + " | SKIP: " + statsObj.tests[testObj.testRunId].results.numSkipped;
  //   slackText = slackText + "\nRUN TIME: " + statsObj.elapsed;
  // }
  // else {
  //   slackText = "QUIT | " + getTimeStamp() + " | " + statsObj.runId;
  // }

  // slackPostMessage(slackChannel, slackText);

  // showStats();

  setTimeout(function(){
    pm2.disconnect();   // Disconnects from PM2
    process.exit();
  }, 100);
}

pm2.connect(function(err) {

  if (err) {
    console.error(err);
    process.exit(2);
  }

  let options = {};
  options.script = "twitterNeuralNetwork.js";
  options.cmd = "/Volumes/RAID1/projects/twitterNeuralNetwork";
  options.autorestart = false;
  options.env = {};
  options.env.NODE_ENV = "production";
  options.env.BATCH_MODE = true;
  options.env.GCLOUD_PROJECT = "graphic-tangent-627";
  options.env.GOOGLE_PROJECT = "graphic-tangent-627";
  options.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN = "nknEWsIkD5UAAAAAAAQouTDFRBKfwsFzuS8PPi2Q_JVYnpotNuaHiddNtmG4mUTi";
  options.env.DROPBOX_WORD_ASSO_APP_KEY = "qlb9k4dp01t9iqk";
  options.env.DROPBOX_WORD_ASSO_APP_SECRET = "wqslhe2t95zfn19";
  options.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER = "/config/twitter";
  options.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE = "altthreecee00.json";
  options.env.TNN_PROCESS_NAME = "tnn";
  options.env.TNN_EVOLVE_ITERATIONS = 5;
  options.env.TNN_TWITTER_DEFAULT_USER = "altthreecee00";
  options.env.TNN_TWITTER_USERS = {"altthreecee00": "altthreecee00", "ninjathreecee": "ninjathreecee"};

  let instanceConfigArray = [];
  let instanceIndex = 0;

  for(instanceIndex=0; instanceIndex < maxInstances; instanceIndex +=1){

    const instanceName = "tnn_" + hostname + "_" + process.pid + "_" + instanceIndex;
    const logfile = "/Users/tc/logs/" + hostname + "/" + process.pid + "/" + instanceName + ".log";

    let currentOptions = defaults(options, {
      name: instanceName,
      out_file: logfile,
      error_file: logfile
    });

    currentOptions.env.TNN_PROCESS_NAME = instanceName;
    console.log("CURRENT OPTIONS\n" + jsonPrint(currentOptions));

    instanceConfigArray.push(currentOptions);

  }

  async.each(instanceConfigArray, function(instanceConfig, cb){

    console.log("START\n" + jsonPrint(instanceConfig));

    pm2.start(instanceConfig, function(err, apps) {

      console.log("PM2 LAUNCHED | " + instanceConfig.name);
      console.log("APPS | " + apps.length);

      slackPostMessage(slackChannel, instanceConfig.name + "\nSTARTED " + getTimeStamp(), function(){
        cb(err);
      });

    });

  }, function(err){
    console.log("ALL LAUNCHED");
    quit();
  });


});