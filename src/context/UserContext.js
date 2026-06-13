"use client"

import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

const UserContext = createContext(null);

const PROTECTED_PREFIXES = ["/dashboard", "/campaigns", "/collaterals", "/integrations", "/context", "/teams", "/pricing", "/profile"];

export const UserProvider = ({ children }) => {
  const { status } = useSession();
  const [user, setUser] = useState(undefined);
  const router = useRouter();
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");
  const isProtectedRoute = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname?.startsWith(`${p}/`)
  );

  useEffect(() => {
    if (!status) return;

    if (status === "loading") return;

    if (status === "authenticated") {
      const fetchUser = async () => {
        try {
          const response = await fetch("/api/profile");
          if (!response.ok) {
            setUser(null);
            if (isProtectedRoute || isAdminRoute) {
              router.replace("/");
            }
            return;
          }
          const data = await response.json();
          setUser(data);
          if (isAdminRoute && !data.isSuperadmin) {
            router.replace("/dashboard");
          }
        } catch (error) {
          console.error(error);
          setUser(null);
          if (isProtectedRoute || isAdminRoute) {
            router.replace("/");
          }
        }
      };

      fetchUser();
      return;
    }

    setUser(null);
    if (isProtectedRoute || isAdminRoute) {
      router.replace("/");
    }
  }, [status, isAdminRoute, isProtectedRoute, router]);

  return (
    <UserContext.Provider value={user}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
