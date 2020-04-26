import firebase from 'firebase/app'
import 'firebase/firestore'
import config from './firebase-config'

// firebase initialize
firebase.initializeApp(config)

// firebase utils
const db = firebase.firestore()

// firebase collections
const studentCollection = db.collection('students')
const sjEnrollmentCollection = db.collection('subject_enrollment')

export {
    db,
    studentCollection,
    sjEnrollmentCollection
}