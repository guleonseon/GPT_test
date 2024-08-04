import { StoreApi, create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatSlice, createChatSlice } from './chat-slice';
import { InputSlice, createInputSlice } from './input-slice';
import { AuthSlice, createAuthSlice } from './auth-slice';
import { ConfigSlice, createConfigSlice } from './config-slice';
import { PromptSlice, createPromptSlice } from './prompt-slice';
import { ToastSlice, createToastSlice } from './toast-slice';
import {
  LocalStorageInterfaceV0ToV1,
  LocalStorageInterfaceV1ToV2,
  LocalStorageInterfaceV2ToV3,
  LocalStorageInterfaceV3ToV4,
  LocalStorageInterfaceV4ToV5,
  LocalStorageInterfaceV5ToV6,
  LocalStorageInterfaceV6ToV7,
  LocalStorageInterfaceV7oV8,
} from '@type/chat';
import {
  migrateV0,
  migrateV1,
  migrateV2,
  migrateV3,
  migrateV4,
  migrateV5,
  migrateV6,
  migrateV7,
} from './migrate';
interface User {
  id: string; // UUID from Supabase auth
  aud: string; // Audience from Supabase auth
  role?: string; // Role from Supabase auth, optional as it might not always be present
  email?: string; // User's email, optional as it might not always be present
  email_confirmed_at?: string; // Optional, might not always be present
  created_at?: string; // User creation time, optional
  last_sign_in_at?: string; // Last sign-in time, optional
  full_name?: string; // From your custom table, optional
  avatar_url?: string; // From your custom table, optional
  billing_address?: object; // From your custom table, optional, JSONB
  payment_method?: object; // From your custom table, optional, JSONB
  token_number?: number; // From your custom table, optional
  consumed_token?: number; // From your custom table, optional
  app_metadata?: {
    provider?: string;
    providers?: string[];
  }; // From Supabase auth, optional
}
interface UserSlice {
  user: User | null;
  token_number: number;
  consumed_token: number;
  price_number: number;
  setUser: (user: User | null) => void;
  setTokenNumber: (number: number) => void;
  setConsumedToken: (number: number) => void;
  setPriceNumber: (price: number) => void;
}

const createUserSlice: StoreSlice<UserSlice> = (set) => ({
  user: null,
  token_number: 0,
  consumed_token: 0,
  price_number: 1,
  setUser: (user) => set({ user }),
  setTokenNumber: (number) => set({ token_number: number }),
  setConsumedToken: (number) => set({ consumed_token: number }),
  setPriceNumber: (price) => set({ price_number: price }),
});

interface SensitiveWordsSlice {
  sensitiveWords: string[];
  setSensitiveWords: (words: string[]) => void;
}

const createSensitiveWordsSlice: StoreSlice<SensitiveWordsSlice> = (set) => ({
  sensitiveWords: [],
  setSensitiveWords: (words) => set({ sensitiveWords: words }),
});

export type StoreState = ChatSlice &
  InputSlice &
  AuthSlice &
  ConfigSlice &
  PromptSlice &
  ToastSlice &
  UserSlice &
  SensitiveWordsSlice; // Combined with SensitiveWordsSlice

export type StoreSlice<T> = (
  set: StoreApi<StoreState>['setState'],
  get: StoreApi<StoreState>['getState']
) => T;

export const createPartializedState = (state: StoreState) => ({
  chats: state.chats,
  currentChatIndex: state.currentChatIndex,
  apiKey: state.apiKey,
  apiEndpoint: state.apiEndpoint,
  theme: state.theme,
  autoTitle: state.autoTitle,
  advancedMode: state.advancedMode,
  prompts: state.prompts,
  defaultChatConfig: state.defaultChatConfig,
  defaultSystemMessage: state.defaultSystemMessage,
  hideMenuOptions: state.hideMenuOptions,
  firstVisit: state.firstVisit,
  hideSideMenu: state.hideSideMenu,
  folders: state.folders,
  enterToSubmit: state.enterToSubmit,
  inlineLatex: state.inlineLatex,
  markdownMode: state.markdownMode,
  totalTokenUsed: state.totalTokenUsed,
  countTotalTokens: state.countTotalTokens,
  token_number: state.token_number,
  consumed_token: state.consumed_token,
  user: state.user, // Ensure the user is still included
});

const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      ...createChatSlice(set, get),
      ...createInputSlice(set, get),
      ...createAuthSlice(set, get),
      ...createConfigSlice(set, get),
      ...createPromptSlice(set, get),
      ...createToastSlice(set, get),
      ...createUserSlice(set,get), // Add the user slice
      ...createSensitiveWordsSlice(set,get),
    }),
    {
      name: 'free-chat-gpt',
      partialize: (state) => createPartializedState(state),
      version: 8,
      migrate: (persistedState, version) => {
        switch (version) {
          case 0:
            migrateV0(persistedState as LocalStorageInterfaceV0ToV1);
          case 1:
            migrateV1(persistedState as LocalStorageInterfaceV1ToV2);
          case 2:
            migrateV2(persistedState as LocalStorageInterfaceV2ToV3);
          case 3:
            migrateV3(persistedState as LocalStorageInterfaceV3ToV4);
          case 4:
            migrateV4(persistedState as LocalStorageInterfaceV4ToV5);
          case 5:
            migrateV5(persistedState as LocalStorageInterfaceV5ToV6);
          case 6:
            migrateV6(persistedState as LocalStorageInterfaceV6ToV7);
          case 7:
            migrateV7(persistedState as LocalStorageInterfaceV7oV8);
            break;
        }
        return persistedState as StoreState;
      },
    }
  )
);

export default useStore;
