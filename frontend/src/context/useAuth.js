// Use Auth: Module level logic for the feature area.
import { useContext } from "react";
import { AuthContext } from "./auth-context-core";

// Use Auth: Runs Use auth flow. Inputs: none. Returns: a function result.
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
