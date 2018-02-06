/*jslint node: true */
"use strict";

const async = require("async");
const moment = require("moment");
const histogramParser = require("@threeceelabs/histogram-parser");
const neataptic = require("./js/neataptic");

const compactDateTimeFormat = "YYYYMMDD HHmmss";

let network;

function jsonPrint (obj){
  if (obj) {
    return JSON.stringify(obj, null, 2);
  }
  else {
    return "UNDEFINED";
  }
}

function activateNetwork(n, input, callback){
  let output;
  output = n.activate(input);
  callback(output);
}

function testEvolve(params, callback){
  let myNetwork = new neataptic.Network(2, 1);

  let myTrainingSet = [
    { input: [0,0], output: [0] },
    { input: [0,1], output: [1] },
    { input: [1,0], output: [1] },
    { input: [1,1], output: [0] }
  ];

  var nodes = myNetwork.nodes;
  // myNetwork.nodes.forEach(function(node){
  var inputIndex = 0;
  var outputIndex = 0;
  var hiddenIndex = 0;

  for (var i=0; i< nodes.length; i++){

    if (nodes[i].type === "input") {
      nodes[i].name = "in_" + inputIndex;
      inputIndex++
    }
    else if (nodes[i].type === "output") {
      nodes[i].name = "out_" + outputIndex;
      outputIndex++
    }
    else {
      nodes[i].name = "hid_" + hiddenIndex;
      hiddenIndex++
    }

    console.log("NODE " + jsonPrint(nodes[i]));
  }

  myNetwork.evolve(myTrainingSet, {
    mutation: neataptic.methods.mutation.FFW,
    equal: true,
    popsize: 100,
    growth: 0.0001,
    elitism: 10,
    // log: 100,
    error: 0.03,
    iterations: 10000,
    mutationRate: 0.7,
    schedule: {
      function: function(schedParams){ 
        console.log("SCHED"
          + " | " + moment().format(compactDateTimeFormat)
          + " | I: " + schedParams.iteration
          + " | F: " + schedParams.fitness.toFixed(5)
          + " | E: " + schedParams.error.toFixed(5)
        );
      },
      iterations: 100
    }

  })
  .then(function(results){

    console.log("NNC"
      + " | EVOLVE RESULTS"
      + " | " + "TIME: " + results.time
      + " | " + "ITERATIONS: " + results.iterations
      + " | " + "ERROR: " + results.error
      + "\n"
    );

    let testPass = true;

    async.each(myTrainingSet, function(datum, cb){

      activateNetwork(myNetwork, datum.input, function(out){

        let dataOut = (out[0] >= 0.5) ? 1 : 0 ;

        let datumPass = false;
        if (datum.output[0] === dataOut){
          datumPass = true;
        }

        if (!datumPass) { testPass = false; }

        console.log("NNC | TEST"
          + " | IN: " + datum.input
          + " | EO: " + datum.output[0]
          + " | TO: " + dataOut
          + " | PASS: " + datumPass
        );

        cb();

      });

    }, function(){
      console.log("TEST RESULT: PASS: " + testPass);

    var nodes = myNetwork.nodes;
    // myNetwork.nodes.forEach(function(node){
    var inputIndex = 0;
    var outputIndex = 0;
    var hiddenIndex = 0;

    for (var i=0; i< nodes.length; i++){

      if (nodes[i].type === "input") {
        nodes[i].name = "in_" + inputIndex;
        inputIndex++
      }
      else if (nodes[i].type === "output") {
        nodes[i].name = "out_" + outputIndex;
        outputIndex++
      }
      else {
        nodes[i].name = "hid_" + hiddenIndex;
        hiddenIndex++
      }

      console.log("NODE " + jsonPrint(nodes[i]));
    }

      callback(testPass);
    });
  });
}

setTimeout(function(){
  console.log("RUN")

  testEvolve({runId: "hey"}, function(pass){
    console.log("TEST: " + pass);
  });

}, 1000);


