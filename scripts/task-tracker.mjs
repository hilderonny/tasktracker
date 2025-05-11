// Firebase SDK Funktionen
// Verfügbare Firebase Libs: https://firebase.google.com/docs/web/learn-more#available-libraries
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.8/firebase-app.js';
// Firebase Authentifizierung
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithRedirect, signOut } from 'https://www.gstatic.com/firebasejs/9.6.8/firebase-auth.js';
// Firestore Datenbank
import { getFirestore, collection, query, onSnapshot, doc, getDoc, setDoc, deleteDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/9.6.8/firebase-firestore.js';

import DetailDialog from './components/vue/detail-dialog.mjs';
import FilterButton from './components/vue/filter-button.mjs';
import LabelledInput from './components/vue/labelled-input.mjs';
import LabelledSelect from './components/vue/labelled-select.mjs';
import PlayerWidget from './components/vue/player-widget.mjs';
import Task from './components/vue/task.mjs';
import experiencehelper from './utils/experiencehelper.mjs';

// Firebase Konfiguration
import firebaseConfig from './config/firebase-web.mjs';
import localFirebaseConfig from './config/firebase-local.mjs';
const firebaseConfigToUse = localFirebaseConfig ?? firebaseConfig; // Wenn lokale API Settings vorhanden sind, sollen diese anstelle der öffentlichen Schlüssel verwendet werden

const app = {
  components: {
    DetailDialog,
    FilterButton,
    LabelledInput,
    LabelledSelect,
    PlayerWidget,
    Task
  },
  data() {
    return {
      firebaseapp: undefined,
      finishedloading: false,
      loaded: false,
      marked: window.marked,
      showplayerdetails: false,
      selectedtask: undefined,
      player: undefined,
      taskidtoselect: undefined,
      tasks: [],
      googleAuthProvider: undefined,
      taskcategories: [
        { label: "Rot", value: "rot", color: '#ff3b30' },
        { label: "Gelb", value: "gelb", color: '#ffcc00' },
        { label: "Grün", value: "gruen", color: '#4cda63' },
        { label: "Lila", value: "lila", color: '#b425d8' },
        { label: "Grau", value: "grau", color: '#8f8e93' },
        { label: "Hellblau", value: "hellblau", color: '#5ac9fa' },
        { label: "Orange", value: "orange", color: '#ff9601' },
        { label: "Rosa", value: "rosa", color: '#ff6684' },
        { label: "Blau", value: "blau", color: '#017aff' },
      ],
    }
  },
  mounted() {
    // Sobald Vue fertig initialisiert ist, soll die Verbindung zu Firebase initialisiert werden
    // App initialisieren und starten, liefert app-Objekt zurück, siehe https://firebase.google.com/docs/reference/node/firebase.app.App
    this.firebaseapp = initializeApp(firebaseConfigToUse);
    this.googleAuthProvider = new GoogleAuthProvider();
    onAuthStateChanged(getAuth(), this.handleauthstatechange.bind(this));
  },
  methods: {
    ...experiencehelper,
    addchecklistitem() {
      this.selectedtask.c.push({ c: false, t: '' });
      Vue.nextTick(() => {
        this.$refs.newchecklistitem.previousElementSibling.focus();
      });
    },
    async addtask(category) {
      /**
       * t: title
       * n: notes
       * c: checklist
       * c.c: checked
       * c.t: title
       */
      const newtask = { i: 'task-' + Date.now(), c: [], t: '', n: '', co: false, category: category ? category.value : 'gelb' };
      this.taskidtoselect = newtask.i;
      this.save(newtask);
    },
    checkchecklistitemcontent(checklistitem) {
      if (checklistitem.t.length < 1) {
        this.selectedtask.c.splice(this.selectedtask.c.indexOf(checklistitem), 1);
      }
    },
    async completetask(task) {
      this.player.experience += 10 + task.c.filter(c => !!c.c).length; // 10 je Task und 1 je abgeschlossenem ChecklistItem
      this.player.coins += 5 + task.c.filter(c => !!c.c).length; // 5 je Task und 1 je abgeschlossenem ChecklistItem
      await deleteDoc(doc(getFirestore(), 'users', getAuth().currentUser.uid, 'tasks', task.i));
      await this.saveplayer();
    },
    async deleteselectedtask() {
      if (!window.confirm('Wirklich löschen?')) return;
      await deleteDoc(doc(getFirestore(), 'users', getAuth().currentUser.uid, 'tasks', this.selectedtask.i));
      this.selectedtask = undefined;
    },
    // Wird jedesmal aufgerufen, wenn sich was am Anmeldezustand ändert
    async handleauthstatechange(user) {
      if (user) {
        await this.loadplayer(user);
        await this.loadtasks(user);
        this.loaded = true;
      } else {
        // Benutzer ist noch nicht angemeldet, also Anmeldefenster anzeigen
        // Müssen wir mit Redirect machen, weil Popup in PWA-App nicht funktioniert
        await signInWithRedirect(getAuth(), this.googleAuthProvider);
      }
    },
    handlekey(evt) {
      if (evt.keyCode === 13) {
        this.save(this.selectedtask);
        this.selectedtask = undefined;
      }
    },
    async loadplayer(user) {
      // Siehe https://firebase.google.com/docs/firestore/query-data/get-data
      // Jeder Benutzer hat ein eigenes Dokument mit der E-Mail-Adresse als Namen (Identifikator)
      const docSnap = await getDoc(doc(getFirestore(), 'users', user.uid));
      if (docSnap.exists()) {
        this.player = docSnap.data();
      } else {
        // Benutzer existiert noch nicht, also einen anlegen und speichern
        this.player = {
          name: user.displayName,
          experience: 0,
          coins: 0
        };
        await setDoc(doc(getFirestore(), 'users', user.uid), this.player);
      }
      this.player.pictureurl = user.photoURL; // Bild als Avatar anzeigen
    },
    async loadtasks(user) {
      // Die Taskliste wird überwacht und live aktualsiert.
      // Siehe https://firebase.google.com/docs/firestore/query-data/listen#listen_to_multiple_documents_in_a_collection
      onSnapshot(query(collection(getFirestore(), 'users', user.uid, 'tasks')), (querySnapshot) => {
        this.tasks = [];
        querySnapshot.forEach(async (document) => {
          const task = document.data();
          this.tasks.push(task);
          if (this.taskidtoselect && task.i === this.taskidtoselect) {
            this.selectedtask = task;
            this.taskidtoselect = undefined;
          }
        });
        this.finishedloading = true;
      });
    },
    async logout() {
      this.googleAuthProvider.setCustomParameters({
        prompt: 'select_account' // Damit wird beim Wieder-Einloggen das Account-Auswahlfenster angezeigt, damit man den Account wechseln kann
      });
      await signOut(getAuth());
      // Das Wiederanmelden wird über handleauthstatechange geregelt
    },
    async save(task) {
      await setDoc(doc(getFirestore(), 'users', getAuth().currentUser.uid, 'tasks', task.i), task);
    },
    async saveplayer() {
      // Nur das in die Datenbank schreiben, was auch wirklich notwendig ist
      // Damit kann das player Objekt lokal noch erweitert werden, ohne dass die Daten in der DB landen
      const playertosave = {
        name: this.player.name,
        experience: this.player.experience,
        coins: this.player.coins,
      };
      await updateDoc(doc(getFirestore(), 'users', getAuth().currentUser.uid), playertosave);
    },
    tasksforcategory(category) {
      return this.tasks.filter(t => t.category === category.value);
    }
  }
}

Vue.createApp(app).mount('body');
