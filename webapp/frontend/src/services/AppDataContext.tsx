// src/services/AppDataContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

// ── Type Definitions ──────────────────────────────────────────────────────────

export interface ClassHierarchyNode {
  id: string;
  label_en: string;
  label_ch?: string;
  poe_class?: string;           // only present on leaf nodes
  resolved_properties: string[];
  resolved_flags: string[];
  constraints?: Record<string, number>;
  children?: ClassHierarchyNode[];
}

export interface ClassProps {
  properties: string[];
  flags: string[];
  constraints: Record<string, number>;
}

export interface AppDataContextValue {
  classHierarchy: ClassHierarchyNode[];
  flatClasses: string[];
  classPropsMap: Record<string, ClassProps>;
  getLeafClassesUnder: (nodeId: string) => string[];
  loading: boolean;
  error: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * DFS walk of the hierarchy tree, collecting every poe_class value found on
 * leaf nodes (nodes that have a poe_class property).
 */
function collectLeafClasses(nodes: ClassHierarchyNode[]): string[] {
  const result: string[] = [];
  const walk = (node: ClassHierarchyNode) => {
    if (node.poe_class) {
      result.push(node.poe_class);
    }
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        walk(child);
      }
    }
  };
  for (const root of nodes) {
    walk(root);
  }
  return result;
}

/**
 * Find the node whose id === nodeId (DFS), then collect all leaf poe_class
 * values under that sub-tree.
 */
function collectLeafClassesUnder(
  nodes: ClassHierarchyNode[],
  nodeId: string
): ClassHierarchyNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    if (node.children && node.children.length > 0) {
      const found = collectLeafClassesUnder(node.children, nodeId);
      if (found) return found;
    }
  }
  return null;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AppDataContext = createContext<AppDataContextValue>({
  classHierarchy: [],
  flatClasses: [],
  classPropsMap: {},
  getLeafClassesUnder: () => [],
  loading: true,
  error: null,
});

// ── Provider ──────────────────────────────────────────────────────────────────

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [classHierarchy, setClassHierarchy] = useState<ClassHierarchyNode[]>([]);
  const [flatClasses, setFlatClasses] = useState<string[]>([]);
  const [classPropsMap, setClassPropsMap] = useState<Record<string, ClassProps>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';

    const fetchData = async () => {
      try {
        // In demo mode the demoAdapter intercepts /api/* routes automatically,
        // so we call the same endpoints.  If the bundle has class-hierarchy data
        // it will be served from the static JSON; otherwise the live API is used.
        const [hierarchyRes, propsRes] = await Promise.all([
          axios.get('/api/class-hierarchy'),
          axios.get('/api/class-properties'),
        ]);

        const hierarchy: ClassHierarchyNode[] = hierarchyRes.data?.hierarchy ?? [];
        setClassHierarchy(hierarchy);

        // Build flat list of all poe_class values via DFS
        const leaves = collectLeafClasses(hierarchy);
        setFlatClasses(leaves);

        // Build classPropsMap from the class-properties response.
        // Expected shape: { classes: { [poe_class]: { properties, flags, constraints } }, defaults: {...} }
        const rawProps = propsRes.data ?? {};
        const propsMap: Record<string, ClassProps> = {};
        const rawClasses: Record<string, any> = rawProps.classes ?? {};
        for (const [cls, val] of Object.entries(rawClasses)) {
          propsMap[cls] = {
            properties: (val as any).properties ?? [],
            flags: (val as any).flags ?? [],
            constraints: (val as any).constraints ?? {},
          };
        }
        setClassPropsMap(propsMap);
      } catch (err: any) {
        const msg = err?.message ?? 'Failed to load class hierarchy data';
        console.error('[AppDataContext] Load failed:', err);
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  /**
   * Return all leaf poe_class values under the node with the given id.
   * If nodeId is "all" or no matching node is found, the full flatClasses list
   * is returned.
   */
  const getLeafClassesUnder = (nodeId: string): string[] => {
    if (nodeId === 'all') return flatClasses;
    const node = collectLeafClassesUnder(classHierarchy, nodeId);
    if (!node) return flatClasses;
    return collectLeafClasses([node]);
  };

  return (
    <AppDataContext.Provider
      value={{ classHierarchy, flatClasses, classPropsMap, getLeafClassesUnder, loading, error }}
    >
      {children}
    </AppDataContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useAppData = (): AppDataContextValue => {
  return useContext(AppDataContext);
};
