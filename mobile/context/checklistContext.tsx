import React, { createContext, useContext, useState } from 'react';


export interface ChecklistItem {
  id: string;
  name: string;     
  isDone: boolean;
}

interface ChecklistContextType {
  checklist: ChecklistItem[];
  toggleItem: (item: any) => void;     
  removeItem: (id: string) => void;    
  toggleDone: (id: string) => void;    
  addManualItem: (text: string) => void; 
}

const ChecklistContext = createContext<ChecklistContextType | undefined>(undefined);

export const ChecklistProvider = ({ children }: { children: React.ReactNode }) => {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  //recommendations toggle for checklist
  const toggleItem = (item: any) => {
    setChecklist((prev) => {
      const exists = prev.find((i) => i.id === item.id);
      if (exists) {
        return prev.filter((i) => i.id !== item.id);
      }
      return [...prev, { ...item, isDone: false }];
    });
  };

  //checklist screen = remove item
  const removeItem = (id: string) => {
    setChecklist((prev) => prev.filter((item) => item.id !== id));
  };

  //checkbox for confirming something is done in checklist screen
  const toggleDone = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isDone: !item.isDone } : item
      )
    );
  };

  //manually add new item to checklist
  const addManualItem = (text: string) => {
    const newItem: ChecklistItem = {
      id: Date.now().toString(),
      name: text,
      isDone: false,
    };
    setChecklist((prev) => [...prev, newItem]);
  };

  return (
    <ChecklistContext.Provider 
      value={{ checklist, toggleItem, removeItem, toggleDone, addManualItem }}>
      {children}
    </ChecklistContext.Provider>
  );
};


export const useChecklist = () => {const context = useContext(ChecklistContext);
  if (!context) {
    throw new Error('Make sure that useChecklist is being used with a ChecklistProvider so that it can be used.');
  }
  return context;
};