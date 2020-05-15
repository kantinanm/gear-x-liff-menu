'use strict';

const reqId = require("request-promise");
const functions = require('firebase-functions');
const {WebhookClient,Payload} = require('dialogflow-fulfillment');
const {Card, Suggestion} = require('dialogflow-fulfillment');

const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: 'https://gearx-yqdqsf.firebaseio.com'
});
const db = admin.firestore();

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({
    request,
    response
  });
  //console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

  const getBody = request.body.originalDetectIntentRequest.payload;
  const userId = getBody.data.source.userId;

  function welcome(agent) {
    agent.add(`Welcome to my agent!`);
  }

  function fallback(agent) {
    agent.add(`I didn't understand`);
    agent.add(`I'm sorry, can you try again?`);
  }

  function chkUser(user){
    return db.collection('students').where('user_id', '==', user).get()
    .then(snapshot => {
      if (snapshot.empty) {
        console.log('No matching documents.');
        return Promise.resolve(false);
      }else{
        console.log('true');
        return Promise.resolve(true);
      }  
    }).catch(err => {
      console.log('Error getting documents', err);
      return Promise.reject(err);
    });
  }

  function getProfileFromURL(studentID,studentCard){
    return reqId(`https://eecon43.nu.ac.th/checkstudent/${studentID}/`)
    .then((data) => {
      let responseData = JSON.parse(data);
      let result = responseData.result;
      if(result == "OK"){
        //พบข้อมูลรหัสนิสิต
        if(responseData.pid == studentCard.toString()){
          //หมายเลขบัตร ปชช ถูกต้อง
          console.log('Success');
          return Promise.resolve(responseData);
        }else{
          //หมายเลขบัตร ปชช ไม่ถูกต้อง
          console.log('Undefined!');
          return Promise.resolve('Undefined');
        }
      }else{
        //ไม่พบข้อมูล
        console.log('Undefined');
        return Promise.resolve('Undefined');
      }
    }).catch((err)=> {
      return Promise.reject(err);
    });
  }

  async function register(agent) {
  const params = agent.parameters;
  const studentID = params.stdID;
  const studentCard = params.stdCard;

  console.log('user id: '+ userId);
  //[1]เช็ค userid จาก db ถ้ามีข้อมูลแล้วจะไม่ให้ผูกบัญชีได้อีก
  if(await chkUser(userId)) return agent.add('ท่านได้ผูกบัญชีกับระบบแล้วค่ะ')
  //[2]ถ้ายังไม่ได้ผูกบัญชี ส่งรหัสนิสิตกับหมายเลขบัตร ปชช ไปดึงข้อมูลจาก reg
    return getProfileFromURL(studentID,studentCard)
    .then((result)=> {
      //[3]ไม่พบข้อมูลใน reg
      if(result == "Undefined"){
        const undefined = {
          "type": "text",
          "text": "ไม่พบข้อมูล!"
        }
        let msg = new Payload(`LINE`, undefined, { sendAsMessage: true });
        agent.add(msg);
        return Promise.reject()
      }else{
        //[4]พบข้อมูลใน reg
        agent.add(`รหัสนิสิตของคุณคือ! ${result.student_code} และหมายเลขบัตรประจำตัวประชาชนของคุณคือ ${result.pid} ใช่หรือไม่คะ?`);
        const payloadJson = {
          "type": "template",
          "altText": "this is a confirm template",
          "template": {
            "type": "confirm",
            "actions": [
              {
                "type": "message",
                "label": "Yes",
                "text": "ใช่"
              },
              {
                "type": "message",
                "label": "No",
                "text": "ไม่ใช่"
              }
            ],
            "text": "ยืนยันการลงทะเบียน"
          }
        }
        let payload = new Payload(`LINE`, payloadJson, { sendAsMessage: true });
        agent.add(payload);
        return Promise.resolve()
      }
    })
    .catch((err) => {
      console.log(err);
      agent.add("กรุณาลองใหม่อีกครั้งค่ะ");
      return Promise.resolve();
    })
  }

  function isClickYes(agent){
    const params = agent.parameters;
    const studentID = params.stdID;
    const studentCard = params.stdCard;

    return getProfileFromURL(studentID,studentCard)
    .then((result)=> {
      const flexMessage = {
        "type": "flex",
        "altText": "Flex Message",
        "contents": {
          "type": "bubble",
          "direction": "ltr",
          "header": {
            "type": "box",
            "layout": "vertical",
            "contents": [
              {
                "type": "text",
                "text": "ข้อมูลผู้ใช้",
                "align": "center",
                "color": "#123663"
              }
            ]
          },
          "hero": {
            "type": "image",
            "url": "https://civil.eng.nu.ac.th/ceCentre/img/ungit/CCI04202020_0003.png",
            "size": "full",
            "aspectMode": "cover",
            "backgroundColor": "#FB5F15"
          },
          "body": {
            "type": "box",
            "layout": "vertical",
            "contents": [
              {
                "type": "text",
                "text": result.student_code + ' ' + result.fullname,
                "align": "center"
              }
            ]
          },
          "footer": {
            "type": "box",
            "layout": "horizontal",
            "contents": [
              {
                "type": "button",
                "action": {
                  "type": "message",
                  "label": "ผูกบัญชี",
                  "text":"ผูกบัญชี"
                },
                "style": "secondary"
              }
            ]
          }
        }
      };
      let payload = new Payload(`LINE`, flexMessage, { sendAsMessage: true });
      agent.add(payload);
      return Promise.resolve()
    })
    .catch((err) => {
      console.log(err);
      agent.add("Uh oh, something happened.");
      return Promise.resolve();
    })
  }

  function addStudent(agent){
    const params = agent.parameters;
    const studentID = params.stdID;
    const studentCard = params.stdCard;
    return getProfileFromURL(studentID,studentCard)
    .then((result)=> {
      if(result == "Undefined"){
        const undefined = {
          "type": "text",
          "text": "ไม่พบข้อมูล!"
        }
        let msg = new Payload(`LINE`, undefined, { sendAsMessage: true });
        agent.add(msg);
        return Promise.reject()
      }else{
        try{
          db.collection("students").add({
            "student_code": result.student_code,
            "student_id_reg": result.student_id_reg,
            "pid": result.pid,
            "fullname": result.fullname,
            "fullname_eng": result.fullname_eng,
            "faculty": result.faculty,
            "curriculum": result.curriculum,
            "major": result.major,
            "degree": result.degree,
            "certificate_name":result.certificate_name,
            "education_status": result.education_status,
            "teacher": result.teacher,
            "gpa": result.gpa,
            "user_id":userId
          })
          .then(function(docRef) {
              console.log("Document written with ID: ", docRef.id);
          })
          .catch(function(error) {
              console.error("Error adding document: ", error);
          });
        }catch(err){
          console.log(err);
        }
        console.log('user id: '+ userId + ' '+ result.student_code);
        agent.add(`ลงทะเบียนเรียบร้อยแล้วค่ะ`);
        const payloadJson = {
          "type": "sticker",
          "packageId": "11537",
          "stickerId": "52002735"
        }
        let payload = new Payload(`LINE`, payloadJson, { sendAsMessage: true });
        agent.add(payload);
        return Promise.resolve()
      }
    })
    .catch((err) => {
      console.log(err);
      agent.add("กรุณาลองใหม่อีกครั้งค่ะ");
      return Promise.resolve();
    })
  }

  //menu 2
  function getSubject(studentID){
    return reqId(`https://eecon43.nu.ac.th/enroll/${studentID}/2562/2/`)
    .then((data) => {
      let responseData = JSON.parse(data);
      let result = responseData.result;
      if(result == "OK"){
        console.log('Success');
        return Promise.resolve(responseData.enroll);
      }
    }).catch((err)=> {
      console.log('err!! '+err)
      return Promise.reject(err);
    });
  }

  function showSubject (agent) {
    return db.collection('students').where('user_id', '==', userId).get()
      .then(snapshot => {
        if (snapshot.empty) {
          console.log('No matching documents.');
          return;
        }  
        snapshot.forEach(doc => {
          const std_id = doc.data().student_code;
          return getSubject(std_id)
          .then((result)=> {
            //const addData = addSubjectToDB(std_id,result);
            console.log('json ',JSON.stringify(result));
            /*result.forEach(enroll => {
              const addData = addSubjectToDB(std_id,enroll);
            });*/
            //console.log('json ',JSON.stringify(addData));
            return Promise.resolve()
          })
          .catch((err) => {
            console.log(err);
            return Promise.resolve();
          })
        });
      })
      .catch(err => {
        console.log('Error getting documents', err);
      });
  }

  function addSubjectToDB(std_id,enroll){
    try{
      db.collection("enrollment").add({
        "student_code": std_id,
        "enroll": [
          {
            "subject_id": enroll.subject_id,
            "subject_name": enroll.subject_name, 
            "unit": enroll.unit,
            "section": enroll.section
          }, 
          { 
            "subject_id": enroll.subject_id,
            "subject_name": enroll.subject_name, 
            "unit": enroll.unit,
            "section": enroll.section
          }
        ],
        "user_id":userId
      })
      .then(function(docRef) {
          console.log("Document written with ID: ", docRef.id);
      })
      .catch(function(error) {
          console.error("Error adding document: ", error);
      });
    }catch(err){
      console.log(err);
    }
  }

  /*function showSubject (agent) {
    return db.collection('students').where('user_id', '==', userId).get()
      .then(snapshot => {
        console.log('true '+ userId);
        if (snapshot.empty) {
          console.log('No matching documents.');
          return;
        }  
        
        snapshot.forEach(doc => {
          console.log(doc.id, '=>', doc.data());
          let rows = [];
          const std_id = doc.data().student_code;
          //console.log(std_id);
          return getSubject(std_id)
          .then((result)=> {
            result.forEach(enroll => {
              //console.log('enroll '+ enroll.subject_name);
              const carousel = getListSubject(enroll);
              rows.push(carousel);
            });
            //console.log('json ',JSON.stringify(rows));
            let payloadJson = {
              "type": "template",
              "altText": "รายวิชาที่ลงทะเบียน",
              "contents": {
                "type": "carousel",
                "contents": rows
              }
            }
            //console.log('payloadJson ',JSON.stringify(payloadJson));
            let menu = new Payload(agent.LINE, payloadJson, { sendAsMessage: true });
            agent.add(menu);
            console.log('commits');
            return Promise.resolve()
          })
          .catch((err) => {
            console.log(err);
            return Promise.resolve();
          })
        });
          agent.add("กรุณารอสักครู่...");
      })
      .catch(err => {
        console.log('Error getting documents', err);
      });
  }*/

