/**
 * Firebase Configuration
 */

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDyFf9zFYfFECreUX42xOIxctQzx4YsyLA",
  authDomain: "mapa-cdmx-b4b28.firebaseapp.com",
  projectId: "mapa-cdmx-b4b28",
  storageBucket: "mapa-cdmx-b4b28.firebasestorage.app",
  messagingSenderId: "897083318077",
  appId: "1:897083318077:web:f8b87504f8e0df5eea6f54",
  measurementId: "G-ZSBC39DPJE"
};

// Inicializar Firebase
let db;
let auth;
let isFirebaseReady = false;

const ADMIN_EMAIL = "lorencez.lopez.david@gmail.com";

try {
  firebase.initializeApp(firebaseConfig);

  db = firebase.firestore();
  auth = firebase.auth();

  isFirebaseReady = true;

  console.log("✅ Firebase inicializado correctamente");

  // Escuchar cambios de sesión
  auth.onAuthStateChanged((user) => {
    window.isAdmin =
      user &&
      user.email &&
      user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    console.log(
      window.isAdmin
        ? "👑 Administrador conectado"
        : "👤 Usuario normal"
    );

    if (window.app && typeof window.app.updateUI === "function") {
      window.app.updateUI();
    }
  });

} catch (error) {
  console.warn(
    "⚠️ Firebase no configurado. Usando modo demo con localStorage."
  );

  isFirebaseReady = false;
}

window.isAdmin = false;

/**
 * Iniciar sesión como administrador
 */
async function adminLogin() {
  if (!auth) {
    alert("Firebase Auth no está disponible.");
    return;
  }

  const email = prompt("Correo de administrador:");

  if (!email) return;

  const password = prompt("Contraseña:");

  if (!password) return;

  try {
    const result = await auth.signInWithEmailAndPassword(
      email,
      password
    );

    if (
      result.user.email.toLowerCase() !==
      ADMIN_EMAIL.toLowerCase()
    ) {
      await auth.signOut();

      alert("Este usuario no tiene permisos de administrador.");
      return;
    }

    alert("Sesión iniciada correctamente.");

  } catch (error) {
    console.error(error);

    alert("Correo o contraseña incorrectos.");
  }
}

/**
 * Cerrar sesión
 */
async function adminLogout() {
  if (!auth) return;

  try {
    await auth.signOut();

    alert("Sesión cerrada.");

  } catch (error) {
    console.error(error);
  }
}

/**
 * Clase para manejar el almacenamiento de datos
 */
class DataStore {
  constructor() {
    this.STORAGE_KEY = "bachemap_reports";
    this.listeners = [];
  }

  // Obtener todos los reportes
  async getAll() {
    if (isFirebaseReady && db) {
      try {
        const snapshot = await db
          .collection("reports")
          .orderBy("createdAt", "desc")
          .get();

        return snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

      } catch (error) {
        console.error("Error al obtener de Firebase:", error);

        return this.getFromLocal();
      }
    }

    return this.getFromLocal();
  }

  // Guardar reporte
  async save(report) {
    if (isFirebaseReady && db) {
      try {
        const docRef = await db.collection("reports").add({
          ...report,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

        return {
          id: docRef.id,
          ...report,
        };

      } catch (error) {
        console.error("Error al guardar en Firebase:", error);

        return this.saveToLocal(report);
      }
    }

    return this.saveToLocal(report);
  }

  // Actualizar votos
  async updateVotes(id, votes) {
    if (isFirebaseReady && db) {
      try {
        await db
          .collection("reports")
          .doc(id)
          .update({ votes });

        return true;

      } catch (error) {
        console.error("Error al actualizar votos:", error);

        return this.updateVotesLocal(id, votes);
      }
    }

    return this.updateVotesLocal(id, votes);
  }

  // Eliminar reporte (solo admin)
  async delete(id) {

    if (!window.isAdmin) {
      alert("No tienes permisos para eliminar reportes.");
      return false;
    }

    if (isFirebaseReady && db) {
      try {
        await db
          .collection("reports")
          .doc(id)
          .delete();

        return true;

      } catch (error) {
        console.error("Error al eliminar:", error);

        return false;
      }
    }

    return this.deleteLocal(id);
  }

  // Escuchar cambios en tiempo real
  onChanges(callback) {
    if (isFirebaseReady && db) {
      return db
        .collection("reports")
        .orderBy("createdAt", "desc")
        .onSnapshot((snapshot) => {

          const reports = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          callback(reports);
        });
    }

    const interval = setInterval(async () => {

      const reports = await this.getFromLocal();

      callback(reports);

    }, 5000);

    return () => clearInterval(interval);
  }

  // Métodos localStorage
  getFromLocal() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);

      return data ? JSON.parse(data) : [];

    } catch {
      return [];
    }
  }

  saveToLocal(report) {
    const reports = this.getFromLocal();

    const newReport = {
      ...report,
      id: "local_" + Date.now(),
      createdAt: new Date().toISOString(),
    };

    reports.unshift(newReport);

    localStorage.setItem(
      this.STORAGE_KEY,
      JSON.stringify(reports)
    );

    return newReport;
  }

  updateVotesLocal(id, votes) {
    const reports = this.getFromLocal();

    const index = reports.findIndex((r) => r.id === id);

    if (index !== -1) {

      reports[index].votes = votes;

      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify(reports)
      );

      return true;
    }

    return false;
  }

  deleteLocal(id) {
    const reports = this.getFromLocal()
      .filter((r) => r.id !== id);

    localStorage.setItem(
      this.STORAGE_KEY,
      JSON.stringify(reports)
    );

    return true;
  }
}

// Instancia global
const dataStore = new DataStore();
