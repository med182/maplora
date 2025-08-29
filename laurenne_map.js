// Limites de la France métropolitaine (à ajuster si besoin)
const franceBounds = L.latLngBounds(
  [41.2, -5.5],  // Sud-Ouest
  [51.3, 9.7]    // Nord-Est
);

// Création de la carte Leaflet avec contraintes
const map = L.map('map', {
  maxBounds: franceBounds,           // Empêche de sortir de France
  maxBoundsViscosity: 1.0,           // Rend les limites strictes (pas de rebond)
  minZoom: 6                         // Empêche de trop dézoomer
});

const Reload = L.Control.extend({
  onAdd: function(){
    const b = L.DomUtil.create('button', 'iot-reload');
    b.title = 'Rafraîchir'; b.innerHTML = '↻';
    L.DomEvent.on(b, 'click', e => { L.DomEvent.stop(e); loadIot(); });
    return b;
  }
});
L.control.reload = opts => new Reload(opts);
L.control.reload({ position:'topright' }).addTo(map);


// Définition des limites géographiques (Île-de-France)
const idfBounds = [
  [48.70, 2.10],
  [49.05, 2.55]
];

// Zoom automatique sur l’Île-de-France
map.fitBounds(idfBounds);

// Ajout de la couche de tuiles OpenStreetMap
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
  crossOrigin: true  
}).addTo(map);

function exportMapPNG(){
  leafletImage(map, function(err, canvas){
    if (err || !canvas) { window.print(); return; } 
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'carte-iot.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  });
}


const Save = L.Control.extend({
  onAdd: function(){
    const b = L.DomUtil.create('button', 'iot-btn iot-save');
    b.title = 'Exporter / Imprimer la carte';
    b.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>'; 
    L.DomEvent.on(b,'click', e => { L.DomEvent.stop(e); window.print(); });
    return b;
  }
});
L.control.save = opts => new Save(opts);
L.control.save({ position:'topright' }).addTo(map);  // à côté du ↻



// Extraction des coordonnées à partir d'un WKT POINT(lat lon)
function extractLatLng(wkt) {
  const match = /POINT\(([\d.-]+) ([\d.-]+)\)/.exec(wkt);
  if (!match) return null;
  const lat = parseFloat(match[1]);  // Latitude
  const lon = parseFloat(match[2]);  // Longitude
  return [lat, lon];
}

// Retourne une couleur selon l'ancienneté de la dernière communication
function getIconColor(derniereComm) {
  const maintenant = new Date();
  const dateComm = new Date(derniereComm);
  if (isNaN(dateComm)) return 'gray'; // Date invalide
  const diffHeures = (maintenant - dateComm) / (1000 * 60 * 60);
  if (diffHeures > 24) return '#90152bff'; // Rouge foncé
  if (diffHeures > 4)  return '#ff8719';   // Orange
  return '#459329ff';                      // Vert
}

// Crée une icône personnalisée selon le type et la couleur
function createIcon(type, color) {
  let iconClass = type === 'gateway' ? 'fa-tower-broadcast' : 'fa-address-card';
  return L.divIcon({
    html: `<i class="fa-solid ${iconClass} fa-2xl" style="color: ${color};"></i>`,
    className: 'fa-icon-wrapper',
    iconSize: [16, 16],
    iconAnchor: [16, 16],
    popupAnchor: [0, -32]
  });
}

// ===================================================================
//  IOT DYNAMIQUE : charge directement le PHP de ton app (port 8080)
// ===================================================================
const markersLayer = L.layerGroup().addTo(map);
const API_URL = 'http://localhost:8080/stores/extstore_iotdevices.php'; 

async function loadIot() {
  try {

    const res  = await fetch(API_URL, { mode: 'cors', credentials: 'include' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    markersLayer.clearLayers();
    if (!data || !data.success || !data.rows) return;

    let bounds = null;

 
    data.rows.forEach(equipement => {
      const gps = equipement.localisation_gps ? extractLatLng(equipement.localisation_gps) : null;
      if (!gps) return;

      const color = getIconColor(equipement.derniere_comm);
      const icon  = createIcon(equipement.type_equipement, color);

   
      const s = Number(equipement.indice_signal);
      let signalImg = (s >= 1 && s <= 5)
        ? `<img src="${s}.png" alt="Signal ${s}" style="height:14px;vertical-align:top;">`
        : 'Non disponible';

    
      const popupContent = `
        <strong>${equipement.nom_equipement || equipement.devEUI || ''}</strong><br>
        Type: ${equipement.type_equipement || ''}<br>
        Site: ${equipement.site_nom || ''}<br>
        Dernière comm: ${equipement.derniere_comm || ''}<br>
        Réseau : ${equipement.network || ''}<br>
        Signal reçu : ${signalImg}
      `;

      L.marker(gps, { icon }).addTo(markersLayer).bindPopup(popupContent);
      bounds = bounds ? bounds.extend(gps) : L.latLngBounds(gps, gps);
    });

    if (bounds) map.fitBounds(bounds, { padding: [20, 20] });
  } catch (error) {
    console.error('Erreur IoT :', error);
  }
}


loadIot();
setInterval(loadIot, 60000); 


