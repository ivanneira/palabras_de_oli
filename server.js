const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

app.get('/api/words', (req, res) => {
    try {
        const wordsData = fs.readFileSync('./data/words.json', 'utf8');
        const words = JSON.parse(wordsData);
        res.json(words);
    } catch (error) {
        console.error('Error reading words file:', error);
        res.status(500).json({ error: 'No se pudieron cargar las palabras' });
    }
});

app.get('/api/words/:difficulty', (req, res) => {
    try {
        const { difficulty } = req.params;
        const wordsData = fs.readFileSync('./data/words.json', 'utf8');
        const allWords = JSON.parse(wordsData);
        
        const filteredWords = allWords.words.filter(word => {
            if (difficulty === 'libre') return true;
            return word.dificultad === difficulty;
        });
        
        res.json({ words: filteredWords });
    } catch (error) {
        console.error('Error filtering words:', error);
        res.status(500).json({ error: 'No se pudieron filtrar las palabras' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🌟 ¡Servidor de Olivia corriendo en puerto ${PORT}! 🌟`);
    console.log(`Visita: http://localhost:${PORT}`);
});