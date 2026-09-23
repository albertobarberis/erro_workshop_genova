let audioContext; // the Web Audio API's main context
let arrayOfSounds = []; // all currently playing Sounds

const ATTACK_TIME = 0.02; // how long a Sound takes to fade in
const RELEASE_TIME = 0.02; // how long a Sound takes to fade out when removed
const STEP_DURATION = 0.1; // seconds per rhythm step (smaller = faster)
const GATE_RATIO = 0.5; // fraction of each step the note stays "on" before fading
const DETUNE_HZ = 10; // detuning in Hz

function fetchOneReference(){ // get ONE random reference's text from the server
    return fetch('https://www.erro.zone/api/references')
        .then(res => res.json())
        .then(data => random(data.references).text);
}

function startAudio(){ // create the audio context on first keypress
    audioContext = new AudioContext();
}

class Sound{
    constructor(freq, key, ascii, bin){
        this.freq = freq;
        this.amp = random(0.1, 0.5); // random volume between 0.3 and 1
        this.key = key;

        // the rhythm pattern: the ascii's bits, e.g. "1000001" -> [1,0,0,0,0,0,1]
        this.bits = bin.padStart(8, '0').split('').map(x => Number(x));
        this.stepIndex = 0; // which bit we're on right now

        // the reference text, revealed one word per "1" beat
        this.refWords = ["loading..."]; // shown until the fetch resolves
        this.wordIndex = 0;

        this.baseStr = key + "  " + ascii.toFixed(1) + "  " + this.bits; // key/ascii/bits
        this.str = ""; // the full text shown on screen, rebuilt by updateDisplay()
        this.updateDisplay();

        this.x = random(width-400);
        this.y = random(height);

        // build the oscillator: freq -> gain -> speakers
        this.mainOsc = audioContext.createOscillator();
        this.mainOsc.type = "sine";
        this.mainOsc.frequency.value = this.freq;
        this.mainOsc.start();

        this.mainOscGain = audioContext.createGain();
        this.mainOscGain.gain.value = 0; // starts silent; playStep() turns it on/off

        this.mainOsc.connect(this.mainOscGain);
        this.mainOscGain.connect(audioContext.destination);

        // fetch the reference text in the background
        fetchOneReference().then(text => {
            if(!arrayOfSounds.includes(this)) return; // this Sound may already be gone
            this.refWords = text.split(/\s+/).filter(w => w.length > 0);
            this.updateDisplay();
        });

        // start the rhythm: play one step every STEP_DURATION seconds
        this.stepTimer = setInterval(() => this.playStep(), STEP_DURATION * 1000);
    }

    playStep(){ // play (or skip) the current bit, then move to the next one
        let bit = this.bits[this.stepIndex];
        let now = audioContext.currentTime;
        let g = this.mainOscGain.gain;
        
        if(bit === 1){
            g.setTargetAtTime(this.amp, now, ATTACK_TIME);
            g.setTargetAtTime(0, now + STEP_DURATION * GATE_RATIO, RELEASE_TIME);
            this.advanceWord();
        } 

        this.stepIndex = (this.stepIndex + 1) % this.bits.length;
    }

    advanceWord(){ // move to the next word in the reference text
        this.wordIndex = (this.wordIndex + 1) % this.refWords.length;
        this.updateDisplay();
    }

    updateDisplay(){ // rebuild the on-screen text from the current word
        this.str = this.baseStr + "  " + this.refWords[this.wordIndex];
    }
}

function findSoundByKey(theKey){ // find the Sound currently linked to a key, if any
    return arrayOfSounds.find(s => s.key === theKey);
}

function stopSound(sound){ // fade out, stop, and remove a Sound
    let index = arrayOfSounds.indexOf(sound);
    if(index === -1) return;

    clearInterval(sound.stepTimer); // stop its rhythm loop

    sound.mainOscGain.gain.setTargetAtTime(0, audioContext.currentTime, RELEASE_TIME); // fade out
    sound.mainOsc.stop(audioContext.currentTime + RELEASE_TIME * 5); // stop the oscillator after the fade

    arrayOfSounds.splice(index, 1);
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    textSize(20);
    textStyle(BOLD);
    textFont("Courier New");
    textAlign(LEFT, CENTER);
}

function draw(){
    background(255);
    fill(0);
    for(let s of arrayOfSounds){
        text(s.str, s.x, s.y);
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

function keyPressed() {
    if(!audioContext) startAudio();

    let ascii = key.charCodeAt(0);
    let bin = ascii.toString(2);

    if(findSoundByKey(key)){ // same key again: detune slightly instead of stopping
        ascii += random(DETUNE_HZ);
    }

    arrayOfSounds.push(new Sound(ascii, key, ascii, bin));
}

function mousePressed(){ // click a Sound's text to remove it
    let clicked = arrayOfSounds.find(s => dist(s.x, s.y, mouseX, mouseY) < 10);
    if(clicked) stopSound(clicked);
}

function mouseDragged(){
    mousePressed(); // dragging over a Sound also removes it
}