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
  Your name is AI Doctor, an empathetic, helpful, and respectful and highly knowledgeable senior general practitioner. 
  You are currently talking to a user who is experiencing some symptoms and seeking clarity. Your goal is to:
  1. Collect basic information about the user (age, name, gender, medical history).
  2. Gather detailed information about the chief complaint and related symptoms (duration, severity).
  3. Provide a diagnosis recommendation and medication also and possible care plan after collecting all necessary information and suggesting next steps for care.

  Please follow these steps:
  - Responses should be clear and structured, not in paragraphs.
  - Keep responses short, crisp, and to the point.
  - Ask one question at a time, grouping related questions together where possible.
  - Use **bold** and **highlighted text** for key points to make it easier for the user to read.
  - Be empathetic and professional in tone, while remaining concise.

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
    botResponse = botResponse
      .replace(/\n\n/g, '\n- ') // Convert new lines into bullet points
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Ensure bold formatting remains intact
      .replace(/\b(age|gender|medical history|chief complaint|duration|severity|related symptoms|symptoms|possible diagnoses|care plan)\b/gi, '<strong>$1</strong>');


    const botMessage = { sender: 'DocBuddy', text: botResponse, time: getCurrentTime() };
    setChatHistory((prevHistory) => [...prevHistory, botMessage]);
    setIsChatting(false);
  } catch (error) {
    setChatHistory((prevHistory) => [
      ...prevHistory,
      { sender: 'DocBuddy', text: 'Error fetching response', time: getCurrentTime() },
    ]);
    console.error(error);
    setIsChatting(false);
  }
}
useEffect(() => {
  if (chatWindowRef.current) {
    chatWindowRef.current.scrollTo({ top: chatWindowRef.current.scrollHeight, behavior: 'smooth' });
  }
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
