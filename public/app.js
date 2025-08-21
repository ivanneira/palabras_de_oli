class PalabrasGame {
    constructor() {
        this.words = [];
        this.currentWords = [];
        this.currentQuestion = 0;
        this.score = 0;
        this.totalStars = 0;
        this.gameMode = '';
        this.currentWord = null;
        this.speechSynthesis = window.speechSynthesis;
        this.spanishVoice = null;
        
        this.initializeGame();
    }

    async initializeGame() {
        try {
            await this.loadWords();
            this.loadStarsFromStorage();
            this.updateStarCounter();
            this.setupVoices();
            this.setupEventListeners();
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

    loadStarsFromStorage() {
        const savedStars = localStorage.getItem('olivia-stars');
        this.totalStars = savedStars ? parseInt(savedStars) : 0;
    }

    saveStarsToStorage() {
        localStorage.setItem('olivia-stars', this.totalStars.toString());
    }

    updateStarCounter() {
        const counterElement = document.getElementById('starCounter');
        if (counterElement) {
            counterElement.textContent = this.totalStars;
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
        this.clearPreviousQuestion();
        this.displayQuestion();
        this.setupWordInput();
        
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

        const userAnswer = wordInput.value.toLowerCase().trim();
        const correctAnswer = this.currentWord.palabra.toLowerCase();

        wordInput.disabled = true;

        if (userAnswer === correctAnswer) {
            this.handleCorrectAnswer();
        } else {
            this.handleIncorrectAnswer();
        }
    }

    handleCorrectAnswer() {
        this.score++;
        this.showFeedback(true, '¡Muy bien, Olivia! 🎉');
        this.speakWord('¡Muy bien!');
        
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) {
            setTimeout(() => {
                nextBtn.classList.remove('hidden');
            }, 1000);
        }
    }

    handleIncorrectAnswer() {
        this.showFeedback(false, 'Inténtalo otra vez 💜');
        this.speakWord('Inténtalo otra vez');
        
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
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        utterance.rate = 0.8;
        utterance.pitch = 1.2;
        
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
            this.speakWord(freeInput.value.trim());
        }
    }

    nextQuestion() {
        this.currentQuestion++;
        this.updateProgress();
        this.showQuestion();
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
        const starsEarned = Math.floor(this.score / 3);
        this.totalStars += starsEarned;
        this.saveStarsToStorage();
        this.updateStarCounter();

        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('starsEarned').textContent = starsEarned;
        
        this.showScreen('resultsScreen');
        
        setTimeout(() => {
            if (this.score >= this.currentWords.length * 0.8) {
                this.speakWord('¡Excelente trabajo, Olivia!');
            } else if (this.score >= this.currentWords.length * 0.6) {
                this.speakWord('¡Muy bien, Olivia!');
            } else {
                this.speakWord('¡Sigue practicando, Olivia!');
            }
        }, 500);
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