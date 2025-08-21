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
        this.speechSynthesis = window.speechSynthesis;
        this.spanishVoice = null;
        this.listenCount = 3;
        this.preloadedImages = new Map();
        this.audioFiles = {
            win: null,
            lose: null
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
            this.spanishVoice = voices.find(voice => 
                voice.lang.includes('es') || 
                voice.name.toLowerCase().includes('spanish') ||
                voice.name.toLowerCase().includes('español')
            ) || voices[0];
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
            loadAudio('win.wav'),
            loadAudio('lose.wav')
        ]).then(([winAudio, loseAudio]) => {
            this.audioFiles.win = winAudio;
            this.audioFiles.lose = loseAudio;
        });
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
            const response = await fetch('/api/words');
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
            
            this.currentWords = this.shuffleArray([...data.words]);
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
        this.listenCount = 3;
        this.clearPreviousQuestion();
        this.displayQuestion();
        this.setupWordInput();
        this.updateListenButton();
        
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
        
        if (this.gameMode === 'facil' && hintText) {
            hintText.textContent = palabra.toUpperCase();
            hintText.style.display = 'block';
        } else if (hintText) {
            hintText.style.display = 'none';
        }

        wordInput.focus();
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
        this.playWinSound();
        
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
        this.playLoseSound();
        
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
                this.speakWord('¡Súper Olivia! 5 seguidos!');
            }, 1500);
        } else if (this.contadorRacha === 10) {
            setTimeout(() => {
                this.showStreakMessage('¡INCREÍBLE OLIVIA! ¡10 PERFECTOS! 🎊🦄✨');
                this.speakWord('¡Increíble Olivia! 10 perfectos!');
                this.showConfetti();
                // Reiniciar racha tras 10
                setTimeout(() => {
                    this.contadorRacha = 0;
                    this.updateDisplays();
                    this.savePointsToAPI();
                }, 3000);
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
            listenCountSpan.textContent = this.listenCount;
            listenBtn.disabled = this.listenCount <= 0;
        }
    }

    listenToWord() {
        if (this.listenCount > 0 && this.currentWord) {
            this.listenCount--;
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
        
        // Añadir exclamaciones para hacer más expresivo
        let expressiveText = text;
        if (!text.includes('¡') && !text.includes('!')) {
            expressiveText = `¡${text}!`;
        }
        
        const utterance = new SpeechSynthesisUtterance(expressiveText);
        utterance.lang = 'es-ES';
        utterance.rate = 0.6; // Más lenta
        utterance.pitch = 1.4; // Más aguda
        utterance.volume = 1.0;
        
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