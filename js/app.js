/**
 * Main Application - BacheMap CDMX
 * 
 * Controla la lógica de la interfaz de usuario y coordina
 * el mapa con el almacenamiento de datos.
 */

class BacheMapApp {
  constructor() {
    this.reports = [];
    this.unsubscribe = null;
    
    // Referencias DOM
    this.elements = {};
    
    // Estado
    this.isModalOpen = false;
    this.pendingDuplicate = false;
  }

  /**
   * Inicializa la aplicación
   */
  async init() {
    // Cachear elementos DOM
    this.cacheElements();
    
    // Inicializar mapa
    mapManager.init();
    
    // Configurar event listeners
    this.setupEventListeners();
    
    // Cargar tema guardado
    this.loadTheme();
    
    // Inicializar iconos
    lucide.createIcons();
    
    // Cargar datos iniciales
    await this.loadReports();
    
    // Suscribirse a cambios en tiempo real
    this.subscribeToChanges();
    
    console.log('🚀 BacheMap CDMX iniciado');
  }

  /**
   * Cachea referencias a elementos DOM
   */
  cacheElements() {
    this.elements = {
      // Modales
      reportModal: document.getElementById('reportModal'),
      modalContent: document.getElementById('modalContent'),
      duplicateModal: document.getElementById('duplicateModal'),
      
      // Formularios
      reportForm: document.getElementById('reportForm'),
      description: document.getElementById('description'),
      
      // Botones
      closeModal: document.getElementById('closeModal'),
      cancelBtn: document.getElementById('cancelBtn'),
      locateBtn: document.getElementById('locateBtn'),
      fabReport: document.getElementById('fabReport'),
      themeToggle: document.getElementById('themeToggle'),
      duplicateCancel: document.getElementById('duplicateCancel'),
      duplicateConfirm: document.getElementById('duplicateConfirm'),
      
      // Filtros
      filterAll: document.getElementById('filterAll'),
      filterSmall: document.getElementById('filterSmall'),
      filterMedium: document.getElementById('filterMedium'),
      filterLarge: document.getElementById('filterLarge'),
      
      // Stats
      totalCount: document.getElementById('totalCount'),
      smallCount: document.getElementById('smallCount'),
      mediumCount: document.getElementById('mediumCount'),
      largeCount: document.getElementById('largeCount'),
      
      // Lista
      recentReports: document.getElementById('recentReports'),
      
      // Toast
      toastContainer: document.getElementById('toastContainer'),
      
      // Sidebar móvil
      sidebar: document.getElementById('sidebar')
    };
  }

