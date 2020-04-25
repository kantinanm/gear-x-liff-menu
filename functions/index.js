'use strict';

const functions = require('firebase-functions');
const {
  WebhookClient,
  Payload
} = require('dialogflow-fulfillment');
const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

// const serviceAccount = require('./key.json')
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   databaseURL: 'https://pizzanulok-vfwchf.firebaseio.com'
// });



process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements


exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({
    request,
    response
  });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

  function welcome(agent) {
    agent.add(`Welcome to my agent!`);
  }

  function fallback(agent) {
    agent.add(`I didn't understand`);
    agent.add(`I'm sorry, can you try again?`);
  }



  function register(agent) {
    const params = agent.parameters
    const studentID = params.stdID 
    const studentCard = params.stdCard 
    agent.add(`รหัสนิสิตของคุณคือ! ${studentID} และหมายเลขบัตรประจำตัวประชาชนของคุณคือ ${studentCard} ใช่หรือไม่ `)

    const payloadJson = {
        "type": "template",
        "altText": "this is a confirm template",
        "template": {
          "type": "confirm",
          "actions": [
            {
              "type": "message",
              "label": "Yes",
              "text": "สักครู่นะค่ะ"
            },
            {
              "type": "message",
              "label": "No",
              "text": "แล้วค่อยกลับมาลงทะเบียนกับเราใหม่นะค่ะ"
            }
          ],
          "text": "ยืนยันการลงทะเบียนนะค่ะ"
        }
      }
    let payload = new Payload(`LINE`, payloadJson, { sendAsMessage: true });

    agent.add(payload);

  }

  

  // Run the proper function handler based on the matched Dialogflow intent name
  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', fallback);
  intentMap.set('studentinfo', register); //ชื่อ intent ที่มัทสร้างและกำหนด ใน dialogflow
  return agent.handleRequest(intentMap);
});