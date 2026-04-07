import React, { createContext, useContext, useState, useCallback } from "react";
import { ProgrammePerson, ProgrammeGroup, defaultPeople, defaultGroups } from "@/data/nresPeopleDirectory";

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
  groups: ProgrammeGroup[];
  addPerson: (person: Omit<ProgrammePerson, "id">, userEmail: string) => void;
  updatePerson: (id: string, updates: Partial<ProgrammePerson>, userEmail: string) => void;
  deletePerson: (id: string, userEmail: string) => void;
  addGroup: (group: Omit<ProgrammeGroup, "id">, userEmail: string) => void;
  updateGroup: (id: string, updates: Partial<ProgrammeGroup>, userEmail: string) => void;
  deleteGroup: (id: string, userEmail: string) => void;
  auditLog: PeopleAuditEntry[];
}

export const NRESPeopleContext = createContext<NRESPeopleContextType | undefined>(undefined);

export const NRESPeopleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [people, setPeople] = useState<ProgrammePerson[]>(defaultPeople);
  const [groups, setGroups] = useState<ProgrammeGroup[]>(defaultGroups);
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
            if (String(p[k] ?? "") !== String(updates[k] ?? "")) {
              addAudit(userEmail, "Edited", p.name, k, String(p[k] ?? ""), String(updates[k] ?? ""));
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

  const addGroup = useCallback(
    (group: Omit<ProgrammeGroup, "id">, userEmail: string) => {
      const newGroup = { ...group, id: crypto.randomUUID() };
      setGroups((prev) => [...prev, newGroup]);
      addAudit(userEmail, "Added", `Group: ${group.name}`);
    },
    [addAudit]
  );

  const updateGroup = useCallback(
    (id: string, updates: Partial<ProgrammeGroup>, userEmail: string) => {
      setGroups((prev) =>
        prev.map((g) => {
          if (g.id !== id) return g;
          const updated = { ...g, ...updates };
          Object.keys(updates).forEach((key) => {
            const k = key as keyof ProgrammeGroup;
            const oldVal = String(g[k] ?? "");
            const newVal = String(updates[k] ?? "");
            if (oldVal !== newVal) {
              addAudit(userEmail, "Edited", `Group: ${g.name}`, k, oldVal, newVal);
            }
          });
          return updated;
        })
      );
    },
    [addAudit]
  );

  const deleteGroup = useCallback(
    (id: string, userEmail: string) => {
      setGroups((prev) => {
        const group = prev.find((g) => g.id === id);
        if (group) addAudit(userEmail, "Deleted", `Group: ${group.name}`);
        return prev.filter((g) => g.id !== id);
      });
    },
    [addAudit]
  );

  return (
    <NRESPeopleContext.Provider value={{ people, groups, addPerson, updatePerson, deletePerson, addGroup, updateGroup, deleteGroup, auditLog }}>
      {children}
    </NRESPeopleContext.Provider>
  );
};

export const useNRESPeople = () => {
  const ctx = useContext(NRESPeopleContext);
  if (!ctx) throw new Error("useNRESPeople must be used within NRESPeopleProvider");
  return ctx;
};
