// Configuración centralizada para la aplicación de Olivia
// Este archivo permite personalizar fácilmente la experiencia de la app

const AppConfig = {
    // === CONFIGURACIÓN DE AUDIO ===
    audio: {
        // Volúmenes (0.0 a 1.0)
        volumes: {
            effects: 0.7,      // Sonidos de shine, break, etc.
            voice: 1.0,        // Voz TTS
            applause: 0.7,     // Sonidos de celebración
            music: 0.6         // Música de fondo (futuro)
        },
        
        // Configuración de efectos
        effects: {
            enableSpatialAudio: false,
            fadeInDuration: 100,
            fadeOutDuration: 200
        }
    },

    // === CONFIGURACIÓN DE VOZ (TTS) ===
    voice: {
        language: 'es-ES',
        rate: 0.4,             // Velocidad: 0.1 (muy lenta) a 2.0 (muy rápida)
        pitch: 2.0,            // Tono: 0.1 (grave) a 2.0 (agudo)
        volume: 1.0,           // Volumen de voz: 0.0 a 1.0
        addExclamations: true, // Agregar ¡! automáticamente
        
        // Preferencias de voz
        preferredVoices: [
            'es-ES-Female',
            'Spanish (Spain)',
            'Microsoft Helena',
            'Google español'
        ]
    },

    // === CONFIGURACIÓN VISUAL ===
    visual: {
        // Tema de colores principales
        theme: {
            primary: '#9370DB',           // Violeta principal (favorito de Olivia)
            primaryLight: '#B19CD9',      // Violeta claro
            primaryDark: '#7B68EE',       // Violeta oscuro
            secondary: '#DDA0DD',         // Lila complementario
            accent: '#E6E6FA',            // Lavanda suave
            background: '#F8F6FF',        // Fondo principal muy claro
            surface: '#FFFFFF',           // Superficies de tarjetas
            success: '#98FB98',           // Verde pastel para éxito
            warning: '#FFE4B5',           // Durazno para advertencias
            error: '#FFB6C1',             // Rosa suave para errores
            text: {
                primary: '#4A4A4A',       // Texto principal
                secondary: '#6B6B6B',     // Texto secundario
                light: '#8A8A8A',         // Texto claro
                onPrimary: '#FFFFFF'      // Texto sobre colores primarios
            }
        },

        // Efectos visuales
        effects: {
            enableAnimations: true,
            animationSpeed: 'normal',     // 'slow', 'normal', 'fast'
            enableParticles: true,
            enableGlow: true,
            borderRadius: {
                small: '12px',
                medium: '20px',
                large: '25px',
                extra: '30px'
            }
        },

    },

    // === CONFIGURACIÓN DE TIPOGRAFÍA ===
    typography: {
        // Fuentes principales (educativas, sin serif)
        fonts: {
            primary: "'Inter', 'Segoe UI', 'Roboto', sans-serif",
            secondary: "'Open Sans', 'Segoe UI', sans-serif",
            display: "'Poppins', 'Inter', sans-serif",
            fallback: "system-ui, -apple-system, sans-serif"
        },
        
        // Tamaños base (se escalan responsive)
        sizes: {
            xs: '0.75rem',    // 12px
            sm: '0.875rem',   // 14px
            base: '1rem',     // 16px
            lg: '1.125rem',   // 18px
            xl: '1.25rem',    // 20px
            '2xl': '1.5rem',  // 24px
            '3xl': '1.875rem', // 30px
            '4xl': '2.25rem', // 36px
            '5xl': '3rem',    // 48px
            '6xl': '3.75rem'  // 60px
        },

        // Configuración específica para aprendizaje
        learning: {
            letterSpacing: '0.05em',      // Espaciado entre letras para claridad
            lineHeight: 1.6,              // Altura de línea para legibilidad
            fontWeight: {
                light: 300,
                normal: 400,
                medium: 500,
                semibold: 600,
                bold: 700
            }
        }
    },

    // === CONFIGURACIÓN DE JUEGO ===
    game: {
        // Tiempos y límites
        timers: {
            feedbackDuration: 2000,       // Tiempo que se muestra feedback (ms)
            transitionDelay: 500,         // Delay entre transiciones
            celebrationDuration: 4000,    // Duración de celebraciones especiales
            autoAdvanceDelay: 1500        // Delay antes de avanzar automáticamente
        },
        
        // Configuración de rachas
        streaks: {
            milestones: [5, 10, 15, 20],  // Hitos que activan celebraciones
            resetAfterUnicorn: true,      // Resetear racha después del nivel unicornio
            showProgressFeedback: true    // Mostrar feedback de progreso
        },
        
        // Configuración de modos
        modes: {
            easy: {
                allowMultipleAttempts: true,
                showProgressHints: true,
                listenCount: -1           // Pistas auditivas ilimitadas
            },
            hard: {
                allowMultipleAttempts: true,
                showProgressHints: false,
                listenCount: -1           // Pistas auditivas ilimitadas
            },
            free: {
                enablePronunciation: true,
                allowAnyWord: true,
                listenCount: -1           // Ilimitado en modo libre (-1 = sin límite)
            }
        },
        
        // Configuración de audio para pistas
        audioHints: {
            showRemainingCount: true,     // Mostrar contador restante en el botón
            disableWhenExhausted: true,   // Deshabilitar botón cuando se agoten
            resetOnNewWord: true,         // Resetear contador con cada nueva palabra
            playOnStart: false            // Reproducir automáticamente al mostrar palabra
        }
    },

    // === CONFIGURACIÓN DE ACCESIBILIDAD ===
    accessibility: {
        // Configuraciones para necesidades especiales
        reducedMotion: false,             // Reducir animaciones
        highContrast: false,              // Alto contraste
        largeText: false,                 // Texto más grande
        screenReader: false,              // Optimizado para lectores de pantalla
        
        // Configuración de focus y navegación
        focusVisible: true,               // Mostrar indicadores de focus
        keyboardNavigation: true,         // Navegación por teclado
        tapTargetSize: '44px'            // Tamaño mínimo de elementos táctiles
    },

    // === CONFIGURACIÓN DE DESARROLLO ===
    development: {
        debugMode: false,                 // Modo debug
        logLevel: 'error',               // 'debug', 'info', 'warn', 'error'
        showPerformanceMetrics: false,   // Mostrar métricas de rendimiento
        enableHotReload: false           // Recarga automática de configuración
    }
};

// Función para obtener configuración con valores por defecto
function getConfig(path, defaultValue = null) {
    const keys = path.split('.');
    let current = AppConfig;
    
    for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        } else {
            return defaultValue;
        }
    }
    
    return current;
}

// Función para actualizar configuración dinámicamente
function updateConfig(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let current = AppConfig;
    
    for (const key of keys) {
        if (!(key in current)) {
            current[key] = {};
        }
        current = current[key];
    }
    
    current[lastKey] = value;
    
    // Disparar evento de configuración actualizada
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('configUpdated', {
            detail: { path, value }
        }));
    }
}

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AppConfig, getConfig, updateConfig };
}

// Hacer disponible globalmente en el navegador
if (typeof window !== 'undefined') {
    window.AppConfig = AppConfig;
    window.getConfig = getConfig;
    window.updateConfig = updateConfig;
}