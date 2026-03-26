import { createContext, useContext, useState, ReactNode } from 'react';

interface AppContextType {
  isLoggedIn: boolean;
  mode: 'paper';
  login: () => void;
  logout: () => void;
}

const AppContext = createContext<AppContextType>({
  isLoggedIn: false,
  mode: 'paper',
  login: () => {},
  logout: () => {},
});

export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <AppContext.Provider
      value={{
        isLoggedIn,
        mode: 'paper',
        login: () => setIsLoggedIn(true),
        logout: () => setIsLoggedIn(false),
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
