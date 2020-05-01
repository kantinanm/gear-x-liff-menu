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

  function getProfile(studentID,studentCard){
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

  function register(agent) {
    const params = agent.parameters;
    const studentID = params.stdID;
    const studentCard = params.stdCard;

    //console.log('user id: '+ userId);
    return getProfile(studentID,studentCard)
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

    return getProfile(studentID,studentCard)
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
    return getProfile(studentID,studentCard)
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
  /*function getSubject(studentID){
    console.log(`url: https://eecon43.nu.ac.th/enroll/${studentID}/2562/2/`);
    return reqId(`https://eecon43.nu.ac.th/enroll/${studentID}/2562/2/`)
    .then((data) => {
      let responseData = JSON.parse(data);
      let result = responseData.result;
      if(result == "OK"){
        console.log('Success');
        console.log('subid: '+responseData.enroll[0].subject_id);
        return Promise.resolve(responseData.enroll);
      }
      
    }).catch((err)=> {
      return Promise.reject(err);
    });
  }*/

  function showSubject (agent) {
    //return db.collection('students').get().then(snapshot => {
    //return db.collection('students').doc('o96eEPEc5hUay57DWGHJ').get().then(item => {
      //if (snapshot.empty) return agent.add(`ยังไม่มีข้อมูลนิสิต`);
      //snapshot.docs.map(item => {
        /*const uid = item.data().user_id;
        if(uid == userId){
          const std_id = item.data().student_id;
          console.log('student_id!: '+ std_id);
          return getSubject('59365544')
          .then((result)=> {
            for (let index = 0; index < result.length; index++) {
              const enroll = result[index];
              console.log(enroll.subject_id);
            }
            return Promise.resolve()
          })
          .catch((err) => {
            console.log(err);
            return Promise.resolve();
          })
        }
      });*/
    //});
    return db.collection('subject').limit(4).get().then(snapshot => {
      if (snapshot.empty) return agent.add(`ยังไม่มีรายวิชาที่ลงทะเบียน`);
      let menu;
      if (agent.requestSource !== agent.LINE) {
        menu = `รายวิชาที่ลงทะเบียน :\n${snapshot.docs.map(subject => `- ${subject.data().subName}`).sort().join('\n')}`;
      }
      else {
        const carousel = getListSubject(snapshot.docs)
        menu = carousel
        menu = new Payload(agent.LINE, carousel, { sendAsMessage: true });
      }
      return agent.add(menu);
    });
  }

  function selectSubject(agent){
    const result = "621"+agent.parameters.subID+"54074519";

    return db.collection('subject').doc(result).get().then(doc => {
      const flexMessage = {
        "type": "flex",
        "altText": "Flex Message",
        "contents": {
          "type": "bubble",
          "direction": "ltr",
          "hero": {
            "type": "image",
            "url": doc.data().url,
            "size": "full",
            "aspectRatio": "20:13",
            "aspectMode": "cover",
            "backgroundColor": "#C5C1C1"
          },
          "body": {
            "type": "box",
            "layout": "vertical",
            "spacing": "sm",
            "contents": [
              {
                "type": "text",
                "text": "รายละเอียด",
                "size": "xl",
                "align": "center",
                "weight": "bold"
              },
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  {
                    "type": "icon",
                    "url": "https://raw.githubusercontent.com/matzeeya/Liff-gear-x/master/src/pic/fast-forward.png",
                    "aspectRatio": "2:1"
                  },
                  {
                    "type": "text",
                    "text": 'รหัสวิชา: '+ doc.data().subId,
                    "wrap": true
                  }
                ]
              },
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  {
                    "type": "icon",
                    "url": "https://raw.githubusercontent.com/matzeeya/Liff-gear-x/master/src/pic/fast-forward.png",
                    "aspectRatio": "2:1"
                  },
                  {
                    "type": "text",
                    "text": 'ชื่อรายวิชา: '+doc.data().subName
                  }
                ]
              },
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  {
                    "type": "icon",
                    "url": "https://raw.githubusercontent.com/matzeeya/Liff-gear-x/master/src/pic/fast-forward.png",
                    "aspectRatio": "2:1"
                  },
                  {
                    "type": "text",
                    "text": 'ผู้สอน: '+doc.data().teacher_name,
                  }
                ]
              },
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  {
                    "type": "icon",
                    "url": "https://raw.githubusercontent.com/matzeeya/Liff-gear-x/master/src/pic/fast-forward.png",
                    "aspectRatio": "2:1"
                  },
                  {
                    "type": "text",
                    "text": 'วัน-เวลา: '+doc.data().dates+' '+doc.data().times+' น.',
                  }
                ]
              },
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  {
                    "type": "icon",
                    "url": "https://raw.githubusercontent.com/matzeeya/Liff-gear-x/master/src/pic/fast-forward.png",
                    "aspectRatio": "2:1"
                  },
                  {
                    "type": "text",
                    "text": 'ห้อง: '+ doc.data().room
                  }
                ]
              },
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  {
                    "type": "icon",
                    "url": "https://raw.githubusercontent.com/matzeeya/Liff-gear-x/master/src/pic/fast-forward.png",
                    "aspectRatio": "2:1"
                  },
                  {
                    "type": "text",
                    "text": 'หน่วยกิต: '+doc.data().subUnit
                  }
                ]
              },
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  {
                    "type": "icon",
                    "url": "https://raw.githubusercontent.com/matzeeya/Liff-gear-x/master/src/pic/fast-forward.png",
                    "aspectRatio": "2:1"
                  },
                  {
                    "type": "text",
                    "text": 'กลุ่ม: '+doc.data().group_id
                  }
                ]
              }
            ]
          }
        }
      };
      let payload = new Payload(`LINE`, flexMessage, { sendAsMessage: true });
      agent.add(payload);
  });
  }

  function getListSubject (subjects) {
    const rows = subjects.map(item => {
      const subject = item.data()
      return {
        "type": "bubble",
        "body": {
          "type": "box",
          "layout": "vertical",
          "spacing": "sm",
          "contents": [
            {
              "type": "image",
              "url": subject.url,
              "size": "full",
              "backgroundColor": "#FFFFFF"
            },
            {
              "type": "text",
              "text": subject.subId+' '+subject.subName,
              "size": "sm",
              "weight": "bold",
              "wrap": true
            },
            {
              "type": "text",
              "text": "ผู้สอน: " + subject.teacher_name,
              "size": "sm",
              "weight": "regular",
              "wrap": true
            },
            {
              "type": "text",
              "text": "หน่วยกิต: " + subject.subUnit,
              "size": "sm",
              "weight": "regular",
              "wrap": true
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
                "type": "message",
                "label": "ดูข้อมูลรายวิชา",
                "text": 'รายวิชา ' + subject.subId+' '+subject.subName
              },
              "style": "primary"
            }
          ]
        }
      }
    })
    const seeMoreBubble = {
      "type": "bubble",
      "body": {
        "type": "box",
        "layout": "vertical",
        "spacing": "sm",
        "contents": [
          {
            "type": "button",
            "action": {
              "type": "uri",
              "label": "ดูเมนูทั้งหมด",
              "uri": "https://google.com" 
            },
            "color": "#C40019",
            "gravity": "center",
            "offsetTop": "150px"
          }
        ]
      }
    }
    rows.push(seeMoreBubble)
    console.log('rows: ' + JSON.stringify(rows))
    return {
      "type": "flex",
      "altText": "รายวิชาที่ลงทะเบียน",
      "contents": {
        "type": "carousel",
        "contents": rows
      }
    }
  }
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
  intentMap.set('selectSubject', selectSubject);
  intentMap.set('classSchedule', showSchedule);
  intentMap.set('calendar', viewCalendar)
  return agent.handleRequest(intentMap);
});