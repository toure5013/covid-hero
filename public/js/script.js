'use strict';

const socket = io();

const outputYou = document.querySelector('.output-you');
const outputBot = document.querySelector('.output-bot');

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
const language = 'en-US'
    // recognition.lang = 'en-US';
recognition.lang = language;


//messages variables
var langDetectedMessage = "";
var proleDetectedMessage = "";
var comBeginedMessage = 'Speech has been detected.';
var resultDetectedMessage = 'Result has been detected.';
var noAnswerMessage = '(No answer...)';

if (language == 'fr-FR') {
    langDetectedMessage = "";
    proleDetectedMessage = "";
    comBeginedMessage = 'Parole detecter avec succès';
    resultDetectedMessage = 'Resultat trouver avec succès.';
    noAnswerMessage = "(Il n'a pas de reponse)";
}

recognition.interimResults = false;
recognition.maxAlternatives = 1;

document.querySelector('button').addEventListener('click', () => {
    recognition.start();
});

recognition.addEventListener('speechstart', () => {
    console.log(comBeginedMessage);
});

recognition.addEventListener('result', (e) => {
    console.log(resultDetectedMessage);

    let last = e.results.length - 1;
    let text = e.results[last][0].transcript;

    outputYou.textContent = text;
    console.log('Confidence: ' + e.results[0][0].confidence);

    socket.emit('chat message', text);
});

recognition.addEventListener('speechend', () => {
    recognition.stop();
});

recognition.addEventListener('error', (e) => {
    outputBot.textContent = 'Error: ' + e.error;
});

function synthVoice(text) {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance();
    utterance.text = text;
    synth.speak(utterance);
}

socket.on('bot reply', function(replyText) {
    synthVoice(replyText);

    if (replyText == '') replyText = noAnswerMessage;
    outputBot.textContent = replyText;
});