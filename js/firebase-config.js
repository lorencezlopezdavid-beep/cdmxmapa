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
let isFirebaseReady = false;

try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  isFirebaseReady = true;
  console.log('✅ Firebase inicializado correctamente');
} catch (error) {
  console.warn('⚠️ Firebase no configurado. Usando modo demo con localStorage.');
  isFirebaseReady = false;
}

/**
 * Clase para manejar el almacenamiento de datos
 * Usa Firebase si está disponible, o localStorage como fallback
 */
class DataStore {
  constructor() {
    this.STORAGE_KEY = 'bachemap_reports';
    this.listeners = [];
  }

  // Obtener todos los reportes
  async getAll() {
    if (isFirebaseReady && db) {
      try {
        const snapshot = await db.collection('reports').orderBy('createdAt', 'desc').get();
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (error) {
        console.error('Error al obtener de Firebase:', error);
        return this.getFromLocal();
      }
    }
    return this.getFromLocal();
  }

  // Guardar reporte
  async save(report) {
    if (isFirebaseReady && db) {
      try {
        const docRef = await db.collection('reports').add({
          ...report,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { id: docRef.id, ...report };
      } catch (error) {
        console.error('Error al guardar en Firebase:', error);
        return this.saveToLocal(report);
      }
    }
    return this.saveToLocal(report);
  }

  // Actualizar votos
  async updateVotes(id, votes) {
    if (isFirebaseReady && db) {
      try {
        await db.collection('reports').doc(id).update({ votes });
        return true;
      } catch (error) {
        console.error('Error al actualizar votos:', error);
        return this.updateVotesLocal(id, votes);
      }
    }
    return this.updateVotesLocal(id, votes);
  }

  // Eliminar reporte (para admin)
  async delete(id) {
    if (isFirebaseReady && db) {
      try {
        await db.collection('reports').doc(id).delete();
        return true;
      } catch (error) {
        console.error('Error al eliminar:', error);
        return this.deleteLocal(id);
      }
    }
    return this.deleteLocal(id);
  }

  // Escuchar cambios en tiempo real
  onChanges(callback) {
    if (isFirebaseReady && db) {
      return db.collection('reports')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
          const reports = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          callback(reports);
        });
    }
    
    // Fallback: polling cada 5 segundos
    const interval = setInterval(async () => {
      const reports = await this.getFromLocal();
      callback(reports);
    }, 5000);
    
    return () => clearInterval(interval);
  }

  // Métodos localStorage (fallback)
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
      id: 'local_' + Date.now(),
      createdAt: new Date().toISOString()
    };
    reports.unshift(newReport);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reports));
    return newReport;
  }

  updateVotesLocal(id, votes) {
    const reports = this.getFromLocal();
    const index = reports.findIndex(r => r.id === id);
    if (index !== -1) {
      reports[index].votes = votes;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reports));
      return true;
    }
    return false;
  }

  deleteLocal(id) {
    const reports = this.getFromLocal().filter(r => r.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reports));
    return true;
  }
}

// Instancia global del datastore
const dataStore = new DataStore();