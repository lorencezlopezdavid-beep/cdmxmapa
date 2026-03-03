/**
 * Map Manager - Maneja toda la lógica del mapa de Leaflet
 */

class MapManager {
  constructor() {
    // Centro de CDMX (Zócalo)
    this.CDMX_CENTER = [19.4326, -99.1332];
    this.DEFAULT_ZOOM = 12;
    this.MOBILE_ZOOM = 11;
    
    // Colores por tamaño de bache
    this.COLORS = {
      small: '#22c55e',   // Verde
      medium: '#eab308',  // Amarillo
      large: '#ef4444'    // Rojo
    };

    // Iconos personalizados
    this.icons = {};
    
    // Marcadores activos
    this.markers = {};
    
    // Filtro actual
    this.currentFilter = 'all';
    
    // Referencia temporal para nuevo reporte
    this.pendingLatLng = null;
    
    // Radio de duplicación en metros
    this.DUPLICATE_RADIUS = 10;
  }

  /**
   * Inicializa el mapa
   */
  init() {
    // Detectar si es móvil
    const isMobile = window.innerWidth < 1024;
    
    // Crear mapa
    this.map = L.map('map', {
      center: this.CDMX_CENTER,
      zoom: isMobile ? this.MOBILE_ZOOM : this.DEFAULT_ZOOM,
      zoomControl: false,
      tap: true,
      touchZoom: true,
      dragging: true
    });

    // Agregar control de zoom personalizado
    L.control.zoom({
      position: 'bottomright'
    }).addTo(this.map);

    // Capa base de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);

    // Capa alternativa para modo oscuro (usaremos CSS filter)
    this.setupDarkModeSupport();

    // Crear iconos personalizados
    this.createCustomIcons();

    // Configurar eventos
    this.setupEvents();

    return this;
  }

  /**
   * Configura soporte para modo oscuro
   */
  setupDarkModeSupport() {
    // El modo oscuro se maneja mediante CSS filter en el contenedor del mapa
    this.updateMapTheme();
  }

  /**
   * Actualiza el tema del mapa según el modo oscuro
   */
  updateMapTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    const mapContainer = document.getElementById('map');
    const isMobile = window.innerWidth < 1024;
    
