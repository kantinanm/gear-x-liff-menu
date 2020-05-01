const region = 'asia-northeast1';
const functions = require('firebase-functions');
const request = require('request-promise');
const LINE_MESSAGING_API = "https://api.line.me/v2/bot/message";
const LINE_HEADER = {
  "Content-Type": "application/json",
  "Authorization": "Bearer CHANNEL_ACCESS_TOKEN"
};
//  1. Import Dialogflow library
const dialogflow = require('dialogflow')
//  2. define dialogflow projectId
const projectId = "gearx-yqdqsf"
//  3. Create session client
const sessionClient = new dialogflow.SessionsClient({
  projectId,
  keyFilename: 'dialogflow-service-account.json',
})

exports.webhookDetectIntent = functions.region(region).https.onRequest(async (req, res) => {
  if (req.body.events[0].type !== 'message') {
      return
  }
  if (req.body.events[0].message.type !== 'text') {
      return
  }
  
  const event = req.body.events[0]
  const userId = event.source.userId
  const message = event.message.text
  
  //  7. call detectIntent function
  const intentResponse = await detectIntent(userId, message, 'th')
  //  8. convert structure to json
  const structjson = require('./structjson');
  const intentResponseMessage = intentResponse.queryResult.fulfillmentMessages
  const replyMessage = intentResponseMessage.map( (messageObj) => {
    let struct
    if (messageObj.message === "text") {
        return {type: "text", text: messageObj.text.text[0] }
    } else if(messageObj.message === "payload") {
        struct = messageObj.payload
        return structjson.structProtoToJson(struct)
    }
    return null
  })
  //  9. reply to user
  request({
    method: "POST",
    uri: `${LINE_MESSAGING_API}/reply`,
    headers: LINE_HEADER,
    body: JSON.stringify({
      replyToken: event.replyToken,
      messages: replyMessage
    })
  })
  
  res.status(200).end()
})

const detectIntent = async (userId, message, languageCode) => {
  //  4. create session path เพื่อจดจำ context ของ user
  const sessionPath = sessionClient.sessionPath(projectId, userId)
  //  5. create request params เพื่อใช้ส่งไป Dialogflow เพื่อ detectIntent
  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: message,
        languageCode: languageCode,
      },
    },
  }
  //  6. call dialogflow API detectIntent
  const responses = await sessionClient.detectIntent(request)
  return responses[0]
}