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

app.get('/api/points', (req, res) => {
    try {
        const pointsPath = './data/points.txt';
        let pointsData = { totalStars: 0, currentStreak: 0, maxStreak: 0 };
        
        if (fs.existsSync(pointsPath)) {
            const fileContent = fs.readFileSync(pointsPath, 'utf8');
            if (fileContent.trim()) {
                pointsData = JSON.parse(fileContent);
            }
        }
        
        res.json(pointsData);
    } catch (error) {
        console.error('Error reading points file:', error);
        res.status(500).json({ error: 'No se pudieron cargar los puntos' });
    }
});

app.post('/api/points', (req, res) => {
    try {
        const { totalStars, currentStreak, maxStreak } = req.body;
        const pointsData = { totalStars, currentStreak, maxStreak };
        const pointsPath = './data/points.txt';
        
        fs.writeFileSync(pointsPath, JSON.stringify(pointsData, null, 2));
        
        console.log(`📊 Puntos guardados para Olivia: ⭐${totalStars} 🔥${currentStreak} 🏆${maxStreak}`);
        res.json({ success: true, data: pointsData });
    } catch (error) {
        console.error('Error saving points:', error);
        res.status(500).json({ error: 'No se pudieron guardar los puntos' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🌟 ¡Servidor de Olivia corriendo en puerto ${PORT}! 🌟`);
    console.log(`Visita: http://localhost:${PORT}`);
});