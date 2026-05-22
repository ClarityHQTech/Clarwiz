"use client"

import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const { status } = useSession();
  const [user, setUser] = useState(undefined);
  const router = useRouter();
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");

  useEffect(() => {
    if(status){
      if (status === "loading") return; // Still loading session, do nothing
      if (status === "authenticated") {
        // fetch("/api/profile")
        //   .then(res => res.json())
        //   .then(data => setUser(data))
        //   .catch(() => setUser(null));

        const fetchUser = async () => {
          try {
            const response = await fetch('/api/profile');
            if (!response.ok) {
              setUser(null);
              if (!isAdminRoute) router.push('/');
              return;
            }
            const data = await response.json();
            setUser(data);
            if (isAdminRoute && data.role !== "admin") {
              router.replace("/dashboard");
            }
          } catch (error) {
            console.error(error);
            setUser(null);
          }
        }

        fetchUser();
      } else {
        setUser(null);
        router.push('/');
      }
    }
  }, [status, isAdminRoute, router]);

  return (
    <UserContext.Provider value={user}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