/* ----------- */
  /*function getListSubject (subjects) {
    console.log('enroll'+ subjects.subject_name);
    return {
      "type": "flex",
      "altText": "Flex Message",
      "contents": {
        "type": "bubble",
        "body": {
          "type": "box",
          "layout": "vertical",
          "spacing": "sm",
          "contents": [
            {
              "type": "image",
              "url": "https://raw.githubusercontent.com/matzeeya/Liff-gear-x/master/src/pic/CCI04202020_0002-1.png",
              "size": "full",
              "backgroundColor": "#FFFFFF"
            },
            {
              "type": "text",
              "text": subjects.subject_id+' '+subjects.subject_name,
              "size": "sm",
              "weight": "bold",
              "wrap": true
            },
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "text",
                  "text": 'หน่วยกิต: '+subjects.unit,
                  "size": "sm"
                }
              ]
            },
            {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "text",
                  "text": 'กลุ่ม: '+subjects.section,
                  "size": "sm"
                }
              ]
            }
          ]
        },
        "footer": {
          "type": "box",
          "layout": "vertical",
          "spacing": "sm",
          "contents": [
            {
              "type": "button",
              "action": {
                "type": "uri",
                "label": "ดูข้อมูลรายวิชา",
                "uri": "https://linecorp.com"
              },
              "style": "primary"
            }
          ]
        }
      }
    }
  }*/
  //end menu 2

  //menu 3
  function showSchedule (agent) {
    const result = "2562254074519";
    return db.collection('classSchedule').doc(result).get().then(snapshot => {
        //agent.add('test '+snapshot.data().Monday.room);
        let rows = [];
        const dayList = snapshot.data()
        for (const key in dayList) {
          if (dayList.hasOwnProperty(key)) {
            const schedules = dayList[key];
            //agent.add('test!! '+schedules);
            const carousel = getSchedule(schedules);
            rows.push(carousel);
          }
        }
        //agent.add('get bubble '+carousel);
        let payloadJson = {
          "type": "flex",
          "altText": "ตารางเรียน",
          "contents": {
            "type": "carousel",
            "contents": rows
          }
        }

        let menu = new Payload(agent.LINE, payloadJson, { sendAsMessage: true });
        agent.add(menu);
    });
  }

  function getSchedule (schedules) {
      return {
        "type": "bubble",
        "direction": "ltr",
        "body": {
          "type": "box",
          "layout": "vertical",
          "spacing": "sm",
          "contents": [
            {
              "type": "image",
              "url": schedules.url,
              "gravity": "top",
              "size": "full"
            },
            {
              "type": "box",
              "layout": "baseline",
              "contents": [
                {
                  "type": "icon",
                  "url": "https://raw.githubusercontent.com/matzeeya/Liff-gear-x/master/src/pic/next1.png",
                  "size": "xl"
                },
                {
                  "type": "text",
                  "text": "13:00-14:50 น.",
                  "size": "xl",
                  "align": "center",
                  "weight": "bold"
                }
              ]
            },
            {
              "type": "box",
              "layout": "baseline",
              "contents": [
                {
                  "type": "text",
                  "text": schedules.subject_code,
                  "size": "sm",
                  "wrap": true
                }
              ]
            },
            {
              "type": "box",
              "layout": "baseline",
              "contents": [
                {
                  "type": "text",
                  "text": schedules.subject_name,
                  "size": "sm"
                }
              ]
            },
            {
              "type": "box",
              "layout": "baseline",
              "contents": [
                {
                  "type": "text",
                  "text": schedules.room,
                  "size": "sm"
                }
              ]
            }
          ]
        },
        "footer": {
          "type": "box",
          "layout": "vertical",
          "spacing": "sm",
          "contents": [
            {
              "type": "text",
              "text": schedules.dates,
              "size": "xl",
              "align": "center",
              "weight": "bold"
            }
          ]
        },
        "styles": {
          "body": {
            "backgroundColor": schedules.color
          }
        }
      }
  }
  //end menu 3

  //menu 4
  function viewCalendar(agent){
    const payloadJson = {
        "type": "flex",
        "altText": "Flex Message",
        "contents": {
          "type": "bubble",
          "hero": {
            "type": "image",
            "url": "https://civil.eng.nu.ac.th/ceCentre/img/ungit/CCI04202020_0003.png",
            "size": "full",
            "aspectRatio": "3:4",
            "aspectMode": "cover",
            "backgroundColor": "#B49898"
          },
          "body": {
            "type": "box",
            "layout": "vertical",
            "spacing": "md",
            "contents": [
              {
                "type": "text",
                "text": "ปฏิทินการศึกษา",
                "size": "xl",
                "weight": "bold"
              },
              {
                "type": "box",
                "layout": "vertical",
                "spacing": "sm",
                "contents": [
                  {
                    "type": "box",
                    "layout": "baseline",
                    "contents": [
                      {
                        "type": "icon",
                        "url": "https://scdn.line-apps.com/n/channel_devcenter/img/fx/restaurant_regular_32.png"
                      },
                      {
                        "type": "text",
                        "text": "ปีการศึกษา 2562",
                        "margin": "sm",
                        "weight": "bold"
                      }
                    ]
                  },
                  {
                    "type": "box",
                    "layout": "baseline",
                    "contents": [
                      {
                        "type": "icon",
                        "url": "https://scdn.line-apps.com/n/channel_devcenter/img/fx/restaurant_large_32.png"
                      },
                      {
                        "type": "text",
                        "text": "เทอม 2",
                        "margin": "sm",
                        "weight": "bold"
                      }
                    ]
                  }
                ]
              }
            ]
          },
          "footer": {
            "type": "box",
            "layout": "vertical",
            "contents": [
              {
                "type": "spacer",
                "size": "xxl"
              },
              {
                "type": "button",
                "action": {
                  "type": "uri",
                  "label": "ดูรายละเอียด",
                  "uri": "https://liff.line.me/1654142758-0Wa6zVJm"
                },
                "color": "#905C44",
                "style": "primary"
              }
            ]
          }
        }
      }
  let payload = new Payload(`LINE`, payloadJson, { sendAsMessage: true });
  agent.add(payload);
  //agent.add('เทส');
  }

  // Run the proper function handler based on the matched Dialogflow intent name
  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', fallback);
  intentMap.set('studentinfo - stdID - stdCard', register);
  intentMap.set('studentinfo - stdID - stdCard - yes', isClickYes);
  intentMap.set('studentinfo - register', addStudent);
  intentMap.set('showSubject', showSubject);
  //intentMap.set('selectSubject', selectSubject);
  intentMap.set('classSchedule', showSchedule);
  intentMap.set('calendar', viewCalendar)
  return agent.handleRequest(intentMap);
});