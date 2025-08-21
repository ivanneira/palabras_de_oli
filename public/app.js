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
        this.preloadedImages = new Map();
        this.audioFiles = {
            win: null,
            lose: null,
            shine: null,
            break: null,
            winStreak: null,
            applause: null
        };
        
        // 10 mensajes personalizados random para Olivia
        this.randomMessages = [
            '¡Olivia es genial! 🌟',
            '¡Qué lista eres! 🎯',
            '¡Sigue así campeona! 💪',
            '¡Eres increíble, Olivia! ✨',
            '¡Muy bien, pequeña genio! 🧠',
            '¡Fantástico trabajo! 🎉',
            '¡Olivia, eres la mejor! 👑',
            '¡Súper bien hecho! 🚀',
            '¡Qué inteligente eres! 💡',
            '¡Excelente, Olivia! 🌈'
        ];
        
        this.initializeGame();
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

    // Obtener valor de configuración con fallback
    getConfigValue(path, defaultValue = null) {
        if (typeof window.getConfig === 'function') {
            return window.getConfig(path, defaultValue);
        }
        
        // Fallback manual si no está disponible la función
        const keys = path.split('.');
        let current = this.config;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }
        
        return current;
    }


    // Función para normalizar acentos (león = leon)
    normalizeText(text) {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }

    // Función para obtener mensaje random
    getRandomMessage() {
        const randomIndex = Math.floor(Math.random() * this.randomMessages.length);
        return this.randomMessages[randomIndex];
    }

    // Función para precargar imagen
    preloadImage(imageSrc) {
        if (this.preloadedImages.has(imageSrc)) {
            return Promise.resolve();
        }
        
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.preloadedImages.set(imageSrc, img);
                resolve();
            };
            img.onerror = () => resolve(); // Continuar aunque falle la precarga
            img.src = imageSrc;
        });
    }

    async initializeGame() {
        try {
            await this.loadWords();
            await this.loadPointsFromAPI();
            this.updateDisplays();
            this.setupVoices();
            this.setupEventListeners();
            this.loadAudioFiles();
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
            
            // Buscar voz preferida
            let selectedVoice = null;
            for (const preferred of preferredVoices) {
                selectedVoice = voices.find(voice => 
                    voice.name.toLowerCase().includes(preferred.toLowerCase())
                );
                if (selectedVoice) break;
            }
            
            // Fallback a cualquier voz en español
            if (!selectedVoice) {
                selectedVoice = voices.find(voice => 
                    voice.lang.includes('es') || 
                    voice.name.toLowerCase().includes('spanish') ||
                    voice.name.toLowerCase().includes('español')
                );
            }
            
            this.spanishVoice = selectedVoice || voices[0];
        };

        if (this.speechSynthesis.getVoices().length === 0) {
            this.speechSynthesis.addEventListener('voiceschanged', setVoice);
        } else {
            setVoice();
        }
    }

    loadAudioFiles() {
        const loadAudio = (filename) => {
            return new Promise((resolve) => {
                const audio = new Audio(`/sounds/${filename}`);
                audio.addEventListener('canplaythrough', () => resolve(audio));
                audio.addEventListener('error', () => resolve(null));
            });
        };

        Promise.all([
            loadAudio('shine.mp3'),
            loadAudio('break.mp3'),
            loadAudio('win.mp3'),
            loadAudio('applause.mp3')
        ]).then(([shineAudio, breakAudio, winStreakAudio, applauseAudio]) => {
            // Mapear correctamente los sonidos
            this.audioFiles.win = shineAudio;      // shine.mp3 para respuestas correctas
            this.audioFiles.lose = breakAudio;     // break.mp3 para respuestas incorrectas
            this.audioFiles.shine = shineAudio;    // shine.mp3 original
            this.audioFiles.break = breakAudio;    // break.mp3 original
            this.audioFiles.winStreak = winStreakAudio; // win.mp3 para rachas
            this.audioFiles.applause = applauseAudio;   // applause.mp3 para celebraciones
            
            // Configurar volúmenes iniciales
            this.updateAudioVolumes();
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
        if (this.audioFiles.winStreak) this.audioFiles.winStreak.volume = volumes.effects;
        if (this.audioFiles.applause) this.audioFiles.applause.volume = volumes.applause;
    }

    setupEventListeners() {
        const wordInput = document.getElementById('wordInput');
        const freeInput = document.getElementById('freeInput');

        if (wordInput) {
            wordInput.addEventListener('keydown', (e) => this.handleKeyInput(e));
            wordInput.addEventListener('input', (e) => this.handleInputChange(e));
        }

        if (freeInput) {
            freeInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.speakFreeInput();
                }
            });
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
        try {
            const response = await fetch('/api/points');
            const data = await response.json();
            this.totalStars = data.totalStars || 0;
            this.contadorRacha = data.currentStreak || 0;
            this.maxRacha = data.maxStreak || 0;
            
            // Backup en localStorage
            localStorage.setItem('olivia-points', JSON.stringify(data));
        } catch (error) {
            console.error('Error loading points from API:', error);
            // Fallback a localStorage
            const savedData = localStorage.getItem('olivia-points');
            if (savedData) {
                const data = JSON.parse(savedData);
                this.totalStars = data.totalStars || 0;
                this.contadorRacha = data.currentStreak || 0;
                this.maxRacha = data.maxStreak || 0;
            }
        }
    }

    async savePointsToAPI() {
        const pointsData = {
            totalStars: this.totalStars,
            currentStreak: this.contadorRacha,
            maxStreak: this.maxRacha
        };

        try {
            await fetch('/api/points', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(pointsData)
            });
            
            // Backup en localStorage
            localStorage.setItem('olivia-points', JSON.stringify(pointsData));
        } catch (error) {
            console.error('Error saving points to API:', error);
            // Guardar solo en localStorage si falla la API
            localStorage.setItem('olivia-points', JSON.stringify(pointsData));
        }
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
        const wordInput = document.getElementById('wordInput');
        if (!wordInput) return;

        const rect = wordInput.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Crear 8 estrellitas flotantes
        for (let i = 0; i < 8; i++) {
            const star = document.createElement('div');
            star.textContent = '⭐';
            star.className = 'floating-star';
            
            // Posición aleatoria alrededor del input
            const angle = (i / 8) * 2 * Math.PI;
            const radius = 50 + Math.random() * 30;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            star.style.left = x + 'px';
            star.style.top = y + 'px';
            star.style.animationDelay = (Math.random() * 0.5) + 's';
            
            document.body.appendChild(star);
            
            // Eliminar después de la animación
            setTimeout(() => {
                if (star.parentNode) {
                    star.parentNode.removeChild(star);
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
            const response = await fetch(`/api/words/${difficulty}`);
            const data = await response.json();
            
            // Filtrar palabras que no han sido usadas
            const availableWords = data.words.filter(word => !this.usedWords[difficulty].has(word.palabra));
            
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
        }
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
                    <div class="color-display" style="background-color: ${color};">
                        ${this.currentWord.palabra.toUpperCase()}
                    </div>
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
        
        // Limpiar listeners anteriores si existen
        if (wordInput._alignmentHandler) {
            wordInput.removeEventListener('input', wordInput._alignmentHandler);
        }
        
        // Agregar nuevo listener para reajustar mientras se escribe
        wordInput._alignmentHandler = () => {
            this.adjustInputAlignment();
        };
        wordInput.addEventListener('input', wordInput._alignmentHandler);

        wordInput.focus();
    }

    setupInputAlignment(input, palabra) {
        // Resetear el padding izquierdo al valor original para evitar acumulación
        input.style.paddingLeft = '';
        
        // Crear elemento temporal para medir el ancho del texto completo de la pista
        const tempSpan = document.createElement('span');
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.position = 'absolute';
        tempSpan.style.fontSize = getComputedStyle(input).fontSize;
        tempSpan.style.fontFamily = getComputedStyle(input).fontFamily;
        tempSpan.style.fontWeight = getComputedStyle(input).fontWeight;
        tempSpan.style.letterSpacing = getComputedStyle(input).letterSpacing;
        tempSpan.textContent = palabra.toUpperCase();
        
        document.body.appendChild(tempSpan);
        const fullTextWidth = tempSpan.getBoundingClientRect().width;
        document.body.removeChild(tempSpan);
        
        // Calcular el padding izquierdo para centrar el inicio del texto con la pista
        const inputWidth = input.getBoundingClientRect().width;
        const originalPaddingLeft = parseFloat(getComputedStyle(input).paddingLeft);
        const paddingRight = parseFloat(getComputedStyle(input).paddingRight);
        const availableWidth = inputWidth - originalPaddingLeft - paddingRight;
        const startPosition = (availableWidth - fullTextWidth) / 2;
        
        // Aplicar el padding calculado
        input.style.paddingLeft = Math.max(startPosition + originalPaddingLeft, 24) + 'px';
        input.style.textAlign = 'left';
    }

    adjustInputAlignment() {
        // Esta función se puede usar para ajustes dinámicos si es necesario
        // Por ahora mantiene la alineación inicial
    }

    handleKeyInput(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.validateAnswer();
        }
    }

    handleInputChange(event) {
        const input = event.target;
        input.value = input.value.toLowerCase().replace(/[^a-záéíóúñü]/g, '');
    }

    validateAnswer() {
        const wordInput = document.getElementById('wordInput');
        if (!wordInput || !this.currentWord) return;

        const userAnswer = this.normalizeText(wordInput.value);
        const correctAnswer = this.normalizeText(this.currentWord.palabra);

        wordInput.disabled = true;

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
            this.clearFeedback();
        }, 2000);
    }

    checkStreakMilestones() {
        if (this.contadorRacha === 5) {
            setTimeout(() => {
                this.showStreakMessage('¡Súper Olivia! 5 seguidos! 🌈');
                this.playWinStreakSound();
                this.speakWord('¡Súper Olivia! 5 seguidos!');
            }, 1500);
        } else if (this.contadorRacha === 10) {
            setTimeout(() => {
                this.showStreakMessage('¡INCREÍBLE OLIVIA! ¡10 PERFECTOS! 🎊🦄✨');
                this.playWinStreakSound();
                this.speakWord('¡Increíble Olivia! 10 perfectos!');
                this.showConfetti();
            }, 1500);
        } else if (this.contadorRacha === 15) {
            setTimeout(() => {
                this.showStreakMessage('¡ESPECTACULAR OLIVIA! ¡15 SEGUIDOS! 🌟⚡🎆');
                this.playWinStreakSound();
                this.speakWord('¡Espectacular Olivia! 15 seguidos!');
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
            // Configuración de audio hints
            const showCount = this.getConfigValue('game.audioHints.showRemainingCount', true);
            const disableWhenExhausted = this.getConfigValue('game.audioHints.disableWhenExhausted', true);
            
            // Mostrar contador o texto según configuración
            if (this.listenCount === -1) {
                // Modo ilimitado (modo libre)
                listenCountSpan.textContent = '∞';
                listenBtn.disabled = false;
            } else if (showCount) {
                listenCountSpan.textContent = this.listenCount;
                listenBtn.disabled = disableWhenExhausted && this.listenCount <= 0;
            } else {
                listenCountSpan.textContent = this.listenCount > 0 ? '🔊' : '🔇';
                listenBtn.disabled = disableWhenExhausted && this.listenCount <= 0;
            }
        }
    }

    listenToWord() {
        if (this.currentWord && (this.listenCount > 0 || this.listenCount === -1)) {
            // Solo decrementar si no es ilimitado (-1)
            if (this.listenCount > 0) {
                this.listenCount--;
            }
            
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
        if (this.audioFiles.winStreak) {
            this.audioFiles.winStreak.currentTime = 0;
            this.audioFiles.winStreak.play().catch(() => {
                console.log('Error playing win streak sound');
            });
        }
    }

    playApplauseSound() {
        if (this.audioFiles.applause) {
            this.audioFiles.applause.currentTime = 0;
            this.audioFiles.applause.play().catch(() => {
                console.log('Error playing applause sound');
            });
        }
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
    }

    speakWord(text) {
        if (!this.speechSynthesis) return;

        this.speechSynthesis.cancel();
        
        // Configuración de voz desde config
        const voiceConfig = this.getConfigValue('voice', {
            language: 'es-ES',
            rate: 0.4,
            pitch: 2.0,
            volume: 1.0,
            addExclamations: true
        });
        
        // Añadir exclamaciones si está habilitado
        let expressiveText = text;
        if (voiceConfig.addExclamations && !text.includes('¡') && !text.includes('!')) {
            expressiveText = `¡${text}!`;
        }
        
        const utterance = new SpeechSynthesisUtterance(expressiveText);
        utterance.lang = voiceConfig.language;
        utterance.rate = voiceConfig.rate;
        utterance.pitch = voiceConfig.pitch;
        utterance.volume = voiceConfig.volume * this.getConfigValue('audio.volumes.voice', 1.0);
        
        if (this.spanishVoice) {
            utterance.voice = this.spanishVoice;
        }
        
        this.speechSynthesis.speak(utterance);
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
        const currentElement = document.getElementById('currentQuestion');
        const totalElement = document.getElementById('totalQuestions');
        
        if (currentElement && totalElement) {
            currentElement.textContent = this.currentQuestion + 1;
            totalElement.textContent = this.currentWords.length;
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
        
        // Easter egg: 20/20 perfectas = pantalla especial de unicornio violeta
        if (this.score === totalQuestions && totalQuestions === 20) {
            this.showUnicornEasterEgg();
            return;
        }
        
        this.showScreen('resultsScreen');
        
        setTimeout(() => {
            if (this.score >= totalQuestions * 0.8) {
                this.speakWord('¡Excelente trabajo, Olivia!');
            } else if (this.score >= totalQuestions * 0.6) {
                this.speakWord('¡Muy bien, Olivia!');
            } else {
                this.speakWord('¡Sigue practicando, Olivia!');
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
            this.speakWord('¡Olivia es perfecta! ¡Veinte de veinte! ¡Eres una súper estrella!');
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
            this.speakWord(`¡Felicidades Olivia! Has completado todas las palabras del modo ${difficultyText}!`);
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
        if (confirm('¿Estás segura de que quieres reiniciar todos los puntos de Olivia?')) {
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

    showScreen(screenId) {
        const screens = ['startScreen', 'gameScreen', 'freePlayScreen', 'resultsScreen'];
        screens.forEach(screen => {
            const element = document.getElementById(screen);
            if (element) {
                if (screen === screenId) {
                    element.classList.remove('hidden');
                } else {
                    element.classList.add('hidden');
                }
            }
        });
    }

    goBack() {
        this.showScreen('startScreen');
        this.currentWord = null;
        this.clearFeedback();
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