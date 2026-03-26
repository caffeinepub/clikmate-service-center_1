/**
 * Simple hash-based router utility for ClikMate.
 * Uses window.location.hash for navigation.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface RouterState {
  path: string;
  params: Record<string, string>;
  navigate: (to: string) => void;
}

export const RouterContext = createContext<RouterState>({
  path: "/",
  params: {},
  navigate: () => {},
});

function getHashPath(): string {
  const hash = window.location.hash;
  if (!hash || hash === "#") return "/";
  return hash.startsWith("#/") ? hash.slice(1) : hash.slice(1) || "/";
}

function matchRoute(
  pattern: string,
  path: string,
): { matched: boolean; params: Record<string, string> } {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) {
    return { matched: false, params: {} };
  }
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return { matched: false, params: {} };
    }
  }
  return { matched: true, params };
}

export function HashRouter({ children }: { children: React.ReactNode }) {
  const [path, setPath] = useState<string>(getHashPath);

  useEffect(() => {
    function onHashChange() {
      setPath(getHashPath());
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((to: string) => {
    window.location.hash = `#${to}`;
  }, []);

  const value = useMemo(
    () => ({ path, params: {}, navigate }),
    [path, navigate],
  );

  return (
    <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
  );
}

interface RouteProps {
  path: string;
  element: React.ReactNode;
}

export function Routes({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function Route({ path, element }: RouteProps) {
  const ctx = useContext(RouterContext);
  const { path: currentPath, navigate } = ctx;
  const { matched, params } = matchRoute(path, currentPath);
  if (!matched) return null;
  return (
    <RouterContext.Provider value={{ path: currentPath, params, navigate }}>
      {element}
    </RouterContext.Provider>
  );
}

export function useNavigate() {
  return useContext(RouterContext).navigate;
}

export function useParams<T extends Record<string, string>>(): Partial<T> {
  return useContext(RouterContext).params as Partial<T>;
}

export function Link({
  to,
  children,
  className,
  "data-ocid": dataOcid,
  style,
  ...rest
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
  "data-ocid"?: string;
  style?: React.CSSProperties;
  [key: string]: unknown;
}) {
  const { navigate } = useContext(RouterContext);
  return (
    <a
      href={`#${to}`}
      className={className}
      data-ocid={dataOcid}
      style={style}
      onClick={(e) => {
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
