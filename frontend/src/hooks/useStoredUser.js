import { useEffect, useState } from "react";
import { getStoredUser, subscribeToStoredUser } from "../utils/authStorage";

export function useStoredUser() {
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => subscribeToStoredUser(setUser), []);

  return user;
}
