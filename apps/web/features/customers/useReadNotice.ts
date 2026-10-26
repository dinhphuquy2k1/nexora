"use client";
import { useEffect, useId } from "react";
import { useToast } from "@nexora/ui";
import type { customerError } from "./errors.ts";
/** A current accepted read emits once per request intent; rerenders cannot create a Toast storm. */
export function useReadNotice(read: {
  error?: ReturnType<typeof customerError>;
  loading: boolean;
  settledId: number;
}) {
  const toast = useToast();
  const id = useId();
  useEffect(() => {
    if (read.error && !read.loading && !read.error.unauthenticated)
      toast.enqueue({
        id: `${id}-read-${read.settledId}`,
        tone: "error",
        message: read.error.message,
      });
  }, [read.error, read.loading, read.settledId, toast, id]);
}
