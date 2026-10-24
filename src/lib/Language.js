var AlienAlphabet = {
    A: 'Α', a: 'α', B: 'ꓭ', b: 'β',
    C: 'Γ', c: 'γ', D: 'Δ', d: 'δ',
    E: 'Ε', e: 'ε', F: 'Ϝ', f: 'ζ',
    G: 'Θ', g: 'θ', H: 'Η', h: 'η',
    I: 'Ι', i: 'ι', J: 'Λ', j: 'λ',
    K: 'Κ', k: 'κ', L: 'Ł', l: 'l',
    M: 'Μ', m: 'μ', N: 'Ν', n: 'ν',
    O: 'Ο', o: 'ο', P: 'Ρ', p: 'ρ',
    Q: 'Φ', q: 'φ', R: 'Σ', r: 'σ',
    S: 'ς', s: 's', T: 'Τ', t: 'τ',
    U: 'U', u: 'π', V: 'Π', v: 'v',
    W: 'Ω', w: 'ω', X: 'X', x: 'x',
    Y: 'Ψ', y: 'ψ', Z: 'Z', z: '𝟚', '': ''
};
function translating(text) {
    return text.split('').map(function (char) {
        if (char in AlienAlphabet) {
            return AlienAlphabet[char];
        }
        return char;
    }).join('');
}
var Alien = ["Colony Health", "Colony Name", "Space Goop",
    "Space Bucks", "Oxygen", "Ammunition", "Evil", "Friendly"];
var chosenWord = "";
function scrambled(wordsList) {
    var randomWord = Math.floor(Math.random() * wordsList.length);
    var word = wordsList[randomWord];
    var randomLetters = word.split('');
    for (var i = randomLetters.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = randomLetters[i];
        randomLetters[i] = randomLetters[j];
        randomLetters[j] = temp;
    }
    return randomLetters.join('');
}
var newAlien = {};
function start() {
    var randomIndex = Math.floor(Math.random() * Alien.length);
    chosenWord = Alien[randomIndex];
    var finalResult = newAlien[chosenWord];
    if (!finalResult) {
        var translatedWord = translating(chosenWord);
        finalResult = scrambled([translatedWord]);
        newAlien[chosenWord] = finalResult;
    }
    document.getElementById("alien-display").innerText = finalResult;
    document.getElementById("result").innerText = "";
    var options = [chosenWord];
    while (options.length < 3) {
        var wrong = Alien[Math.floor(Math.random() * Alien.length)];
        if (!options.includes(wrong)) {
            options.push(wrong);
        }
    }
    var optionsContainer = document.getElementById("options");
    optionsContainer.innerHTML = "";
    var _loop_1 = function (option) {
        var btn = document.createElement("button");
        btn.innerText = option;
        btn.onclick = function () { return checkGuess(option); };
        optionsContainer.appendChild(btn);
    };
    for (var _i = 0, options_1 = options; _i < options_1.length; _i++) {
        var option = options_1[_i];
        _loop_1(option);
    }
}
function checkGuess(selectedWord) {
    var resultBox = document.getElementById("result");
    if (selectedWord === chosenWord) {
        resultBox.style.color = "#4ade80";
        resultBox.innerText = "Correct! ✅";
    }
    else {
        resultBox.style.color = "#f87171";
        resultBox.innerText = "Wrong! It was \"".concat(chosenWord, "\" \u274C");
    }
    setTimeout(start, 1500);
}
window.onload = start;
