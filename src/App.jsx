import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import chatbotIcon from './assets/chatbot.png';
import { FaMicrophone } from 'react-icons/fa';


function App() {
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isChatting, setIsChatting] = useState(false);
  const chatWindowRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [useVoiceResponse, setUseVoiceResponse] = useState(false);


  // Function to get current time
  const getCurrentTime = () => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

   // Function to handle Speech-to-Text (User Voice Input)
   const startListening = () => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-US';
    recognition.interimResults = false;  // Ensures that results are not interim, but final
    recognition.onstart = () => {
      setIsListening(true);  // Update state to indicate the system is listening
      setUseVoiceResponse(true);
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuestion(transcript); // Set the recognized speech as input
      generateAnswer(transcript); // Automatically send the recognized speech as a question
    };
    recognition.onend = () => {
      setIsListening(false);  // Reset the listening state when recognition ends
    };
    recognition.onerror = (event) => {
      console.error("Speech recognition error", event);
      setIsListening(false);  // Reset the listening state if an error occurs
    };
    recognition.start(); // Start listening
  };

async function generateAnswer() {
  if (!question.trim()) return;

  const userMessage = { sender: 'You', text: question, time: getCurrentTime() };
  setChatHistory((prevHistory) => [...prevHistory, userMessage]);
  setQuestion('');
  setIsChatting(true);

  const formattedHistory = chatHistory.map(msg => `${msg.sender}: ${msg.text}`).join('\n');
  
  const prompt = `
  Your name is DocBuddy, an empathetic, helpful, and respectful and highly knowledgeable senior general practitioner. 
  You are currently talking to a user who is experiencing some symptoms and seeking clarity.Your primary function is to conduct virtual patient interviews, meticulously collecting health-related information to aid in forming a differential diagnosis, which will be reviewed by a senior doctor. Your goal is to:
  1.Ensure to gather detailed descriptions by asking follow up questions from user of each related symptom , including onset, duration, triggers, and alleviation factors.
  2.Collect basic information about the user (age, name, gender, medical history).
  3.After finishing the symptom collection, provide diagnosis recommendation and medication and possible care plan to the user. At the end of the conversation, summarize the conversation and create a symptom summary from the conversation and send it as part of the last message itself.The summary should highlight the key points just like how a General Practitioner would do. Along with that, breakdown her chief complaint, duration, severity, basic health information and related symptoms point by point , each new pont should start from a new line. Send the last message in an organized way and should be arranged in a manner that user can see each point clearly and efficiently.

  Please follow these steps:
  - Responses should be clear and structured, not in paragraphs.
  - Keep responses short, crisp, and to the point.
  - Ask one question at a time
  - Use **bold** and **highlighted text** for key points to make it easier for the user to read.
  - Be empathetic and professional in tone, while remaining concise.
  -Send the last message in an organized way and should be arranged in a manner that user can see each point clearly and efficiently.
  Here is the conversation history:
  ${formattedHistory}

  Now, here is the user's new input:
  ${question}

  `;


  try {
    const response = await axios({
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_API_KEY',
      method: 'post',
      data: {
        contents: [{ parts: [{ text: prompt }] }],
      },
    });

    let botResponse = response.data.candidates[0].content.parts[0].text;
    // Remove any repeated "DocBuddy:" at the start of the response
    botResponse = botResponse.replace(/^DocBuddy[:,]? /i, '');
    botResponse = botResponse
      .replace(/\n\n/g, '\n- ') // Convert new lines into bullet points
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Ensure bold formatting remains intact
      .replace(/\b(age|gender|medical history|chief complaint|duration|severity|related symptoms|symptoms|possible diagnoses|care plan)\b/gi, '<strong>$1</strong>');


    const botMessage = { sender: 'DocBuddy', text: botResponse, time: getCurrentTime() };
    setChatHistory((prevHistory) => [...prevHistory, botMessage]);
    setIsChatting(false);
    if (useVoiceResponse) {
      speak(botResponse);
      setUseVoiceResponse(false); // Reset after speaking
    }
  } catch (error) {
    setChatHistory((prevHistory) => [
      ...prevHistory,
      { sender: 'DocBuddy', text: 'Error fetching response', time: getCurrentTime() },
    ]);
    console.error(error);
    setIsChatting(false);
  }
}
const speak = (text) => {
  speechSynthesis.cancel();  // Stop any ongoing speech
  setTimeout(() => {
  const utterance = new SpeechSynthesisUtterance(text.replace(/<\/?[^>]+(>|$)/g, "") .replace(/\*/g," "));
  utterance.lang = 'en-US';
 // Wait for voices to be loaded before selecting
 const loadVoices = () => {
  const voices = speechSynthesis.getVoices();
  const preferredVoices = voices.filter(voice =>
    voice.name.includes("Google UK English Female") || 
    voice.name.includes("Microsoft Zira") || 
    voice.name.includes("Microsoft Cortana")
  );

  utterance.voice = preferredVoices.length > 0 ? preferredVoices[0] :  voices.find(voice => voice.lang === 'en-US') || voices[0];    // Default to the first available voice if no female voice is found
  utterance.rate = 1.25;
  utterance.pitch = 1;  // Slightly increase pitch for a more natural female tone
  utterance.volume = 1;   // Full volume
  speechSynthesis.speak(utterance);

};
 // If voices are not yet loaded, listen for the event
 if (speechSynthesis.getVoices().length === 0) {
  speechSynthesis.onvoiceschanged = loadVoices;
} else {
  loadVoices();
}
}, 100); // Small delay ensures cancellation takes effect
};

useEffect(() => {
  if (chatWindowRef.current) {
    chatWindowRef.current.scrollTo({ top: chatWindowRef.current.scrollHeight, behavior: 'smooth' });
  }
  speechSynthesis.onvoiceschanged = () => {
    console.log("Voices loaded successfully");
  };
}, [chatHistory]);

const handleKeyPress = (event) => {
  if (event.key === 'Enter' && !isChatting) {
    event.preventDefault(); // Prevents new line in textarea
    generateAnswer();
  }
};

return (
  <div className="app-container">
    <div className="chatbot-icon-wrapper">
      <img src={chatbotIcon} alt="Chatbot" className="chatbot-icon" />
      <span className="ai-doctor-logo">DocBuddy</span>
    </div>

    <div className="chat-container">
      <div className="chat-window" ref={chatWindowRef}>
        {chatHistory.map((msg, index) => (
          <div key={index} className={msg.sender === 'You' ? 'user-box' : 'bot-box'}>
            <strong>{msg.sender}:</strong>
            <div dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br>') }} />
            <div className="timestamp">{msg.time}</div>
          </div>
        ))}
      </div>

      <textarea
        className="chat-input"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={handleKeyPress} // Handle Enter key
        placeholder="Describe your symptoms..."
      ></textarea>
        <button className="chat-button" onClick={generateAnswer} disabled={isChatting}>
        {isChatting ? 'Thinking...' : 'Ask DocBuddy'}
      </button>
      <button className="mic-button" onClick={startListening} disabled={isListening}>
          {isListening ? 'Listening...' :""}
          <FaMicrophone className="mic-icon" />
        </button>
        
    </div>
  </div>
);
}

export default App; 
