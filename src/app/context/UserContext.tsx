// /app/context/UserContext.tsx

'use client';

import React, { createContext, useContext } from 'react';

interface UserContextProps {
  userName: string;
  role: 'author' | 'reviewer' | 'admin' | 'member' | 'unknown';
}

const UserContext = createContext<UserContextProps | undefined>(undefined);

interface UserProviderProps {
  userName: string;
  role: 'author' | 'reviewer' | 'admin' | 'member' | 'unknown';
  children: React.ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({
  userName,
  role,
  children,
}) => {
  return (
    <UserContext.Provider value={{ userName, role }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser должен использоваться внутри UserProvider');
  }
  return context;
};