  /**
   * Configura todos los event listeners
   */
  setupEventListeners() {
    // Modal de reporte
    this.elements.closeModal.addEventListener('click', () => this.closeReportModal());
    this.elements.cancelBtn.addEventListener('click', () => this.closeReportModal());
    this.elements.reportModal.addEventListener('click', (e) => {
      if (e.target === this.elements.reportModal) this.closeReportModal();
    });
    
    // Formulario
    this.elements.reportForm.addEventListener('submit', (e) => this.handleSubmit(e));
    
    // Modal de duplicado
    this.elements.duplicateCancel.addEventListener('click', () => this.closeDuplicateModal());
    this.elements.duplicateConfirm.addEventListener('click', () => {
      this.pendingDuplicate = false;
      this.closeDuplicateModal();
      this.openReportModal();
    });
    this.elements.duplicateModal.addEventListener('click', (e) => {
      if (e.target === this.elements.duplicateModal) this.closeDuplicateModal();
    });
    
    // Geolocalización
    this.elements.locateBtn.addEventListener('click', () => this.handleLocate());
    
    // (eliminado - movido arriba con funcionalidad mejorada)
    
    // Tema
    this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
    
    // Tema móvil
    const themeToggleMobile = document.getElementById('themeToggleMobile');
    if (themeToggleMobile) {
      themeToggleMobile.addEventListener('click', () => this.toggleTheme());
    }
    
    // FAB móvil - centrar mapa en ubicación
    this.elements.fabReport.addEventListener('click', () => {
      mapManager.map.setView(mapManager.CDMX_CENTER, 13);
      this.showToast('Centrado en CDMX. Toca el mapa para reportar.', 'info');
    });
    
    // Cerrar instrucciones móviles al tocar mapa
    setTimeout(() => {
      const mobileInstructions = document.getElementById('mobileInstructions');
      if (mobileInstructions) {
        mobileInstructions.style.opacity = '0';
        mobileInstructions.style.transition = 'opacity 0.5s';
        setTimeout(() => mobileInstructions.style.display = 'none', 500);
      }
    }, 5000);
    
    // Filtros
    this.elements.filterAll.addEventListener('click', () => this.setFilter('all'));
    this.elements.filterSmall.addEventListener('click', () => this.setFilter('small'));
    this.elements.filterMedium.addEventListener('click', () => this.setFilter('medium'));
    this.elements.filterLarge.addEventListener('click', () => this.setFilter('large'));
    
    // Tecla Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeReportModal();
        this.closeDuplicateModal();
      }
    });
  }

  /**
   * Carga los reportes iniciales
   */
  async loadReports() {
    try {
      this.reports = await dataStore.getAll();
      this.updateUI();
      mapManager.loadReports(this.reports);
    } catch (error) {
      console.error('Error cargando reportes:', error);
      this.showToast('Error al cargar los reportes', 'error');
    }
  }

  /**
   * Se suscribe a cambios en tiempo real
   */
  subscribeToChanges() {
    this.unsubscribe = dataStore.onChanges((reports) => {
      this.reports = reports;
      this.updateUI();
      mapManager.loadReports(this.reports);
    });
  }

  /**
   * Actualiza toda la interfaz
   */
  updateUI() {
    this.updateStats();
    this.updateRecentList();
  }

  /**
   * Actualiza las estadísticas
   */
  updateStats() {
    const stats = {
      total: this.reports.length,
      small: this.reports.filter(r => r.size === 'small').length,
      medium: this.reports.filter(r => r.size === 'medium').length,
      large: this.reports.filter(r => r.size === 'large').length
    };

    // Animar contadores
    this.animateCounter(this.elements.totalCount, stats.total);
    this.animateCounter(this.elements.smallCount, stats.small);
    this.animateCounter(this.elements.mediumCount, stats.medium);
    this.animateCounter(this.elements.largeCount, stats.large);
  }

  /**
   * Anima un contador numérico
   */
  animateCounter(element, target) {
    const current = parseInt(element.textContent) || 0;
    if (current === target) return;
    
    const duration = 500;
    const start = performance.now();
    
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(current + (target - current) * easeOut);
      
      element.textContent = value;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }

  /**
   * Actualiza la lista de reportes recientes
   */
  updateRecentList() {
    const recent = this.reports.slice(0, 5);
    
    if (recent.length === 0) {
      this.elements.recentReports.innerHTML = `
        <div class="text-center py-8 text-slate-400">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
          <p class="text-xs">No hay reportes aún</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    const sizeLabels = {
      small: { text: 'Pequeño', color: 'bg-green-100 text-green-700' },
      medium: { text: 'Mediano', color: 'bg-yellow-100 text-yellow-700' },
      large: { text: 'Grande', color: 'bg-red-100 text-red-700' }
    };

    this.elements.recentReports.innerHTML = recent.map(report => {
      const size = sizeLabels[report.size];
      const date = mapManager.formatDate(report.createdAt);
      
      return `
        <div class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer group"
             onclick="window.app.focusReport('${report.id}')">
          <div class="w-10 h-10 rounded-lg ${size.color} flex items-center justify-center flex-shrink-0">
            <i data-lucide="map-pin" class="w-4 h-4"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="text-xs font-medium ${size.color} px-2 py-0.5 rounded-full">${size.text}</span>
              <span class="text-xs text-slate-400">${date}</span>
            </div>
            <p class="text-xs text-slate-600 dark:text-slate-300 truncate">
              ${report.description || 'Sin descripción'}
            </p>
          </div>
          <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"></i>
        </div>
      `;
    }).join('');
    
    lucide.createIcons();
  }

  /**
   * Enfoca un reporte en el mapa
   */
  focusReport(id) {
    const report = this.reports.find(r => r.id === id);
    if (report) {
      mapManager.setView(report.lat, report.lng);
      const marker = mapManager.markers[id];
      if (marker) {
        marker.openPopup();
      }
    }
  }

  /**
   * Maneja el envío del formulario
   */
  async handleSubmit(e) {
    e.preventDefault();
    
    const latLng = mapManager.getPendingLatLng();
    if (!latLng) {
      this.showToast('Error: No se pudo obtener la ubicación', 'error');
      return;
    }

    const formData = new FormData(e.target);
    const size = formData.get('size');
    const description = this.elements.description.value.trim();

    // Crear objeto de reporte
    const report = {
      lat: latLng.lat,
      lng: latLng.lng,
      size,
      description,
      votes: 0,
      votedBy: []
    };

    try {
      // Guardar en Firebase/localStorage
      await dataStore.save(report);
      
      // Cerrar modal y limpiar
      this.closeReportModal();
      this.elements.reportForm.reset();
      mapManager.clearPendingLatLng();
      
      this.showToast('¡Reporte guardado exitosamente!', 'success');
    } catch (error) {
      console.error('Error guardando reporte:', error);
      this.showToast('Error al guardar el reporte', 'error');
    }
  }

  /**
   * Vota en un reporte
   */
  async voteReport(id, value) {
    const report = this.reports.find(r => r.id === id);
    if (!report) return;

    // En una app real, verificaríamos si el usuario ya votó
    // Por ahora, permitimos votos ilimitados para demo
    
    const newVotes = (report.votes || 0) + value;
    
    try {
      await dataStore.updateVotes(id, newVotes);
      
      // Actualizar datos locales
      report.votes = newVotes;
      mapManager.markers[id].reportData.votes = newVotes;
      mapManager.updatePopupContent(id);
      
      const message = value > 0 ? '¡Gracias por confirmar!' : 'Reporte marcado como resuelto';
      this.showToast(message, 'success');
    } catch (error) {
      this.showToast('Error al registrar voto', 'error');
    }
  }

  /**
   * Maneja la geolocalización
   */
  async handleLocate() {
    this.showToast('Buscando tu ubicación...', 'info');
    
    try {
      await mapManager.locateUser();
      this.showToast('Ubicación encontrada', 'success');
    } catch (error) {
      console.error('Error de geolocalización:', error);
      // Usar el mensaje de error específico o uno genérico
      const message = error && error.message ? error.message : 'No se pudo obtener tu ubicación. Verifica los permisos.';
      this.showToast(message, 'error');
    }
  }

  /**
   * Abre el modal de reporte
   */
  openReportModal() {
    this.elements.reportModal.classList.remove('hidden');
    this.elements.reportModal.classList.add('flex');
    
    // Animar entrada (mobile: slide up, desktop: scale)
    setTimeout(() => {
      this.elements.modalContent.classList.remove('translate-y-full', 'lg:scale-95', 'lg:opacity-0');
      this.elements.modalContent.classList.add('translate-y-0', 'lg:scale-100', 'lg:opacity-100');
    }, 10);
    
    this.isModalOpen = true;
    
    // Ocultar instrucciones móviles
    const mobileInstructions = document.getElementById('mobileInstructions');
    if (mobileInstructions) mobileInstructions.style.display = 'none';
  }

  /**
   * Cierra el modal de reporte
   */
  closeReportModal() {
    this.elements.modalContent.classList.remove('translate-y-0', 'lg:scale-100', 'lg:opacity-100');
    this.elements.modalContent.classList.add('translate-y-full', 'lg:scale-95', 'lg:opacity-0');
    
    setTimeout(() => {
      this.elements.reportModal.classList.add('hidden');
      this.elements.reportModal.classList.remove('flex');
      this.isModalOpen = false;
      mapManager.clearPendingLatLng();
    }, 200);
  }

  /**
   * Muestra advertencia de duplicado
   */
  showDuplicateWarning() {
    this.pendingDuplicate = true;
    this.elements.duplicateModal.classList.remove('hidden');
    this.elements.duplicateModal.classList.add('flex');
    
    // Animar entrada
    const modalContent = document.getElementById('duplicateModalContent');
    setTimeout(() => {
      modalContent.classList.remove('translate-y-full');
      modalContent.classList.add('translate-y-0');
    }, 10);
  }

  /**
   * Cierra modal de duplicado
   */
  closeDuplicateModal() {
    const modalContent = document.getElementById('duplicateModalContent');
    modalContent.classList.remove('translate-y-0');
    modalContent.classList.add('translate-y-full');
    
    setTimeout(() => {
      this.elements.duplicateModal.classList.add('hidden');
      this.elements.duplicateModal.classList.remove('flex');
      if (this.pendingDuplicate) {
        mapManager.clearPendingLatLng();
        this.pendingDuplicate = false;
      }
    }, 200);
  }

  /**
   * Cambia el filtro activo
   */
  setFilter(filter) {
    // Actualizar botones
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('bg-slate-800', 'text-white');
      btn.classList.add('bg-slate-100', 'text-slate-600');
    });
    
    const activeBtn = {
      all: this.elements.filterAll,
      small: this.elements.filterSmall,
      medium: this.elements.filterMedium,
      large: this.elements.filterLarge
    }[filter];
    
    activeBtn.classList.remove('bg-slate-100', 'text-slate-600');
    activeBtn.classList.add('bg-slate-800', 'text-white');
    
    // Aplicar filtro al mapa
    mapManager.applyFilter(filter);
  }

  /**
   * Alterna entre tema claro/oscuro
   */
  toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    mapManager.updateMapTheme();
  }

  /**
   * Carga el tema guardado
   */
  loadTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (saved === 'dark' || (!saved && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
    mapManager.updateMapTheme();
  }

  /**
   * Muestra un toast notification
   */
  showToast(message, type = 'info') {
    const colors = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      warning: 'bg-amber-500',
      info: 'bg-blue-500'
    };

    const icons = {
      success: 'check-circle',
      error: 'x-circle',
      warning: 'alert-triangle',
      info: 'info'
    };

    const toast = document.createElement('div');
    toast.className = `toast pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white ${colors[type]} w-full lg:w-auto lg:min-w-[300px] max-w-md`;
    toast.innerHTML = `
      <i data-lucide="${icons[type]}" class="w-5 h-5 flex-shrink-0"></i>
      <p class="text-sm font-medium flex-1">${message}</p>
    `;

    this.elements.toastContainer.appendChild(toast);
    lucide.createIcons();

    // Animar entrada
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Remover después de 3 segundos (más tiempo en móvil para leer mejor)
    const duration = window.innerWidth < 1024 ? 4000 : 3000;
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

// Inicializar app cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.app = new BacheMapApp();
  window.app.init();
});