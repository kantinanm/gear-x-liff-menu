const fs = require('fs')
const firebase = require('firebase')
const students = require('./student.json')
const enrollments = require('./enrollment.json')

function checkConfigFile() {
  const firebaseConfigPath = './src/firebase-config.js'
  if (fs.existsSync(firebaseConfigPath)) {
    return true

  } else {
    return false
  }
}

function checkPermissions() {
  const config = require('../src/firebase-config')

  firebase.initializeApp(config)
  const db = firebase.firestore()

  return db.collection('test').get().then(() => {
    return true
  }).catch(err => {
    if (err.code === 'permission-denied') {
      return false
    }
    return true
  })
}

function seed() {
  const db = firebase.firestore()
  const studentCollection = db.collection('students')
  const enrollmentCollection = db.collection('enrollments')

  return Promise.all(students.map(student => studentCollection.add(student)), enrollments.map(enrollment => enrollmentCollection.add(enrollment)))
}

module.exports = {
  seed,
  checkPermissions,
  checkConfigFile
}