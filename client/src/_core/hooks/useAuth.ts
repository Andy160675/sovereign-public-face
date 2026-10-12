import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

/**
 * Key this hook used to write the signed-in user's record to. The write is gone
 * (see the note in `state` below), but removing it does not clear the copies
 * already sitting in users' browsers — so clear it once on mount.
 */
const LEGACY_USER_INFO_KEY = "manus-runtime-user-info";

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_USER_INFO_KEY);
    } catch {
      // Private mode and blocked site-data both throw on access. Nothing to do:
      // if the store is unreadable there is no stale copy to remove.
    }
  }, []);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    // The signed-in user's record (id, email, name, role) used to be written to
    // localStorage under "manus-runtime-user-info" on every render.
    //
    // It had exactly one consumer, and it was not this app: the Manus runtime
    // inlined into the production bundle reads the key when it reports an error
    // (`userInfo: localStorage.getItem("manus-runtime-user-info")` in
    // vite-plugin-manus-runtime's runtime_dist). So removing the write does cost
    // something real — error reports lose user attribution — and that trade is
    // made deliberately rather than by accident.
    //
    // What the write cost instead: the account's email and role sat somewhere any
    // injected script could read, and stayed there. It happened inside a
    // `useMemo`, and on sign-out it stored the string "null" rather than clearing
    // the key, so a shared browser kept the previous user's details until
    // something overwrote them. Attribution on a crash report is not worth a
    // readable copy of every signed-in user's identity.
    //
    // That runtime only reads the key, so it will not repopulate it, which is why
    // clearing it once on mount is enough.
    //
    // Session identity itself is in an httpOnly cookie and was never here, so
    // removing this costs nothing and takes the readable copy away.
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
