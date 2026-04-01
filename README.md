# Studio 21 A1 – Intensivtraining Online 🇩🇪

Plataforma interactiva para el libro **Studio 21 A1 – Intensivtraining** (Cornelsen).  
Diseñada para desplegarse en **GitHub Pages** sin ningún servidor backend.

---

## 📁 Estructura del repositorio

```
studio21/
├── index.html              ← Página principal
├── README.md
├── css/
│   └── style.css           ← Estilos completos
├── js/
│   └── app.js              ← Lógica de la aplicación
├── data/
│   └── activities.json     ← Todas las actividades (editable)
└── audios/
    ├── track_02.mp3        ← Pista 02 (Start auf Deutsch 1b)
    ├── track_03.mp3        ← Pista 03
    ├── track_04.mp3        ← Pista 04
    ├── track_05.mp3        ← Pista 05
    ├── track_06.mp3        ← Pista 06
    ├── track_07.mp3        ← Pista 07
    ├── track_08.mp3        ← Pista 08
    ├── track_09.mp3        ← Pista 09
    ├── track_10.mp3        ← Pista 10
    ├── track_11.mp3        ← Pista 11
    ├── track_12.mp3        ← Pista 12
    ├── track_13.mp3        ← Pista 13
    ...
    └── track_39.mp3        ← Última pista del libro
```

---

## 🚀 Despliegue en GitHub Pages

### Paso 1 – Crear repositorio

1. Ve a [github.com/new](https://github.com/new)
2. Nombre: `studio21-online` (o el que prefieras)
3. Visibilidad: **Public** (GitHub Pages gratuito requiere público)
4. Crea el repositorio

### Paso 2 – Subir archivos

**Opción A – Interfaz web de GitHub:**
1. Sube la carpeta completa arrastrando los archivos
2. Mantén la estructura de carpetas (`css/`, `js/`, `data/`, `audios/`)

**Opción B – Git (recomendado):**
```bash
git clone https://github.com/TU_USUARIO/studio21-online.git
cp -r /ruta/a/studio21/* studio21-online/
cd studio21-online
git add .
git commit -m "Agregar Studio 21 plataforma interactiva"
git push origin main
```

### Paso 3 – Activar GitHub Pages

1. Ve a **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / Folder: `/ (root)`
4. Clic en **Save**

Tu sitio estará disponible en:  
`https://TU_USUARIO.github.io/studio21-online/`

---

## 🎵 Agregar los audios

1. Renombra tus archivos MP3 con el formato `track_XX.mp3` (ej: `track_02.mp3`)
2. Súbelos a la carpeta `audios/`
3. En `data/activities.json`, el campo `"audio"` de cada actividad apunta automáticamente a `audios/track_XX.mp3`

**Formatos aceptados:** MP3, OGG, WAV, M4A  
**Tamaño:** GitHub Pages tiene límite de 100MB por archivo y 1GB por repositorio.  
Para archivos grandes, considera usar [Git LFS](https://git-lfs.github.com/).

---

## ✏️ Agregar más actividades

Edita `data/activities.json`. Cada actividad sigue esta estructura:

```json
{
  "id": "kap1-nueva",
  "title": "Título de la actividad",
  "type": "fill_blank",
  "audio": "audios/track_04.mp3",
  "instructions": "Instrucción para el alumno.",
  "items": [
    { "id": 1, "prefix": "Ich ", "blank": "", "suffix": " Laura.", "answer": "heiße" }
  ]
}
```

### Tipos de actividad disponibles (`type`):

| Tipo | Descripción |
|------|-------------|
| `fill_blank` | Completar espacios con texto libre |
| `fill_blank_select` | Completar con menú desplegable |
| `fill_blank_bank` | Completar usando banco de palabras |
| `conjugation_table` | Tabla de conjugación verbal |
| `conjugation_fill` | Tabla + frases con huecos |
| `sorting` | Arrastrar palabras a categorías |
| `match_connect` | Conectar columnas |
| `cross_out` | Tachar la palabra que no corresponde |
| `text_production` | Escribir textos libres |
| `word_boundaries` | Separar palabras en texto continuo |
| `checkbox_table` | Marcar casillas en tabla |
| `labeling` | Etiquetar elementos numerados |

---

## 🛠️ Características

- ✅ Sin backend, funciona 100% estático
- ✅ Progreso guardado en `localStorage` del navegador
- ✅ Reproductor de audio integrado con control de progreso
- ✅ Corrección automática con retroalimentación visual
- ✅ Arrastrar y soltar para actividades de clasificación
- ✅ Responsive (funciona en móvil y tablet)
- ✅ Atajos de teclado: `Alt + ←/→` para navegar capítulos
- ✅ Botón de pista ("Lösung") en actividades de producción

---

## 📝 Licencia

Material didáctico propio. El libro Studio 21 A1 es propiedad de Cornelsen Verlag.
