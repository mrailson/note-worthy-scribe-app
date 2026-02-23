import React, { createContext, useContext, useState, useCallback } from "react";
import { ProgrammePerson, defaultPeople } from "@/data/nresPeopleDirectory";

export interface PeopleAuditEntry {
  id: string;
  timestamp: Date;
  userEmail: string;
  action: "Added" | "Edited" | "Deleted";
  personName: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
}

interface NRESPeopleContextType {
  people: ProgrammePerson[];
  addPerson: (person: Omit<ProgrammePerson, "id">, userEmail: string) => void;
  updatePerson: (id: string, updates: Partial<ProgrammePerson>, userEmail: string) => void;
  deletePerson: (id: string, userEmail: string) => void;
  auditLog: PeopleAuditEntry[];
}

const NRESPeopleContext = createContext<NRESPeopleContextType | undefined>(undefined);

export const NRESPeopleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [people, setPeople] = useState<ProgrammePerson[]>(defaultPeople);
  const [auditLog, setAuditLog] = useState<PeopleAuditEntry[]>([]);

  const addAudit = useCallback(
    (userEmail: string, action: PeopleAuditEntry["action"], personName: string, field?: string, oldValue?: string, newValue?: string) => {
      setAuditLog((prev) => [
        { id: crypto.randomUUID(), timestamp: new Date(), userEmail, action, personName, field, oldValue, newValue },
        ...prev,
      ]);
    },
    []
  );

  const addPerson = useCallback(
    (person: Omit<ProgrammePerson, "id">, userEmail: string) => {
      const newPerson = { ...person, id: crypto.randomUUID() };
      setPeople((prev) => [...prev, newPerson]);
      addAudit(userEmail, "Added", person.name);
    },
    [addAudit]
  );

  const updatePerson = useCallback(
    (id: string, updates: Partial<ProgrammePerson>, userEmail: string) => {
      setPeople((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const updated = { ...p, ...updates };
          Object.keys(updates).forEach((key) => {
            const k = key as keyof ProgrammePerson;
            if (String(p[k]) !== String(updates[k])) {
              addAudit(userEmail, "Edited", p.name, k, String(p[k]), String(updates[k]));
            }
          });
          return updated;
        })
      );
    },
    [addAudit]
  );

  const deletePerson = useCallback(
    (id: string, userEmail: string) => {
      setPeople((prev) => {
        const person = prev.find((p) => p.id === id);
        if (person) addAudit(userEmail, "Deleted", person.name);
        return prev.filter((p) => p.id !== id);
      });
    },
    [addAudit]
  );

  return (
    <NRESPeopleContext.Provider value={{ people, addPerson, updatePerson, deletePerson, auditLog }}>
      {children}
    </NRESPeopleContext.Provider>
  );
};

export const useNRESPeople = () => {
  const ctx = useContext(NRESPeopleContext);
  if (!ctx) throw new Error("useNRESPeople must be used within NRESPeopleProvider");
  return ctx;
};
