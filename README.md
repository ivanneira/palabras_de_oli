# 🌟 Palabras de Oli - Aplicación Educativa

Una aplicación web interactiva diseñada específicamente para que Olivia aprenda y practique palabras en español de manera divertida y educativa.

## ✨ Características Principales

### 🎮 Modos de Juego
- **Modo Fácil** 🐱: Con pistas visuales de las letras
- **Modo Difícil** 🦁: Sin pistas, mayor desafío
- **Modo Libre** 🌈: Practica cualquier palabra que quieras

### 🎯 Características Especiales
- **10 Mensajes Personalizados**: Mensajes motivacionales aleatorios para Olivia
- **Normalización de Acentos**: "león" = "leon" (acepta ambas formas)
- **Precarga de Imágenes**: Experiencia fluida sin delays
- **Easter Egg Especial**: Pantalla de unicornio violeta para puntuación perfecta (20/20)
- **Botón Reset Discreto**: Para reiniciar puntos cuando sea necesario
- **Responsive Design**: Optimizado para móvil, tablet y desktop
- **TTS Mejorado**: Voz más lenta, aguda y con exclamaciones expresivas

### 🏆 Sistema de Puntuación
- **Estrellas**: Por cada respuesta correcta
- **Rachas**: Contador de respuestas consecutivas correctas
- **Persistencia**: Los puntos se guardan automáticamente

### 🎨 Diseño
- **Gradiente Violeta**: Fondo hermoso en tonos violetas
- **Animaciones Suaves**: Transiciones y efectos visuales atractivos
- **Confetti**: Celebraciones visuales por logros especiales
- **Estrellas Flotantes**: Efectos de celebración por respuestas correctas

## 🚀 Instalación y Deployment

### Requisitos Previos
- Node.js 16.0.0 o superior
- npm o yarn
- Docker (opcional)

### Instalación Local

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd palabras_de_oli
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Iniciar en modo desarrollo**
   ```bash
   npm run dev
   ```

4. **Iniciar en modo producción**
   ```bash
   npm start
   ```

5. **Abrir en el navegador**
   ```
   http://localhost:3000
   ```

### Deployment con Docker

1. **Usando Docker Compose (Recomendado)**
   ```bash
   docker-compose up -d
   ```

2. **Construir imagen manualmente**
   ```bash
   docker build -t palabras-oli .
   docker run -p 3000:3000 palabras-oli
   ```

### Deployment en Sarah (Servidor Personal)

```bash
# Navegar al directorio del proyecto
cd /home/ineira/codigo/palabras_de_oli

# Actualizar código
git pull origin main

# Construir y ejecutar con Docker Compose
docker-compose up -d --build

# Verificar que esté corriendo
docker-compose ps
```

**Acceso Local:** http://localhost:3011  
**Acceso LAN:** http://192.168.1.45:3011  
**Acceso Público:** Via túnel ngrok automático de Claudio

## 📁 Estructura del Proyecto

```
palabras_de_oli/
├── public/                 # Archivos estáticos
│   ├── index.html         # Página principal
│   ├── app.js            # Lógica de la aplicación
│   ├── styles.css        # Estilos CSS
│   ├── images/           # Imágenes de las palabras
│   └── sounds/           # Archivos de audio (futuros)
├── data/                  # Datos de la aplicación
│   ├── words.json        # Base de datos de palabras
│   └── points.txt        # Persistencia de puntuación
├── server.js             # Servidor Express
├── package.json          # Dependencias del proyecto
├── Dockerfile           # Configuración Docker
├── docker-compose.yml   # Orquestación Docker
└── README.md           # Este archivo
```

## 🎮 Guía de Uso

### Para Olivia
1. **Selecciona un modo de juego**:
   - Fácil si quieres ver las letras
   - Difícil para un mayor desafío
   - Libre para practicar cualquier palabra

2. **Escucha la palabra** haciendo clic en el botón 🔊

3. **Escribe la palabra** en el cuadro de texto

4. **Presiona Enter** o espera un momento para verificar

5. **¡Celebra tus logros!** ⭐ Cada respuesta correcta te da una estrella

### Funciones Especiales
- **Reset de Puntos**: Haz clic en 🔄 para reiniciar (requiere confirmación)
- **Easter Egg**: ¡Consigue 20/20 perfectas para una sorpresa especial! 🦄

## 🛠️ Tecnologías Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Audio**: Web Speech API (Text-to-Speech)
- **Persistencia**: Sistema de archivos local
- **Contenedores**: Docker & Docker Compose
- **Diseño**: CSS Grid, Flexbox, Animaciones CSS

## 📝 Base de Datos de Palabras

Las palabras están organizadas en `data/words.json` con la estructura:

```json
{
  "words": [
    {
      "palabra": "gato",
      "categoria": "animales",
      "dificultad": "facil",
      "imagen": "/images/GATO.png",
      "sonido": "/sounds/gato.mp3"
    }
  ]
}
```

### Categorías Disponibles
- **Animales**: gato, perro, león, oso, pato, vaca, pez
- **Colores**: rojo, azul, verde, rosa, negro
- **Objetos**: casa, sol, luna, árbol, flor, agua, mesa, libro

## 🔧 Configuración Avanzada

### Variables de Entorno
```bash
PORT=3000                    # Puerto del servidor
NODE_ENV=production         # Entorno de ejecución
```

### Configuración TTS
- **Velocidad**: 0.6 (más lenta para mejor comprensión)
- **Tono**: 1.4 (más agudo para niños)
- **Idioma**: es-ES (Español de España)
- **Exclamaciones**: Automáticas para mayor expresividad

### Configuración Docker
El puerto 3011 está mapeado para evitar conflictos en el servidor Sarah.

## 🐛 Solución de Problemas

### Problemas Comunes

1. **No se escucha el audio**
   - Verificar que el navegador permita audio
   - Comprobar volumen del sistema
   - Algunos navegadores requieren interacción del usuario antes del audio

2. **Los puntos no se guardan**
   - Verificar permisos de escritura en `data/points.txt`
   - Comprobar que el servidor tenga acceso al sistema de archivos

3. **Las imágenes no se cargan**
   - Verificar que las imágenes existan en `public/images/`
   - Comprobar la configuración del servidor estático

4. **Problemas de responsive**
   - Limpiar caché del navegador
   - Verificar que el viewport esté configurado correctamente

### Logs y Depuración

```bash
# Ver logs del contenedor
docker-compose logs -f palabras-app

# Monitorear archivos en desarrollo
npm run dev

# Verificar estado del servidor
curl http://localhost:3011/api/words
```

## 🎯 Futuras Mejoras

- [ ] Más categorías de palabras (números, colores avanzados, acciones)
- [ ] Sistema de niveles progresivos
- [ ] Estadísticas detalladas de progreso
- [ ] Modo multijugador para hermanos/amigos
- [ ] Grabación de voz para comparar pronunciación
- [ ] Temas visuales personalizables
- [ ] Integración con calendario de práctica diaria

## 👨‍💻 Desarrollo

### Contribuir
Este es un proyecto personal para Olivia, pero las sugerencias son bienvenidas.

### Autor
Desarrollado con ❤️ para Olivia

### Licencia
MIT License - Uso personal y educativo

---

¡Disfruta aprendiendo, Olivia! 🌟🦄✨
