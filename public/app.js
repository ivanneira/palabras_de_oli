class PalabrasGame {
    constructor() {
        this.words = [];
        this.currentWords = [];
        this.currentQuestion = 0;
        this.score = 0;
        this.totalStars = 0;
        this.gameMode = '';
        this.questionsPerGame = 10;
        
        this.initializeGame();
    }

    async initializeGame() {
        try {
            await this.loadWords();
            this.loadStarsFromStorage();
            this.updateStarCounter();
        } catch (error) {
            console.error('Error initializing game:', error);
            alert('Error al cargar el juego. Por favor, recarga la página.');
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
            this.gameMode = difficulty;
            const response = await fetch(`/api/words/${difficulty}`);
            const data = await response.json();
            
            this.currentWords = this.shuffleArray([...data.words]).slice(0, this.questionsPerGame);
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

        const word = this.currentWords[this.currentQuestion];
        const questionType = Math.random() < 0.5 ? 'word-to-image' : 'image-to-word';
        
        this.clearPreviousQuestion();
        
        if (questionType === 'word-to-image') {
            this.showWordToImageQuestion(word);
        } else {
            this.showImageToWordQuestion(word);
        }
    }

    clearPreviousQuestion() {
        const optionsContainer = document.getElementById('optionsContainer');
        const nextBtn = document.getElementById('nextBtn');
        
        optionsContainer.innerHTML = '';
        nextBtn.classList.add('hidden');
    }

    showWordToImageQuestion(correctWord) {
        const questionText = document.getElementById('questionText');
        const questionImage = document.getElementById('questionImage');
        
        questionText.textContent = `¿Cuál es ${correctWord.palabra}?`;
        questionImage.innerHTML = '';
        
        const wrongWords = this.getRandomWrongWords(correctWord, 3);
        const allOptions = this.shuffleArray([correctWord, ...wrongWords]);
        
        this.createImageOptions(allOptions, correctWord);
    }

    showImageToWordQuestion(correctWord) {
        const questionText = document.getElementById('questionText');
        const questionImage = document.getElementById('questionImage');
        
        questionText.textContent = '¿Qué palabra es?';
        questionImage.innerHTML = `
            <div class="placeholder-image">
                📷 ${correctWord.palabra}
            </div>
        `;
        
        const wrongWords = this.getRandomWrongWords(correctWord, 3);
        const allOptions = this.shuffleArray([correctWord, ...wrongWords]);
        
        this.createWordOptions(allOptions, correctWord);
    }

    getRandomWrongWords(correctWord, count) {
        const availableWords = this.words.filter(word => 
            word.palabra !== correctWord.palabra
        );
        
        const shuffled = this.shuffleArray(availableWords);
        return shuffled.slice(0, count);
    }

    createImageOptions(options, correctWord) {
        const container = document.getElementById('optionsContainer');
        
        options.forEach(word => {
            const button = document.createElement('button');
            button.className = 'option-btn';
            button.onclick = () => this.checkAnswer(word, correctWord, button);
            
            button.innerHTML = `
                <div class="option-image">
                    <div class="placeholder-image">📷</div>
                </div>
                <span>${word.palabra}</span>
            `;
            
            container.appendChild(button);
        });
    }

    createWordOptions(options, correctWord) {
        const container = document.getElementById('optionsContainer');
        
        options.forEach(word => {
            const button = document.createElement('button');
            button.className = 'option-btn';
            button.onclick = () => this.checkAnswer(word, correctWord, button);
            
            button.innerHTML = `<span>${word.palabra}</span>`;
            
            container.appendChild(button);
        });
    }

    checkAnswer(selectedWord, correctWord, buttonElement) {
        const allButtons = document.querySelectorAll('.option-btn');
        const nextBtn = document.getElementById('nextBtn');
        
        allButtons.forEach(btn => {
            btn.onclick = null;
            btn.style.pointerEvents = 'none';
        });

        if (selectedWord.palabra === correctWord.palabra) {
            buttonElement.classList.add('correct');
            this.score++;
            this.playCorrectSound();
        } else {
            buttonElement.classList.add('incorrect');
            this.highlightCorrectAnswer(correctWord);
            this.playIncorrectSound();
        }

        nextBtn.classList.remove('hidden');
    }

    highlightCorrectAnswer(correctWord) {
        const allButtons = document.querySelectorAll('.option-btn');
        allButtons.forEach(btn => {
            if (btn.textContent.includes(correctWord.palabra)) {
                btn.classList.add('correct');
            }
        });
    }

    playCorrectSound() {
        console.log('🎉 ¡Correcto!');
    }

    playIncorrectSound() {
        console.log('❌ Incorrecto');
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
        const starsEarned = Math.floor(this.score / 2);
        this.totalStars += starsEarned;
        this.saveStarsToStorage();
        this.updateStarCounter();

        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('starsEarned').textContent = starsEarned;
        
        this.showScreen('resultsScreen');
    }

    showScreen(screenId) {
        const screens = ['startScreen', 'gameScreen', 'resultsScreen'];
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