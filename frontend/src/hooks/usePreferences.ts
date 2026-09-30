import { useContext } from "react";
import {
  PreferencesContext,
  PreferencesContextValue,
} from "../context/preferences-context";

export function usePreferences(): PreferencesContextValue {
  return useContext(PreferencesContext);
}
