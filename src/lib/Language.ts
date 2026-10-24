 const AlienAlphabet: Record<string, string> = {
    A : 'Α', a : 'α', B : 'ꓭ', b : 'β',
    C : 'Γ', c : 'γ', D : 'Δ', d : 'δ',
    E : 'Ε', e : 'ε', F : 'Ϝ', f : 'ζ',
    G : 'Θ', g : 'θ', H : 'Η', h : 'η', 
    I : 'Ι', i : 'ι', J : 'Λ', j : 'λ',
    K : 'Κ', k : 'κ', L : 'Ł', l : 'l',
    M : 'Μ', m : 'μ', N : 'Ν', n : 'ν',
    O : 'Ο', o : 'ο', P : 'Ρ', p : 'ρ',
    Q : 'Φ', q : 'φ', R : 'Σ', r : 'σ',
    S : 'ς', s : 's', T : 'Τ', t : 'τ',
    U : 'U', u : 'π', V : 'Π', v : 'v',
    W : 'Ω', w : 'ω', X : 'X', x : 'x',
    Y : 'Ψ', y : 'ψ', Z : 'Z', z : '𝟚', '' : ''
};

function translating(text:string): string {
    return text.split('').map(char => {
        if (char in AlienAlphabet) {
            return AlienAlphabet[char]
        }
        return char;
}).join('');
}



let Alien: string[] = ["Colony Health", "Colony Name", "Space Goop",
                       "Space Bucks", "Oxygen", "Ammunition", "Evil", "Friendly"]; 
let chosenWord = ""

function scrambled(wordsList: string[]): string {


    const randomWord = Math.floor(Math.random() * wordsList.length);
    const word = wordsList[randomWord];

    const randomLetters = word.split('');
    for(let i = randomLetters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        
        const temp = randomLetters[i];
        randomLetters[i] = randomLetters[j];
        randomLetters[j] = temp;    
    }
    return randomLetters.join(''); 
}

const newAlien: Record<string, string> = {};

function start (): void {
    
    
    const randomIndex = Math.floor(Math.random() * Alien.length);
    chosenWord = Alien[randomIndex];

    let finalResult = newAlien[chosenWord];
    
    if(!finalResult) {
        const translatedWord = translating(chosenWord);
        finalResult = scrambled([translatedWord]);
        newAlien[chosenWord] = finalResult; }

    document.getElementById("alien-display")!.innerText = finalResult;
    document.getElementById("result")!.innerText = "";

    let options: string[] = [chosenWord]
    while (options.length < 3) {
        let wrong = Alien[Math.floor(Math.random() * Alien.length)]
        if (!options.includes(wrong)) {
            options.push(wrong);
        }
    }

    let optionsContainer = document.getElementById("options")!;
    optionsContainer.innerHTML = "";
    
    for (let option of options) {
        let btn = document.createElement("button");
        btn.innerText = option;
        btn.onclick = () => checkGuess(option); 
        optionsContainer.appendChild(btn);
    }
}

   function checkGuess(selectedWord: string): void {
    let resultBox = document.getElementById("result")!;

    if (selectedWord === chosenWord) {
        resultBox.style.color = "#4ade80"; 
        resultBox.innerText = "Correct! ✅";
    } else {
        resultBox.style.color = "#f87171"; 
        resultBox.innerText = `Wrong! It was "${chosenWord}" ❌`;
    }

    
    setTimeout(start, 1500);
}

window.onload = start;