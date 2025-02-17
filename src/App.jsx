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
  const [micActive, setMicActive] = useState(false);  // Track mic active state
  const micButtonRef = useRef(null);  // Reference to the mic button for toggling class


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
      setMicActive(true); // Activate mic vibration effect when listening
      if (micButtonRef.current) {
        micButtonRef.current.classList.add('clicked');  // Add 'clicked' class when microphone is active
      }
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuestion(transcript); // Set the recognized speech as input
      generateAnswer(transcript); // Automatically send the recognized speech as a question
    };
    recognition.onend = () => {
      setIsListening(false);  // Reset the listening state when recognition ends
      setMicActive(false); // Deactivate mic vibration when listening ends
      if (micButtonRef.current) {
        micButtonRef.current.classList.remove('clicked');  // Remove 'clicked' class when recognition ends
      }
    };
    recognition.onerror = (event) => {
      console.error("Speech recognition error", event);
      setIsListening(false);  // Reset the listening state if an error occurs
      setMicActive(false); // Deactivate mic vibration on error
      if (micButtonRef.current) {
        micButtonRef.current.classList.remove('clicked');  // Remove 'clicked' class on error
      }
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
    const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
    const GEMINI_API = import.meta.env.VITE_GEMINI_API_KEY;
  
    const prompt = `
    Your name is DocBuddy, an empathetic, helpful, and respectful and highly knowledgeable senior general practitioner doctor. 
    You are currently talking to a user who is experiencing some symptoms and seeking clarity.Your primary function is to conduct virtual patient interviews, meticulously collecting health-related information to aid in forming a differential diagnosis, which will be reviewed by a senior doctor. Your goal is to:
    1. Ensure to gather detailed descriptions by asking follow-up questions from the user of each related symptom, including onset, duration, triggers, and alleviation factors.
    2. Collect basic information about the user (age, name, gender, medical history).
    3. After finishing the symptom collection, provide diagnosis recommendation and medication and possible care plan to the user. At the end of the conversation, summarize the conversation and create a symptom summary from the conversation and send it as part of the last message itself. The summary should highlight the key points just like how a General Practitioner would do. Along with that, break down their chief complaint, duration, severity, basic health information, and related symptoms point by point, each new point should start from a new line. Send the last message in an organized way and should be arranged in a manner that the user can see each point clearly and efficiently.
  
    Please follow these steps:
    - Responses should be clear and structured, not in paragraphs.
    - Ask one question at a time.
    - Keep responses short, crisp, and to the point.
    - Use **bold** and **highlighted text** for key points to make it easier for the user to read.
    - Be empathetic and professional in tone while remaining concise.
    - Do not give the final summary again and again, just give the summary at the last of the first condition explained.
    - Send the last message in an organized way and should be arranged in a manner that the user can see each point clearly and efficiently.
    
    Here is the conversation history:
    ${formattedHistory}
    
    Now, here is the user's new input:
    ${question}
    `;
  
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini', // Change model as needed
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
          temperature: 0.7,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
        }
      );
  
      let botResponse = response.data.choices[0].message.content;
      botResponse = botResponse.replace(/^DocBuddy[:,]? /i, '')
        .replace(/\n\n/g, '\n- ')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\b(age|gender|medical history|chief complaint|duration|severity|related symptoms|symptoms|possible diagnoses|care plan)\b/gi, '<strong>$1</strong>');
  
      const botMessage = { sender: 'DocBuddy', text: botResponse, time: getCurrentTime() };
      setChatHistory((prevHistory) => [...prevHistory, botMessage]);
      setIsChatting(false);
      if (useVoiceResponse) {
        speak(botResponse);
        setUseVoiceResponse(false);
      }
    } catch (error) {
      console.error('OpenAI API Error:', error.response?.data || error.message);
      fetchGemini(prompt);
    }
  }
  
  async function fetchGemini(prompt) {
    const GEMINI_API = import.meta.env.VITE_GEMINI_API_KEY;
    try {
      const response = await axios({
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API}`,
        method: 'post',
        data: {
          contents: [{ parts: [{ text: prompt }] }],
        },
      });
  
      let botResponse = response.data.candidates[0].content.parts[0].text;
      botResponse = botResponse.replace(/^DocBuddy[:,]? /i, '')
        .replace(/\n\n/g, '\n- ')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\b(age|gender|medical history|chief complaint|duration|severity|related symptoms|symptoms|possible diagnoses|care plan)\b/gi, '<strong>$1</strong>');
  
      const botMessage = { sender: 'DocBuddy', text: botResponse, time: getCurrentTime() };
      setChatHistory((prevHistory) => [...prevHistory, botMessage]);
      setIsChatting(false);
      if (useVoiceResponse) {
        speak(botResponse);
        setUseVoiceResponse(false);
      }
    } catch (error) {
      console.error('Gemini API Error:', error.response?.data || error.message);
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
  speechSynthesis.cancel();
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
         <button className={`mic-button ${micActive ? 'active' : ''}`}
          onClick={() =>{
            if (isListening) {
              setMicActive(false); // Deactivate mic when clicked
              if (micButtonRef.current) {
                micButtonRef.current.classList.remove('clicked');
              } 
          }
          else {
            startListening(); // Start speech recognition
          }
        }}
      >
           <FaMicrophone />
        </button>
     
        
    </div>
  </div>
);
}

export default App; 