    if (isDark) {
      // En móvil, aplicar filtro más suave para mejor rendimiento
      if (isMobile) {
        mapContainer.style.filter = 'brightness(0.85) invert(1) hue-rotate(180deg)';
      } else {
        mapContainer.style.filter = 'brightness(0.8) contrast(1.1) hue-rotate(180deg) invert(1)';
      }
    } else {
      mapContainer.style.filter = 'none';
    }
  }

  /**
   * Crea iconos personalizados para cada tamaño
   */
  createCustomIcons() {
    const sizes = {
      small: { size: 24, iconSize: 12 },
      medium: { size: 32, iconSize: 16 },
      large: { size: 40, iconSize: 20 }
    };

    Object.keys(sizes).forEach(size => {
      const config = sizes[size];
      this.icons[size] = L.divIcon({
        className: 'custom-marker',
        html: `
          <div class="relative">
            <div class="absolute inset-0 rounded-full animate-ping opacity-75" 
                 style="background-color: ${this.COLORS[size]}"></div>
            <div class="relative w-${config.size / 4} h-${config.size / 4} rounded-full shadow-lg flex items-center justify-center"
                 style="width: ${config.size}px; height: ${config.size}px; background-color: ${this.COLORS[size]}; border: 3px solid white;">
              <svg width="${config.iconSize}" height="${config.iconSize}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                ${size === 'large' 
                  ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
                  : '<circle cx="12" cy="12" r="10"/>'}
              </svg>
            </div>
          </div>
        `,
        iconSize: [config.size, config.size],
        iconAnchor: [config.size / 2, config.size / 2],
        popupAnchor: [0, -config.size / 2]
      });
    });
  }

  /**
   * Configura eventos del mapa
   */
  setupEvents() {
    // Detectar drag para evitar clicks accidentales en móvil
    this.isDragging = false;
    let startPos = null;
    
    this.map.on('mousedown touchstart', (e) => {
      this.isDragging = false;
      startPos = e.containerPoint || (e.touches && e.touches[0]);
    });
    
    this.map.on('mousemove touchmove', () => {
      this.isDragging = true;
    });
    
    // Click en el mapa para nuevo reporte
    this.map.on('click', (e) => {
      this.handleMapClick(e);
    });
    
    // Ajustar zoom al cambiar tamaño de pantalla
    window.addEventListener('resize', () => {
      const isMobile = window.innerWidth < 1024;
      const currentZoom = this.map.getZoom();
      const targetZoom = isMobile ? this.MOBILE_ZOOM : this.DEFAULT_ZOOM;
      
      if (Math.abs(currentZoom - targetZoom) > 1) {
        this.map.setZoom(targetZoom);
      }
    });
  }

  /**
   * Maneja el click en el mapa
   */
  handleMapClick(e) {
    // En móvil, verificar que no sea un drag
    if (this.isDragging) return;
    
    this.pendingLatLng = e.latlng;
    
    // Verificar duplicados
    const nearby = this.findNearbyReports(e.latlng, this.DUPLICATE_RADIUS);
    
    if (nearby.length > 0) {
      // Mostrar advertencia de duplicado
      window.app.showDuplicateWarning();
    } else {
      // Abrir modal directamente
      window.app.openReportModal();
    }
  }

  /**
   * Busca reportes cercanos a una ubicación
   */
  findNearbyReports(latlng, radiusMeters) {
    const nearby = [];
    
    Object.values(this.markers).forEach(marker => {
      const distance = this.map.distance(latlng, marker.getLatLng());
      if (distance <= radiusMeters) {
        nearby.push({
          marker,
          distance: Math.round(distance),
          data: marker.reportData
        });
      }
    });
    
    return nearby;
  }

  /**
   * Agrega un marcador al mapa
   */
  addMarker(report) {
    const { id, lat, lng, size, description, createdAt, votes = 0 } = report;
    
    // Verificar si ya existe
    if (this.markers[id]) {
      this.removeMarker(id);
    }

    // Crear marcador
    const marker = L.marker([lat, lng], {
      icon: this.icons[size]
    }).addTo(this.map);

    // Guardar datos en el marcador
    marker.reportData = report;

    // Crear contenido del popup
    const popupContent = this.createPopupContent(report);
    marker.bindPopup(popupContent, {
      maxWidth: 300,
      className: 'custom-popup'
    });

    // Guardar referencia
    this.markers[id] = marker;

    // Aplicar filtro actual
    this.applyFilter(this.currentFilter);

    return marker;
  }

  /**
   * Crea el contenido HTML del popup
   */
  createPopupContent(report) {
    const { size, description, createdAt, votes = 0, id } = report;
    
    const sizeLabels = {
      small: { text: 'Pequeño', color: 'text-green-600', bg: 'bg-green-100' },
      medium: { text: 'Mediano', color: 'text-yellow-600', bg: 'bg-yellow-100' },
      large: { text: 'Grande', color: 'text-red-600', bg: 'bg-red-100' }
    };

    const sizeInfo = sizeLabels[size];
    const date = this.formatDate(createdAt);

    return `
      <div class="min-w-[250px]">
        <div class="flex items-center gap-2 mb-3">
          <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${sizeInfo.bg} ${sizeInfo.color}">
            ${sizeInfo.text}
          </span>
          <span class="text-xs text-slate-400">${date}</span>
        </div>
        
        ${description ? `
          <p class="text-sm text-slate-700 dark:text-slate-300 mb-3 line-clamp-3">
            "${description}"
          </p>
        ` : '<p class="text-sm text-slate-400 italic mb-3">Sin descripción</p>'}
        
        <div class="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
          <div class="flex items-center gap-2">
            <button onclick="window.app.voteReport('${id}', 1)" 
                    class="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-green-50 text-slate-600 hover:text-green-600 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
              </svg>
              <span class="text-xs font-medium">Sí existe</span>
            </button>
            <button onclick="window.app.voteReport('${id}', -1)" 
                    class="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50 text-slate-600 hover:text-red-600 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
              </svg>
            </button>
          </div>
          <div class="flex items-center gap-1 text-sm">
            <span class="font-semibold ${votes > 0 ? 'text-green-600' : votes < 0 ? 'text-red-600' : 'text-slate-600'}">
              ${votes > 0 ? '+' : ''}${votes}
            </span>
            <span class="text-slate-400 text-xs">confirmaciones</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Actualiza el contenido de un popup
   */
  updatePopupContent(id) {
    const marker = this.markers[id];
    if (marker) {
      const content = this.createPopupContent(marker.reportData);
      marker.setPopupContent(content);
    }
  }

  /**
   * Elimina un marcador
   */
  removeMarker(id) {
    if (this.markers[id]) {
      this.map.removeLayer(this.markers[id]);
      delete this.markers[id];
    }
  }

  /**
   * Elimina todos los marcadores
   */
  clearAllMarkers() {
    Object.keys(this.markers).forEach(id => {
      this.removeMarker(id);
    });
  }

  /**
   * Carga múltiples reportes
   */
  loadReports(reports) {
    // Limpiar marcadores existentes que no están en la nueva lista
    const newIds = new Set(reports.map(r => r.id));
    Object.keys(this.markers).forEach(id => {
      if (!newIds.has(id)) {
        this.removeMarker(id);
      }
    });

    // Agregar o actualizar marcadores
    reports.forEach(report => {
      this.addMarker(report);
    });
  }

  /**
   * Aplica filtro por tamaño
   */
  applyFilter(filter) {
    this.currentFilter = filter;
    
    Object.values(this.markers).forEach(marker => {
      const size = marker.reportData.size;
      const shouldShow = filter === 'all' || filter === size;
      
      if (shouldShow) {
        marker.addTo(this.map);
      } else {
        this.map.removeLayer(marker);
      }
    });
  }

  /**
   * Centra el mapa en una ubicación
   */
  setView(lat, lng, zoom = null) {
    const isMobile = window.innerWidth < 1024;
    const finalZoom = zoom || (isMobile ? 15 : 16);
    this.map.setView([lat, lng], finalZoom);
  }

  /**
   * Obtiene la ubicación del usuario
   */
  locateUser() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no soportada'));
        return;
      }

      this.map.locate({
        setView: true,
        maxZoom: 16,
        enableHighAccuracy: true,
        timeout: 10000
      });

      this.map.once('locationfound', (e) => {
        // Agregar círculo de precisión
        L.circle(e.latlng, {
          radius: e.accuracy / 2,
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.1
        }).addTo(this.map).bindPopup('Tu ubicación').openPopup();
        
        resolve(e.latlng);
      });

      this.map.once('locationerror', (e) => {
        // Manejar error con mensaje claro
        let errorMessage = 'No se pudo obtener tu ubicación';
        
        if (e.code === 1) {
          errorMessage = 'Permiso de ubicación denegado. Activa la ubicación en tu navegador.';
        } else if (e.code === 2) {
          errorMessage = 'Ubicación no disponible. Intenta de nuevo.';
        } else if (e.code === 3) {
          errorMessage = 'Tiempo de espera agotado. Intenta de nuevo.';
        } else if (e.message) {
          errorMessage = e.message;
        }
        
        reject(new Error(errorMessage));
      });
    });
  }

  /**
   * Obtiene las coordenadas pendientes
   */
  getPendingLatLng() {
    return this.pendingLatLng;
  }

  /**
   * Limpia las coordenadas pendientes
   */
  clearPendingLatLng() {
    this.pendingLatLng = null;
  }

  /**
   * Formatea fecha para mostrar
   */
  formatDate(timestamp) {
    if (!timestamp) return 'Fecha desconocida';
    
    let date;
    if (timestamp.toDate) {
      // Firebase Timestamp
      date = timestamp.toDate();
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      date = new Date();
    }

    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Justo ahora';
    if (minutes < 60) return `Hace ${minutes} min`;
    if (hours < 24) return `Hace ${hours} h`;
    if (days < 7) return `Hace ${days} días`;
    
    return date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
}

// Instancia global
const mapManager = new MapManager();