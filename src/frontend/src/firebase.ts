import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAJIN8FKsPGBXhfO9Dvw5SW2HN58nTvmxE",
  authDomain: "clikmate-erp.firebaseapp.com",
  projectId: "clikmate-erp",
  storageBucket: "clikmate-erp.firebasestorage.app",
  messagingSenderId: "639418425559",
  appId: "1:639418425559:web:e9f62bb86ddd161ce55092",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export default app;
