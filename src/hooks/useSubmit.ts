import useStore from '@store/store';
import { useTranslation } from 'react-i18next';
import { ChatInterface, ModelOptions,MessageInterface } from '@type/chat';
import { getChatCompletion, getChatCompletionStream } from '@api/api';
import { parseEventSource } from '@api/helper';
import { limitMessageTokens, updateTotalTokenUsed, countTokens } from '@utils/messageUtils';
import { _defaultChatConfig } from '@constants/chat';
import { officialAPIEndpoint } from '@constants/auth';
import { supabase } from '@utils/supabaseClient';


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
const useSubmit = () => {
  const { t, i18n } = useTranslation('api');
  const error = useStore((state) => state.error);
  const setError = useStore((state) => state.setError);
  const apiEndpoint = useStore((state) => state.apiEndpoint);
  const apiKey = useStore((state) => state.apiKey);
  const setGenerating = useStore((state) => state.setGenerating);
  const generating = useStore((state) => state.generating);
  const currentChatIndex = useStore((state) => state.currentChatIndex);
  const setChats = useStore((state) => state.setChats);
  const { token_number, consumed_token, user, setTokenNumber, setConsumedToken } = useStore(state => ({
    token_number: state.token_number,
    consumed_token: state.consumed_token,
    user: state.user as User,
    setTokenNumber: state.setTokenNumber,
    setConsumedToken: state.setConsumedToken
  }));

  const sensitiveWords = useStore(state => state.sensitiveWords);

  const checkForSensitiveWords = (messageContent: string): boolean => {
    return sensitiveWords.some(word => messageContent.includes(word));
  };

  const generateTitle = async (
    message: MessageInterface[]
  ): Promise<string> => {
    let data;
    try {
      if (!apiKey || apiKey.length === 0) {
        // official endpoint
        if (apiEndpoint === officialAPIEndpoint) {
          throw new Error(t('noApiKeyWarning') as string);
        }

        // other endpoints
        data = await getChatCompletion(
          useStore.getState().apiEndpoint,
          message,
          _defaultChatConfig
        );
      } else if (apiKey) {
        // own apikey
        data = await getChatCompletion(
          useStore.getState().apiEndpoint,
          message,
          _defaultChatConfig,
          apiKey
        );
      }
    } catch (error: unknown) {
      throw new Error(`Error generating title!\n${(error as Error).message}`);
    }
    return data.choices[0].message.content;
  };
  const price_number = useStore((state) => state.price_number);
  const updateConsumedTokenInSupabase = async (newTokensUsed: number) => {
    if (!user) return;

    try {
      const newConsumedTokenValue = consumed_token + (newTokensUsed * price_number);
      const { error } = await supabase
        .from('users')
        .update({ consumed_token: newConsumedTokenValue })
        .eq('id', user.id);

      if (error) throw error;
      setConsumedToken(newConsumedTokenValue);
    } catch (error) {
      console.error('Error updating total number:', error);
      setError('Error updating total number');
    }
  };

  const calculateNewTokensUsed = (messages: MessageInterface[], model: ModelOptions): number => {
    // Assuming countTokens always returns a number
    return countTokens(messages, model);
  };

    // Function to get the last round of conversation
  // Function to get the last round of conversation
  const getLastRoundMessages = (messages: MessageInterface[]) => {
    if (!messages || messages.length === 0) {
      return []; // Return an empty array if messages is undefined or empty
    }
    
    if (messages.length >= 2) {
      return messages.slice(-2); // Get the last two messages
    } else {
      return messages; // If less than two messages, return all
    }
  };

  // Function to calculate tokens for the last round
  const calculateTokensForLastRound = async () => {
    const chats = useStore.getState().chats;
    if (!chats) {
      console.error("Chats are undefined");
      return 0; // Return 0 if chats are undefined
    }
    const currentChatIndex = useStore.getState().currentChatIndex;
    if (typeof currentChatIndex !== 'number') {
      console.error("currentChatIndex is undefined or not a number");
      return 0; // Return 0 if currentChatIndex is not defined or not a number
    }
    const model = chats[currentChatIndex].config.model;
    const lastRoundMessages = getLastRoundMessages(chats[currentChatIndex].messages);
    return calculateNewTokensUsed(lastRoundMessages, model);
  };

  /* RAG relevant implementation */
  const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY; // Replace with your OpenAI API key
  const OPENAI_ENDPOINT = 'https://api.openai.com/v1/engines/text-embedding-ada-002/embeddings'; // OpenAI's text-embedding endpoint
  type EmbeddingResponse = number[];

  async function convertTextToOpenAIEmbedding(text: string): Promise<EmbeddingResponse> {
        const response = await fetch(OPENAI_ENDPOINT, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ input: text })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.data[0].embedding; 
  }

  async function storeMessageWithEmbedding(userId:string,sessionId: number, role: string, content: string): Promise<void> {
      // Convert text to embedding
      const embedding = await convertTextToOpenAIEmbedding(content);
    
      const { data, error } = await supabase
        .from('conversation_history')
        .insert([
          { user_id: userId,session_id: sessionId, role: role, content: content, embedding: embedding }
        ]);
    
      if (error) {
        console.error("Error storing message with embedding:", error);
      } else {
        console.log("Message with embedding stored successfully:", data);
      }
  }

  async function retrieveSimilarHistory(userId: string, sessionId: number, query: string): Promise<String> {
      const query_vector = await convertTextToOpenAIEmbedding(query);
    let result = '';
      let { data: documents, error } = await supabase
      .rpc('search_document_sections', {
        query_vector})
    if (error) console.error(error)
    else {
      //console.log(data)
      result += documents.map((document: { section_content: string; similarity: number;}) => `${document.section_content.trim()}---\n`).join("")
      //console.log(result)
    }

    return result;
  }

  const handleSubmit = async () => {
    if (token_number <= consumed_token) {
      console.log("Insufficient tokens to proceed.");
      return;
    }
    const chats = useStore.getState().chats;
    if (!chats) {
      console.error("Chats are undefined");
      return; // or handle this case appropriately
    }
    const lastMessageContent = chats[currentChatIndex].messages[chats[currentChatIndex].messages.length - 1].content;
    
    if (checkForSensitiveWords(lastMessageContent)) {
      // Handle sensitive word case
      const updatedChats = [...chats];
      updatedChats[currentChatIndex].messages.push({
        role: 'assistant',
        content: '请您重新提问，谢谢！',
      });
      setChats(updatedChats);
      setGenerating(false);
      const newTokensForLastRound = await calculateTokensForLastRound();         

      // Update the consumed token count in the database
      await updateConsumedTokenInSupabase(newTokensForLastRound);
      return;
    }


    if (generating || !chats || chats.length === 0 || !chats[currentChatIndex]) {
      console.log("Chats are not properly initialized or empty.");
      return;
    }

    const updatedChats: ChatInterface[] = JSON.parse(JSON.stringify(chats));

    updatedChats[currentChatIndex].messages.push({
      role: 'assistant',
      content: '',
    });

    setChats(updatedChats);
    setGenerating(true);

    try {
      let stream;
      if (chats[currentChatIndex].messages.length === 0)
        throw new Error('No messages submitted!');

      const user_message = chats[currentChatIndex].messages[chats[currentChatIndex].messages.length - 1].content;
      await storeMessageWithEmbedding(user.id, 0, 'user', user_message);

      let messages = limitMessageTokens(
        chats[currentChatIndex].messages,
        chats[currentChatIndex].config.max_tokens,
        chats[currentChatIndex].config.model
      );

      //console.log(chats[currentChatIndex].title);
      if (chats[currentChatIndex].title == "ChritianGPT (Mormon)")
      {
        let document_context = await retrieveSimilarHistory(user.id, 0, user_message);
        messages = [
          {
            role: "system",
            content: `You are a representative that is very helpful when it comes to 
            talking about Bibles, Only ever answer truthfully and be as helpful as you can!`
          },
          {
            role: "user",
            content: `Context sessions: "${document_context}" Question: "${user_message}" Answer as simple text:`
          },
        ]
      }
      if (messages.length === 0) throw new Error('Message exceed max token!');

      // no api key (free)
      if (!apiKey || apiKey.length === 0) {
        // official endpoint
        if (apiEndpoint === officialAPIEndpoint) {
          throw new Error(t('noApiKeyWarning') as string);
        }

        // other endpoints
        stream = await getChatCompletionStream(
          useStore.getState().apiEndpoint,
          messages,
          chats[currentChatIndex].config
        );
      } else if (apiKey) {
        // own apikey
        stream = await getChatCompletionStream(
          useStore.getState().apiEndpoint,
          messages,
          chats[currentChatIndex].config,
          apiKey
        );
      }

      if (stream) {
        if (stream.locked)
          throw new Error(
            'Oops, the stream is locked right now. Please try again'
          );
        const reader = stream.getReader();
        let reading = true;
        let partial = '';
        while (reading && useStore.getState().generating) {
          const { done, value } = await reader.read();
          const result = parseEventSource(
            partial + new TextDecoder().decode(value)
          );
          partial = '';

          if (result === '[DONE]' || done) {
            reading = false;
          } else {
            const resultString = result.reduce((output: string, curr) => {
              if (typeof curr === 'string') {
                partial += curr;
              } else {
                const content = curr.choices[0]?.delta?.content ?? null;
                if (content) output += content;
              }
              return output;
            }, '');

            const updatedChats: ChatInterface[] = JSON.parse(
              JSON.stringify(useStore.getState().chats)
            );
            const updatedMessages = updatedChats[currentChatIndex].messages;
            updatedMessages[updatedMessages.length - 1].content += resultString;
            setChats(updatedChats);
          }
        }
        if (useStore.getState().generating) {
          reader.cancel('Cancelled by user');
        } else {
          reader.cancel('Generation completed');
        }
        reader.releaseLock();
        stream.cancel();
      }

      // update tokens used in chatting
      if (!chats || typeof currentChatIndex !== 'number' || !chats[currentChatIndex]) {
        throw new Error("Chats or currentChatIndex is undefined");
      }
      const currChats = useStore.getState().chats;
      const countTotalTokens = useStore.getState().countTotalTokens;

      if (currChats && countTotalTokens) {
        const model = currChats[currentChatIndex].config.model;
        const messages = currChats[currentChatIndex].messages;
        updateTotalTokenUsed(
          model,
          messages.slice(0, -1),
          messages[messages.length - 1]
        );
      }

      // generate title for new chats
      if (
        useStore.getState().autoTitle &&
        currChats &&
        !currChats[currentChatIndex]?.titleSet
      ) {
        const messages_length = currChats[currentChatIndex].messages.length;
        const assistant_message =
          currChats[currentChatIndex].messages[messages_length - 1].content;
        const user_message =
          currChats[currentChatIndex].messages[messages_length - 2].content;

        const message: MessageInterface = {
          role: 'user',
          content: `Generate a title in less than 6 words for the following message (language: ${i18n.language}):\n"""\nUser: ${user_message}\nAssistant: ${assistant_message}\n"""`,
        };

        let title = (await generateTitle([message])).trim();
        if (title.startsWith('"') && title.endsWith('"')) {
          title = title.slice(1, -1);
        }
        const updatedChats: ChatInterface[] = JSON.parse(
          JSON.stringify(useStore.getState().chats)
        );
        updatedChats[currentChatIndex].title = title;
        updatedChats[currentChatIndex].titleSet = true;
        setChats(updatedChats);
        
        // update tokens used for generating title
        if (countTotalTokens) {
          const model = _defaultChatConfig.model;
          updateTotalTokenUsed(model, [message], {
            role: 'assistant',
            content: title,
          });
        }
      }
      // Wait for the state to update with the LLM's response
      //await new Promise(resolve => setTimeout(resolve, 0));
      if (currChats) {
        const messages_length = currChats[currentChatIndex].messages.length;
        const assistant_message = currChats[currentChatIndex].messages[messages_length - 1].content;
        await storeMessageWithEmbedding(user.id, 0, 'assistant', assistant_message);
      }

      // Calculate tokens for the last round including the LLM's response
      const newTokensForLastRound = await calculateTokensForLastRound();         

      // Update the consumed token count in the database
      await updateConsumedTokenInSupabase(newTokensForLastRound);
    } catch (e) {
      const err = e as Error; // Type assertion
      console.error('Error:', err.message)
      setError(err.message);
    }
    setGenerating(false);
    
  };

  return { handleSubmit, error };
};



export default useSubmit;
