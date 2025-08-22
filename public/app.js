class PalabrasGame {
    constructor() {
        this.words = [];
        this.currentWords = [];
        this.currentQuestion = 0;
        this.score = 0;
        this.totalStars = 0;
        this.contadorRacha = 0;
        this.maxRacha = 0;
        this.gameMode = '';
        this.currentWord = null;
        this.usedWords = {
            facil: new Set(),
            dificil: new Set()
        };
        this.speechSynthesis = window.speechSynthesis;
        this.spanishVoice = null;
        this.listenCount = 3; // Se configurará dinámicamente por modo
        
        // Configuración centralizada
        this.config = window.AppConfig || {};
        this.loadConfig();
        
        // Optimización: LRU Cache para imágenes con límite
        this.preloadedImages = new Map();
        this.maxCachedImages = 20; // Límite de imágenes en cache
        
        // Cache para consultas DOM frecuentes
        this.domCache = new Map();
        
        // Control de TTS throttling
        this.ttsThrottle = null;
        this.ttsDelay = 100; // ms entre llamadas TTS
        
        // Memoización de configuración
        this.configCache = new Map();
        
        // Event listeners cleanup tracking
        this.eventListeners = [];
        
        // Sistema robusto de alineación responsiva
        this.resizeObserver = null;
        this.orientationChangeThrottle = null;
        this.alignmentCache = new Map();
        this.currentInputElement = null;
        
        this.audioFiles = {
            win: null,
            lose: null,
            shine: null,
            break: null,
            winStreak: null,
            applause: null,
            tap: null
        };
        
        // Configuración de personalización
        this.childName = 'Olivia';
        this.selectedVoice = null;
        this.voiceRate = 0.4; // Velocidad por defecto infantil
        this.voicePitch = 2.0; // Pitch alto por defecto para niños
        
        // 10 mensajes personalizados random que usarán el nombre dinámico
        this.randomMessages = [
            '¡{name} es genial! 🌟',
            '¡Qué lista eres! 🎯',
            '¡Sigue así campeona! 💪',
            '¡Eres increíble, {name}! ✨',
            '¡Muy bien, pequeña genio! 🧠',
            '¡Fantástico trabajo! 🎉',
            '¡{name}, eres la mejor! 👑',
            '¡Súper bien hecho! 🚀',
            '¡Qué inteligente eres! 💡',
            '¡Excelente, {name}! 🌈'
        ];
        
        this.initializeGame();
        
        // Cleanup automático al cerrar/recargar página
        window.addEventListener('beforeunload', () => this.cleanupAllListeners());
    }

    // Cargar configuración
    loadConfig() {
        // Escuchar cambios de configuración
        if (typeof window !== 'undefined') {
            window.addEventListener('configUpdated', (event) => {
                this.handleConfigUpdate(event.detail.path, event.detail.value);
            });
        }
        
    }

    // Manejar actualizaciones de configuración
    handleConfigUpdate(path, value) {
        console.log(`Configuración actualizada: ${path} = ${value}`);
        
        // Recargar configuraciones específicas según el path
        if (path.startsWith('voice.')) {
            this.setupVoices();
        } else if (path.startsWith('audio.')) {
            this.updateAudioVolumes();
        }
    }

    // Obtener valor de configuración con memoización
    getConfigValue(path, defaultValue = null) {
        // Cache hit - evita parsing repetitivo
        if (this.configCache.has(path)) {
            return this.configCache.get(path);
        }
        
        let result;
        if (typeof window.getConfig === 'function') {
            result = window.getConfig(path, defaultValue);
        } else {
            // Fallback manual si no está disponible la función
            const keys = path.split('.');
            let current = this.config;
            
            for (const key of keys) {
                if (current && typeof current === 'object' && key in current) {
                    current = current[key];
                } else {
                    result = defaultValue;
                    break;
                }
            }
            if (result === undefined) result = current;
        }
        
        // Cache result para futuras consultas
        this.configCache.set(path, result);
        return result;
    }


    // Función para normalizar acentos (león = leon)
    normalizeText(text) {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }

    // Función para obtener mensaje random personalizado
    getRandomMessage() {
        const randomIndex = Math.floor(Math.random() * this.randomMessages.length);
        const message = this.randomMessages[randomIndex];
        return this.personalizeMessage(message);
    }

    // Función para precargar imagen con LRU cache
    preloadImage(imageSrc) {
        if (this.preloadedImages.has(imageSrc)) {
            // Mover al final para LRU
            const img = this.preloadedImages.get(imageSrc);
            this.preloadedImages.delete(imageSrc);
            this.preloadedImages.set(imageSrc, img);
            return Promise.resolve();
        }
        
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                // Implementar LRU: eliminar la más antigua si excede límite
                if (this.preloadedImages.size >= this.maxCachedImages) {
                    const firstKey = this.preloadedImages.keys().next().value;
                    this.preloadedImages.delete(firstKey);
                }
                this.preloadedImages.set(imageSrc, img);
                resolve();
            };
            img.onerror = () => resolve(); // Continuar aunque falle la precarga
            img.src = imageSrc;
        });
    }

    async initializeGame() {
        try {
            // Verificar compatibilidad de almacenamiento
            this.storageCompatibility = this.checkStorageCompatibility();
            
            await this.loadWords();
            await this.loadPointsFromAPI();
            
            // Cargar configuración de personalización
            await this.loadPersonalizationSettings();
            
            // Configurar controles de voz
            this.setupVoiceControls();
            
            this.updateDisplays();
            this.setupVoices();
            this.setupEventListeners();
            this.loadAudioFiles();
            
            // Mostrar modal de configuración si es la primera vez
            this.checkFirstTimeSetup();
        } catch (error) {
            console.error('Error initializing game:', error);
            alert('Error al cargar el juego. Por favor, recarga la página.');
        }
    }

    setupVoices() {
        const setVoice = () => {
            const voices = this.speechSynthesis.getVoices();
            const preferredVoices = this.getConfigValue('voice.preferredVoices', [
                'es-ES-Female', 'Spanish (Spain)', 'Microsoft Helena', 'Google español'
            ]);
            
            // Primero: usar voz seleccionada por el usuario si existe
            let selectedVoice = null;
            if (this.selectedVoice) {
                selectedVoice = voices.find(voice => voice.name === this.selectedVoice);
            }
            
            // Segundo: buscar voz preferida por configuración
            if (!selectedVoice) {
                for (const preferred of preferredVoices) {
                    selectedVoice = voices.find(voice => 
                        voice.name.toLowerCase().includes(preferred.toLowerCase())
                    );
                    if (selectedVoice) break;
                }
            }
            
            // Tercero: fallback a cualquier voz en español
            if (!selectedVoice) {
                selectedVoice = voices.find(voice => 
                    voice.lang.includes('es') || 
                    voice.name.toLowerCase().includes('spanish') ||
                    voice.name.toLowerCase().includes('español')
                );
            }
            
            this.spanishVoice = selectedVoice || voices[0];
            
            // Debug: mostrar voz seleccionada
            if (this.spanishVoice) {
                console.log('Voz TTS seleccionada:', this.spanishVoice.name, 'Lang:', this.spanishVoice.lang);
            }
        };

        if (this.speechSynthesis.getVoices().length === 0) {
            this.speechSynthesis.addEventListener('voiceschanged', setVoice);
        } else {
            setVoice();
        }
    }

    // Lazy loading de audio files - solo cargar cuando se necesiten
    loadAudioFiles() {
        // Solo precargar audio crítico (shine y break para feedback inmediato)
        this.loadCriticalAudio();
    }

    loadCriticalAudio() {
        const criticalAudio = ['shine.mp3', 'break.mp3', 'tap.mp3'];
        
        criticalAudio.forEach(filename => {
            this.loadSingleAudio(filename).then(audio => {
                const key = filename.split('.')[0];
                this.audioFiles[key] = audio;
                if (key === 'shine') {
                    this.audioFiles.win = audio; // Mapeo para compatibilidad
                } else if (key === 'break') {
                    this.audioFiles.lose = audio; // Mapeo para compatibilidad
                } else if (key === 'tap') {
                    // tap.mp3 cargado para feedback táctil
                }
                this.updateAudioVolumes();
            });
        });
    }

    // Cargar audio individual con lazy loading
    loadSingleAudio(filename) {
        return new Promise((resolve) => {
            const audio = new Audio(`/sounds/${filename}`);
            audio.addEventListener('canplaythrough', () => resolve(audio));
            audio.addEventListener('error', () => resolve(null));
            // Optimización: preload metadata solamente
            audio.preload = 'metadata';
        });
    }

    // Lazy loading de audio no crítico cuando se necesite
    ensureAudioLoaded(audioKey) {
        if (this.audioFiles[audioKey]) {
            return Promise.resolve(this.audioFiles[audioKey]);
        }

        const audioMap = {
            winStreak: 'win.mp3',
            applause: 'applause.mp3'
        };

        const filename = audioMap[audioKey];
        if (!filename) return Promise.resolve(null);

        return this.loadSingleAudio(filename).then(audio => {
            this.audioFiles[audioKey] = audio;
            this.updateAudioVolumes();
            return audio;
        });
    }

    updateAudioVolumes() {
        const volumes = this.getConfigValue('audio.volumes', {
            effects: 0.8,
            voice: 1.0,
            applause: 0.9
        });

        if (this.audioFiles.win) this.audioFiles.win.volume = volumes.effects;
        if (this.audioFiles.lose) this.audioFiles.lose.volume = volumes.effects;
        if (this.audioFiles.shine) this.audioFiles.shine.volume = volumes.effects;
        if (this.audioFiles.break) this.audioFiles.break.volume = volumes.effects;
        if (this.audioFiles.tap) this.audioFiles.tap.volume = volumes.effects;
        if (this.audioFiles.winStreak) this.audioFiles.winStreak.volume = volumes.effects;
        if (this.audioFiles.applause) this.audioFiles.applause.volume = volumes.applause;
    }

    setupEventListeners() {
        const wordInput = this.getDOMElement('wordInput');
        const freeInput = this.getDOMElement('freeInput');

        if (wordInput) {
            const keydownHandler = (e) => this.handleKeyInput(e);
            const inputHandler = (e) => this.handleInputChange(e);
            
            wordInput.addEventListener('keydown', keydownHandler);
            wordInput.addEventListener('input', inputHandler);
            
            // Track listeners for cleanup
            this.eventListeners.push(
                { element: wordInput, event: 'keydown', handler: keydownHandler },
                { element: wordInput, event: 'input', handler: inputHandler }
            );
        }

        if (freeInput) {
            const freeKeyHandler = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.speakFreeInput();
                }
            };
            
            freeInput.addEventListener('keydown', freeKeyHandler);
            
            // Track listener for cleanup
            this.eventListeners.push(
                { element: freeInput, event: 'keydown', handler: freeKeyHandler }
            );
        }
    }

    async loadWords() {
        try {
            const response = await fetch('./words.json');
            const data = await response.json();
            this.words = data.words;
        } catch (error) {
            console.error('Error loading words:', error);
            throw error;
        }
    }

    async loadPointsFromAPI() {
        // Sistema híbrido: localStorage principal + cookies como respaldo
        try {
            let data = null;
            
            // Intentar cargar desde localStorage primero
            const localData = localStorage.getItem('olivia-points');
            if (localData) {
                data = JSON.parse(localData);
            } else {
                // Fallback a cookies si localStorage no está disponible
                data = this.loadFromCookies();
            }
            
            if (data) {
                this.totalStars = data.totalStars || 0;
                this.contadorRacha = data.currentStreak || 0;
                this.maxRacha = data.maxStreak || 0;
            } else {
                // Valores por defecto para nueva sesión
                this.totalStars = 0;
                this.contadorRacha = 0;
                this.maxRacha = 0;
            }
        } catch (error) {
            console.error('Error loading points:', error);
            // Valores por defecto en caso de error
            this.totalStars = 0;
            this.contadorRacha = 0;
            this.maxRacha = 0;
        }
    }

    async savePointsToAPI() {
        const pointsData = {
            totalStars: this.totalStars,
            currentStreak: this.contadorRacha,
            maxStreak: this.maxRacha
        };

        try {
            // Guardar en localStorage como principal
            localStorage.setItem('olivia-points', JSON.stringify(pointsData));
            
            // Guardar también en cookies como respaldo
            this.saveToCookies(pointsData);
        } catch (error) {
            console.error('Error saving points:', error);
            // Si localStorage falla, intentar solo cookies
            try {
                this.saveToCookies(pointsData);
            } catch (cookieError) {
                console.error('Error saving to cookies:', cookieError);
            }
        }
    }

    // Métodos para manejo de cookies como respaldo
    saveToCookies(data) {
        try {
            const cookieValue = JSON.stringify(data);
            // Expira en 1 año
            const expires = new Date();
            expires.setFullYear(expires.getFullYear() + 1);
            document.cookie = `olivia-points=${encodeURIComponent(cookieValue)}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
        } catch (error) {
            console.error('Error saving to cookies:', error);
        }
    }

    loadFromCookies() {
        try {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'olivia-points') {
                    return JSON.parse(decodeURIComponent(value));
                }
            }
            return null;
        } catch (error) {
            console.error('Error loading from cookies:', error);
            return null;
        }
    }

    // ===== FUNCIONES DE PERSONALIZACIÓN =====
    async loadPersonalizationSettings() {
        try {
            // Intentar cargar desde localStorage primero
            const localData = localStorage.getItem('olivia-personalization');
            let settings = null;
            
            if (localData) {
                settings = JSON.parse(localData);
            } else {
                // Fallback a cookies
                settings = this.loadPersonalizationFromCookies();
            }
            
            if (settings) {
                this.childName = settings.childName || 'Olivia';
                this.selectedVoice = settings.selectedVoice || null;
                this.voiceRate = settings.voiceRate || 0.4;
                this.voicePitch = settings.voicePitch || 2.0;
                // Actualizar títulos con el nombre cargado
                setTimeout(() => this.updateDynamicTitles(), 100);
            }
        } catch (error) {
            console.error('Error loading personalization:', error);
            // Usar valores por defecto
            this.childName = 'Olivia';
            this.selectedVoice = null;
        }
    }

    savePersonalizationSettings() {
        const settings = {
            childName: this.childName,
            selectedVoice: this.selectedVoice,
            voiceRate: this.voiceRate,
            voicePitch: this.voicePitch
        };
        
        try {
            // Guardar en localStorage
            localStorage.setItem('olivia-personalization', JSON.stringify(settings));
            
            // Guardar también en cookies como respaldo
            this.savePersonalizationToCookies(settings);
        } catch (error) {
            console.error('Error saving personalization:', error);
            // Si localStorage falla, intentar solo cookies
            try {
                this.savePersonalizationToCookies(settings);
            } catch (cookieError) {
                console.error('Error saving personalization to cookies:', cookieError);
            }
        }
    }

    savePersonalizationToCookies(settings) {
        try {
            const cookieValue = JSON.stringify(settings);
            const expires = new Date();
            expires.setFullYear(expires.getFullYear() + 1);
            document.cookie = `olivia-personalization=${encodeURIComponent(cookieValue)}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
        } catch (error) {
            console.error('Error saving personalization to cookies:', error);
        }
    }

    loadPersonalizationFromCookies() {
        try {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'olivia-personalization') {
                    return JSON.parse(decodeURIComponent(value));
                }
            }
            return null;
        } catch (error) {
            console.error('Error loading personalization from cookies:', error);
            return null;
        }
    }

    checkFirstTimeSetup() {
        // Verificar si existen datos de personalización
        const hasLocalData = localStorage.getItem('olivia-personalization');
        const hasCookieData = this.loadPersonalizationFromCookies();
        
        if (!hasLocalData && !hasCookieData) {
            // Primera vez, mostrar modal
            this.showSettingsModal();
        }
    }

    // Función para personalizar mensajes con el nombre del niño
    personalizeMessage(message) {
        return message.replace(/{name}/g, this.childName);
    }

    // Función para actualizar todos los títulos dinámicos
    updateDynamicTitles() {
        try {
            const pageTitle = document.getElementById('pageTitle');
            const mainTitle = document.getElementById('mainTitle');
            const resultsTitle = document.getElementById('resultsTitle');
            
            if (pageTitle) {
                pageTitle.textContent = this.personalizeMessage('¡Aprende con {name}! 🌟');
            }
            
            if (mainTitle) {
                mainTitle.textContent = this.personalizeMessage('¡Aprende con {name}! 🌟');
            }
            
            if (resultsTitle) {
                resultsTitle.textContent = this.personalizeMessage('¡Muy bien, {name}! 🎉');
            }
        } catch (error) {
            console.error('Error updating dynamic titles:', error);
        }
    }

    // ===== CONTROLES DE VOZ AVANZADOS =====
    setupVoiceControls() {
        // Configurar sliders de velocidad y pitch
        this.setupSlider('voiceRate', 'rateValue', (value) => {
            this.voiceRate = parseFloat(value);
            this.savePersonalizationSettings();
        });

        this.setupSlider('voicePitch', 'pitchValue', (value) => {
            this.voicePitch = parseFloat(value);
            this.savePersonalizationSettings();
        });

        // Configurar sliders del modal de ayuda
        this.setupSlider('helpVoiceRate', 'helpRateValue', (value) => {
            this.voiceRate = parseFloat(value);
            this.syncVoiceControlValues();
            this.savePersonalizationSettings();
        });

        this.setupSlider('helpVoicePitch', 'helpPitchValue', (value) => {
            this.voicePitch = parseFloat(value);
            this.syncVoiceControlValues();
            this.savePersonalizationSettings();
        });

        // Configurar botones de previsualización
        this.setupPreviewButton('previewVoiceBtn');
        this.setupPreviewButton('helpPreviewVoiceBtn');

        // Configurar clics en marcadores de slider
        this.setupSliderMarkers();
    }

    setupSlider(sliderId, valueId, onChange) {
        const slider = document.getElementById(sliderId);
        const valueSpan = document.getElementById(valueId);

        if (!slider || !valueSpan) return;

        // Establecer valor inicial
        slider.value = sliderId.includes('Rate') ? this.voiceRate : this.voicePitch;
        valueSpan.textContent = slider.value;

        // Event listener para cambios
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            valueSpan.textContent = value;
            
            // Animación de feedback
            slider.classList.add('updating');
            setTimeout(() => slider.classList.remove('updating'), 300);
            
            // Callback
            if (onChange) onChange(value);
        });

        // Previsualización automática al soltar el slider
        slider.addEventListener('change', () => {
            this.previewVoiceWithCurrentSettings();
        });
    }

    setupPreviewButton(buttonId) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        button.addEventListener('click', () => {
            this.previewVoiceWithCurrentSettings();
        });
    }

    setupSliderMarkers() {
        // Agregar event listeners a todos los marcadores de slider
        const markers = document.querySelectorAll('.marker');
        markers.forEach(marker => {
            marker.addEventListener('click', () => {
                const value = parseFloat(marker.dataset.value);
                const sliderContainer = marker.closest('.voice-control-group');
                const slider = sliderContainer?.querySelector('.voice-slider');
                
                if (slider) {
                    slider.value = value;
                    slider.dispatchEvent(new Event('input', { bubbles: true }));
                    slider.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    // Animación de marcador seleccionado
                    marker.style.transform = 'translateY(-2px) scale(1.1)';
                    setTimeout(() => {
                        marker.style.transform = '';
                    }, 200);
                }
            });
        });
    }

    syncVoiceControlValues() {
        // Sincronizar todos los controles de voz con los valores actuales
        const rateSlider = document.getElementById('voiceRate');
        const pitchSlider = document.getElementById('voicePitch');
        const helpRateSlider = document.getElementById('helpVoiceRate');
        const helpPitchSlider = document.getElementById('helpVoicePitch');
        
        const rateValue = document.getElementById('rateValue');
        const pitchValue = document.getElementById('pitchValue');
        const helpRateValue = document.getElementById('helpRateValue');
        const helpPitchValue = document.getElementById('helpPitchValue');

        // Actualizar sliders principales
        if (rateSlider && rateValue) {
            rateSlider.value = this.voiceRate;
            rateValue.textContent = this.voiceRate;
        }
        if (pitchSlider && pitchValue) {
            pitchSlider.value = this.voicePitch;
            pitchValue.textContent = this.voicePitch;
        }

        // Actualizar sliders del modal de ayuda
        if (helpRateSlider && helpRateValue) {
            helpRateSlider.value = this.voiceRate;
            helpRateValue.textContent = this.voiceRate;
        }
        if (helpPitchSlider && helpPitchValue) {
            helpPitchSlider.value = this.voicePitch;
            helpPitchValue.textContent = this.voicePitch;
        }
    }

    previewVoiceWithCurrentSettings() {
        const previewText = `¡Hola ${this.childName}! Esta es mi voz.`;
        console.log(`🎵 Previsualización: "${previewText}" - Rate: ${this.voiceRate}, Pitch: ${this.voicePitch}`);
        
        // Usar voz seleccionada si existe
        let selectedVoice = null;
        if (this.selectedVoice) {
            const voices = this.speechSynthesis.getVoices();
            selectedVoice = voices.find(voice => voice.name === this.selectedVoice);
        }
        
        this.speakWordWithCustomSettings(previewText, selectedVoice, this.voiceRate, this.voicePitch);
    }

    speakWordWithCustomSettings(text, voice = null, rate = null, pitch = null) {
        if (!this.speechSynthesis) return;

        // Cancelar cualquier síntesis anterior
        this.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Usar configuración personalizada o valores por defecto
        utterance.rate = rate !== null ? rate : this.voiceRate;
        utterance.pitch = pitch !== null ? pitch : this.voicePitch;
        utterance.volume = 1.0;
        utterance.lang = 'es-ES';
        
        // Usar voz especificada o la voz seleccionada
        if (voice) {
            utterance.voice = voice;
        } else if (this.spanishVoice) {
            utterance.voice = this.spanishVoice;
        }
        
        console.log(`🗣️ Hablando: "${text}" con rate=${utterance.rate}, pitch=${utterance.pitch}, voz=${utterance.voice?.name || 'default'}`);
        
        this.speechSynthesis.speak(utterance);
    }

    addVoicePreviewListener(voiceSelect, allVoices) {
        if (!voiceSelect) return;

        // Remover listener anterior si existe
        const existingListener = voiceSelect.onchange;
        if (existingListener) {
            voiceSelect.removeEventListener('change', existingListener);
        }

        const changeHandler = () => {
            const selectedVoiceName = voiceSelect.value;
            
            if (selectedVoiceName) {
                // Encontrar la voz seleccionada
                const selectedVoice = allVoices.find(voice => voice.name === selectedVoiceName);
                
                if (selectedVoice) {
                    console.log(`🔄 Voz cambiada a: ${selectedVoice.name} (${selectedVoice.lang})`);
                    
                    // Actualizar voz seleccionada
                    this.selectedVoice = selectedVoiceName;
                    
                    // Previsualizar con la nueva voz
                    const previewText = `¡Hola ${this.childName}! Soy ${selectedVoice.name.split(' ')[0] || 'tu asistente'}.`;
                    this.speakWordWithCustomSettings(previewText, selectedVoice, this.voiceRate, this.voicePitch);
                    
                    // Guardar configuración
                    this.savePersonalizationSettings();
                }
            } else {
                // Voz automática seleccionada
                console.log(`🤖 Voz automática seleccionada`);
                this.selectedVoice = null;
                this.previewVoiceWithCurrentSettings();
                this.savePersonalizationSettings();
            }
        };

        voiceSelect.addEventListener('change', changeHandler);
    }

    // ===== FUNCIONES DEL MODAL DE CONFIGURACIÓN =====
    showSettingsModal() {
        const modal = document.getElementById('settingsModal');
        const nameInput = document.getElementById('childName');
        const voiceSelect = document.getElementById('voiceSelect');
        
        // Prellenar con valores actuales
        nameInput.value = this.childName;
        
        // Cargar voces disponibles
        this.populateVoiceSelect();
        
        // Escuchar cambios de voces para recargar el selector
        if (this.speechSynthesis.getVoices().length === 0) {
            const onVoicesChanged = () => {
                this.populateVoiceSelect();
                this.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
            };
            this.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
        }
        
        // Sincronizar controles de voz
        this.syncVoiceControlValues();
        
        // Mostrar modal con animación
        modal.classList.add('show');
        
        // Focus en el input del nombre
        setTimeout(() => nameInput.focus(), 300);
    }

    hideSettingsModal() {
        const modal = document.getElementById('settingsModal');
        modal.classList.remove('show');
    }

    // ===== FUNCIONES DEL MODAL DE AYUDA =====
    showHelpModal() {
        const modal = document.getElementById('helpModal');
        
        // Prellenar configuraciones actuales
        const nameInput = document.getElementById('helpChildName');
        const voiceSelect = document.getElementById('helpVoiceSelect');
        
        nameInput.value = this.childName;
        
        // Cargar voces disponibles
        this.populateHelpVoiceSelect();
        
        // Actualizar estadísticas actuales
        this.updateHelpStats();
        
        // Sincronizar controles de voz
        this.syncVoiceControlValues();
        
        // Mostrar modal con animación
        modal.classList.add('show');
        
        // Asegurarse de que la pestaña de información esté activa
        this.showHelpTab('info');
    }

    hideHelpModal() {
        const modal = document.getElementById('helpModal');
        modal.classList.remove('show');
    }

    showHelpTab(tabName) {
        // Ocultar todas las pestañas y contenidos
        const tabs = document.querySelectorAll('.help-tab');
        const contents = document.querySelectorAll('.help-content');
        
        tabs.forEach(tab => tab.classList.remove('active'));
        contents.forEach(content => content.classList.remove('active'));
        
        // Mostrar la pestaña y contenido seleccionados
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        const activeContent = document.getElementById(`helpTab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
        
        if (activeTab && activeContent) {
            activeTab.classList.add('active');
            activeContent.classList.add('active');
        }
        
        // Si es la pestaña de configuración, cargar voces
        if (tabName === 'settings') {
            this.populateHelpVoiceSelect();
        }
    }

    populateHelpVoiceSelect() {
        const voiceSelect = document.getElementById('helpVoiceSelect');
        const voices = this.speechSynthesis.getVoices();
        
        // Limpiar opciones existentes
        voiceSelect.innerHTML = '';
        
        if (voices.length === 0) {
            voiceSelect.innerHTML = '<option value="">Cargando voces...</option>';
            setTimeout(() => {
                if (this.speechSynthesis.getVoices().length > 0) {
                    this.populateHelpVoiceSelect();
                } else {
                    voiceSelect.innerHTML = '<option value="">No hay voces disponibles</option>';
                }
            }, 500);
            return;
        }
        
        // Filtrar voces en español
        let spanishVoices = voices.filter(voice => 
            voice.lang.startsWith('es') || 
            voice.name.toLowerCase().includes('span') ||
            voice.name.toLowerCase().includes('helena') ||
            voice.name.toLowerCase().includes('spanish')
        );
        
        if (spanishVoices.length === 0) {
            spanishVoices = voices;
        }
        
        // Agregar opción por defecto
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Voz automática (recomendada)';
        voiceSelect.appendChild(defaultOption);
        
        // Agregar voces españolas disponibles
        spanishVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.voiceURI || voice.name;
            option.textContent = `${voice.name} (${voice.lang})`;
            
            // Marcar como seleccionada si es la voz actual
            if (this.selectedVoice && 
                (this.selectedVoice.voiceURI === voice.voiceURI || 
                 this.selectedVoice.name === voice.name)) {
                option.selected = true;
            }
            
            voiceSelect.appendChild(option);
        });
        
        // Agregar event listener para previsualización
        voiceSelect.addEventListener('change', () => {
            const selectedVoiceId = voiceSelect.value;
            if (selectedVoiceId) {
                const selectedVoice = voices.find(voice => 
                    voice.voiceURI === selectedVoiceId || voice.name === selectedVoiceId
                );
                if (selectedVoice) {
                    // Previsualizar la voz
                    this.speakWord('Hola, esta es mi voz', selectedVoice);
                }
            } else {
                // Usar voz por defecto
                this.speakWord('Hola, esta es la voz automática');
            }
        });
    }

    updateHelpStats() {
        const starCountElement = document.getElementById('helpStarCount');
        const maxStreakElement = document.getElementById('helpMaxStreak');
        
        if (starCountElement) {
            starCountElement.textContent = this.totalStars;
        }
        if (maxStreakElement) {
            maxStreakElement.textContent = this.maxRacha;
        }
    }

    confirmResetPoints() {
        // Mensaje personalizado con confirmación
        const confirmMessage = this.personalizeMessage('¿Estás segura de que quieres reiniciar todos los puntos de {name}?');
        
        if (confirm(confirmMessage)) {
            this.totalStars = 0;
            this.contadorRacha = 0;
            this.maxRacha = 0;
            this.updateDisplays();
            this.updateHelpStats();
            this.savePointsToAPI();
            
            // Cerrar modal de ayuda
            this.hideHelpModal();
            
            // Mensaje de confirmación con audio
            setTimeout(() => {
                this.speakWord('Puntos reiniciados. ¡A empezar de nuevo!');
            }, 500);
        }
    }

    // ===== DETECCIÓN AVANZADA DE VOCES REALES =====
    filterRealVoices(allVoices) {
        console.log('🔍 Analizando', allVoices.length, 'voces disponibles...');
        
        // Filtrar solo voces locales del sistema (más confiables)
        const localVoices = allVoices.filter(voice => {
            // localService true = voz real del sistema
            // localService false = voz sintética online/fake
            return voice.localService === true;
        });
        
        console.log('🏠 Voces locales encontradas:', localVoices.length);
        
        if (localVoices.length === 0) {
            console.log('⚠️ No hay voces locales, usando todas las disponibles');
            // Fallback: si no hay locales, usar todas pero con filtrado de duplicados
            return this.removeDuplicateVoices(allVoices);
        }
        
        // Filtrar voces españolas primero
        const spanishVoices = localVoices.filter(voice => {
            const isSpanish = voice.lang.startsWith('es') || 
                            voice.lang.startsWith('ES') ||
                            voice.name.toLowerCase().includes('span') ||
                            voice.name.toLowerCase().includes('español') ||
                            voice.name.toLowerCase().includes('helena') ||
                            voice.name.toLowerCase().includes('maria') ||
                            voice.name.toLowerCase().includes('paloma') ||
                            voice.name.toLowerCase().includes('jorge');
            
            console.log(`🗣️ ${voice.name} (${voice.lang}) - Español: ${isSpanish}, Local: ${voice.localService}`);
            return isSpanish;
        });
        
        console.log('🇪🇸 Voces españolas locales:', spanishVoices.length);
        
        if (spanishVoices.length > 0) {
            return this.removeDuplicateVoices(spanishVoices);
        } else {
            // Si no hay españolas locales, usar las mejores voces locales disponibles
            console.log('📢 No hay voces españolas locales, usando mejores voces locales');
            return this.removeDuplicateVoices(localVoices.slice(0, 8));
        }
    }
    
    removeDuplicateVoices(voices) {
        const uniqueVoices = [];
        const seenCombinations = new Set();
        
        voices.forEach(voice => {
            // Crear identificador único usando lang + nombre base (sin Microsoft/Google prefix)
            const baseName = voice.name
                .replace(/^(Microsoft |Google |Apple )/i, '')
                .replace(/\s+\(.*\)$/, '') // Remover (Enhanced) etc
                .trim();
            
            const uniqueId = `${voice.lang}-${baseName}`.toLowerCase();
            
            if (!seenCombinations.has(uniqueId)) {
                seenCombinations.add(uniqueId);
                uniqueVoices.push(voice);
                console.log(`✅ Voz única añadida: ${voice.name} (${voice.lang}) - ID: ${uniqueId}`);
            } else {
                console.log(`🔄 Voz duplicada ignorada: ${voice.name} (${voice.lang}) - ID: ${uniqueId}`);
            }
        });
        
        console.log('🎯 Total voces únicas:', uniqueVoices.length);
        return uniqueVoices;
    }
    
    createFriendlyVoiceName(voice) {
        let displayName = voice.name;
        let emoji = '🗣️'; // Default emoji
        
        // Detectar género y personalidad por nombre
        const nameLower = voice.name.toLowerCase();
        
        if (nameLower.includes('helena')) {
            emoji = '🎭';
            displayName = 'Helena (Española)';
        } else if (nameLower.includes('maria') || nameLower.includes('maría')) {
            emoji = '👩';
            displayName = 'María (Española)';
        } else if (nameLower.includes('paloma')) {
            emoji = '🕊️';
            displayName = 'Paloma (Española)';
        } else if (nameLower.includes('jorge')) {
            emoji = '👨';
            displayName = 'Jorge (Español)';
        } else if (nameLower.includes('carlos')) {
            emoji = '🧑';
            displayName = 'Carlos (Español)';
        } else if (nameLower.includes('microsoft')) {
            emoji = '🎤';
            displayName = voice.name.replace(/Microsoft /i, '').trim();
        } else if (nameLower.includes('google')) {
            emoji = '🤖';
            displayName = voice.name.replace(/Google /i, '').trim();
        } else if (nameLower.includes('apple') || nameLower.includes('siri')) {
            emoji = '🍎';
            displayName = voice.name.replace(/Apple /i, '').trim();
        } else {
            // Detectar género por idioma y características del nombre
            if (voice.lang.startsWith('es') && (nameLower.includes('female') || nameLower.includes('woman') || nameLower.includes('mujer'))) {
                emoji = '👩';
            } else if (voice.lang.startsWith('es') && (nameLower.includes('male') || nameLower.includes('man') || nameLower.includes('hombre'))) {
                emoji = '👨';
            }
        }
        
        return `${emoji} ${displayName}`;
    }

    populateVoiceSelect() {
        const voiceSelect = document.getElementById('voiceSelect');
        const voices = this.speechSynthesis.getVoices();
        
        // Limpiar opciones existentes
        voiceSelect.innerHTML = '';
        
        if (voices.length === 0) {
            voiceSelect.innerHTML = '<option value="">Cargando voces...</option>';
            // Intentar recargar voces después de un momento
            setTimeout(() => {
                if (this.speechSynthesis.getVoices().length > 0) {
                    this.populateVoiceSelect();
                } else {
                    voiceSelect.innerHTML = '<option value="">No hay voces disponibles</option>';
                }
            }, 500);
            return;
        }
        
        // Usar filtrado avanzado de voces reales
        const filteredVoices = this.filterRealVoices(voices);
        
        // Opción por defecto
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '🤖 Voz automática (recomendada)';
        voiceSelect.appendChild(defaultOption);
        
        // Agregar voces filtradas con nombres amigables
        filteredVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = this.createFriendlyVoiceName(voice);
            
            // Agregar información adicional como data attributes
            option.dataset.lang = voice.lang;
            option.dataset.localService = voice.localService;
            option.dataset.voiceURI = voice.voiceURI || '';
            
            voiceSelect.appendChild(option);
        });
        
        // Seleccionar voz actual si existe
        if (this.selectedVoice) {
            voiceSelect.value = this.selectedVoice;
        }
        
        // Agregar event listener para previsualización
        this.addVoicePreviewListener(voiceSelect, voices);
    }

    // Método para verificar compatibilidad de almacenamiento
    checkStorageCompatibility() {
        const compatibility = {
            localStorage: false,
            cookies: false,
            details: []
        };

        // Verificar localStorage
        try {
            const test = 'test-storage';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            compatibility.localStorage = true;
            compatibility.details.push('✅ localStorage disponible');
        } catch (error) {
            compatibility.details.push('❌ localStorage no disponible: ' + error.message);
        }

        // Verificar cookies
        try {
            document.cookie = 'test-cookie=test; path=/';
            if (document.cookie.indexOf('test-cookie=test') !== -1) {
                compatibility.cookies = true;
                compatibility.details.push('✅ Cookies disponibles');
                // Limpiar cookie de prueba
                document.cookie = 'test-cookie=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
            } else {
                compatibility.details.push('❌ Cookies bloqueadas');
            }
        } catch (error) {
            compatibility.details.push('❌ Cookies no disponibles: ' + error.message);
        }

        // Mostrar información en consola solo en modo debug
        if (this.getConfigValue('development.debugMode', false)) {
            console.log('🔧 Compatibilidad de almacenamiento:', compatibility);
        }

        return compatibility;
    }

    updateDisplays() {
        this.updateStarCounter();
        this.updateStreakCounter();
    }

    updateStarCounter() {
        const counterElement = document.getElementById('starCounter');
        if (counterElement) {
            counterElement.textContent = this.totalStars;
        }
    }

    updateStreakCounter() {
        const streakElement = document.getElementById('streakCounter');
        if (streakElement) {
            streakElement.textContent = this.contadorRacha;
        }
    }

    animateStarGain() {
        const starIcon = document.getElementById('starIcon');
        if (starIcon) {
            starIcon.classList.remove('star-animate');
            setTimeout(() => {
                starIcon.classList.add('star-animate');
                setTimeout(() => {
                    starIcon.classList.remove('star-animate');
                }, 1000);
            }, 10);
        }
    }

    animateCorrectWord() {
        const wordInput = document.getElementById('wordInput');
        if (wordInput) {
            wordInput.classList.remove('word-correct');
            setTimeout(() => {
                wordInput.classList.add('word-correct');
                setTimeout(() => {
                    wordInput.classList.remove('word-correct');
                }, 800);
            }, 10);
        }
    }

    animateIncorrectWord() {
        const wordInput = document.getElementById('wordInput');
        if (wordInput) {
            // Shake animation
            wordInput.classList.remove('input-error-shake');
            wordInput.classList.add('input-error-shake');
            
            // Red border animation
            wordInput.classList.remove('input-error-border');
            wordInput.classList.add('input-error-border');
            
            setTimeout(() => {
                wordInput.classList.remove('input-error-shake');
                wordInput.classList.remove('input-error-border');
            }, 1000);
        }
    }

    createFloatingStars() {
        const wordInput = this.getDOMElement('wordInput');
        if (!wordInput) return;

        // Límite de nodos DOM para evitar acumulación excesiva
        const existingStars = document.querySelectorAll('.floating-star');
        if (existingStars.length > 20) {
            // Limpiar estrellas más antiguas si hay demasiadas
            existingStars.forEach((star, index) => {
                if (index < existingStars.length - 15) {
                    star.remove();
                }
            });
        }

        const rect = wordInput.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Reducir número de estrellas en móviles para mejor rendimiento
        const isMobile = window.innerWidth < 768;
        const starCount = isMobile ? 4 : 6; // Reducido de 8 

        // Crear estrellitas flotantes optimizadas
        for (let i = 0; i < starCount; i++) {
            const star = document.createElement('div');
            star.textContent = '⭐';
            star.className = 'floating-star';
            
            // Posición aleatoria alrededor del input
            const angle = (i / starCount) * 2 * Math.PI;
            const radius = 50 + Math.random() * 30;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            star.style.left = x + 'px';
            star.style.top = y + 'px';
            star.style.animationDelay = (Math.random() * 0.5) + 's';
            
            // Usar requestAnimationFrame para mejor rendimiento
            requestAnimationFrame(() => {
                document.body.appendChild(star);
            });
            
            // Eliminar después de la animación con cleanup automático
            setTimeout(() => {
                if (star.parentNode) {
                    star.remove(); // Método más moderno que removeChild
                }
            }, 2500);
        }
    }

    fadeTransition(callback) {
        const questionContainer = document.getElementById('inputContainer');
        if (questionContainer) {
            questionContainer.classList.add('question-fade-out');
            
            setTimeout(() => {
                if (callback) callback();
                questionContainer.classList.remove('question-fade-out');
                questionContainer.classList.add('question-fade-in');
                
                setTimeout(() => {
                    questionContainer.classList.remove('question-fade-in');
                }, 300);
            }, 300);
        } else if (callback) {
            callback();
        }
    }

    async startGame(difficulty) {
        try {
            if (difficulty === 'libre') {
                this.showScreen('freePlayScreen');
                const freeInput = document.getElementById('freeInput');
                if (freeInput) {
                    freeInput.focus();
                }
                return;
            }

            this.gameMode = difficulty;
            
            // Filtrar palabras por dificultad y que no han sido usadas
            const wordsForDifficulty = this.words.filter(word => word.dificultad === difficulty);
            const availableWords = wordsForDifficulty.filter(word => !this.usedWords[difficulty].has(word.palabra));
            
            // Si no quedan palabras, mostrar pantalla de completado
            if (availableWords.length === 0) {
                this.showCompletionScreen(difficulty);
                return;
            }
            
            this.currentWords = this.shuffleArray([...availableWords]);
            this.currentQuestion = 0;
            this.score = 0;
            
            this.showScreen('gameScreen');
            this.updateProgress();
            this.showQuestion();
        } catch (error) {
            console.error('Error starting game:', error);
            alert('Error al iniciar el juego.');
        }
    }

    shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    showQuestion() {
        if (this.currentQuestion >= this.currentWords.length) {
            this.showResults();
            return;
        }

        this.currentWord = this.currentWords[this.currentQuestion];
        
        // Configurar cantidad de pistas auditivas según el modo
        const listenConfig = this.getConfigValue(`game.modes.${this.gameMode}.listenCount`, 3);
        this.listenCount = listenConfig;
        
        this.clearPreviousQuestion();
        this.displayQuestion();
        this.setupWordInput();
        this.updateListenButton();
        
        // Reproducir automáticamente si está configurado
        const playOnStart = this.getConfigValue('game.audioHints.playOnStart', false);
        if (playOnStart && this.currentWord) {
            setTimeout(() => {
                this.speakWord(this.currentWord.palabra);
            }, 500); // Pequeño delay para mejor UX
        }
        
        // Precargar la siguiente imagen si existe
        if (this.currentQuestion + 1 < this.currentWords.length) {
            const nextWord = this.currentWords[this.currentQuestion + 1];
            if (nextWord && nextWord.imagen && !nextWord.imagen.startsWith('color:')) {
                this.preloadImage(nextWord.imagen);
            }
        }
        
        setTimeout(() => {
            this.speakWord(this.currentWord.palabra);
        }, 500);
    }

    clearPreviousQuestion() {
        const nextBtn = document.getElementById('nextBtn');
        const feedbackMessage = document.getElementById('feedbackMessage');
        const wordInput = document.getElementById('wordInput');
        
        if (nextBtn) nextBtn.classList.add('hidden');
        if (feedbackMessage) {
            feedbackMessage.textContent = '';
            feedbackMessage.className = 'feedback-message';
        }
        if (wordInput) {
            wordInput.value = '';
            wordInput.disabled = false;
            
            // Resetear completamente la alineación al cambiar de pregunta
            this.resetInputAlignment(wordInput);
        }
        
        // Limpiar letras táctiles de la pregunta anterior
        const touchLetters = document.querySelectorAll('.touch-letter');
        touchLetters.forEach(letter => {
            letter.classList.remove('used', 'adding');
        });
        
        // Limpiar cache de alineación para la nueva pregunta
        this.alignmentCache.clear();
    }

    displayQuestion() {
        const questionText = document.getElementById('questionText');
        const questionImage = document.getElementById('questionImage');
        
        if (questionText) {
            questionText.textContent = 'Escucha y escribe la palabra:';
        }

        if (questionImage && this.currentWord) {
            if (this.currentWord.imagen.startsWith('color:')) {
                const color = this.currentWord.imagen.replace('color:', '');
                questionImage.innerHTML = `
                    <div class="color-display" style="background-color: ${color};"></div>
                `;
            } else {
                questionImage.innerHTML = `
                    <img src="${this.currentWord.imagen}" alt="${this.currentWord.palabra}" />
                `;
            }
        }
    }

    setupWordInput() {
        const wordInput = document.getElementById('wordInput');
        const hintText = document.getElementById('hintText');
        
        if (!wordInput || !this.currentWord) return;

        const palabra = this.currentWord.palabra.toLowerCase();
        wordInput.maxLength = palabra.length;
        wordInput.value = '';
        
        // Configurar pistas
        if (hintText) {
            hintText.textContent = palabra.toUpperCase();
            hintText.style.display = 'block';
            
            // Usar opacidad fija de 0.6 para ambos modos
            hintText.style.opacity = '0.6';
        }
        
        // Configurar input para que el texto empiece alineado con las pistas
        this.setupInputAlignment(wordInput, palabra);
        
        // Limpiar listeners anteriores usando tracking system
        this.cleanupWordInputListeners();
        
        // Agregar nuevo listener para reajustar mientras se escribe
        const alignmentHandler = () => this.adjustInputAlignment();
        wordInput.addEventListener('input', alignmentHandler);
        
        // Track listener para cleanup posterior
        this.eventListeners.push({
            element: wordInput,
            event: 'input',
            handler: alignmentHandler,
            temp: true // Marcador para listeners temporales
        });

        // Configurar letras táctiles para dispositivos sin teclado físico
        this.setupTouchLetters(palabra);

        wordInput.focus();
        
        // Inicializar estado del botón de envío
        this.updateSubmitButton();
    }

    setupInputAlignment(input, palabra) {
        // Almacenar referencia al input actual para recálculos
        this.currentInputElement = input;
        
        // Configurar observador de cambios de tamaño
        this.setupResizeObserver(input);
        
        // Configurar listener para cambios de orientación
        this.setupOrientationListener();
        
        // Realizar alineación inicial
        this.performInputAlignment(input, palabra);
    }
    
    performInputAlignment(input, palabra) {
        if (!input || !palabra) return;
        
        // Cache key basado en palabra y dimensiones actuales
        const viewport = `${window.innerWidth}x${window.innerHeight}`;
        const cacheKey = `${palabra}_${viewport}_${input.getBoundingClientRect().width}`;
        
        // Verificar cache para evitar cálculos redundantes
        if (this.alignmentCache.has(cacheKey)) {
            const cachedPadding = this.alignmentCache.get(cacheKey);
            input.style.paddingLeft = cachedPadding;
            return;
        }
        
        // Resetear completamente los estilos de alineación
        this.resetInputAlignment(input);
        
        // Crear elemento temporal para medir el ancho del texto completo de la pista
        const tempSpan = document.createElement('span');
        tempSpan.style.cssText = `
            visibility: hidden;
            position: absolute;
            top: -9999px;
            white-space: nowrap;
            font-family: ${getComputedStyle(input).fontFamily};
            font-size: ${getComputedStyle(input).fontSize};
            font-weight: ${getComputedStyle(input).fontWeight};
            letter-spacing: ${getComputedStyle(input).letterSpacing};
        `;
        tempSpan.textContent = palabra.toUpperCase();
        
        document.body.appendChild(tempSpan);
        const fullTextWidth = tempSpan.getBoundingClientRect().width;
        document.body.removeChild(tempSpan);
        
        // Obtener dimensiones actuales del input
        const inputRect = input.getBoundingClientRect();
        const computedStyle = getComputedStyle(input);
        const originalPaddingLeft = parseFloat(computedStyle.paddingLeft);
        const paddingRight = parseFloat(computedStyle.paddingRight);
        const borderLeft = parseFloat(computedStyle.borderLeftWidth);
        const borderRight = parseFloat(computedStyle.borderRightWidth);
        
        // Calcular espacio disponible real
        const totalUsedSpace = originalPaddingLeft + paddingRight + borderLeft + borderRight;
        const availableWidth = inputRect.width - totalUsedSpace;
        
        // Calcular posición de inicio centrada
        const startPosition = Math.max(
            (availableWidth - fullTextWidth) / 2,
            0 // Nunca usar padding negativo
        );
        
        // Calcular padding final con límites
        const finalPaddingLeft = Math.max(
            startPosition + originalPaddingLeft,
            originalPaddingLeft, // Mínimo: padding original
            24 // Mínimo absoluto: 24px
        );
        
        // Aplicar el padding calculado
        input.style.paddingLeft = finalPaddingLeft + 'px';
        input.style.textAlign = 'left';
        
        // Guardar en cache para futuras optimizaciones
        this.alignmentCache.set(cacheKey, finalPaddingLeft + 'px');
        
        // Limpiar cache si crece mucho (LRU simple)
        if (this.alignmentCache.size > 20) {
            const firstKey = this.alignmentCache.keys().next().value;
            this.alignmentCache.delete(firstKey);
        }
    }
    
    resetInputAlignment(input) {
        // Resetear completamente los estilos de alineación
        input.style.paddingLeft = '';
        input.style.textAlign = '';
        
        // Forzar recálculo de layout
        input.offsetHeight; // Trigger reflow
    }

    adjustInputAlignment() {
        // Recalcular alineación con la palabra actual si está disponible
        if (this.currentInputElement && this.currentWord) {
            this.performInputAlignment(this.currentInputElement, this.currentWord.palabra);
        }
    }
    
    setupResizeObserver(input) {
        // Limpiar observador anterior si existe
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        // Crear nuevo ResizeObserver para detectar cambios de tamaño
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver((entries) => {
                // Throttle para evitar demasiados recálculos
                if (this.resizeThrottle) {
                    clearTimeout(this.resizeThrottle);
                }
                
                this.resizeThrottle = setTimeout(() => {
                    // Solo recalcular si el input aún existe y es visible
                    if (input && input.offsetParent && this.currentWord) {
                        this.performInputAlignment(input, this.currentWord.palabra);
                    }
                }, 100); // 100ms throttle para performance
            });
            
            // Observar el input y su contenedor padre
            this.resizeObserver.observe(input);
            const container = input.closest('.input-container');
            if (container) {
                this.resizeObserver.observe(container);
            }
        } else {
            // Fallback para navegadores sin ResizeObserver
            this.setupFallbackResizeListener();
        }
    }
    
    setupFallbackResizeListener() {
        // Fallback usando window.resize para navegadores antiguos
        const resizeHandler = () => {
            if (this.resizeThrottle) {
                clearTimeout(this.resizeThrottle);
            }
            
            this.resizeThrottle = setTimeout(() => {
                if (this.currentInputElement && this.currentWord) {
                    this.performInputAlignment(this.currentInputElement, this.currentWord.palabra);
                }
            }, 150); // Throttle más alto para window.resize
        };
        
        window.addEventListener('resize', resizeHandler);
        
        // Track para cleanup
        this.eventListeners.push({
            element: window,
            event: 'resize',
            handler: resizeHandler,
            temp: false
        });
    }
    
    setupOrientationListener() {
        // Listener para cambios de orientación en dispositivos móviles
        const orientationHandler = () => {
            // Delay más largo para cambios de orientación
            // ya que el layout tarda más en estabilizarse
            if (this.orientationChangeThrottle) {
                clearTimeout(this.orientationChangeThrottle);
            }
            
            this.orientationChangeThrottle = setTimeout(() => {
                // Limpiar cache al cambiar orientación
                this.alignmentCache.clear();
                
                if (this.currentInputElement && this.currentWord) {
                    this.performInputAlignment(this.currentInputElement, this.currentWord.palabra);
                }
            }, 300); // 300ms para que el layout se estabilice
        };
        
        // Múltiples eventos para máxima compatibilidad
        const orientationEvents = ['orientationchange', 'resize'];
        
        orientationEvents.forEach(eventType => {
            window.addEventListener(eventType, orientationHandler);
            
            this.eventListeners.push({
                element: window,
                event: eventType,
                handler: orientationHandler,
                temp: false
            });
        });
        
        // Listener adicional para cambios de viewport en dispositivos móviles
        if ('visualViewport' in window) {
            const viewportHandler = () => {
                if (this.orientationChangeThrottle) {
                    clearTimeout(this.orientationChangeThrottle);
                }
                
                this.orientationChangeThrottle = setTimeout(() => {
                    if (this.currentInputElement && this.currentWord) {
                        this.performInputAlignment(this.currentInputElement, this.currentWord.palabra);
                    }
                }, 150);
            };
            
            window.visualViewport.addEventListener('resize', viewportHandler);
            
            this.eventListeners.push({
                element: window.visualViewport,
                event: 'resize',
                handler: viewportHandler,
                temp: false
            });
        }
    }

    handleKeyInput(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.validateAnswer();
        } else if (event.key === 'Backspace' || event.key === 'Delete') {
            // Sincronizar con letras táctiles cuando se borra con teclado físico
            setTimeout(() => {
                this.syncTouchLettersWithInput();
            }, 10);
        }
    }

    handleInputChange(event) {
        const input = event.target;
        input.value = input.value.toLowerCase().replace(/[^a-záéíóúñü]/g, '');
        
        // Sincronizar letras táctiles con el input cuando se escribe con teclado físico
        this.syncTouchLettersWithInput();
        
        // Actualizar estado del botón de envío
        this.updateSubmitButton();
    }
    
    updateSubmitButton() {
        const submitBtn = document.getElementById('submitBtn');
        const wordInput = document.getElementById('wordInput');
        
        if (!submitBtn || !wordInput || !this.currentWord) return;
        
        const currentLength = wordInput.value.length;
        const targetLength = this.currentWord.palabra.length;
        
        if (currentLength === targetLength && currentLength > 0) {
            submitBtn.classList.remove('disabled');
        } else {
            submitBtn.classList.add('disabled');
        }
    }

    validateAnswer() {
        const wordInput = document.getElementById('wordInput');
        const submitBtn = document.getElementById('submitBtn');
        if (!wordInput || !this.currentWord) return;

        const userAnswer = this.normalizeText(wordInput.value);
        const correctAnswer = this.normalizeText(this.currentWord.palabra);

        wordInput.disabled = true;
        // Deshabilitar el botón de envío durante la validación
        if (submitBtn) {
            submitBtn.classList.add('disabled');
        }

        if (userAnswer === correctAnswer) {
            this.handleCorrectAnswer();
        } else {
            this.handleIncorrectAnswer();
        }
    }

    handleCorrectAnswer() {
        this.score++;
        this.totalStars++;
        this.contadorRacha++;
        
        // Actualizar racha máxima
        if (this.contadorRacha > this.maxRacha) {
            this.maxRacha = this.contadorRacha;
        }
        
        // Animaciones de celebración
        this.animateCorrectWord();
        this.createFloatingStars();
        this.animateStarGain();
        
        // Verificar hitos de racha
        this.checkStreakMilestones();
        
        // Mostrar feedback con mensaje random
        const randomMessage = this.getRandomMessage();
        this.showFeedback(true, randomMessage);
        this.playShineSound();
        
        // Actualizar displays y guardar
        this.updateDisplays();
        this.savePointsToAPI();
        
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) {
            setTimeout(() => {
                nextBtn.classList.remove('hidden');
            }, 1000);
        }
    }

    handleIncorrectAnswer() {
        // Resetear racha
        this.contadorRacha = 0;
        
        // Animaciones de error
        this.animateIncorrectWord();
        
        this.showFeedback(false, 'Inténtalo otra vez 💜');
        this.playBreakSound();
        
        // Actualizar displays y guardar
        this.updateDisplays();
        this.savePointsToAPI();
        
        setTimeout(() => {
            const wordInput = document.getElementById('wordInput');
            if (wordInput) {
                wordInput.disabled = false;
                wordInput.value = '';
                wordInput.focus();
            }
            // Rehabilitar y actualizar el botón de envío
            this.updateSubmitButton();
            this.clearFeedback();
        }, 2000);
    }

    checkStreakMilestones() {
        if (this.contadorRacha === 5) {
            setTimeout(() => {
                this.showStreakMessage(this.personalizeMessage('¡Súper {name}! 5 seguidos! 🌈'));
                this.playWinStreakSound();
                this.speakWord(this.personalizeMessage('¡Súper {name}! 5 seguidos!'));
            }, 1500);
        } else if (this.contadorRacha === 10) {
            setTimeout(() => {
                this.showStreakMessage('¡INCREÍBLE OLIVIA! ¡10 PERFECTOS! 🎊🦄✨');
                this.playWinStreakSound();
                this.speakWord(this.personalizeMessage('¡Increíble {name}! 10 perfectos!'));
                this.showConfetti();
            }, 1500);
        } else if (this.contadorRacha === 15) {
            setTimeout(() => {
                this.showStreakMessage('¡ESPECTACULAR OLIVIA! ¡15 SEGUIDOS! 🌟⚡🎆');
                this.playWinStreakSound();
                this.speakWord(this.personalizeMessage('¡Espectacular {name}! 15 seguidos!'));
                this.showConfetti();
            }, 1500);
        } else if (this.contadorRacha === 20) {
            setTimeout(() => {
                this.showStreakMessage('🦄 ¡NIVEL UNICORNIO! ¡20 PERFECTOS! 🦄✨🌈');
                this.playApplauseSound();
                this.speakWord('¡Nivel unicornio! 20 perfectos!');
                this.showConfetti();
                // Reiniciar racha tras nivel unicornio
                setTimeout(() => {
                    this.contadorRacha = 0;
                    this.updateDisplays();
                    this.savePointsToAPI();
                }, 4000);
            }, 1500);
        }
    }

    showStreakMessage(message) {
        const feedbackMessage = document.getElementById('feedbackMessage');
        if (feedbackMessage) {
            const originalContent = feedbackMessage.textContent;
            const originalClass = feedbackMessage.className;
            
            feedbackMessage.textContent = message;
            feedbackMessage.className = 'feedback-message feedback-success';
            
            setTimeout(() => {
                feedbackMessage.textContent = originalContent;
                feedbackMessage.className = originalClass;
            }, 3000);
        }
    }

    showConfetti() {
        const container = document.getElementById('confetti-container');
        if (!container) return;
        
        // Limpiar confetti anterior
        container.innerHTML = '';
        
        // Crear 100 piezas de confetti
        for (let i = 0; i < 100; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.animationDelay = Math.random() * 3 + 's';
            confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
            container.appendChild(confetti);
        }
        
        // Limpiar después de 6 segundos
        setTimeout(() => {
            container.innerHTML = '';
        }, 6000);
    }

    updateListenButton() {
        const listenBtn = document.getElementById('listenBtn');
        const listenCountSpan = document.getElementById('listenCount');
        
        if (listenBtn && listenCountSpan) {
            // El botón escuchar ahora es siempre ilimitado
            listenCountSpan.textContent = '∞';
            listenBtn.disabled = false;
        }
    }

    listenToWord() {
        if (this.currentWord) {
            // El botón escuchar ahora es siempre ilimitado
            // No decrementamos listenCount nunca
            
            this.updateListenButton();
            this.speakWord(this.currentWord.palabra);
        }
    }

    playWinSound() {
        if (this.audioFiles.win) {
            this.audioFiles.win.currentTime = 0;
            this.audioFiles.win.play().catch(() => {
                this.speakWord('¡Muy bien!');
            });
        } else {
            this.speakWord('¡Muy bien!');
        }
    }

    playLoseSound() {
        if (this.audioFiles.lose) {
            this.audioFiles.lose.currentTime = 0;
            this.audioFiles.lose.play().catch(() => {
                this.speakWord('Inténtalo otra vez');
            });
        } else {
            this.speakWord('Inténtalo otra vez');
        }
    }

    playShineSound() {
        if (this.audioFiles.shine) {
            this.audioFiles.shine.currentTime = 0;
            this.audioFiles.shine.play().catch(() => {
                console.log('Error playing shine sound');
            });
        }
    }

    playBreakSound() {
        if (this.audioFiles.break) {
            this.audioFiles.break.currentTime = 0;
            this.audioFiles.break.play().catch(() => {
                console.log('Error playing break sound');
            });
        }
    }

    playWinStreakSound() {
        this.ensureAudioLoaded('winStreak').then(audio => {
            if (audio) {
                audio.currentTime = 0;
                audio.play().catch(() => {
                    console.log('Error playing win streak sound');
                });
            }
        });
    }

    playApplauseSound() {
        this.ensureAudioLoaded('applause').then(audio => {
            if (audio) {
                audio.currentTime = 0;
                audio.play().catch(() => {
                    console.log('Error playing applause sound');
                });
            }
        });
    }

    showFeedback(isCorrect, message) {
        const feedbackMessage = document.getElementById('feedbackMessage');
        if (!feedbackMessage) return;

        feedbackMessage.textContent = message;
        feedbackMessage.className = `feedback-message ${isCorrect ? 'feedback-success' : 'feedback-error'}`;
    }

    clearFeedback() {
        const feedbackMessage = document.getElementById('feedbackMessage');
        if (feedbackMessage) {
            feedbackMessage.textContent = '';
            feedbackMessage.className = 'feedback-message';
        }
        
        const wordInput = document.getElementById('wordInput');
        if (wordInput) {
            wordInput.value = '';
            wordInput.disabled = false;
        }
        
        // Actualizar estado del botón después de limpiar
        this.updateSubmitButton();
    }

    speakWord(text, customVoice = null) {
        if (!this.speechSynthesis) return;

        // Cancelar inmediatamente cualquier audio TTS anterior para evitar superposición
        this.speechSynthesis.cancel();
        
        // Throttling TTS para evitar múltiples llamadas rápidas
        if (this.ttsThrottle) {
            clearTimeout(this.ttsThrottle);
        }
        
        this.ttsThrottle = setTimeout(() => {
            // Doble cancelación para máxima seguridad contra superposición
            this.speechSynthesis.cancel();
            
            // Configuración de voz personalizada o por defecto
            const voiceConfig = this.getConfigValue('voice', {
                language: 'es-ES',
                addExclamations: true
            });
            
            // Añadir exclamaciones si está habilitado
            let expressiveText = text;
            if (voiceConfig.addExclamations && !text.includes('¡') && !text.includes('!')) {
                expressiveText = `¡${text}!`;
            }
            
            const utterance = new SpeechSynthesisUtterance(expressiveText);
            utterance.lang = voiceConfig.language;
            
            // Usar configuración personalizada del usuario
            utterance.rate = this.voiceRate || 0.4;
            utterance.pitch = this.voicePitch || 2.0;
            utterance.volume = this.getConfigValue('audio.volumes.voice', 1.0);
            
            // Usar voz personalizada si se proporciona, o la voz española por defecto
            if (customVoice) {
                utterance.voice = customVoice;
            } else if (this.spanishVoice) {
                utterance.voice = this.spanishVoice;
            }
            
            this.speechSynthesis.speak(utterance);
            this.ttsThrottle = null;
        }, this.ttsDelay);
    }

    speakCurrentWord() {
        if (this.currentWord) {
            this.speakWord(this.currentWord.palabra);
        }
    }

    speakFreeInput() {
        const freeInput = document.getElementById('freeInput');
        if (freeInput && freeInput.value.trim()) {
            const text = freeInput.value.trim();
            this.speakWord(text);
            freeInput.value = '';
            freeInput.focus();
        }
    }

    nextQuestion() {
        this.currentQuestion++;
        this.updateProgress();
        
        // Usar fade transition entre preguntas
        this.fadeTransition(() => {
            this.showQuestion();
        });
    }

    updateProgress() {
        // Actualizar progreso en el header
        const remainingElementHeader = document.getElementById('remainingWordsHeader');
        
        if (remainingElementHeader) {
            const remaining = this.currentWords.length - this.currentQuestion;
            remainingElementHeader.textContent = remaining > 0 ? `Quedan ${remaining} palabras` : 'Última palabra';
        }
    }

    showResults() {
        // Agregar palabras completadas a la lista de usadas
        if (this.gameMode === 'facil' || this.gameMode === 'dificil') {
            this.currentWords.forEach(word => {
                this.usedWords[this.gameMode].add(word.palabra);
            });
        }
        
        const starsEarned = this.score;
        const totalQuestions = this.currentWords.length;
        
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('starsEarned').textContent = starsEarned;
        
        // Actualizar el total dinámico en la pantalla de resultados
        const scoreTotalElement = document.getElementById('scoreTotalDynamic');
        if (scoreTotalElement) {
            scoreTotalElement.textContent = `/ ${totalQuestions}`;
        }
        
        // Easter egg: 20/20 perfectas = pantalla especial de unicornio violeta
        if (this.score === totalQuestions && totalQuestions === 20) {
            this.showUnicornEasterEgg();
            return;
        }
        
        this.showScreen('resultsScreen');
        
        setTimeout(() => {
            if (this.score >= totalQuestions * 0.8) {
                this.speakWord(this.personalizeMessage('¡Excelente trabajo, {name}!'));
            } else if (this.score >= totalQuestions * 0.6) {
                this.speakWord(this.personalizeMessage('¡Muy bien, {name}!'));
            } else {
                this.speakWord(this.personalizeMessage('¡Sigue practicando, {name}!'));
            }
        }, 500);
    }

    showUnicornEasterEgg() {
        // Crear pantalla de unicornio
        const unicornScreen = document.createElement('div');
        unicornScreen.className = 'unicorn-screen';
        unicornScreen.innerHTML = `
            <div class="unicorn-content">
                <div class="unicorn-emoji">🦄</div>
                <h1 class="unicorn-title">¡OLIVIA ES PERFECTA!</h1>
                <p class="unicorn-message">🌟 ¡20 de 20! ¡Eres una súper estrella! 🌟</p>
                <button class="unicorn-close-btn" onclick="this.parentElement.parentElement.remove(); game.showScreen('resultsScreen');">
                    ¡Continuar siendo genial! ✨
                </button>
            </div>
        `;
        
        document.body.appendChild(unicornScreen);
        
        // Reproducir mensaje especial
        setTimeout(() => {
            this.speakWord(this.personalizeMessage('¡{name} es perfecta! ¡Veinte de veinte! ¡Eres una súper estrella!'));
        }, 1000);
        
        // Mostrar confetti
        this.showConfetti();
    }

    showCompletionScreen(difficulty) {
        // Crear pantalla de completado
        const completionScreen = document.createElement('div');
        completionScreen.className = 'completion-screen';
        const difficultyText = difficulty === 'facil' ? 'FÁCIL' : 'DIFÍCIL';
        completionScreen.innerHTML = `
            <div class="completion-content">
                <div class="completion-emoji">🎉</div>
                <h1 class="completion-title">¡FELICIDADES OLIVIA!</h1>
                <p class="completion-message">🌟 ¡Has completado TODAS las palabras del modo ${difficultyText}! 🌟</p>
                <div class="completion-buttons">
                    <button class="completion-restart-btn" onclick="game.resetMode('${difficulty}'); this.parentElement.parentElement.parentElement.remove();">
                        🔄 Volver a empezar
                    </button>
                    <button class="completion-menu-btn" onclick="this.parentElement.parentElement.parentElement.remove(); game.showScreen('startScreen');">
                        🏠 Menú principal
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(completionScreen);
        
        // Reproducir sonido de applause y mensaje
        this.playApplauseSound();
        setTimeout(() => {
            this.speakWord(this.personalizeMessage(`¡Felicidades {name}! Has completado todas las palabras del modo ${difficultyText}!`));
        }, 1000);
        
        // Mostrar confetti
        this.showConfetti();
    }

    resetMode(difficulty) {
        // Resetear palabras usadas del modo
        this.usedWords[difficulty].clear();
        // Reiniciar el juego en ese modo
        this.startGame(difficulty);
    }

    // Función para resetear puntos
    resetPoints() {
        if (confirm(this.personalizeMessage('¿Estás segura de que quieres reiniciar todos los puntos de {name}?'))) {
            this.totalStars = 0;
            this.contadorRacha = 0;
            this.maxRacha = 0;
            this.updateDisplays();
            this.savePointsToAPI();
            
            // Mensaje de confirmación
            setTimeout(() => {
                this.speakWord('Puntos reiniciados');
            }, 500);
        }
    }

    // Método para obtener elementos DOM con cache
    getDOMElement(id) {
        if (this.domCache.has(id)) {
            return this.domCache.get(id);
        }
        const element = document.getElementById(id);
        if (element) {
            this.domCache.set(id, element);
        }
        return element;
    }

    // Cleanup de listeners temporales de word input
    cleanupWordInputListeners() {
        this.eventListeners = this.eventListeners.filter(listener => {
            if (listener.temp && listener.element.id === 'wordInput') {
                listener.element.removeEventListener(listener.event, listener.handler);
                return false; // Remover del array
            }
            return true; // Mantener en el array
        });
    }

    // Cleanup general de todos los event listeners
    cleanupAllListeners() {
        this.eventListeners.forEach(listener => {
            if (listener.element && listener.element.removeEventListener) {
                listener.element.removeEventListener(listener.event, listener.handler);
            }
        });
        this.eventListeners = [];
        
        // Cleanup específico para alineación
        this.cleanupAlignmentResources();
    }
    
    cleanupAlignmentResources() {
        // Cleanup del ResizeObserver
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        
        // Cleanup de throttles
        if (this.resizeThrottle) {
            clearTimeout(this.resizeThrottle);
            this.resizeThrottle = null;
        }
        
        if (this.orientationChangeThrottle) {
            clearTimeout(this.orientationChangeThrottle);
            this.orientationChangeThrottle = null;
        }
        
        // Limpiar referencias
        this.currentInputElement = null;
        this.alignmentCache.clear();
    }

    showScreen(screenId) {
        const screens = ['startScreen', 'gameScreen', 'freePlayScreen', 'resultsScreen'];
        screens.forEach(screen => {
            const element = this.getDOMElement(screen); // Usar cache DOM
            if (element) {
                if (screen === screenId) {
                    element.classList.remove('hidden');
                } else {
                    element.classList.add('hidden');
                }
            }
        });
        
        // Mostrar/ocultar letras táctiles según la pantalla
        const touchLettersContainer = document.getElementById('touchLettersContainer');
        if (touchLettersContainer) {
            if (screenId === 'gameScreen') {
                touchLettersContainer.style.display = 'block';
            } else {
                touchLettersContainer.style.display = 'none';
                
                // Cleanup de recursos de alineación al salir del juego
                if (screenId !== 'gameScreen') {
                    this.cleanupAlignmentResources();
                }
            }
        }
        
        // Mostrar/ocultar elementos del header según la pantalla
        this.updateHeaderVisibility(screenId);
        
        // Recalcular alineación cuando se muestra la pantalla del juego
        if (screenId === 'gameScreen') {
            // Delay pequeño para que el layout se estabilice
            setTimeout(() => {
                if (this.currentInputElement && this.currentWord) {
                    this.performInputAlignment(this.currentInputElement, this.currentWord.palabra);
                }
            }, 100);
        }
    }
    
    updateHeaderVisibility(screenId) {
        const backBtn = document.getElementById('backBtnHeader');
        const progress = document.getElementById('progressHeader');
        
        if (screenId === 'gameScreen') {
            // Mostrar botón atrás y progreso en el juego
            if (backBtn) backBtn.classList.remove('hidden');
            if (progress) progress.classList.remove('hidden');
        } else {
            // Ocultar en otras pantallas
            if (backBtn) backBtn.classList.add('hidden');
            if (progress) progress.classList.add('hidden');
        }
    }

    goBack() {
        this.showScreen('startScreen');
        this.currentWord = null;
        this.clearFeedback();
    }

    // ===== SISTEMA DE LETRAS TÁCTILES PARA DISPOSITIVOS SIN TECLADO =====

    setupTouchLetters(palabra) {
        const touchLettersContainer = document.getElementById('touchLettersContainer');
        const touchLettersGrid = document.getElementById('touchLetters');
        const clearBtn = document.getElementById('clearLettersBtn');
        
        if (!touchLettersContainer || !touchLettersGrid || !clearBtn) return;

        // Mostrar el contenedor
        touchLettersContainer.style.display = 'block';
        
        // Limpiar letras anteriores
        touchLettersGrid.innerHTML = '';
        
        // Generar array de letras desordenadas
        const letters = this.generateShuffledLetters(palabra);
        
        // Crear botones de letras táctiles
        letters.forEach((letter, index) => {
            const letterBtn = this.createTouchLetter(letter, index);
            touchLettersGrid.appendChild(letterBtn);
        });

        // Configurar botón de limpiar
        this.setupClearButton(clearBtn);
        
        // Agregar clase de animación de entrada
        touchLettersContainer.classList.add('touch-container-fade-in');
    }

    generateShuffledLetters(palabra) {
        // Convertir palabra a array de letras
        const letters = palabra.toLowerCase().split('');
        
        // Desordenar usando Fisher-Yates shuffle para garantizar aleatoriedad
        const shuffled = [...letters];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        return shuffled;
    }

    createTouchLetter(letter, index) {
        const letterBtn = document.createElement('button');
        letterBtn.className = 'touch-letter';
        letterBtn.textContent = letter.toUpperCase();
        letterBtn.dataset.letter = letter;
        letterBtn.dataset.index = index;
        
        // Optimización: usar event delegation o listeners directos
        letterBtn.addEventListener('click', (e) => this.onTouchLetterClick(e));
        letterBtn.addEventListener('touchstart', (e) => this.onTouchLetterTouch(e), { passive: true });
        
        // Track listener para cleanup
        this.eventListeners.push({
            element: letterBtn,
            event: 'click',
            handler: (e) => this.onTouchLetterClick(e),
            temp: true
        });
        
        return letterBtn;
    }

    onTouchLetterClick(event) {
        event.preventDefault();
        const letterBtn = event.currentTarget;
        const letter = letterBtn.dataset.letter;
        
        // Evitar doble click
        if (letterBtn.classList.contains('used') || letterBtn.classList.contains('adding')) {
            return;
        }
        
        this.addLetterToInput(letter, letterBtn);
    }

    onTouchLetterTouch(event) {
        // Feedback visual inmediato para touch
        const letterBtn = event.currentTarget;
        letterBtn.style.transform = 'translateY(-1px) scale(0.98)';
        
        setTimeout(() => {
            letterBtn.style.transform = '';
        }, 150);
    }

    addLetterToInput(letter, letterBtn) {
        const wordInput = document.getElementById('wordInput');
        if (!wordInput || !this.currentWord) return;

        const currentValue = wordInput.value;
        const targetLength = this.currentWord.palabra.length;
        
        // Verificar si ya alcanzó la longitud máxima
        if (currentValue.length >= targetLength) {
            return;
        }
        
        // Agregar animación de feedback
        letterBtn.classList.add('adding');
        
        // Agregar letra al input
        wordInput.value = currentValue + letter;
        
        // Marcar letra como usada después de la animación
        setTimeout(() => {
            letterBtn.classList.remove('adding');
            letterBtn.classList.add('used');
        }, 300);
        
        // Reproducir sonido de feedback (opcional)
        this.playTouchLetterSound();
        
        // Actualizar estado del botón de envío
        this.updateSubmitButton();
        
        // Trigger input event para mantener consistencia
        wordInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    setupClearButton(clearBtn) {
        // Limpiar listeners anteriores
        const existingListener = this.eventListeners.find(
            listener => listener.element === clearBtn && listener.event === 'click'
        );
        if (existingListener) {
            clearBtn.removeEventListener('click', existingListener.handler);
        }
        
        const clearHandler = () => this.clearAllLetters();
        clearBtn.addEventListener('click', clearHandler);
        
        // Track listener
        this.eventListeners.push({
            element: clearBtn,
            event: 'click',
            handler: clearHandler,
            temp: true
        });
    }

    clearAllLetters() {
        const wordInput = document.getElementById('wordInput');
        const touchLetters = document.querySelectorAll('.touch-letter');
        
        if (wordInput) {
            wordInput.value = '';
            // Trigger input event para consistencia
            wordInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        // Restaurar todas las letras táctiles
        touchLetters.forEach(letter => {
            letter.classList.remove('used', 'adding');
        });
        
        // Reproducir sonido de limpieza
        this.playTouchClearSound();
        
        // Actualizar botón de envío
        this.updateSubmitButton();
        
        // Re-enfocar el input si es necesario
        if (wordInput) {
            wordInput.focus();
        }
    }

    playTouchLetterSound() {
        // Sonido específico para feedback táctil usando tap.mp3
        if (this.audioFiles.tap) {
            // Detener audio anterior para evitar superposición
            this.audioFiles.tap.currentTime = 0;
            this.audioFiles.tap.volume = 0.4; // Volumen moderado para feedback táctil
            this.audioFiles.tap.play().catch(() => {
                // Silenciar error, es solo feedback opcional
            });
        } else if (this.audioFiles.shine) {
            // Fallback a shine si tap no está disponible
            const audio = this.audioFiles.shine.cloneNode();
            audio.volume = 0.3;
            audio.play().catch(() => {
                // Silenciar error, es solo feedback opcional
            });
        }
    }

    playTouchClearSound() {
        // Sonido sutil para limpiar (usar tap con volumen bajo)
        if (this.audioFiles.tap) {
            // Detener audio anterior para evitar superposición
            this.audioFiles.tap.currentTime = 0;
            this.audioFiles.tap.volume = 0.2; // Volumen muy bajo para limpiar
            this.audioFiles.tap.play().catch(() => {
                // Silenciar error
            });
        } else if (this.audioFiles.break) {
            // Fallback a break si tap no está disponible
            const audio = this.audioFiles.break.cloneNode();
            audio.volume = 0.2;
            audio.play().catch(() => {
                // Silenciar error
            });
        }
    }

    hideTouchLetters() {
        const touchLettersContainer = document.getElementById('touchLettersContainer');
        if (touchLettersContainer) {
            touchLettersContainer.style.display = 'none';
        }
    }

    syncTouchLettersWithInput() {
        const wordInput = document.getElementById('wordInput');
        const touchLetters = document.querySelectorAll('.touch-letter');
        
        if (!wordInput || !this.currentWord) return;
        
        const currentValue = wordInput.value.toLowerCase();
        const targetWord = this.currentWord.palabra.toLowerCase();
        
        // Crear un mapa de frecuencias de letras en el input actual
        const inputLetterCount = {};
        for (let char of currentValue) {
            inputLetterCount[char] = (inputLetterCount[char] || 0) + 1;
        }
        
        // Crear un mapa de frecuencias de letras en la palabra objetivo
        const targetLetterCount = {};
        for (let char of targetWord) {
            targetLetterCount[char] = (targetLetterCount[char] || 0) + 1;
        }
        
        // Resetear todas las letras táctiles y marcar las utilizadas
        touchLetters.forEach(letterBtn => {
            const letter = letterBtn.dataset.letter;
            letterBtn.classList.remove('used', 'adding');
            
            // Contar cuántas veces aparece esta letra en las letras táctiles antes de esta posición
            const letterIndex = parseInt(letterBtn.dataset.index);
            let letterAppearanceIndex = 0;
            
            for (let i = 0; i < letterIndex; i++) {
                const prevBtn = document.querySelector(`.touch-letter[data-index="${i}"]`);
                if (prevBtn && prevBtn.dataset.letter === letter) {
                    letterAppearanceIndex++;
                }
            }
            
            // Verificar si esta instancia específica de la letra debería estar marcada como usada
            const usedCount = inputLetterCount[letter] || 0;
            if (letterAppearanceIndex < usedCount) {
                letterBtn.classList.add('used');
            }
        });
    }

}

let game;

window.addEventListener('DOMContentLoaded', () => {
    game = new PalabrasGame();
    
});

function startGame(difficulty) {
    if (game) {
        game.startGame(difficulty);
    }
}

function nextQuestion() {
    if (game) {
        game.nextQuestion();
    }
}

function goBack() {
    if (game) {
        game.goBack();
    }
}

function submitAnswer() {
    if (game) {
        const submitBtn = document.getElementById('submitBtn');
        // Solo permitir envío si el botón no está deshabilitado
        if (submitBtn && !submitBtn.classList.contains('disabled')) {
            game.validateAnswer();
        }
    }
}

function speakCurrentWord() {
    if (game) {
        game.speakCurrentWord();
    }
}

function speakFreeInput() {
    if (game) {
        game.speakFreeInput();
    }
}

function listenToWord() {
    if (game) {
        game.listenToWord();
    }
}

function resetPoints() {
    if (game) {
        game.resetPoints();
    }
}

// ===== FUNCIONES GLOBALES DEL MODAL DE CONFIGURACIÓN =====
function showSettingsModal() {
    if (game) {
        game.showSettingsModal();
    }
}

function saveSettings() {
    if (game) {
        const nameInput = document.getElementById('childName');
        const voiceSelect = document.getElementById('voiceSelect');
        
        // Validar y guardar nombre
        let name = nameInput.value.trim();
        if (name.length === 0) {
            name = 'Olivia'; // Fallback al nombre por defecto
        }
        
        // Sanitizar el nombre (solo letras, espacios y algunos caracteres especiales)
        name = name.replace(/[^a-zA-ZÁáÉéÍíÓóÚúÑñü\s]/g, '').slice(0, 20);
        
        if (name.length === 0) {
            name = 'Olivia'; // Fallback si se eliminaron todos los caracteres
        }
        
        game.childName = name;
        game.selectedVoice = voiceSelect.value;
        
        // Guardar configuración
        game.savePersonalizationSettings();
        
        // Actualizar voz si se seleccionó una específica
        if (game.selectedVoice) {
            const voices = game.speechSynthesis.getVoices();
            const selectedVoice = voices.find(v => v.name === game.selectedVoice);
            if (selectedVoice) {
                game.spanishVoice = selectedVoice;
            }
        }
        
        // Actualizar títulos dinámicos
        game.updateDynamicTitles();
        
        // Cerrar modal
        game.hideSettingsModal();
        
        // Mostrar mensaje de confirmación personalizado
        game.speakWord(`¡Hola ${game.childName}! ¡Todo está listo para jugar!`);
    }
}

function useDefaultSettings() {
    if (game) {
        // Usar configuración por defecto
        game.childName = 'Olivia';
        game.selectedVoice = null;
        
        // Guardar configuración
        game.savePersonalizationSettings();
        
        // Actualizar títulos dinámicos
        game.updateDynamicTitles();
        
        // Cerrar modal
        game.hideSettingsModal();
        
        // Mensaje de bienvenida
        game.speakWord('¡Hola Olivia! ¡Vamos a aprender juntas!');
    }
}

// ===== FUNCIONES GLOBALES DEL MODAL DE AYUDA =====
function showHelpModal() {
    if (game) {
        game.showHelpModal();
    }
}

function hideHelpModal() {
    if (game) {
        game.hideHelpModal();
    }
}

function showHelpTab(tabName) {
    if (game) {
        game.showHelpTab(tabName);
    }
}

function saveHelpSettings() {
    if (game) {
        const nameInput = document.getElementById('helpChildName');
        const voiceSelect = document.getElementById('helpVoiceSelect');
        
        // Validar y guardar nombre
        let name = nameInput.value.trim();
        if (name.length === 0) {
            name = 'Olivia'; // Fallback al nombre por defecto
        }
        
        game.childName = name;
        
        // Guardar voz seleccionada
        const selectedVoiceId = voiceSelect.value;
        if (selectedVoiceId && selectedVoiceId !== '') {
            const voices = game.speechSynthesis.getVoices();
            const selectedVoice = voices.find(voice => voice.voiceURI === selectedVoiceId || voice.name === selectedVoiceId);
            if (selectedVoice) {
                game.selectedVoice = selectedVoice;
            }
        }
        
        // Guardar configuración
        game.savePersonalizationSettings();
        
        // Actualizar títulos dinámicos
        game.updateDynamicTitles();
        
        // Mensaje de confirmación
        game.speakWord(`¡Configuración guardada, ${game.childName}!`);
        
        // Mostrar mensaje de éxito en la interfaz
        const successMsg = document.createElement('div');
        successMsg.textContent = '¡Configuración guardada!';
        successMsg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--color-success);
            color: white;
            padding: 12px 20px;
            border-radius: 25px;
            font-family: var(--font-primary);
            font-weight: 600;
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(successMsg);
        
        setTimeout(() => {
            successMsg.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => successMsg.remove(), 300);
        }, 2000);
    }
}

function confirmResetPoints() {
    if (game) {
        game.confirmResetPoints();
    }
}