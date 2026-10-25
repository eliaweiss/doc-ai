import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { Organization } from "@zdocs/types";
import { zFetch } from "../lib/utils";

interface OrgState {
  org: Organization | null;
  organizations: Organization[];
  isLoadingOrgs: boolean;
  orgsFetched: boolean;
}

interface OrgActions {
  setOrg: (org: Organization | null) => void;
  setOrganizations: (organizations: Organization[]) => void;
  addOrganization: (organization: Organization) => void;
  removeOrganization: (orgId: string) => void;
  fetchOrganizations: () => Promise<Organization[]>;
}

type OrgStore = OrgState & OrgActions;

const initialState: OrgState = {
  org: null,
  organizations: [],
  isLoadingOrgs: false,
  orgsFetched: false,
};

// Module-level flag to prevent duplicate API calls
let isFetchInProgress = false;

export const useOrgStore = create<OrgStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,
        setOrg: (org) => set({ org }),
        setOrganizations: (organizations) => set({ organizations, orgsFetched: true }),
        addOrganization: (organization) => {
          const current = get().organizations;
          set({ organizations: [...current, organization] });
        },
        removeOrganization: (orgId) => {
          const current = get().organizations;
          set({ organizations: current.filter((o) => o.id !== orgId) });
        },
        fetchOrganizations: async () => {
          // Return cached if already fetched or fetch in progress
          if (get().orgsFetched || isFetchInProgress) {
            return get().organizations;
          }

          isFetchInProgress = true;
          set({ isLoadingOrgs: true });

          try {
            const data = await zFetch("/api/org/list-org", {
              method: "POST",
            });
            const organizations = data.organizations as Organization[];
            set({ organizations, orgsFetched: true, isLoadingOrgs: false });

            // Auto-select org if none selected
            const currentOrg = get().org;
            if (organizations.length > 0) {
              if (currentOrg) {
                // Refresh current org with fresh data
                const freshOrg = organizations.find((o) => o.id === currentOrg.id);
                if (freshOrg) {
                  set({ org: freshOrg });
                } else {
                  // Cached org no longer exists, select first
                  set({ org: organizations[0] });
                }
              } else {
                // No current org, select first
                set({ org: organizations[0] });
              }
            }

            return organizations;
          } catch (error) {
            console.error("Failed to fetch organizations:", error);
            set({ isLoadingOrgs: false, orgsFetched: true });
            return [];
          } finally {
            isFetchInProgress = false;
          }
        },
      }),
      {
        name: "org-storage",
        partialize: (state) => ({
          org: state.org,
          // Don't persist organizations list - always fetch fresh
        }),
      }
    )
  )
);

export default useOrgStore;
