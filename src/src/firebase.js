import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Tus llaves oficiales de conexión
const firebaseConfig = {
  apiKey: "AIzaSyCqLGua09sIzdt7i2_fjz8FeHDTJ34QfWA",
  authDomain: "gestion-almacenes.firebaseapp.com",
  databaseURL:
    "https://gestion-almacenes-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "gestion-almacenes",
  storageBucket: "gestion-almacenes.firebasestorage.app",
  messagingSenderId: "629632703140",
  appId: "1:629632703140:web:36095c10a6d0e1445ca431",
  measurementId: "G-1SLSJ2KYCS",
};

// Inicializamos la aplicación de Firebase
const app = initializeApp(firebaseConfig);

// Exportamos la Base de Datos para que el resto de la app pueda usarla
export const db = getFirestore(app);
