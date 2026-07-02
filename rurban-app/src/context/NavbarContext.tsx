import React, { createContext, useContext, useState } from 'react';

type NavbarContextType = {
  isNavVisible: boolean;
  setNavVisible: (v: boolean) => void;
};

const NavbarContext = createContext<NavbarContextType>({
  isNavVisible: true,
  setNavVisible: () => {},
});

export function NavbarProvider({ children }: { children: React.ReactNode }) {
  const [isNavVisible, setNavVisible] = useState(true);
  return (
    <NavbarContext.Provider value={{ isNavVisible, setNavVisible }}>
      {children}
    </NavbarContext.Provider>
  );
}

export function useNavbar() {
  return useContext(NavbarContext);
}
