<template>
  <section class="section">
    <div class="container">
      <h1 class="title">Schedule </h1>
      <!-- TODO: add greeting text -->

      <div class="columns is-multiline">
        <!-- loading indicator -->
       
        <!-- Subject Card-->
        <!-- to show -->

        <!-- TODO: add share button-->
        <div class="share" v-if="userProfile && !isLoading">
          <p class="subtitle">บอกให้เพื่อนรู้ว่าเราเรียนอะไร ? 🤓</p>
          <button class="button" @click="share">แชร์ตารางเรียน ให้เพื่อนดู</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
const firebaseApp = require("../firebase.js");
const line = require("../line-config");
export default {
  data() {
    return {
      classSchedule: [],
      isLoading: false,
      userProfile: null
    };
  },
  mounted() {
    const liff = this.$liff;
    liff
      .init({
        liffId: "" // your liff id
      })
      .then(() => {
        console.log("LIFF initialize finished");
        if (liff.isLoggedIn()) {
          liff
            .getProfile()
            .then(profile => {
              // console.log(JSON.stringify(profile))
              this.userProfile = profile;
            })
            .catch(err => {
              console.error(err);
            });
        } else {
          console.log("LIFF is not logged in");
          liff.login();
        }
      })
      .catch(err => {
        console.error("Error initialize LIFF: ", err);
      });
    // TODO: get classSchedule from Firestore
    this.isLoading = true;
    let id_for_test = "2562254074519";
    firebaseApp.classScheduleCollection.get(id_for_test).then(snapshot => {
      this.classSchedule = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log("to show data");
      console.log(this.classSchedule);
      this.isLoading = false;
    });
  },
  methods: {

    share() {
      console.log("share target picker");
      // TODO: implement share target picker
      const liff = this.$liff;
      liff
        .shareTargetPicker([
          {
            type: "text",
            text: "ตารางเรียนจ้า " + line.classScheduleLiffUrl
          }
        ])
        .then(function() {
          console.log("Message sent");
        })
        .catch(function(error) {
          console.log("Error sending message: " + error);
        });
    },
  
  }
};
</script>

<style scoped>
.share {
  margin: 8px auto;
  padding: 16px;
}
</style>