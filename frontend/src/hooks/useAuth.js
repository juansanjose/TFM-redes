import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Keycloak from "keycloak-js";

const DEFAULTS = {
  url: process.env.REACT_APP_KEYCLOAK_URL ?? "http://localhost:8082",
  realm: process.env.REACT_APP_KEYCLOAK_REALM ?? "tfm",
  clientId: process.env.REACT_APP_KEYCLOAK_CLIENT_ID ?? "tfm-frontend",
};

const AuthContext = createContext(null);

function createKeycloakInstance() {
  return new Keycloak({
    url: DEFAULTS.url,
    realm: DEFAULTS.realm,
    clientId: DEFAULTS.clientId,
  });
}

export function AuthProvider({ children }) {
  const keycloakRef = useRef(null);
  if (!keycloakRef.current) {
    keycloakRef.current = createKeycloakInstance();
  }

  const keycloak = keycloakRef.current;
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  const silentCheckSsoRedirectUri = React.useMemo(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    return `${window.location.origin}/silent-check-sso.html`;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const authenticated = await keycloak.init({
          onLoad: "check-sso",
          checkLoginIframe: false,
          pkceMethod: "S256",
          silentCheckSsoRedirectUri,
        });
        if (cancelled) return;
        setIsAuthenticated(authenticated);
        if (authenticated) {
          setToken(keycloak.token ?? null);
          setProfile(keycloak.tokenParsed ?? null);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Keycloak init failed", err);
        setError(err instanceof Error ? err.message : String(err));
        setIsAuthenticated(false);
        setToken(null);
        setProfile(null);
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    };

    init();

    keycloak.onTokenExpired = () => {
      keycloak
        .updateToken(60)
        .then((refreshed) => {
          if (refreshed && !cancelled) {
            setToken(keycloak.token ?? null);
            setProfile(keycloak.tokenParsed ?? null);
          }
        })
        .catch((err) => {
          console.warn("Failed to refresh token", err);
          keycloak.login();
        });
    };

    return () => {
      cancelled = true;
    };
  }, [keycloak, silentCheckSsoRedirectUri]);

  const login = useCallback(() => keycloak.login(), [keycloak]);

  const logout = useCallback(() => keycloak.logout({ redirectUri: window.location.origin }), [keycloak]);

  const getToken = useCallback(async () => {
    if (!isAuthenticated) return null;
    try {
      const refreshed = await keycloak.updateToken(60);
      if (refreshed) {
        setToken(keycloak.token ?? null);
        setProfile(keycloak.tokenParsed ?? null);
      }
    } catch (err) {
      console.warn("Unable to refresh token", err);
      keycloak.login();
      return null;
    }
    return keycloak.token ?? null;
  }, [isAuthenticated, keycloak]);

  const apiBase = useMemo(() => process.env.REACT_APP_API_BASE ?? "", []);

  const fetchWithAuth = useCallback(
    async (path, { method = "GET", body, headers } = {}) => {
      const currentToken = await getToken();
      const mergedHeaders = {
        "Content-Type": "application/json",
        ...(headers ?? {}),
      };
      if (currentToken) {
        mergedHeaders.Authorization = `Bearer ${currentToken}`;
      }
      const response = await fetch(`${apiBase}${path}`, {
        method,
        headers: mergedHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed with status ${response.status}`);
      }
      if (response.status === 204) return null;
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        return response.json();
      }
      return response.text();
    },
    [apiBase, getToken]
  );

  const value = useMemo(
    () => ({
      isInitializing,
      isAuthenticated,
      token,
      profile,
      error,
      login,
      logout,
      keycloak,
      getToken,
      fetchWithAuth,
    }),
    [isInitializing, isAuthenticated, token, profile, error, keycloak, login, logout, getToken, fetchWithAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
