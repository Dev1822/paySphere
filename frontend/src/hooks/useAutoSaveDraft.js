import { useEffect, useRef, useState, useCallback } from 'react';
import { db } from '../db/db';

export function useAutoSaveDraft(formId, data, debounceMs = 2000) {
  const [lastSaved, setLastSaved] = useState(null);
  const dataRef = useRef(data);
  const timeoutRef = useRef(null);

  // Update ref to avoid triggering effect on every render if we don't want to
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Debounced save
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        const now = new Date();
        await db.drafts.put({
          id: formId,
          data: dataRef.current,
          updatedAt: now,
        });
        setLastSaved(now);
      } catch (error) {
        console.error('Failed to auto-save draft:', error);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, formId, debounceMs]);

  const clearDraft = useCallback(async () => {
    try {
      await db.drafts.delete(formId);
      setLastSaved(null);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  }, [formId]);

  return { lastSaved, clearDraft };
}

// Utility to manually get the draft before component mount / form initialization
export async function getDraft(formId) {
  try {
    return await db.drafts.get(formId);
  } catch (error) {
    console.error('Failed to get draft:', error);
    return null;
  }
}
