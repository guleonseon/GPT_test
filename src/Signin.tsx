// SignIn.tsx
import React, { useState } from 'react';
import { supabase } from '@utils/supabaseClient';
import { style } from 'typestyle';

// Define your User interface
interface User {
    id: string; // UUID from Supabase auth
    aud: string; // Audience from Supabase auth
    role?: string; // Role from Supabase auth, optional as it might not always be present
    email?: string; // User's email, optional as it might not always be present
    email_confirmed_at?: string; // Optional, might not always be present
    created_at?: string; // User creation time, optional
    last_sign_in_at?: string; // Last sign-in time, optional
    full_name?: string; // Optional, from your custom table
    avatar_url?: string; // Optional, from your custom table
    billing_address?: object; // JSONB, optional
    payment_method?: object; // JSONB, optional
    token_number?: number; // Optional, from your custom table
    consumed_token?: number; // Optional, from your custom table
    app_metadata?: { provider?: string; providers?: string[] }; // Metadata, optional
  }

// Updated styles using TypeStyle
const welcomeMessageClass = style({
    fontSize: '16px', // Adjust font size for readability
    lineHeight: '1.8', // Increase line height for better text flow
    color: '#555', // Maintain a comfortable reading color
    marginTop: '10px', // Adjust top margin
    marginBottom: '20px', // Adjust bottom margin
    maxWidth: '600px', // Maintain a readable text width
    textAlign: 'justify', // Justify the text for a clean look
    textIndent: '2em', // Indent the first line for a classic look
    padding: '0 10px', // Add some padding for space around the text
  });
const containerClass = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: '20px',
  backgroundColor: '#ffffff',
  boxSizing: 'border-box',
});

const headerClass = style({
  fontSize: '32px', // Larger font size for the header
  fontWeight: 'bold', // Make the header bold
  textAlign: 'center',
  color: '#333',
  marginBottom: '10px',
});

const formClass = style({
  display: 'flex',
  flexDirection: 'column',
  width: '300px',
  alignItems: 'center',
  boxShadow: '0px 0px 10px rgba(0,0,0,0.1)',
  padding: '20px',
  borderRadius: '8px',
  backgroundColor: '#f9f9f9',
  marginTop: '20px', // Add space between text and form
});

const inputClass = style({
  margin: '10px 0',
  padding: '10px',
  width: '100%',
  borderRadius: '5px',
  border: '1px solid #ddd',
});

const buttonClass = style({
  padding: '10px 20px',
  backgroundColor: '#4CAF50',
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  marginTop: '20px',
  width: '100%',
  fontSize: '16px',
});
const signUpButtonClass = style({
    marginTop: '10px',
    textDecoration: 'underline',
    cursor: 'pointer',
    color: '#4CAF50',
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: '16px',
  });
const errorClass = style({
  color: 'red',
  margin: '10px 0',
});

// SignIn component
interface SignInProps {
  onUserSignedIn: (user: User) => void;
}

function SignIn({ onUserSignedIn }: SignInProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw new Error(error.message);

      if (data.user) {
        onUserSignedIn(data.user as User);
      }
    } catch (error) {
      const err = error as Error;
      console.error('Sign-in error:', err);
      setErrorMessage(err.message);
    }
  };
  const handleSignUp = () => {
    window.location.href = 'https://price.tokenai.chat/';
  };
  return (
    <div className={containerClass}>
      <h1 className={headerClass}>TokenAI, 您的智能伙伴</h1>
      <p className={welcomeMessageClass}>
        在这里，您可以体验ChatGPT的卓越能力，让它助您一臂之力，无论是在学习、工作，还是日常生活中，我们的平台不仅提供通用的智能对话体验，更专注于打造个性化服务。您将有机会接触多种专业领域的GPT应用，包括：
        <br /><br />
        私人医生GPT：为您提供健康咨询和生活方式指导。<br />
        个人人生导师GPT：助您规划人生，提供职业发展和个人成长的建议。<br />
        个人伴侣GPT（女朋友/男朋友）：为您带来贴心的日常陪伴和情感交流。<br />
        职业规划GPT：协助您制定职业目标，规划未来职业道路。<br />
        家教GPT：帮助您（或您的孩子）更好的学习。<br />
        <br />
        在套肯人工智能平台，我们致力于将最新的技术和人工智能的温度结合起来，为您打造一个更智能、更贴心的数字生活伙伴。让我们一起探索人工智能的无限可能！
        </p>
      {errorMessage && <p className={errorClass}>{errorMessage}</p>}
      <form onSubmit={handleSubmit} className={formClass}>
        <input 
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputClass}
        />
        <input 
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={inputClass}
        />
        <button type="submit" className={buttonClass}>登录</button>
        <button onClick={handleSignUp} className={signUpButtonClass}>注册</button>
      </form>
    </div>
  );
}

export default SignIn;
