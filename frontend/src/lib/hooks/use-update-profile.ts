"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { profileApi } from "@/lib/api/profile";
import { queryKeys } from "@/lib/api/query-keys";
import { useAuth } from "@/lib/auth/auth-provider";

/** On success, writes straight into both the TanStack cache (`auth.me`,
 * shared with useProfile) and AuthProvider's in-memory user (read by
 * AccountLayout's sidebar, the header user menu, etc.) — a profile update
 * must be reflected everywhere the name is shown, not just the form that
 * submitted it. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { setUser } = useAuth();

  return useMutation({
    mutationFn: (fullName: string) => profileApi.updateProfile(fullName),
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.auth.me, user);
      setUser(user);
    },
  });
}
